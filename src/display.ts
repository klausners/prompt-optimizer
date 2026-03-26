import type { ProviderScores } from './parser.js'

export function displayScores(
  scores: ProviderScores,
  iteration: number,
  dimensions: string[],
  threshold: number
): void {
  console.log(`\n--- Scores (Iteracao ${iteration}) ---`)

  const colWidths = dimensions.map((d) => Math.max(d.length + 2, 8))
  const header = ['Provider'.padEnd(20)]
  for (let i = 0; i < dimensions.length; i++) {
    header.push(dimensions[i].padEnd(colWidths[i]))
  }
  console.log(header.join(' '))
  console.log('-'.repeat(20 + colWidths.reduce((a, b) => a + b + 1, 0)))

  for (const [provider, dimMap] of scores.entries()) {
    const row = [provider.padEnd(20)]
    for (let i = 0; i < dimensions.length; i++) {
      const dim = dimensions[i]
      const data = dimMap.get(dim)
      const scoreStr = data ? data.score.toFixed(2) : 'N/A'
      const flagged = data && data.score < threshold ? '*' : ' '
      row.push((scoreStr + flagged).padEnd(colWidths[i]))
    }
    console.log(row.join(' '))
  }
  console.log(`\n* = below threshold (${threshold})`)
}

export function displayDiagnostics(scores: ProviderScores, threshold: number): void {
  console.log('\n=== Diagnosticos detalhados ===\n')
  for (const [provider, dimMap] of scores.entries()) {
    const failingDims = Array.from(dimMap.entries()).filter(([, d]) => d.score < threshold)
    if (failingDims.length === 0) continue

    console.log(`Provider: ${provider}`)
    for (const [dimension, data] of failingDims) {
      console.log(`  Dimensao: ${dimension} (score: ${data.score.toFixed(2)})`)
      const sample = data.reasons.slice(0, 2)
      for (const reason of sample) {
        const stripped = reason.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim()
        console.log(`    Juiz: ${stripped.slice(0, 300)}...`)
      }
    }
    console.log()
  }
}

export function displayFinalReport(history: ProviderScores[]): void {
  console.log('\n=== Relatorio Final: Evolucao dos Scores ===\n')
  const first = history[0]
  const last = history[history.length - 1]

  console.log(
    `${'Provider'.padEnd(20)} ${'Dimension'.padEnd(15)} ${'Inicial'.padEnd(10)} ${'Final'.padEnd(10)} ${'Delta'.padEnd(8)}`
  )
  console.log('-'.repeat(65))

  for (const [provider, dimMap] of first.entries()) {
    const lastDimMap = last.get(provider)
    for (const [dimension, initData] of dimMap.entries()) {
      const finalData = lastDimMap?.get(dimension)
      const finalScore = finalData?.score ?? initData.score
      const delta = finalScore - initData.score
      const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(2)
      console.log(
        `${provider.padEnd(20)} ${dimension.padEnd(15)} ${initData.score.toFixed(2).padEnd(10)} ${finalScore.toFixed(2).padEnd(10)} ${deltaStr.padEnd(8)}`
      )
    }
  }
}
