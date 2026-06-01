import type { SupabaseClient } from '@supabase/supabase-js'

export type SupplierGroupRow = {
  id: string
  name: string
  rfc: string | null
  is_active: boolean
  created_at: string
}

export type GroupEnrichment = {
  supplier_count: number
  invoice_count: number
  credit_note_count: number
  suggested_rfc: string | null
  rfc_conflict: boolean
}

export type EnrichedSupplierGroup = SupplierGroupRow & GroupEnrichment

export type DuplicateCluster = {
  normalized_name: string
  groups: EnrichedSupplierGroup[]
  canonical_id: string
}

export type MaintenancePreview = {
  groups: EnrichedSupplierGroup[]
  duplicate_clusters: DuplicateCluster[]
  missing_rfc_with_suggestion: EnrichedSupplierGroup[]
  empty_groups: EnrichedSupplierGroup[]
  stats: {
    total_active: number
    without_rfc: number
    duplicate_name_clusters: number
    duplicate_groups_to_merge: number
    empty_groups: number
  }
}

export type MaintenanceResult = {
  merged_clusters: number
  deactivated_groups: number
  rfc_backfilled: number
  suppliers_relinked: number
  invoices_relinked: number
  credit_notes_relinked: number
}

export function normalizeGroupName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function normalizeRfc(rfc: string | null | undefined): string | null {
  const v = rfc?.trim().toUpperCase()
  return v || null
}

/** Pick the best group to keep when merging same-name duplicates. */
export function pickCanonicalGroupId(groups: EnrichedSupplierGroup[]): string {
  if (groups.length === 0) throw new Error('empty cluster')
  const sorted = [...groups].sort((a, b) => {
    const score = (g: EnrichedSupplierGroup) =>
      (g.rfc ? 1_000_000 : 0) +
      g.supplier_count * 1_000 +
      g.invoice_count * 100 +
      g.credit_note_count * 10
  const diff = score(b) - score(a)
    if (diff !== 0) return diff
    return a.created_at.localeCompare(b.created_at)
  })
  return sorted[0].id
}

export function buildDuplicateClusters(groups: EnrichedSupplierGroup[]): DuplicateCluster[] {
  const byName = new Map<string, EnrichedSupplierGroup[]>()
  for (const g of groups) {
    const key = normalizeGroupName(g.name)
    const list = byName.get(key) ?? []
    list.push(g)
    byName.set(key, list)
  }
  const clusters: DuplicateCluster[] = []
  for (const [normalized_name, members] of byName) {
    if (members.length < 2) continue
    clusters.push({
      normalized_name,
      groups: members,
      canonical_id: pickCanonicalGroupId(members),
    })
  }
  clusters.sort((a, b) => b.groups.length - a.groups.length)
  return clusters
}

function distinctRfcsFromInvoices(
  invoices: { cfdi_emisor_rfc: string | null }[],
): { suggested: string | null; conflict: boolean } {
  const set = new Set<string>()
  for (const inv of invoices) {
    const rfc = normalizeRfc(inv.cfdi_emisor_rfc)
    if (rfc) set.add(rfc)
  }
  if (set.size === 0) return { suggested: null, conflict: false }
  if (set.size === 1) return { suggested: [...set][0], conflict: false }
  return { suggested: null, conflict: true }
}

export function buildMaintenancePreview(groups: EnrichedSupplierGroup[]): MaintenancePreview {
  const duplicate_clusters = buildDuplicateClusters(groups)
  const duplicateIds = new Set(
    duplicate_clusters.flatMap(c => c.groups.filter(g => g.id !== c.canonical_id).map(g => g.id)),
  )

  const missing_rfc_with_suggestion = groups.filter(
    g => !g.rfc && g.suggested_rfc && !g.rfc_conflict,
  )

  const empty_groups = groups.filter(
    g =>
      g.supplier_count === 0 &&
      g.invoice_count === 0 &&
      g.credit_note_count === 0,
  )

  return {
    groups,
    duplicate_clusters,
    missing_rfc_with_suggestion,
    empty_groups,
    stats: {
      total_active: groups.length,
      without_rfc: groups.filter(g => !g.rfc).length,
      duplicate_name_clusters: duplicate_clusters.length,
      duplicate_groups_to_merge: duplicateIds.size,
      empty_groups: empty_groups.length,
    },
  }
}

export async function loadEnrichedSupplierGroups(
  supabase: SupabaseClient,
): Promise<EnrichedSupplierGroup[]> {
  const { data: groupRows, error: gErr } = await supabase
    .from('supplier_groups')
    .select('id, name, rfc, is_active, created_at')
    .eq('is_active', true)
    .order('name')

  if (gErr) throw gErr
  const groups = groupRows ?? []
  if (groups.length === 0) return []

  const ids = groups.map(g => g.id)

  const [{ data: suppliers }, { data: invoices }, { data: creditNotes }] = await Promise.all([
    supabase.from('suppliers').select('group_id').in('group_id', ids),
    supabase
      .from('supplier_invoices')
      .select('supplier_group_id, cfdi_emisor_rfc')
      .in('supplier_group_id', ids),
    supabase
      .from('invoice_credit_notes')
      .select('supplier_group_id')
      .in('supplier_group_id', ids),
  ])

  const supplierCounts = new Map<string, number>()
  for (const s of suppliers ?? []) {
    if (!s.group_id) continue
    supplierCounts.set(s.group_id, (supplierCounts.get(s.group_id) ?? 0) + 1)
  }

  const invoicesByGroup = new Map<string, { cfdi_emisor_rfc: string | null }[]>()
  const invoiceCounts = new Map<string, number>()
  for (const inv of invoices ?? []) {
    const gid = inv.supplier_group_id
    invoiceCounts.set(gid, (invoiceCounts.get(gid) ?? 0) + 1)
    const list = invoicesByGroup.get(gid) ?? []
    list.push({ cfdi_emisor_rfc: inv.cfdi_emisor_rfc })
    invoicesByGroup.set(gid, list)
  }

  const cnCounts = new Map<string, number>()
  for (const cn of creditNotes ?? []) {
    const gid = cn.supplier_group_id
    cnCounts.set(gid, (cnCounts.get(gid) ?? 0) + 1)
  }

  return groups.map(g => {
    const invList = invoicesByGroup.get(g.id) ?? []
    const { suggested, conflict } = distinctRfcsFromInvoices(invList)
    return {
      ...g,
      supplier_count: supplierCounts.get(g.id) ?? 0,
      invoice_count: invoiceCounts.get(g.id) ?? 0,
      credit_note_count: cnCounts.get(g.id) ?? 0,
      suggested_rfc: g.rfc ? null : suggested,
      rfc_conflict: !g.rfc && conflict,
    }
  })
}

export async function runSupplierGroupMaintenance(
  supabase: SupabaseClient,
  options: { merge_duplicates?: boolean; backfill_rfc?: boolean; deactivate_empty?: boolean } = {},
): Promise<MaintenanceResult> {
  const {
    merge_duplicates = true,
    backfill_rfc = true,
    deactivate_empty = true,
  } = options

  const enriched = await loadEnrichedSupplierGroups(supabase)
  const preview = buildMaintenancePreview(enriched)

  const result: MaintenanceResult = {
    merged_clusters: 0,
    deactivated_groups: 0,
    rfc_backfilled: 0,
    suppliers_relinked: 0,
    invoices_relinked: 0,
    credit_notes_relinked: 0,
  }

  const idsToDeactivate = new Set<string>()

  if (merge_duplicates) {
    for (const cluster of preview.duplicate_clusters) {
      const canonicalId = cluster.canonical_id
      const duplicateIds = cluster.groups.filter(g => g.id !== canonicalId).map(g => g.id)
      if (duplicateIds.length === 0) continue

      const canonical = cluster.groups.find(g => g.id === canonicalId)!
      let canonicalRfc = normalizeRfc(canonical.rfc)

      for (const dup of cluster.groups) {
        if (dup.id === canonicalId) continue
        if (!canonicalRfc && dup.rfc) canonicalRfc = normalizeRfc(dup.rfc)
        if (!canonicalRfc && dup.suggested_rfc) canonicalRfc = normalizeRfc(dup.suggested_rfc)
      }

      if (backfill_rfc && !canonicalRfc && canonical.suggested_rfc) {
        canonicalRfc = normalizeRfc(canonical.suggested_rfc)
      }

      if (backfill_rfc && canonicalRfc && !canonical.rfc) {
        const { error } = await supabase
          .from('supplier_groups')
          .update({ rfc: canonicalRfc })
          .eq('id', canonicalId)
        if (!error) result.rfc_backfilled += 1
      }

      for (const dupId of duplicateIds) {
        const { data: movedSuppliers } = await supabase
          .from('suppliers')
          .update({ group_id: canonicalId })
          .eq('group_id', dupId)
          .select('id')
        result.suppliers_relinked += movedSuppliers?.length ?? 0

        const { data: movedInvoices } = await supabase
          .from('supplier_invoices')
          .update({ supplier_group_id: canonicalId })
          .eq('supplier_group_id', dupId)
          .select('id')
        result.invoices_relinked += movedInvoices?.length ?? 0

        const { data: movedCn } = await supabase
          .from('invoice_credit_notes')
          .update({ supplier_group_id: canonicalId })
          .eq('supplier_group_id', dupId)
          .select('id')
        result.credit_notes_relinked += movedCn?.length ?? 0

        idsToDeactivate.add(dupId)
      }

      result.merged_clusters += 1
    }
  }

  if (backfill_rfc) {
    const refreshed = await loadEnrichedSupplierGroups(supabase)
    for (const g of refreshed) {
      if (g.rfc || !g.suggested_rfc || g.rfc_conflict || idsToDeactivate.has(g.id)) continue
      const { error } = await supabase
        .from('supplier_groups')
        .update({ rfc: g.suggested_rfc })
        .eq('id', g.id)
      if (!error) result.rfc_backfilled += 1
    }
  }

  if (deactivate_empty) {
    const refreshed = await loadEnrichedSupplierGroups(supabase)
    for (const g of refreshed) {
      if (
        g.supplier_count === 0 &&
        g.invoice_count === 0 &&
        g.credit_note_count === 0
      ) {
        idsToDeactivate.add(g.id)
      }
    }
  }

  if (idsToDeactivate.size > 0) {
    const { data } = await supabase
      .from('supplier_groups')
      .update({ is_active: false })
      .in('id', [...idsToDeactivate])
      .select('id')
    result.deactivated_groups = data?.length ?? 0
  }

  return result
}
