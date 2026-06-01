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
  plan: MaintenanceExecutionPlan
}

export type SupplierForPlan = {
  id: string
  name: string
  group_id: string | null
  plant_id: string | null
  provider_number: number | null
}

export type GroupPlanSnapshot = {
  id: string
  name: string
  rfc: string | null
  supplier_count: number
  invoice_count: number
  credit_note_count: number
}

export type SupplierRelinkPreview = {
  supplier_id: string
  supplier_name: string
  plant_id: string | null
  provider_number: number | null
  from_group_id: string
  from_group_name: string
  to_group_id: string
  to_group_name: string
}

export type MergeClusterPlan = {
  normalized_name: string
  canonical: GroupPlanSnapshot
  /** RFC on canonical after merge (null = stays without RFC). */
  rfc_after_merge: string | null
  duplicates: GroupPlanSnapshot[]
  suppliers_to_relink: SupplierRelinkPreview[]
  invoices_to_relink: number
  credit_notes_to_relink: number
  warnings: string[]
}

export type RfcBackfillPlan = {
  group_id: string
  group_name: string
  rfc: string
  invoice_count: number
  source: 'invoices' | 'merge'
}

export type DeactivateGroupPlan = {
  group_id: string
  group_name: string
  rfc: string | null
  reason: 'merged_duplicate' | 'empty_unused'
}

export type MaintenanceExecutionPlan = {
  merge_clusters: MergeClusterPlan[]
  rfc_backfills: RfcBackfillPlan[]
  deactivations: DeactivateGroupPlan[]
  totals: {
    groups_merged_away: number
    suppliers_relinked: number
    invoices_relinked: number
    credit_notes_relinked: number
    rfc_updates: number
    groups_deactivated: number
  }
  warnings: string[]
  has_actions: boolean
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

function toSnapshot(g: EnrichedSupplierGroup): GroupPlanSnapshot {
  return {
    id: g.id,
    name: g.name,
    rfc: g.rfc,
    supplier_count: g.supplier_count,
    invoice_count: g.invoice_count,
    credit_note_count: g.credit_note_count,
  }
}

function resolveMergedCanonicalRfc(
  canonical: EnrichedSupplierGroup,
  cluster: EnrichedSupplierGroup[],
): string | null {
  let rfc = normalizeRfc(canonical.rfc)
  for (const member of cluster) {
    if (member.id === canonical.id) continue
    if (!rfc && member.rfc) rfc = normalizeRfc(member.rfc)
    if (!rfc && member.suggested_rfc) rfc = normalizeRfc(member.suggested_rfc)
  }
  if (!rfc && canonical.suggested_rfc) rfc = normalizeRfc(canonical.suggested_rfc)
  return rfc
}

export function buildMaintenanceExecutionPlan(
  groups: EnrichedSupplierGroup[],
  suppliers: SupplierForPlan[],
): MaintenanceExecutionPlan {
  const duplicate_clusters = buildDuplicateClusters(groups)

  const mergedAwayIds = new Set<string>()
  const canonicalKeptIds = new Set<string>()
  const merge_clusters: MergeClusterPlan[] = []
  const globalWarnings: string[] = []

  let suppliersRelinked = 0
  let invoicesRelinked = 0
  let creditNotesRelinked = 0

  for (const cluster of duplicate_clusters) {
    const canonical = cluster.groups.find(g => g.id === cluster.canonical_id)!
    canonicalKeptIds.add(canonical.id)
    const duplicates = cluster.groups.filter(g => g.id !== canonical.id)
    for (const d of duplicates) mergedAwayIds.add(d.id)

    const rfc_after_merge = resolveMergedCanonicalRfc(canonical, cluster.groups)
    const warnings: string[] = []

    const distinctMemberRfcs = new Set(
      cluster.groups.map(g => normalizeRfc(g.rfc)).filter((r): r is string => !!r),
    )
    if (distinctMemberRfcs.size > 1) {
      warnings.push(
        `Hay ${distinctMemberRfcs.size} RFC distintos entre duplicados (${[...distinctMemberRfcs].join(', ')}). Verifique que sea la misma empresa.`,
      )
    }

    const suppliers_to_relink: SupplierRelinkPreview[] = []
    let invCount = 0
    let cnCount = 0

    for (const dup of duplicates) {
      invCount += dup.invoice_count
      cnCount += dup.credit_note_count
      for (const s of suppliers) {
        if (s.group_id !== dup.id) continue
        suppliers_to_relink.push({
          supplier_id: s.id,
          supplier_name: s.name,
          plant_id: s.plant_id,
          provider_number: s.provider_number,
          from_group_id: dup.id,
          from_group_name: dup.name,
          to_group_id: canonical.id,
          to_group_name: canonical.name,
        })
      }
    }

    suppliersRelinked += suppliers_to_relink.length
    invoicesRelinked += invCount
    creditNotesRelinked += cnCount

    merge_clusters.push({
      normalized_name: cluster.normalized_name,
      canonical: toSnapshot(canonical),
      rfc_after_merge,
      duplicates: duplicates.map(toSnapshot),
      suppliers_to_relink,
      invoices_to_relink: invCount,
      credit_notes_to_relink: cnCount,
      warnings,
    })
  }

  const rfc_backfills: RfcBackfillPlan[] = []
  const rfcUpdatedInMerge = new Set<string>()

  for (const m of merge_clusters) {
    if (m.rfc_after_merge && !m.canonical.rfc) {
      rfcUpdatedInMerge.add(m.canonical.id)
    }
  }

  for (const g of groups) {
    if (g.rfc || !g.suggested_rfc || g.rfc_conflict || mergedAwayIds.has(g.id)) continue
    if (rfcUpdatedInMerge.has(g.id)) continue
    rfc_backfills.push({
      group_id: g.id,
      group_name: g.name,
      rfc: g.suggested_rfc,
      invoice_count: g.invoice_count,
      source: 'invoices',
    })
  }

  const deactivations: DeactivateGroupPlan[] = []

  for (const m of merge_clusters) {
    for (const dup of m.duplicates) {
      deactivations.push({
        group_id: dup.id,
        group_name: dup.name,
        rfc: dup.rfc,
        reason: 'merged_duplicate',
      })
    }
  }

  const empty_groups = groups.filter(
    g =>
      g.supplier_count === 0 &&
      g.invoice_count === 0 &&
      g.credit_note_count === 0,
  )

  for (const g of empty_groups) {
    if (mergedAwayIds.has(g.id)) continue
    if (canonicalKeptIds.has(g.id)) continue
    deactivations.push({
      group_id: g.id,
      group_name: g.name,
      rfc: g.rfc,
      reason: 'empty_unused',
    })
  }

  const rfc_updates =
    rfc_backfills.length +
    merge_clusters.filter(m => m.rfc_after_merge && !m.canonical.rfc).length

  for (const g of groups) {
    if (g.rfc_conflict) {
      globalWarnings.push(
        `«${g.name}» tiene facturas con emisores RFC distintos; el RFC no se completará automáticamente.`,
      )
    }
  }

  const totals = {
    groups_merged_away: mergedAwayIds.size,
    suppliers_relinked: suppliersRelinked,
    invoices_relinked: invoicesRelinked,
    credit_notes_relinked: creditNotesRelinked,
    rfc_updates,
    groups_deactivated: deactivations.length,
  }

  const has_actions =
    merge_clusters.length > 0 ||
    rfc_backfills.length > 0 ||
    deactivations.length > 0

  return {
    merge_clusters,
    rfc_backfills,
    deactivations,
    totals,
    warnings: globalWarnings,
    has_actions,
  }
}

export function buildMaintenancePreview(
  groups: EnrichedSupplierGroup[],
  suppliers: SupplierForPlan[] = [],
): MaintenancePreview {
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

  const plan = buildMaintenanceExecutionPlan(groups, suppliers)

  return {
    groups,
    duplicate_clusters,
    missing_rfc_with_suggestion,
    empty_groups,
    plan,
    stats: {
      total_active: groups.length,
      without_rfc: groups.filter(g => !g.rfc).length,
      duplicate_name_clusters: duplicate_clusters.length,
      duplicate_groups_to_merge: duplicateIds.size,
      empty_groups: empty_groups.length,
    },
  }
}

export async function loadSuppliersForGroupPlan(
  supabase: SupabaseClient,
  groupIds: string[],
): Promise<SupplierForPlan[]> {
  if (groupIds.length === 0) return []
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, group_id, plant_id, provider_number')
    .in('group_id', groupIds)
    .order('name')
  if (error) throw error
  return (data ?? []) as SupplierForPlan[]
}

export async function loadMaintenancePreview(
  supabase: SupabaseClient,
): Promise<MaintenancePreview> {
  const groups = await loadEnrichedSupplierGroups(supabase)
  const suppliers = await loadSuppliersForGroupPlan(
    supabase,
    groups.map(g => g.id),
  )
  return buildMaintenancePreview(groups, suppliers)
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

  const preview = await loadMaintenancePreview(supabase)
  const enriched = preview.groups

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
