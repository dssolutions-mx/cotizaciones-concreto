'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard, X, Upload, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';

interface QuickSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onSuccess?: () => void;
}

type PaymentInstrumentType = 'pagare_2_a_1' | 'garantia_prendaria' | 'contrato' | 'cheque_post_fechado' | 'visto_bueno_direccion' | '';

const PAYMENT_INSTRUMENT_OPTIONS = [
  { value: 'pagare_2_a_1', label: 'Pagaré 2 a 1' },
  { value: 'garantia_prendaria', label: 'Garantía Prendaria' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'cheque_post_fechado', label: 'Cheque Post Fechado' },
  { value: 'visto_bueno_direccion', label: 'Visto Bueno por Dirección' },
] as const;

export default function QuickSetupModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSuccess,
}: QuickSetupModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentInstrumentType, setPaymentInstrumentType] = useState<PaymentInstrumentType>('');
  const [pagareAmount, setPagareAmount] = useState('');
  const [pagareExpiry, setPagareExpiry] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState('30');
  const [gracePeriod, setGracePeriod] = useState('5');
  const [notes, setNotes] = useState('');
  const [documents, setDocuments] = useState<Array<{
    file: File;
    documentType: 'pagare' | 'contract' | 'credit_application' | 'other';
    documentAmount?: string;
    expiryDate?: string;
    notes?: string;
  }>>([]);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);

  const resetForm = () => {
    setCreditLimit('');
    setPaymentInstrumentType('');
    setPagareAmount('');
    setPagareExpiry('');
    setPaymentFrequency('30');
    setGracePeriod('5');
    setNotes('');
    setDocuments([]);
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`El archivo ${file.name} excede el tamaño máximo de 10MB`);
        return;
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(`El archivo ${file.name} no es un tipo permitido (PDF o imagen)`);
        return;
      }

      // Determine document type based on payment instrument
      let documentType: 'pagare' | 'contract' | 'credit_application' | 'other' = 'other';
      if (paymentInstrumentType === 'pagare_2_a_1') {
        documentType = 'pagare';
      } else if (paymentInstrumentType === 'contrato') {
        documentType = 'contract';
      } else if (paymentInstrumentType === 'garantia_prendaria' || paymentInstrumentType === 'cheque_post_fechado') {
        documentType = 'other';
      }

      setDocuments((prev) => [
        ...prev,
        {
          file,
          documentType,
          documentAmount: paymentInstrumentType === 'pagare_2_a_1' || paymentInstrumentType === 'cheque_post_fechado' ? pagareAmount : undefined,
          expiryDate: paymentInstrumentType === 'pagare_2_a_1' || paymentInstrumentType === 'cheque_post_fechado' ? pagareExpiry : undefined,
        },
      ]);
    });

    // Reset input
    e.target.value = '';
  };

  const handleRemoveDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDocumentTypeChange = (index: number, newType: 'pagare' | 'contract' | 'credit_application' | 'other') => {
    setDocuments((prev) =>
      prev.map((doc, i) =>
        i === index ? { ...doc, documentType: newType } : doc
      )
    );
  };

  const uploadDocuments = async (userId: string): Promise<boolean> => {
    if (documents.length === 0) return true;

    setIsUploadingDocuments(true);
    let allSuccess = true;

    try {
      for (const doc of documents) {
        const formData = new FormData();
        formData.append('file', doc.file);
        formData.append('client_id', clientId);
        formData.append('document_type', doc.documentType);
        if (doc.documentAmount) formData.append('document_amount', doc.documentAmount);
        if (doc.expiryDate) formData.append('expiry_date', doc.expiryDate);
        if (doc.notes) formData.append('notes', doc.notes);

        const response = await fetch('/api/credit-terms/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          console.error(`Error uploading ${doc.file.name}:`, error);
          allSuccess = false;
        }
      }

      if (!allSuccess) {
        toast.warning('Algunos documentos no se pudieron subir. Puedes subirlos después desde la página de crédito.');
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast.warning('Error al subir algunos documentos. Puedes subirlos después desde la página de crédito.');
      allSuccess = false;
    } finally {
      setIsUploadingDocuments(false);
    }

    return allSuccess;
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const parsedCreditLimit = parseFormattedNumber(creditLimit);
    if (!parsedCreditLimit || parsedCreditLimit <= 0) {
      toast.error('Ingresa un límite de crédito válido');
      return;
    }

    if (!paymentInstrumentType) {
      toast.error('Selecciona un instrumento de cobro');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user ID and role for document uploads
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Get user role
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const userRole = profile?.role || '';

      // Save credit terms first
      // Note: Sales agents shouldn't include pagaré info - validators will add it
      const payload: any = {
        credit_limit: parsedCreditLimit,
        payment_frequency_days: parseInt(paymentFrequency) || 30,
        grace_period_days: parseInt(gracePeriod) || 0,
        payment_instrument_type: paymentInstrumentType,
      };

      // Only include pagaré info if user is validator/executive (not sales agent)
      if (!['SALES_AGENT', 'EXTERNAL_SALES_AGENT'].includes(userRole)) {
        if (pagareAmount) {
          const parsedPagareAmount = parseFormattedNumber(pagareAmount);
          if (parsedPagareAmount) payload.pagare_amount = parsedPagareAmount;
        }
        if (pagareExpiry) payload.pagare_expiry_date = pagareExpiry;
      }
      if (notes) payload.notes = notes;

      const response = await fetch(`/api/credit-terms/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar');
      }

      // Upload documents after credit terms are saved
      if (documents.length > 0) {
        await uploadDocuments(user.id);
      }

      // Show appropriate success message based on user role
      if (['SALES_AGENT', 'EXTERNAL_SALES_AGENT'].includes(userRole)) {
        toast.success('Información de crédito enviada para validación. Un validador revisará y completará el proceso agregando el pagaré.');
      } else {
        toast.success('Términos de crédito configurados correctamente');
      }
      
      handleClose();
      onSuccess?.();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al configurar crédito');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Configurar Términos de Crédito
          </DialogTitle>
          <DialogDescription>
            Configura los términos de crédito para {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Credit Limit */}
          <div className="space-y-2">
            <Label htmlFor="credit-limit">
              Límite de Crédito <span className="text-red-500">*</span>
            </Label>
            <Input
              id="credit-limit"
              type="text"
              inputMode="numeric"
              placeholder="200,000"
              value={formatNumberWithCommas(creditLimit)}
              onChange={(e) => {
                const rawValue = e.target.value;
                // Allow only digits, commas, and one decimal point
                if (rawValue === '' || /^[\d,]*\.?\d*$/.test(rawValue.replace(/,/g, ''))) {
                  setCreditLimit(rawValue.replace(/,/g, ''));
                }
              }}
              className="text-lg"
            />
            <p className="text-xs text-gray-500">
              💡 Típicamente 3-5× el tamaño promedio de pedido del cliente
            </p>
          </div>

          {/* Payment Instrument Type */}
          <div className="space-y-2">
            <Label htmlFor="payment-instrument">
              Instrumento de Cobro <span className="text-red-500">*</span>
            </Label>
            <Select
              value={paymentInstrumentType}
              onValueChange={(value) => {
                setPaymentInstrumentType(value as PaymentInstrumentType);
                // Update document types when instrument changes
                setDocuments((prev) =>
                  prev.map((doc) => {
                    let newType: typeof doc.documentType = doc.documentType;
                    if (value === 'pagare_2_a_1') {
                      newType = 'pagare';
                    } else if (value === 'contrato') {
                      newType = 'contract';
                    } else if (value === 'cheque_post_fechado' || value === 'visto_bueno_direccion') {
                      newType = 'other';
                    }
                    return {
                      ...doc,
                      documentType: newType,
                      documentAmount: value === 'pagare_2_a_1' || value === 'cheque_post_fechado' ? pagareAmount : doc.documentAmount,
                      expiryDate: value === 'pagare_2_a_1' || value === 'cheque_post_fechado' ? pagareExpiry : doc.expiryDate,
                    };
                  })
                );
              }}
            >
              <SelectTrigger id="payment-instrument">
                <SelectValue placeholder="Selecciona un instrumento de cobro" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_INSTRUMENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Selecciona el tipo de instrumento de cobro que se utilizará para este crédito
            </p>
          </div>

          {/* Pagaré Amount (conditional) - Only show for validators/executives */}
          {(paymentInstrumentType === 'pagare_2_a_1' || paymentInstrumentType === 'cheque_post_fechado') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pagare-amount">
                  Monto del Instrumento {paymentInstrumentType === 'pagare_2_a_1' ? '(Pagaré)' : '(Cheque Post Fechado)'} (opcional)
                </Label>
                <Input
                  id="pagare-amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="200,000"
                  value={formatNumberWithCommas(pagareAmount)}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    // Allow only digits, commas, and one decimal point
                    if (rawValue === '' || /^[\d,]*\.?\d*$/.test(rawValue.replace(/,/g, ''))) {
                      const cleanValue = rawValue.replace(/,/g, '');
                      setPagareAmount(cleanValue);
                      // Update document amounts when pagaré amount changes
                      setDocuments((prev) =>
                        prev.map((doc) => ({
                          ...doc,
                          documentAmount: cleanValue || undefined,
                        }))
                      );
                    }
                  }}
                />
                <p className="text-xs text-gray-500">
                  {paymentInstrumentType === 'pagare_2_a_1' 
                    ? 'El validador de crédito agregará esta información al aprobar'
                    : 'Información del instrumento de cobro'}
                </p>
              </div>

              {/* Pagaré Expiry Date (conditional) */}
              <div className="space-y-2">
                <Label htmlFor="pagare-expiry">
                  Fecha de Vencimiento {paymentInstrumentType === 'pagare_2_a_1' ? '(Pagaré)' : '(Cheque Post Fechado)'} (opcional)
                </Label>
                <Input
                  id="pagare-expiry"
                  type="date"
                  value={pagareExpiry}
                  onChange={(e) => {
                    setPagareExpiry(e.target.value);
                    // Update document expiry dates when pagaré expiry changes
                    setDocuments((prev) =>
                      prev.map((doc) => ({
                        ...doc,
                        expiryDate: e.target.value || undefined,
                      }))
                    );
                  }}
                />
              </div>
            </>
          )}

          {/* Payment Frequency */}
          <div className="space-y-2">
            <Label htmlFor="payment-frequency">Frecuencia de Pago (días)</Label>
            <Input
              id="payment-frequency"
              type="number"
              placeholder="30"
              value={paymentFrequency}
              onChange={(e) => setPaymentFrequency(e.target.value)}
            />
            <p className="text-xs text-gray-500">¿Cada cuántos días debe pagar el cliente?</p>
          </div>

          {/* Grace Period */}
          <div className="space-y-2">
            <Label htmlFor="grace-period">Período de Gracia (días)</Label>
            <Input
              id="grace-period"
              type="number"
              placeholder="5"
              value={gracePeriod}
              onChange={(e) => setGracePeriod(e.target.value)}
            />
            <p className="text-xs text-gray-500">Días adicionales antes de considerar el pago atrasado</p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Ej: Cliente preferencial, condiciones especiales acordadas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Document Upload Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <Label>Documentos de Respaldo (opcional)</Label>
              <p className="text-xs text-gray-500">
                Sube los documentos que respaldan estos términos de crédito (pagarés, contratos, etc.)
              </p>
              
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={handleFileAdd}
                  className="cursor-pointer"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Document List */}
            {documents.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Documentos a subir ({documents.length}):</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(doc.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Select
                        value={doc.documentType}
                        onValueChange={(value) =>
                          handleDocumentTypeChange(index, value as typeof doc.documentType)
                        }
                        disabled={isSubmitting}
                      >
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pagare">Pagaré</SelectItem>
                          <SelectItem value="contract">Contrato</SelectItem>
                          <SelectItem value="credit_application">Solicitud de Crédito</SelectItem>
                          <SelectItem value="other">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDocument(index)}
                        disabled={isSubmitting}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary Card */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-sm mb-3">Resumen de Configuración:</h4>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-gray-600">Límite de Crédito:</dt>
                <dd className="font-medium">
                  {creditLimit ? `$${parseFormattedNumber(creditLimit)?.toLocaleString('es-MX') || '0'}` : 'No especificado'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">Instrumento de Cobro:</dt>
                <dd className="font-medium">
                  {paymentInstrumentType
                    ? PAYMENT_INSTRUMENT_OPTIONS.find((opt) => opt.value === paymentInstrumentType)?.label
                    : 'No seleccionado'}
                </dd>
              </div>
              {(pagareAmount || pagareExpiry) && (
                <>
                  {pagareAmount && (
                    <div>
                      <dt className="text-gray-600">Monto:</dt>
                      <dd className="font-medium">${parseFormattedNumber(pagareAmount)?.toLocaleString('es-MX') || '0'}</dd>
                    </div>
                  )}
                  {pagareExpiry && (
                    <div>
                      <dt className="text-gray-600">Fecha Vencimiento:</dt>
                      <dd className="font-medium">
                        {new Date(pagareExpiry).toLocaleDateString('es-MX')}
                      </dd>
                    </div>
                  )}
                </>
              )}
              <div>
                <dt className="text-gray-600">Frecuencia de Pago:</dt>
                <dd className="font-medium">Cada {paymentFrequency} días</dd>
              </div>
              <div>
                <dt className="text-gray-600">Período de Gracia:</dt>
                <dd className="font-medium">{gracePeriod} días</dd>
              </div>
            </dl>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={
              isSubmitting || 
              isUploadingDocuments || 
              !creditLimit || 
              !parseFormattedNumber(creditLimit) || 
              !paymentInstrumentType
            }
          >
            {isSubmitting || isUploadingDocuments
              ? isUploadingDocuments
                ? 'Subiendo documentos...'
                : 'Guardando...'
              : 'Guardar y Activar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
