'use client';

import { useState, useEffect } from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import { Building2, MapPin, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import type { Plant, BusinessUnit } from '@/types/plant';
import { supabase } from '@/lib/supabase/client';

interface EditingItem {
  type: 'plant' | 'business_unit';
  id: string | null;
  data: Partial<Plant> | Partial<BusinessUnit>;
}

export default function PlantsManagementPage() {
  const { availablePlants, businessUnits, refreshPlantData } = usePlantContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingItem | null>(null);

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
    if (!editing) return;

    try {
      setLoading(true);
      setError(null);

      if (editing.type === 'business_unit') {
        if (editing.id) {
          // Update existing business unit
          const { error } = await supabase
            .from('business_units')
            .update(editing.data)
            .eq('id', editing.id);
          if (error) throw error;
        } else {
          // Create new business unit
          const { error } = await supabase
            .from('business_units')
            .insert([editing.data]);
          if (error) throw error;
        }
      } else {
        if (editing.id) {
          // Update existing plant
          const { error } = await supabase
            .from('plants')
            .update(editing.data)
            .eq('id', editing.id);
          if (error) throw error;
        } else {
          // Create new plant
          const { error } = await supabase
            .from('plants')
            .insert([editing.data]);
          if (error) throw error;
        }
      }

      await refreshPlantData();
      setEditing(null);
    } catch (err) {
      console.error('Error saving:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type: 'plant' | 'business_unit', id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este elemento?')) return;

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

      await refreshPlantData();
    } catch (err) {
      console.error('Error deleting:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setLoading(false);
    }
  };

  const updateEditingData = (field: string, value: string | boolean) => {
    if (!editing) return;
    setEditing({
      ...editing,
      data: { ...editing.data, [field]: value }
    });
  };

  return (
    <RoleGuard allowedRoles="EXECUTIVE" redirectTo="/access-denied">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Gestión de Plantas y Unidades de Negocio</h1>
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

        {/* Business Units Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              Unidades de Negocio
            </h2>
            <button
              onClick={handleCreateBusinessUnit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
              disabled={loading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Unidad
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {businessUnits.map((bu) => (
              <div key={bu.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                {editing?.type === 'business_unit' && editing.id === bu.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Código"
                      value={(editing.data as Partial<BusinessUnit>).code || ''}
                      onChange={(e) => updateEditingData('code', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={(editing.data as Partial<BusinessUnit>).name || ''}
                      onChange={(e) => updateEditingData('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <textarea
                      placeholder="Descripción"
                      value={(editing.data as Partial<BusinessUnit>).description || ''}
                      onChange={(e) => updateEditingData('description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={2}
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSave}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md flex items-center"
                        disabled={loading}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded-md flex items-center"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{bu.name}</h3>
                        <p className="text-sm text-gray-500">{bu.code}</p>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleEdit('business_unit', bu)}
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete('business_unit', bu.id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {bu.description && (
                      <p className="text-sm text-gray-600 mb-2">{bu.description}</p>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      bu.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {bu.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </>
                )}
              </div>
            ))}

            {/* New Business Unit Form */}
            {editing?.type === 'business_unit' && editing.id === null && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-dashed border-blue-300">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Código"
                    value={(editing.data as Partial<BusinessUnit>).code || ''}
                    onChange={(e) => updateEditingData('code', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={(editing.data as Partial<BusinessUnit>).name || ''}
                    onChange={(e) => updateEditingData('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <textarea
                    placeholder="Descripción"
                    value={(editing.data as Partial<BusinessUnit>).description || ''}
                    onChange={(e) => updateEditingData('description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={2}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSave}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md flex items-center"
                      disabled={loading}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Crear
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded-md flex items-center"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Plants Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-green-600" />
              Plantas
            </h2>
            <button
              onClick={handleCreatePlant}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center"
              disabled={loading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Planta
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availablePlants.map((plant) => (
              <div key={plant.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                {editing?.type === 'plant' && editing.id === plant.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Código"
                      value={(editing.data as Partial<Plant>).code || ''}
                      onChange={(e) => updateEditingData('code', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={(editing.data as Partial<Plant>).name || ''}
                      onChange={(e) => updateEditingData('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Ubicación"
                      value={(editing.data as Partial<Plant>).location || ''}
                      onChange={(e) => updateEditingData('location', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <select
                      value={(editing.data as Partial<Plant>).business_unit_id || ''}
                      onChange={(e) => updateEditingData('business_unit_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Seleccionar Unidad de Negocio</option>
                      {businessUnits.map((bu) => (
                        <option key={bu.id} value={bu.id}>
                          {bu.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSave}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md flex items-center"
                        disabled={loading}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded-md flex items-center"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{plant.name}</h3>
                        <p className="text-sm text-gray-500">{plant.code}</p>
                        {plant.location && (
                          <p className="text-sm text-gray-500 flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {plant.location}
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleEdit('plant', plant)}
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete('plant', plant.id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {plant.business_unit && (
                      <p className="text-sm text-blue-600 mb-2">{plant.business_unit.name}</p>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      plant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {plant.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </>
                )}
              </div>
            ))}

            {/* New Plant Form */}
            {editing?.type === 'plant' && editing.id === null && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-dashed border-green-300">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Código"
                    value={(editing.data as Partial<Plant>).code || ''}
                    onChange={(e) => updateEditingData('code', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={(editing.data as Partial<Plant>).name || ''}
                    onChange={(e) => updateEditingData('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="Ubicación"
                    value={(editing.data as Partial<Plant>).location || ''}
                    onChange={(e) => updateEditingData('location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <select
                    value={(editing.data as Partial<Plant>).business_unit_id || ''}
                    onChange={(e) => updateEditingData('business_unit_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Seleccionar Unidad de Negocio</option>
                    {businessUnits.map((bu) => (
                      <option key={bu.id} value={bu.id}>
                        {bu.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSave}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md flex items-center"
                      disabled={loading}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Crear
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded-md flex items-center"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </RoleGuard>
  );
} 