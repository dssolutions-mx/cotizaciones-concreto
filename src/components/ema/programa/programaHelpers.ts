import type { ProgramaCalibacionConInstrumento, EstadoPrograma } from '@/types/ema';

export const TIPO_EVENTO_LABEL: Record<string, string> = {
  calibracion_externa: 'Calibración EMA',
  verificacion_interna: 'Verificación interna',
  verificacion_post_incidente: 'Post-incidente',
};

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const ESTADO_STYLE: Record<
  EstadoPrograma,
  { pill: string; dot: string; label: string }
> = {
  pendiente: {
    pill: 'bg-sky-100 text-sky-800 border-sky-200',
    dot: 'bg-sky-400',
    label: 'Pendiente',
  },
  completado: {
    pill: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-400',
    label: 'Completado',
  },
  vencido: {
    pill: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
    label: 'Vencido',
  },
  cancelado: {
    pill: 'bg-stone-100 text-stone-500 border-stone-200',
    dot: 'bg-stone-300',
    label: 'Cancelado',
  },
};

export function programaDateKey(iso: string): string {
  return iso.split('T')[0] ?? iso;
}

export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(programaDateKey(dateStr)).getTime() - today.getTime()) / 86_400_000);
}

export function eventPillClass(entry: ProgramaCalibacionConInstrumento): string {
  if (entry.estado === 'completado') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (entry.estado === 'cancelado') return 'bg-stone-100 text-stone-500 border-stone-200';
  if (entry.estado === 'vencido') return 'bg-red-100 text-red-800 border-red-200';
  const d = daysUntil(entry.fecha_programada);
  if (d <= 7) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-sky-100 text-sky-800 border-sky-200';
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function isProgramaRowOverdue(e: ProgramaCalibacionConInstrumento): boolean {
  if (e.estado === 'vencido') return true;
  if (e.estado === 'pendiente' && daysUntil(e.fecha_programada) < 0) return true;
  return false;
}

export function groupProgramaByDay(entries: ProgramaCalibacionConInstrumento[]): Map<string, ProgramaCalibacionConInstrumento[]> {
  const map = new Map<string, ProgramaCalibacionConInstrumento[]>();
  for (const e of entries) {
    const k = programaDateKey(e.fecha_programada);
    const arr = map.get(k) ?? [];
    arr.push(e);
    map.set(k, arr);
  }
  return map;
}
