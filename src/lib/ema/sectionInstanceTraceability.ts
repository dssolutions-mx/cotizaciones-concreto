import type { VerificacionTemplateItem, VerificacionTemplateSection } from '@/types/ema';
import { effectiveLayout } from './sectionLayout';

/**
 * Whether the verification UI should collect or show instance/fila traceability for this section.
 * Evita pedir "código de instancia" en grillas donde no hay vínculo a patrón ni el autor lo exige.
 */
export function sectionRequestsInstrumentGridInstanceCode(
  section: VerificacionTemplateSection & { items?: VerificacionTemplateItem[] },
  instrumentoTipo: string | undefined,
): boolean {
  if (effectiveLayout(section) !== 'instrument_grid') return false;
  if (section.instances_config?.codigo_required === true) return true;
  if (instrumentoTipo === 'C' && (section.items ?? []).some((it) => it.tipo === 'referencia_equipo')) return true;
  return false;
}
