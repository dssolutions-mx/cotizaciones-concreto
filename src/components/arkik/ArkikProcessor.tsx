'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArkikRawParser } from '@/services/arkikRawParser';
import { ArkikOrderGrouper } from '@/services/arkikOrderGrouper';
import type { StagingRemision, OrderSuggestion, ValidationError, RemisionInsertPayload, RemisionMaterialInsert } from '@/types/arkik';
import { FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, XCircle, ArrowRightLeft } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { supabase } from '@/lib/supabase/client';
import { ArkikValidator } from '@/services/arkikValidator';

type Step = 'upload' | 'validate' | 'group' | 'confirm';

export default function ArkikProcessor() {
  const { currentPlant } = usePlantContext();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stagingData, setStagingData] = useState<StagingRemision[]>([]);
  const [orderSuggestions, setOrderSuggestions] = useState<OrderSuggestion[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [testMode, setTestMode] = useState(true);

  const stats = useMemo(() => ({
    totalRows: stagingData.length + validationErrors.filter(e => !e.recoverable).length,
    validRows: stagingData.length,
    errorRows: validationErrors.filter(e => !e.recoverable).length,
    ordersToCreate: orderSuggestions.filter(s => !s.remisiones[0]?.orden_original).length,
    remisionsWithoutOrder: stagingData.filter(r => !r.orden_original).length,
  }), [stagingData, validationErrors, orderSuggestions]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!currentPlant) {
      alert('Selecciona una planta antes de subir el archivo.');
      return;
    }

    setFile(selectedFile);
    setLoading(true);
    try {
      const parser = new ArkikRawParser();
      const { data, errors, metadata } = await parser.parseFile(selectedFile);

      const { data: session, error: sessionError } = await supabase
        .from('arkik_import_sessions')
        .insert({
          file_name: selectedFile.name,
          plant_id: currentPlant.id,
          status: 'validating',
          total_rows: metadata.totalRows,
          processed_rows: 0,
          error_summary: {},
          validation_errors: [],
        })
        .select()
        .single();
      if (sessionError) throw sessionError;
      setSessionId(session.id);

      const stagingRows = data.map((row, index) => convertToStagingRemision(row, session.id, index + 1, testMode));
      setStagingData(stagingRows);
      setValidationErrors(errors);
      setStep('validate');
    } catch (err: any) {
      console.error(err);
      alert(`Error al procesar el archivo: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }, [currentPlant, testMode]);

  const handleValidation = useCallback(async () => {
    if (!sessionId || !currentPlant) return;
    setLoading(true);
    try {
      // Validate against DB, including backward price linking as needed
      const validator = new ArkikValidator(currentPlant.id);
      const { validated, errors } = await validator.validateBatch(stagingData);
      setStagingData(validated);
      setValidationErrors(prev => [...prev, ...errors]);

      // Persist to staging
      const payload = validated.map(r => ({
        id: r.id,
        session_id: r.session_id,
        row_number: r.row_number,
        fecha: r.fecha.toISOString().split('T')[0],
        hora_carga: r.hora_carga.toISOString().split('T')[1]?.split('.')[0] || null,
        remision_number: r.remision_number,
        cliente_name: r.cliente_name,
        obra_name: r.obra_name,
        recipe_code: r.recipe_code || r.prod_tecnico || null,
        volumen_fabricado: r.volumen_fabricado,
        conductor: r.conductor || r.chofer || null,
        unidad: r.placas || null,
        suggested_order_group: '',
        materials_teorico: r.materials_teorico,
        materials_real: r.materials_real,
        validation_status: r.validation_status,
        validation_errors: r.validation_errors,
        orden_original: r.orden_original || null,
        estatus: r.estatus || null,
        cliente_codigo: r.cliente_codigo || null,
        rfc: r.rfc || null,
        punto_entrega: r.punto_entrega || null,
        prod_comercial: r.prod_comercial || null,
        prod_tecnico: r.prod_tecnico || null,
        product_description: r.product_description || null,
        comentarios_internos: r.comentarios_internos || null,
        comentarios_externos: r.comentarios_externos || null,
        elementos: r.elementos || null,
        camion: r.camion || null,
        placas: r.placas || null,
        bombeable: r.bombeable ? 'SI' : 'NO',
        fecha_hora_carga: null,
        materials_retrabajo: r.materials_retrabajo || {},
        materials_manual: r.materials_manual || {},
      }));
      // Clean existing rows for this session to avoid duplicates on re-run
      await supabase.from('arkik_staging_remisiones').delete().eq('session_id', sessionId);
      const { error } = await supabase.from('arkik_staging_remisiones').insert(payload);
      if (error) throw error;

      setStep('group');
    } catch (err: any) {
      console.error(err);
      alert(`Error durante la validación: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }, [stagingData, sessionId, currentPlant]);

  const handleGrouping = useCallback(() => {
    const grouper = new ArkikOrderGrouper();
    const suggestions = grouper.groupRemisiones(stagingData);
    setOrderSuggestions(suggestions);
    setStep('confirm');
  }, [stagingData]);

  // Interactive group operations
  const moveRemisionToGroup = (fromGroupIdx: number, remIdx: number, toGroupIdx: number) => {
    if (fromGroupIdx === toGroupIdx) return;
    setOrderSuggestions(prev => {
      const clone = prev.map(g => ({ ...g, remisiones: [...g.remisiones] }));
      const [rem] = clone[fromGroupIdx].remisiones.splice(remIdx, 1);
      if (!rem) return prev;
      clone[toGroupIdx].remisiones.push(rem);
      return clone;
    });
  };

  const removeRemision = (groupIdx: number, remIdx: number) => {
    setOrderSuggestions(prev => prev.map((g, i) => i !== groupIdx ? g : { ...g, remisiones: g.remisiones.filter((_, j) => j !== remIdx) }));
  };

  const splitGroupAt = (groupIdx: number, splitIdx: number) => {
    setOrderSuggestions(prev => {
      const group = prev[groupIdx];
      if (!group) return prev;
      const left = { ...group, group_key: `${group.group_key}_L`, remisiones: group.remisiones.slice(0, splitIdx) };
      const right = { ...group, group_key: `${group.group_key}_R`, remisiones: group.remisiones.slice(splitIdx) };
      const next = [...prev];
      next.splice(groupIdx, 1, left, right);
      return next;
    });
  };

  const mergeWithNext = (groupIdx: number) => {
    setOrderSuggestions(prev => {
      if (groupIdx >= prev.length - 1) return prev;
      const current = prev[groupIdx];
      const next = prev[groupIdx + 1];
      const merged = { ...current, group_key: `${current.group_key}_M`, remisiones: [...current.remisiones, ...next.remisiones] };
      const arr = [...prev];
      arr.splice(groupIdx, 2, merged);
      return arr;
    });
  };

  const addEmptyGroup = () => {
    setOrderSuggestions(prev => ([...prev, {
      group_key: `EMPTY_${Date.now()}`,
      client_id: '',
      obra_name: 'Sin obra',
      comentarios_externos: [],
      date_range: { start: new Date(), end: new Date() },
      remisiones: [],
      total_volume: 0,
      suggested_name: 'Grupo vacío',
      recipe_codes: new Set(),
      validation_issues: [],
    }]));
  };

  // Basic drag & drop (native) helpers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, groupIdx: number, remIdx: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ groupIdx, remIdx }));
  };

  const handleDropOnGroup = (e: React.DragEvent<HTMLDivElement>, toGroupIdx: number) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain')) as { groupIdx: number; remIdx: number };
      moveRemisionToGroup(data.groupIdx, data.remIdx, toGroupIdx);
    } catch {
      // ignore
    }
  };

  const handleConfirmation = useCallback(async () => {
    if (!currentPlant) return;
    setLoading(true);
    try {
      // In test mode: tag orders and remisiones for later deletion
      for (const suggestion of orderSuggestions) {
        if (!suggestion.remisiones[0]?.orden_original) {
          // Create an order skeleton only in test mode or as draft
          const { data: order, error: orderError } = await supabase.from('orders').insert({
            client_id: suggestion.client_id || null,
            construction_site: suggestion.obra_name,
            order_number: `${testMode ? 'TEST-' : ''}ARKIK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            delivery_date: suggestion.date_range.start.toISOString().split('T')[0],
            delivery_time: suggestion.date_range.start.toISOString().split('T')[1]?.split('.')[0] || null,
            special_requirements: suggestion.comentarios_externos.join(' | '),
            order_status: 'created',
            auto_generated: true,
            generation_criteria: { source: 'ARKIK', group_key: suggestion.group_key, test_mode: testMode },
            import_session_id: sessionId,
            plant_id: currentPlant.id,
            elemento: suggestion.suggested_name,
          }).select().single();
          if (orderError) throw orderError;

          // Insert remisiones minimal
          for (const r of suggestion.remisiones) {
            const remPayload = buildRemisionInsertPayload(order.id, r);
            const { data: rem, error: remError } = await supabase.from('remisiones').insert({
              ...remPayload,
              plant_id: currentPlant.id,
              designacion_ehe: r.product_description || null,
              created_by: null,
            }).select().single();
            if (remError) throw remError;

            const materials = buildRemisionMaterialsInsert(rem.id, r);
            if (materials.length) {
              const { error: rmError } = await supabase.from('remision_materiales').insert(materials);
              if (rmError) throw rmError;
            }
          }
        }
      }

      await supabase.from('arkik_import_sessions').update({
        status: 'completed',
        processed_rows: stagingData.length,
        successful_rows: stagingData.filter(r => r.validation_status !== 'error').length,
        completed_at: new Date().toISOString(),
      }).eq('id', sessionId);

      alert('Procesamiento completado.');
      resetState();
    } catch (err: any) {
      console.error(err);
      alert(`Error al confirmar: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }, [orderSuggestions, currentPlant, sessionId, stagingData]);

  const resetState = () => {
    setFile(null);
    setSessionId(null);
    setStagingData([]);
    setOrderSuggestions([]);
    setValidationErrors([]);
    setStep('upload');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Procesador de Reportes Arkik</h1>
          <p className="text-gray-600 text-sm">Sube y valida remisiones con revisión interactiva.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={testMode} onChange={e => setTestMode(e.target.checked)} />
            Modo prueba (etiquetar para borrar)
          </label>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
        {(['upload','validate','group','confirm'] as Step[]).map((s, idx) => (
          <div key={s} className={`flex items-center ${step === s ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step === s ? 'bg-green-100' : 'bg-gray-100'}`}>{idx+1}</div>
            <span className="ml-2 capitalize">{s}</span>
            {idx < 3 && <ArrowRightLeft className="mx-3 h-4 w-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {step === 'upload' && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <input id="arkik-upload" className="hidden" type="file" accept=".xls,.xlsx" onChange={handleFileUpload} />
          <label htmlFor="arkik-upload" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md bg-gray-50 hover:bg-gray-100">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Seleccionar archivo Excel Arkik
          </label>
        </div>
      )}

      {step === 'validate' && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Válidas: {stats.validRows}</div>
            <div className="flex items-center gap-2 text-amber-700"><AlertCircle className="h-4 w-4" /> Errores: {stats.errorRows}</div>
            <div className="flex items-center gap-2 text-slate-700">Total filas: {stats.totalRows}</div>
          </div>
          <div className="mt-4 flex justify-end">
            <button disabled={loading} onClick={handleValidation} className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50">
              {loading ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          </div>
        </div>
      )}

      {step === 'group' && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-4 text-sm">
            <div>Remisiones sin orden: {stats.remisionsWithoutOrder}</div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleGrouping} className="px-4 py-2 rounded bg-green-600 text-white">Generar sugerencias</button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-6 text-sm">
            <div>Órdenes sugeridas: {orderSuggestions.length}</div>
            <div>Órdenes a crear: {stats.ordersToCreate}</div>
          </div>

          {/* Interactive review table */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {orderSuggestions.map((group, gi) => (
              <div key={group.group_key} className="border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold text-sm">{group.suggested_name}</div>
                    <div className="text-xs text-gray-500">Volumen: {group.total_volume.toFixed(2)} | Remisiones: {group.remisiones.length}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-xs px-2 py-1 border rounded" onClick={() => splitGroupAt(gi, Math.ceil(group.remisiones.length / 2))}>Dividir</button>
                    <button className="text-xs px-2 py-1 border rounded" onClick={() => mergeWithNext(gi)} disabled={gi === orderSuggestions.length - 1}>Unir con siguiente</button>
                  </div>
                </div>

                {/* Group warnings summary */}
                <GroupIssuesSummary remisiones={group.remisiones} />

                <div className="mt-2 space-y-2" onDragOver={e => e.preventDefault()} onDrop={e => handleDropOnGroup(e, gi)}>
                  {group.remisiones.map((r, ri) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between text-sm border rounded p-2"
                      draggable
                      onDragStart={e => handleDragStart(e, gi, ri)}
                    >
                      <div className="flex-1">
                        <div className="font-medium">Remisión {r.remision_number}</div>
                        <div className="text-xs text-gray-500">Vol: {r.volumen_fabricado} | Obra: {r.obra_name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select className="text-xs border rounded px-1 py-0.5" value={gi} onChange={e => moveRemisionToGroup(gi, ri, Number(e.target.value))}>
                          {orderSuggestions.map((g, idx) => (
                            <option key={g.group_key} value={idx}>{`Grupo ${idx + 1}`}</option>
                          ))}
                        </select>
                        <button className="text-xs px-2 py-1 border rounded" onClick={() => removeRemision(gi, ri)}>Quitar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2 justify-between">
            <button onClick={addEmptyGroup} className="px-3 py-2 rounded border">Añadir grupo vacío</button>
            <div className="flex gap-2">
              <button onClick={() => setStep('group')} className="px-4 py-2 rounded border">Regresar</button>
              <button disabled={loading} onClick={handleConfirmation} className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50">{loading ? 'Procesando…' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Errors list minimal */}
      {validationErrors.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Errores</h3>
          <div className="max-h-56 overflow-auto text-sm">
            {validationErrors.slice(0, 50).map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-rose-700 py-0.5"><XCircle className="h-3.5 w-3.5" /> Fila {e.row_number}: {e.message}</div>
            ))}
            {validationErrors.length > 50 && (
              <div className="text-gray-500 text-xs mt-1">… {validationErrors.length - 50} más</div>
            )}
          </div>
          <MaterialMappingReview staging={stagingData} />
        </div>
      )}
    </div>
  );
}

function convertToStagingRemision(row: any, sessionId: string, rowNumber: number, testMode: boolean): StagingRemision {
  const materials_teorico: Record<string, number> = {};
  const materials_real: Record<string, number> = {};
  Object.entries(row.materials || {}).forEach(([code, values]: any) => {
    materials_teorico[code] = values?.teorica || 0;
    materials_real[code] = values?.real || 0;
  });

  const comentario = row.comentarios_externos || '';
  return {
    id: crypto.randomUUID(),
    session_id: sessionId,
    row_number: rowNumber,
    orden_original: row.orden || undefined,
    fecha: new Date(row.fecha),
    hora_carga: new Date(row.hora_carga),
    remision_number: String(row.remision),
    estatus: String(row.estatus || ''),
    volumen_fabricado: Number(row.volumen || 0),
    cliente_codigo: String(row.cliente_codigo || ''),
    cliente_name: String(row.cliente_nombre || ''),
    rfc: String(row.rfc || ''),
    obra_name: String(row.obra || ''),
    punto_entrega: String(row.punto_entrega || ''),
    comentarios_externos: comentario,
    comentarios_internos: String(row.comentarios_internos || ''),
    prod_comercial: String(row.prod_comercial || ''),
    prod_tecnico: String(row.prod_tecnico || ''),
    product_description: String(row.product_description || ''),
    recipe_code: String(row.prod_tecnico || ''),
    camion: String(row.camion || ''),
    placas: String(row.placas || ''),
    conductor: String(row.chofer || ''),
    bombeable: (() => {
      const s = String(row.bombeable || '').toLowerCase();
      if (!s) return false;
      if (s.includes('no')) return false;
      if (s.includes('bombeable')) return true;
      if (s.includes('si')) return true;
      return false;
    })(),
    elementos: String(row.elementos || ''),
    suggested_order_group: '',
    materials_teorico,
    materials_real,
    validation_status: 'pending',
    validation_errors: testMode ? [] : [],
  } as StagingRemision;
}

function buildRemisionInsertPayload(orderId: string, r: StagingRemision): RemisionInsertPayload {
  return {
    order_id: orderId,
    remision_number: r.remision_number,
    fecha: r.fecha.toISOString().split('T')[0],
    hora_carga: r.hora_carga.toISOString().split('T')[1]?.split('.')[0] || '00:00:00',
    volumen_fabricado: r.volumen_fabricado,
    conductor: r.conductor || null,
    unidad: r.placas || null,
    tipo_remision: 'CONCRETO',
  };
}

function buildRemisionMaterialsInsert(remisionId: string, r: StagingRemision): RemisionMaterialInsert[] {
  return Object.keys(r.materials_teorico).map(code => ({
    remision_id: remisionId,
    material_type: code,
    cantidad_teorica: (r.materials_teorico[code] || 0) * (r.volumen_fabricado || 0),
    cantidad_real: r.materials_real[code] || 0,
  }));
}

// Simple helper subcomponents and actions
function GroupIssuesSummary({ remisiones }: { remisiones: StagingRemision[] }) {
  const counts = useMemo(() => {
    const all = remisiones.flatMap(r => r.validation_errors || []);
    const byType = all.reduce<Record<string, number>>((acc, e) => { acc[e.error_type] = (acc[e.error_type] || 0) + 1; return acc; }, {});
    return byType;
  }, [remisiones]);
  const keys = Object.keys(counts);
  if (!keys.length) return null;
  return (
    <div className="text-xs text-amber-700">
      {keys.map(k => (
        <span key={k} className="mr-3">{k}: {counts[k]}</span>
      ))}
    </div>
  );
}

function MaterialMappingReview({ staging }: { staging: StagingRemision[] }) {
  const codes = useMemo(() => {
    const set = new Set<string>();
    staging.forEach(r => {
      Object.keys(r.materials_teorico || {}).forEach(c => set.add(c));
      Object.keys(r.materials_real || {}).forEach(c => set.add(c));
    });
    return Array.from(set).sort();
  }, [staging]);
  if (!codes.length) return null;
  return (
    <div className="mt-3">
      <div className="font-semibold text-sm mb-1">Revisión de materiales detectados</div>
      <div className="flex flex-wrap gap-2 text-xs">
        {codes.map(c => (
          <span key={c} className="px-2 py-1 rounded bg-gray-100">{c}</span>
        ))}
      </div>
    </div>
  );
}



