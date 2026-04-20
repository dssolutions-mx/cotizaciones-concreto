'use client';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ReportRemisionData, ReportSummary, ReportColumn } from '@/types/pdf-reports';
import { DC_DOCUMENT_THEME as C, getDocumentContact, DC_DOCUMENT_TYPOGRAPHY as T } from '@/lib/reports/branding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GroupingMode = 'none' | 'order' | 'construction_site';

export interface DeliveryReceiptTemplateConfig {
  columns: ReportColumn[];
  groupBy: GroupingMode;
  showTotalsRow: boolean;
  showIVABreakdown: boolean;
  showGroupSubtotals: boolean;
  orientation: 'landscape' | 'portrait';
  reportTitle: string;
  pageSize: 'A4' | 'LETTER';
  generatedAt: Date;
  dateRangeLabel: string;
  plantName?: string;
  clientNames: string[];
  vatRatePct?: number;
}

interface PDFProps {
  data: ReportRemisionData[];
  summary: ReportSummary;
  config: DeliveryReceiptTemplateConfig;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    fontFamily: T.fontFamilyBody,
    backgroundColor: C.surfacePage,
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 24,
    fontSize: T.sizeTable,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.navy,
    paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'column', gap: 1 },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end', gap: 1 },
  companyName: {
    fontSize: T.sizeH2,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
  },
  companyContact: { fontSize: T.sizeFooter, color: C.textMuted },
  reportTitle: {
    fontSize: T.sizeH2,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
  },
  reportMeta: { fontSize: T.sizeFooter, color: C.textMuted },
  // Meta block (client, period, plant)
  metaBlock: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    backgroundColor: C.surfacePanel,
    padding: 6,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: C.borderLight,
  },
  metaItem: { flexDirection: 'column', flex: 1 },
  metaLabel: { fontSize: T.sizeFooter, color: C.textMuted, textTransform: 'uppercase' },
  metaValue: { fontSize: T.sizeBody, fontFamily: 'Helvetica-Bold', color: C.textPrimary },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.navy,
  },
  tableHeaderCell: {
    paddingVertical: 4,
    paddingHorizontal: 3,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: T.sizeFooter,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.borderLight,
  },
  tableRowAlt: {
    backgroundColor: C.rowAlternate,
  },
  tableCell: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: T.sizeTable,
    color: C.textSecondary,
  },
  tableCellRight: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: T.sizeTable,
    color: C.textSecondary,
    textAlign: 'right',
    fontFamily: 'Courier',
  },
  // Group header
  groupHeader: {
    flexDirection: 'row',
    backgroundColor: C.groupHeaderTint,
    borderTopWidth: 0.5,
    borderTopColor: C.green,
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  groupHeaderText: {
    fontSize: T.sizeTable,
    fontFamily: 'Helvetica-Bold',
    color: C.navyDark,
    flex: 1,
  },
  groupHeaderMeta: {
    fontSize: T.sizeTable,
    color: C.textMuted,
    fontFamily: 'Courier',
  },
  // Subtotal row
  subtotalRow: {
    flexDirection: 'row',
    backgroundColor: C.surfaceTotals,
    borderTopWidth: 0.5,
    borderTopColor: C.borderMedium,
  },
  subtotalCell: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: T.sizeTable,
    fontFamily: 'Courier',
    color: C.textPrimary,
    textAlign: 'right',
  },
  subtotalLabel: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: T.sizeTable,
    fontFamily: 'Helvetica-Bold',
    color: C.textPrimary,
    flex: 1,
  },
  // Totals section
  totalsBlock: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.navy,
    paddingTop: 6,
  },
  totalsTitle: {
    fontSize: T.sizeBody,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
    marginBottom: 4,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
  },
  totalItem: { flexDirection: 'column', alignItems: 'flex-end' },
  totalLabel: { fontSize: T.sizeFooter, color: C.textMuted },
  totalValue: { fontSize: T.sizeBody, fontFamily: 'Courier', color: C.textPrimary },
  totalValueAccent: { fontSize: T.sizeH2, fontFamily: 'Courier', color: C.navy },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: C.borderMedium,
    paddingTop: 4,
  },
  footerText: { fontSize: T.sizeFooter, color: C.textMuted },
  // Accent bar
  accentBar: {
    height: 3,
    backgroundColor: C.green,
    marginBottom: 8,
    borderRadius: 1,
  },
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const fmtCurrency = (v?: number) =>
  v == null ? '' : `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDecimal = (v?: number, d = 2) =>
  v == null ? '' : v.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtDate = (d?: string) => {
  if (!d) return '';
  try { return format(new Date(d + 'T12:00:00'), 'dd/MM/yy'); } catch { return d; }
};

function cellValue(item: ReportRemisionData, col: ReportColumn, rowIndex: number): string {
  switch (col.id) {
    case 'row_number': return String(rowIndex + 1);
    case 'fecha': return fmtDate(item.fecha);
    case 'remision_number': return String(item.remision_number ?? '');
    case 'business_name': return item.client?.business_name ?? '';
    case 'order_number': return String(item.order?.order_number ?? '');
    case 'construction_site': return item.order?.construction_site ?? '';
    case 'elemento': return item.order?.elemento ?? '';
    case 'unidad_cr':
    case 'unidad': return item.unidad ?? '';
    case 'recipe_code': return item.master_code ?? item.recipe?.recipe_code ?? '';
    case 'volumen_fabricado': return fmtDecimal(item.volumen_fabricado);
    case 'unit_price': return fmtCurrency(item.unit_price);
    case 'line_total': return fmtCurrency(item.line_total);
    case 'vat_amount': return fmtCurrency(item.vat_amount);
    case 'final_total': return fmtCurrency(item.final_total);
    case 'conductor': return item.conductor ?? '';
    case 'strength_fc': return item.recipe?.strength_fc ? `${item.recipe.strength_fc} kg` : '';
    case 'placement_type': return item.recipe?.placement_type ?? '';
    case 'slump': return item.recipe?.slump != null ? `${item.recipe.slump} cm` : '';
    case 'requires_invoice': return item.order?.requires_invoice ? 'Sí' : 'No';
    case 'client_rfc': return item.client?.rfc ?? '';
    case 'special_requirements': return item.order?.special_requirements ?? '';
    case 'comentarios_internos': return item.order?.comentarios_internos ?? '';
    case 'arkik_reassignment': return item.arkik_reassignment_note ?? '';
    case 'order_status': return item.order?.order_status ?? '';
    case 'tipo_remision': return item.tipo_remision ?? '';
    case 'recipe_notes': return item.recipe?.notes ?? '';
    case 'age_days': return item.recipe?.age_days != null ? `${item.recipe.age_days}` : '';
    default: return '';
  }
}

function isNumericCol(col: ReportColumn): boolean {
  return col.type === 'currency' || col.type === 'number' || col.format === 'decimal' || col.format === 'currency' || col.format === 'integer';
}

// Distribute widths proportionally from the column widthPercent strings, capped at 100%
function computeColWidths(cols: ReportColumn[]): string[] {
  const raw = cols.map((c) => parseFloat(c.width ?? '8') || 8);
  const total = raw.reduce((s, v) => s + v, 0);
  return raw.map((v) => `${((v / total) * 100).toFixed(1)}%`);
}

// ---------------------------------------------------------------------------
// GroupedData
// ---------------------------------------------------------------------------

interface GroupBlock {
  key: string;
  label: string;
  rows: ReportRemisionData[];
  vol: number;
  subtotal: number;
  vat: number;
  total: number;
}

function groupData(data: ReportRemisionData[], mode: GroupingMode): GroupBlock[] {
  if (mode === 'none') {
    const vol = data.reduce((s, r) => s + r.volumen_fabricado, 0);
    const subtotal = data.reduce((s, r) => s + (r.line_total ?? 0), 0);
    const vat = data.reduce((s, r) => s + (r.vat_amount ?? 0), 0);
    return [{ key: 'all', label: '', rows: data, vol, subtotal, vat, total: subtotal + vat }];
  }

  const map = new Map<string, GroupBlock>();
  for (const r of data) {
    const key =
      mode === 'order'
        ? String(r.order?.order_number ?? r.order_id)
        : (r.order?.construction_site ?? 'Sin Obra');
    const label =
      mode === 'order'
        ? `Pedido ${r.order?.order_number ?? ''} — ${r.order?.construction_site ?? ''}`
        : (r.order?.construction_site ?? 'Sin Obra');
    if (!map.has(key)) map.set(key, { key, label, rows: [], vol: 0, subtotal: 0, vat: 0, total: 0 });
    const g = map.get(key)!;
    g.rows.push(r);
    g.vol += r.volumen_fabricado;
    g.subtotal += r.line_total ?? 0;
    g.vat += r.vat_amount ?? 0;
    g.total += r.final_total ?? 0;
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header({ config }: { config: DeliveryReceiptTemplateConfig }) {
  const contact = getDocumentContact();
  return (
    <View>
      <View style={styles.accentBar} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.companyName}>{contact.companyLine}</Text>
          <Text style={styles.companyContact}>{contact.addressLine}</Text>
          <Text style={styles.companyContact}>{contact.phone} · {contact.email}</Text>
          <Text style={styles.companyContact}>{contact.web}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.reportTitle}>{config.reportTitle}</Text>
          <Text style={styles.reportMeta}>Período: {config.dateRangeLabel}</Text>
          {config.plantName && (
            <Text style={styles.reportMeta}>Planta: {config.plantName}</Text>
          )}
          <Text style={styles.reportMeta}>
            Generado: {format(config.generatedAt, "dd/MM/yyyy HH:mm", { locale: es })}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MetaBlock({ config }: { config: DeliveryReceiptTemplateConfig }) {
  const clientLabel =
    config.clientNames.length === 1
      ? config.clientNames[0]
      : config.clientNames.length > 1
      ? `${config.clientNames.length} clientes`
      : '—';

  return (
    <View style={styles.metaBlock}>
      <View style={styles.metaItem}>
        <Text style={styles.metaLabel}>Cliente</Text>
        <Text style={styles.metaValue}>{clientLabel}</Text>
      </View>
      <View style={styles.metaItem}>
        <Text style={styles.metaLabel}>Período</Text>
        <Text style={styles.metaValue}>{config.dateRangeLabel}</Text>
      </View>
      {config.plantName && (
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Planta</Text>
          <Text style={styles.metaValue}>{config.plantName}</Text>
        </View>
      )}
      {config.vatRatePct != null && (
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>IVA</Text>
          <Text style={styles.metaValue}>{config.vatRatePct}%</Text>
        </View>
      )}
    </View>
  );
}

function TableHeader({
  columns,
  widths,
}: {
  columns: ReportColumn[];
  widths: string[];
}) {
  return (
    <View style={styles.tableHeader} fixed>
      {columns.map((col, i) => (
        <Text
          key={col.id}
          style={[styles.tableHeaderCell, { width: widths[i] }]}
        >
          {col.label}
        </Text>
      ))}
    </View>
  );
}

function DataRow({
  item,
  columns,
  widths,
  index,
}: {
  item: ReportRemisionData;
  columns: ReportColumn[];
  widths: string[];
  index: number;
}) {
  const isAlt = index % 2 === 1;
  return (
    <View style={[styles.tableRow, isAlt ? styles.tableRowAlt : {}]}>
      {columns.map((col, ci) => (
        <Text
          key={col.id}
          style={[
            isNumericCol(col) ? styles.tableCellRight : styles.tableCell,
            { width: widths[ci] },
          ]}
        >
          {cellValue(item, col, index)}
        </Text>
      ))}
    </View>
  );
}

function GroupSubtotalRow({
  group,
  columns,
  widths,
  showIVA,
}: {
  group: GroupBlock;
  columns: ReportColumn[];
  widths: string[];
  showIVA: boolean;
}) {
  return (
    <View style={styles.subtotalRow}>
      {columns.map((col, ci) => {
        let val = '';
        if (ci === 0) val = `Subtotal (${group.rows.length} rem.)`;
        else if (col.id === 'volumen_fabricado') val = fmtDecimal(group.vol);
        else if (col.id === 'line_total') val = fmtCurrency(group.subtotal);
        else if (col.id === 'vat_amount' && showIVA) val = fmtCurrency(group.vat);
        else if (col.id === 'final_total') val = fmtCurrency(group.total);

        const isNum = isNumericCol(col);
        return (
          <Text
            key={col.id}
            style={[
              ci === 0 ? styles.subtotalLabel : isNum ? styles.subtotalCell : styles.subtotalLabel,
              { width: widths[ci] },
            ]}
          >
            {val}
          </Text>
        );
      })}
    </View>
  );
}

function TotalsBlock({
  summary,
  showIVA,
}: {
  summary: ReportSummary;
  showIVA: boolean;
}) {
  return (
    <View style={styles.totalsBlock}>
      <Text style={styles.totalsTitle}>Totales del Reporte</Text>
      <View style={styles.totalsRow}>
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>Remisiones</Text>
          <Text style={styles.totalValue}>{summary.totalRemisiones}</Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>Volumen</Text>
          <Text style={styles.totalValue}>{fmtDecimal(summary.totalVolume)} m³</Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{fmtCurrency(summary.totalAmount)}</Text>
        </View>
        {showIVA && (
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>IVA</Text>
            <Text style={styles.totalValue}>{fmtCurrency(summary.totalVAT)}</Text>
          </View>
        )}
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValueAccent}>{fmtCurrency(summary.finalTotal)}</Text>
        </View>
      </View>
    </View>
  );
}

function Footer({ config }: { config: DeliveryReceiptTemplateConfig }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        {config.reportTitle} · {config.dateRangeLabel}
      </Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DeliveryReceiptPDF({ data, summary, config }: PDFProps) {
  const widths = computeColWidths(config.columns);
  const groups = groupData(data, config.groupBy);
  const showGroupHeaders = config.groupBy !== 'none';
  const orientation = config.orientation === 'landscape' ? 'landscape' : 'portrait';

  let globalRowIndex = 0;

  return (
    <Document title={config.reportTitle} author="DC Concretos" language="es-MX">
      <Page
        size={config.pageSize}
        orientation={orientation}
        style={styles.page}
      >
        <Header config={config} />
        <MetaBlock config={config} />
        <TableHeader columns={config.columns} widths={widths} />

        {groups.map((group) => (
          <View key={group.key}>
            {showGroupHeaders && (
              <View style={styles.groupHeader}>
                <Text style={styles.groupHeaderText}>{group.label}</Text>
                <Text style={styles.groupHeaderMeta}>
                  {group.rows.length} rem. · {fmtDecimal(group.vol)} m³ · {fmtCurrency(group.subtotal)}
                </Text>
              </View>
            )}
            {group.rows.map((item) => {
              const idx = globalRowIndex++;
              return (
                <DataRow
                  key={item.id}
                  item={item}
                  columns={config.columns}
                  widths={widths}
                  index={idx}
                />
              );
            })}
            {showGroupHeaders && config.showGroupSubtotals && (
              <GroupSubtotalRow
                group={group}
                columns={config.columns}
                widths={widths}
                showIVA={config.showIVABreakdown}
              />
            )}
          </View>
        ))}

        {config.showTotalsRow && (
          <TotalsBlock summary={summary} showIVA={config.showIVABreakdown} />
        )}

        <Footer config={config} />
      </Page>
    </Document>
  );
}
