import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getInstrumentos } from '@/services/emaInstrumentoService';
import { getProgramaCalendar } from '@/services/emaProgramaService';
import type { EstadoInstrumento } from '@/types/ema';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const plant_id = searchParams.get('plant_id') ?? undefined;

    const admin = createServiceClient();

    // ── All instruments for stats ──────────────────────────────────────────
    const allInstrumentos = await getInstrumentos({ plant_id, limit: 500 });

    const stats: Record<EstadoInstrumento | 'total', number> = {
      vigente: 0,
      proximo_vencer: 0,
      vencido: 0,
      en_revision: 0,
      inactivo: 0,
      total: allInstrumentos.length,
    };
    for (const inst of allInstrumentos) {
      if (inst.estado in stats) stats[inst.estado]++;
    }

    // ── Urgent items (vencido + proximo_vencer) ────────────────────────────
    const urgentItems = allInstrumentos
      .filter(i => i.estado === 'vencido' || i.estado === 'proximo_vencer')
      .sort((a, b) => {
        // vencido before proximo_vencer, then by fecha_proximo_evento ascending
        if (a.estado !== b.estado) return a.estado === 'vencido' ? -1 : 1;
        if (!a.fecha_proximo_evento) return 1;
        if (!b.fecha_proximo_evento) return -1;
        return a.fecha_proximo_evento.localeCompare(b.fecha_proximo_evento);
      })
      .slice(0, 8);

    // ── Recent activity (last 10 events across all tables) ─────────────────
    const [certsRes, verifsRes, incidentesRes] = await Promise.all([
      admin
        .from('certificados_calibracion')
        .select('id, instrumento_id, laboratorio_externo, created_at, instrumentos(codigo, nombre)')
        .order('created_at', { ascending: false })
        .limit(5),
      admin
        .from('completed_verificaciones')
        .select('id, instrumento_id, resultado, estado, created_at, instrumentos(codigo, nombre)')
        .order('created_at', { ascending: false })
        .limit(5),
      admin
        .from('incidentes_instrumento')
        .select('id, instrumento_id, tipo, severidad, estado, created_at, instrumentos(codigo, nombre)')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const activities: Array<{
      type: string;
      instrumento: { id: string; codigo: string; nombre: string };
      descripcion: string;
      fecha: string;
    }> = [];

    for (const row of (certsRes.data ?? [])) {
      const inst = (row.instrumentos as any);
      if (!inst) continue;
      activities.push({
        type: 'certificado',
        instrumento: { id: row.instrumento_id, codigo: inst.codigo, nombre: inst.nombre },
        descripcion: `Certificado registrado — ${row.laboratorio_externo}`,
        fecha: row.created_at,
      });
    }
    for (const row of (verifsRes.data ?? [])) {
      const inst = (row.instrumentos as any);
      if (!inst) continue;
      activities.push({
        type: 'verificacion',
        instrumento: { id: row.instrumento_id, codigo: inst.codigo, nombre: inst.nombre },
        descripcion: `Verificación interna — ${row.resultado}`,
        fecha: row.created_at,
      });
    }
    for (const row of (incidentesRes.data ?? [])) {
      const inst = (row.instrumentos as any);
      if (!inst) continue;
      activities.push({
        type: 'incidente',
        instrumento: { id: row.instrumento_id, codigo: inst.codigo, nombre: inst.nombre },
        descripcion: `Incidente reportado — ${row.tipo} (${row.severidad})`,
        fecha: row.created_at,
      });
    }
    // Sort combined activities descending by fecha, take top 10
    activities.sort((a, b) => b.fecha.localeCompare(a.fecha));
    const recentActivity = activities.slice(0, 10);

    // ── Upcoming programa (next 7 days) ───────────────────────────────────
    const today = new Date();
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);

    const programaProximos = await getProgramaCalendar({
      plant_id,
      estado: 'pendiente',
      fecha_desde: today.toISOString().split('T')[0],
      fecha_hasta: in7Days.toISOString().split('T')[0],
    });

    return NextResponse.json({
      stats,
      urgent_items: urgentItems,
      recent_activity: recentActivity,
      programa_proximos: programaProximos,
    });
  } catch (error: any) {
    console.error('[EMA Dashboard]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
