import type { QueueMessage } from '../../../backend/src/types'

export type { QueueMessage }

export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"']+/g
  return [...new Set(text.match(urlRegex) || [])]
}
