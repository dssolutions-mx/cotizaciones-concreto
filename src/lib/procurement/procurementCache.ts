/**
 * In-memory cache for procurement aggregated metrics.
 * Used for supplier-analysis and other heavy aggregation APIs.
 */

import { PROCUREMENT_METRICS } from './metricsConfig';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function cacheKey(prefix: string, params: Record<string, string | undefined>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ''}`)
    .join('&');
  return `${PROCUREMENT_METRICS.CACHE_PREFIX}${prefix}:${sorted}`;
}

export function getCached<T>(prefix: string, params: Record<string, string | undefined>): T | null {
  const key = cacheKey(prefix, params);
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(
  prefix: string,
  params: Record<string, string | undefined>,
  data: T,
  ttlMs?: number
): void {
  const key = cacheKey(prefix, params);
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs ?? PROCUREMENT_METRICS.SUPPLIER_ANALYSIS_TTL_MS,
  });
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  const toDelete: string[] = [];
  for (const k of cache.keys()) {
    if (k.startsWith(`${PROCUREMENT_METRICS.CACHE_PREFIX}${prefix}`)) toDelete.push(k);
  }
  toDelete.forEach((k) => cache.delete(k));
}
