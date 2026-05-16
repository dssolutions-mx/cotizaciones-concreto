'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, Trash2, AlertTriangle, FileUp, FileCheck2, X } from 'lucide-react'
import type { InvoiceCostCategory, ParsedCfdi, CfdiCaptureMode } from '@/types/finance'
import { c_FormaPago, c_MetodoPago, c_UsoCFDI } from '@/lib/sat/codigosSat'

export type OrphanEntry = {
  id: string
  entry_number: string
  entry_date: string
  plant_id: string
  supplier_id: string
  material_id: string
  received_qty_entered: number | null
  received_qty_kg: number | null
  received_uom: string | null
  unit_price: number | null
  total_cost: number | null
  fleet_cost: number | null
  landed_unit_price: number | null
  supplier_invoice: string | null
  fleet_invoice: string | null
  ap_due_date_material: string | null
  supplier?: { id: string; name: string; group_id: string | null; default_vat_rate: number | null } | null
  material?: { id: string; material_name: string } | null
}

/** A display line in the drawer. May aggregate multiple source entries. */
type LineItem = {
  key: string
  /** Source entries when aggregating multiple receipts into one line. */
  sourceEntries?: OrphanEntry[]
  /** Single entry_id — used only for historical/manual lines. */
  entry_id: string | null
  cost_category: InvoiceCostCategory
  description: string
  qty: string
  unit_price: string
  amount: string
  /** When true the amount is derived from entry data and cannot be edited. */
  locked?: boolean
}

type SupplierGroup = {
  id: string
  name: string
  rfc: string | null
  plant_supplier: { id: string; default_vat_rate: number | null; default_payment_terms_days: number | null } | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selected orphan entries to bill — undefined/empty = historical mode (manual lines) */
  entries?: OrphanEntry[]
  plantId?: string
  /** When set, shows a "N remaining" badge indicating uno-a-uno queue progress */
  queueInfo?: { remaining: number }
  onSuccess: () => void
}

const DEFAULT_VAT = 0.16

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Build aggregated display lines from a set of orphan entries.
 *  Groups by (cost_category × material_id) so the user sees one line per material.
 *  On submit these expand back into individual items per entry. */
function buildLines(entries: OrphanEntry[]): LineItem[] {
  const matGroups = new Map<string, OrphanEntry[]>()
  const fleetGroups = new Map<string, OrphanEntry[]>()

  for (const e of entries) {
    const mid = e.material_id
    if (!matGroups.has(mid)) matGroups.set(mid, [])
    matGroups.get(mid)!.push(e)

    if (Number(e.fleet_cost ?? 0) > 0) {
      if (!fleetGroups.has(mid)) fleetGroups.set(mid, [])
      fleetGroups.get(mid)!.push(e)
    }
  }

  const lines: LineItem[] = []

  for (const [mid, grp] of matGroups) {
    const totalAmt = grp.reduce((s, e) => s + Number(e.total_cost ?? 0), 0)
    const totalQty = grp.reduce((s, e) => s + Number(e.received_qty_entered ?? 0), 0)
    const matName = grp[0].material?.material_name ?? ''
    const desc = grp.length === 1
      ? `${matName} — ${grp[0].entry_number}`
      : `${matName} (${grp.length} recepciones)`
    lines.push({
      key: `mat:${mid}`,
      sourceEntries: grp,
      entry_id: null,
      cost_category: 'material',
      description: desc,
      qty: totalQty.toFixed(2),
      unit_price: totalQty > 0 ? (totalAmt / totalQty).toFixed(4) : '',
      amount: totalAmt.toFixed(2),
      locked: true,
    })
  }

  for (const [mid, grp] of fleetGroups) {
    const totalFleet = grp.reduce((s, e) => s + Number(e.fleet_cost ?? 0), 0)
    const matName = grp[0].material?.material_name ?? ''
    lines.push({
      key: `fleet:${mid}`,
      sourceEntries: grp,
      entry_id: null,
      cost_category: 'fleet',
      description: `Flete — ${matName}`,
      qty: String(grp.length),
      unit_price: grp.length > 0 ? (totalFleet / grp.length).toFixed(2) : '',
      amount: totalFleet.toFixed(2),
      locked: true,
    })
  }

  return lines
}

export default function CreateSupplierInvoiceDrawer({ open, onOpenChange, entries, plantId, queueInfo, onSuccess }: Props) {
  const isHistorical = !entries || entries.length === 0

  // ── supplier group ─────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<SupplierGroup[]>([])
  const [groupId, setGroupId] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)

  // Derived supplier info from entries (non-historical)
  const firstSupplier = entries?.[0]?.supplier ?? null
  const supplierHasGroup = !!firstSupplier?.group_id

  // ── invoice header ─────────────────────────────────────────────────────────
  const [isInternal, setIsInternal] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dueDate, setDueDate] = useState(() => format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [vatRate, setVatRate] = useState(String(DEFAULT_VAT))
  const [notes, setNotes] = useState('')

  // ── discounts & retentions ─────────────────────────────────────────────────
  const [discountAmount, setDiscountAmount] = useState('')
  const [isrRate, setIsrRate]       = useState('0')
  const [ivaRetRate, setIvaRetRate] = useState('0')

  // ── line items ─────────────────────────────────────────────────────────────
  const [lines, setLines] = useState<LineItem[]>([])

  // ── CFDI XML upload ───────────────────────────────────────────────────────
  const [cfdiCaptureMode, setCfdiCaptureMode] = useState<CfdiCaptureMode>('manual')
  const [parsedCfdi, setParsedCfdi] = useState<ParsedCfdi | null>(null)
  const [cfdiFile, setCfdiFile] = useState<File | null>(null)
  const [parsingCfdi, setParsingCfdi] = useState(false)
  const [skipCfdi, setSkipCfdi] = useState(false)
  const [cfdiFormaPago, setCfdiFormaPago] = useState<string>('')
  const [cfdiMetodoPago, setCfdiMetodoPago] = useState<string>('')
  const [cfdiUso, setCfdiUso] = useState<string>('')

  // ── submit ─────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)

  const effectivePlantId = plantId ?? entries?.[0]?.plant_id ?? ''

  // Fetch supplier groups on open (filter by plant when known)
  useEffect(() => {
    if (!open) return
    const url = effectivePlantId
      ? `/api/ap/supplier-groups?plant_id=${effectivePlantId}`
      : '/api/ap/supplier-groups'
    fetch(url)
      .then(r => r.ok ? r.json() : { groups: [] })
      .then(d => setGroups(d.groups ?? []))
      .catch(() => setGroups([]))
  }, [open, effectivePlantId])

  // Reset + build state when drawer opens or entries change
  useEffect(() => {
    if (!open) return

    setIsInternal(false)
    setNotes('')
    setNewGroupName('')
    setDiscountAmount('')
    setIsrRate('0')
    setIvaRetRate('0')
    setCfdiCaptureMode('manual')
    setParsedCfdi(null)
    setCfdiFile(null)
    setSkipCfdi(false)
    setCfdiFormaPago('')
    setCfdiMetodoPago('')
    setCfdiUso('')

    if (isHistorical) {
      setGroupId('')
      setVatRate(String(DEFAULT_VAT))
      setInvoiceDate(format(new Date(), 'yyyy-MM-dd'))
      setDueDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
      setInvoiceNumber('')
      setLines([{
        key: crypto.randomUUID(),
        entry_id: null,
        cost_category: 'material',
        description: '',
        qty: '',
        unit_price: '',
        amount: '',
      }])
      return
    }

    // Non-historical: build aggregated lines from entries
    setLines(buildLines(entries ?? []))

    // Pre-fill group from first entry's supplier
    if (firstSupplier?.group_id) setGroupId(firstSupplier.group_id)
    else setGroupId('')

    // Pre-fill VAT
    setVatRate(String(firstSupplier?.default_vat_rate ?? DEFAULT_VAT))

    // Pre-fill due date from entry if available
    const dueFromEntry = entries?.[0]?.ap_due_date_material
    if (dueFromEntry) setDueDate(dueFromEntry)
    else setDueDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'))

    // Pre-fill invoice number
    setInvoiceNumber(entries?.[0]?.supplier_invoice ?? '')
    setInvoiceDate(format(new Date(), 'yyyy-MM-dd'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entries, isHistorical])

  // Auto-update VAT + due date when group changes (historical/picker mode)
  useEffect(() => {
    if (!isHistorical) return
    const g = groups.find(x => x.id === groupId)
    if (g?.plant_supplier?.default_vat_rate != null) {
      setVatRate(String(g.plant_supplier.default_vat_rate))
    }
    if (g?.plant_supplier?.default_payment_terms_days != null) {
      setDueDate(format(addDays(new Date(invoiceDate), g.plant_supplier.default_payment_terms_days), 'yyyy-MM-dd'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, groups])

  const updateLine = (key: string, field: keyof LineItem, value: string) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key || l.locked) return l
      const updated = { ...l, [field]: value }
      if (field === 'qty' || field === 'unit_price') {
        const q = parseFloat(updated.qty)
        const u = parseFloat(updated.unit_price)
        if (!isNaN(q) && !isNaN(u)) updated.amount = (q * u).toFixed(2)
      }
      return updated
    }))
  }

  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key))

  const addLine = () => setLines(prev => [...prev, {
    key: crypto.randomUUID(),
    entry_id: null,
    cost_category: 'material',
    description: '',
    qty: '',
    unit_price: '',
    amount: '',
  }])

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0),
    [lines]
  )
  const vat         = parseFloat(vatRate) || 0
  const discount    = parseFloat(discountAmount) || 0
  const isrRateNum  = parseFloat(isrRate) || 0
  const ivaRetRateNum = parseFloat(ivaRetRate) || 0
  const taxableBase = Math.max(0, subtotal - discount)
  const tax         = Math.round(taxableBase * vat * 100) / 100
  const isrAmt      = Math.round(taxableBase * isrRateNum * 100) / 100
  const ivaRetAmt   = Math.round(tax * ivaRetRateNum * 100) / 100
  const total       = Math.round((taxableBase + tax - isrAmt - ivaRetAmt) * 100) / 100

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  const createGroup = async () => {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    try {
      const res = await fetch('/api/ap/supplier-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error'); return }
      setGroups(prev => [...prev, { ...data.group, plant_supplier: null }])
      setGroupId(data.group.id)
      setNewGroupName('')
    } finally {
      setCreatingGroup(false)
    }
  }

  /** Parse a CFDI XML and prefill fiscal fields. */
  const handleCfdiFile = async (file: File) => {
    setParsingCfdi(true)
    try {
      const form = new FormData()
      form.append('xml_file', file)
      const res = await fetch('/api/ap/cfdi/parse', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo leer el CFDI')
        return
      }
      if (data.receptor_match === 'mismatch') {
        toast.error(`El CFDI está dirigido a otro RFC (${data.cfdi.receptor_rfc}). El RFC configurado es ${data.company_rfc}.`)
        return
      }
      if (data.receptor_match === 'company_rfc_not_set') {
        toast.warning('El RFC de la empresa no está configurado en system_settings; no se pudo validar receptor.')
      }
      if (data.duplicate_invoice) {
        toast.error(`Este CFDI ya está registrado en la factura ${data.duplicate_invoice.invoice_number}`)
        return
      }
      const cfdi: ParsedCfdi = data.cfdi
      setParsedCfdi(cfdi)
      setCfdiFile(file)
      setCfdiCaptureMode('cfdi')

      // Prefill form fields from CFDI
      setInvoiceNumber([cfdi.serie, cfdi.folio].filter(Boolean).join('-') || cfdi.uuid.slice(0, 8))
      setInvoiceDate(cfdi.fecha_emision.slice(0, 10))
      setVatRate(String(cfdi.vat_rate || DEFAULT_VAT))
      setCfdiFormaPago(cfdi.forma_pago ?? '')
      setCfdiMetodoPago(cfdi.metodo_pago ?? '')
      setCfdiUso(cfdi.uso_cfdi ?? '')
      setDiscountAmount(cfdi.descuento > 0 ? cfdi.descuento.toFixed(2) : '')
      setIsrRate(cfdi.retention_isr_rate > 0 ? String(cfdi.retention_isr_rate) : '0')
      setIvaRetRate(cfdi.retention_iva_rate > 0 ? String(cfdi.retention_iva_rate) : '0')

      // Match supplier group by emisor RFC
      if (data.supplier_group) {
        setGroupId(data.supplier_group.id)
      }

      // Default a single editable line summing the CFDI subtotal so the user
      // can split into material/fleet manually.
      const subtotalLine = cfdi.subtotal.toFixed(2)
      if (isHistorical) {
        setLines([{
          key: crypto.randomUUID(),
          entry_id: null,
          cost_category: 'material',
          description: cfdi.emisor_nombre ?? `CFDI ${cfdi.serie ?? ''}${cfdi.folio ?? ''}`,
          qty: '1',
          unit_price: subtotalLine,
          amount: subtotalLine,
        }])
      }

      toast.success(`CFDI leído — UUID ${cfdi.uuid.slice(0, 8)}…`)
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al leer el CFDI')
    } finally {
      setParsingCfdi(false)
    }
  }

  const clearCfdi = () => {
    setParsedCfdi(null)
    setCfdiFile(null)
    setCfdiCaptureMode('manual')
    setCfdiFormaPago('')
    setCfdiMetodoPago('')
    setCfdiUso('')
  }

  /** Expand aggregated display lines into individual API items (one per source entry). */
  const buildApiItems = () => {
    const items: Array<{
      entry_id: string | null
      cost_category: string
      description: string | null
      qty: number | null
      unit_price: number | null
      amount: number
    }> = []

    for (const l of lines) {
      if (l.sourceEntries && l.sourceEntries.length > 0) {
        for (const e of l.sourceEntries) {
          const amt = l.cost_category === 'material'
            ? Number(e.total_cost ?? 0)
            : Number(e.fleet_cost ?? 0)
          if (amt <= 0) continue
          items.push({
            entry_id: e.id,
            cost_category: l.cost_category,
            description: l.cost_category === 'material'
              ? `${e.material?.material_name ?? ''} — ${e.entry_number}`
              : `Flete — ${e.entry_number}`,
            qty: l.cost_category === 'material' ? (e.received_qty_entered ?? null) : null,
            unit_price: l.cost_category === 'material' ? (e.unit_price ?? null) : (e.fleet_cost ?? null),
            amount: amt,
          })
        }
      } else {
        items.push({
          entry_id: l.entry_id,
          cost_category: l.cost_category,
          description: l.description || null,
          qty: l.qty ? parseFloat(l.qty) : null,
          unit_price: l.unit_price ? parseFloat(l.unit_price) : null,
          amount: parseFloat(l.amount),
        })
      }
    }
    return items
  }

  const handleSubmit = async () => {
    if (!groupId) { toast.error('Selecciona o crea un grupo de proveedor'); return }
    if (!effectivePlantId) { toast.error('Planta requerida'); return }
    if (!invoiceDate || !dueDate) { toast.error('Fecha de factura y vencimiento requeridos'); return }
    if (!isInternal && !invoiceNumber.trim()) { toast.error('Número de factura requerido'); return }
    if (lines.length === 0) { toast.error('Agrega al menos una línea'); return }
    const invalidLine = lines.find(l => !l.amount || parseFloat(l.amount) <= 0)
    if (invalidLine) { toast.error('Todas las líneas deben tener monto'); return }

    const apiItems = buildApiItems()
    if (apiItems.length === 0) { toast.error('No hay líneas válidas'); return }

    // Warn if user-edited subtotal/total deviates from the parsed CFDI
    if (parsedCfdi) {
      if (Math.abs(subtotal - parsedCfdi.subtotal) > 0.02) {
        const ok = window.confirm(
          `El subtotal capturado (${subtotal.toFixed(2)}) no coincide con el del CFDI (${parsedCfdi.subtotal.toFixed(2)}). ¿Continuar?`,
        )
        if (!ok) return
      }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/ap/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_group_id: groupId,
          plant_id: effectivePlantId,
          invoice_number: isInternal ? '' : invoiceNumber.trim(),
          is_internal: isInternal,
          invoice_date: invoiceDate,
          due_date: dueDate,
          vat_rate: vat,
          subtotal,
          discount_amount: discount,
          retention_isr_rate: isrRateNum,
          retention_iva_rate: ivaRetRateNum,
          source: isHistorical ? 'historical' : 'system',
          notes: notes.trim() || null,
          items: apiItems,
          cfdi_uuid: parsedCfdi?.uuid ?? null,
          cfdi_serie: parsedCfdi?.serie ?? null,
          cfdi_folio: parsedCfdi?.folio ?? null,
          cfdi_forma_pago: cfdiFormaPago || parsedCfdi?.forma_pago || null,
          cfdi_metodo_pago: cfdiMetodoPago || parsedCfdi?.metodo_pago || null,
          cfdi_uso: cfdiUso || parsedCfdi?.uso_cfdi || null,
          cfdi_tipo_comprobante: parsedCfdi?.tipo_comprobante ?? null,
          cfdi_fecha_emision: parsedCfdi?.fecha_emision ?? null,
          cfdi_fecha_timbrado: parsedCfdi?.fecha_timbrado ?? null,
          cfdi_emisor_rfc: parsedCfdi?.emisor_rfc ?? null,
          cfdi_receptor_rfc: parsedCfdi?.receptor_rfc ?? null,
          cfdi_capture_mode: cfdiCaptureMode,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error al crear factura'); return }
      toast.success(`Factura ${data.invoice.invoice_number} creada`)
      onOpenChange(false)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  // Resolved group name for read-only display
  const resolvedGroupName = groups.find(g => g.id === groupId)?.name ?? firstSupplier?.name ?? null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden">
        <SheetHeader className="px-6 pt-5 pb-4 border-b border-stone-200 shrink-0">
          <SheetTitle className="flex items-center gap-2">
            {isHistorical ? 'Nueva factura histórica' : `Crear factura (${entries?.length ?? 0} recepcion${(entries?.length ?? 0) !== 1 ? 'es' : ''})`}
            {queueInfo && queueInfo.remaining > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full text-xs font-medium">
                {queueInfo.remaining} más después
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {isHistorical
              ? 'Registra una factura anterior al sistema sin recepciones vinculadas.'
              : queueInfo && queueInfo.remaining > 0
                ? 'Completa esta factura y se abrirá automáticamente la siguiente recepción.'
                : 'La factura agrupa las recepciones seleccionadas en una sola cuenta por pagar.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* CFDI XML upload — primary capture path */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
              CFDI (XML)
              {parsedCfdi && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-medium uppercase tracking-wide">
                  Leído
                </span>
              )}
            </h3>
            {parsedCfdi ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3 space-y-1">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <FileCheck2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <div className="font-medium text-stone-900">
                        {cfdiFile?.name ?? 'CFDI'} · {parsedCfdi.tipo_comprobante}
                      </div>
                      <div className="font-mono text-[10px] text-stone-500">
                        UUID {parsedCfdi.uuid}
                      </div>
                      <div className="text-stone-600">
                        {parsedCfdi.emisor_nombre ?? parsedCfdi.emisor_rfc} · {parsedCfdi.emisor_rfc}
                      </div>
                      <div className="text-stone-500">
                        Subtotal {mxn.format(parsedCfdi.subtotal)} · Total {mxn.format(parsedCfdi.total)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearCfdi}
                    className="p-1 text-stone-400 hover:text-rose-600"
                    title="Quitar CFDI"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : skipCfdi ? (
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600 flex items-center justify-between">
                <span>Captura sin XML (histórica / sin CFDI)</span>
                <button
                  type="button"
                  className="text-sky-700 hover:text-sky-800 underline-offset-2 hover:underline"
                  onClick={() => setSkipCfdi(false)}
                >
                  Subir XML
                </button>
              </div>
            ) : (
              <label
                htmlFor="cfdi-xml-input"
                className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  parsingCfdi
                    ? 'border-sky-300 bg-sky-50 cursor-wait'
                    : 'border-stone-300 bg-white hover:border-sky-400 hover:bg-sky-50/30 cursor-pointer'
                }`}
              >
                <FileUp className="h-6 w-6 text-stone-400" />
                <div className="text-xs text-stone-600">
                  {parsingCfdi ? 'Leyendo CFDI…' : 'Arrastra o haz clic para subir el XML del CFDI'}
                </div>
                <div className="text-[10px] text-stone-400">
                  Los campos fiscales se prellenarán automáticamente.
                </div>
                <input
                  id="cfdi-xml-input"
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  className="hidden"
                  disabled={parsingCfdi}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleCfdiFile(f)
                    e.target.value = '' // allow re-selecting the same file
                  }}
                />
                <button
                  type="button"
                  className="mt-1 text-[11px] text-stone-500 hover:text-stone-700 underline-offset-2 hover:underline"
                  onClick={(e) => { e.preventDefault(); setSkipCfdi(true) }}
                >
                  Capturar sin XML (histórica)
                </button>
              </label>
            )}
          </section>

          <Separator />

          {/* Supplier — read-only when entries provide it; picker for historical */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-stone-900">Proveedor</h3>
            {isHistorical ? (
              <>
                <div className="flex gap-2">
                  <Select value={groupId || '__none__'} onValueChange={v => setGroupId(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="flex-1 bg-white">
                      <SelectValue placeholder="Seleccionar proveedor…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Seleccionar —</SelectItem>
                      {groups.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Nuevo proveedor (nombre)…"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    className="flex-1 h-8 text-xs"
                    onKeyDown={e => e.key === 'Enter' && void createGroup()}
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => void createGroup()} disabled={!newGroupName.trim() || creatingGroup}>
                    <Plus className="h-3.5 w-3.5" />
                    Crear
                  </Button>
                </div>
              </>
            ) : supplierHasGroup ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-md border border-stone-200">
                <span className="text-sm font-medium text-stone-900">{resolvedGroupName}</span>
                {firstSupplier?.name && resolvedGroupName !== firstSupplier.name && (
                  <span className="text-xs text-stone-400">({firstSupplier.name})</span>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-md border border-amber-200 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {firstSupplier?.name ?? 'Proveedor'} no tiene grupo asignado. Selecciona o crea uno:
                </div>
                <div className="flex gap-2">
                  <Select value={groupId || '__none__'} onValueChange={v => setGroupId(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="flex-1 bg-white">
                      <SelectValue placeholder="Seleccionar grupo…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Seleccionar —</SelectItem>
                      {groups.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Nuevo grupo (nombre)…"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    className="flex-1 h-8 text-xs"
                    onKeyDown={e => e.key === 'Enter' && void createGroup()}
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => void createGroup()} disabled={!newGroupName.trim() || creatingGroup}>
                    <Plus className="h-3.5 w-3.5" /> Crear
                  </Button>
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* Invoice header */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-900">Datos de la factura</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-internal"
                checked={isInternal}
                onCheckedChange={v => setIsInternal(!!v)}
              />
              <label htmlFor="is-internal" className="text-xs cursor-pointer select-none">
                Sin factura formal — generar folio interno (INT-YYYY-NNNNN)
              </label>
            </div>
            {!isInternal && (
              <div className="space-y-1">
                <Label className="text-xs">Número de factura *</Label>
                <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="bg-white" placeholder="Ej. A-12345" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fecha de factura *</Label>
                <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha de vencimiento *</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-white" />
              </div>
            </div>
            <div className="space-y-1 w-40">
              <Label className="text-xs">IVA</Label>
              <Select value={vatRate} onValueChange={setVatRate}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0% (exento)</SelectItem>
                  <SelectItem value="0.08">8%</SelectItem>
                  <SelectItem value="0.16">16%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(parsedCfdi || skipCfdi) && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Forma de pago (CFDI)</Label>
                  <Select value={cfdiFormaPago || '__none__'} onValueChange={v => setCfdiFormaPago(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="bg-white h-8 text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {c_FormaPago.map(f => <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Método de pago</Label>
                  <Select value={cfdiMetodoPago || '__none__'} onValueChange={v => setCfdiMetodoPago(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="bg-white h-8 text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {c_MetodoPago.map(m => <SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Uso CFDI</Label>
                  <Select value={cfdiUso || '__none__'} onValueChange={v => setCfdiUso(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="bg-white h-8 text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {c_UsoCFDI.map(u => <SelectItem key={u.code} value={u.code}>{u.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Notas (opcional)</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} className="bg-white" placeholder="Observaciones…" />
            </div>
          </section>

          <Separator />

          {/* Descuentos y Retenciones */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-900">Descuentos y Retenciones</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Descuento (pre-IVA)</Label>
                <Input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={e => setDiscountAmount(e.target.value)}
                  className="bg-white"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Retención ISR</Label>
                <Select value={isrRate} onValueChange={setIsrRate}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (ninguna)</SelectItem>
                    <SelectItem value="0.0125">1.25% — fletes</SelectItem>
                    <SelectItem value="0.10">10% — honorarios</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
                {isrRate === 'custom' && (
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="Tasa decimal, ej. 0.05"
                    className="mt-1 bg-white text-xs h-7"
                    onBlur={e => setIsrRate(e.target.value || '0')}
                    defaultValue=""
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Retención IVA</Label>
                <Select value={ivaRetRate} onValueChange={setIvaRetRate}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (ninguna)</SelectItem>
                    <SelectItem value="0.04">4% — autotransporte</SelectItem>
                    <SelectItem value="0.106667">10.67% — servicios 2/3</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
                {ivaRetRate === 'custom' && (
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="Tasa decimal, ej. 0.04"
                    className="mt-1 bg-white text-xs h-7"
                    onBlur={e => setIvaRetRate(e.target.value || '0')}
                    defaultValue=""
                  />
                )}
              </div>
            </div>
          </section>

          <Separator />

          {/* Line items */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Líneas de factura</h3>
              {isHistorical && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addLine}>
                  <Plus className="h-3.5 w-3.5" /> Agregar línea
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {lines.map(l => (
                <div key={l.key} className={`rounded-md p-3 space-y-2 border ${l.locked ? 'bg-stone-50/70 border-stone-100' : 'bg-stone-50 border-stone-200'}`}>
                  <div className="flex items-center gap-2">
                    {l.locked ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium w-24 text-center ${l.cost_category === 'fleet' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {l.cost_category === 'fleet' ? 'Flete' : 'Material'}
                      </span>
                    ) : (
                      <Select value={l.cost_category} onValueChange={v => updateLine(l.key, 'cost_category', v as InvoiceCostCategory)}>
                        <SelectTrigger className="w-28 h-7 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="material">Material</SelectItem>
                          <SelectItem value="fleet">Flete</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <span className={`flex-1 text-xs ${l.locked ? 'text-stone-700' : 'hidden'}`}>{l.description}</span>
                    {!l.locked && (
                      <Input
                        value={l.description}
                        onChange={e => updateLine(l.key, 'description', e.target.value)}
                        className="flex-1 h-7 text-xs bg-white"
                        placeholder="Descripción…"
                      />
                    )}
                    {!l.locked && (
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="p-1 text-stone-400 hover:text-red-600"
                        title="Quitar línea"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-0.5">
                      <span className="text-[10px] text-stone-500">Cantidad</span>
                      <Input
                        type="number"
                        value={l.qty}
                        onChange={e => updateLine(l.key, 'qty', e.target.value)}
                        className="h-7 text-xs bg-white"
                        placeholder="0"
                        disabled={l.locked}
                      />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <span className="text-[10px] text-stone-500">Precio unit.</span>
                      <Input
                        type="number"
                        value={l.unit_price}
                        onChange={e => updateLine(l.key, 'unit_price', e.target.value)}
                        className="h-7 text-xs bg-white"
                        placeholder="0.00"
                        disabled={l.locked}
                      />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <span className="text-[10px] text-stone-500 font-medium">Monto neto</span>
                      <Input
                        type="number"
                        value={l.amount}
                        onChange={e => updateLine(l.key, 'amount', e.target.value)}
                        className={`h-7 text-xs font-medium ${l.locked ? 'bg-stone-100 text-stone-700' : 'bg-white'}`}
                        placeholder="0.00"
                        disabled={l.locked}
                      />
                    </div>
                  </div>
                  {l.locked && l.sourceEntries && l.sourceEntries.length > 1 && (
                    <p className="text-[10px] text-stone-400 pl-1">
                      {l.sourceEntries.map(e => e.entry_number).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Totals breakdown */}
          <div className="bg-stone-50 rounded-md p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">Subtotal</span>
              <span className="tabular-nums">{mxn.format(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>− Descuento</span>
                <span className="tabular-nums">−{mxn.format(discount)}</span>
              </div>
            )}
            {(discount > 0) && (
              <div className="flex justify-between font-medium border-t border-stone-200 pt-1">
                <span className="text-stone-700">Base gravable</span>
                <span className="tabular-nums">{mxn.format(taxableBase)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-600">+ IVA ({Math.round(vat * 100)}%)</span>
              <span className="tabular-nums">{mxn.format(tax)}</span>
            </div>
            {isrAmt > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>− Ret. ISR ({(isrRateNum * 100).toFixed(2)}%)</span>
                <span className="tabular-nums">−{mxn.format(isrAmt)}</span>
              </div>
            )}
            {ivaRetAmt > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>− Ret. IVA ({(ivaRetRateNum * 100).toFixed(2)}% s/IVA)</span>
                <span className="tabular-nums">−{mxn.format(ivaRetAmt)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between font-semibold text-base">
              <span>Total a pagar</span>
              <span className="tabular-nums">{mxn.format(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-stone-200 px-6 py-4 flex justify-end gap-3 bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={() => void handleSubmit()} disabled={loading} className="bg-sky-700 hover:bg-sky-800 text-white">
            {loading ? 'Creando…' : 'Crear factura'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
