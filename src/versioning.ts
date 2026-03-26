import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import path from 'path'

export function getNextVersion(promptName: string, versionsDir: string): number {
  const resolved = path.resolve(versionsDir)
  if (!existsSync(resolved)) {
    mkdirSync(resolved, { recursive: true })
    return 1
  }
  const files = readdirSync(resolved)
  const pattern = new RegExp(`^${promptName}-v(\\d+)\\.txt$`)
  let maxVersion = 0
  for (const file of files) {
    const match = file.match(pattern)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > maxVersion) maxVersion = n
    }
  }
  return maxVersion + 1
}

export function saveVersion(promptName: string, content: string, versionsDir: string): string {
  const resolved = path.resolve(versionsDir)
  if (!existsSync(resolved)) {
    mkdirSync(resolved, { recursive: true })
  }
  const version = getNextVersion(promptName, versionsDir)
  const versionPath = path.join(resolved, `${promptName}-v${version}.txt`)
  writeFileSync(versionPath, content, 'utf-8')
  return versionPath
}
