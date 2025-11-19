import { Document, Page, Text, View, StyleSheet, Image, Svg, Path, Line, Rect, Circle } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Modern card-based styles matching the reference image
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: 'white',
    padding: 20,
    fontSize: 8,
  },
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#0C1F28',
  },
  logo: {
    width: 80,
    height: 'auto',
  },
  titleSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  mainTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0C1F28',
    textAlign: 'center',
    marginBottom: 4,
  },
  normasText: {
    fontSize: 6,
    color: '#666666',
    textAlign: 'center',
  },
  // Metadata grid
  metadataGrid: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metadataRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metadataCell: {
    flex: 1,
    flexDirection: 'row',
  },
  metadataLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#4B5563',
    marginRight: 3,
  },
  metadataValue: {
    fontSize: 7,
    color: '#1F2937',
  },
  // Two-column layout
  twoColumnContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  leftColumn: {
    width: '48%',
  },
  rightColumn: {
    width: '48%',
  },
  // Card styles
  card: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    backgroundColor: 'white',
  },
  cardHeader: {
    backgroundColor: '#0C1F28',
    padding: 6,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  cardHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: 'white',
  },
  cardBody: {
    padding: 6,
  },
  // Table styles for granulometry
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    paddingVertical: 3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 2,
  },
  tableHeaderCell: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    textAlign: 'center',
  },
  tableCell: {
    fontSize: 6,
    color: '#1F2937',
    textAlign: 'center',
  },
  tableCellBold: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: '#0C1F28',
    textAlign: 'center',
  },
  // Column widths for granulometry table
  colMalla: { width: '20%' },
  colRetenido: { width: '20%' },
  colPorcentaje: { width: '15%' },
  colAcumulado: { width: '20%' },
  colPasa: { width: '25%' },
  // Formula styles
  formulaBox: {
    backgroundColor: '#F9FAFB',
    padding: 5,
    borderRadius: 3,
    marginVertical: 3,
  },
  formulaText: {
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: '#1F2937',
    marginBottom: 2,
  },
  formulaBold: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#0C1F28',
  },
  formulaResult: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#069E2D',
    marginTop: 3,
  },
  // Variable legend
  variableLegend: {
    fontSize: 6,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 1.3,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#6B7280',
  },
  // Graph container
  graphContainer: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    padding: 8,
    backgroundColor: 'white',
  },
  graphTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0C1F28',
    marginBottom: 6,
    textAlign: 'center',
  },
});

interface MallaData {
  numero_malla: string;
  abertura_mm: number;
  peso_retenido: number | null;
  porcentaje_retenido: number;
  porcentaje_acumulado: number;
  porcentaje_pasa: number;
}

interface EstudioData {
  alta_estudio: {
    id: string;
    tipo_material: 'Arena' | 'Grava';
    mina_procedencia: string;
    ubicacion?: string;
    nombre_material: string;
    tecnico: string;
    fecha_elaboracion: string;
    fecha_muestreo?: string;
    numero_arena?: number;
    cliente?: string;
    planta?: string;
    tipo_estudio?: string[];
    origen_material?: string;
  };
  estudios: Array<{
    id: string;
    alta_estudio_id: string;
    tipo_estudio: string;
    nombre_estudio: string;
    descripcion?: string;
    norma_referencia?: string;
    estado: string;
    fecha_programada?: string;
    fecha_completado?: string;
    resultados?: any;
    observaciones?: string;
  }>;
  limites?: Array<{
    malla: string;
    limite_inferior: number;
    limite_superior: number;
  }>;
  tamaño?: string;
}

interface EstudioPDFProps {
  estudio: EstudioData;
}

// Helper component for rendering formulas
const FormulaDisplay = ({ label, formula, result }: { label?: string; formula: string; result: string }) => (
  <View style={styles.formulaBox}>
    {label && <Text style={styles.formulaText}>{label}</Text>}
    <Text style={styles.formulaBold}>{formula}</Text>
    <Text style={styles.formulaResult}>{result}</Text>
  </View>
);

// SVG Granulometric Curve Chart Component
const GranulometricCurveChart = ({ 
  mallas, 
  limites,
  tipoMaterial 
}: { 
  mallas: MallaData[]; 
  limites?: Array<{ malla: string; limite_inferior: number; limite_superior: number }>;
  tipoMaterial?: 'Arena' | 'Grava';
}) => {
  const width = 240;
  const height = 180;
  const padding = { top: 15, right: 15, bottom: 30, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // **DYNAMIC APPROACH**: Use only mallas that have actual data (same as web version)
  // Filter mallas: exclude Fondo and mallas without data
  const mallasFiltradas = mallas.filter(m => {
    if (m.numero_malla === 'Fondo' || m.abertura_mm <= 0) return false;
    if (m.peso_retenido === null || m.peso_retenido === undefined) return false;
    return true;
  });

  // Create limits map by abertura_mm (more reliable than malla name)
  const limitesMap = new Map<number, { inferior: number; superior: number }>();
  if (limites && limites.length > 0) {
    // Comprehensive mapping of all possible malla name variations to abertura_mm
    const mallaToNumber: Record<string, number> = {
      // Pulgadas grandes
      '3"': 75.0, '3': 75.0, '3in': 75.0,
      '2 1/2"': 63.0, '2 1/2': 63.0, '21/2': 63.0, '2.5': 63.0,
      '2"': 50.0, '2': 50.0, '2in': 50.0,
      '1 1/2"': 37.5, '1 1/2': 37.5, '11/2': 37.5, '1.5': 37.5,
      '1"': 25.0, '1': 25.0, '1in': 25.0,
      '3/4"': 19.0, '3/4': 19.0, '.75': 19.0, '0.75': 19.0,
      '1/2"': 12.5, '1/2': 12.5, '.5': 12.5, '0.5': 12.5,
      '3/8"': 9.5, '3/8': 9.5, '.375': 9.5, '0.375': 9.5,
      // Números de malla
      'No. 4': 4.75, 'No.4': 4.75, '4': 4.75, '#4': 4.75,
      'No. 8': 2.36, 'No.8': 2.36, '8': 2.36, '#8': 2.36,
      'No. 16': 1.18, 'No.16': 1.18, '16': 1.18, '#16': 1.18,
      'No. 30': 0.60, 'No.30': 0.60, '30': 0.60, '#30': 0.60,
      'No. 50': 0.30, 'No.50': 0.30, '50': 0.30, '#50': 0.30,
      'No. 100': 0.15, 'No.100': 0.15, '100': 0.15, '#100': 0.15,
      'No. 200': 0.075, 'No.200': 0.075, '200': 0.075, '#200': 0.075,
    };
    
    limites.forEach(limite => {
      // Try direct lookup first
      let abertura = mallaToNumber[limite.malla];
      
      // If not found, try without quotes
      if (!abertura) {
        abertura = mallaToNumber[limite.malla.replace(/"/g, '')];
      }
      
      // If still not found, try normalizing spaces
      if (!abertura) {
        const normalized = limite.malla.replace(/\s+/g, '').replace(/"/g, '');
        abertura = mallaToNumber[normalized];
      }
      
      // Only add to map if we found a valid abertura
      if (abertura) {
        limitesMap.set(abertura, {
          inferior: limite.limite_inferior,
          superior: limite.limite_superior
        });
      }
    });
  }

  // Build chart data - ALWAYS include data, limits are optional
  type ChartDataPoint = {
    abertura: number;
    malla: string;
    porcentaje_pasa?: number;
    limite_inferior?: number;
    limite_superior?: number;
  };

  const chartData: ChartDataPoint[] = mallasFiltradas.map(malla => ({
    abertura: malla.abertura_mm,
    malla: malla.numero_malla,
    porcentaje_pasa: malla.porcentaje_pasa,
    limite_inferior: limitesMap.get(malla.abertura_mm)?.inferior,
    limite_superior: limitesMap.get(malla.abertura_mm)?.superior
  })).sort((a, b) => b.abertura - a.abertura); // Sort by abertura descending

  // Determine if we have any limits at all
  const hasAnyLimits = chartData.some(d => 
    d.limite_inferior !== undefined || d.limite_superior !== undefined
  );

  // Add extension points ONLY if we have limits
  let datosGrafica: ChartDataPoint[] = [...chartData];
  if (hasAnyLimits && chartData.length > 0) {
    const aberturaMaxima = chartData[0].abertura;
    const aberturaMinima = chartData[chartData.length - 1].abertura;
    
    // Find max and min limits to determine extension points
    const limitValues = chartData
      .filter(d => d.limite_inferior !== undefined || d.limite_superior !== undefined)
      .flatMap(d => [d.limite_inferior, d.limite_superior])
      .filter((v): v is number => v !== undefined);
    
    if (limitValues.length > 0) {
      datosGrafica.unshift({
        abertura: aberturaMaxima * 1.5,
        malla: '',
        porcentaje_pasa: undefined,
        limite_inferior: 100,
        limite_superior: 100
      });
      
      datosGrafica.push({
        abertura: aberturaMinima * 0.5,
        malla: '',
        porcentaje_pasa: undefined,
        limite_inferior: 0,
        limite_superior: 0
      });
    }
  }

  // X-axis positioning (index-based, evenly spaced)
  const getXPosition = (index: number) => {
    if (datosGrafica.length <= 1) {
      return padding.left + chartWidth / 2; // Center single point
    }
    const step = chartWidth / (datosGrafica.length - 1);
    return padding.left + (index * step);
  };

  // Y-axis positioning (0-100%)
  const getYPosition = (percentage: number) => {
    return padding.top + chartHeight - (percentage / 100) * chartHeight;
  };

  // Generate path for actual data (only where porcentaje_pasa is defined)
  const generateDataPath = () => {
    const points: { x: number; y: number }[] = [];
    
    datosGrafica.forEach((dato, index) => {
      if (dato.porcentaje_pasa !== undefined) {
        points.push({ 
          x: getXPosition(index), 
          y: getYPosition(dato.porcentaje_pasa) 
        });
      }
    });
    
    if (points.length === 0) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  // Generate path for upper or lower limit
  const generateLimitPath = (isUpper: boolean) => {
    const points: { x: number; y: number }[] = [];
    
    datosGrafica.forEach((dato, index) => {
      const value = isUpper ? dato.limite_superior : dato.limite_inferior;
      if (value !== undefined && value !== null) {
        points.push({ x: getXPosition(index), y: getYPosition(value) });
      }
    });

    if (points.length === 0) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  // Don't render chart if there's no data at all
  if (datosGrafica.length === 0) {
    return (
      <Svg width={width} height={height}>
        <Text x={width / 2} y={height / 2} style={{ fontSize: 8, fill: '#6B7280' }} textAnchor="middle">
          Sin datos para graficar
        </Text>
      </Svg>
    );
  }

  const actualDataPath = generateDataPath();
  const upperLimitPath = generateLimitPath(true);
  const lowerLimitPath = generateLimitPath(false);

  return (
    <Svg width={width} height={height}>
      {/* Background */}
      <Rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="#FAFAFA" />
      
      {/* Grid lines - Horizontal */}
      {[0, 20, 40, 60, 80, 100].map((value) => (
        <Line
          key={`h-${value}`}
          x1={padding.left}
          y1={getYPosition(value)}
          x2={padding.left + chartWidth}
          y2={getYPosition(value)}
          stroke="#E5E7EB"
          strokeWidth={0.5}
        />
      ))}
      
      {/* Grid lines - Vertical */}
      {datosGrafica.map((_, index) => (
        <Line
          key={`v-${index}`}
          x1={getXPosition(index)}
          y1={padding.top}
          x2={getXPosition(index)}
          y2={padding.top + chartHeight}
          stroke="#E5E7EB"
          strokeWidth={0.5}
        />
      ))}

      {/* Axes */}
      <Line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#374151" strokeWidth={1} />
      <Line x1={padding.left} y1={padding.top + chartHeight} x2={padding.left + chartWidth} y2={padding.top + chartHeight} stroke="#374151" strokeWidth={1} />

      {/* Y-axis labels */}
      {[0, 20, 40, 60, 80, 100].map((value) => (
        <Text
          key={`y-${value}`}
          x={padding.left - 8}
          y={getYPosition(value) + 2}
          style={{ fontSize: 6, fill: '#374151' }}
          textAnchor="end"
        >
          {value}
        </Text>
      ))}

      {/* X-axis labels - only for points with malla names */}
      {datosGrafica.map((dato, index) => {
        if (!dato.malla || dato.malla === '') return null; // Skip extension points
        
        // Format label for display
        let displayName = dato.malla.replace(/No\.\s*/g, '').replace(/"/g, '');
        
        return (
          <Text
            key={`x-${index}`}
            x={getXPosition(index)}
            y={padding.top + chartHeight + 12}
            style={{ fontSize: 5.5, fill: '#374151' }}
            textAnchor="middle"
          >
            {displayName}
          </Text>
        );
      })}

      {/* Axis titles */}
      <Text 
        x={width / 2} 
        y={height - 8} 
        style={{ fontSize: 7, fill: '#1F2937', fontFamily: 'Helvetica-Bold' }} 
        textAnchor="middle"
      >
        Mallas
      </Text>
      <Text 
        x={12} 
        y={height / 2} 
        style={{ fontSize: 7, fill: '#1F2937', fontFamily: 'Helvetica-Bold' }} 
        textAnchor="middle" 
        transform={`rotate(-90 12 ${height / 2})`}
      >
        % Pasa
      </Text>

      {/* Limit curves - Only render if limits exist */}
      {upperLimitPath && upperLimitPath.length > 0 && (
        <Path d={upperLimitPath} stroke="#069E2D" strokeWidth={1.5} fill="none" />
      )}
      {lowerLimitPath && lowerLimitPath.length > 0 && (
        <Path d={lowerLimitPath} stroke="#069E2D" strokeWidth={1.5} fill="none" />
      )}

      {/* Actual data curve - ALWAYS render if we have data */}
      {actualDataPath && actualDataPath.length > 0 && (
        <Path d={actualDataPath} stroke="#1F2937" strokeWidth={2} fill="none" />
      )}

      {/* Data points - only where porcentaje_pasa is defined */}
      {datosGrafica.map((dato, index) => {
        if (dato.porcentaje_pasa === undefined) return null;
        
        return (
          <Circle
            key={index}
            cx={getXPosition(index)}
            cy={getYPosition(dato.porcentaje_pasa)}
            r={2}
            fill="#1F2937"
          />
        );
      })}
    </Svg>
  );
};

export function EstudioPDF({ estudio }: EstudioPDFProps) {
  // Extract study data
  const granulometria = estudio.estudios.find(e => 
    e.nombre_estudio === 'Granulometría' || e.nombre_estudio === 'Análisis Granulométrico'
  );
  const masaVolumetrica = estudio.estudios.find(e => e.nombre_estudio === 'Masa Volumétrica');
  const densidad = estudio.estudios.find(e => e.nombre_estudio === 'Densidad');
  const perdidaLavado = estudio.estudios.find(e => e.nombre_estudio === 'Pérdida por Lavado');
  const absorcion = estudio.estudios.find(e => e.nombre_estudio === 'Absorción');

  // NMX references text
  const normasText = "Referencia: NMX-C-111-ONNCCE-2018, NMX-C-030-ONNCCE-2004, NMX-C-170-ONNCCE-2015, NMX-C-077-ONNCCE-2019, NMX-C-073-ONNCCE-2004, NMX-C-165-ONNCCE-2020, NMX-C-166-ONNCCE-2006, NMX-C-084-ONNCCE-2018, NMX-C-416-ONNCCE-2003 y NMX-C-088-ONNCCE-2019";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Image 
            src="/images/dc-concretos-logo.png" 
            style={styles.logo}
          />
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>
              RESULTADOS DE ESTUDIOS DE {estudio.alta_estudio.tipo_material.toUpperCase()}
            </Text>
            <Text style={styles.normasText}>{normasText}</Text>
          </View>
          <View style={{ width: 80 }} />
        </View>

        {/* Metadata Grid */}
        <View style={styles.metadataGrid}>
          {/* Row 1: Tipo de Análisis, Planta, Tipo de Material */}
          <View style={styles.metadataRow}>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Tipo de Análisis:</Text>
              <Text style={styles.metadataValue}>
                {estudio.alta_estudio.tipo_estudio && estudio.alta_estudio.tipo_estudio.length > 0
                  ? estudio.alta_estudio.tipo_estudio.join(', ')
                  : 'N/A'}
              </Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Planta:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.planta || 'N/A'}</Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Tipo de Material:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.tipo_material}</Text>
            </View>
          </View>
          
          {/* Row 2: Material, Fecha Muestreo, Fecha Elaboración */}
          <View style={styles.metadataRow}>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Material:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.nombre_material}</Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Fecha de Muestreo:</Text>
              <Text style={styles.metadataValue}>
                {estudio.alta_estudio.fecha_muestreo 
                  ? format(new Date(estudio.alta_estudio.fecha_muestreo), 'dd/MM/yyyy', { locale: es })
                  : 'N/A'}
              </Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Fecha de Elaboración:</Text>
              <Text style={styles.metadataValue}>
                {format(new Date(estudio.alta_estudio.fecha_elaboracion), 'dd/MM/yyyy', { locale: es })}
              </Text>
            </View>
          </View>
          
          {/* Row 3: Mina de Procedencia, Ubicación, Origen */}
          <View style={styles.metadataRow}>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Mina de Procedencia:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.mina_procedencia}</Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Ubicación:</Text>
              <Text style={styles.metadataValue}>
                {estudio.alta_estudio.ubicacion || 'N/A'}
              </Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Origen:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.origen_material || 'N/A'}</Text>
            </View>
          </View>
          
          {/* Row 4: Muestreada por, ID de Muestra */}
          <View style={styles.metadataRow}>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Muestreado por:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.tecnico}</Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>ID de la Muestra:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.id.slice(0, 8).toUpperCase()}</Text>
            </View>
            {estudio.alta_estudio.numero_arena && (
              <View style={styles.metadataCell}>
                <Text style={styles.metadataLabel}>No. de Folio:</Text>
                <Text style={styles.metadataValue}>{estudio.alta_estudio.numero_arena}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Two-column layout */}
        <View style={styles.twoColumnContainer}>
          {/* Left Column */}
          <View style={styles.leftColumn}>
            {/* Card 1: Granulometría */}
            {granulometria && granulometria.resultados && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>Granulometría ( Ref. NMX-C-077-ONNCCE-2019 )</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, styles.colMalla]}>No malla</Text>
                      <Text style={[styles.tableHeaderCell, styles.colRetenido]}>Retenido</Text>
                      <Text style={[styles.tableHeaderCell, styles.colPorcentaje]}>%</Text>
                      <Text style={[styles.tableHeaderCell, styles.colAcumulado]}>% Acum.</Text>
                      <Text style={[styles.tableHeaderCell, styles.colPasa]}>% Pasa</Text>
                    </View>
                    {/* Show only mallas with data (nulls hidden, zeros shown) */}
                    {granulometria.resultados.mallas
                      .filter((m: any) => m.numero_malla !== 'Fondo' && m.peso_retenido !== null)
                      .map((malla: any, index: number) => (
                        <View key={index} style={styles.tableRow}>
                          <Text style={[styles.tableCellBold, styles.colMalla]}>
                            {malla.numero_malla}
                          </Text>
                          <Text style={[styles.tableCell, styles.colRetenido]}>
                            {malla.peso_retenido !== null ? malla.peso_retenido.toFixed(1) : '-'}
                          </Text>
                          <Text style={[styles.tableCell, styles.colPorcentaje]}>
                            {malla.porcentaje_retenido.toFixed(1)}
                          </Text>
                          <Text style={[styles.tableCell, styles.colAcumulado]}>
                            {malla.porcentaje_acumulado.toFixed(1)}
                          </Text>
                          <Text style={[styles.tableCellBold, styles.colPasa]}>
                            {malla.porcentaje_pasa.toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    <View style={[styles.tableRow, { backgroundColor: '#F9FAFB' }]}>
                      <Text style={[styles.tableCellBold, styles.colMalla]}>Total</Text>
                      <Text style={[styles.tableCellBold, styles.colRetenido]}>
                        {(granulometria.resultados.peso_total_retenido || 0).toFixed(1)}
                      </Text>
                      <Text style={styles.colPorcentaje}></Text>
                      <Text style={styles.colAcumulado}></Text>
                      <Text style={styles.colPasa}></Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.formulaText}>
                      Módulo de finura ( esp. de 2.3 a 3.1) ={' '}
                      <Text style={styles.formulaBold}>{(granulometria.resultados.modulo_finura || 0).toFixed(2)}</Text>
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Card 2: Masa Volumétrica */}
            {masaVolumetrica && masaVolumetrica.resultados && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>Masa volumétrica ( Ref. NMX-C-073-ONNCCE-2004 )</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.formulaText}>
                    Masa v. suelta: {(masaVolumetrica.resultados.masa_suelta || 0).toFixed(2)} kg × Factor = {' '}
                    <Text style={styles.formulaBold}>{(masaVolumetrica.resultados.masa_volumetrica_suelta || 0).toFixed(0)}</Text> kg/m³
                  </Text>
                  <Text style={styles.formulaText}>
                    Masa v. Compactada: {(masaVolumetrica.resultados.masa_compactada || 0).toFixed(2)} kg × Factor = {' '}
                    <Text style={styles.formulaBold}>{(masaVolumetrica.resultados.masa_volumetrica_compactada || 0).toFixed(0)}</Text> kg/m³
                  </Text>
                  <Text style={[styles.formulaText, { marginTop: 3 }]}>
                    Factor = <Text style={styles.formulaBold}>{(masaVolumetrica.resultados.factor || 0).toFixed(2)}</Text> 1/m³
                  </Text>
                </View>
              </View>
            )}

            {/* Card 3: Masa Específica S.S.S. */}
            {densidad && densidad.resultados && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>Masa específica ( S.S.S. ) ( Ref. NMX-C-165-ONNCCE-2020 )</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.formulaBox}>
                    <Text style={styles.formulaBold}>
                      Me_sss = S / (B + S - C)
                    </Text>
                    {densidad.resultados.peso_muestra_sss && (
                      <Text style={styles.formulaText}>
                        = {densidad.resultados.peso_muestra_sss.toFixed(1)} /{' '}
                        ({((densidad.resultados.volumen_desplazado || 0) + densidad.resultados.peso_muestra_sss).toFixed(1)} +{' '}
                        {densidad.resultados.peso_muestra_sss.toFixed(1)} -{' '}
                        {(densidad.resultados.peso_muestra_sumergida || 0).toFixed(1)})
                      </Text>
                    )}
                    <Text style={styles.formulaResult}>
                      = {(densidad.resultados.densidad_relativa_sss || 0).toFixed(2)} g / cm³
                    </Text>
                  </View>
                  <Text style={styles.variableLegend}>
                    S= Masa de la muestra sat. y sup. Seco (g)
                    {'\n'}B= Masa del picnómetro con agua (g)
                    {'\n'}C= Masa del picnómetro con la muestra y agua (g)
                  </Text>
                </View>
              </View>
            )}

            {/* Card 4: Masa Específica (seca) */}
            {densidad && densidad.resultados && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>Masa específica (seca) ( Ref. NMX-C-165-ONNCCE-2020 )</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.formulaBox}>
                    <Text style={styles.formulaBold}>
                      Me_seca = Me_sss / (1 + (% Abs/100))
                    </Text>
                    <Text style={styles.formulaText}>
                      = {(densidad.resultados.densidad_relativa_sss || 0).toFixed(2)} /{' '}
                      {(1 + (densidad.resultados.absorcion || 0) / 100).toFixed(2)}
                    </Text>
                    <Text style={styles.formulaResult}>
                      = {(densidad.resultados.densidad_relativa_seca || 0).toFixed(2)} g / cm³
                    </Text>
                  </View>
                  <Text style={styles.variableLegend}>
                    Me_sss= Masa específica S.S.S
                    {'\n'}% Abs= % Absorción
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Right Column */}
          <View style={styles.rightColumn}>
            {/* Granulometric Curve Graph */}
            {granulometria && granulometria.resultados && (
              <View style={styles.graphContainer}>
                <Text style={styles.graphTitle}>
                  Granulometría ( Ref. NMX-C-077-ONNCCE-2019 )
                </Text>
                <GranulometricCurveChart 
                  mallas={granulometria.resultados.mallas}
                  limites={estudio.limites}
                  tipoMaterial={estudio.alta_estudio.tipo_material}
                />
              </View>
            )}

            {/* Card 5: Absorción */}
            {(absorcion?.resultados || densidad?.resultados) && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>Absorción ( Ref. NMX-C-165-ONNCCE-2020 )</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.formulaBox}>
                    <Text style={styles.formulaBold}>
                      % Absorción = (masa muestra SSS (g) - masa muestra seca (g)) / masa muestra seca (g) × 100
                    </Text>
                    {(absorcion?.resultados || densidad?.resultados) && (
                      <Text style={styles.formulaText}>
                        {absorcion?.resultados ? (
                          `% Absorción = (${(absorcion.resultados.peso_muestra_sss || 0).toFixed(1)} - ${(absorcion.resultados.peso_muestra_seca_horno || 0).toFixed(1)}) / ${(absorcion.resultados.peso_muestra_seca_horno || 1).toFixed(1)} × 100`
                        ) : densidad?.resultados ? (
                          `% Absorción = (${(densidad.resultados.peso_muestra_sss || 0).toFixed(1)} - ${(densidad.resultados.peso_muestra_seca_horno || 0).toFixed(1)}) / ${(densidad.resultados.peso_muestra_seca_horno || 1).toFixed(1)} × 100`
                        ) : ''}
                      </Text>
                    )}
                    <Text style={styles.formulaResult}>
                      = {(absorcion?.resultados?.absorcion_porcentaje || densidad?.resultados?.absorcion || 0).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Card 6: Pérdida por Lavado */}
            {perdidaLavado && perdidaLavado.resultados && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>Pérdida por lavado ( Ref. NMX-C-084-ONNCCE-2018 )</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.formulaBold, { marginBottom: 3 }]}>Secado a masa constante</Text>
                  <Text style={styles.formulaText}>
                    Masa muestra seca "Ms" ( g ) = {' '}
                    <Text style={styles.formulaBold}>{(perdidaLavado.resultados.peso_muestra_inicial || 0).toFixed(1)}</Text> g
                  </Text>
                  <Text style={styles.formulaText}>
                    Masa muestra seca lavada = {' '}
                    <Text style={styles.formulaBold}>{(perdidaLavado.resultados.peso_muestra_despues_lavado || 0).toFixed(1)}</Text> g
                  </Text>
                  <View style={styles.formulaBox}>
                    <Text style={styles.formulaBold}>
                      % P x L = (Ms - Msl) / Ms × 100
                    </Text>
                    <Text style={styles.formulaText}>
                      = ({(perdidaLavado.resultados.peso_muestra_inicial || 0).toFixed(1)} -{' '}
                      {(perdidaLavado.resultados.peso_muestra_despues_lavado || 0).toFixed(1)}) /{' '}
                      {(perdidaLavado.resultados.peso_muestra_inicial || 1).toFixed(1)} × 100
                    </Text>
                    <Text style={styles.formulaResult}>
                      = {(perdidaLavado.resultados.porcentaje_perdida || 0).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>+52 618 159 1481</Text>
          <Text style={styles.footerText}>alejandrodiaz@dcconcretos.com.mx</Text>
          <Text style={styles.footerText}>GERENTE DE CALIDAD - Alejandro Diaz Fernandez de Cevallos</Text>
        </View>
      </Page>
    </Document>
  );
}
