import { useState, useEffect, useCallback } from 'react';
import { clientService } from '@/lib/supabase/clients';

interface ConstructionSite {
  id: string;
  name: string;
  location: string;
  access_restrictions: string;
  special_conditions: string;
  client_id: string;
  is_active: boolean;
}

interface ConstructionSiteSelectProps {
  clientId: string;
  value: string;
  onChange: (site: ConstructionSite | null) => void;
  onLocationChange: (location: string) => void;
  className?: string;
}

export default function ConstructionSiteSelect({
  clientId,
  value,
  onChange,
  onLocationChange,
  className = ''
}: ConstructionSiteSelectProps) {
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [showNewSiteForm, setShowNewSiteForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newSite, setNewSite] = useState({
    name: '',
    location: '',
    access_restrictions: '',
    special_conditions: '',
    is_active: true
  });

  const loadSites = useCallback(async () => {
    try {
      setIsLoading(true);
      const sitesData = await clientService.getClientSites(clientId);
      setSites(sitesData);
    } catch (error) {
      console.error('Error loading construction sites:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      loadSites();
    }
  }, [clientId, loadSites]);

  const handleAddNewSite = async () => {
    if (!newSite.name.trim()) {
      alert('El nombre de la obra es obligatorio');
      return;
    }

    try {
      setIsLoading(true);
      const createdSite = await clientService.createSite(clientId, newSite);
      
      // Refresh sites list
      await loadSites();
      
      // Select the newly created site
      onChange(createdSite);
      onLocationChange(createdSite.location || '');
      
      // Reset form
      setNewSite({
        name: '',
        location: '',
        access_restrictions: '',
        special_conditions: '',
        is_active: true
      });
      setShowNewSiteForm(false);
    } catch (error) {
      console.error('Error creating new site:', error);
      alert('Error al crear la obra');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSiteChange = (siteId: string) => {
    if (siteId === 'new') {
      setShowNewSiteForm(true);
      onChange(null);
      onLocationChange('');
      return;
    }

    const selectedSite = sites.find(site => site.id === siteId);
    onChange(selectedSite || null);
    onLocationChange(selectedSite?.location || '');
  };

  return (
    <div className={className}>
      <div className="mb-4">
        <select
          value={value}
          onChange={(e) => handleSiteChange(e.target.value)}
          className="w-full p-2 border rounded-md"
          disabled={isLoading}
        >
          <option value="">Seleccionar Obra</option>
          {sites.map(site => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
          <option value="new">+ Agregar Nueva Obra</option>
        </select>
      </div>

      {showNewSiteForm && (
        <div className="bg-gray-50 p-4 rounded-md mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Nueva Obra</h3>
            <button
              type="button"
              onClick={() => setShowNewSiteForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="site_name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Obra *
              </label>
              <input
                type="text"
                id="site_name"
                value={newSite.name}
                onChange={(e) => setNewSite(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border rounded-md"
                placeholder="Nombre de la obra"
              />
            </div>

            <div>
              <label htmlFor="site_location" className="block text-sm font-medium text-gray-700 mb-1">
                Ubicación
              </label>
              <input
                type="text"
                id="site_location"
                value={newSite.location}
                onChange={(e) => setNewSite(prev => ({ ...prev, location: e.target.value }))}
                className="w-full p-2 border rounded-md"
                placeholder="Dirección o coordenadas"
              />
            </div>

            <div>
              <label htmlFor="site_access" className="block text-sm font-medium text-gray-700 mb-1">
                Restricciones de Acceso
              </label>
              <textarea
                id="site_access"
                value={newSite.access_restrictions}
                onChange={(e) => setNewSite(prev => ({ ...prev, access_restrictions: e.target.value }))}
                className="w-full p-2 border rounded-md"
                rows={2}
                placeholder="Restricciones de acceso al sitio"
              />
            </div>

            <div>
              <label htmlFor="site_conditions" className="block text-sm font-medium text-gray-700 mb-1">
                Condiciones Especiales
              </label>
              <textarea
                id="site_conditions"
                value={newSite.special_conditions}
                onChange={(e) => setNewSite(prev => ({ ...prev, special_conditions: e.target.value }))}
                className="w-full p-2 border rounded-md"
                rows={2}
                placeholder="Condiciones especiales del sitio"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddNewSite}
                disabled={isLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {isLoading ? 'Guardando...' : 'Guardar Obra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 