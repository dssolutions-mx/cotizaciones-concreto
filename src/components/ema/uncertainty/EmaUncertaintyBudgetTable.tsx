'use client'

import React from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'
import { EmaNormReferenceChip } from './EmaNormReferenceChip'
import type { BudgetResult, UncertaintyComponent } from '@/types/ema-uncertainty'
import { cn } from '@/lib/utils'

interface EmaUncertaintyBudgetTableProps {
  budget: BudgetResult
  unit: string
  studyDate?: string
  className?: string
}

/**
 * Presupuesto de incertidumbre table — mirrors the Excel "Presupuesto Incertidumbre"
 * sheet layout but adds Formula and Norma columns for full transparency.
 *
 * Ref: JCGM 100:2008 §5 — combined uncertainty; NMX-EC-17025-IMNC-2018 §7.6.
 */
export function EmaUncertaintyBudgetTable({
  budget,
  unit,
  className,
}: EmaUncertaintyBudgetTableProps) {
  const { components, mean_value, u_c, nu_eff, k, U, U_rel_pct } = budget

  const fmt = (n: number, digits = 4) =>
    n === 0 ? '0' : n.toExponential(digits)

  const fmtFixed = (n: number, digits = 4) =>
    n.toFixed(digits)

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header info row */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
        <div>
          <span className="text-stone-500">Media x̄ =&nbsp;</span>
          <span className="font-semibold text-stone-800">
            {mean_value?.toFixed(4)} {unit}
          </span>
          <span className="ml-1 text-[10px] text-stone-400">
            <EmaNormReferenceChip ref_norma="GUM §4.2.3" formula_display="x̄ = (1/n) Σ xᵢ" />
          </span>
        </div>
        <div>
          <span className="text-stone-500">u_c =&nbsp;</span>
          <span className="font-semibold text-stone-800">
            {fmt(u_c)} {unit}
          </span>
          <span className="ml-1 text-[10px] text-stone-400">
            <EmaNormReferenceChip
              ref_norma="GUM §5.1.2"
              formula_display={`u_c = √(Σ(cᵢ·uᵢ)²) = ${fmt(u_c)}`}
            />
          </span>
        </div>
        <div>
          <span className="text-stone-500">νeff =&nbsp;</span>
          <span className="font-semibold text-stone-800">
            {isFinite(nu_eff) ? fmtFixed(nu_eff, 1) : '∞'}
          </span>
          <span className="ml-1 text-[10px] text-stone-400">
            <EmaNormReferenceChip
              ref_norma="GUM Annex G.4"
              formula_display="νeff = u_c⁴ / Σ(uᵢ⁴/νᵢ)"
            />
          </span>
        </div>
        <div>
          <span className="text-stone-500">k =&nbsp;</span>
          <span className="font-semibold text-stone-800">{fmtFixed(k, 4)}</span>
          <span className="ml-1 text-[10px] text-stone-400">
            <EmaNormReferenceChip
              ref_norma="GUM §6.3; Table G.2"
              formula_display={`k = t_{95.45%}(νeff=${isFinite(nu_eff) ? nu_eff.toFixed(1) : '∞'}) = ${k.toFixed(4)}`}
            />
          </span>
        </div>
      </div>

      {/* Component table — grouped by Tipo A / Tipo B per CENAM presupuesto layout */}
      <div className="overflow-x-auto rounded-lg border border-stone-200 print:overflow-visible">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500">
              <th className="px-3 py-2 text-left">Fuente</th>
              <th className="px-3 py-2 text-center">Categoría</th>
              <th className="px-3 py-2 text-left">Magnitud Xᵢ</th>
              <th className="px-3 py-2 text-right" title="Para Tipo B rectangular = semi-amplitud ±a. Para medidas = valor medio estimado.">Valor xᵢ</th>
              <th className="px-3 py-2 text-right">u(xᵢ)</th>
              <th className="px-3 py-2 text-center">Tipo</th>
              <th className="px-3 py-2 text-center">Distribución</th>
              <th className="px-3 py-2 text-right">cᵢ</th>
              <th className="px-3 py-2 text-right">uᵢ(y)</th>
              <th className="px-3 py-2 text-right">uᵢ²(y)</th>
              <th className="px-3 py-2 text-right" title="100 × uᵢ²(y) / Σ uᵢ²(y) — contribución relativa a la varianza combinada">% contrib.</th>
              <th className="px-3 py-2 text-left">Fórmula</th>
              <th className="px-3 py-2 text-center">Norma</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(() => {
              const sumUi2 = components.reduce((s, c) => s + c.ui2_y, 0) || 1;
              const typeA = components.filter((c) => c.tipo === 'A');
              const typeB = components.filter((c) => c.tipo === 'B');
              const rows: React.ReactNode[] = [];
              if (typeA.length > 0) {
                rows.push(
                  <tr key="hdr-a" className="bg-purple-50/60 text-[10px] uppercase tracking-wide text-purple-700">
                    <td colSpan={13} className="px-3 py-1 font-semibold">
                      Tipo A — evaluación estadística (GUM §4.2)
                    </td>
                  </tr>,
                );
                typeA.forEach((c, idx) => {
                  rows.push(
                    <BudgetRow
                      key={`a-${idx}`}
                      component={c}
                      unit={unit}
                      contribPct={(100 * c.ui2_y) / sumUi2}
                    />,
                  );
                });
              }
              if (typeB.length > 0) {
                rows.push(
                  <tr key="hdr-b" className="bg-teal-50/60 text-[10px] uppercase tracking-wide text-teal-700">
                    <td colSpan={13} className="px-3 py-1 font-semibold">
                      Tipo B — evaluación no-estadística (GUM §4.3)
                    </td>
                  </tr>,
                );
                typeB.forEach((c, idx) => {
                  rows.push(
                    <BudgetRow
                      key={`b-${idx}`}
                      component={c}
                      unit={unit}
                      contribPct={(100 * c.ui2_y) / sumUi2}
                    />,
                  );
                });
              }
              return rows;
            })()}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-300 bg-stone-50 font-semibold">
              <td colSpan={9} className="px-3 py-2 text-right text-stone-600">
                Σ uᵢ²(y) =
              </td>
              <td className="px-3 py-2 text-right text-stone-800">
                {fmt(components.reduce((s, c) => s + c.ui2_y, 0))}
              </td>
              <td colSpan={3} className="px-3 py-2 text-left text-stone-500">
                {unit}²
              </td>
            </tr>
            <tr className="bg-stone-50 font-semibold">
              <td colSpan={9} className="px-3 py-2 text-right text-stone-600">
                u_c = √Σ uᵢ²(y) =
              </td>
              <td className="px-3 py-2 text-right text-stone-800">
                {fmt(u_c)}
              </td>
              <td colSpan={3} className="px-3 py-2 text-left text-stone-500">
                {unit}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Result summary */}
      <div className="rounded-lg border-2 border-blue-200 bg-blue-50 px-5 py-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Resultado final
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ResultCard
            label="u_c(y)"
            value={`${fmt(u_c)} ${unit}`}
            sub="Incertidumbre combinada"
            refNorma="GUM §5.1.2"
            formula={`u_c = √(Σ(cᵢ·uᵢ)²) = ${fmt(u_c)}`}
          />
          <ResultCard
            label="νeff"
            value={isFinite(nu_eff) ? fmtFixed(nu_eff, 1) : '∞'}
            sub="Grados de libertad efectivos"
            refNorma="GUM Annex G.4"
            formula="νeff = u_c⁴ / Σ(uᵢ⁴/νᵢ)"
          />
          <ResultCard
            label="k"
            value={fmtFixed(k, 4)}
            sub={`t₉₅.₄₅%(νeff)`}
            refNorma="GUM §6.3; Table G.2"
            formula={`k = t_{95.45%}(${isFinite(nu_eff) ? nu_eff.toFixed(1) : '∞'}) = ${k.toFixed(4)}`}
          />
          <ResultCard
            label={`U (k=${k.toFixed(2)})`}
            value={`${fmt(U)} ${unit}`}
            sub="Incertidumbre expandida"
            refNorma="GUM §6.2"
            formula={`U = k · u_c = ${k.toFixed(4)} × ${fmt(u_c)} = ${fmt(U)}`}
            highlight
          />
        </div>
        {U_rel_pct !== null && (
          <p className="mt-2 text-xs text-blue-600">
            Incertidumbre relativa: <strong>{U_rel_pct.toFixed(2)} %</strong>
          </p>
        )}
        {(() => {
          const typeAComp = components.find((c) => c.tipo === 'A');
          const nuA = typeAComp?.nu;
          if (nuA == null || !isFinite(nuA) || nu_eff < nuA * 2) return null;
          return (
            <p className="mt-1 text-[10px] text-blue-500">
              νeff ({fmtFixed(nu_eff, 1)}) &gt; ν_A ({nuA}) porque las fuentes Tipo B tienen ν = ∞; su peso diluye el
              término finito en Welch–Satterthwaite — resultado correcto (GUM Anex. G.4). Con fuentes Tipo B
              dominantes, k tiende a 2 en lugar de t&#8203;_{'{n−1}'}.
            </p>
          );
        })()}
        <p className="mt-1 text-[10px] text-blue-500">
          Nivel de confianza ≈ 95 % (k de distribución t de Student para νeff). Ref: GUM §6.3.
        </p>
      </div>
    </div>
  )
}

const CATEGORIA_META: Record<
  NonNullable<UncertaintyComponent['categoria']>,
  { label: string; className: string }
> = {
  repeatability:    { label: 'Repetibilidad',    className: 'bg-purple-100 text-purple-700' },
  reproducibility:  { label: 'Reproducibilidad', className: 'bg-violet-100 text-violet-700' },
  resolution:       { label: 'Resolución',        className: 'bg-teal-100 text-teal-700' },
  calibration:      { label: 'Calibración',       className: 'bg-blue-100 text-blue-700' },
  environmental:    { label: 'Ambiental',          className: 'bg-emerald-100 text-emerald-700' },
  method:           { label: 'Método',             className: 'bg-amber-100 text-amber-700' },
  systematic:       { label: 'Sistemático',        className: 'bg-orange-100 text-orange-700' },
  custom:           { label: 'Personalizada',     className: 'bg-stone-200 text-stone-700' },
}

function CategoriaChip({ categoria }: { categoria: UncertaintyComponent['categoria'] }) {
  if (!categoria) return <span className="text-stone-300">—</span>
  const meta = CATEGORIA_META[categoria]
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap', meta.className)}>
      {meta.label}
    </span>
  )
}

function BudgetRow({
  component: c,
  unit,
  contribPct,
}: {
  component: UncertaintyComponent
  unit: string
  contribPct: number
}) {
  const fmt = (n: number) => n.toExponential(4)
  const fmtFixed = (n: number) => n.toFixed(4)

  // For Type B rectangular, show ±a (semi-amplitude = u·√3) instead of the best-estimate value (0).
  // This makes the physical meaning clear: the prior covers ±a around the nominal.
  const isRectangularB = c.tipo === 'B' && c.distribucion === 'rectangular'
  const valorDisplay = isRectangularB
    ? `±${fmtFixed(c.u_xi * Math.sqrt(3))}`
    : fmtFixed(c.valor_xi)

  // Provenance detection on calibration rows (from descripcion authored by service)
  const desc = c.descripcion ?? ''
  const isInternalVerif = desc.startsWith('Verificación interna')
  const isExternalCert = desc.startsWith('Certificado externo')
  const hasUnitConversion = desc.includes('convertido')

  // Highlight rows that dominate the budget (≥ 40% of total variance)
  const isDominant = contribPct >= 40

  return (
    <tr className={cn('hover:bg-stone-50', isDominant && 'bg-amber-50/40')}>
      <td className="px-3 py-1.5 text-stone-700">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>{c.fuente}</span>
          {isInternalVerif && (
            <span
              className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700"
              title={desc}
            >
              Verificación interna
            </span>
          )}
          {isExternalCert && (
            <span
              className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700"
              title={desc}
            >
              Cert. externo
            </span>
          )}
          {hasUnitConversion && (
            <span
              className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700"
              title={desc}
            >
              convertido
            </span>
          )}
        </div>
        {desc && (
          <p className="mt-0.5 text-[10px] text-stone-400 truncate" title={desc}>
            {desc}
          </p>
        )}
      </td>
      <td className="px-3 py-1.5 text-center">
        <CategoriaChip categoria={c.categoria} />
      </td>
      <td className="px-3 py-1.5 font-mono text-stone-600">{c.magnitud_xi}</td>
      <td className="px-3 py-1.5 text-right font-mono text-stone-600">
        {valorDisplay}
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-stone-700">{fmt(c.u_xi)}</td>
      <td className="px-3 py-1.5 text-center">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold',
            c.tipo === 'A'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-teal-100 text-teal-700',
          )}
        >
          {c.tipo}
        </span>
      </td>
      <td className="px-3 py-1.5 text-center font-mono text-stone-500 text-[11px]">
        {c.distribucion}
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-stone-600">{fmtFixed(c.ci)}</td>
      <td className="px-3 py-1.5 text-right font-mono font-medium text-stone-800">
        {fmt(c.ui_y)}
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-stone-600">{fmt(c.ui2_y)}</td>
      <td
        className={cn(
          'px-3 py-1.5 text-right font-mono',
          isDominant ? 'font-semibold text-amber-700' : 'text-stone-600',
        )}
        title={isDominant ? 'Contribución dominante (≥40 %)' : undefined}
      >
        {contribPct.toFixed(2)} %
      </td>
      <td className="max-w-[180px] px-3 py-1.5 font-mono text-[10px] text-stone-500 truncate" title={c.formula_display}>
        {c.formula_display}
      </td>
      <td className="px-3 py-1.5 text-center">
        <EmaNormReferenceChip
          ref_norma={c.ref_norma}
          formula_display={c.formula_display}
        />
      </td>
    </tr>
  )
}

function ResultCard({
  label,
  value,
  sub,
  refNorma,
  formula,
  highlight,
}: {
  label: string
  value: string
  sub: string
  refNorma: string
  formula: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2',
        highlight
          ? 'border-blue-400 bg-white shadow-sm'
          : 'border-blue-100 bg-blue-50',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-blue-600">{label}</span>
        <EmaNormReferenceChip ref_norma={refNorma} formula_display={formula} />
      </div>
      <div className={cn('mt-1 font-mono text-sm font-bold', highlight ? 'text-blue-800' : 'text-blue-700')}>
        {value}
      </div>
      <div className="text-[10px] text-blue-500">{sub}</div>
    </div>
  )
}
