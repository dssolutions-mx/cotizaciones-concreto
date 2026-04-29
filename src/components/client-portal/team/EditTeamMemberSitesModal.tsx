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
import { Loader2, MapPin } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import type { TeamMember } from '@/lib/client-portal/teamService';
import { appendPortalClientId, getStoredPortalClientId } from '@/lib/client-portal/portalClientIdUrl';

export interface EditTeamMemberSitesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  onSuccess?: () => void;
}

export function EditTeamMemberSitesModal({
  open,
  onOpenChange,
  member,
  onSuccess,
}: EditTeamMemberSitesModalProps) {
  const { toast } = useToast();
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allSites, setAllSites] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const restrictedKey = (member.allowed_construction_site_ids ?? []).join(',');

  useEffect(() => {
    if (!open) return;

    const ids = member.allowed_construction_site_ids;
    const restricted = Array.isArray(ids) && ids.length > 0;
    setAllSites(!restricted);
    setSelectedIds(restricted ? new Set(ids) : new Set());

    let cancelled = false;
    setLoadingSites(true);
    fetch(appendPortalClientId('/api/client-portal/team/construction-sites-options'), {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((json: { sites?: { id: string; name: string }[] }) => {
        if (cancelled) return;
        setSites(json.sites || []);
      })
      .catch(() => {
        if (!cancelled) setSites([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSites(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, member.user_id, restrictedKey]);

  const handleSave = useCallback(async () => {
    if (!allSites && sites.length > 0 && selectedIds.size === 0) {
      toast({
        title: 'Obras',
        description: 'Selecciona al menos una obra o marca «Todas las obras».',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const portalCid = getStoredPortalClientId();
      const url = appendPortalClientId(
        `/api/client-portal/team/${encodeURIComponent(member.user_id)}/construction-sites`
      );
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          construction_site_ids: allSites ? [] : Array.from(selectedIds),
          ...(portalCid ? { client_id: portalCid } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Error al guardar');
      }
      toast({ title: 'Guardado', description: 'Alcance de obras actualizado.' });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [allSites, member.user_id, onOpenChange, onSuccess, selectedIds, sites.length, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            Obras permitidas
          </DialogTitle>
          <DialogDescription>
            {member.first_name || member.last_name
              ? `${member.first_name || ''} ${member.last_name || ''}`.trim()
              : member.email}
            <br />
            Define a qué obras puede acceder este usuario en el portal. «Todas las obras» quita la restricción.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loadingSites ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando obras…
            </div>
          ) : sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay obras registradas para este cliente. Cuando existan, podrás asignarlas aquí.
            </p>
          ) : (
            <>
              <div className="flex items-center space-x-2 rounded-lg border p-3">
                <Checkbox
                  id="team-edit-all-sites"
                  checked={allSites}
                  onCheckedChange={(checked) => {
                    const on = checked === true;
                    setAllSites(on);
                    if (on) setSelectedIds(new Set());
                  }}
                />
                <Label htmlFor="team-edit-all-sites" className="cursor-pointer font-medium leading-snug">
                  Todas las obras ({sites.length})
                </Label>
              </div>

              {!allSites && (
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border p-3">
                  {sites.map((site) => (
                    <div key={site.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`team-site-${site.id}`}
                        checked={selectedIds.has(site.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (checked === true) next.add(site.id);
                            else next.delete(site.id);
                            return next;
                          });
                        }}
                      />
                      <Label htmlFor={`team-site-${site.id}`} className="cursor-pointer text-sm font-normal">
                        {site.name}
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
          <Button type="button" onClick={() => void handleSave()} disabled={saving || loadingSites}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
