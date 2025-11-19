'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { ClientCreditTerms } from '@/lib/supabase/creditTerms';
import { formatCurrency, formatDate, formatNumberWithCommas, parseFormattedNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { Clock, CheckCircle, FileText, DollarSign, Calendar, User, Building2 } from 'lucide-react';
import Link from 'next/link';

interface PendingCreditTerm extends ClientCreditTerms {
  client?: {
    id: string;
    business_name: string;
    client_code: string;
  } | null;
}

const PAYMENT_INSTRUMENT_LABELS: Record<string, string> = {
  pagare_2_a_1: 'Pagaré 2 a 1',
  garantia_prendaria: 'Garantía Prendaria',
  contrato: 'Contrato',
  cheque_post_fechado: 'Cheque Post Fechado',
  visto_bueno_direccion: 'Visto Bueno por Dirección',
};

export default function PendingCreditApprovalList() {
  const [pendingTerms, setPendingTerms] = useState<PendingCreditTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState<PendingCreditTerm | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [pagareAmount, setPagareAmount] = useState('');
  const [pagareExpiry, setPagareExpiry] = useState('');

  useEffect(() => {
    fetchPendingTerms();
  }, []);

  const fetchPendingTerms = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/credit-terms/pending');

      if (!response.ok) {
        throw new Error('Error al cargar términos pendientes');
      }

      const result = await response.json();
      setPendingTerms(result.data || []);
    } catch (error) {
      console.error('Error fetching pending terms:', error);
      toast.error('Error al cargar términos pendientes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveClick = (term: PendingCreditTerm) => {
    setSelectedTerm(term);
    setPagareAmount('');
    setPagareExpiry('');
    setShowApproveDialog(true);
  };

  const handleApprove = async () => {
    if (!selectedTerm) return;

    const parsedAmount = pagareAmount ? parseFormattedNumber(pagareAmount) : null;
    
    setIsApproving(true);

    try {
      const response = await fetch(`/api/credit-terms/approve/${selectedTerm.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagare_amount: parsedAmount,
          pagare_expiry_date: pagareExpiry || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al aprobar términos de crédito');
      }

      toast.success('Términos de crédito aprobados y activados exitosamente');
      setShowApproveDialog(false);
      setSelectedTerm(null);
      fetchPendingTerms();
    } catch (error: any) {
      console.error('Error approving credit terms:', error);
      toast.error(error.message || 'Error al aprobar términos de crédito');
    } finally {
      setIsApproving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Cargando...</div>
        </CardContent>
      </Card>
    );
  }

  if (pendingTerms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Términos Pendientes de Validación
          </CardTitle>
          <CardDescription>
            No hay términos de crédito pendientes de validación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <p className="font-semibold text-blue-900 mb-2">¿Qué aparece aquí?</p>
            <p className="text-blue-800">
              Esta sección muestra términos de crédito con estado <strong>"Pendiente de Validación"</strong>.
              Estos son términos creados por agentes de ventas que requieren tu aprobación y la adición del pagaré
              para ser activados.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                Términos Pendientes de Validación
              </CardTitle>
              <CardDescription className="mt-1">
                {pendingTerms.length} término{pendingTerms.length !== 1 ? 's' : ''} pendiente{pendingTerms.length !== 1 ? 's' : ''} de validación
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              <Clock className="h-3 w-3 mr-1" />
              Estado: Pendiente de Validación
            </Badge>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <p className="font-semibold text-blue-900 mb-1">¿Qué aparece aquí?</p>
            <p className="text-blue-800">
              Esta sección muestra términos de crédito con estado <strong>"Pendiente de Validación"</strong>.
              Estos son términos creados por agentes de ventas que requieren tu aprobación y la adición del pagaré
              para ser activados. Al aprobar, el estado cambiará a <strong>"Activo"</strong>.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingTerms.map((term) => (
              <div
                key={term.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    {/* Client Info */}
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <div>
                        <Link
                          href={`/clients/${term.client_id}/credito`}
                          className="font-semibold text-lg hover:underline"
                        >
                          {term.client?.business_name || 'Cliente desconocido'}
                        </Link>
                        {term.client?.client_code && (
                          <p className="text-sm text-muted-foreground">
                            Código: {term.client.client_code}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Credit Terms Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Límite de Crédito</p>
                        <p className="font-semibold">
                          {term.credit_limit ? formatCurrency(term.credit_limit) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Instrumento de Cobro</p>
                        <p className="font-semibold">
                          {term.payment_instrument_type
                            ? PAYMENT_INSTRUMENT_LABELS[term.payment_instrument_type] || term.payment_instrument_type
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Frecuencia de Pago</p>
                        <p className="font-semibold">
                          {term.payment_frequency_days
                            ? `Cada ${term.payment_frequency_days} días`
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Creado</p>
                        <p className="font-semibold">{formatDate(term.created_at)}</p>
                      </div>
                    </div>

                    {/* Notes */}
                    {term.notes && (
                      <div className="text-sm">
                        <p className="text-muted-foreground text-xs mb-1">Notas:</p>
                        <p className="bg-muted p-2 rounded">{term.notes}</p>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Estado: Pendiente de Validación
                      </Badge>
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        Creado: {formatDate(term.created_at)}
                      </Badge>
                      <Link
                        href={`/clients/${term.client_id}/credito`}
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        Ver documentos
                      </Link>
                    </div>
                  </div>

                  {/* Approve Button */}
                  <Button
                    onClick={() => handleApproveClick(term)}
                    className="ml-4"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aprobar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aprobar Términos de Crédito</DialogTitle>
            <DialogDescription>
              Agrega la información del pagaré para completar y activar los términos de crédito
              {selectedTerm?.client && ` para ${selectedTerm.client.business_name}`}
            </DialogDescription>
          </DialogHeader>

          {selectedTerm && (
            <div className="space-y-6 py-4">
              {/* Summary of Credit Terms */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-semibold text-sm mb-3">Resumen de Términos:</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Límite de Crédito:</p>
                    <p className="font-semibold">
                      {selectedTerm.credit_limit ? formatCurrency(selectedTerm.credit_limit) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Instrumento de Cobro:</p>
                    <p className="font-semibold">
                      {selectedTerm.payment_instrument_type
                        ? PAYMENT_INSTRUMENT_LABELS[selectedTerm.payment_instrument_type]
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Frecuencia de Pago:</p>
                    <p className="font-semibold">
                      {selectedTerm.payment_frequency_days
                        ? `Cada ${selectedTerm.payment_frequency_days} días`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Período de Gracia:</p>
                    <p className="font-semibold">
                      {selectedTerm.grace_period_days || 0} días
                    </p>
                  </div>
                </div>
              </div>

              {/* Pagaré Information */}
              {(selectedTerm.payment_instrument_type === 'pagare_2_a_1' ||
                selectedTerm.payment_instrument_type === 'cheque_post_fechado') && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Información del Pagaré
                  </h4>

                  <div className="space-y-2">
                    <Label htmlFor="approve-pagare-amount">
                      Monto del Pagaré (opcional)
                    </Label>
                    <Input
                      id="approve-pagare-amount"
                      type="text"
                      inputMode="numeric"
                      placeholder="200,000"
                      value={formatNumberWithCommas(pagareAmount)}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        if (rawValue === '' || /^[\d,]*\.?\d*$/.test(rawValue.replace(/,/g, ''))) {
                          setPagareAmount(rawValue.replace(/,/g, ''));
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="approve-pagare-expiry">
                      Fecha de Vencimiento del Pagaré (opcional)
                    </Label>
                    <Input
                      id="approve-pagare-expiry"
                      type="date"
                      value={pagareExpiry}
                      onChange={(e) => setPagareExpiry(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Note about activation */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-blue-900">
                    <strong>Estado Actual:</strong>
                  </p>
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    Pendiente de Validación
                  </Badge>
                </div>
                <p className="text-sm text-blue-900">
                  <strong>Acción:</strong> Al aprobar, estos términos cambiarán a estado <strong>"Activo"</strong> y
                  reemplazarán cualquier término de crédito activo existente para este cliente.
                </p>
                <p className="text-sm text-blue-800 italic">
                  Los términos con estado "Pendiente de Validación" fueron creados por agentes de ventas y requieren
                  tu revisión y la adición del pagaré para completar el proceso.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={isApproving}
            >
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={isApproving}>
              {isApproving ? 'Aprobando...' : 'Aprobar y Activar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

