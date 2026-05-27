/** Distinct remisión numbers linked to a material entry via FIFO allocations. */
export function formatOrphanEntryRemisionLabel(numbers: string[] | undefined | null): string | null {
  if (!numbers?.length) return null
  if (numbers.length <= 3) return numbers.join(', ')
  return `${numbers.slice(0, 2).join(', ')} +${numbers.length - 2}`
}

export function orphanEntryRemisionTitle(numbers: string[] | undefined | null): string | undefined {
  if (!numbers?.length) return undefined
  return numbers.join(', ')
}
