'use client';

import React, { useEffect, useMemo, useState } from 'react';
import PhotoUploadComponent from '@/components/common/PhotoUploadComponent';

export type SiteAccessRating = 'green' | 'yellow' | 'red';

export type SiteValidationState = {
  road_type?: 'paved' | 'gravel_good' | 'gravel_rough';
  road_slope?: 'none' | 'moderate' | 'steep';
  recent_weather_impact?: 'dry' | 'light_rain' | 'heavy_rain';
  route_incident_history?: 'none' | 'minor' | 'major';
  validation_notes?: string;
  evidence_photo_urls: string[];
};

type Props = {
  rating: SiteAccessRating | null;
  onChangeRating: (r: SiteAccessRating) => void;
  value: SiteValidationState;
  onChange: (v: SiteValidationState) => void;
  showErrors?: boolean;
};

export default function SiteAccessValidation({ rating, onChangeRating, value, onChange, showErrors }: Props) {
  const [local, setLocal] = useState<SiteValidationState>({ evidence_photo_urls: [], ...value });

  useEffect(() => {
    setLocal(prev => ({ ...prev, ...value }));
  }, [value]);

  // Auto-fill for red
  useEffect(() => {
    if (rating === 'red') {
      const next = { ...local, road_type: 'gravel_rough' as const };
      setLocal(next);
      onChange(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rating]);

  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!rating) return errs;
    if (rating === 'yellow') {
      if (!local.road_type) errs.road_type = 'Requerido';
      if (!local.road_slope) errs.road_slope = 'Requerido';
      if (!local.recent_weather_impact) errs.recent_weather_impact = 'Requerido';
      if (!local.route_incident_history) errs.route_incident_history = 'Requerido';
      if (!local.evidence_photo_urls || local.evidence_photo_urls.length < 2) errs.photos = '2-3 fotos requeridas';
    }
    if (rating === 'red') {
      if (!local.road_slope || (local.road_slope !== 'moderate' && local.road_slope !== 'steep')) errs.road_slope = 'Seleccione moderada o pronunciada';
      if (!local.recent_weather_impact) errs.recent_weather_impact = 'Clima requerido';
      if (!local.route_incident_history) errs.route_incident_history = 'Historial requerido';
      if (!local.evidence_photo_urls || local.evidence_photo_urls.length < 2) errs.photos = '2-3 fotos requeridas';
    }
    return errs;
  }, [local, rating]);

  const setField = (k: keyof SiteValidationState, v: any) => {
    const next = { ...local, [k]: v } as SiteValidationState;
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      <h4 className="text-base font-bold text-gray-800">Validación de Acceso a Obra</h4>

      <div className="flex gap-3">
        {(['green','yellow','red'] as SiteAccessRating[]).map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChangeRating(opt)}
            className={`px-4 py-2 rounded-md border text-sm font-medium ${rating === opt ?
              (opt === 'green' ? 'bg-green-100 border-green-500 text-green-800' : opt === 'yellow' ? 'bg-yellow-100 border-yellow-500 text-yellow-800' : 'bg-red-100 border-red-500 text-red-800') : 'bg-white border-gray-300 text-gray-700'}`}
          >
            {opt === 'green' ? 'Verde' : opt === 'yellow' ? 'Amarillo' : 'Rojo'}
          </button>
        ))}
      </div>

      {rating === 'green' && (
        <div className="text-sm text-gray-600">Acceso pavimentado sin pendientes relevantes. No se requiere evidencia.</div>
      )}

      {rating === 'yellow' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de camino</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2" value={local.road_type || ''} onChange={(e) => setField('road_type', e.target.value as any)}>
                <option value="">Seleccione…</option>
                <option value="paved">Pavimentado</option>
                <option value="gravel_good">Terracería (buena)</option>
                <option value="gravel_rough">Terracería (mala)</option>
              </select>
              {showErrors && errors.road_type && <p className="text-xs text-red-600 mt-1">{errors.road_type}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pendiente</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2" value={local.road_slope || ''} onChange={(e) => setField('road_slope', e.target.value as any)}>
                <option value="">Seleccione…</option>
                <option value="none">Sin pendiente</option>
                <option value="moderate">Moderada</option>
                <option value="steep">Pronunciada</option>
              </select>
              {showErrors && errors.road_slope && <p className="text-xs text-red-600 mt-1">{errors.road_slope}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clima reciente</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2" value={local.recent_weather_impact || ''} onChange={(e) => setField('recent_weather_impact', e.target.value as any)}>
                <option value="">Seleccione…</option>
                <option value="dry">Seco</option>
                <option value="light_rain">Lluvia ligera</option>
                <option value="heavy_rain">Lluvia fuerte</option>
              </select>
              {showErrors && errors.recent_weather_impact && <p className="text-xs text-red-600 mt-1">{errors.recent_weather_impact}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Historial de incidentes</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2" value={local.route_incident_history || ''} onChange={(e) => setField('route_incident_history', e.target.value as any)}>
                <option value="">Seleccione…</option>
                <option value="none">Ninguno</option>
                <option value="minor">Menores</option>
                <option value="major">Mayores</option>
              </select>
              {showErrors && errors.route_incident_history && <p className="text-xs text-red-600 mt-1">{errors.route_incident_history}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea className="w-full rounded-md border border-gray-300 px-3 py-2" rows={3} value={local.validation_notes || ''} onChange={(e) => setField('validation_notes', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Evidencia fotográfica (2–3 fotos)</label>
            <PhotoUploadComponent
              onUploaded={(u) => setField('evidence_photo_urls', u)}
              onError={() => {}}
            />
            {showErrors && errors.photos && <p className="text-xs text-red-600 mt-1">{errors.photos}</p>}
          </div>
        </div>
      )}

      {rating === 'red' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de camino</label>
              <input className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-100" value="Terracería (mala)" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pendiente</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2" value={local.road_slope || ''} onChange={(e) => setField('road_slope', e.target.value as any)}>
                <option value="">Seleccione…</option>
                <option value="moderate">Moderada</option>
                <option value="steep">Pronunciada</option>
              </select>
              {showErrors && errors.road_slope && <p className="text-xs text-red-600 mt-1">{errors.road_slope}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clima reciente (obligatorio)</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2" value={local.recent_weather_impact || ''} onChange={(e) => setField('recent_weather_impact', e.target.value as any)}>
                <option value="">Seleccione…</option>
                <option value="dry">Seco</option>
                <option value="light_rain">Lluvia ligera</option>
                <option value="heavy_rain">Lluvia fuerte</option>
              </select>
              {showErrors && errors.recent_weather_impact && <p className="text-xs text-red-600 mt-1">{errors.recent_weather_impact}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Historial de incidentes</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2" value={local.route_incident_history || ''} onChange={(e) => setField('route_incident_history', e.target.value as any)}>
                <option value="">Seleccione…</option>
                <option value="none">Ninguno</option>
                <option value="minor">Menores</option>
                <option value="major">Mayores</option>
              </select>
              {showErrors && errors.route_incident_history && <p className="text-xs text-red-600 mt-1">{errors.route_incident_history}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea className="w-full rounded-md border border-gray-300 px-3 py-2" rows={3} value={local.validation_notes || ''} onChange={(e) => setField('validation_notes', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Evidencia fotográfica (2–3 fotos)</label>
            <PhotoUploadComponent
              onUploaded={(u) => setField('evidence_photo_urls', u)}
              onError={() => {}}
            />
            {showErrors && errors.photos && <p className="text-xs text-red-600 mt-1">{errors.photos}</p>}
          </div>
        </div>
      )}
    </div>
  );
}


