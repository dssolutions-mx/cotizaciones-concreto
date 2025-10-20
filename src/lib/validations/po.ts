import { z } from 'zod';

export const MaterialUomSchema = z.enum(['kg', 'l']);

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
  material_id: z.string().uuid('ID de material debe ser un UUID válido').optional(),
  uom: MaterialUomSchema.optional(),
  qty_ordered: z.number().positive('Cantidad debe ser positiva'),
  unit_price: z.number().nonnegative('Precio debe ser no negativo'),
  required_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const POItemUpdateSchema = z.object({
  id: z.string().uuid('ID de item debe ser un UUID válido'),
  qty_ordered: z.number().positive('Cantidad debe ser positiva').optional(),
  unit_price: z.number().nonnegative('Precio debe ser no negativo').optional(),
  required_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: PurchaseOrderItemStatusSchema.optional(),
});

export type POHeaderInput = z.infer<typeof POHeaderInputSchema>;
export type POHeaderUpdate = z.infer<typeof POHeaderUpdateSchema>;
export type POItemInput = z.infer<typeof POItemInputSchema>;
export type POItemUpdate = z.infer<typeof POItemUpdateSchema>;


