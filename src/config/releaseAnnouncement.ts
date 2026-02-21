/**
 * Configuración del anuncio in-app "Novedades de la versión".
 * Persistencia "una vez por versión por usuario" se maneja en DB.
 */

export const RELEASE_ANNOUNCEMENT_VERSION = '2025-02';
export const RELEASE_ANNOUNCEMENT_ALLOWED_VERSIONS = [RELEASE_ANNOUNCEMENT_VERSION] as const;

export type ReleaseAudience =
  | 'EXECUTIVE'
  | 'PLANT_MANAGER'
  | 'ADMIN_OPERATIONS'
  | 'SALES_AGENT'
  | 'EXTERNAL_SALES_AGENT'
  | 'DEFAULT';

const BLOCKS = {
  global: {
    title: 'Novedades de la versión',
    subtitle: 'Un paso adelante en operación, control y experiencia comercial.',
    blocks: [
      {
        title: 'Rediseño visual y navegación',
        items: [
          'Nueva coherencia visual en dashboard, finanzas y menú.',
          'Navegación más clara y menú más limpio.',
          'Mejoras de accesibilidad cuando prefieres menos animación.',
        ],
      },
      {
        title: 'Procurement (PO + Entradas)',
        items: [
          'Mejoras en órdenes de compra, entradas y créditos aplicados a PO.',
          'Mayor trazabilidad y control operativo.',
        ],
      },
      {
        title: 'Productos adicionales',
        items: [
          'Configuración más flexible.',
          'Claridad desde cotización hasta pedido.',
        ],
      },
      {
        title: 'Dashboard de aprobaciones',
        items: [
          'Tareas pendientes en un solo lugar.',
          'Acceso más rápido a revisiones y decisiones.',
        ],
      },
    ],
  },
  executive: {
    emphasis: [
      'Procurement con enfoque ERP corporativo para mayor control de compras, inventario y lotes.',
      'Mayor confiabilidad de datos de PO y Entradas para reporteo ejecutivo y toma de decisiones.',
      'Trazabilidad end-to-end del flujo procurement: compras → registros → validaciones.',
    ],
  },
  commercial: {
    emphasis: [
      'Navegación comercial más centralizada para clientes, cotizaciones y seguimiento.',
      'Productos adicionales como nuevo switch operativo en el proceso comercial: más claridad desde cotización hasta pedido.',
      'Menos fricción para ejecutar tareas clave del día con un flujo más directo.',
    ],
  },
  operations: {
    emphasis: [
      'Fortalecimiento del cálculo de materia prima y asignación por lotes.',
      'Flujo más robusto para operación diaria y control.',
    ],
  },
} as const;

export function getReleaseAnnouncementConfig(role: string | undefined) {
  const audience = resolveAudience(role);
  const global = BLOCKS.global;

  let roleEmphasis: string[] = [];
  if (audience === 'EXECUTIVE') {
    roleEmphasis = BLOCKS.executive.emphasis;
  } else if (audience === 'SALES_AGENT' || audience === 'EXTERNAL_SALES_AGENT') {
    roleEmphasis = BLOCKS.commercial.emphasis;
  } else if (audience === 'PLANT_MANAGER' || audience === 'ADMIN_OPERATIONS') {
    roleEmphasis = BLOCKS.operations.emphasis;
  }

  return {
    title: global.title,
    subtitle: global.subtitle,
    blocks: global.blocks,
    roleEmphasis,
  };
}

function resolveAudience(role: string | undefined): ReleaseAudience {
  if (!role) return 'DEFAULT';
  if (
    role === 'EXECUTIVE' ||
    role === 'PLANT_MANAGER' ||
    role === 'ADMIN_OPERATIONS' ||
    role === 'SALES_AGENT' ||
    role === 'EXTERNAL_SALES_AGENT'
  ) {
    return role as ReleaseAudience;
  }
  return 'DEFAULT';
}
