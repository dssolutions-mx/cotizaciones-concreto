import type { PostgrestError } from '@supabase/supabase-js';
import { getBusinessDateString } from '@/lib/client-portal/businessDate';

/** Subset of POST body fields safe to log (no coordinates, no free-text notes). */
export type PortalOrderBodyLogSnapshot = {
  delivery_date?: string;
  delivery_time?: string;
  plant_id?: string;
  construction_site_id?: string;
  construction_site?: string;
  quote_detail_id?: string;
  quote_id?: string | null;
  volume?: number | string;
  requires_invoice?: boolean;
  selected_additional_product_ids?: string[];
  delivery_latitude?: number | string;
  delivery_longitude?: number | string;
};

/**
 * Portal order create — diagnostics for users (reference id) and developers (JSON logs).
 *
 * **Support / user:** share `reference` (e.g. PO-20260602-K7M2P) from the API or UI.
 * **Developer:** in server logs, grep `portal_order_create` and the same reference:
 *   `portal_order_create` → events: create_started, validation_rejected, create_failed, create_succeeded
 */
export const PORTAL_ORDER_LOG_SCOPE = 'portal_order_create';

export type PortalOrderErrorCode =
  | 'VALIDATION_DELIVERY_DATE'
  | 'VALIDATION_ELEMENTO'
  | 'VALIDATION_SITE'
  | 'VALIDATION_QUOTE_DETAIL'
  | 'VALIDATION_VOLUME'
  | 'VALIDATION_PLANT'
  | 'VALIDATION_COORDINATES'
  | 'VALIDATION_QUOTE_MISMATCH'
  | 'FORBIDDEN_SITE'
  | 'FORBIDDEN_PLANT'
  | 'FORBIDDEN_PORTAL_SITE'
  | 'QUOTE_NOT_VALID'
  | 'ORDER_NUMBER_GENERATION'
  | 'ORDER_INSERT_FAILED'
  | 'ORDER_NUMBER_CONFLICT'
  | 'ORDER_ITEM_INSERT_FAILED'
  | 'ADDITIONAL_PRODUCTS_FAILED'
  | 'AMOUNT_UPDATE_FAILED'
  | 'ROLLBACK_FAILED'
  | 'UNEXPECTED';

export type PortalOrderCreateFailure = {
  status: number;
  /** Short message for the end user (Spanish). */
  error: string;
  /** Shareable id, e.g. PO-20260602-K7M2P */
  reference: string;
  code: PortalOrderErrorCode;
};

export type PortalOrderLogContext = {
  reference: string;
  step: string;
  clientId?: string;
  userId?: string;
  orderId?: string | null;
  orderNumber?: string;
  quoteDetailId?: string;
  plantId?: string | null;
  constructionSiteId?: string | null;
};

/** User-visible line appended when support needs to trace the request. */
export function portalOrderSupportLine(reference: string): string {
  return `Referencia de soporte: ${reference}`;
}

export function createPortalOrderReference(): string {
  const datePart = getBusinessDateString().replace(/-/g, '');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `PO-${datePart}-${suffix}`;
}

export function snapshotPortalOrderBody(body: PortalOrderBodyLogSnapshot): Record<string, unknown> {
  return {
    delivery_date: body.delivery_date,
    delivery_time: body.delivery_time,
    plant_id: body.plant_id,
    construction_site_id: body.construction_site_id,
    construction_site: body.construction_site?.trim().slice(0, 120),
    quote_detail_id: body.quote_detail_id,
    quote_id: body.quote_id,
    volume: body.volume,
    requires_invoice: body.requires_invoice,
    additional_count: Array.isArray(body.selected_additional_product_ids)
      ? body.selected_additional_product_ids.length
      : body.selected_additional_product_ids === undefined
        ? 'legacy_all'
        : 0,
    has_delivery_pin: Boolean(
      body.delivery_latitude !== undefined &&
        body.delivery_latitude !== null &&
        body.delivery_latitude !== '' &&
        body.delivery_longitude !== undefined &&
        body.delivery_longitude !== null &&
        body.delivery_longitude !== ''
    ),
  };
}

export function normalizeUnknownError(error: unknown): {
  name: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  stack?: string;
} {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const pg = error as PostgrestError;
    return {
      name: 'PostgrestError',
      message: pg.message,
      code: pg.code,
      details: pg.details ?? undefined,
      hint: pg.hint ?? undefined,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 4).join(' | '),
    };
  }
  return { name: 'Unknown', message: String(error) };
}

type LogLevel = 'info' | 'warn' | 'error';

function writePortalOrderLog(level: LogLevel, event: string, payload: Record<string, unknown>) {
  const line = JSON.stringify({
    scope: PORTAL_ORDER_LOG_SCOPE,
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export function logPortalOrderInfo(
  event: string,
  ctx: PortalOrderLogContext,
  extra?: Record<string, unknown>
) {
  writePortalOrderLog('info', event, { ...ctx, ...extra });
}

export function logPortalOrderWarn(
  event: string,
  ctx: PortalOrderLogContext,
  extra?: Record<string, unknown>
) {
  writePortalOrderLog('warn', event, { ...ctx, ...extra });
}

export function logPortalOrderError(
  event: string,
  ctx: PortalOrderLogContext,
  error: unknown,
  extra?: Record<string, unknown>
) {
  writePortalOrderLog('error', event, {
    ...ctx,
    ...extra,
    error: normalizeUnknownError(error),
  });
}

export function buildPortalOrderFailure(
  reference: string,
  code: PortalOrderErrorCode,
  status: number,
  userMessage: string,
  ctx: PortalOrderLogContext,
  cause?: unknown,
  extra?: Record<string, unknown>
): PortalOrderCreateFailure {
  logPortalOrderError('create_failed', ctx, cause ?? new Error(userMessage), {
    code,
    httpStatus: status,
    userMessage,
    ...extra,
  });
  return {
    status,
    code,
    reference,
    error: userMessage,
  };
}

export function buildPortalOrderValidationFailure(
  reference: string,
  code: PortalOrderErrorCode,
  userMessage: string,
  ctx: PortalOrderLogContext,
  extra?: Record<string, unknown>
): PortalOrderCreateFailure {
  logPortalOrderWarn('validation_rejected', ctx, { code, userMessage, ...extra });
  return {
    status: 400,
    code,
    reference,
    error: userMessage,
  };
}

/** Maps PostgREST / DB errors to a stable code for dashboards and grep. */
export function inferPortalOrderErrorCode(
  error: unknown,
  step: string
): PortalOrderErrorCode {
  const norm = normalizeUnknownError(error);
  if (norm.code === '23505' && String(norm.message).includes('order_number')) {
    return 'ORDER_NUMBER_CONFLICT';
  }
  if (step === 'insert_order') return 'ORDER_INSERT_FAILED';
  if (step === 'insert_order_item') return 'ORDER_ITEM_INSERT_FAILED';
  if (step === 'insert_additional_items') return 'ADDITIONAL_PRODUCTS_FAILED';
  if (step === 'update_amounts') return 'AMOUNT_UPDATE_FAILED';
  if (step === 'generate_order_number') return 'ORDER_NUMBER_GENERATION';
  return 'UNEXPECTED';
}

export function userMessageForPortalOrderCode(
  code: PortalOrderErrorCode,
  err?: unknown
): string {
  switch (code) {
    case 'ORDER_NUMBER_CONFLICT':
      return 'Hubo un conflicto al asignar el número de pedido. Intenta de nuevo en unos segundos.';
    case 'ORDER_INSERT_FAILED':
      return 'No se pudo registrar el pedido en el sistema.';
    case 'ORDER_ITEM_INSERT_FAILED':
      return 'No se pudo guardar el producto del pedido.';
    case 'ADDITIONAL_PRODUCTS_FAILED':
      return 'No se pudieron guardar uno o más productos adicionales.';
    case 'AMOUNT_UPDATE_FAILED':
      return 'El pedido se creó parcialmente pero no se pudieron calcular los montos.';
    case 'ORDER_NUMBER_GENERATION':
      return 'No se pudo generar un número de pedido único.';
    case 'ROLLBACK_FAILED':
      return 'Ocurrió un error y no se pudo limpiar un pedido incompleto. Contacta soporte de inmediato.';
    case 'UNEXPECTED':
    default: {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('productos adicionales') || msg.includes('organización')) {
        return msg;
      }
      return 'No se pudo completar el pedido. No se guardó un pedido incompleto.';
    }
  }
}

export type PortalOrderSubmitError = {
  message: string;
  reference?: string;
  code?: string;
};

export function parsePortalOrderApiError(
  json: unknown,
  fallbackReference?: string
): PortalOrderSubmitError {
  if (!json || typeof json !== 'object') {
    return {
      message: 'No se pudo crear el pedido. Intenta de nuevo.',
      reference: fallbackReference,
    };
  }
  const o = json as Record<string, unknown>;
  const message =
    typeof o.error === 'string' && o.error.trim()
      ? o.error.trim()
      : 'No se pudo crear el pedido.';
  const reference =
    typeof o.reference === 'string'
      ? o.reference
      : fallbackReference;
  return {
    message,
    reference,
    code: typeof o.code === 'string' ? o.code : undefined,
  };
}

/** User-facing block for schedule / modals (message + copyable reference). */
export function formatPortalOrderSubmitErrorDisplay(err: PortalOrderSubmitError): string {
  const lines = [err.message];
  if (err.reference) {
    lines.push('', portalOrderSupportLine(err.reference));
  }
  return lines.join('\n');
}
