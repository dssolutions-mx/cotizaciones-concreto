'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { InformeFirmaRol } from '@/types/informe-ensayo';
import type { EmitFirmaInput } from '@/types/informe-ensayo';

const ROLES: { rol: InformeFirmaRol; label: string }[] = [
  { rol: 'elaboro', label: 'Elaboró' },
  { rol: 'reviso', label: 'Revisó' },
  { rol: 'autorizo', label: 'Autorizó' },
];

type FirmaRow = {
  rol: InformeFirmaRol;
  signer_name: string;
  cedula_profesional: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (firmas: EmitFirmaInput[]) => void;
  loading?: boolean;
  profile?: { first_name?: string | null; last_name?: string | null; cedula_profesional?: string | null };
  userId?: string;
};

export function InformeFirmaDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  profile,
  userId,
}: Props) {
  const defaultName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  const [rows, setRows] = useState<FirmaRow[]>(
    ROLES.map((r) => ({
      rol: r.rol,
      signer_name: r.rol === 'elaboro' ? defaultName : '',
      cedula_profesional: r.rol === 'elaboro' ? (profile?.cedula_profesional ?? '') : '',
    }))
  );

  useEffect(() => {
    if (!open) return;
    setRows(
      ROLES.map((r) => ({
        rol: r.rol,
        signer_name: r.rol === 'elaboro' ? defaultName : '',
        cedula_profesional: r.rol === 'elaboro' ? (profile?.cedula_profesional ?? '') : '',
      }))
    );
  }, [open, defaultName, profile?.cedula_profesional]);

  const updateRow = (rol: InformeFirmaRol, patch: Partial<FirmaRow>) => {
    setRows((prev) => prev.map((r) => (r.rol === rol ? { ...r, ...patch } : r)));
  };

  const canSubmit = rows.every((r) => r.signer_name.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Firmas de autorización (§6)</DialogTitle>
          <DialogDescription>
            Nombre y cédula profesional para cada rol. Elaboró se prellena desde su perfil.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {ROLES.map(({ rol, label }) => {
            const row = rows.find((r) => r.rol === rol)!;
            return (
              <div key={rol} className="space-y-2 rounded-md border border-stone-200 p-3">
                <p className="text-sm font-medium text-stone-800">{label}</p>
                <div className="space-y-1.5">
                  <Label htmlFor={`${rol}-name`}>Nombre</Label>
                  <Input
                    id={`${rol}-name`}
                    value={row.signer_name}
                    onChange={(e) => updateRow(rol, { signer_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${rol}-cedula`}>Cédula profesional</Label>
                  <Input
                    id={`${rol}-cedula`}
                    value={row.cedula_profesional}
                    onChange={(e) => updateRow(rol, { cedula_profesional: e.target.value })}
                    placeholder="Opcional si no aplica"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit || loading}
            onClick={() =>
              onConfirm(
                rows.map((r) => ({
                  rol: r.rol,
                  signer_name: r.signer_name.trim(),
                  cedula_profesional: r.cedula_profesional.trim() || undefined,
                  signer_user_id: r.rol === 'elaboro' ? userId : undefined,
                }))
              )
            }
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Emitir informe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
