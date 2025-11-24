'use client';

import React, { useState, useEffect } from 'react';
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
}

export function CreatePortalUserModal({
  open,
  onOpenChange,
  onSuccess,
  defaultClientIds = [],
}: CreatePortalUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; client_code: string }>>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientRoles, setClientRoles] = useState<Record<string, 'executive' | 'user'>>({});
  const { toast } = useToast();

  const form = useForm<CreatePortalUserFormData>({
    resolver: zodResolver(createPortalUserSchema),
    defaultValues: {
      clientIds: [],
      roles: {},
    },
  });

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
      form.reset();
      setSelectedClients([]);
      setClientRoles({});
    }
  }, [open, defaultClientIds]);

  const loadClients = async () => {
    try {
      setLoadingClients(true);
      const data = await clientService.getAllClients();
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
  };

  const handleClientToggle = (clientId: string) => {
    if (selectedClients.includes(clientId)) {
      setSelectedClients(selectedClients.filter(id => id !== clientId));
      const newRoles = { ...clientRoles };
      delete newRoles[clientId];
      setClientRoles(newRoles);
      form.setValue('clientIds', selectedClients.filter(id => id !== clientId));
      form.setValue('roles', newRoles);
    } else {
      const newSelected = [...selectedClients, clientId];
      setSelectedClients(newSelected);
      const newRoles = { ...clientRoles, [clientId]: 'user' as const };
      setClientRoles(newRoles);
      form.setValue('clientIds', newSelected);
      form.setValue('roles', newRoles);
    }
  };

  const handleRoleChange = (clientId: string, role: 'executive' | 'user') => {
    const newRoles = { ...clientRoles, [clientId]: role };
    setClientRoles(newRoles);
    form.setValue('roles', newRoles);
  };

  const onSubmit = async (data: CreatePortalUserFormData) => {
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

      form.reset();
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                    <Input placeholder="usuario@ejemplo.com" {...field} />
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
                      <Input placeholder="Juan" {...field} />
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
                      <Input placeholder="Pérez" {...field} />
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
                onClick={() => onOpenChange(false)}
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

