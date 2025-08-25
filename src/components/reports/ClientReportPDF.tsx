import { Document, Page, Text, View, StyleSheet, Image, Svg, Path } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PDFReportProps, ReportColumn } from '@/types/pdf-reports';
import { AVAILABLE_COLUMNS } from '@/types/pdf-reports';

// Enhanced styles optimized for report layout with better space management
const styles = StyleSheet.create({
  // Optimized page styles for landscape orientation
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: 'white',
    position: 'relative',
    paddingTop: 60,
    paddingBottom: 80,
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
    height: 40,
    width: '100%',
    position: 'relative',
    marginBottom: 15,
  },
  darkBluePath: {
    fill: '#1B365D',
  },
  greenPath: {
    fill: '#00A650',
  },
  mainContent: {
    padding: 15, // Reduced padding for more content space
    paddingTop: 25,
    paddingBottom: 100,
  },
  
  // Header styles (adapted from QuotePDF)
  header: {
    height: 60,
    position: 'relative',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'white',
  },
  logo: {
    width: 100,
    height: 'auto',
    marginTop: 0,
  },
  documentInfo: {
    textAlign: 'right',
  },
  reportTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  dateSection: {
    marginTop: 10,
    fontSize: 10,
  },
  
  // Client info styles
  clientInfo: {
    marginBottom: 20,
    fontSize: 10,
  },
  clientName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  },
  
  // Report title
  title: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Helvetica-Bold',
  },
  
  // Filter info section
  filterInfo: {
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 4,
  },
  filterTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  },
  filterItem: {
    fontSize: 9,
    marginBottom: 2,
  },
  
  // Professional table styles for client estimates
  table: {
    marginBottom: 15,
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
    minHeight: 28,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    borderBottomStyle: 'solid',
    paddingVertical: 4,
    paddingHorizontal: 2,
    minHeight: 22,
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
    padding: 6,
    alignItems: 'center',
  },
  groupHeaderText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1B365D',
  },
  groupTotalsRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f3f4',
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    borderBottomStyle: 'solid',
    padding: 4,
    alignItems: 'center',
  },
  tableRowAlternate: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    borderBottomStyle: 'solid',
    backgroundColor: '#F8F9FA',
    paddingVertical: 4,
    paddingHorizontal: 2,
    minHeight: 22,
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
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  cellText: {
    fontSize: 8,
    color: '#333333',
  },
  cellTextBold: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
  },
  cellTextCenter: {
    fontSize: 8,
    textAlign: 'center',
    color: '#333333',
  },
  cellTextRight: {
    fontSize: 8,
    textAlign: 'right',
    color: '#333333',
  },
  
  // Summary section
  summarySection: {
    marginTop: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 4,
    width: '23%',
  },
  summaryCardTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  summaryCardValue: {
    fontSize: 11,
    color: '#1B365D',
  },
  
  // Group summary
  groupSummary: {
    marginTop: 15,
  },
  groupSummaryTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
    backgroundColor: '#f1f3f4',
    padding: 5,
  },
  groupItemText: {
    fontSize: 9,
  },
  
  // Footer styles (from QuotePDF)
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    backgroundColor: 'white',
  },
  footerContent: {
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    borderTopStyle: 'solid',
    paddingTop: 10,
  },
  contactInfo: {
    position: 'absolute',
    bottom: 12,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 20,
    backgroundColor: 'white',
    paddingBottom: 4,
  },
  footerRow: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  footerText: {
    fontSize: 8,
    color: '#666666',
    marginRight: 3,
  },
  footerIcon: {
    width: 14,
    height: 14,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 12,
  },
  grandTotals: {
    marginTop: 10,
    alignSelf: 'center',
    width: '95%',
    backgroundColor: '#1B365D',
    padding: 8,
  },
  grandTotalsInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f2b49',
    padding: 8,
  },
  grandTotalsLabel: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalsValue: {
    color: 'white',
    fontSize: 10,
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

// Page background component (reused from QuotePDF)
const PageBackground = () => (
  <View style={styles.pageBackground}>
    <Svg style={styles.topSection}>
      <Path d="M0,0 L595,0 L595,40 L0,40 Z" style={styles.darkBluePath} />
      <Path d="M297,0 L595,0 L595,40 L347,40 Z" style={styles.greenPath} />
    </Svg>

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
    </View>

    <Svg style={styles.bottomSection}>
      <Path d="M0,0 L595,0 L595,12 L0,12 Z" style={styles.darkBluePath} />
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

  // Smart column width optimization based on content type
  const optimizeColumnWidths = (columns: ReportColumn[]): ReportColumn[] => {
    // Base widths optimized for landscape A4 - professional client estimate layout
    const widthMap: Record<string, string> = {
      'fecha': '9%',           // Fecha
      'remision_number': '9%', // Remision
      'business_name': '14%',  // Cliente
      'order_number': '9%',    // N° pedido
      'construction_site': '13%', // OBRA
      'elemento': '11%',       // ELEMENTO
      'unidad_cr': '7%',       // Unidad
      'recipe_code': '11%',    // Producto
      'volumen_fabricado': '7%', // M3
      'unit_price': '9%',      // P.U
      'line_total': '9%',      // Subtotal
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
          return format(new Date(value), 'dd/MM/yyyy', { locale: es });
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
      paddingVertical: 3,
      paddingHorizontal: 4,
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

  // Enhanced row capacity per page with better space utilization
  const firstPageCapacity = 20; // Increased capacity with optimized layout
  const nextPageCapacity = 28; // More rows on subsequent pages

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

  // Grand totals from summary
  const grandTotals = {
    volume: summary.totalVolume,
    subtotal: summary.totalAmount,
    vat: configuration.showVAT ? summary.totalVAT : 0,
    total: configuration.showVAT ? summary.totalAmount + summary.totalVAT : summary.totalAmount,
  };

  return (
    <Document>
      {/* First Page - Header, Summary, and Initial Data */}
      <Page size="A4" style={styles.page} orientation="landscape">
        <PageBackground />
        <View style={styles.mainContent}>
          {/* Header */}
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
                  <Text style={styles.headerText}>{column.label.toUpperCase()}</Text>
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
                  
                  {/* Summary Row if enabled */}
                  {configuration.showSummary && (
            <View style={styles.tableRow}>
              <View style={{ width: '60%', padding: 1 }}>
                <Text style={styles.cellTextBold}>TOTALES:</Text>
                      </View>
              <View style={{ width: '20%', padding: 1, textAlign: 'right' }}>
                <Text style={styles.cellTextBold}>{summary.totalVolume.toFixed(2)} m³</Text>
                      </View>
              <View style={{ width: '20%', padding: 1, textAlign: 'right' }}>
                <Text style={styles.cellTextBold}>
                          ${summary.totalAmount.toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </Text>
                      </View>
                    </View>
              )}
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
          <PageBackground />
          <View style={styles.mainContent}>
            {/* Simplified header for continuation pages */}
            <View style={styles.header}>
              <Image style={styles.logo} src="/images/logo.png" />
              <View style={styles.documentInfo}>
                <Text style={styles.reportTitle}>
                  {configuration.title || 'REPORTE DE ENTREGAS'} - Página {pageIndex + 2}
                </Text>
                <Text style={styles.dateSection}>
                  {clientInfo?.business_name}
                </Text>
              </View>
            </View>

            {/* Continuation table */}
            <View style={styles.table}>
              {/* Table Header */}
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
                      <Text style={styles.headerText}>{column.label.toUpperCase()}</Text>
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

            {/* Grand totals only on the last page of multipage reports */}
            {pages.length > 1 && pageIndex === pages.length - 2 && (
              <View style={styles.grandTotals}>
                <View style={styles.grandTotalsInner}>
                  <Text style={styles.grandTotalsLabel}>M3</Text>
                  <Text style={styles.grandTotalsValue}>{grandTotals.volume.toFixed(2)}</Text>
                  <Text style={styles.grandTotalsLabel}>Sub Total</Text>
                  <Text style={styles.grandTotalsValue}>
                    ${grandTotals.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  {configuration.showVAT && (
                    <>
                      <Text style={styles.grandTotalsLabel}>IVA</Text>
                      <Text style={styles.grandTotalsValue}>
                        ${grandTotals.vat.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </>
                  )}
                  <Text style={styles.grandTotalsLabel}>Total</Text>
                  <Text style={styles.grandTotalsValue}>
                    ${grandTotals.total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
            </View>
              </View>
            )}
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default ClientReportPDF;
