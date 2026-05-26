import React from 'react'
import { Page, Text, View } from '@react-pdf/renderer'
import type { BudgetResult, UncertaintyComponent } from '@/lib/ema/uncertaintyBudget'
import { verificacionPdfStyles as s } from '@/components/ema/pdf/verificacionPdfStyles'
import { PdfTable, type PdfTableColumn } from '@/components/ema/pdf/verificacionPdfTable'

const BUDGET_COLS: PdfTableColumn[] = [
  { key: 'fuente', label: 'Fuente de incertidumbre', width: '20%' },
  { key: 'xi', label: 'Magnitud Xᵢ', width: '7%' },
  { key: 'val', label: 'Valor xᵢ', width: '9%', mono: true, align: 'right' },
  { key: 'uxi', label: 'u(xᵢ)', width: '9%', mono: true, align: 'right' },
  { key: 'tipo', label: 'Tipo', width: '5%', align: 'center' },
  { key: 'dist', label: 'Distrib.', width: '8%' },
  { key: 'ci', label: 'cᵢ', width: '6%', mono: true, align: 'right' },
  { key: 'uiy', label: 'uᵢ(y)', width: '9%', mono: true, align: 'right' },
  { key: 'ui2', label: 'uᵢ²(y)', width: '9%', mono: true, align: 'right' },
  { key: 'pct', label: '% var.', width: '6%', align: 'right' },
  { key: 'nu', label: 'νᵢ', width: '6%', align: 'right' },
  { key: 'norma', label: 'Ref. norma', width: '6%' },
]

function fmtSci(n: number, digits = 3): string {
  if (n === 0) return '0'
  if (Math.abs(n) >= 0.01 && Math.abs(n) < 10000) return n.toFixed(4)
  return n.toExponential(digits)
}

function componentRow(c: UncertaintyComponent, sumUi2: number): string[] {
  const pct = sumUi2 > 0 ? ((100 * c.ui2_y) / sumUi2).toFixed(1) : '0'
  return [
    c.fuente,
    c.magnitud_xi,
    `${fmtSci(c.valor_xi)} ${c.unidad}`,
    fmtSci(c.u_xi),
    c.tipo,
    c.distribucion,
    String(c.ci),
    fmtSci(c.ui_y),
    fmtSci(c.ui2_y),
    pct,
    isFinite(c.nu) ? (c.nu >= 1e6 ? '∞' : fmtSci(c.nu, 1)) : '∞',
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
  const { components, mean_value, u_c, nu_eff, k, U } = budget ?? {
    components: [],
    mean_value: 0,
    u_c: 0,
    nu_eff: Infinity,
    k: 2,
    U: 0,
    U_rel_pct: null,
  }

  const sumUi2 = components.reduce((acc, c) => acc + c.ui2_y, 0)
  const typeA = components.filter((c) => c.tipo === 'A')
  const typeB = components.filter((c) => c.tipo === 'B')
  const rows: string[][] = []
  for (const c of typeA) rows.push(componentRow(c, sumUi2 || 1))
  for (const c of typeB) rows.push(componentRow(c, sumUi2 || 1))
  if (sumUi2 > 0) {
    rows.push([
      '—',
      '—',
      '—',
      '—',
      '—',
      '—',
      'Σ',
      '—',
      fmtSci(sumUi2),
      '100',
      '—',
      'GUM §5.1.2',
    ])
  }

  return (
    <Page size="A4" orientation="landscape" style={s.pageLandscape}>
      <View style={s.cardHeader}>
        <Text style={s.cardHeaderText}>
          §7 Presupuesto de incertidumbre de medición (JCGM 100:2008 / NMX-EC-17025-IMNC-2018 §7.6)
        </Text>
      </View>

      {!budget && (
        <View style={[s.cardBody, { marginTop: 8 }]}>
          <Text style={{ fontSize: 9, color: '#92400E' }}>
            Estado GUM: {metrologiaStatus ?? 'sin calcular'}
            {skippedReason ? ` — ${skippedReason}` : ''}
          </Text>
          <Text style={{ fontSize: 8, marginTop: 6, color: '#78716C' }}>
            El presupuesto no está disponible en este registro. Ejecute el cierre de verificación o
            «Recalcular incertidumbre» en el sistema antes de emitir el informe para acreditación.
          </Text>
        </View>
      )}

      {budget && (
        <>
          <View style={[s.summaryStrip, { marginTop: 8 }]}>
            <Text style={s.summaryItem}>
              Error medio ē = {mean_value.toFixed(4)} {unit}
            </Text>
            <Text style={s.summaryItem}>u_c = {fmtSci(u_c)} {unit}</Text>
            <Text style={s.summaryItem}>
              νeff = {isFinite(nu_eff) ? nu_eff.toFixed(1) : '∞'}
            </Text>
            <Text style={s.summaryItem}>k = {k.toFixed(4)}</Text>
            <Text style={[s.summaryItem, { fontWeight: 'bold' }]}>
              U = {fmtSci(U)} {unit}
            </Text>
            {turMin != null && (
              <Text style={s.summaryItem}>TUR mín. observado = {turMin.toFixed(2)}</Text>
            )}
          </View>

          {certificado && (
            <Text style={{ fontSize: 7.5, marginBottom: 6, color: '#57534E' }}>
              Trazabilidad metrológica del resultado: certificado / registro {certificado}
            </Text>
          )}

          {rows.length > 0 && <PdfTable columns={BUDGET_COLS} rows={rows} fontSize={6.5} />}

          <View style={s.legalBlock}>
            <Text style={s.legalText}>
              La incertidumbre expandida U se obtuvo conforme al método GUM: u_c = √(Σ uᵢ²(y)); νeff por
              Welch-Satterthwaite; k = t₉₅.₄₅%(νeff); U = k·u_c. Los componentes Tipo A provienen de la
              repetibilidad de las lecturas de verificación; los Tipo B de resolución, calibración del patrón
              y demás fuentes declaradas en el procedimiento interno.
            </Text>
          </View>
        </>
      )}

      <View style={s.footer} fixed>
        <Text>
          {instrumentoCodigo ? `${instrumentoCodigo} · ` : ''}
          Reg. {registroId.slice(0, 8).toUpperCase()} · Presupuesto GUM
        </Text>
        <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    </Page>
  )
}
