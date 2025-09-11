'use client';

import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Search, Users } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/lib/supabase';
import type { ClientInfo } from '@/types/clientQuality';
import { Switch } from '@/components/ui/switch';

interface ClientSelectorProps {
  selectedClientId: string;
  onClientSelect: (clientId: string) => void;
  className?: string;
}

export function ClientSelector({
  selectedClientId,
  onClientSelect,
  className
}: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [onlyWithQualityData, setOnlyWithQualityData] = useState(false);

  // Load clients with quality data
  useEffect(() => {
    const loadClients = async () => {
      try {
        setLoading(true);

        // Get all clients
        const { data: allClients, error: clientsError } = await supabase
          .from('clients')
          .select(`
            id,
            business_name,
            client_code,
            rfc
          `)
          .order('business_name');

        if (clientsError) throw clientsError;

        // Get clients that have quality data in the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const { data: clientsWithData, error: qualityError } = await supabase
          .from('remisiones')
          .select(`
            orders!inner (
              client_id,
              clients (
                id,
                business_name
              )
            )
          `)
          .gte('fecha', sixMonthsAgo.toISOString().split('T')[0])
          .not('volumen_fabricado', 'is', null);

        if (qualityError) throw qualityError;

        // Create a set of client IDs that have quality data
        const clientsWithQualityData = new Set(
          (clientsWithData || []).map(r => r.orders?.clients?.id).filter(Boolean)
        );

        // Format clients with quality data indicator
        const formattedClients = (allClients || []).map(client => ({
          id: client.id,
          business_name: client.business_name,
          client_code: client.client_code,
          rfc: client.rfc,
          hasQualityData: clientsWithQualityData.has(client.id)
        }));

        setClients(formattedClients);
      } catch (error) {
        console.error('Error loading clients:', error);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };

    loadClients();
  }, []);

  const selectedClient = clients.find(client => client.id === selectedClientId);

  const normalize = (text: string) =>
    (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  const safeSearch = normalize(searchValue || '');
  const filteredClients = clients
    .filter(client => !onlyWithQualityData || !!client.hasQualityData)
    .filter(client => {
      if (!safeSearch) return true;
      const name = normalize(client.business_name || '');
      const code = normalize(client.client_code || '');
      const rfc = normalize(client.rfc || '');
      return name.includes(safeSearch) || code.includes(safeSearch) || rfc.includes(safeSearch);
    });

  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      <label className="text-sm font-medium text-gray-700">
        Seleccionar Cliente
      </label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                <span>Cargando clientes...</span>
              </div>
            ) : selectedClient ? (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="truncate">{selectedClient.business_name}</span>
                <Badge variant="secondary" className="ml-2">
                  {selectedClient.client_code}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-500">
                <Users className="h-4 w-4" />
                <span>Seleccionar cliente...</span>
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-full p-0" align="start">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
            <div className="text-xs text-gray-600">
              {filteredClients.length}/{clients.length} coincidencias
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Solo con datos</span>
              <Switch
                checked={onlyWithQualityData}
                onCheckedChange={(v) => setOnlyWithQualityData(!!v)}
                aria-label="Filtrar solo clientes con datos de calidad"
              />
            </div>
          </div>
          <Command>
            <CommandInput
              placeholder="Buscar cliente..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? 'Cargando...' : 'No se encontraron clientes.'}
              </CommandEmpty>
              <CommandGroup>
                {filteredClients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`${client.business_name} ${client.client_code} ${client.rfc || ''}`}
                    onSelect={() => {
                      onClientSelect(client.id === selectedClientId ? '' : client.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedClientId === client.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{client.business_name}</span>
                        {client.hasQualityData && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            Datos de calidad
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>Código: {client.client_code}</span>
                        {client.rfc && <span>• RFC: {client.rfc}</span>}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedClient && (
        <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 p-2 rounded">
          <span>Cliente seleccionado:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClientSelect('')}
            className="h-6 px-2 text-xs"
          >
            Cambiar
          </Button>
        </div>
      )}

      <div className="text-xs text-gray-500">
        {clients.length} clientes con datos de calidad disponibles
      </div>
    </div>
  );
}
