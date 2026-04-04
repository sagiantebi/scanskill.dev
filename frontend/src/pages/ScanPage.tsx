import { Link, useLocation, useParams } from 'react-router-dom'
import { MarkdownViewer } from '../components/MarkdownViewer'
import { ScanResultCard } from '../components/ScanResultCard'
import { StatusBadge } from '../components/StatusBadge'
import { useScanPolling } from '../hooks/useScanPolling'

export function ScanPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const jobId = id ?? ''

  const routeNotice =
    (location.state as { notice?: string } | null)?.notice ?? undefined

  const { data, isLoading, isError, error } = useScanPolling(jobId)

  if (!jobId) {
    return <p className="text-stone-600 dark:text-stone-400">Invalid scan id.</p>
  }

  if (isLoading) {
    return (
      <p className="text-stone-600 dark:text-stone-400">Loading scan…</p>
    )
  }

  if (isError || !data) {
    return (
      <p className="text-red-600 dark:text-red-400" role="alert">
        {error instanceof Error ? error.message : 'Error'}
      </p>
    )
  }

  const { status, progress, progressPhase, result } = data
  const hasResult = !!result

  return (
    <div className="max-w-2xl space-y-6">
      {routeNotice ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          {routeNotice}
        </div>
      ) : null}

      <div>
        <Link to="/" className="text-sm text-accent hover:underline">
          Back to scanner
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          Scan progress
        </h1>
        <p className="mt-1 font-mono text-xs text-stone-500 dark:text-stone-400">
          {jobId}
        </p>
      </div>

      {data.sourceUrl ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <span className="font-medium text-stone-600 dark:text-stone-400">
            Source URL{' '}
          </span>
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="break-all text-[var(--color-accent)] underline"
          >
            {data.sourceUrl}
          </a>
        </div>
      ) : null}

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-stone-600 dark:text-stone-300">
            Status
          </span>
          <StatusBadge status={status} />
        </div>

        {!hasResult && (
          <>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-[width]"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {progressPhase ?? 'Analyzing skill…'} This page refreshes automatically.
            </p>
          </>
        )}

        {hasResult && result && <ScanResultCard result={result} />}
      </div>

      {hasResult && data.originalSkillMarkdown ? (
        <MarkdownViewer raw={data.originalSkillMarkdown} />
      ) : null}
    </div>
  )
}
