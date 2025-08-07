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
    primary_supplier: '',
    supplier_code: '',
    is_active: true,
    notes: ''
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
        primary_supplier: material.primary_supplier || '',
        supplier_code: material.supplier_code || '',
        is_active: material.is_active ?? true,
        notes: material.notes || ''
      });
    }
  }, [isOpen, material]);

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
      await recipeService.updateMaterial(material.id, {
        ...formData,
        density: formData.density ? parseFloat(formData.density) : undefined,
        specific_gravity: formData.specific_gravity ? parseFloat(formData.specific_gravity) : undefined,
        absorption_rate: formData.absorption_rate ? parseFloat(formData.absorption_rate) : undefined,
        fineness_modulus: formData.fineness_modulus ? parseFloat(formData.fineness_modulus) : undefined
      });

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

            <div>
              <Label htmlFor="subcategory">Subcategoría</Label>
              <Input
                id="subcategory"
                name="subcategory"
                value={formData.subcategory}
                onChange={handleInputChange}
                placeholder="Ej: Tipo I, 20mm, etc."
              />
            </div>

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

          {/* Supplier Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Información del Proveedor</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary_supplier">Proveedor Principal</Label>
                <Input
                  id="primary_supplier"
                  name="primary_supplier"
                  value={formData.primary_supplier}
                  onChange={handleInputChange}
                  placeholder="Nombre del proveedor"
                />
              </div>

              <div>
                <Label htmlFor="supplier_code">Código del Proveedor</Label>
                <Input
                  id="supplier_code"
                  name="supplier_code"
                  value={formData.supplier_code}
                  onChange={handleInputChange}
                  placeholder="Código interno del proveedor"
                />
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