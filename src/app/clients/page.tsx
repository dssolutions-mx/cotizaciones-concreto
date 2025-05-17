'use client';

import React, { useState, useEffect } from 'react';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import { clientService } from '@/lib/supabase/clients';
import { useRouter } from 'next/navigation';

interface Client {
  id: string;
  business_name: string;
  client_code: string;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  useEffect(() => {
    loadClients();
  }, []);

  const handleDeleteClient = async (clientId: string, businessName: string) => {
    if (!confirm(`¿Estás seguro de eliminar el cliente "${businessName}"?`)) {
      return;
    }
    
    try {
      setIsDeleting(true);
      await clientService.deleteClient(clientId);
      // Recargar la lista después de eliminar
      await loadClients();
      // Mostrar mensaje de éxito
      alert('Cliente eliminado correctamente');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar el cliente';
      alert(`Error: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.client_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Gestión de Clientes</h1>
        
        <RoleProtectedButton
          allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
          onClick={() => router.push('/clients/new')}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          showDisabled={true}
        >
          Crear Nuevo Cliente
        </RoleProtectedButton>
      </div>
      
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar cliente por nombre o código..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {loading || isDeleting ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-gray-400 rounded-full" role="status">
            <span className="sr-only">Cargando...</span>
          </div>
          <p className="mt-2 text-gray-600">
            {isDeleting ? 'Eliminando cliente...' : 'Cargando clientes...'}
          </p>
        </div>
      ) : error ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-red-500">{error}</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-600">
            {clients.length === 0 ? 'No hay clientes registrados.' : 'No se encontraron clientes con ese criterio de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Nombre de Empresa
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                      {client.client_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {client.business_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-3">
                        <button 
                          className="text-indigo-600 hover:text-indigo-800 font-medium py-1 px-3 rounded-md hover:bg-indigo-50 transition-colors duration-150"
                          onClick={() => {
                            router.push(`/clients/${client.id}`);
                          }}
                        >
                          Ver
                        </button>
                        
                        <RoleProtectedButton
                          allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
                          onClick={() => {
                            router.push(`/clients/${client.id}/edit`);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium py-1 px-3 rounded-md hover:bg-blue-50 transition-colors duration-150"
                        >
                          Editar
                        </RoleProtectedButton>
                        
                        <RoleProtectedButton
                          allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}
                          onClick={() => handleDeleteClient(client.id, client.business_name)}
                          className="text-red-600 hover:text-red-800 font-medium py-1 px-3 rounded-md hover:bg-red-50 transition-colors duration-150"
                          disabled={isDeleting}
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
        <div className="bg-white shadow-lg rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Estadísticas de Clientes (Solo Ejecutivos)</h2>
          <p className="text-gray-600 mb-4">Esta sección muestra estadísticas avanzadas solo visibles para ejecutivos.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 shadow-sm">
              <h3 className="font-semibold text-blue-700">Total de Clientes</h3>
              <p className="text-3xl font-bold text-blue-800">{filteredClients.length}</p>
            </div>
            <div className="border border-green-200 rounded-lg p-4 bg-green-50 shadow-sm">
              <h3 className="font-semibold text-green-700">Clientes Activos</h3>
              <p className="text-2xl font-bold text-green-800">Próximamente</p>
            </div>
            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50 shadow-sm">
              <h3 className="font-semibold text-purple-700">Clientes Nuevos (30 días)</h3>
              <p className="text-2xl font-bold text-purple-800">Próximamente</p>
            </div>
          </div>
        </div>
      </RoleProtectedSection>
    </div>
  );
} 