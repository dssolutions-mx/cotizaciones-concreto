'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// Define types for construction sites
interface ConstructionSite {
  id: string;
  name: string;
}

// Define types for clients
interface Client {
  id: string;
  business_name: string;
}

// Modal component props
interface BalanceAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  clientBalance: number;
  clientSites?: ConstructionSite[];
  onAdjustmentComplete: () => void;
}

// Form validation schema
const adjustmentFormSchema = z.object({
  adjustmentType: z.enum(['TRANSFER', 'SITE_TRANSFER', 'MANUAL_ADDITION']),
  transferType: z.enum(['DEBT', 'CREDIT']),
  targetClientId: z.string().optional().refine(val => {
    // This field is required when adjustmentType is TRANSFER
    return true; // We'll handle this manually in the form
  }),
  amount: z.string().min(1, "El monto es requerido").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    { message: "Debe ser un número mayor que cero" }
  ),
  sourceSite: z.string().optional(),
  targetSite: z.string().optional(),
  notes: z.string().min(1, "Se requiere una descripción o justificación del ajuste"),
});

// Main component for balance adjustment modal
export default function BalanceAdjustmentModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  clientBalance,
  clientSites = [],
  onAdjustmentComplete
}: BalanceAdjustmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [hasBalances, setHasBalances] = useState(true);
  const [clientSiteBalances, setClientSiteBalances] = useState<{[key: string]: number}>({});
  const clientsLoadedRef = useRef(false);
  const { mutate } = useSWRConfig();

  // Initialize form with hook-form and zod for validations
  const form = useForm<z.infer<typeof adjustmentFormSchema>>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: {
      adjustmentType: 'TRANSFER',
      transferType: 'DEBT',
      amount: '',
      notes: '',
    },
  });

  // Get selected adjustment type for conditional rendering
  const adjustmentType = form.watch('adjustmentType');
  const transferType = form.watch('transferType');

  // Load clients for target client selection
  const loadClients = useCallback(async () => {
    // Si ya estamos cargando o ya cargamos clientes y tenemos datos, no volver a cargar
    if (clientsLoading || (clientsLoadedRef.current && clients.length > 0)) return;
    
    setClientsLoading(true);
    try {
      // Cargar clientes excluyendo el cliente actual
      const { data, error } = await supabase
        .from('clients')
        .select('id, business_name')
        .neq('id', clientId) // Exclude current client
        .order('business_name');
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.warn("No se encontraron clientes para transferir");
      }
      
      setClients(data || []);
      clientsLoadedRef.current = true;
      return data;
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('No se pudieron cargar los clientes');
      return [];
    } finally {
      setClientsLoading(false);
    }
  }, [clientId, clientsLoading, clients.length]);

  // Handle adjustment type change
  const handleAdjustmentTypeChange = (value: string) => {
    form.setValue('adjustmentType', value as any);
    
    // If transferring between clients, load client list
    if (value === 'TRANSFER') {
      // Si no hay clientes cargados, forzar una nueva carga
      if (!clientsLoadedRef.current || clients.length === 0) {
        clientsLoadedRef.current = false; // Reiniciar indicador para forzar la carga
        loadClients();
      }
    }
    
    // Para transferencia entre obras, inicializar valores por defecto
    if (value === 'SITE_TRANSFER') {
      form.setValue('sourceSite', '_empty'); // Inicializar como Balance General
      form.setValue('targetSite', '_empty'); // Inicializar como Balance General
    }
    else {
      // Reset related fields
      form.setValue('targetClientId', undefined);
      form.setValue('sourceSite', undefined);
      form.setValue('targetSite', undefined);
    }
  };

  // Función para verificar si el cliente tiene balances
  const checkBalances = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('client_balances')
        .select('id, current_balance, construction_site')
        .eq('client_id', clientId)
        .limit(10);
      
      if (error) throw error;
      
      // Actualizar el mapa de balances por obra
      const balances: {[key: string]: number} = {};
      data.forEach(balance => {
        const siteName = balance.construction_site || '_empty';
        balances[siteName] = balance.current_balance;
      });
      setClientSiteBalances(balances);
      
      // Verificar si hay al menos un balance general (construction_site = null)
      const hasGeneralBalance = data.some(balance => balance.construction_site === null);
      
      if (!hasGeneralBalance) {
        console.warn('El cliente no tiene un balance general registrado, las transferencias entre obras pueden fallar');
        toast.warning('Este cliente no tiene un balance general registrado. Las transferencias desde el balance general no funcionarán.', {
          duration: 5000
        });
      }
      
      setHasBalances(data && data.length > 0);
      return data || [];
    } catch (error) {
      console.error('Error verificando balances:', error);
      setHasBalances(false);
      return [];
    }
  }, [clientId]);

  // Verificar balances cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      // Verificar balances
      checkBalances();
    }
  }, [isOpen, checkBalances]);
  
  // Efecto separado para cargar clientes cuando se necesitan
  useEffect(() => {
    if (isOpen && form.getValues().adjustmentType === 'TRANSFER') {
      loadClients();
    }
  }, [isOpen, loadClients]);

  // Recalcular saldos cuando cambie la obra origen
  const sourceSite = form.watch('sourceSite');
  useEffect(() => {
    // Este efecto se puede usar para actualizar la UI cuando cambia la obra origen
    // pero no necesitamos agregar console.log aquí
  }, [sourceSite, adjustmentType]);

  // Resetear el estado cuando el modal se cierra
  useEffect(() => {
    if (!isOpen) {
      // Si el modal se cierra, preparar para la próxima apertura
      clientsLoadedRef.current = false;
    }
  }, [isOpen]);

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof adjustmentFormSchema>) => {
    // Validate targetClientId for TRANSFER type
    if (values.adjustmentType === 'TRANSFER' && !values.targetClientId) {
      form.setError('targetClientId', {
        type: 'manual',
        message: 'Se requiere seleccionar un cliente destino'
      });
      return;
    }
    
    // Validate sourceSite and targetSite for SITE_TRANSFER type
    if (values.adjustmentType === 'SITE_TRANSFER') {
      if (!values.sourceSite && !values.targetSite) {
        toast.error('Debe seleccionar al menos una obra origen o destino');
        return;
      }

      if (values.sourceSite === values.targetSite && values.sourceSite !== undefined && values.sourceSite !== '') {
        toast.error('La obra origen y destino no pueden ser la misma');
        return;
      }
      
      // Asegurar que tanto origen como destino están presentes
      if (values.sourceSite === undefined) {
        form.setValue('sourceSite', '_empty'); // Usar balance general si no se seleccionó una obra origen
      }
      
      if (values.targetSite === undefined) {
        form.setValue('targetSite', '_empty'); // Usar balance general si no se seleccionó una obra destino
      }
      
      // Advertir si no hay balances disponibles
      if (!hasBalances) {
        const confirmTransfer = window.confirm('No se detectaron balances para este cliente, lo que podría causar errores en la transferencia. ¿Desea continuar de todos modos?');
        if (!confirmTransfer) {
          return;
        }
      }
      
      // Si el origen es balance general (null), verificar si hay una advertencia
      if (values.sourceSite === '_empty' || !values.sourceSite) {
        // No necesitamos un console.log aquí
      }
    }
    
    // Verificar si hay suficiente saldo cuando es un cargo (DEBT)
    if (values.transferType === 'DEBT') {
      const amount = parseFloat(values.amount);
      
      // Para transferencias entre obras
      if (values.adjustmentType === 'SITE_TRANSFER') {
        const sourceSite = values.sourceSite === '_empty' || !values.sourceSite ? '_empty' : values.sourceSite;
        const siteBalance = clientSiteBalances[sourceSite];
        
        // Si tenemos el balance para esa obra, verificamos
        if (siteBalance !== undefined && amount > siteBalance) {
          toast.error(`No hay suficiente saldo para transferir. Saldo disponible: ${formatCurrency(siteBalance)}`);
          return;
        }
      }
      // Para otras transferencias (entre clientes)
      else if (values.adjustmentType === 'TRANSFER') {
        // Verificamos contra el balance general del cliente
        if (amount > clientBalance) {
          toast.error(`No hay suficiente saldo para transferir. Saldo disponible: ${formatCurrency(clientBalance)}`);
          return;
        }
      }
    }
    
    setIsSubmitting(true);
    
    try {
      // Determine which function to call
      const functionName = values.adjustmentType === 'TRANSFER' 
        ? 'transfer_client_balance' 
        : values.adjustmentType === 'SITE_TRANSFER'
          ? 'transfer_site_balance'
          : 'add_historical_balance';
      
      // Check if the function exists
      try {
        // Don't actually call the function for the check - just see if it exists in metadata
        const { error: functionCheck } = await supabase.rpc(functionName, null, {
          count: 'exact',
          head: true
        });
        
        if (functionCheck && functionCheck.message.includes('function does not exist')) {
          toast.error(`Esta funcionalidad aún no está disponible. Por favor, contacte al administrador del sistema.`);
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        // Some Supabase versions handle this as an exception
        // We can continue since this is just a preflight check
        console.log(`Error checking ${functionName} availability:`, err);
      }
      
      const amount = parseFloat(values.amount);
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      if (!userId) {
        throw new Error('No se pudo determinar el usuario actual. Inicie sesión nuevamente.');
      }
      
      // Prepare parameters based on adjustment type
      let params: Record<string, any> = {};
      
      switch (values.adjustmentType) {
        case 'TRANSFER':
          params = {
            p_source_client_id: clientId,
            p_target_client_id: values.targetClientId,
            p_amount: amount,
            p_transfer_type: values.transferType,
            p_notes: values.notes,
            p_created_by: userId
          };
          break;
        
        case 'SITE_TRANSFER':
          params = {
            p_client_id: clientId,
            p_source_site: values.sourceSite === '_empty' ? null : values.sourceSite, 
            p_target_site: values.targetSite === '_empty' ? null : values.targetSite,
            p_amount: amount,
            p_transfer_type: values.transferType,
            p_notes: values.notes,
            p_created_by: userId
          };
          
          // Para depuración
          console.log(`SITE_TRANSFER: Intentando transferir de '${values.sourceSite === '_empty' ? "BALANCE GENERAL" : values.sourceSite}' a '${values.targetSite === '_empty' ? "BALANCE GENERAL" : values.targetSite}'`);
          break;
        
        case 'MANUAL_ADDITION':
          params = {
            p_amount: amount,
            p_balance_type: values.transferType,
            p_client_id: clientId,
            p_created_by: userId,
            p_notes: values.notes,
            p_site_name: values.sourceSite === '_empty' ? null : values.sourceSite
          };
          break;
      }
      
      console.log(`Calling RPC function ${functionName} with params:`, params);
      
      // Para SITE_TRANSFER, validar explícitamente que source_site está definido
      if (values.adjustmentType === 'SITE_TRANSFER') {
        // Mantener estos logs porque son útiles para entender los valores enviados al backend
        console.log("Source site:", values.sourceSite, "Target site:", values.targetSite);
        console.log("Final source site param:", params.p_source_site);
        console.log("Final target site param:", params.p_target_site);
      }
      
      // Call the appropriate RPC function
      const { data, error } = await supabase.rpc(functionName, params);
      
      if (error) {
        console.error('Detailed Supabase error:', error);
        console.error(`Error calling ${functionName} with params:`, JSON.stringify(params));
        
        // Provide a user-friendly error message
        let userMessage = 'No se pudo realizar el ajuste de saldo.';
        
        if (error.message) {
          if (error.message.includes('function does not exist')) {
            userMessage = `Esta funcionalidad (${functionName}) no está disponible actualmente. Por favor contacte al administrador del sistema.`;
          } else if (error.message.includes('El monto a transferir debe ser positivo')) {
            userMessage = 'El monto debe ser un valor positivo mayor que cero.';
          } else if (error.message.includes('No se puede transferir más del saldo disponible')) {
            userMessage = 'No se puede transferir más del saldo disponible.';
          } else if (error.message.includes('Obra origen no encontrada') || error.message.includes('sin balance registrado')) {
            // Manejo específico para el error de obra sin balance
            userMessage = `No existe balance para la obra origen seleccionada. Por favor, asegúrese de que la obra tenga un saldo registrado antes de realizar transferencias.`;
          } else if (error.message.includes('in the schema cache')) {
            userMessage = 'Error en los parámetros de la función. Por favor contacte soporte técnico.';
            console.error('Schema parameter mismatch:', error);
            
            // Para el caso específico de transfer_site_balance
            if (error.message.includes('transfer_site_balance') && error.hint) {
              userMessage = `Error en la transferencia entre obras: faltó especificar uno o más parámetros obligatorios. Por favor contacte a soporte técnico.`;
            }
          } else if (error.hint) {
            // If there's a hint, check it to improve the message
            userMessage = `${error.message}. Sugerencia: ${error.hint}`;
          } else {
            userMessage = error.message;
          }
        }
        
        throw new Error(userMessage);
      }
      
      // Success message based on adjustment type
      let successMessage = '';
      switch (values.adjustmentType) {
        case 'TRANSFER':
          const targetClient = clients.find(c => c.id === values.targetClientId);
          successMessage = `Transferencia de ${formatCurrency(amount)} realizada de ${clientName} a ${targetClient?.business_name || 'otro cliente'}`;
          break;
        case 'SITE_TRANSFER':
          successMessage = `Transferencia de ${formatCurrency(amount)} realizada entre obras`;
          break;
        case 'MANUAL_ADDITION':
          successMessage = `${values.transferType === 'DEBT' ? 'Cargo' : 'Abono'} de ${formatCurrency(amount)} registrado correctamente`;
          break;
      }
      
      toast.success(successMessage);
      
      // Close modal and update data
      onClose();
      onAdjustmentComplete();
      
    } catch (error: any) {
      console.error('Error adjusting balance:', error);
      toast.error(`${error.message || 'No se pudo realizar el ajuste de saldo'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verificamos si hay suficiente saldo para la transferencia
  const getAvailableBalance = () => {
    const sourceSite = form.getValues().sourceSite === '_empty' || !form.getValues().sourceSite 
      ? '_empty' 
      : form.getValues().sourceSite;
    
    // Si estamos haciendo una transferencia entre obras, mostrar el saldo de la obra seleccionada
    if (adjustmentType === 'SITE_TRANSFER' && sourceSite && clientSiteBalances[sourceSite] !== undefined) {
      return clientSiteBalances[sourceSite];
    }
    
    // En otros casos, mostrar el saldo general del cliente
    return clientBalance;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Ajustar Saldo de Cliente</DialogTitle>
          <DialogDescription>
            {clientName} - Saldo actual: {formatCurrency(clientBalance)}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            {/* Adjustment Type */}
            <FormField
              control={form.control}
              name="adjustmentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Ajuste</FormLabel>
                  <Select
                    onValueChange={handleAdjustmentTypeChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el tipo de ajuste" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TRANSFER">Transferir balance a otro cliente</SelectItem>
                      <SelectItem value="SITE_TRANSFER">Transferir balance entre obras</SelectItem>
                      <SelectItem value="MANUAL_ADDITION">Agregar saldo histórico</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Transfer Type (Debt or Credit) */}
            <FormField
              control={form.control}
              name="transferType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {adjustmentType === 'MANUAL_ADDITION' 
                      ? 'Tipo de Balance a Agregar' 
                      : 'Tipo de Transferencia'}
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DEBT">Deuda (cargo)</SelectItem>
                      <SelectItem value="CREDIT">Crédito (abono)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Target Client (only for TRANSFER) */}
            {adjustmentType === 'TRANSFER' && (
              <FormField
                control={form.control}
                name="targetClientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente Destino</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione cliente destino" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientsLoading ? (
                          <SelectItem value="loading" disabled>Cargando clientes...</SelectItem>
                        ) : clients.length > 0 ? (
                          clients.map(client => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.business_name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="empty" disabled>No hay otros clientes disponibles</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {/* Source Site (for SITE_TRANSFER and MANUAL_ADDITION) */}
            {(adjustmentType === 'SITE_TRANSFER' || adjustmentType === 'MANUAL_ADDITION') && (
              <FormField
                control={form.control}
                name="sourceSite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {adjustmentType === 'SITE_TRANSFER' ? 'Obra Origen' : 'Obra (opcional)'}
                    </FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(value)}
                        defaultValue={field.value || '_empty'}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {field.value === '_empty' || !field.value 
                              ? "Balance General" 
                              : field.value}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_empty">Balance General</SelectItem>
                          {clientSites.map(site => (
                            <SelectItem key={site.id} value={site.name}>
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {adjustmentType === 'SITE_TRANSFER' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        "Balance General" representa todas las transacciones no asociadas a una obra específica.
                        <br />
                        <span className="text-green-600 font-medium">Puede transferir desde el Balance General a una obra específica o viceversa.</span>
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {/* Target Site (for SITE_TRANSFER) */}
            {adjustmentType === 'SITE_TRANSFER' && (
              <FormField
                control={form.control}
                name="targetSite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Obra Destino</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(value)}
                        defaultValue={field.value || '_empty'}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {field.value === '_empty' || !field.value 
                              ? "Balance General" 
                              : field.value}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_empty">Balance General</SelectItem>
                          {clientSites
                            .filter(site => site.name !== form.getValues().sourceSite || form.getValues().sourceSite === '_empty')
                            .map(site => (
                              <SelectItem key={site.id} value={site.name}>
                                {site.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Para transferir al balance general, seleccione "Balance General".
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input placeholder="0.00" {...field} />
                  </FormControl>
                  {transferType === 'DEBT' && (
                    <p className="text-xs text-blue-600 mt-1">
                      Saldo disponible: {formatCurrency(getAvailableBalance())}
                      {adjustmentType === 'SITE_TRANSFER' && (
                        <span>
                          {form.getValues().sourceSite === '_empty' || !form.getValues().sourceSite
                            ? ' (Balance General)'
                            : ` (Obra: ${form.getValues().sourceSite})`}
                        </span>
                      )}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas / Justificación</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Indique el motivo del ajuste de saldo" 
                      className="min-h-[80px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button 
                variant="outline" 
                type="button"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full"
                title={
                  form.getValues().adjustmentType === 'SITE_TRANSFER' 
                    ? "Asegúrese de que la obra origen tenga un balance registrado" 
                    : undefined
                }
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Procesando...
                  </div>
                ) : (
                  'Confirmar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 