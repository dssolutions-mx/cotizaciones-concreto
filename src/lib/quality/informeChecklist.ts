import type { InformeChecklistItem, InformeSnapshot, LaboratorioAcreditacionConfig } from '@/types/informe-ensayo';
import { requiredMeasurandsForInformeUncertainty } from '@/lib/quality/informeMeasurands';

export function evaluateInformeChecklist(input: {
  muestreo: {
    id: string;
    fecha_recepcion_lab?: string | null;
    muestreado_por?: string | null;
    muestras?: Array<{
      id: string;
      is_edad_garantia?: boolean | null;
      estado?: string;
      tipo_muestra?: string;
      ensayos?: unknown[];
    }>;
  };
  order_elemento?: string | null;
  labConfig: LaboratorioAcreditacionConfig | null;
  ensayoHasEquipment?: boolean;
  uncertaintyMissing?: string[];
}): InformeChecklistItem[] {
  const items: InformeChecklistItem[] = [];

  const garantia = (input.muestreo.muestras ?? []).filter((m) => m.is_edad_garantia);
  const pendingGarantia = garantia.filter(
    (m) => m.estado !== 'ENSAYADO' && (!m.ensayos || m.ensayos.length === 0)
  );

  items.push({
    id: 'ensayos_garantia',
    label: 'Ensayos de edad garantía completados',
    ok: pendingGarantia.length === 0 && garantia.length > 0,
    href: pendingGarantia[0] ? `/quality/muestreos/${input.muestreo.id}` : undefined,
    severity: 'blocker',
  });

  items.push({
    id: 'lab_config',
    label: 'Configuración del laboratorio acreditado',
    ok: !!input.labConfig?.acreditacion_ema_numero,
    href: '/quality/configuracion-informe',
    severity: 'blocker',
  });

  items.push({
    id: 'fecha_recepcion',
    label: 'Fecha recepción en laboratorio',
    ok: !!input.muestreo.fecha_recepcion_lab,
    href: `/quality/muestreos/${input.muestreo.id}`,
    severity: 'warning',
  });

  items.push({
    id: 'elemento',
    label: 'Elemento estructural en pedido',
    ok: !!input.order_elemento?.trim(),
    severity: 'warning',
  });

  if (garantia.some((m) => m.estado === 'ENSAYADO' || (m.ensayos && m.ensayos.length > 0))) {
    items.push({
      id: 'equipo_ensayo',
      label: 'Equipo de ensayo registrado (prensa)',
      ok: !!input.ensayoHasEquipment,
      href: `/quality/muestreos/${input.muestreo.id}`,
      severity: 'warning',
    });
  }

  for (const codigo of input.uncertaintyMissing ?? []) {
    items.push({
      id: `u_${codigo}`,
      label: `Incertidumbre publicada (${codigo})`,
      ok: false,
      href: `/quality/ema/incertidumbre/${codigo.toLowerCase()}`,
      severity: 'blocker',
    });
  }

  return items;
}

export function checklistReady(items: InformeChecklistItem[]): boolean {
  return items.filter((i) => i.severity === 'blocker').every((i) => i.ok);
}

export function requiredUFromMuestreoRow(row: {
  revenimiento_sitio?: number | null;
  temperatura_concreto?: number | null;
  contenido_aire?: number | null;
  masa_unitaria?: number | null;
  muestras_json?: Array<{ tipo_muestra?: string }> | null;
  declarar_incertidumbre_campo?: boolean;
}) {
  const types = (row.muestras_json ?? []).map((m) => m.tipo_muestra ?? '').filter(Boolean);
  return requiredMeasurandsForInformeUncertainty({
    revenimiento_sitio: row.revenimiento_sitio,
    temperatura_concreto: row.temperatura_concreto,
    contenido_aire: row.contenido_aire,
    masa_unitaria: row.masa_unitaria,
    specimenTypes: types,
    declarar_incertidumbre_campo: row.declarar_incertidumbre_campo,
  });
}

export function findUncertaintyInSnapshot(
  snapshot: InformeSnapshot,
  codigo: string
): InformeSnapshot['uncertainty'][number] | undefined {
  return snapshot.uncertainty.find((u) => u.measurand_codigo === codigo);
}
