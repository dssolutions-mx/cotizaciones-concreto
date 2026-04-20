'use client';

import React, { useState } from 'react';
import type { ComplianceFinding } from '@/lib/compliance/run';

function JsonFold({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  if (Object.keys(data).length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-700"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Ocultar detalle técnico' : 'Ver detalle técnico (IDs)'}
      </button>
      {open ? (
        <pre className="mt-1 max-h-36 overflow-auto rounded border border-stone-200 bg-white p-2 text-[10px] text-stone-600">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export function ComplianceFindingRow({ f }: { f: ComplianceFinding }) {
  const d = f.details ?? {};

  if (f.rule === 'missingEvidence') {
    return (
      <div className="rounded-md border border-stone-100 bg-white px-3 py-2 text-sm">
        <div className="text-xs font-mono text-stone-500">{f.rule}</div>
        <p className="text-stone-800">{f.message}</p>
        <dl className="mt-2 grid gap-1 text-stone-700">
          <div className="flex flex-wrap gap-2">
            <dt className="text-stone-500">Pedido</dt>
            <dd className="font-medium">{String(d.order_label ?? '—')}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-stone-500">Cliente / obra</dt>
            <dd>{String(d.client_label ?? '—')}</dd>
          </div>
        </dl>
        <JsonFold data={d as Record<string, unknown>} />
      </div>
    );
  }

  if (f.rule === 'missingPumping') {
    return (
      <div className="rounded-md border border-stone-100 bg-white px-3 py-2 text-sm">
        <div className="text-xs font-mono text-stone-500">{f.rule}</div>
        <p className="text-stone-800">{f.message}</p>
        <dl className="mt-2 text-stone-700">
          <div className="flex flex-wrap gap-2">
            <dt className="text-stone-500">Pedido</dt>
            <dd className="font-medium">{String(d.order_label ?? '—')}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-stone-500">Cliente / obra</dt>
            <dd>{String(d.client_label ?? '—')}</dd>
          </div>
        </dl>
        <JsonFold data={d as Record<string, unknown>} />
      </div>
    );
  }

  if (f.rule === 'operatorMismatch') {
    return (
      <div className="rounded-md border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm">
        <div className="text-xs font-mono text-stone-500">{f.rule}</div>
        <p className="font-medium text-stone-900">Conductor distinto al operador asignado</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-stone-500">Remisión</dt>
            <dd>{String(d.remisionNumber ?? '—')}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Unidad</dt>
            <dd>{String(d.unidad ?? '—')}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Conductor (remisión)</dt>
            <dd>{String(d.driver ?? '—')}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Operador asignado (mantenimiento)</dt>
            <dd>{String(d.assignedOperator ?? '—')}</dd>
          </div>
        </dl>
        <JsonFold data={d as Record<string, unknown>} />
      </div>
    );
  }

  if (f.rule === 'unknownUnit') {
    return (
      <div className="rounded-md border border-stone-100 bg-white px-3 py-2 text-sm">
        <div className="text-xs font-mono text-stone-500">{f.rule}</div>
        <p className="text-stone-800">{f.message}</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-stone-500">Texto remisión</dt>
            <dd>{String(d.unidad ?? '')}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Canónico</dt>
            <dd className="font-mono text-xs">{String(d.canonical ?? '')}</dd>
          </div>
        </dl>
        <JsonFold data={d as Record<string, unknown>} />
      </div>
    );
  }

  if (f.rule === 'missingChecklist') {
    return (
      <div className="rounded-md border border-stone-100 bg-white px-3 py-2 text-sm">
        <div className="text-xs font-mono text-stone-500">{f.rule}</div>
        <p className="text-stone-800">{f.message}</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-stone-500">Unidad</dt>
            <dd>{String(d.assetId ?? '')}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Planta hogar</dt>
            <dd>{String(d.homePlantCode ?? '—')}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">m³</dt>
            <dd>{String(d.totalM3 ?? '')}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Remisiones (count)</dt>
            <dd>{(d.remisionIds as string[] | undefined)?.length ?? 0}</dd>
          </div>
        </dl>
        <JsonFold data={d as Record<string, unknown>} />
      </div>
    );
  }

  if (f.rule === 'missingMaterialEntries' || f.rule === 'missingProduction') {
    return (
      <div className="rounded-md border border-stone-100 bg-white px-3 py-2 text-sm">
        <div className="text-xs font-mono text-stone-500">{f.rule}</div>
        <p className="text-stone-800">{f.message}</p>
      </div>
    );
  }

  if (f.rule === 'noDieselActivity' || f.rule === 'dieselWithoutProduction') {
    return (
      <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
        <div className="text-xs font-mono text-slate-500">{f.rule}</div>
        <p className="text-stone-800">{f.message}</p>
        {d.liters !== undefined ? (
          <p className="mt-1 text-xs text-stone-600">Litros: {String(d.liters)}</p>
        ) : null}
        <JsonFold data={d as Record<string, unknown>} />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-stone-100 bg-stone-50/80 px-3 py-2 text-sm">
      <div className="font-mono text-xs text-stone-500">{f.rule}</div>
      <div className="text-stone-800">{f.message}</div>
      <JsonFold data={d as Record<string, unknown>} />
    </div>
  );
}
