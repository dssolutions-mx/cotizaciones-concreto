"use client";

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { clientService } from '@/lib/supabase/clients';
import { ConstructionSite } from '@/types/client';
import { Loader2 } from "lucide-react";

interface SelectClientProps {
  onClientSelected: (clientId: string, sites: ConstructionSite[]) => void;
  showSites?: boolean;
}

export function SelectClient({ onClientSelected, showSites = false }: SelectClientProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSites, setClientSites] = useState<ConstructionSite[]>([]);

  // Fetch clients on mount
  useEffect(() => {
    async function fetchClients() {
      setIsLoading(true);
      try {
        const data = await clientService.getAllClients();
        setClients(data || []);
      } catch (error) {
        console.error("Error fetching clients:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchClients();
  }, []);

  // Fetch sites when a client is selected
  useEffect(() => {
    async function fetchClientSites() {
      if (!selectedClientId || !showSites) return;
      
      try {
        const sites = await clientService.getClientSites(selectedClientId);
        setClientSites(sites || []);
      } catch (error) {
        console.error("Error fetching client sites:", error);
        setClientSites([]);
      }
    }
    
    fetchClientSites();
  }, [selectedClientId, showSites]);

  // Filter clients based on search query
  const filteredClients = searchQuery
    ? clients.filter(client => 
        client.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.client_code?.toLowerCase().includes(searchQuery.toLowerCase()))
    : clients;

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    
    // If we don't need sites, select the client immediately
    if (!showSites) {
      onClientSelected(clientId, []);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedClientId) {
      onClientSelected(selectedClientId, clientSites);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client-search">Buscar Cliente</Label>
        <Command className="rounded-lg border shadow-md">
          <CommandInput 
            placeholder="Buscar por nombre o código..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No se encontraron clientes</CommandEmpty>
            <CommandGroup>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                filteredClients.map(client => (
                  <CommandItem
                    key={client.id}
                    value={client.id}
                    onSelect={() => handleSelectClient(client.id)}
                    className={`flex justify-between ${selectedClientId === client.id ? 'bg-accent' : ''}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{client.business_name}</span>
                      <span className="text-xs text-muted-foreground">{client.client_code}</span>
                    </div>
                    {client.credit_status && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        client.credit_status === 'approved' ? 'bg-green-100 text-green-800' :
                        client.credit_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {client.credit_status === 'approved' ? 'Aprobado' : 
                         client.credit_status === 'pending' ? 'Pendiente' : 'Rechazado'}
                      </span>
                    )}
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>

      {showSites && selectedClientId && (
        <div className="pt-4 pb-2">
          <Label>Información del Cliente Seleccionado</Label>
          <div className="mt-2 p-3 border rounded-md bg-muted/50">
            <p className="font-medium">
              {clients.find(c => c.id === selectedClientId)?.business_name}
            </p>
            
            {clientSites.length > 0 && (
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">Obras disponibles:</Label>
                <ul className="mt-1 text-sm">
                  {clientSites.map(site => (
                    <li key={site.id} className="py-1">{site.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {showSites && selectedClientId && (
        <div className="flex justify-end pt-4">
          <Button 
            onClick={handleConfirmSelection}
            disabled={!selectedClientId}
          >
            Continuar
          </Button>
        </div>
      )}
    </div>
  );
} 