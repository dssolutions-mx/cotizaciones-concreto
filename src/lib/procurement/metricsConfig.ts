/**
 * Procurement metrics layer — configuration
 * SLOs and limits per docs/PROCUREMENT_SLOS.md
 */

export const PROCUREMENT_METRICS = {
  /** Max months for supplier analysis / trend queries */
  MAX_MONTHS_RANGE: 24,

  /** TTL for supplier analysis cache (aggregated, slower queries) — 5 min */
  SUPPLIER_ANALYSIS_TTL_MS: 5 * 60 * 1000,

  /** TTL for PO summary cache (on-demand, per PO) — 1 min */
  PO_SUMMARY_TTL_MS: 60 * 1000,

  /** Cache key prefixes */
  CACHE_PREFIX: 'procurement:',
} as const;

export type ProcurementEndpoint =
  | 'po-summary'
  | 'supplier-analysis'
  | 'payables'
  | 'entries'
  | 'payable-validate';

/** Latency SLOs in ms (p95 targets) */
export const PROCUREMENT_SLO_MS: Record<ProcurementEndpoint, number> = {
  'po-summary': 300,
  'supplier-analysis': 5000, // 5s for 12 months
  payables: 500,
  entries: 800,
  'payable-validate': 500,
};
