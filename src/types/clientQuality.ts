// Types for Client Quality Analysis Module

// Basic client information
export interface ClientInfo {
  id: string;
  business_name: string;
  client_code: string;
  rfc?: string;
  hasQualityData?: boolean;
}

// Quality metrics for a specific period
export interface ClientQualityMetrics {
  totalVolume: number; // Total volume in m³
  totalRemisiones: number;
  totalMuestreos: number;
  totalEnsayos: number;
  avgResistencia: number;
  complianceRate: number; // Percentage of tests meeting specifications
  volumeByMonth: Array<{
    month: string;
    volume: number;
    remisiones: number;
  }>;
  complianceByMonth: Array<{
    month: string;
    complianceRate: number;
    totalTests: number;
    passedTests: number;
  }>;
}

// Detailed quality data by remision
export interface ClientQualityRemisionData {
  id: string;
  orderId?: string;
  remisionNumber: string;
  fecha: string;
  volume: number;
  recipeCode: string;
  recipeFc: number;
  constructionSite: string;
  muestreos: Array<{
    id: string;
    fechaMuestreo: string;
    numeroMuestreo: number;
    masaUnitaria: number;
    temperaturaAmbiente: number;
    temperaturaConcreto: number;
    revenimientoSitio: number;
    concrete_specs?: any;
    muestras: Array<{
      id: string;
      tipoMuestra: 'CILINDRO' | 'VIGA' | 'CUBO';
      identificacion: string;
      fechaProgramadaEnsayo: string;
      ensayos: Array<{
        id: string;
        fechaEnsayo: string;
        cargaKg: number;
        resistenciaCalculada: number;
        porcentajeCumplimiento: number;
        isEdadGarantia: boolean;
        isEnsayoFueraTiempo: boolean;
      }>;
    }>;
  }>;
  complianceStatus: 'compliant' | 'non_compliant' | 'pending' | 'no_data';
  avgResistencia?: number;
  avgCompliance?: number;
  minResistencia?: number;
  maxResistencia?: number;
  rendimientoVolumetrico?: number;
  totalMaterialQuantity?: number;
  materiales?: Array<{
    id: string;
    materialType: string;
    cantidadReal: number;
  }>;
  siteChecks?: Array<{
    id: string;
    testType: 'SLUMP' | 'EXTENSIBILIDAD';
    valorInicialCm: number | null;
    valorFinalCm: number | null;
    fueAjustado: boolean;
    temperaturaAmbiente: number | null;
    temperaturaConcreto: number | null;
    fechaMuestreo: string;
  }>;
}

// Per-recipe coefficient of variation breakdown
export interface RecipeCVBreakdown {
  recipeCode: string;
  strengthFc: number;
  ageDays: number;
  coefficientVariation: number;
  ensayoCount: number;
  muestreoCount: number; // Number of muestreos (samplings) used for CV calculation
  avgResistencia: number;
  avgCompliance: number;
}

// Summary statistics for client quality analysis
export interface ClientQualitySummary {
  clientInfo: ClientInfo;
  period: {
    from: string;
    to: string;
  };
  totals: {
    volume: number;
    remisiones: number;
    remisionesMuestreadas: number;
    remisionesConDatosCalidad: number;
    porcentajeCoberturaMuestreo: number;
    porcentajeCoberturaCalidad: number;
    muestreos: number;
    ensayos: number;
    ensayosEdadGarantia: number;
  };
  averages: {
    resistencia: number;
    complianceRate: number;
    masaUnitaria: number;
    rendimientoVolumetrico: number;
    coefficientVariation: number;
    cvByRecipe?: RecipeCVBreakdown[];
  };
  performance: {
    complianceRate: number;
    onTimeTestingRate: number;
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
    qualityTrend: 'improving' | 'declining' | 'stable';
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    metric: string;
  }>;
}

// Main data structure containing all client quality information
export interface ClientQualityData {
  clientInfo: ClientInfo;
  summary: ClientQualitySummary;
  remisiones: ClientQualityRemisionData[];
  monthlyStats: Array<{
    month: string;
    year: number;
    volume: number;
    remisiones: number;
    muestreos: number;
    ensayos: number;
    avgResistencia: number;
    complianceRate: number;
  }>;
  qualityByRecipe: Array<{
    recipeCode: string;
    recipeFc: number;
    totalVolume: number;
    totalTests: number;
    avgResistencia: number;
    complianceRate: number;
    count: number;
  }>;
  qualityByConstructionSite: Array<{
    constructionSite: string;
    totalVolume: number;
    totalTests: number;
    avgResistencia: number;
    complianceRate: number;
    count: number;
  }>;
}

// Chart data types for visualization
export interface ClientQualityChartData {
  volumeChart: Array<{
    date: string;
    volume: number;
    remisiones: number;
  }>;
  complianceChart: Array<{
    date: string;
    complianceRate: number;
    totalTests: number;
    passedTests: number;
  }>;
  resistenciaChart: Array<{
    date: string;
    avgResistencia: number;
    minResistencia: number;
    maxResistencia: number;
    count: number;
  }>;
  recipePerformance: Array<{
    recipe: string;
    avgResistencia: number;
    complianceRate: number;
    volume: number;
  }>;
}

// Filter options for client quality analysis
export interface ClientQualityFilters {
  dateRange: {
    from: string;
    to: string;
  };
  clientId?: string;
  recipeCodes?: string[];
  constructionSites?: string[];
  complianceStatus?: 'compliant' | 'non_compliant' | 'pending' | 'all';
  minVolume?: number;
  maxVolume?: number;
}

// API response types
export interface ClientQualityApiResponse {
  data: ClientQualityData;
  summary: ClientQualitySummary;
  success: boolean;
  error?: string;
}

// Dashboard component props
export interface ClientQualityMetricsProps {
  summary: ClientQualitySummary;
  loading?: boolean;
}

export interface ClientQualityChartsProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
  chartType: 'overview' | 'volume' | 'compliance' | 'performance';
}

export interface ClientQualityTableProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export interface ClientSelectorProps {
  selectedClientId: string;
  onClientSelect: (clientId: string) => void;
}
