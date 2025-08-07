'use client';

import React, { useState, useEffect } from 'react';
import { recipeService } from '@/lib/supabase/recipes';
import { Material } from '@/types/recipes';
import { usePlantContext } from '@/contexts/PlantContext';
import { Plus, Edit, Trash2, Eye, Search } from 'lucide-react';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import AddMaterialModal from '@/components/materials/AddMaterialModal';
import EditMaterialModal from '@/components/materials/EditMaterialModal';
import { showSuccess, showError } from '@/lib/utils/toast';

export default function MaterialsManagementPage() {
  const { currentPlant } = usePlantContext();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null);

  useEffect(() => {
    loadMaterials();
  }, [currentPlant]);

  const loadMaterials = async () => {
    try {
      setIsLoading(true);
      const materialsData = await recipeService.getMaterials(currentPlant?.id);
      setMaterials(materialsData);
    } catch (error) {
      console.error('Error loading materials:', error);
      setError('Error al cargar los materiales');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaterialSuccess = () => {
    loadMaterials();
  };

  const handleEditMaterial = (material: Material) => {
    setMaterialToEdit(material);
    setShowEditModal(true);
  };

  const handleDeleteMaterial = async (material: Material) => {
    if (confirm(`¿Está seguro de que desea eliminar el material "${material.material_name}"?`)) {
      try {
        await recipeService.deleteMaterial(material.id);
        showSuccess('Material eliminado exitosamente');
        loadMaterials();
      } catch (error) {
        console.error('Error deleting material:', error);
        showError('Error al eliminar el material');
      }
    }
  };

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.material_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || material.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(materials.map(m => m.category)));

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'cemento': 'Cemento',
      'agregado': 'Agregado',
      'aditivo': 'Aditivo',
      'agua': 'Agua'
    };
    return labels[category] || category;
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        isActive 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        {isActive ? 'Activo' : 'Inactivo'}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <p>Cargando materiales...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Materiales</h1>
        
        <RoleProtectedButton
          allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
          onClick={() => setShowAddModal(true)}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 inline-flex items-center gap-2"
          showDisabled={true}
          disabledMessage="Solo el equipo de calidad y ejecutivos pueden agregar materiales"
        >
          <Plus size={18} />
          Agregar Material
        </RoleProtectedButton>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar Materiales
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {getCategoryLabel(category)}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Material
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMaterials.map((material) => (
                <tr key={material.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {material.material_name}
                      </div>
                      {material.subcategory && (
                        <div className="text-sm text-gray-500">
                          {material.subcategory}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {material.material_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getCategoryLabel(material.category)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {material.unit_of_measure}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(material.is_active)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedMaterial(material)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Ver detalles"
                      >
                        <Eye size={16} />
                      </button>
                      <RoleProtectedButton
                        allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
                        onClick={() => handleEditMaterial(material)}
                        className="text-green-600 hover:text-green-900"
                        showDisabled={false}
                      >
                        <Edit size={16} />
                      </RoleProtectedButton>
                      <RoleProtectedButton
                        allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
                        onClick={() => handleDeleteMaterial(material)}
                        className="text-red-600 hover:text-red-900"
                        showDisabled={false}
                      >
                        <Trash2 size={16} />
                      </RoleProtectedButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredMaterials.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No se encontraron materiales</p>
          </div>
        )}
      </div>

      {/* Material Details Modal */}
      {selectedMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Detalles del Material</h2>
              <button
                onClick={() => setSelectedMaterial(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Información Básica</h3>
                <div className="space-y-2">
                  <p><span className="font-medium">Nombre:</span> {selectedMaterial.material_name}</p>
                  <p><span className="font-medium">Código:</span> {selectedMaterial.material_code}</p>
                  <p><span className="font-medium">Categoría:</span> {getCategoryLabel(selectedMaterial.category)}</p>
                  {selectedMaterial.subcategory && (
                    <p><span className="font-medium">Subcategoría:</span> {selectedMaterial.subcategory}</p>
                  )}
                  <p><span className="font-medium">Unidad de Medida:</span> {selectedMaterial.unit_of_measure}</p>
                  <p><span className="font-medium">Estado:</span> {getStatusBadge(selectedMaterial.is_active)}</p>
                </div>
              </div>

              {/* Technical Properties */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Propiedades Técnicas</h3>
                <div className="space-y-2">
                  {selectedMaterial.density && (
                    <p><span className="font-medium">Densidad:</span> {selectedMaterial.density} kg/m³</p>
                  )}
                  {selectedMaterial.specific_gravity && (
                    <p><span className="font-medium">Gravedad Específica:</span> {selectedMaterial.specific_gravity}</p>
                  )}
                  {selectedMaterial.absorption_rate && (
                    <p><span className="font-medium">Absorción:</span> {selectedMaterial.absorption_rate}%</p>
                  )}
                  {selectedMaterial.fineness_modulus && (
                    <p><span className="font-medium">Módulo de Fineza:</span> {selectedMaterial.fineness_modulus}</p>
                  )}
                  {selectedMaterial.strength_class && (
                    <p><span className="font-medium">Clase de Resistencia:</span> {selectedMaterial.strength_class}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Supplier Information */}
            {(selectedMaterial.primary_supplier || selectedMaterial.supplier_code) && (
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-3">Información del Proveedor</h3>
                <div className="space-y-2">
                  {selectedMaterial.primary_supplier && (
                    <p><span className="font-medium">Proveedor Principal:</span> {selectedMaterial.primary_supplier}</p>
                  )}
                  {selectedMaterial.supplier_code && (
                    <p><span className="font-medium">Código del Proveedor:</span> {selectedMaterial.supplier_code}</p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedMaterial(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-md hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      <AddMaterialModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleMaterialSuccess}
        plantId={currentPlant?.id}
      />

      {/* Edit Material Modal */}
      <EditMaterialModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setMaterialToEdit(null);
        }}
        onSuccess={handleMaterialSuccess}
        material={materialToEdit}
      />
    </div>
  );
} 