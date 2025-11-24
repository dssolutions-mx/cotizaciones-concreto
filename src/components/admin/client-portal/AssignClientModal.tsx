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

// Cache clients list outside component to persist across modal opens/closes
let cachedClientsForAssign: Array<{ id: string; business_name: string; client_code: string }> | null = null;
let clientsCacheTimestampForAssign: number = 0;
const CLIENTS_CACHE_TTL_FOR_ASSIGN = 5 * 60 * 1000; // 5 minutes

function AssignClientModalComponent({
  open,
  onOpenChange,
  userId,
  existingClientIds = [],
  onSuccess,
}: AssignClientModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; client_code: string }>>(
    cachedClientsForAssign || []
  );
  const [loadingClients, setLoadingClients] = useState(false);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const form = useForm<AssignClientFormData>({
    resolver: zodResolver(assignClientSchema),
    defaultValues: {
      role: 'user',
    },
  });

  // Memoize loadClients function
  const loadClients = useCallback(async () => {
    // Use cached clients if available and not expired
    const now = Date.now();
    if (cachedClientsForAssign && (now - clientsCacheTimestampForAssign) < CLIENTS_CACHE_TTL_FOR_ASSIGN) {
      setClients(cachedClientsForAssign);
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

      const data = await clientService.getAllClients();
      
      // Update cache
      cachedClientsForAssign = data;
      clientsCacheTimestampForAssign = now;
      
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
    } else {
      // Reset form when modal closes
      form.reset({
        clientId: '',
        role: 'user',
      });
    }
  }, [open, form, loadClients]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Memoize submit handler
  const onSubmit = useCallback(async (data: AssignClientFormData) => {
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

      form.reset({
        clientId: '',
        role: 'user',
      });
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
  }, [userId, form, toast, onOpenChange, onSuccess]);

  // Memoize available clients
  const availableClients = useMemo(() => {
    return clients.filter(
      (client) => !existingClientIds.includes(client.id)
    );
  }, [clients, existingClientIds]);

  // Memoize modal close handler
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
                onClick={handleClose}
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

// Memoize the component to prevent unnecessary re-renders
export const AssignClientModal = React.memo(AssignClientModalComponent);

