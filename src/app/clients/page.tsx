'use client';

import React, { useState, useEffect } from 'react';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import { clientService } from '@/lib/supabase/clients';

interface Client {
  id: string;
  business_name: string;
  client_code: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadClients = async () => {
      try {
        setLoading(true);
        const data = await clientService.getAllClients();
        setClients(data);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar los clientes';
        setError(errorMessage);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadClients();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Clientes</h1>
        
        <RoleProtectedButton
          allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
          onClick={() => {
            alert('Formulario de creación de cliente próximamente');
          }}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          showDisabled={true}
        >
          Crear Nuevo Cliente
        </RoleProtectedButton>
      </div>
      
      {loading ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-gray-400 rounded-full" role="status">
            <span className="sr-only">Cargando...</span>
          </div>
          <p className="mt-2 text-gray-600">Cargando clientes...</p>
        </div>
      ) : error ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-red-500">{error}</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-600">No hay clientes registrados.</p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre de Empresa
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {client.client_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.business_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button 
                          className="text-indigo-600 hover:text-indigo-900"
                          onClick={() => {
                            alert(`Ver detalles de ${client.business_name}`);
                          }}
                        >
                          Ver
                        </button>
                        
                        <RoleProtectedButton
                          allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
                          onClick={() => {
                            alert(`Editar ${client.business_name} próximamente`);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Editar
                        </RoleProtectedButton>
                        
                        <RoleProtectedButton
                          allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}
                          onClick={() => {
                            alert(`Eliminar ${client.business_name} próximamente`);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Eliminar
                        </RoleProtectedButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <RoleProtectedSection
        allowedRoles={['EXECUTIVE']}
        action="ver estadísticas avanzadas de clientes"
        className="mt-8"
      >
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Estadísticas de Clientes (Solo Ejecutivos)</h2>
          <p className="text-gray-600 mb-4">Esta sección muestra estadísticas avanzadas solo visibles para ejecutivos.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-medium text-blue-800">Total de Clientes</h3>
              <p className="text-2xl font-bold">{clients.length}</p>
            </div>
            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="font-medium text-green-800">Clientes Activos</h3>
              <p className="text-2xl font-bold">Próximamente</p>
            </div>
            <div className="border rounded-lg p-4 bg-purple-50">
              <h3 className="font-medium text-purple-800">Clientes Nuevos (30 días)</h3>
              <p className="text-2xl font-bold">Próximamente</p>
            </div>
          </div>
        </div>
      </RoleProtectedSection>
    </div>
  );
} 