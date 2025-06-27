'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface EditRemisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  remision: any;
  onSuccess: () => void;
}

interface RemisionMaterial {
  id: string;
  material_type: string;
  cantidad_real: number;
  cantidad_teorica: number;
}

// Material name mapping
const MATERIAL_NAMES: Record<string, string> = {
  'cement': 'Cemento',
  'water': 'Agua',
  'gravel': 'Grava 20mm',
  'gravel40mm': 'Grava 40mm',
  'volcanicSand': 'Arena Volcánica',
  'basalticSand': 'Arena Basáltica',
  'additive1': 'Aditivo 1',
  'additive2': 'Aditivo 2'
};

export default function EditRemisionModal({ isOpen, onClose, remision, onSuccess }: EditRemisionModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [materials, setMaterials] = useState<RemisionMaterial[]>([]);
  
  const [formData, setFormData] = useState({
    remision_number: '',
    fecha: '',
    hora_carga: '',
    volumen_fabricado: '',
    conductor: '',
    unidad: '',
    recipe_id: '',
    designacion_ehe: '',
    tipo_remision: 'CONCRETO'
  });

  // Verificar permisos
  const canEdit = profile?.role === 'DOSIFICADOR' || 
                  profile?.role === 'PLANT_MANAGER' || 
                  profile?.role === 'EXECUTIVE';

  useEffect(() => {
    console.log('EditRemisionModal: useEffect triggered', { isOpen, remisionId: remision?.id });
    if (isOpen && remision) {
      console.log('EditRemisionModal: Modal opened, loading data for remision:', remision.id);
      // Cargar datos frescos de la base de datos cada vez que se abra el modal
      loadFreshRemisionData();
      loadMaterials();
      loadRecipes();
    }
  }, [isOpen, remision?.id]); // Using remision.id instead of remision object

  // Additional effect to force refresh when modal opens
  useEffect(() => {
    if (isOpen && remision?.id) {
      console.log('EditRemisionModal: Force refresh on modal open');
      loadFreshRemisionData();
    }
  }, [isOpen]);

  const loadFreshRemisionData = async () => {
    if (!remision?.id) {
      console.log('EditRemisionModal: No remision.id available');
      return;
    }

    console.log('EditRemisionModal: Loading fresh data for remision ID:', remision.id);
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('remisiones')
        .select('*')
        .eq('id', remision.id)
        .single();

      if (error) throw error;

      if (data) {
        console.log('EditRemisionModal: Fresh data loaded:', data);
        console.log('EditRemisionModal: Original fecha from prop:', remision.fecha);
        console.log('EditRemisionModal: Fresh fecha from DB:', data.fecha);
        
        // Llenar el formulario con datos frescos de la base de datos
        const freshFormData = {
          remision_number: data.remision_number || '',
          fecha: data.fecha ? format(new Date(data.fecha), 'yyyy-MM-dd') : '',
          hora_carga: data.hora_carga || '',
          volumen_fabricado: data.volumen_fabricado?.toString() || '',
          conductor: data.conductor || '',
          unidad: data.unidad || '',
          recipe_id: data.recipe_id || '',
          designacion_ehe: data.designacion_ehe || '',
          tipo_remision: data.tipo_remision || 'CONCRETO'
        };
        
        console.log('EditRemisionModal: Setting fresh form data:', freshFormData);
        setFormData(freshFormData);
      }
    } catch (error) {
      console.error('Error loading fresh remision data:', error);
      // Si falla, usar los datos del prop como fallback
      console.log('EditRemisionModal: Using fallback data from prop');
      setFormData({
        remision_number: remision.remision_number || '',
        fecha: remision.fecha ? format(new Date(remision.fecha), 'yyyy-MM-dd') : '',
        hora_carga: remision.hora_carga || '',
        volumen_fabricado: remision.volumen_fabricado?.toString() || '',
        conductor: remision.conductor || '',
        unidad: remision.unidad || '',
        recipe_id: remision.recipe_id || '',
        designacion_ehe: remision.designacion_ehe || '',
        tipo_remision: remision.tipo_remision || 'CONCRETO'
      });
    } finally {
      setLoadingData(false);
    }
  };

  const loadRecipes = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, recipe_code, strength_fc, placement_type')
        .order('recipe_code');

      if (error) throw error;
      setRecipes(data || []);
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  };

  const loadMaterials = async () => {
    if (!remision?.id) return;

    try {
      const { data, error } = await supabase
        .from('remision_materiales')
        .select('*')
        .eq('remision_id', remision.id);

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRecipeChange = (value: string) => {
    setFormData(prev => ({ ...prev, recipe_id: value }));
    
    // Auto-fill designacion_ehe with recipe code when recipe is selected
    if (value && recipes.length > 0) {
      const selectedRecipe = recipes.find(r => r.id === value);
      if (selectedRecipe && selectedRecipe.recipe_code) {
        setFormData(prev => ({ ...prev, designacion_ehe: selectedRecipe.recipe_code }));
      }
    }
  };

  const handleMaterialChange = (index: number, field: string, value: string) => {
    setMaterials(prev => prev.map((material, i) => 
      i === index ? { ...material, [field]: parseFloat(value) || 0 } : material
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canEdit) {
      toast.error('No tienes permisos para editar remisiones');
      return;
    }

    if (!formData.remision_number || !formData.fecha || !formData.hora_carga || !formData.volumen_fabricado) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    setLoading(true);

    try {
      // Actualizar datos principales de la remisión
      const { error: remisionError } = await supabase
        .from('remisiones')
        .update({
          remision_number: formData.remision_number,
          fecha: formData.fecha,
          hora_carga: formData.hora_carga,
          volumen_fabricado: parseFloat(formData.volumen_fabricado),
          conductor: formData.conductor,
          unidad: formData.unidad,
          recipe_id: formData.recipe_id || null,
          designacion_ehe: formData.designacion_ehe,
          tipo_remision: formData.tipo_remision
        })
        .eq('id', remision.id);

      if (remisionError) throw remisionError;

      // Actualizar materiales si existen
      if (materials.length > 0) {
        const materialUpdates = materials.map(material => ({
          id: material.id,
          cantidad_real: material.cantidad_real,
          cantidad_teorica: material.cantidad_teorica
        }));

        for (const material of materialUpdates) {
          const { error: materialError } = await supabase
            .from('remision_materiales')
            .update({
              cantidad_real: material.cantidad_real,
              cantidad_teorica: material.cantidad_teorica
            })
            .eq('id', material.id);

          if (materialError) throw materialError;
        }
      }

      toast.success('Remisión actualizada exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating remision:', error);
      toast.error('Error al actualizar la remisión');
    } finally {
      setLoading(false);
    }
  };

  if (!canEdit) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acceso Denegado</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            No tienes permisos para editar remisiones. Esta función está disponible solo para el equipo de dosificación, jefes de planta y ejecutivos.
          </p>
          <DialogFooter>
            <Button onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Remisión</DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 border-t-2 border-b-2 border-blue-600 rounded-full animate-spin"></div>
              <span className="text-gray-600">Cargando datos actualizados...</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Número de Remisión */}
            <div>
              <Label htmlFor="remision_number">Número de Remisión *</Label>
              <Input
                id="remision_number"
                value={formData.remision_number}
                onChange={(e) => handleInputChange('remision_number', e.target.value)}
                required
              />
            </div>

            {/* Tipo de Remisión */}
            <div>
              <Label htmlFor="tipo_remision">Tipo de Remisión *</Label>
              <Select
                value={formData.tipo_remision}
                onValueChange={(value) => handleInputChange('tipo_remision', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONCRETO">Concreto</SelectItem>
                  <SelectItem value="BOMBEO">Bombeo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha */}
            <div>
              <Label htmlFor="fecha">Fecha *</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => handleInputChange('fecha', e.target.value)}
                required
              />
            </div>

            {/* Hora de Carga */}
            <div>
              <Label htmlFor="hora_carga">Hora de Carga *</Label>
              <Input
                id="hora_carga"
                type="time"
                value={formData.hora_carga}
                onChange={(e) => handleInputChange('hora_carga', e.target.value)}
                required
              />
            </div>

            {/* Volumen Fabricado */}
            <div>
              <Label htmlFor="volumen_fabricado">Volumen Fabricado (m³) *</Label>
              <Input
                id="volumen_fabricado"
                type="number"
                step="0.01"
                min="0"
                value={formData.volumen_fabricado}
                onChange={(e) => handleInputChange('volumen_fabricado', e.target.value)}
                required
              />
            </div>

            {/* Conductor */}
            <div>
              <Label htmlFor="conductor">Conductor</Label>
              <Input
                id="conductor"
                value={formData.conductor}
                onChange={(e) => handleInputChange('conductor', e.target.value)}
              />
            </div>

            {/* Unidad */}
            <div>
              <Label htmlFor="unidad">Unidad</Label>
              <Input
                id="unidad"
                value={formData.unidad}
                onChange={(e) => handleInputChange('unidad', e.target.value)}
              />
            </div>

            {/* Receta (solo para concreto) */}
            {formData.tipo_remision === 'CONCRETO' && (
              <div>
                <Label htmlFor="recipe_id">Receta</Label>
                <Select
                  value={formData.recipe_id}
                  onValueChange={handleRecipeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar receta" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipes.map((recipe) => (
                      <SelectItem key={recipe.id} value={recipe.id}>
                        {recipe.recipe_code} - {recipe.strength_fc} kg/cm² ({recipe.placement_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Designación EHE */}
            <div>
              <Label htmlFor="designacion_ehe">Designación EHE</Label>
              <Input
                id="designacion_ehe"
                value={formData.designacion_ehe}
                onChange={(e) => handleInputChange('designacion_ehe', e.target.value)}
                placeholder="Normalmente coincide con el código de receta"
              />
              <p className="text-xs text-gray-500 mt-1">
                La designación EHE generalmente es la misma que el código de la receta seleccionada
              </p>
            </div>
          </div>

          {/* Materiales Section */}
          {materials.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Materiales</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 border text-left">Material</th>
                      <th className="px-4 py-2 border text-right">Cantidad Teórica</th>
                      <th className="px-4 py-2 border text-right">Cantidad Real</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((material, index) => (
                      <tr key={material.id}>
                        <td className="px-4 py-2 border">
                          {MATERIAL_NAMES[material.material_type] || material.material_type}
                        </td>
                        <td className="px-4 py-2 border text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={material.cantidad_teorica}
                            onChange={(e) => handleMaterialChange(index, 'cantidad_teorica', e.target.value)}
                            className="w-24 text-right"
                          />
                        </td>
                        <td className="px-4 py-2 border text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={material.cantidad_real}
                            onChange={(e) => handleMaterialChange(index, 'cantidad_real', e.target.value)}
                            className="w-24 text-right"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
} 