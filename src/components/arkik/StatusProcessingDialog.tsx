'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, ArrowRight, Trash2, User, Truck, Calendar, Package,
  Check, Factory, Search, CheckCircle, XCircle, Loader2, Info
} from 'lucide-react';
import type { StagingRemision, StatusProcessingDecision, StatusProcessingAction } from '@/types/arkik';
import { StatusProcessingAction as SPA } from '@/types/arkik';

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLocalTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const calculateCompatibilityScore = (problemRemision: StagingRemision, candidate: StagingRemision): number => {
  let score = 0;
  if (candidate.conductor === problemRemision.conductor) score += 100;
  if (candidate.placas === problemRemision.placas) score += 50;
  const timeDiff = Math.abs(candidate.fecha.getTime() - problemRemision.fecha.getTime());
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
  if (daysDiff === 0) score += 20;
  else if (daysDiff <= 1) score += 10;
  if (Object.values(candidate.materials_real).every(amount => amount === 0)) score += 30;
  if (candidate.recipe_code && problemRemision.recipe_code && candidate.recipe_code === problemRemision.recipe_code) score += 15;
  return score;
};

const getCompatibilityIndicators = (problemRemision: StagingRemision, candidate: StagingRemision) => {
  const indicators = [];
  if (candidate.conductor === problemRemision.conductor)
    indicators.push({ icon: User, label: 'Mismo conductor', color: 'bg-green-100 text-green-800' });
  if (candidate.placas === problemRemision.placas)
    indicators.push({ icon: Truck, label: 'Misma unidad', color: 'bg-blue-100 text-blue-800' });
  const timeDiff = Math.abs(candidate.fecha.getTime() - problemRemision.fecha.getTime());
  if (timeDiff / (1000 * 60 * 60 * 24) === 0)
    indicators.push({ icon: Calendar, label: 'Mismo día', color: 'bg-yellow-100 text-yellow-800' });
  if (Object.values(candidate.materials_real).every(amount => amount === 0))
    indicators.push({ icon: Package, label: 'Sin materiales', color: 'bg-purple-100 text-purple-800' });
  return indicators;
};

interface Plant { id: string; name: string; code: string; }

interface CrossPlantPreview {
  found: boolean;
  remision_id?: string;
  remision_number?: string;
  volumen_fabricado?: number;
  fecha?: string;
  client_name?: string | null;
  construction_site?: string | null;
}

interface StatusProcessingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  remision: StagingRemision | null;
  potentialTargets: StagingRemision[];
  onSaveDecision: (decision: StatusProcessingDecision) => void;
  currentPlantId?: string;
}

// ── Action card component ──────────────────────────────────────────────────
interface ActionCardProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: 'gray' | 'blue' | 'red' | 'indigo';
  disabled?: boolean;
}

const accentStyles = {
  gray:   { border: 'border-gray-700',   bg: 'bg-gray-50',   icon: 'text-gray-600',   check: 'bg-gray-700'   },
  blue:   { border: 'border-blue-600',   bg: 'bg-blue-50',   icon: 'text-blue-600',   check: 'bg-blue-600'   },
  red:    { border: 'border-red-500',    bg: 'bg-red-50',    icon: 'text-red-500',    check: 'bg-red-500'    },
  indigo: { border: 'border-indigo-600', bg: 'bg-indigo-50', icon: 'text-indigo-600', check: 'bg-indigo-600' },
};

function ActionCard({ selected, onClick, icon, title, description, accent, disabled }: ActionCardProps) {
  const s = accentStyles[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        relative w-full text-left rounded-lg border-2 p-4 transition-all
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500
        disabled:opacity-40 disabled:cursor-not-allowed
        ${selected
          ? `${s.border} ${s.bg}`
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 disabled:hover:border-gray-200 disabled:hover:bg-white'
        }
      `}
    >
      {selected && (
        <span className={`absolute top-3 right-3 w-5 h-5 rounded-full ${s.check} flex items-center justify-center`}>
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        </span>
      )}
      <span className={`block mb-2 [&>svg]:h-5 [&>svg]:w-5 ${selected ? s.icon : 'text-gray-400'}`}>
        {icon}
      </span>
      <span className="block text-sm font-semibold text-gray-900 leading-tight mb-1">{title}</span>
      <span className="block text-xs text-gray-500 leading-relaxed">{description}</span>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function StatusProcessingDialog({
  isOpen, onClose, remision, potentialTargets, onSaveDecision, currentPlantId
}: StatusProcessingDialogProps) {
  const [action, setAction] = useState<StatusProcessingAction | ''>('');
  const [targetRemisionNumber, setTargetRemisionNumber] = useState('');
  const [wasteReason, setWasteReason] = useState('');
  const [notes, setNotes] = useState('');
  const [materialsToTransfer, setMaterialsToTransfer] = useState<Record<string, number>>({});

  const [reassignSearch, setReassignSearch] = useState('');

  const [availablePlants, setAvailablePlants] = useState<Plant[]>([]);
  const [plantsLoading, setPlantsLoading] = useState(false);
  const [plantsError, setPlantsError] = useState<string | null>(null);
  const [plantsFetched, setPlantsFetched] = useState(false);
  const [crossPlantTargetPlantId, setCrossPlantTargetPlantId] = useState('');
  const [crossPlantRemisionNumber, setCrossPlantRemisionNumber] = useState('');
  const [crossPlantPreview, setCrossPlantPreview] = useState<CrossPlantPreview | null>(null);
  const [crossPlantPreviewLoading, setCrossPlantPreviewLoading] = useState(false);
  const [crossPlantUnconfirmedAllowed, setCrossPlantUnconfirmedAllowed] = useState(false);

  const fetchPlants = async () => {
    setPlantsLoading(true);
    setPlantsError(null);
    try {
      const res = await fetch('/api/production-control/plants-for-cross-plant');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar plantas');
      setAvailablePlants(data.plants ?? []);
      setPlantsFetched(true);
    } catch (e: any) {
      setPlantsError(e.message ?? 'No se pudieron cargar las plantas');
    } finally {
      setPlantsLoading(false);
    }
  };

  useEffect(() => {
    const isCrossPlantAction = action === SPA.MARK_AS_CROSS_PLANT_PRODUCTION || action === SPA.MARK_AS_CROSS_PLANT_BILLING;
    if (!isCrossPlantAction || plantsFetched || plantsLoading) return;
    fetchPlants();
  }, [action, plantsFetched, plantsLoading]);

  const handleCrossPlantPreview = async () => {
    if (!crossPlantTargetPlantId || !crossPlantRemisionNumber.trim()) return;
    setCrossPlantPreviewLoading(true);
    setCrossPlantPreview(null);
    try {
      const res = await fetch(
        `/api/arkik/cross-plant-preview?plant_id=${crossPlantTargetPlantId}&remision_number=${encodeURIComponent(crossPlantRemisionNumber.trim())}`
      );
      setCrossPlantPreview(await res.json());
    } catch {
      setCrossPlantPreview({ found: false });
    } finally {
      setCrossPlantPreviewLoading(false);
    }
  };

  const resetForm = () => {
    setAction(''); setTargetRemisionNumber(''); setWasteReason(''); setNotes('');
    setMaterialsToTransfer({}); setReassignSearch(''); setCrossPlantTargetPlantId(''); setCrossPlantRemisionNumber('');
    setCrossPlantPreview(null); setCrossPlantPreviewLoading(false); setCrossPlantUnconfirmedAllowed(false);
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleSave = () => {
    if (!remision || !action) return;
    const decision: StatusProcessingDecision = {
      remision_id: remision.id, remision_number: remision.remision_number,
      original_status: remision.estatus, action: action as StatusProcessingAction, notes
    };
    if (action === SPA.REASSIGN_TO_EXISTING) {
      if (!targetRemisionNumber) { alert('Selecciona una remisión destino para la reasignación'); return; }
      decision.target_remision_number = targetRemisionNumber;
      decision.materials_to_transfer = Object.keys(materialsToTransfer).length > 0 ? materialsToTransfer : remision.materials_real;
    }
    if (action === SPA.MARK_AS_WASTE) {
      if (!wasteReason) { alert('Ingresa la razón del desperdicio'); return; }
      decision.waste_reason = wasteReason;
    }
    if (action === SPA.MARK_AS_CROSS_PLANT_BILLING) {
      if (!crossPlantTargetPlantId) { alert('Selecciona la planta que dosificó el concreto'); return; }
      const plant = availablePlants.find(p => p.id === crossPlantTargetPlantId);
      decision.target_plant_id = crossPlantTargetPlantId;
      decision.target_plant_name = plant?.name;
    }
    if (action === SPA.MARK_AS_CROSS_PLANT_PRODUCTION) {
      if (!crossPlantTargetPlantId) { alert('Selecciona la planta de facturación'); return; }
      if (!crossPlantRemisionNumber.trim()) { alert('Ingresa el número de remisión de facturación'); return; }
      if (!crossPlantPreview?.found && !crossPlantUnconfirmedAllowed) {
        alert('Confirma la remisión de facturación o elige continuar sin confirmar'); return;
      }
      const plant = availablePlants.find(p => p.id === crossPlantTargetPlantId);
      decision.target_plant_id = crossPlantTargetPlantId;
      decision.target_plant_name = plant?.name;
      decision.target_remision_number = crossPlantRemisionNumber.trim();
      decision.cross_plant_confirmed = crossPlantPreview?.found === true;
    }
    onSaveDecision(decision);
    handleClose();
  };

  const initializeMaterialsForTransfer = () => {
    if (remision && Object.keys(materialsToTransfer).length === 0)
      setMaterialsToTransfer({ ...remision.materials_real });
  };

  const updateMaterialAmount = (code: string, amount: number) =>
    setMaterialsToTransfer(prev => ({ ...prev, [code]: amount }));

  if (!remision) return null;

  const getActionTitle = () => {
    switch (action) {
      case SPA.PROCEED_NORMAL: return 'Procesar normalmente';
      case SPA.REASSIGN_TO_EXISTING: return 'Reasignar materiales';
      case SPA.MARK_AS_WASTE: return 'Marcar como desperdicio';
      case SPA.MARK_AS_CROSS_PLANT_PRODUCTION: return 'Producción para otra planta';
      case SPA.MARK_AS_CROSS_PLANT_BILLING: return 'Concreto producido en otra planta';
      default: return '';
    }
  };

  const isCancelledWithMaterials =
    remision.estatus.toLowerCase().includes('cancelado') &&
    Object.values(remision.materials_real).some(v => v > 0);

  const isTerminadoSinMateriales =
    remision.estatus.toLowerCase().includes('terminado') &&
    !remision.estatus.toLowerCase().includes('incompleto') &&
    Object.values(remision.materials_real).every(v => v === 0);

  const getStatusVariant = (status: string): 'destructive' | 'secondary' | 'outline' => {
    if (status.toLowerCase().includes('cancelado')) return 'destructive';
    if (status.toLowerCase().includes('incompleto')) return 'secondary';
    return 'outline';
  };

  const selectedPlantName = availablePlants.find(p => p.id === crossPlantTargetPlantId)?.name;

  const isSaveDisabled =
    !action ||
    (action === SPA.MARK_AS_CROSS_PLANT_BILLING && !crossPlantTargetPlantId) ||
    (action === SPA.MARK_AS_CROSS_PLANT_PRODUCTION &&
      crossPlantPreview !== null && !crossPlantPreview.found && !crossPlantUnconfirmedAllowed);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold text-gray-900 leading-tight">
                Procesar Remisión{' '}
                <span className="font-mono text-gray-500">#{remision.remision_number}</span>
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant={getStatusVariant(remision.estatus)} className="text-xs capitalize">
                  {remision.estatus}
                </Badge>
                <DialogDescription className="text-xs text-gray-400 truncate m-0 p-0">
                  {remision.cliente_name} · {remision.obra_name}
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Remision details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            {[
              { label: 'Fecha',     value: formatLocalDate(remision.fecha) },
              { label: 'Hora',      value: remision.hora_carga instanceof Date ? formatLocalTime(remision.hora_carga) : formatLocalTime(new Date(remision.hora_carga as any)) },
              { label: 'Volumen',   value: `${remision.volumen_fabricado.toFixed(1)} m³` },
              { label: 'Conductor', value: remision.conductor || '—' },
              { label: 'Camión',    value: remision.placas || '—' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{item.label}</p>
                <p className="font-medium text-gray-800">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Materials */}
          {Object.values(remision.materials_real).some(v => v > 0) ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Materiales Consumidos</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(remision.materials_real)
                  .filter(([, v]) => v > 0)
                  .map(([code, amount]) => (
                    <div key={code} className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5">
                      <span className="text-xs font-medium text-slate-500">{code}</span>
                      <span className="text-sm font-bold text-slate-800">{amount.toFixed(0)}<span className="text-xs font-normal text-slate-400 ml-0.5">kg</span></span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
              <Package className="h-3.5 w-3.5" />
              Sin materiales registrados en esta remisión
            </div>
          )}

          <div className="h-px bg-gray-100" />

          {/* ── Action Selection ───────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">Seleccionar acción</p>

            {isTerminadoSinMateriales && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                Remisión entregada sin materiales. Generalmente indica que otra planta dosificó el concreto.
              </div>
            )}

            {isTerminadoSinMateriales ? (
              <div className="grid grid-cols-2 gap-3">
                <ActionCard
                  selected={action === SPA.MARK_AS_CROSS_PLANT_BILLING}
                  onClick={() => setAction(SPA.MARK_AS_CROSS_PLANT_BILLING)}
                  icon={<Factory />}
                  accent="indigo"
                  title="Producido en otra planta"
                  description="Selecciona la planta que dosificó. El vínculo con su remisión se establece automáticamente."
                />
                <ActionCard
                  selected={action === SPA.PROCEED_NORMAL}
                  onClick={() => setAction(SPA.PROCEED_NORMAL)}
                  icon={<CheckCircle />}
                  accent="gray"
                  title="Procesar sin materiales"
                  description="Importar la remisión tal como está. La confirmación quedará pendiente."
                />
              </div>
            ) : (
              <div className={`grid gap-3 ${isCancelledWithMaterials ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <ActionCard
                  selected={action === SPA.PROCEED_NORMAL}
                  onClick={() => setAction(SPA.PROCEED_NORMAL)}
                  icon={<CheckCircle />}
                  accent="gray"
                  title="Procesar normal"
                  description="Importar esta remisión con sus materiales registrados."
                />
                <ActionCard
                  selected={action === SPA.REASSIGN_TO_EXISTING}
                  onClick={() => { setAction(SPA.REASSIGN_TO_EXISTING); initializeMaterialsForTransfer(); }}
                  icon={<ArrowRight />}
                  accent="blue"
                  title="Reasignar"
                  description={
                    potentialTargets.length === 0
                      ? 'Sin candidatos disponibles.'
                      : `Transferir materiales a otra remisión (${potentialTargets.length} candidatos).`
                  }
                  disabled={potentialTargets.length === 0}
                />
                <ActionCard
                  selected={action === SPA.MARK_AS_WASTE}
                  onClick={() => setAction(SPA.MARK_AS_WASTE)}
                  icon={<Trash2 />}
                  accent="red"
                  title="Desperdicio"
                  description="Los materiales no se importarán al inventario."
                />
                {isCancelledWithMaterials && (
                  <ActionCard
                    selected={action === SPA.MARK_AS_CROSS_PLANT_PRODUCTION}
                    onClick={() => setAction(SPA.MARK_AS_CROSS_PLANT_PRODUCTION)}
                    icon={<Factory />}
                    accent="indigo"
                    title="Producción cruzada"
                    description="Producido aquí, facturado en otra planta."
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Reassign form ──────────────────────────────────────── */}
          {action === SPA.REASSIGN_TO_EXISTING && potentialTargets.length > 0 && (
            <>
              <div className="h-px bg-gray-100" />
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Selecciona la remisión destino</p>
                  <p className="text-xs text-gray-400 mt-0.5">Ordenadas por compatibilidad. Verde = mismo conductor (mayor prioridad).</p>
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <Input
                    value={reassignSearch}
                    onChange={e => setReassignSearch(e.target.value)}
                    placeholder="Filtrar por # remisión, conductor o camión..."
                    className="pl-8 h-9 text-sm"
                  />
                  {reassignSearch && (
                    <button
                      type="button"
                      onClick={() => setReassignSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Candidate card list */}
                {(() => {
                  const q = reassignSearch.toLowerCase().trim();
                  const scored = potentialTargets
                    .map(t => ({ t, score: calculateCompatibilityScore(remision, t) }))
                    .sort((a, b) => b.score - a.score);
                  const filtered = q
                    ? scored.filter(({ t }) =>
                        t.remision_number.includes(q) ||
                        (t.conductor ?? '').toLowerCase().includes(q) ||
                        (t.placas ?? '').toLowerCase().includes(q)
                      )
                    : scored;

                  return (
                    <>
                      {q && (
                        <p className="text-xs text-gray-400">
                          {filtered.length === 0 ? 'Sin resultados' : `${filtered.length} de ${potentialTargets.length} candidatos`}
                        </p>
                      )}
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                        {filtered.length === 0 ? (
                          <div className="text-center py-6 text-sm text-gray-400">
                            No hay candidatos que coincidan con "{reassignSearch}"
                          </div>
                        ) : filtered.map(({ t: target, score }) => {
                          const indicators = getCompatibilityIndicators(remision, target);
                          const hasZeroMat = Object.values(target.materials_real).every(v => v === 0);
                          const isSelected = targetRemisionNumber === target.remision_number;
                          return (
                            <button
                              key={target.id}
                              type="button"
                              onClick={() => setTargetRemisionNumber(target.remision_number)}
                              className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-semibold text-sm ${isSelected ? 'text-blue-800' : 'text-gray-900'}`}>
                                      #{target.remision_number}
                                    </span>
                                    <Badge variant="outline" className={`text-xs px-1.5 py-0 ${score >= 100 ? 'bg-green-50 text-green-700 border-green-200' : score >= 50 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                      {score} pts
                                    </Badge>
                                    {hasZeroMat && (
                                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 px-1.5 py-0">Sin materiales</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                                    {target.conductor && (
                                      <span className={`flex items-center gap-1 ${target.conductor === remision.conductor ? 'text-green-700 font-semibold' : 'text-gray-500'}`}>
                                        <User className="h-3 w-3" />{target.conductor}
                                      </span>
                                    )}
                                    {target.placas && (
                                      <span className={`flex items-center gap-1 ${target.placas === remision.placas ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}>
                                        <Truck className="h-3 w-3" />{target.placas}
                                      </span>
                                    )}
                                  </div>
                                  {indicators.length > 0 && (
                                    <div className="flex gap-1 flex-wrap mt-1.5">
                                      {indicators.map((ind, i) => {
                                        const Ic = ind.icon;
                                        return (
                                          <span key={i} className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border ${ind.color}`}>
                                            <Ic className="h-3 w-3" />{ind.label}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                                  <span className={`text-sm font-semibold ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>
                                    {target.volumen_fabricado.toFixed(1)} m³
                                  </span>
                                  <span className="text-xs text-gray-400">{formatLocalDate(target.fecha)}</span>
                                  {isSelected && (
                                    <span className="mt-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                {/* Selected target confirmation */}
                {targetRemisionNumber && (() => {
                  const selected = potentialTargets.find(t => t.remision_number === targetRemisionNumber);
                  if (!selected) return null;
                  return (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                      <p className="font-medium text-blue-800 mb-1">Reasignación seleccionada</p>
                      <p className="text-blue-700 text-xs">
                        Los materiales de <strong>Remisión #{remision.remision_number}</strong> serán transferidos a{' '}
                        <strong>Remisión #{selected.remision_number}</strong>
                        {selected.conductor ? ` (${selected.conductor})` : ''}.
                      </p>
                    </div>
                  );
                })()}

                <p className="text-sm font-semibold text-gray-900">Materiales a transferir</p>
                <div className="space-y-2">
                  {Object.entries(materialsToTransfer).map(([code, amount]) => (
                    <div key={code} className="flex items-center gap-3">
                      <span className="w-20 text-sm font-medium text-gray-600">{code}</span>
                      <Input
                        type="number" step="0.01" value={amount}
                        onChange={e => updateMaterialAmount(code, parseFloat(e.target.value) || 0)}
                        className="flex-1 h-9"
                      />
                      <span className="text-xs text-gray-400 w-6">kg</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400">Los materiales se sumarán al consumo real de la remisión destino.</p>
              </div>
            </>
          )}

          {/* ── Waste form ─────────────────────────────────────────── */}
          {action === SPA.MARK_AS_WASTE && (
            <>
              <div className="h-px bg-gray-100" />
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-900">
                  Razón del desperdicio <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={wasteReason}
                  onChange={e => setWasteReason(e.target.value)}
                  placeholder="Ej: Cancelación del cliente, falla en bomba..."
                  className="h-10"
                />
                <p className="text-xs text-gray-400">Los materiales marcados como desperdicio no se importarán al inventario.</p>
              </div>
            </>
          )}

          {/* ── Cross-plant BILLING form (Plant A) ────────────────── */}
          {action === SPA.MARK_AS_CROSS_PLANT_BILLING && (
            <>
              <div className="h-px bg-gray-100" />
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold text-gray-900">
                    ¿En qué planta se dosificó el concreto? <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-gray-400 mt-0.5">No necesitas el número de remisión de esa planta — el vínculo se establece automáticamente.</p>
                </div>
                <Select value={crossPlantTargetPlantId} onValueChange={setCrossPlantTargetPlantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la planta productora..." />
                  </SelectTrigger>
                  <SelectContent>
                    {plantsLoading ? (
                      <div className="p-3 space-y-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />)}
                      </div>
                    ) : plantsError ? (
                      <div className="p-3 space-y-2">
                        <p className="text-xs text-red-600">{plantsError}</p>
                        <button
                          type="button"
                          onClick={fetchPlants}
                          className="text-xs text-indigo-600 hover:underline font-medium"
                        >
                          Reintentar
                        </button>
                      </div>
                    ) : availablePlants.length === 0 ? (
                      <div className="p-3">
                        <p className="text-xs text-gray-400">No hay otras plantas registradas.</p>
                      </div>
                    ) : availablePlants.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {crossPlantTargetPlantId && (
                  <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-lg px-3.5 py-3 text-sm text-blue-800">
                    <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>
                      Cuando <strong>{selectedPlantName ?? 'esa planta'}</strong> suba su archivo Arkik, el sistema vinculará las remisiones automáticamente. No se requiere ninguna acción adicional.
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Cross-plant PRODUCTION form (Plant B) ─────────────── */}
          {action === SPA.MARK_AS_CROSS_PLANT_PRODUCTION && (
            <>
              <div className="h-px bg-gray-100" />
              <div className="space-y-4">
                <div className="flex items-start gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-3 py-2">
                  <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  Los materiales quedan registrados en esta planta. El sistema vinculará esta remisión con la de facturación para trazabilidad y costos.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      Planta que facturó al cliente <span className="text-red-500">*</span>
                    </Label>
                    <Select value={crossPlantTargetPlantId} onValueChange={v => { setCrossPlantTargetPlantId(v); setCrossPlantPreview(null); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona planta..." />
                      </SelectTrigger>
                      <SelectContent>
                        {plantsLoading ? (
                          <div className="p-3 space-y-2">
                            {[1, 2, 3].map(i => <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />)}
                          </div>
                        ) : plantsError ? (
                          <div className="p-3 space-y-2">
                            <p className="text-xs text-red-600">{plantsError}</p>
                            <button
                              type="button"
                              onClick={fetchPlants}
                              className="text-xs text-indigo-600 hover:underline font-medium"
                            >
                              Reintentar
                            </button>
                          </div>
                        ) : availablePlants.length === 0 ? (
                          <div className="p-3">
                            <p className="text-xs text-gray-400">No hay otras plantas registradas.</p>
                          </div>
                        ) : availablePlants.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      Número de remisión de facturación <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="Ej: 12345"
                          value={crossPlantRemisionNumber}
                          onChange={e => { setCrossPlantRemisionNumber(e.target.value); setCrossPlantPreview(null); }}
                          onKeyDown={e => { if (e.key === 'Enter') handleCrossPlantPreview(); }}
                        />
                        <p className="text-xs text-gray-400">
                          Solo dígitos —{' '}
                          <span className="text-green-600 font-medium">12345</span>{' '}
                          no{' '}
                          <span className="text-red-400 line-through">DC-12345</span>
                        </p>
                      </div>
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={handleCrossPlantPreview}
                        disabled={!crossPlantTargetPlantId || !crossPlantRemisionNumber.trim() || crossPlantPreviewLoading}
                        className="shrink-0 self-start"
                      >
                        {crossPlantPreviewLoading
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Search className="h-4 w-4" />
                        }
                        <span className="ml-1.5">Verificar</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {crossPlantPreview?.found && (
                  <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-3.5">
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <div className="text-sm flex-1 space-y-1">
                      <p className="font-semibold text-green-800">Remisión #{crossPlantPreview.remision_number} confirmada</p>
                      <div className="grid grid-cols-2 gap-x-4 text-xs text-green-700">
                        {crossPlantPreview.client_name && <span>Cliente: <strong>{crossPlantPreview.client_name}</strong></span>}
                        {crossPlantPreview.construction_site && <span>Obra: <strong>{crossPlantPreview.construction_site}</strong></span>}
                        {crossPlantPreview.fecha && <span>Fecha: <strong>{crossPlantPreview.fecha}</strong></span>}
                        {crossPlantPreview.volumen_fabricado !== undefined && <span>Volumen: <strong>{crossPlantPreview.volumen_fabricado.toFixed(1)} m³</strong></span>}
                      </div>
                    </div>
                  </div>
                )}

                {crossPlantPreview && !crossPlantPreview.found && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
                    <div className="flex items-start gap-2.5 p-3.5">
                      <XCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-amber-800">
                          No encontrada en {selectedPlantName ?? 'esa planta'}
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Esa planta puede no haber subido su archivo aún, o el número no coincide. Verifica que sean solo dígitos sin prefijo.
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-amber-200 bg-amber-100/40 px-4 py-3 space-y-2.5">
                      <p className="text-xs font-semibold text-amber-800">¿Cómo deseas continuar?</p>
                      {[
                        { value: true,  label: 'Continuar sin confirmar', sub: 'El vínculo se resolverá automáticamente cuando esa planta suba su archivo.' },
                        { value: false, label: 'Verificar el número primero', sub: 'Revisar el número de remisión antes de guardar.' },
                      ].map(opt => (
                        <label key={String(opt.value)} className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio" name="cpUnconfirmed"
                            checked={crossPlantUnconfirmedAllowed === opt.value}
                            onChange={() => setCrossPlantUnconfirmedAllowed(opt.value)}
                            className="mt-0.5 accent-indigo-600"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                            <p className="text-xs text-gray-500">{opt.sub}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Notes ─────────────────────────────────────────────── */}
          {action && (
            <>
              <div className="h-px bg-gray-100" />
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-900">
                  Notas adicionales <span className="text-gray-400 font-normal text-xs">(opcional)</span>
                </Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Información adicional para auditorías o seguimiento..."
                  className="min-h-[72px] text-sm resize-none"
                />
              </div>
            </>
          )}

        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-400 truncate">
            {action ? getActionTitle() : 'Ninguna acción seleccionada'}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleClose} className="px-4">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaveDisabled}
              className="bg-blue-600 hover:bg-blue-700 px-4"
            >
              Guardar Decisión
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
