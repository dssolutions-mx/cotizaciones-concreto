export interface Material {
  id: string;
  material_code: string;
  material_name: string;
  category: string;
  subcategory?: string;
  unit_of_measure: string;
  density?: number;
  specific_gravity?: number;
  absorption_rate?: number;
  fineness_modulus?: number;
  strength_class?: string;
  chemical_composition?: any;
  physical_properties?: any;
  quality_standards?: any;
  primary_supplier?: string;
  supplier_code?: string;
  supplier_specifications?: any;
  is_active: boolean;
  plant_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialCategory {
  value: string;
  label: string;
  description: string;
}

export interface MaterialSubcategory {
  value: string;
  label: string;
  category: string;
}

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  {
    value: 'cemento',
    label: 'Cemento',
    description: 'Materiales aglutinantes hidráulicos'
  },
  {
    value: 'agregado',
    label: 'Agregado',
    description: 'Materiales granulares para concreto'
  },
  {
    value: 'aditivo',
    label: 'Aditivo',
    description: 'Materiales para modificar propiedades del concreto'
  },
  {
    value: 'agua',
    label: 'Agua',
    description: 'Agua para mezclado'
  },
  {
    value: 'filler',
    label: 'Filler',
    description: 'Materiales de relleno'
  }
];

export const MATERIAL_SUBCATEGORIES: MaterialSubcategory[] = [
  // Cementos
  { value: 'cemento_portland', label: 'Cemento Portland', category: 'cemento' },
  { value: 'cemento_compuesto', label: 'Cemento Compuesto', category: 'cemento' },
  { value: 'cemento_puzolanico', label: 'Cemento Puzolánico', category: 'cemento' },
  
  // Agregados
  { value: 'agregado_fino', label: 'Agregado Fino', category: 'agregado' },
  { value: 'agregado_grueso', label: 'Agregado Grueso', category: 'agregado' },
  { value: 'agregado_ligero', label: 'Agregado Ligero', category: 'agregado' },
  
  // Aditivos
  { value: 'plastificante', label: 'Plastificante', category: 'aditivo' },
  { value: 'acelerante', label: 'Acelerante', category: 'aditivo' },
  { value: 'retardante', label: 'Retardante', category: 'aditivo' },
  { value: 'superplastificante', label: 'Superplastificante', category: 'aditivo' },
  { value: 'aire_incorporado', label: 'Aire Incorporado', category: 'aditivo' },
  { value: 'impermeabilizante', label: 'Impermeabilizante', category: 'aditivo' },
  
  // Agua
  { value: 'agua_potable', label: 'Agua Potable', category: 'agua' },
  { value: 'agua_tratada', label: 'Agua Tratada', category: 'agua' },
  
  // Fillers
  { value: 'filler_calcareo', label: 'Filler Calcáreo', category: 'filler' },
  { value: 'filler_siliceo', label: 'Filler Silíceo', category: 'filler' }
];

export const UNIT_OF_MEASURE_OPTIONS = [
  { value: 'kg/m³', label: 'kg/m³' },
  { value: 'l/m³', label: 'l/m³' },
  { value: 'kg', label: 'kg' },
  { value: 'l', label: 'l' },
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' }
]; 