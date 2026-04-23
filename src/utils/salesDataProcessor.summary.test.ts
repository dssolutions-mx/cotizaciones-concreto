/**
 * Run: npx tsx src/utils/salesDataProcessor.summary.test.ts
 */
import assert from 'assert';
import { SalesDataProcessor, Remision, Order } from './salesDataProcessor';

function run() {
  const remision: Remision = {
    id: 'r1',
    remision_number: 'R-1',
    fecha: '2026-01-15',
    tipo_remision: 'CONCRETO',
    volumen_fabricado: 10,
    order_id: 'o-missing',
    recipe: { recipe_code: 'C250', id: 'rec1', strength_fc: 250 },
  };

  const order: Order = {
    id: 'o1',
    order_number: 'O-1',
    requires_invoice: false,
    items: [{ id: 'i1', product_type: 'C250', unit_price: 100, volume: 10 }],
  };

  const withOrder: Remision = { ...remision, order_id: 'o1' };

  const noOrderMetrics = SalesDataProcessor.calculateSummaryMetrics(
    [remision],
    [order],
    [],
    [{ id: 'i1', order_id: 'o1', product_type: 'C250', unit_price: 100, volume: 10 }],
    new Map()
  );
  assert.strictEqual(noOrderMetrics.concreteVolume, 10, 'volume counts without matching order');
  assert.strictEqual(noOrderMetrics.concreteAmount, 0, 'amounts skip when order_id missing from salesData');

  const pricingMap = new Map([
    ['r1', { subtotal_amount: 800, volumen_fabricado: 10 }],
  ]);

  const pairedMetrics = SalesDataProcessor.calculateSummaryMetrics(
    [withOrder],
    [order],
    [],
    [{ id: 'i1', order_id: 'o1', product_type: 'C250', unit_price: 100, volume: 10 }],
    pricingMap
  );
  assert.strictEqual(pairedMetrics.concreteVolume, 10);
  assert.strictEqual(pairedMetrics.concreteAmount, 800, 'pricing map drives amount when paired');
  assert.strictEqual(pairedMetrics.additionalAmount, 0);

  const orderWithAdd = {
    id: 'o2',
    order_number: 'O-2',
    requires_invoice: false,
    items: [
      { id: 'i2', product_type: 'C250', unit_price: 100, volume: 10 },
      {
        id: 'i-add',
        product_type: 'PRODUCTO ADICIONAL: Fibra (FIB01)',
        unit_price: 5,
        volume: 1,
        billing_type: 'PER_M3',
      },
    ],
  } as Order;
  const remAdd: Remision = {
    id: 'r2',
    remision_number: 'R-2',
    fecha: '2026-02-01',
    tipo_remision: 'CONCRETO',
    volumen_fabricado: 10,
    order_id: 'o2',
    recipe: { recipe_code: 'C250', id: 'rec2' },
  };
  const flatAdd = [
    { id: 'i2', order_id: 'o2', product_type: 'C250', unit_price: 100, volume: 10 },
    {
      id: 'i-add',
      order_id: 'o2',
      product_type: 'PRODUCTO ADICIONAL: Fibra (FIB01)',
      unit_price: 5,
      volume: 1,
      billing_type: 'PER_M3',
    },
  ];
  const withAdd = SalesDataProcessor.calculateSummaryMetrics(
    [remAdd],
    [orderWithAdd],
    [],
    flatAdd,
    new Map([['r2', { subtotal_amount: 900, volumen_fabricado: 10 }]])
  );
  assert.strictEqual(withAdd.concreteAmount, 900);
  assert.strictEqual(withAdd.additionalAmount, 50, 'PER_M3 additional = multiplier × remision concrete m³ × unit');
  assert.strictEqual(withAdd.totalAmount, 950);

  console.log('calculateSummaryMetrics fixture tests: OK');
}

run();
