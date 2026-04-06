'use client';

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Package, Wrench, X, Plus, Search, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SelectedInstrumento {
  instrumento_id: string;
  paquete_id?: string;
  nombre: string;
  codigo: string;
  estado_al_momento: 'vigente' | 'proximo_vencer' | 'vencido';
  fecha_vencimiento_al_momento: string;
}

export interface EquipoUtilizadoPickerHandle {
  getSelected: () => SelectedInstrumento[];
}

interface Props {
  plantId?: string;
  onChange?: (instruments: SelectedInstrumento[]) => void;
}

const ESTADO_BADGE: Record<string, string> = {
  vigente: 'bg-green-100 text-green-700',
  proximo_vencer: 'bg-yellow-100 text-yellow-800',
  vencido: 'bg-red-100 text-red-700',
};

const ESTADO_ICON: Record<string, React.ReactNode> = {
  vigente: <CheckCircle className="h-3 w-3" />,
  proximo_vencer: <Clock className="h-3 w-3" />,
  vencido: <AlertTriangle className="h-3 w-3" />,
};

export const EquipoUtilizadoPicker = forwardRef<EquipoUtilizadoPickerHandle, Props>(
  ({ plantId, onChange }, ref) => {
    const [selected, setSelected] = useState<SelectedInstrumento[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [paquetes, setPaquetes] = useState<any[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);

    useImperativeHandle(ref, () => ({
      getSelected: () => selected,
    }));

    // Fetch paquetes for this plant
    useEffect(() => {
      const fetchPaquetes = async () => {
        try {
          const params = new URLSearchParams();
          if (plantId) params.set('plant_id', plantId);
          const res = await fetch(`/api/ema/paquetes?${params}`);
          const j = await res.json();
          setPaquetes(j.data ?? []);
        } catch { /* silent */ }
      };
      fetchPaquetes();
    }, [plantId]);

    // Debounced instrument search
    useEffect(() => {
      if (searchQuery.length < 2) { setSearchResults([]); return; }
      const timer = setTimeout(async () => {
        setLoadingSearch(true);
        try {
          const params = new URLSearchParams({ search: searchQuery });
          if (plantId) params.set('plant_id', plantId);
          const res = await fetch(`/api/ema/instrumentos?${params}`);
          const j = await res.json();
          setSearchResults((j.data ?? []).filter((i: any) => i.estado !== 'inactivo'));
        } catch { /* silent */ }
        finally { setLoadingSearch(false); }
      }, 350);
      return () => clearTimeout(timer);
    }, [searchQuery, plantId]);

    const addInstrumento = useCallback((inst: any, paqueteId?: string) => {
      if (selected.some(s => s.instrumento_id === inst.id)) return;

      // Map estado to snapshot estado (only 3 valid values for snapshot)
      let estadoSnap: SelectedInstrumento['estado_al_momento'] = 'vigente';
      if (inst.estado === 'vencido') estadoSnap = 'vencido';
      else if (inst.estado === 'proximo_vencer') estadoSnap = 'proximo_vencer';

      const newItem: SelectedInstrumento = {
        instrumento_id: inst.id,
        paquete_id: paqueteId,
        nombre: inst.nombre,
        codigo: inst.codigo,
        estado_al_momento: estadoSnap,
        fecha_vencimiento_al_momento: inst.fecha_proximo_evento ?? new Date().toISOString().split('T')[0],
      };
      const next = [...selected, newItem];
      setSelected(next);
      onChange?.(next);
      setSearchQuery('');
      setSearchResults([]);
    }, [selected, onChange]);

    const removeInstrumento = useCallback((instrumentoId: string) => {
      const next = selected.filter(s => s.instrumento_id !== instrumentoId);
      setSelected(next);
      onChange?.(next);
    }, [selected, onChange]);

    const loadPaquete = useCallback(async (paqueteId: string) => {
      if (!paqueteId || paqueteId === 'none') return;
      try {
        const res = await fetch(`/api/ema/paquetes/${paqueteId}`);
        const j = await res.json();
        const paquete = j.data;
        if (!paquete?.instrumentos) return;
        // Add all instruments from the package
        for (const pi of paquete.instrumentos) {
          if (!pi.instrumento) continue;
          addInstrumento(pi.instrumento, paqueteId);
        }
      } catch { /* silent */ }
    }, [addInstrumento]);

    const hasVencidos = selected.some(s => s.estado_al_momento === 'vencido');

    return (
      <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">Equipo utilizado</h3>
          <span className="text-xs text-gray-400 ml-auto">EMA — trazabilidad de instrumentos</span>
        </div>

        {hasVencidos && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            Hay instrumentos vencidos. Si el bloqueo está activo en configuración EMA, el guardado será rechazado.
          </div>
        )}

        {/* Quick load from package */}
        {paquetes.length > 0 && (
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <Select onValueChange={loadPaquete}>
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue placeholder="Cargar desde paquete…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Seleccionar paquete —</SelectItem>
                {paquetes.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Manual instrument search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Buscar instrumento por código o nombre…"
            className="pl-8 h-8 text-sm bg-white"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map((inst: any) => (
                <div
                  key={inst.id}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-xs flex items-center justify-between"
                  onClick={() => addInstrumento(inst)}
                >
                  <span>
                    <span className="font-mono text-gray-400 mr-2">{inst.codigo}</span>
                    {inst.nombre}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[inst.estado] ?? 'bg-gray-100 text-gray-500'}`}>
                    {ESTADO_ICON[inst.estado]} {inst.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected list */}
        {selected.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">Ningún instrumento seleccionado — opcional durante configuración inicial</p>
        ) : (
          <div className="space-y-1">
            {selected.map(s => (
              <div key={s.instrumento_id} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-3 py-1.5 text-xs">
                <Wrench className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <span className="font-mono text-gray-400">{s.codigo}</span>
                <span className="flex-1 text-gray-700">{s.nombre}</span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${ESTADO_BADGE[s.estado_al_momento]}`}>
                  {ESTADO_ICON[s.estado_al_momento]} {s.estado_al_momento}
                </span>
                <button type="button" onClick={() => removeInstrumento(s.instrumento_id)} className="text-gray-300 hover:text-red-500 ml-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

EquipoUtilizadoPicker.displayName = 'EquipoUtilizadoPicker';
