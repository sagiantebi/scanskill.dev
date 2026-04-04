import type { QueueMessage } from '../../../backend/src/types'

export type { QueueMessage }

const COMMAND_MAX_LEN = 400

const splitRegex = /\s*(?:&&|\|\||[;|]|\band\s+execute\b|\bthen\b|\band\s+run\b)\s*/i
const commandStartRegex = /^(?:curl|wget|rm\s+-rf|sudo|chmod|chown|exec|eval|bash\s+-c|node|npm|npx|pnpm|yarn|powershell|sh)\b/i

function lineShellRegex(): RegExp {
  return /\b(?:curl|wget|rm\s+-rf|sudo|chmod|chown|exec|eval|bash\s+-c|node|npm|npx|pnpm|yarn|powershell|sh)\b[^\n]*/gi
}

function capShellCommand(s: string): string {
  if (s.length <= COMMAND_MAX_LEN) return s
  return `${s.slice(0, COMMAND_MAX_LEN - 1)}…`
}

/** Drop trailing markdown / list noise after a URL in the same “command” line. */
export function trimProseAfterUrl(cmd: string): string {
  const m = cmd.match(/https?:\/\/[^\s<>"'`\])]+/i)
  if (!m || m.index === undefined) return cmd
  const urlEnd = m.index + m[0].length
  let tail = cmd.slice(urlEnd).replace(/^[)\],.;:!?'`]*\s*/, '')
  if (!tail) return cmd.slice(0, urlEnd).trim()
  if (/^(?:for|to|and|see|visit|read|check|at|refer|from)\b/i.test(tail)) {
    return cmd.slice(0, urlEnd).trim()
  }
  const t = tail.trim()
  if (
    t.length > 20 &&
    /^[a-z0-9 ,.;:'"’_\-]+$/i.test(t) &&
    !/[|&;`$(){}\[\]]/.test(t)
  ) {
    return cmd.slice(0, urlEnd).trim()
  }
  return cmd
}

function trimTrailingMarkdownNoise(s: string): string {
  return s.replace(/\)+$/g, '').replace(/\]+$/g, '').trim()
}

function polishShellCommand(part: string): string {
  let s = part.trim().replace(/[.,!?]+$/g, '')
  s = trimProseAfterUrl(s)
  s = trimTrailingMarkdownNoise(s)
  return capShellCommand(s)
}

function extractShellCommandsFromChunk(chunk: string): string[] {
  const rawMatches = chunk.match(lineShellRegex()) || []
  const extracted: string[] = []

  for (const raw of rawMatches) {
    const parts = raw
      .split(splitRegex)
      .map((p) => p.trim().replace(/[.,!?]+$/g, ''))
      .filter(Boolean)

    for (const part of parts) {
      commandStartRegex.lastIndex = 0
      if (commandStartRegex.test(part)) {
        extracted.push(polishShellCommand(part))
      }
    }
  }

  return extracted
}

/**
 * Deterministic shell-like fragments. Merges worker1 `shellCommandCandidates` (code fences / line matches)
 * with a full-text pass so patterns like `eval(` are still caught outside those segments.
 */
export function extractShellCommands(text: string, shellCommandCandidates?: string[]): string[] {
  const fromCandidates = (shellCommandCandidates ?? []).flatMap((c) => extractShellCommandsFromChunk(c))
  const fromBody = extractShellCommandsFromChunk(text)
  return [...new Set([...fromCandidates, ...fromBody])]
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
