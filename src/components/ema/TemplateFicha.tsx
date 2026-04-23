'use client';

import React from 'react';
import type {
  VerificacionTemplate,
  VerificacionTemplateHeaderField,
  VerificacionTemplateSection,
  VerificacionTemplateItem,
} from '@/types/ema';
import { effectiveLayout, effectiveSectionRepetitions } from '@/lib/ema/sectionLayout';
import { normalizeTemplateItem } from '@/lib/ema/templateItem';
import { cn } from '@/lib/utils';

export interface TemplateFichaProps {
  template: Pick<VerificacionTemplate, 'codigo' | 'nombre' | 'norma_referencia' | 'descripcion'>;
  sections: Array<VerificacionTemplateSection & { items: VerificacionTemplateItem[] }>;
  header_fields?: VerificacionTemplateHeaderField[];
  className?: string;
}

/** Excel-style preview / print layout for verification templates */
export function TemplateFicha({ template, sections, header_fields, className }: TemplateFichaProps) {
  return (
    <div className={cn('rounded-lg border border-stone-900 overflow-hidden text-sm', className)}>
      <div className="bg-slate-800 text-white px-4 py-3 text-center font-semibold tracking-tight">
        {template.nombre}
      </div>
      {template.norma_referencia && (
        <div className="bg-emerald-800 text-white px-4 py-2 text-xs text-center">{template.norma_referencia}</div>
      )}
      {template.descripcion && (
        <div className="bg-stone-100 px-3 py-2 text-[11px] text-stone-700 border-b border-stone-300">
          {template.descripcion}
        </div>
      )}

      {header_fields && header_fields.length > 0 && (
        <div className="grid grid-cols-2 gap-px bg-stone-300 border-b border-stone-300">
          {header_fields.map(h => (
            <div key={h.id} className="flex bg-white">
              <div className="bg-emerald-700 text-white text-[10px] font-semibold uppercase px-2 py-1.5 w-32 shrink-0">
                {h.label}
              </div>
              <div className="px-2 py-1.5 text-xs text-stone-600 flex-1 font-mono">
                {h.source === 'computed' ? <span className="text-stone-400">(calculado)</span> : '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="divide-y divide-stone-300">
        {sections.map(sec => {
          const layout = effectiveLayout(sec as any);
          const reps = effectiveSectionRepetitions(sec as any);
          return (
            <div key={sec.id}>
              <div className="bg-slate-800 text-white px-3 py-2 text-xs font-semibold flex justify-between">
                <span>{sec.titulo}</span>
                <span className="text-emerald-200 font-mono text-[10px]">{layout}</span>
              </div>
              {sec.descripcion && (
                <div className="bg-stone-50 px-3 py-1 text-[11px] text-stone-600 border-b border-stone-200">
                  {sec.descripcion}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-700 text-white">
                      {layout === 'instrument_grid' && <th className="border border-stone-400 px-2 py-1 text-left">Código</th>}
                      {(sec.items ?? [])
                        .filter(i => normalizeTemplateItem(i).item_role !== 'derivado')
                        .map(it => (
                          <th key={it.id} className="border border-stone-400 px-2 py-1 text-left font-semibold">
                            {it.punto}
                          </th>
                        ))}
                      <th className="border border-stone-400 px-2 py-1">¿Cumple?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: reps }, (_, i) => i + 1).map(rep => (
                      <tr key={rep} className="bg-white">
                        {layout === 'instrument_grid' && (
                          <td className="border border-stone-300 px-2 py-2 text-stone-400 font-mono">—</td>
                        )}
                        {(sec.items ?? [])
                          .filter(x => normalizeTemplateItem(x).item_role !== 'derivado')
                          .map(it => {
                            const n = normalizeTemplateItem(it);
                            const spec =
                              n.pass_fail_rule?.kind === 'tolerance_abs'
                                ? `${n.pass_fail_rule.expected} ± ${n.pass_fail_rule.tolerance}${n.pass_fail_rule.unit ? ` ${n.pass_fail_rule.unit}` : ''}`
                                : n.pass_fail_rule?.kind === 'range'
                                  ? `${n.pass_fail_rule.min ?? '—'} – ${n.pass_fail_rule.max ?? '—'}`
                                  : n.pass_fail_rule?.kind === 'expected_bool'
                                    ? `Esperado: ${n.pass_fail_rule.value ? 'Sí' : 'No'}`
                                    : '—';
                            return (
                              <td key={it.id} className="border border-stone-300 px-2 py-2 align-top">
                                <div className="text-[10px] text-stone-500 font-mono mb-1">{spec}</div>
                                <div className="h-6 border border-dashed border-stone-200 rounded bg-stone-50" />
                              </td>
                            );
                          })}
                        <td className="border border-stone-300 px-2 py-2 w-20 bg-stone-50 text-center text-stone-400">
                          auto
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
