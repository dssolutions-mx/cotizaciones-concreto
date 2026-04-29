'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ConstructionSite } from '@/types/client';
import { formatCurrency } from '@/lib/utils'; // Import formatter
import { clientService } from '@/lib/supabase/clients';
import { User, Phone } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For confirmation view
import { Badge } from "@/components/ui/badge"; // For confirmation view
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  paymentNeedsExplicitConstructionSite,
  countNamedConstructionSites,
  computeFifoAllocation,
  type SiteDebtFifo,
} from '@/lib/finanzas/paymentConstructionSite';
import { fetchFifoSiteDebts } from '@/lib/finanzas/fifoSiteDebts';
import { supabase } from '@/lib/supabase/client';

const isCashPayment = (method: string) => method === 'CASH' || method === 'Efectivo';

// Define the component props interface
export interface PaymentFormProps {
  clientId: string;
  sites: ConstructionSite[];
  onSuccess: () => void; // Renamed from onPaymentAdded for clarity
  onCancel: () => void; // Added a cancel handler for better control (e.g., closing modal)
  // Added props
  defaultConstructionSite?: string | null; // Can be null or undefined
  currentBalance?: number;
  /** Optional - when provided, displayed in the modal; otherwise fetched from API */
  clientName?: string;
  /** Optional - critical for cash verification call (Política 3.4) */
  clientPhone?: string;
}

// Renamed component to PaymentForm for consistency
export default function PaymentForm({ 
  clientId, 
  sites, 
  onSuccess,
  onCancel,
  defaultConstructionSite,
  currentBalance,
  clientName: clientNameProp,
  clientPhone: clientPhoneProp,
}: PaymentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false); // State for confirmation step
  const [verificationCallConfirmed, setVerificationCallConfirmed] = useState(false);
  const [paymentFifoDebts, setPaymentFifoDebts] = useState<SiteDebtFifo[]>([]);
  const [clientInfo, setClientInfo] = useState<{ business_name?: string; phone?: string } | null>(
    clientNameProp || clientPhoneProp ? { business_name: clientNameProp, phone: clientPhoneProp } : null
  );

  // Fetch client info when not provided (for Quick Add flow, etc.)
  useEffect(() => {
    if (clientNameProp || clientPhoneProp) {
      setClientInfo({ business_name: clientNameProp, phone: clientPhoneProp });
      return;
    }
    let cancelled = false;
    clientService.getClientById(clientId).then((client) => {
      if (!cancelled && client) {
        setClientInfo({ business_name: client.business_name, phone: client.phone ?? undefined });
      }
    }).catch(() => {
      if (!cancelled) setClientInfo(null);
    });
    return () => { cancelled = true; };
  }, [clientId, clientNameProp, clientPhoneProp]);
  const toLocalISODate = (d: Date) => {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60_000);
    return local.toISOString().slice(0, 10);
  };
  const namedSites = useMemo(
    () => sites.filter((s) => s?.name?.trim()),
    [sites]
  );
  const needsExplicitSite = paymentNeedsExplicitConstructionSite(sites);
  const nSites = countNamedConstructionSites(sites);

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'TRANSFER',
    reference_number: '',
    notes: '',
    payment_date: toLocalISODate(new Date()),
    construction_site: defaultConstructionSite || 'general',
  });

  useEffect(() => {
    let cancelled = false;
    fetchFifoSiteDebts(supabase, clientId)
      .then((rows) => {
        if (!cancelled) setPaymentFifoDebts(rows);
      })
      .catch(() => {
        if (!cancelled) setPaymentFifoDebts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const fifoPreview = useMemo(() => {
    if (!needsExplicitSite || nSites <= 1) return null;
    if ((paymentData.construction_site?.trim() ?? '') !== 'general') return null;
    const amt = parseFloat(paymentData.amount || '');
    if (!(amt > 0)) return null;
    if (paymentFifoDebts.length === 0) {
      return { distributions: [] as { construction_site: string; amount: number }[], surplusToGeneral: amt };
    }
    return computeFifoAllocation(paymentFifoDebts, amt);
  }, [
    needsExplicitSite,
    nSites,
    paymentData.construction_site,
    paymentData.amount,
    paymentFifoDebts,
  ]);

  // Align obra selection with API rules: single → that obra; none / multi → default general (FIFO for multi)
  useEffect(() => {
    const named = sites.filter((s) => s?.name?.trim());
    setPaymentData((prev) => {
      if (named.length === 1) {
        return { ...prev, construction_site: named[0].name };
      }
      if (named.length === 0) {
        return { ...prev, construction_site: 'general' };
      }
      if (defaultConstructionSite && named.some((s) => s.name === defaultConstructionSite)) {
        return { ...prev, construction_site: defaultConstructionSite };
      }
      return { ...prev, construction_site: 'general' };
    });
  }, [sites, defaultConstructionSite]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSetFullBalance = () => {
    if (currentBalance && currentBalance > 0) {
      setPaymentData(prev => ({
        ...prev,
        amount: currentBalance.toFixed(2) // Set amount as string
      }));
    }
  };

  // Refactored submit logic for confirmation
  const handleAttemptSubmit = async () => {
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      toast.error('El monto del pago debe ser mayor a cero');
      return;
    }
    if (!paymentData.payment_date) {
      toast.error('La fecha del pago es obligatoria');
      return;
    }
    // Reset verification when entering confirmation (e.g. user changed to cash)
    setVerificationCallConfirmed(false);
    setIsConfirming(true);
  };
  
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setIsConfirming(false); // Move back from confirmation view immediately
    try {
      const amount = parseFloat(paymentData.amount);
      const sel = paymentData.construction_site?.trim() ?? '';
      const cs = !sel || sel === 'general' ? 'general' : sel;

      const body: Record<string, unknown> = {
        client_id: clientId,
        amount,
        payment_method: paymentData.payment_method,
        reference_number: paymentData.reference_number || null,
        notes: paymentData.notes || null,
        construction_site: cs === 'general' ? 'general' : cs,
        payment_date: paymentData.payment_date,
      };
      if (isCashPayment(paymentData.payment_method)) {
        body.verification_call_confirmed = true;
      }
      const res = await fetch('/api/finanzas/client-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Error al registrar el pago');
      }

      onSuccess(); // Call success callback (closes modal, refetches)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al registrar el pago';
      console.error("Payment Error:", error);
      toast.error(errorMessage);
      // Keep modal open on error to allow correction?
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = () => {
    setVerificationCallConfirmed(false);
    setIsConfirming(false); // Go back to editing form
  };

  // Compact client info card - helps UX and provides phone for cash verification call
  const ClientInfoCard = () => {
    if (!clientInfo?.business_name && !clientInfo?.phone) return null;
    return (
      <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
        {clientInfo.business_name && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium">{clientInfo.business_name}</span>
          </div>
        )}
        {clientInfo.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <a href={`tel:${clientInfo.phone}`} className="text-primary hover:underline">
              {clientInfo.phone}
            </a>
            {isCashPayment(paymentData.payment_method) && (
              <span className="text-xs text-amber-600">(número para llamada de verificación)</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render confirmation view if isConfirming is true
  if (isConfirming) {
    const selectedSiteName =
      paymentData.construction_site === 'general' || !paymentData.construction_site?.trim()
        ? nSites === 0
          ? 'Pago general (sin obras registradas)'
          : nSites === 1
            ? `Obra única: ${namedSites[0]?.name ?? ''}`
            : 'Pago general (FIFO por obra)'
        : paymentData.construction_site || '—';
    return (
      <div className="space-y-6 py-4">
        <ClientInfoCard />
        <Alert>
          <AlertTitle className="text-lg">Confirmar Pago</AlertTitle>
          <AlertDescription>
            Por favor, revise los detalles del pago antes de confirmar.
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm p-4 border rounded-md">
          <div>
             <Label className="text-gray-500">Monto</Label>
             <p className="font-semibold text-lg">{formatCurrency(parseFloat(paymentData.amount))}</p>
          </div>
          <div>
             <Label className="text-gray-500">Fecha</Label>
             <p className="font-medium">{paymentData.payment_date}</p>
          </div>
           <div>
             <Label className="text-gray-500">Método</Label>
             <p className="font-medium">{paymentData.payment_method}</p>
          </div>
          <div>
             <Label className="text-gray-500">Referencia</Label>
             <p className="font-medium">{paymentData.reference_number || '-'}</p>
          </div>
          <div>
             <Label className="text-gray-500">Aplicar a</Label>
             <p className="font-medium">{selectedSiteName}</p>
          </div>
           {paymentData.notes && (
             <div className="col-span-2">
               <Label className="text-gray-500">Notas</Label>
               <p className="font-medium whitespace-pre-wrap">{paymentData.notes}</p>
             </div>
           )}
        </div>

        {isCashPayment(paymentData.payment_method) && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-800">Política de Cobranza en Efectivo (obligatorio)</p>
            <p className="text-sm text-amber-800">
              He realizado la llamada de verificación al número validado del cliente y he confirmado: monto, concepto, agente y producto.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={verificationCallConfirmed}
                onCheckedChange={(checked) => setVerificationCallConfirmed(checked === true)}
                disabled={isSubmitting}
              />
              <span className="text-sm font-medium text-amber-900">
                Confirmo cumplimiento del procedimiento de verificación (Política 3.4)
              </span>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={handleEdit} disabled={isSubmitting}>
            Editar
          </Button>
          <Button
            onClick={handleConfirmSubmit}
            disabled={
              isSubmitting ||
              (isCashPayment(paymentData.payment_method) && !verificationCallConfirmed)
            }
          >
            {isSubmitting ? 'Procesando...' : 'Confirmar Pago'}
          </Button>
        </div>
      </div>
    );
  }

  // Original form rendering
  return (
    // Wrap in form tag for semantics, link submit button via form attribute
    <form id="payment-form" onSubmit={(e) => { e.preventDefault(); handleAttemptSubmit(); }}> 
      <ClientInfoCard />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4"> 
        <div className="space-y-2"> {/* Use space-y for consistency */}
          <Label htmlFor="amount">Monto del Pago *</Label>
           <div className="relative"> {/* Container for input and button */}
             <Input
               id="amount"
               name="amount"
               type="number"
               value={paymentData.amount}
               onChange={handleChange}
               min="0.01" // Ensure positive amount
               step="0.01"
               required
               disabled={isSubmitting}
               placeholder="0.00"
               className="pr-10" // Add padding for potential icon/button inside
             />
             {/* Consider adding $ sign absolutely positioned inside */} 
           </div>
           {currentBalance && currentBalance > 0 && (
             <Button 
                type="button" // Prevent form submission
                variant="ghost"
                size="sm"
                className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800"
                onClick={handleSetFullBalance}
             >
               Pagar Saldo Total: {formatCurrency(currentBalance)}
             </Button>
           )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_date">Fecha del Pago *</Label>
          <Input
            id="payment_date"
            name="payment_date"
            type="date"
            value={paymentData.payment_date}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="payment_method">Método de Pago</Label>
          <Select
            name="payment_method"
            value={paymentData.payment_method}
            onValueChange={(value) => handleChange({ target: { name: 'payment_method', value } } as any)} // Type assertion needed for Select
            disabled={isSubmitting}
          >
            <SelectTrigger id="payment_method">
              <SelectValue placeholder="Seleccione método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Efectivo</SelectItem>
              <SelectItem value="TRANSFER">Transferencia</SelectItem>
              <SelectItem value="CHECK">Cheque</SelectItem>
              <SelectItem value="CREDIT_CARD">Tarjeta de Crédito</SelectItem>
              <SelectItem value="OTHER">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="reference_number">Referencia</Label>
          <Input
            id="reference_number"
            name="reference_number"
            type="text"
            value={paymentData.reference_number}
            onChange={handleChange}
            placeholder="Número de transferencia, cheque, etc."
            disabled={isSubmitting}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="construction_site">Obra</Label>
          <Select
            name="construction_site"
            value={
              needsExplicitSite
                ? paymentData.construction_site?.trim()
                  ? paymentData.construction_site
                  : 'general'
                : paymentData.construction_site
            }
            onValueChange={(value) =>
              handleChange({ target: { name: 'construction_site', value } } as React.ChangeEvent<HTMLSelectElement>)
            }
            disabled={isSubmitting}
          >
            <SelectTrigger id="construction_site">
              <SelectValue
                placeholder={
                  needsExplicitSite ? 'Pago general (FIFO) u obra específica' : 'Pago general u obra específica'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {needsExplicitSite ? (
                <>
                  <SelectItem value="general">— Pago general (FIFO automático) —</SelectItem>
                  {namedSites.map((site) => (
                    <SelectItem key={site.id} value={site.name}>
                      {site.name}
                    </SelectItem>
                  ))}
                </>
              ) : namedSites.length === 1 ? (
                namedSites.map((site) => (
                  <SelectItem key={site.id} value={site.name}>
                    {site.name}
                  </SelectItem>
                ))
              ) : (
                <>
                  <SelectItem value="general">— Pago general —</SelectItem>
                  {namedSites.map((site) => (
                    <SelectItem key={site.id} value={site.name}>
                      {site.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          {needsExplicitSite && (
            <p className="text-xs text-muted-foreground">
              Varias obras: elija pago general para FIFO (obra más antigua primero) o una obra para aplicar todo el monto.
            </p>
          )}
        </div>

        {fifoPreview && (
          <div className="md:col-span-2 rounded-md border border-dashed border-primary/35 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">
              Distribución FIFO prevista (obra con pedido más antiguo primero)
            </p>
            {fifoPreview.distributions.length > 0 ? (
              <ul className="space-y-1.5 text-xs">
                {fifoPreview.distributions.map((d, i) => (
                  <li key={`${d.construction_site}-${i}`} className="flex justify-between gap-2">
                    <span className="text-muted-foreground truncate">{d.construction_site}</span>
                    <span className="font-medium tabular-nums shrink-0">{formatCurrency(d.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {fifoPreview.surplusToGeneral > 0 ? (
              <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                Saldo a favor (crédito general):{' '}
                <span className="font-semibold text-green-700 tabular-nums">
                  {formatCurrency(fifoPreview.surplusToGeneral)}
                </span>
              </p>
            ) : null}
          </div>
        )}
        
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            name="notes"
            value={paymentData.notes}
            onChange={handleChange}
            rows={3} 
            disabled={isSubmitting}
            placeholder="Añadir notas adicionales aquí..."
          />
        </div>
      </div>
      
      {/* Submit/Cancel Buttons should be in the DialogFooter of the parent component */}
      <div className="flex justify-end gap-3 pt-4 border-t">
         <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
           Cancelar
         </Button>
         {/* This button now triggers the confirmation step, not the final submit */}
         <Button type="submit" disabled={isSubmitting}> 
           Revisar Pago
         </Button>
      </div>
    </form> 
  );
}

// Helper function (if needed, or keep logic inline)
// function getSiteIdFromName(sites: ConstructionSite[], name: string): string | null {
//   const site = sites.find(s => s.name === name);
//   return site ? site.id : null;
// }

// Note: We will need to adjust the parent components to pass `onSuccess` and `onCancel`,
// and handle the submit button placement (likely in DialogFooter/SheetFooter).
// The ClientPaymentForm component itself no longer renders the "Registrar Pago" button directly.
