import React from 'react'
import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { DC_DOCUMENT_CONTACT } from '@/lib/reports/branding'
import { effectiveLayout, effectiveSectionRepetitions } from '@/lib/ema/sectionLayout'
import {
  buildMeasurementMap,
  formatVerificacionMeasurement,
  sectionItemsForDisplay,
  verificacionCumpleLabel,
  verificacionRowCumple,
} from '@/lib/ema/verificacionFichaModel'
import { verificacionPrintMeta, VERIFICACION_RESULTADO_LABEL } from '@/lib/ema/verificacionPrintMeta'
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
  /** When true and items.length > 1, prepend an index cover page. */
  includeCover?: boolean
  generatedAt?: string
}

function logoSrc(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/images/dc-concretos-logo.png`
  }
  return '/images/dc-concretos-logo.png'
}

function PdfFooter({
  registroId,
  instrumentoCodigo,
}: {
  registroId: string
  instrumentoCodigo?: string
}) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {DC_DOCUMENT_CONTACT.companyLine}
        {instrumentoCodigo ? ` · ${instrumentoCodigo}` : ''} · Reg. {registroId.slice(0, 8).toUpperCase()}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}

function MetaGrid({ meta }: { meta: ReturnType<typeof verificacionPrintMeta> }) {
  const rows = [
    meta.instrumentoCodigo && { label: 'Código', value: meta.instrumentoCodigo },
    meta.instrumentoNombre && { label: 'Instrumento', value: meta.instrumentoNombre },
    meta.fechaVerificacion && { label: 'Fecha verificación', value: meta.fechaVerificacion },
    meta.fechaProxima && { label: 'Próxima verificación', value: meta.fechaProxima },
    meta.resultado && { label: 'Resultado', value: meta.resultado },
    meta.verificador && { label: 'Registrado por', value: meta.verificador },
  ].filter(Boolean) as { label: string; value: string }[]

  if (!rows.length) return null

  return (
    <View style={s.metaGrid}>
      {rows.map((row) => (
        <View key={row.label} style={s.metaRow}>
          <Text style={s.metaLabel}>{row.label}</Text>
          <Text style={s.metaValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  )
}

function SectionTable({
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
  const colCount = items.length + (layout === 'instrument_grid' ? 1 : 0) + 1
  const cellStyle = colCount > 6 ? s.tdMono : s.td

  const headerCells: React.ReactNode[] = []
  if (layout === 'instrument_grid') {
    headerCells.push(
      <Text key="code-h" style={s.th}>
        Código
      </Text>,
    )
  }
  for (const it of items) {
    headerCells.push(
      <Text key={it.id} style={s.th}>
        {it.punto}
      </Text>,
    )
  }
  headerCells.push(
    <Text key="cumple-h" style={[s.th, { width: 48, flexGrow: 0 }]}>
      ¿Cumple?
    </Text>,
  )

  const bodyRows = Array.from({ length: reps }, (_, i) => i + 1).map((rep, rowIdx) => {
    const rowStyle = rowIdx % 2 === 1 ? s.tableRowAlt : s.tableRow
    const cells: React.ReactNode[] = []
    if (layout === 'instrument_grid') {
      const code =
        items
          .map((it) => mMap.get(`${section.id}:${rep}:${it.id}`)?.instance_code)
          .find((c) => c?.trim()) ?? '—'
      cells.push(
        <Text key="code" style={cellStyle}>
          {code}
        </Text>,
      )
    }
    for (const it of items) {
      const m = mMap.get(`${section.id}:${rep}:${it.id}`)
      cells.push(
        <Text key={it.id} style={cellStyle}>
          {formatVerificacionMeasurement(it, m)}
        </Text>,
      )
    }
    cells.push(
      <Text key="cumple" style={s.tdCumple}>
        {verificacionCumpleLabel(verificacionRowCumple(section.id, rep, items, mMap))}
      </Text>,
    )
    return (
      <View key={rep} style={rowStyle}>
        {cells}
      </View>
    )
  })

  return (
    <View>
      <View style={s.sectionTitle}>
        <Text>
          {section.titulo}
          {layout ? ` (${layout})` : ''}
        </Text>
      </View>
      {section.descripcion ? <Text style={s.sectionDesc}>{section.descripcion}</Text> : null}
      <View style={s.tableHeader}>{headerCells}</View>
      {bodyRows}
    </View>
  )
}

function VerificacionFichaPages({
  data,
  lab,
}: {
  data: CompletedVerificacionDetalle
  lab?: VerificacionPdfLabContext
}) {
  const snapshot = data.snapshot
  if (!snapshot?.template) {
    return (
      <Page size="A4" style={s.page} wrap>
        <Text>Verificación sin snapshot de plantilla ({data.id.slice(0, 8)}).</Text>
        <PdfFooter registroId={data.id} />
      </Page>
    )
  }

  const template = snapshot.template
  const meta = verificacionPrintMeta(data)
  const mMap = buildMeasurementMap(data.measurements ?? [])
  const sections = snapshot.sections ?? []

  return (
    <Page size="A4" style={s.page} wrap>
      <View style={s.header}>
        <Image src={logoSrc()} style={s.logo} />
        <View style={s.headerText}>
          <Text style={s.docTitle}>REGISTRO DE VERIFICACIÓN INTERNA</Text>
          <Text style={s.docSubtitle}>
            {DC_DOCUMENT_CONTACT.companyLine}
            {lab?.plantName ? ` · ${lab.plantName}` : ''}
          </Text>
          {lab?.acreditacionEma ? (
            <Text style={s.docSubtitle}>Acreditación EMA: {lab.acreditacionEma}</Text>
          ) : null}
          <Text style={s.docSubtitle}>
            NMX-EC-17025-IMNC-2018 · Documento para revisión de acreditación
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1B365D', marginBottom: 4, textAlign: 'center' }}>
        {template.nombre}
      </Text>
      {template.norma_referencia ? <Text style={s.normaBand}>{template.norma_referencia}</Text> : null}
      {template.descripcion ? <Text style={s.templateDesc}>{template.descripcion}</Text> : null}

      <MetaGrid meta={meta} />

      {(meta.condiciones || meta.observaciones) && (
        <View style={s.notesBox}>
          {meta.condiciones ? <Text>Condiciones: {meta.condiciones}</Text> : null}
          {meta.observaciones ? <Text>Observaciones: {meta.observaciones}</Text> : null}
        </View>
      )}

      {data.instrumentos_maestro && data.instrumentos_maestro.length > 0 && (
        <Text style={[s.notesBox, { marginBottom: 6 }]}>
          Patrones:{' '}
          {data.instrumentos_maestro.map((m) => `${m.codigo} (${m.nombre})`).join(' · ')}
        </Text>
      )}

      {sections.map((sec) => (
        <SectionTable key={sec.id} section={sec} mMap={mMap} />
      ))}

      <PdfFooter registroId={data.id} instrumentoCodigo={data.instrumento?.codigo} />
    </Page>
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
  return (
    <Page size="A4" style={s.page}>
      <View style={s.header}>
        <Image src={logoSrc()} style={s.logo} />
        <View style={s.headerText}>
          <Text style={s.docTitle}>INFORME DE VERIFICACIONES INTERNAS</Text>
          <Text style={s.docSubtitle}>{DC_DOCUMENT_CONTACT.companyLine}</Text>
          {lab?.plantName ? <Text style={s.docSubtitle}>Planta: {lab.plantName}</Text> : null}
          {lab?.acreditacionEma ? (
            <Text style={s.docSubtitle}>Acreditación EMA: {lab.acreditacionEma}</Text>
          ) : null}
        </View>
      </View>

      <Text style={s.coverTitle}>Índice de registros</Text>
      <Text style={s.coverMeta}>Fecha de emisión del informe: {generatedAt}</Text>
      <Text style={s.coverMeta}>Total de verificaciones: {items.length}</Text>

      <View style={{ marginTop: 10, borderWidth: 1, borderColor: '#D6D3D1' }}>
        <View style={[s.tableHeader, { backgroundColor: '#1B365D' }]}>
          <Text style={[s.th, { width: 24, flexGrow: 0 }]}>#</Text>
          <Text style={s.th}>Instrumento</Text>
          <Text style={[s.th, { width: 72, flexGrow: 0 }]}>Fecha</Text>
          <Text style={[s.th, { width: 64, flexGrow: 0 }]}>Resultado</Text>
          <Text style={s.th}>Plantilla</Text>
        </View>
        {items.map((v, i) => (
          <View key={v.id} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
            <Text style={[s.td, { width: 24, flexGrow: 0 }]}>{i + 1}</Text>
            <Text style={s.td}>
              {v.instrumento?.codigo ?? '—'} — {v.instrumento?.nombre ?? '—'}
            </Text>
            <Text style={[s.tdMono, { width: 72, flexGrow: 0 }]}>{v.fecha_verificacion}</Text>
            <Text style={[s.td, { width: 64, flexGrow: 0 }]}>
              {VERIFICACION_RESULTADO_LABEL[v.resultado] ?? v.resultado}
            </Text>
            <Text style={s.tdMono}>
              {v.snapshot?.template?.codigo ?? '—'}
              {v.template_version_number != null ? ` v${v.template_version_number}` : ''}
            </Text>
          </View>
        ))}
      </View>

      <PdfFooter registroId={items[0]?.id ?? 'informe'} />
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
          ? `Verificación ${items[0]?.instrumento?.codigo ?? ''} ${items[0]?.fecha_verificacion ?? ''}`
          : `Informe verificaciones (${items.length})`
      }
      author={DC_DOCUMENT_CONTACT.companyLine}
    >
      {showCover && items.length > 0 ? (
        <CoverPage items={items} lab={lab} generatedAt={issued} />
      ) : null}
      {items.map((data) => (
        <VerificacionFichaPages key={data.id} data={data} lab={lab} />
      ))}
    </Document>
  )
}
