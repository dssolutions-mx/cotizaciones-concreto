import { supabase } from '@/lib/supabase/client';
import { StagingRemision } from '@/types/arkik';

export interface RemisionCreationResult {
  success: boolean;
  remisionId?: string;
  error?: string;
}

export class ArkikRemisionCreator {
  private plantId: string;

  constructor(plantId: string) {
    this.plantId = plantId;
  }

  /**
   * Create remision records from arkik data for existing orders
   */
  async createRemisionesForExistingOrder(
    orderId: string,
    stagingRemisiones: StagingRemision[]
  ): Promise<{
    success: boolean;
    createdRemisiones: string[];
    errors: string[];
  }> {
    const createdRemisiones: string[] = [];
    const errors: string[] = [];

    for (const stagingRemision of stagingRemisiones) {
      try {
        const result = await this.createSingleRemision(orderId, stagingRemision);
        
        if (result.success && result.remisionId) {
          createdRemisiones.push(result.remisionId);
        } else {
          errors.push(`Remisión ${stagingRemision.remision_number}: ${result.error}`);
        }
      } catch (error) {
        errors.push(`Remisión ${stagingRemision.remision_number}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      createdRemisiones,
      errors
    };
  }

  /**
   * Create a single remision record
   */
  private async createSingleRemision(
    orderId: string,
    stagingRemision: StagingRemision
  ): Promise<RemisionCreationResult> {
    try {
      // Create the main remision record
      const { data: remision, error: remisionError } = await supabase
        .from('remisiones')
        .insert({
          order_id: orderId,
          remision_number: stagingRemision.remision_number,
          fecha: (() => {
            const year = stagingRemision.fecha.getFullYear();
            const month = String(stagingRemision.fecha.getMonth() + 1).padStart(2, '0');
            const day = String(stagingRemision.fecha.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          })(),
          hora_carga: (() => {
            const hours = String(stagingRemision.hora_carga.getHours()).padStart(2, '0');
            const minutes = String(stagingRemision.hora_carga.getMinutes()).padStart(2, '0');
            const seconds = String(stagingRemision.hora_carga.getSeconds()).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
          })(),
          volumen_fabricado: stagingRemision.volumen_fabricado,
          conductor: stagingRemision.conductor,
          placas: stagingRemision.placas,
          camion: stagingRemision.camion,
          punto_entrega: stagingRemision.punto_entrega,
          comentarios_externos: stagingRemision.comentarios_externos,
          comentarios_internos: stagingRemision.comentarios_internos,
          product_description: stagingRemision.product_description,
          recipe_id: stagingRemision.recipe_id,
          estatus: stagingRemision.estatus,
          plant_id: this.plantId,
          // Arkik specific fields
          arkik_import: true,
          arkik_session_id: stagingRemision.session_id,
          arkik_raw_data: {
            prod_comercial: stagingRemision.prod_comercial,
            prod_tecnico: stagingRemision.prod_tecnico,
            elementos: stagingRemision.elementos,
            bombeable: stagingRemision.bombeable,
            quote_detail_id: stagingRemision.quote_detail_id
          }
        })
        .select('id')
        .single();

      if (remisionError) {
        throw remisionError;
      }

      // Create material records
      if (remision.id) {
        await this.createMaterialRecords(remision.id, stagingRemision);
      }

      return {
        success: true,
        remisionId: remision.id
      };

    } catch (error) {
      console.error('Error creating remision:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create material records for a remision
   */
  private async createMaterialRecords(
    remisionId: string,
    stagingRemision: StagingRemision
  ): Promise<void> {
    const materialRecords = [];

    // Process all material codes
    const allMaterialCodes = new Set([
      ...Object.keys(stagingRemision.materials_teorico || {}),
      ...Object.keys(stagingRemision.materials_real || {}),
      ...Object.keys(stagingRemision.materials_retrabajo || {}),
      ...Object.keys(stagingRemision.materials_manual || {})
    ]);

    for (const materialCode of allMaterialCodes) {
      const teorico = stagingRemision.materials_teorico[materialCode] || 0;
      const realBase = stagingRemision.materials_real[materialCode] || 0;
      const retrabajo = stagingRemision.materials_retrabajo?.[materialCode] || 0;
      const manual = stagingRemision.materials_manual?.[materialCode] || 0;
      
      // Calculate final real amount
      const realFinal = realBase + retrabajo + manual;

      // Only create record if there's any non-zero value
      if (teorico > 0 || realFinal > 0) {
        materialRecords.push({
          remision_id: remisionId,
          arkik_material_code: materialCode,
          cantidad_teorica: teorico,
          cantidad_real_base: realBase,
          cantidad_retrabajo: retrabajo,
          cantidad_manual: manual,
          cantidad_real_final: realFinal,
          variacion_absoluta: realFinal - teorico,
          variacion_porcentual: teorico > 0 ? ((realFinal - teorico) / teorico) * 100 : 0,
          plant_id: this.plantId,
          created_at: new Date().toISOString()
        });
      }
    }

    if (materialRecords.length > 0) {
      const { error } = await supabase
        .from('arkik_materials')
        .insert(materialRecords);

      if (error) {
        console.error('Error creating material records:', error);
        throw error;
      }
    }
  }

  /**
   * Update order totals after adding remisiones
   */
  async updateOrderTotals(orderId: string): Promise<void> {
    try {
      // Calculate new totals based on all remisiones in the order
      const { data: remisiones, error: remisionesError } = await supabase
        .from('remisiones')
        .select('volumen_fabricado, order_items!inner(unit_price)')
        .eq('order_id', orderId);

      if (remisionesError) {
        throw remisionesError;
      }

      // Calculate total volume and amount
      const totalVolume = remisiones.reduce((sum, r) => sum + r.volumen_fabricado, 0);
      const totalAmount = remisiones.reduce((sum, r) => {
        const unitPrice = (r as any).order_items?.unit_price || 0;
        return sum + (r.volumen_fabricado * unitPrice);
      }, 0);

      // Update order totals
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          total_amount: totalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        throw updateError;
      }

    } catch (error) {
      console.error('Error updating order totals:', error);
      throw error;
    }
  }

  /**
   * Validate that remisiones can be added to an order
   */
  async validateRemisionesForOrder(
    orderId: string,
    stagingRemisiones: StagingRemision[]
  ): Promise<{
    valid: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Check if order exists and can accept new remisiones
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('order_status, credit_status, delivery_date')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        errors.push('Orden no encontrada');
        return { valid: false, warnings, errors };
      }

      // Check order status
      if (!['created', 'validated', 'scheduled'].includes(order.order_status)) {
        errors.push(`Orden en estado ${order.order_status} no puede recibir nuevas remisiones`);
      }

      // Check credit status
      if (order.credit_status !== 'approved') {
        warnings.push(`Orden con estado de crédito ${order.credit_status}`);
      }

      // Check for duplicate remision numbers
      const remisionNumbers = stagingRemisiones.map(r => r.remision_number);
      const { data: existingRemisiones, error: duplicateError } = await supabase
        .from('remisiones')
        .select('remision_number')
        .in('remision_number', remisionNumbers);

      if (duplicateError) {
        errors.push('Error verificando duplicados de remisiones');
      } else if (existingRemisiones.length > 0) {
        const duplicates = existingRemisiones.map(r => r.remision_number);
        errors.push(`Remisiones duplicadas: ${duplicates.join(', ')}`);
      }

      // Check date consistency
      const orderDate = new Date(order.delivery_date);
      stagingRemisiones.forEach(remision => {
        const daysDiff = Math.abs(
          (remision.fecha.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysDiff > 1) {
          warnings.push(
            `Remisión ${remision.remision_number} tiene fecha muy diferente a la orden (${daysDiff.toFixed(0)} días)`
          );
        }
      });

    } catch (error) {
      errors.push(`Error en validación: ${error}`);
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }
}
