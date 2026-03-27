import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  MaterialAlert,
  MaterialAlertEvent,
  AlertStatus,
  AlertFilters,
  ConfirmAlertInput,
  ValidateAlertInput,
  ScheduleDeliveryInput,
  ResolveAlertInput,
  ReorderConfig,
  ReorderConfigInput,
  ManualMaterialRequestInput,
} from '@/types/alerts';

export class MaterialAlertService {

  async getAlerts(filters: AlertFilters = {}): Promise<MaterialAlert[]> {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('material_alerts')
      .select(`
        *,
        material:materials!material_id(id, material_name, category, unit_of_measure),
        plant:plants!plant_id(id, name, code)
      `)
      .order('created_at', { ascending: false });

    if (filters.plant_id) {
      query = query.eq('plant_id', filters.plant_id);
    }
    if (filters.material_id) {
      query = query.eq('material_id', filters.material_id);
    }
    if (filters.existing_po_id) {
      query = query.eq('existing_po_id', filters.existing_po_id);
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }
    if (filters.date_from) {
      query = query.gte('triggered_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('triggered_at', filters.date_to + 'T23:59:59');
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch alerts: ${error.message}`);
    return (data || []) as MaterialAlert[];
  }

  async getActiveAlerts(plantId: string): Promise<MaterialAlert[]> {
    return this.getAlerts({
      plant_id: plantId,
      status: [
        'pending_confirmation', 'confirmed', 'pending_validation',
        'validated', 'pending_po', 'po_linked', 'delivery_scheduled',
      ],
    });
  }

  /**
   * Dosificador proactively requests material: creates alert at pending_validation
   * (skips pending_confirmation). physical_count_kg = current system stock snapshot.
   */
  async createManualRequestAlert(
    input: ManualMaterialRequestInput,
    userId: string
  ): Promise<MaterialAlert> {
    const supabase = await createServerSupabaseClient();

    const activeStatuses: AlertStatus[] = [
      'pending_confirmation',
      'confirmed',
      'pending_validation',
      'validated',
      'pending_po',
      'po_linked',
      'delivery_scheduled',
      'delivered',
    ];

    const { data: existing } = await supabase
      .from('material_alerts')
      .select('id')
      .eq('plant_id', input.plant_id)
      .eq('material_id', input.material_id)
      .in('status', activeStatuses)
      .maybeSingle();

    if (existing?.id) {
      throw new Error('Ya existe una alerta activa para este material en esta planta');
    }

    const { data: plant } = await supabase
      .from('plants')
      .select('code')
      .eq('id', input.plant_id)
      .single();

    const plantCode = (plant?.code || 'PLT').replace(/\s+/g, '').slice(0, 8);
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;

    const startOfDay = `${y}-${m}-${d}T00:00:00.000Z`;
    const { count } = await supabase
      .from('material_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('plant_id', input.plant_id)
      .gte('created_at', startOfDay);

    const seq = (count ?? 0) + 1;
    const alertNumber = `ALRT-${plantCode}-${dateStr}-${String(seq).padStart(3, '0')}`;

    const { data: inv } = await supabase
      .from('material_inventory')
      .select('current_stock')
      .eq('plant_id', input.plant_id)
      .eq('material_id', input.material_id)
      .maybeSingle();

    const currentStock = Number(inv?.current_stock ?? 0);

    const { data: cfg } = await supabase
      .from('material_reorder_config')
      .select('id, reorder_point_kg')
      .eq('plant_id', input.plant_id)
      .eq('material_id', input.material_id)
      .eq('is_active', true)
      .maybeSingle();

    const reorderPointKg = cfg?.reorder_point_kg != null ? Number(cfg.reorder_point_kg) : 0;

    const parts: string[] = ['Solicitud manual por dosificador.'];
    if (input.estimated_need_kg != null && input.estimated_need_kg > 0) {
      parts.push(`Necesidad estimada: ${input.estimated_need_kg} kg.`);
    }
    if (input.notes?.trim()) {
      parts.push(input.notes.trim());
    }
    const validationNotes = parts.join(' ');

    const { data: inserted, error: insertErr } = await supabase
      .from('material_alerts')
      .insert({
        alert_number: alertNumber,
        plant_id: input.plant_id,
        material_id: input.material_id,
        reorder_config_id: cfg?.id ?? null,
        triggered_at: new Date().toISOString(),
        triggered_stock_kg: currentStock,
        reorder_point_kg: reorderPointKg,
        status: 'pending_validation',
        confirmation_deadline: null,
        physical_count_kg: currentStock,
        validation_notes: validationNotes || null,
      })
      .select(
        `
        *,
        material:materials!material_id(id, material_name, category, unit_of_measure),
        plant:plants!plant_id(id, name, code)
      `
      )
      .single();

    if (insertErr) {
      throw new Error(insertErr.message || 'No se pudo crear la solicitud');
    }

    await supabase.from('material_alert_events').insert({
      alert_id: inserted.id,
      event_type: 'manual_request_by_dosificador',
      to_status: 'pending_validation',
      performed_by: userId,
      details: {
        estimated_need_kg: input.estimated_need_kg ?? null,
        notes: input.notes ?? null,
        snapshot_stock_kg: currentStock,
      },
    });

    return inserted as MaterialAlert;
  }

  async getAlertById(alertId: string): Promise<MaterialAlert | null> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('material_alerts')
      .select(`
        *,
        material:materials!material_id(id, material_name, category, unit_of_measure),
        plant:plants!plant_id(id, name, code)
      `)
      .eq('id', alertId)
      .single();

    if (error) return null;
    return data as MaterialAlert;
  }

  async getAlertEvents(alertId: string): Promise<MaterialAlertEvent[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('material_alert_events')
      .select('*')
      .eq('alert_id', alertId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch alert events: ${error.message}`);
    return (data || []) as MaterialAlertEvent[];
  }

  private async transitionAlert(
    alertId: string,
    fromStatuses: AlertStatus[],
    toStatus: AlertStatus,
    userId: string,
    updateData: Partial<Record<string, unknown>>,
    eventDetails?: Record<string, unknown>
  ): Promise<MaterialAlert> {
    const supabase = await createServerSupabaseClient();

    // Fetch current alert
    const { data: current, error: fetchErr } = await supabase
      .from('material_alerts')
      .select('id, status')
      .eq('id', alertId)
      .single();

    if (fetchErr || !current) throw new Error('Alert not found');
    if (!fromStatuses.includes(current.status as AlertStatus)) {
      throw new Error(`Cannot transition from ${current.status} to ${toStatus}`);
    }

    // Update alert
    const { data: updated, error: updateErr } = await supabase
      .from('material_alerts')
      .update({
        ...updateData,
        status: toStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .select()
      .single();

    if (updateErr) throw new Error(`Failed to update alert: ${updateErr.message}`);

    // Log event
    await supabase.from('material_alert_events').insert({
      alert_id: alertId,
      event_type: `status_change_to_${toStatus}`,
      from_status: current.status,
      to_status: toStatus,
      performed_by: userId,
      details: eventDetails || null,
    });

    return updated as MaterialAlert;
  }

  /**
   * Step 2-3: Dosificador confirms alert with physical count
   */
  async confirmAlert(
    alertId: string,
    input: ConfirmAlertInput,
    userId: string
  ): Promise<MaterialAlert> {
    const supabase = await createServerSupabaseClient();

    // Get alert to calculate discrepancy
    const { data: alert } = await supabase
      .from('material_alerts')
      .select('triggered_stock_kg')
      .eq('id', alertId)
      .single();

    const discrepancy = alert
      ? input.physical_count_kg - Number(alert.triggered_stock_kg)
      : null;

    return this.transitionAlert(
      alertId,
      ['pending_confirmation'],
      'pending_validation',
      userId,
      {
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
        physical_count_kg: input.physical_count_kg,
        discrepancy_kg: discrepancy,
        discrepancy_notes: input.discrepancy_notes || null,
      },
      {
        physical_count_kg: input.physical_count_kg,
        discrepancy_kg: discrepancy,
      }
    );
  }

  /**
   * Step 4: Jefe de Planta validates need, checks PO
   */
  async validateAlert(
    alertId: string,
    input: ValidateAlertInput,
    userId: string
  ): Promise<MaterialAlert> {
    const supabase = await createServerSupabaseClient();

    const { data: alertRow, error: alertErr } = await supabase
      .from('material_alerts')
      .select('id, material_id, plant_id')
      .eq('id', alertId)
      .single();

    if (alertErr || !alertRow?.material_id) {
      throw new Error('Alerta no encontrada o sin material');
    }

    if (input.existing_po_id) {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('id, plant_id, status')
        .eq('id', input.existing_po_id)
        .single();

      if (!po) throw new Error('La orden de compra no existe');
      if (po.plant_id !== alertRow.plant_id) {
        throw new Error('La OC no pertenece a la planta de esta alerta');
      }
      const hdr = String(po.status || '').toLowerCase();
      if (hdr !== 'open' && hdr !== 'partial') {
        throw new Error('Solo se pueden vincular órdenes abiertas o parciales');
      }

      const { data: lines } = await supabase
        .from('purchase_order_items')
        .select('qty_ordered, qty_received, status, is_service, material_id')
        .eq('po_id', input.existing_po_id)
        .eq('material_id', alertRow.material_id)
        .eq('is_service', false)
        .in('status', ['open', 'partial']);

      const hasOpenBalance = (lines || []).some((row) => {
        const ordered = Number(row.qty_ordered) || 0;
        const received = Number(row.qty_received) || 0;
        return ordered - received > 1e-9;
      });

      if (!hasOpenBalance) {
        throw new Error(
          'Esta OC no tiene partida abierta con saldo pendiente para el material de esta alerta'
        );
      }
    }

    const nextStatus: AlertStatus = input.existing_po_id ? 'po_linked' :
      input.needs_new_po ? 'pending_po' : 'validated';

    return this.transitionAlert(
      alertId,
      ['pending_validation', 'confirmed'],
      nextStatus,
      userId,
      {
        validated_by: userId,
        validated_at: new Date().toISOString(),
        existing_po_id: input.existing_po_id || null,
        validation_notes: input.validation_notes || null,
      },
      {
        existing_po_id: input.existing_po_id,
        needs_new_po: input.needs_new_po,
      }
    );
  }

  /**
   * Link a PO to an alert that needed a new one
   */
  async linkPO(alertId: string, poId: string, userId: string): Promise<MaterialAlert> {
    const supabase = await createServerSupabaseClient();

    const { data: alertRow, error: alertErr } = await supabase
      .from('material_alerts')
      .select('id, material_id, plant_id')
      .eq('id', alertId)
      .single();

    if (alertErr || !alertRow?.material_id) {
      throw new Error('Alerta no encontrada o sin material');
    }

    const { data: po } = await supabase
      .from('purchase_orders')
      .select('id, plant_id, status')
      .eq('id', poId)
      .single();

    if (!po) throw new Error('La orden de compra no existe');
    if (po.plant_id !== alertRow.plant_id) {
      throw new Error('La OC no pertenece a la planta de esta alerta');
    }
    const hdr = String(po.status || '').toLowerCase();
    if (hdr !== 'open' && hdr !== 'partial') {
      throw new Error('Solo se pueden vincular órdenes abiertas o parciales');
    }

    const { data: lines } = await supabase
      .from('purchase_order_items')
      .select('qty_ordered, qty_received, status, is_service, material_id')
      .eq('po_id', poId)
      .eq('material_id', alertRow.material_id)
      .eq('is_service', false)
      .in('status', ['open', 'partial']);

    const hasOpenBalance = (lines || []).some((row) => {
      const ordered = Number(row.qty_ordered) || 0;
      const received = Number(row.qty_received) || 0;
      return ordered - received > 1e-9;
    });

    if (!hasOpenBalance) {
      throw new Error(
        'Esta OC no tiene partida abierta con saldo pendiente para el material de esta alerta'
      );
    }

    return this.transitionAlert(
      alertId,
      ['pending_po', 'validated'],
      'po_linked',
      userId,
      { existing_po_id: poId },
      { po_id: poId }
    );
  }

  /**
   * Step 6: Admin schedules delivery date
   */
  async scheduleDelivery(
    alertId: string,
    input: ScheduleDeliveryInput,
    userId: string
  ): Promise<MaterialAlert> {
    return this.transitionAlert(
      alertId,
      ['po_linked', 'validated'],
      'delivery_scheduled',
      userId,
      {
        scheduled_delivery_date: input.scheduled_delivery_date,
        scheduled_by: userId,
        scheduled_at: new Date().toISOString(),
      },
      { scheduled_delivery_date: input.scheduled_delivery_date }
    );
  }

  /**
   * Step 8: Resolve alert when material entry is created
   */
  async resolveAlert(
    alertId: string,
    input: ResolveAlertInput,
    userId: string
  ): Promise<MaterialAlert> {
    return this.transitionAlert(
      alertId,
      ['delivery_scheduled', 'po_linked', 'validated', 'pending_po'],
      'closed',
      userId,
      {
        resolved_entry_id: input.entry_id,
        resolved_lot_id: input.lot_id || null,
        resolved_at: new Date().toISOString(),
      },
      { entry_id: input.entry_id, lot_id: input.lot_id }
    );
  }

  /**
   * Cancel an alert (false alarm)
   */
  async cancelAlert(alertId: string, reason: string, userId: string): Promise<MaterialAlert> {
    return this.transitionAlert(
      alertId,
      ['pending_confirmation', 'confirmed', 'pending_validation', 'validated', 'pending_po', 'po_linked', 'delivery_scheduled'],
      'cancelled',
      userId,
      {},
      { reason }
    );
  }

  /**
   * Check for expired alerts (called by cron edge function)
   */
  async checkExpiredAlerts(): Promise<number> {
    const supabase = await createServerSupabaseClient();

    const { data: expired, error } = await supabase
      .from('material_alerts')
      .select('id')
      .eq('status', 'pending_confirmation')
      .lt('confirmation_deadline', new Date().toISOString());

    if (error || !expired?.length) return 0;

    for (const alert of expired) {
      await supabase
        .from('material_alerts')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', alert.id);

      await supabase.from('material_alert_events').insert({
        alert_id: alert.id,
        event_type: 'auto_expired',
        from_status: 'pending_confirmation',
        to_status: 'expired',
        details: { reason: 'Confirmation deadline exceeded (4h)' },
      });
    }

    return expired.length;
  }

  /**
   * Auto-resolve alert when material entry matches
   */
  async autoResolveForEntry(
    plantId: string,
    materialId: string,
    entryId: string,
    lotId: string | null,
    userId: string
  ): Promise<MaterialAlert | null> {
    const supabase = await createServerSupabaseClient();

    const { data: activeAlert } = await supabase
      .from('material_alerts')
      .select('id, status')
      .eq('plant_id', plantId)
      .eq('material_id', materialId)
      .not('status', 'in', '("closed","cancelled")')
      .limit(1)
      .single();

    if (!activeAlert) return null;

    // Only auto-resolve if in delivery_scheduled or later
    const resolvableStatuses: AlertStatus[] = ['delivery_scheduled', 'po_linked', 'validated'];
    if (!resolvableStatuses.includes(activeAlert.status as AlertStatus)) return null;

    return this.resolveAlert(activeAlert.id, { entry_id: entryId, lot_id: lotId || undefined }, userId);
  }

  // ==========================================
  // Reorder Config
  // ==========================================

  async getReorderConfig(plantId: string): Promise<ReorderConfig[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('material_reorder_config')
      .select(`
        *,
        material:materials!material_id(id, material_name, category)
      `)
      .eq('plant_id', plantId)
      .eq('is_active', true)
      .order('configured_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch reorder config: ${error.message}`);
    return (data || []) as ReorderConfig[];
  }

  async setReorderConfig(input: ReorderConfigInput, userId: string): Promise<ReorderConfig> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('material_reorder_config')
      .upsert({
        plant_id: input.plant_id,
        material_id: input.material_id,
        reorder_point_kg: input.reorder_point_kg,
        reorder_qty_kg: input.reorder_qty_kg || null,
        configured_by: userId,
        configured_at: new Date().toISOString(),
        is_active: true,
        notes: input.notes || null,
      }, { onConflict: 'plant_id,material_id' })
      .select(`
        *,
        material:materials!material_id(id, material_name, category)
      `)
      .single();

    if (error) throw new Error(`Failed to set reorder config: ${error.message}`);
    return data as ReorderConfig;
  }
}
