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
import { Plus, Trash2, AlertTriangle, FileUp, FileCheck2, X, CheckCircle2, Truck } from 'lucide-react'
import type { InvoiceCostCategory, ParsedCfdi, CfdiCaptureMode } from '@/types/finance'
import { c_FormaPago, c_MetodoPago, c_UsoCFDI } from '@/lib/sat/codigosSat'
import RetentionRateSelect, { useRetentionRateState } from '@/components/finanzas/RetentionRateSelect'
import { ISR_RETENTION_PRESETS, IVA_RETENTION_PRESETS } from '@/lib/ap/retentionRates'

export type OrphanEntry = {
  id: string
  entry_number: string
  entry_date: string
  plant_id: string
  supplier_id: string
  fleet_supplier_id: string | null
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
  ap_due_date_fleet: string | null
  supplier?: {
    id: string
    name: string
    group_id: string | null
    default_vat_rate: number | null
    supplier_group?: { id: string; name: string } | null
  } | null
  fleet_supplier?: {
    id: string
    name: string
    group_id: string | null
    default_vat_rate: number | null
    supplier_group?: { id: string; name: string } | null
  } | null
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
  /**
   * When true the drawer is in fleet-only mode: shows fleet lines as the
   * primary content, hides the material section, defaults ISR to 1.25%.
   * Used from the "Fletes pendientes" workflow.
   */
  fleetOnly?: boolean
  onSuccess: () => void
}

const DEFAULT_VAT = 0.16

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Build aggregated material display lines from orphan entries (groups by material_id, sums total_cost). */
function buildMaterialLines(entries: OrphanEntry[]): LineItem[] {
  const matGroups = new Map<string, OrphanEntry[]>()
  for (const e of entries) {
    const mid = e.material_id
    if (!matGroups.has(mid)) matGroups.set(mid, [])
    matGroups.get(mid)!.push(e)
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
  return lines
}

/** Build aggregated fleet display lines from orphan entries (groups by material_id, sums fleet_cost > 0). */
function buildFleetLines(entries: OrphanEntry[]): LineItem[] {
  const fleetGroups = new Map<string, OrphanEntry[]>()
  for (const e of entries) {
    if (Number(e.fleet_cost ?? 0) > 0) {
      const mid = e.material_id
      if (!fleetGroups.has(mid)) fleetGroups.set(mid, [])
      fleetGroups.get(mid)!.push(e)
    }
  }

  const lines: LineItem[] = []
  for (const [, grp] of fleetGroups) {
    const totalFleet = grp.reduce((s, e) => s + Number(e.fleet_cost ?? 0), 0)
    const matName = grp[0].material?.material_name ?? ''
    lines.push({
      key: `fleet:${grp[0].material_id}`,
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

// ── small helper: CFDI pill badge ─────────────────────────────────────────────
function CfdiPill() {
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-semibold uppercase tracking-wide leading-none">
      <CheckCircle2 className="h-2.5 w-2.5" />
      CFDI
    </span>
  )
}

export default function CreateSupplierInvoiceDrawer({ open, onOpenChange, entries, plantId, queueInfo, fleetOnly = false, onSuccess }: Props) {
  const isHistorical = !entries || entries.length === 0

  // ── supplier group ─────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<SupplierGroup[]>([])
  const [groupId, setGroupId] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)

  // Fleet supplier group (separate from material supplier)
  const [fleetGroupId, setFleetGroupId] = useState('')
  const [includeFleetInThisInvoice, setIncludeFleetInThisInvoice] = useState(false)

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
  const isrRetention = useRetentionRateState(0, ISR_RETENTION_PRESETS)
  const ivaRetention = useRetentionRateState(0, IVA_RETENTION_PRESETS)

  // ── line items (split) ─────────────────────────────────────────────────────
  const [materialLines, setMaterialLines] = useState<LineItem[]>([])
  const [fleetLines, setFleetLines] = useState<LineItem[]>([])

  // ── CFDI XML upload ───────────────────────────────────────────────────────
  const [cfdiCaptureMode, setCfdiCaptureMode] = useState<CfdiCaptureMode>('manual')
  const [parsedCfdi, setParsedCfdi] = useState<ParsedCfdi | null>(null)
  const [cfdiFile, setCfdiFile] = useState<File | null>(null)
  const [parsingCfdi, setParsingCfdi] = useState(false)
  const [skipCfdi, setSkipCfdi] = useState(false)
  const [cfdiFormaPago, setCfdiFormaPago] = useState<string>('')
  const [cfdiMetodoPago, setCfdiMetodoPago] = useState<string>('')
  const [cfdiUso, setCfdiUso] = useState<string>('')

  // ── CFDI prefill tracking ─────────────────────────────────────────────────
  const [cfdiPrefilled, setCfdiPrefilled] = useState<Set<string>>(new Set())

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
    isrRetention.reset(0)
    ivaRetention.reset(0)
    setCfdiCaptureMode('manual')
    setParsedCfdi(null)
    setCfdiFile(null)
    setSkipCfdi(false)
    setCfdiFormaPago('')
    setCfdiMetodoPago('')
    setCfdiUso('')
    setCfdiPrefilled(new Set())
    setFleetGroupId('')

    if (isHistorical) {
      setGroupId('')
      setVatRate(String(DEFAULT_VAT))
      setInvoiceDate(format(new Date(), 'yyyy-MM-dd'))
      setDueDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
      setInvoiceNumber('')
      setMaterialLines([{
        key: crypto.randomUUID(),
        entry_id: null,
        cost_category: 'material',
        description: '',
        qty: '',
        unit_price: '',
        amount: '',
      }])
      setFleetLines([])
      setIncludeFleetInThisInvoice(false)
      return
    }

    // Non-historical: build aggregated lines from entries
    const builtMaterialLines = buildMaterialLines(entries ?? [])
    const builtFleetLines = buildFleetLines(entries ?? [])
    setMaterialLines(builtMaterialLines)
    setFleetLines(builtFleetLines)

    if (fleetOnly) {
      // Fleet-only mode: fleet lines are primary; no material invoice
      setIncludeFleetInThisInvoice(false)
      // Pre-fill supplier group from fleet supplier — prefer group_id, fall back to supplier's own group
      const fleetGroupIds = [...new Set((entries ?? [])
        .map(e => e.fleet_supplier?.group_id)
        .filter(Boolean))]
      // If no group_id set, the fleet supplier may not be in supplier_groups yet — leave picker empty
      setGroupId(fleetGroupIds.length === 1 ? (fleetGroupIds[0] as string) : '')
      setVatRate(String(DEFAULT_VAT))
      isrRetention.reset(0.0125) // 1.25% is the standard transport ISR retention
      const dueFromFleet = entries?.[0]?.ap_due_date_fleet
      if (dueFromFleet) setDueDate(dueFromFleet)
      else setDueDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
      setInvoiceNumber(entries?.[0]?.fleet_invoice ?? '')
      setInvoiceDate(format(new Date(), 'yyyy-MM-dd'))
      return
    }

    // Detect whether all entries share the same fleet supplier as the material supplier.
    // Two checks, because some suppliers have no group_id assigned yet:
    //  A) Same supplier_groups record (group_id match) — cross-plant canonical identity
    //  B) Same plant-scoped supplier row (supplier_id === fleet_supplier_id) — e.g. MAPEI with no group
    const matGroupId = firstSupplier?.group_id ?? null
    const allEnts = entries ?? []
    const sameByGroupId = !!matGroupId && allEnts.length > 0 &&
      allEnts.every(e => !!e.fleet_supplier?.group_id && e.fleet_supplier.group_id === matGroupId)
    const sameByRow = allEnts.length > 0 &&
      allEnts.every(e => !!e.fleet_supplier_id && e.fleet_supplier_id === e.supplier_id)
    const isSameSupplier = sameByGroupId || sameByRow
    // The group_id to use for the invoice — prefer group if set, fall back to first fleet supplier's group
    const resolvedFleetGroupId = matGroupId ?? null

    if (isSameSupplier && builtFleetLines.length > 0) {
      // Same company covers both material and transport — auto-include fleet in this invoice
      setIncludeFleetInThisInvoice(true)
      setFleetGroupId(resolvedFleetGroupId ?? '')
    } else {
      setIncludeFleetInThisInvoice(false)
      setFleetGroupId('')
    }

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
  }, [open, entries, isHistorical, fleetOnly])

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

  // ── line helpers (parameterised by setter) ─────────────────────────────────
  const updateLine = (
    setter: React.Dispatch<React.SetStateAction<LineItem[]>>,
    key: string,
    field: keyof LineItem,
    value: string,
  ) => {
    setter(prev => prev.map(l => {
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

  const removeLine = (
    setter: React.Dispatch<React.SetStateAction<LineItem[]>>,
    key: string,
  ) => setter(prev => prev.filter(l => l.key !== key))

  const addLine = (setter: React.Dispatch<React.SetStateAction<LineItem[]>>) =>
    setter(prev => [...prev, {
      key: crypto.randomUUID(),
      entry_id: null,
      cost_category: 'material',
      description: '',
      qty: '',
      unit_price: '',
      amount: '',
    }])

  // ── computed totals ────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => materialLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0),
    [materialLines]
  )
  const fleetSubtotal = useMemo(
    () => fleetLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0),
    [fleetLines]
  )
  // Whether material and fleet come from the same supplier (can merge into one invoice).
  // Mirrors the detection logic in the reset effect:
  //  A) Same supplier_groups.id (cross-plant)
  //  B) Same plant-scoped supplier row (supplier_id === fleet_supplier_id) — covers suppliers without a group
  const sameFleetSupplier = !isHistorical && !fleetOnly && (() => {
    const ents = entries ?? []
    if (ents.length === 0) return false
    const byGroup = !!groupId && !!fleetGroupId && groupId === fleetGroupId
    const byRow = ents.every(e => !!e.fleet_supplier_id && e.fleet_supplier_id === e.supplier_id)
    return byGroup || byRow
  })()

  // In fleet-only mode, base = fleet lines.
  // When merging same-supplier fleet into the material invoice, base = material + fleet combined.
  // Otherwise base = material lines only.
  const effectiveSubtotal = fleetOnly
    ? fleetSubtotal
    : (sameFleetSupplier && includeFleetInThisInvoice && fleetLines.length > 0)
      ? subtotal + fleetSubtotal
      : subtotal
  const vat            = parseFloat(vatRate) || 0
  const discount       = parseFloat(discountAmount) || 0
  const isrRateNum     = isrRetention.rate
  const ivaRetRateNum  = ivaRetention.rate
  const taxableBase    = Math.max(0, effectiveSubtotal - discount)
  const tax            = Math.round(taxableBase * vat * 100) / 100
  const isrAmt         = Math.round(taxableBase * isrRateNum * 100) / 100
  const ivaRetAmt      = Math.round(taxableBase * ivaRetRateNum * 100) / 100
  const total          = Math.round((taxableBase + tax - isrAmt - ivaRetAmt) * 100) / 100

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

      // Track which fields were prefilled from CFDI
      const prefilled = new Set<string>()

      // Prefill form fields from CFDI
      setInvoiceNumber([cfdi.serie, cfdi.folio].filter(Boolean).join('-') || cfdi.uuid.slice(0, 8))
      prefilled.add('invoiceNumber')
      setInvoiceDate(cfdi.fecha_emision.slice(0, 10))
      prefilled.add('invoiceDate')
      setVatRate(String(cfdi.vat_rate || DEFAULT_VAT))
      prefilled.add('vatRate')
      setCfdiFormaPago(cfdi.forma_pago ?? '')
      setCfdiMetodoPago(cfdi.metodo_pago ?? '')
      setCfdiUso(cfdi.uso_cfdi ?? '')
      if (cfdi.descuento > 0) {
        setDiscountAmount(cfdi.descuento.toFixed(2))
        prefilled.add('discountAmount')
      } else {
        setDiscountAmount('')
      }
      if (cfdi.retention_isr_rate > 0) {
        isrRetention.reset(cfdi.retention_isr_rate)
        prefilled.add('isrRate')
      } else {
        isrRetention.reset(0)
      }
      if (cfdi.retention_iva_rate > 0) {
        ivaRetention.reset(cfdi.retention_iva_rate)
        prefilled.add('ivaRetRate')
      } else {
        ivaRetention.reset(0)
      }

      setCfdiPrefilled(prefilled)

      // Match supplier group by emisor RFC
      if (data.supplier_group) {
        setGroupId(data.supplier_group.id)
      }

      // Build lines from cfdi:Conceptos (one line per concept).
      // In non-historical mode with locked entry lines we don't override, but we
      // still populate for historical / manual mode.
      if (isHistorical) {
        if (cfdi.conceptos.length > 0) {
          setMaterialLines(cfdi.conceptos.map(c => ({
            key: crypto.randomUUID(),
            entry_id: null,
            cost_category: 'material' as const,
            description: c.descripcion,
            qty: String(c.cantidad),
            unit_price: c.valor_unitario.toFixed(2),
            amount: (c.importe - c.descuento).toFixed(2),
          })))
        } else {
          // Fallback: single line with full subtotal
          setMaterialLines([{
            key: crypto.randomUUID(),
            entry_id: null,
            cost_category: 'material',
            description: cfdi.emisor_nombre ?? `CFDI ${cfdi.serie ?? ''}${cfdi.folio ?? ''}`,
            qty: '1',
            unit_price: cfdi.subtotal.toFixed(2),
            amount: cfdi.subtotal.toFixed(2),
          }])
        }
        setFleetLines([])
      }

      const nLines = cfdi.conceptos.length
      toast.success(`CFDI leído — UUID ${cfdi.uuid.slice(0, 8)}…${nLines > 0 ? ` · ${nLines} concepto(s)` : ''}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al leer el CFDI'
      toast.error(msg)
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
    setCfdiPrefilled(new Set())
  }

  /** Expand aggregated material display lines into individual API items. */
  const buildApiItems = () => {
    const items: Array<{
      entry_id: string | null
      cost_category: string
      description: string | null
      qty: number | null
      unit_price: number | null
      amount: number
    }> = []

    for (const l of materialLines) {
      if (l.sourceEntries && l.sourceEntries.length > 0) {
        for (const e of l.sourceEntries) {
          const amt = Number(e.total_cost ?? 0)
          if (amt <= 0) continue
          items.push({
            entry_id: e.id,
            cost_category: 'material',
            description: `${e.material?.material_name ?? ''} — ${e.entry_number}`,
            qty: e.received_qty_entered ?? null,
            unit_price: e.unit_price ?? null,
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

  /** Expand aggregated fleet display lines into individual API items. */
  const buildFleetApiItems = () => {
    const items: Array<{
      entry_id: string | null
      cost_category: string
      description: string | null
      qty: number | null
      unit_price: number | null
      amount: number
    }> = []

    for (const l of fleetLines) {
      if (l.sourceEntries && l.sourceEntries.length > 0) {
        for (const e of l.sourceEntries) {
          const amt = Number(e.fleet_cost ?? 0)
          if (amt <= 0) continue
          items.push({
            entry_id: e.id,
            cost_category: 'fleet',
            description: `Flete — ${e.entry_number}`,
            qty: null,
            unit_price: e.fleet_cost ?? null,
            amount: amt,
          })
        }
      } else {
        items.push({
          entry_id: l.entry_id,
          cost_category: 'fleet',
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

    // Fleet-only mode: validate fleet lines instead of material lines
    if (fleetOnly) {
      if (fleetLines.length === 0) { toast.error('Agrega al menos una línea de flete'); return }
      const invalidFleet = fleetLines.find(l => !l.amount || parseFloat(l.amount) <= 0)
      if (invalidFleet) { toast.error('Todas las líneas deben tener monto'); return }
      const fleetItems = buildFleetApiItems()
      if (fleetItems.length === 0) { toast.error('No hay líneas válidas'); return }
      const fleetSubtotalAmt = fleetLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
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
            subtotal: fleetSubtotalAmt,
            discount_amount: discount,
            retention_isr_rate: isrRateNum,
            retention_iva_rate: ivaRetRateNum,
            source: 'system',
            notes: notes.trim() || null,
            items: fleetItems,
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
        if (!res.ok) { toast.error(data.error ?? 'Error al crear factura de flete'); return }
        toast.success(`Factura de flete ${data.invoice.invoice_number} creada`)
        onOpenChange(false)
        onSuccess()
      } finally {
        setLoading(false)
      }
      return
    }

    if (materialLines.length === 0) { toast.error('Agrega al menos una línea de material'); return }
    const invalidLine = materialLines.find(l => !l.amount || parseFloat(l.amount) <= 0)
    if (invalidLine) { toast.error('Todas las líneas deben tener monto'); return }

    const apiItems = buildApiItems()
    if (apiItems.length === 0) { toast.error('No hay líneas válidas'); return }

    // Warn if user-edited subtotal deviates from the parsed CFDI
    if (parsedCfdi) {
      if (Math.abs(effectiveSubtotal - parsedCfdi.subtotal) > 0.02) {
        const ok = window.confirm(
          `El subtotal capturado (${effectiveSubtotal.toFixed(2)}) no coincide con el del CFDI (${parsedCfdi.subtotal.toFixed(2)}). ¿Continuar?`,
        )
        if (!ok) return
      }
    }

    setLoading(true)
    try {
      // ── Build items: merge fleet into material when same supplier group ────
      // Same supplier → one invoice with both material and fleet lines.
      // Different supplier → one material invoice now, fleet invoice separately below.
      const mergeFleet = sameFleetSupplier && includeFleetInThisInvoice && fleetLines.length > 0
      const combinedItems = mergeFleet ? [...apiItems, ...buildFleetApiItems()] : apiItems

      // ── Invoice 1: material supplier (may include fleet when same supplier) ─
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
          subtotal: effectiveSubtotal,
          discount_amount: discount,
          retention_isr_rate: isrRateNum,
          retention_iva_rate: ivaRetRateNum,
          source: isHistorical ? 'historical' : 'system',
          notes: notes.trim() || null,
          items: combinedItems,
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
      toast.success(`Factura ${data.invoice.invoice_number} creada${mergeFleet ? ' (material + flete)' : ''}`)
      // Surface non-fatal server warnings (e.g. payable not created due to missing group)
      if (Array.isArray(data.warnings)) {
        for (const w of data.warnings) toast.warning(w, { duration: 8000 })
      }

      // ── Invoice 2: fleet supplier — only when DIFFERENT from material supplier ─
      if (!mergeFleet && includeFleetInThisInvoice && fleetLines.length > 0 && fleetGroupId) {
        const fleetItems = buildFleetApiItems()
        if (fleetItems.length > 0) {
          const fleetSubtotalAmt = fleetLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
          const fleetRes = await fetch('/api/ap/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplier_group_id: fleetGroupId,
              plant_id: effectivePlantId,
              invoice_number: '',
              is_internal: true,
              invoice_date: invoiceDate,
              due_date: dueDate,
              vat_rate: vat,
              subtotal: fleetSubtotalAmt,
              discount_amount: 0,
              retention_isr_rate: 0.0125,
              retention_iva_rate: 0,
              source: isHistorical ? 'historical' : 'system',
              notes: `Flete — generado junto con factura ${data.invoice.invoice_number}`,
              items: fleetItems,
              cfdi_uuid: null,
              cfdi_serie: null,
              cfdi_folio: null,
              cfdi_forma_pago: null,
              cfdi_metodo_pago: null,
              cfdi_uso: null,
              cfdi_tipo_comprobante: null,
              cfdi_fecha_emision: null,
              cfdi_fecha_timbrado: null,
              cfdi_emisor_rfc: null,
              cfdi_receptor_rfc: null,
              cfdi_capture_mode: 'manual' as CfdiCaptureMode,
            }),
          })
          const fleetData = await fleetRes.json()
          if (!fleetRes.ok) {
            toast.error(fleetData.error ?? 'Error al crear factura de flete')
          } else {
            toast.success(`Factura de flete ${fleetData.invoice.invoice_number} creada`)
            if (Array.isArray(fleetData.warnings)) {
              for (const w of fleetData.warnings) toast.warning(w, { duration: 8000 })
            }
          }
        }
      }

      onOpenChange(false)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  // Resolved group name for read-only display
  const resolvedGroupName = groups.find(g => g.id === groupId)?.name ?? firstSupplier?.name ?? null

  // Helper to render a set of line item cards
  const renderLineCards = (
    lines: LineItem[],
    setter: React.Dispatch<React.SetStateAction<LineItem[]>>,
    showAddButton: boolean,
  ) => (
    <div className="space-y-2">
      {lines.map(l => (
        <div key={l.key} className={`rounded-md p-3 space-y-2 border ${l.locked ? 'bg-stone-50/70 border-stone-100' : 'bg-stone-50 border-stone-200'}`}>
          <div className="flex items-center gap-2">
            {l.locked ? (
              <span className={`px-2 py-0.5 rounded text-xs font-medium w-24 text-center ${l.cost_category === 'fleet' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {l.cost_category === 'fleet' ? 'Flete' : 'Material'}
              </span>
            ) : (
              <Select value={l.cost_category} onValueChange={v => updateLine(setter, l.key, 'cost_category', v as InvoiceCostCategory)}>
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
                onChange={e => updateLine(setter, l.key, 'description', e.target.value)}
                className="flex-1 h-7 text-xs bg-white"
                placeholder="Descripción…"
              />
            )}
            {!l.locked && (
              <button
                type="button"
                onClick={() => removeLine(setter, l.key)}
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
                onChange={e => updateLine(setter, l.key, 'qty', e.target.value)}
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
                onChange={e => updateLine(setter, l.key, 'unit_price', e.target.value)}
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
                onChange={e => updateLine(setter, l.key, 'amount', e.target.value)}
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
      {showAddButton && (
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 mt-1" onClick={() => addLine(setter)}>
          <Plus className="h-3.5 w-3.5" /> Agregar línea
        </Button>
      )}
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden">
        <SheetHeader className="px-6 pt-5 pb-4 border-b border-stone-200 shrink-0">
          <SheetTitle className="flex items-center gap-2">
            {fleetOnly
              ? `Factura de flete (${entries?.length ?? 0} entrada${(entries?.length ?? 0) !== 1 ? 's' : ''})`
              : isHistorical
                ? 'Nueva factura histórica'
                : `Crear factura (${entries?.length ?? 0} recepcion${(entries?.length ?? 0) !== 1 ? 'es' : ''})`}
            {queueInfo && queueInfo.remaining > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full text-xs font-medium">
                {queueInfo.remaining} más después
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {fleetOnly
              ? 'Registra la factura del proveedor de transporte/flete para las entradas seleccionadas.'
              : isHistorical
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
                      {/* Subtotal/Total line removed — shown in totals panel comparison below */}
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

            {/* CFDI emisor identity banner — shown whenever a CFDI is loaded */}
            {parsedCfdi && (
              <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                <span className="font-medium shrink-0">CFDI emisor:</span>
                <span className="font-mono font-semibold">{parsedCfdi.emisor_rfc}</span>
                {parsedCfdi.emisor_nombre && (
                  <span className="truncate text-sky-700">{parsedCfdi.emisor_nombre}</span>
                )}
              </div>
            )}

            {/* RFC mismatch warning */}
            {parsedCfdi && groupId && (() => {
              const selectedGroup = groups.find(g => g.id === groupId)
              if (!selectedGroup?.rfc) return null
              const rfcOk = selectedGroup.rfc.toUpperCase() === parsedCfdi.emisor_rfc.toUpperCase()
              if (rfcOk) return (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  RFC del proveedor coincide con el CFDI ({selectedGroup.rfc})
                </div>
              )
              return (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    El RFC del grupo seleccionado <strong>{selectedGroup.rfc}</strong> no coincide con el RFC emisor del CFDI <strong>{parsedCfdi.emisor_rfc}</strong>. Verifica que el proveedor sea correcto.
                  </span>
                </div>
              )
            })()}

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
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}{g.rfc ? ` · ${g.rfc}` : ''}
                        </SelectItem>
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
                {(() => {
                  const grp = groups.find(g => g.id === groupId)
                  return grp?.rfc
                    ? <span className="text-xs font-mono text-stone-500 ml-auto">{grp.rfc}</span>
                    : null
                })()}
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
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}{g.rfc ? ` · ${g.rfc}` : ''}
                        </SelectItem>
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
                <Label className="text-xs flex items-center">
                  Número de factura *
                  {cfdiPrefilled.has('invoiceNumber') && <CfdiPill />}
                </Label>
                <Input
                  value={invoiceNumber}
                  onChange={e => {
                    setInvoiceNumber(e.target.value)
                    setCfdiPrefilled(prev => { const s = new Set(prev); s.delete('invoiceNumber'); return s })
                  }}
                  className="bg-white"
                  placeholder="Ej. A-12345"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center">
                  Fecha de factura *
                  {cfdiPrefilled.has('invoiceDate') && <CfdiPill />}
                </Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={e => {
                    setInvoiceDate(e.target.value)
                    setCfdiPrefilled(prev => { const s = new Set(prev); s.delete('invoiceDate'); return s })
                  }}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha de vencimiento *</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-white" />
              </div>
            </div>
            <div className="space-y-1 w-40">
              <Label className="text-xs flex items-center">
                IVA
                {cfdiPrefilled.has('vatRate') && <CfdiPill />}
              </Label>
              <Select value={vatRate} onValueChange={v => {
                setVatRate(v)
                setCfdiPrefilled(prev => { const s = new Set(prev); s.delete('vatRate'); return s })
              }}>
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
                <Label className="text-xs flex items-center">
                  Descuento (pre-IVA)
                  {cfdiPrefilled.has('discountAmount') && <CfdiPill />}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={e => {
                    setDiscountAmount(e.target.value)
                    setCfdiPrefilled(prev => { const s = new Set(prev); s.delete('discountAmount'); return s })
                  }}
                  className="bg-white"
                  placeholder="0.00"
                />
              </div>
              <RetentionRateSelect
                label={<>Retención ISR{cfdiPrefilled.has('isrRate') && <CfdiPill />}</>}
                presets={ISR_RETENTION_PRESETS}
                presetOptions={[
                  { value: '0', label: '0% (ninguna)' },
                  { value: '0.0125', label: '1.25% — fletes / RIF' },
                  { value: '0.10', label: '10% — honorarios PF' },
                ]}
                selectValue={isrRetention.selectValue}
                customDraft={isrRetention.customDraft}
                editingCustom={isrRetention.editingCustom}
                onSelectValueChange={v => {
                  isrRetention.setSelectValue(v)
                  setCfdiPrefilled(prev => { const s = new Set(prev); s.delete('isrRate'); return s })
                }}
                onCustomDraftChange={isrRetention.setCustomDraft}
                onEditingCustomChange={isrRetention.setEditingCustom}
              />
              <RetentionRateSelect
                label={<>Retención IVA{cfdiPrefilled.has('ivaRetRate') && <CfdiPill />}</>}
                presets={IVA_RETENTION_PRESETS}
                presetOptions={[
                  { value: '0', label: '0% (ninguna)' },
                  { value: '0.04', label: '4% — autotransporte' },
                  { value: '0.106667', label: '10.67% — servicios 2/3' },
                ]}
                selectValue={ivaRetention.selectValue}
                customDraft={ivaRetention.customDraft}
                editingCustom={ivaRetention.editingCustom}
                onSelectValueChange={v => {
                  ivaRetention.setSelectValue(v)
                  setCfdiPrefilled(prev => { const s = new Set(prev); s.delete('ivaRetRate'); return s })
                }}
                onCustomDraftChange={ivaRetention.setCustomDraft}
                onEditingCustomChange={ivaRetention.setEditingCustom}
              />
            </div>
          </section>

          <Separator />

          {/* Line items */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Líneas de factura</h3>
            </div>

            {fleetOnly ? (
              /* Fleet-only mode: fleet lines are the primary content */
              <div className="space-y-2">
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide flex items-center gap-1">
                  <Truck className="h-3 w-3" /> Flete / Transporte
                </p>
                {renderLineCards(fleetLines, setFleetLines, false)}
              </div>
            ) : (
              <>
                {/* Material sub-section */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-stone-600 uppercase tracking-wide">Material</p>
                  {renderLineCards(materialLines, setMaterialLines, isHistorical)}
                </div>

                {/* Fleet sub-section — only in non-historical mode when there are fleet lines */}
                {!isHistorical && fleetLines.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-xs font-medium text-stone-600 uppercase tracking-wide">Flete</p>

                    {/* Toggle / status banner — mutually exclusive */}
                    {sameFleetSupplier ? (
                      /* Same supplier: auto-merged, no toggle needed */
                      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        <span className="mt-0.5">✓</span>
                        <span>El proveedor de flete es el mismo que el de material — las líneas de flete se incluyen automáticamente en esta factura.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="include-fleet"
                          checked={includeFleetInThisInvoice}
                          onCheckedChange={v => setIncludeFleetInThisInvoice(!!v)}
                        />
                        <label htmlFor="include-fleet" className="text-xs cursor-pointer select-none">
                          Incluir flete en esta misma factura (genera una segunda factura para el transportista)
                        </label>
                      </div>
                    )}

                    {includeFleetInThisInvoice ? (
                      <div className="space-y-3">
                        {/* Fleet supplier picker — hidden when same supplier (already set) */}
                        {!sameFleetSupplier && (
                          <div className="space-y-1">
                            <Label className="text-xs">Proveedor de flete</Label>
                            <Select value={fleetGroupId || '__none__'} onValueChange={v => setFleetGroupId(v === '__none__' ? '' : v)}>
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Seleccionar proveedor de flete…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Seleccionar —</SelectItem>
                                {groups.map(g => (
                                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Fleet line cards */}
                        {renderLineCards(fleetLines, setFleetLines, false)}

                        {/* Fleet subtotal */}
                        <div className="flex justify-between text-xs text-stone-600 pt-1">
                          <span>Subtotal flete</span>
                          <span className="tabular-nums font-medium">{mxn.format(fleetSubtotal)}</span>
                        </div>
                      </div>
                    ) : (
                      /* Info banner when fleet lines exist but are excluded */
                      <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">
                        Las líneas de flete no se incluyen en esta factura. Crea una factura separada para el transportista desde la pestaña &quot;Fletes pendientes&quot;.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Totals breakdown */}
          <div className="bg-stone-50 rounded-md p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">Subtotal</span>
              <span className="tabular-nums">{mxn.format(effectiveSubtotal)}</span>
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
                <span>− Ret. IVA ({(ivaRetRateNum * 100).toFixed(2)}% s/base)</span>
                <span className="tabular-nums">−{mxn.format(ivaRetAmt)}</span>
              </div>
            )}

            {/* CFDI comparison row */}
            {parsedCfdi && (() => {
              const subtotalDiff = Math.abs(effectiveSubtotal - parsedCfdi.subtotal)
              const totalDiff    = Math.abs(total             - parsedCfdi.total)
              const subtotalOk   = subtotalDiff <= 0.02
              const totalOk      = totalDiff    <= 0.02
              return (
                <>
                  <Separator className="my-1" />
                  <div className="grid grid-cols-2 gap-x-4 text-xs py-1">
                    <div className="text-stone-500 font-medium">CFDI dice:</div>
                    <div className="text-stone-500 font-medium">Esta factura:</div>

                    {/* Subtotal row */}
                    <div className={`flex items-center gap-1 ${subtotalOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {!subtotalOk && <AlertTriangle className="h-3 w-3 shrink-0" />}
                      Subtotal {mxn.format(parsedCfdi.subtotal)}
                    </div>
                    <div className={`tabular-nums ${subtotalOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                      Subtotal {mxn.format(effectiveSubtotal)}
                    </div>

                    {/* Total row */}
                    <div className={`flex items-center gap-1 ${totalOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {!totalOk && <AlertTriangle className="h-3 w-3 shrink-0" />}
                      Total {mxn.format(parsedCfdi.total)}
                    </div>
                    <div className={`tabular-nums ${totalOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                      Total {mxn.format(total)}
                    </div>
                  </div>
                </>
              )
            })()}

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
