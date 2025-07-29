import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface RemisionMaterialesModalProps {
  isOpen: boolean;
  onClose: () => void;
  remision: any;
}

export default function RemisionMaterialesModal({ isOpen, onClose, remision }: RemisionMaterialesModalProps) {
  const [materialDetails, setMaterialDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Material type mapping for display
  const MATERIAL_TYPE_MAP: Record<string, string> = {
    'cement': 'CPC 40',
    'water': 'AGUA 1',
    'gravel': 'GRAVA BASALTO 20mm',
    'gravel40mm': 'GRAVA BASALTO 40mm',
    'volcanicSand': 'ARENA BLANCA',
    'basalticSand': 'ARENA TRITURADA',
    'additive1': '800 MX',
    'additive2': 'ADITIVO 2'
  };
  
  useEffect(() => {
    if (isOpen && remision) {
      fetchMaterialDetails();
    }
  }, [isOpen, remision]);
  
  const fetchMaterialDetails = async () => {
    setLoading(true);
    try {
      // Validate that we have a valid recipe_id
      if (!remision?.recipe_id) {
        console.warn('No recipe_id found for remision:', remision);
        setMaterialDetails([]);
        setLoading(false);
        return;
      }

      // Get recipe version for this remision's recipe
      const { data: versionData, error: versionError } = await supabase
        .from('recipe_versions')
        .select('id')
        .eq('recipe_id', remision.recipe_id)
        .eq('is_current', true)
        .single();
      
      if (versionError) throw versionError;
      
      // Get the theoretical quantities for this recipe version
      const { data: theoreticalData, error: theoreticalError } = await supabase
        .from('material_quantities')
        .select('material_type, quantity')
        .eq('recipe_version_id', versionData.id);
      
      if (theoreticalError) throw theoreticalError;
      
      // Create lookup map for theoretical quantities per material type
      const theoreticalMap = new Map();
      theoreticalData.forEach(item => {
        theoreticalMap.set(item.material_type, item.quantity);
      });
      
      // Process the materials with calculated values
      const processedMaterials = remision.materiales.map((material: any) => {
        const displayName = MATERIAL_TYPE_MAP[material.material_type] || material.material_type;
        const baseTheoretical = theoreticalMap.get(material.material_type) || 0;
        const theoreticalQuantity = baseTheoretical * remision.volumen_fabricado;
        const realQuantity = material.cantidad_real;
        const difference = realQuantity - theoreticalQuantity;
        const percentageDifference = theoreticalQuantity > 0 
          ? (difference / theoreticalQuantity) * 100 
          : 0;
        
        return {
          material_type: displayName,
          real_quantity: realQuantity,
          theoretical_quantity: theoreticalQuantity,
          difference,
          percentage_difference: percentageDifference
        };
      });
      
      setMaterialDetails(processedMaterials);
    } catch (error) {
      console.error('Error fetching material details:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Detalles de Materiales - Remisión {remision.remision_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Fecha:</p>
            <p>{new Date(remision.fecha).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Receta:</p>
            <p>{remision.recipes?.recipe_code}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Volumen:</p>
            <p>{remision.volumen_fabricado} m³</p>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">Cargando detalles de materiales...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Real (kg)</TableHead>
                  <TableHead className="text-right">Teórico (kg)</TableHead>
                  <TableHead className="text-right">Diferencia (kg)</TableHead>
                  <TableHead className="text-right">Diferencia (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialDetails.map((material, index) => (
                  <TableRow key={index}>
                    <TableCell>{material.material_type}</TableCell>
                    <TableCell className="text-right">{material.real_quantity.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{material.theoretical_quantity.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <span className={material.difference > 0 ? 'text-red-500' : material.difference < 0 ? 'text-yellow-500' : 'text-green-500'}>
                        {material.difference.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={material.percentage_difference > 0 ? 'text-red-500' : material.percentage_difference < 0 ? 'text-yellow-500' : 'text-green-500'}>
                        {material.percentage_difference.toFixed(2)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {materialDetails.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      No hay datos de materiales disponibles para esta remisión
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 