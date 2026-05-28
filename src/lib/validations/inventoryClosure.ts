import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD');

export const InitiateClosureSchema = z.object({
  plant_id: z.string().uuid('plant_id debe ser un UUID válido'),
  period_start: isoDate,
  period_end: isoDate,
  variance_threshold_pct: z.number().min(0).max(100).optional().default(2),
  notes: z.string().max(2000).optional(),
  parent_closure_id: z.string().uuid().optional(),
}).refine((d) => d.period_end >= d.period_start, {
  message: 'period_end debe ser igual o posterior a period_start',
  path: ['period_end'],
});

export const PhysicalCountUnitSchema = z.enum(['kg', 'm3', 'ton', 'unit']);

export const PhysicalCountRowSchema = z.object({
  material_id: z.string().uuid(),
  physical_count_value: z.number().min(0),
  physical_count_unit: PhysicalCountUnitSchema,
  volumetric_weight_kg_per_m3: z.number().positive().optional(),
  volumetric_weight_source: z
    .enum(['quality_study', 'closure_override', 'po_item', 'supplier_agreement', 'material_default', 'entry'])
    .optional(),
  quality_study_id: z.string().uuid().optional(),
});

export const BulkPhysicalCountSchema = z.object({
  counts: z.array(PhysicalCountRowSchema).min(1),
});

export const JustificationRowSchema = z.object({
  material_id: z.string().uuid(),
  justification_text: z.string().min(1, 'La justificación no puede estar vacía').max(5000),
});

export const BulkJustificationsSchema = z.object({
  justifications: z.array(JustificationRowSchema).min(1),
});

export const SealClosureSchema = z.object({
  signed_by: z.string().uuid(),
  // Accept a storage path or a URL — path is preferred so signed URLs don't expire
  signature_image_url: z.string().min(1, 'La firma es requerida'),
});

export const ListClosuresQuerySchema = z.object({
  plant_id: z.string().uuid().optional(),
  status: z
    .enum(['draft', 'physical_count', 'reconciled', 'justified', 'sealed', 'cancelled'])
    .optional(),
  period_start: isoDate.optional(),
  period_end: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
