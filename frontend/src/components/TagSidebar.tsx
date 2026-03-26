import { Link } from 'react-router-dom'
import type { TagEntry } from '../types'

export function TagSidebar({ tags }: { tags: TagEntry[] }) {
  return (
    <aside className="order-2 shrink-0 md:order-1 md:w-56">
      <h2 className="mb-3 text-sm font-medium text-stone-500 dark:text-stone-400">
        Catalog tags
      </h2>
      <nav className="flex flex-wrap gap-2 md:flex-col md:flex-nowrap md:gap-1.5">
        {tags.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            No tags yet. Complete a scan to build the catalog.
          </p>
        ) : (
          tags.map(({ tag, count }) => (
            <Link
              key={tag}
              to={`/category/${encodeURIComponent(tag)}`}
              className="inline-flex max-w-full items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 transition hover:border-accent hover:bg-stone-100 hover:text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:border-accent dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              <span className="truncate">{tag}</span>
              <span className="shrink-0 tabular-nums text-stone-400 dark:text-stone-500">
                {count}
              </span>
            </Link>
          ))
        )}
      </nav>
    </aside>
  )
}
