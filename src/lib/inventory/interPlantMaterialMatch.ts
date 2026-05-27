/**
 * Match destination-plant materials for inter-plant transfers (by accounting_code, then material_code).
 */

export type MaterialMatchRow = {
  id: string
  material_code: string
  material_name: string
  accounting_code?: string | null
  plant_id?: string | null
  is_active?: boolean | null
}

export type InterPlantDestMatchResult = {
  candidates: MaterialMatchRow[]
  suggestedId: string | null
  matchReason: 'accounting_code' | 'material_code' | 'none' | 'ambiguous'
}

function normAccounting(code: string | null | undefined): string | null {
  const t = code?.trim()
  return t ? t : null
}

/** Client or server: suggest destination material from origin + destination catalog. */
export function suggestDestMaterial(
  source: Pick<MaterialMatchRow, 'id' | 'material_code' | 'accounting_code'> | null,
  destCatalog: MaterialMatchRow[]
): InterPlantDestMatchResult {
  const active = destCatalog.filter((m) => m.is_active !== false)
  if (!source) {
    return { candidates: [], suggestedId: null, matchReason: 'none' }
  }

  const srcAc = normAccounting(source.accounting_code)
  if (srcAc) {
    const byAc = active.filter((m) => normAccounting(m.accounting_code) === srcAc)
    if (byAc.length === 1) {
      return { candidates: byAc, suggestedId: byAc[0].id, matchReason: 'accounting_code' }
    }
    if (byAc.length > 1) {
      return { candidates: byAc, suggestedId: null, matchReason: 'ambiguous' }
    }
    return { candidates: [], suggestedId: null, matchReason: 'none' }
  }

  const byCode = active.filter((m) => m.material_code === source.material_code)
  if (byCode.length === 1) {
    return { candidates: byCode, suggestedId: byCode[0].id, matchReason: 'material_code' }
  }
  if (byCode.length > 1) {
    return { candidates: byCode, suggestedId: null, matchReason: 'ambiguous' }
  }
  return { candidates: [], suggestedId: null, matchReason: 'none' }
}

export function validateDestMaterialChoice(
  source: Pick<MaterialMatchRow, 'accounting_code'> | null,
  dest: Pick<MaterialMatchRow, 'id' | 'accounting_code'> | null
): { ok: true } | { ok: false; message: string } {
  if (!dest) {
    return { ok: false, message: 'Seleccione el material de destino' }
  }
  const srcAc = normAccounting(source?.accounting_code)
  const destAc = normAccounting(dest.accounting_code)
  if (srcAc && destAc && srcAc !== destAc) {
    return {
      ok: false,
      message: `La clave contable de destino (${destAc}) no coincide con la de origen (${srcAc})`,
    }
  }
  return { ok: true }
}
