// Types for Dynamic PDF Report System
import { DateRange } from "react-day-picker";

export interface ReportColumn {
  id: string;
  label: string;
  field: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  width?: string;
  format?: 'date' | 'currency' | 'decimal' | 'integer';
  required?: boolean;
}

export interface ReportFilter {
  dateRange: DateRange;
  clientIds?: string[];
  constructionSites?: string[];
  recipeCodes?: string[];
  orderIds?: string[];
  remisionIds?: string[];
  plantIds?: string[];
  deliveryStatus?: 'all' | 'delivered' | 'pending';
  invoiceRequirement?: 'all' | 'with_invoice' | 'without_invoice';
  singleDateMode?: boolean;
  
  // Legacy single selection support for backward compatibility
  clientId?: string;
  constructionSite?: string;
  recipeCode?: string;
}

// Enhanced selection interfaces for hierarchical data
export interface SelectableOrder {
  id: string;
  order_number: string;
  construction_site: string;
  elemento?: string;
  client_id: string;
  client_name: string;
  total_remisiones: number;
  total_volume: number;
  total_amount: number;
  selected: boolean;
  remisiones: SelectableRemision[];
}

export interface SelectableRemision {
  id: string;
  remision_number: string;
  fecha: string;
  order_id: string;
  volumen_fabricado: number;
  recipe_code?: string;
  conductor?: string;
  line_total?: number;
  selected: boolean;
  plant_info?: {
    plant_id: string;
    plant_code: string;
    plant_name: string;
    vat_percentage: number;
  };
}

export interface SelectableClient {
  id: string;
  business_name: string;
  client_code?: string;
  rfc?: string;
  selected: boolean;
  orders: SelectableOrder[];
}

export interface SelectionSummary {
  totalClients: number;
  totalOrders: number;
  totalRemisiones: number;
  totalVolume: number;
  totalAmount: number;
  selectedClients: string[];
  selectedOrders: string[];
  selectedRemisiones: string[];
}

export interface HierarchicalReportData {
  clients: SelectableClient[];
  selectionSummary: SelectionSummary;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  selectedColumns: string[];
  defaultFilters?: Partial<ReportFilter>;
  isDefault?: boolean;
  createdBy?: string;
  createdAt?: Date;
}

// Extended types based on existing database schema
export interface ReportRemisionData {
  id: string;
  remision_number: string;
  fecha: string;
  order_id: string;
  volumen_fabricado: number;
  conductor?: string;
  unidad?: string;
  tipo_remision: 'CONCRETO' | 'BOMBEO';
  
  // Display product: master_code when available (source of truth), else variant recipe_code
  master_code?: string;
  // From relationships
  recipe?: {
    recipe_code: string;
    strength_fc: number;
    notes?: string;
    placement_type?: string;
    max_aggregate_size?: number;
    slump?: number;
    age_days?: number;
  };
  
  order?: {
    order_number: string;
    construction_site: string;
    elemento?: string;
    requires_invoice: boolean;
    total_amount: number;
    final_amount?: number;
    invoice_amount?: number;
    client_id: string;
  };
  
  client?: {
    id: string;
    business_name: string;
    name?: string;
    rfc?: string;
    address?: string;
  };
  
  // Plant information for VAT calculation
  plant_info?: {
    plant_id: string;
    plant_code: string;
    plant_name: string;
    vat_percentage: number;
  };
  
  // Calculated fields
  unit_price?: number;
  line_total?: number;
  vat_amount?: number;
  final_total?: number;
}

export interface ReportSummary {
  totalRemisiones: number;
  totalVolume: number;
  totalAmount: number;
  totalVAT: number;
  finalTotal: number;
  groupedByRecipe: Record<string, {
    count: number;
    volume: number;
    amount: number;
  }>;
  groupedByDate: Record<string, {
    count: number;
    volume: number;
    amount: number;
  }>;
}

export interface ReportConfiguration {
  title: string;
  subtitle?: string;
  filters: ReportFilter;
  selectedColumns: ReportColumn[];
  template?: ReportTemplate;
  showSummary: boolean;
  showVAT: boolean;
  groupBy?: 'none' | 'date' | 'recipe' | 'construction_site' | 'client' | 'order';
  sortBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  // Enhanced selection options
  selectionMode: 'client-level' | 'order-level' | 'remision-level';
  allowPartialSelection: boolean;
}

export interface PDFReportProps {
  data: ReportRemisionData[];
  configuration: ReportConfiguration;
  summary: ReportSummary;
  clientInfo?: {
    business_name: string;
    name?: string;
    address?: string;
    rfc?: string;
    plant_info?: {
      plant_id: string;
      plant_code: string;
      plant_name: string;
      vat_percentage: number;
    };
  };
  dateRange: DateRange;
  generatedAt: Date;
}

// Available columns for the report system
export const AVAILABLE_COLUMNS: ReportColumn[] = [
  // Row Number Column (N°)
  {
    id: 'row_number',
    label: 'N°',
    field: '_row_number',
    type: 'number',
    width: '4%',
    required: true
  },
  // Company Standard Columns in exact order
  {
    id: 'fecha',
    label: 'Fecha',
    field: 'fecha',
    type: 'date',
    format: 'date',
    width: '8%',
    required: true
  },
  {
    id: 'remision_number',
    label: 'Remision',
    field: 'remision_number',
    type: 'text',
    width: '8%',
    required: true
  },
  {
    id: 'business_name',
    label: 'Cliente',
    field: 'client.business_name',
    type: 'text',
    width: '12%',
    required: true
  },
  {
    id: 'order_number',
    label: 'N° pedido',
    field: 'order.order_number',
    type: 'text',
    width: '8%',
    required: true
  },
  {
    id: 'construction_site',
    label: 'OBRA',
    field: 'order.construction_site',
    type: 'text',
    width: '12%',
    required: true
  },
  {
    id: 'elemento',
    label: 'ELEMENTO',
    field: 'order.elemento',
    type: 'text',
    width: '10%',
    required: true
  },
  {
    id: 'unidad_cr',
    label: 'Unidad',
    field: 'unidad',
    type: 'text',
    width: '6%',
    required: true
  },
  {
    id: 'recipe_code',
    label: 'Producto',
    field: 'recipe.recipe_code',
    type: 'text',
    width: '10%',
    required: true
  },
  {
    id: 'volumen_fabricado',
    label: 'M3',
    field: 'volumen_fabricado',
    type: 'number',
    format: 'decimal',
    width: '6%',
    required: true
  },
  {
    id: 'unit_price',
    label: 'P.U',
    field: 'unit_price',
    type: 'currency',
    format: 'currency',
    width: '8%',
    required: true
  },
  {
    id: 'line_total',
    label: 'Subtotal',
    field: 'line_total',
    type: 'currency',
    format: 'currency',
    width: '8%',
    required: true
  },
  
  // Additional columns (not in company standard)
  {
    id: 'conductor',
    label: 'Conductor',
    field: 'conductor',
    type: 'text',
    width: '12%'
  },
  {
    id: 'unidad',
    label: 'Unidad',
    field: 'unidad',
    type: 'text',
    width: '8%'
  },
  
  // Additional Product Information
  {
    id: 'strength_fc',
    label: 'Resistencia',
    field: 'recipe.strength_fc',
    type: 'number',
    format: 'integer',
    width: '8%'
  },
  {
    id: 'placement_type',
    label: 'Tipo Colocación',
    field: 'recipe.placement_type',
    type: 'text',
    width: '10%'
  },
  {
    id: 'max_aggregate_size',
    label: 'TMA',
    field: 'recipe.max_aggregate_size',
    type: 'number',
    format: 'integer',
    width: '6%'
  },
  {
    id: 'slump',
    label: 'Revenimiento',
    field: 'recipe.slump',
    type: 'number',
    format: 'integer',
    width: '8%'
  },
  
  // Additional Financial Information
  {
    id: 'vat_amount',
    label: 'IVA',
    field: 'vat_amount',
    type: 'currency',
    format: 'currency',
    width: '10%'
  },
  {
    id: 'final_total',
    label: 'Total Final',
    field: 'final_total',
    type: 'currency',
    format: 'currency',
    width: '12%'
  },
  
  // Additional Order Information
  {
    id: 'requires_invoice',
    label: 'Requiere Factura',
    field: 'order.requires_invoice',
    type: 'boolean',
    width: '8%'
  },
  
  // Additional Client Information
  {
    id: 'client_rfc',
    label: 'RFC Cliente',
    field: 'client.rfc',
    type: 'text',
    width: '10%'
  }
];

// Default column sets for quick selection
export const DEFAULT_COLUMN_SETS = {
  basic: [
    'remision_number',
    'fecha',
    'construction_site',
    'volumen_fabricado',
    'recipe_code'
  ],
  delivery: [
    'remision_number',
    'fecha',
    'construction_site',
    'volumen_fabricado',
    'conductor',
    'unidad',
    'recipe_code'
  ],
  financial: [
    'remision_number',
    'fecha',
    'construction_site',
    'volumen_fabricado',
    'recipe_code',
    'unit_price',
    'line_total',
    'requires_invoice'
  ],
  detailed: [
    'remision_number',
    'fecha',
    'construction_site',
    'volumen_fabricado',
    'conductor',
    'recipe_code',
    'strength_fc',
    'unit_price',
    'line_total',
    'vat_amount',
    'final_total'
  ],
  client_focused: [
    'fecha',
    'construction_site',
    'volumen_fabricado',
    'recipe_code',
    'strength_fc',
    'unit_price',
    'line_total',
    'requires_invoice'
  ],
  // Company standard template with required columns in exact order from image
  company_standard: [
    'fecha',
    'remision_number',
    'business_name',
    'order_number',
    'construction_site',
    'elemento',
    'unidad_cr',
    'recipe_code',
    'volumen_fabricado',
    'unit_price',
    'line_total'
  ]
};

// Predefined report templates
export const DEFAULT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'company-standard',
    name: 'Estándar Empresarial',
    description: 'Reporte estándar con columnas requeridas: fecha, remisión, cliente, pedido, obra, elemento, unidad, producto, m3, precio unitario, subtotal',
    selectedColumns: DEFAULT_COLUMN_SETS.company_standard,
    isDefault: true
  },
  {
    id: 'delivery-summary',
    name: 'Resumen de Entregas',
    description: 'Reporte básico de entregas por cliente',
    selectedColumns: DEFAULT_COLUMN_SETS.delivery
  },
  {
    id: 'financial-detail',
    name: 'Detalle Financiero',
    description: 'Reporte detallado con información financiera',
    selectedColumns: DEFAULT_COLUMN_SETS.financial,
    defaultFilters: {
      invoiceRequirement: 'all'
    }
  },
  {
    id: 'client-statement',
    name: 'Estado de Cuenta Cliente',
    description: 'Reporte enfocado al cliente con información relevante',
    selectedColumns: DEFAULT_COLUMN_SETS.client_focused,
    defaultFilters: {
      deliveryStatus: 'delivered'
    }
  },
  {
    id: 'complete-report',
    name: 'Reporte Completo',
    description: 'Reporte con toda la información disponible',
    selectedColumns: DEFAULT_COLUMN_SETS.detailed
  }
];
