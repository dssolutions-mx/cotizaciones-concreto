'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initialName?: string
  initialRfc?: string
  groupId?: string
  rfcRequired?: boolean
  onSaved: () => void
}

export default function SupplierGroupDialog({
  open,
  onOpenChange,
  mode,
  initialName = '',
  initialRfc = '',
  groupId,
  rfcRequired = false,
  onSaved,
}: Props) {
  const [name, setName] = useState(initialName)
  const [rfc, setRfc] = useState(initialRfc)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setRfc(initialRfc)
    setError(null)
  }, [open, initialName, initialRfc])

  const save = async () => {
    const trimmedName = name.trim()
    const trimmedRfc = rfc.trim().toUpperCase()
    if (!trimmedName) {
      setError('El nombre es requerido')
      return
    }
    if (rfcRequired && !trimmedRfc) {
      setError('El RFC es requerido para facturación con CFDI')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const url =
        mode === 'create' ? '/api/ap/supplier-groups' : `/api/ap/supplier-groups/${groupId}`
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          rfc: trimmedRfc || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'No se pudo guardar')
        return
      }
      onSaved()
      onOpenChange(false)
    } catch {
      setError('Error de red')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nuevo grupo de proveedor' : 'Editar grupo'}</DialogTitle>
          <DialogDescription>
            El RFC identifica al emisor en CFDI y evita duplicados al registrar facturas en CxP.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="sg-name">Nombre</Label>
            <Input
              id="sg-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Cemex"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sg-rfc">
              RFC fiscal {rfcRequired ? '(requerido)' : '(recomendado)'}
            </Label>
            <Input
              id="sg-rfc"
              value={rfc}
              onChange={e => setRfc(e.target.value.toUpperCase())}
              placeholder="AAA010101AAA"
              className="font-mono"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? 'Crear' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
