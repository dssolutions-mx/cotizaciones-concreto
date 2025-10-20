export type POStatus = 'open' | 'partial' | 'fulfilled' | 'cancelled';
export type MaterialUom = 'kg' | 'l';

export interface PurchaseOrder {
  id: string;
  plant_id: string;
  supplier_id: string;
  currency: 'MXN';
  status: POStatus;
  notes?: string;
  created_by: string;
  approved_by?: string | null;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  is_service: boolean; // true for fleet/services
  material_id?: string | null;
  uom?: MaterialUom | null;
  qty_ordered: number;
  qty_received_kg: number;
  unit_price: number;
  status: POStatus;
  required_by?: string;
  created_at: string;
}


