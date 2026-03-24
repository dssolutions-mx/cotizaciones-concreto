import { createServerSupabaseClient } from '@/lib/supabase/server';
import { MaterialLot, MaterialLotDetail, LotCostBreakdown, LotFilters, LotMetadataUpdate } from '@/types/lots';

export class MaterialLotService {

  async getLotsByPlant(plantId: string, filters: LotFilters = {}): Promise<{
    data: MaterialLot[];
    total: number;
  }> {
    const supabase = await createServerSupabaseClient();
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    let query = supabase
      .from('material_lots')
      .select(`
        *,
        material:materials!material_id(id, material_name, category, unit_of_measure),
        supplier:suppliers!supplier_id(id, name),
        entry:material_entries!entry_id(id, entry_number, entry_date, entry_time)
      `, { count: 'exact' })
      .eq('plant_id', plantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.material_id) {
      query = query.eq('material_id', filters.material_id);
    }
    if (filters.supplier_id) {
      query = query.eq('supplier_id', filters.supplier_id);
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to + 'T23:59:59');
    }
    if (filters.has_remaining === true) {
      query = query.gt('remaining_quantity_kg', 0);
    }
    if (filters.quality_status) {
      query = query.eq('quality_status', filters.quality_status);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch lots: ${error.message}`);
    return { data: (data || []) as MaterialLot[], total: count || 0 };
  }

  async getLotDetail(lotId: string): Promise<MaterialLotDetail | null> {
    const supabase = await createServerSupabaseClient();

    const { data: lot, error } = await supabase
      .from('material_lots')
      .select(`
        *,
        material:materials!material_id(id, material_name, category, unit_of_measure),
        supplier:suppliers!supplier_id(id, name),
        entry:material_entries!entry_id(id, entry_number, entry_date, entry_time)
      `)
      .eq('id', lotId)
      .single();

    if (error || !lot) return null;

    // Get allocations consumed from this lot
    const { data: allocations } = await supabase
      .from('material_consumption_allocations')
      .select(`
        id, remision_id, quantity_consumed_kg, unit_price, total_cost, consumption_date,
        remision:remisiones!remision_id(remision_number, fecha)
      `)
      .eq('lot_id', lotId)
      .order('consumption_date', { ascending: true });

    const allocationSummaries = (allocations || []).map((a: Record<string, unknown>) => {
      const remision = a.remision as { remision_number?: string; fecha?: string } | null;
      return {
        id: a.id as string,
        remision_id: a.remision_id as string,
        remision_number: remision?.remision_number,
        remision_date: remision?.fecha,
        quantity_consumed_kg: a.quantity_consumed_kg as number,
        unit_price: a.unit_price as number,
        total_cost: a.total_cost as number,
        consumption_date: a.consumption_date as string,
      };
    });

    const totalConsumed = allocationSummaries.reduce((sum, a) => sum + a.quantity_consumed_kg, 0);
    const totalCostConsumed = allocationSummaries.reduce((sum, a) => sum + a.total_cost, 0);

    return {
      ...(lot as MaterialLot),
      allocations: allocationSummaries,
      total_consumed_kg: totalConsumed,
      total_cost_consumed: totalCostConsumed,
    };
  }

  async getLotCostBreakdown(lotId: string): Promise<LotCostBreakdown | null> {
    const supabase = await createServerSupabaseClient();

    const { data: lot, error } = await supabase
      .from('material_lots')
      .select('id, lot_number, material_unit_price, fleet_cost, fleet_unit_cost, landed_unit_price, received_qty_kg, remaining_quantity_kg')
      .eq('id', lotId)
      .single();

    if (error || !lot) return null;

    const receivedKg = Number(lot.received_qty_kg) || 0;
    const remainingKg = Number(lot.remaining_quantity_kg) || 0;
    const consumedKg = receivedKg - remainingKg;
    const landedPrice = Number(lot.landed_unit_price) || 0;

    return {
      lot_id: lot.id,
      lot_number: lot.lot_number,
      material_unit_price: Number(lot.material_unit_price) || 0,
      fleet_cost: Number(lot.fleet_cost) || 0,
      fleet_unit_cost: Number(lot.fleet_unit_cost) || 0,
      landed_unit_price: landedPrice,
      received_qty_kg: receivedKg,
      remaining_quantity_kg: remainingKg,
      total_material_value: (Number(lot.material_unit_price) || 0) * receivedKg,
      total_fleet_value: Number(lot.fleet_cost) || 0,
      total_landed_value: landedPrice * receivedKg,
      consumed_qty_kg: consumedKg,
      consumed_value: consumedKg * landedPrice,
    };
  }

  async updateLotMetadata(lotId: string, data: LotMetadataUpdate): Promise<MaterialLot> {
    const supabase = await createServerSupabaseClient();

    const { data: lot, error } = await supabase
      .from('material_lots')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lotId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update lot: ${error.message}`);
    return lot as MaterialLot;
  }

  async getLotByEntryId(entryId: string): Promise<MaterialLot | null> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('material_lots')
      .select('*')
      .eq('entry_id', entryId)
      .single();

    if (error) return null;
    return data as MaterialLot;
  }
}
