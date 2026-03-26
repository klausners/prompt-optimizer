import { readFileSync } from 'fs'
import path from 'path'
import { parse } from 'yaml'

export function loadRubrics(evalConfigPath: string): Record<string, string> {
  const resolved = path.resolve(evalConfigPath)
  const raw = readFileSync(resolved, 'utf-8')
  const config = parse(raw)
  const templates = config?.assertionTemplates

  if (!templates) {
    console.log('Warning: No assertionTemplates found — rewriter will run without rubric context')
    return {}
  }

  const rubrics: Record<string, string> = {}
  for (const [name, template] of Object.entries<any>(templates)) {
    const value: string = template?.value ?? ''
    const sanitized = value.replace(/\{\{[\w]+\}\}/g, '[test variable]')
    rubrics[name] = sanitized
  }
  return rubrics
}
