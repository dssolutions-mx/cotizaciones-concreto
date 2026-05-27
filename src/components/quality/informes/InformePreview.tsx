'use client';

import React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isInformeLabExperiment } from '@/lib/quality/informeLabContext';
import type { InformeSnapshot } from '@/types/informe-ensayo';

type Props = {
  snapshot: InformeSnapshot;
  gaps?: Array<{ label: string; href?: string }>;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 overflow-hidden">
      <div className="bg-[#1B365D] px-3 py-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="p-3 bg-white text-sm space-y-2">{children}</div>
    </div>
  );
}

export function InformePreview({ snapshot, gaps }: Props) {
  const issued = snapshot.documento.issued_at
    ? format(new Date(snapshot.documento.issued_at), "d 'de' MMMM yyyy", { locale: es })
    : 'Borrador — sin emitir';

  const isLab = isInformeLabExperiment(snapshot);
  const estudio = snapshot.estudio_laboratorio;
  const metodoCompresion = snapshot.compresion_resumen.metodo ?? 'NMX-C-155-ONNCCE-2017';

  return (
    <div className="space-y-4 text-stone-800">
      {isLab && (
        <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
          Informe de <strong>experimento interno</strong> (I+D) — NMX-EC-17025-IMNC-2018 §7.8. No sustituye
          certificación de obra.
        </div>
      )}

      {gaps && gaps.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900 mb-2">Información pendiente</p>
          <p className="text-amber-800 text-xs mb-2">
            El informe se generará con los datos disponibles. Complete los puntos siguientes cuando sea posible.
          </p>
          <ul className="space-y-1">
            {gaps.map((g) => (
              <li key={g.label}>
                {g.href ? (
                  <Link href={g.href} className="text-amber-800 underline underline-offset-2">
                    {g.label}
                  </Link>
                ) : (
                  g.label
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="§1 Identificación">
        <p>
          <span className="font-medium">{snapshot.laboratorio.razon_social}</span> — {snapshot.laboratorio.nombre}
        </p>
        <p className="text-stone-600 text-xs">
          {snapshot.laboratorio.direccion ?? '—'} · Acreditación EMA:{' '}
          {snapshot.laboratorio.acreditacion_ema ?? 'No configurada'}
        </p>
        <p>
          Informe <strong>{snapshot.documento.numero ?? '—'}</strong> · Emisión: {issued}
        </p>
        {isLab && estudio ? (
          <>
            <p>Estudio: {estudio.study_name ?? '—'}</p>
            <p>Lote: {estudio.lote_number ?? '—'}</p>
            <p>Protocolo: {estudio.protocol_label ?? estudio.protocol_type ?? '—'}</p>
            <p>Receta ref.: {estudio.recipe_code ?? '—'}</p>
            <p>Solicitante: {snapshot.cliente.nombre}</p>
          </>
        ) : (
          <>
            <p>Cliente: {snapshot.cliente.nombre}</p>
            <p>
              Obra: {snapshot.obra.construction_site ?? '—'} · Pedido {snapshot.obra.order_number ?? '—'}
            </p>
            <p>Elemento: {snapshot.obra.elemento ?? 'No especificado'}</p>
          </>
        )}
      </Section>

      <Section title={isLab ? '§2 Elaboración en laboratorio' : '§2 Muestreo'}>
        <p>
          Fecha {snapshot.muestreo.fecha_muestreo}
          {snapshot.muestreo.hora_muestreo ? ` ${snapshot.muestreo.hora_muestreo}` : ''} · Lote{' '}
          {snapshot.muestreo.lote_id}
        </p>
        <p>Recepción lab: {snapshot.muestreo.fecha_recepcion_lab ?? '—'}</p>
        <p>Muestreado por: {snapshot.muestreo.muestreado_por}</p>
        <p>Plan: {snapshot.muestreo.plan_muestreo}</p>
        {!isLab && (
          <p>
            Ambiente: {snapshot.muestreo.temperatura_ambiente ?? '—'} °C
            {snapshot.muestreo.humedad_relativa_obra != null
              ? ` · HR ${snapshot.muestreo.humedad_relativa_obra} %`
              : ''}
          </p>
        )}
      </Section>

      <Section title="§3 Resultados — concreto fresco">
        {snapshot.resultados_fresco.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-stone-500">
                <th className="py-1">Ensayo</th>
                {snapshot.resultados_fresco.some((row) => row.lectura) ? (
                  <th>Lectura</th>
                ) : null}
                <th>Resultado</th>
                <th>Especificado</th>
                <th>C/NC</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.resultados_fresco.map((r, i) => (
                <tr key={`${r.ensayo}-${r.lectura ?? ''}-${i}`} className="border-b border-stone-100">
                  <td className="py-1">{r.ensayo}</td>
                  {snapshot.resultados_fresco.some((row) => row.lectura) ? (
                    <td className="text-stone-600">{r.lectura ?? '—'}</td>
                  ) : null}
                  <td>
                    {r.resultado}
                    {r.uncertainty && (
                      <span className="block text-[10px] text-stone-500">{r.uncertainty.display}</span>
                    )}
                  </td>
                  <td>{r.especificado}</td>
                  <td>
                    <Badge variant={r.conformidad === 'C' ? 'default' : 'secondary'}>{r.conformidad}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : snapshot.declaraciones.fresco_no_aplica ? (
          <p className="text-stone-500 text-xs">{snapshot.declaraciones.fresco_no_aplica}</p>
        ) : (
          <p className="text-stone-500">Sin ensayos de campo registrados.</p>
        )}
        {snapshot.uncertainty.length > 0 ? (
          <p className="text-[10px] text-stone-500 mt-2 border-t border-stone-100 pt-2">
            Incertidumbre declarada (EMA):{' '}
            {snapshot.uncertainty.map((u) => `${u.measurand_codigo} ${u.display}`).join(' · ')}
          </p>
        ) : null}
      </Section>

      <Section title="§3 Resistencia a compresión">
        {snapshot.resultados_compresion.length === 0 ? (
          <p className="text-stone-500">Sin ensayos de compresión.</p>
        ) : (
          <>
            <p className="text-xs text-stone-500 mb-2">Método: {metodoCompresion}</p>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b text-left text-stone-500">
                  <th>Espécimen</th>
                  <th>Edad</th>
                  <th>kN</th>
                  <th>kg/cm²</th>
                  <th>C/NC</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.resultados_compresion.map((r) => (
                  <tr key={r.identificacion} className="border-b border-stone-100">
                    <td className="py-1">{r.identificacion}</td>
                    <td>{r.edad_dias ?? '—'} d</td>
                    <td>{r.carga_kn ?? '—'}</td>
                    <td>{r.fc_kg_cm2 ?? '—'}</td>
                    <td>{r.conformidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs">
              Promedio: {snapshot.compresion_resumen.promedio_kg_cm2 ?? '—'} kg/cm² · f&apos;c ref.:{' '}
              {snapshot.compresion_resumen.resistencia_especificada ?? '—'} kg/cm²
              {estudio?.edad_especificada ? ` @ ${estudio.edad_especificada}` : ''}
            </p>
            {snapshot.compresion_resumen.incertidumbre_u && (
              <p className="text-xs font-medium">
                Incertidumbre de medición U: {snapshot.compresion_resumen.incertidumbre_u.display}
                {snapshot.compresion_resumen.incertidumbre_u.documento_codigo && (
                  <span className="text-stone-500 font-normal">
                    {' '}
                    · Estudio {snapshot.compresion_resumen.incertidumbre_u.documento_codigo}
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </Section>

      <Section title="§4 Declaraciones">
        {snapshot.declaraciones.texto_legal.map((t) => (
          <p key={t} className="text-xs text-stone-600">
            {t}
          </p>
        ))}
        <p className="text-xs">Regla de decisión: {snapshot.declaraciones.regla_decision}</p>
        {snapshot.declaraciones.muestreado_por_cliente && (
          <p className="text-xs text-amber-800">
            El muestreo fue realizado por el cliente (§7.8.6).
          </p>
        )}
      </Section>

      {snapshot.opinion_tecnica && (
        <Section title="Opinión e interpretaciones (§7.8.7)">
          <p className="text-xs whitespace-pre-wrap">{snapshot.opinion_tecnica}</p>
        </Section>
      )}
    </div>
  );
}
