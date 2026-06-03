import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ledgerAuditBridgeTotalsByMaterialIds } from '@/lib/inventory/ledgerAuditPeriodTotals';
import { buildTheoreticalBridgeFromFlow } from '@/lib/inventory/theoreticalBridge';
import { InventoryDashboardService } from './inventoryDashboardService';
import { resolveClosureVolumetricWeight, convertToKg } from '@/lib/inventory/closureVolumetricWeight';
import { computeClosureVarianceFields } from '@/lib/inventory/closureVariance';
import { computeInventoryAfter } from '@/lib/inventory/adjustmentModel';
import { insertAdjustmentFifoLayer } from '@/lib/inventory/insertAdjustmentFifoLayer';
import { consumeFifoForClosureAdjustment } from '@/lib/inventory/consumeFifoForClosureAdjustment';
import type {
  InventoryClosure,
  InventoryClosureDetail,
  InventoryClosureMaterial,
  InventoryClosureSummary,
  InitiateClosureInput,
  PhysicalCountInput,
  JustificationInput,
  SealClosureInput,
  TheoreticalReviewMaterialRow,
} from '@/types/inventoryClosure';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any;

export class InventoryClosureService {
  // Typed loosely because inventory_closures tables are not yet in database.types.ts
  // (they are in the migration but not regenerated yet). Once the migration is applied
  // and types are regenerated this can be tightened.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClientAny;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(supabase: SupabaseClientAny) {
    this.supabase = supabase;
  }

  static async create() {
    const supabase = await createServerSupabaseClient();
    return new InventoryClosureService(supabase);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Initiate
  // ─────────────────────────────────────────────────────────────────────────

  async initiateClosure(
    userId: string,
    input: InitiateClosureInput,
  ): Promise<InventoryClosure> {
    if (input.parent_closure_id) {
      // ── Amendment path ─────────────────────────────────────────────────────
      // Validate the parent exists, is sealed, belongs to the same plant, and matches period
      const { data: parent } = await this.supabase
        .from('inventory_closures')
        .select('id, status, plant_id, period_start, period_end')
        .eq('id', input.parent_closure_id)
        .single();

      if (!parent) throw new Error('El cierre original no existe');
      if (parent.status !== 'sealed') throw new Error('Solo se puede enmendar un cierre sellado');
      if (parent.plant_id !== input.plant_id) throw new Error('La enmienda debe ser para la misma planta que el cierre original');
      if (parent.period_start !== input.period_start || parent.period_end !== input.period_end) {
        throw new Error('La enmienda debe cubrir exactamente el mismo período que el cierre original');
      }
      // Guard: no open amendment already in progress for this parent
      const { data: openAmend } = await this.supabase
        .from('inventory_closures')
        .select('id, status')
        .eq('parent_closure_id', input.parent_closure_id)
        .not('status', 'in', '("sealed","cancelled")')
        .maybeSingle();

      if (openAmend) {
        throw new Error(`Ya existe una enmienda en progreso (${openAmend.status}) para este cierre. Cancélala antes de iniciar una nueva.`);
      }
    } else {
      // ── Original path — period overlap guard ───────────────────────────────
      // Detect any non-cancelled original that overlaps [period_start, period_end]
      const { data: overlapping } = await this.supabase
        .from('inventory_closures')
        .select('id, status, period_start, period_end')
        .eq('plant_id', input.plant_id)
        .not('status', 'eq', 'cancelled')
        .is('parent_closure_id', null)
        .lte('period_start', input.period_end)
        .gte('period_end', input.period_start)
        .maybeSingle();

      if (overlapping) {
        throw new Error(
          `Ya existe un cierre ${overlapping.status} que se traslapa con este período (${overlapping.period_start} – ${overlapping.period_end}). Cancela ese cierre antes de iniciar uno nuevo.`,
        );
      }
    }

    // Create closure header
    const { data: closure, error } = await this.supabase
      .from('inventory_closures')
      .insert({
        plant_id: input.plant_id,
        period_start: input.period_start,
        period_end: input.period_end,
        initiated_by: userId,
        variance_threshold_pct: input.variance_threshold_pct ?? 2,
        notes: input.notes ?? null,
        status: 'draft',
        parent_closure_id: input.parent_closure_id ?? null,
      })
      .select()
      .single();

    if (error || !closure) throw new Error(`Error al crear cierre: ${error?.message}`);

    // Snapshot theoretical inventory
    // For amendments this naturally includes the original closure's adjustments
    // because calculateHistoricalInventory reads live material_adjustments data.
    await this.snapshotTheoreticalInventory(closure.id, input.plant_id, input.period_start, input.period_end);

    return closure as InventoryClosure;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cancel
  // ─────────────────────────────────────────────────────────────────────────

  async cancelClosure(closureId: string, userId: string): Promise<void> {
    const { data: closure } = await this.supabase
      .from('inventory_closures')
      .select('id, status')
      .eq('id', closureId)
      .single();

    if (!closure) throw new Error('Cierre no encontrado');
    if (closure.status === 'sealed') throw new Error('No se puede cancelar un cierre sellado');
    if (closure.status === 'cancelled') throw new Error('El cierre ya está cancelado');

    const { error } = await this.supabase
      .from('inventory_closures')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', closureId);

    if (error) throw new Error(`Error al cancelar cierre: ${error.message}`);

    void userId; // logged via RLS / audit
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Hard delete (executive only — via API auth)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Permanently removes a closure and its snapshot/evidence rows (CASCADE).
   * Child amendments are deleted first. Material adjustments created at seal are NOT removed.
   */
  async deleteClosure(closureId: string, userId: string): Promise<void> {
    const { data: closure } = await this.supabase
      .from('inventory_closures')
      .select('id')
      .eq('id', closureId)
      .single();

    if (!closure) throw new Error('Cierre no encontrado');

    const { data: children } = await this.supabase
      .from('inventory_closures')
      .select('id')
      .eq('parent_closure_id', closureId);

    for (const child of children ?? []) {
      await this.deleteClosure(child.id, userId);
    }

    const { error } = await this.supabase.from('inventory_closures').delete().eq('id', closureId);

    if (error) throw new Error(`Error al eliminar cierre: ${error.message}`);

    void userId;
  }

  private async snapshotTheoreticalInventory(
    closureId: string,
    plantId: string,
    startDate: string,
    endDate: string,
    options?: {
      /** Reuse volumetric fields from a prior snapshot to avoid N quality lookups on confirm. */
      volumetricHintsByMaterialId?: Map<
        string,
        {
          volumetric_weight_kg_per_m3: number | null;
          volumetric_weight_source: string | null;
          quality_study_id: string | null;
        }
      >;
    },
  ): Promise<void> {
    const dashService = new InventoryDashboardService(this.supabase);
    const flows = await dashService.calculateHistoricalInventory(plantId, startDate, endDate);

    if (flows.length === 0) return;

    const materialIds = flows.map((f) => f.material_id);
    const ledgerMap = await ledgerAuditBridgeTotalsByMaterialIds(this.supabase, {
      plantId,
      periodStart: startDate,
      periodEnd: endDate,
      materialIds,
    });

    // Fetch material meta (name + bulk density) for volumetric weight resolution
    const { data: materials } = await this.supabase
      .from('materials')
      .select('id, material_name, bulk_density_kg_per_m3')
      .in('id', materialIds);

    const materialMap = new Map<string, { id: string; material_name: string; bulk_density_kg_per_m3: number | null }>(
      (materials as Array<{ id: string; material_name: string; bulk_density_kg_per_m3: number | null }> ?? [])
        .map((m) => [m.id, m]),
    );

    const closureThreshold = (
      await this.supabase
        .from('inventory_closures')
        .select('variance_threshold_pct')
        .eq('id', closureId)
        .single()
    ).data?.variance_threshold_pct ?? 2;

    const volumetricHints = options?.volumetricHintsByMaterialId;

    const rows = await Promise.all(
      flows.map(async (flow) => {
        const mat = materialMap.get(flow.material_id);
        const bridge = buildTheoreticalBridgeFromFlow(flow, ledgerMap.get(flow.material_id));

        const hinted = volumetricHints?.get(flow.material_id);
        let volW: number | null = hinted?.volumetric_weight_kg_per_m3 ?? null;
        let volSource: string | null = hinted?.volumetric_weight_source ?? null;
        let qualityStudyId: string | null = hinted?.quality_study_id ?? null;

        if (!hinted && mat?.material_name) {
          const resolved = await resolveClosureVolumetricWeight(this.supabase, {
            plantId,
            materialId: flow.material_id,
            materialName: mat.material_name,
            materialBulkDensityKgPerM3: mat?.bulk_density_kg_per_m3 ?? null,
          });
          if (resolved) {
            volW = resolved.volW;
            volSource = resolved.source;
            qualityStudyId = resolved.qualityStudyId ?? null;
          }
        }

        return {
          closure_id: closureId,
          material_id: flow.material_id,
          initial_stock_kg: bridge.initial_stock_kg,
          period_entries_kg: bridge.period_entries_kg,
          period_consumption_kg: bridge.period_consumption_kg,
          period_adjustments_kg: bridge.period_adjustments_kg,
          period_waste_kg: bridge.period_waste_kg,
          theoretical_final_kg: bridge.theoretical_final_kg,
          volumetric_weight_kg_per_m3: volW,
          volumetric_weight_source: volSource,
          quality_study_id: qualityStudyId,
          requires_justification: false,
        };
      }),
    );

    const { error } = await this.supabase.from('inventory_closure_materials').insert(rows);
    if (error) throw new Error(`Error al guardar snapshot teórico: ${error.message}`);

    // Status stays draft until the user confirms theoretical review in the UI.
  }

  /**
   * Rebuilds theoretical snapshot from live `calculateHistoricalInventory` (same engine as consumos Excel).
   * Only allowed while closure is in draft.
   */
  async refreshTheoreticalSnapshot(closureId: string): Promise<void> {
    const { data: closure } = await this.supabase
      .from('inventory_closures')
      .select('id, status, plant_id, period_start, period_end')
      .eq('id', closureId)
      .single();

    if (!closure) throw new Error('Cierre no encontrado');
    if (closure.status !== 'draft') {
      throw new Error('Solo se puede recalcular el teórico en borrador');
    }

    const { data: existingRows } = await this.supabase
      .from('inventory_closure_materials')
      .select(
        'material_id, volumetric_weight_kg_per_m3, volumetric_weight_source, quality_study_id',
      )
      .eq('closure_id', closureId);

    const volumetricHintsByMaterialId = new Map(
      (existingRows ?? []).map(
        (r: {
          material_id: string;
          volumetric_weight_kg_per_m3: number | null;
          volumetric_weight_source: string | null;
          quality_study_id: string | null;
        }) => [
          r.material_id,
          {
            volumetric_weight_kg_per_m3: r.volumetric_weight_kg_per_m3,
            volumetric_weight_source: r.volumetric_weight_source,
            quality_study_id: r.quality_study_id,
          },
        ],
      ),
    );

    const { error: delError } = await this.supabase
      .from('inventory_closure_materials')
      .delete()
      .eq('closure_id', closureId);

    if (delError) throw new Error(`Error al limpiar snapshot: ${delError.message}`);

    await this.snapshotTheoreticalInventory(
      closureId,
      closure.plant_id,
      closure.period_start,
      closure.period_end,
      { volumetricHintsByMaterialId },
    );
  }

  /**
   * Live theoretical rows for UI — matches consumos Excel bridge (Inv. inicial + Ajustes ± auditoría).
   * Read-only by default; pass `persistSnapshot` to rewrite draft snapshot (slow — use on confirm or explicit refresh).
   */
  async getTheoreticalReviewRows(
    closureId: string,
    options?: { persistSnapshot?: boolean },
  ): Promise<TheoreticalReviewMaterialRow[]> {
    const { data: closure, error: closureError } = await this.supabase
      .from('inventory_closures')
      .select('id, status, plant_id, period_start, period_end')
      .eq('id', closureId)
      .single();

    if (closureError || !closure) {
      throw new Error(`Cierre no encontrado: ${closureError?.message ?? ''}`.trim());
    }

    if (options?.persistSnapshot && closure.status === 'draft') {
      await this.refreshTheoreticalSnapshot(closureId);
    }

    const { data: snapshotRows, error: materialsError } = await this.supabase
      .from('inventory_closure_materials')
      .select(`
        *,
        material:materials(id, material_code, material_name, category, unit_of_measure, bulk_density_kg_per_m3)
      `)
      .eq('closure_id', closureId)
      .order('material_id');

    if (materialsError) {
      throw new Error(`Error al cargar materiales del cierre: ${materialsError.message}`);
    }

    const materials = (snapshotRows ?? []) as InventoryClosureMaterial[];

    const dashService = new InventoryDashboardService(this.supabase);
    const flows = await dashService.calculateHistoricalInventory(
      closure.plant_id,
      closure.period_start,
      closure.period_end,
    );
    const flowByMaterial = new Map(flows.map((f) => [f.material_id, f]));

    const materialIds =
      materials.length > 0
        ? materials.map((m) => m.material_id)
        : flows.map((f) => f.material_id);

    const ledgerMap = await ledgerAuditBridgeTotalsByMaterialIds(this.supabase, {
      plantId: closure.plant_id,
      periodStart: closure.period_start,
      periodEnd: closure.period_end,
      materialIds,
    });

    const baseRows: InventoryClosureMaterial[] =
      materials.length > 0
        ? materials
        : flows.map((flow) => ({
            id: '',
            closure_id: closureId,
            material_id: flow.material_id,
            initial_stock_kg: 0,
            period_entries_kg: 0,
            period_consumption_kg: 0,
            period_adjustments_kg: 0,
            period_waste_kg: 0,
            theoretical_final_kg: 0,
            requires_justification: false,
            created_at: '',
            updated_at: '',
            material: {
              id: flow.material_id,
              material_name: flow.material_name,
              category: flow.category,
              unit_of_measure: 'kg',
            },
          }));

    return baseRows.map((m) => {
      const flow = flowByMaterial.get(m.material_id);
      if (!flow) {
        return {
          ...m,
          period_adjustments_positive_kg: 0,
          period_adjustments_negative_kg: 0,
          adjustments_from_ledger_audit: false,
          system_current_stock_kg: 0,
          variance_vs_system_kg: 0,
        };
      }

      const bridge = buildTheoreticalBridgeFromFlow(flow, ledgerMap.get(m.material_id));

      return {
        ...m,
        initial_stock_kg: bridge.initial_stock_kg,
        period_entries_kg: bridge.period_entries_kg,
        period_consumption_kg: bridge.period_consumption_kg,
        period_waste_kg: bridge.period_waste_kg,
        theoretical_final_kg: bridge.theoretical_final_kg,
        period_adjustments_kg: bridge.period_adjustments_kg,
        period_adjustments_positive_kg: bridge.period_adjustments_positive_kg,
        period_adjustments_negative_kg: bridge.period_adjustments_negative_kg,
        adjustments_from_ledger_audit: bridge.adjustments_from_ledger_audit,
        system_current_stock_kg: bridge.system_current_stock_kg,
        variance_vs_system_kg: bridge.variance_vs_system_kg,
      };
    });
  }

  /**
   * Updates theoretical kg columns on existing snapshot rows (no delete/recreate).
   * Faster than full refresh — used when confirming after the user reviewed live numbers.
   */
  private async syncTheoreticalSnapshotNumbers(
    closureId: string,
    plantId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const dashService = new InventoryDashboardService(this.supabase);
    const flows = await dashService.calculateHistoricalInventory(plantId, startDate, endDate);
    if (flows.length === 0) return 0;

    const materialIds = flows.map((f) => f.material_id);
    const { data: existingRows } = await this.supabase
      .from('inventory_closure_materials')
      .select('id, material_id')
      .eq('closure_id', closureId)
      .in('material_id', materialIds);

    const existingByMaterial = new Map(
      (existingRows ?? []).map((r: { id: string; material_id: string }) => [r.material_id, r.id]),
    );

    const { data: materials } = await this.supabase
      .from('materials')
      .select('id, material_name, bulk_density_kg_per_m3')
      .in('id', materialIds);

    const materialMap = new Map(
      (materials as Array<{ id: string; material_name: string; bulk_density_kg_per_m3: number | null }> ?? []).map(
        (m) => [m.id, m],
      ),
    );

    const { data: volHints } = await this.supabase
      .from('inventory_closure_materials')
      .select(
        'material_id, volumetric_weight_kg_per_m3, volumetric_weight_source, quality_study_id',
      )
      .eq('closure_id', closureId);

    const volumetricHintsByMaterialId = new Map(
      (volHints ?? []).map(
        (r: {
          material_id: string;
          volumetric_weight_kg_per_m3: number | null;
          volumetric_weight_source: string | null;
          quality_study_id: string | null;
        }) => [r.material_id, r],
      ),
    );

    const ledgerMap = await ledgerAuditBridgeTotalsByMaterialIds(this.supabase, {
      plantId,
      periodStart: startDate,
      periodEnd: endDate,
      materialIds,
    });

    let written = 0;
    for (const flow of flows) {
      const bridge = buildTheoreticalBridgeFromFlow(flow, ledgerMap.get(flow.material_id));
      const payload = {
        initial_stock_kg: bridge.initial_stock_kg,
        period_entries_kg: bridge.period_entries_kg,
        period_consumption_kg: bridge.period_consumption_kg,
        period_adjustments_kg: bridge.period_adjustments_kg,
        period_waste_kg: bridge.period_waste_kg,
        theoretical_final_kg: bridge.theoretical_final_kg,
        updated_at: new Date().toISOString(),
      };

      const existingId = existingByMaterial.get(flow.material_id);
      if (existingId) {
        const { error } = await this.supabase
          .from('inventory_closure_materials')
          .update(payload)
          .eq('id', existingId);
        if (error) throw new Error(`Error al actualizar snapshot: ${error.message}`);
        written += 1;
        continue;
      }

      const mat = materialMap.get(flow.material_id);
      const hinted = volumetricHintsByMaterialId.get(flow.material_id);
      let volW: number | null = hinted?.volumetric_weight_kg_per_m3 ?? null;
      let volSource: string | null = hinted?.volumetric_weight_source ?? null;
      let qualityStudyId: string | null = hinted?.quality_study_id ?? null;

      if (!hinted && mat?.material_name) {
        const resolved = await resolveClosureVolumetricWeight(this.supabase, {
          plantId,
          materialId: flow.material_id,
          materialName: mat.material_name,
          materialBulkDensityKgPerM3: mat?.bulk_density_kg_per_m3 ?? null,
        });
        if (resolved) {
          volW = resolved.volW;
          volSource = resolved.source;
          qualityStudyId = resolved.qualityStudyId ?? null;
        }
      }

      const { error } = await this.supabase.from('inventory_closure_materials').insert({
        closure_id: closureId,
        material_id: flow.material_id,
        ...payload,
        volumetric_weight_kg_per_m3: volW,
        volumetric_weight_source: volSource,
        quality_study_id: qualityStudyId,
        requires_justification: false,
      });
      if (error) throw new Error(`Error al guardar snapshot teórico: ${error.message}`);
      written += 1;
    }

    return written;
  }

  /**
   * Re-reads live theoretical bridge into the closure snapshot and recomputes
   * variance / justification flags from existing physical counts (unchanged).
   */
  async resyncTheoreticalAndVariances(closureId: string): Promise<{
    theoretical_rows_updated: number;
    variance_rows_updated: number;
  }> {
    const { data: closure } = await this.supabase
      .from('inventory_closures')
      .select('id, status, plant_id, period_start, period_end, variance_threshold_pct')
      .eq('id', closureId)
      .single();

    if (!closure) throw new Error('Cierre no encontrado');
    if (closure.status === 'sealed' || closure.status === 'cancelled') {
      throw new Error('No se puede modificar un cierre sellado o cancelado');
    }

    const theoreticalRowsUpdated = await this.syncTheoreticalSnapshotNumbers(
      closureId,
      closure.plant_id,
      closure.period_start,
      closure.period_end,
    );

    const varianceRowsUpdated = await this.recalculateClosureVariances(
      closureId,
      Number(closure.variance_threshold_pct ?? 2),
    );

    return {
      theoretical_rows_updated: theoreticalRowsUpdated,
      variance_rows_updated: varianceRowsUpdated,
    };
  }

  private async recalculateClosureVariances(
    closureId: string,
    thresholdPct: number,
  ): Promise<number> {
    const { data: rows, error } = await this.supabase
      .from('inventory_closure_materials')
      .select('id, material_id, physical_count_kg, theoretical_final_kg')
      .eq('closure_id', closureId)
      .not('physical_count_kg', 'is', null);

    if (error) throw new Error(`Error al cargar conteos: ${error.message}`);
    if (!rows?.length) return 0;

    let updated = 0;
    const now = new Date().toISOString();

    for (const row of rows as Array<{
      id: string
      physical_count_kg: number
      theoretical_final_kg: number | null
    }>) {
      const physicalKg = Number(row.physical_count_kg);
      const theoretical = Number(row.theoretical_final_kg ?? 0);
      const varianceFields = computeClosureVarianceFields(
        physicalKg,
        theoretical,
        thresholdPct,
      );

      const { error: updateError } = await this.supabase
        .from('inventory_closure_materials')
        .update({
          ...varianceFields,
          updated_at: now,
        })
        .eq('id', row.id);

      if (updateError) {
        throw new Error(`Error al recalcular varianza: ${updateError.message}`);
      }
      updated += 1;
    }

    return updated;
  }

  async confirmTheoreticalReview(closureId: string): Promise<void> {
    const { data: closure } = await this.supabase
      .from('inventory_closures')
      .select('id, status, plant_id, period_start, period_end')
      .eq('id', closureId)
      .single();

    if (!closure) throw new Error('Cierre no encontrado');
    if (closure.status === 'sealed' || closure.status === 'cancelled') {
      throw new Error('No se puede modificar un cierre sellado o cancelado');
    }
    if (closure.status === 'physical_count') return;

    const written = await this.syncTheoreticalSnapshotNumbers(
      closureId,
      closure.plant_id,
      closure.period_start,
      closure.period_end,
    );

    const { count, error: countError } = await this.supabase
      .from('inventory_closure_materials')
      .select('material_id', { count: 'exact', head: true })
      .eq('closure_id', closureId);

    if (countError) throw new Error(`Error al verificar materiales: ${countError.message}`);
    if (!count && !written) {
      throw new Error(
        'No hay materiales en el inventario teórico para este período. Ajusta las fechas o verifica movimientos en la planta.',
      );
    }

    const { error } = await this.supabase
      .from('inventory_closures')
      .update({ status: 'physical_count', updated_at: new Date().toISOString() })
      .eq('id', closureId);

    if (error) throw new Error(`Error al confirmar revisión teórica: ${error.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Physical counts
  // ─────────────────────────────────────────────────────────────────────────

  async savePhysicalCounts(
    closureId: string,
    counts: PhysicalCountInput[],
    thresholdPct: number,
  ): Promise<InventoryClosureMaterial[]> {
    const upserts = counts.map((c) => {
      const physKg = convertToKg(
        c.physical_count_value,
        c.physical_count_unit,
        c.volumetric_weight_kg_per_m3,
      );

      // Will be null if m3 without vol weight — service validates below
      return { closureId, ...c, physKg };
    });

    // Fetch theoretical finals for variance calc
    const { data: existing } = await this.supabase
      .from('inventory_closure_materials')
      .select('material_id, theoretical_final_kg')
      .eq('closure_id', closureId)
      .in(
        'material_id',
        counts.map((c) => c.material_id),
      );

    const theoreticalMap = new Map<string, number>(
      (existing as Array<{ material_id: string; theoretical_final_kg: number | null }> ?? [])
        .map((r) => [r.material_id, Number(r.theoretical_final_kg)]),
    );

    const rows = upserts.map((u) => {
      const theoretical = theoreticalMap.get(u.material_id) ?? 0;
      const physKg = u.physKg;
      const varianceFields = computeClosureVarianceFields(physKg, theoretical, thresholdPct);

      return {
        closure_id: closureId,
        material_id: u.material_id,
        physical_count_value: u.physical_count_value,
        physical_count_unit: u.physical_count_unit,
        volumetric_weight_kg_per_m3: u.volumetric_weight_kg_per_m3 ?? null,
        volumetric_weight_source: u.volumetric_weight_source ?? null,
        quality_study_id: u.quality_study_id ?? null,
        physical_count_kg: physKg,
        variance_kg: varianceFields.variance_kg,
        variance_pct: varianceFields.variance_pct,
        requires_justification: varianceFields.requires_justification,
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await this.supabase
      .from('inventory_closure_materials')
      .upsert(rows, { onConflict: 'closure_id,material_id' })
      .select();

    if (error) throw new Error(`Error al guardar conteos: ${error.message}`);

    // Advance status if not already past physical_count
    const { data: closure } = await this.supabase
      .from('inventory_closures')
      .select('status')
      .eq('id', closureId)
      .single();

    if (closure?.status === 'physical_count') {
      await this.supabase
        .from('inventory_closures')
        .update({ status: 'reconciled', updated_at: new Date().toISOString() })
        .eq('id', closureId);
    } else if (closure?.status === 'justified') {
      const { data: pending } = await this.supabase
        .from('inventory_closure_materials')
        .select('material_id')
        .eq('closure_id', closureId)
        .eq('requires_justification', true)
        .is('justification_text', null);

      if (pending && pending.length > 0) {
        await this.supabase
          .from('inventory_closures')
          .update({ status: 'reconciled', updated_at: new Date().toISOString() })
          .eq('id', closureId)
          .eq('status', 'justified');
      }
    }

    return (data ?? []) as InventoryClosureMaterial[];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Justifications
  // ─────────────────────────────────────────────────────────────────────────

  async saveJustifications(
    closureId: string,
    justifications: JustificationInput[],
  ): Promise<void> {
    const rows = justifications.map((j) => ({
      closure_id: closureId,
      material_id: j.material_id,
      justification_text: j.justification_text,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.supabase
      .from('inventory_closure_materials')
      .upsert(rows, { onConflict: 'closure_id,material_id' });

    if (error) throw new Error(`Error al guardar justificaciones: ${error.message}`);

    // Check if all required justifications are filled
    const { data: pending } = await this.supabase
      .from('inventory_closure_materials')
      .select('material_id, requires_justification, justification_text')
      .eq('closure_id', closureId)
      .eq('requires_justification', true)
      .is('justification_text', null);

    if (!pending || pending.length === 0) {
      await this.supabase
        .from('inventory_closures')
        .update({ status: 'justified', updated_at: new Date().toISOString() })
        .eq('id', closureId)
        .in('status', ['reconciled', 'justified']);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Seal — creates real adjustments via existing FIFO path
  // ─────────────────────────────────────────────────────────────────────────

  async sealClosure(
    closureId: string,
    userId: string,
    input: SealClosureInput,
  ): Promise<InventoryClosure> {
    const { data: closure } = await this.supabase
      .from('inventory_closures')
      .select('*, plant_id, variance_threshold_pct, status')
      .eq('id', closureId)
      .single();

    if (!closure) throw new Error('Cierre no encontrado');
    if (closure.status === 'sealed') {
      return closure as InventoryClosure;
    }
    if (!['justified', 'reconciled'].includes(closure.status)) {
      throw new Error(`No se puede sellar un cierre con estatus "${closure.status}"`);
    }

    // Validate all required justifications are present
    const { data: missing } = await this.supabase
      .from('inventory_closure_materials')
      .select('material_id')
      .eq('closure_id', closureId)
      .eq('requires_justification', true)
      .is('justification_text', null);

    if (missing && missing.length > 0) {
      throw new Error(
        `Faltan justificaciones para ${missing.length} material(es) con varianza significativa.`,
      );
    }

    // Fetch all materials with non-zero variance
    const { data: materials } = await this.supabase
      .from('inventory_closure_materials')
      .select('*, material:materials(material_name)')
      .eq('closure_id', closureId);

    if (!materials) throw new Error('No se pudieron obtener los materiales del cierre');

    const adjustmentDate = closure.period_end;
    const dateStr = adjustmentDate.replace(/-/g, '');

    // Create adjustment for each material (idempotent — no double seal).
    // Adjustment qty = physical count − libro teórico al cierre del período (period_end).
    // Does NOT use live material_inventory (e.g. June consumptions after May 31 must not
    // distort the May close). DB trigger skips current_stock for reference_type inventory_closure.
    for (const mat of materials) {
      const physicalCountKg = mat.physical_count_kg == null ? null : Number(mat.physical_count_kg);
      if (physicalCountKg == null) continue; // no physical count → nothing to reconcile

      if (mat.adjustment_id) {
        const { data: linkedAdj } = await this.supabase
          .from('material_adjustments')
          .select('id')
          .eq('id', mat.adjustment_id)
          .maybeSingle();
        if (linkedAdj) continue;
      }

      const { data: existingClosureAdj } = await this.supabase
        .from('material_adjustments')
        .select('id')
        .eq('plant_id', closure.plant_id)
        .eq('material_id', mat.material_id)
        .eq('reference_type', 'inventory_closure')
        .ilike('reference_notes', `%${closureId}%`)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existingClosureAdj) {
        await this.supabase
          .from('inventory_closure_materials')
          .update({
            adjustment_id: existingClosureAdj.id,
            updated_at: new Date().toISOString(),
          })
          .eq('closure_id', closureId)
          .eq('material_id', mat.material_id);
        continue;
      }

      // Get next adjustment number for this plant
      const { data: lastAdj } = await this.supabase
        .from('material_adjustments')
        .select('adjustment_number')
        .eq('plant_id', closure.plant_id)
        .ilike('adjustment_number', `ADJ-${dateStr}-%`)
        .order('adjustment_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const seq = lastAdj
        ? parseInt(lastAdj.adjustment_number.split('-').pop() || '0', 10) + 1
        : 1;
      const adjustmentNumber = `ADJ-${dateStr}-${String(seq).padStart(3, '0')}`;

      const inventoryBefore = Number(mat.theoretical_final_kg ?? 0);
      const stockDeltaKg = physicalCountKg - inventoryBefore;
      if (Math.abs(stockDeltaKg) < 0.001) continue; // teórico ya coincide con conteo físico del período
      // physical > live → under-counted → add stock (physical_count); else remove (correction)
      const adjustmentType = stockDeltaKg > 0 ? 'physical_count' : 'correction';
      const quantityAdjusted = Math.abs(stockDeltaKg); // always positive; direction from type

      const inventoryAfter = computeInventoryAfter(
        inventoryBefore,
        quantityAdjusted,
        adjustmentType,
      );

      const { data: adj, error: adjError } = await this.supabase
        .from('material_adjustments')
        .insert({
          adjustment_number: adjustmentNumber,
          plant_id: closure.plant_id,
          material_id: mat.material_id,
          adjustment_date: adjustmentDate,
          adjustment_time: new Date().toTimeString().split(' ')[0],
          adjustment_type: adjustmentType,
          quantity_adjusted: quantityAdjusted,
          inventory_before: inventoryBefore,
          inventory_after: inventoryAfter,
          reference_type: 'inventory_closure',
          reference_notes: `Cierre de inventario ${closureId} — período ${closure.period_start}/${closure.period_end}`,
          adjusted_by: userId,
        })
        .select()
        .single();

      if (adjError || !adj) {
        throw new Error(
          `Error al crear ajuste para ${mat.material?.material_name ?? mat.material_id}: ${adjError?.message}`,
        );
      }

      // Run FIFO logic (positive → ADJP layer, negative → consume FIFO)
      if (stockDeltaKg > 0) {
        const fifoResult = await insertAdjustmentFifoLayer(this.supabase, {
          adjustmentId: adj.id,
          adjustmentNumber,
          adjustmentType,
          referenceType: 'inventory_closure',
          referenceNotes: adj.reference_notes,
          plantId: closure.plant_id,
          materialId: mat.material_id,
          adjustmentDate,
          inventoryBefore,
          inventoryAfter,
          quantityAdjusted,
          enteredBy: userId,
        });
        if (!fifoResult.ok) {
          // Roll back the adjustment
          await this.supabase.from('material_adjustments').delete().eq('id', adj.id);
          throw new Error(`Error FIFO para ${mat.material_id}: ${fifoResult.error}`);
        }
      } else {
        const consResult = await consumeFifoForClosureAdjustment(this.supabase, {
          adjustmentId: adj.id,
          adjustmentNumber,
          plantId: closure.plant_id,
          materialId: mat.material_id,
          quantityKg: quantityAdjusted,
          consumptionDate: adjustmentDate,
          userId,
          inventoryBefore,
          inventoryAfter,
        });
        if (!consResult.ok) {
          await this.supabase.from('material_adjustments').delete().eq('id', adj.id);
          throw new Error(
            `Error FIFO consumo para ${mat.material?.material_name ?? mat.material_id}: ${consResult.error}`,
          );
        }
      }

      // Link adjustment back to closure material
      await this.supabase
        .from('inventory_closure_materials')
        .update({ adjustment_id: adj.id, updated_at: new Date().toISOString() })
        .eq('closure_id', closureId)
        .eq('material_id', mat.material_id);
    }

    // Seal the closure
    const { data: sealed, error: sealError } = await this.supabase
      .from('inventory_closures')
      .update({
        status: 'sealed',
        signed_by: input.signed_by,
        signed_at: new Date().toISOString(),
        signature_image_url: input.signature_image_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', closureId)
      .select()
      .single();

    if (sealError || !sealed) throw new Error(`Error al sellar cierre: ${sealError?.message}`);
    return sealed as InventoryClosure;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Read helpers
  // ─────────────────────────────────────────────────────────────────────────

  async listClosures(filters: {
    plantId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<InventoryClosureSummary[]> {
    let query = this.supabase
      .from('inventory_closures')
      .select(`
        id, plant_id, period_start, period_end, status, initiated_at, signed_at, parent_closure_id,
        plant:plants(name),
        initiated_by_user:user_profiles!initiated_by(first_name, last_name)
      `)
      .order('initiated_at', { ascending: false });

    if (filters.plantId) query = query.eq('plant_id', filters.plantId);
    if (filters.status) query = query.eq('status', filters.status);

    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw new Error(`Error al listar cierres: ${error.message}`);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      plant_id: row.plant_id,
      plant_name: row.plant?.name ?? '',
      period_start: row.period_start,
      period_end: row.period_end,
      status: row.status,
      initiated_at: row.initiated_at,
      initiated_by_name: row.initiated_by_user
        ? `${row.initiated_by_user.first_name} ${row.initiated_by_user.last_name}`.trim()
        : '',
      sealed_at: row.signed_at ?? null,
      material_count: 0,
      materials_requiring_justification: 0,
      parent_closure_id: row.parent_closure_id ?? null,
    }));
  }

  async getClosureDetail(closureId: string): Promise<InventoryClosureDetail> {
    const { data: closure, error } = await this.supabase
      .from('inventory_closures')
      .select(`
        *,
        plant:plants(id, name, code),
        initiated_by_user:user_profiles!initiated_by(id, first_name, last_name),
        signed_by_user:user_profiles!signed_by(id, first_name, last_name)
      `)
      .eq('id', closureId)
      .single();

    if (error || !closure) throw new Error(`Cierre no encontrado: ${error?.message}`);

    // Resolve signature path → signed URL so it's never permanently stored as an expiring URL
    if (closure.signature_image_url && !closure.signature_image_url.startsWith('http')) {
      const { data: sigSigned } = await this.supabase.storage
        .from('inventory-closure-evidence')
        .createSignedUrl(closure.signature_image_url, 3600);
      if (sigSigned?.signedUrl) {
        closure.signature_image_url = sigSigned.signedUrl;
      }
    }

    const { data: materials } = await this.supabase
      .from('inventory_closure_materials')
      .select(`
        *,
        material:materials(id, material_code, material_name, category, unit_of_measure, bulk_density_kg_per_m3)
      `)
      .eq('closure_id', closureId)
      .order('material_id');

    const { data: evidence } = await this.supabase
      .from('inventory_closure_evidence')
      .select('*')
      .eq('closure_id', closureId)
      .order('uploaded_at', { ascending: false });

    // Resolve signed URLs for evidence
    const evidenceWithUrls = await Promise.all(
      (evidence ?? []).map(async (e: any) => {
        const { data } = await this.supabase.storage
          .from('inventory-closure-evidence')
          .createSignedUrl(e.file_path, 3600);
        return { ...e, signed_url: data?.signedUrl ?? null };
      }),
    );

    // Group evidence by material
    const evidenceByMaterial = new Map<string, typeof evidenceWithUrls>();
    const closureWideEvidence: typeof evidenceWithUrls = [];
    for (const e of evidenceWithUrls) {
      if (!e.material_id) {
        closureWideEvidence.push(e);
      } else {
        const arr = evidenceByMaterial.get(e.material_id) ?? [];
        arr.push(e);
        evidenceByMaterial.set(e.material_id, arr);
      }
    }

    return {
      ...closure,
      materials: (materials ?? []).map((m: any) => ({
        ...m,
        evidence: evidenceByMaterial.get(m.material_id) ?? [],
      })),
      evidence: closureWideEvidence,
    } as InventoryClosureDetail;
  }

  async updateExcelPath(closureId: string, path: string): Promise<void> {
    await this.supabase
      .from('inventory_closures')
      .update({ excel_export_path: path, updated_at: new Date().toISOString() })
      .eq('id', closureId);
  }
}
