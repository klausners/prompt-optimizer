import { execSync } from 'child_process'
import path from 'path'
import os from 'os'
import type { OptimizerConfig } from './config.js'

export function runEval(config: OptimizerConfig): void {
  const evalConfigResolved = path.resolve(config.evalConfig)
  const evalDir = path.dirname(evalConfigResolved)
  const configFile = path.basename(evalConfigResolved)
  const outputPath = path.join(os.tmpdir(), 'eval-results.json')

  let cmd: string
  if (config.envFile) {
    const envFileResolved = path.resolve(config.envFile)
    cmd = `cd "${evalDir}" && source "${envFileResolved}" && NODE_OPTIONS="--import tsx" npx promptfoo eval -c "${configFile}" -j 1 --env-file "${envFileResolved}" -o "${outputPath}"`
  } else {
    cmd = `cd "${evalDir}" && NODE_OPTIONS="--import tsx" npx promptfoo eval -c "${configFile}" -j 1 -o "${outputPath}"`
  }

  try {
    execSync(cmd, {
      stdio: 'inherit',
      shell: '/bin/bash',
      timeout: 1_200_000, // 20 min
    })
  } catch (error: any) {
    if (error.status === 127 || error.code === 'ENOENT') {
      throw new Error(
        'promptfoo not found. Install it in your project: npm install -D promptfoo'
      )
    }
    throw new Error(
      `promptfoo eval failed (exit code ${error.status}): ${error.stderr?.toString() ?? ''}`
    )
  }
}
