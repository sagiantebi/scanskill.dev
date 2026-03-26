import hljs from 'highlight.js/lib/core'
import markdown from 'highlight.js/lib/languages/markdown'
import { useMemo } from 'react'
import 'highlight.js/styles/github.css'
import { useCopyToClipboard } from '../hooks/useCopyToClipboard'
import { escapeHtml } from '../lib/utils'

hljs.registerLanguage('markdown', markdown)

export function MarkdownViewer({ raw }: { raw: string }) {
  const { copyState, copy } = useCopyToClipboard()

  const highlighted = useMemo(() => {
    try {
      return hljs.highlight(raw, { language: 'markdown' }).value
    } catch {
      return escapeHtml(raw)
    }
  }, [raw])

  return (
    <section className="rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
        <h2 className="text-sm font-medium text-stone-700 dark:text-stone-300">
          Original skill (markdown)
        </h2>
        <button
          type="button"
          onClick={() => void copy(raw)}
          className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
        >
          {copyState === 'copied'
            ? 'Copied'
            : copyState === 'error'
              ? 'Copy failed'
              : 'Copy'}
        </button>
      </div>
      <div className="max-h-[min(28rem,55vh)] overflow-auto p-4">
        <pre className="m-0 text-xs leading-relaxed whitespace-pre [&_code.hljs]:bg-transparent">
          <code
            className="hljs language-markdown block font-mono"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      </div>
    </section>
  )
}
