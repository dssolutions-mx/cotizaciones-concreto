'use client'

import React from 'react'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface EmaNormReferenceChipProps {
  /** Short ref string displayed on the chip, e.g. "GUM §4.2.3" */
  ref_norma: string
  /** Optional formula/explanation for the side panel */
  formula_display?: string
  className?: string
}

/**
 * Citation chip that opens a portaled detail panel.
 * Used throughout the uncertainty budget table so users can trace every
 * computed number back to the exact norm clause.
 *
 * Ref: NMX-EC-17025-IMNC-2018 §7.6 transparency requirement.
 */
export function EmaNormReferenceChip({
  ref_norma,
  formula_display,
  className,
}: EmaNormReferenceChipProps) {
  // Colour-code by reference type for fast visual scanning
  const chipColor = ref_norma.startsWith('GUM')
    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
    : ref_norma.startsWith('ISO')
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
    : ref_norma.startsWith('NMX')
    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono font-medium transition-colors',
            chipColor,
            className,
          )}
          title={`Norma: ${ref_norma}${formula_display ? ' — click para ver fórmula' : ''}`}
        >
          <BookOpen className="h-2.5 w-2.5 shrink-0" />
          {ref_norma}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-72 rounded-lg border-stone-200 bg-white p-3"
      >
        <p className="text-xs font-semibold text-stone-800">{ref_norma}</p>
        {formula_display && (
          <pre className="mt-2 whitespace-pre-wrap rounded bg-stone-50 px-2 py-1.5 font-mono text-[11px] text-stone-700">
            {formula_display}
          </pre>
        )}
        <p className="mt-2 text-[10px] text-stone-500">{getClauseExplanation(ref_norma)}</p>
      </PopoverContent>
    </Popover>
  )
}

function getClauseExplanation(ref: string): string {
  const map: Record<string, string> = {
    'GUM §4.2.3':
      'Evaluación Tipo A: incertidumbre estándar de la media = desviación estándar experimental / √n. JCGM 100:2008.',
    'GUM §4.2.4':
      'Evaluación Tipo A: estimación conjunta de varianza a partir de múltiples series de observaciones. JCGM 100:2008.',
    'GUM §4.3.4':
      'Evaluación Tipo B: incertidumbre a partir de certificado de calibración. u = U_cert / k. JCGM 100:2008.',
    'GUM §4.3.7':
      'Evaluación Tipo B: resolución de instrumento digital. Distribución rectangular, semiancho = Div.mín/2, u = semiancho/√3. JCGM 100:2008.',
    'GUM §5.1.2':
      'Incertidumbre estándar combinada: u_c(y) = √(Σ cᵢ² · u(xᵢ)²). JCGM 100:2008.',
    'GUM §5.1.3':
      'Coeficiente de sensibilidad: cᵢ = ∂f/∂xᵢ, derivada parcial del modelo de medición evaluada en los mejores estimados. JCGM 100:2008.',
    'GUM §6.2':
      'Incertidumbre expandida: U = k · u_c. Proporciona un intervalo con nivel de confianza aproximado del 95 %. JCGM 100:2008.',
    'GUM §6.3':
      'Factor de cobertura: k se obtiene de la distribución t de Student al nivel de confianza deseado para νeff. JCGM 100:2008.',
    'GUM Annex G.4':
      'Grados de libertad efectivos (Welch–Satterthwaite): νeff = u_c⁴ / Σ(uᵢ⁴/νᵢ). Determina k de la tabla t. JCGM 100:2008.',
    'GUM §6.3; Table G.2':
      'k = t_{95.45%}(νeff) de la Tabla G.2 de JCGM 100:2008. Equivale a ~1.96 para νeff→∞.',
    'GUM §4.2.4; ISO 5725-2 §7':
      'ANOVA de una vía para separar repetibilidad (s_r, intra-operador) y reproducibilidad (s_L, inter-operador). ISO 5725-2:1994.',
    'GUM §4.3':
      'Evaluación Tipo B: cualquier método distinto al análisis estadístico de series de observaciones. JCGM 100:2008.',
  }
  return map[ref] ?? `Referencia: ${ref}. Consultar documento normativo para texto completo.`
}
