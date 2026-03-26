import { readFileSync } from 'fs'
import path from 'path'
import os from 'os'
import type { OptimizerConfig } from './config.js'

export type DimensionScores = Map<string, { score: number; reasons: string[] }>
export type ProviderScores = Map<string, DimensionScores>

export function detectDimension(
  assertionValue: string,
  dimensions: Record<string, string>
): string | null {
  // dimensions is name -> keyword (e.g. { depth: 'PROFUNDIDADE' })
  for (const [name, keyword] of Object.entries(dimensions)) {
    if (assertionValue.includes(keyword)) {
      return name
    }
  }
  return null
}

export function parseResults(config: OptimizerConfig): ProviderScores {
  const evalOutput = path.join(os.tmpdir(), 'eval-results.json')
  const raw = readFileSync(evalOutput, 'utf-8')
  const data = JSON.parse(raw)
  const results: any[] = data?.results?.results ?? []

  const accumulator = new Map<string, Map<string, { scores: number[]; reasons: string[] }>>()
  const providerTotal = new Map<string, number>()
  const providerNoGrading = new Map<string, number>()

  for (const result of results) {
    const provider: string = result?.provider?.label ?? 'unknown'
    providerTotal.set(provider, (providerTotal.get(provider) ?? 0) + 1)

    if (!result?.gradingResult) {
      providerNoGrading.set(provider, (providerNoGrading.get(provider) ?? 0) + 1)
      continue
    }

    const componentResults: any[] = result.gradingResult?.componentResults ?? []

    for (const component of componentResults) {
      const assertionValue: string = component?.assertion?.value ?? ''
      const dimension = detectDimension(assertionValue, config.dimensions)
      if (!dimension) continue

      const reason: string = component?.reason ?? ''
      const match = reason.match(/<score>(\d+)<\/score>/)
      if (!match) continue

      const score = parseInt(match[1], 10)

      if (!accumulator.has(provider)) {
        accumulator.set(provider, new Map())
      }
      const dimMap = accumulator.get(provider)!

      if (!dimMap.has(dimension)) {
        dimMap.set(dimension, { scores: [], reasons: [] })
      }
      const dimData = dimMap.get(dimension)!
      dimData.scores.push(score)
      dimData.reasons.push(reason)
    }
  }

  // Guard: abort if > 50% of test cases for a provider have no gradingResult
  for (const [provider, total] of providerTotal.entries()) {
    const noGrading = providerNoGrading.get(provider) ?? 0
    if (noGrading > total * 0.5) {
      throw new Error(
        `Provider "${provider}" has ${noGrading}/${total} test cases without gradingResult. ` +
          `Cannot compute meaningful scores. Check eval logs for errors.`
      )
    }
  }

  // Compute means
  const finalMap: ProviderScores = new Map()
  for (const [provider, dimMap] of accumulator.entries()) {
    const providerResult: DimensionScores = new Map()
    for (const [dimension, data] of dimMap.entries()) {
      const mean = data.scores.reduce((a, b) => a + b, 0) / data.scores.length
      providerResult.set(dimension, { score: mean, reasons: data.reasons })
    }
    finalMap.set(provider, providerResult)
  }

  return finalMap
}
