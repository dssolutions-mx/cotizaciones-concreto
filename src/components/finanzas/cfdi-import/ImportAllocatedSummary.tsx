'use client'

type AllocatedRow = {
  key: string
  label: string
  detail?: string | null
}

type Props = {
  title: string
  rows: AllocatedRow[]
  className?: string
}

export default function ImportAllocatedSummary({ title, rows, className }: Props) {
  if (rows.length === 0) return null
  return (
    <div
      className={
        className
        ?? 'rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 space-y-2'
      }
    >
      <p className="font-medium">{title}</p>
      <ul className="list-disc pl-4 max-h-28 overflow-y-auto space-y-0.5">
        {rows.map(r => (
          <li key={r.key}>
            {r.label}
            {r.detail ? <span className="text-sky-700"> → {r.detail}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
