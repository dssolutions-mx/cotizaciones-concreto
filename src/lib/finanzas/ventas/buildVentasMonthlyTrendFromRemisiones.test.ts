/**
 * Run: npx tsx src/lib/finanzas/ventas/buildVentasMonthlyTrendFromRemisiones.test.ts
 */
import assert from 'assert';
import {
  buildMonthlyActiveClientSeries,
  buildMonthlyVentasTrendFromRemisiones,
  buildSparklineRevenueByPlantLastNMonths,
  monthKeyFromRemisionFecha,
} from './buildVentasMonthlyTrendFromRemisiones';

function run() {
  assert.strictEqual(monthKeyFromRemisionFecha('2026-03-05'), '2026-03');

  const order = {
    id: 'o1',
    order_number: 'O-1',
    requires_invoice: false,
    items: [{ id: 'i1', product_type: 'C250', unit_price: 100, volume: 10 }],
  };

  const rem1 = {
    id: 'r1',
    fecha: '2026-01-10',
    order_id: 'o1',
    plant_id: 'p1',
    tipo_remision: 'CONCRETO',
    volumen_fabricado: 5,
    recipe: { recipe_code: 'C250', id: 'rec1' },
  };
  const rem2 = {
    id: 'r2',
    fecha: '2026-01-20',
    order_id: 'o1',
    plant_id: 'p1',
    tipo_remision: 'CONCRETO',
    volumen_fabricado: 5,
    recipe: { recipe_code: 'C250', id: 'rec1' },
  };

  const pricingMap = new Map([
    ['r1', { subtotal_amount: 400, volumen_fabricado: 5 }],
    ['r2', { subtotal_amount: 600, volumen_fabricado: 5 }],
  ]);

  const trend = buildMonthlyVentasTrendFromRemisiones([rem1, rem2], [order], pricingMap, false);
  assert.strictEqual(trend.length, 1);
  assert.strictEqual(trend[0].month, '2026-01');
  assert.strictEqual(trend[0].concreteVolume, 10);
  assert.strictEqual(trend[0].pumpVolume, 0);
  assert.strictEqual(trend[0].revenue, 1000);

  const active = buildMonthlyActiveClientSeries([
    { id: 'a', fecha: '2026-02-01', order: { client_id: 'c1' } },
    { id: 'b', fecha: '2026-02-15', order: { client_id: 'c1' } },
    { id: 'c', fecha: '2026-02-20', order: { client_id: 'c2' } },
  ]);
  assert.deepStrictEqual(active, [{ month: '2026-02', count: 2 }]);

  const remP1 = { ...rem1, id: 'rp1', plant_id: 'plant-a' };
  const remP2 = { ...rem2, id: 'rp2', plant_id: 'plant-b', fecha: '2026-01-12' };
  const spark = buildSparklineRevenueByPlantLastNMonths(
    [remP1, remP2],
    [order],
    new Map([
      ['rp1', { subtotal_amount: 200, volumen_fabricado: 5 }],
      ['rp2', { subtotal_amount: 300, volumen_fabricado: 5 }],
    ]),
    ['plant-a', 'plant-b'],
    false,
    3
  );
  assert.deepStrictEqual(spark['plant-a'], [200]);
  assert.deepStrictEqual(spark['plant-b'], [300]);

  const orderFx = {
    id: 'of',
    order_number: 'O-F',
    requires_invoice: false,
    items: [
      { id: 'ic', product_type: 'C250', unit_price: 50, volume: 20 },
      {
        id: 'ifx',
        product_type: 'PRODUCTO ADICIONAL: Cuota (CUOTA)',
        unit_price: 100,
        volume: 1,
        billing_type: 'PER_ORDER_FIXED',
      },
    ],
  };
  const remJan = {
    id: 'rj',
    fecha: '2026-01-08',
    order_id: 'of',
    plant_id: 'p1',
    tipo_remision: 'CONCRETO',
    volumen_fabricado: 10,
    recipe: { recipe_code: 'C250', id: 'r' },
  };
  const remFeb = {
    id: 'rf',
    fecha: '2026-02-03',
    order_id: 'of',
    plant_id: 'p1',
    tipo_remision: 'CONCRETO',
    volumen_fabricado: 10,
    recipe: { recipe_code: 'C250', id: 'r' },
  };
  const pmFx = new Map([
    ['rj', { subtotal_amount: 500, volumen_fabricado: 10 }],
    ['rf', { subtotal_amount: 500, volumen_fabricado: 10 }],
  ]);
  const trendFx = buildMonthlyVentasTrendFromRemisiones([remJan, remFeb], [orderFx], pmFx, false);
  assert.strictEqual(trendFx.length, 2);
  assert.strictEqual(trendFx[0].revenue, 600, 'PER_ORDER_FIXED additional only in first activity month');
  assert.strictEqual(trendFx[1].revenue, 500);

  console.log('buildVentasMonthlyTrendFromRemisiones tests: OK');
}

run();
