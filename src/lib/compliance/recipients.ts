/**
 * Email routing for compliance disputes (cotizador user_profiles + static CC chain).
 */

export type PlantOverride = {
  dosificador?: string;
  jefe_planta?: string;
  extra_cc?: string[];
};

export type ComplianceOverridesMap = Record<string, PlantOverride>;

const ENRIQUE = 'enrique.felix@dcconcretos.com.mx';
const RH = 'rh@dcconcretos.com.mx';
const HECTOR = 'hector.morales@dcconcretos.com.mx';
const ALBERTO_BU = 'jose.torres@dcconcretos.com.mx';
/** Mario — operaciones Pitahaya P004P y León P005 (no se usa correo planta5@ en CC fijo). */
const MARIO_WIDE = 'marioperez@dcconcretos.com.mx';

/** Tijuana-area plant codes (no Mario wide CC; Alberto BU covers ops) */
const TIJUANA_PLANTS = new Set(['P002', 'P003', 'P004', 'DIACE']);

/** Same strings as in resolveComplianceRecipients — use in UI as single source of truth. */
export const COMPLIANCE_CANONICAL_CC_EMAILS = {
  albertoBuTijuana: { label: 'Alberto (BU — operaciones Tijuana)', email: ALBERTO_BU },
  enrique: { label: 'Enrique', email: ENRIQUE },
  rh: { label: 'RH', email: RH },
  hector: { label: 'Héctor', email: HECTOR },
  marioOpsP004P_P005: { label: 'Mario (operaciones P004P y P005)', email: MARIO_WIDE },
} as const;

export const COMPLIANCE_TIJUANA_PLANT_CODES = [...TIJUANA_PLANTS].sort() as string[];

/**
 * Human-readable routing matrix (mirrors resolveComplianceRecipients).
 * UI only — do not branch business logic off this text.
 */
export const COMPLIANCE_ROUTING_MATRIX = [
  {
    id: 'para',
    title: 'Para (destinatario principal)',
    plantScope: 'Todas las plantas',
    detail:
      'Roles DOSIFICADOR activos en cotizador para esa planta. Si en la tabla de abajo pones “Extra en Para”, ese correo se une a la lista (sin duplicar). Opcional: mismo dato vía COMPLIANCE_OVERRIDES_JSON en el servidor.',
  },
  {
    id: 'tijuana-cc',
    title: 'CC fijos — región Plaza Tijuana',
    plantScope: COMPLIANCE_TIJUANA_PLANT_CODES.join(', '),
    detail: `Siempre en copia: ${ALBERTO_BU}, ${ENRIQUE}, ${RH}. En esta región no se agrega el Mario “amplio” (${MARIO_WIDE}); Alberto cubre operación.`,
  },
  {
    id: 'resto-cc',
    title: 'CC fijos — Bajío y resto (no Tijuana)',
    plantScope: 'P001, P004P, P005, otras fuera de la lista Tijuana',
    detail: `Base en copia: ${HECTOR}, ${ENRIQUE}, ${RH}. P004P y P005 agregan a Mario (${MARIO_WIDE}) por operaciones; no se usa el correo histórico planta5@ en CC fijo. P001 solo lleva la base (sin Mario salvo extra_cc por planta).`,
  },
] as const;

/** @deprecated Prefer COMPLIANCE_ROUTING_MATRIX + COMPLIANCE_CANONICAL_CC_EMAILS in UI */
export const COMPLIANCE_ROUTING_SUMMARY = [
  {
    title: 'Para (destinatario principal)',
    body: 'Dosificadores activos en cotizador para esa planta, más correos opcionales por planta (abajo o en JSON env).',
  },
  {
    title: 'Copia — Plaza Tijuana (P002, P003, P004, DIACE)',
    body: 'CC fijos: jose.torres@dcconcretos.com.mx (BU), Enrique y RH.',
  },
  {
    title: 'Copia — Resto (Bajío y similares)',
    body: `CC fijos: Héctor, Enrique, RH. P004P y P005 incluyen Mario (${MARIO_WIDE}).`,
  },
] as const;

function unique(emails: (string | undefined | null)[]): string[] {
  const s = new Set<string>();
  for (const e of emails) {
    if (e && e.includes('@')) s.add(e.trim().toLowerCase());
  }
  return [...s];
}

export function parseComplianceOverridesJson(
  raw: string | undefined,
): ComplianceOverridesMap {
  if (!raw?.trim()) return {};
  try {
    const j = JSON.parse(raw) as ComplianceOverridesMap;
    return j && typeof j === 'object' ? j : {};
  } catch {
    return {};
  }
}

/** DB + env merge: per-field override from `db` wins when set. */
export function mergeComplianceOverrides(
  env: ComplianceOverridesMap,
  db: ComplianceOverridesMap,
): ComplianceOverridesMap {
  const codes = new Set([...Object.keys(env), ...Object.keys(db)]);
  const out: ComplianceOverridesMap = {};
  for (const code of codes) {
    const e = env[code] ?? {};
    const d = db[code] ?? {};
    out[code] = {
      dosificador: d.dosificador ?? e.dosificador,
      jefe_planta: d.jefe_planta ?? e.jefe_planta,
      extra_cc: d.extra_cc?.length ? d.extra_cc : e.extra_cc,
    };
  }
  return out;
}

/**
 * Returns To (dosificadores) and CC (escalation). Omits Mario wide for P001 per policy.
 */
export function resolveComplianceRecipients(
  plantCode: string,
  dosificadorEmailsFromDb: string[],
  overrides: ComplianceOverridesMap,
): { to: string[]; cc: string[] } {
  const ov = overrides[plantCode] ?? {};
  const to = unique([
    ov.dosificador,
    ...dosificadorEmailsFromDb.filter((e) => e?.includes('@')),
  ]);

  const cc: string[] = [];

  if (ov.jefe_planta) cc.push(ov.jefe_planta);

  if (TIJUANA_PLANTS.has(plantCode)) {
    cc.push(ALBERTO_BU, ENRIQUE, RH);
  } else {
    cc.push(HECTOR, ENRIQUE, RH);
    if (plantCode === 'P004P' || plantCode === 'P005') {
      cc.push(MARIO_WIDE);
    }
  }

  if (ov.extra_cc?.length) cc.push(...ov.extra_cc);

  const toLower = new Set(to.map((e) => e.toLowerCase()));
  const ccDedup = unique(cc).filter((e) => !toLower.has(e.toLowerCase()));

  return { to, cc: ccDedup };
}
