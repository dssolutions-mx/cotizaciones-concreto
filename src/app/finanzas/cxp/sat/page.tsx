'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ReconciliationReport } from '@/lib/sat/reconciliation'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

// ── SAT Inventory tab ──────────────────────────────────────────────────────────

function SatInventoryTab() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { file: string; message: string }[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ap/sat-inventory?from=${from}&to=${to}`)
      if (res.ok) {
        const d = await res.json()
        setRows(d.rows ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [from, to])

  const handleImport = async (file: File) => {
    setUploading(true)
    setImportResult(null)
    try {
      const form = new FormData()
      const isZip = file.name.toLowerCase().endsWith('.zip')
      form.append(isZip ? 'zip_file' : 'xml_file', file)
      const res = await fetch('/api/ap/sat-import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error al importar'); return }
      setImportResult(data)
      toast.success(`Importado: ${data.imported} CFDI(s)${data.skipped > 0 ? `, ${data.skipped} omitido(s)` : ''}`)
      void fetchRows()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  useEffect(() => { void fetchRows() }, [fetchRows])

  return (
    <div className="space-y-4">
      {/* Filters + import */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 bg-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36 bg-white" />
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchRows()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Buscar
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <label
            htmlFor="sat-import-file"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors ${
              uploading
                ? 'border-sky-300 bg-sky-50 text-sky-700 cursor-wait'
                : 'border-stone-300 bg-white hover:bg-stone-50 text-stone-700'
            }`}
          >
            <FileUp className="h-3.5 w-3.5" />
            {uploading ? 'Importando…' : 'Importar ZIP / XML'}
          </label>
          <input
            id="sat-import-file"
            ref={fileRef}
            type="file"
            accept=".zip,.xml,text/xml,application/xml,application/zip"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleImport(f)
            }}
          />
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={cn(
          'rounded-md border p-3 text-xs space-y-1',
          importResult.errors.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
        )}>
          <div className="font-medium">
            {importResult.imported} importado(s) · {importResult.skipped} omitido(s) · {importResult.errors.length} error(es)
          </div>
          {importResult.errors.map((e, i) => (
            <div key={i} className="text-red-700">{e.file}: {e.message}</div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-stone-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-stone-600">UUID</th>
              <th className="px-3 py-2 text-left font-medium text-stone-600">Emisor</th>
              <th className="px-3 py-2 text-left font-medium text-stone-600">Tipo</th>
              <th className="px-3 py-2 text-left font-medium text-stone-600">Fecha</th>
              <th className="px-3 py-2 text-right font-medium text-stone-600">Subtotal</th>
              <th className="px-3 py-2 text-right font-medium text-stone-600">Total</th>
              <th className="px-3 py-2 text-center font-medium text-stone-600">Estado SAT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-stone-400"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-stone-400">Sin datos para el período</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.uuid} className="hover:bg-stone-50">
                <td className="px-3 py-2 font-mono text-[10px] text-stone-500 max-w-[120px] truncate" title={r.uuid}>{r.uuid.slice(0, 8)}…</td>
                <td className="px-3 py-2 text-stone-700">{r.emisor_nombre ?? r.emisor_rfc}</td>
                <td className="px-3 py-2">
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', r.tipo_comprobante === 'E' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700')}>
                    {r.tipo_comprobante}
                  </span>
                </td>
                <td className="px-3 py-2 text-stone-600">{r.fecha_emision ? format(new Date(r.fecha_emision), 'dd MMM yyyy', { locale: es }) : '-'}</td>
                <td className="px-3 py-2 text-right">{mxn.format(r.subtotal)}</td>
                <td className="px-3 py-2 text-right font-medium">{mxn.format(r.total)}</td>
                <td className="px-3 py-2 text-center">
                  {r.estado_sat === 'cancelado'
                    ? <span className="text-red-600 font-medium">Cancelado</span>
                    : <span className="text-emerald-600">Vigente</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Reconciliation tab ─────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 space-y-1">
      <div className="text-[11px] text-stone-500">{label}</div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
    </div>
  )
}

function ReconciliationTab() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [emisorRfc, setEmisorRfc] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReconciliationReport | null>(null)

  const fetchReport = async () => {
    setLoading(true)
    try {
      let url = `/api/ap/reconciliation?from=${from}&to=${to}`
      if (emisorRfc.trim()) url += `&emisor_rfc=${encodeURIComponent(emisorRfc.trim())}`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error'); return }
      setReport(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 bg-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36 bg-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">RFC Emisor (opcional)</Label>
          <Input value={emisorRfc} onChange={e => setEmisorRfc(e.target.value)} placeholder="Todos" className="w-40 bg-white" />
        </div>
        <Button size="sm" onClick={() => void fetchReport()} disabled={loading} className="bg-sky-700 hover:bg-sky-800 text-white">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Conciliar
        </Button>
      </div>

      {report && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total SAT" value={report.summary.total_sat} color="text-stone-800" />
            <KpiCard label="Conciliadas" value={report.summary.matched} color="text-emerald-700" />
            <KpiCard label="Solo en SAT" value={report.summary.in_sat_only} color="text-amber-600" />
            <KpiCard label="Solo en sistema" value={report.summary.in_system_only} color="text-blue-600" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label="Canceladas con saldo" value={report.summary.cancelled_open} color="text-red-600" />
            <KpiCard label="Monto no coincide" value={report.summary.total_mismatch} color="text-orange-600" />
            <KpiCard label="NC sin aplicar" value={report.summary.unapplied_nc} color="text-purple-600" />
          </div>

          {/* A: In SAT not in system */}
          <Section
            title="A — Solo en SAT (no registradas en sistema)"
            color="amber"
            icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
            count={report.in_sat_not_in_system.length}
          >
            <SatTable rows={report.in_sat_not_in_system} />
          </Section>

          {/* B: In system not in SAT */}
          <Section
            title="B — Solo en sistema (sin UUID o no en SAT)"
            color="blue"
            icon={<AlertTriangle className="h-4 w-4 text-blue-600" />}
            count={report.in_system_not_in_sat.length}
          >
            <InvTable rows={report.in_system_not_in_sat} />
          </Section>

          {/* C: Cancelled in SAT but open */}
          <Section
            title="C — Canceladas en SAT con saldo abierto"
            color="red"
            icon={<XCircle className="h-4 w-4 text-red-600" />}
            count={report.cancelled_in_sat_but_open.length}
          >
            <CancelledTable rows={report.cancelled_in_sat_but_open} />
          </Section>

          {/* D: Total mismatch */}
          <Section
            title="D — Monto no coincide"
            color="orange"
            icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
            count={report.total_mismatch.length}
          >
            <MismatchTable rows={report.total_mismatch} />
          </Section>

          {/* E: Unapplied credit notes */}
          <Section
            title="E — Notas de crédito SAT sin aplicar"
            color="purple"
            icon={<AlertTriangle className="h-4 w-4 text-purple-600" />}
            count={report.unapplied_credit_notes.length}
          >
            <SatTable rows={report.unapplied_credit_notes} />
          </Section>

          {/* Matched */}
          <Section
            title="Conciliadas"
            color="emerald"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            count={report.matched.length}
          >
            <MatchedTable rows={report.matched} />
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, color, icon, count, children }: {
  title: string; color: string; icon: React.ReactNode; count: number; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  if (count === 0) return null
  const borderColors: Record<string, string> = {
    amber: 'border-amber-200', blue: 'border-blue-200', red: 'border-red-200',
    orange: 'border-orange-200', purple: 'border-purple-200', emerald: 'border-emerald-200',
  }
  return (
    <div className={cn('rounded-lg border overflow-hidden', borderColors[color] ?? 'border-stone-200')}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 bg-white text-sm font-semibold text-stone-800 hover:bg-stone-50 text-left"
        onClick={() => setOpen(v => !v)}
      >
        {icon}
        {title}
        <span className="ml-1 text-xs font-normal text-stone-500">({count})</span>
      </button>
      {open && <div className="border-t border-inherit overflow-x-auto">{children}</div>}
    </div>
  )
}

function SatTable({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-stone-50"><tr>
        <th className="px-3 py-2 text-left font-medium text-stone-600">UUID</th>
        <th className="px-3 py-2 text-left font-medium text-stone-600">Emisor RFC</th>
        <th className="px-3 py-2 text-left font-medium text-stone-600">Tipo</th>
        <th className="px-3 py-2 text-left font-medium text-stone-600">Fecha</th>
        <th className="px-3 py-2 text-right font-medium text-stone-600">Total SAT</th>
      </tr></thead>
      <tbody className="divide-y divide-stone-100">
        {rows.map((r: any) => (
          <tr key={r.uuid} className="hover:bg-stone-50">
            <td className="px-3 py-2 font-mono text-[10px] text-stone-500" title={r.uuid}>{r.uuid.slice(0, 8)}…</td>
            <td className="px-3 py-2">{r.emisor_rfc}</td>
            <td className="px-3 py-2">{r.tipo_comprobante}</td>
            <td className="px-3 py-2">{r.fecha_emision ? format(new Date(r.fecha_emision), 'dd MMM yyyy', { locale: es }) : '-'}</td>
            <td className="px-3 py-2 text-right font-medium">{mxn.format(r.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function InvTable({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-stone-50"><tr>
        <th className="px-3 py-2 text-left font-medium text-stone-600">Factura</th>
        <th className="px-3 py-2 text-left font-medium text-stone-600">Proveedor</th>
        <th className="px-3 py-2 text-left font-medium text-stone-600">Fecha</th>
        <th className="px-3 py-2 text-left font-medium text-stone-600">UUID en sistema</th>
        <th className="px-3 py-2 text-right font-medium text-stone-600">Total</th>
      </tr></thead>
      <tbody className="divide-y divide-stone-100">
        {rows.map((r: any) => (
          <tr key={r.id} className="hover:bg-stone-50">
            <td className="px-3 py-2 font-mono font-semibold">{r.invoice_number}</td>
            <td className="px-3 py-2">{r.supplier_group?.name ?? r.cfdi_emisor_rfc ?? '-'}</td>
            <td className="px-3 py-2">{r.invoice_date ? format(new Date(r.invoice_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es }) : '-'}</td>
            <td className="px-3 py-2 font-mono text-[10px] text-stone-500">{r.cfdi_uuid ? r.cfdi_uuid.slice(0, 8) + '…' : '—'}</td>
            <td className="px-3 py-2 text-right font-medium">{mxn.format(r.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CancelledTable({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-stone-50"><tr>
        <th className="px-3 py-2 text-left font-medium text-stone-600">UUID</th>
        <th className="px-3 py-2 text-left font-medium text-stone-600">Factura</th>
        <th className="px-3 py-2 text-left font-medium text-stone-600">Estado sistema</th>
        <th className="px-3 py-2 text-right font-medium text-stone-600">Total</th>
      </tr></thead>
      <tbody className="divide-y divide-stone-100">
        {rows.map((r: any, i: number) => (
          <tr key={i} className="hover:bg-stone-50">
            <td className="px-3 py-2 font-mono text-[10px] text-stone-500" title={r.sat?.uuid}>{r.sat?.uuid?.slice(0, 8)}…</td>
            <td className="px-3 py-2 font-mono font-semibold">{r.inv?.invoice_number}</td>
            <td className="px-3 py-2 text-amber-600">{r.inv?.status}</td>
            <td className="px-3 py-2 text-right">{mxn.format(r.sat?.total ?? 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MismatchTable({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-stone-50"><tr>
        <th className="px-3 py-2 text-left font-medium text-stone-600">UUID</th>
        <th className="px-3 py-2 text-left font-medium text-stone-600">Factura</th>
        <th className="px-3 py-2 text-right font-medium text-stone-600">Total SAT</th>
        <th className="px-3 py-2 text-right font-medium text-stone-600">Total sistema</th>
        <th className="px-3 py-2 text-right font-medium text-stone-600">Diferencia</th>
      </tr></thead>
      <tbody className="divide-y divide-stone-100">
        {rows.map((r: any) => (
          <tr key={r.uuid} className="hover:bg-stone-50">
            <td className="px-3 py-2 font-mono text-[10px] text-stone-500" title={r.uuid}>{r.uuid.slice(0, 8)}…</td>
            <td className="px-3 py-2 font-mono font-semibold">{r.invoice_number}</td>
            <td className="px-3 py-2 text-right">{mxn.format(r.sat_total)}</td>
            <td className="px-3 py-2 text-right">{mxn.format(r.system_total)}</td>
            <td className={cn('px-3 py-2 text-right font-medium', r.diff > 0 ? 'text-red-600' : 'text-emerald-600')}>
              {r.diff > 0 ? '+' : ''}{mxn.format(r.diff)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MatchedTable({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-stone-50"><tr>
        <th className="px-3 py-2 text-left font-medium text-stone-600">UUID</th>
        <th className="px-3 py-2 text-left font-medium text-stone-600">Factura</th>
        <th className="px-3 py-2 text-right font-medium text-stone-600">Total SAT</th>
        <th className="px-3 py-2 text-right font-medium text-stone-600">Total sistema</th>
        <th className="px-3 py-2 text-center font-medium text-stone-600">Monto</th>
        <th className="px-3 py-2 text-center font-medium text-stone-600">Estado SAT</th>
      </tr></thead>
      <tbody className="divide-y divide-stone-100">
        {rows.map((r: any) => (
          <tr key={r.uuid} className="hover:bg-stone-50">
            <td className="px-3 py-2 font-mono text-[10px] text-stone-500" title={r.uuid}>{r.uuid.slice(0, 8)}…</td>
            <td className="px-3 py-2 font-mono font-semibold">{r.invoice_number}</td>
            <td className="px-3 py-2 text-right">{mxn.format(r.sat_total)}</td>
            <td className="px-3 py-2 text-right">{mxn.format(r.system_total)}</td>
            <td className="px-3 py-2 text-center">
              {r.total_match
                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mx-auto" />
                : <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mx-auto" />}
            </td>
            <td className="px-3 py-2 text-center">
              {r.sat_estado === 'cancelado'
                ? <span className="text-red-600 font-medium">Cancelado</span>
                : <span className="text-emerald-600">Vigente</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SatPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-stone-900">SAT — Conciliación CFDI</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Importa el inventario de CFDIs recibidos del SAT y compáralo contra las facturas registradas en el sistema.
        </p>
      </div>
      <Tabs defaultValue="inventario">
        <TabsList>
          <TabsTrigger value="inventario">Inventario SAT</TabsTrigger>
          <TabsTrigger value="conciliacion">Conciliación</TabsTrigger>
        </TabsList>
        <TabsContent value="inventario" className="pt-4">
          <SatInventoryTab />
        </TabsContent>
        <TabsContent value="conciliacion" className="pt-4">
          <ReconciliationTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
