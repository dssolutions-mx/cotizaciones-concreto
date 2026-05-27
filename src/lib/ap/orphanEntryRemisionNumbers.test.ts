import { describe, expect, it } from 'vitest'
import { orphanEntryLoggedRemisionLabel } from './orphanEntryRemisionNumbers'

describe('orphanEntryLoggedRemisionLabel', () => {
  it('uses supplier_invoice on material tab', () => {
    expect(
      orphanEntryLoggedRemisionLabel(
        { supplier_invoice: 'REM-45012', fleet_invoice: 'GUIA-99' },
        'material',
      ),
    ).toBe('REM-45012')
  })

  it('prefers fleet_invoice on fleet tab', () => {
    expect(
      orphanEntryLoggedRemisionLabel(
        { supplier_invoice: 'REM-45012', fleet_invoice: 'GUIA-99' },
        'fleet',
      ),
    ).toBe('GUIA-99')
  })

  it('returns null when empty', () => {
    expect(orphanEntryLoggedRemisionLabel({ supplier_invoice: '  ' }, 'material')).toBeNull()
  })
})
