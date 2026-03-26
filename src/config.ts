import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { parse } from 'yaml'

export interface OptimizerConfig {
  promptsDir: string
  evalConfig: string
  envFile?: string
  versionsDir: string
  threshold: number
  maxIterations: number
  stagnationThreshold: number
  rewriterModel: string
  dimensions: Record<string, string>
  providerToFile: Record<string, string>
}

export function loadConfig(configPath: string): OptimizerConfig {
  const resolved = path.resolve(configPath)
  if (!existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`)
  }

  const raw = readFileSync(resolved, 'utf-8')
  const parsed = parse(raw)

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid config file: ${resolved}`)
  }

  const config: OptimizerConfig = {
    promptsDir: parsed.promptsDir,
    evalConfig: parsed.evalConfig,
    envFile: parsed.envFile,
    versionsDir: parsed.versionsDir,
    threshold: parsed.threshold ?? 4.0,
    maxIterations: parsed.maxIterations ?? 3,
    stagnationThreshold: parsed.stagnationThreshold ?? 0.3,
    rewriterModel: parsed.rewriterModel ?? 'openai:gpt-4o',
    dimensions: parsed.dimensions,
    providerToFile: parsed.providerToFile,
  }

  // Validate required fields
  if (!config.promptsDir) throw new Error('Config missing required field: promptsDir')
  if (!config.evalConfig) throw new Error('Config missing required field: evalConfig')
  if (!config.versionsDir) throw new Error('Config missing required field: versionsDir')
  if (!config.dimensions || Object.keys(config.dimensions).length === 0) {
    throw new Error('Config missing required field: dimensions')
  }
  if (!config.providerToFile || Object.keys(config.providerToFile).length === 0) {
    throw new Error('Config missing required field: providerToFile')
  }

  // Validate paths exist on disk
  const promptsDir = path.resolve(config.promptsDir)
  if (!existsSync(promptsDir)) {
    throw new Error(`promptsDir does not exist: ${promptsDir}`)
  }

  const evalConfig = path.resolve(config.evalConfig)
  if (!existsSync(evalConfig)) {
    throw new Error(`evalConfig does not exist: ${evalConfig}`)
  }

  return config
}
