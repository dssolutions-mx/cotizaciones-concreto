'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { UncertaintyMeasurand, UncertaintyMeasurandInput } from '@/types/ema-uncertainty'

const INPUT_KIND_LABEL: Record<UncertaintyMeasurandInput['kind'], string> = {
  measured: 'Medida',
  constant: 'Constante',
  derived: 'Derivada',
  environmental: 'Ambiental',
  method: 'Método',
  systematic: 'Sistemático',
}

export function EmaUncertaintyMeasurandPanel({
  measurand,
  showVariables = true,
  onDeleteInput,
}: {
  measurand: UncertaintyMeasurand
  showVariables?: boolean
  /** When provided, a delete button appears on each input row (admin-only). */
  onDeleteInput?: (inputId: string) => void
}) {
  const [inputs, setInputs] = useState<UncertaintyMeasurandInput[]>(
    [...(measurand.inputs ?? [])].sort((a, b) => a.orden - b.orden),
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(inp: UncertaintyMeasurandInput) {
    const confirmed = window.confirm(
      `¿Eliminar la variable "${inp.simbolo} — ${inp.nombre_display}" del catálogo del mensurando?\n\n` +
      `Esta acción elimina el contribuyente de TODOS los estudios de este mensurando y no se puede deshacer.`,
    )
    if (!confirmed) return
    setDeletingId(inp.id)
    try {
      const res = await fetch(
        `/api/ema/uncertainty/measurands/${measurand.id}/inputs/${inp.id}`,
        { method: 'DELETE' },
      )
      if (res.ok || res.status === 204) {
        setInputs((prev) => prev.filter((i) => i.id !== inp.id))
        onDeleteInput?.(inp.id)
      } else {
        const body = await res.json().catch(() => ({}))
        alert(body.error ?? 'Error al eliminar la variable')
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-stone-200">
      <header className="border-b border-stone-200 bg-stone-50/70 px-4 py-3">
        <h3 className="text-sm font-semibold text-stone-800">Mensurando</h3>
        <p className="mt-0.5 text-sm text-stone-600">{measurand.nombre}</p>
        <p className="text-xs text-stone-500">{measurand.metodo_norma}</p>
        {measurand.documento_codigo && (
          <p className="mt-1 font-mono text-[11px] text-stone-400">{measurand.documento_codigo}</p>
        )}
      </header>

      {(measurand.formula_expr || measurand.formula_descr) && (
        <div className="border-b border-stone-100 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
            Modelo de medición
          </p>
          <div className="mt-2 inline-block max-w-full rounded-md border border-stone-200 bg-white px-4 py-2.5">
            {measurand.formula_expr && (
              <p className="font-mono text-base leading-snug text-stone-900">{measurand.formula_expr}</p>
            )}
            {measurand.formula_descr && (
              <p className="mt-1 font-mono text-xs text-stone-600">{measurand.formula_descr}</p>
            )}
          </div>
          <p className="mt-2 text-[11px] text-stone-400">GUM §4.1</p>
        </div>
      )}

      {showVariables && inputs.length > 0 && (
        <div>
          <p className="border-b border-stone-100 bg-stone-50/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">
            Variables del modelo
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-[11px] font-medium uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-2">Símbolo</th>
                  <th className="px-3 py-2">Magnitud</th>
                  <th className="px-3 py-2">Unidad</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Resolución</th>
                  <th className="px-4 py-2">Sensibilidad</th>
                  {onDeleteInput && <th className="w-10 px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {inputs.map((inp) => (
                  <tr key={inp.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2 font-mono text-sm font-medium text-stone-800">
                      {inp.simbolo}
                    </td>
                    <td className="px-3 py-2 text-stone-700">{inp.nombre_display}</td>
                    <td className="px-3 py-2 font-mono text-xs text-stone-600">
                      {inp.unidad || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-stone-600">
                      {INPUT_KIND_LABEL[inp.kind]}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-stone-600">
                      {inp.default_resolucion != null ? inp.default_resolucion : '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-stone-600">
                      {inp.sensitivity_expr?.trim() || '—'}
                    </td>
                    {onDeleteInput && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          title="Eliminar del catálogo (global)"
                          disabled={deletingId === inp.id}
                          className="text-stone-300 hover:text-red-600 disabled:opacity-40"
                          onClick={() => handleDelete(inp)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
