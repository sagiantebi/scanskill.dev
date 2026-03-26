import { describe, expect, it } from 'vitest'
import { dedupeUrls, escapeHtml, isTerminal, parseUrlMode } from '../utils'

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;',
    )
  })

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('escapes multiple special characters together', () => {
    expect(escapeHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d')
  })
})

describe('isTerminal', () => {
  it('returns true for completed', () => {
    expect(isTerminal('completed')).toBe(true)
  })

  it('returns true for failed', () => {
    expect(isTerminal('failed')).toBe(true)
  })

  it('returns false for queued', () => {
    expect(isTerminal('queued')).toBe(false)
  })

  it('returns false for processing', () => {
    expect(isTerminal('processing')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isTerminal('')).toBe(false)
  })
})

describe('dedupeUrls', () => {
  it('removes duplicate URLs', () => {
    expect(
      dedupeUrls([
        'https://a.com',
        'https://b.com',
        'https://a.com',
      ]),
    ).toEqual(['https://a.com', 'https://b.com'])
  })

  it('filters out empty strings', () => {
    expect(dedupeUrls(['https://a.com', '', 'https://b.com', ''])).toEqual([
      'https://a.com',
      'https://b.com',
    ])
  })

  it('returns empty array for empty input', () => {
    expect(dedupeUrls([])).toEqual([])
  })

  it('preserves order of first occurrence', () => {
    expect(
      dedupeUrls(['https://c.com', 'https://a.com', 'https://c.com']),
    ).toEqual(['https://c.com', 'https://a.com'])
  })

  it('handles all-empty array', () => {
    expect(dedupeUrls(['', '', ''])).toEqual([])
  })
})

describe('parseUrlMode', () => {
  it('returns true for valid http URL', () => {
    expect(parseUrlMode('https://example.com')).toBe(true)
  })

  it('returns true for valid http URL with path', () => {
    expect(parseUrlMode('https://example.com/path/to/file.md')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(parseUrlMode('')).toBe(false)
  })

  it('returns false for plain text', () => {
    expect(parseUrlMode('not a url')).toBe(false)
  })

  it('returns false for partial URL without protocol', () => {
    expect(parseUrlMode('example.com')).toBe(false)
  })

  it('returns true for non-http protocols', () => {
    expect(parseUrlMode('ftp://files.example.com/data')).toBe(true)
  })
})
