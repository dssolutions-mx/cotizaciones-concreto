import { Document, Page, Text, View, StyleSheet, Image, Svg, Path } from '@react-pdf/renderer';
import { ApprovedQuote } from './ApprovedQuotesTab';

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
    fill: '#1B365D',
  },
  greenPath: {
    fill: '#00A650',
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
  quoteNumber: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  dateSection: {
    marginTop: 15,
    fontSize: 10,
  },
  clientInfo: {
    marginBottom: 20,
    fontSize: 10,
  },
  title: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Helvetica-Bold',
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#304F1E',
    padding: 6,
    borderBottom: 1,
    borderBottomColor: '#CCCCCC',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: 1,
    borderBottomColor: '#CCCCCC',
    padding: 6,
    minHeight: 24,
    alignItems: 'center',
  },
  columnQuantity: {
    width: '8%',
    textAlign: 'center',
  },
  columnDescription: {
    width: '52%',
  },
  columnUnit: {
    width: '10%',
    textAlign: 'center',
  },
  columnPrice: {
    width: '15%',
    textAlign: 'right',
  },
  columnTotal: {
    width: '15%',
    textAlign: 'right',
  },
  headerText: {
    color: 'white',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  cellText: {
    fontSize: 9,
  },
  terms: {
    marginBottom: 15,
  },
  termsTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  },
  termsList: {
    marginLeft: 15,
  },
  termsText: {
    fontSize: 9,
    marginBottom: 3,
  },
  additionalServices: {
    marginBottom: 20,
  },
  smallNote: {
    fontSize: 8,
    marginTop: 5,
    marginLeft: 15,
    fontFamily: 'Times-Italic',
  },
  signature: {
    marginTop: 20,
    textAlign: 'center',
    marginBottom: 30,
  },
  signatureText: {
    fontSize: 10,
    marginBottom: 3,
  },
  signatureBold: {
    fontSize: 10,
    marginBottom: 3,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    backgroundColor: 'white',
  },
  footerContent: {
    borderTop: 1,
    borderTopColor: '#CCCCCC',
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
  totalLabel: {
    fontFamily: 'Helvetica-Bold',
  },
});

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

const PageBackground = () => (
  <View style={styles.pageBackground}>
    {/* Top Section with diagonal design */}
    <Svg style={styles.topSection}>
      <Path d="M0,0 L595,0 L595,40 L0,40 Z" style={styles.darkBluePath} />
      <Path d="M297,0 L595,0 L595,40 L347,40 Z" style={styles.greenPath} />
    </Svg>

    {/* Footer with contact info */}
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

    {/* Bottom blue bar */}
    <Svg style={styles.bottomSection}>
      <Path d="M0,0 L595,0 L595,12 L0,12 Z" style={styles.darkBluePath} />
    </Svg>
  </View>
);

const QuotePDF = ({ quote, showVAT = false }: { quote: ApprovedQuote; showVAT?: boolean }) => {
  // Calculate concrete subtotal
  const concreteSubtotal = quote.quote_details.reduce(
    (sum, detail) => sum + detail.final_price * detail.volume,
    0
  );
  
  // Calculate concrete VAT (16%)
  const concreteVAT = showVAT ? parseFloat((concreteSubtotal * 0.16).toFixed(2)) : 0;
  
  // Calculate concrete total with VAT
  const concreteTotal = concreteSubtotal + concreteVAT;
  
  // Get pump service information
  const hasPumpService = quote.quote_details.some(detail => detail.pump_service);
  const pumpServicePrice = hasPumpService 
    ? quote.quote_details.find(detail => detail.pump_service)?.pump_price || 0
    : 0;
  
  // Calculate pump service VAT (16%)
  const pumpServiceVAT = showVAT && hasPumpService ? parseFloat((pumpServicePrice * 0.16).toFixed(2)) : 0;
  
  // Calculate pump service total with VAT
  const pumpServiceTotal = pumpServicePrice + pumpServiceVAT;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PageBackground />
        <View style={styles.mainContent}>
          {/* Header with logo and document info */}
          <View style={styles.header}>
            <Image style={styles.logo} src="/images/logo.png" />
            <View style={styles.documentInfo}>
              <Text style={styles.quoteNumber}>COT-EF-{quote.quote_number}</Text>
              <View style={styles.dateSection}>
                <Text>Fecha:</Text>
                <Text>{new Date(quote.created_at).toLocaleDateString('es-MX')}</Text>
              </View>
            </View>
          </View>

          {/* Client Info */}
          <View style={styles.clientInfo}>
            <Text>Cliente: {quote.client?.business_name}</Text>
            <Text>Obra: {quote.construction_site}</Text>
          </View>

          <Text style={styles.title}>COTIZACIÓN CONCRETO PREMEZCLADO</Text>

          {/* Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerText, styles.columnQuantity]}>CANTIDAD</Text>
              <Text style={[styles.headerText, styles.columnDescription]}>DESCRIPCION</Text>
              <Text style={[styles.headerText, styles.columnUnit]}>UNIDAD</Text>
              <Text style={[styles.headerText, styles.columnPrice]}>PRECIO UNITARIO</Text>
              <Text style={[styles.headerText, styles.columnTotal]}>TOTAL</Text>
            </View>

            {quote.quote_details.map((detail, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.cellText, styles.columnQuantity]}>{detail.volume}</Text>
                <Text style={[styles.cellText, styles.columnDescription]}>
                  {`CONCRETO ${detail.recipe?.notes} ${detail.recipe?.strength_fc} KG/CM2 ${detail.recipe?.placement_type} TMA ${detail.recipe?.max_aggregate_size} REV ${detail.recipe?.slump} EDAD ${detail.recipe?.age_days} DIAS`}
                </Text>
                <Text style={[styles.cellText, styles.columnUnit]}>M3</Text>
                <Text style={[styles.cellText, styles.columnPrice]}>$ {detail.final_price.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                <Text style={[styles.cellText, styles.columnTotal]}>$ {(detail.final_price * detail.volume).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
              </View>
            ))}
            
            {/* Subtotal Row */}
            <View style={styles.tableRow}>
              <Text style={[styles.cellText, styles.columnQuantity]}></Text>
              <Text style={[styles.cellText, styles.columnDescription]}></Text>
              <Text style={[styles.cellText, styles.columnUnit]}></Text>
              <Text style={[styles.cellText, styles.columnPrice, styles.totalLabel]}>
                {hasPumpService ? 'SUBTOTAL:' : 'SUBTOTAL:'}
              </Text>
              <Text style={[styles.cellText, styles.columnTotal]}>$ {concreteSubtotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
            </View>
            
            {/* VAT Row - Only shown if showVAT is true */}
            {showVAT && (
              <View style={styles.tableRow}>
                <Text style={[styles.cellText, styles.columnQuantity]}></Text>
                <Text style={[styles.cellText, styles.columnDescription]}></Text>
                <Text style={[styles.cellText, styles.columnUnit]}></Text>
                <Text style={[styles.cellText, styles.columnPrice, styles.totalLabel]}>IVA (16%):</Text>
                <Text style={[styles.cellText, styles.columnTotal]}>$ {concreteVAT.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
              </View>
            )}
            
            {/* Total Row - Only shown if showVAT is true */}
            {showVAT && (
              <View style={styles.tableRow}>
                <Text style={[styles.cellText, styles.columnQuantity]}></Text>
                <Text style={[styles.cellText, styles.columnDescription]}></Text>
                <Text style={[styles.cellText, styles.columnUnit]}></Text>
                <Text style={[styles.cellText, styles.columnPrice, styles.totalLabel]}>TOTAL:</Text>
                <Text style={[styles.cellText, styles.columnTotal]}>$ {concreteTotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
              </View>
            )}
          </View>

          {/* Pump Service Table - Only shown if pump service is included */}
          {hasPumpService && (
            <View style={[styles.table, { marginTop: 20 }]}>
              <Text style={[styles.title, { fontSize: 12, marginBottom: 8 }]}>SERVICIO DE BOMBEO</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerText, styles.columnQuantity]}>CANT.</Text>
                <Text style={[styles.headerText, styles.columnDescription]}>DESCRIPCION</Text>
                <Text style={[styles.headerText, styles.columnUnit]}>UNIDAD</Text>
                <Text style={[styles.headerText, styles.columnPrice]}>PRECIO</Text>
                <Text style={[styles.headerText, styles.columnTotal]}>TOTAL</Text>
              </View>
              
              <View style={styles.tableRow}>
                <Text style={[styles.cellText, styles.columnQuantity]}>1</Text>
                <Text style={[styles.cellText, styles.columnDescription]}>
                  SERVICIO DE BOMBEO
                </Text>
                <Text style={[styles.cellText, styles.columnUnit]}>SERVICIO</Text>
                <Text style={[styles.cellText, styles.columnPrice]}>$ {pumpServicePrice.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                <Text style={[styles.cellText, styles.columnTotal]}>$ {pumpServicePrice.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
              </View>
              
              {/* Pump Service VAT Row - Only shown if showVAT is true */}
              {showVAT && (
                <View style={styles.tableRow}>
                  <Text style={[styles.cellText, styles.columnQuantity]}></Text>
                  <Text style={[styles.cellText, styles.columnDescription]}></Text>
                  <Text style={[styles.cellText, styles.columnUnit]}></Text>
                  <Text style={[styles.cellText, styles.columnPrice, styles.totalLabel]}>IVA (16%):</Text>
                  <Text style={[styles.cellText, styles.columnTotal]}>$ {pumpServiceVAT.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                </View>
              )}
              
              {/* Pump Service Total Row - Only shown if showVAT is true */}
              {showVAT && (
                <View style={styles.tableRow}>
                  <Text style={[styles.cellText, styles.columnQuantity]}></Text>
                  <Text style={[styles.cellText, styles.columnDescription]}></Text>
                  <Text style={[styles.cellText, styles.columnUnit]}></Text>
                  <Text style={[styles.cellText, styles.columnPrice, styles.totalLabel]}>TOTAL BOMBEO:</Text>
                  <Text style={[styles.cellText, styles.columnTotal]}>$ {pumpServiceTotal.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Page>
      
      <Page size="A4" style={styles.page}>
        <PageBackground />
        <View style={styles.mainContent}>
          {/* Terms and Conditions */}
          <View style={styles.terms}>
            <Text style={styles.termsTitle}>Términos y condiciones comerciales:</Text>
            <View style={styles.termsList}>
              <Text style={styles.termsText}>
                1.- Vigencia de cotización {new Date(quote.created_at).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}.
              </Text>
              <Text style={styles.termsText}>
                {showVAT ? '2.- Precios incluyen IVA 16%.' : '2.- Precios mas IVA 16%.'}
              </Text>
              <Text style={styles.termsText}>3.- Condición de pago: Anticipado.</Text>
              <Text style={styles.termsText}>4.- Condiciones de entrega: programación y confirmación con 24 hrs de anticipación.</Text>
            </View>
          </View>

          {/* Additional Services */}
          <View style={styles.additionalServices}>
            <Text style={styles.termsTitle}>Servicios Adicionales:</Text>
            <View style={styles.termsList}>
              <Text style={styles.termsText}>
                1.- Volumen mínimo de entrega 4m3. Entregas menores se cobra $450 {showVAT ? 'con IVA' : '+ IVA'} por cada m3 vacío.
              </Text>
              <Text style={styles.termsText}>
                2.- Volumen mínimo de bombeo 14 m3 ($3,710 {showVAT ? 'con IVA' : '+ IVA'}).
              </Text>
              <Text style={styles.termsText}>
                3.- Servicio fuera de horario: $1,850 {showVAT ? 'con IVA' : '+ IVA'} por cada hora.
              </Text>
              <Text style={styles.termsText}>
                4.- Apertura de planta en domingo y/o día festivo: $11,500 {showVAT ? 'con IVA' : '+ IVA'} (cargo fijo).
              </Text>
              <Text style={styles.termsText}>
                5.- Resistencia a 14 días*, considerar un incremento en precio de $ 145 {showVAT ? 'con IVA' : '+ IVA'}
              </Text>
              <Text style={styles.termsText}>
                6.- Resistencia a 7 días*, considerar un incremento en precio de $ 200 {showVAT ? 'con IVA' : '+ IVA'}
              </Text>
              <Text style={styles.termsText}>
                7.- Resistencia a 3 días*, considerar un incremento en precio de $ 250 {showVAT ? 'con IVA' : '+ IVA'}
              </Text>
            </View>
            <Text style={styles.smallNote}>*Los concretos de resistencia rápida con características especiales requieren revisión previa a la cotización.</Text>
          </View>

          {/* Signature */}
          <View style={styles.signature}>
            <Text style={styles.signatureText}>Atentamente</Text>
            <Text style={styles.signatureBold}>Enrique Félix Martínez</Text>
            <Text style={styles.signatureBold}>DC CONCRETOS</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default QuotePDF;