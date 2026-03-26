const statusStyles: Record<string, string> = {
  completed:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
}

const defaultStyle =
  'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status] ?? defaultStyle}`}
    >
      {status}
    </span>
  )
}
