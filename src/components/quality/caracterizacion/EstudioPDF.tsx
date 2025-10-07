import { Document, Page, Text, View, StyleSheet, Image, Svg, Path } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Estilos del PDF
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: 'white',
    position: 'relative',
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
    marginBottom: 20,
  },
  darkBluePath: {
    fill: '#0C1F28',
  },
  greenPath: {
    fill: '#069E2D',
  },
  mainContent: {
    padding: 30,
    paddingTop: 50,
  },
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
  documentTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0C1F28',
  },
  dateSection: {
    marginTop: 8,
    fontSize: 10,
    color: '#666666',
  },
  title: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    marginTop: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0C1F28',
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 10,
    marginTop: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#069E2D',
    borderBottom: 1,
    borderBottomColor: '#069E2D',
    paddingBottom: 5,
  },
  infoGrid: {
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: '35%',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0C1F28',
  },
  infoValue: {
    width: '65%',
    fontSize: 10,
    color: '#333333',
  },
  table: {
    marginBottom: 15,
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#069E2D',
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: 1,
    borderBottomColor: '#E5E7EB',
    padding: 6,
    minHeight: 24,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  headerText: {
    color: 'white',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  cellText: {
    fontSize: 9,
    color: '#333333',
  },
  cellBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0C1F28',
  },
  columnMalla: {
    width: '12%',
    textAlign: 'center',
  },
  columnAbertura: {
    width: '12%',
    textAlign: 'center',
  },
  columnRetenido: {
    width: '14%',
    textAlign: 'center',
  },
  columnPorcRetenido: {
    width: '14%',
    textAlign: 'center',
  },
  columnPorcAcum: {
    width: '14%',
    textAlign: 'center',
  },
  columnPorcPasa: {
    width: '12%',
    textAlign: 'center',
  },
  columnLimInf: {
    width: '11%',
    textAlign: 'center',
  },
  columnLimSup: {
    width: '11%',
    textAlign: 'center',
  },
  resultBox: {
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 4,
    borderLeft: 3,
    borderLeftColor: '#069E2D',
  },
  resultRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  resultLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0C1F28',
    width: '50%',
  },
  resultValue: {
    fontSize: 10,
    color: '#333333',
    width: '50%',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    backgroundColor: 'white',
  },
  contactInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#666666',
  },
  footerBold: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0C1F28',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 10,
    right: 30,
    fontSize: 8,
    color: '#999999',
  },
  observaciones: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 4,
    borderLeft: 3,
    borderLeftColor: '#F59E0B',
  },
  observacionesTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#92400E',
    marginBottom: 5,
  },
  observacionesText: {
    fontSize: 9,
    color: '#78350F',
    lineHeight: 1.5,
  },
});

interface EstudioData {
  alta_estudio: {
    id: string;
    tipo_material: 'Arena' | 'Grava';
    mina_procedencia: string;
    nombre_material: string;
    tecnico: string;
    fecha_elaboracion: string;
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

const PhoneIcon = () => (
  <Svg style={{ width: 10, height: 10 }} viewBox="0 0 24 24">
    <Path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1zM19 12h2c0-4.9-4-8.9-9-8.9v2c3.9 0 7 3.1 7 6.9z" fill="#666666"/>
  </Svg>
);

const EmailIcon = () => (
  <Svg style={{ width: 10, height: 10 }} viewBox="0 0 24 24">
    <Path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#666666"/>
  </Svg>
);

const WebIcon = () => (
  <Svg style={{ width: 10, height: 10 }} viewBox="0 0 24 24">
    <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="#666666"/>
  </Svg>
);

const PageBackground = () => (
  <View style={styles.pageBackground}>
    {/* Top Section with diagonal design */}
    <Svg style={styles.topSection}>
      <Path d="M0,0 L595,0 L595,40 L0,40 Z" style={styles.darkBluePath} />
      <Path d="M297,0 L595,0 L595,40 L347,40 Z" style={styles.greenPath} />
    </Svg>

    {/* Footer */}
    <View style={styles.footer}>
      <View style={styles.contactInfo}>
        <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
          <PhoneIcon />
          <Text style={styles.footerText}>477-129-2394</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
          <EmailIcon />
          <Text style={styles.footerText}>ventas@dcconcretos.com.mx</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
          <WebIcon />
          <Text style={styles.footerText}>www.dcconcretos.com.mx</Text>
        </View>
      </View>
    </View>
  </View>
);

export function EstudioPDF({ estudio }: EstudioPDFProps) {
  // Encontrar todos los estudios por tipo
  const granulometria = estudio.estudios.find(e => 
    e.tipo_estudio === 'Granulometría' || e.tipo_estudio === 'Análisis Granulométrico'
  );
  const caracterizacion = estudio.estudios.find(e => e.tipo_estudio === 'Caracterización Física');
  const masaVolumetrica = estudio.estudios.find(e => e.tipo_estudio === 'Masa Volumétrico');
  const densidad = estudio.estudios.find(e => e.tipo_estudio === 'Densidad');
  const perdidaLavado = estudio.estudios.find(e => e.tipo_estudio === 'Pérdida por Lavado');
  const absorcion = estudio.estudios.find(e => e.tipo_estudio === 'Absorción');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PageBackground />
        
        <View style={styles.mainContent}>
          {/* Header */}
          <View style={styles.header}>
            <Image 
              src="/images/dcconcretos/DC_LOGO_F_2.jpg" 
              style={styles.logo}
            />
            <View style={styles.documentInfo}>
              <Text style={styles.documentTitle}>
                REPORTE DE CARACTERIZACIÓN DE MATERIALES
              </Text>
              <Text style={styles.dateSection}>
                Fecha: {format(new Date(estudio.alta_estudio.fecha_elaboracion), 'dd/MM/yyyy', { locale: es })}
              </Text>
              <Text style={styles.dateSection}>
                ID: {estudio.alta_estudio.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            CARACTERIZACIÓN DE {estudio.alta_estudio.tipo_material.toUpperCase()}
          </Text>

          {/* Información General */}
          <Text style={styles.subtitle}>Información General</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Material:</Text>
              <Text style={styles.infoValue}>{estudio.alta_estudio.nombre_material}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tipo:</Text>
              <Text style={styles.infoValue}>{estudio.alta_estudio.tipo_material}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Procedencia:</Text>
              <Text style={styles.infoValue}>{estudio.alta_estudio.mina_procedencia}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Planta:</Text>
              <Text style={styles.infoValue}>{estudio.alta_estudio.planta?.nombre || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Técnico:</Text>
              <Text style={styles.infoValue}>{estudio.alta_estudio.tecnico}</Text>
            </View>
            {estudio.tamaño && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tamaño:</Text>
                <Text style={styles.infoValue}>{estudio.tamaño}</Text>
              </View>
            )}
          </View>

          {/* Granulometría */}
          {granulometria && granulometria.resultados && (
            <>
              <Text style={styles.subtitle}>Análisis Granulométrico</Text>
              
              {/* Tabla de Granulometría */}
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.headerText, styles.columnMalla]}>Malla</Text>
                  <Text style={[styles.headerText, styles.columnAbertura]}>Abertura (mm)</Text>
                  <Text style={[styles.headerText, styles.columnRetenido]}>Peso Retenido (g)</Text>
                  <Text style={[styles.headerText, styles.columnPorcRetenido]}>% Retenido</Text>
                  <Text style={[styles.headerText, styles.columnPorcAcum]}>% Acumulado</Text>
                  <Text style={[styles.headerText, styles.columnPorcPasa]}>% Pasa</Text>
                  {estudio.limites && estudio.limites.length > 0 && (
                    <>
                      <Text style={[styles.headerText, styles.columnLimInf]}>Lím. Inf.</Text>
                      <Text style={[styles.headerText, styles.columnLimSup]}>Lím. Sup.</Text>
                    </>
                  )}
                </View>
                
                {granulometria.resultados.mallas
                  .filter((m: any) => m.peso_retenido !== null && m.numero_malla !== 'Fondo')
                  .map((malla: any, index: number) => {
                    const limite = estudio.limites?.find(l => 
                      l.malla.toLowerCase().replace(/[^a-z0-9]/g, '') === 
                      malla.numero_malla.toLowerCase().replace(/[^a-z0-9]/g, '')
                    );
                    
                    return (
                      <View 
                        key={index} 
                        style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
                      >
                        <Text style={[styles.cellBold, styles.columnMalla]}>
                          {malla.numero_malla}
                        </Text>
                        <Text style={[styles.cellText, styles.columnAbertura]}>
                          {malla.abertura_mm > 0 ? malla.abertura_mm : '-'}
                        </Text>
                        <Text style={[styles.cellText, styles.columnRetenido]}>
                          {malla.peso_retenido.toFixed(2)}
                        </Text>
                        <Text style={[styles.cellText, styles.columnPorcRetenido]}>
                          {malla.porcentaje_retenido.toFixed(2)}%
                        </Text>
                        <Text style={[styles.cellText, styles.columnPorcAcum]}>
                          {malla.porcentaje_acumulado.toFixed(2)}%
                        </Text>
                        <Text style={[styles.cellBold, styles.columnPorcPasa]}>
                          {malla.porcentaje_pasa.toFixed(2)}%
                        </Text>
                        {estudio.limites && estudio.limites.length > 0 && (
                          <>
                            <Text style={[styles.cellText, styles.columnLimInf]}>
                              {limite ? `${limite.limite_inferior}%` : '-'}
                            </Text>
                            <Text style={[styles.cellText, styles.columnLimSup]}>
                              {limite ? `${limite.limite_superior}%` : '-'}
                            </Text>
                          </>
                        )}
                      </View>
                    );
                  })}
              </View>

              {/* Resultados Calculados */}
              <View style={styles.resultBox}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Peso de Muestra Inicial:</Text>
                  <Text style={styles.resultValue}>
                    {granulometria.resultados.peso_muestra_inicial} g
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Peso Total Retenido:</Text>
                  <Text style={styles.resultValue}>
                    {granulometria.resultados.peso_total_retenido.toFixed(2)} g
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Módulo de Finura:</Text>
                  <Text style={styles.resultValue}>
                    {granulometria.resultados.modulo_finura.toFixed(2)}
                  </Text>
                </View>
                {granulometria.resultados.tamaño_maximo_nominal && (
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Tamaño Máximo Nominal:</Text>
                    <Text style={styles.resultValue}>
                      {granulometria.resultados.tamaño_maximo_nominal}
                    </Text>
                  </View>
                )}
              </View>

              {/* Observaciones */}
              {granulometria.resultados.observaciones && (
                <View style={styles.observaciones}>
                  <Text style={styles.observacionesTitle}>Observaciones:</Text>
                  <Text style={styles.observacionesText}>
                    {granulometria.resultados.observaciones}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `Página ${pageNumber} de ${totalPages}`
        )} fixed />
      </Page>

      {/* Segunda página: Resultados de Ensayos Físicos */}
      {(masaVolumetrica || densidad || perdidaLavado || absorcion || caracterizacion) && (
        <Page size="A4" style={styles.page}>
          <PageBackground />
          
          <View style={styles.mainContent}>
            {/* Header */}
            <View style={styles.header}>
              <Image 
                src="/images/dcconcretos/DC_LOGO_F_2.jpg" 
                style={styles.logo}
              />
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>
                  ENSAYOS FÍSICOS
                </Text>
              </View>
            </View>

            <Text style={styles.title}>PROPIEDADES FÍSICAS DEL MATERIAL</Text>

            {/* Masa Volumétrica */}
            {masaVolumetrica && masaVolumetrica.resultados && (
              <>
                <Text style={styles.subtitle}>Masa Volumétrica</Text>
                <View style={styles.resultBox}>
                  {masaVolumetrica.resultados.masa_volumetrica_suelta && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Masa Volumétrica Suelta:</Text>
                      <Text style={styles.resultValue}>
                        {masaVolumetrica.resultados.masa_volumetrica_suelta.toFixed(2)} kg/m³
                      </Text>
                    </View>
                  )}
                  {masaVolumetrica.resultados.masa_volumetrica_compactada && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Masa Volumétrica Compactada:</Text>
                      <Text style={styles.resultValue}>
                        {masaVolumetrica.resultados.masa_volumetrica_compactada.toFixed(2)} kg/m³
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Densidad */}
            {densidad && densidad.resultados && (
              <>
                <Text style={styles.subtitle}>Densidad</Text>
                <View style={styles.resultBox}>
                  {densidad.resultados.densidad_relativa && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Densidad Relativa:</Text>
                      <Text style={styles.resultValue}>
                        {densidad.resultados.densidad_relativa.toFixed(3)} g/cm³
                      </Text>
                    </View>
                  )}
                  {densidad.resultados.densidad_sss && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Densidad SSS:</Text>
                      <Text style={styles.resultValue}>
                        {densidad.resultados.densidad_sss.toFixed(3)} g/cm³
                      </Text>
                    </View>
                  )}
                  {densidad.resultados.densidad_aparente && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Densidad Aparente:</Text>
                      <Text style={styles.resultValue}>
                        {densidad.resultados.densidad_aparente.toFixed(3)} g/cm³
                      </Text>
                    </View>
                  )}
                  {densidad.resultados.absorcion !== undefined && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Absorción:</Text>
                      <Text style={styles.resultValue}>
                        {densidad.resultados.absorcion.toFixed(2)}%
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Pérdida por Lavado */}
            {perdidaLavado && perdidaLavado.resultados && (
              <>
                <Text style={styles.subtitle}>Pérdida por Lavado</Text>
                <View style={styles.resultBox}>
                  {perdidaLavado.resultados.perdida_lavado && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Pérdida por Lavado (g):</Text>
                      <Text style={styles.resultValue}>
                        {perdidaLavado.resultados.perdida_lavado.toFixed(2)} g
                      </Text>
                    </View>
                  )}
                  {perdidaLavado.resultados.porcentaje_perdida && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Pérdida por Lavado:</Text>
                      <Text style={styles.resultValue}>
                        {perdidaLavado.resultados.porcentaje_perdida.toFixed(2)}%
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Absorción */}
            {absorcion && absorcion.resultados && (
              <>
                <Text style={styles.subtitle}>Absorción</Text>
                <View style={styles.resultBox}>
                  {absorcion.resultados.absorcion_porcentaje && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Absorción:</Text>
                      <Text style={styles.resultValue}>
                        {absorcion.resultados.absorcion_porcentaje.toFixed(2)}%
                      </Text>
                    </View>
                  )}
                  {absorcion.resultados.absorcion && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Absorción (g):</Text>
                      <Text style={styles.resultValue}>
                        {absorcion.resultados.absorcion.toFixed(2)} g
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Caracterización Física (si existe y no está en estudios separados) */}
            {caracterizacion && caracterizacion.resultados && (
              <>
                {caracterizacion.resultados.masa_especifica && (
                  <>
                    <Text style={styles.subtitle}>Masas Específicas</Text>
                    <View style={styles.resultBox}>
                      {caracterizacion.resultados.masa_especifica && (
                        <View style={styles.resultRow}>
                          <Text style={styles.resultLabel}>Masa Específica:</Text>
                          <Text style={styles.resultValue}>
                            {caracterizacion.resultados.masa_especifica.toFixed(3)} g/cm³
                          </Text>
                        </View>
                      )}
                      {caracterizacion.resultados.masa_especifica_sss && (
                        <View style={styles.resultRow}>
                          <Text style={styles.resultLabel}>Masa Específica SSS:</Text>
                          <Text style={styles.resultValue}>
                            {caracterizacion.resultados.masa_especifica_sss.toFixed(3)} g/cm³
                          </Text>
                        </View>
                      )}
                      {caracterizacion.resultados.masa_especifica_seca && (
                        <View style={styles.resultRow}>
                          <Text style={styles.resultLabel}>Masa Específica Seca:</Text>
                          <Text style={styles.resultValue}>
                            {caracterizacion.resultados.masa_especifica_seca.toFixed(3)} g/cm³
                          </Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </>
            )}
          </View>

          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
            `Página ${pageNumber} de ${totalPages}`
          )} fixed />
        </Page>
      )}
    </Document>
  );
}

