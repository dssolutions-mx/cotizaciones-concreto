import { Document, Page, Text, View, StyleSheet, Image, Svg, Path } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PDFReportProps, ReportColumn } from '@/types/pdf-reports';
import { AVAILABLE_COLUMNS } from '@/types/pdf-reports';
import { formatDate } from '@/lib/utils';

// Enhanced styles optimized for report layout with better space management
const styles = StyleSheet.create({
  // Optimized page styles for A4 landscape orientation (more standard)
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: 'white',
    position: 'relative',
    paddingTop: 40,
    paddingBottom: 60,
    paddingLeft: 20,
    paddingRight: 20,
  },
  pageBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topSection: {
    height: 30,
    width: '100%',
    position: 'relative',
    marginBottom: 10,
  },
  darkBluePath: {
    fill: '#1B365D',
  },
  greenPath: {
    fill: '#00A650',
  },
  mainContent: {
    padding: 15,
    paddingTop: 20,
    paddingBottom: 80,
  },
  
  // Header styles (only for first page)
  header: {
    height: 50,
    position: 'relative',
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'white',
  },
  logo: {
    width: 80,
    height: 'auto',
    marginTop: 0,
  },
  documentInfo: {
    textAlign: 'right',
  },
  reportTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  dateSection: {
    marginTop: 8,
    fontSize: 9,
  },
  
  // Client info styles
  clientInfo: {
    marginBottom: 15,
    fontSize: 9,
  },
  clientName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  
  // Report title
  title: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 15,
    fontFamily: 'Helvetica-Bold',
  },
  
  // Filter info section
  filterInfo: {
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 3,
  },
  filterTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  filterItem: {
    fontSize: 8,
    marginBottom: 1,
  },
  
  // Professional table styles for client estimates
  table: {
    marginBottom: 12,
    alignSelf: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#333333',
    borderStyle: 'solid',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1B365D',
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
    borderBottomStyle: 'solid',
    minHeight: 25,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    borderBottomStyle: 'solid',
    paddingVertical: 3,
    paddingHorizontal: 2,
    minHeight: 20,
    alignItems: 'center',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#E8F3EA',
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    borderTopStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    borderBottomStyle: 'solid',
    padding: 5,
    alignItems: 'center',
  },
  groupHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1B365D',
  },
  groupTotalsRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f3f4',
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    borderBottomStyle: 'solid',
    padding: 3,
    alignItems: 'center',
  },
  tableRowAlternate: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    borderBottomStyle: 'solid',
    backgroundColor: '#F8F9FA',
    paddingVertical: 3,
    paddingHorizontal: 2,
    minHeight: 20,
    alignItems: 'center',
  },
  
  // Dynamic column styles (will be calculated based on selected columns)
  columnNarrow: {
    width: '8%',
    textAlign: 'center',
  },
  columnMedium: {
    width: '12%',
    textAlign: 'left',
  },
  columnWide: {
    width: '15%',
    textAlign: 'left',
  },
  columnNumber: {
    width: '10%',
    textAlign: 'right',
  },
  columnCurrency: {
    width: '12%',
    textAlign: 'right',
  },
  
  // Professional text styles for client presentation
  headerText: {
    color: 'white',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  cellText: {
    fontSize: 7,
    color: '#333333',
  },
  cellTextBold: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
  },
  cellTextCenter: {
    fontSize: 7,
    textAlign: 'center',
    color: '#333333',
  },
  cellTextRight: {
    fontSize: 7,
    textAlign: 'right',
    color: '#333333',
  },
  
  // Summary section
  summarySection: {
    marginTop: 15,
    marginBottom: 15,
  },
  summaryTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 3,
    width: '23%',
  },
  summaryCardTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  summaryCardValue: {
    fontSize: 10,
    color: '#1B365D',
  },
  
  // Group summary
  groupSummary: {
    marginTop: 12,
  },
  groupSummaryTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
    backgroundColor: '#f1f3f4',
    padding: 4,
  },
  groupItemText: {
    fontSize: 8,
  },
  
  // Footer styles (only for last page)
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
    backgroundColor: 'white',
  },
  footerContent: {
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
  contactInfo: {
    position: 'absolute',
    bottom: 8,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 15,
    backgroundColor: 'white',
    paddingBottom: 3,
  },
  footerRow: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 3,
  },
  footerText: {
    fontSize: 7,
    color: '#666666',
    marginRight: 2,
  },
  footerIcon: {
    width: 12,
    height: 12,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 10,
  },
  
  // NEW: Professional totals section with visual hierarchy (only at the end)
  grandTotals: {
    marginTop: 20,
    alignSelf: 'flex-end',
    width: '60%',
    borderWidth: 1,
    borderColor: '#1B365D',
    borderStyle: 'solid',
  },
  grandTotalsInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1B365D',
    padding: 6,
    paddingHorizontal: 10,
  },
  grandTotalsLabel: {
    color: 'white',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalsValue: {
    color: 'white',
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  
  // NEW: Enhanced totals with proper visual hierarchy
  totalsSection: {
    marginTop: 10,
    alignSelf: 'flex-end',
    width: '60%',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    marginBottom: 2,
  },
  totalsRowBlue: {
    backgroundColor: '#1B365D',
  },
  totalsRowGreen: {
    backgroundColor: '#00A650',
  },
  totalsLabel: {
    color: 'white',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  totalsValue: {
    color: 'white',
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  totalsValueBold: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
});

// Footer icons (reused from QuotePDF)
const PhoneIcon = () => (
  <Svg style={styles.footerIcon} viewBox="0 0 24 24">
    <Path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1zM19 12h2c0-4.9-4-8.9-9-8.9v2c3.9 0 7 3.1 7 6.9z" fill="#666666"/>
  </Svg>
);

const EmailIcon = () => (
  <Svg style={styles.footerIcon} viewBox="0 0 24 24">
    <Path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#666666"/>
  </Svg>
);

const WebIcon = () => (
  <Svg style={styles.footerIcon} viewBox="0 0 24 24">
    <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="#666666"/>
  </Svg>
);

const LocationIcon = () => (
  <Svg style={styles.footerIcon} viewBox="0 0 24 24">
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#666666"/>
  </Svg>
);

// Page background component (only for first page)
const PageBackground = () => (
  <View style={styles.pageBackground}>
    <Svg style={styles.topSection}>
      <Path d="M0,0 L595,0 L595,30 L0,30 Z" style={styles.darkBluePath} />
      <Path d="M297,0 L595,0 L595,30 L347,30 Z" style={styles.greenPath} />
    </Svg>
  </View>
);

// Footer component (only for last page)
const PageFooter = () => (
  <View style={styles.footer}>
    <View style={styles.footerRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={styles.footerText}>477-129-2394</Text>
        <PhoneIcon />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={styles.footerText}>ventas@dcconcretos.com.mx</Text>
        <EmailIcon />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={styles.footerText}>www.dcconcretos.com.mx</Text>
        <WebIcon />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={styles.footerText}>Carr. Silao-san Felipe km 4.1 cp. 36110</Text>
        <LocationIcon />
      </View>
    </View>
    
    <Svg style={styles.bottomSection}>
      <Path d="M0,0 L595,0 L595,10 L0,10 Z" style={styles.darkBluePath} />
    </Svg>
  </View>
);

const ClientReportPDF = ({ data, configuration, summary, clientInfo, dateRange, generatedAt }: PDFReportProps) => {
  // Enhanced column handling with better layout management
  const MAX_COLUMNS = 11; // Increased to accommodate company standard columns
  const REQUIRED_COLUMN_IDS = ['fecha', 'remision_number']; // Company requirements

  // Validate date range
  if (!dateRange.from || !dateRange.to) {
    throw new Error('Invalid date range provided to PDF component');
  }

  const byId = new Map(AVAILABLE_COLUMNS.map((c) => [c.id, c] as const));

  let initialSelected = configuration.selectedColumns
    .filter((col) => byId.has(col.id))
    .map((col) => ({ ...byId.get(col.id)!, ...col }));

  // Ensure required columns are present (prepend if missing)
  for (const reqId of REQUIRED_COLUMN_IDS) {
    if (!initialSelected.some((c) => c.id === reqId) && byId.has(reqId)) {
      initialSelected.unshift(byId.get(reqId)!);
    }
  }

  // Limit number of columns to prevent overflow
  const limitedColumns = initialSelected.slice(0, MAX_COLUMNS);

  // Smart column width optimization for A4 landscape
  const optimizeColumnWidths = (columns: ReportColumn[]): ReportColumn[] => {
    // Base widths optimized for A4 landscape - more balanced distribution
    const widthMap: Record<string, string> = {
      'fecha': '9%',           // Fecha
      'remision_number': '9%', // Remision
      'business_name': '14%',  // Cliente
      'order_number': '9%',    // N° pedido
      'construction_site': '13%', // OBRA
      'elemento': '11%',       // ELEMENTO
      'unidad_cr': '7%',       // Unidad
      'recipe_code': '12%',    // Producto
      'volumen_fabricado': '7%', // M3
      'unit_price': '10%',     // P.U
      'line_total': '10%',     // Subtotal
      'conductor': '9%',       // Additional columns
      'unidad': '7%'
    };

    return columns.map(col => ({
      ...col,
      width: widthMap[col.id] || '9%'
    }));
  };

  const selectedColumns = optimizeColumnWidths(limitedColumns);

  // Helper function to format values based on column type
  const formatValue = (value: any, column: ReportColumn): string => {
    if (value === null || value === undefined) return '-';

    switch (column.format) {
      case 'date':
        try {
          return formatDate(value, 'dd/MM/yyyy');
        } catch {
          return value?.toString() || '-';
        }
      case 'currency':
        return `$${Number(value).toLocaleString('es-MX', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`;
      case 'decimal':
        return Number(value).toLocaleString('es-MX', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      case 'integer':
        return Math.round(Number(value)).toLocaleString('es-MX');
      default:
        if (typeof value === 'boolean') {
          return value ? 'Sí' : 'No';
        }
        return value?.toString() || '-';
    }
  };

  // Professional column style function with visual segmentation
  const getColumnStyle = (column: ReportColumn) => {
    const baseStyle = {
      width: column.width || '9%',
      paddingVertical: 2,
      paddingHorizontal: 3,
      borderRightWidth: 1,
      borderRightColor: '#D0D0D0',
      borderRightStyle: 'solid' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    };

    switch (column.type) {
      case 'currency':
      case 'number':
        return { ...baseStyle, alignItems: 'flex-end' as const };
      case 'boolean':
        return { ...baseStyle, alignItems: 'center' as const };
      default:
        return { ...baseStyle, alignItems: 'flex-start' as const };
    }
  };

  // Helper function to get value from data using field path
  const getValue = (item: any, fieldPath: string): any => {
    // Handle elemento from orders table - try multiple possible paths
    if (fieldPath === 'order.elemento') {
      return item?.orders?.elemento ?? item?.order?.elemento ?? item?.elemento ?? '-';
    }
    
    return fieldPath.split('.').reduce((obj, key) => obj?.[key], item);
  };

  // Format filter summary for display
  const formatFilterSummary = () => {
    const filters = [];
    
    filters.push(`Período: ${format(dateRange.from!, 'dd/MM/yyyy', { locale: es })} - ${format(dateRange.to!, 'dd/MM/yyyy', { locale: es })}`);
    
    if (configuration.filters.constructionSite && configuration.filters.constructionSite !== 'todos') {
      filters.push(`Obra: ${configuration.filters.constructionSite}`);
    }
    
    if (configuration.filters.recipeCode && configuration.filters.recipeCode !== 'all') {
      filters.push(`Receta: ${configuration.filters.recipeCode}`);
    }
    
    if (configuration.filters.invoiceRequirement && configuration.filters.invoiceRequirement !== 'all') {
      const requirement = configuration.filters.invoiceRequirement === 'with_invoice' ? 'Con factura' : 'Sin factura';
      filters.push(`Facturación: ${requirement}`);
    }

    return filters;
  };
  
  // Build grouped data by order
  type GroupInfo = {
    key: string;
    orderNumber: string;
    elemento?: string;
    constructionSite?: string;
    items: any[];
    totals: { volume: number; amount: number; vat: number; final: number };
  };

  const groups: GroupInfo[] = Object.values(
    data.reduce((acc: Record<string, GroupInfo>, item: any) => {
      const key = item.order_id || item.order?.order_number || 'sin-orden';
      if (!acc[key]) {
        acc[key] = {
          key,
          orderNumber: item.order?.order_number || '-',
          elemento: item.order?.elemento,
          constructionSite: item.order?.construction_site,
          items: [],
          totals: { volume: 0, amount: 0, vat: 0, final: 0 },
        };
      }
      acc[key].items.push(item);
      acc[key].totals.volume += Number(item.volumen_fabricado || 0);
      acc[key].totals.amount += Number(item.line_total || 0);
      acc[key].totals.vat += Number(item.vat_amount || 0);
      const baseAmount = (item.final_total ?? item.line_total) ?? 0;
      const vatAmount = item.vat_amount ?? 0;
      acc[key].totals.final += Number(baseAmount) + Number(vatAmount);
      return acc;
    }, {})
  );

  // Pagination planning: build flat rows with group headers
  type RenderRow = { type: 'group'; group: GroupInfo } | { type: 'data'; item: any } | { type: 'groupTotal'; group: GroupInfo };
  const flattenedRows: RenderRow[] = [];
  groups.forEach((g) => {
    flattenedRows.push({ type: 'group', group: g });
    g.items.forEach((it) => flattenedRows.push({ type: 'data', item: it }));
    flattenedRows.push({ type: 'groupTotal', group: g });
  });

  // Enhanced row capacity per page for A4 landscape
  const firstPageCapacity = 20; // Reduced for better layout
  const nextPageCapacity = 25; // Balanced capacity for subsequent pages

  const pages: RenderRow[][] = [];
  let current: RenderRow[] = [];
  let capacity = firstPageCapacity;
  flattenedRows.forEach((row) => {
    if (current.length >= capacity) {
      pages.push(current);
      current = [];
      capacity = nextPageCapacity;
    }
    current.push(row);
  });
  if (current.length) pages.push(current);

  const renderSummarySection = () => (
    <View style={styles.summarySection}>
      <Text style={styles.summaryTitle}>Resumen General</Text>
      
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>Total Remisiones</Text>
          <Text style={styles.summaryCardValue}>{summary.totalRemisiones}</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>Volumen Total</Text>
          <Text style={styles.summaryCardValue}>{summary.totalVolume.toFixed(2)} m³</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>Monto Total</Text>
          <Text style={styles.summaryCardValue}>
            ${summary.totalAmount.toLocaleString('es-MX', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </Text>
        </View>
        
        {configuration.showVAT && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>IVA Total</Text>
            <Text style={styles.summaryCardValue}>
              ${summary.totalVAT.toLocaleString('es-MX', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </Text>
          </View>
        )}
      </View>

      {/* Recipe breakdown */}
      {Object.keys(summary.groupedByRecipe).length > 0 && (
        <View style={styles.groupSummary}>
          <Text style={styles.groupSummaryTitle}>Resumen por Receta</Text>
          {Object.entries(summary.groupedByRecipe).map(([recipe, stats], index) => (
            <View key={`recipe-${index}-${recipe}`} style={styles.groupItem}>
              <Text style={styles.groupItemText}>{recipe}</Text>
              <Text style={styles.groupItemText}>
                {stats.volume.toFixed(2)} m³ - ${stats.amount.toLocaleString('es-MX', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // NEW: Professional totals section with proper visual hierarchy (only at the end)
  const renderFinalTotals = () => {
    // Get VAT percentage from plant info or default to 16%
    // Database stores VAT as decimal (0.08 for 8%), so multiply by 100 for display
    const vatRateDecimal = clientInfo?.plant_info?.vat_percentage || 0.16;
    const vatPercentage = vatRateDecimal * 100; // Convert to percentage for display
    
    // Recalculate VAT amount based on plant's VAT rate
    const vatAmount = (summary.totalAmount * vatRateDecimal);
    const finalTotal = summary.totalAmount + vatAmount;
    
    return (
      <View style={styles.totalsSection}>
        {/* M3 and Subtotal Row */}
        <View style={[styles.totalsRow, styles.totalsRowBlue]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <Text style={styles.totalsLabel}>M3 Total:</Text>
            <Text style={styles.totalsValue}>{summary.totalVolume.toFixed(2)} m³</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <Text style={styles.totalsLabel}>Subtotal:</Text>
            <Text style={styles.totalsValue}>
              ${summary.totalAmount.toLocaleString('es-MX', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </Text>
          </View>
        </View>
        
        {/* IVA Row */}
        {configuration.showVAT && (
          <View style={[styles.totalsRow, styles.totalsRowBlue]}>
            <Text style={styles.totalsLabel}>IVA ({vatPercentage.toFixed(0)}%):</Text>
            <Text style={styles.totalsValue}>
              ${vatAmount.toLocaleString('es-MX', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </Text>
          </View>
        )}
        
        {/* Final Total Row */}
        <View style={[styles.totalsRow, styles.totalsRowGreen]}>
          <Text style={styles.totalsLabel}>TOTAL:</Text>
          <Text style={styles.totalsValueBold}>
            ${finalTotal.toLocaleString('es-MX', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Document>
      {/* First Page - Header, Summary, and Initial Data */}
      <Page size="A4" style={styles.page} orientation="landscape">
        <PageBackground />
        <View style={styles.mainContent}>
          {/* Header - ONLY on first page */}
          <View style={styles.header}>
            <Image style={styles.logo} src="/images/logo.png" />
            <View style={styles.documentInfo}>
              <Text style={styles.reportTitle}>{configuration.title || 'REPORTE DE ENTREGAS'}</Text>
              <View style={styles.dateSection}>
                <Text>Generado: {format(generatedAt, 'dd/MM/yyyy HH:mm', { locale: es })}</Text>
              </View>
            </View>
          </View>

          {/* Client Info */}
          {clientInfo && (
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{clientInfo.business_name}</Text>
              {clientInfo.name && clientInfo.name !== clientInfo.business_name && (
                <Text>{clientInfo.name}</Text>
              )}
              {clientInfo.rfc && <Text>RFC: {clientInfo.rfc}</Text>}
              {clientInfo.address && <Text>{clientInfo.address}</Text>}
              {clientInfo.plant_info && (
                <Text>Planta: {clientInfo.plant_info.plant_name} ({clientInfo.plant_info.plant_code}) - IVA: {(clientInfo.plant_info.vat_percentage * 100).toFixed(0)}%</Text>
              )}
            </View>
          )}

          {/* Filter Information */}
          <View style={styles.filterInfo}>
            <Text style={styles.filterTitle}>Filtros Aplicados:</Text>
            {formatFilterSummary().map((filter, index) => (
              <Text key={index} style={styles.filterItem}>• {filter}</Text>
            ))}
          </View>

          {/* Summary Section */}
          {configuration.showSummary && renderSummarySection()}

          {/* Data Table */}
          {flattenedRows.length > 0 && (
            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                {selectedColumns.map((column, index) => {
                  const headerStyle = getColumnStyle(column);
                  return (
                    <View 
                      key={`header-${column.id}`} 
                      style={[
                        headerStyle,
                        {
                          borderRightWidth: index === selectedColumns.length - 1 ? 0 : 1,
                          borderRightColor: '#666666',
                          borderRightStyle: 'solid',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }
                      ]}
                    >
                      <Text style={styles.headerText} wrap={false}>{column.label.toUpperCase()}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Table Rows - page 1 */}
              {pages[0]?.map((entry, index) => {
                if (entry.type === 'group') {
                  return (
                    <View key={`g-${index}`} style={styles.groupHeaderRow}>
                      <Text style={styles.groupHeaderText}>Orden: {entry.group.orderNumber}   Obra: {entry.group.constructionSite || '-' }   Elemento: {entry.group.elemento || '-'}</Text>
                    </View>
                  );
                }
                if (entry.type === 'groupTotal') {
                  return (
                    <View key={`gt-${index}`} style={styles.groupTotalsRow}>
                      <View style={{ width: '60%', padding: 1 }}>
                        <Text style={styles.cellTextBold}>Subtotal de orden</Text>
                      </View>
                      <View style={{ width: '20%', padding: 1, textAlign: 'right' }}>
                        <Text style={styles.cellTextBold}>{entry.group.totals.volume.toFixed(2)} m³</Text>
                      </View>
                      <View style={{ width: '20%', padding: 1, textAlign: 'right' }}>
                        <Text style={styles.cellTextBold}>
                          ${Number(entry.group.totals.amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>
                  );
                }
                const item = entry.item;
                return (
                  <View key={`r-${item.id || `idx-${index}`}`} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                    {selectedColumns.map((column, colIndex) => {
                      const value = getValue(item, column.field);
                      const formattedValue = formatValue(value, column);
                      const textStyle = column.type === 'currency' || column.type === 'number' ? 
                        styles.cellTextRight : styles.cellText;
                      
                      const cellStyle = getColumnStyle(column);
                      return (
                        <View 
                          key={`${item.id || index}-${column.id}-${index}`} 
                          style={[
                            cellStyle,
                            {
                              borderRightWidth: colIndex === selectedColumns.length - 1 ? 0 : 1,
                              borderRightColor: '#D0D0D0',
                              borderRightStyle: 'solid',
                            }
                          ]}
                        >
                          <Text style={textStyle}>{formattedValue}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}

          {data.length === 0 && (
            <View style={{ textAlign: 'center', marginTop: 50 }}>
              <Text style={styles.cellText}>No se encontraron datos con los filtros especificados</Text>
            </View>
          )}
        </View>
      </Page>

      {/* Additional pages if data spans multiple pages */}
      {pages.slice(1).map((pageRows, pageIndex) => (
        <Page key={`page-${pageIndex + 1}`} size="A4" style={styles.page} orientation="landscape">
          <View style={styles.mainContent}>
            {/* NO header on continuation pages - cleaner layout */}
            
            {/* Continuation table */}
            <View style={styles.table}>
              {/* Table Header - consistent with first page */}
              <View style={styles.tableHeader}>
                {selectedColumns.map((column, index) => {
                  const headerStyle = getColumnStyle(column);
                  return (
                    <View 
                      key={`header-${pageIndex}-${column.id}`} 
                      style={[
                        headerStyle,
                        {
                          borderRightWidth: index === selectedColumns.length - 1 ? 0 : 1,
                          borderRightColor: '#666666',
                          borderRightStyle: 'solid',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }
                      ]}
                    >
                      <Text style={styles.headerText} wrap={false}>{column.label.toUpperCase()}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Table Rows for this page */}
              {pageRows.map((entry, index) => {
                if (entry.type === 'group') {
                  return (
                    <View key={`pg-${pageIndex}-g-${index}`} style={styles.groupHeaderRow}>
                      <Text style={styles.groupHeaderText}>Orden: {entry.group.orderNumber}   Obra: {entry.group.constructionSite || '-'}   Elemento: {entry.group.elemento || '-'}</Text>
                    </View>
                  );
                }
                if (entry.type === 'groupTotal') {
                  return (
                    <View key={`pg-${pageIndex}-gt-${index}`} style={styles.groupTotalsRow}>
                      <View style={{ width: '60%', padding: 1 }}>
                        <Text style={styles.cellTextBold}>Subtotal de orden</Text>
                      </View>
                      <View style={{ width: '20%', padding: 1, textAlign: 'right' }}>
                        <Text style={styles.cellTextBold}>{entry.group.totals.volume.toFixed(2)} m³</Text>
                      </View>
                      <View style={{ width: '20%', padding: 1, textAlign: 'right' }}>
                        <Text style={styles.cellTextBold}>
                          ${Number(entry.group.totals.amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>
                  );
                }
                const item = entry.item;
                return (
                  <View key={`page-${pageIndex}-row-${item.id || `index-${index}`}-${index}`} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                    {selectedColumns.map((column, colIndex) => {
                      const value = getValue(item, column.field);
                      const formattedValue = formatValue(value, column);
                      const textStyle = column.type === 'currency' || column.type === 'number' ? 
                        styles.cellTextRight : styles.cellText;
                      
                      const cellStyle = getColumnStyle(column);
                      return (
                        <View 
                          key={`page-${pageIndex}-${item.id || index}-${column.id}-${index}`} 
                          style={[
                            cellStyle,
                            {
                              borderRightWidth: colIndex === selectedColumns.length - 1 ? 0 : 1,
                              borderRightColor: '#D0D0D0',
                              borderRightStyle: 'solid',
                            }
                          ]}
                        >
                          <Text style={textStyle}>{formattedValue}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>
        </Page>
      ))}

      {/* Final Page - Totals and Footer */}
      <Page size="A4" style={styles.page} orientation="landscape">
        <PageFooter />
        <View style={styles.mainContent}>
          {/* NO header on final page - removed completely */}
          
          {/* Final totals section with proper visual hierarchy - positioned closer to top */}
          {configuration.showSummary && renderFinalTotals()}
        </View>
      </Page>
    </Document>
  );
};

export default ClientReportPDF;
