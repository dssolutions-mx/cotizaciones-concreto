/**
 * Portal order creation helpers (no DB).
 * Run: npx tsx tests/security/portal-order-creation.test.ts
 */
import assert from 'node:assert';
import {
  computeInvoiceAmount,
  computePreliminarySubtotal,
  isConcreteOrderItem,
  parseValidConstructionSiteId,
  sumConcreteVolumeFromItems,
} from '../../src/lib/client-portal/portalOrderCreation';
import {
  getBusinessDateString,
  isDeliveryDateBeforeBusinessToday,
} from '../../src/lib/client-portal/businessDate';
import {
  createPortalOrderReference,
  inferPortalOrderErrorCode,
  parsePortalOrderApiError,
  portalOrderSupportLine,
} from '../../src/lib/client-portal/portalOrderDiagnostics';

assert.match(createPortalOrderReference(), /^PO-\d{8}-[A-Z2-9]{5}$/);
assert.ok(portalOrderSupportLine('PO-20260101-ABC12').includes('PO-20260101-ABC12'));

const parsed = parsePortalOrderApiError({
  error: 'El volumen debe ser mayor a cero.',
  reference: 'PO-20260101-XYZ99',
  code: 'VALIDATION_VOLUME',
});
assert.strictEqual(parsed.message, 'El volumen debe ser mayor a cero.');
assert.strictEqual(parsed.reference, 'PO-20260101-XYZ99');
assert.strictEqual(parsed.code, 'VALIDATION_VOLUME');

assert.strictEqual(
  inferPortalOrderErrorCode({ code: '23505', message: 'duplicate order_number' }, 'insert_order'),
  'ORDER_NUMBER_CONFLICT'
);

assert.strictEqual(parseValidConstructionSiteId('not-a-uuid'), null);
assert.strictEqual(
  parseValidConstructionSiteId('a1b2c3d4-e5f6-4789-a012-3456789abcde'),
  'a1b2c3d4-e5f6-4789-a012-3456789abcde'
);

assert.strictEqual(isConcreteOrderItem('CONCRETO'), true);
assert.strictEqual(isConcreteOrderItem('PRODUCTO ADICIONAL: Fibra (FIB)'), false);

const items = [
  { product_type: 'CONCRETO', volume: 10 },
  { product_type: 'PRODUCTO ADICIONAL: X (Y)', volume: 1 },
];
assert.strictEqual(sumConcreteVolumeFromItems(items), 10);

assert.strictEqual(computePreliminarySubtotal(1000, 250.555), 1250.56);
assert.strictEqual(computeInvoiceAmount(1000, false), 1000);
assert.strictEqual(computeInvoiceAmount(1000, true, 0.16), 1160);

const today = getBusinessDateString();
assert.strictEqual(isDeliveryDateBeforeBusinessToday(today), false);
assert.strictEqual(isDeliveryDateBeforeBusinessToday('1999-01-01'), true);

console.log('portal-order-creation tests: ok');
