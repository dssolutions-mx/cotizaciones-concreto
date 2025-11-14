'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ChevronDown, ChevronRight, FlaskConical, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePlantContext } from '@/contexts/PlantContext';

interface MasterRecipeWithVariants {
  id: string;
  master_code: string;
  strength_fc: number;
  age_days: number;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  plant_id: string;
  variants: Array<{
    id: string;
    recipe_code: string;
    arkik_long_code?: string;
    arkik_short_code?: string;
    variant_suffix?: string;
  }>;
}

interface MasterRecipeSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMasterSelect: (masterId: string, masterCode: string, variantCount: number) => void;
}

export function MasterRecipeSearchModal({
  isOpen,
  onClose,
  onMasterSelect
}: MasterRecipeSearchModalProps) {
  const { currentPlant } = usePlantContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [masters, setMasters] = useState<MasterRecipeWithVariants[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && currentPlant?.id) {
      loadMasters();
    }
  }, [isOpen, currentPlant?.id]);

  const loadMasters = async () => {
    if (!currentPlant?.id) return;

    setLoading(true);
    try {
      // Fetch all master recipes with their variants
      const { data: masterData, error: masterError } = await supabase
        .from('master_recipes')
        .select('*')
        .eq('plant_id', currentPlant.id)
        .eq('is_active', true)
        .order('master_code');

      if (masterError) throw masterError;

      // For each master, fetch its variants
      const mastersWithVariants: MasterRecipeWithVariants[] = await Promise.all(
        (masterData || []).map(async (master) => {
          const { data: variants, error: variantsError } = await supabase
            .from('recipes')
            .select('id, recipe_code, arkik_long_code, arkik_short_code, variant_suffix')
            .eq('master_recipe_id', master.id)
            .order('variant_suffix');

          if (variantsError) {
            console.error('Error fetching variants:', variantsError);
            return { ...master, variants: [] };
          }

          return {
            ...master,
            variants: variants || []
          };
        })
      );

      setMasters(mastersWithVariants);
    } catch (error) {
      console.error('Error loading masters:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMasterExpansion = (masterId: string) => {
    const newExpanded = new Set(expandedMasters);
    if (newExpanded.has(masterId)) {
      newExpanded.delete(masterId);
    } else {
      newExpanded.add(masterId);
    }
    setExpandedMasters(newExpanded);
  };

  const filteredMasters = masters.filter(master => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      master.master_code.toLowerCase().includes(query) ||
      master.strength_fc.toString().includes(query) ||
      master.variants.some(v =>
        v.recipe_code.toLowerCase().includes(query) ||
        v.arkik_long_code?.toLowerCase().includes(query) ||
        v.arkik_short_code?.toLowerCase().includes(query)
      )
    );
  });

  const handleMasterSelect = (master: MasterRecipeWithVariants) => {
    onMasterSelect(master.id, master.master_code, master.variants.length);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Seleccionar Receta Maestra para Análisis
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por código maestro, resistencia, o variante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Master Recipes List */}
        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Cargando recetas maestras...</span>
            </div>
          ) : filteredMasters.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No se encontraron recetas maestras
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMasters.map((master) => {
                const isExpanded = expandedMasters.has(master.id);

                return (
                  <div
                    key={master.id}
                    className="border rounded-lg overflow-hidden hover:border-blue-300 transition-colors"
                  >
                    {/* Master Header */}
                    <div className="bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <button
                            onClick={() => toggleMasterExpansion(master.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg text-gray-900">
                                {master.master_code}
                              </h3>
                              <Badge variant="outline" className="bg-blue-50">
                                {master.variants.length} variante{master.variants.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              f'c {master.strength_fc} kg/cm² @ {master.age_days} días |
                              {master.placement_type} |
                              TMA {master.max_aggregate_size}mm |
                              Rev {master.slump}cm
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleMasterSelect(master)}
                          variant="default"
                          size="sm"
                        >
                          Analizar Maestro
                        </Button>
                      </div>
                    </div>

                    {/* Variants List */}
                    {isExpanded && master.variants.length > 0 && (
                      <div className="bg-white">
                        <div className="px-4 py-2 bg-gray-100 border-t text-xs font-medium text-gray-700">
                          Variantes de esta receta maestra:
                        </div>
                        <div className="divide-y">
                          {master.variants.map((variant) => (
                            <div
                              key={variant.id}
                              className="px-4 py-3 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-mono text-sm font-medium text-gray-900">
                                    {variant.arkik_long_code || variant.recipe_code}
                                  </div>
                                  {variant.arkik_long_code && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      Legacy: {variant.recipe_code}
                                      {variant.variant_suffix && (
                                        <span className="ml-2 text-blue-600">
                                          Sufijo: {variant.variant_suffix}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {variant.arkik_short_code && (
                                    <div className="text-xs text-gray-500">
                                      Código corto: {variant.arkik_short_code}
                                    </div>
                                  )}
                                </div>
                                <Badge variant="secondary" className="ml-2">
                                  Variante
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No variants warning */}
                    {isExpanded && master.variants.length === 0 && (
                      <div className="px-4 py-3 bg-yellow-50 border-t text-sm text-yellow-800">
                        ⚠️ Este maestro no tiene variantes asociadas
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600">
            {filteredMasters.length} receta{filteredMasters.length !== 1 ? 's' : ''} maestra{filteredMasters.length !== 1 ? 's' : ''} encontrada{filteredMasters.length !== 1 ? 's' : ''}
          </div>
          <Button onClick={onClose} variant="outline">
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
