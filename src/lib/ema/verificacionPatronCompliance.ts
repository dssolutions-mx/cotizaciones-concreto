/**
 * Gate patrones (Tipo A) used in internal verification (Tipo C) against traceability
 * and calibration validity — application-side checks aligned with typical NMX-EC-17025 practice
 * (calibration certificate current, uncertainty stated, verification date within cert interval).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getBusinessUnitIdForPlant } from '@/lib/ema/patronScope';
import { computeInstrumentoEstadoFromSchedule } from '@/services/emaInstrumentoService';

export type PatronComplianceIssue = { codigo: string; nombre: string; detalle: string };

/**
 * @param fechaVerificacion ISO date YYYY-MM-DD of the verification run
 * @param workInstrumentoId Tipo C instrument being verified (BU scope check vs patrones)
 */
export async function assertPatronesCumplenParaVerificacionInterna(
  admin: SupabaseClient,
  maestroIds: readonly string[],
  fechaVerificacion: string,
  workInstrumentoId?: string,
): Promise<{ ok: true } | { ok: false; issues: PatronComplianceIssue[] }> {
  const unique = [...new Set(maestroIds)];
  if (unique.length === 0) return { ok: true };

  let workBuId: string | null = null;
  if (workInstrumentoId) {
    const { data: workRow, error: wErr } = await admin
      .from('instrumentos')
      .select('plant_id')
      .eq('id', workInstrumentoId)
      .maybeSingle();
    if (wErr) throw wErr;
    if (workRow?.plant_id) {
      workBuId = await getBusinessUnitIdForPlant(admin, workRow.plant_id);
    }
  }

  const { data: cfg } = await admin
    .from('ema_configuracion')
    .select('dias_alerta_proximo_vencer')
    .maybeSingle();
  const dias = (cfg as { dias_alerta_proximo_vencer?: number } | null)?.dias_alerta_proximo_vencer ?? 7;

  const { data: insts, error: iErr } = await admin
    .from('instrumentos')
    .select(
      `
      id,
      codigo,
      nombre,
      tipo,
      estado,
      fecha_proximo_evento,
      plant_id,
      conjuntos_herramientas ( tipo_servicio ),
      plants ( business_unit_id )
    `,
    )
    .in('id', unique);
  if (iErr) throw iErr;

  const byId = new Map((insts ?? []).map((r: Record<string, unknown>) => [r.id as string, r]));
  const issues: PatronComplianceIssue[] = [];

  for (const mid of unique) {
    const row = byId.get(mid) as
      | {
          codigo: string;
          nombre: string;
          tipo: string;
          estado: string;
          fecha_proximo_evento: string | null;
          plant_id: string;
          plants: { business_unit_id: string | null } | { business_unit_id: string | null }[] | null;
          conjuntos_herramientas:
            | { tipo_servicio?: string }
            | { tipo_servicio?: string }[]
            | null;
        }
      | undefined;
    if (!row) {
      issues.push({ codigo: mid.slice(0, 8), nombre: '—', detalle: 'Instrumento patrón no encontrado.' });
      continue;
    }
    const codigo = row.codigo ?? mid;
    const nombre = row.nombre ?? '—';

    if (row.tipo !== 'A') {
      issues.push({
        codigo,
        nombre,
        detalle:
          'Solo instrumentos tipo A (patrón con calibración externa EMA) pueden usarse como referencia en esta verificación.',
      });
      continue;
    }

    if (workBuId) {
      const pl = Array.isArray(row.plants) ? row.plants[0] : row.plants;
      const patronBu = pl?.business_unit_id ?? null;
      if (patronBu !== workBuId) {
        issues.push({
          codigo,
          nombre,
          detalle:
            'El patrón pertenece a otra unidad de negocio y no puede usarse en esta verificación.',
        });
        continue;
      }
    }

    const ch = row.conjuntos_herramientas;
    const tipoServicio =
      (Array.isArray(ch) ? ch[0]?.tipo_servicio : ch?.tipo_servicio) ?? 'ninguno';
    const computed = computeInstrumentoEstadoFromSchedule(
      row.fecha_proximo_evento,
      row.estado,
      dias,
    );
    if (computed === 'vencido') {
      issues.push({
        codigo,
        nombre,
        detalle:
          'El patrón está vencido respecto a su programación de calibración/verificación. Registre un certificado vigente o actualice el programa antes de usarlo como referencia.',
      });
      continue;
    }
    if ((tipoServicio === 'calibracion' || tipoServicio === 'verificacion') && !row.fecha_proximo_evento) {
      issues.push({
        codigo,
        nombre,
        detalle: 'El patrón no tiene fecha de próximo evento de calibración/verificación programada.',
      });
      continue;
    }

    const { data: cert, error: cErr } = await admin
      .from('certificados_calibracion')
      .select('fecha_emision, fecha_vencimiento, incertidumbre_expandida')
      .eq('instrumento_id', mid)
      .eq('is_vigente', true)
      .order('fecha_emision', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cErr) throw cErr;

    if (!cert) {
      issues.push({
        codigo,
        nombre,
        detalle:
          'No hay certificado de calibración vigente registrado para este patrón. Registre el certificado del laboratorio acreditado antes de usarlo como referencia (trazabilidad NMX-EC-17025).',
      });
      continue;
    }

    const emision = cert.fecha_emision as string;
    const vencimiento = cert.fecha_vencimiento as string;
    if (fechaVerificacion < emision) {
      issues.push({
        codigo,
        nombre,
        detalle: `La fecha de verificación (${fechaVerificacion}) es anterior a la emisión del certificado vigente (${emision}).`,
      });
    }
    if (fechaVerificacion > vencimiento) {
      issues.push({
        codigo,
        nombre,
        detalle: `La fecha de verificación (${fechaVerificacion}) es posterior al vencimiento del certificado vigente (${vencimiento}).`,
      });
    }

    const u = cert.incertidumbre_expandida as number | null | undefined;
    if (u == null || !(u > 0)) {
      issues.push({
        codigo,
        nombre,
        detalle:
          'El certificado vigente no incluye incertidumbre expandida (U) registrada en el sistema. Complétela en el certificado para cumplir con el reporte de incertidumbre (17025).',
      });
    }
  }

  return issues.length ? { ok: false, issues } : { ok: true };
}
