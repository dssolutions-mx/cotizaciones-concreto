export const CONCRETE_TYPES = {
  '1': { label: 'LTT', description: 'Losa de Tránsito Temporal' },
  '2': { label: 'CAB', description: 'Cabezal' },
  '3': { label: 'PDF', description: 'Piso de Fábrica' },
  '4': { label: 'COLUMNA', description: 'Columna' },
  '5': { label: 'NTC CLASE 2', description: 'NTC Clase 2 Convencional' },
  '6': { label: 'CONVENCIONAL', description: 'Convencional' },
  '7': { label: 'CAB1', description: 'Cabezal 1' },
  '8': { label: 'CAB LLAVE', description: 'Cabezal Tipo Llave' },
  '9': { label: 'CAB CELOSIA', description: 'Cabezal Celosía' },
  'A': { label: 'ALTA RESISTENCIA', description: 'Alta Resistencia' },
  'B': { label: 'TRABE RM', description: 'Trabe RM' },
  'C': { label: 'AUTO COMPACTABLE', description: 'Auto Compactable' },
  'D': { label: 'TRABE TDN', description: 'Trabe TDN' },
  'E': { label: 'LANZADO', description: 'Concreto Lanzado' },
  'F': { label: 'RESISTENCIA RÁPIDA', description: 'Concreto Resistencia Rápida' },
  'L': { label: 'Pre losa', description: 'Pre losa' },
  'N': { label: 'TRABE NEBRASKA', description: 'Trabe Nebraska' },
  'P': { label: 'PAVIMENTO', description: 'Pavimento' },
  'R': { label: 'RELLENO FLUIDO', description: 'Relleno Fluido' },
  'S': { label: 'AUTOSELLANTE', description: 'Autosellante' },
  'T': { label: 'TRABE TIN', description: 'Trabe TIN' },
  'U': { label: 'TRABE NU', description: 'Trabe NU' },
  'Z': { label: 'ZAPATA ZPC', description: 'Zapata Corrida ZPC' },
} as const;

export type ConcreteTypeCode = keyof typeof CONCRETE_TYPES;

export function getDefaultConcreteTypeForDesignType(designType: 'FC' | 'MR'): ConcreteTypeCode {
  return designType === 'FC' ? '6' : 'P';
}
