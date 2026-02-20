/**
 * Procurement API observability: timing, structured logging.
 * Use for latency SLO checks and debugging.
 */

import { PROCUREMENT_SLO_MS, type ProcurementEndpoint } from './metricsConfig';

export interface ProcurementLogContext {
  endpoint: ProcurementEndpoint;
  role?: string;
  plant_id?: string;
  latency_ms?: number;
  error?: string;
  warning?: string;
}

export function logProcurement(ctx: ProcurementLogContext): void {
  const payload = {
    module: 'procurement',
    ...ctx,
    ts: new Date().toISOString(),
  };
  if (ctx.error) {
    console.error('[procurement]', JSON.stringify(payload));
  } else if (ctx.warning || (ctx.latency_ms && ctx.latency_ms > (PROCUREMENT_SLO_MS[ctx.endpoint] ?? 9999))) {
    console.warn('[procurement]', JSON.stringify(payload));
  } else if (process.env.NODE_ENV === 'development') {
    console.log('[procurement]', JSON.stringify(payload));
  }
}

export async function withProcurementTiming<T>(
  endpoint: ProcurementEndpoint,
  fn: () => Promise<T>,
  context?: Partial<Omit<ProcurementLogContext, 'endpoint' | 'latency_ms' | 'error'>>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const latency_ms = Date.now() - start;
    logProcurement({
      endpoint,
      latency_ms,
      ...context,
    });
    return result;
  } catch (err) {
    const latency_ms = Date.now() - start;
    logProcurement({
      endpoint,
      latency_ms,
      error: err instanceof Error ? err.message : String(err),
      ...context,
    });
    throw err;
  }
}
