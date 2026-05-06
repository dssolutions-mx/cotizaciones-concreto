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
import type { TeamMember } from '@/lib/client-portal/teamService';
import { appendPortalClientId, getStoredPortalClientId } from '@/lib/client-portal/portalClientIdUrl';

export interface EditTeamMemberPlantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  onSuccess?: () => void;
}

export function EditTeamMemberPlantsModal({
  open,
  onOpenChange,
  member,
  onSuccess,
}: EditTeamMemberPlantsModalProps) {
  const { toast } = useToast();
  const [plants, setPlants] = useState<{ id: string; name: string }[]>([]);
  const [loadingPlants, setLoadingPlants] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allPlants, setAllPlants] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const restrictedKey = (member.allowed_plant_ids ?? []).join(',');

  useEffect(() => {
    if (!open) return;

    const ids = member.allowed_plant_ids;
    const restricted = Array.isArray(ids) && ids.length > 0;
    setAllPlants(!restricted);
    setSelectedIds(restricted ? new Set(ids) : new Set());

    let cancelled = false;
    setLoadingPlants(true);
    fetch(appendPortalClientId('/api/client-portal/team/plants-options'), {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((json: { plants?: { id: string; name: string }[] }) => {
        if (cancelled) return;
        setPlants(json.plants || []);
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
  }, [open, member.user_id, restrictedKey]);

  const handleSave = useCallback(async () => {
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
      const portalCid = getStoredPortalClientId();
      const url = appendPortalClientId(
        `/api/client-portal/team/${encodeURIComponent(member.user_id)}/plants`
      );
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plant_ids: allPlants ? [] : Array.from(selectedIds),
          ...(portalCid ? { client_id: portalCid } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Error al guardar');
      }
      toast({ title: 'Guardado', description: 'Alcance de plantas actualizado.' });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [allPlants, member.user_id, onOpenChange, onSuccess, selectedIds, plants.length, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-muted-foreground" />
            Plantas permitidas
          </DialogTitle>
          <DialogDescription>
            {member.first_name || member.last_name
              ? `${member.first_name || ''} ${member.last_name || ''}`.trim()
              : member.email}
            <br />
            Define desde qué plantas puede pedir concreto o ver calidad en el portal. «Todas las plantas»
            quita la restricción.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loadingPlants ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando plantas…
            </div>
          ) : plants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay plantas activas.</p>
          ) : (
            <>
              <div className="flex items-center space-x-2 rounded-lg border p-3">
                <Checkbox
                  id="team-edit-all-plants"
                  checked={allPlants}
                  onCheckedChange={(checked) => {
                    const on = checked === true;
                    setAllPlants(on);
                    if (on) setSelectedIds(new Set());
                  }}
                />
                <Label htmlFor="team-edit-all-plants" className="cursor-pointer font-medium leading-snug">
                  Todas las plantas ({plants.length})
                </Label>
              </div>

              {!allPlants && (
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border p-3">
                  {plants.map((plant) => (
                    <div key={plant.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`team-plant-${plant.id}`}
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
                      <Label htmlFor={`team-plant-${plant.id}`} className="cursor-pointer text-sm font-normal">
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
