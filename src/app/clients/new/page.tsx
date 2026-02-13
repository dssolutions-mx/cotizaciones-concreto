'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientService } from '@/lib/supabase/clients';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { useDebounce } from '@/hooks/useDebounce';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LiveDuplicateSuggestions } from '@/components/clients/LiveDuplicateSuggestions';

// Interfaz para sitios de construcción (obras)
interface ConstructionSite {
  name: string;
  location: string;
  access_restrictions: string;
  special_conditions: string;
  is_active: boolean;
}

export default function NewClientPage() {
  const router = useRouter();
  const { profile } = useAuthBridge();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<Array<{ id: string; business_name: string; client_code: string | null; match_reason: string }>>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [suggestedCashCode, setSuggestedCashCode] = useState<string | null>(null);
  const [liveDuplicates, setLiveDuplicates] = useState<Array<{ id: string; business_name: string; client_code: string | null; match_reason: string }>>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  const [formData, setFormData] = useState({
    business_name: '',
    client_code: '', // RFC when requires_invoice
    requires_invoice: false,
    address: '',
    contact_name: '',
    email: '',
    phone: '',
    credit_status: 'ACTIVE' as const
  });

  const debouncedBusinessName = useDebounce(formData.business_name.trim(), 400);

  // Live fuzzy match mientras escribe
  useEffect(() => {
    if (debouncedBusinessName.length < 3) {
      setLiveDuplicates([]);
      return;
    }
    let cancelled = false;
    setIsCheckingDuplicates(true);
    const codeForCheck = formData.requires_invoice
      ? formData.client_code.trim() || undefined
      : (suggestedCashCode || undefined);
    clientService
      .findPotentialDuplicates(debouncedBusinessName, codeForCheck)
      .then((list) => {
        if (!cancelled) setLiveDuplicates(list || []);
      })
      .catch(() => {
        if (!cancelled) setLiveDuplicates([]);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingDuplicates(false);
      });
    return () => { cancelled = true; };
  }, [debouncedBusinessName, formData.requires_invoice, formData.client_code, suggestedCashCode]);

  // Estado para las obras
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [currentSite, setCurrentSite] = useState<ConstructionSite>({
    name: '',
    location: '',
    access_restrictions: '',
    special_conditions: '',
    is_active: true
  });

  function getCreatorInitials(): string {
    const fn = (profile as { first_name?: string } | null)?.first_name?.trim().slice(0, 1) || '';
    const ln = (profile as { last_name?: string } | null)?.last_name?.trim().slice(0, 1) || '';
    return (fn + ln).toUpperCase() || 'XX';
  }

  useEffect(() => {
    if (!formData.requires_invoice) {
      const initials = getCreatorInitials();
      clientService.getNextCashOnlyClientCode(initials).then(setSuggestedCashCode).catch(() => setSuggestedCashCode('XX-001'));
    } else {
      setSuggestedCashCode(null);
    }
  }, [formData.requires_invoice, profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: checkbox.checked
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Manejar cambios en el formulario de obra
  const handleSiteChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentSite(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Agregar una obra a la lista
  const handleAddSite = () => {
    if (!currentSite.name.trim()) {
      alert('El nombre de la obra es obligatorio');
      return;
    }
    
    setSites(prev => [...prev, { ...currentSite }]);
    setCurrentSite({
      name: '',
      location: '',
      access_restrictions: '',
      special_conditions: '',
      is_active: true
    });
    setShowSiteForm(false);
  };

  // Eliminar una obra de la lista
  const handleRemoveSite = (index: number) => {
    setSites(prev => prev.filter((_, i) => i !== index));
  };

  const doCreateClient = async () => {
    const clientCode = formData.requires_invoice
      ? formData.client_code.trim()
      : (suggestedCashCode || 'XX-001');
    const clientPayload = {
      ...formData,
      client_code: clientCode,
      rfc: formData.requires_invoice ? formData.client_code.trim() : undefined,
    };
    await clientService.createClientWithSites(clientPayload, sites);
    router.push('/clients');
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.business_name.trim()) {
      setError('El nombre de la empresa es obligatorio');
      return;
    }
    if (!formData.contact_name.trim()) {
      setError('El nombre de contacto es obligatorio');
      return;
    }
    if (!formData.phone.trim()) {
      setError('El número de teléfono es obligatorio');
      return;
    }
    if (formData.requires_invoice && !formData.client_code?.trim()) {
      setError('El RFC es obligatorio cuando se requiere factura');
      return;
    }

    try {
      const codeForDupCheck = formData.requires_invoice
        ? formData.client_code.trim()
        : (suggestedCashCode || undefined);
      const duplicates = await clientService.findPotentialDuplicates(
        formData.business_name,
        codeForDupCheck
      );
      if (duplicates.length > 0) {
        setPotentialDuplicates(duplicates);
        setShowDuplicateDialog(true);
        return;
      }
      setIsSubmitting(true);
      await doCreateClient();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear el cliente';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCreateDespiteDuplicates = async () => {
    setShowDuplicateDialog(false);
    try {
      setIsSubmitting(true);
      await doCreateClient();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear el cliente';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Link 
          href="/clients" 
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Volver a clientes
        </Link>
        <h1 className="text-2xl font-bold">Crear Nuevo Cliente</h1>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <h2 className="text-xl font-semibold mb-4">Información del Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Datos básicos */}
            <div className="mb-4">
              <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de Empresa *
              </label>
              <input
                type="text"
                id="business_name"
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
              {debouncedBusinessName.length >= 3 && (
                <div className="mt-2.5">
                  <LiveDuplicateSuggestions
                    isChecking={isCheckingDuplicates}
                    duplicates={liveDuplicates}
                  />
                </div>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requiere Factura
              </label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requires_invoice"
                  name="requires_invoice"
                  checked={formData.requires_invoice}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData(prev => ({
                      ...prev,
                      requires_invoice: checked,
                      ...(checked ? {} : { client_code: '' }),
                    }));
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requires_invoice" className="ml-2 text-sm text-gray-700">
                  Sí, requiere factura
                </label>
              </div>
            </div>
            
            {formData.requires_invoice ? (
              <div className="mb-4">
                <label htmlFor="client_code" className="block text-sm font-medium text-gray-700 mb-1">
                  RFC / Código de cliente *
                </label>
                <input
                  type="text"
                  id="client_code"
                  name="client_code"
                  value={formData.client_code}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                  placeholder="Ej: XAXX010101000"
                />
                <p className="text-xs text-gray-500 mt-1">El RFC es el código único del cliente (obligatorio para facturación)</p>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de cliente
                </label>
                <p className="text-sm text-gray-600 py-1">
                  {suggestedCashCode ? (
                    <span>Código asignado: <strong>{suggestedCashCode}</strong></span>
                  ) : (
                    <span className="text-gray-400">Cargando...</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0">Se genera automáticamente para clientes de efectivo</p>
              </div>
            )}
            
            {/* Datos de contacto */}
            <div className="mb-4 md:col-span-2">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Dirección (Opcional)
              </label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de Contacto *
              </label>
              <input
                type="text"
                id="contact_name"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Correo Electrónico (Opcional)
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="ejemplo@dominio.com"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono *
              </label>
              <div className="flex rounded-md shadow-xs">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  +52
                </span>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => {
                    // Solo permitir números y guiones
                    const value = e.target.value.replace(/[^\d-]/g, '');
                    setFormData((prev) => ({
                      ...prev,
                      phone: value
                    }));
                  }}
                  placeholder="1234-567-890"
                  className="flex-1 p-2 border border-gray-300 rounded-r-md focus:ring-blue-500 focus:border-blue-500"
                  maxLength={12}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Formato: 1234-567-890
              </p>
            </div>
            
            <div className="mb-4">
              <label htmlFor="credit_status" className="block text-sm font-medium text-gray-700 mb-1">
                Estado de Crédito
              </label>
              <select
                id="credit_status"
                name="credit_status"
                value={formData.credit_status}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="ACTIVE">Activo</option>
                <option value="SUSPENDED">Suspendido</option>
                <option value="BLACKLISTED">Lista Negra</option>
              </select>
            </div>
          </div>
          
          {/* Sección de Obras */}
          <div className="mt-8 border-t border-gray-200 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Obras</h2>
              <button
                type="button"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                onClick={() => setShowSiteForm(true)}
              >
                Agregar Obra
              </button>
            </div>
            
            {sites.length === 0 ? (
              <p className="text-gray-500">No hay obras agregadas. Puedes agregar obras para este cliente.</p>
            ) : (
              <div className="bg-gray-50 p-4 rounded-md mb-6">
                <h3 className="font-medium mb-2">Obras Agregadas:</h3>
                <ul className="divide-y divide-gray-200">
                  {sites.map((site, index) => (
                    <li key={index} className="py-3 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{site.name}</p>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            site.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {site.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{site.location}</p>
                        {site.access_restrictions && (
                          <p className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">Restricciones de acceso:</span> {site.access_restrictions}
                          </p>
                        )}
                        {site.special_conditions && (
                          <p className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">Condiciones especiales:</span> {site.special_conditions}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSite(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Formulario para agregar obra */}
            {showSiteForm && (
              <div className="bg-gray-50 p-4 rounded-md mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Nueva Obra</h3>
                  <button
                    type="button"
                    onClick={() => setShowSiteForm(false)}
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
                      value={currentSite.name}
                      onChange={handleSiteChange}
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
                      value={currentSite.location}
                      onChange={handleSiteChange}
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
                      value={currentSite.access_restrictions}
                      onChange={handleSiteChange}
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
                      value={currentSite.special_conditions}
                      onChange={handleSiteChange}
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
                        id="site_is_active"
                        name="is_active"
                        checked={currentSite.is_active}
                        onChange={(e) => {
                          setCurrentSite(prev => ({
                            ...prev,
                            is_active: e.target.checked
                          }));
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="site_is_active" className="ml-2 text-sm text-gray-700">
                        Obra Activa
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddSite}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Agregar Obra
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex justify-end">
            <Link 
              href="/clients" 
              className="bg-gray-300 text-gray-800 px-4 py-2 rounded mr-2 hover:bg-gray-400"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-green-300"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </div>

      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Posible duplicado?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">
                  Se encontraron clientes similares en el sistema. Revise si no es un duplicado antes de continuar.
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {potentialDuplicates.map((d) => (
                    <li key={d.id} className="flex justify-between gap-4">
                      <span>{d.business_name}</span>
                      <span className="text-muted-foreground">
                        {d.client_code || '—'} • {d.match_reason}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3">¿Desea crear el cliente de todos modos?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCreateDespiteDuplicates}>
              Sí, crear de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 