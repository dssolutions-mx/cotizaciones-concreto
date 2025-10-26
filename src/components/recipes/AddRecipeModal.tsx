/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Search, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import EnhancedPlantSelector from '@/components/plants/EnhancedPlantSelector';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import { recipeService } from '@/lib/supabase/recipes';
import { Material, NewRecipeData, RecipeSpecification, MaterialSelection, ReferenceMaterialSelection } from '@/types/recipes';
import { generateRecipeCode } from '@/lib/calculator/calculations';
import { Button } from '@/components/ui/button';

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuthBridge();
  const { userAccess, isGlobalAdmin, currentPlant } = usePlantContext();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialSelection[]>([]);
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Plant selection state for recipe creation
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(() => {
    return plantAwareDataService.getDefaultPlantForCreation({
      userAccess,
      isGlobalAdmin,
      currentPlantId: currentPlant?.id || null
    });
  });
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string | null>(
    currentPlant?.business_unit_id || null
  );

  const [formData, setFormData] = useState({
    recipeCode: '',
    newSystemCode: '',
    recipeType: 'FC' as 'FC' | 'MR',
    strengthFc: '',
    ageUnit: 'D' as 'D' | 'H',
    ageDays: '28',
    ageHours: '',
    placementType: 'D',
    maxAggregateSize: '',
    slump: '',
    applicationType: 'standard' as const,
    hasWaterproofing: false,
    performanceGrade: 'standard' as const,
    notes: '',
  });

  // Dynamic SSS map for selected materials (by material_id)
  const [referenceSSS, setReferenceSSS] = useState<Record<string, number | undefined>>({});

  // Variant governance state
  const [variantDecisionOpen, setVariantDecisionOpen] = useState(false);
  const [sameSpecCandidates, setSameSpecCandidates] = useState<Array<{ id: string; recipe_code: string; age_days: number | null; age_hours: number | null }>>([]);
  const [decisionAction, setDecisionAction] = useState<'create' | 'update'>('create');
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [overrideCode, setOverrideCode] = useState<string>('');
  const [pendingPayload, setPendingPayload] = useState<{
    specification: RecipeSpecification;
    validMaterials: MaterialSelection[];
    refMaterials: ReferenceMaterialSelection[];
    intendedCode: string;
  } | null>(null);

  // Prefill SSS with selected dry quantities when a new material is added
  useEffect(() => {
    setReferenceSSS(prev => {
      const next = { ...prev };
      selectedMaterials.forEach((m) => {
        if (next[m.material_id] === undefined && typeof m.quantity === 'number' && isFinite(m.quantity)) {
          next[m.material_id] = m.quantity;
        }
      });
      // Remove entries for materials no longer selected
      Object.keys(next).forEach((id) => {
        if (!selectedMaterials.find(m => m.material_id === id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [selectedMaterials]);

  // Load materials when plant changes
  useEffect(() => {
    if (selectedPlantId) {
      loadMaterials();
    }
  }, [selectedPlantId]);

  const loadMaterials = async () => {
    try {
      const materialsData = await recipeService.getMaterials(selectedPlantId || undefined);
      setMaterials(materialsData);
    } catch (error) {
      console.error('Error loading materials:', error);
      setError('Error al cargar los materiales');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate plant selection
    if (!selectedPlantId) {
      setError('Debes seleccionar una planta para crear la receta');
      return;
    }

    // Validate materials selection
    if (selectedMaterials.length === 0) {
      setError('Debes seleccionar al menos un material para la receta');
      return;
    }

    // Validate user can create in selected plant
    if (!plantAwareDataService.canCreateInPlant(selectedPlantId, {
      userAccess,
      isGlobalAdmin,
      currentPlantId: currentPlant?.id || null
    })) {
      setError('No tienes permisos para crear recetas en la planta seleccionada');
      return;
    }

    setIsSubmitting(true);

    try {
      const specification: RecipeSpecification = {
        strength_fc: parseFloat(formData.strengthFc),
        age_days: formData.ageUnit === 'D' ? parseInt(formData.ageDays) : null as unknown as number,
        age_hours: formData.ageUnit === 'H' && formData.ageHours ? parseInt(formData.ageHours) : undefined,
        placement_type: formData.placementType,
        max_aggregate_size: parseFloat(formData.maxAggregateSize),
        slump: parseFloat(formData.slump),
        application_type: formData.applicationType,
        has_waterproofing: formData.hasWaterproofing,
        performance_grade: formData.performanceGrade,
        recipe_type: formData.recipeType
      };

      // Prepare reference materials (dynamic SSS only): includes any selected material with SSS provided
      const refMaterials: ReferenceMaterialSelection[] = [];
      selectedMaterials.forEach(sel => {
        const val = referenceSSS[sel.material_id];
        if (typeof val === 'number' && isFinite(val) && val > 0) {
          const mat = materials.find(m => m.id === sel.material_id);
          if (mat) {
            // For DB reference table, we send material_type label; if material_id path is needed later, we can extend API
            const material_type = (mat.material_code || mat.category || 'MATERIAL').toUpperCase();
            refMaterials.push({ material_type: material_type as any, sss_value: val });
          }
        }
      });

      // Only include materials with valid positive quantities
      const validMaterials = selectedMaterials.filter(m => Number.isFinite(m.quantity) && (m.quantity as number) > 0);

      // Compute canonical ARKIK codes up-front and set as recipe_code
      const strength = Math.round(parseFloat(formData.strengthFc));
      const ageVal = formData.ageUnit === 'D' ? parseInt(formData.ageDays || '0', 10) : parseInt(formData.ageHours || '0', 10);
      const slump = Math.round(parseFloat(formData.slump));
      const tmaFactor = parseFloat(formData.maxAggregateSize) >= 40 ? '4' : '2';
      const fcCode = String(strength).padStart(3, '0');
      const edadCode = String(ageVal).padStart(2, '0');
      const revCode = String(slump).padStart(2, '0');
      const coloc = formData.placementType; // 'D' | 'B'
      const prefix = formData.recipeType === 'MR' ? 'PAV' : '5';

      // Variante detection by selected materials (PCE)
      const selectedRows = selectedMaterials.map(sm => materials.find(m => m.id === sm.material_id)).filter(Boolean) as Material[];
      const hasPCE = selectedRows.some(m => (m.material_name || '').toUpperCase().includes('PCE'));
      const variante = hasPCE ? 'PCE' : '000';

      const intendedCode = `${prefix}-${fcCode}-${tmaFactor}-B-${edadCode}-${revCode}-${coloc}-2-${variante}`;

      // Preflight: detect same-spec existing variants in this plant and prompt user decision
      let candidates: Array<{ id: string; recipe_code: string; age_days: number | null; age_hours: number | null }> = [];
      try {
        const { data: baseCandidates } = await supabase
          .from('recipes')
          .select('id, recipe_code, age_days, age_hours')
          .eq('plant_id', selectedPlantId)
          .eq('strength_fc', specification.strength_fc)
          .eq('placement_type', specification.placement_type)
          .eq('max_aggregate_size', specification.max_aggregate_size)
          .eq('slump', specification.slump);
        const isDays = formData.ageUnit === 'D';
        candidates = (baseCandidates || []).filter(r => {
          if (isDays) {
            return (r.age_days === specification.age_days) && (r.age_hours === null || r.age_hours === 0);
          }
          return (r.age_hours === specification.age_hours) && (r.age_days === null || r.age_days === 0);
        });

        // Also check for recipe_code collision even if specs differ
        const { data: codeCollision } = await supabase
          .from('recipes')
          .select('id, recipe_code, age_days, age_hours')
          .eq('plant_id', selectedPlantId)
          .eq('recipe_code', intendedCode)
          .limit(1)
          .maybeSingle?.() as any;
        if (codeCollision && !candidates.find(c => c.id === codeCollision.id)) {
          candidates.push(codeCollision);
        }
      } catch (_) {
        // ignore preflight errors, proceed as if none found
      }

      if (candidates.length > 0) {
        setSameSpecCandidates(candidates);
        setPendingPayload({ specification, validMaterials, refMaterials, intendedCode });
        setOverrideCode(intendedCode);
        setVariantDecisionOpen(true);
        setIsSubmitting(false);
        return;
      }

      // No same-spec candidates → create new recipe with intended ARKIK code as canonical recipe_code
      const recipeData: NewRecipeData = {
        recipe_code: intendedCode,
        new_system_code: intendedCode,
        specification,
        materials: validMaterials,
        reference_materials: refMaterials.length > 0 ? refMaterials : undefined,
        notes: formData.notes || undefined,
        plant_id: selectedPlantId
      };

      await recipeService.createRecipeWithSpecifications(recipeData);

      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        recipeCode: '',
        newSystemCode: '',
        recipeType: 'FC',
        strengthFc: '',
        ageUnit: 'D',
        ageDays: '28',
        ageHours: '',
        placementType: 'D',
        maxAggregateSize: '',
        slump: '',
        applicationType: 'standard',
        hasWaterproofing: false,
        performanceGrade: 'standard',
        notes: '',
      });
      setSelectedMaterials([]);
      setReferenceSSS({});
      
    } catch (err: any) {
      setError(err.message || 'Error al crear la receta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecisionConfirm = async () => {
    if (!pendingPayload || !selectedPlantId) {
      setVariantDecisionOpen(false);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const { specification, validMaterials, refMaterials, intendedCode } = pendingPayload;
      if (decisionAction === 'update' && selectedExistingId) {
        // Option A: Update existing variant (rename code if provided) and create a new version with materials
        const targetCode = (overrideCode || intendedCode).trim();
        if (targetCode) {
          await supabase.from('recipes').update({ recipe_code: targetCode, new_system_code: targetCode }).eq('id', selectedExistingId);
        }
        // Create new version with materials
        const newVersion = await recipeService.createRecipeVersion(
          selectedExistingId,
          (validMaterials.map(m => ({ material_id: m.material_id, quantity: m.quantity as number, unit: m.unit })) as any),
          formData.notes || undefined,
          targetCode
        );
        // If we have reference materials and version id, attach them
        // Attempt to fetch current version id (the RPC should return it, but fallback to query)
        let versionId: string | undefined = (newVersion as any)?.id;
        if (!versionId) {
          const { data: currentVersion } = await supabase
            .from('recipe_versions')
            .select('id')
            .eq('recipe_id', selectedExistingId)
            .eq('is_current', true)
            .single();
          versionId = currentVersion?.id;
        }
        if (versionId && refMaterials.length > 0) {
          const rows = refMaterials.map(rm => ({
            recipe_version_id: versionId!,
            material_type: rm.material_type,
            sss_value: rm.sss_value
          }));
          await supabase.from('recipe_reference_materials').insert(rows);
        }
      } else {
        // Option B: Create new variant (force new recipe row even if same specs exist)
        const targetCode = (overrideCode || intendedCode).trim();
        // Insert recipe row
        const { data: newRecipe, error: recipeErr } = await supabase
          .from('recipes')
          .insert({
            recipe_code: targetCode,
            strength_fc: specification.strength_fc,
            age_days: specification.age_days,
            age_hours: specification.age_hours ?? null,
            placement_type: specification.placement_type,
            max_aggregate_size: specification.max_aggregate_size,
            slump: specification.slump,
            application_type: specification.application_type,
            has_waterproofing: specification.has_waterproofing,
            performance_grade: specification.performance_grade,
            plant_id: selectedPlantId,
            created_by: profile?.id || null
          })
          .select('*')
          .single();
        if (recipeErr || !newRecipe) throw recipeErr || new Error('No se pudo crear la receta');

        // Create initial version
        const { data: version, error: versionErr } = await supabase
          .from('recipe_versions')
          .insert({
            recipe_id: newRecipe.id,
            version_number: 1,
            effective_date: new Date().toISOString(),
            is_current: true,
            notes: specification.recipe_type || null
          })
          .select('*')
          .single();
        if (versionErr || !version) throw versionErr || new Error('No se pudo crear la versión de la receta');

        // Insert material quantities
        if (validMaterials.length > 0) {
          const materialRows = validMaterials.map(vm => ({
            recipe_version_id: version.id,
            material_id: vm.material_id,
            material_type: vm.unit || 'MATERIAL',
            quantity: vm.quantity as number,
            unit: vm.unit
          }));
          const { error: mqErr } = await supabase.from('material_quantities').insert(materialRows);
          if (mqErr) throw mqErr;
        }
        // Insert SSS reference materials if provided
        if (refMaterials.length > 0) {
          const refRows = refMaterials.map(rm => ({
            recipe_version_id: version.id,
            material_type: rm.material_type,
            sss_value: rm.sss_value
          }));
          const { error: refErr } = await supabase.from('recipe_reference_materials').insert(refRows);
          if (refErr) throw refErr;
        }
      }

      setVariantDecisionOpen(false);
      setPendingPayload(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al procesar la decisión de variante');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const addMaterial = (material: Material) => {
    const existingIndex = selectedMaterials.findIndex(m => m.material_id === material.id);
    
    if (existingIndex >= 0) {
      // Update existing material quantity
      const updated = [...selectedMaterials];
      updated[existingIndex] = {
        ...updated[existingIndex],
        // Keep quantity as-is if not set yet (NaN). If it's a number, increment.
        quantity: Number.isFinite(updated[existingIndex].quantity)
          ? (updated[existingIndex].quantity + 1)
          : Number.NaN
      };
      setSelectedMaterials(updated);
    } else {
      // Add new material
      setSelectedMaterials(prev => [...prev, {
        material_id: material.id,
        // Start empty for better UX (no spinners, user can paste/type freely)
        quantity: Number.NaN,
        unit: material.unit_of_measure
      }]);
    }
  };

  const updateMaterialQuantity = (materialId: string, quantity: number) => {
    const sanitized = Number.isFinite(quantity) && quantity >= 0 ? quantity : Number.NaN;
    setSelectedMaterials(prev =>
      prev.map(m =>
        m.material_id === materialId
          ? { ...m, quantity: sanitized }
          : m
      )
    );
  };

  const handleQuantityInputChange = (materialId: string, raw: string) => {
    // Normalize decimal separator and parse
    const value = raw.replace(/,/g, '.').trim();
    if (value === '') {
      updateMaterialQuantity(materialId, Number.NaN);
      return;
    }
    const parsed = parseFloat(value);
    updateMaterialQuantity(materialId, parsed);
  };

  const preventEnterKey: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const removeMaterial = (materialId: string) => {
    setSelectedMaterials(prev => prev.filter(m => m.material_id !== materialId));
  };

  const filteredMaterials = materials.filter((material) => {
    const name = (material.material_name || '').toLowerCase();
    const code = (material.material_code || '').toLowerCase();
    const category = (material.category || '').toLowerCase();
    const term = (searchTerm || '').toLowerCase();
    return name.includes(term) || code.includes(term) || category.includes(term);
  });

  const getMaterialName = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    return material?.material_name || 'Material desconocido';
  };

  const proceedWithPayload = async (createNewVariant: boolean) => {
    if (!pendingPayload || !selectedPlantId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const { specification, validMaterials, refMaterials, intendedCode } = pendingPayload;
      const targetCode = (overrideCode || intendedCode).trim();

      if (createNewVariant) {
        // Option B: Create new variant (force new recipe row even if same specs exist)
        const { data: newRecipe, error: recipeErr } = await supabase
          .from('recipes')
          .insert({
            recipe_code: targetCode,
            strength_fc: specification.strength_fc,
            age_days: specification.age_days,
            age_hours: specification.age_hours ?? null,
            placement_type: specification.placement_type,
            max_aggregate_size: specification.max_aggregate_size,
            slump: specification.slump,
            application_type: specification.application_type,
            has_waterproofing: specification.has_waterproofing,
            performance_grade: specification.performance_grade,
            plant_id: selectedPlantId,
            created_by: profile?.id || null
          })
          .select('*')
          .single();
        if (recipeErr || !newRecipe) throw recipeErr || new Error('No se pudo crear la receta');

        // Create initial version
        const { data: version, error: versionErr } = await supabase
          .from('recipe_versions')
          .insert({
            recipe_id: newRecipe.id,
            version_number: 1,
            effective_date: new Date().toISOString(),
            is_current: true,
            notes: specification.recipe_type || null
          })
          .select('*')
          .single();
        if (versionErr || !version) throw versionErr || new Error('No se pudo crear la versión de la receta');

        // Insert material quantities
        if (validMaterials.length > 0) {
          const materialRows = validMaterials.map(vm => ({
            recipe_version_id: version.id,
            material_id: vm.material_id,
            material_type: vm.unit || 'MATERIAL',
            quantity: vm.quantity as number,
            unit: vm.unit
          }));
          const { error: mqErr } = await supabase.from('material_quantities').insert(materialRows);
          if (mqErr) throw mqErr;
        }
        // Insert SSS reference materials if provided
        if (refMaterials.length > 0) {
          const refRows = refMaterials.map(rm => ({
            recipe_version_id: version.id,
            material_type: rm.material_type,
            sss_value: rm.sss_value
          }));
          const { error: refErr } = await supabase.from('recipe_reference_materials').insert(refRows);
          if (refErr) throw refErr;
        }
      } else {
        // Option A: Update existing variant (rename code if provided) and create a new version with materials
        if (targetCode) {
          await supabase.from('recipes').update({ recipe_code: targetCode, new_system_code: targetCode }).eq('id', selectedExistingId);
        }
        // Create new version with materials
        const newVersion = await recipeService.createRecipeVersion(
          selectedExistingId!,
          (validMaterials.map(m => ({ material_id: m.material_id, quantity: m.quantity as number, unit: m.unit })) as any),
          formData.notes || undefined,
          targetCode
        );
        // If we have reference materials and version id, attach them
        // Attempt to fetch current version id (the RPC should return it, but fallback to query)
        let versionId: string | undefined = (newVersion as any)?.id;
        if (!versionId) {
          const { data: currentVersion } = await supabase
            .from('recipe_versions')
            .select('id')
            .eq('recipe_id', selectedExistingId!)
            .eq('is_current', true)
            .single();
          versionId = currentVersion?.id;
        }
        if (versionId && refMaterials.length > 0) {
          const rows = refMaterials.map(rm => ({
            recipe_version_id: versionId!,
            material_type: rm.material_type,
            sss_value: rm.sss_value
          }));
          await supabase.from('recipe_reference_materials').insert(rows);
        }
      }

      setVariantDecisionOpen(false);
      setPendingPayload(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al procesar la decisión de variante');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Crear Nueva Receta con Especificaciones</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plant Selection */}
          <div>
            <EnhancedPlantSelector
              mode="CREATE"
              selectedPlantId={selectedPlantId}
              selectedBusinessUnitId={selectedBusinessUnitId}
              onPlantChange={setSelectedPlantId}
              onBusinessUnitChange={setSelectedBusinessUnitId}
              required
              showLabel
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recipe Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de Receta *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="recipeCode"
                  value={formData.recipeCode}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: FC150-14D-28D"
                />
                <button type="button" onClick={() => {
                  const strength = parseFloat(formData.strengthFc);
                  const slump = parseFloat(formData.slump);
                  const ageVal = formData.ageUnit === 'D' ? parseInt(formData.ageDays || '0', 10) : parseInt(formData.ageHours || '0', 10);
                  if (!Number.isNaN(strength) && !Number.isNaN(slump) && ageVal > 0) {
                    const code = generateRecipeCode(formData.recipeType as any, strength, slump, formData.placementType, ageVal, formData.ageUnit);
                    setFormData(prev => ({ ...prev, recipeCode: code }));
                  }
                }} className="px-2 py-1 text-xs bg-gray-100 border rounded hover:bg-gray-200">Usar sugerido</button>
              </div>
            </div>

            {/* Código Nuevo Sistema: ahora se rellena automáticamente con el Código de Receta */}

            {/* Recipe Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Receta *
              </label>
              <select
                name="recipeType"
                value={formData.recipeType}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="FC">Receta de Concreto (FC)</option>
                <option value="MR">Receta de Mortero (MR)</option>
              </select>
            </div>

            {/* Strength */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resistencia f'c (Kg/cm2) *
              </label>
              <input
                type="number"
                name="strengthFc"
                value={formData.strengthFc}
                onChange={handleInputChange}
                required
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="25"
              />
            </div>

            {/* Age Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de Edad *</label>
              <select
                name="ageUnit"
                value={formData.ageUnit}
                onChange={(e) => {
                  const unit = e.target.value as 'D' | 'H';
                  setFormData(prev => ({ ...prev, ageUnit: unit, ...(unit === 'D' ? { ageHours: '' } : { }) }));
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="D">Días</option>
                <option value="H">Horas</option>
              </select>
            </div>

            {/* Age Value based on unit */}
            {formData.ageUnit === 'D' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Edad (días) *</label>
                <input
                  type="number"
                  name="ageDays"
                  value={formData.ageDays}
                  onChange={handleInputChange}
                  required
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Edad (horas) *</label>
                <input
                  type="number"
                  name="ageHours"
                  value={formData.ageHours}
                  onChange={handleInputChange}
                  required
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: 12, 18"
                />
              </div>
            )}

            {/* Placement Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Colocación *
              </label>
              <select
                name="placementType"
                value={formData.placementType}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="D">Directa</option>
                <option value="B">Bombeado</option>
              </select>
            </div>

            {/* Max Aggregate Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tamaño Máximo de Agregado (mm) *
              </label>
              <input
                type="number"
                name="maxAggregateSize"
                value={formData.maxAggregateSize}
                onChange={handleInputChange}
                required
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="20"
              />
            </div>

            {/* Slump */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Revenimiento (cm) *
              </label>
              <input
                type="number"
                name="slump"
                value={formData.slump}
                onChange={handleInputChange}
                required
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="10"
              />
            </div>

            {/* Tipo de Aplicación / Grado de Rendimiento / Impermeabilizante: se fijan por defecto como en la calculadora */}
          </div>

          {/* Preview helper: Suggested code and ARKIK codes */}
          {(() => {
            const strength = parseFloat(formData.strengthFc);
            const slump = parseFloat(formData.slump);
            const placement = formData.placementType;
            const ageUnit = formData.ageUnit;
            const ageVal = ageUnit === 'D' ? parseInt(formData.ageDays || '0', 10) : parseInt(formData.ageHours || '0', 10);
            const canPreview = !Number.isNaN(strength) && !Number.isNaN(slump) && ageVal > 0 && (placement === 'D' || placement === 'B');
            if (!canPreview) return null;

            const code = generateRecipeCode(formData.recipeType as any, strength, slump, placement, ageVal, ageUnit);

            // Detect variante by additives in selected materials
            const selectedRows = selectedMaterials.map(sm => materials.find(m => m.id === sm.material_id)).filter(Boolean) as Material[];
            const hasPCE = selectedRows.some(m => (m.material_name || '').toUpperCase().includes('PCE'));
            const variante = hasPCE ? 'PCE' : '000';

            const fcCode = String(Math.round(strength)).padStart(3, '0');
            const edadCode = String(ageVal).padStart(2, '0');
            const revCode = String(Math.round(slump)).padStart(2, '0');
            const tmaFactor = parseFloat(formData.maxAggregateSize) >= 40 ? '4' : '2';
            const coloc = placement; // 'D' | 'B'
            const prefix = formData.recipeType === 'MR' ? 'PAV' : '5';
            const typeCode = 'B';
            const numSeg = '2';
            const arkikLong = `${prefix}-${fcCode}-${tmaFactor}-${typeCode}-${edadCode}-${revCode}-${coloc}-${numSeg}-${variante}`;
            const arkikShort = `${fcCode}${edadCode}${tmaFactor}${revCode}${coloc}`;

            return (
              <div className="mt-2 p-3 bg-gray-50 border rounded">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-600">Código sugerido</div>
                    <div className="font-mono font-semibold">{code}</div>
                  </div>
                  <div className="text-right md:text-left">
                    <div className="text-gray-600">ARKIK Long</div>
                    <div className="font-mono font-semibold break-all">{arkikLong}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">ARKIK Short</div>
                    <div className="font-mono font-semibold">{arkikShort}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Edad</div>
                    <div className="font-mono">{ageVal}{ageUnit}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Material Selection */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Materiales</h3>
              <button
                type="button"
                onClick={() => setShowMaterialSelector(!showMaterialSelector)}
                className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600"
              >
                {showMaterialSelector ? <EyeOff size={16} /> : <Eye size={16} />}
                {showMaterialSelector ? 'Ocultar Selector' : 'Mostrar Selector'}
              </button>
            </div>

            {/* Selected Materials */}
            {selectedMaterials.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Materiales Seleccionados:</h4>
                <div className="space-y-2">
                  {selectedMaterials.map((material) => (
                    <div key={material.material_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="flex-1">{getMaterialName(material.material_id)}</span>
                      <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={Number.isFinite(material.quantity) ? String(material.quantity) : ''}
                              onChange={(e) => handleQuantityInputChange(material.material_id, e.target.value)}
                              onKeyDown={preventEnterKey}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Cantidad"
                            />
                        <span className="text-sm text-gray-600">{material.unit}</span>
                        <button
                          type="button"
                          onClick={() => removeMaterial(material.material_id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Material Selector */}
            {showMaterialSelector && (
              <div className="border rounded-lg p-4">
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Buscar materiales..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                  {filteredMaterials.map((material) => (
                    <div
                      key={material.id}
                      className="p-2 border rounded cursor-pointer hover:bg-blue-50"
                      onClick={() => addMaterial(material)}
                    >
                      <div className="font-medium text-sm">{material.material_name}</div>
                      <div className="text-xs text-gray-600">
                        {material.category} • {material.unit_of_measure}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reference Materials */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Materiales de Referencia (SSS)</h3>
            </div>

            <div className="border rounded-lg p-4">
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800">
                  Los materiales agregados arriba representan cantidades en estado seco para propósitos de costeo.
                  Esta sección captura los equivalentes en estado SSS (Saturado Superficie Seca) usados para codificación ARKIK y referencias técnicas.
                </div>

                {/* Dynamic SSS for selected materials */}
                {selectedMaterials.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">SSS por material seleccionado</h4>
                    <div className="space-y-2">
                      {selectedMaterials.map((sel) => {
                        const mat = materials.find(m => m.id === sel.material_id);
                        if (!mat) return null;
                        const isLiquid = mat.category === 'agua' || mat.category === 'aditivo';
                        const unit = isLiquid ? 'L/m³' : 'kg/m³';
                        const isWater = mat.category === 'agua';
                        return (
                          <div key={sel.material_id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                            <div className="text-sm">
                              <div className="font-medium">{mat.material_name}</div>
                              <div className="text-xs text-gray-600">Unidad SSS: {unit}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={(referenceSSS[sel.material_id] ?? '') as any}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/,/g, '.');
                                  const val = raw.trim() === '' ? undefined : parseFloat(raw);
                                  setReferenceSSS(prev => ({ ...prev, [sel.material_id]: val }));
                                }}
                                onKeyDown={preventEnterKey}
                                className={`w-28 px-2 py-1 border rounded text-sm border-gray-300`}
                                placeholder={Number.isFinite(sel.quantity) ? String(sel.quantity) : ''}
                              />
                              <span className="text-xs text-gray-600">{unit}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Los materiales añadidos en la sección de materiales aparecen aquí para capturar su equivalente en estado SSS (para ARKIK). Si no aplica, deja el campo vacío.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas / Observaciones
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Notas adicionales sobre la receta..."
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !selectedPlantId ||
                selectedMaterials.length === 0 ||
                selectedMaterials.every(m => !Number.isFinite(m.quantity) || (m.quantity as number) <= 0)
              }
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creando...' : 'Crear Receta'}
            </button>
          </div>
        </form>
      </div>

      {/* Variant Decision Modal */}
      {variantDecisionOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Gestión de Variantes</h3>
            
            {decisionAction === 'create' && (
              <div className="space-y-4 mb-6">
                <p className="text-sm text-gray-700">
                  Se encontraron {sameSpecCandidates.length} receta(s) con la misma especificación técnica:
                </p>
                <div className="space-y-2 bg-gray-50 p-3 rounded border">
                  {sameSpecCandidates.map((candidate: any) => (
                    <div key={candidate.id} className="flex justify-between items-center p-2 bg-white rounded border">
                      <div>
                        <div className="font-mono font-semibold">{candidate.recipe_code}</div>
                        <div className="text-xs text-gray-600">
                          Edad: {candidate.age_days ? `${candidate.age_days} días` : `${candidate.age_hours} horas`}
                        </div>
                        {candidate.master_recipes && (
                          <div className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded inline-block mt-1">
                            Maestro: {candidate.master_recipes.master_code}
                          </div>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSelectedExistingId(candidate.id);
                          setDecisionAction('update');
                        }}
                      >
                        Usar como variante
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-4">
                  <label className="text-sm font-medium block mb-2">¿Deseas crear una nueva variante?</label>
                  <input 
                    type="text" 
                    value={overrideCode} 
                    onChange={(e) => setOverrideCode(e.target.value)} 
                    placeholder="Dejar en blanco para usar código calculado"
                    className="w-full px-3 py-2 border rounded text-sm mb-3"
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => {
                        setDecisionAction('create');
                        setVariantDecisionOpen(false);
                        proceedWithPayload(true);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Crear como nueva variante
                    </Button>
                    <Button 
                      variant="secondary"
                      onClick={() => setVariantDecisionOpen(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {decisionAction === 'update' && selectedExistingId && (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  Vas a crear una nueva variante basada en la receta seleccionada. Puedes renombrar la variante:
                </p>
                <input 
                  type="text" 
                  value={overrideCode} 
                  onChange={(e) => setOverrideCode(e.target.value)} 
                  placeholder="Código de nueva variante (opcional)"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      proceedWithPayload(true);
                      setVariantDecisionOpen(false);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Crear variante
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={() => {
                      setDecisionAction('create');
                      setSelectedExistingId(null);
                    }}
                  >
                    Volver
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 