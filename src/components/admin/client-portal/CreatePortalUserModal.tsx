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

function CreatePortalUserModalComponent({
  open,
  onOpenChange,
  onSuccess,
  defaultClientIds = [],
}: CreatePortalUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; client_code: string }>>(
    cachedClients || []
  );
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientRoles, setClientRoles] = useState<Record<string, 'executive' | 'user'>>({});
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

  // Load clients when modal opens
  useEffect(() => {
    if (open) {
      loadClients();
      
      // Pre-select default clients if provided
      if (defaultClientIds.length > 0) {
        setSelectedClients(defaultClientIds);
        const defaultRoles: Record<string, 'executive' | 'user'> = {};
        defaultClientIds.forEach(clientId => {
          defaultRoles[clientId] = 'executive'; // Default to executive for new users
        });
        setClientRoles(defaultRoles);
        form.setValue('clientIds', defaultClientIds);
        form.setValue('roles', defaultRoles);
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
    }
  }, [open, defaultClientIds, form, loadClients]);

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
    } else {
      const newSelected = [...selectedClients, clientId];
      setSelectedClients(newSelected);
      const newRoles = { ...clientRoles, [clientId]: 'user' as const };
      setClientRoles(newRoles);
      form.setValue('clientIds', newSelected);
      form.setValue('roles', newRoles);
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
  }, [form, toast, onOpenChange, onSuccess]);

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

