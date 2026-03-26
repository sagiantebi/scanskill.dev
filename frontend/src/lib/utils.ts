export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'failed'
}

export function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls.filter(Boolean))]
}

export function parseUrlMode(urlTrim: string): boolean {
  if (!urlTrim) return false
  try {
    new URL(urlTrim)
    return true
  } catch {
    return false
  }
}
