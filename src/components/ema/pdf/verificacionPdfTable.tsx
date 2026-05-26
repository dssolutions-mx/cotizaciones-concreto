import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { verificacionPdfStyles as s } from '@/components/ema/pdf/verificacionPdfStyles'

/** Column width strings must sum to 100% */
export type PdfTableColumn = {
  key: string
  label: string
  width: string
  align?: 'left' | 'center' | 'right'
  mono?: boolean
}

export function PdfTable({
  columns,
  rows,
  fontSize = 7.5,
}: {
  columns: PdfTableColumn[]
  rows: string[][]
  fontSize?: number
}) {
  return (
    <View style={s.tableFrame}>
      <View style={s.tableHeaderRow}>
        {columns.map((col) => (
          <View
            key={col.key}
            style={[
              s.tableCell,
              { width: col.width, borderRightWidth: 1, borderRightColor: '#ffffff40' },
            ]}
          >
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
          style={rowIdx % 2 === 1 ? s.tableBodyRowAlt : s.tableBodyRow}
        >
          {row.map((cell, colIdx) => {
            const col = columns[colIdx]
            return (
              <View
                key={col.key}
                style={[
                  s.tableCell,
                  { width: col.width, borderRightWidth: 1, borderRightColor: '#E7E5E4' },
                ]}
              >
                <Text
                  style={[
                    col.mono ? s.tableCellMono : s.tableCellText,
                    {
                      fontSize,
                      textAlign: col.align ?? 'left',
                    },
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

/** Build measurement table columns with fixed % widths (no flex). */
export function buildMeasurementColumns(
  layout: string,
  items: { id: string; punto: string }[],
): PdfTableColumn[] {
  const cumplePct = 11
  const codePct = layout === 'instrument_grid' ? 14 : 0
  const n = items.length
  const dataPct = 100 - cumplePct - codePct
  const each = n > 0 ? dataPct / n : dataPct

  const cols: PdfTableColumn[] = []
  if (layout === 'instrument_grid') {
    cols.push({ key: 'code', label: 'Código instancia', width: `${codePct}%`, mono: true })
  }
  for (const it of items) {
    cols.push({
      key: it.id,
      label: it.punto,
      width: `${each}%`,
    })
  }
  cols.push({
    key: 'cumple',
    label: 'Dictamen fila',
    width: `${cumplePct}%`,
    align: 'center',
  })
  return cols
}

export function measurementTableFontSize(columnCount: number): number {
  if (columnCount <= 4) return 8
  if (columnCount <= 6) return 7
  return 6.5
}
