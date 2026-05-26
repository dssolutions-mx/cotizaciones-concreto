'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmaNormReferenceChip } from '@/components/ema/uncertainty/EmaNormReferenceChip'
import type { PublishPreflight, UncertaintyStudy } from '@/types/ema-uncertainty'
import { cn } from '@/lib/utils'

/**
 * Render a detail string that may contain `[ID verificación: <uuid>]` tags
 * as inline clickable links to the verification page.
 */
function DetailWithLinks({ detail }: { detail: string }) {
  // Split on [ID verificación: uuid] tags
  const parts = detail.split(/(\[ID verificación:\s*[0-9a-f-]{36}\])/gi)
  return (
    <span>
      {parts.map((part, i) => {
        const m = part.match(/\[ID verificación:\s*([0-9a-f-]{36})\]/i)
        if (m) {
          return (
            <Link
              key={i}
              href={`/quality/ema/verificaciones/${m[1]}`}
              className="inline-flex items-center gap-0.5 ml-1 underline underline-offset-2 text-amber-700 hover:text-amber-900 font-medium"
            >
              Ver verificación
              <ExternalLink className="h-3 w-3" />
            </Link>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

export function EmaUncertaintyPublishPanel({
  study,
  preflight,
  onPublish,
  publishing,
  error,
  previewU,
  previousU,
  unit,
}: {
  study: UncertaintyStudy
  preflight: PublishPreflight | null
  onPublish: (validUntil: string | null) => void
  publishing: boolean
  error: string | null
  previewU: number | null
  previousU: number | null
  unit: string
}) {
  const [validUntil, setValidUntil] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (study.estado !== 'borrador') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
        <p className="text-sm font-medium text-emerald-800">
          Este estudio ya fue {study.estado === 'publicado' ? 'publicado' : 'reemplazado'}.
        </p>
        {study.documento_codigo && (
          <p className="mt-1 text-xs text-emerald-600 font-mono">{study.documento_codigo}</p>
        )}
      </div>
    )
  }

  const allPass = preflight?.ok ?? false

  return (
    <>
      <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-5 md:p-6">
        <h3 className="text-sm font-semibold text-stone-800">Lista de verificación</h3>
        <p className="text-xs text-stone-500">
          Al publicar, esta U reemplazará la anterior para este mensurando.
          <EmaNormReferenceChip
            ref_norma="GUM §6.2"
            formula_display="U = k · u_c"
            className="ml-1"
          />
        </p>

        <div>
          <Label htmlFor="valid_until">Válida hasta (opcional)</Label>
          <Input
            id="valid_until"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="mt-1 max-w-xs"
          />
        </div>

        {preflight ? (
          <div className="space-y-2">
            {preflight.checks.map((c, i) => {
              const isRec = c.label.startsWith('[Recomendación]')
              const displayLabel = isRec ? c.label.replace('[Recomendación] ', '') : c.label
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm',
                    c.passed && 'border-emerald-200 bg-emerald-50',
                    !c.passed && !isRec && 'border-red-200 bg-red-50',
                    !c.passed && isRec && 'border-amber-200 bg-amber-50',
                  )}
                >
                  {c.passed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isRec ? 'text-amber-600' : 'text-red-500',
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      c.passed && 'text-emerald-800',
                      !c.passed && !isRec && 'text-red-700',
                      !c.passed && isRec && 'text-amber-900',
                    )}
                  >
                    {displayLabel}
                  </span>
                  {c.detail && (
                    <span className="ml-auto text-xs text-stone-400">
                      <DetailWithLinks detail={c.detail} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-stone-400 italic">Cargando validaciones…</p>
        )}

        {previewU !== null && (
          <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm">
            <span className="text-stone-500">U a publicar: </span>
            <span className="font-mono font-bold text-stone-800">
              ± {previewU.toExponential(3)} {unit}
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Button
          type="button"
          disabled={!allPass || publishing || previewU === null}
          className="w-full bg-stone-900 hover:bg-stone-800"
          onClick={() => setConfirmOpen(true)}
        >
          {publishing ? 'Publicando…' : 'Publicar incertidumbre declarada'}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Publicar incertidumbre declarada?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-stone-600">
                <p>
                  Esta acción reemplazará la incertidumbre declarada para{' '}
                  <strong>{study.measurand?.nombre}</strong>.
                </p>
                {previousU !== null && previewU !== null && (
                  <p className="font-mono text-xs">
                    Anterior: ± {previousU.toExponential(3)} {unit}
                    <br />
                    Nueva: ± {previewU.toExponential(3)} {unit}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-stone-900 hover:bg-stone-800"
              onClick={() => {
                setConfirmOpen(false)
                onPublish(validUntil || null)
              }}
            >
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
