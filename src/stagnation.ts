import type { ProviderScores } from './parser.js'

export function findFailingPrompts(scores: ProviderScores, threshold: number): string[] {
  const failing: string[] = []
  for (const [provider, dimMap] of scores.entries()) {
    for (const [, data] of dimMap.entries()) {
      if (data.score < threshold) {
        failing.push(provider)
        break
      }
    }
  }
  return failing
}

export function isStagnant(
  prev: ProviderScores,
  current: ProviderScores,
  threshold: number,
  stagnationThreshold: number
): boolean {
  let anyImprovement = false

  for (const [provider, currentDimMap] of current.entries()) {
    const prevDimMap = prev.get(provider)
    if (!prevDimMap) continue

    for (const [dimension, currentData] of currentDimMap.entries()) {
      if (currentData.score >= threshold) continue

      const prevData = prevDimMap.get(dimension)
      if (!prevData) continue

      const improvement = currentData.score - prevData.score
      if (improvement >= stagnationThreshold) {
        anyImprovement = true
        break
      }
    }
    if (anyImprovement) break
  }

  return !anyImprovement
}
