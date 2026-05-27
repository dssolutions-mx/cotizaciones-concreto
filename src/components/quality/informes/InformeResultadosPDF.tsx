import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { DC_DOCUMENT_CONTACT } from '@/lib/reports/branding';
import {
  PdfTable,
  PDF_PORTRAIT_TABLE_WIDTH,
  type PdfTableColumn,
} from '@/components/ema/pdf/verificacionPdfTable';
import { verificacionPdfStyles as s } from '@/components/ema/pdf/verificacionPdfStyles';
import type { InformeFirmaRol, InformeSnapshot } from '@/types/informe-ensayo';

type Props = { snapshot: InformeSnapshot };

const FRESH_COLS: PdfTableColumn[] = [
  { key: 'ensayo', label: 'Ensayo', widthPt: 148 },
  { key: 'resultado', label: 'Resultado', widthPt: 148 },
  { key: 'especificado', label: 'Especificado', widthPt: 118 },
  { key: 'conformidad', label: 'C/NC', widthPt: 117, align: 'center' },
];

const COMPRESSION_COLS: PdfTableColumn[] = [
  { key: 'id', label: 'Espécimen', widthPt: 148 },
  { key: 'edad', label: 'Edad', widthPt: 72, align: 'center' },
  { key: 'kn', label: 'kN', widthPt: 88, align: 'right', mono: true },
  { key: 'fc', label: 'kg/cm²', widthPt: 108, align: 'right', mono: true },
  { key: 'conformidad', label: 'C/NC', widthPt: 115, align: 'center' },
];

const FIRMA_LABELS: Record<InformeFirmaRol, { title: string; subtitle: string }> = {
  elaboro: { title: 'Elaboró', subtitle: 'Responsable de la emisión' },
  reviso: { title: 'Revisó', subtitle: 'Revisión técnica' },
  autorizo: { title: 'Autorizó', subtitle: 'Autorización del informe' },
};

const LEGAL = [
  'Este informe de resultados de ensayo se emite conforme a la NMX-EC-17025-IMNC-2018 §7.8 y al procedimiento interno del laboratorio acreditado.',
  'Los resultados se refieren exclusivamente a las muestras y ensayos identificados en este documento. La incertidumbre de medición declarada proviene de estudios publicados en el sistema de gestión metrológica del laboratorio.',
  'Documento controlado generado por el sistema de gestión de calidad del laboratorio. Reproducciones no controladas pueden no reflejar el estado vigente del registro.',
];

function logoSrc(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/images/dc-concretos-logo.png`;
  }
  return '/images/dc-concretos-logo.png';
}

function PdfCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardHeaderText}>{title}</Text>
      </View>
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}

function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={mono ? s.kvValueMono : s.kvValue}>{value}</Text>
    </View>
  );
}

function PdfFooter({ docNumero }: { docNumero: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {DC_DOCUMENT_CONTACT.companyLine} · {docNumero}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

function formatIssuedAt(issuedAt: string | null): string {
  if (!issuedAt) return 'Borrador — sin emitir';
  try {
    return new Date(issuedAt).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return issuedAt;
  }
}

function formatSignedAt(signedAt: string | null): string {
  if (!signedAt) return '';
  try {
    return new Date(signedAt).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return signedAt;
  }
}

function DocumentHeader({ snapshot }: { snapshot: InformeSnapshot }) {
  const doc = snapshot.documento;
  const lab = snapshot.laboratorio;
  const docLine = `${doc.codigo} Rev. ${doc.revision} · ${doc.numero ?? 'BORRADOR'}`;

  return (
    <View style={s.header}>
      <Image src={logoSrc()} style={s.logo} />
      <View style={s.headerText}>
        <Text style={s.docTitle}>INFORME DE RESULTADOS DE ENSAYO</Text>
        <Text style={s.docSubtitle}>{lab.razon_social}</Text>
        <Text style={s.docSubtitle}>{lab.nombre}</Text>
        {lab.acreditacion_ema ? (
          <Text style={s.docSubtitle}>Acreditación EMA: {lab.acreditacion_ema}</Text>
        ) : null}
        <Text style={s.docSubtitle}>
          NMX-EC-17025-IMNC-2018 §7.8 · Informe para el cliente
        </Text>
        <Text style={s.docCode}>{docLine}</Text>
      </View>
    </View>
  );
}

export function InformeResultadosPDF({ snapshot }: Props) {
  const doc = snapshot.documento;
  const lab = snapshot.laboratorio;
  const muestreadoLabel =
    snapshot.muestreo.muestreado_por === 'CLIENTE' ? 'Cliente' : 'Laboratorio acreditado';

  const freshRows = snapshot.resultados_fresco.map((r) => [
    r.ensayo,
    r.uncertainty ? `${r.resultado}\n${r.uncertainty.display}` : r.resultado,
    r.especificado,
    r.conformidad,
  ]);

  const compressionRows = snapshot.resultados_compresion.map((r) => [
    r.identificacion,
    r.edad_dias != null ? `${r.edad_dias} d` : '—',
    r.carga_kn != null ? String(r.carga_kn) : '—',
    r.fc_kg_cm2 != null ? String(r.fc_kg_cm2) : '—',
    r.conformidad,
  ]);

  const firmaSlots: InformeFirmaRol[] = ['elaboro', 'reviso', 'autorizo'];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <DocumentHeader snapshot={snapshot} />

        <View style={s.normaBand}>
          <Text>NMX-EC-17025-IMNC-2018 · Informe de resultados de ensayo (§7.8)</Text>
        </View>

        {!doc.issued_at ? (
          <View
            style={{
              marginBottom: 8,
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: '#FEF3C7',
              borderWidth: 1,
              borderColor: '#F59E0B',
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#92400E', textAlign: 'center' }}>
              BORRADOR — Documento sin emitir. No sustituye el informe oficial con folio y firmas.
            </Text>
          </View>
        ) : null}

        <Text style={s.procedureTitle}>
          Emisión: {formatIssuedAt(doc.issued_at)}
          {doc.replaces_numero ? ` · Reemplaza informe ${doc.replaces_numero}` : ''}
        </Text>

        <PdfCard title="§1 Cliente y obra">
          <Kv label="Cliente" value={snapshot.cliente.nombre} />
          <Kv
            label="Obra / pedido"
            value={`${snapshot.obra.construction_site ?? '—'} · Pedido ${snapshot.obra.order_number ?? '—'}`}
          />
          <Kv label="Elemento" value={snapshot.obra.elemento ?? 'No especificado'} />
          {snapshot.obra.designacion_ehe ? (
            <Kv label="Designación" value={snapshot.obra.designacion_ehe} />
          ) : null}
          <Kv label="Contacto cliente" value={snapshot.cliente.contacto ?? '—'} />
        </PdfCard>

        <PdfCard title="§2 Muestreo y recepción">
          <Kv
            label="Fecha / hora"
            value={`${snapshot.muestreo.fecha_muestreo}${snapshot.muestreo.hora_muestreo ? ` ${snapshot.muestreo.hora_muestreo}` : ''}`}
          />
          <Kv label="Lote / remisión" value={`${snapshot.muestreo.lote_id} · ${snapshot.muestreo.remision_number ?? '—'}`} mono />
          <Kv label="Recepción en laboratorio" value={snapshot.muestreo.fecha_recepcion_lab ?? '—'} />
          <Kv label="Muestreado por" value={muestreadoLabel} />
          <Kv label="Ubicación" value={snapshot.muestreo.ubicacion ?? '—'} />
          <Kv
            label="Condiciones en obra"
            value={[
              snapshot.muestreo.temperatura_ambiente != null
                ? `T amb. ${snapshot.muestreo.temperatura_ambiente} °C`
                : null,
              snapshot.muestreo.humedad_relativa_obra != null
                ? `HR ${snapshot.muestreo.humedad_relativa_obra} %`
                : null,
              snapshot.muestreo.condiciones_climaticas,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          />
          <Kv label="Plan de muestreo" value={snapshot.muestreo.plan_muestreo} />
        </PdfCard>

        <PdfCard title="§3 Resultados — concreto fresco">
          {freshRows.length > 0 ? (
            <PdfTable columns={FRESH_COLS} rows={freshRows} tableWidth={PDF_PORTRAIT_TABLE_WIDTH} />
          ) : (
            <Text style={s.sectionBlockDesc}>Sin ensayos de campo registrados.</Text>
          )}
        </PdfCard>

        <PdfCard title="§3 Resistencia a compresión">
          {compressionRows.length > 0 ? (
            <>
              <PdfTable
                columns={COMPRESSION_COLS}
                rows={compressionRows}
                tableWidth={PDF_PORTRAIT_TABLE_WIDTH}
              />
              <View style={{ marginTop: 6 }}>
                <Kv
                  label="Promedio"
                  value={
                    snapshot.compresion_resumen.promedio_kg_cm2 != null
                      ? `${snapshot.compresion_resumen.promedio_kg_cm2} kg/cm²`
                      : '—'
                  }
                  mono
                />
                <Kv
                  label="f′c especificada"
                  value={
                    snapshot.compresion_resumen.resistencia_especificada != null
                      ? `${snapshot.compresion_resumen.resistencia_especificada} kg/cm²`
                      : '—'
                  }
                  mono
                />
                {snapshot.compresion_resumen.incertidumbre_u ? (
                  <Text style={{ fontSize: 7.5, fontWeight: 'bold', color: '#1B365D', marginTop: 4 }}>
                    Incertidumbre de medición U: {snapshot.compresion_resumen.incertidumbre_u.display}
                  </Text>
                ) : null}
              </View>
            </>
          ) : (
            <Text style={s.sectionBlockDesc}>Sin ensayos de compresión registrados.</Text>
          )}
        </PdfCard>

        {snapshot.condiciones_ensayo.equipos.length > 0 ? (
          <PdfCard title="Equipos utilizados">
            {snapshot.condiciones_ensayo.equipos.map((eq) => (
              <Kv
                key={`${eq.codigo}-${eq.nombre}`}
                label={eq.codigo}
                value={`${eq.nombre}${eq.vencimiento ? ` · vig. ${eq.vencimiento}` : ''}`}
              />
            ))}
          </PdfCard>
        ) : null}

        <PdfCard title="§4 Declaraciones">
          <View style={s.legalBlock}>
            {snapshot.declaraciones.texto_legal.map((t) => (
              <Text key={t} style={s.legalText}>
                {t}
              </Text>
            ))}
            {LEGAL.map((t) => (
              <Text key={t} style={s.legalText}>
                {t}
              </Text>
            ))}
          </View>
          <Kv label="Regla de decisión" value={snapshot.declaraciones.regla_decision} />
          {snapshot.declaraciones.muestreado_por_cliente ? (
            <Text style={{ fontSize: 7.5, color: '#92400E', marginTop: 4 }}>
              El muestreo fue realizado por el cliente (NMX-EC-17025-IMNC-2018 §7.8.6).
            </Text>
          ) : null}
        </PdfCard>

        {snapshot.opinion_tecnica ? (
          <PdfCard title="Opinión e interpretaciones">
            <Text style={s.procedureDesc}>{snapshot.opinion_tecnica}</Text>
          </PdfCard>
        ) : null}

        {snapshot.firmas.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <Text style={s.sectionBlockTitle}>Firmas</Text>
            <View style={s.signatureRow}>
              {firmaSlots.map((rol) => {
                const firma = snapshot.firmas.find((f) => f.rol === rol);
                const meta = FIRMA_LABELS[rol];
                return (
                  <View key={rol} style={s.signatureBox}>
                    <Text style={s.signatureRoleTitle}>{meta.title}</Text>
                    <Text style={s.signatureRoleSubtitle}>{meta.subtitle}</Text>
                    <View style={s.signaturePlaceholder} />
                    <Text style={s.signatureName}>{firma?.nombre ?? '—'}</Text>
                    {firma?.cedula ? (
                      <Text style={s.signatureDate}>Cédula: {firma.cedula}</Text>
                    ) : null}
                    {firma?.signed_at ? (
                      <Text style={s.signatureDate}>Fecha: {formatSignedAt(firma.signed_at)}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <PdfFooter docNumero={doc.numero ?? 'BORRADOR'} />
        <Text style={{ fontSize: 6.5, color: '#78716C', marginTop: 8 }}>
          {lab.pie_pagina ?? `${lab.direccion ?? ''} · ${lab.telefono ?? ''} · ${lab.email ?? ''}`}
        </Text>
      </Page>
    </Document>
  );
}
