'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Package, ChevronLeft, Search, Check } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/button';
import ClientPortalLoader from '@/components/client-portal/ClientPortalLoader';
import DatePicker from '@/components/client-portal/DatePicker';
import { format, parseISO } from 'date-fns';
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

export default function ScheduleOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Form state
  const [plantId, setPlantId] = useState<string>('');
  const [constructionSiteId, setConstructionSiteId] = useState<string | 'other' | ''>('');
  const [constructionSiteName, setConstructionSiteName] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<string>(formatDateLocal(new Date()));
  const [deliveryTime, setDeliveryTime] = useState<string>('08:00');
  const [productId, setProductId] = useState<string>('');
  const [volume, setVolume] = useState<string>('10');
  const [elemento, setElemento] = useState<string>('');
  const [requiresInvoice, setRequiresInvoice] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

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

  const selectedSite = useMemo(() => sites.find(s => s.id === constructionSiteId), [sites, constructionSiteId]);
  const selectedProduct = useMemo(() => products.find(p => p.id === productId), [products, productId]);
  const todayStr = useMemo(() => formatDateLocal(new Date()), []);

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
        requires_invoice: requiresInvoice,
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
                {/* Plant */}
                <div>
                  <label className="block text-footnote text-label-tertiary mb-2">Planta *</label>
                  <select
                    value={plantId}
                    onChange={async (e) => {
                      const newPlantId = e.target.value;
                      setPlantId(newPlantId);
                      setProductId('');
                      setProductQuery('');
                      setProducts([]);
                    }}
                    className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                  >
                    <option value="">Selecciona una planta…</option>
                    {plants.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Site */}
                <div>
                  <label className="block text-footnote text-label-tertiary mb-2">Obra *</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      value={constructionSiteId}
                      onChange={async (e) => {
                        const value = e.target.value as any;
                        setConstructionSiteId(value);
                        setProductId('');
                        setProductQuery('');
                        if (value && value !== 'other' && plantId) {
                          try {
                            const siteName = sites.find(s => s.id === value)?.name || value;
                            const res = await fetch(`/api/client-portal/master-recipes?site=${encodeURIComponent(siteName)}&plant_id=${encodeURIComponent(plantId)}`);
                            const json = await res.json();
                            if (!res.ok) throw new Error(json.error || 'Error productos');
                            setProducts(json.products || []);
                          } catch (e: any) {
                            setError(e?.message || 'Error cargando productos');
                          }
                        } else {
                          setProducts([]);
                        }
                      }}
                      className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                    >
                      <option value="">Selecciona una obra…</option>
                      {sites.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                      <option value="other">Otra…</option>
                    </select>
                    {constructionSiteId === 'other' && (
                      <input
                        value={constructionSiteName}
                        onChange={(e) => setConstructionSiteName(e.target.value)}
                        placeholder="Nombre de la obra"
                        className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                      />
                    )}
                  </div>
                </div>

                {/* Date & time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DatePicker
                    value={deliveryDate}
                    onChange={setDeliveryDate}
                    minDate={todayStr}
                    label="Fecha de entrega *"
                  />
                  <div>
                    <label className="block text-footnote text-label-tertiary mb-2">Hora preferida</label>
                    <input
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Product - Custom Dropdown */}
                <div>
                  <label className="block text-footnote text-label-tertiary mb-2">Producto *</label>
                  {products.length > 0 && (
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-label-tertiary" />
                      <input
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                        onFocus={() => setProductDropdownOpen(true)}
                        placeholder="Buscar por código, resistencia o tipo…"
                        className="w-full rounded-xl glass-thin px-10 py-2 text-sm border border-white/20 focus:border-primary/50 focus:outline-none"
                      />
                    </div>
                  )}
                  
                  {/* Custom Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                      disabled={!plantId || !constructionSiteId || constructionSiteId === 'other'}
                      className="w-full text-left rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none disabled:opacity-50"
                    >
                      {selectedProduct ? (
                        <div>
                          <div className="font-semibold text-label-primary">{selectedProduct.master_code}</div>
                          <div className="text-sm text-label-secondary mt-1">
                            {selectedProduct.strength_fc} kg/cm² • ${selectedProduct.unit_price.toLocaleString('es-MX')}/m³
                            {selectedProduct.age_days && ` • ${selectedProduct.age_days} días`}
                            {selectedProduct.slump && ` • Rev. ${selectedProduct.slump} cm`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-label-tertiary">Selecciona un producto…</span>
                      )}
                    </button>
                    
                    {productDropdownOpen && filteredProducts.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setProductDropdownOpen(false)} />
                        <div className="absolute z-20 w-full mt-2 max-h-[400px] overflow-y-auto rounded-2xl glass-base border border-white/30 shadow-2xl">
                          {filteredProducts.map(product => (
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
                              <div className="flex items-start justify-between gap-4">
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
                                <div className="text-right">
                                  <div className="font-bold text-primary">
                                    ${product.unit_price.toLocaleString('es-MX')}
                                  </div>
                                  <div className="text-xs text-label-tertiary">por m³</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {products.length === 0 && plantId && constructionSiteId && constructionSiteId !== 'other' && (
                    <p className="text-caption text-label-tertiary mt-2">No hay productos disponibles para esta obra y planta.</p>
                  )}
                </div>

                {/* Volume */}
                <div>
                  <label className="block text-footnote text-label-tertiary mb-2">Volumen (m³) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                  />
                </div>

                {/* Elemento */}
                <div>
                  <label className="block text-footnote text-label-tertiary mb-2">Elemento *</label>
                  <input
                    value={elemento}
                    onChange={(e) => setElemento(e.target.value)}
                    placeholder="Ej. Losas, Cimentación, Columnas"
                    className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                  />
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <input id="factura" type="checkbox" checked={requiresInvoice} onChange={(e) => setRequiresInvoice(e.target.checked)} className="w-4 h-4" />
                    <label htmlFor="factura" className="text-body text-label-secondary">Requiere factura</label>
                  </div>
                </div>

                <div>
                  <label className="block text-footnote text-label-tertiary mb-2">Notas</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="glass"
                    size="lg"
                    disabled={!canContinue}
                    onClick={() => setStep(2)}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass-thin rounded-2xl p-6 border border-white/10">
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-2">Planta</p>
                    <p className="text-title-3 font-bold text-label-primary">{plants.find(p => p.id === plantId)?.name || ''}</p>
                  </div>
                  <div className="glass-thin rounded-2xl p-6 border border-white/10">
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-2">Obra</p>
                    <p className="text-title-3 font-bold text-label-primary">{constructionSiteId === 'other' ? constructionSiteName : (selectedSite?.name || '')}</p>
                  </div>
                  <div className="glass-thin rounded-2xl p-6 border border-white/10">
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-2">Fecha y hora</p>
                    <p className="text-title-3 font-bold text-label-primary">
                      {format(parseISO(deliveryDate), 'dd MMM yyyy', { locale: es })} • {deliveryTime}
                    </p>
                  </div>
                  <div className="glass-thin rounded-2xl p-6 border border-white/10">
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-2">Producto</p>
                    <p className="text-title-3 font-bold text-label-primary">{selectedProduct?.master_code || ''}</p>
                    <p className="text-caption text-label-secondary mt-1">
                      {selectedProduct?.strength_fc} kg/cm²
                      {selectedProduct?.age_days && ` • ${selectedProduct.age_days} días`}
                      {selectedProduct?.slump && ` • Rev. ${selectedProduct.slump} cm`}
                    </p>
                  </div>
                  <div className="glass-thin rounded-2xl p-6 border border-white/10">
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-2">Volumen</p>
                    <p className="text-title-3 font-bold text-label-primary">{Number(volume).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³</p>
                  </div>
                  <div className="glass-thin rounded-2xl p-6 border border-white/10">
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-2">Precio unitario</p>
                    <p className="text-title-3 font-bold text-label-primary">${(selectedProduct?.unit_price || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m³</p>
                  </div>
                  <div className="glass-thin rounded-2xl p-6 border border-white/10">
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-2">Elemento</p>
                    <p className="text-title-3 font-bold text-label-primary">{elemento}</p>
                  </div>
                  <div className="glass-thin rounded-2xl p-6 border border-white/10">
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-2">Factura</p>
                    <p className="text-title-3 font-bold text-label-primary">{requiresInvoice ? 'Sí' : 'No'}</p>
                  </div>
                </div>

                {/* Total */}
                <div className="glass-thin rounded-2xl p-6 border-2 border-primary/30">
                  <div className="flex items-center justify-between">
                    <p className="text-body font-semibold text-label-primary">Total estimado</p>
                    <p className="text-title-1 font-bold text-primary">
                      ${((selectedProduct?.unit_price || 0) * Number(volume)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
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
                  <Button variant="glass" size="lg" disabled={submitting} onClick={handleSubmit}>
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
