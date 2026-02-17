import { z } from 'zod';

export const MaterialUomSchema = z.enum(['kg', 'l', 'm3']);
export const ServiceUomSchema = z.enum(['trips', 'tons', 'hours', 'loads', 'units']);
export const POItemUomSchema = z.union([MaterialUomSchema, ServiceUomSchema]);

export const PurchaseOrderStatusSchema = z.enum(['open', 'partial', 'fulfilled', 'cancelled']);
export const PurchaseOrderItemStatusSchema = z.enum(['open', 'partial', 'fulfilled', 'cancelled']);

export const POHeaderInputSchema = z.object({
  plant_id: z.string().uuid('ID de planta debe ser un UUID válido'),
  supplier_id: z.string().uuid('ID de proveedor debe ser un UUID válido'),
  currency: z.literal('MXN').optional().default('MXN'),
  notes: z.string().max(2000).optional(),
});

export const POHeaderUpdateSchema = z.object({
  id: z.string().uuid('ID de PO debe ser un UUID válido'),
  status: PurchaseOrderStatusSchema.optional(),
  notes: z.string().max(2000).optional(),
  approved_by: z.string().uuid('ID de usuario inválido').optional(),
});

export const POItemInputSchema = z.object({
  po_id: z.string().uuid('ID de PO debe ser un UUID válido'),
  is_service: z.boolean().default(false),
  material_id: z.string().uuid('ID de material debe ser un UUID válido').nullable().optional(),
  service_description: z.string().min(1, 'Descripción del servicio requerida').max(500).nullable().optional(),
  uom: POItemUomSchema.optional(),
  qty_ordered: z.number().positive('Cantidad debe ser positiva'),
  unit_price: z.number().nonnegative('Precio debe ser no negativo'),
  required_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  volumetric_weight_kg_per_m3: z.number().positive('Peso volumétrico debe ser positivo').optional(),
  material_supplier_id: z.string().uuid('ID de proveedor de material debe ser un UUID válido').nullable().optional(),
}).refine(
  (data) => {
    if (data.is_service) {
      // Service: must have description, must NOT have material_id
      return !!data.service_description && !data.material_id;
    } else {
      // Material: must have material_id, must NOT have description
      return !!data.material_id && !data.service_description;
    }
  },
  {
    message: 'Servicios requieren descripción (sin material); Materiales requieren material_id (sin descripción)',
  }
).refine(
  (data) => {
    // UoM validation: required for both types
    if (!data.uom) return false;
    if (data.is_service) {
      return ServiceUomSchema.safeParse(data.uom).success;
    } else {
      const ok = MaterialUomSchema.safeParse(data.uom).success;
      if (!ok) return false;
      // If m3, volumetric weight may be provided (optional) but must be positive if present
      if (data.uom === 'm3' && data.volumetric_weight_kg_per_m3 !== undefined) {
        return data.volumetric_weight_kg_per_m3 > 0;
      }
      return true;
    }
  },
  {
    message: 'UoM inválido o peso volumétrico inválido (m3 requiere valor positivo si se envía)',
  }
).refine(
  (data) => {
    // material_supplier_id can only be set when is_service = true
    if (data.material_supplier_id && !data.is_service) {
      return false;
    }
    return true;
  },
  {
    message: 'material_supplier_id solo puede ser establecido para servicios (is_service=true)',
  }
);

export const POItemUpdateSchema = z.object({
  id: z.string().uuid('ID de item debe ser un UUID válido'),
  qty_ordered: z.number().positive('Cantidad debe ser positiva').optional(),
  unit_price: z.number().nonnegative('Precio debe ser no negativo').optional(),
  required_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: PurchaseOrderItemStatusSchema.optional(),
  volumetric_weight_kg_per_m3: z.number().positive('Peso volumétrico debe ser positivo').optional(),
});

export const POCreditInputSchema = z.object({
  credit_amount: z.number().positive('El monto del crédito debe ser positivo'),
  credit_notes: z.string().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional(),
});

export type POHeaderInput = z.infer<typeof POHeaderInputSchema>;
export type POHeaderUpdate = z.infer<typeof POHeaderUpdateSchema>;
export type POItemInput = z.infer<typeof POItemInputSchema>;
export type POItemUpdate = z.infer<typeof POItemUpdateSchema>;
export type POCreditInput = z.infer<typeof POCreditInputSchema>;

