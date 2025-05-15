'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { es } from 'date-fns/locale';

interface RemisionData {
  id: string;
  remision_number: string;
  fecha: string;
  volumen_fabricado: number;
  recipe_id: string;
  recipe: {
    recipe_code: string;
    strength_fc: number;
    slump: number;
    age_days: number;
  } | null;
  orders: {
    id: string;
    clients: {
      business_name: string;
    } | null;
  } | null;
}

interface RemisionesPickerProps {
  onRemisionSelected: (remision: RemisionData) => void;
}

export default function RemisionesPicker({ onRemisionSelected }: RemisionesPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [remisiones, setRemisiones] = useState<RemisionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchRemisiones = async (search?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('remisiones')
        .select(`
          id,
          remision_number,
          fecha,
          volumen_fabricado,
          recipe_id,
          recipe:recipes(
            recipe_code,
            strength_fc,
            slump,
            age_days
          ),
          orders(
            id,
            clients(
              business_name
            )
          )
        `)
        .order('fecha', { ascending: false });
      
      // Add search filter if provided
      if (search && search.trim() !== '') {
        query = query.or(`remision_number.ilike.%${search}%,recipe.recipe_code.ilike.%${search}%,orders.clients.business_name.ilike.%${search}%`);
      }
      
      // Limit results to most recent remisiones
      query = query.limit(50);
      
      const { data, error } = await query;
      
      if (error) throw error;
      setRemisiones(data as unknown as RemisionData[] || []);
    } catch (err) {
      console.error('Error fetching remisiones:', err);
      setError('Error al cargar remisiones. Por favor intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchRemisiones();
  }, []);
  
  // Search when term changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchRemisiones(searchTerm);
    }, 300);
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Seleccionar Remisión</CardTitle>
        <CardDescription>
          Busque una remisión por número, cliente o código de receta para crear un nuevo muestreo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 relative">
          <Input
            placeholder="Buscar por número de remisión, cliente o receta..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10"
          />
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        
        {loading && (
          <div className="flex justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}
        
        {error && (
          <div className="text-red-500 text-center p-4">
            {error}
          </div>
        )}
        
        {!loading && !error && remisiones.length === 0 && (
          <div className="text-center text-gray-500 p-6">
            No se encontraron remisiones. Intente con otra búsqueda.
          </div>
        )}
        
        <div className="space-y-2">
          {remisiones.map(remision => (
            <div
              key={remision.id}
              className="border rounded-md p-3 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => {
                console.log('Selected remision with fecha:', remision.fecha);
                onRemisionSelected(remision);
              }}
            >
              <div className="flex justify-between">
                <div className="font-medium">Remisión #{remision.remision_number}</div>
                <div className="text-sm text-gray-500">
                  {formatDate(remision.fecha, 'PPP')}
                </div>
              </div>
              
              <div className="flex justify-between mt-1">
                <div className="text-sm text-gray-600">
                  {remision.orders?.clients?.business_name || 'Cliente no especificado'}
                </div>
                <div className="text-sm font-medium">
                  {remision.volumen_fabricado} m³
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                  {remision.recipe?.recipe_code || 'Receta no especificada'}
                </div>
                <div className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                  {remision.recipe?.strength_fc || '-'} kg/cm²
                </div>
                <div className="bg-orange-50 text-orange-700 px-2 py-1 rounded text-xs">
                  Rev: {remision.recipe?.slump || '-'} cm
                </div>
                <div className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs">
                  {remision.recipe?.age_days || '-'} días
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {remisiones.length > 0 && (
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => fetchRemisiones(searchTerm)}>
              Cargar más remisiones
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 