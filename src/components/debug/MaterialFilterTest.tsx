'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { caracterizacionService } from '@/services/caracterizacionService';
import { Material } from '@/types/recipes';

// Componente de prueba para verificar el filtrado de materiales
export default function MaterialFilterTest() {
  const [plantId, setPlantId] = useState('');
  const [tipoMaterial, setTipoMaterial] = useState<'Arena' | 'Grava' | ''>('');
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plantas = [
    { id: '4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad', name: 'Planta 1' },
    { id: '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', name: 'Planta 2' },
    { id: '836cbbcf-67b2-4534-97cc-b83e71722ff7', name: 'Planta 3' },
    { id: 'baf175a7-fcf7-4e71-b18f-e952d8802129', name: 'Planta 4' }
  ];

  const testFilter = async () => {
    if (!plantId || !tipoMaterial) {
      setError('Selecciona planta y tipo de material');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await caracterizacionService.getMaterialesPorTipoYPlanta(plantId, tipoMaterial);
      setMateriales(result);
    } catch (err) {
      setError('Error al cargar materiales: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Test de Filtrado de Materiales</h2>
      
      <div className="flex gap-4 mb-4">
        <Select value={plantId} onValueChange={setPlantId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Seleccionar planta" />
          </SelectTrigger>
          <SelectContent>
            {plantas.map(planta => (
              <SelectItem key={planta.id} value={planta.id}>
                {planta.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipoMaterial} onValueChange={(value) => setTipoMaterial(value as 'Arena' | 'Grava')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo de material" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Arena">Arena</SelectItem>
            <SelectItem value="Grava">Grava</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={testFilter} disabled={loading}>
          {loading ? 'Cargando...' : 'Probar Filtro'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">
            Resultados: {materiales.length} materiales encontrados
          </h3>
        </div>
        <div className="p-4">
          {materiales.length === 0 ? (
            <p className="text-gray-500">No hay materiales para mostrar</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Nombre</th>
                    <th className="text-left p-2">Código</th>
                    <th className="text-left p-2">Aggregate Type</th>
                    <th className="text-left p-2">Subcategory</th>
                    <th className="text-left p-2">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {materiales.map((material) => (
                    <tr key={material.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{material.material_name}</td>
                      <td className="p-2">{material.material_code}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          material.aggregate_type === 'AR' ? 'bg-blue-100 text-blue-800' :
                          material.aggregate_type === 'GR' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {material.aggregate_type || 'null'}
                        </span>
                      </td>
                      <td className="p-2">{material.subcategory || 'null'}</td>
                      <td className="p-2">{material.primary_supplier || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
