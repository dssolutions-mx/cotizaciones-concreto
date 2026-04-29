'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { clientService } from '@/lib/supabase/clients';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const createPortalUserSchema = z.object({
  email: z.string().email('Email inválido'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  clientIds: z.array(z.string()).min(1, 'Debe seleccionar al menos un cliente'),
  roles: z.record(z.enum(['executive', 'user'])),
});

type CreatePortalUserFormData = z.infer<typeof createPortalUserSchema>;

interface CreatePortalUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultClientIds?: string[];
}

// Cache clients list outside component to persist across modal opens/closes
let cachedClients: Array<{ id: string; business_name: string; client_code: string }> | null = null;
let clientsCacheTimestamp: number = 0;
const CLIENTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Stable default when `defaultClientIds` is omitted — avoid `= []` (new array every render → useEffect loops). */
const EMPTY_DEFAULT_CLIENT_IDS: string[] = [];

function CreatePortalUserModalComponent({
  open,
  onOpenChange,
  onSuccess,
  defaultClientIds = EMPTY_DEFAULT_CLIENT_IDS,
}: CreatePortalUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; client_code: string }>>(
    cachedClients || []
  );
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientRoles, setClientRoles] = useState<Record<string, 'executive' | 'user'>>({});
  type ClientSitePick = {
    allSites: boolean;
    selectedIds: Set<string>;
    loaded: boolean;
    options: { id: string; name: string }[];
  };
  const [sitePicks, setSitePicks] = useState<Record<string, ClientSitePick>>({});
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const form = useForm<CreatePortalUserFormData>({
    resolver: zodResolver(createPortalUserSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      clientIds: [],
      roles: {},
    },
  });

  // Memoize loadClients function
  const loadClients = useCallback(async () => {
    // Use cached clients if available and not expired
    const now = Date.now();
    if (cachedClients && (now - clientsCacheTimestamp) < CLIENTS_CACHE_TTL) {
      setClients(cachedClients);
      setLoadingClients(false);
      return;
    }

    try {
      setLoadingClients(true);
      
      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const data = await clientService.getApprovedClients();
      
      // Update cache
      cachedClients = data;
      clientsCacheTimestamp = now;
      
      setClients(data);
    } catch (error: any) {
      console.error('Error loading clients:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar clientes',
        variant: 'destructive',
      });
    } finally {
      setLoadingClients(false);
    }
  }, [toast]);

  const defaultClientIdsKey =
    defaultClientIds.length === 0
      ? ''
      : [...defaultClientIds].slice().sort().join(',');

  // Load clients when modal opens
  useEffect(() => {
    if (open) {
      loadClients();
      
      // Pre-select default clients if provided
      if (defaultClientIds.length > 0) {
        setSelectedClients(defaultClientIds);
        const defaultRoles: Record<string, 'executive' | 'user'> = {};
        defaultClientIds.forEach((clientId) => {
          defaultRoles[clientId] = 'executive';
        });
        setClientRoles(defaultRoles);
        form.setValue('clientIds', defaultClientIds);
        form.setValue('roles', defaultRoles);
        defaultClientIds.forEach((clientId) => {
          void (async () => {
            try {
              const sites = await clientService.getClientSites(clientId, false, false);
              setSitePicks((prev) => ({
                ...prev,
                [clientId]: {
                  allSites: true,
                  selectedIds: new Set(),
                  loaded: true,
                  options: (sites || []).map((s: { id: string; name: string }) => ({
                    id: s.id,
                    name: s.name,
                  })),
                },
              }));
            } catch {
              setSitePicks((prev) => ({
                ...prev,
                [clientId]: { allSites: true, selectedIds: new Set(), loaded: true, options: [] },
              }));
            }
          })();
        });
      }
    } else {
      // Reset form and state when modal closes
      form.reset({
        email: '',
        firstName: '',
        lastName: '',
        clientIds: [],
        roles: {},
      });
      setSelectedClients([]);
      setClientRoles({});
      setSitePicks({});
    }
  }, [open, defaultClientIdsKey, form, loadClients]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Memoize client toggle handler
  const handleClientToggle = useCallback((clientId: string) => {
    if (selectedClients.includes(clientId)) {
      const newSelected = selectedClients.filter(id => id !== clientId);
      setSelectedClients(newSelected);
      const newRoles = { ...clientRoles };
      delete newRoles[clientId];
      setClientRoles(newRoles);
      form.setValue('clientIds', newSelected);
      form.setValue('roles', newRoles);
      setSitePicks((prev) => {
        const next = { ...prev };
        delete next[clientId];
        return next;
      });
    } else {
      const newSelected = [...selectedClients, clientId];
      setSelectedClients(newSelected);
      const newRoles = { ...clientRoles, [clientId]: 'user' as const };
      setClientRoles(newRoles);
      form.setValue('clientIds', newSelected);
      form.setValue('roles', newRoles);
      void (async () => {
        try {
          const sites = await clientService.getClientSites(clientId, false, false);
          setSitePicks((prev) => ({
            ...prev,
            [clientId]: {
              allSites: true,
              selectedIds: new Set(),
              loaded: true,
              options: (sites || []).map((s: { id: string; name: string }) => ({
                id: s.id,
                name: s.name,
              })),
            },
          }));
        } catch {
          setSitePicks((prev) => ({
            ...prev,
            [clientId]: { allSites: true, selectedIds: new Set(), loaded: true, options: [] },
          }));
        }
      })();
    }
  }, [selectedClients, clientRoles, form]);

  // Memoize role change handler
  const handleRoleChange = useCallback((clientId: string, role: 'executive' | 'user') => {
    const newRoles = { ...clientRoles, [clientId]: role };
    setClientRoles(newRoles);
    form.setValue('roles', newRoles);
  }, [clientRoles, form]);

  // Memoize submit handler
  const onSubmit = useCallback(async (data: CreatePortalUserFormData) => {
    const constructionSiteIdsByClient: Record<string, string[]> = {};
    for (const cid of data.clientIds) {
      const pick = sitePicks[cid];
      if (!pick?.loaded) continue;
      if (!pick.allSites) {
        const ids = [...pick.selectedIds];
        if (ids.length === 0) {
          const label = clients.find((c) => c.id === cid)?.business_name || cid;
          toast({
            title: 'Obras requeridas',
            description: `Selecciona al menos una obra para "${label}" o marca "Todas las obras".`,
            variant: 'destructive',
          });
          return;
        }
        constructionSiteIdsByClient[cid] = ids;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/client-portal-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          clientIds: data.clientIds,
          roles: data.roles,
          constructionSiteIdsByClient:
            Object.keys(constructionSiteIdsByClient).length > 0 ? constructionSiteIdsByClient : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear usuario');
      }

      toast({
        title: 'Usuario creado',
        description: 'El usuario del portal ha sido creado exitosamente',
      });

      // Reset form and state
      form.reset({
        email: '',
        firstName: '',
        lastName: '',
        clientIds: [],
        roles: {},
      });
      setSelectedClients([]);
      setClientRoles({});
      setSitePicks({});
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error al crear usuario',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [form, toast, onOpenChange, onSuccess, sitePicks, clients]);

  // Memoize modal close handler
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Usuario del Portal</DialogTitle>
          <DialogDescription>
            Crea un nuevo usuario del portal y asígnalo a uno o más clientes
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input placeholder="usuario@ejemplo.com" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido</FormLabel>
                    <FormControl>
                      <Input placeholder="Pérez" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <FormLabel>Clientes *</FormLabel>
              {loadingClients ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                  {clients.length === 0 ? (
                    <div className="text-sm text-gray-500 py-2 text-center">
                      No hay clientes disponibles
                    </div>
                  ) : (
                    clients.map((client) => {
                      const isSelected = selectedClients.includes(client.id);
                      return (
                        <div key={client.id} className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`client-${client.id}`}
                              checked={isSelected}
                              onChange={() => handleClientToggle(client.id)}
                              className="rounded border-gray-300"
                            />
                            <Label
                              htmlFor={`client-${client.id}`}
                              className="cursor-pointer flex-1"
                            >
                              {client.business_name} ({client.client_code})
                            </Label>
                          </div>
                          {isSelected && (
                            <div className="ml-6 space-y-2">
                              <Label className="text-xs text-gray-600">Rol:</Label>
                              <RadioGroup
                                value={clientRoles[client.id] || 'user'}
                                onValueChange={(value) =>
                                  handleRoleChange(client.id, value as 'executive' | 'user')
                                }
                                className="flex gap-4"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="executive" id={`exec-${client.id}`} />
                                  <Label htmlFor={`exec-${client.id}`} className="cursor-pointer text-sm">
                                    Ejecutivo
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="user" id={`usr-${client.id}`} />
                                  <Label htmlFor={`usr-${client.id}`} className="cursor-pointer text-sm">
                                    Usuario
                                  </Label>
                                </div>
                              </RadioGroup>
                              {(() => {
                                const pick = sitePicks[client.id];
                                if (!pick?.loaded) {
                                  return (
                                    <p className="text-xs text-muted-foreground mt-1">Cargando obras…</p>
                                  );
                                }
                                if (pick.options.length === 0) {
                                  return null;
                                }
                                return (
                                  <div className="mt-2 space-y-2 rounded border p-2 bg-muted/30">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`all-sites-${client.id}`}
                                        checked={pick.allSites}
                                        onCheckedChange={(checked) => {
                                          const v = checked === true;
                                          setSitePicks((prev) => ({
                                            ...prev,
                                            [client.id]: {
                                              ...prev[client.id],
                                              allSites: v,
                                              selectedIds: v ? new Set() : prev[client.id].selectedIds,
                                            },
                                          }));
                                        }}
                                      />
                                      <Label htmlFor={`all-sites-${client.id}`} className="text-xs cursor-pointer">
                                        Todas las obras
                                      </Label>
                                    </div>
                                    {!pick.allSites && (
                                      <div className="max-h-36 overflow-y-auto space-y-1 pl-1">
                                        {pick.options.map((site) => (
                                          <div key={site.id} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`site-${client.id}-${site.id}`}
                                              checked={pick.selectedIds.has(site.id)}
                                              onCheckedChange={(checked) => {
                                                setSitePicks((prev) => {
                                                  const cur = prev[client.id];
                                                  if (!cur) return prev;
                                                  const nextIds = new Set(cur.selectedIds);
                                                  if (checked === true) nextIds.add(site.id);
                                                  else nextIds.delete(site.id);
                                                  return {
                                                    ...prev,
                                                    [client.id]: { ...cur, selectedIds: nextIds },
                                                  };
                                                });
                                              }}
                                            />
                                            <Label
                                              htmlFor={`site-${client.id}-${site.id}`}
                                              className="text-xs cursor-pointer font-normal"
                                            >
                                              {site.name}
                                            </Label>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {form.formState.errors.clientIds && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.clientIds.message}
                </p>
              )}
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || selectedClients.length === 0}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Usuario
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const CreatePortalUserModal = React.memo(CreatePortalUserModalComponent);

