import type { QueueMessage } from '../../../backend/src/types'

export type { QueueMessage }

/** Hostnames that are not actionable URLs (placeholders, ellipsis prose). */
const NON_ACTIONABLE_HOSTNAMES = new Set([
  '...',
  '..',
  '.',
  'your-domain',
  'yourdomain',
  'hostname',
  'domain',
])

export function isValidHttpUrl(candidate: string): boolean {
  const trimmed = candidate.replace(/[)\],.;:!?'`]+$/g, '').trim()
  if (!trimmed) return false
  let u: URL
  try {
    u = new URL(trimmed)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  if (!host || /^\.+$/.test(host)) return false
  if (NON_ACTIONABLE_HOSTNAMES.has(host)) return false
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (!host.includes('.') && !host.startsWith('[')) {
    return false
  }
  return true
}

export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"']+/g
  const raw = [...new Set(text.match(urlRegex) || [])]
  return raw.filter(isValidHttpUrl)
}
