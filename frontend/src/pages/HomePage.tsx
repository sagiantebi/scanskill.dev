import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { fetchStats, fetchTags } from '../api/client'
import { TagSidebar } from '../components/TagSidebar'
import { useSubmitScan } from '../hooks/useSubmitScan'
import { parseUrlMode } from '../lib/utils'

export function HomePage() {
  const [content, setContent] = useState('')
  const [urlField, setUrlField] = useState('')

  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: fetchStats })
  const { data: tagsData } = useQuery({ queryKey: ['tags'], queryFn: fetchTags })

  const submitMutation = useSubmitScan(() => ({ content, urlField }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submitMutation.mutate()
  }

  const urlTrim = urlField.trim()
  const contentTrim = content.trim()
  const urlMode = parseUrlMode(urlTrim)
  const canSubmit = urlMode
    ? urlTrim.length > 0 && !submitMutation.isPending
    : contentTrim.length >= 10 && !submitMutation.isPending

  return (
    <div className="flex flex-col gap-10 md:flex-row md:gap-12">
      <TagSidebar tags={tagsData?.tags ?? []} />

      <div className="order-1 min-w-0 flex-1 md:order-2">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          Analyze an agent skill
        </h1>
        <p className="mb-6 max-w-xl text-stone-600 dark:text-stone-400">
          We sanitize the input, extract links and commands, label intent, and
          estimate risk. Paste skill text here or enter a URL to fetch markdown.
          If both are filled, the URL wins—you&apos;ll see a notice on the scan
          page.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="url"
              className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300"
            >
              Skill URL (optional)
            </label>
            <p className="mb-1 text-xs text-stone-500 dark:text-stone-400">
              We fetch markdown from this URL when set.
            </p>
            <input
              id="url"
              type="url"
              value={urlField}
              onChange={(e) => setUrlField(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm outline-none ring-[var(--color-accent)] placeholder:text-stone-400 focus:border-[var(--color-accent)] focus:ring-2 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
            />
          </div>
          <div>
            <label
              htmlFor="content"
              className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300"
            >
              Skill or instruction text
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              placeholder="Paste skill instructions, tool definitions, or agent-facing markdown…"
              className="w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm leading-relaxed text-stone-900 shadow-sm outline-none ring-[var(--color-accent)] placeholder:text-stone-400 focus:border-[var(--color-accent)] focus:ring-2 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
            />
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {urlMode
                ? 'Not used when a valid URL is set above.'
                : 'At least 10 characters.'}
            </p>
          </div>

          {submitMutation.isError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {submitMutation.error instanceof Error
                ? submitMutation.error.message
                : 'Something went wrong'}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Running…' : 'Run scan'}
          </button>
        </form>

        <p className="mt-8 text-sm text-stone-600 dark:text-stone-400">
          <span className="font-medium tabular-nums text-stone-800 dark:text-stone-200">
            {stats?.completedScans ?? '—'}
          </span>{' '}
          completed scans in catalog
        </p>
      </div>
    </div>
  )
}
