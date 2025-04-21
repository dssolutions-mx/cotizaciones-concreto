"use client";

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { SelectClient } from "@/components/clients/SelectClient";
import { ConstructionSite } from "@/types/client";
import PaymentForm from "@/components/clients/PaymentForm";
import { useToast } from "@/components/ui/use-toast";

export default function QuickAddPaymentButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSites, setClientSites] = useState<ConstructionSite[]>([]);
  const [isSelectingClient, setIsSelectingClient] = useState(true);
  const { toast } = useToast();

  const handleClientSelected = (clientId: string, sites: ConstructionSite[]) => {
    setSelectedClientId(clientId);
    setClientSites(sites);
    setIsSelectingClient(false);
  };

  const handlePaymentSuccess = () => {
    toast({
      title: "Pago registrado",
      description: "El pago ha sido registrado exitosamente",
      variant: "success",
    });
    
    // Reset and close dialog
    setIsDialogOpen(false);
    resetForm();
  };

  const handleCancel = () => {
    resetForm();
  };

  const resetForm = () => {
    setSelectedClientId(null);
    setClientSites([]);
    setIsSelectingClient(true);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          className="bg-green-600 hover:bg-green-700 text-white" 
          onClick={() => setIsDialogOpen(true)}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Registrar Pago
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isSelectingClient ? "Seleccionar Cliente" : "Registrar Pago"}
          </DialogTitle>
          <DialogDescription>
            {isSelectingClient 
              ? "Seleccione el cliente al que desea registrar un pago"
              : "Ingrese los detalles del pago"
            }
          </DialogDescription>
        </DialogHeader>
        
        {isSelectingClient ? (
          <div className="py-4">
            <SelectClient 
              onClientSelected={handleClientSelected} 
              showSites={true}
            />
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          selectedClientId && (
            <PaymentForm
              clientId={selectedClientId}
              sites={clientSites}
              onSuccess={handlePaymentSuccess}
              onCancel={handleCancel}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
} 