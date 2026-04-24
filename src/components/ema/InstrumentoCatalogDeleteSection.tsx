'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { EmaDeleteBlocker } from '@/types/ema'

export function InstrumentoCatalogDeleteSection({
  instrumentoId,
  codigo,
  nombre,
}: {
  instrumentoId: string
  codigo: string
  nombre: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [blockers, setBlockers] = useState<EmaDeleteBlocker[]>([])
  const [confirm, setConfirm] = useState('')

  return (
    <div className="pt-4 mt-2 border-t border-stone-200">
      <p className="text-xs text-stone-500 mb-3 max-w-2xl">
        Eliminar quita el instrumento del catálogo. Con trazabilidad existente el sistema no permitirá el borrado; use
        <span className="font-medium"> Inactivo (baja)</span> en el formulario de arriba.
      </p>
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) {
            setErr(null)
            setBlockers([])
            setConfirm('')
          }
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-800 gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar del catálogo…
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="border-stone-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar instrumento</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-stone-600">
                <p>
                  ¿Confirma eliminar <span className="font-mono font-medium text-stone-900">{codigo}</span>
                  {' — '}
                  <span className="font-medium text-stone-900">{nombre}</span>?
                </p>
                <p className="text-xs text-stone-500">Escriba el código exacto para confirmar.</p>
                <Input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={codigo}
                  className="font-mono text-sm"
                  autoComplete="off"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {err}
              {blockers.length > 0 && (
                <ul className="mt-2 list-disc pl-4 space-y-1">
                  {blockers.map((b) => (
                    <li key={b.code}>{b.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || confirm.trim() !== codigo}
              className="bg-red-700 hover:bg-red-800 focus:ring-red-700"
              onClick={async (e) => {
                e.preventDefault()
                setBusy(true)
                setErr(null)
                setBlockers([])
                try {
                  const res = await fetch(`/api/ema/instrumentos/${instrumentoId}`, { method: 'DELETE' })
                  const j = await res.json().catch(() => ({}))
                  if (res.status === 409 && Array.isArray(j.blockers)) {
                    setBlockers(j.blockers)
                    setErr(j.error ?? 'No se puede eliminar.')
                    return
                  }
                  if (!res.ok) throw new Error(j.error ?? 'Error al eliminar')
                  setOpen(false)
                  router.push('/quality/instrumentos/catalogo')
                } catch (caught: unknown) {
                  setErr(caught instanceof Error ? caught.message : 'Error al eliminar')
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
