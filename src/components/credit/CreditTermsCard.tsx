'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { Edit3, Save, X, CreditCard, Calendar, FileText, Trash2 } from 'lucide-react';
import { ClientCreditTerms } from '@/lib/supabase/creditTerms';
import { formatCurrency, formatDate, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PAYMENT_INSTRUMENT_LABELS: Record<string, string> = {
  pagare_2_a_1: 'Pagaré 2 a 1',
  garantia_prendaria: 'Garantía Prendaria',
  contrato: 'Contrato',
  cheque_post_fechado: 'Cheque Post Fechado',
  visto_bueno_direccion: 'Visto Bueno por Dirección',
};

// Validation schema for credit terms
const creditTermsSchema = z.object({
  credit_limit: z.string().refine(
    (val) => val === '' || (!isNaN(Number(val)) && Number(val) >= 0),
    {
      message: 'Debe ser un número válido mayor o igual a cero',
    }
  ),
  pagare_amount: z.string().refine(
    (val) => val === '' || (!isNaN(Number(val)) && Number(val) >= 0),
    {
      message: 'Debe ser un número válido mayor o igual a cero',
    }
  ),
  pagare_expiry_date: z.string().optional(),
  payment_frequency_days: z.string().refine(
    (val) => val === '' || (!isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 365),
    {
      message: 'Debe ser un número entre 1 y 365 días',
    }
  ),
  grace_period_days: z.string().refine(
    (val) => val === '' || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 90),
    {
      message: 'Debe ser un número entre 0 y 90 días',
    }
  ),
  payment_instrument_type: z.enum(['pagare_2_a_1', 'garantia_prendaria', 'contrato', 'cheque_post_fechado', 'visto_bueno_direccion']).optional().nullable(),
  notes: z.string().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional(),
});

type CreditTermsFormData = z.infer<typeof creditTermsSchema>;

interface CreditTermsCardProps {
  clientId: string;
  clientName: string;
  creditTerms: ClientCreditTerms | null;
  onSave?: (terms: ClientCreditTerms) => void;
  onDelete?: () => void;
  isEditable?: boolean;
}

export default function CreditTermsCard({
  clientId,
  clientName,
  creditTerms,
  onSave,
  onDelete,
  isEditable = true,
}: CreditTermsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const form = useForm<CreditTermsFormData>({
    resolver: zodResolver(creditTermsSchema),
    defaultValues: {
      credit_limit: creditTerms?.credit_limit?.toString() || '',
      pagare_amount: creditTerms?.pagare_amount?.toString() || '',
      pagare_expiry_date: creditTerms?.pagare_expiry_date || '',
      payment_frequency_days: creditTerms?.payment_frequency_days?.toString() || '',
      grace_period_days: creditTerms?.grace_period_days?.toString() || '0',
      payment_instrument_type: creditTerms?.payment_instrument_type || null,
      notes: creditTerms?.notes || '',
    },
  });

  // Update form when credit terms change
  useEffect(() => {
    if (creditTerms) {
      form.reset({
        credit_limit: creditTerms.credit_limit?.toString() || '',
        pagare_amount: creditTerms.pagare_amount?.toString() || '',
        pagare_expiry_date: creditTerms.pagare_expiry_date || '',
        payment_frequency_days: creditTerms.payment_frequency_days?.toString() || '',
        grace_period_days: creditTerms.grace_period_days?.toString() || '0',
        payment_instrument_type: creditTerms.payment_instrument_type || null,
        notes: creditTerms.notes || '',
      });
    }
  }, [creditTerms, form]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setShowDeleteDialog(false);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/credit-terms/${clientId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar términos de crédito');
      }

      toast.success('Términos de crédito terminados exitosamente');
      onDelete?.();
      // Reload page to refresh data
      window.location.reload();
    } catch (error: any) {
      console.error('Error deleting credit terms:', error);
      toast.error(error.message || 'Error al eliminar términos de crédito');
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = (data: CreditTermsFormData) => {
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmDialog(false);
    setIsSaving(true);

    try {
      const data = form.getValues();

      const response = await fetch(`/api/credit-terms/${clientId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credit_limit: data.credit_limit ? parseFloat(data.credit_limit) : null,
          pagare_amount: data.pagare_amount ? parseFloat(data.pagare_amount) : null,
          pagare_expiry_date: data.pagare_expiry_date || null,
          payment_frequency_days: data.payment_frequency_days
            ? parseInt(data.payment_frequency_days)
            : null,
          grace_period_days: data.grace_period_days ? parseInt(data.grace_period_days) : 0,
          payment_instrument_type: data.payment_instrument_type || null,
          notes: data.notes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar términos de crédito');
      }

      const result = await response.json();

      toast.success('Términos de crédito guardados exitosamente');
      setIsEditing(false);

      if (onSave && result.data) {
        onSave(result.data);
      }

      // Reload page to reflect changes
      window.location.reload();
    } catch (error: any) {
      console.error('Error saving credit terms:', error);
      toast.error(error.message || 'Error al guardar términos de crédito');
    } finally {
      setIsSaving(false);
    }
  };

  // Check if pagaré is expiring soon (< 30 days)
  const isPagareExpiringSoon = () => {
    if (!creditTerms?.pagare_expiry_date) return false;

    const expiryDate = new Date(creditTerms.pagare_expiry_date);
    const today = new Date();
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  };

  const isPagareExpired = () => {
    if (!creditTerms?.pagare_expiry_date) return false;

    const expiryDate = new Date(creditTerms.pagare_expiry_date);
    const today = new Date();

    return expiryDate < today;
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header with Edit Controls */}
        <div className="flex items-center justify-between pb-4 border-b">
          {!isEditing ? (
            <>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Configuración de Crédito
                </p>
                {creditTerms && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Vigente desde {formatDate(creditTerms.effective_date)}
                  </p>
                )}
              </div>
              {isEditable && creditTerms && (
                <div className="flex gap-2">
                  <Button onClick={handleEdit} variant="ghost" size="sm" className="gap-2">
                    <Edit3 className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                    Terminar
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">
                Editando términos de crédito
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleCancel}
                  variant="ghost"
                  size="sm"
                  disabled={isSaving}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  onClick={form.handleSubmit(onSubmit)}
                  size="sm"
                  disabled={isSaving}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div>
          {!isEditing ? (
            // Display Mode - Apple HIG visual hierarchy
            <div className="space-y-6">
              {!creditTerms ? (
                <div className="text-center py-8">
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                      <CreditCard className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-foreground">
                        Sin Términos de Crédito
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Este cliente aún no tiene configurados sus términos de crédito.
                      </p>
                    </div>
                    {isEditable ? (
                      <Button onClick={handleEdit} size="default" className="gap-2 mt-4">
                        <Edit3 className="h-4 w-4" />
                        Configurar Términos
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Solo los ejecutivos y validadores de crédito pueden configurar estos términos
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Primary Information - Larger, more prominent */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Credit Limit */}
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                        Límite de Crédito
                      </label>
                      <p className="text-3xl font-bold text-foreground">
                        {creditTerms.credit_limit
                          ? formatCurrency(creditTerms.credit_limit)
                          : '—'}
                      </p>
                    </div>

                    {/* Payment Instrument Type */}
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                        Instrumento de Cobro
                      </label>
                      <p className="text-3xl font-bold text-foreground">
                        {creditTerms.payment_instrument_type
                          ? PAYMENT_INSTRUMENT_LABELS[creditTerms.payment_instrument_type] || creditTerms.payment_instrument_type
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Pagaré Amount - Show if instrument type requires it */}
                  {(creditTerms.payment_instrument_type === 'pagare_2_a_1' || creditTerms.payment_instrument_type === 'cheque_post_fechado') && creditTerms.pagare_amount && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                          Monto del {creditTerms.payment_instrument_type === 'pagare_2_a_1' ? 'Pagaré' : 'Cheque Post Fechado'}
                        </label>
                        <p className="text-2xl font-bold text-foreground">
                          {formatCurrency(creditTerms.pagare_amount)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="border-t" />

                  {/* Secondary Information - Clean grouped layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Payment Frequency */}
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                        Frecuencia de Pago
                      </label>
                      <p className="text-lg font-semibold text-foreground">
                        {creditTerms.payment_frequency_days
                          ? `Cada ${creditTerms.payment_frequency_days} días`
                          : '—'}
                      </p>
                    </div>

                    {/* Grace Period */}
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                        Período de Gracia
                      </label>
                      <p className="text-lg font-semibold text-foreground">
                        {creditTerms.grace_period_days !== null
                          ? `${creditTerms.grace_period_days} días`
                          : '—'}
                      </p>
                    </div>

                    {/* Pagaré Expiry */}
                    {creditTerms.pagare_expiry_date && (
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs uppercase tracking-wide font-medium text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          Vencimiento del Pagaré
                        </label>
                        <div className="flex items-center gap-3">
                          <p
                            className={`text-lg font-semibold ${
                              isPagareExpired()
                                ? 'text-red-600'
                                : isPagareExpiringSoon()
                                ? 'text-orange-600'
                                : 'text-foreground'
                            }`}
                          >
                            {formatDate(creditTerms.pagare_expiry_date)}
                          </p>
                          {isPagareExpired() && (
                            <span className="text-xs font-medium bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-200">
                              Vencido
                            </span>
                          )}
                          {isPagareExpiringSoon() && !isPagareExpired() && (
                            <span className="text-xs font-medium bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full border border-orange-200">
                              Vence pronto
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes - Full width at bottom */}
                  {creditTerms.notes && (
                    <>
                      <div className="border-t" />
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wide font-medium text-muted-foreground flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5" />
                          Notas Adicionales
                        </label>
                        <p className="text-sm text-foreground leading-relaxed bg-gray-50 p-4 rounded-lg border">
                          {creditTerms.notes}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Edit Mode - Clean, organized form
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Primary amounts - More prominent */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="credit_limit"
                      render={({ field }) => {
                        const displayValue = field.value ? formatNumberWithCommas(field.value) : '';
                        return (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Límite de Crédito</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="200,000"
                                className="text-lg h-12"
                                value={displayValue}
                                onChange={(e) => {
                                  const rawValue = e.target.value;
                                  // Allow only digits, commas, and one decimal point
                                  if (rawValue === '' || /^[\d,]*\.?\d*$/.test(rawValue.replace(/,/g, ''))) {
                                    const cleanValue = rawValue.replace(/,/g, '');
                                    field.onChange(cleanValue === '' ? '' : cleanValue);
                                  }
                                }}
                                onBlur={() => {
                                  const parsed = parseFormattedNumber(field.value || '');
                                  field.onChange(parsed?.toString() || '');
                                  field.onBlur();
                                }}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Monto máximo de crédito permitido
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={form.control}
                      name="payment_instrument_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Instrumento de Cobro</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger className="text-lg h-12">
                                <SelectValue placeholder="Selecciona un instrumento" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pagare_2_a_1">Pagaré 2 a 1</SelectItem>
                              <SelectItem value="garantia_prendaria">Garantía Prendaria</SelectItem>
                              <SelectItem value="contrato">Contrato</SelectItem>
                              <SelectItem value="cheque_post_fechado">Cheque Post Fechado</SelectItem>
                              <SelectItem value="visto_bueno_direccion">Visto Bueno por Dirección</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            Tipo de instrumento de cobro
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Conditional Pagaré Amount and Expiry */}
                  {(form.watch('payment_instrument_type') === 'pagare_2_a_1' || 
                    form.watch('payment_instrument_type') === 'cheque_post_fechado') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="pagare_amount"
                        render={({ field }) => {
                          const displayValue = field.value ? formatNumberWithCommas(field.value) : '';
                          return (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold">
                                Monto {form.watch('payment_instrument_type') === 'pagare_2_a_1' ? 'del Pagaré' : 'del Cheque Post Fechado'} (opcional)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="200,000"
                                  className="h-12"
                                  value={displayValue}
                                  onChange={(e) => {
                                    const rawValue = e.target.value;
                                    // Allow only digits, commas, and one decimal point
                                    if (rawValue === '' || /^[\d,]*\.?\d*$/.test(rawValue.replace(/,/g, ''))) {
                                      const cleanValue = rawValue.replace(/,/g, '');
                                      field.onChange(cleanValue === '' ? '' : cleanValue);
                                    }
                                  }}
                                  onBlur={() => {
                                    const parsed = parseFormattedNumber(field.value || '');
                                    field.onChange(parsed?.toString() || '');
                                    field.onBlur();
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name="pagare_expiry_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">
                              Fecha de Vencimiento {form.watch('payment_instrument_type') === 'pagare_2_a_1' ? '(Pagaré)' : '(Cheque Post Fechado)'} (opcional)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                className="h-12"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t" />

                {/* Payment terms */}
                <div className="space-y-6">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Condiciones de Pago
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="payment_frequency_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frecuencia de Pago (días)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              placeholder="ej. 15, 30, 60"
                              className="h-11"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Número de días entre pagos esperados
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="grace_period_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Período de Gracia (días)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              placeholder="0"
                              className="h-11"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Días adicionales antes de considerar vencido
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pagare_expiry_date"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Fecha de Vencimiento del Pagaré</FormLabel>
                          <FormControl>
                            <Input type="date" className="h-11 max-w-xs" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t" />

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Notas Adicionales</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Condiciones especiales, acuerdos, etc."
                          className="min-h-[120px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Información adicional sobre las condiciones de crédito
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}
        </div>
      </div>

      {/* Save Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Cambios</DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea guardar los términos de crédito? Esto creará un
              nuevo registro en el historial de cambios.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmSave} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminar Condiciones de Crédito</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea terminar las condiciones de crédito para{' '}
              <strong>{clientName}</strong>?
              <br />
              <br />
              Esta acción desactivará las condiciones de crédito actuales. El historial
              se mantendrá para referencia, pero el cliente ya no tendrá condiciones de
              crédito activas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Terminando...' : 'Terminar Condiciones'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
