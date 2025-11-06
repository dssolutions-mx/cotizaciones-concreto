/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Search, AlertCircle, CheckCircle2, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseMasterAndVariantFromRecipeCode } from '@/lib/utils/masterRecipeUtils';
import { recipeService } from '@/lib/supabase/recipes';
import { toast } from 'sonner';
import type { Material } from '@/types/recipes';

interface AddRecipeModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type MasterRecipe = {
  id: string;
  master_code: string;
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  variant_count: number;
};

type CreationMode = 'variant' | 'new_master';

export const AddRecipeModalV2: React.FC<AddRecipeModalV2Props> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  
  // Step state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  
  // Creation mode
  const [creationMode, setCreationMode] = useState<CreationMode>('variant');
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);
  const [selectedMaster, setSelectedMaster] = useState<MasterRecipe | null>(null);
  const [availableMasters, setAvailableMasters] = useState<MasterRecipe[]>([]);
  const [masterSearch, setMasterSearch] = useState('');
  
  // Core specs
  const [specs, setSpecs] = useState({
    strengthFc: '',
    ageUnit: 'days' as 'days' | 'hours',
    ageDays: '28',
    ageHours: '',
    placementType: 'D',
    maxAggregateSize: '19',
    slump: '12',
    recipeType: 'FC' as 'FC' | 'MR',
    hasWaterproofing: false,
    notes: ''
  });
  
  // Materials - single list for both regular use and SSS reference
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<Array<{
    material_id: string;
    quantity_regular: string;
    quantity_sss: string;
    unit: string;
  }>>([]);
  const [materialSearch, setMaterialSearch] = useState('');
  
  // Code generation
  const [suggestedCode, setSuggestedCode] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false);
  
  // Validation & conflicts
  const [sameSpecRecipes, setSameSpecRecipes] = useState<any[]>([]);
  const [codeConflict, setCodeConflict] = useState<any | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMaterialDropdownOpen, setIsMaterialDropdownOpen] = useState(false);
  const materialPickerRef = useRef<HTMLDivElement | null>(null);
  const materialInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (materialPickerRef.current && !materialPickerRef.current.contains(event.target as Node)) {
        setIsMaterialDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const plantId = currentPlant?.id;

  // Load materials when plant changes
  useEffect(() => {
    if (plantId && isOpen) {
      loadMaterials();
      if (creationMode === 'variant') {
        loadCompatibleMasters();
      }
    }
  }, [plantId, isOpen, creationMode]);

  // Prefill specs when master is selected
  useEffect(() => {
    if (selectedMaster && creationMode === 'variant') {
      setSpecs({
        strengthFc: selectedMaster.strength_fc.toString(),
        ageUnit: selectedMaster.age_days ? 'days' : 'hours',
        ageDays: selectedMaster.age_days?.toString() || '28',
        ageHours: selectedMaster.age_hours?.toString() || '',
        placementType: selectedMaster.placement_type,
        maxAggregateSize: selectedMaster.max_aggregate_size.toString(),
        slump: selectedMaster.slump.toString(),
        recipeType: 'FC',
        hasWaterproofing: false,
        notes: ''
      });
    }
  }, [selectedMaster, creationMode]);

  // Generate code when specs change
  useEffect(() => {
    if (specs.strengthFc && specs.slump && specs.maxAggregateSize) {
      generateSuggestedCode();
    }
  }, [specs, creationMode, selectedMasterId]);

  // Re-check code collision live on step 3 when code changes
  useEffect(() => {
    const run = async () => {
      if (currentStep !== 3 || !plantId) return;
      await checkForConflicts();
    };
    run();
  }, [currentStep, useCustomCode, customCode, suggestedCode, plantId]);

  const loadMaterials = async () => {
    if (!plantId) return;
    
    try {
      const materialsData = await recipeService.getMaterials(plantId);
      console.log('Materials loaded:', materialsData.length);
      setMaterials(materialsData);
      
      if (materialsData.length === 0) {
        toast.error('No hay materiales activos para esta planta');
      }
    } catch (e: any) {
      console.error('Error loading materials:', e);
      toast.error(`Error cargando materiales: ${e.message || 'Unknown error'}`);
    }
  };


  const loadCompatibleMasters = async () => {
    if (!plantId) return;
    
    try {
      const { data, error } = await supabase
        .from('master_recipes')
        .select(`
          id,
          master_code,
          strength_fc,
          age_days,
          age_hours,
          placement_type,
          max_aggregate_size,
          slump,
          recipes!recipes_master_recipe_id_fkey(id)
        `)
        .eq('plant_id', plantId)
        .order('master_code');
      
      if (error) throw error;
      
      const enriched = (data || []).map((m: any) => ({
        ...m,
        variant_count: m.recipes?.length || 0
      }));
      
      setAvailableMasters(enriched);
    } catch (e: any) {
      toast.error('Error cargando maestros');
    }
  };

  const generateSuggestedCode = () => {
    if (!specs.strengthFc || !specs.slump || !specs.maxAggregateSize) return;
    
    const strength = Math.round(parseFloat(specs.strengthFc));
    const ageVal = specs.ageUnit === 'days' 
      ? parseInt(specs.ageDays || '0', 10) 
      : parseInt(specs.ageHours || '0', 10);
    const slump = Math.round(parseFloat(specs.slump));
    const tmaFactor = parseFloat(specs.maxAggregateSize) >= 40 ? '4' : '2';
    const fcCode = String(strength).padStart(3, '0');
    const edadCode = String(ageVal).padStart(2, '0');
    const revCode = String(slump).padStart(2, '0');
    const coloc = specs.placementType; // 'D' | 'B' | 'L'
    const prefix = specs.recipeType === 'MR' ? 'P' : '5';
    
    // Detect variant by materials (PCE detection)
    const selectedRows = selectedMaterials
      .map(sm => materials.find(m => m.id === sm.material_id))
      .filter(Boolean) as Material[];
    const hasPCE = selectedRows.some(m => (m.material_name || '').toUpperCase().includes('PCE'));
    const variante = hasPCE ? 'PCE' : '000';
    
    // Full ARKIK long code
    const code = `${prefix}-${fcCode}-${tmaFactor}-B-${edadCode}-${revCode}-${coloc}-2-${variante}`;
    
    setSuggestedCode(code);
  };

  const checkForConflicts = async () => {
    if (!plantId) return;
    
    const finalCode = useCustomCode ? customCode : suggestedCode;
    
    try {
      // Check same-spec recipes
      const { data: sameSpec } = await supabase
        .from('recipes')
        .select('id, recipe_code, master_recipe_id, master_recipes:master_recipe_id(master_code)')
        .eq('plant_id', plantId)
        .eq('strength_fc', parseFloat(specs.strengthFc))
        .eq('placement_type', specs.placementType)
        .eq('max_aggregate_size', parseFloat(specs.maxAggregateSize))
        .eq('slump', parseFloat(specs.slump));
      
      const filtered = (sameSpec || []).filter((r: any) => {
        if (specs.ageUnit === 'days') {
          return r.age_days === parseInt(specs.ageDays);
        } else {
          return r.age_hours === parseInt(specs.ageHours);
        }
      });
      
      setSameSpecRecipes(filtered);
      
      // Check exact code collision for this plant
      const { data: collision } = await supabase
        .from('recipes')
        .select('id, recipe_code, master_recipe_id')
        .eq('plant_id', plantId)
        .eq('recipe_code', finalCode)
        .maybeSingle();
      
      setCodeConflict(collision);
      
      return { sameSpec: filtered, collision };
    } catch (e: any) {
      return { sameSpec: [], collision: null };
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      // Validate specs
      if (!specs.strengthFc || !specs.slump || !specs.maxAggregateSize) {
        setError('Completa todas las especificaciones requeridas');
        return;
      }
      
      // If variant mode, require master selection
      if (creationMode === 'variant' && !selectedMasterId) {
        setError('Selecciona un maestro para crear la variante');
        return;
      }
      
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Validate materials
      if (selectedMaterials.length === 0) {
        setError('Agrega al menos un material');
        return;
      }
      
      const invalidRegular = selectedMaterials.filter(m => parsedQuantity(m.quantity_regular) <= 0);
      const invalidSSS = selectedMaterials.filter(m => parsedQuantity(m.quantity_sss) <= 0);
      if (invalidRegular.length > 0 || invalidSSS.length > 0) {
        setError('Ingresa cantidades para Regular y SSS en todos los materiales');
        return;
      }
      
      // Check conflicts
      await checkForConflicts();
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!plantId) return;
    
    const finalCode = useCustomCode ? customCode : suggestedCode;
    
    if (!finalCode) {
      setError('Código de receta inválido');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Detect if variant with same code already exists (exact match)
      const { data: existing } = await supabase
        .from('recipes')
        .select('id')
        .eq('plant_id', plantId)
        .eq('recipe_code', finalCode)
        .maybeSingle();

      const isUpdate = Boolean(existing?.id);

      // Create recipe
      let newRecipe: any = null; let recipeErr: any = null;
      if (isUpdate) {
        const { data, error } = await supabase
          .from('recipes')
          .update({
            strength_fc: parseFloat(specs.strengthFc),
            age_days: specs.ageUnit === 'days' ? parseInt(specs.ageDays) : null,
            age_hours: specs.ageUnit === 'hours' ? parseInt(specs.ageHours) : null,
            placement_type: specs.placementType,
            max_aggregate_size: parseFloat(specs.maxAggregateSize),
            slump: parseFloat(specs.slump),
            application_type: 'standard',
            has_waterproofing: specs.hasWaterproofing,
            performance_grade: 'standard',
            master_recipe_id: creationMode === 'variant' ? selectedMasterId : null,
            variant_suffix: creationMode === 'variant' ? parseMasterAndVariantFromRecipeCode(finalCode).variantSuffix : null
          })
          .eq('id', existing!.id)
          .select('*')
          .single();
        newRecipe = data; recipeErr = error;
      } else {
        const { data, error } = await supabase
          .from('recipes')
          .insert({
            recipe_code: finalCode,
            strength_fc: parseFloat(specs.strengthFc),
            age_days: specs.ageUnit === 'days' ? parseInt(specs.ageDays) : null,
            age_hours: specs.ageUnit === 'hours' ? parseInt(specs.ageHours) : null,
            placement_type: specs.placementType,
            max_aggregate_size: parseFloat(specs.maxAggregateSize),
            slump: parseFloat(specs.slump),
            application_type: 'standard',
            has_waterproofing: specs.hasWaterproofing,
            performance_grade: 'standard',
            plant_id: plantId,
            master_recipe_id: creationMode === 'variant' ? selectedMasterId : null,
            variant_suffix: creationMode === 'variant' ? parseMasterAndVariantFromRecipeCode(finalCode).variantSuffix : null
          })
          .select('*')
          .single();
        newRecipe = data; recipeErr = error;
      }
       
      if (recipeErr) throw recipeErr;
      
      // Create version (or new current version when updating)
      const { data: version, error: versionErr } = await supabase
        .from('recipe_versions')
        .insert({
          recipe_id: newRecipe.id,
          version_number: 1,
          effective_date: new Date().toISOString(),
          is_current: true,
          notes: specs.notes || specs.recipeType
        })
        .select('*')
        .single();
      
      if (versionErr) throw versionErr;
      
      // Insert materials (regular use)
      const regularMaterialRows = selectedMaterials.map(m => ({
        recipe_version_id: version.id,
        material_id: m.material_id,
        material_type: materials.find(mat => mat.id === m.material_id)?.category || 'MATERIAL',
        quantity: parsedQuantity(m.quantity_regular),
        unit: m.unit
      }));
      
      const { error: mqErr } = await supabase
        .from('material_quantities')
        .insert(regularMaterialRows);
      
      if (mqErr) throw mqErr;

      // Insert SSS reference materials (one row per material)
      const ssMaterialRows = selectedMaterials
        .filter(m => parsedQuantity(m.quantity_sss) > 0)
        .map(m => ({
          recipe_version_id: version.id,
          material_id: m.material_id,
          material_type: materials.find(mat => mat.id === m.material_id)?.category || 'SSS',
          sss_value: parsedQuantity(m.quantity_sss),
          unit: m.unit
        }));

      if (ssMaterialRows.length > 0) {
        const { error: sssErr } = await supabase
          .from('recipe_reference_materials')
          .upsert(ssMaterialRows, { onConflict: 'recipe_version_id,material_id' });
        if (sssErr) throw sssErr;
      }
      
      // If new_master mode, create master after recipe
      if (creationMode === 'new_master') {
        const { masterCode } = parseMasterAndVariantFromRecipeCode(finalCode);
        
        const { data: newMaster, error: masterErr } = await supabase
          .from('master_recipes')
          .insert({
            master_code: masterCode || finalCode,
            plant_id: plantId,
            strength_fc: parseFloat(specs.strengthFc),
            age_days: specs.ageUnit === 'days' ? parseInt(specs.ageDays) : null,
            age_hours: specs.ageUnit === 'hours' ? parseInt(specs.ageHours) : null,
            placement_type: specs.placementType,
            max_aggregate_size: parseFloat(specs.maxAggregateSize),
            slump: parseFloat(specs.slump)
          })
          .select('id')
          .single();
        
        if (!masterErr && newMaster) {
          // Link recipe to master
          await supabase.rpc('link_variant_to_master', {
            p_recipe_id: newRecipe.id,
            p_master_id: newMaster.id
          });
        }
      }
      
      toast.success('Receta creada exitosamente');
      onSuccess();
      handleClose();
    } catch (e: any) {
      setError(e.message || 'Error al crear receta');
      toast.error(e.message || 'Error al crear receta');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setCreationMode('variant');
    setSelectedMasterId(null);
    setSelectedMaster(null);
    setSpecs({
      strengthFc: '',
      ageUnit: 'days',
      ageDays: '28',
      ageHours: '',
      placementType: 'D',
      maxAggregateSize: '19',
      slump: '12',
      recipeType: 'FC',
      hasWaterproofing: false,
      notes: ''
    });
    setSelectedMaterials([]);
    setMaterialSearch('');
    setMasterSearch('');
    setSuggestedCode('');
    setCustomCode('');
    setUseCustomCode(false);
    setError(null);
    setSameSpecRecipes([]);
    setCodeConflict(null);
    onClose();
  };

  const parsedQuantity = (value: string) => {
    if (!value) return 0;
    const normalized = value.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const addMaterial = (material: Material) => {
    if (selectedMaterials.find(m => m.material_id === material.id)) {
      toast.error('Material ya agregado');
      return;
    }
    
    setSelectedMaterials([...selectedMaterials, {
      material_id: material.id,
      quantity_regular: '',
      quantity_sss: '',
      unit: material.unit_of_measure
    }]);
    setMaterialSearch('');
    requestAnimationFrame(() => {
      materialInputRef.current?.focus();
      setIsMaterialDropdownOpen(true);
    });
  };

  const removeMaterial = (materialId: string) => {
    setSelectedMaterials(selectedMaterials.filter(m => m.material_id !== materialId));
  };

  const updateMaterialQuantity = (materialId: string, quantity: string) => {
    setSelectedMaterials(selectedMaterials.map(m =>
      m.material_id === materialId ? { ...m, quantity_regular: quantity } : m
    ));
  };

  const updateMaterialSSQuantity = (materialId: string, quantity: string) => {
    setSelectedMaterials(selectedMaterials.map(m =>
      m.material_id === materialId ? { ...m, quantity_sss: quantity } : m
    ));
  };

  const filteredMasters = availableMasters.filter(m =>
    m.master_code.toLowerCase().includes(masterSearch.toLowerCase())
  );

  const filteredMaterials = materials.filter(m =>
    m.material_name.toLowerCase().includes(materialSearch.toLowerCase()) &&
    !selectedMaterials.find(sm => sm.material_id === m.id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Nueva Receta</h2>
            <p className="text-sm text-gray-600 mt-1">
              Paso {currentStep} de 3 • {creationMode === 'variant' ? 'Variante de Maestro' : 'Nuevo Maestro + Primera Variante'}
            </p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center px-6 py-4 bg-gray-50 border-b">
          {[1, 2, 3].map((step) => (
            <React.Fragment key={step}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              } font-semibold`}>
                {step}
              </div>
              {step < 3 && (
                <div className={`flex-1 h-1 mx-2 ${
                  step < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Mode & Specs */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Creation Mode Selection */}
              <div>
                <label className="block text-sm font-semibold mb-3">Tipo de Creación</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      setCreationMode('variant');
                      setSelectedMasterId(null);
                      setSelectedMaster(null);
                      loadCompatibleMasters();
                    }}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      creationMode === 'variant'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">🔗</div>
                      <div className="font-semibold text-sm">Variante de Maestro</div>
                      <div className="text-xs text-gray-600 mt-1">Agregar a maestro existente</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setCreationMode('new_master');
                      setSelectedMasterId(null);
                      setSelectedMaster(null);
                    }}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      creationMode === 'new_master'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">⭐</div>
                      <div className="font-semibold text-sm">Nuevo Maestro</div>
                      <div className="text-xs text-gray-600 mt-1">Crear maestro con primera variante</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Master Selection (if variant mode) */}
              {creationMode === 'variant' && (
                <div>
                  <label className="block text-sm font-semibold mb-3">Seleccionar Maestro</label>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar maestro..."
                      value={masterSearch}
                      onChange={(e) => setMasterSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                    {filteredMasters.map(master => (
                      <button
                        key={master.id}
                        onClick={() => {
                          setSelectedMasterId(master.id);
                          setSelectedMaster(master);
                        }}
                        className={`w-full p-3 border rounded-lg text-left transition-all ${
                          selectedMasterId === master.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-mono font-semibold text-sm">{master.master_code}</div>
                            <div className="text-xs text-gray-600">
                              f'c: {master.strength_fc} • Rev: {master.slump} • {master.variant_count} variantes
                            </div>
                          </div>
                          {selectedMasterId === master.id && (
                            <CheckCircle2 className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Specifications */}
              <div>
                <label className="block text-sm font-semibold mb-3">
                  Especificaciones Técnicas
                  {creationMode === 'variant' && selectedMaster && (
                    <span className="ml-2 text-xs font-normal text-blue-600">
                      (Heredadas del maestro)
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Resistencia (f'c) *</label>
                    <input
                      type="number"
                      value={specs.strengthFc}
                      onChange={(e) => setSpecs({ ...specs, strengthFc: e.target.value })}
                      placeholder="250"
                      disabled={creationMode === 'variant' && !!selectedMaster}
                      className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium mb-1">Edad *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={specs.ageUnit === 'days' ? specs.ageDays : specs.ageHours}
                        onChange={(e) => specs.ageUnit === 'days' 
                          ? setSpecs({ ...specs, ageDays: e.target.value })
                          : setSpecs({ ...specs, ageHours: e.target.value })
                        }
                        disabled={creationMode === 'variant' && !!selectedMaster}
                        className="flex-1 px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <select
                        value={specs.ageUnit}
                        onChange={(e) => setSpecs({ ...specs, ageUnit: e.target.value as 'days' | 'hours' })}
                        disabled={creationMode === 'variant' && !!selectedMaster}
                        className="px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="days">Días</option>
                        <option value="hours">Horas</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium mb-1">Revenimiento *</label>
                    <input
                      type="number"
                      value={specs.slump}
                      onChange={(e) => setSpecs({ ...specs, slump: e.target.value })}
                      placeholder="12"
                      disabled={creationMode === 'variant' && !!selectedMaster}
                      className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium mb-1">TMA *</label>
                    <input
                      type="number"
                      value={specs.maxAggregateSize}
                      onChange={(e) => setSpecs({ ...specs, maxAggregateSize: e.target.value })}
                      placeholder="19"
                      disabled={creationMode === 'variant' && !!selectedMaster}
                      className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium mb-1">Colocación *</label>
                    <select
                      value={specs.placementType}
                      onChange={(e) => setSpecs({ ...specs, placementType: e.target.value })}
                      disabled={creationMode === 'variant' && !!selectedMaster}
                      className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="D">Directo (D)</option>
                      <option value="B">Bombeado (B)</option>
                      <option value="L">Lanzado (L)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium mb-1">Tipo</label>
                    <select
                      value={specs.recipeType}
                      onChange={(e) => setSpecs({ ...specs, recipeType: e.target.value as 'FC' | 'MR' })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="FC">f'c</option>
                      <option value="MR">MR</option>
                    </select>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={specs.hasWaterproofing}
                      onChange={(e) => setSpecs({ ...specs, hasWaterproofing: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Impermeabilizante</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Materials */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-3">Materiales</label>
                
                {/* Add Material */}
                <div className="relative mb-4" ref={materialPickerRef}>
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    ref={materialInputRef}
                    type="text"
                    placeholder="Buscar material..."
                    value={materialSearch}
                    onChange={(e) => {
                      setMaterialSearch(e.target.value);
                      setIsMaterialDropdownOpen(true);
                    }}
                    onFocus={() => setIsMaterialDropdownOpen(true)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                  
                  {isMaterialDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredMaterials.length > 0 ? (
                        filteredMaterials.map(material => (
                          <button
                            key={material.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addMaterial(material);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-sm">{material.material_name}</div>
                              <div className="text-xs text-gray-600">{material.category || material.material_code}</div>
                            </div>
                            <Plus className="h-4 w-4 text-gray-400" />
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          {materialSearch ? 'Sin resultados para la búsqueda actual' : 'No hay materiales disponibles'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Selected Materials */}
                {selectedMaterials.length > 0 ? (
                  <div className="space-y-3">
                    {selectedMaterials.map(sm => {
                      const material = materials.find(m => m.id === sm.material_id);
                      return (
                        <div key={sm.material_id} className="flex items-center gap-3 p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{material?.material_name}</div>
                            <div className="text-xs text-gray-600">{material?.category || material?.material_code}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={sm.quantity_regular}
                              onChange={(e) => updateMaterialQuantity(sm.material_id, e.target.value)}
                              placeholder="0"
                              className="w-24 px-3 py-2 border rounded-lg text-right"
                            />
                            <input
                              type="number"
                              value={sm.quantity_sss}
                              onChange={(e) => updateMaterialSSQuantity(sm.material_id, e.target.value)}
                              placeholder="SSS"
                              className="w-24 px-3 py-2 border rounded-lg text-right"
                            />
                            <span className="text-sm text-gray-600 w-12">{sm.unit}</span>
                            <button
                              onClick={() => removeMaterial(sm.material_id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay materiales agregados</p>
                    <p className="text-sm">Busca y agrega materiales arriba</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review & Code */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Code Generation */}
              <div>
                <label className="block text-sm font-semibold mb-3">Código de Receta</label>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="radio"
                      checked={!useCustomCode}
                      onChange={() => setUseCustomCode(false)}
                    />
                    <span className="text-sm font-medium">Código sugerido (ARKIK)</span>
                  </div>
                  <div className="font-mono text-lg font-bold text-blue-600 ml-6">
                    {suggestedCode || 'Calculando...'}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4 mb-2">
                    <input
                      type="radio"
                      checked={useCustomCode}
                      onChange={() => setUseCustomCode(true)}
                    />
                    <span className="text-sm font-medium">Código personalizado</span>
                  </div>
                  <input
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    disabled={!useCustomCode}
                    placeholder="Ingresar código personalizado"
                    className="w-full px-3 py-2 border rounded-lg ml-6 disabled:bg-gray-100"
                  />
                </div>
              </div>

              {/* Conflicts & Warnings */}
              {sameSpecRecipes.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    <div className="font-semibold mb-2">Recetas con especificaciones idénticas encontradas:</div>
                    <div className="space-y-1">
                      {sameSpecRecipes.map((r: any) => (
                        <div key={r.id} className="text-sm">
                          • {r.recipe_code}
                          {r.master_recipes && (
                            <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              Maestro: {r.master_recipes.master_code}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {codeConflict && (
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription>
                    El código {useCustomCode ? customCode : suggestedCode} ya existe en esta planta. Se actualizará la variante existente al guardar.
                  </AlertDescription>
                </Alert>
              )}

              {/* Summary */}
              <div>
                <label className="block text-sm font-semibold mb-3">Resumen</label>
                <div className="bg-gray-50 p-4 rounded-lg border space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-medium">
                      {creationMode === 'variant' ? '🔗 Variante de Maestro' : '⭐ Nuevo Maestro + Primera Variante'}
                    </span>
                  </div>
                  {creationMode === 'variant' && selectedMaster && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Maestro:</span>
                      <span className="font-mono font-medium text-blue-600">{selectedMaster.master_code}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">f'c:</span>
                    <span className="font-medium">{specs.strengthFc} kg/cm²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Edad:</span>
                    <span className="font-medium">
                      {specs.ageUnit === 'days' ? `${specs.ageDays} días` : `${specs.ageHours} horas`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Materiales:</span>
                    <span className="font-medium">{selectedMaterials.length} materiales (Regular y SSS requeridos)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <Button
            variant="secondary"
            onClick={currentStep === 1 ? handleClose : handleBack}
            disabled={loading}
          >
            {currentStep === 1 ? 'Cancelar' : 'Atrás'}
          </Button>
          
          <div className="flex gap-2">
            {currentStep < 3 ? (
              <Button onClick={handleNext} disabled={loading}>
                Siguiente
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading || (useCustomCode && !customCode)}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? 'Creando...' : 'Crear Receta'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

