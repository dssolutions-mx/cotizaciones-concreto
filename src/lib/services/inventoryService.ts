import { supabase } from '@/lib/supabase/client';
import type { 
  MaterialEntry, 
  MaterialAdjustment, 
  MaterialInventory, 
  DailyInventoryLog, 
  MaterialEntryInput, 
  MaterialAdjustmentInput,
  InventoryActivity,
  CurrentStockStatus,
  ArkikProcessingResult
} from '@/types/inventory';

export class InventoryService {
  // Use the singleton Supabase client instance
  private supabase = supabase;

  // Get authenticated user and plant access
  private async getAuthenticatedUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error || !user) {
      throw new Error('Usuario no autenticado');
    }

    const { data: profile, error: profileError } = await this.supabase
      .from('user_profiles')
      .select('id, role, plant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Perfil de usuario no encontrado');
    }

    // Check if user has inventory permissions
    const allowedRoles = ['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR'];
    if (!allowedRoles.includes(profile.role)) {
      throw new Error('Sin permisos para gestionar inventario');
    }

    return { user, profile };
  }

  // Generate unique entry/adjustment numbers
  private async generateEntryNumber(plantId: string, date: string): Promise<string> {
    const dateStr = date.replace(/-/g, '');
    const { data, error } = await this.supabase
      .from('material_entries')
      .select('entry_number')
      .eq('plant_id', plantId)
      .ilike('entry_number', `ENT-${dateStr}-%`)
      .order('entry_number', { ascending: false })
      .limit(1);

    if (error) throw error;

    const lastNumber = data[0]?.entry_number;
    const sequence = lastNumber ? parseInt(lastNumber.split('-').pop() || '0') + 1 : 1;
    return `ENT-${dateStr}-${sequence.toString().padStart(3, '0')}`;
  }

  private async generateAdjustmentNumber(plantId: string, date: string): Promise<string> {
    const dateStr = date.replace(/-/g, '');
    const { data, error } = await this.supabase
      .from('material_adjustments')
      .select('adjustment_number')
      .eq('plant_id', plantId)
      .ilike('adjustment_number', `ADJ-${dateStr}-%`)
      .order('adjustment_number', { ascending: false })
      .limit(1);

    if (error) throw error;

    const lastNumber = data[0]?.adjustment_number;
    const sequence = lastNumber ? parseInt(lastNumber.split('-').pop() || '0') + 1 : 1;
    return `ADJ-${dateStr}-${sequence.toString().padStart(3, '0')}`;
  }

  // Get current inventory for user's plant
  async getCurrentInventory(materialId?: string, lowStockOnly?: boolean): Promise<MaterialInventory[]> {
    const { profile } = await this.getAuthenticatedUser();

    let query = this.supabase
      .from('material_inventory')
      .select(`
        *,
        material:materials(id, material_name, category, unit_of_measure, is_active)
      `)
      .eq('plant_id', profile.plant_id);

    if (materialId) {
      query = query.eq('material_id', materialId);
    }

    if (lowStockOnly) {
      query = query.eq('stock_status', 'LOW');
    }

    const { data, error } = await query.order('current_stock', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener inventario: ${error.message}`);
    }

    return data || [];
  }

  // Create material entry
  async createMaterialEntry(input: MaterialEntryInput): Promise<MaterialEntry> {
    const { user, profile } = await this.getAuthenticatedUser();
    
    const entryDate = input.entry_date || new Date().toISOString().split('T')[0];
    const entryNumber = await this.generateEntryNumber(profile.plant_id, entryDate);

    // Get current inventory to calculate before/after values
    const { data: currentInventory } = await this.supabase
      .from('material_inventory')
      .select('current_stock')
      .eq('plant_id', profile.plant_id)
      .eq('material_id', input.material_id)
      .single();

    const inventoryBefore = currentInventory?.current_stock || 0;
    const inventoryAfter = inventoryBefore + input.quantity_received;

    const entryData = {
      entry_number: entryNumber,
      plant_id: profile.plant_id,
      material_id: input.material_id,
      supplier_id: input.supplier_id,
      entry_date: entryDate,
      entry_time: new Date().toTimeString().split(' ')[0],
      quantity_received: input.quantity_received,
      supplier_invoice: input.supplier_invoice,
      truck_number: input.truck_number,
      driver_name: input.driver_name,
      inventory_before: inventoryBefore,
      inventory_after: inventoryAfter,
      notes: input.notes,
      entered_by: user.id,
    };

    const { data, error } = await this.supabase
      .from('material_entries')
      .insert(entryData)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al crear entrada de material: ${error.message}`);
    }

    return data;
  }

  // Create material adjustment
  async createMaterialAdjustment(input: MaterialAdjustmentInput): Promise<MaterialAdjustment> {
    const { user, profile } = await this.getAuthenticatedUser();
    
    const adjustmentDate = input.adjustment_date || new Date().toISOString().split('T')[0];
    const adjustmentNumber = await this.generateAdjustmentNumber(profile.plant_id, adjustmentDate);

    // Get current inventory to calculate before/after values
    const { data: currentInventory } = await this.supabase
      .from('material_inventory')
      .select('current_stock')
      .eq('plant_id', profile.plant_id)
      .eq('material_id', input.material_id)
      .single();

    const inventoryBefore = currentInventory?.current_stock || 0;
    const inventoryAfter = inventoryBefore - input.quantity_adjusted; // Adjustments typically reduce stock

    const adjustmentData = {
      adjustment_number: adjustmentNumber,
      plant_id: profile.plant_id,
      material_id: input.material_id,
      adjustment_date: adjustmentDate,
      adjustment_time: new Date().toTimeString().split(' ')[0],
      adjustment_type: input.adjustment_type,
      quantity_adjusted: input.quantity_adjusted,
      inventory_before: inventoryBefore,
      inventory_after: inventoryAfter,
      reference_type: input.reference_type,
      reference_notes: input.reference_notes,
      adjusted_by: user.id,
    };

    const { data, error } = await this.supabase
      .from('material_adjustments')
      .insert(adjustmentData)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al crear ajuste de material: ${error.message}`);
    }

    return data;
  }

  // Get daily inventory log
  async getDailyLog(date: string): Promise<DailyInventoryLog | null> {
    const { profile } = await this.getAuthenticatedUser();

    const { data, error } = await this.supabase
      .from('daily_inventory_log')
      .select('*')
      .eq('plant_id', profile.plant_id)
      .eq('log_date', date)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Error al obtener bitácora diaria: ${error.message}`);
    }

    return data;
  }

  // Close daily log
  async closeDailyLog(date: string, notes?: string): Promise<DailyInventoryLog> {
    const { user, profile } = await this.getAuthenticatedUser();

    const { data, error } = await this.supabase
      .from('daily_inventory_log')
      .update({
        is_closed: true,
        closed_by: user.id,
        closed_at: new Date().toISOString(),
        daily_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('plant_id', profile.plant_id)
      .eq('log_date', date)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al cerrar bitácora diaria: ${error.message}`);
    }

    return data;
  }

  // Get material entries for date range
  async getMaterialEntries(dateFrom?: string, dateTo?: string, materialId?: string, limit = 20, offset = 0): Promise<MaterialEntry[]> {
    const { profile } = await this.getAuthenticatedUser();

    let query = this.supabase
      .from('material_entries')
      .select('*')
      .eq('plant_id', profile.plant_id);

    if (dateFrom) {
      query = query.gte('entry_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('entry_date', dateTo);
    }

    if (materialId) {
      query = query.eq('material_id', materialId);
    }

    const { data, error } = await query
      .order('entry_date', { ascending: false })
      .order('entry_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Error al obtener entradas de material: ${error.message}`);
    }

    return data || [];
  }

  // Get material adjustments for date range
  async getMaterialAdjustments(dateFrom?: string, dateTo?: string, materialId?: string, limit = 20, offset = 0): Promise<MaterialAdjustment[]> {
    const { profile } = await this.getAuthenticatedUser();

    let query = this.supabase
      .from('material_adjustments')
      .select('*')
      .eq('plant_id', profile.plant_id);

    if (dateFrom) {
      query = query.gte('adjustment_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('adjustment_date', dateTo);
    }

    if (materialId) {
      query = query.eq('material_id', materialId);
    }

    const { data, error } = await query
      .order('adjustment_date', { ascending: false })
      .order('adjustment_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Error al obtener ajustes de material: ${error.message}`);
    }

    return data || [];
  }

  // Get daily inventory activity
  async getDailyActivity(dateFrom?: string, dateTo?: string, materialId?: string, activityType = 'all', limit = 20, offset = 0): Promise<InventoryActivity[]> {
    const { profile } = await this.getAuthenticatedUser();

    const { data, error } = await this.supabase
      .from('vw_daily_inventory_activity')
      .select('*')
      .eq('plant_name', profile.plant_id); // Note: This view might need adjustment for plant filtering

    if (error) {
      throw new Error(`Error al obtener actividad diaria: ${error.message}`);
    }

    return data || [];
  }

  // Get current stock status overview
  async getCurrentStockStatus(): Promise<CurrentStockStatus[]> {
    const { profile } = await this.getAuthenticatedUser();

    const { data, error } = await this.supabase
      .from('vw_current_stock_status')
      .select('*')
      .eq('plant_name', profile.plant_id); // Note: This view might need adjustment for plant filtering

    if (error) {
      throw new Error(`Error al obtener estado de stock: ${error.message}`);
    }

    return data || [];
  }

  // Update material entry
  async updateMaterialEntry(id: string, updates: Partial<MaterialEntryInput>): Promise<MaterialEntry> {
    const { profile } = await this.getAuthenticatedUser();

    const { data, error } = await this.supabase
      .from('material_entries')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('plant_id', profile.plant_id) // Ensure user can only update their plant's entries
      .select()
      .single();

    if (error) {
      throw new Error(`Error al actualizar entrada de material: ${error.message}`);
    }

    return data;
  }

  // Update material adjustment
  async updateMaterialAdjustment(id: string, updates: Partial<MaterialAdjustmentInput>): Promise<MaterialAdjustment> {
    const { profile } = await this.getAuthenticatedUser();

    const { data, error } = await this.supabase
      .from('material_adjustments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('plant_id', profile.plant_id) // Ensure user can only update their plant's adjustments
      .select()
      .single();

    if (error) {
      throw new Error(`Error al actualizar ajuste de material: ${error.message}`);
    }

    return data;
  }

  // Upload document to storage
  async uploadDocument(file: File, type: 'entry' | 'adjustment', referenceId: string): Promise<string> {
    const { profile } = await this.getAuthenticatedUser();
    
    const fileExtension = file.name.split('.').pop();
    const fileName = `${profile.plant_id}/${type}/${referenceId}_${Date.now()}.${fileExtension}`;

    const { data, error } = await this.supabase.storage
      .from('inventory-documents')
      .upload(fileName, file);

    if (error) {
      throw new Error(`Error al subir documento: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from('inventory-documents')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  // Process Arkik file upload (placeholder for integration)
  async processArkikUpload(file: File, plantId?: string): Promise<ArkikProcessingResult> {
    // This would integrate with the existing Arkik processing system
    // For now, return a placeholder result
    return {
      fileId: 'temp-' + Date.now(),
      totalRecords: 0,
      date: new Date().toISOString().split('T')[0],
      plant: plantId || 'unknown',
      status: 'uploaded',
    };
  }
}
