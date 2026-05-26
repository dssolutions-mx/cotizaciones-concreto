import React from 'react'
import { Page, Text, View } from '@react-pdf/renderer'
import type { BudgetResult, UncertaintyComponent } from '@/lib/ema/uncertaintyBudget'
import { verificacionPdfStyles as s } from '@/components/ema/pdf/verificacionPdfStyles'
import {
  PdfTable,
  PDF_LANDSCAPE_TABLE_WIDTH,
  widthsFromWeights,
  type PdfTableColumn,
} from '@/components/ema/pdf/verificacionPdfTable'

function buildBudgetColumns(): PdfTableColumn[] {
  const labels = [
    'Fuente',
    'Xᵢ',
    'xᵢ',
    'u(xᵢ)',
    'Tipo',
    'Distrib.',
    'cᵢ',
    'uᵢ(y)',
    'uᵢ²',
    '%',
    'ν',
    'Norma',
  ]
  const weights = [4, 1, 1.2, 1.2, 0.7, 1, 0.7, 1.2, 1.2, 0.8, 0.8, 1.2]
  const widths = widthsFromWeights(weights, PDF_LANDSCAPE_TABLE_WIDTH)
  return labels.map((label, i) => ({
    key: `b${i}`,
    label,
    widthPt: widths[i],
    align: i >= 2 && i <= 3 ? 'right' : i >= 6 && i <= 9 ? 'right' : 'left',
    mono: i >= 1 && i <= 3,
  }))
}

function fmtSci(n: number | null | undefined, digits = 3): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  if (Math.abs(n) >= 0.01 && Math.abs(n) < 10000) return n.toFixed(4)
  return n.toExponential(digits)
}

function fmtFixed(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function componentRow(c: UncertaintyComponent, sumUi2: number): string[] {
  const ui2 = Number(c.ui2_y)
  const pct =
    sumUi2 > 0 && Number.isFinite(ui2) ? ((100 * ui2) / sumUi2).toFixed(1) : '0'
  const nu = c.nu
  return [
    c.fuente ?? '—',
    c.magnitud_xi ?? '—',
    fmtSci(c.valor_xi),
    fmtSci(c.u_xi),
    c.tipo ?? '—',
    c.distribucion ?? '—',
    c.ci != null && Number.isFinite(c.ci) ? String(c.ci) : '—',
    fmtSci(c.ui_y),
    fmtSci(c.ui2_y),
    pct,
    nu != null && Number.isFinite(nu) ? (nu >= 1e6 ? '∞' : fmtSci(nu, 1)) : '∞',
    c.ref_norma ?? '—',
  ]
}

export function VerificacionUncertaintyBudgetPDF({
  budget,
  unit,
  metrologiaStatus,
  skippedReason,
  turMin,
  certificado,
  registroId,
  instrumentoCodigo,
}: {
  budget: BudgetResult | null
  unit: string
  metrologiaStatus: string | null
  skippedReason?: string | null
  turMin?: number | null
  certificado?: string | null
  registroId: string
  instrumentoCodigo?: string
}) {
  const components = budget?.components ?? []
  const sumUi2 = components.reduce((acc, c) => {
    const v = Number(c.ui2_y)
    return acc + (Number.isFinite(v) ? v : 0)
  }, 0)
  const typeA = components.filter((c) => c.tipo === 'A')
  const typeB = components.filter((c) => c.tipo === 'B')
  const rows: string[][] = []
  for (const c of typeA) rows.push(componentRow(c, sumUi2 || 1))
  for (const c of typeB) rows.push(componentRow(c, sumUi2 || 1))

  const budgetCols = buildBudgetColumns()

  return (
    <Page size="A4" orientation="landscape" style={s.pageLandscape}>
      <View style={s.cardHeader}>
        <Text style={s.cardHeaderText}>
          §7 Presupuesto de incertidumbre (JCGM 100:2008 · NMX-EC-17025-IMNC-2018 §7.6)
        </Text>
      </View>

      {!budget && (
        <View style={[s.cardBody, { marginTop: 8 }]}>
          <Text style={{ fontSize: 9, color: '#92400E' }}>
            Estado GUM: {metrologiaStatus ?? 'sin calcular'}
            {skippedReason ? ` — ${skippedReason}` : ''}
          </Text>
          <Text style={{ fontSize: 8, marginTop: 6, color: '#78716C', lineHeight: 1.4 }}>
            Cierre la verificación o ejecute «Recalcular incertidumbre» en el sistema para incluir el
            presupuesto completo en el expediente.
          </Text>
        </View>
      )}

      {budget && (
        <>
          <View style={[s.summaryStrip, { marginTop: 8 }]}>
            <Text style={s.summaryItem}>ē = {fmtFixed(budget.mean_value)} {unit}</Text>
            <Text style={s.summaryItem}>u_c = {fmtSci(budget.u_c)} {unit}</Text>
            <Text style={s.summaryItem}>
              νeff = {Number.isFinite(budget.nu_eff) ? fmtFixed(budget.nu_eff, 1) : '∞'}
            </Text>
            <Text style={s.summaryItem}>k = {fmtFixed(budget.k)}</Text>
            <Text style={[s.summaryItem, { fontWeight: 'bold' }]}>
              U = {fmtSci(budget.U)} {unit}
            </Text>
            {turMin != null && (
              <Text style={s.summaryItem}>TUR mín. = {turMin.toFixed(2)}</Text>
            )}
          </View>

          {certificado && (
            <Text style={{ fontSize: 7.5, marginBottom: 6, color: '#57534E' }}>
              Trazabilidad: {certificado}
            </Text>
          )}

          {rows.length > 0 && (
            <PdfTable
              columns={budgetCols}
              rows={rows}
              fontSize={6.5}
              tableWidth={PDF_LANDSCAPE_TABLE_WIDTH}
            />
          )}
        </>
      )}

      <View style={s.footer} fixed>
        <Text>
          {instrumentoCodigo ? `${instrumentoCodigo} · ` : ''}
          VER-{registroId.slice(0, 8).toUpperCase()} · Presupuesto GUM
        </Text>
        <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    </Page>
  )
}
