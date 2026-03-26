import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { loadConfig } from './config.js'
import { runEval } from './eval-runner.js'
import { parseResults, type ProviderScores } from './parser.js'
import { rewritePrompt } from './rewriter.js'
import { saveVersion } from './versioning.js'
import { findFailingPrompts, isStagnant } from './stagnation.js'
import { displayScores, displayDiagnostics, displayFinalReport } from './display.js'
import { loadRubrics } from './rubrics.js'
import { askUser } from './utils.js'

function parseArgs(): string {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-c' && args[i + 1]) {
      return args[i + 1]
    }
  }
  return 'prompt-optimizer.config.yaml'
}

async function main() {
  const configPath = parseArgs()
  const config = loadConfig(configPath)
  const dimensions = Object.keys(config.dimensions)

  const rubrics = loadRubrics(config.evalConfig)
  const history: ProviderScores[] = []

  for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
    console.log(`\n=== Prompt Optimizer - Iteracao ${iteration}/${config.maxIterations} ===\n`)
    console.log('Rodando eval...')

    runEval(config)
    const scores = parseResults(config)
    history.push(scores)
    displayScores(scores, iteration, dimensions, config.threshold)

    const failing = findFailingPrompts(scores, config.threshold)
    if (failing.length === 0) {
      console.log('\nTodos os prompts acima do threshold. Nenhuma otimizacao necessaria.')
      break
    }

    if (iteration > 1) {
      const prev = history[history.length - 2]
      if (isStagnant(prev, scores, config.threshold, config.stagnationThreshold)) {
        console.log(`\nParado: nenhuma dimensao melhorou >= ${config.stagnationThreshold}.`)
        displayDiagnostics(scores, config.threshold)
        break
      }
    }

    console.log(`\nPrompts abaixo de ${config.threshold}: ${failing.join(', ')}`)
    const answer = await askUser('\nDeseja otimizar automaticamente? (s/n): ')

    if (answer.toLowerCase() !== 's') {
      displayDiagnostics(scores, config.threshold)
      if (iteration > 1) displayFinalReport(history)
      break
    }

    // Deduplicate by file: group failing providers that share the same prompt file
    const fileToProviders = new Map<string, string[]>()
    for (const provider of failing) {
      const file = config.providerToFile[provider]
      if (!file) continue
      const existing = fileToProviders.get(file) || []
      existing.push(provider)
      fileToProviders.set(file, existing)
    }

    let changed = false
    for (const [file, providers] of fileToProviders) {
      const filePath = path.join(path.resolve(config.promptsDir), file)
      const current = readFileSync(filePath, 'utf-8')

      console.log(`\nOtimizando ${file} (${providers.join(', ')})...`)
      const versionPath = saveVersion(file.replace('.txt', ''), current, config.versionsDir)
      console.log(`  Salvo: ${versionPath}`)

      // Merge scores from all providers that use this file, keeping worst per dimension
      const mergedScores = new Map<string, { score: number; reasons: string[] }>()
      for (const provider of providers) {
        const providerScores = scores.get(provider)
        if (!providerScores) continue
        for (const [dim, data] of providerScores) {
          const existing = mergedScores.get(dim)
          if (!existing || data.score < existing.score) {
            mergedScores.set(dim, data)
          }
        }
      }

      const isShared = providers.length > 1
      const rewritten = await rewritePrompt(
        file,
        mergedScores,
        rubrics,
        config,
        isShared,
        providers
      )
      if (rewritten && rewritten !== current) {
        writeFileSync(filePath, rewritten, 'utf-8')
        console.log(`  Reescrito: ${file}`)
        changed = true
      } else {
        console.log(`  Sem mudancas (rewrite rejeitado ou identico)`)
      }
    }

    if (!changed) {
      console.log('\nNenhuma mudanca aplicada. Parando.')
      break
    }
  }

  if (history.length > 1) displayFinalReport(history)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
