'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Package, ChevronLeft, Search, Check, Clock, AlertCircle } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ClientPortalLoader from '@/components/client-portal/ClientPortalLoader';
import DatePicker from '@/components/client-portal/DatePicker';
import { useUserPermissions } from '@/hooks/client-portal/useUserPermissions';
import { format, parseISO, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

type Site = { id: string; name: string };
type Plant = { id: string; name: string };
type Product = {
  id: string;
  master_code: string;
  strength_fc: number;
  age_days: number | null;
  slump: number | null;
  placement_type: string | null;
  max_aggregate_size: number | null;
  unit_price: number;
  quote_detail_id: string;
  quote_id: string;
};

// Helper to format date as YYYY-MM-DD in local timezone (avoiding UTC conversion issues)
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Time picker component - iOS HIG compliant
function TimePicker({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  const [hour, minute] = value.split(':');

  return (
    <div className="flex items-center gap-2">
      <Select value={hour} onValueChange={(h) => onChange(`${h}:${minute}`)}>
        <SelectTrigger className="w-20 glass-thin border-white/20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {hours.map(h => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-label-primary font-bold">:</span>
      <Select value={minute} onValueChange={(m) => onChange(`${hour}:${m}`)}>
        <SelectTrigger className="w-20 glass-thin border-white/20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {minutes.map(m => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function ScheduleOrderPage() {
  const router = useRouter();
  const { canCreateOrders, isLoading: permissionsLoading } = useUserPermissions();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Form state
  const [plantId, setPlantId] = useState<string>('');
  const [constructionSiteId, setConstructionSiteId] = useState<string | 'other' | ''>('');
  const [constructionSiteName, setConstructionSiteName] = useState('');
  // Default to tomorrow
  const getTomorrowDate = () => formatDateLocal(addDays(new Date(), 1));
  const [deliveryDate, setDeliveryDate] = useState<string>(getTomorrowDate());
  const [deliveryTime, setDeliveryTime] = useState<string>('08:00');
  const [productId, setProductId] = useState<string>('');
  const [volume, setVolume] = useState<string>('10');
  const [elemento, setElemento] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productLoading, setProductLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sitesRes, plantsRes] = await Promise.all([
          fetch('/api/client-portal/sites'),
          fetch('/api/plants')
        ]);
        const sitesJson = await sitesRes.json();
        const plantsJson = await plantsRes.json();
        if (!sitesRes.ok) throw new Error(sitesJson.error || 'Error sitios');
        if (!plantsRes.ok) throw new Error(plantsJson.error || 'Error plantas');
        setSites(sitesJson.sites || []);
        setPlants(plantsJson.data || []);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Error cargando datos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Memoized selectors - define before they're used in effects
  const selectedSite = useMemo(() => sites.find(s => s.id === constructionSiteId), [sites, constructionSiteId]);
  const selectedProduct = useMemo(() => products.find(p => p.id === productId), [products, productId]);
  const todayStr = useMemo(() => formatDateLocal(new Date()), []);
  const tomorrowStr = useMemo(() => getTomorrowDate(), []);

  // Load products when plant or construction site changes
  useEffect(() => {
    const loadProducts = async () => {
      if (!plantId || (!constructionSiteId && constructionSiteId !== 'other')) {
        setProducts([]);
        setProductId('');
        setProductQuery('');
        return;
      }

      setProductLoading(true);
      try {
        let siteName = '';
        if (constructionSiteId === 'other') {
          siteName = constructionSiteName;
        } else {
          siteName = selectedSite?.name || '';
        }

        if (!siteName) {
          setProducts([]);
          return;
        }

        const res = await fetch(
          `/api/client-portal/master-recipes?site=${encodeURIComponent(siteName)}&plant_id=${encodeURIComponent(plantId)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al cargar productos');
        setProducts(json.products || []);
        setProductId('');
      } catch (e: any) {
        console.error('Error loading products:', e);
        setProducts([]);
      } finally {
        setProductLoading(false);
      }
    };

    loadProducts();
  }, [plantId, constructionSiteId, constructionSiteName, selectedSite]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      (p.master_code || '').toLowerCase().includes(q) ||
      String(p.strength_fc || '').includes(q) ||
      (p.placement_type || '').toLowerCase().includes(q)
    );
  }, [products, productQuery]);

  const canContinue = useMemo(() => {
    const hasSite = constructionSiteId === 'other' ? constructionSiteName.trim().length > 1 : !!constructionSiteId;
    const notPast = !deliveryDate || deliveryDate >= todayStr;
    return hasSite && plantId && deliveryDate && notPast && productId && Number(volume) > 0 && elemento.trim().length > 0;
  }, [constructionSiteId, constructionSiteName, deliveryDate, productId, volume, elemento, plantId, todayStr]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      // Determine construction_site_id: only send UUID if from dropdown, not "other"
      let siteIdToSend: string | null = null;
      let siteNameToSend: string;
      
      if (constructionSiteId === 'other') {
        siteNameToSend = constructionSiteName;
        siteIdToSend = null;
      } else if (constructionSiteId && selectedSite) {
        siteNameToSend = selectedSite.name;
        // Only send ID if it's a valid UUID (not the name itself)
        siteIdToSend = constructionSiteId;
      } else {
        throw new Error('Debe seleccionar una obra');
      }

      const payload: any = {
        construction_site: siteNameToSend,
        construction_site_id: siteIdToSend,
        delivery_date: deliveryDate,
        delivery_time: deliveryTime,
        requires_invoice: true, // Always true, hidden from UI
        special_requirements: notes || null,
        elemento,
        plant_id: plantId,
        quote_id: selectedProduct?.quote_id || null,
        quote_detail_id: selectedProduct?.quote_detail_id || null,
        volume: Number(volume),
        unit_price: selectedProduct?.unit_price || 0
      };

      const res = await fetch('/api/client-portal/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo crear el pedido');

      router.replace(`/client-portal/orders/${json.id}`);
    } catch (e: any) {
      setError(e?.message || 'Error al crear el pedido');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ClientPortalLoader message="Cargando programador..." />;

  return (
    <div className="min-h-screen bg-background-primary">
      <Container maxWidth="2xl" className="py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-white/60 dark:bg-white/5 border border-white/30 backdrop-blur-sm transition-colors hover:bg-white/70"
            >
              <ChevronLeft className="w-4 h-4 text-label-primary" />
              <span className="text-callout font-medium text-label-primary group-hover:text-label-primary/90">Volver</span>
            </button>
            <div className="w-12 h-12 rounded-2xl glass-thick flex items-center justify-center border border-white/30">
              <Package className="w-6 h-6 text-label-primary" />
            </div>
            <div>
              <h1 className="text-large-title font-bold text-label-primary">
                Programar Pedido
              </h1>
              <p className="text-body text-label-secondary">
                Paso {step} de 2
              </p>
            </div>
          </div>
        </motion.div>

        <div className="glass-base rounded-3xl p-8">
          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 text-callout border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Plant Selection - Custom Select */}
                <div>
                  <label className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Planta *</label>
                  <Select value={plantId} onValueChange={setPlantId}>
                    <SelectTrigger className="w-full glass-thin border-white/20">
                      <SelectValue placeholder="Seleccionar planta" />
                    </SelectTrigger>
                    <SelectContent>
                      {plants.map(plant => (
                        <SelectItem key={plant.id} value={plant.id}>
                          {plant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Construction Site - Custom Select */}
                <div>
                  <label className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Obra *</label>
                  <Select
                    value={constructionSiteId}
                    onValueChange={(value) => {
                      setConstructionSiteId(value);
                      if (value !== 'other') {
                        setConstructionSiteName(sites.find(s => s.id === value)?.name || '');
                      }
                    }}
                    disabled={!plantId}
                  >
                    <SelectTrigger className="w-full glass-thin border-white/20">
                      <SelectValue placeholder="Seleccionar obra" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map(site => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">Otra obra (especificar)</SelectItem>
                    </SelectContent>
                  </Select>
                  {constructionSiteId === 'other' && (
                    <input
                      type="text"
                      placeholder="Nombre de la obra"
                      value={constructionSiteName}
                      onChange={(e) => setConstructionSiteName(e.target.value)}
                      className="mt-3 w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                    />
                  )}
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DatePicker
                    value={deliveryDate}
                    onChange={setDeliveryDate}
                    minDate={todayStr}
                    label="Fecha de entrega *"
                  />
                  <div>
                    <label className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Hora de entrega *</label>
                    <div className="flex items-center gap-2 p-3 rounded-xl glass-thin border border-white/20">
                      <Clock className="w-5 h-5 text-label-tertiary" />
                      <TimePicker value={deliveryTime} onChange={setDeliveryTime} />
                    </div>
                  </div>
                </div>

                {/* Elemento */}
                <div>
                  <label className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Elemento *</label>
                  <input
                    type="text"
                    placeholder="Ej: Losa de cimentación, Muro, Columna"
                    value={elemento}
                    onChange={(e) => setElemento(e.target.value)}
                    className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                  />
                </div>

                {/* Product Selection */}
                <div>
                  <label className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Producto (Receta Maestra) *</label>
                  <input
                    type="text"
                    placeholder="Buscar por código, resistencia, tipo..."
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    className="mb-3 w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                    disabled={!plantId || (!constructionSiteId && constructionSiteId !== 'other')}
                  />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                      disabled={!plantId || (!constructionSiteId && constructionSiteId !== 'other')}
                      className="w-full text-left rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none flex items-center justify-between disabled:opacity-50"
                    >
                      <span className="text-label-primary">{selectedProduct?.master_code || 'Seleccionar producto'}</span>
                      <div className="flex items-center gap-2">
                        {productLoading && <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
                        <ChevronLeft className="w-5 h-5 text-label-tertiary rotate-180" />
                      </div>
                    </button>
                    {productDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setProductDropdownOpen(false)} />
                        <div className="absolute z-30 w-full mt-2 max-h-[400px] overflow-y-auto rounded-2xl glass-base border border-white/30 shadow-2xl">
                          {productLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                              <span className="ml-2 text-label-secondary">Cargando productos...</span>
                            </div>
                          ) : filteredProducts.length === 0 ? (
                            <div className="p-6 text-center">
                              <p className="text-label-secondary text-callout">No hay productos disponibles para esta selección</p>
                            </div>
                          ) : (
                            filteredProducts.map(product => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => {
                                  setProductId(product.id);
                                  setProductDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 border-b border-white/10 last:border-0 hover:bg-white/10 transition-colors ${
                                  productId === product.id ? 'bg-primary/10' : ''
                                }`}
                              >
                                <div className="flex-1">
                                  <div className="font-semibold text-label-primary flex items-center gap-2">
                                    {product.master_code}
                                    {productId === product.id && <Check className="w-4 h-4 text-primary" />}
                                  </div>
                                  <div className="text-sm text-label-secondary mt-1 space-y-1">
                                    <div>Resistencia: {product.strength_fc} kg/cm²</div>
                                    {product.age_days && <div>Edad: {product.age_days} días</div>}
                                    {product.slump && <div>Revenimiento: {product.slump} cm</div>}
                                    {product.placement_type && <div>Tipo: {product.placement_type}</div>}
                                    {product.max_aggregate_size && <div>TMA: {product.max_aggregate_size} mm</div>}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Volume */}
                <div>
                  <label className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Volumen (m³) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Notas (Opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    disabled={!canContinue}
                    onClick={() => setStep(2)}
                    className="glass-button-blue"
                  >
                    Continuar
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="review"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Order Details Summary */}
                <div className="space-y-4">
                  {/* Main Info Section */}
                  <div className="glass-base rounded-3xl p-6 border border-white/20">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-1">Obra</p>
                          <p className="text-title-2 font-bold text-label-primary">{constructionSiteId === 'other' ? constructionSiteName : (selectedSite?.name || '')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-1">Planta</p>
                          <p className="text-body font-semibold text-label-primary">{plants.find(p => p.id === plantId)?.name || ''}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass-thin rounded-2xl p-5 border border-white/10">
                      <p className="text-caption text-label-tertiary uppercase tracking-wide mb-2">Fecha y hora de entrega</p>
                      <p className="text-body font-semibold text-label-primary">
                        {format(parseISO(deliveryDate), 'EEEE, dd MMM', { locale: es })}
                      </p>
                      <p className="text-callout font-medium text-label-primary mt-1">{deliveryTime}</p>
                    </div>
                    <div className="glass-thin rounded-2xl p-5 border border-white/10">
                      <p className="text-caption text-label-tertiary uppercase tracking-wide mb-2">Elemento</p>
                      <p className="text-body font-semibold text-label-primary">{elemento}</p>
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="glass-thin rounded-2xl p-5 border border-white/10">
                    <p className="text-caption text-label-tertiary uppercase tracking-wide mb-3">Producto a entregar</p>
                    <div className="space-y-2">
                      <p className="text-title-3 font-bold text-label-primary">{selectedProduct?.master_code || ''}</p>
                      <div className="space-y-1">
                        <p className="text-callout text-label-secondary">
                          <span className="font-semibold">Resistencia:</span> {selectedProduct?.strength_fc} kg/cm²
                        </p>
                        {selectedProduct?.age_days && (
                          <p className="text-callout text-label-secondary">
                            <span className="font-semibold">Edad:</span> {selectedProduct.age_days} días
                          </p>
                        )}
                        {selectedProduct?.slump && (
                          <p className="text-callout text-label-secondary">
                            <span className="font-semibold">Revenimiento:</span> {selectedProduct.slump} cm
                          </p>
                        )}
                        {selectedProduct?.placement_type && (
                          <p className="text-callout text-label-secondary">
                            <span className="font-semibold">Tipo:</span> {selectedProduct.placement_type}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Volume Info */}
                  <div className="glass-thin rounded-2xl p-5 border border-white/10">
                    <p className="text-caption text-label-tertiary uppercase tracking-wide mb-2">Volumen</p>
                    <p className="text-title-2 font-bold text-label-primary">{Number(volume).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³</p>
                  </div>
                </div>

                {notes && (
                  <div className="glass-thin rounded-2xl p-6 border border-white/10">
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-2">Notas</p>
                    <p className="text-body text-label-secondary">{notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" size="lg" onClick={() => setStep(1)}>Editar</Button>
                  <Button disabled={submitting} onClick={handleSubmit} className="glass-button-blue">
                    {submitting ? 'Programando…' : 'Programar pedido'}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Container>
    </div>
  );
}
