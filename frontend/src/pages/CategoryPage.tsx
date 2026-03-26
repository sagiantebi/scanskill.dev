import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { fetchByTag } from '../api/client'

export function CategoryPage() {
  const raw = useParams<{ tag: string }>().tag
  const tag = raw ? decodeURIComponent(raw) : ''

  const { data, isLoading, isError } = useQuery({
    queryKey: ['skills-by-tag', tag],
    queryFn: () => fetchByTag(tag),
    enabled: !!tag,
  })

  if (!tag) {
    return <p className="text-stone-600 dark:text-stone-400">Missing tag.</p>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/" className="text-sm text-accent hover:underline">
          Back to scanner
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          Catalog tag:{' '}
          <span className="text-accent">{data?.tag ?? tag}</span>
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Scanned skills labeled with this tag.
        </p>
      </div>

      {isLoading && (
        <p className="text-stone-600 dark:text-stone-400">Loading…</p>
      )}
      {isError && (
        <p className="text-red-600 dark:text-red-400" role="alert">
          Could not load catalog.
        </p>
      )}

      {data && data.skills.length === 0 && (
        <p className="text-stone-600 dark:text-stone-400">
          No catalog entries with this tag yet.
        </p>
      )}

      {data && data.skills.length > 0 && (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
          {data.skills.map((s) => (
            <li key={s.id}>
              <Link
                to={`/scan/${s.id}`}
                className="block px-4 py-4 transition hover:bg-stone-50 dark:hover:bg-stone-800/80"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-stone-500 dark:text-stone-400">
                    {s.id.slice(0, 8)}…
                  </span>
                  {s.riskLevel && (
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs capitalize dark:bg-stone-800">
                      {s.riskLevel}
                    </span>
                  )}
                </div>
                {s.tldr && (
                  <p className="mt-1 text-sm font-medium text-stone-800 dark:text-stone-200">
                    {s.tldr}
                  </p>
                )}
                <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">
                  {s.preview}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
