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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { clientService } from '@/lib/supabase/clients';
import { useToast } from '@/components/ui/use-toast';

const assignClientSchema = z.object({
  clientId: z.string().uuid('Debe seleccionar un cliente'),
  role: z.enum(['executive', 'user'], {
    required_error: 'Debe seleccionar un rol',
  }),
});

type AssignClientFormData = z.infer<typeof assignClientSchema>;

interface AssignClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  existingClientIds?: string[];
  onSuccess?: () => void;
}

export function AssignClientModal({
  open,
  onOpenChange,
  userId,
  existingClientIds = [],
  onSuccess,
}: AssignClientModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; client_code: string }>>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const { toast } = useToast();

  const form = useForm<AssignClientFormData>({
    resolver: zodResolver(assignClientSchema),
    defaultValues: {
      role: 'user',
    },
  });

  useEffect(() => {
    if (open) {
      loadClients();
    }
  }, [open]);

  const loadClients = async () => {
    try {
      setLoadingClients(true);
      const data = await clientService.getAllClients();
      // Filter out already assigned clients
      const availableClients = data.filter(
        (client: any) => !existingClientIds.includes(client.id)
      );
      setClients(availableClients);
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

  const onSubmit = async (data: AssignClientFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/client-portal-users/${userId}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: data.clientId,
          role: data.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al asignar cliente');
      }

      toast({
        title: 'Cliente asignado',
        description: 'El cliente ha sido asignado exitosamente al usuario',
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error al asignar cliente',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableClients = clients.filter(
    (client) => !existingClientIds.includes(client.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Asignar Cliente</DialogTitle>
          <DialogDescription>
            Asigna un cliente a este usuario del portal
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <FormControl>
                    {loadingClients ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableClients.length === 0 ? (
                            <SelectItem value="no-clients" disabled>
                              No hay clientes disponibles
                            </SelectItem>
                          ) : (
                            availableClients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.business_name} ({client.client_code})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="space-y-2"
                    >
                      <div className="flex items-start space-x-3 rounded-lg border p-4">
                        <RadioGroupItem value="executive" id="role-executive" />
                        <div className="space-y-1">
                          <Label htmlFor="role-executive" className="cursor-pointer">
                            Ejecutivo
                          </Label>
                          <p className="text-xs text-gray-600">
                            Acceso completo a todas las funciones, puede gestionar equipo y aprobar pedidos
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 rounded-lg border p-4">
                        <RadioGroupItem value="user" id="role-user" />
                        <div className="space-y-1">
                          <Label htmlFor="role-user" className="cursor-pointer">
                            Usuario
                          </Label>
                          <p className="text-xs text-gray-600">
                            Permisos configurables, acceso limitado según configuración
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || availableClients.length === 0}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Asignar Cliente
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

