// Types for Dynamic PDF Report System

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
  dateRange: {
    from: Date;
    to: Date;
  };
  clientId?: string;
  constructionSite?: string;
  recipeCode?: string;
  deliveryStatus?: 'all' | 'delivered' | 'pending';
  invoiceRequirement?: 'all' | 'with_invoice' | 'without_invoice';
  singleDateMode?: boolean;
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
    requires_invoice: boolean;
    total_amount: number;
    final_amount?: number;
    invoice_amount?: number;
    client_id: string;
    elemento?: string;
  };
  
  client?: {
    id: string;
    business_name: string;
    name?: string;
    rfc?: string;
    address?: string;
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
  groupBy?: 'none' | 'date' | 'recipe' | 'construction_site';
  sortBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
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
  };
  dateRange: {
    from: Date;
    to: Date;
  };
  generatedAt: Date;
}

// Available columns for the report system
export const AVAILABLE_COLUMNS: ReportColumn[] = [
  // Delivery Information
  {
    id: 'remision_number',
    label: 'No. Remisión',
    field: 'remision_number',
    type: 'text',
    width: '12%',
    required: true
  },
  {
    id: 'fecha',
    label: 'Fecha',
    field: 'fecha',
    type: 'date',
    format: 'date',
    width: '10%',
    required: true
  },
  {
    id: 'construction_site',
    label: 'Obra',
    field: 'order.construction_site',
    type: 'text',
    width: '15%'
  },
  {
    id: 'volumen_fabricado',
    label: 'Volumen (m³)',
    field: 'volumen_fabricado',
    type: 'number',
    format: 'decimal',
    width: '10%',
    required: true
  },
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
  
  // Product Information
  {
    id: 'recipe_code',
    label: 'Código Receta',
    field: 'recipe.recipe_code',
    type: 'text',
    width: '10%'
  },
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
  
  // Financial Information
  {
    id: 'unit_price',
    label: 'Precio Unitario',
    field: 'unit_price',
    type: 'currency',
    format: 'currency',
    width: '12%'
  },
  {
    id: 'line_total',
    label: 'Total Línea',
    field: 'line_total',
    type: 'currency',
    format: 'currency',
    width: '12%'
  },
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
  
  // Order Information
  {
    id: 'order_number',
    label: 'No. Orden',
    field: 'order.order_number',
    type: 'text',
    width: '10%'
  },
  {
    id: 'elemento',
    label: 'Elemento',
    field: 'order.elemento',
    type: 'text',
    width: '12%'
  },
  {
    id: 'requires_invoice',
    label: 'Requiere Factura',
    field: 'order.requires_invoice',
    type: 'boolean',
    width: '8%'
  },
  
  // Client Information
  {
    id: 'business_name',
    label: 'Razón Social',
    field: 'client.business_name',
    type: 'text',
    width: '15%'
  },
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
  ]
};

// Predefined report templates
export const DEFAULT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'delivery-summary',
    name: 'Resumen de Entregas',
    description: 'Reporte básico de entregas por cliente',
    selectedColumns: DEFAULT_COLUMN_SETS.delivery,
    isDefault: true
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
