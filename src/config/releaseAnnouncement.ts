/**
 * Configuración del anuncio in-app "Novedades de la versión".
 * Persistencia "una vez por versión por usuario" se maneja en DB.
 */

export const RELEASE_ANNOUNCEMENT_VERSION = '2026-05';
export const RELEASE_ANNOUNCEMENT_ALLOWED_VERSIONS = [
  /** Legado previo para clientes/cache que aún intentan marcar visto con el slug anterior. */
  '2025-02',
  RELEASE_ANNOUNCEMENT_VERSION,
] as const;

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
    subtitle: 'May 2026: finanzas y proveedor, inventario FIFO, calidad/certificados y mejoras operativas.',
    blocks: [
      {
        title: 'Finanzas y cuentas por pagar (proveedor)',
        items: [
          'Gestión extendida sobre facturas y notas de crédito de proveedor.',
          'Agrupaciones de proveedor y vistas CXP alineadas al flujo de compras.',
        ],
      },
      {
        title: 'Inventario, consumos y compras',
        items: [
          'FIFO consolidado con ledger por material y mejor trazo contable.',
          'Consumos: reportes mejorados por planta, desperdicios Arkik/merma en reporteo.',
          'Auditoría financiera sensible al rol donde aplica.',
        ],
      },
      {
        title: 'Calidad, EMA y certificados',
        items: [
          'Pavimento (pv_promedio) y mejoras en muestreos, moldes e instrumentación.',
          'Certificados y descarga de PDF endurecidos donde aplica.',
        ],
      },
      {
        title: 'Operaciones, RH y cliente',
        items: [
          'Remisiones y reporteo semanal: filtros refinados por planta, tipo de remisión y clientes.',
          'Cumplimiento: mejoras en bomba, checklist pipa y generación PDF de estudios.',
          'Portal cliente: evidencia por pedido/remisión y entrega opcional con coordenadas.',
        ],
      },
    ],
  },
  executive: {
    emphasis: [
      'Cuentas por pagar y trabajo de mayo en finanzas/proveedor: más transparencia hacia cerrar ciclo ERP.',
      'Mayor cobertura de inventario FIFO, consumos y auditoría materiales por planta.',
    ],
  },
  commercial: {
    emphasis: [
      'Portal cliente con evidencia más clara y pedidos mejor documentados.',
      'Menos fricción al coordinar datos de obra y programa de pedidos.',
    ],
  },
  operations: {
    emphasis: [
      'Reportes RR.HH./remisiones con vistas más operables para plantas y filtros efectivos.',
      'Flujo FIFO y auditoría materiales enfocados en trabajo diario y control en planta.',
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
