'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronLeft, Clock, AlertCircle, Check, Layers } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ClientPortalLoader from '@/components/client-portal/ClientPortalLoader';
import DatePicker from '@/components/client-portal/DatePicker';
import { cn } from '@/lib/utils';
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
  unit_price: number | null; // null if user doesn't have view_prices permission
  quote_detail_id: string;
  quote_id: string;
  quote_number?: string | null;
};

type QuoteExtraItem = {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  name: string;
  code: string;
  unit: string;
  notes: string | null;
  /** Cotización de origen del renglón (puede diferir del concreto elegido) */
  quote_id?: string;
};

/** Radix Select value when slump is null in data */
const SLUMP_NULL_SENTINEL = '__slump_null__';

/** Radix Select value when age_days is null */
const AGE_NULL_SENTINEL = '__age_null__';

const PLACEMENT_EMPTY = '__placement_empty__';

function isLikelyConstructionSiteUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/** Collapse placement_type noise so D / DIRECTO / homoglyphs don’t become duplicate options */
function normalizePlacementForCompare(t: string | null): string {
  return (t ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** One bucket per modo de colocación (D = DIRECTO, B = BOMBEADO, etc.) */
function canonicalPlacementKey(p: Product): string {
  const u = normalizePlacementForCompare(p.placement_type);
  if (!u) return PLACEMENT_EMPTY;
  if (u === 'D' || u === 'DIRECTO' || u === 'DIRECTA') return 'DIRECTO';
  if (u.startsWith('DIRECTO')) return 'DIRECTO';
  if (u === 'B' || u === 'BOMBEADO') return 'BOMBEADO';
  if (u.startsWith('BOMBEADO')) return 'BOMBEADO';
  return u;
}

function formatPlacementLabelFromCanonical(canonicalKey: string): string {
  if (canonicalKey === PLACEMENT_EMPTY) return 'Sin especificar';
  if (canonicalKey === 'DIRECTO') return 'Directo';
  if (canonicalKey === 'BOMBEADO') return 'Bombeado';
  return canonicalKey;
}

function placementSortKeyCanonical(canonicalKey: string): number {
  if (canonicalKey === PLACEMENT_EMPTY) return 99;
  if (canonicalKey === 'DIRECTO') return 0;
  if (canonicalKey === 'BOMBEADO') return 1;
  return 2;
}

function placementSortKeyNorm(k: string): number {
  return placementSortKeyCanonical(k);
}

function formatPriceMx(amount: number): string {
  return amount.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
  const { canCreateOrders, canViewPrices, isLoading: permissionsLoading } = useUserPermissions();
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
  const [quoteExtras, setQuoteExtras] = useState<QuoteExtraItem[]>([]);
  const [extrasLoading, setExtrasLoading] = useState(false);
  const [selectedAdditionalIds, setSelectedAdditionalIds] = useState<Set<string>>(new Set());
  /** Cascading recipe filters: resistencia → revenimiento → colocación */
  const [recipeStrengthKey, setRecipeStrengthKey] = useState('');
  const [recipeSlumpKey, setRecipeSlumpKey] = useState('');
  const [recipePlacementKey, setRecipePlacementKey] = useState('');
  const [recipeAgeKey, setRecipeAgeKey] = useState('');
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

  /** Normalized obra name for APIs (master-recipes + catalog extras) */
  const resolvedSiteName = useMemo(() => {
    if (constructionSiteId === 'other') return constructionSiteName.trim();
    return selectedSite?.name?.trim() ?? '';
  }, [constructionSiteId, constructionSiteName, selectedSite?.name]);

  useEffect(() => {
    if (!plantId || !resolvedSiteName) {
      setQuoteExtras([]);
      setSelectedAdditionalIds(new Set());
      setExtrasLoading(false);
      return;
    }

    const params = new URLSearchParams();
    params.set('site', resolvedSiteName);
    params.set('plant_id', plantId);
    if (
      constructionSiteId &&
      constructionSiteId !== 'other' &&
      isLikelyConstructionSiteUuid(constructionSiteId)
    ) {
      params.set('construction_site_id', constructionSiteId);
    }
    if (selectedProduct?.quote_id) {
      params.set('quote_id', selectedProduct.quote_id);
    }

    let cancelled = false;
    setExtrasLoading(true);

    fetch(`/api/client-portal/catalog-additional-products?${params.toString()}`)
      .then((res) => res.json())
      .then((json: { items?: QuoteExtraItem[] }) => {
        if (cancelled) return;
        const items = json.items ?? [];
        setQuoteExtras(items);
        setSelectedAdditionalIds(new Set(items.map((i) => i.id)));
      })
      .catch(() => {
        if (!cancelled) {
          setQuoteExtras([]);
          setSelectedAdditionalIds(new Set());
        }
      })
      .finally(() => {
        if (!cancelled) setExtrasLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [plantId, resolvedSiteName, constructionSiteId, selectedProduct?.quote_id]);

  const productPickerDisabled =
    !plantId || (!constructionSiteId && constructionSiteId !== 'other');

  // Load products when plant or construction site changes
  useEffect(() => {
    const loadProducts = async () => {
      if (!plantId || (!constructionSiteId && constructionSiteId !== 'other')) {
        setProducts([]);
        setProductId('');
        setRecipeStrengthKey('');
        setRecipeSlumpKey('');
        setRecipePlacementKey('');
        setRecipeAgeKey('');
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
          setProductId('');
          setRecipeStrengthKey('');
          setRecipeSlumpKey('');
          setRecipePlacementKey('');
          setRecipeAgeKey('');
          return;
        }

        const res = await fetch(
          `/api/client-portal/master-recipes?site=${encodeURIComponent(siteName)}&plant_id=${encodeURIComponent(plantId)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al cargar productos');
        setProducts(json.products || []);
        setProductId('');
        setRecipeStrengthKey('');
        setRecipeSlumpKey('');
        setRecipePlacementKey('');
        setRecipeAgeKey('');
      } catch (e: any) {
        console.error('Error loading products:', e);
        setProducts([]);
        setProductId('');
        setRecipeStrengthKey('');
        setRecipeSlumpKey('');
        setRecipePlacementKey('');
        setRecipeAgeKey('');
      } finally {
        setProductLoading(false);
      }
    };

    loadProducts();
  }, [plantId, constructionSiteId, constructionSiteName, selectedSite]);

  const strengthOptions = useMemo(() => {
    const s = new Set<number>();
    for (const p of products) s.add(p.strength_fc);
    return Array.from(s).sort((a, b) => a - b);
  }, [products]);

  const productsAtStrength = useMemo(() => {
    if (recipeStrengthKey === '') return [];
    const fc = Number(recipeStrengthKey);
    return products.filter((p) => p.strength_fc === fc);
  }, [products, recipeStrengthKey]);

  const slumpMeta = useMemo(() => {
    const numeric = new Set<number>();
    let hasNull = false;
    for (const p of productsAtStrength) {
      if (p.slump == null) hasNull = true;
      else numeric.add(p.slump);
    }
    return {
      numeric: Array.from(numeric).sort((a, b) => a - b),
      hasNull,
    };
  }, [productsAtStrength]);

  const productsAtSlump = useMemo(() => {
    if (recipeSlumpKey === '') return [];
    return productsAtStrength.filter((p) => {
      if (recipeSlumpKey === SLUMP_NULL_SENTINEL) return p.slump == null;
      return p.slump === Number(recipeSlumpKey);
    });
  }, [productsAtStrength, recipeSlumpKey]);

  const placementOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const p of productsAtSlump) {
      seen.add(canonicalPlacementKey(p));
    }
    return Array.from(seen).sort((a, b) => {
      const oa = placementSortKeyNorm(a);
      const ob = placementSortKeyNorm(b);
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b);
    });
  }, [productsAtSlump]);

  const productsAtPlacement = useMemo(() => {
    if (recipePlacementKey === '') return [];
    return productsAtSlump.filter((p) => canonicalPlacementKey(p) === recipePlacementKey);
  }, [productsAtSlump, recipePlacementKey]);

  /** Distinct design ages after colocación (variant step 1) */
  const ageOptions = useMemo(() => {
    const ages = new Set<string>();
    for (const p of productsAtPlacement) {
      ages.add(p.age_days == null ? AGE_NULL_SENTINEL : String(p.age_days));
    }
    return Array.from(ages).sort((a, b) => {
      if (a === AGE_NULL_SENTINEL) return 1;
      if (b === AGE_NULL_SENTINEL) return -1;
      return Number(a) - Number(b);
    });
  }, [productsAtPlacement]);

  const productsAtAge = useMemo(() => {
    if (recipePlacementKey === '' || recipeAgeKey === '') return [];
    return productsAtPlacement.filter((p) => {
      if (recipeAgeKey === AGE_NULL_SENTINEL) return p.age_days == null;
      return p.age_days === Number(recipeAgeKey);
    });
  }, [productsAtPlacement, recipePlacementKey, recipeAgeKey]);

  /** Recetas que comparten la misma edad: ordenar por TMA y código */
  const recipesSorted = useMemo(() => {
    return [...productsAtAge].sort((a, b) => {
      const tmaA = a.max_aggregate_size ?? -1;
      const tmaB = b.max_aggregate_size ?? -1;
      if (tmaA !== tmaB) return tmaA - tmaB;
      return a.master_code.localeCompare(b.master_code);
    });
  }, [productsAtAge]);

  useEffect(() => {
    if (productLoading || productPickerDisabled || products.length === 0) return;
    if (strengthOptions.length === 1 && recipeStrengthKey === '') {
      setRecipeStrengthKey(String(strengthOptions[0]));
    }
  }, [productLoading, productPickerDisabled, products.length, strengthOptions, recipeStrengthKey]);

  useEffect(() => {
    if (productLoading || recipeStrengthKey === '') return;
    const { numeric, hasNull } = slumpMeta;
    const nOpts = numeric.length + (hasNull ? 1 : 0);
    if (nOpts === 1 && recipeSlumpKey === '') {
      if (hasNull) setRecipeSlumpKey(SLUMP_NULL_SENTINEL);
      else setRecipeSlumpKey(String(numeric[0]));
    }
  }, [productLoading, recipeStrengthKey, recipeSlumpKey, slumpMeta]);

  useEffect(() => {
    if (productLoading || recipeSlumpKey === '') return;
    if (placementOptions.length === 1 && recipePlacementKey === '') {
      setRecipePlacementKey(placementOptions[0]);
    }
  }, [productLoading, recipeSlumpKey, recipePlacementKey, placementOptions]);

  useEffect(() => {
    if (recipePlacementKey === '') return;
    if (productsAtPlacement.length === 0) {
      setProductId('');
      setRecipeAgeKey('');
    } else if (productsAtPlacement.length === 1) {
      setProductId(productsAtPlacement[0].id);
      setRecipeAgeKey('');
    } else {
      setProductId('');
    }
  }, [recipePlacementKey, productsAtPlacement]);

  useEffect(() => {
    if (recipePlacementKey === '' || productsAtPlacement.length <= 1) return;
    if (ageOptions.length === 1 && recipeAgeKey === '') {
      setRecipeAgeKey(ageOptions[0]);
    }
  }, [recipePlacementKey, productsAtPlacement.length, ageOptions, recipeAgeKey]);

  useEffect(() => {
    if (recipeAgeKey === '') return;
    if (productsAtAge.length === 1) {
      setProductId(productsAtAge[0].id);
    } else if (productsAtAge.length > 1) {
      setProductId((cur) =>
        cur && productsAtAge.some((p) => p.id === cur) ? cur : ''
      );
    } else {
      setProductId('');
    }
  }, [recipeAgeKey, productsAtAge]);

  const canContinue = useMemo(() => {
    const hasSite = constructionSiteId === 'other' ? constructionSiteName.trim().length > 1 : !!constructionSiteId;
    const notPast = !deliveryDate || deliveryDate >= todayStr;
    const extrasBlocking = Boolean(plantId && resolvedSiteName && extrasLoading);
    return (
      hasSite &&
      plantId &&
      deliveryDate &&
      notPast &&
      productId &&
      Number(volume) > 0 &&
      elemento.trim().length > 0 &&
      !extrasBlocking
    );
  }, [
    constructionSiteId,
    constructionSiteName,
    deliveryDate,
    productId,
    volume,
    elemento,
    plantId,
    todayStr,
    resolvedSiteName,
    extrasLoading,
  ]);

  const estimatedLineTotal = useMemo(() => {
    const u = Number(volume);
    const price = selectedProduct?.unit_price;
    if (!canViewPrices || price == null || Number.isNaN(u) || u <= 0) return null;
    return u * price;
  }, [canViewPrices, volume, selectedProduct?.unit_price]);

  const estimatedExtrasTotal = useMemo(() => {
    if (!canViewPrices) return null;
    let sum = 0;
    let anySelected = false;
    for (const ex of quoteExtras) {
      if (!selectedAdditionalIds.has(ex.id)) continue;
      anySelected = true;
      sum += Number(ex.total_price) || 0;
    }
    if (!anySelected) return null;
    return sum;
  }, [canViewPrices, quoteExtras, selectedAdditionalIds]);

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
        unit_price: selectedProduct?.unit_price || 0,
        selected_additional_product_ids: Array.from(selectedAdditionalIds),
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

  if (loading || permissionsLoading) {
    return <ClientPortalLoader message="Cargando programador..." />;
  }

  // Check permissions
  if (!canCreateOrders) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <Container maxWidth="md" className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No tienes permiso para crear pedidos. Contacta al administrador de tu organización.
            </AlertDescription>
          </Alert>
        </Container>
      </div>
    );
  }

  // Note: Order creation works without price visibility; users with view_prices see amounts in the form.

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
                Paso {step} de 2 · Obra y planta → Receta → Extras y volumen → Confirmar
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
                  <label htmlFor="schedule-plant" className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Planta *</label>
                  <Select value={plantId} onValueChange={setPlantId}>
                    <SelectTrigger id="schedule-plant" className="w-full glass-thin border-white/20">
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
                  <label htmlFor="schedule-site" className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Obra *</label>
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
                    <SelectTrigger id="schedule-site" className="w-full glass-thin border-white/20">
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
                    <>
                      <label htmlFor="schedule-site-other" className="block text-footnote text-label-tertiary uppercase tracking-wide mt-3 mb-2">Nombre de la obra *</label>
                      <input
                        id="schedule-site-other"
                        type="text"
                        placeholder="Nombre de la obra"
                        value={constructionSiteName}
                        onChange={(e) => setConstructionSiteName(e.target.value)}
                        className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                      />
                    </>
                  )}
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DatePicker
                    value={deliveryDate}
                    onChange={setDeliveryDate}
                    minDate={todayStr}
                    label="Fecha de entrega *"
                    inputId="schedule-delivery-date"
                  />
                  <div>
                    <p id="schedule-time-heading" className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Hora de entrega *</p>
                    <div role="group" aria-labelledby="schedule-time-heading" className="flex items-center gap-2 p-3 rounded-xl glass-thin border border-white/20">
                      <Clock className="w-5 h-5 shrink-0 text-label-tertiary" aria-hidden />
                      <TimePicker value={deliveryTime} onChange={setDeliveryTime} />
                    </div>
                  </div>
                </div>

                {/* Elemento */}
                <div>
                  <label htmlFor="schedule-elemento" className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Elemento *</label>
                  <input
                    id="schedule-elemento"
                    type="text"
                    placeholder="Ej: Losa de cimentación, Muro, Columna"
                    value={elemento}
                    onChange={(e) => setElemento(e.target.value)}
                    className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                  />
                </div>

                {/* Product — cascada: resistencia → revenimiento → colocación */}
                <div className="rounded-2xl border border-white/20 bg-white/[0.03] p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide">Producto (receta) *</p>
                    {productLoading ? (
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <p className="text-caption text-label-secondary">
                    Primero ubicación y fecha; luego elige resistencia, revenimiento y colocación. Si hay varias líneas en cotización,
                    define edad de diseño y la receta. Los extras vigentes para tu obra y planta aparecen abajo; luego indica el volumen.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="schedule-recipe-strength" className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">
                        1. Resistencia (f&apos;c) *
                      </label>
                      <Select
                        value={recipeStrengthKey}
                        onValueChange={(v) => {
                          setRecipeStrengthKey(v);
                          setRecipeSlumpKey('');
                          setRecipePlacementKey('');
                          setRecipeAgeKey('');
                          setProductId('');
                        }}
                        disabled={productPickerDisabled || productLoading || strengthOptions.length === 0}
                      >
                        <SelectTrigger id="schedule-recipe-strength" className="w-full glass-thin border-white/20">
                          <SelectValue placeholder={
                            strengthOptions.length === 0 && !productLoading
                              ? 'Sin productos para esta obra'
                              : 'Seleccionar kg/cm²'
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {strengthOptions.map((fc) => (
                            <SelectItem key={fc} value={String(fc)}>
                              {fc} kg/cm²
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label htmlFor="schedule-recipe-slump" className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">
                        2. Revenimiento *
                      </label>
                      <Select
                        value={recipeSlumpKey}
                        onValueChange={(v) => {
                          setRecipeSlumpKey(v);
                          setRecipePlacementKey('');
                          setRecipeAgeKey('');
                          setProductId('');
                        }}
                        disabled={
                          productPickerDisabled ||
                          productLoading ||
                          recipeStrengthKey === '' ||
                          (!slumpMeta.hasNull && slumpMeta.numeric.length === 0)
                        }
                      >
                        <SelectTrigger id="schedule-recipe-slump" className="w-full glass-thin border-white/20">
                          <SelectValue placeholder="Seleccionar cm" />
                        </SelectTrigger>
                        <SelectContent>
                          {slumpMeta.numeric.map((cm) => (
                            <SelectItem key={cm} value={String(cm)}>
                              {cm} cm
                            </SelectItem>
                          ))}
                          {slumpMeta.hasNull ? (
                            <SelectItem value={SLUMP_NULL_SENTINEL}>Sin dato</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label htmlFor="schedule-recipe-placement" className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">
                        3. Colocación *
                      </label>
                      <Select
                        key={`coloc-${placementOptions.join('|')}`}
                        value={recipePlacementKey}
                        onValueChange={(v) => {
                          setRecipePlacementKey(v);
                          setRecipeAgeKey('');
                          setProductId('');
                        }}
                        disabled={
                          productPickerDisabled ||
                          productLoading ||
                          recipeSlumpKey === '' ||
                          placementOptions.length === 0
                        }
                      >
                        <SelectTrigger id="schedule-recipe-placement" className="w-full glass-thin border-white/20">
                          <SelectValue placeholder="Directo o bombeado" />
                        </SelectTrigger>
                        <SelectContent>
                          {placementOptions.map((canonicalKey) => (
                            <SelectItem key={canonicalKey} value={canonicalKey}>
                              {formatPlacementLabelFromCanonical(canonicalKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {productsAtPlacement.length > 1 ? (
                      <div className="space-y-4 border-t border-white/10 pt-4">
                        <div>
                          <label
                            htmlFor="schedule-recipe-age"
                            className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2"
                          >
                            4. Edad de diseño *
                          </label>
                          <p className="text-caption text-label-secondary mb-3">
                            Primero la edad de garantía en días; después eliges la receta concreta.
                          </p>
                          <Select
                            value={recipeAgeKey}
                            onValueChange={(v) => {
                              setRecipeAgeKey(v);
                              setProductId('');
                            }}
                            disabled={
                              productPickerDisabled ||
                              productLoading ||
                              recipePlacementKey === '' ||
                              ageOptions.length === 0
                            }
                          >
                            <SelectTrigger id="schedule-recipe-age" className="w-full glass-thin border-white/20">
                              <SelectValue placeholder="Seleccionar edad (días)" />
                            </SelectTrigger>
                            <SelectContent>
                              {ageOptions.map((key) => (
                                <SelectItem key={key} value={key}>
                                  {key === AGE_NULL_SENTINEL ? 'Sin dato' : `${key} días`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {recipeAgeKey !== '' && productsAtAge.length > 1 ? (
                          <div className="space-y-3">
                            <div>
                              <p className="block text-footnote text-label-tertiary uppercase tracking-wide mb-1">
                                5. Receta *
                              </p>
                              <p className="text-caption text-label-secondary">
                                El código es la receta maestra en cotización: cada variante es un master distinto (p. ej. TMA o aditivo). Si varias comparten edad y precio, el portal puede mostrar una sola opción por especificación (resistencia, revenimiento, colocación, edad, TMA).
                              </p>
                            </div>
                            <ul className="space-y-2" role="listbox" aria-label="Elige la receta">
                              {recipesSorted.map((p) => {
                                const selected = productId === p.id;
                                return (
                                  <li key={p.id}>
                                    <button
                                      type="button"
                                      role="option"
                                      aria-selected={selected}
                                      onClick={() => setProductId(p.id)}
                                      className={cn(
                                        'flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                                        selected
                                          ? 'border-primary bg-primary/10 ring-1 ring-primary/35'
                                          : 'border-white/20 bg-white/[0.04] hover:border-white/35 hover:bg-white/[0.07]'
                                      )}
                                    >
                                      <div className="min-w-0">
                                        <p className="font-mono text-body font-semibold tracking-tight text-label-primary">
                                          {p.master_code}
                                        </p>
                                        <p className="text-caption text-label-secondary">
                                          {p.max_aggregate_size != null ? `TMA ${p.max_aggregate_size} mm` : 'TMA —'}
                                          {p.quote_number ? ` · Cot. ${p.quote_number}` : ''}
                                        </p>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-3">
                                        {canViewPrices && p.unit_price != null ? (
                                          <div className="text-right">
                                            <p className="text-footnote uppercase tracking-wide text-label-tertiary">
                                              Precio
                                            </p>
                                            <p className="text-body font-bold tabular-nums text-label-primary">
                                              {formatPriceMx(p.unit_price)}
                                            </p>
                                            <p className="text-caption text-label-tertiary">/ m³</p>
                                          </div>
                                        ) : null}
                                        <span
                                          className={cn(
                                            'flex h-9 w-9 items-center justify-center rounded-full border-2',
                                            selected
                                              ? 'border-primary bg-primary/15 text-primary'
                                              : 'border-white/25 text-transparent'
                                          )}
                                          aria-hidden
                                        >
                                          {selected ? <Check className="h-5 w-5" strokeWidth={2.5} /> : null}
                                        </span>
                                      </div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {recipePlacementKey !== '' &&
                    productsAtPlacement.length === 0 &&
                    !productLoading ? (
                      <p className="text-callout text-amber-700 dark:text-amber-400">
                        No hay recetas que coincidan con esta combinación. Prueba otra colocación u obra.
                      </p>
                    ) : null}

                    {canViewPrices && productId && selectedProduct ? (
                      <div className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3">
                        <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-2">Precio</p>
                        {selectedProduct.unit_price != null ? (
                          <>
                            <p className="text-title-3 font-bold text-label-primary">
                              {formatPriceMx(selectedProduct.unit_price)}
                              <span className="text-body font-normal text-label-secondary"> / m³</span>
                            </p>
                            {estimatedLineTotal != null ? (
                              <p className="text-callout text-label-secondary mt-2">
                                Total estimado:{' '}
                                <span className="font-semibold text-label-primary">
                                  {formatPriceMx(estimatedLineTotal)}
                                </span>
                                <span className="text-caption text-label-tertiary">
                                  {' '}
                                  ({Number(volume).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                                  m³)
                                </span>
                              </p>
                            ) : (
                              <p className="text-caption text-label-tertiary mt-2">
                                Indica el volumen abajo para ver el total estimado.
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-callout text-label-secondary">
                            Precio unitario no disponible para esta receta en el portal.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Catálogo de extras: cliente + obra + planta (cotización más reciente por producto) */}
                {plantId && resolvedSiteName ? (
                  <div className="rounded-2xl border border-white/20 bg-white/[0.03] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers className="w-4 h-4 shrink-0 text-primary" aria-hidden />
                        <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                          Productos adicionales (obra y planta)
                        </p>
                      </div>
                      {extrasLoading ? (
                        <span
                          className="h-4 w-4 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <p className="text-caption text-label-secondary">
                      Precios tomados de cotizaciones aprobadas para esta obra; por producto se usa la línea más reciente. Marcado por defecto;
                      desmarca lo que no vaya en este pedido.
                    </p>
                    {!extrasLoading && quoteExtras.length === 0 ? (
                      <p className="text-callout text-label-tertiary">
                        No hay partidas adicionales activas para esta obra y planta en cotizaciones aprobadas.
                      </p>
                    ) : null}
                    {!extrasLoading && quoteExtras.length > 0 ? (
                      <ul className="space-y-3 list-none p-0 m-0">
                        {quoteExtras.map((ex) => (
                          <li
                            key={ex.id}
                            className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 items-start"
                          >
                            <input
                              type="checkbox"
                              id={`schedule-extra-${ex.id}`}
                              checked={selectedAdditionalIds.has(ex.id)}
                              onChange={() =>
                                setSelectedAdditionalIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(ex.id)) next.delete(ex.id);
                                  else next.add(ex.id);
                                  return next;
                                })
                              }
                              className="mt-1 h-4 w-4 shrink-0 rounded border-white/30 accent-primary"
                            />
                            <label htmlFor={`schedule-extra-${ex.id}`} className="flex-1 cursor-pointer min-w-0">
                              <span className="text-body font-semibold text-label-primary">{ex.name}</span>
                              {ex.code ? (
                                <span className="text-caption text-label-tertiary ml-2">({ex.code})</span>
                              ) : null}
                              <span className="block text-callout text-label-secondary mt-0.5">
                                Cant. {ex.quantity}
                                {ex.unit ? ` ${ex.unit}` : ''}
                                {canViewPrices && ex.unit_price != null
                                  ? ` · ${formatPriceMx(ex.unit_price)} c/u`
                                  : ''}
                              </span>
                              {ex.notes ? (
                                <span className="block text-caption text-label-tertiary mt-1">{ex.notes}</span>
                              ) : null}
                            </label>
                            {canViewPrices && ex.total_price != null ? (
                              <span className="text-body font-semibold text-label-primary tabular-nums shrink-0">
                                {formatPriceMx(ex.total_price)}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {canViewPrices && estimatedExtrasTotal != null ? (
                      <p className="text-callout text-label-secondary pt-1 border-t border-white/10">
                        Subtotal extras (referencia, sin IVA):{' '}
                        <span className="font-semibold text-label-primary">{formatPriceMx(estimatedExtrasTotal)}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Volume */}
                <div>
                  <label htmlFor="schedule-volume" className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Volumen (m³) *</label>
                  <input
                    id="schedule-volume"
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
                  <label htmlFor="schedule-notes" className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">Notas (Opcional)</label>
                  <textarea
                    id="schedule-notes"
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
                        <p className="text-callout text-label-secondary">
                          <span className="font-semibold">Colocación:</span>{' '}
                          {selectedProduct
                            ? formatPlacementLabelFromCanonical(canonicalPlacementKey(selectedProduct))
                            : '—'}
                        </p>
                      </div>
                    </div>
                    {canViewPrices && selectedProduct?.unit_price != null ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                        <p className="text-caption text-label-tertiary uppercase tracking-wide mb-1">Precio unitario</p>
                        <p className="text-body font-semibold text-label-primary">
                          {formatPriceMx(selectedProduct.unit_price)} / m³
                        </p>
                        {estimatedLineTotal != null ? (
                          <>
                            <p className="text-caption text-label-tertiary uppercase tracking-wide mt-3 mb-1">
                              Total estimado
                            </p>
                            <p className="text-title-3 font-bold text-label-primary">
                              {formatPriceMx(estimatedLineTotal)}
                            </p>
                            <p className="text-caption text-label-tertiary mt-1">
                              {Number(volume).toLocaleString('es-MX', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              m³ · Referencia antes de impuestos
                            </p>
                          </>
                        ) : null}
                      </div>
                    ) : canViewPrices && selectedProduct ? (
                      <p className="text-callout text-label-tertiary mt-3">
                        Precio unitario no disponible para esta receta en el portal.
                      </p>
                    ) : null}
                  </div>

                  {plantId && resolvedSiteName ? (
                    <div className="glass-thin rounded-2xl p-5 border border-white/10">
                      <p className="text-caption text-label-tertiary uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary shrink-0" aria-hidden />
                        Productos adicionales (cotización)
                      </p>
                      {quoteExtras.length === 0 ? (
                        <p className="text-callout text-label-tertiary">
                          Sin partidas adicionales en esta cotización.
                        </p>
                      ) : (
                        <ul className="space-y-3 list-none p-0 m-0">
                          {quoteExtras.map((ex) => {
                            const on = selectedAdditionalIds.has(ex.id);
                            return (
                              <li
                                key={`rev-${ex.id}`}
                                className="flex justify-between gap-4 text-callout border-b border-white/10 pb-3 last:border-0 last:pb-0"
                              >
                                <span className={`min-w-0 ${on ? 'text-label-primary' : 'text-label-tertiary line-through'}`}>
                                  {ex.name}
                                  {ex.code ? ` (${ex.code})` : ''}
                                  {on ? '' : ' — no incluido'}
                                </span>
                                {canViewPrices && on && ex.total_price != null ? (
                                  <span className="shrink-0 font-semibold tabular-nums">{formatPriceMx(ex.total_price)}</span>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {canViewPrices && estimatedExtrasTotal != null ? (
                        <p className="text-footnote text-label-secondary mt-4 pt-3 border-t border-white/10">
                          Subtotal extras (referencia, sin IVA):{' '}
                          <span className="font-semibold text-label-primary">{formatPriceMx(estimatedExtrasTotal)}</span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}

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
