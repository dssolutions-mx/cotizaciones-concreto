import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { DC_DOCUMENT_THEME, DC_DOCUMENT_TYPOGRAPHY } from '@/lib/reports/branding';
import type { InformeSnapshot } from '@/types/informe-ensayo';

const T = DC_DOCUMENT_THEME;
const TY = DC_DOCUMENT_TYPOGRAPHY;

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: TY.sizeBody,
    fontFamily: 'Helvetica',
    color: T.textPrimary,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: T.navy,
    paddingBottom: 8,
  },
  logo: { width: 72, height: 36, objectFit: 'contain', marginRight: 12 },
  titleBlock: { flex: 1 },
  mainTitle: { fontSize: TY.sizeH1, fontWeight: 'bold', color: T.navy },
  subTitle: { fontSize: TY.sizeFooter, color: T.textMuted, marginTop: 2 },
  card: { marginBottom: 10, borderWidth: 1, borderColor: T.borderLight },
  cardHeader: {
    backgroundColor: T.surfaceHeader,
    padding: 6,
  },
  cardHeaderText: { color: T.surfaceHeaderText, fontSize: TY.sizeTable, fontWeight: 'bold' },
  cardBody: { padding: 8, backgroundColor: T.surfacePage },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: '38%', fontSize: TY.sizeFooter, color: T.textMuted },
  value: { width: '62%', fontSize: TY.sizeFooter },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: T.surfaceSubtle,
    borderBottomWidth: 1,
    borderBottomColor: T.borderMedium,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: T.borderLight,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  cell: { fontSize: 7 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
    fontSize: 7,
    color: T.textMuted,
    borderTopWidth: 1,
    borderTopColor: T.footerRule,
    paddingTop: 6,
  },
});

type Props = { snapshot: InformeSnapshot };

export function InformeResultadosPDF({ snapshot }: Props) {
  const doc = snapshot.documento;
  const lab = snapshot.laboratorio;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src="/images/dc-concretos-logo.png" style={styles.logo} />
          <View style={styles.titleBlock}>
            <Text style={styles.mainTitle}>INFORME DE RESULTADOS DE ENSAYO</Text>
            <Text style={styles.subTitle}>
              {doc.codigo} Rev. {doc.revision} · {doc.numero ?? 'BORRADOR'}
            </Text>
            <Text style={styles.subTitle}>{lab.razon_social} — {lab.nombre}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderText}>§1 Cliente y obra</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.row}>
              <Text style={styles.label}>Cliente</Text>
              <Text style={styles.value}>{snapshot.cliente.nombre}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Obra / pedido</Text>
              <Text style={styles.value}>
                {snapshot.obra.construction_site ?? '—'} · {snapshot.obra.order_number ?? '—'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Elemento</Text>
              <Text style={styles.value}>{snapshot.obra.elemento ?? 'No especificado'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Acreditación EMA</Text>
              <Text style={styles.value}>{lab.acreditacion_ema ?? '—'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderText}>§2 Muestreo</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.row}>
              <Text style={styles.label}>Fecha / lote</Text>
              <Text style={styles.value}>
                {snapshot.muestreo.fecha_muestreo} · {snapshot.muestreo.lote_id}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Recepción lab</Text>
              <Text style={styles.value}>{snapshot.muestreo.fecha_recepcion_lab ?? '—'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Muestreado por</Text>
              <Text style={styles.value}>{snapshot.muestreo.muestreado_por}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderText}>§3 Concreto fresco</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, { width: '28%' }]}>Ensayo</Text>
              <Text style={[styles.cell, { width: '28%' }]}>Resultado</Text>
              <Text style={[styles.cell, { width: '22%' }]}>Especificado</Text>
              <Text style={[styles.cell, { width: '12%' }]}>C/NC</Text>
            </View>
            {snapshot.resultados_fresco.map((r) => (
              <View key={r.ensayo} style={styles.tableRow}>
                <Text style={[styles.cell, { width: '28%' }]}>{r.ensayo}</Text>
                <Text style={[styles.cell, { width: '28%' }]}>
                  {r.resultado}
                  {r.uncertainty ? `\n${r.uncertainty.display}` : ''}
                </Text>
                <Text style={[styles.cell, { width: '22%' }]}>{r.especificado}</Text>
                <Text style={[styles.cell, { width: '12%' }]}>{r.conformidad}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderText}>§3 Resistencia a compresión</Text>
          </View>
          <View style={styles.cardBody}>
            {snapshot.resultados_compresion.map((r) => (
              <View key={r.identificacion} style={styles.tableRow}>
                <Text style={[styles.cell, { width: '30%' }]}>{r.identificacion}</Text>
                <Text style={[styles.cell, { width: '15%' }]}>{r.edad_dias ?? '—'} d</Text>
                <Text style={[styles.cell, { width: '15%' }]}>{r.carga_kn ?? '—'} kN</Text>
                <Text style={[styles.cell, { width: '20%' }]}>{r.fc_kg_cm2 ?? '—'} kg/cm²</Text>
                <Text style={[styles.cell, { width: '10%' }]}>{r.conformidad}</Text>
              </View>
            ))}
            {snapshot.compresion_resumen.incertidumbre_u && (
              <Text style={{ fontSize: 7, marginTop: 6, fontWeight: 'bold' }}>
                Incertidumbre de medición U: {snapshot.compresion_resumen.incertidumbre_u.display}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderText}>§4 Declaraciones</Text>
          </View>
          <View style={styles.cardBody}>
            {snapshot.declaraciones.texto_legal.map((t) => (
              <Text key={t} style={{ fontSize: 7, marginBottom: 3, color: T.textSecondary }}>
                {t}
              </Text>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          {lab.pie_pagina ?? `${lab.direccion ?? ''} · ${lab.telefono ?? ''}`} · Documento controlado {doc.codigo}
        </Text>
      </Page>
    </Document>
  );
}
