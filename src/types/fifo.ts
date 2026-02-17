/**
 * FIFO Consumption Allocation Types
 * 
 * These types support ERP-standard FIFO costing where material consumption
 * is allocated to specific entry layers (cost layers) in chronological order.
 */

export interface MaterialConsumptionAllocation {
  id: string;
  remision_id: string;
  remision_material_id: string;
  entry_id: string;
  material_id: string;
  plant_id: string;
  quantity_consumed_kg: number;
  unit_price: number;
  total_cost: number;
  consumption_date: string; // YYYY-MM-DD
  created_at: string;
  created_by?: string | null;
}

export interface FIFOAllocationResult {
  totalCost: number;
  allocations: Array<{
    entryId: string;
    entryNumber: string;
    quantity: number; // kg consumed from this layer
    unitPrice: number; // exact price from this entry layer
    cost: number; // quantity * unitPrice
    remainingAfter: number; // remaining quantity in this layer after consumption
  }>;
}

export interface FIFOAllocationRequest {
  remisionId: string;
  remisionMaterialId: string;
  materialId: string;
  plantId: string;
  quantityToConsume: number; // total kg to consume
  consumptionDate: string; // YYYY-MM-DD
}

export interface InventoryValuationResult {
  materialId: string;
  plantId: string;
  totalValue: number;
  layers: Array<{
    entryId: string;
    entryNumber: string;
    remainingQuantityKg: number;
    unitPrice: number;
    layerValue: number;
  }>;
}
