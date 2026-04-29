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
import { clientService } from '@/lib/supabase/clients';
import type { ClientAssociation } from '@/lib/supabase/clientPortalAdmin';

export interface EditPortalMembershipSitesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  association: ClientAssociation;
  onSuccess?: () => void;
}

export function EditPortalMembershipSitesModal({
  open,
  onOpenChange,
  userId,
  association,
  onSuccess,
}: EditPortalMembershipSitesModalProps) {
  const { toast } = useToast();
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allSites, setAllSites] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const restrictedKey =
    association?.allowed_construction_site_ids?.join(',') ?? '';

  useEffect(() => {
    if (!open || !association) return;

    const ids = association.allowed_construction_site_ids;
    const restricted = Array.isArray(ids) && ids.length > 0;
    setAllSites(!restricted);
    setSelectedIds(restricted ? new Set(ids) : new Set());

    let cancelled = false;
    setLoadingSites(true);
    clientService
      .getClientSites(association.client_id, false, false)
      .then((rows) => {
        if (cancelled) return;
        setSites(
          (rows || []).map((r: { id: string; name: string }) => ({
            id: r.id,
            name: r.name,
          }))
        );
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
  }, [open, association?.client_id, association?.id, restrictedKey]);

  const handleSave = useCallback(async () => {
    if (!association) return;
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
      const body: Record<string, unknown> = {
        role: association.role_within_client,
      };
      if (association.role_within_client === 'user') {
        body.permissions = association.permissions as Record<string, boolean>;
      }
      body.constructionSiteIds = allSites ? [] : Array.from(selectedIds);

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
        description: 'Alcance de obras actualizado.',
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
    allSites,
    association,
    onOpenChange,
    onSuccess,
    selectedIds,
    sites.length,
    toast,
    userId,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            Obras permitidas (portal)
          </DialogTitle>
          <DialogDescription>
            Usuario: <span className="font-medium text-foreground">{association.client_name}</span>
            <br />
            Sin selección explícita = acceso a todas las obras de este cliente.
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
              Este cliente no tiene obras registradas. El usuario tendrá acceso cuando existan obras.
            </p>
          ) : (
            <>
              <div className="flex items-center space-x-2 rounded-lg border p-3">
                <Checkbox
                  id="edit-all-sites"
                  checked={allSites}
                  onCheckedChange={(checked) => {
                    const on = checked === true;
                    setAllSites(on);
                    if (on) setSelectedIds(new Set());
                  }}
                />
                <Label htmlFor="edit-all-sites" className="cursor-pointer font-medium leading-snug">
                  Todas las obras ({sites.length})
                </Label>
              </div>

              {!allSites && (
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border p-3">
                  {sites.map((site) => (
                    <div key={site.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`site-${site.id}`}
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
                      <Label htmlFor={`site-${site.id}`} className="cursor-pointer text-sm font-normal">
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
