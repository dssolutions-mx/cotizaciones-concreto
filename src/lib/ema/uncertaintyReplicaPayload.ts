/**
 * Sanitize replica PUT payloads before Zod validation / DB upsert.
 * Strips nulls, non-finite numbers, and empty UUID strings that cause 422s.
 */

import { z } from 'zod';

export function sanitizeRawValuesJson(
  raw: Record<string, unknown> | null | undefined,
): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== 'string' || k.length === 0) continue;
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
    } else if (typeof v === 'string' && v.length > 0) {
      out[k] = v;
    }
  }
  return out;
}

export const NullableUuidSchema = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.string().uuid().nullable(),
);

export const ReplicaPayloadSchema = z.object({
  orden: z.number().int().min(1),
  operator_id: NullableUuidSchema.optional(),
  instrumento_id: NullableUuidSchema.optional(),
  raw_values_json: z
    .record(z.unknown())
    .transform((raw) => sanitizeRawValuesJson(raw)),
  computed_value: z.preprocess(
    (v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v ?? null),
    z.number().nullable().optional(),
  ),
});

export const UpsertReplicasPayloadSchema = z.object({
  replicas: z.array(ReplicaPayloadSchema).min(1),
});
