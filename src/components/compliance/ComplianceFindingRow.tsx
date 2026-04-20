'use client';

import React from 'react';
import type { ComplianceFinding } from '@/lib/compliance/run';

function Row({ label, value }: { label: string; value: unknown }) {
  const text = Array.isArray(value)
    ? (value as unknown[]).map(String).filter(Boolean).join(', ') || '—'
    : value == null || value === ''
      ? '—'
      : String(value);
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-900">{text}</dd>
    </div>
  );
}

function Card({ severity, children }: { severity: 'high' | 'info'; children: React.ReactNode }) {
  const border = severity === 'info'
    ? 'border-amber-200 bg-amber-50/40'
    : 'border-stone-200 bg-white';
  return (
    <div className={`rounded-md border ${border} px-3 py-2.5 text-sm`}>
      {children}
    </div>
  );
}

export function ComplianceFindingRow({ f }: { f: ComplianceFinding }) {
  const d = f.details ?? {};

  if (f.rule === 'missingChecklist') {
    const turno = d.horaFirst && d.horaLast
      ? `${String(d.horaFirst).slice(0, 5)} – ${String(d.horaLast).slice(0, 5)}`
      : d.horaFirst ? String(d.horaFirst).slice(0, 5) : null;
    return (
      <Card severity="high">
        <p className="mb-2 font-semibold text-stone-900">{String(d.assetId ?? f.message)}</p>
        <dl className="grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Row label="Planta hogar" value={d.homePlantCode} />
          <Row label="Operador asignado" value={d.primaryOperator} />
          <Row label="Conductor(es) en remisión" value={d.drivers} />
          <Row label="m³ total" value={d.totalM3 != null ? Number(d.totalM3).toFixed(1) : null} />
          <Row label="Remisiones" value={d.remisionNumbers} />
          <Row label="Turno" value={turno} />
          <Row label="Dosificador" value={d.dosificador_names} />
        </dl>
      </Card>
    );
  }

  if (f.rule === 'missingEvidence') {
    return (
      <Card severity="high">
        <dl className="grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Pedido" value={d.order_label} />
          <Row label="Cliente / Obra" value={d.client_label} />
          <Row label="m³" value={d.m3Total != null ? Number(d.m3Total).toFixed(1) : null} />
          <Row label="Remisiones" value={d.remisionNumbers} />
          <Row label="Conductor(es)" value={d.drivers} />
          <Row label="Dosificador" value={d.dosificador_names} />
        </dl>
      </Card>
    );
  }

  if (f.rule === 'missingPumping') {
    return (
      <Card severity="high">
        <dl className="grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Pedido" value={d.order_label} />
          <Row label="Cliente / Obra" value={d.client_label} />
          <Row label="m³ concreto" value={d.concretoM3 != null ? Number(d.concretoM3).toFixed(1) : null} />
          <Row label="# Remisiones concreto" value={d.concretoRemisionCount} />
          <Row label="Nums. remisión" value={d.remisionNumbers} />
          <Row label="Conductor(es)" value={d.drivers} />
        </dl>
      </Card>
    );
  }

  if (f.rule === 'operatorMismatch') {
    return (
      <Card severity="info">
        <dl className="grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Remisión" value={d.remisionNumber} />
          <Row label="Unidad" value={d.unidad} />
          <Row label="Hora" value={d.horaCarga ? String(d.horaCarga).slice(0, 5) : null} />
          <Row label="Conductor (remisión)" value={d.driver} />
          <Row label="Operador asignado" value={d.assignedOperator} />
          <Row label="Pedido" value={d.order_label} />
          <Row label="Cliente / Obra" value={d.client_label} />
        </dl>
      </Card>
    );
  }

  if (f.rule === 'unknownUnit') {
    return (
      <Card severity="high">
        <dl className="grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Texto remisión" value={d.unidad} />
          <Row label="Canónico resuelto" value={d.canonical} />
          <Row label="Num. remisión" value={d.remisionNumber} />
          <Row label="Hora" value={d.horaCarga ? String(d.horaCarga).slice(0, 5) : null} />
          <Row label="Conductor" value={d.driver} />
        </dl>
      </Card>
    );
  }

  if (f.rule === 'missingMaterialEntries') {
    return (
      <Card severity="high">
        <p className="text-stone-800">{f.message}</p>
        {(d.concretoRemisionCount != null || d.concretoM3 != null) && (
          <dl className="mt-1.5 grid grid-cols-2 gap-1.5 text-sm">
            <Row label="Remisiones" value={d.concretoRemisionCount} />
            <Row label="m³ total" value={d.concretoM3 != null ? Number(d.concretoM3).toFixed(1) : null} />
          </dl>
        )}
      </Card>
    );
  }

  if (f.rule === 'missingProduction') {
    return (
      <Card severity="high">
        <p className="text-stone-800">{f.message}</p>
      </Card>
    );
  }

  if (f.rule === 'noDieselActivity' || f.rule === 'dieselWithoutProduction') {
    return (
      <Card severity="info">
        <p className="text-stone-800">{f.message}</p>
        {d.liters !== undefined && (
          <p className="mt-1 text-xs text-stone-600">Litros: {String(d.liters)}</p>
        )}
      </Card>
    );
  }

  return (
    <Card severity="info">
      <p className="text-stone-800">{f.message}</p>
    </Card>
  );
}
