import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

export interface GetRemisionesRangeParams {
  plantId?: string | null;
  from: Date | string;
  to: Date | string;
  page?: number; // 1-based
  pageSize?: number; // default 100
  select?: string; // override selection; default minimal fields
  orderBy?: { column: string; ascending?: boolean };
}

export interface RemisionesRangeResult<T = any> {
  rows: T[];
  count: number | null;
}

function toDateString(input: Date | string): string {
  if (typeof input === 'string') return input;
  return format(input, 'yyyy-MM-dd');
}

export async function getRemisionesRange<T = any>(params: GetRemisionesRangeParams): Promise<RemisionesRangeResult<T>> {
  const {
    plantId,
    from,
    to,
    page = 1,
    pageSize = 100,
    select = 'id, fecha, volumen_fabricado, tipo_remision, recipe_id, order_id',
    orderBy = { column: 'fecha', ascending: true },
  } = params;

  const fromStr = toDateString(from);
  const toStr = toDateString(to);

  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;

  let q = supabase
    .from('remisiones')
    .select(select, { count: 'exact' })
    .eq('tipo_remision', 'CONCRETO')
    .gte('fecha', fromStr)
    .lte('fecha', toStr)
    .order(orderBy.column, { ascending: !!orderBy.ascending })
    .range(rangeStart, rangeEnd);

  if (plantId) q = q.eq('plant_id', plantId);

  const { data, error, count } = await q as any;
  if (error) throw error;
  return { rows: (data || []) as T[], count: (typeof count === 'number' ? count : null) };
}

export interface GetRemisionesAllPagesParams extends Omit<GetRemisionesRangeParams, 'page' | 'pageSize'> {
  pageSize?: number;
}

export async function* getRemisionesAllPages<T = any>(params: GetRemisionesAllPagesParams): AsyncGenerator<RemisionesRangeResult<T>, void, unknown> {
  const { plantId, from, to, pageSize = 100, select, orderBy } = params;
  // Fetch first page to get count
  const first = await getRemisionesRange<T>({ plantId, from, to, page: 1, pageSize, select, orderBy });
  yield first;
  const total = first.count || 0;
  if (!total) return;
  const totalPages = Math.ceil(total / pageSize);
  for (let p = 2; p <= totalPages; p++) {
    const next = await getRemisionesRange<T>({ plantId, from, to, page: p, pageSize, select, orderBy });
    yield next;
  }
}


