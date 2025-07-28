'use client';

import React, { useState } from 'react';
import { Building2, Users, Save, X, ArrowRight } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { supabase } from '@/lib/supabase/client';

interface UserData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  plant_id?: string | null;
  business_unit_id?: string | null;
  plant_name?: string;
  business_unit_name?: string;
}

interface UserPlantAssignmentProps {
  user: UserData;
  onUpdate: () => void;
  className?: string;
}

export default function UserPlantAssignment({ user, onUpdate, className }: UserPlantAssignmentProps) {
  const { availablePlants, businessUnits } = usePlantContext();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState(user.plant_id || '');
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState(user.business_unit_id || '');
  const [assignmentType, setAssignmentType] = useState<'global' | 'business_unit' | 'plant'>(
    user.plant_id ? 'plant' : user.business_unit_id ? 'business_unit' : 'global'
  );

  const handleSave = async () => {
    try {
      setLoading(true);

      let updateData: { plant_id: string | null; business_unit_id: string | null } = {
        plant_id: null,
        business_unit_id: null
      };

      if (assignmentType === 'plant' && selectedPlantId) {
        updateData.plant_id = selectedPlantId;
        // When assigning to a plant, we don't need business unit assignment
        updateData.business_unit_id = null;
      } else if (assignmentType === 'business_unit' && selectedBusinessUnitId) {
        updateData.business_unit_id = selectedBusinessUnitId;
        updateData.plant_id = null;
      }
      // For 'global', both remain null

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating user assignment:', error);
      alert('Error al actualizar la asignación del usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedPlantId(user.plant_id || '');
    setSelectedBusinessUnitId(user.business_unit_id || '');
    setAssignmentType(user.plant_id ? 'plant' : user.business_unit_id ? 'business_unit' : 'global');
    setIsEditing(false);
  };

  const getAssignmentDisplay = () => {
    if (user.plant_name) {
      return (
        <div className="flex items-center text-sm">
          <Building2 className="h-4 w-4 text-green-600 mr-2" />
          <div>
            <span className="font-medium text-green-700">{user.plant_name}</span>
            <span className="text-gray-500 ml-1">({user.plant_id?.substring(0, 8)}...)</span>
          </div>
        </div>
      );
    } else if (user.business_unit_name) {
      return (
        <div className="flex items-center text-sm">
          <Building2 className="h-4 w-4 text-blue-600 mr-2" />
          <div>
            <span className="font-medium text-blue-700">{user.business_unit_name}</span>
            <span className="text-gray-500 ml-1">(Unidad de Negocio)</span>
          </div>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-sm">
          <Users className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-gray-500">Acceso Global</span>
        </div>
      );
    }
  };

  if (!isEditing) {
    return (
      <div className={`flex items-center justify-between ${className}`}>
        <div>{getAssignmentDisplay()}</div>
        <button
          onClick={() => setIsEditing(true)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Assignment Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de Asignación
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              value="global"
              checked={assignmentType === 'global'}
              onChange={(e) => setAssignmentType(e.target.value as 'global')}
              className="mr-2"
            />
            <Users className="h-4 w-4 mr-1" />
            <span className="text-sm">Acceso Global (Todos los datos)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="business_unit"
              checked={assignmentType === 'business_unit'}
              onChange={(e) => setAssignmentType(e.target.value as 'business_unit')}
              className="mr-2"
            />
            <Building2 className="h-4 w-4 mr-1 text-blue-600" />
            <span className="text-sm">Unidad de Negocio (Todas las plantas de la unidad)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="plant"
              checked={assignmentType === 'plant'}
              onChange={(e) => setAssignmentType(e.target.value as 'plant')}
              className="mr-2"
            />
            <Building2 className="h-4 w-4 mr-1 text-green-600" />
            <span className="text-sm">Planta Específica</span>
          </label>
        </div>
      </div>

      {/* Business Unit Selector */}
      {assignmentType === 'business_unit' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unidad de Negocio
          </label>
          <select
            value={selectedBusinessUnitId}
            onChange={(e) => setSelectedBusinessUnitId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Seleccionar Unidad de Negocio</option>
            {businessUnits.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.name} ({bu.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Plant Selector */}
      {assignmentType === 'plant' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Planta
          </label>
          <select
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">Seleccionar Planta</option>
            {availablePlants.map((plant) => (
              <option key={plant.id} value={plant.id}>
                {plant.name} ({plant.code}) - {plant.business_unit?.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-50 p-3 rounded-md">
        <div className="flex items-center text-sm text-gray-600">
          <span className="font-medium">Resultado:</span>
          <ArrowRight className="h-4 w-4 mx-2" />
          <span>
            {assignmentType === 'global' 
              ? 'El usuario tendrá acceso a todos los datos del sistema'
              : assignmentType === 'business_unit'
              ? `Acceso a todas las plantas de la unidad ${businessUnits.find(bu => bu.id === selectedBusinessUnitId)?.name || 'seleccionada'}`
              : `Acceso únicamente a la planta ${availablePlants.find(p => p.id === selectedPlantId)?.name || 'seleccionada'}`
            }
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={handleSave}
          disabled={loading || (assignmentType === 'plant' && !selectedPlantId) || (assignmentType === 'business_unit' && !selectedBusinessUnitId)}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-3 py-1 rounded-md flex items-center text-sm"
        >
          <Save className="h-4 w-4 mr-1" />
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded-md flex items-center text-sm"
        >
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </button>
      </div>
    </div>
  );
} 