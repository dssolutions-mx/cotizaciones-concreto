'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { clientService } from '@/lib/supabase/clients';
import { orderService } from '@/lib/supabase/orders';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import PaymentForm from '@/components/clients/PaymentForm';
import BalanceAdjustmentModal from '@/components/clients/BalanceAdjustmentModal';
import { BalanceAdjustmentHistory } from '@/components/clients/BalanceAdjustmentHistory';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { subMonths } from 'date-fns';
// Import types from the new file
import { Client, ConstructionSite as BaseConstructionSite, ClientPayment, ClientBalance } from '@/types/client';
import { OrderWithClient } from '@/types/orders';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from "sonner";
// Import for map components
import dynamic from 'next/dynamic';
import { Badge } from "@/components/ui/badge";
// Import icons
import { Pencil, Trash2, Plus, X, Save, Map } from "lucide-react";
import { authService } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';
import ClientLogoManager from '@/components/clients/ClientLogoManager';

// Extended type with coordinates
interface ConstructionSite extends BaseConstructionSite {
  latitude?: number | null;
  longitude?: number | null;
}

// Dynamically import map components with no SSR to avoid window errors
const GoogleMapSelector = dynamic(
  () => import('@/components/maps/GoogleMapSelector'),
  { ssr: false }
);

const GoogleMapWrapper = dynamic(
  () => import('@/components/maps/GoogleMapWrapper'),
  { ssr: false }
);

// Dynamically import the LocationSearchBox
const LocationSearchBox = dynamic(
  () => import('@/components/maps/LocationSearchBox'),
  { ssr: false }
);

// Custom Switch component since @/components/ui/switch doesn't exist
const Switch = ({ checked, onCheckedChange, disabled }: { 
  checked: boolean; 
  onCheckedChange: (checked: boolean) => void; 
  disabled?: boolean 
}) => {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors 
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 
                 ${checked ? 'bg-green-500' : 'bg-gray-200'} 
                 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out
                   ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
};

// Componente para nuevos sitios
function NewSiteForm({ clientId, onSiteAdded }: { clientId: string, onSiteAdded: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [siteData, setSiteData] = useState({
    name: '',
    location: '',
    access_restrictions: '',
    special_conditions: '',
    is_active: true,
    latitude: null as number | null,
    longitude: null as number | null
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSiteData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Memoized callback for map location selection to prevent excessive re-renders
  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setSiteData(prev => {
      // Only update if values actually changed
      if (prev.latitude === lat && prev.longitude === lng) {
        return prev;
      }
      return {
        ...prev,
        latitude: lat,
        longitude: lng
      };
    });
  }, []);

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
        is_active: true,
        latitude: null,
        longitude: null
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
          allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Agregar Nueva Obra</span>
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
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X className="h-4 w-4" />
          <span>Cancelar</span>
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
      
      {/* Map for selecting coordinates */}
      <div className="mt-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ubicación en el Mapa
        </label>
        <p className="text-sm text-gray-500 mb-2">
          Haz clic en el mapa para seleccionar las coordenadas exactas de la obra
        </p>
        <GoogleMapWrapper>
          <GoogleMapSelector 
            onSelectLocation={handleLocationSelect} 
            height="400px"
            initialPosition={siteData.latitude && siteData.longitude ? 
              { lat: siteData.latitude, lng: siteData.longitude } : null}
          />
        </GoogleMapWrapper>
        
        {/* Display coordinates if selected */}
        {siteData.latitude && siteData.longitude && (
          <div className="mt-2 text-sm">
            <p>Coordenadas seleccionadas: {siteData.latitude.toFixed(6)}, {siteData.longitude.toFixed(6)}</p>
          </div>
        )}
      </div>
      
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={handleSubmit}
          className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-blue-300 transition-colors"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>Guardar Obra</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Componente para editar sitios existentes
function EditSiteForm({ site, clientId, onSiteUpdated, onCancel }: { site: ConstructionSite, clientId: string, onSiteUpdated: () => void, onCancel: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [siteData, setSiteData] = useState<Partial<ConstructionSite>>({
    name: site.name,
    location: site.location,
    access_restrictions: site.access_restrictions,
    special_conditions: site.special_conditions,
    is_active: site.is_active,
    latitude: site.latitude,
    longitude: site.longitude
  });
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted state for map components
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSiteData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLocationSelect = useCallback((lat: number, lng: number, address?: string) => {
    setSiteData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      // Update location field if an address was provided from search
      ...(address ? { location: address } : {})
    }));
  }, []);

  const handleSubmit = async () => {
    if (!siteData.name?.trim()) {
      alert('El nombre de la obra es obligatorio');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!site.id) {
        alert('Error: ID de la obra no encontrado.');
        setIsSubmitting(false);
        return;
      }
      // Ensure all necessary fields are passed to updateSite
      const updateData = {
        name: siteData.name,
        location: siteData.location,
        access_restrictions: siteData.access_restrictions,
        special_conditions: siteData.special_conditions,
        is_active: siteData.is_active ?? true, // Default to true if undefined
        latitude: siteData.latitude,
        longitude: siteData.longitude
      };
      await clientService.updateSite(clientId, site.id, updateData);
      toast.success("Obra actualizada con éxito");
      onSiteUpdated();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar la obra';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 bg-gray-50 p-4 rounded-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Editar Obra: {site.name}</h3>
        <button 
          onClick={onCancel}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X className="h-4 w-4" />
          <span>Cancelar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="mb-3">
          <label htmlFor={`edit_site_name_${site.id}`} className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la Obra *
          </label>
          <input
            type="text"
            id={`edit_site_name_${site.id}`}
            name="name"
            value={siteData.name || ''}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor={`edit_site_location_${site.id}`} className="block text-sm font-medium text-gray-700 mb-1">
            Ubicación
          </label>
          <input
            type="text"
            id={`edit_site_location_${site.id}`}
            name="location"
            value={siteData.location || ''}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor={`edit_site_access_restrictions_${site.id}`} className="block text-sm font-medium text-gray-700 mb-1">
            Restricciones de Acceso
          </label>
          <textarea
            id={`edit_site_access_restrictions_${site.id}`}
            name="access_restrictions"
            value={siteData.access_restrictions || ''}
            onChange={handleChange}
            rows={2}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor={`edit_site_special_conditions_${site.id}`} className="block text-sm font-medium text-gray-700 mb-1">
            Condiciones Especiales
          </label>
          <textarea
            id={`edit_site_special_conditions_${site.id}`}
            name="special_conditions"
            value={siteData.special_conditions || ''}
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
              id={`edit_is_active_${site.id}`}
              name="is_active"
              checked={siteData.is_active ?? true}
              onChange={(e) => {
                setSiteData(prev => ({
                  ...prev,
                  is_active: e.target.checked
                }));
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor={`edit_is_active_${site.id}`} className="ml-2 text-sm text-gray-700">
              Obra Activa
            </label>
          </div>
        </div>

        <div className="md:col-span-2 mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Coordenadas Geográficas (Opcional)
          </label>
          
          {/* Add the location search box */}
          {isMounted && (
            <LocationSearchBox onSelectLocation={handleLocationSelect} />
          )}
          
          {/* Map for selecting location */}
          <GoogleMapWrapper>
            <GoogleMapSelector 
              onSelectLocation={handleLocationSelect} 
              height="400px"
              initialPosition={
                siteData.latitude && siteData.longitude 
                  ? { lat: siteData.latitude, lng: siteData.longitude } 
                  : undefined
              } 
            />
          </GoogleMapWrapper>
          {siteData.latitude && siteData.longitude && (
            <p className="text-xs text-gray-500 mt-1">
              Lat: {siteData.latitude.toFixed(6)}, Lng: {siteData.longitude.toFixed(6)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Actualizando...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Actualizar Obra</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Componente para mostrar balance del cliente (Refactored with Shadcn Card)
function ClientBalanceSummary({ balances }: { balances: ClientBalance[] }) {
  const generalBalance = balances.find(balance => balance.construction_site === null);
  const siteBalances = balances.filter(balance => balance.construction_site !== null);

  // Format balance helper
  const formatBal = (amount: number | undefined) => {
    return amount !== undefined ? formatCurrency(amount) : formatCurrency(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance del Cliente</CardTitle>
        {generalBalance?.last_updated && (
          <CardDescription>
            Última actualización: {formatDate(generalBalance.last_updated, 'PPP p')}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* General Balance */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-gray-700 font-medium">Balance Total</span>
            <span className={`text-lg font-bold ${generalBalance && generalBalance.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatBal(generalBalance?.current_balance)}
            </span>
          </div>
        </div>

        {/* Balances por obra */}
        {siteBalances.length > 0 && (
          <div>
            <h3 className="text-md font-semibold mb-2 text-gray-800">Desglose por Obra</h3>
            <div className="space-y-2">
              {siteBalances.map((balance, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                  <span className="text-sm text-gray-700 truncate pr-2" title={balance.construction_site || 'Desconocido'}>
                    {balance.construction_site || 'Obra Desconocida'}
                  </span>
                  <span className={`text-sm font-medium ${balance.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(balance.current_balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {balances.length === 0 && (
           <p className="text-sm text-center text-gray-500 py-4">No hay información de balance disponible.</p>
        )}
      </CardContent>
    </Card>
  );
}

// Desglose aritmético del saldo del cliente
function ClientBalanceBreakdown({
  clientId,
  orders,
  payments,
  balances
}: {
  clientId: string;
  orders: OrderWithClient[];
  payments: ClientPayment[];
  balances: ClientBalance[];
}) {
  const [deliveredOrderIds, setDeliveredOrderIds] = React.useState<Set<string>>(new Set());
  const [netAdjustments, setNetAdjustments] = React.useState<number>(0);
  const [adjustmentCount, setAdjustmentCount] = React.useState<number>(0);
  const [consumptionWithVat, setConsumptionWithVat] = React.useState<number>(0);
  const [orderRowsExtended, setOrderRowsExtended] = React.useState<Array<any>>([]);
  const [vatByPlant, setVatByPlant] = React.useState<Record<string, number>>({});
  const [adjustmentsList, setAdjustmentsList] = React.useState<any[]>([]);
  const [expandedSites, setExpandedSites] = React.useState<Set<string>>(new Set());
  const generalBalance = React.useMemo(() => balances.find(b => b.construction_site === null)?.current_balance || 0, [balances]);

  // Cargar remisiones por orden para determinar entregas (EXISTS remisiones)
  React.useEffect(() => {
    const loadRemisiones = async () => {
      try {
        const orderIds = (orders || []).map(o => o.id);
        if (orderIds.length === 0) {
          setDeliveredOrderIds(new Set());
          return;
        }
        const { data, error } = await supabase
          .from('remisiones')
          .select('order_id')
          .in('order_id', orderIds);
        if (error) {
          console.error('Error loading remisiones:', error);
          setDeliveredOrderIds(new Set());
          return;
        }
        const setIds = new Set<string>((data || []).map((r: any) => r.order_id));
        setDeliveredOrderIds(setIds);
      } catch (e) {
        console.error('Unexpected error loading remisiones:', e);
        setDeliveredOrderIds(new Set());
      }
    };
    loadRemisiones();
  }, [orders]);

  // Cargar ajustes y calcular neto (DEBT suma, CREDIT resta)
  React.useEffect(() => {
    const loadAdjustments = async () => {
      try {
        // Verificar existencia de la función antes de llamar con filtros
        const { error: testError } = await supabase.rpc('get_client_balance_adjustments', {});
        if (testError && testError.message?.includes('does not exist')) {
          setNetAdjustments(0);
          setAdjustmentCount(0);
          return;
        }
        const { data, error } = await supabase.rpc('get_client_balance_adjustments', { p_client_id: clientId });
        if (error) {
          console.error('Error loading adjustments:', error);
          setNetAdjustments(0);
          setAdjustmentCount(0);
          return;
        }
        const list = (data as any[]) || [];
        const net = list.reduce((sum, a: any) => {
          const amount = Number(a.amount) || 0;
          const dir = a.transfer_type === 'DEBT' ? 1 : -1; // DEBT incrementa saldo, CREDIT reduce
          return sum + dir * amount;
        }, 0);
        setNetAdjustments(net);
        setAdjustmentCount(list.length);
        setAdjustmentsList(list);
      } catch (e) {
        console.error('Unexpected error loading adjustments:', e);
        setNetAdjustments(0);
        setAdjustmentCount(0);
        setAdjustmentsList([]);
      }
    };
    loadAdjustments();
  }, [clientId]);

  // Consumo con IVA cuando aplique: usar invoice_amount si existe; si no, aplicar VAT por planta o 0.16
  React.useEffect(() => {
    const computeConsumptionWithVat = async () => {
      try {
        if (!orders || orders.length === 0 || deliveredOrderIds.size === 0) {
          setConsumptionWithVat(0);
          return;
        }
        const deliveredOrders = orders.filter(o => {
          const status = (o.order_status || '').toString().toLowerCase();
          const notCancelled = status !== 'cancelled' && status !== 'CANCELLED';
          const delivered = deliveredOrderIds.has(o.id);
          return notCancelled && delivered;
        });
        const deliveredIds = deliveredOrders.map(o => o.id);
        if (deliveredIds.length === 0) {
          setConsumptionWithVat(0);
          return;
        }
        // Fetch needed fields from orders
        const { data: orderRows, error: ordersErr } = await supabase
          .from('orders')
          .select('id, order_number, construction_site, final_amount, invoice_amount, requires_invoice, plant_id')
          .in('id', deliveredIds);
        if (ordersErr) {
          console.error('Error fetching orders for VAT computation:', ordersErr);
          // Fallback: sum final_amount
          const fallback = deliveredOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);
          setConsumptionWithVat(fallback);
          return;
        }
        const rows = orderRows || [];
        // Collect plant ids needing VAT rate
        const plantIds = Array.from(new Set(rows.map((r: any) => r.plant_id).filter(Boolean)));
        let vatByPlant: Record<string, number> = {};
        if (plantIds.length > 0) {
          const { data: plants, error: plantsErr } = await supabase
            .from('plants')
            .select('id, business_unit:business_unit_id(id, vat_rate)')
            .in('id', plantIds);
          if (!plantsErr && Array.isArray(plants)) {
            plants.forEach((p: any) => {
              const rate = p?.business_unit?.vat_rate;
              if (typeof rate === 'number') vatByPlant[p.id] = rate;
            });
          }
        }
        const DEFAULT_VAT = 0.16;
        const total = rows.reduce((sum: number, r: any) => {
          const finalAmount = Number(r.final_amount) || 0;
          const invoiceAmount = typeof r.invoice_amount === 'number' ? r.invoice_amount : null;
          const requiresInvoice = !!r.requires_invoice;
          if (!requiresInvoice) return sum + finalAmount;
          if (invoiceAmount !== null) return sum + invoiceAmount;
          const rate = (r.plant_id && typeof vatByPlant[r.plant_id] === 'number') ? vatByPlant[r.plant_id] : DEFAULT_VAT;
          return sum + finalAmount * (1 + rate);
        }, 0);
        setConsumptionWithVat(total);
        setOrderRowsExtended(rows);
        setVatByPlant(vatByPlant);
      } catch (e) {
        console.error('Unexpected error computing consumption with VAT:', e);
        // Fallback: sum final amounts without VAT
        const fallback = orders
          .filter(o => deliveredOrderIds.has(o.id))
          .reduce((sum, o) => sum + (o.final_amount || 0), 0);
        setConsumptionWithVat(fallback);
        setOrderRowsExtended([]);
      }
    };
    computeConsumptionWithVat();
  }, [orders, deliveredOrderIds]);

  // Pagos totales
  const totalPayments = React.useMemo(() => {
    if (!payments || payments.length === 0) return 0;
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  // Saldo esperado por aritmética
  const expectedBalance = React.useMemo(() => {
    return consumptionWithVat - totalPayments + netAdjustments;
  }, [consumptionWithVat, totalPayments, netAdjustments]);

  // Desglose por obra (usar balances existentes para mostrar el saldo actual por obra)
  const siteBalances = React.useMemo(() => balances.filter(b => b.construction_site !== null), [balances]);

  // Agrupar por obra (incluye "General" para null)
  const siteKeys = React.useMemo(() => {
    const keys = new Set<string>();
    balances.forEach(b => keys.add(b.construction_site || '::GENERAL'));
    (orderRowsExtended || []).forEach((r: any) => keys.add(r.construction_site || '::GENERAL'));
    (payments || []).forEach((p) => keys.add(p.construction_site || '::GENERAL'));
    if (keys.size === 0) keys.add('::GENERAL');
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [balances, orderRowsExtended, payments]);

  const perSiteBreakdown = React.useMemo(() => {
    const DEFAULT_VAT = 0.16;
    const computeOrderWithVat = (row: any) => {
      const finalAmount = Number(row.final_amount) || 0;
      const invoiceAmount = typeof row.invoice_amount === 'number' ? row.invoice_amount : null;
      const requiresInvoice = !!row.requires_invoice;
      if (!requiresInvoice) return finalAmount;
      if (invoiceAmount !== null) return invoiceAmount;
      const rate = (row.plant_id && typeof vatByPlant[row.plant_id] === 'number') ? vatByPlant[row.plant_id] : DEFAULT_VAT;
      return finalAmount * (1 + rate);
    };

    const bySite: Record<string, {
      label: string;
      consumptionWithVat: number;
      payments: number;
      adjustments: number;
      expected: number;
      currentBalance: number;
      orders: any[];
      sitePayments: ClientPayment[];
    }> = {};

    siteKeys.forEach(key => {
      const label = key === '::GENERAL' ? 'General' : key;
      const ordersForSite = (orderRowsExtended || []).filter((r: any) => (r.construction_site || '::GENERAL') === key && deliveredOrderIds.has(r.id));
      const consumption = ordersForSite.reduce((sum, r) => sum + computeOrderWithVat(r), 0);
      const paymentsForSite = (payments || []).filter(p => (p.construction_site || '::GENERAL') === key);
      const paymentsSum = paymentsForSite.reduce((s, p) => s + (p.amount || 0), 0);
      let adjustmentsSum = 0;
      (adjustmentsList || []).forEach((a: any) => {
        const dir = a.transfer_type === 'DEBT' ? 1 : -1; // DEBT incrementa saldo, CREDIT reduce
        if (a.adjustment_type === 'SITE_TRANSFER') {
          if ((a.source_site || '::GENERAL') === key) adjustmentsSum += dir * (Number(a.amount) || 0);
          if ((a.target_site || '::GENERAL') === key) adjustmentsSum += -dir * (Number(a.amount) || 0);
        } else if (a.adjustment_type === 'TRANSFER') {
          if (key === '::GENERAL') adjustmentsSum += dir * (Number(a.amount) || 0);
        } else if (a.adjustment_type === 'MANUAL_ADDITION') {
          const site = (a.source_site || '::GENERAL');
          if (site === key) adjustmentsSum += dir * (Number(a.amount) || 0);
        }
      });
      const current = balances.find(b => (b.construction_site || '::GENERAL') === key)?.current_balance || 0;
      const expected = consumption - paymentsSum + adjustmentsSum;
      bySite[key] = {
        label,
        consumptionWithVat: consumption,
        payments: paymentsSum,
        adjustments: adjustmentsSum,
        expected,
        currentBalance: current,
        orders: ordersForSite,
        sitePayments: paymentsForSite
      };
    });
    return bySite;
  }, [siteKeys, orderRowsExtended, deliveredOrderIds, vatByPlant, payments, adjustmentsList, balances]);

  const totals = React.useMemo(() => {
    const base = Object.values(perSiteBreakdown).reduce((acc, s) => {
      acc.consumptionWithVat += s.consumptionWithVat;
      acc.payments += s.payments;
      acc.adjustments += s.adjustments;
      acc.expected += s.expected;
      return acc;
    }, { consumptionWithVat: 0, payments: 0, adjustments: 0, expected: 0 });
    // IMPORTANT: Saldo actual en totales debe ser el balance general (no suma de obras)
    return { ...base, currentBalance: generalBalance } as { consumptionWithVat: number; payments: number; adjustments: number; expected: number; currentBalance: number };
  }, [perSiteBreakdown, generalBalance]);

  const toggleSite = (key: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <Card className="mt-4 overflow-x-auto">
      <CardHeader>
        <CardTitle>Cómo se calcula el saldo</CardTitle>
        <CardDescription>Consumo entregado − Pagos ± Ajustes = Saldo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border overflow-hidden">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Consumo entregado (incluye IVA cuando aplica)</TableCell>
                <TableCell className="text-right">{formatCurrency(consumptionWithVat)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Pagos</TableCell>
                <TableCell className="text-right text-green-700">− {formatCurrency(totalPayments)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Ajustes {adjustmentCount > 0 && <span className="text-xs text-muted-foreground">({adjustmentCount})</span>}</TableCell>
                <TableCell className={`text-right ${netAdjustments >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {netAdjustments >= 0 ? '+ ' : '− '}{formatCurrency(Math.abs(netAdjustments))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Saldo esperado</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(expectedBalance)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-sm text-muted-foreground">Saldo actual del sistema</TableCell>
                <TableCell className={`text-right font-medium ${generalBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>{formatCurrency(generalBalance)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="overflow-x-auto">
          <h3 className="text-md font-semibold mb-2 text-gray-800">Desglose por obra</h3>
          <div className="rounded-md border overflow-hidden">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Obra</TableHead>
                  <TableHead className="text-right">Consumo (IVA)</TableHead>
                  <TableHead className="text-right">Pagos</TableHead>
                  <TableHead className="text-right">Ajustes</TableHead>
                  <TableHead className="text-right">Saldo esperado</TableHead>
                  <TableHead className="text-right">Saldo actual</TableHead>
                  <TableHead className="text-right">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {siteKeys.map((key) => {
                  const s = perSiteBreakdown[key];
                  if (!s) return null;
                  const isExpanded = expandedSites.has(key);
                  return (
                    <React.Fragment key={key}>
                      <TableRow>
                        <TableCell className="truncate" title={s.label}>{s.label}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.consumptionWithVat)}</TableCell>
                        <TableCell className="text-right text-green-700">− {formatCurrency(s.payments)}</TableCell>
                        <TableCell className={`text-right ${s.adjustments >= 0 ? 'text-red-700' : 'text-green-700'}`}>{s.adjustments >= 0 ? '+ ' : '− '}{formatCurrency(Math.abs(s.adjustments))}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(s.expected)}</TableCell>
                        <TableCell className={`text-right ${s.currentBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>{formatCurrency(s.currentBalance)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => toggleSite(key)} className="h-8 px-2">
                            {isExpanded ? 'Ocultar' : 'Ver'}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-md border">
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Órdenes entregadas</h4>
                                <div className="rounded border bg-white divide-y">
                                  {s.orders.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground">Sin órdenes entregadas</div>
                                  ) : s.orders.map((o: any) => (
                                    <div key={o.id} className="flex justify-between p-2 text-sm">
                                      <span className="truncate" title={o.order_number || o.id}>{o.order_number || o.id}</span>
                                      <span>{formatCurrency(((o.requires_invoice && (typeof o.invoice_amount === 'number')) ? o.invoice_amount : (o.final_amount || 0)) || 0)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Pagos</h4>
                                <div className="rounded border bg-white divide-y">
                                  {s.sitePayments.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground">Sin pagos registrados</div>
                                  ) : s.sitePayments.map((p) => (
                                    <div key={p.id} className="flex justify-between p-2 text-sm">
                                      <span className="truncate" title={p.reference_number || ''}>{formatDate(p.payment_date)}</span>
                                      <span>{formatCurrency(p.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                <TableRow>
                  <TableCell className="font-semibold">Totales</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(totals.consumptionWithVat)}</TableCell>
                  <TableCell className="text-right font-semibold text-green-700">− {formatCurrency(totals.payments)}</TableCell>
                  <TableCell className={`text-right font-semibold ${totals.adjustments >= 0 ? 'text-red-700' : 'text-green-700'}`}>{totals.adjustments >= 0 ? '+ ' : '− '}{formatCurrency(Math.abs(totals.adjustments))}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(totals.expected)}</TableCell>
                  <TableCell className={`text-right font-semibold ${totals.currentBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>{formatCurrency(totals.currentBalance)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Nota de conciliación */}
        <p className="text-xs text-muted-foreground">
          Si el saldo esperado difiere del saldo actual, verifique órdenes sin remisiones o ajustes recientes.
        </p>
      </CardContent>
    </Card>
  );
}

// Componente para mostrar historial de pagos (Enhanced with Filters, Pagination, Shadcn Table)
function ClientPaymentsList({ payments: allPayments }: { payments: ClientPayment[] }) {
  const [filters, setFilters] = useState<{
    startDate: Date | undefined;
    endDate: Date | undefined;
    paymentMethod: string;
  }>(() => {
    const now = new Date();
    const lastMonth = subMonths(now, 1);
    
    // Ensure dates are valid
    if (isNaN(now.getTime()) || isNaN(lastMonth.getTime())) {
      return {
        startDate: undefined,
        endDate: undefined,
        paymentMethod: 'all',
      };
    }
    
    return {
      startDate: lastMonth,
      endDate: now,
      paymentMethod: 'all',
    };
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Or make this configurable

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    if (key === 'startDate' || key === 'endDate') {
      // Validate that the date is valid before setting it
      if (value && !isNaN(new Date(value).getTime())) {
        setFilters(prev => ({ ...prev, [key]: new Date(value) }));
      } else {
        // If invalid date, set to undefined
        setFilters(prev => ({ ...prev, [key]: undefined }));
      }
    } else {
      setFilters(prev => ({ ...prev, [key]: value }));
    }
    setCurrentPage(1); // Reset to first page on filter change
  };

  const filteredPayments = useMemo(() => {
    return allPayments.filter(payment => {
      const paymentDate = new Date(payment.payment_date);
      
      // Skip invalid dates
      if (isNaN(paymentDate.getTime())) {
        return false;
      }
      
      const startMatch = !filters.startDate || !isNaN(filters.startDate.getTime()) && paymentDate >= filters.startDate;
      const endMatch = !filters.endDate || !isNaN(filters.endDate.getTime()) && paymentDate <= filters.endDate;
      const methodMatch = filters.paymentMethod === 'all' || payment.payment_method === filters.paymentMethod;
      return startMatch && endMatch && methodMatch;
    });
  }, [allPayments, filters]);

  // Pagination logic
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayments, currentPage, itemsPerPage]);

  const paymentMethodOptions = useMemo(() => {
    // Get unique payment methods from all payments
    const methods = new Set(allPayments.map(p => p.payment_method));
    return Array.from(methods);
  }, [allPayments]);

  const formatDateFromString = (date: string): string => {
    if (!date) return '';
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return '';
      return dateObj.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.warn('Error formatting date:', date, error);
      return '';
    }
  };

  const formatTimeFromString = (date: string): string => {
    if (!date) return '';
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return '';
      return dateObj.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('Error formatting time:', date, error);
      return '';
    }
  };

  // Helper function to safely format date for input value
  const formatDateForInput = (date: Date | undefined): string => {
    if (!date || isNaN(date.getTime())) return '';
    try {
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.warn('Invalid date encountered:', date);
      return '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Pagos</CardTitle>
        <CardDescription>Filtra y revisa los pagos registrados.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filter Section */}
        <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-md bg-gray-50">
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              id="startDate"
              value={formatDateForInput(filters.startDate)}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              id="endDate"
              value={formatDateForInput(filters.endDate)}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">Método</label>
            <Select 
              value={filters.paymentMethod}
              onValueChange={(value) => handleFilterChange('paymentMethod', value)}
            >
              <SelectTrigger id="paymentMethod">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {paymentMethodOptions.map(method => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Payments Table */}
        {paginatedPayments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No hay pagos que coincidan con los filtros seleccionados.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateFromString(payment.payment_date)} {formatTimeFromString(payment.payment_date)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell>{payment.payment_method}</TableCell>
                  <TableCell>{payment.reference_number || '-'}</TableCell>
                  <TableCell className="truncate max-w-[150px]" title={payment.construction_site || 'Distribución automática'}>
                    {payment.construction_site || "Distribución automática"}
                  </TableCell>
                  <TableCell className="truncate max-w-[200px]" title={payment.notes || ''}>{payment.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <span className="text-sm text-gray-600">
              Página {currentPage} de {totalPages} (Total: {filteredPayments.length} pagos)
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Update SiteStatusToggle to also show coordinates
function SiteStatusToggle({ site, onStatusChange }: { site: ConstructionSite, onStatusChange: () => void }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [dialogReady, setDialogReady] = useState(false);

  const handleToggle = async () => {
    try {
      setIsUpdating(true);
      await clientService.updateSiteStatus(site.id, !site.is_active);
      onStatusChange();
      toast.success(`Obra ${!site.is_active ? 'activada' : 'desactivada'} exitosamente`);
    } catch (error) {
      console.error('Error updating site status:', error);
      toast.error('Error al actualizar el estado de la obra');
    } finally {
      setIsUpdating(false);
    }
  };

  // Return early if the site doesn't have valid coordinates
  const hasCoordinates = site.latitude && site.longitude;

  // Memoized handler for map selector to prevent re-renders
  const handleMapSelection = useCallback(() => {
    // This is a read-only map, so we don't need to do anything with selections
  }, []);
  
  // Handle dialog opening
  const openMapDialog = useCallback(() => {
    setShowMapDialog(true);
    // Short delay to ensure DOM is ready before rendering the map
    setTimeout(() => {
      setDialogReady(true);
    }, 100);
  }, []);

  // Handle dialog closing
  const closeDialog = useCallback(() => {
    setShowMapDialog(false);
    setDialogReady(false);
  }, []);

  return (
    <div>
      <div className="flex items-center space-x-2">
        <Switch
          checked={site.is_active}
          onCheckedChange={handleToggle}
          disabled={isUpdating}
        />
        <span className={`text-sm ${site.is_active ? 'text-green-600' : 'text-gray-500'}`}>
          {site.is_active ? 'Activa' : 'Inactiva'}
        </span>
      </div>
      
      {hasCoordinates && (
        <div className="mt-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={openMapDialog}
            className="flex items-center gap-1 text-xs"
          >
            <Map className="h-3 w-3" />
            <span>Ver en Mapa</span>
          </Button>
          
          <Dialog open={showMapDialog} onOpenChange={closeDialog}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ubicación: {site.name}</DialogTitle>
                <DialogDescription>
                  {site.location || 'Sin dirección registrada'}
                </DialogDescription>
              </DialogHeader>
              
              {dialogReady && site.latitude && site.longitude && (
                <div className="h-[400px] w-full mt-4 rounded-lg overflow-hidden">
                  <GoogleMapWrapper className="h-full w-full">
                    <GoogleMapSelector
                      initialPosition={{ lat: site.latitude, lng: site.longitude }}
                      onSelectLocation={handleMapSelection}
                      height="100%"
                      readOnly={true}
                    />
                  </GoogleMapWrapper>
                </div>
              )}
              
              <div className="mt-2 text-sm text-gray-600">
                Coordenadas: {site.latitude!.toFixed(6)}, {site.longitude!.toFixed(6)}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

// Order Detail Modal Component
function OrderDetailModal({ 
  isOpen, 
  onClose, 
  orderId 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  orderId: string | null 
}) {
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [remisiones, setRemisiones] = useState<any[]>([]);
  const [loadingRemisiones, setLoadingRemisiones] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      const fetchOrderDetails = async () => {
        setLoading(true);
        try {
          // Obtener los datos del pedido
          const { data, error } = await orderService.getOrderById(orderId);
          if (error) throw new Error(error);
          setOrderDetails(data);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Error al cargar detalles del pedido';
          setError(errorMessage);
        } finally {
          setLoading(false);
        }
      };

      // Función separada para las remisiones
      const fetchRemisiones = async () => {
        setLoadingRemisiones(true);
        try {
          // Importamos dinámicamente para evitar problemas de SSR
          const supabaseModule = await import('@/lib/supabase/client');
          const supabase = supabaseModule.supabase;
          
          if (!supabase) {
            console.error("Cliente Supabase no disponible");
            return;
          }
          
          // Verificamos primero si la tabla existe
          const { error: tableCheckError } = await supabase
            .from('remisiones')
            .select('id')
            .limit(1);
          
          // Si hay error con la tabla, probablemente no existe o no tenemos acceso
          if (tableCheckError) {
            console.log("La tabla de remisiones no está disponible:", tableCheckError.message);
            return;
          }
          
          // Si la tabla existe, procedemos con la consulta completa
          const { data: remisionesData, error: remisionesError } = await supabase
            .from('remisiones')
            .select(`
              *,
              recipe:recipes(recipe_code),
              materiales:remision_materiales(*)
            `)
            .eq('order_id', orderId)
            .order('fecha', { ascending: false });
          
          if (remisionesError) {
            console.error("Error al cargar remisiones:", remisionesError);
          } else {
            setRemisiones(remisionesData || []);
          }
        } catch (err) {
          console.error("Error inesperado al cargar remisiones:", err);
        } finally {
          setLoadingRemisiones(false);
        }
      };

      fetchOrderDetails();
      fetchRemisiones();
    }
  }, [isOpen, orderId]);

  // Agrupar remisiones por tipo
  const concreteRemisiones = remisiones.filter(r => r.tipo_remision === 'CONCRETO');
  const pumpRemisiones = remisiones.filter(r => r.tipo_remision === 'BOMBEO');
  
  // Calcular totales de volumen
  const totalConcreteVolume = concreteRemisiones.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);
  const totalPumpVolume = pumpRemisiones.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);

  // Agrupar remisiones de concreto por receta
  const concreteByRecipe = concreteRemisiones.reduce<Record<string, { volume: number; count: number }>>((acc, remision) => {
    const recipeCode = remision.recipe?.recipe_code || 'Sin receta';
    if (!acc[recipeCode]) {
      acc[recipeCode] = {
        volume: 0,
        count: 0
      };
    }
    acc[recipeCode].volume += remision.volumen_fabricado || 0;
    acc[recipeCode].count += 1;
    return acc;
  }, {});

  // Verificar si hay remisiones de concreto
  const hasRemisiones = concreteRemisiones.length > 0;

  if (!isOpen || !orderId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Detalles del Pedido</DialogTitle>
          <DialogDescription>
            {orderDetails?.order_number || 'Cargando...'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <p>Cargando detalles del pedido...</p>
          </div>
        ) : error ? (
          <div className="text-red-600 py-4">
            {error}
          </div>
        ) : orderDetails ? (
          <div className="space-y-6">
            {/* Order General Info */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Número de Pedido</p>
                    <p className="text-base">{orderDetails.order_number}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Fecha de Entrega</p>
                    <p className="text-base">{formatDate(orderDetails.delivery_date, 'PP')} {orderDetails.delivery_time}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Estado</p>
                    <div className={`px-2 py-1 mt-1 rounded-full text-xs font-medium inline-flex items-center
                      ${orderDetails.order_status === 'created' ? 'bg-yellow-100 text-yellow-800' : 
                        orderDetails.order_status === 'validated' ? 'bg-green-100 text-green-800' :
                        orderDetails.order_status === 'scheduled' ? 'bg-purple-100 text-purple-800' :
                        orderDetails.order_status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'}`}>
                      {orderDetails.order_status.charAt(0).toUpperCase() + orderDetails.order_status.slice(1)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Obra</p>
                    <p className="text-base">{orderDetails.construction_site || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Monto Total</p>
                    <p className="text-base">{orderDetails.final_amount ? formatCurrency(orderDetails.final_amount) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Requiere Factura</p>
                    <p className="text-base">{orderDetails.requires_invoice ? 'Sí' : 'No'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Products or Remisiones */}
            {hasRemisiones ? (
              // Mostrar productos basados en remisiones
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Productos (Basados en Remisiones)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(concreteByRecipe).map(([recipe, data], index) => (
                      <Badge key={`client-recipe-${index}-${recipe}`} variant="outline" className="bg-blue-50">
                        {recipe}: {data.volume.toFixed(2)} m³
                      </Badge>
                    ))}
                    {pumpRemisiones.length > 0 && (
                      <Badge variant="outline" className="bg-green-50">
                        Bombeo: {totalPumpVolume.toFixed(2)} m³
                      </Badge>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>№ Remisión</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Receta</TableHead>
                        <TableHead className="text-right">Volumen (m³)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {concreteRemisiones.map((remision) => (
                        <TableRow key={remision.id}>
                          <TableCell className="font-medium">{remision.remision_number}</TableCell>
                          <TableCell>
                            {remision.fecha ? formatDate(new Date(remision.fecha), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>{remision.recipe?.recipe_code || 'N/A'}</TableCell>
                          <TableCell className="text-right">{(remision.volumen_fabricado || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : loadingRemisiones ? (
              // Mostramos mensaje de carga si aún estamos buscando remisiones
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="py-4 text-center text-gray-500">
                    <p>Cargando información de productos...</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Mostrar productos originales del pedido
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  {orderDetails.items && orderDetails.items.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Precio Unitario</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderDetails.items.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{item.product_type || 'Producto'}</TableCell>
                            <TableCell className="text-right">{item.volume || 0} m³</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unit_price || 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total_price || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-gray-500 text-sm">No hay productos registrados para este pedido.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Bombeo (si hay remisiones de bombeo) */}
            {pumpRemisiones.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Servicios de Bombeo</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>№ Remisión</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Operador</TableHead>
                        <TableHead className="text-right">Volumen (m³)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pumpRemisiones.map((remision) => (
                        <TableRow key={remision.id}>
                          <TableCell className="font-medium">{remision.remision_number}</TableCell>
                          <TableCell>
                            {remision.fecha ? formatDate(new Date(remision.fecha), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>{remision.operador || '-'}</TableCell>
                          <TableCell className="text-right">{(remision.volumen_fabricado || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Mostrar fila de totales si hay más de una remisión de bombeo */}
                      {pumpRemisiones.length > 1 && (
                        <TableRow className="bg-gray-50 font-medium">
                          <TableCell colSpan={3} className="text-right">
                            Total:
                          </TableCell>
                          <TableCell className="text-right">
                            {totalPumpVolume.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Special Requirements */}
            {orderDetails.special_requirements && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Requisitos Especiales</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{orderDetails.special_requirements}</p>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              <Button asChild variant="default">
                <Link href={`/orders/${orderId}`} target="_blank">Ver Completo</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function ClientDetailContent({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [balances, setBalances] = useState<ClientBalance[]>([]);
  const [clientOrders, setClientOrders] = useState<OrderWithClient[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Dialog state for payment form
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  // Dialog state for balance adjustment
  const [isBalanceAdjustmentDialogOpen, setIsBalanceAdjustmentDialogOpen] = useState(false);
  // Order detail modal state
  const [isOrderDetailModalOpen, setIsOrderDetailModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [editingSite, setEditingSite] = useState<ConstructionSite | null>(null);
  // Delete site confirmation dialog
  const [siteToDelete, setSiteToDelete] = useState<ConstructionSite | null>(null);
  const [isDeletingSite, setIsDeletingSite] = useState(false);
  // Edit client modal state
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [editForm, setEditForm] = useState<any | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [userOptions, setUserOptions] = useState<Array<{ id: string; name: string }>>([]);

  // Find the current total balance for passing to PaymentForm - MOVED UP HERE to fix hooks order
  const currentTotalBalance = useMemo(() => {
    const generalBalance = balances.find(b => b.construction_site === null);
    return generalBalance?.current_balance || 0;
  }, [balances]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedClient = await clientService.getClientById(clientId);
      if (!fetchedClient) throw new Error('Cliente no encontrado');
      setClient(fetchedClient);

      const [fetchedSites, fetchedPayments, fetchedBalances] = await Promise.all([
        clientService.getClientSites(clientId),
        clientService.getClientPayments(clientId),
        clientService.getClientBalances(clientId)
      ]);
      setSites(fetchedSites);
      setPayments(fetchedPayments);
      setBalances(fetchedBalances);

      // Fetch orders for this client
      setLoadingOrders(true);
      const { data: orders, error: ordersError } = await orderService.getOrders({ clientId });
      if (ordersError) {
        console.error("Error loading client orders:", ordersError);
      } else {
        setClientOrders(orders);
      }
      setLoadingOrders(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cargar datos';
      console.error("Error loading client data:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load user profiles for assignment when component mounts or modal opens
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await authService.getAllUsers();
        const list = (data || []).map((u: any) => ({
          id: u.id,
          name: (u.first_name || u.last_name) ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : (u.email || 'Usuario')
        }));
        setUserOptions(list);
      } catch (e) {
        console.warn('No fue posible cargar usuarios mediante authService:', e);
      }
    };
    loadUsers();
  }, []);

  const openEditClient = () => {
    if (!client) return;
    setEditForm({
      business_name: client.business_name || '',
      contact_name: client.contact_name || '',
      email: client.email || '',
      phone: client.phone || '',
      rfc: client.rfc || '',
      address: client.address || '',
      requires_invoice: !!client.requires_invoice,
      // @ts-ignore optional runtime fields
      client_type: (client as any).client_type || 'de_la_casa',
      // @ts-ignore optional runtime fields
      assigned_user_id: (client as any).assigned_user_id || '',
    });
    setIsEditClientOpen(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setEditForm((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSaveClient = async () => {
    if (!editForm) return;
    try {
      setSavingClient(true);
      const payload = {
        ...editForm,
        // normalize blank assignment
        assigned_user_id: editForm.assigned_user_id || null,
      };
      // @ts-ignore service accepts partial
      await clientService.updateClient(clientId, payload);
      toast.success('Cliente actualizado');
      setIsEditClientOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || 'Error al actualizar el cliente');
    } finally {
      setSavingClient(false);
    }
  };

  const handlePaymentAdded = () => {
    setIsPaymentDialogOpen(false); // Close the dialog
    loadData(); // Refresh data
  };

  const handlePaymentCancel = () => {
    setIsPaymentDialogOpen(false); // Close the dialog
  };

  // Handle opening the order detail modal
  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsOrderDetailModalOpen(true);
  };

  // Format date helper function for orders section
  const formatOrderDate = (dateString: string): string => {
    return formatDate(dateString, 'PP');
  };

  // Handlers for balance adjustment
  const handleBalanceAdjustmentOpen = () => {
    setIsBalanceAdjustmentDialogOpen(true);
  };

  const handleBalanceAdjustmentComplete = () => {
    setIsBalanceAdjustmentDialogOpen(false);
    loadData(); // Refresh data after adjustment
  };

  // Handle site deletion
  const handleDeleteSite = async () => {
    if (!siteToDelete) return;
    
    try {
      setIsDeletingSite(true);
      await clientService.deleteSite(siteToDelete.id);
      toast.success(`Obra "${siteToDelete.name}" eliminada con éxito`);
      setSiteToDelete(null);
      loadData(); // Reload data after deletion
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar la obra';
      toast.error(errorMessage);
    } finally {
      setIsDeletingSite(false);
    }
  };

  if (loading) {
    return <div className="p-4">Cargando detalles del cliente...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  if (!client) {
    return <div className="p-4">No se encontró el cliente.</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <Card className="overflow-x-auto">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{client.business_name}</CardTitle>
              <CardDescription>Código: {client.client_code} | RFC: {client.rfc}</CardDescription>
            </div>
            <RoleProtectedButton
              allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
              onClick={openEditClient}
              className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-md"
            >
              <Pencil className="h-4 w-4" />
              <span>Editar Cliente</span>
            </RoleProtectedButton>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <ClientLogoManager
              clientId={clientId}
              businessName={client.business_name}
              logoPath={(client as any).logo_path}
              onUpdated={(next) => setClient((prev) => prev ? ({ ...prev, logo_path: next } as any) : prev)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <p><strong>Contacto:</strong> {client.contact_name}</p>
            <p><strong>Email:</strong> {client.email}</p>
            <p><strong>Teléfono:</strong> {client.phone}</p>
            <p><strong>Dirección:</strong> {client.address}</p>
            <p><strong>Requiere Factura:</strong> {client.requires_invoice ? 'Sí' : 'No'}</p>
            <p><strong>Estado de Crédito:</strong> {client.credit_status}</p>
            {/** Nuevo: tipo de cliente y usuario asignado */}
            {'client_type' in client && (
              <p><strong>Tipo de Cliente:</strong> {(
                client as any
              ).client_type === 'de_la_casa' ? 'Cliente de la casa' : (
                (client as any).client_type === 'normal' ? 'Cliente normal' : (
                (client as any).client_type === 'asignado' ? 'Cliente asignado' : 'Cliente nuevo'))}</p>
            )}
            {'assigned_user_id' in client && (
              <p><strong>Usuario asignado:</strong> { (client as any).assigned_user_id ? (client as any).assigned_user_id : 'Sin asignar'}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Client Modal */}
      <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>Actualiza la información del cliente.</DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Negocio *</label>
                  <input name="business_name" value={editForm.business_name} onChange={handleEditChange} className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
                  <input name="rfc" value={editForm.rfc} onChange={handleEditChange} className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
                  <input name="contact_name" value={editForm.contact_name} onChange={handleEditChange} className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input name="phone" value={editForm.phone} onChange={handleEditChange} className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input name="email" type="email" value={editForm.email} onChange={handleEditChange} className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input id="requires_invoice_edit" name="requires_invoice" type="checkbox" checked={!!editForm.requires_invoice} onChange={handleEditChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  <label htmlFor="requires_invoice_edit" className="text-sm text-gray-700">Requiere Factura</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <textarea name="address" value={editForm.address} onChange={handleEditChange} rows={2} className="w-full p-2 border border-gray-300 rounded-md" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cliente</label>
                  <select name="client_type" value={editForm.client_type} onChange={handleEditChange} className="w-full p-2 border border-gray-300 rounded-md">
                    <option value="normal">Cliente normal</option>
                    <option value="de_la_casa">Cliente de la casa</option>
                    <option value="asignado">Cliente asignado</option>
                    <option value="nuevo">Cliente nuevo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario asignado</label>
                  <select name="assigned_user_id" value={editForm.assigned_user_id || ''} onChange={(e) => {
                    const value = e.target.value;
                    setEditForm((prev: any) => ({
                      ...prev,
                      assigned_user_id: value || '',
                      client_type: value ? 'asignado' : prev.client_type,
                    }));
                  }} className="w-full p-2 border border-gray-300 rounded-md">
                    <option value="">Sin asignar</option>
                    {userOptions.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  {userOptions.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500">No hay usuarios disponibles para asignar.</p>
                  )}
                  {userOptions.length > 0 && (
                    <p className="mt-1 text-xs text-gray-400">Usuarios disponibles: {userOptions.length}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsEditClientOpen(false)} disabled={savingClient}>Cancelar</Button>
                <Button onClick={handleSaveClient} disabled={savingClient}>
                  {savingClient ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <ClientBalanceSummary balances={balances} />
        </div>

        <div className="lg:col-span-2 xl:col-span-3 space-y-6">
          <ClientBalanceBreakdown
            clientId={clientId}
            orders={clientOrders}
            payments={payments}
            balances={balances}
          />
          <Tabs defaultValue="payments" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="payments">Pagos</TabsTrigger>
              <TabsTrigger value="adjustments">Ajustes de Saldo</TabsTrigger>
            </TabsList>
            
            <TabsContent value="payments">
              <ClientPaymentsList payments={payments} />
            </TabsContent>
            
            <TabsContent value="adjustments">
              <BalanceAdjustmentHistory clientId={clientId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Payment and Balance Adjustment buttons */}
      {balances.length > 0 && (
        <section className="mt-6">
          <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
            <DialogTrigger asChild>
              <RoleProtectedButton
                allowedRoles={['PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
                onClick={() => setIsPaymentDialogOpen(true)}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Registrar Pago
              </RoleProtectedButton>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Registrar Pago</DialogTitle>
                <DialogDescription>
                  Registre un pago para {client?.business_name}
                </DialogDescription>
              </DialogHeader>
              
              <PaymentForm
                clientId={clientId}
                sites={sites}
                onSuccess={handlePaymentAdded}
                onCancel={handlePaymentCancel}
                currentBalance={currentTotalBalance}
              />
            </DialogContent>
          </Dialog>
          
          {/* Balance Adjustment Button */}
          <RoleProtectedButton
            allowedRoles={['PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
            onClick={handleBalanceAdjustmentOpen}
            className="mt-4 ml-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Ajustar Saldo
          </RoleProtectedButton>
          
          {/* Balance Adjustment Modal */}
          {client && (
            <BalanceAdjustmentModal
              isOpen={isBalanceAdjustmentDialogOpen}
              onClose={() => setIsBalanceAdjustmentDialogOpen(false)}
              clientId={clientId}
              clientName={client.business_name}
              clientBalance={currentTotalBalance}
              clientSites={sites.map(site => ({ id: site.id, name: site.name }))}
              onAdjustmentComplete={handleBalanceAdjustmentComplete}
            />
          )}
        </section>
      )}

      <Card>
         <CardHeader>
           <CardTitle>Obras Registradas</CardTitle>
           <CardDescription>Lista de obras asociadas a este cliente.</CardDescription>
         </CardHeader>
         <CardContent>
            {sites.length > 0 ? (
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Restricciones de Acceso</TableHead>
                    <TableHead>Condiciones Especiales</TableHead>
                    <TableHead>Coordenadas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map((site) => (
                    <TableRow key={site.id}>
                      <TableCell className="font-medium">{site.name}</TableCell>
                      <TableCell>{site.location || '-'}</TableCell>
                      <TableCell>{site.access_restrictions || '-'}</TableCell>
                      <TableCell>{site.special_conditions || '-'}</TableCell>
                      <TableCell>
                        {site.latitude && site.longitude 
                          ? `${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}`
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <SiteStatusToggle site={site} onStatusChange={loadData} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <RoleProtectedButton
                            allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
                            onClick={() => setEditingSite(site)}
                            className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded-md text-xs transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Editar</span>
                          </RoleProtectedButton>
                          <RoleProtectedButton
                            allowedRoles={['EXECUTIVE']}
                            onClick={() => setSiteToDelete(site)}
                            className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-md text-xs transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Eliminar</span>
                          </RoleProtectedButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-gray-500">No hay obras registradas para este cliente.</p>
            )}
            {editingSite && (
              <EditSiteForm 
                site={editingSite} 
                clientId={clientId} 
                onSiteUpdated={() => {
                  setEditingSite(null);
                  loadData();
                }}
                onCancel={() => setEditingSite(null)}
              />
            )}
            <NewSiteForm clientId={clientId} onSiteAdded={loadData} />
         </CardContent>
      </Card>

      <Card className="overflow-x-auto">
        <CardHeader>
          <CardTitle>Pedidos Relacionados</CardTitle>
          <CardDescription>Lista de pedidos asociados a este cliente</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingOrders ? (
            <p className="text-sm text-gray-500">Cargando pedidos...</p>
          ) : clientOrders.length > 0 ? (
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Número de Pedido</TableHead>
                  <TableHead>Fecha de Entrega</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{formatOrderDate(order.delivery_date)}</TableCell>
                    <TableCell>{order.delivery_time}</TableCell>
                    <TableCell className="truncate max-w-[150px]" title={order.construction_site || ''}>
                      {order.construction_site || "-"}
                    </TableCell>
                    <TableCell>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center
                        ${order.order_status === 'created' ? 'bg-yellow-100 text-yellow-800' : 
                          order.order_status === 'validated' ? 'bg-green-100 text-green-800' :
                          order.order_status === 'scheduled' ? 'bg-purple-100 text-purple-800' :
                          order.order_status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'}`}>
                        {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                      </div>
                    </TableCell>
                    <TableCell>{order.final_amount ? formatCurrency(order.final_amount) : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewOrderDetails(order.id)}
                      >
                        Ver Detalles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-gray-500">No hay pedidos registrados para este cliente.</p>
          )}
          <div className="mt-4">
            <Link href={`/orders/create?clientId=${clientId}`}>
              <Button variant="default">Crear Nuevo Pedido</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      <OrderDetailModal 
        isOpen={isOrderDetailModalOpen} 
        onClose={() => setIsOrderDetailModalOpen(false)} 
        orderId={selectedOrderId} 
      />

      {/* Delete Site Confirmation Dialog */}
      <Dialog open={!!siteToDelete} onOpenChange={(open) => !open && setSiteToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar permanentemente la obra "{siteToDelete?.name}"? 
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setSiteToDelete(null)}
              disabled={isDeletingSite}
              className="flex items-center gap-1"
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteSite} 
              disabled={isDeletingSite}
              className="flex items-center gap-1"
            >
              {isDeletingSite ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Eliminando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  <span>Eliminar</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 