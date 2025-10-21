import { z } from 'zod';

// Common enums
export const MaterialUomSchema = z.enum(['kg', 'l', 'm3']);

// Base schemas
const BaseMaterialEntryInputSchema = z.object({
  material_id: z.string().uuid('ID de material debe ser un UUID válido'),
  supplier_id: z.string().uuid('ID de proveedor debe ser un UUID válido').optional(),
  quantity_received: z.number().positive('La cantidad debe ser positiva'),
  supplier_invoice: z.string().max(100, 'Número de remisión no puede exceder 100 caracteres').optional(),
  ap_due_date_material: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD').optional(),
  notes: z.string().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD').optional(),
  plant_id: z.string().uuid('ID de planta debe ser un UUID válido').optional(),
  // Pricing fields (for accounting review)
  unit_price: z.number().nonnegative('El precio unitario debe ser no negativo').optional(),
  total_cost: z.number().nonnegative('El costo total debe ser no negativo').optional(),
  fleet_supplier_id: z.string().uuid('ID de proveedor de flota debe ser un UUID válido').optional(),
  fleet_cost: z.number().nonnegative('El costo de flota debe ser no negativo').optional(),
  fleet_invoice: z.string().max(100, 'Número de factura de flota no puede exceder 100 caracteres').optional(),
  ap_due_date_fleet: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD').optional(),
  // Optional Purchase Order linkage on create (materials)
  po_id: z.string().uuid('ID de PO debe ser un UUID válido').optional(),
  po_item_id: z.string().uuid('ID de ítem de PO debe ser un UUID válido').optional(),
  received_uom: MaterialUomSchema.optional(),
  received_qty_entered: z.number().positive('Cantidad ingresada debe ser positiva').optional(),
  volumetric_weight_kg_per_m3: z.number().positive('Peso volumétrico debe ser positivo').optional(), // used only when received_uom='m3' and no PO/agreement/default
  // Fleet Purchase Order linkage
  fleet_po_id: z.string().uuid('ID de PO de flota debe ser un UUID válido').optional(),
  fleet_po_item_id: z.string().uuid('ID de ítem de PO de flota debe ser un UUID válido').optional(),
  fleet_qty_entered: z.number().positive('Cantidad de servicio debe ser positiva').optional(),
  fleet_uom: z.enum(['trips', 'tons', 'hours', 'loads', 'units']).optional(),
});

export const MaterialEntryInputSchema = BaseMaterialEntryInputSchema.refine(
  (data) => {
    // If liters, pass-through: no special requirements
    if (data.received_uom === 'l') return true;
    // If m3 without PO item specified, require volumetric weight or it must be resolvable elsewhere (will be enforced server-side). Here we only ensure positive if provided.
    if (data.received_uom === 'm3' && data.volumetric_weight_kg_per_m3 !== undefined) {
      return data.volumetric_weight_kg_per_m3 > 0;
    }
    return true;
  },
  {
    message: 'Peso volumétrico inválido para m3',
  }
);

export const MaterialAdjustmentInputSchema = z.object({
  material_id: z.string().uuid('ID de material debe ser un UUID válido'),
  adjustment_type: z.enum(['consumption', 'waste', 'correction', 'transfer', 'loss'], {
    required_error: 'Tipo de ajuste es requerido',
    invalid_type_error: 'Tipo de ajuste no válido'
  }),
  quantity_adjusted: z.number().positive('La cantidad ajustada debe ser positiva'),
  reference_type: z.string().max(50, 'Tipo de referencia no puede exceder 50 caracteres').optional(),
  reference_notes: z.string().min(1, 'Las notas de referencia son requeridas').max(1000, 'Notas de referencia no pueden exceder 1000 caracteres'),
  adjustment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD').optional(),
  plant_id: z.string().uuid('ID de planta debe ser un UUID válido').optional(),
});

export const InventorySearchParamsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD').optional(),
  material_id: z.string().uuid('ID de material debe ser un UUID válido').optional(),
  type: z.enum(['entries', 'adjustments', 'all']).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

export const DailyLogInputSchema = z.object({
  log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD'),
  daily_notes: z.string().max(1000, 'Las notas diarias no pueden exceder 1000 caracteres').optional(),
});

export const CloseDailyLogSchema = z.object({
  log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD'),
});

// File upload validation
export const DocumentUploadSchema = z.object({
  file: z.any(), // Using z.any() for server-side compatibility
  type: z.enum(['entry', 'adjustment'], { 
    required_error: 'Tipo de documento es requerido',
    invalid_type_error: 'Tipo de documento no válido'
  }),
  reference_id: z.string().uuid('ID de referencia debe ser un UUID válido'),
});

// Query parameter validation for GET requests
export const GetInventoryQuerySchema = z.object({
  plant_id: z.string().uuid('ID de planta debe ser un UUID válido').optional(),
  material_id: z.string().uuid('ID de material debe ser un UUID válido').optional(),
  low_stock_only: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
});

export const GetDailyLogQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD').optional(),
  plant_id: z.string().uuid('ID de planta debe ser un UUID válido').optional(),
});

export const GetActivitiesQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha desde debe estar en formato YYYY-MM-DD').optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha hasta debe estar en formato YYYY-MM-DD').optional(),
  material_id: z.string().uuid('ID de material debe ser un UUID válido').optional(),
  activity_type: z.enum(['ENTRY', 'ADJUSTMENT', 'all']).optional().default('all'),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional().default(20),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0)).optional().default(0),
});

// Update schemas (for PUT requests)
export const UpdateMaterialEntrySchema = BaseMaterialEntryInputSchema.partial().extend({
  id: z.string().uuid('ID debe ser un UUID válido'),
});

export const UpdateMaterialAdjustmentSchema = MaterialAdjustmentInputSchema.partial().extend({
  id: z.string().uuid('ID debe ser un UUID válido'),
});

// Arkik upload validation
export const ArkikUploadSchema = z.object({
  file: z.any(), // Using z.any() for server-side compatibility
  plant_id: z.string().uuid('ID de planta debe ser un UUID válido').optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD').optional(),
});

// Export type aliases for convenience
export type MaterialEntryInput = z.infer<typeof MaterialEntryInputSchema>;
export type MaterialAdjustmentInput = z.infer<typeof MaterialAdjustmentInputSchema>;
export type InventorySearchParams = z.infer<typeof InventorySearchParamsSchema>;
export type DailyLogInput = z.infer<typeof DailyLogInputSchema>;
export type DocumentUpload = z.infer<typeof DocumentUploadSchema>;
export type GetInventoryQuery = z.infer<typeof GetInventoryQuerySchema>;
export type GetDailyLogQuery = z.infer<typeof GetDailyLogQuerySchema>;
export type GetActivitiesQuery = z.infer<typeof GetActivitiesQuerySchema>;
export type UpdateMaterialEntry = z.infer<typeof UpdateMaterialEntrySchema>;
export type UpdateMaterialAdjustment = z.infer<typeof UpdateMaterialAdjustmentSchema>;
export type ArkikUpload = z.infer<typeof ArkikUploadSchema>;
