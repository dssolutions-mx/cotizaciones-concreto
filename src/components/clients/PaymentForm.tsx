'use client';

import React, { useState, useEffect } from 'react';
import { clientService } from '@/lib/supabase/clients'; // Assuming clientService is correctly typed and available
import { ConstructionSite } from '@/types/client';
import { formatCurrency } from '@/lib/utils'; // Import formatter
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

// Define the component props interface
export interface PaymentFormProps {
  clientId: string;
  sites: ConstructionSite[];
  onSuccess: () => void; // Renamed from onPaymentAdded for clarity
  onCancel: () => void; // Added a cancel handler for better control (e.g., closing modal)
  // Added props
  defaultConstructionSite?: string | null; // Can be null or undefined
  currentBalance?: number;
}

// Renamed component to PaymentForm for consistency
export default function PaymentForm({ 
  clientId, 
  sites, 
  onSuccess,
  onCancel,
  defaultConstructionSite,
  currentBalance
}: PaymentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false); // State for confirmation step
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'TRANSFER',
    reference_number: '',
    notes: '',
    // Initialize with default if provided, otherwise "general" for General Payment
    construction_site: defaultConstructionSite || 'general', 
  });

  // Effect to set default site when component mounts or default changes
  useEffect(() => {
    if (defaultConstructionSite) {
      // Check if the default site name exists in the available sites
      const siteExists = sites.some(site => site.name === defaultConstructionSite);
      setPaymentData(prev => ({
        ...prev,
        construction_site: siteExists ? defaultConstructionSite : 'general' 
      }));
    }
  }, [defaultConstructionSite, sites]);

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
      alert('El monto del pago debe ser mayor a cero');
      return;
    }
    // If amount is valid, move to confirmation step
    setIsConfirming(true);
  };
  
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setIsConfirming(false); // Move back from confirmation view immediately
    try {
      const amount = parseFloat(paymentData.amount);
      const paymentToSubmit = {
        amount,
        payment_method: paymentData.payment_method,
        reference_number: paymentData.reference_number,
        notes: paymentData.notes,
        // Ensure null is sent if construction_site is 'general'
        construction_site: paymentData.construction_site === 'general' ? null : paymentData.construction_site, 
        payment_date: new Date().toISOString() 
      };
      
      await clientService.createPayment(clientId, paymentToSubmit); 
      onSuccess(); // Call success callback (closes modal, refetches)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al registrar el pago';
      console.error("Payment Error:", error);
      alert(errorMessage); 
      // Keep modal open on error to allow correction?
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = () => {
    setIsConfirming(false); // Go back to editing form
  };

  // Render confirmation view if isConfirming is true
  if (isConfirming) {
    const selectedSiteName = paymentData.construction_site === 'general' 
      ? "Pago General (Distribución Automática)" 
      : paymentData.construction_site;
    return (
      <div className="space-y-6 py-4">
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
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleEdit} disabled={isSubmitting}>
            Editar
          </Button>
          <Button onClick={handleConfirmSubmit} disabled={isSubmitting}>
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
                variant="link"
                size="sm"
                className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800"
                onClick={handleSetFullBalance}
             >
               Pagar Saldo Total: {formatCurrency(currentBalance)}
             </Button>
           )}
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
          <Label htmlFor="construction_site">Obra Específica (opcional)</Label>
          <Select
            name="construction_site"
            value={paymentData.construction_site}
            onValueChange={(value) => handleChange({ target: { name: 'construction_site', value } } as any)} // Type assertion
            disabled={isSubmitting}
          >
            <SelectTrigger id="construction_site">
              <SelectValue placeholder="Pago General (Distribución Automática)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">-- Pago General (Distribución Automática) --</SelectItem> 
              {sites.map(site => (
                <SelectItem key={site.id} value={site.name}>{site.name}</SelectItem> 
              ))}
            </SelectContent>
          </Select>
        </div>
        
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
         <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
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
