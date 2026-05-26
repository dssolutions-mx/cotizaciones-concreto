import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { verificacionPdfStyles as s } from '@/components/ema/pdf/verificacionPdfStyles'

/** Usable width inside A4 portrait with 32pt horizontal padding (595.28 - 64). */
export const PDF_PORTRAIT_TABLE_WIDTH = 531

/** Usable width inside A4 landscape with 24pt horizontal padding (841.89 - 48). */
export const PDF_LANDSCAPE_TABLE_WIDTH = 794

export type PdfTableColumn = {
  key: string
  label: string
  /** Absolute width in points — required for stable react-pdf layout. */
  widthPt: number
  align?: 'left' | 'center' | 'right'
  mono?: boolean
}

function cellStyle(col: PdfTableColumn, isHeader: boolean) {
  return {
    width: col.widthPt,
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: 4,
    paddingHorizontal: 4,
    justifyContent: 'center' as const,
    borderRightWidth: 1,
    borderRightColor: isHeader ? '#ffffff50' : '#E7E5E4',
  }
}

export function PdfTable({
  columns,
  rows,
  fontSize = 7.5,
  tableWidth,
}: {
  columns: PdfTableColumn[]
  rows: string[][]
  fontSize?: number
  tableWidth?: number
}) {
  const computedWidth = tableWidth ?? columns.reduce((sum, c) => sum + c.widthPt, 0)

  return (
    <View style={[s.tableFrame, { width: computedWidth }]}>
      <View style={[s.tableHeaderRow, { width: computedWidth }]}>
        {columns.map((col) => (
          <View key={col.key} style={cellStyle(col, true)}>
            <Text
              style={[
                s.tableHeaderText,
                { fontSize, textAlign: col.align ?? 'left' },
              ]}
            >
              {col.label}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={[
            rowIdx % 2 === 1 ? s.tableBodyRowAlt : s.tableBodyRow,
            { width: computedWidth },
          ]}
        >
          {row.map((cell, colIdx) => {
            const col = columns[colIdx]
            if (!col) return null
            return (
              <View key={col.key} style={cellStyle(col, false)}>
                <Text
                  style={[
                    col.mono ? s.tableCellMono : s.tableCellText,
                    { fontSize, textAlign: col.align ?? 'left' },
                  ]}
                >
                  {cell}
                </Text>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

/** Distribute total width across weight units (integers). */
export function widthsFromWeights(weights: number[], totalPt: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) return weights.map(() => totalPt / Math.max(weights.length, 1))
  const raw = weights.map((w) => (w / sum) * totalPt)
  const rounded = raw.map((w) => Math.floor(w))
  let drift = totalPt - rounded.reduce((a, b) => a + b, 0)
  for (let i = 0; drift > 0 && i < rounded.length; i++, drift--) {
    rounded[i] += 1
  }
  return rounded
}

export function buildCoverColumns(): PdfTableColumn[] {
  const labels = ['#', 'Registro', 'Instrumento', 'Fecha', 'Dictamen', 'Formato', 'U', 'TUR']
  const weights = [1, 2, 6, 2, 2, 2.5, 2, 1.5]
  const widths = widthsFromWeights(weights, PDF_PORTRAIT_TABLE_WIDTH)
  const aligns: Array<'left' | 'center' | 'right'> = [
    'center',
    'left',
    'left',
    'left',
    'left',
    'left',
    'right',
    'right',
  ]
  return labels.map((label, i) => ({
    key: `c${i}`,
    label,
    widthPt: widths[i],
    align: aligns[i],
    mono: i === 1 || i === 3 || i === 5 || i === 6,
  }))
}

export function buildPatronColumns(): PdfTableColumn[] {
  const labels = ['Código', 'Denominación', 'U', 'k', 'Unidad', 'Estado', 'Próx. evento']
  const weights = [2, 5, 1.5, 1, 1.5, 1.5, 2]
  const widths = widthsFromWeights(weights, PDF_PORTRAIT_TABLE_WIDTH)
  return labels.map((label, i) => ({
    key: `p${i}`,
    label,
    widthPt: widths[i],
    align: i === 2 || i === 3 || i === 6 ? 'right' : 'left',
    mono: i === 0 || i === 2 || i === 3 || i === 6,
  }))
}

/** Row-per-item layout (matches verification detail UI — avoids wide matrix overflow). */
export function buildMeasurementDetailColumns(): PdfTableColumn[] {
  const labels = ['Punto de control', 'Valor esperado', 'Valor observado', 'Error', 'Dictamen', 'Obs.']
  const weights = [3.2, 2.2, 2.2, 1.2, 1.1, 1.1]
  const widths = widthsFromWeights(weights, PDF_PORTRAIT_TABLE_WIDTH)
  return labels.map((label, i) => ({
    key: `m${i}`,
    label,
    widthPt: widths[i],
    align: i >= 3 ? 'center' : 'left',
    mono: i >= 1 && i <= 3,
  }))
}
