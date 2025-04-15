'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientService } from '@/lib/supabase/clients';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';

// Interfaces para tipado
interface Client {
  id: string;
  business_name: string;
  client_code: string;
  rfc: string;
  requires_invoice: boolean;
  address: string;
  contact_name: string;
  email: string;
  phone: string;
  credit_status: string;
}

interface ConstructionSite {
  id: string;
  name: string;
  location: string;
  access_restrictions: string;
  special_conditions: string;
  client_id: string;
  created_at: string;
  is_active: boolean;
}

// Nuevas interfaces para pagos
interface ClientPayment {
  id: string;
  client_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string;
  notes: string;
  construction_site: string | null;
  created_at: string;
}

interface ClientBalance {
  client_id: string;
  construction_site: string | null;
  current_balance: number;
  last_updated: string;
}

// Componente para nuevos sitios
function NewSiteForm({ clientId, onSiteAdded }: { clientId: string, onSiteAdded: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [siteData, setSiteData] = useState({
    name: '',
    location: '',
    access_restrictions: '',
    special_conditions: '',
    is_active: true
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSiteData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    if (!siteData.name.trim()) {
      alert('El nombre de la obra es obligatorio');
      return;
    }

    setIsSubmitting(true);
    try {
      await clientService.createSite(clientId, siteData);
      setSiteData({
        name: '',
        location: '',
        access_restrictions: '',
        special_conditions: '',
        is_active: true
      });
      setShowForm(false);
      onSiteAdded();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al crear la obra';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <div className="mt-6">
        <RoleProtectedButton
          allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
          onClick={() => setShowForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Agregar Nueva Obra
        </RoleProtectedButton>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-gray-50 p-4 rounded-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Nueva Obra</h3>
        <button 
          onClick={() => setShowForm(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="mb-3">
          <label htmlFor="site_name" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la Obra *
          </label>
          <input
            type="text"
            id="site_name"
            name="name"
            value={siteData.name}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="site_location" className="block text-sm font-medium text-gray-700 mb-1">
            Ubicación
          </label>
          <input
            type="text"
            id="site_location"
            name="location"
            value={siteData.location}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="site_access_restrictions" className="block text-sm font-medium text-gray-700 mb-1">
            Restricciones de Acceso
          </label>
          <textarea
            id="site_access_restrictions"
            name="access_restrictions"
            value={siteData.access_restrictions}
            onChange={handleChange}
            rows={2}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="site_special_conditions" className="block text-sm font-medium text-gray-700 mb-1">
            Condiciones Especiales
          </label>
          <textarea
            id="site_special_conditions"
            name="special_conditions"
            value={siteData.special_conditions}
            onChange={handleChange}
            rows={2}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estado de la Obra
          </label>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={siteData.is_active}
              onChange={(e) => {
                setSiteData(prev => ({
                  ...prev,
                  is_active: e.target.checked
                }));
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              Obra Activa
            </label>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={handleSubmit}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Obra'}
        </button>
      </div>
    </div>
  );
}

// Componente para formulario de pagos
function ClientPaymentForm({ 
  clientId, 
  sites, 
  onPaymentAdded 
}: { 
  clientId: string, 
  sites: ConstructionSite[], 
  onPaymentAdded: () => void 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'TRANSFER',
    reference_number: '',
    notes: '',
    construction_site: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      alert('El monto del pago debe ser mayor a cero');
      return;
    }

    setIsSubmitting(true);
    try {
      // Convertir el monto a número
      const amount = parseFloat(paymentData.amount);
      
      // Preparar datos para envío
      const paymentToSubmit = {
        ...paymentData,
        amount,
        construction_site: paymentData.construction_site || null,
        payment_date: new Date().toISOString()
      };
      
      // Check if createPayment exists in clientService
      if (typeof clientService.createPayment === 'function') {
        // Llamar al servicio para registrar el pago
        await clientService.createPayment(clientId, paymentToSubmit);
      } else {
        console.log('Note: clientService.createPayment not implemented yet');
        console.log('Payment data:', paymentToSubmit);
        
        // Mock successful payment for UI flow
        setTimeout(() => {
          alert('Funcionalidad de pago aún no implementada en el backend');
        }, 500);
      }
      
      // Limpiar formulario
      setPaymentData({
        amount: '',
        payment_method: 'TRANSFER',
        reference_number: '',
        notes: '',
        construction_site: '',
      });
      
      onPaymentAdded();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al registrar el pago';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 bg-gray-50 p-4 rounded-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Nuevo Pago</h3>
        <button 
          onClick={onPaymentAdded}
          className="text-gray-500 hover:text-gray-700"
        >
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="mb-3">
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
            Monto del Pago *
          </label>
          <input
            type="number"
            id="amount"
            name="amount"
            value={paymentData.amount}
            onChange={handleChange}
            min="0"
            step="0.01"
            className="w-full p-2 border border-gray-300 rounded-md"
            required
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700 mb-1">
            Método de Pago
          </label>
          <select
            id="payment_method"
            name="payment_method"
            value={paymentData.payment_method}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="CASH">Efectivo</option>
            <option value="TRANSFER">Transferencia</option>
            <option value="CHECK">Cheque</option>
            <option value="CREDIT_CARD">Tarjeta de Crédito</option>
            <option value="OTHER">Otro</option>
          </select>
        </div>
        
        <div className="mb-3">
          <label htmlFor="reference_number" className="block text-sm font-medium text-gray-700 mb-1">
            Referencia
          </label>
          <input
            type="text"
            id="reference_number"
            name="reference_number"
            value={paymentData.reference_number}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Número de transferencia, cheque, etc."
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="construction_site" className="block text-sm font-medium text-gray-700 mb-1">
            Obra Específica (opcional)
          </label>
          <select
            id="construction_site"
            name="construction_site"
            value={paymentData.construction_site}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">-- Aplicar a todas las obras --</option>
            {sites.map(site => (
              <option key={site.id} value={site.name}>{site.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Si no selecciona una obra, el pago se distribuirá automáticamente comenzando por las obras más antiguas.
          </p>
        </div>
        
        <div className="mb-3 md:col-span-2">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notas
          </label>
          <textarea
            id="notes"
            name="notes"
            value={paymentData.notes}
            onChange={handleChange}
            rows={2}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>
      
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={handleSubmit}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-green-300"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Procesando...' : 'Registrar Pago'}
        </button>
      </div>
    </div>
  );
}

// Componente para mostrar balance del cliente
function ClientBalanceSummary({ balances }: { balances: ClientBalance[] }) {
  // Encontrar el balance general (sin obra específica)
  const generalBalance = balances.find(balance => balance.construction_site === null);
  
  // Filtrar los balances por obra
  const siteBalances = balances.filter(balance => balance.construction_site !== null);
  
  return (
    <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Balance del Cliente</h2>
      
      {/* Balance general */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-gray-700 font-medium">Balance Total</span>
          <span className={`text-lg font-bold ${generalBalance && generalBalance.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ${generalBalance ? generalBalance.current_balance.toFixed(2) : '0.00'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Actualizado: {generalBalance ? new Date(generalBalance.last_updated).toLocaleString() : 'No disponible'}
        </p>
      </div>
      
      {/* Balances por obra */}
      {siteBalances.length > 0 && (
        <div>
          <h3 className="text-md font-medium mb-2">Balances por Obra</h3>
          <div className="space-y-2">
            {siteBalances.map((balance, index) => (
              <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-700">{balance.construction_site}</span>
                <span className={`font-medium ${balance.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${balance.current_balance.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para mostrar historial de pagos
function ClientPaymentsList({ payments }: { payments: ClientPayment[] }) {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3">Historial de Pagos</h3>
      
      {payments.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No hay pagos registrados para este cliente.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referencia</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Obra</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="py-2 px-3 text-sm text-gray-900">
                    {new Date(payment.payment_date).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-3 text-sm font-medium text-gray-900">
                    ${payment.amount.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-500">
                    {payment.payment_method === 'CASH' && 'Efectivo'}
                    {payment.payment_method === 'TRANSFER' && 'Transferencia'}
                    {payment.payment_method === 'CHECK' && 'Cheque'}
                    {payment.payment_method === 'CREDIT_CARD' && 'Tarjeta de Crédito'}
                    {payment.payment_method === 'OTHER' && 'Otro'}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-500">{payment.reference_number}</td>
                  <td className="py-2 px-3 text-sm text-gray-500">
                    {payment.construction_site || "Distribución automática"}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-500">{payment.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ClientDetailContent({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [balances, setBalances] = useState<ClientBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [activeTab, setActiveTab] = useState('sites'); // 'sites', 'payments'

  const loadSites = useCallback(async () => {
    try {
      const sitesData = await clientService.getClientSites(clientId);
      setSites(sitesData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar las obras';
      setError(errorMessage);
    }
  }, [clientId]);

  const loadPayments = useCallback(async () => {
    try {
      // Check if getClientPayments exists in clientService
      if (typeof clientService.getClientPayments === 'function') {
        const paymentsData = await clientService.getClientPayments(clientId);
        setPayments(paymentsData);
      } else {
        console.log('Note: clientService.getClientPayments not implemented yet');
        // Set empty payments array to avoid errors
        setPayments([]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar los pagos';
      console.error(errorMessage);
    }
  }, [clientId]);

  const loadBalances = useCallback(async () => {
    try {
      // Check if getClientBalances exists in clientService
      if (typeof clientService.getClientBalances === 'function') {
        const balancesData = await clientService.getClientBalances(clientId);
        setBalances(balancesData);
      } else {
        console.log('Note: clientService.getClientBalances not implemented yet');
        // Set empty balances array to avoid errors
        setBalances([]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar los balances';
      console.error(errorMessage);
    }
  }, [clientId]);

  const loadClientData = useCallback(async () => {
    try {
      setLoading(true);
      const [clientData, sitesData] = await Promise.all([
        clientService.getClientById(clientId),
        clientService.getClientSites(clientId)
      ]);
      setClient(clientData);
      setSites(sitesData);
      setError(null);
      
      // Cargar pagos y balances después de lo esencial
      loadPayments();
      loadBalances();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar los datos del cliente';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [clientId, loadPayments, loadBalances]);

  useEffect(() => {
    loadClientData();
  }, [loadClientData]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 text-center">
        <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-gray-400 rounded-full" role="status">
          <span className="sr-only">Cargando...</span>
        </div>
        <p className="mt-2 text-gray-600">Cargando información del cliente...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-md">
          <p>{error}</p>
          <button 
            onClick={() => router.push('/clients')}
            className="mt-2 text-blue-600 hover:underline"
          >
            Volver a la lista de clientes
          </button>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-md">
          <p>No se encontró el cliente solicitado.</p>
          <Link href="/clients" className="mt-2 text-blue-600 hover:underline">
            Volver a la lista de clientes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/clients" className="flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Volver a lista de clientes
        </Link>
      </div>

      {/* Actions Header */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{client.business_name}</h1>
        <div className="flex space-x-2">
          <RoleProtectedButton
            allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}
            onClick={() => setShowPaymentForm(prev => !prev)}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            showDisabled={true}
          >
            {showPaymentForm ? 'Ocultar Registro de Pago' : 'Registrar Pago'}
          </RoleProtectedButton>
          <RoleProtectedButton
            allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
            onClick={() => router.push(`/clients/${clientId}/edit`)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Editar Cliente
          </RoleProtectedButton>
        </div>
      </div>

      {/* Conditionally render Payment Form */}
      {showPaymentForm && (
        <div className="mb-6">
           <ClientPaymentForm 
              clientId={clientId} 
              sites={sites} 
              onPaymentAdded={() => {
                loadPayments();
                loadBalances();
                setShowPaymentForm(false); // Hide form after adding
              }} 
            />
        </div>
      )}

      {loading ? (
        <div>Cargando...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : client ? (
        <div>
          <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">{client.business_name}</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Estado de Crédito</p>
                <p className="font-medium">
                  {client.credit_status === 'ACTIVE' && <span className="text-green-600">Activo</span>}
                  {client.credit_status === 'SUSPENDED' && <span className="text-yellow-600">Suspendido</span>}
                  {client.credit_status === 'BLACKLISTED' && <span className="text-red-600">Lista Negra</span>}
                  {!client.credit_status && <span className="text-gray-600">No especificado</span>}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Facturación</p>
                <p className="font-medium">
                  {client.requires_invoice 
                    ? <span className="text-green-600">Requiere factura</span> 
                    : <span className="text-gray-600">No requiere factura</span>}
                </p>
                {client.requires_invoice && client.rfc && (
                  <p className="text-sm mt-1">RFC: {client.rfc}</p>
                )}
              </div>
              
              {client.address && (
                <div>
                  <p className="text-sm text-gray-500">Dirección</p>
                  <p className="font-medium">{client.address}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Información de Contacto</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Nombre de Contacto</p>
                <p className="font-medium">{client.contact_name}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Teléfono</p>
                <p className="font-medium">{client.phone}</p>
              </div>
              
              {client.email && (
                <div>
                  <p className="text-sm text-gray-500">Correo Electrónico</p>
                  <p className="font-medium">{client.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Balance Summary Section - Visible to more roles */}
          {balances.length > 0 && (
            <RoleProtectedButton
              allowedRoles={['PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR', 'SALES_AGENT']}
              onClick={() => {}}
              className="p-0 block w-full text-left"
            >
              <ClientBalanceSummary balances={balances} />
            </RoleProtectedButton>
          )}

          {/* Tabs para Obras y Pagos */}
          <div className="mb-6 border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('sites')}
                className={`py-2 px-4 text-center font-medium text-sm border-b-2 ${
                  activeTab === 'sites'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Obras
              </button>
              <RoleProtectedButton
                allowedRoles={['PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR', 'SALES_AGENT']}
                onClick={() => setActiveTab('payments')}
                className={`py-2 px-4 text-center font-medium text-sm border-b-2 ${
                  activeTab === 'payments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Pagos
              </RoleProtectedButton>
            </nav>
          </div>

          {/* Contenido de la pestaña activa */}
          {activeTab === 'sites' && (
            <div>
              <h3 className="text-xl font-bold mb-4">Obras del Cliente</h3>
              <NewSiteForm clientId={clientId} onSiteAdded={() => loadSites()} />
              {sites.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-gray-500 mb-4">Este cliente no tiene obras registradas.</p>
                  {!showPaymentForm && (
                    <RoleProtectedButton
                      allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
                      onClick={() => setShowPaymentForm(true)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Agregar primera obra
                    </RoleProtectedButton>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {sites.map((site) => (
                    <div key={site.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="grow">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-gray-900">{site.name}</h3>
                            <span className={`px-3 py-1 text-xs font-medium rounded-full flex items-center ${
                              site.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              <span className={`w-2 h-2 rounded-full mr-2 ${
                                site.is_active ? 'bg-green-600' : 'bg-red-600'
                              }`}></span>
                              {site.is_active ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            {site.location && (
                              <div>
                                <span className="font-medium text-gray-700">Ubicación:</span> {site.location}
                              </div>
                            )}
                            {site.access_restrictions && (
                              <div>
                                <span className="font-medium text-gray-700">Restricciones:</span> {site.access_restrictions}
                              </div>
                            )}
                            {site.special_conditions && (
                              <div>
                                <span className="font-medium text-gray-700">Condiciones:</span> {site.special_conditions}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-end md:justify-center space-x-2">
                          <RoleProtectedButton
                            allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
                            onClick={async () => {
                              if (confirm(`¿Estás seguro de que deseas marcar esta obra como ${site.is_active ? 'inactiva' : 'activa'}?`)) {
                                try {
                                  await clientService.updateSiteStatus(site.id, !site.is_active);
                                  loadClientData();
                                } catch (error) {
                                  const errorMessage = error instanceof Error ? error.message : 'Error al actualizar el estado de la obra';
                                  alert(errorMessage);
                                }
                              }
                            }}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                              site.is_active
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              {site.is_active ? (
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              ) : (
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              )}
                            </svg>
                            <span>{site.is_active ? 'Desactivar' : 'Activar'}</span>
                          </RoleProtectedButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              <h3 className="text-xl font-bold mb-4">Historial de Pagos del Cliente</h3>
              <ClientPaymentsList payments={payments} />
            </div>
          )}
        </div>
      ) : (
        <div>No se encontró el cliente</div>
      )}
    </div>
  );
} 