import React from 'react'
import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { registerEmaPdfFonts } from '@/lib/reports/registerEmaPdfFonts'

registerEmaPdfFonts()
import { DC_DOCUMENT_CONTACT } from '@/lib/reports/branding'
import { PdfTable } from '@/components/ema/pdf/verificacionPdfTable'
import { verificacionPdfStyles as s } from '@/components/ema/pdf/verificacionPdfStyles'
import {
  buildBudgetPdfColumns,
  buildBudgetPdfRows,
  buildTraceabilityPdfColumns,
  buildTraceabilityPdfRows,
  fmtPdfExp,
  fmtPdfFixed,
  formatEnvOverridesSummary,
  formatExcludedInputs,
  formatStudyEstado,
  PDF_LANDSCAPE_TABLE_WIDTH,
  pdfTableWidthInsideCard,
  studyShortId,
  uniqueNormRefsFromComponents,
} from '@/lib/ema/uncertaintyInformePdfModel'
import {
  buildReplicaPdfColumns,
  buildReplicaPdfRows,
  replicaPdfTableWidth,
  replicaSectionUsesLandscape,
  type ReplicaPdfInformeContext,
} from '@/lib/ema/uncertaintyInformeReplicaPdf'
import {
  PDF_NU_EFF,
  PDF_X_MEDIA,
  pdfFormatNuEffValue,
  pdfSanitizeMetrologyText,
} from '@/lib/ema/uncertaintyPdfMetrologyText'
import type { UncertaintyStudyInformeDetalle } from '@/types/ema-uncertainty'

export type UncertaintyPdfLabContext = {
  plantName?: string | null
  acreditacionEma?: string | null
}

export type UncertaintyInformePDFProps = {
  informe: UncertaintyStudyInformeDetalle
  lab?: UncertaintyPdfLabContext
  generatedAt?: string
}

const LEGAL = [
  'Este registro documenta la evaluación de incertidumbre de medición del mensurando indicado, conforme al procedimiento del laboratorio y a la NMX-EC-17025-IMNC-2018 §7.6.',
  'El presupuesto de incertidumbre se elaboró según la Guía JCGM 100:2008 (GUM). La incertidumbre expandida U se obtiene como U = k * u_c, con k de la distribución t de Student para el nivel de confianza aproximado del 95 % y los grados de libertad efectivos nu_eff (GUM §6.2, §6.3).',
  'Documento controlado generado por el sistema de gestión de calidad del laboratorio. Reproducciones no controladas pueden no reflejar el estado vigente del registro.',
]

const TRACEABILITY_COLS = buildTraceabilityPdfColumns()

function logoSrc(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/images/dc-concretos-logo.png`
  }
  return '/images/dc-concretos-logo.png'
}

function PdfFooter({
  studyId,
  measurandCode,
  section,
}: {
  studyId: string
  measurandCode: string
  section?: string
}) {
  return (
    <View style={s.footer}>
      <Text>
        {DC_DOCUMENT_CONTACT.companyLine}
        {` · ${measurandCode}`}
        {section ? ` · ${section}` : ''}
        {` · ${studyShortId(studyId)}`}
      </Text>
      <Text render={({ pageNumber }) => `Página ${pageNumber}`} />
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

function DocumentHeader({
  lab,
  docLine,
}: {
  lab?: UncertaintyPdfLabContext
  docLine: string
}) {
  return (
    <View style={s.header}>
      <Image src={logoSrc()} style={s.logo} />
      <View style={s.headerText}>
        <Text style={s.docTitle}>REGISTRO DE EVALUACIÓN DE INCERTIDUMBRE DE MEDICIÓN</Text>
        <Text style={s.docSubtitle}>{DC_DOCUMENT_CONTACT.companyLine}</Text>
        {lab?.plantName ? (
          <Text style={s.docSubtitle}>Planta / ubicación: {lab.plantName}</Text>
        ) : null}
        {lab?.acreditacionEma ? (
          <Text style={s.docSubtitle}>Acreditación EMA del laboratorio: {lab.acreditacionEma}</Text>
        ) : null}
        <Text style={s.docSubtitle}>
          NMX-EC-17025-IMNC-2018 §7.6 · JCGM 100:2008 (GUM) · Documento para entidad de
          acreditación
        </Text>
        <Text style={s.docCode}>{docLine}</Text>
      </View>
    </View>
  )
}

function BudgetSectionPdf({
  informe,
}: {
  informe: UncertaintyStudyInformeDetalle
}) {
  const { budget, measurand } = informe
  const unit = measurand.unidad
  const cols = buildBudgetPdfColumns()
  const structured = buildBudgetPdfRows(budget.components, unit)
  const componentTableRows = structured
    .filter((r): r is { kind: 'component'; cells: string[] } => r.kind === 'component')
    .map((r) => r.cells)

  return (
    <>
      <View style={s.summaryStrip}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 4 }}>
          <Text style={[s.summaryItem, { marginRight: 0, minWidth: 120 }]}>
            {PDF_X_MEDIA} = {fmtPdfFixed(budget.mean_value, 4)} {unit}
          </Text>
          <Text style={[s.summaryItem, { marginRight: 0, minWidth: 120 }]}>
            u_c = {fmtPdfExp(budget.u_c)} {unit}
          </Text>
          <Text style={[s.summaryItem, { marginRight: 0, minWidth: 72 }]}>
            {PDF_NU_EFF} = {pdfFormatNuEffValue(budget.nu_eff)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <Text style={[s.summaryItem, { marginRight: 0, minWidth: 72 }]}>
            k = {fmtPdfFixed(budget.k, 4)}
          </Text>
          <Text style={[s.summaryItem, { marginRight: 0, minWidth: 140 }]}>
            U = {fmtPdfExp(budget.U)} {unit}
            {budget.U_rel_pct != null ? ` (${budget.U_rel_pct.toFixed(2)} % rel.)` : ''}
          </Text>
        </View>
      </View>

      {structured.map((row, idx) => {
        if (row.kind === 'header_a') {
          return (
            <Text key={`ha-${idx}`} style={s.sectionBlockTitle}>
              Tipo A — evaluación estadística (GUM §4.2)
            </Text>
          )
        }
        if (row.kind === 'header_b') {
          return (
            <Text key={`hb-${idx}`} style={s.sectionBlockTitle}>
              Tipo B — evaluación no estadística (GUM §4.3)
            </Text>
          )
        }
        if (row.kind === 'footer_sum' || row.kind === 'footer_uc') {
          return (
            <Text key={`f-${idx}`} style={{ fontSize: 7.5, textAlign: 'right', marginBottom: 2 }}>
              {row.cells[8]} {row.cells[9]} {row.cells[12]}
            </Text>
          )
        }
        return null
      })}

      <PdfTable
        columns={cols}
        rows={componentTableRows}
        fontSize={6}
        tableWidth={PDF_LANDSCAPE_TABLE_WIDTH}
      />
    </>
  )
}

export function UncertaintyInformePDF({
  informe,
  lab: labOverride,
  generatedAt,
}: UncertaintyInformePDFProps) {
  const { study, measurand, budget, publisher } = informe
  const lab = labOverride ?? informe.lab
  const issued =
    generatedAt ??
    new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

  const docCodigo = study.documento_codigo ?? `${measurand.documento_codigo ?? measurand.codigo}-${study.fecha_estudio}`
  const docLine = `${docCodigo} · ${studyShortId(study.id)} · Estado: ${formatStudyEstado(study.estado)} · Emitido ${issued}`

  const replicaCtx: ReplicaPdfInformeContext = {
    study,
    measurand,
    instrument_lookup: informe.instrument_lookup,
  }
  const replicaLandscape = replicaSectionUsesLandscape(replicaCtx)
  const replicaCols = buildReplicaPdfColumns(replicaCtx)
  const replicaRows = buildReplicaPdfRows(replicaCtx)
  const replicaTableWidth = replicaPdfTableWidth(replicaCtx)
  const traceRows = buildTraceabilityPdfRows(informe.instrument_traceability)
  const normRefs = uniqueNormRefsFromComponents(budget.components)

  const publishedAtLabel = study.published_at
    ? new Date(study.published_at).toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  const computedAtLabel = new Date(informe.budget_computed_at).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Document
      title={`${docCodigo} — ${measurand.nombre}`}
      author={DC_DOCUMENT_CONTACT.companyLine}
    >
      <Page size="A4" style={s.page}>
        <DocumentHeader lab={lab} docLine={docLine} />

        <Text style={s.procedureTitle}>{measurand.nombre}</Text>
        {measurand.metodo_norma ? <Text style={s.normaBand}>{measurand.metodo_norma}</Text> : null}
        {measurand.formula_descr ? (
          <Text style={s.procedureDesc}>{measurand.formula_descr}</Text>
        ) : null}

        <PdfCard title="§1 Control del documento y trazabilidad del registro">
          <Kv label="Identificador único" value={studyShortId(study.id)} mono />
          <Kv label="ID sistema" value={study.id} mono />
          <Kv label="Código de documento" value={docCodigo} mono />
          <Kv label="Fecha del estudio" value={study.fecha_estudio} mono />
          <Kv label="Estado" value={formatStudyEstado(study.estado)} />
          <Kv label="Publicado el" value={publishedAtLabel} mono />
          <Kv
            label="Publicado por"
            value={publisher?.full_name ?? publisher?.email ?? '—'}
          />
          <Kv label="Vigencia hasta" value={study.valid_until ?? 'Indefinida'} mono />
          <Kv label="Presupuesto congelado el" value={computedAtLabel} mono />
        </PdfCard>

        <PdfCard title="§2 Mensurando y método de medición">
          <Kv label="Código mensurando" value={measurand.codigo} mono />
          <Kv label="Unidad del mensurando" value={measurand.unidad} />
          <Kv label="Método / norma" value={measurand.metodo_norma} />
          {measurand.formula_expr ? (
            <Kv label="Modelo matemático" value={measurand.formula_expr} mono />
          ) : null}
          {measurand.documento_codigo ? (
            <Kv label="Procedimiento documentado" value={measurand.documento_codigo} mono />
          ) : null}
        </PdfCard>

        <PdfCard title="§3 Diseño del estudio">
          <Kv label="Número de réplicas" value={String(study.n_replicas)} mono />
          <Kv
            label="Operadores participantes"
            value={
              informe.equipo_operators.length > 0
                ? informe.equipo_operators.map((o) => o.full_name).join('; ')
                : 'No definido en el pool'
            }
          />
          {informe.equipo_instruments.length > 0 ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 4 }}>
                Instrumentos del estudio (rol metrológico)
              </Text>
              {informe.equipo_instruments.map((inst) => (
                <Kv
                  key={inst.instrumento_id}
                  label={inst.role_label}
                  value={`${inst.codigo} — ${inst.nombre}`}
                  mono
                />
              ))}
            </View>
          ) : (
            <Kv label="Instrumentos del estudio" value="No definido en el pool" />
          )}
          <Kv
            label="Variables excluidas del presupuesto"
            value={formatExcludedInputs(measurand, study.excluded_input_simbolos)}
          />
          <Kv
            label="Parámetros de ensayo (env.)"
            value={formatEnvOverridesSummary(study.env_overrides)}
          />
          {study.notas?.trim() ? <Kv label="Notas del estudio" value={study.notas.trim()} /> : null}
        </PdfCard>

        <PdfFooter studyId={study.id} measurandCode={measurand.codigo} section="Identificación" />
      </Page>

      <Page
        size="A4"
        orientation={replicaLandscape ? 'landscape' : 'portrait'}
        style={replicaLandscape ? s.pageLandscape : s.page}
      >
        <PdfCard title="§4 Datos experimentales (réplicas)">
          {informe.equipo_instruments.length > 1 ? (
            <Text style={{ fontSize: 7.5, color: '#57534E', marginBottom: 6 }}>
              Cada réplica registra el instrumento asignado por rol (prensa / vernier, etc.), igual
              que en el espacio de trabajo del estudio.
            </Text>
          ) : null}
          {replicaRows.length > 0 ? (
            <PdfTable
              columns={replicaCols}
              rows={replicaRows}
              fontSize={replicaLandscape ? 6 : 6.5}
              headerFontSize={replicaLandscape ? 5.5 : 6}
              tableWidth={replicaTableWidth}
              compact={replicaLandscape}
            />
          ) : (
            <Text style={{ fontSize: 8, color: '#78716C' }}>Sin réplicas registradas.</Text>
          )}
        </PdfCard>

        {informe.custom_inputs.length > 0 && (
          <PdfCard title="Variables adicionales definidas en el estudio">
            {informe.custom_inputs.map((ci) => (
              <Kv
                key={ci.id}
                label={`${ci.nombre_display} (${ci.simbolo}, Tipo ${ci.tipo_ab})`}
                value={ci.descripcion?.trim() || '—'}
              />
            ))}
          </PdfCard>
        )}

        <PdfFooter studyId={study.id} measurandCode={measurand.codigo} section="Réplicas" />
      </Page>

      <Page size="A4" style={s.page}>
        <PdfCard title="§5 Trazabilidad metrológica de instrumentos">
          {traceRows.length > 0 ? (
            <PdfTable
              columns={TRACEABILITY_COLS}
              rows={traceRows}
              fontSize={7}
              tableWidth={pdfTableWidthInsideCard(false)}
            />
          ) : (
            <Text style={{ fontSize: 8, color: '#78716C' }}>
              Sin instrumentos vinculados al estudio.
            </Text>
          )}
        </PdfCard>

        <PdfFooter
          studyId={study.id}
          measurandCode={measurand.codigo}
          section="Trazabilidad"
        />
      </Page>

      <Page size="A4" orientation="landscape" style={s.pageLandscape}>
        <Text style={s.sectionBlockTitle}>§6 Presupuesto de incertidumbre (GUM)</Text>
        <BudgetSectionPdf informe={informe} />
        <PdfFooter
          studyId={study.id}
          measurandCode={measurand.codigo}
          section="Presupuesto"
        />
      </Page>

      <Page size="A4" style={s.page}>
        <PdfCard title="§7 Incertidumbre expandida declarada">
          <View style={s.dictamenBox}>
            <Text style={s.dictamenLabel}>U (k = {fmtPdfFixed(budget.k, 2)})</Text>
            <Text style={s.dictamenValue}>
              {fmtPdfExp(budget.U)} {measurand.unidad}
            </Text>
          </View>
          <Kv label="u_c combinada" value={`${fmtPdfExp(budget.u_c)} ${measurand.unidad}`} mono />
          <Kv
            label={`Media del mensurando (${PDF_X_MEDIA})`}
            value={`${fmtPdfFixed(budget.mean_value, 4)} ${measurand.unidad}`}
            mono
          />
          {informe.previous_u_expandida != null && (
            <Kv
              label="U anterior (estudio reemplazado)"
              value={`${fmtPdfExp(informe.previous_u_expandida)} ${measurand.unidad}`}
              mono
            />
          )}
        </PdfCard>

        <PdfCard title="§8 Referencias normativas">
          {(measurand.gum_references_json ?? []).map((ref, i) => (
            <Text key={`gum-${i}`} style={s.legalText}>
              · {ref.step}: {ref.ref} — {pdfSanitizeMetrologyText(ref.formula)}
            </Text>
          ))}
          {normRefs.length > 0 && (
            <Text style={{ ...s.legalText, marginTop: 6, fontWeight: 'bold' }}>
              Cláusulas citadas en el presupuesto:
            </Text>
          )}
          {normRefs.map((ref, i) => (
            <Text key={`nr-${i}`} style={s.legalText}>
              · {pdfSanitizeMetrologyText(ref)}
            </Text>
          ))}
        </PdfCard>

        <PdfCard title="§9 Declaraciones y validez">
          {LEGAL.map((t, i) => (
            <Text key={i} style={s.legalText}>
              {i + 1}. {t}
            </Text>
          ))}
        </PdfCard>

        <PdfCard title="§10 Autorización de publicación">
          <View style={s.signatureRow}>
            <View style={s.signatureBox}>
              <Text style={s.signatureRoleTitle}>Publicó el estudio</Text>
              <Text style={s.signatureRoleSubtitle}>
                Responsable de la evaluación de incertidumbre
              </Text>
              <View style={s.signaturePlaceholder} />
              <Text style={s.signatureName}>{publisher?.full_name ?? '—'}</Text>
              {study.published_at ? (
                <Text style={s.signatureDate}>Fecha: {publishedAtLabel}</Text>
              ) : null}
            </View>
          </View>
        </PdfCard>

        <PdfFooter studyId={study.id} measurandCode={measurand.codigo} section="Resultado" />
      </Page>
    </Document>
  )
}
