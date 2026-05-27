import type { LaboratorioLoteStatus } from '@/types/laboratorioLote';

export type ExperimentoWorkflowStep = 'mezcla' | 'muestreo' | 'ensayos' | 'evaluacion';

export function workflowStepFromStatus(status: LaboratorioLoteStatus): ExperimentoWorkflowStep {
  switch (status) {
    case 'borrador':
      return 'mezcla';
    case 'muestreado':
      return 'ensayos';
    case 'cerrado':
      return 'evaluacion';
    case 'evaluado':
      return 'evaluacion';
    default:
      return 'mezcla';
  }
}

export function nextStepHint(
  status: LaboratorioLoteStatus,
  hasMuestreo: boolean
): string {
  if (status === 'borrador') return hasMuestreo ? 'Revisar muestreo' : 'Planificar muestras';
  if (status === 'muestreado') return 'Registrar ensayos';
  if (status === 'cerrado') return 'Registrar conclusión';
  if (status === 'evaluado') return 'Protocolo cerrado';
  return '—';
}
