'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import type { MatchDetailField, ScoreBreakdownItem } from '@/lib/ap/cfdiEntryMatchDetails'
import { CheckCircle2, AlertTriangle, Minus } from 'lucide-react'

const statusIcon = {
  match: CheckCircle2,
  mismatch: AlertTriangle,
  neutral: Minus,
  info: Minus,
}

const statusClass = {
  match: 'text-emerald-700',
  mismatch: 'text-amber-800',
  neutral: 'text-stone-500',
  info: 'text-sky-700',
}

type Props = {
  fields: MatchDetailField[]
  scoreBreakdown: ScoreBreakdownItem[]
  fileName?: string
  emisorNombre?: string | null
}

export default function BulkCfdiMatchReview({
  fields,
  scoreBreakdown,
  fileName,
  emisorNombre,
}: Props) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50/80 p-3 space-y-3 text-xs">
      {(fileName || emisorNombre) && (
        <div className="text-[10px] text-stone-500 space-y-0.5">
          {fileName && <div>Archivo: <span className="font-mono">{fileName}</span></div>}
          {emisorNombre && <div>Emisor CFDI: {emisorNombre}</div>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="text-stone-500 border-b border-stone-200">
              <th className="text-left py-1 pr-2 font-medium w-[28%]">Campo</th>
              <th className="text-left py-1 pr-2 font-medium w-[28%]">Recepción</th>
              <th className="text-left py-1 pr-2 font-medium w-[28%]">CFDI</th>
              <th className="text-left py-1 font-medium w-[16%]">Estado</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => {
              const Icon = statusIcon[f.status]
              return (
                <tr key={i} className="border-b border-stone-100 last:border-0 align-top">
                  <td className="py-1.5 pr-2 text-stone-700 font-medium">{f.label}</td>
                  <td className="py-1.5 pr-2 text-stone-600 break-words">{f.entry_value ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-stone-600 break-words">{f.cfdi_value ?? '—'}</td>
                  <td className={cn('py-1.5', statusClass[f.status])}>
                    <span className="inline-flex items-center gap-1">
                      <Icon className="h-3 w-3 shrink-0" />
                      {f.status === 'match' ? 'OK' : f.status === 'mismatch' ? 'Rev.' : '—'}
                    </span>
                    {f.note && (
                      <div className="text-[10px] text-stone-500 mt-0.5 leading-snug">{f.note}</div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {scoreBreakdown.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-stone-200">
          <span className="text-[10px] text-stone-500 w-full">Señales de coincidencia:</span>
          {scoreBreakdown.map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-white border border-stone-200 px-2 py-0.5 text-[10px] text-stone-700"
            >
              {s.signal} <span className="ml-1 tabular-nums text-stone-400">+{s.points}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
