import React from 'react'
import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { DC_DOCUMENT_CONTACT } from '@/lib/reports/branding'
import { effectiveLayout, effectiveSectionRepetitions } from '@/lib/ema/sectionLayout'
import {
  buildMeasurementMap,
  countMeasurementStats,
  formatEsperadoItem,
  formatVerificacionMeasurement,
  sectionItemsForDisplay,
  verificacionCumpleLabel,
} from '@/lib/ema/verificacionFichaModel'
import { metrologiaBudgetForPdf } from '@/lib/ema/rebuildVerificationBudget'
import {
  formatVerificacionCondiciones,
  verificacionPrintMeta,
  VERIFICACION_RESULTADO_LABEL,
} from '@/lib/ema/verificacionPrintMeta'
import { VerificacionUncertaintyBudgetPDF } from '@/components/ema/pdf/VerificacionUncertaintyBudgetPDF'
import {
  PdfTable,
  PDF_PORTRAIT_TABLE_WIDTH,
  buildCoverColumns,
  buildMeasurementDetailColumns,
  buildPatronColumns,
} from '@/components/ema/pdf/verificacionPdfTable'
import { verificacionPdfStyles as s } from '@/components/ema/pdf/verificacionPdfStyles'
import type {
  CompletedVerificacionDetalle,
  VerificacionTemplateItem,
  VerificacionTemplateSection,
} from '@/types/ema'

export type VerificacionPdfLabContext = {
  plantName?: string | null
  acreditacionEma?: string | null
}

export type VerificacionInformePDFProps = {
  items: CompletedVerificacionDetalle[]
  lab?: VerificacionPdfLabContext
  includeCover?: boolean
  generatedAt?: string
}

const ESTADO_DOC: Record<string, string> = {
  cerrado: 'Cerrada',
  firmado_operador: 'Firmada (operador)',
  firmado_revisor: 'Firmada (revisor)',
  en_proceso: 'En proceso',
  cancelado: 'Cancelada',
}

const LEGAL = [
  'Este registro documenta la verificación interna del estado de un instrumento de medición, conforme al procedimiento del laboratorio y a la NMX-EC-17025-IMNC-2018.',
  'La trazabilidad metrológica de las mediciones se establece mediante patrones de referencia calibrados y/o verificados, cuyos certificados o registros internos se citan en este documento.',
  'El presupuesto de incertidumbre (cuando aplica) se elaboró según la Guía GUM (JCGM 100:2008) y constituye evidencia objetiva del cumplimiento del requisito 7.6.',
  'Documento controlado generado por el sistema de gestión de calidad del laboratorio. Reproducciones no controladas pueden no reflejar el estado vigente del registro.',
]

const MEASUREMENT_COLS = buildMeasurementDetailColumns()
const PATRON_COLS = buildPatronColumns()

function logoSrc(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/images/dc-concretos-logo.png`
  }
  return '/images/dc-concretos-logo.png'
}

function PdfFooter({
  registroId,
  instrumentoCodigo,
  section,
}: {
  registroId: string
  instrumentoCodigo?: string
  section?: string
}) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {DC_DOCUMENT_CONTACT.companyLine}
        {instrumentoCodigo ? ` · ${instrumentoCodigo}` : ''}
        {section ? ` · ${section}` : ''} · VER-{registroId.slice(0, 8).toUpperCase()}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}

function PdfCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardHeaderText}>{title}</Text>
      </View>
      <View style={s.cardBody}>{children}</View>
    </View>
  )
}

function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={mono ? s.kvValueMono : s.kvValue}>{value}</Text>
    </View>
  )
}

function DocumentHeader({ lab, docLine }: { lab?: VerificacionPdfLabContext; docLine: string }) {
  return (
    <View style={s.header}>
      <Image src={logoSrc()} style={s.logo} />
      <View style={s.headerText}>
        <Text style={s.docTitle}>REGISTRO DE VERIFICACIÓN INTERNA DE INSTRUMENTOS</Text>
        <Text style={s.docSubtitle}>{DC_DOCUMENT_CONTACT.companyLine}</Text>
        {lab?.plantName ? <Text style={s.docSubtitle}>Planta / ubicación: {lab.plantName}</Text> : null}
        {lab?.acreditacionEma ? (
          <Text style={s.docSubtitle}>Acreditación EMA del laboratorio: {lab.acreditacionEma}</Text>
        ) : null}
        <Text style={s.docSubtitle}>
          NMX-EC-17025-IMNC-2018 · JCGM 100:2008 (GUM) · Documento para entidad de acreditación
        </Text>
        <Text style={s.docCode}>{docLine}</Text>
      </View>
    </View>
  )
}

function MeasurementSectionPdf({
  section,
  mMap,
}: {
  section: VerificacionTemplateSection & { items?: VerificacionTemplateItem[] }
  mMap: ReturnType<typeof buildMeasurementMap>
}) {
  const layout = effectiveLayout(section as VerificacionTemplateSection & { layout?: string })
  const reps = effectiveSectionRepetitions(
    section as VerificacionTemplateSection & { repetible?: boolean; repeticiones_default?: number },
  )
  const items = sectionItemsForDisplay(section)
  const rows: string[][] = []

  for (let rep = 1; rep <= reps; rep++) {
    const repSuffix = reps > 1 ? ` · rep. ${rep}` : ''
    let gridCode = ''
    if (layout === 'instrument_grid') {
      gridCode =
        items
          .map((it) => mMap.get(`${section.id}:${rep}:${it.id}`)?.instance_code)
          .find((c) => c?.trim()) ?? ''
    }

    for (const it of items) {
      const m = mMap.get(`${section.id}:${rep}:${it.id}`)
      let punto = it.punto
      if (gridCode) punto = `[${gridCode}] ${punto}`
      punto += repSuffix

      const error =
        m?.error_calculado != null
          ? m.error_calculado.toFixed(3)
          : '—'

      rows.push([
        punto,
        formatEsperadoItem(it),
        formatVerificacionMeasurement(it, m),
        error,
        verificacionCumpleLabel(m?.cumple),
        m?.observacion?.trim() || '—',
      ])
    }
  }

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.sectionBlockTitle}>{section.titulo}</Text>
      {section.descripcion ? <Text style={s.sectionBlockDesc}>{section.descripcion}</Text> : null}
      {rows.length > 0 ? (
        <PdfTable
          columns={MEASUREMENT_COLS}
          rows={rows}
          fontSize={7}
          tableWidth={PDF_PORTRAIT_TABLE_WIDTH}
        />
      ) : (
        <Text style={{ fontSize: 8, color: '#78716C' }}>Sin lecturas registradas en esta sección.</Text>
      )}
    </View>
  )
}

function VerificacionRecordPages({
  data,
  lab,
  recordIndex,
  recordTotal,
}: {
  data: CompletedVerificacionDetalle
  lab?: VerificacionPdfLabContext
  recordIndex: number
  recordTotal: number
}) {
  const snapshot = data.snapshot
  if (!snapshot?.template) return null

  const template = snapshot.template
  const meta = verificacionPrintMeta(data)
  const mMap = buildMeasurementMap(data.measurements ?? [])
  const stats = countMeasurementStats(data.measurements ?? [])
  const cal = data.instrumento_calibracion
  const budget = metrologiaBudgetForPdf(data.metrologia, cal)
  const unit = cal?.unidad ?? '—'
  const docLine = `VER-${data.id.slice(0, 8).toUpperCase()} · Registro ${recordIndex} de ${recordTotal} · Estado: ${ESTADO_DOC[data.estado] ?? data.estado}`

  const patronRows =
    data.instrumentos_maestro?.map((m) => [
      m.codigo,
      m.nombre,
      m.incertidumbre_expandida != null ? String(m.incertidumbre_expandida) : '—',
      m.incertidumbre_k != null ? String(m.incertidumbre_k) : '—',
      m.incertidumbre_unidad ?? '—',
      m.estado ?? '—',
      m.fecha_proximo_evento ?? '—',
    ]) ?? []

  const elaborado = data.signatures?.find((x) => x.rol === 'elaborado')
  const revisado = data.signatures?.find((x) => x.rol === 'revisado')
  const cond = data.condiciones_ambientales
  const issues = data.issues ?? []
  const evidencias = data.evidencias ?? []

  return (
    <>
      <Page size="A4" style={s.page} wrap>
        <DocumentHeader lab={lab} docLine={docLine} />

        <Text style={s.procedureTitle}>{template.nombre}</Text>
        {template.norma_referencia ? <Text style={s.normaBand}>{template.norma_referencia}</Text> : null}
        {template.descripcion ? <Text style={s.procedureDesc}>{template.descripcion}</Text> : null}

        <PdfCard title="§1 Control del documento y trazabilidad del registro">
          <Kv label="Identificador único" value={`VER-${data.id.slice(0, 8).toUpperCase()}`} mono />
          <Kv label="ID sistema" value={data.id} mono />
          <Kv
            label="Formato / versión"
            value={`${template.codigo ?? '—'} · v${data.template_version_number ?? '—'}`}
            mono
          />
          <Kv label="Fecha de verificación" value={data.fecha_verificacion} mono />
          <Kv label="Próxima verificación" value={data.fecha_proxima_verificacion ?? '—'} mono />
          <Kv label="Estado del registro" value={ESTADO_DOC[data.estado] ?? data.estado} />
        </PdfCard>

        <PdfCard title="§2 Equipo bajo verificación">
          <Kv label="Código" value={meta.instrumentoCodigo ?? '—'} mono />
          <Kv label="Denominación" value={meta.instrumentoNombre ?? '—'} />
          <Kv label="Tipo instrumento" value={data.instrumento?.tipo ?? '—'} />
          <Kv label="Estado operativo" value={data.instrumento?.estado ?? '—'} />
        </PdfCard>

        <PdfCard title="§3 Condiciones ambientales y responsable">
          <Kv label="Condiciones (resumen)" value={formatVerificacionCondiciones(cond) ?? 'No registradas'} />
          {cond?.temperatura ? <Kv label="Temperatura" value={cond.temperatura} /> : null}
          {cond?.humedad ? <Kv label="Humedad relativa" value={cond.humedad} /> : null}
          {cond?.lugar ? <Kv label="Lugar" value={cond.lugar} /> : null}
          <Kv label="Ejecutada por" value={meta.verificador ?? '—'} />
          {elaborado ? (
            <Kv label="Firma elaborado" value={`${elaborado.signer_name} · ${elaborado.signed_at}`} />
          ) : null}
          {revisado ? (
            <Kv label="Firma revisado" value={`${revisado.signer_name} · ${revisado.signed_at}`} />
          ) : null}
        </PdfCard>

        {patronRows.length > 0 && (
          <PdfCard title="§4 Patrones de referencia y trazabilidad metrológica">
            <PdfTable
              columns={PATRON_COLS}
              rows={patronRows}
              fontSize={7.5}
              tableWidth={PDF_PORTRAIT_TABLE_WIDTH}
            />
          </PdfCard>
        )}

        <PdfCard title="§5 Resultado metrológico emitido (verificación interna)">
          <Kv
            label="Certificado / registro interno"
            value={cal?.numero_certificado ?? 'Pendiente de emisión'}
            mono
          />
          <Kv label="Fecha emisión U" value={cal?.fecha_emision ?? '—'} mono />
          <Kv label="Proveedor calibración" value={cal?.proveedor ?? 'Laboratorio interno'} />
          <Kv label="Vigencia" value={cal?.vigente_hasta ?? '—'} mono />
          <Kv
            label="Incertidumbre expandida U"
            value={
              cal?.u_expandida != null
                ? `${cal.u_expandida} ${cal.unidad ?? unit} (k = ${cal.k_factor ?? 2})`
                : '—'
            }
            mono
          />
          {data.metrologia?.tur_min_observado != null && (
            <Kv label="TUR mínimo observado" value={String(data.metrologia.tur_min_observado)} mono />
          )}
          <Kv
            label="Estado presupuesto GUM"
            value={data.metrologia?.gum_rollup_status ?? 'No calculado'}
          />
          {data.metrologia?.gum_rollup_skipped_reason && (
            <Kv label="Detalle GUM" value={data.metrologia.gum_rollup_skipped_reason} />
          )}
        </PdfCard>

        <PdfCard title="§6 Resultados de verificación (lecturas y criterios de aceptación)">
          <View style={s.summaryStrip}>
            <Text style={s.summaryItem}>Ítems con dictamen: {stats.total}</Text>
            <Text style={s.summaryItem}>Cumple: {stats.cumple}</Text>
            <Text style={s.summaryItem}>No cumple: {stats.noCumple}</Text>
          </View>
          {(snapshot.sections ?? []).map((sec) => (
            <MeasurementSectionPdf key={sec.id} section={sec} mMap={mMap} />
          ))}
          {evidencias.length > 0 && (
            <Kv label="Evidencias adjuntas" value={`${evidencias.length} archivo(s) en el expediente digital`} />
          )}
          {issues.length > 0 && (
            <View style={{ marginTop: 6 }}>
              <Text style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 4 }}>No conformidades / observaciones</Text>
              {issues.map((iss, i) => (
                <Text key={iss.id ?? i} style={{ fontSize: 7.5, marginBottom: 2, color: '#44403C' }}>
                  · {iss.descripcion || 'Incidencia registrada'}
                </Text>
              ))}
            </View>
          )}
        </PdfCard>

        <PdfCard title="§8 Dictamen de la verificación interna">
          <View style={s.dictamenBox}>
            <Text style={s.dictamenLabel}>Resultado global</Text>
            <Text style={s.dictamenValue}>
              {VERIFICACION_RESULTADO_LABEL[data.resultado] ?? meta.resultado ?? data.resultado}
            </Text>
          </View>
          {meta.observaciones ? <Kv label="Observaciones generales" value={meta.observaciones} /> : null}
        </PdfCard>

        <PdfCard title="§9 Declaraciones y validez">
          {LEGAL.map((t, i) => (
            <Text key={i} style={s.legalText}>
              {i + 1}. {t}
            </Text>
          ))}
        </PdfCard>

        <View style={s.signatureRow}>
          <View style={s.signatureBox}>
            <Text style={s.signatureLabel}>Elaboró (operador de verificación)</Text>
            {elaborado ? (
              <Text style={s.signatureName}>{elaborado.signer_name}</Text>
            ) : (
              <Text style={s.signatureName}>{meta.verificador ?? '________________________'}</Text>
            )}
          </View>
          <View style={s.signatureBox}>
            <Text style={s.signatureLabel}>Revisó (responsable técnico)</Text>
            {revisado ? (
              <Text style={s.signatureName}>{revisado.signer_name}</Text>
            ) : (
              <Text style={s.signatureName}>________________________</Text>
            )}
          </View>
        </View>

        <PdfFooter
          registroId={data.id}
          instrumentoCodigo={data.instrumento?.codigo}
          section="Registro de verificación"
        />
      </Page>

      <VerificacionUncertaintyBudgetPDF
        budget={budget}
        unit={unit}
        metrologiaStatus={data.metrologia?.gum_rollup_status ?? null}
        skippedReason={data.metrologia?.gum_rollup_skipped_reason}
        turMin={data.metrologia?.tur_min_observado}
        certificado={cal?.numero_certificado}
        registroId={data.id}
        instrumentoCodigo={data.instrumento?.codigo}
      />
    </>
  )
}

function CoverPage({
  items,
  lab,
  generatedAt,
}: {
  items: CompletedVerificacionDetalle[]
  lab?: VerificacionPdfLabContext
  generatedAt: string
}) {
  const coverCols = buildCoverColumns()
  const rows = items.map((v, i) => {
    const cal = v.instrumento_calibracion
    return [
      String(i + 1),
      v.id.slice(0, 8).toUpperCase(),
      `${v.instrumento?.codigo ?? '—'} — ${v.instrumento?.nombre ?? '—'}`,
      v.fecha_verificacion,
      VERIFICACION_RESULTADO_LABEL[v.resultado] ?? v.resultado,
      `${v.snapshot?.template?.codigo ?? '—'} v${v.template_version_number ?? '—'}`,
      cal?.u_expandida != null ? `${cal.u_expandida} ${cal.unidad ?? ''}` : '—',
      v.metrologia?.tur_min_observado != null ? v.metrologia.tur_min_observado.toFixed(1) : '—',
    ]
  })

  return (
    <Page size="A4" style={s.page}>
      <DocumentHeader
        lab={lab}
        docLine={`Informe consolidado · ${items.length} registro(s) · Emitido ${generatedAt}`}
      />
      <Text style={s.coverTitle}>Índice de registros de verificación interna</Text>
      <Text style={s.coverMeta}>
        Cada registro incluye: identificación del equipo, patrones de referencia, resultados de
        verificación (punto / esperado / observado / error / dictamen), presupuesto de incertidumbre GUM
        (cuando aplique) y dictamen conforme a NMX-EC-17025-IMNC-2018.
      </Text>
      <PdfTable
        columns={coverCols}
        rows={rows}
        fontSize={7}
        tableWidth={PDF_PORTRAIT_TABLE_WIDTH}
      />
      <PdfFooter registroId={items[0]?.id ?? 'informe'} section="Índice" />
    </Page>
  )
}

export function VerificacionInformePDF({
  items,
  lab,
  includeCover,
  generatedAt,
}: VerificacionInformePDFProps) {
  const issued =
    generatedAt ??
    new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  const showCover = includeCover ?? items.length > 1

  return (
    <Document
      title={
        items.length === 1
          ? `VER-${items[0]?.id.slice(0, 8)} ${items[0]?.instrumento?.codigo ?? ''}`
          : `Informe verificaciones (${items.length})`
      }
      author={DC_DOCUMENT_CONTACT.companyLine}
    >
      {showCover && items.length > 0 ? (
        <CoverPage items={items} lab={lab} generatedAt={issued} />
      ) : null}
      {items.map((data, index) => (
        <VerificacionRecordPages
          key={data.id}
          data={data}
          lab={lab}
          recordIndex={index + 1}
          recordTotal={items.length}
        />
      ))}
    </Document>
  )
}
