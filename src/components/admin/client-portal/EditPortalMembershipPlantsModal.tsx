'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Factory } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import type { ClientAssociation } from '@/lib/supabase/clientPortalAdmin';

export interface EditPortalMembershipPlantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  association: ClientAssociation;
  onSuccess?: () => void;
}

export function EditPortalMembershipPlantsModal({
  open,
  onOpenChange,
  userId,
  association,
  onSuccess,
}: EditPortalMembershipPlantsModalProps) {
  const { toast } = useToast();
  const [plants, setPlants] = useState<{ id: string; name: string }[]>([]);
  const [loadingPlants, setLoadingPlants] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allPlants, setAllPlants] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const restrictedKey = association?.allowed_plant_ids?.join(',') ?? '';

  useEffect(() => {
    if (!open || !association) return;

    const ids = association.allowed_plant_ids;
    const restricted = Array.isArray(ids) && ids.length > 0;
    setAllPlants(!restricted);
    setSelectedIds(restricted ? new Set(ids) : new Set());

    let cancelled = false;
    setLoadingPlants(true);
    fetch('/api/plants?active=true', { credentials: 'include' })
      .then((res) => res.json())
      .then((json: { data?: { id: string; name: string }[] }) => {
        if (cancelled) return;
        setPlants(
          (json.data || []).map((p) => ({
            id: p.id,
            name: p.name,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setPlants([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlants(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, association?.client_id, association?.id, restrictedKey]);

  const handleSave = useCallback(async () => {
    if (!association) return;
    if (!allPlants && plants.length > 0 && selectedIds.size === 0) {
      toast({
        title: 'Plantas',
        description: 'Selecciona al menos una planta o marca «Todas las plantas».',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        role: association.role_within_client,
      };
      if (association.role_within_client === 'user') {
        body.permissions = association.permissions as Record<string, boolean>;
      }
      body.plantIds = allPlants ? [] : Array.from(selectedIds);

      const res = await fetch(
        `/api/admin/client-portal-users/${encodeURIComponent(userId)}/clients?clientId=${encodeURIComponent(association.client_id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Error al guardar');
      }

      toast({
        title: 'Guardado',
        description: 'Alcance de plantas actualizado.',
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [
    allPlants,
    association,
    onOpenChange,
    onSuccess,
    selectedIds,
    plants.length,
    toast,
    userId,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-muted-foreground" />
            Plantas permitidas (portal)
          </DialogTitle>
          <DialogDescription>
            Usuario: <span className="font-medium text-foreground">{association.client_name}</span>
            <br />
            Sin selección explícita = acceso a todas las plantas activas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loadingPlants ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando plantas…
            </div>
          ) : plants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay plantas activas en el sistema.</p>
          ) : (
            <>
              <div className="flex items-center space-x-2 rounded-lg border p-3">
                <Checkbox
                  id="edit-all-plants"
                  checked={allPlants}
                  onCheckedChange={(checked) => {
                    const on = checked === true;
                    setAllPlants(on);
                    if (on) setSelectedIds(new Set());
                  }}
                />
                <Label htmlFor="edit-all-plants" className="cursor-pointer font-medium leading-snug">
                  Todas las plantas ({plants.length})
                </Label>
              </div>

              {!allPlants && (
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border p-3">
                  {plants.map((plant) => (
                    <div key={plant.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`plant-${plant.id}`}
                        checked={selectedIds.has(plant.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (checked === true) next.add(plant.id);
                            else next.delete(plant.id);
                            return next;
                          });
                        }}
                      />
                      <Label htmlFor={`plant-${plant.id}`} className="cursor-pointer text-sm font-normal">
                        {plant.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || loadingPlants}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
