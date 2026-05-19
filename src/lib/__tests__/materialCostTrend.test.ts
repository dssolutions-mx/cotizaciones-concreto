import assert from 'node:assert';
import {
  aggregateReceiptEntries,
  buildPriceJustification,
  entriesToExceptionRows,
  expandReceiptBucketsWithCarryForward,
  isEligibleReceiptForCost,
  materialNeedsAttention,
  summarizeSeries,
  type MaterialEntryRaw,
} from '../materialCostTrend';

const baseEntry = (overrides: Partial<MaterialEntryRaw>): MaterialEntryRaw => ({
  id: 'e1',
  material_id: 'm1',
  entry_number: 'ENT-1',
  entry_date: '2026-05-10',
  landed_unit_price: 3.5,
  received_qty_kg: 1000,
  quantity_received: null,
  excluded_from_fifo: false,
  pricing_status: 'reviewed',
  ...overrides,
});

{
  const entries = [
    baseEntry({ id: 'a', landed_unit_price: 4, received_qty_kg: 1000, entry_date: '2026-05-05' }),
    baseEntry({ id: 'b', landed_unit_price: 2, received_qty_kg: 1000, entry_date: '2026-05-06' }),
  ];
  const { buckets } = aggregateReceiptEntries(entries, 'week', '2026-05-01', '2026-05-31');
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].avgPricePerKg, 3);
  assert.equal(buckets[0].receiptCount, 2);
}

{
  const entries = [
    baseEntry({ pricing_status: 'pending' }),
    baseEntry({ id: 'x', pricing_status: 'reviewed', landed_unit_price: null }),
  ];
  const stats = aggregateReceiptEntries(entries, 'week', '2026-05-01', '2026-05-31');
  assert.equal(stats.pendingReviewCount, 1);
  assert.equal(stats.missingLandedCount, 1);
  assert.equal(stats.buckets.length, 0);
}

{
  const actual = [
    {
      periodStart: '2026-05-05',
      granularity: 'week' as const,
      source: 'receipt' as const,
      avgPricePerKg: 3,
      receiptCount: 1,
    },
  ];
  const expanded = expandReceiptBucketsWithCarryForward(actual, 'week', '2026-05-19');
  assert.ok(expanded.length > 1);
  assert.ok(expanded.some((p) => p.carriedForward));
}

{
  const series = [
    {
      periodStart: '2026-04-01',
      granularity: 'week' as const,
      source: 'receipt' as const,
      avgPricePerKg: 2,
    },
    {
      periodStart: '2026-04-08',
      granularity: 'week' as const,
      source: 'receipt' as const,
      avgPricePerKg: 2.5,
      receiptCount: 1,
    },
  ];
  const summary = summarizeSeries(series);
  assert.equal(summary.hasAlert, true);
  assert.equal(summary.pctChange, 25);
}

{
  const summary = summarizeSeries([
    {
      periodStart: '2026-05-05',
      granularity: 'week' as const,
      source: 'receipt' as const,
      avgPricePerKg: 3.25,
      receiptCount: 2,
      totalQtyKg: 5000,
      minPrice: 3,
      maxPrice: 3.5,
    },
  ]);
  const j = buildPriceJustification(summary, {
    periodStart: '2026-05-05',
    granularity: 'week',
    source: 'receipt',
    avgPricePerKg: 3.25,
    receiptCount: 2,
    totalQtyKg: 5000,
    minPrice: 3,
    maxPrice: 3.5,
  });
  assert.ok(j?.formula.includes('Σ'));
  assert.ok(j?.bullets.some((b) => b.includes('5000 kg')));
}

{
  const rows = entriesToExceptionRows(
    [
      baseEntry({ id: 'p', pricing_status: 'pending' }),
      baseEntry({ id: 'l', landed_unit_price: null }),
      baseEntry({ id: 'x', excluded_from_fifo: true }),
    ],
    '2026-05-01',
    '2026-05-31'
  );
  const issues = rows.map((r) => r.issue).sort();
  assert.deepEqual(issues, ['excluded_fifo', 'missing_landed', 'pending_review']);
}

assert.equal(materialNeedsAttention({ hasAlert: true }), true);
assert.equal(materialNeedsAttention({ pendingReviewInPeriod: 2 }), true);
assert.equal(
  materialNeedsAttention({
    lastSource: 'receipt',
    lastCarriedForward: true,
    receiptCountInPeriod: 0,
  }),
  true
);
assert.equal(materialNeedsAttention({}), false);

assert.equal(isEligibleReceiptForCost(baseEntry({})), true);
assert.equal(isEligibleReceiptForCost(baseEntry({ pricing_status: 'pending' })), false);

console.log('materialCostTrend.test.ts: ok');
