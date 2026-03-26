import type { QueueMessage } from '../../../backend/src/types'

export type { QueueMessage }

export function extractShellCommands(text: string): string[] {
  const shellRegex = /\b(?:curl|wget|rm\s+-rf|sudo|chmod|chown|exec|eval|bash\s+-c|node|npm|npx|pnpm|yarn|powershell|sh)\b[^\n]*/gi
  const splitRegex = /\s*(?:&&|\|\||[;|]|\band\s+execute\b|\bthen\b|\band\s+run\b)\s*/i
  const commandStartRegex = /^(?:curl|wget|rm\s+-rf|sudo|chmod|chown|exec|eval|bash\s+-c|node|npm|npx|pnpm|yarn|powershell|sh)\b/i

  const rawMatches = text.match(shellRegex) || []
  const extracted: string[] = []

  for (const raw of rawMatches) {
    const parts = raw
      .split(splitRegex)
      .map((part) => part.trim().replace(/[.,!?]+$/g, ''))
      .filter(Boolean)

    for (const part of parts) {
      if (commandStartRegex.test(part)) {
        extracted.push(part)
      }
    }
  }

  return [...new Set(extracted)]
}

export function detectInjections(text: string): string[] {
  const injectionPatterns = [
    /eval\(/i, /Function\(/i, /innerHTML/i, /dangerouslySetInnerHTML/i,
    /<script/i, /javascript:/i, /ignore\s+previous\s+instructions/i,
    /system\s+prompt/i, /developer\s+message/i
  ]
  return injectionPatterns
    .filter(pattern => pattern.test(text))
    .map(p => p.toString())
}

export function getTagsFromText(text: string): string[] {
  const tags: string[] = []
  if (/shell|bash|command|terminal/i.test(text)) tags.push('shell-commands')
  if (/url|http|api|fetch|axios/i.test(text)) tags.push('access-websites')
  if (/react|typescript|javascript|python/i.test(text)) tags.push('programming')
  if (/\b(nodejs|node\.js|node|npm|npx|pnpm|yarn)\b/i.test(text)) tags.push('nodejs')
  if (/(?:base64|atob\(|fromcharcode|\\x[0-9a-f]{2}|%[0-9a-f]{2})/i.test(text)) tags.push('obfuscated')
  return tags
}
