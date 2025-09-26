'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { Material } from '@/types/recipes';
import { recipeService } from '@/lib/supabase/recipes';
import { showSuccess, showError } from '@/lib/utils/toast';

interface EditMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  material: Material | null;
}

export default function EditMaterialModal({ isOpen, onClose, onSuccess, material }: EditMaterialModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    material_name: '',
    material_code: '',
    category: 'cemento',
    subcategory: '',
    unit_of_measure: 'kg',
    density: '',
    specific_gravity: '',
    absorption_rate: '',
    fineness_modulus: '',
    strength_class: '',
    supplier_id: '',
    aggregate_type: '',
    aggregate_size: '',
    aggregate_lithology: '',
    aggregate_extraction: '',
    is_active: true,
    notes: ''
  });

  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; provider_number: number; provider_letter?: string; internal_code?: string }>>([]);
  const [builderState, setBuilderState] = useState({
    aggregateType: '' as '' | 'AR' | 'GR',
    aggregateSize: '' as '' | string,
    lithology: '' as '' | 'A' | 'C' | 'B' | 'G' | 'R' | 'D',
    extraction: '' as '' | 'T' | 'R' | 'M' | 'L',
    providerNumber: '' as '' | string,
    cementProviderLetter: '' as '' | string,
    cementSpecification: '' as '' | string,
    waterProviderNumber: '' as '' | string,
  });

  const categories = [
    { value: 'cemento', label: 'Cemento' },
    { value: 'agregado', label: 'Agregado' },
    { value: 'aditivo', label: 'Aditivo' },
    { value: 'agua', label: 'Agua' }
  ];

  const units = [
    { value: 'kg', label: 'Kilogramos (kg)' },
    { value: 'm3', label: 'Metros cúbicos (m³)' },
    { value: 'l', label: 'Litros (L)' },
    { value: 'ton', label: 'Toneladas (ton)' }
  ];

  // Load material data when modal opens
  useEffect(() => {
    if (isOpen && material) {
      setFormData({
        material_name: material.material_name || '',
        material_code: material.material_code || '',
        category: material.category || 'cemento',
        subcategory: material.subcategory || '',
        unit_of_measure: material.unit_of_measure || 'kg',
        density: material.density?.toString() || '',
        specific_gravity: material.specific_gravity?.toString() || '',
        absorption_rate: material.absorption_rate?.toString() || '',
        fineness_modulus: material.fineness_modulus?.toString() || '',
        strength_class: material.strength_class || '',
        supplier_id: (material as any).supplier_id || '',
        aggregate_type: (material as any).aggregate_type || '',
        aggregate_size: (material as any).aggregate_size?.toString() || '',
        aggregate_lithology: (material as any).aggregate_lithology || '',
        aggregate_extraction: (material as any).aggregate_extraction || '',
        is_active: material.is_active ?? true,
        notes: material.notes || ''
      });

      setBuilderState({
        aggregateType: ((material as any).aggregate_type || '') as any,
        aggregateSize: (material as any).aggregate_size?.toString() || '',
        lithology: ((material as any).aggregate_lithology || '') as any,
        extraction: ((material as any).aggregate_extraction || '') as any,
        providerNumber: '',
        cementProviderLetter: '',
        cementSpecification: material.category === 'cemento' ? material.material_code?.slice(1) || '' : '',
        waterProviderNumber: '',
      });
    }
  }, [isOpen, material]);

  useEffect(() => {
    // fetch suppliers for context
    (async () => {
      try {
        const data = await recipeService.getSuppliers((material as any)?.plant_id);
        setSuppliers(data);
      } catch (e) {
        console.error('Error fetching suppliers', e);
      }
    })();
  }, [material]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!material) {
      showError('No se ha seleccionado un material para editar');
      return;
    }

    if (!formData.material_name || !formData.material_code) {
      showError('El nombre y código del material son obligatorios');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        ...formData,
        // Convert numeric fields; use null to clear if empty
        density: formData.density ? parseFloat(formData.density) : null,
        specific_gravity: formData.specific_gravity ? parseFloat(formData.specific_gravity) : null,
        absorption_rate: formData.absorption_rate ? parseFloat(formData.absorption_rate) : null,
        fineness_modulus: formData.fineness_modulus ? parseFloat(formData.fineness_modulus) : null,
        // Normalize optional foreign keys / enums
        supplier_id: formData.supplier_id || null,
        subcategory: formData.subcategory || null,
        strength_class: formData.strength_class || null,
        notes: formData.notes || null,
      };

      // Aggregate protocol fields
      if (formData.category === 'agregado') {
        payload.aggregate_type = formData.aggregate_type || null;
        payload.aggregate_size = formData.aggregate_size ? parseInt(formData.aggregate_size, 10) : null;
        payload.aggregate_lithology = formData.aggregate_lithology || null;
        payload.aggregate_extraction = formData.aggregate_extraction || null;
      } else {
        payload.aggregate_type = null;
        payload.aggregate_size = null;
        payload.aggregate_lithology = null;
        payload.aggregate_extraction = null;
      }
      await recipeService.updateMaterial(material.id, payload);

      showSuccess('Material actualizado exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating material:', error);
      showError('Error al actualizar el material');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Material</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="material_name">Nombre del Material *</Label>
              <Input
                id="material_name"
                name="material_name"
                value={formData.material_name}
                onChange={handleInputChange}
                placeholder="Ej: Cemento Portland Tipo I"
                required
              />
            </div>

            <div>
              <Label htmlFor="material_code">Código del Material *</Label>
              <Input
                id="material_code"
                name="material_code"
                value={formData.material_code}
                onChange={handleInputChange}
                placeholder="Ej: CPC-40"
                required
              />
            </div>

            <div>
              <Label htmlFor="category">Categoría *</Label>
              <Select value={formData.category} onValueChange={(value) => handleSelectChange('category', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {['cemento','aditivo'].includes(formData.category) && (
              <div>
                <Label htmlFor="subcategory">Subcategoría</Label>
                <Input
                  id="subcategory"
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleInputChange}
                  placeholder={formData.category === 'cemento' ? 'Ej: Tipo I' : 'Ej: Superplastificante A'}
                />
              </div>
            )}

            <div>
              <Label htmlFor="unit_of_measure">Unidad de Medida *</Label>
              <Select value={formData.unit_of_measure} onValueChange={(value) => handleSelectChange('unit_of_measure', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map(unit => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.category === 'cemento' && (
              <div>
                <Label htmlFor="strength_class">Clase de Resistencia</Label>
                <Input
                  id="strength_class"
                  name="strength_class"
                  value={formData.strength_class}
                  onChange={handleInputChange}
                  placeholder="Ej: 40 MPa"
                />
              </div>
            )}
          </div>

          {/* Technical Properties */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Propiedades Técnicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="density">Densidad (kg/m³)</Label>
                <Input
                  id="density"
                  name="density"
                  type="number"
                  step="0.01"
                  value={formData.density}
                  onChange={handleInputChange}
                  placeholder="Ej: 3150"
                />
              </div>

              <div>
                <Label htmlFor="specific_gravity">Gravedad Específica</Label>
                <Input
                  id="specific_gravity"
                  name="specific_gravity"
                  type="number"
                  step="0.01"
                  value={formData.specific_gravity}
                  onChange={handleInputChange}
                  placeholder="Ej: 3.15"
                />
              </div>

              <div>
                <Label htmlFor="absorption_rate">Absorción (%)</Label>
                <Input
                  id="absorption_rate"
                  name="absorption_rate"
                  type="number"
                  step="0.01"
                  value={formData.absorption_rate}
                  onChange={handleInputChange}
                  placeholder="Ej: 1.2"
                />
              </div>

              <div>
                <Label htmlFor="fineness_modulus">Módulo de Fineza</Label>
                <Input
                  id="fineness_modulus"
                  name="fineness_modulus"
                  type="number"
                  step="0.01"
                  value={formData.fineness_modulus}
                  onChange={handleInputChange}
                  placeholder="Ej: 2.8"
                />
              </div>
            </div>
          </div>

          {/* Supplier Information - normalized */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Información del Proveedor</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Proveedor</Label>
                <Select value={formData.supplier_id} onValueChange={(v) => setFormData(prev => ({ ...prev, supplier_id: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{`${s.provider_number} - ${s.name}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Letra</Label>
                <Input value={(suppliers.find(s => s.id === formData.supplier_id)?.provider_letter || '').toUpperCase()} disabled />
              </div>
              <div>
                <Label>Código Interno</Label>
                <Input value={suppliers.find(s => s.id === formData.supplier_id)?.internal_code || ''} disabled />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Información adicional sobre el material..."
              rows={3}
            />
          </div>

          {/* Status */}
          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active">Material Activo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Actualizar Material'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 