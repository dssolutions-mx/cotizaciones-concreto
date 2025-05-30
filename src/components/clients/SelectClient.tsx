"use client";

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { clientService } from '@/lib/supabase/clients';
import { ConstructionSite } from '@/types/client';
import { Loader2, Search, List, Check } from "lucide-react";

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
  const [viewMode, setViewMode] = useState<'dropdown' | 'search'>('dropdown');

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

  // Filter clients based on search query - same logic as ClientBalanceTable
  const filteredClients = searchQuery
    ? clients.filter(client => 
        client.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.client_code?.toLowerCase().includes(searchQuery.toLowerCase()))
    : clients;

  // Sort clients alphabetically by business name
  const sortedClients = [...clients].sort((a, b) => 
    (a.business_name || '').localeCompare(b.business_name || '')
  );

  // Sort filtered clients for search mode
  const sortedFilteredClients = [...filteredClients].sort((a, b) => 
    (a.business_name || '').localeCompare(b.business_name || '')
  );

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

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <Label>Método de selección</Label>
        <div className="flex items-center space-x-2">
          <List className="h-4 w-4" />
          <Switch
            checked={viewMode === 'search'}
            onCheckedChange={(checked) => setViewMode(checked ? 'search' : 'dropdown')}
          />
          <Search className="h-4 w-4" />
        </div>
      </div>

      {viewMode === 'dropdown' ? (
        /* Dropdown Mode - Similar to ventas page */
        <div className="space-y-2">
          <Label htmlFor="client-select">Seleccionar Cliente</Label>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Select value={selectedClientId || ""} onValueChange={handleSelectClient}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccione un cliente..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {sortedClients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex justify-between items-center w-full">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{client.business_name}</span>
                        <span className="text-xs text-muted-foreground">{client.client_code}</span>
                      </div>
                      {client.credit_status && (
                        <span className={`text-xs px-2 py-1 rounded-full ml-2 ${
                          client.credit_status === 'approved' ? 'bg-green-100 text-green-800' :
                          client.credit_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {client.credit_status === 'approved' ? 'Aprobado' : 
                           client.credit_status === 'pending' ? 'Pendiente' : 'Rechazado'}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ) : (
        /* Search Mode - Using Input with manual filtering like ClientBalanceTable */
        <div className="space-y-2">
          <Label htmlFor="client-search">Buscar Cliente</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="client-search"
              placeholder="Buscar por nombre o código de cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          
          {/* Results List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              {sortedFilteredClients.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchQuery ? 'No se encontraron clientes' : 'Escriba para buscar clientes'}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {sortedFilteredClients.map(client => (
                    <div
                      key={client.id}
                      onClick={() => handleSelectClient(client.id)}
                      className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${
                        selectedClientId === client.id 
                          ? 'bg-accent border border-accent-foreground/20' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{client.business_name}</span>
                        <span className="text-xs text-muted-foreground">{client.client_code}</span>
                      </div>
                      <div className="flex items-center gap-2">
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
                        {selectedClientId === client.id && (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Show selected client info */}
      {selectedClient && (
        <div className="pt-2 pb-2">
          <Label>Cliente Seleccionado</Label>
          <div className="mt-2 p-3 border rounded-md bg-muted/50">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{selectedClient.business_name}</p>
                <p className="text-sm text-muted-foreground">{selectedClient.client_code}</p>
              </div>
              {selectedClient.credit_status && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  selectedClient.credit_status === 'approved' ? 'bg-green-100 text-green-800' :
                  selectedClient.credit_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {selectedClient.credit_status === 'approved' ? 'Aprobado' : 
                   selectedClient.credit_status === 'pending' ? 'Pendiente' : 'Rechazado'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {showSites && selectedClientId && (
        <div className="pt-2 pb-2">
          <Label>Obras disponibles</Label>
          {clientSites.length > 0 ? (
            <div className="mt-2 p-3 border rounded-md bg-muted/50">
              <ul className="text-sm space-y-1">
                {clientSites.map(site => (
                  <li key={site.id} className="py-1 border-b last:border-b-0">{site.name}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-2 p-3 border rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">No hay obras registradas para este cliente</p>
            </div>
          )}
        </div>
      )}

      {((showSites && selectedClientId) || (!showSites && selectedClientId)) && (
        <div className="flex justify-end pt-4 space-x-2">
          <Button 
            variant="outline"
            onClick={() => {
              setSelectedClientId(null);
              setClientSites([]);
              setSearchQuery('');
            }}
          >
            Limpiar
          </Button>
          <Button 
            onClick={showSites ? handleConfirmSelection : () => onClientSelected(selectedClientId!, clientSites)}
            disabled={!selectedClientId}
          >
            {showSites ? 'Continuar' : 'Seleccionar'}
          </Button>
        </div>
      )}
    </div>
  );
} 