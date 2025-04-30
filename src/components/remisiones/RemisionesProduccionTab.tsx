import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from '@/lib/supabase';
import RemisionMaterialesModal from './RemisionMaterialesModal';

export default function RemisionesProduccionTab() {
  const [remisiones, setRemisiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRemision, setSelectedRemision] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchRemisiones();
  }, []);

  const fetchRemisiones = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('remisiones')
        .select(`
          id,
          remision_number,
          fecha,
          hora_carga,
          volumen_fabricado,
          conductor,
          unidad,
          recipe_id,
          recipes(recipe_code)
        `)
        .not('recipe_id', 'is', null)
        .not('recipes.recipe_code', 'is', null)
        .order('fecha', { ascending: false });

      if (error) throw error;
      
      const remisionesConcreto = data?.filter(item => 
        item.recipes && typeof item.recipes === 'object' && 'recipe_code' in item.recipes && item.recipes.recipe_code
      ) || [];
      
      setRemisiones(remisionesConcreto);
    } catch (error) {
      console.error('Error fetching remisiones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (remision: any) => {
    try {
      const { data: materiales, error: materialesError } = await supabase
        .from('remision_materiales')
        .select('*')
        .eq('remision_id', remision.id);

      if (materialesError) throw materialesError;

      setSelectedRemision({
        ...remision,
        materiales: materiales || []
      });
      setShowModal(true);
    } catch (error) {
      console.error('Error fetching remision details:', error);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-3">Producción y Consumo de Materiales</h2>
      
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Cargando datos de remisiones...</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Remisión</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Receta</TableHead>
                  <TableHead>Volumen (m³)</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Conductor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remisiones.length > 0 ? (
                  remisiones.map(remision => (
                    <TableRow 
                      key={remision.id} 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(remision)}
                    >
                      <TableCell className="font-medium">{remision.remision_number}</TableCell>
                      <TableCell>{new Date(remision.fecha).toLocaleDateString()}</TableCell>
                      <TableCell>{remision.hora_carga}</TableCell>
                      <TableCell>{remision.recipes?.recipe_code}</TableCell>
                      <TableCell>{remision.volumen_fabricado}</TableCell>
                      <TableCell>{remision.unidad}</TableCell>
                      <TableCell>{remision.conductor}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4">
                      No hay remisiones de concreto registradas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {selectedRemision && (
            <RemisionMaterialesModal
              isOpen={showModal}
              onClose={() => setShowModal(false)}
              remision={selectedRemision}
            />
          )}
        </>
      )}
    </div>
  );
} 