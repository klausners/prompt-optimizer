import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import os from 'os'
import type { OptimizerConfig } from './config.js'
import type { DimensionScores } from './parser.js'

const REWRITER_SYSTEM =
  'You are a prompt engineering assistant. Return only the rewritten prompt text. No commentary, no markdown fences, no preamble.'

export async function rewritePrompt(
  promptFile: string,
  scores: DimensionScores,
  rubrics: Record<string, string>,
  config: OptimizerConfig,
  isShared?: boolean,
  providerNames?: string[]
): Promise<string | null> {
  const filePath = path.join(path.resolve(config.promptsDir), promptFile)
  const original = readFileSync(filePath, 'utf-8')

  const failingDimensions = Array.from(scores.entries()).filter(
    ([, data]) => data.score < config.threshold
  )

  const scoreSummary = Array.from(scores.entries())
    .map(([dim, data]) => `  ${dim}: ${data.score.toFixed(2)}/5.0`)
    .join('\n')

  let failingDetails = ''
  for (const [dim, data] of failingDimensions) {
    failingDetails += `\n### ${dim} (score: ${data.score.toFixed(2)})\n`
    const sampleReasons = data.reasons.slice(0, 3)
    for (const reason of sampleReasons) {
      const stripped = reason.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim()
      failingDetails += `Judge reasoning: ${stripped}\n`
    }
  }

  let rubricDefs = '\n## Evaluation rubrics (what the judge checks):\n'
  for (const [dim] of failingDimensions) {
    const rubric = rubrics[dim]
    if (rubric) {
      rubricDefs += `\n### ${dim}:\n${rubric}\n`
    }
  }

  let userMessage = `You are rewriting the following AI system prompt to improve its quality scores.

## Current prompt:
${original}

## Current scores (mean across test cases):
${scoreSummary}

## Failing dimensions (below ${config.threshold}) — improve these:
${failingDetails}
${rubricDefs}

Rewrite the prompt to improve the failing dimensions. Preserve all existing {{placeholder}} variables exactly as-is. Return only the rewritten prompt text.`

  if (isShared && providerNames && providerNames.length > 1) {
    userMessage += `\n\nThis prompt is shared by multiple providers (${providerNames.join(', ')}). Do not optimize for one at the expense of the other.`
  }

  try {
    // Build a temporary promptfoo config to run the rewrite through any provider
    const tmpDir = path.join(os.tmpdir(), 'prompt-optimizer-rewrite')
    mkdirSync(tmpDir, { recursive: true })

    const rewriteConfig = {
      providers: [config.rewriterModel],
      prompts: [`${REWRITER_SYSTEM}\n\n---\n\n{{message}}`],
      tests: [{ vars: { message: userMessage } }],
    }

    const configPath = path.join(tmpDir, 'rewrite-config.yaml')
    const outputPath = path.join(tmpDir, 'rewrite-output.json')

    // Write config as JSON (promptfoo accepts both YAML and JSON)
    writeFileSync(configPath, JSON.stringify(rewriteConfig, null, 2), 'utf-8')

    let cmd = `npx promptfoo eval -c "${configPath}" -o "${outputPath}" --no-cache`
    if (config.envFile) {
      const envFileResolved = path.resolve(config.envFile)
      cmd = `source "${envFileResolved}" && ${cmd} --env-file "${envFileResolved}"`
    }

    execSync(cmd, {
      stdio: 'pipe',
      shell: '/bin/bash',
      timeout: 300_000, // 5 min
    })

    const output = JSON.parse(readFileSync(outputPath, 'utf-8'))
    const result = output?.results?.results?.[0]
    if (!result?.response?.output) return null

    let cleaned = String(result.response.output).trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
    }

    // Validate all original {{placeholder}}s are preserved
    const originalPlaceholders = new Set(original.match(/\{\{[\w]+\}\}/g) || [])
    const rewrittenPlaceholders = new Set(cleaned.match(/\{\{[\w]+\}\}/g) || [])
    for (const p of originalPlaceholders) {
      if (!rewrittenPlaceholders.has(p)) {
        console.log(`  REJECTED: placeholder ${p} missing from rewrite`)
        return null
      }
    }

    return cleaned
  } catch (error: any) {
    console.log(`  Rewrite error: ${error.message}`)
    return null
  }
}
