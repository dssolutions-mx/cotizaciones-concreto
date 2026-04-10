'use client'

import React from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  showDeleteMuestreo: boolean
  onOpenDeleteMuestreo: (open: boolean) => void
  numeroMuestreo: number | undefined
  muestrasCount: number
  isDeletingMuestreo: boolean
  onConfirmDeleteMuestreo: () => void

  showDeleteMuestra: boolean
  onOpenDeleteMuestra: (open: boolean) => void
  isDeletingMuestra: boolean
  onConfirmDeleteMuestra: () => void
  onCancelDeleteMuestra: () => void
}

export default function MuestreoDeleteDialogs({
  showDeleteMuestreo,
  onOpenDeleteMuestreo,
  numeroMuestreo,
  muestrasCount,
  isDeletingMuestreo,
  onConfirmDeleteMuestreo,
  showDeleteMuestra,
  onOpenDeleteMuestra,
  isDeletingMuestra,
  onConfirmDeleteMuestra,
  onCancelDeleteMuestra,
}: Props) {
  return (
    <>
      <Dialog open={showDeleteMuestreo} onOpenChange={onOpenDeleteMuestreo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el muestreo #{numeroMuestreo}? Esta acción eliminará el muestreo y
              todas sus muestras asociadas. Esta acción no se puede deshacer.
              {muestrasCount > 0 && (
                <span className="block mt-2 text-red-600 font-medium">Se eliminarán {muestrasCount} muestra(s).</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenDeleteMuestreo(false)} disabled={isDeletingMuestreo}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onConfirmDeleteMuestreo} disabled={isDeletingMuestreo}>
              {isDeletingMuestreo ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Muestreo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteMuestra} onOpenChange={onOpenDeleteMuestra}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar esta muestra? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onCancelDeleteMuestra} disabled={isDeletingMuestra}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onConfirmDeleteMuestra} disabled={isDeletingMuestra}>
              {isDeletingMuestra ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Muestra
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
