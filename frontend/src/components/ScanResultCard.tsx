import { Link } from 'react-router-dom'
import type { ScanResultPayload } from '../types'
import { dedupeUrls } from '../lib/utils'

export function ScanResultCard({ result }: { result: ScanResultPayload }) {
  const referencedUrls = dedupeUrls([...result.urls, ...result.normalizedUrls])

  return (
    <div className="space-y-4 border-t border-stone-100 pt-4 dark:border-stone-800">
      {result.tldr && (
        <div>
          <h2 className="text-sm font-medium text-stone-500 dark:text-stone-400">
            Summary
          </h2>
          <p className="mt-1 text-stone-800 dark:text-stone-200">
            {result.tldr}
          </p>
        </div>
      )}
      <div>
        <h2 className="text-sm font-medium text-stone-500 dark:text-stone-400">
          Risk level
        </h2>
        <p className="mt-1 capitalize text-stone-800 dark:text-stone-200">
          {result.riskLevel}
        </p>
      </div>
      <div>
        <h2 className="text-sm font-medium text-stone-500 dark:text-stone-400">
          Detected tags
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {result.tags.map((t) => (
            <li key={t}>
              <Link
                to={`/category/${encodeURIComponent(t)}`}
                className="inline-block rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-sm text-stone-700 transition hover:border-accent hover:bg-stone-100 hover:text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:border-accent dark:hover:bg-stone-800 dark:hover:text-stone-100"
              >
                {t}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {referencedUrls.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-stone-500 dark:text-stone-400">
            Links extracted from skill
          </h2>
          <ul className="mt-2 max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-sm">
            {referencedUrls.map((u) => (
              <li key={u} className="break-all">
                <a
                  href={u}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[var(--color-accent)] underline"
                >
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
