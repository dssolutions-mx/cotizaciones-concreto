'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

interface AddMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plantId?: string;
}

export default function AddMaterialModal({ isOpen, onClose, onSuccess, plantId }: AddMaterialModalProps) {
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
    supplier_id: '',
    aggregate_type: '',
    aggregate_size: '',
    aggregate_lithology: '',
    aggregate_extraction: '',
    is_active: true,
    notes: ''
  });

  // New: state to build codes per Quality protocol
  const [builderState, setBuilderState] = useState({
    // Aggregates
    aggregateType: 'GR' as 'AR' | 'GR',
    aggregateSize: '' as '' | string, // 1-9
    lithology: '' as '' | 'A' | 'C' | 'B' | 'G' | 'R' | 'D',
    extraction: '' as '' | 'T' | 'R' | 'M' | 'L',
    providerNumber: '' as '' | string, // 1-9

    // Cement
    cementProviderLetter: '' as '' | string, // A-Z single letter
    cementSpecification: '' as '' | string, // e.g. 40RS

    // Water
    waterProviderNumber: '' as '' | string, // 1-9

    // Additive
    additiveSpecificCode: '' as '' | string,

    // Control
    autoBuild: true,
  });

  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; provider_number: number; provider_letter?: string; internal_code?: string }>>([]);

  const [codeError, setCodeError] = useState<string | null>(null);

  const categories = [
    { value: 'cemento', label: 'Cemento' },
    { value: 'agregado', label: 'Agregado' },
    { value: 'aditivo', label: 'Aditivo' },
    { value: 'agua', label: 'Agua' }
  ];

  // Options for the protocol
  const aggregateTypes = [
    { value: 'AR', label: 'Arena' },
    { value: 'GR', label: 'Grava' }
  ];

  const lithologyOptions = [
    { value: 'A', label: 'Andesita' },
    { value: 'C', label: 'Caliza' },
    { value: 'B', label: 'Basalto' },
    { value: 'G', label: 'Granito' },
    { value: 'R', label: 'Riolita' },
    { value: 'D', label: 'Dolomita' }
  ];

  const extractionOptions = [
    { value: 'T', label: 'Triturado' },
    { value: 'R', label: 'De río' },
    { value: 'M', label: 'De mina' },
    { value: 'L', label: 'Río + lavado' }
  ];

  const sizeOptions = useMemo(() => Array.from({ length: 9 }, (_, i) => String(i + 1)), []);
  const providerNumbers = sizeOptions; // 1..9 (solo para fallback antiguo, ya no se usa para tamaño)

  // Fetch suppliers for the current plant
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const data = await recipeService.getSuppliers(plantId);
        setSuppliers(data);
      } catch (e) {
        console.error('Error fetching suppliers', e);
      }
    };
    if (isOpen) fetchSuppliers();
  }, [isOpen, plantId]);

  // Keep builder state in sync with selected supplier
  useEffect(() => {
    const supplier = suppliers.find(s => s.id === formData.supplier_id);
    if (!supplier) return;
    setBuilderState(prev => ({
      ...prev,
      providerNumber: String(supplier.provider_number || ''),
      waterProviderNumber: String(supplier.provider_number || ''),
      cementProviderLetter: (supplier.provider_letter || '').toUpperCase(),
    }));
  }, [formData.supplier_id, suppliers, formData.category]);

  const units = [
    { value: 'kg', label: 'Kilogramos (kg)' },
    { value: 'm3', label: 'Metros cúbicos (m³)' },
    { value: 'l', label: 'Litros (L)' },
    { value: 'ton', label: 'Toneladas (ton)' }
  ];

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

    if (name === 'category') {
      // Reset builder fields when category changes
      setBuilderState(prev => ({
        ...prev,
        aggregateType: 'GR',
        aggregateSize: '',
        lithology: '',
        extraction: '',
        providerNumber: '',
        cementProviderLetter: '',
        cementSpecification: '',
        waterProviderNumber: '',
        additiveSpecificCode: '',
      }));
      // Clear protocol persistence fields too
      setFormData(prev => ({
        ...prev,
        supplier_id: '',
        aggregate_type: '',
        aggregate_size: '',
        aggregate_lithology: '',
        aggregate_extraction: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!plantId) {
      showError('Debe seleccionar una planta');
      return;
    }

    if (!formData.material_name || !formData.material_code) {
      showError('El nombre y código del material son obligatorios');
      return;
    }

    if (formData.material_code.length > 6) {
      showError('El código del material no debe exceder 6 caracteres');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        ...formData,
        plant_id: plantId,
        density: formData.density ? parseFloat(formData.density) : undefined,
        specific_gravity: formData.specific_gravity ? parseFloat(formData.specific_gravity) : undefined,
        absorption_rate: formData.absorption_rate ? parseFloat(formData.absorption_rate) : undefined,
        fineness_modulus: formData.fineness_modulus ? parseFloat(formData.fineness_modulus) : undefined,
        supplier_id: formData.supplier_id || undefined,
      };

      // Only send aggregate protocol fields for aggregates
      if (formData.category === 'agregado') {
        payload.aggregate_type = (formData.aggregate_type as 'AR' | 'GR') || undefined;
        payload.aggregate_size = formData.aggregate_size ? parseInt(formData.aggregate_size) : undefined;
        payload.aggregate_lithology = (formData.aggregate_lithology as 'A' | 'C' | 'B' | 'G' | 'R' | 'D') || undefined;
        payload.aggregate_extraction = (formData.aggregate_extraction as 'T' | 'R' | 'M' | 'L') || undefined;
      } else {
        payload.aggregate_type = undefined;
        payload.aggregate_size = undefined;
        payload.aggregate_lithology = undefined;
        payload.aggregate_extraction = undefined;
      }

      await recipeService.createMaterial(payload);

      showSuccess('Material creado exitosamente');
      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating material:', error);
      showError('Error al crear el material');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
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
      supplier_id: '',
      aggregate_type: '',
      aggregate_size: '',
      aggregate_lithology: '',
      aggregate_extraction: '',
      is_active: true,
      notes: ''
    });
    setBuilderState({
      aggregateType: 'GR',
      aggregateSize: '',
      lithology: '',
      extraction: '',
      providerNumber: '',
      cementProviderLetter: '',
      cementSpecification: '',
      waterProviderNumber: '',
      additiveSpecificCode: '',
      autoBuild: true,
    });
    setCodeError(null);
  };

  // Build code automatically based on the selected category and builder state
  useEffect(() => {
    if (!builderState.autoBuild) return;

    let code = '';
    if (formData.category === 'agregado') {
      const { aggregateType, aggregateSize, lithology, extraction, providerNumber } = builderState;
      if (aggregateType && aggregateSize && lithology && extraction && providerNumber) {
        code = `${aggregateType}${aggregateSize}${lithology}${extraction}${providerNumber}`.toUpperCase();
      }
      // persist protocol fields in formData for saving
      setFormData(prev => ({
        ...prev,
        aggregate_type: aggregateType || '',
        aggregate_size: aggregateSize || '',
        aggregate_lithology: lithology || '',
        aggregate_extraction: extraction || ''
      }));
    } else if (formData.category === 'agua') {
      const { waterProviderNumber } = builderState;
      if (waterProviderNumber) code = `A${waterProviderNumber}`.toUpperCase();
    } else if (formData.category === 'cemento') {
      const { cementProviderLetter, cementSpecification } = builderState;
      if (cementProviderLetter || cementSpecification) {
        code = `${(cementProviderLetter || '').toUpperCase()}${(cementSpecification || '').toUpperCase()}`;
      }
    } else if (formData.category === 'aditivo') {
      const { additiveSpecificCode } = builderState;
      if (additiveSpecificCode) code = additiveSpecificCode.toUpperCase();
    }

    if (code && code.length > 6) {
      setCodeError('El código no debe exceder 6 caracteres');
    } else {
      setCodeError(null);
    }

    setFormData(prev => ({ ...prev, material_code: code }));
  }, [builderState, formData.category]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Material</DialogTitle>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="material_code">Código del Material *</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto_build"
                    checked={builderState.autoBuild}
                    onCheckedChange={(checked) => setBuilderState(prev => ({ ...prev, autoBuild: checked }))}
                  />
                  <Label htmlFor="auto_build" className="text-sm">Generar automáticamente</Label>
                </div>
              </div>

              <Input
                id="material_code"
                name="material_code"
                value={formData.material_code}
                onChange={(e) => {
                  // Allow manual override when autoBuild is off
                  const value = e.target.value.toUpperCase();
                  setFormData(prev => ({ ...prev, material_code: value }));
                }}
                placeholder="Máx. 6 caracteres"
                maxLength={6}
                required
                disabled={builderState.autoBuild}
              />
              {codeError && (
                <p className="text-sm text-red-600 mt-1">{codeError}</p>
              )}
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

            {/* Protocol-driven builder by category */}
            {builderState.autoBuild && (
              <div className="md:col-span-2 space-y-4">
                {formData.category === 'agregado' && (
                  <div className="rounded-md border p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div>
                        <Label>Tipo</Label>
                        <Select
                          value={builderState.aggregateType}
                          onValueChange={(value) => setBuilderState(prev => ({ ...prev, aggregateType: value as 'AR' | 'GR' }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {aggregateTypes.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tamaño</Label>
                        <Input
                          type="number"
                          min={1}
                          value={builderState.aggregateSize}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, '');
                            setBuilderState(prev => ({ ...prev, aggregateSize: v }));
                          }}
                          placeholder="Ej: 4"
                        />
                      </div>
                      <div>
                        <Label>Litología</Label>
                        <Select
                          value={builderState.lithology}
                          onValueChange={(value) => setBuilderState(prev => ({ ...prev, lithology: value as typeof builderState.lithology }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {lithologyOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Extracción</Label>
                        <Select
                          value={builderState.extraction}
                          onValueChange={(value) => setBuilderState(prev => ({ ...prev, extraction: value as typeof builderState.extraction }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {extractionOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Proveedor (número)</Label>
                        <Input value={builderState.providerNumber} placeholder="#" disabled />
                      </div>
                      
                    </div>

                    <div className="flex items-center space-x-2 text-sm">
                      <span className="font-semibold">Código sugerido:</span>
                      <span className="font-mono bg-muted px-2 py-1 rounded">
                        {formData.material_code || '—'}
                      </span>
                    </div>
                  </div>
                )}

                {formData.category === 'agua' && (
                  <div className="rounded-md border p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label>Proveedor (número)</Label>
                        <Input value={builderState.waterProviderNumber} placeholder="#" disabled />
                      </div>
                      <div className="md:col-span-2 flex items-end">
                        <div className="text-sm">
                          Código: <span className="font-mono bg-muted px-2 py-1 rounded">{formData.material_code || 'A#'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {formData.category === 'cemento' && (
                  <div className="rounded-md border p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label>Letra proveedor</Label>
                        <Input
                          value={builderState.cementProviderLetter}
                          onChange={(e) => {
                            const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
                            setBuilderState(prev => ({ ...prev, cementProviderLetter: v }));
                          }}
                          placeholder="Ej: X"
                          maxLength={1}
                        />
                      </div>
                      <div>
                        <Label>Especificación del cemento</Label>
                        <Input
                          value={builderState.cementSpecification}
                          onChange={(e) => {
                            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
                            setBuilderState(prev => ({ ...prev, cementSpecification: v }));
                          }}
                          placeholder="Ej: 40RS"
                          maxLength={5}
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="text-sm">
                          Código: <span className="font-mono bg-muted px-2 py-1 rounded">{formData.material_code || 'X40RS'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {formData.category === 'aditivo' && (
                  <div className="rounded-md border p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label>Código específico</Label>
                        <Input
                          value={builderState.additiveSpecificCode}
                          onChange={(e) => {
                            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                            setBuilderState(prev => ({ ...prev, additiveSpecificCode: v }));
                          }}
                          placeholder="Ej: SP1"
                          maxLength={6}
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end">
                        <div className="text-sm">
                          Código: <span className="font-mono bg-muted px-2 py-1 rounded">{formData.material_code || 'XXX'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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

          {/* Supplier Information (normalized) */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Información del Proveedor</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Proveedor</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}
                >
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
                  Creando...
                </>
              ) : (
                'Crear Material'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 