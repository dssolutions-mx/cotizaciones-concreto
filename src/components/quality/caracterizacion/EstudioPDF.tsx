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
    borderBottom: 2,
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
    border: 1,
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
    border: 1,
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
    borderBottom: 1,
    borderBottomColor: '#D1D5DB',
    paddingVertical: 3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: 0.5,
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
    borderTop: 1,
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
    border: 1,
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
    planta?: {
      nombre: string;
    };
  };
  estudios: Array<{
    tipo_estudio: string;
    estado: string;
    resultados?: any;
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
  limites 
}: { 
  mallas: MallaData[]; 
  limites?: Array<{ malla: string; limite_inferior: number; limite_superior: number }>;
}) => {
  const width = 240;
  const height = 180;
  const padding = { top: 15, right: 15, bottom: 30, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Filter mallas that are relevant for the chart
  const mallaNames = ['3/8', '4', '8', '16', '30', '50', '100'];
  const chartMallas = mallas.filter(m => {
    const name = m.numero_malla.replace(/No\.\s*/g, '').replace(/"/g, '').trim();
    return mallaNames.includes(name);
  });

  // Create logarithmic scale for X-axis
  const getXPosition = (index: number) => {
    const step = chartWidth / (mallaNames.length - 1);
    return padding.left + (index * step);
  };

  // Linear scale for Y-axis (0-100%)
  const getYPosition = (percentage: number) => {
    return padding.top + chartHeight - (percentage / 100) * chartHeight;
  };

  // Generate path for actual data
  const generatePath = (data: { porcentaje_pasa: number }[]) => {
    if (data.length === 0) return '';
    
    let path = `M ${getXPosition(0)} ${getYPosition(data[0].porcentaje_pasa)}`;
    for (let i = 1; i < data.length; i++) {
      path += ` L ${getXPosition(i)} ${getYPosition(data[i].porcentaje_pasa)}`;
    }
    return path;
  };

  // Generate path for limits
  const generateLimitPath = (isUpper: boolean) => {
    if (!limites || limites.length === 0) return '';
    
    const points: { x: number; y: number }[] = [];
    mallaNames.forEach((mallaName, index) => {
      const limite = limites.find(l => {
        const lName = l.malla.replace(/No\.\s*/g, '').replace(/"/g, '').trim();
        return lName === mallaName;
      });
      if (limite) {
        const value = isUpper ? limite.limite_superior : limite.limite_inferior;
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

  const actualDataPath = generatePath(chartMallas);
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
      {mallaNames.map((_, index) => (
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
          fontSize={6}
          fill="#374151"
          textAnchor="end"
        >
          {value}
        </Text>
      ))}

      {/* X-axis labels */}
      {mallaNames.map((name, index) => (
        <Text
          key={`x-${name}`}
          x={getXPosition(index)}
          y={padding.top + chartHeight + 12}
          fontSize={6}
          fill="#374151"
          textAnchor="middle"
        >
          {name}
        </Text>
      ))}

      {/* Axis titles */}
      <Text x={width / 2} y={height - 8} fontSize={7} fill="#1F2937" textAnchor="middle" fontFamily="Helvetica-Bold">
        Mallas
      </Text>
      <Text x={12} y={height / 2} fontSize={7} fill="#1F2937" textAnchor="middle" fontFamily="Helvetica-Bold" transform={`rotate(-90 12 ${height / 2})`}>
        % Pasa
      </Text>

      {/* Limit curves */}
      {upperLimitPath && (
        <Path d={upperLimitPath} stroke="#069E2D" strokeWidth={1.5} fill="none" />
      )}
      {lowerLimitPath && (
        <Path d={lowerLimitPath} stroke="#069E2D" strokeWidth={1.5} fill="none" />
      )}

      {/* Actual data curve */}
      {actualDataPath && (
        <Path d={actualDataPath} stroke="#1F2937" strokeWidth={2} fill="none" />
      )}

      {/* Data points */}
      {chartMallas.map((malla, index) => (
        <Circle
          key={index}
          cx={getXPosition(index)}
          cy={getYPosition(malla.porcentaje_pasa)}
          r={2}
          fill="#1F2937"
        />
      ))}
    </Svg>
  );
};

export function EstudioPDF({ estudio }: EstudioPDFProps) {
  // Extract study data
  const granulometria = estudio.estudios.find(e => 
    e.tipo_estudio === 'Granulometría' || e.tipo_estudio === 'Análisis Granulométrico'
  );
  const masaVolumetrica = estudio.estudios.find(e => e.tipo_estudio === 'Masa Volumétrica');
  const densidad = estudio.estudios.find(e => e.tipo_estudio === 'Densidad');
  const perdidaLavado = estudio.estudios.find(e => e.tipo_estudio === 'Pérdida por Lavado');
  const absorcion = estudio.estudios.find(e => e.tipo_estudio === 'Absorción');

  // NMX references text
  const normasText = "Referencia: NMX-C-111-ONNCCE-2018, NMX-C-030-ONNCCE-2004, NMX-C-170-ONNCCE-2015, NMX-C-077-ONNCCE-2019, NMX-C-073-ONNCCE-2004, NMX-C-165-ONNCCE-2020, NMX-C-166-ONNCCE-2006, NMX-C-084-ONNCCE-2018, NMX-C-416-ONNCCE-2003 y NMX-C-088-ONNCCE-2019";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Image 
            src="/images/dcconcretos/DC_LOGO_F_2.jpg" 
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
          <View style={styles.metadataRow}>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Fecha de muestreo:</Text>
              <Text style={styles.metadataValue}>
                {estudio.alta_estudio.fecha_muestreo 
                  ? format(new Date(estudio.alta_estudio.fecha_muestreo), 'dd/MM/yyyy', { locale: es })
                  : 'N/A'}
              </Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Fecha de estudio:</Text>
              <Text style={styles.metadataValue}>
                {format(new Date(estudio.alta_estudio.fecha_elaboracion), 'dd/MM/yyyy', { locale: es })}
              </Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>No. de Folio:</Text>
              <Text style={styles.metadataValue}>
                {estudio.alta_estudio.numero_arena || 'N/A'}
              </Text>
            </View>
          </View>
          <View style={styles.metadataRow}>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Mina de procedencia:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.mina_procedencia}</Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Ubicación:</Text>
              <Text style={styles.metadataValue}>
                {estudio.alta_estudio.ubicacion || estudio.alta_estudio.planta?.nombre || 'N/A'}
              </Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Número de la Arena:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.numero_arena || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.metadataRow}>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Muestreada por:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.tecnico}</Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Cliente:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.cliente || 'ITISA'}</Text>
            </View>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>ID de la Muestra:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.id.slice(0, 8).toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.metadataRow}>
            <View style={styles.metadataCell}>
              <Text style={styles.metadataLabel}>Planta de procedencia:</Text>
              <Text style={styles.metadataValue}>{estudio.alta_estudio.planta?.nombre || 'N/A'}</Text>
            </View>
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
                    {/* Show ALL mallas, even without data */}
                    {granulometria.resultados.mallas
                      .filter((m: any) => m.numero_malla !== 'Fondo')
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
                        {granulometria.resultados.peso_total_retenido.toFixed(1)}
                      </Text>
                      <Text style={styles.colPorcentaje}></Text>
                      <Text style={styles.colAcumulado}></Text>
                      <Text style={styles.colPasa}></Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.formulaText}>
                      Módulo de finura ( esp. de 2.3 a 3.1) ={' '}
                      <Text style={styles.formulaBold}>{granulometria.resultados.modulo_finura.toFixed(2)}</Text>
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
                    Masa v. suelta: {masaVolumetrica.resultados.masa_suelta.toFixed(2)} kg × Factor = {' '}
                    <Text style={styles.formulaBold}>{masaVolumetrica.resultados.masa_volumetrica_suelta.toFixed(0)}</Text> kg/m³
                  </Text>
                  <Text style={styles.formulaText}>
                    Masa v. Compactada: {masaVolumetrica.resultados.masa_compactada.toFixed(2)} kg × Factor = {' '}
                    <Text style={styles.formulaBold}>{masaVolumetrica.resultados.masa_volumetrica_compactada.toFixed(0)}</Text> kg/m³
                  </Text>
                  <Text style={[styles.formulaText, { marginTop: 3 }]}>
                    Factor = <Text style={styles.formulaBold}>{masaVolumetrica.resultados.factor.toFixed(2)}</Text> 1/m³
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
                    <Text style={styles.formulaText}>
                      = {densidad.resultados.peso_muestra_sss?.toFixed(1) || 'N/A'} /{' '}
                      ({(densidad.resultados.volumen_desplazado + densidad.resultados.peso_muestra_sss)?.toFixed(1) || 'N/A'} +{' '}
                      {densidad.resultados.peso_muestra_sss?.toFixed(1) || 'N/A'} -{' '}
                      {densidad.resultados.peso_muestra_sumergida?.toFixed(1) || 'N/A'})
                    </Text>
                    <Text style={styles.formulaResult}>
                      = {densidad.resultados.densidad_relativa_sss.toFixed(2)} g / cm³
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
                      = {densidad.resultados.densidad_relativa_sss.toFixed(2)} /{' '}
                      {(1 + densidad.resultados.absorcion / 100).toFixed(2)}
                    </Text>
                    <Text style={styles.formulaResult}>
                      = {densidad.resultados.densidad_relativa_seca.toFixed(2)} g / cm³
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
                    <Text style={styles.formulaText}>
                      {absorcion?.resultados ? (
                        `% Absorción = (${absorcion.resultados.peso_muestra_sss?.toFixed(1)} - ${absorcion.resultados.peso_muestra_seca_horno?.toFixed(1)}) / ${absorcion.resultados.peso_muestra_seca_horno?.toFixed(1)} × 100`
                      ) : densidad?.resultados ? (
                        `% Absorción = (${densidad.resultados.peso_muestra_sss?.toFixed(1)} - ${densidad.resultados.peso_muestra_seca_horno?.toFixed(1)}) / ${densidad.resultados.peso_muestra_seca_horno?.toFixed(1)} × 100`
                      ) : ''}
                    </Text>
                    <Text style={styles.formulaResult}>
                      = {(absorcion?.resultados?.absorcion_porcentaje || densidad?.resultados?.absorcion)?.toFixed(1)}%
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
                    <Text style={styles.formulaBold}>{perdidaLavado.resultados.peso_muestra_inicial?.toFixed(1)}</Text> g
                  </Text>
                  <Text style={styles.formulaText}>
                    Masa muestra seca lavada = {' '}
                    <Text style={styles.formulaBold}>{perdidaLavado.resultados.peso_muestra_despues_lavado?.toFixed(1)}</Text> g
                  </Text>
                  <View style={styles.formulaBox}>
                    <Text style={styles.formulaBold}>
                      % P x L = (Ms - Msl) / Ms × 100
                    </Text>
                    <Text style={styles.formulaText}>
                      = ({perdidaLavado.resultados.peso_muestra_inicial?.toFixed(1)} -{' '}
                      {perdidaLavado.resultados.peso_muestra_despues_lavado?.toFixed(1)}) /{' '}
                      {perdidaLavado.resultados.peso_muestra_inicial?.toFixed(1)} × 100
                    </Text>
                    <Text style={styles.formulaResult}>
                      = {perdidaLavado.resultados.porcentaje_perdida?.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>477-129-2394</Text>
          <Text style={styles.footerText}>ventas@dcconcretos.com.mx</Text>
          <Text style={styles.footerText}>www.dcconcretos.com.mx</Text>
        </View>
      </Page>
    </Document>
  );
}
