'use client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

import { useState, useEffect, useMemo } from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import { Building2, Plus, Search, Filter } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import type { Plant, BusinessUnit } from '@/types/plant';
import { supabase } from '@/lib/supabase/client';
import { BusinessUnitCard } from '@/components/admin/plants/BusinessUnitCard';
import { PlantCard } from '@/components/admin/plants/PlantCard';
import { PlantDetailModal } from '@/components/admin/plants/PlantDetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EditingItem {
  type: 'plant' | 'business_unit';
  id: string | null;
  data: Partial<Plant> | Partial<BusinessUnit>;
}

export default function PlantsManagementPage() {
  let plantContext;
  try {
    plantContext = usePlantContext();
  } catch (err) {
    // Context not available during SSR/static generation
    plantContext = null;
  }
  
  const availablePlants = plantContext?.availablePlants || [];
  const businessUnits = plantContext?.businessUnits || [];
  const refreshPlantData = plantContext?.refreshPlantData || (async () => {});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredBusinessUnits = useMemo(() => {
    if (!Array.isArray(businessUnits) || businessUnits.length === 0) return [];
    
    let filtered = [...businessUnits];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(bu =>
        bu?.name?.toLowerCase().includes(term) ||
        bu?.code?.toLowerCase().includes(term)
      );
    }
    
    if (filterType === 'active') {
      filtered = filtered.filter(bu => bu?.is_active);
    } else if (filterType === 'inactive') {
      filtered = filtered.filter(bu => !bu?.is_active);
    }
    
    return filtered;
  }, [businessUnits, searchTerm, filterType]);

  const filteredPlants = useMemo(() => {
    if (!Array.isArray(availablePlants) || availablePlants.length === 0) return [];
    
    let filtered = [...availablePlants];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(plant =>
        plant?.name?.toLowerCase().includes(term) ||
        plant?.code?.toLowerCase().includes(term) ||
        plant?.location?.toLowerCase().includes(term)
      );
    }
    
    if (selectedBusinessUnit) {
      filtered = filtered.filter(plant => plant?.business_unit_id === selectedBusinessUnit);
    }
    
    if (filterType === 'active') {
      filtered = filtered.filter(plant => plant?.is_active);
    } else if (filterType === 'inactive') {
      filtered = filtered.filter(plant => !plant?.is_active);
    }
    
    return filtered;
  }, [availablePlants, searchTerm, selectedBusinessUnit, filterType]);

  const handleCreateBusinessUnit = () => {
    setEditing({
      type: 'business_unit',
      id: null,
      data: { code: '', name: '', description: '', is_active: true }
    });
  };

  const handleCreatePlant = () => {
    setEditing({
      type: 'plant',
      id: null,
      data: { code: '', name: '', location: '', business_unit_id: '', is_active: true }
    });
  };

  const handleEdit = (type: 'plant' | 'business_unit', item: Plant | BusinessUnit) => {
    setEditing({
      type,
      id: item.id,
      data: { ...item }
    });
  };

  const handleSave = async () => {
    if (!editing || !editing.data) return;

    try {
      setLoading(true);
      setError(null);

      const dataToSave = { ...editing.data };
      const editingId = editing.id;

      if (editing.type === 'business_unit') {
        if (editingId) {
          const { error } = await supabase
            .from('business_units')
            .update(dataToSave)
            .eq('id', editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('business_units')
            .insert([dataToSave]);
          if (error) throw error;
        }
      } else {
        if (editingId) {
          const { error } = await supabase
            .from('plants')
            .update(dataToSave)
            .eq('id', editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('plants')
            .insert([dataToSave]);
          if (error) throw error;
        }
      }

      if (refreshPlantData) {
        await refreshPlantData();
      }
      setEditing(null);
      toast({
        title: 'Éxito',
        description: editingId ? 'Elemento actualizado correctamente' : 'Elemento creado correctamente',
      });
    } catch (err) {
      console.error('Error saving:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type: 'plant' | 'business_unit', id: string) => {
    if (!confirm('¿Estás seguro de que quieres desactivar este elemento?')) return;

    try {
      setLoading(true);
      setError(null);

      if (type === 'business_unit') {
        const { error } = await supabase
          .from('business_units')
          .update({ is_active: false })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('plants')
          .update({ is_active: false })
          .eq('id', id);
        if (error) throw error;
      }

      if (refreshPlantData) {
        await refreshPlantData();
      }
      toast({
        title: 'Éxito',
        description: 'Elemento desactivado correctamente',
      });
    } catch (err) {
      console.error('Error deleting:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateEditingData = (field: string, value: string | boolean) => {
    if (!editing || !editing.data) return;
    setEditing({
      ...editing,
      data: { ...editing.data, [field]: value }
    });
  };

  const getPlantCountForBU = (buId: string) => {
    if (!Array.isArray(availablePlants)) return 0;
    return availablePlants.filter(p => p?.business_unit_id === buId).length;
  };

  return (
    <RoleGuard allowedRoles="EXECUTIVE" redirectTo="/access-denied">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Plantas y Unidades de Negocio</h1>
            <p className="text-sm text-gray-600 mt-1">
              Administra plantas y unidades de negocio del sistema
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleCreateBusinessUnit} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Unidad
            </Button>
            <Button onClick={handleCreatePlant}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Planta
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              &times;
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="glass-base rounded-xl p-4 mb-6 border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                type="text"
                placeholder="Buscar..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedBusinessUnit || 'all'} onValueChange={(value) => setSelectedBusinessUnit(value === 'all' ? null : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por unidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las unidades</SelectItem>
                {Array.isArray(businessUnits) && businessUnits.map((bu) => (
                  <SelectItem key={bu?.id} value={bu?.id}>
                    {bu?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Business Units Column */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Unidades de Negocio
              </h2>
              <span className="text-sm text-gray-500">
                {filteredBusinessUnits.length} {filteredBusinessUnits.length === 1 ? 'unidad' : 'unidades'}
              </span>
            </div>
            <div className="space-y-4">
              {filteredBusinessUnits.map((bu, index) => (
                <BusinessUnitCard
                  key={bu.id}
                  businessUnit={bu}
                  plantCount={getPlantCountForBU(bu.id)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  delay={index * 0.05}
                />
              ))}
              {filteredBusinessUnits.length === 0 && (
                <div className="glass-base rounded-xl p-8 text-center border">
                  <p className="text-gray-500">No se encontraron unidades de negocio</p>
                </div>
              )}
            </div>
          </div>

          {/* Plants Column */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-green-600" />
                Plantas
              </h2>
              <span className="text-sm text-gray-500">
                {filteredPlants.length} {filteredPlants.length === 1 ? 'planta' : 'plantas'}
              </span>
            </div>
            <div className="space-y-4">
              {filteredPlants.map((plant, index) => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onViewDetails={setSelectedPlantId}
                  delay={index * 0.05}
                />
              ))}
              {filteredPlants.length === 0 && (
                <div className="glass-base rounded-xl p-8 text-center border">
                  <p className="text-gray-500">No se encontraron plantas</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editing?.id ? 'Editar' : 'Crear'} {editing?.type === 'business_unit' ? 'Unidad de Negocio' : 'Planta'}
              </DialogTitle>
              <DialogDescription>
                {editing?.id ? 'Actualiza la información' : 'Completa los datos para crear un nuevo elemento'}
              </DialogDescription>
            </DialogHeader>

            {editing && editing.data && (
              <div className="space-y-4 py-4">
                {editing.type === 'business_unit' ? (
                  <>
                    <div>
                      <Label htmlFor="bu-code">Código *</Label>
                      <Input
                        id="bu-code"
                        value={(editing.data as Partial<BusinessUnit>).code || ''}
                        onChange={(e) => updateEditingData('code', e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="bu-name">Nombre *</Label>
                      <Input
                        id="bu-name"
                        value={(editing.data as Partial<BusinessUnit>).name || ''}
                        onChange={(e) => updateEditingData('name', e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="bu-description">Descripción</Label>
                      <textarea
                        id="bu-description"
                        value={(editing.data as Partial<BusinessUnit>).description || ''}
                        onChange={(e) => updateEditingData('description', e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={3}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="plant-code">Código *</Label>
                      <Input
                        id="plant-code"
                        value={(editing.data as Partial<Plant>).code || ''}
                        onChange={(e) => updateEditingData('code', e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="plant-name">Nombre *</Label>
                      <Input
                        id="plant-name"
                        value={(editing.data as Partial<Plant>).name || ''}
                        onChange={(e) => updateEditingData('name', e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="plant-location">Ubicación</Label>
                      <Input
                        id="plant-location"
                        value={(editing.data as Partial<Plant>).location || ''}
                        onChange={(e) => updateEditingData('location', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="plant-bu">Unidad de Negocio</Label>
                      <Select
                        value={(editing.data as Partial<Plant>).business_unit_id || ''}
                        onValueChange={(value) => updateEditingData('business_unit_id', value)}
                      >
                        <SelectTrigger id="plant-bu" className="mt-1">
                          <SelectValue placeholder="Seleccionar unidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Ninguna</SelectItem>
                          {Array.isArray(businessUnits) && businessUnits.map((bu) => (
                            <SelectItem key={bu?.id} value={bu?.id}>
                              {bu?.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setEditing(null)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Plant Detail Modal */}
        <PlantDetailModal
          open={!!selectedPlantId}
          onOpenChange={(open) => !open && setSelectedPlantId(null)}
          plantId={selectedPlantId}
        />
      </div>
    </RoleGuard>
  );
}
