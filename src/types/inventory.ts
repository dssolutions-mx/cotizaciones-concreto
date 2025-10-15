export interface MaterialEntry {
  id: string;
  entry_number: string;
  plant_id: string;
  material_id: string;
  supplier_id?: string;
  entry_date: string;
  entry_time: string;
  quantity_received: number;
  unit_price?: number;
  total_cost?: number;
  supplier_invoice?: string;
  inventory_before: number;
  inventory_after: number;
  notes?: string;
  entered_by: string;
  created_at: string;
  updated_at: string;
  // Fleet tracking
  fleet_supplier_id?: string;
  fleet_cost?: number;
  // Pricing review workflow
  pricing_status?: 'pending' | 'reviewed';
  reviewed_by?: string;
  reviewed_at?: string;
  // Optional joined data
  material?: {
    id: string;
    material_name: string;
    category: string;
    unit_of_measure: string;
  };
  entered_by_user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface MaterialAdjustment {
  id: string;
  adjustment_number: string;
  plant_id: string;
  material_id: string;
  adjustment_date: string;
  adjustment_time: string;
  adjustment_type: 'consumption' | 'waste' | 'correction' | 'transfer' | 'loss';
  quantity_adjusted: number;
  inventory_before: number;
  inventory_after: number;
  reference_type?: string;
  reference_notes: string;
  document_urls?: string[];
  notes?: string;
  adjusted_by: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialInventory {
  id: string;
  plant_id: string;
  material_id: string;
  current_stock: number;
  minimum_stock: number;
  maximum_stock?: number;
  stock_status: 'LOW' | 'OK' | 'EXCESS';
  last_entry_date?: string;
  last_adjustment_date?: string;
  last_consumption_date?: string;
  updated_at: string;
  material?: {
    id: string;
    material_name: string;
    category: string;
    unit: string;
    is_active: boolean;
  };
}

export interface DailyInventoryLog {
  id: string;
  plant_id: string;
  log_date: string;
  total_entries: number;
  total_adjustments: number;
  total_consumption: number;
  is_closed: boolean;
  closed_by?: string;
  closed_at?: string;
  daily_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialEntryInput {
  material_id: string;
  supplier_id?: string;
  quantity_received: number;
  supplier_invoice?: string;
  notes?: string;
  entry_date?: string; // defaults to today
  plant_id?: string; // Added for plant-specific filtering
}

export interface MaterialAdjustmentInput {
  material_id: string;
  adjustment_type: 'manual_out' | 'manual_in' | 'correction' | 'waste' | 'transfer' | 'return';
  quantity: number;
  reason: string;
  reference_number?: string;
  transfer_destination?: string;
  notes?: string;
  adjustment_date?: string; // defaults to today
  document_urls?: string[];
}

export interface InventorySearchParams {
  date?: string;
  material_id?: string;
  type?: 'entries' | 'adjustments' | 'all';
  limit?: number;
  offset?: number;
}

export interface InventoryActivity {
  activity_type: 'ENTRY' | 'ADJUSTMENT';
  activity_date: string;
  activity_time: string;
  plant_name: string;
  material_name: string;
  quantity: number;
  inventory_before: number;
  inventory_after: number;
  performed_by: string;
  notes?: string;
}

export interface CurrentStockStatus {
  plant_name: string;
  material_name: string;
  category: string;
  current_stock: number;
  minimum_stock: number;
  stock_status: 'LOW' | 'OK' | 'EXCESS';
  last_entry_date?: string;
  last_adjustment_date?: string;
  last_consumption_date?: string;
}

export interface DocumentUploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface ArkikProcessingResult {
  fileId: string;
  totalRecords: number;
  date: string;
  plant: string;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  errors?: string[];
}

// API Response types
export interface InventoryApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface InventoryListResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Frontend form data types
export interface MaterialEntryFormData {
  materialId: string;
  quantity: number;
  supplierInvoice?: string;
  truckNumber?: string;
  driverName?: string;
  notes?: string;
  documents: string[];
}

export interface MaterialAdjustmentFormData {
  materialId: string;
  adjustmentType: 'manual_out' | 'manual_in' | 'correction' | 'waste' | 'transfer' | 'return';
  quantity: number;
  reason: string;
  referenceNumber?: string;
  transferDestination?: string;
  notes?: string;
  documents: string[];
}

// Component props types
export interface MaterialSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  plantId?: string;
}

export interface SupplierSelectProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  plantId?: string;
}

export interface FileUploadProps {
  onFileSelect: (files: FileList) => void;
  acceptedTypes?: string[];
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in MB
  uploading?: boolean;
  disabled?: boolean;
  className?: string;
}

export interface DocumentPreviewProps {
  url: string;
  name?: string;
  type?: string;
  size?: number;
  onRemove?: () => void;
  className?: string;
}

// Material and supplier types for selects
export interface Material {
  id: string;
  material_name: string;
  category: string;
  unit: string;
  is_active: boolean;
}

export interface Supplier {
  id: string;
  supplier_name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
}

export interface InventoryDocument {
  id: string;
  entry_id?: string;
  adjustment_id?: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  document_type: 'entry' | 'adjustment';
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  url?: string; // Signed URL for viewing
}

export interface PendingFile {
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploaded' | 'error';
  documentId?: string;
  error?: string;
  url?: string;
  isCameraCapture?: boolean;
}

// New types for the inventory dashboard
export interface InventoryDashboardFilters {
  plant_id?: string;
  start_date: string;
  end_date: string;
  material_ids?: string[];
}

export interface MaterialFlowSummary {
  material_id: string;
  material_name: string;
  unit: string;
  
  // Inputs
  initial_stock: number;
  total_entries: number;
  total_manual_additions: number;
  
  // Outputs  
  total_remisiones_consumption: number;
  total_manual_withdrawals: number;
  total_adjustments: number;
  total_waste: number;
  
  // Final calculation
  theoretical_final_stock: number;
  actual_current_stock: number;
  variance: number;
  variance_percentage: number;
}

export interface InventoryDashboardSummary {
  date_range: {
    start_date: string;
    end_date: string;
  };
  plant_info: {
    id: string;
    name: string;
    code: string;
  };
  
  // Aggregated totals
  total_materials_tracked: number;
  total_remisiones: number;
  total_entries: number;
  total_adjustments: number;
  materials_with_variance: number;
  
  // Material-level details
  material_flows: MaterialFlowSummary[];
}

export interface RemisionMaterialConsumption {
  remision_number: string;
  remision_date: string;
  material_id: string;
  material_name: string;
  cantidad_teorica: number;
  cantidad_real: number;
  variance: number;
}

export interface InventoryMovement {
  movement_type: 'ENTRY' | 'ADJUSTMENT' | 'REMISION' | 'WASTE';
  movement_date: string;
  material_id: string;
  material_name: string;
  quantity: number;
  unit: string;
  reference: string;
  notes?: string;
}

export interface InventoryDashboardData {
  summary: InventoryDashboardSummary;
  movements: InventoryMovement[];
  consumption_details: RemisionMaterialConsumption[];
}

// API Response types for dashboard
export interface InventoryDashboardResponse {
  success: boolean;
  data: InventoryDashboardData;
  error?: string;
}
