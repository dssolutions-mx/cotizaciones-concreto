import { supabase } from '@/lib/supabase';
import { handleError } from '@/utils/errorHandler';
import type {
  ClientQualityData,
  ClientQualitySummary,
  ClientQualityRemisionData,
  ClientQualityApiResponse,
  ClientInfo
} from '@/types/clientQuality';

// Main service class for client quality analysis
export class ClientQualityService {

  /**
   * Get comprehensive quality data for a specific client
   */
  static async getClientQualityData(
    clientId: string,
    fromDate: string,
    toDate: string
  ): Promise<ClientQualityApiResponse> {
    try {
      console.log(`[ClientQualityService] Fetching data for client ${clientId} from ${fromDate} to ${toDate}`);

      // Get client basic info
      const clientInfo = await this.getClientInfo(clientId);
      if (!clientInfo) {
        throw new Error('Cliente no encontrado');
      }

      // Get all quality data for the client
      const remisionesData = await this.getClientRemisionesWithQuality(clientId, fromDate, toDate);
      const monthlyStats = await this.getMonthlyQualityStats(clientId, fromDate, toDate);
      const recipeStats = await this.getQualityByRecipe(clientId, fromDate, toDate);
      const siteStats = await this.getQualityByConstructionSite(clientId, fromDate, toDate);

      // Calculate summary statistics
      const summary = await this.calculateQualitySummary(clientInfo, remisionesData, fromDate, toDate);

      const qualityData: ClientQualityData = {
        clientInfo,
        summary,
        remisiones: remisionesData,
        monthlyStats,
        qualityByRecipe: recipeStats,
        qualityByConstructionSite: siteStats
      };

      return {
        data: qualityData,
        summary,
        success: true
      };

    } catch (error) {
      console.error('[ClientQualityService] Error fetching client quality data:', error);
      return {
        data: null as any,
        summary: null as any,
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Get basic client information
   */
  private static async getClientInfo(clientId: string): Promise<ClientInfo | null> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, business_name, client_code, rfc')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      return data as ClientInfo;
    } catch (error) {
      handleError(error, 'getClientInfo');
      return null;
    }
  }

  /**
   * Get all remisiones with quality data for a client
   */
  private static async getClientRemisionesWithQuality(
    clientId: string,
    fromDate: string,
    toDate: string
  ): Promise<ClientQualityRemisionData[]> {
    try {
      // First, get the order IDs for this client
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('client_id', clientId)
        .gte('delivery_date', fromDate)
        .lte('delivery_date', toDate);

      if (orderError) throw orderError;

      if (!orderData || orderData.length === 0) {
        console.log(`[ClientQualityService] No orders found for client ${clientId} in date range ${fromDate} to ${toDate}`);
        return [];
      }

      const orderIds = orderData.map(order => order.id);
      console.log(`[ClientQualityService] Found ${orderIds.length} orders for client ${clientId}`);

        // Now get remisiones for these orders
        const { data, error } = await supabase
          .from('remisiones')
          .select(`
            id,
            remision_number,
            fecha,
            volumen_fabricado,
            recipe_id,
            recipes (
              id,
              recipe_code,
              strength_fc
            ),
            orders (
              id,
              construction_site,
              clients (
                id,
                business_name
              )
            ),
            muestreos (
              id,
              fecha_muestreo,
              numero_muestreo,
              masa_unitaria,
              temperatura_ambiente,
              temperatura_concreto,
              revenimiento_sitio,
              muestras (
                id,
                tipo_muestra,
                identificacion,
                fecha_programada_ensayo,
                ensayos (
                  id,
                  fecha_ensayo,
                  carga_kg,
                  resistencia_calculada,
                  porcentaje_cumplimiento,
                  is_edad_garantia,
                  is_ensayo_fuera_tiempo
                )
              )
            ),
            remision_materiales (
              id,
              material_type,
              cantidad_real
            )
          `)
          .in('order_id', orderIds)
          .gte('fecha', fromDate)
          .lte('fecha', toDate)
          .not('volumen_fabricado', 'is', null)
          .order('fecha', { ascending: false });

      if (error) throw error;

      // Data is already filtered by client through the order relationship
      const filteredData = data || [];

      console.log(`[ClientQualityService] Found ${filteredData.length} remisiones for client ${clientId}`);

      // Transform and calculate compliance for each remision
      return filteredData.map(remision => {
        const muestreos = remision.muestreos || [];
        const allEnsayos = muestreos.flatMap((muestreo: any) =>
          muestreo.muestras?.flatMap((muestra: any) => muestra.ensayos || []) || []
        );

        // Only consider guarantee age tests that are within the allowed time window
        const validEnsayos = allEnsayos.filter((e: any) =>
          e.is_edad_garantia === true &&
          e.is_ensayo_fuera_tiempo === false &&
          e.resistencia_calculada > 0 &&
          e.porcentaje_cumplimiento !== null &&
          e.porcentaje_cumplimiento !== undefined
        );

        // Only calculate compliance for remisiones that have been tested
        const hasQualityData = validEnsayos.length > 0;
        const complianceRate = hasQualityData
          ? validEnsayos.reduce((sum: number, e: any) => sum + (e.porcentaje_cumplimiento || 0), 0) / validEnsayos.length
          : 0;

        const avgResistencia = hasQualityData
          ? validEnsayos.reduce((sum: number, e: any) => sum + (e.resistencia_calculada || 0), 0) / validEnsayos.length
          : 0;

        const minResistencia = hasQualityData
          ? Math.min(...validEnsayos.map((e: any) => e.resistencia_calculada || 0))
          : 0;

        const maxResistencia = hasQualityData
          ? Math.max(...validEnsayos.map((e: any) => e.resistencia_calculada || 0))
          : 0;

        // Calculate volumetric yield for sampled remisiones
        let rendimientoVolumetrico = 0;
        if (muestreos.length > 0 && remision.volumen_fabricado > 0) {
          // Sum all material quantities (cantidad_real)
          const totalMaterialQuantity = (remision.remision_materiales || [])
            .reduce((sum: number, material: any) => sum + (material.cantidad_real || 0), 0);
          
          // Get average masa unitaria from muestreos
          const avgMasaUnitaria = muestreos.length > 0
            ? muestreos.reduce((sum: number, m: any) => sum + (m.masa_unitaria || 0), 0) / muestreos.length
            : 0;
          
          if (totalMaterialQuantity > 0 && avgMasaUnitaria > 0) {
            // Rendimiento volumétrico = (total_materiales / masa_unitaria) / volumen_remision * 100 (para porcentaje)
            rendimientoVolumetrico = ((totalMaterialQuantity / avgMasaUnitaria) / remision.volumen_fabricado) * 100;
          }
        }

        return {
          id: remision.id,
          orderId: remision.order_id || remision.orders?.id,
          remisionNumber: remision.remision_number,
          fecha: remision.fecha,
          volume: remision.volumen_fabricado || 0,
          recipeCode: remision.recipes?.recipe_code || '',
          recipeFc: remision.recipes?.strength_fc || 0,
          constructionSite: remision.orders?.construction_site || '',
          rendimientoVolumetrico,
          totalMaterialQuantity: (remision.remision_materiales || [])
            .reduce((sum: number, material: any) => sum + (material.cantidad_real || 0), 0),
          materiales: (remision.remision_materiales || []).map((material: any) => ({
            id: material.id,
            materialType: material.material_type,
            cantidadReal: material.cantidad_real || 0
          })),
          muestreos: muestreos.map((muestreo: any) => ({
            id: muestreo.id,
            fechaMuestreo: muestreo.fecha_muestreo,
            numeroMuestreo: muestreo.numero_muestreo,
            masaUnitaria: muestreo.masa_unitaria || 0,
            temperaturaAmbiente: muestreo.temperatura_ambiente || 0,
            temperaturaConcreto: muestreo.temperatura_concreto || 0,
            revenimientoSitio: muestreo.revenimiento_sitio || 0,
            muestras: muestreo.muestras?.map((muestra: any) => ({
              id: muestra.id,
              tipoMuestra: muestra.tipo_muestra,
              identificacion: muestra.identificacion,
              fechaProgramadaEnsayo: muestra.fecha_programada_ensayo,
              ensayos: muestra.ensayos?.map((ensayo: any) => ({
                id: ensayo.id,
                fechaEnsayo: ensayo.fecha_ensayo,
                cargaKg: ensayo.carga_kg,
                resistenciaCalculada: ensayo.resistencia_calculada || 0,
                porcentajeCumplimiento: ensayo.porcentaje_cumplimiento || 0,
                isEdadGarantia: ensayo.is_edad_garantia || false,
                isEnsayoFueraTiempo: ensayo.is_ensayo_fuera_tiempo || false
              })) || []
            })) || []
          })),
          complianceStatus: complianceRate >= 95 ? 'compliant' :
                          complianceRate >= 80 ? 'pending' : 'non_compliant',
          avgResistencia,
          minResistencia,
          maxResistencia
        };
      });

    } catch (error) {
      handleError(error, 'getClientRemisionesWithQuality');
      return [];
    }
  }

  /**
   * Get monthly quality statistics for a client
   */
  private static async getMonthlyQualityStats(
    clientId: string,
    fromDate: string,
    toDate: string
  ): Promise<Array<{
    month: string;
    year: number;
    volume: number;
    remisiones: number;
    muestreos: number;
    ensayos: number;
    avgResistencia: number;
    complianceRate: number;
  }>> {
    try {
      // This would typically be done with a more complex query or aggregation
      // For now, we'll return a simplified structure
      const remisiones = await this.getClientRemisionesWithQuality(clientId, fromDate, toDate);

      const monthlyData = new Map<string, any>();

      remisiones.forEach(remision => {
        const date = new Date(remision.fecha);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, {
            month: date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            year: date.getFullYear(),
            volume: 0,
            remisiones: 0,
            muestreos: 0,
            ensayos: 0,
            totalResistencia: 0,
            resistenciaCount: 0,
            compliantTests: 0,
            totalTests: 0
          } as any);
        }

        const data = monthlyData.get(monthKey);
        data.volume += remision.volume;
        data.remisiones += 1;
        data.muestreos += remision.muestreos.length;

        remision.muestreos.forEach(muestreo => {
          muestreo.muestras.forEach(muestra => {
            const validEnsayos = muestra.ensayos.filter(e =>
              e.isEdadGarantia === true &&
              e.isEnsayoFueraTiempo === false &&
              e.resistenciaCalculada > 0 &&
              e.porcentajeCumplimiento !== null &&
              e.porcentajeCumplimiento !== undefined
            );
            data.ensayos += validEnsayos.length;

            validEnsayos.forEach(ensayo => {
              if (ensayo.resistenciaCalculada > 0) {
                data.totalResistencia += ensayo.resistenciaCalculada;
                data.resistenciaCount += 1;
              }
              if (ensayo.porcentajeCumplimiento >= 100) {
                data.compliantTests += 1;
              }
              data.totalTests += 1;
            });
          });
        });
      });

      return Array.from(monthlyData.values()).map(data => ({
        ...data,
        avgResistencia: data.resistenciaCount > 0 ? data.totalResistencia / data.resistenciaCount : 0,
        complianceRate: data.totalTests > 0 ? (data.compliantTests / data.totalTests) * 100 : 0
      }));

    } catch (error) {
      handleError(error, 'getMonthlyQualityStats');
      return [];
    }
  }

  /**
   * Get quality statistics grouped by recipe
   */
  private static async getQualityByRecipe(
    clientId: string,
    fromDate: string,
    toDate: string
  ): Promise<Array<{
    recipeCode: string;
    recipeFc: number;
    totalVolume: number;
    totalTests: number;
    avgResistencia: number;
    complianceRate: number;
    count: number;
  }>> {
    try {
      const remisiones = await this.getClientRemisionesWithQuality(clientId, fromDate, toDate);

      const recipeData = new Map<string, any>();

      remisiones.forEach(remision => {
        const recipeKey = remision.recipeCode;

        if (!recipeData.has(recipeKey)) {
          recipeData.set(recipeKey, {
            recipeCode: recipeKey,
            recipeFc: remision.recipeFc,
            totalVolume: 0,
            totalTests: 0,
            totalResistencia: 0,
            resistenciaCount: 0,
            compliantTests: 0,
            count: 0
          } as any);
        }

        const data = recipeData.get(recipeKey);
        data.totalVolume += remision.volume;
        data.count += 1;

        remision.muestreos.forEach(muestreo => {
          muestreo.muestras.forEach(muestra => {
            const validEnsayos = muestra.ensayos.filter(e =>
              e.isEdadGarantia === true &&
              e.isEnsayoFueraTiempo === false &&
              e.resistenciaCalculada > 0 &&
              e.porcentajeCumplimiento !== null &&
              e.porcentajeCumplimiento !== undefined
            );
            data.totalTests += validEnsayos.length;

            validEnsayos.forEach(ensayo => {
              if (ensayo.resistenciaCalculada > 0) {
                data.totalResistencia += ensayo.resistenciaCalculada;
                data.resistenciaCount += 1;
              }
              if (ensayo.porcentajeCumplimiento >= 100) {
                data.compliantTests += 1;
              }
            });
          });
        });
      });

      return Array.from(recipeData.values()).map(data => ({
        ...data,
        avgResistencia: data.resistenciaCount > 0 ? data.totalResistencia / data.resistenciaCount : 0,
        complianceRate: data.totalTests > 0 ? (data.compliantTests / data.totalTests) * 100 : 0
      }));

    } catch (error) {
      handleError(error, 'getQualityByRecipe');
      return [];
    }
  }

  /**
   * Get quality statistics grouped by construction site
   */
  private static async getQualityByConstructionSite(
    clientId: string,
    fromDate: string,
    toDate: string
  ): Promise<Array<{
    constructionSite: string;
    totalVolume: number;
    totalTests: number;
    avgResistencia: number;
    complianceRate: number;
    count: number;
  }>> {
    try {
      const remisiones = await this.getClientRemisionesWithQuality(clientId, fromDate, toDate);

      const siteData = new Map<string, any>();

      remisiones.forEach(remision => {
        const siteKey = remision.constructionSite;

        if (!siteData.has(siteKey)) {
          siteData.set(siteKey, {
            constructionSite: siteKey,
            totalVolume: 0,
            totalTests: 0,
            totalResistencia: 0,
            resistenciaCount: 0,
            compliantTests: 0,
            count: 0
          } as any);
        }

        const data = siteData.get(siteKey);
        data.totalVolume += remision.volume;
        data.count += 1;

        remision.muestreos.forEach(muestreo => {
          muestreo.muestras.forEach(muestra => {
            const validEnsayos = muestra.ensayos.filter(e =>
              e.isEdadGarantia === true &&
              e.isEnsayoFueraTiempo === false &&
              e.resistenciaCalculada > 0 &&
              e.porcentajeCumplimiento !== null &&
              e.porcentajeCumplimiento !== undefined
            );
            data.totalTests += validEnsayos.length;

            validEnsayos.forEach(ensayo => {
              if (ensayo.resistenciaCalculada > 0) {
                data.totalResistencia += ensayo.resistenciaCalculada;
                data.resistenciaCount += 1;
              }
              if (ensayo.porcentajeCumplimiento >= 100) {
                data.compliantTests += 1;
              }
            });
          });
        });
      });

      return Array.from(siteData.values()).map(data => ({
        ...data,
        avgResistencia: data.resistenciaCount > 0 ? data.totalResistencia / data.resistenciaCount : 0,
        complianceRate: data.totalTests > 0 ? (data.compliantTests / data.totalTests) * 100 : 0
      }));

    } catch (error) {
      handleError(error, 'getQualityByConstructionSite');
      return [];
    }
  }

  /**
   * Calculate comprehensive quality summary for a client
   */
  private static async calculateQualitySummary(
    clientInfo: ClientInfo,
    remisiones: ClientQualityRemisionData[],
    fromDate: string,
    toDate: string
  ): Promise<ClientQualitySummary> {
    try {
      // Calculate sampling and quality data coverage
      const remisionesWithMuestreos = remisiones.filter(r => r.muestreos && r.muestreos.length > 0).length;
      const remisionesWithQualityData = remisiones.filter(r => {
        const muestreos = r.muestreos || [];
        const allEnsayos = muestreos.flatMap((muestreo: any) =>
          muestreo.muestras?.flatMap((muestra: any) => muestra.ensayos || []) || []
        );
        const validEnsayos = allEnsayos.filter((e: any) =>
          e.isEdadGarantia === true &&
          e.isEnsayoFueraTiempo === false &&
          e.resistenciaCalculada > 0 &&
          e.porcentajeCumplimiento !== null &&
          e.porcentajeCumplimiento !== undefined
        );
        return validEnsayos.length > 0;
      }).length;

      // Calculate totals with proper filtering
      const totals = {
        volume: remisiones.reduce((sum, r) => sum + r.volume, 0),
        remisiones: remisiones.length,
        remisionesMuestreadas: remisionesWithMuestreos,
        remisionesConDatosCalidad: remisionesWithQualityData,
        porcentajeCoberturaMuestreo: remisiones.length > 0 ? (remisionesWithMuestreos / remisiones.length) * 100 : 0,
        porcentajeCoberturaCalidad: remisiones.length > 0 ? (remisionesWithQualityData / remisiones.length) * 100 : 0,
        muestreos: remisiones.reduce((sum: number, r: any) => sum + r.muestreos.length, 0),
        ensayos: remisiones.reduce((sum: number, r: any) =>
          sum + r.muestreos.reduce((mSum: number, m: any) =>
            mSum + m.muestras.reduce((sSum: number, s: any) =>
              sSum + s.ensayos.length, 0
            ), 0
          ), 0
        ),
        ensayosEdadGarantia: remisiones.reduce((sum: number, r: any) =>
          sum + r.muestreos.reduce((mSum: number, m: any) =>
            mSum + m.muestras.reduce((sSum: number, s: any) =>
              sSum + s.ensayos.filter((e: any) =>
                e.isEdadGarantia === true &&
                e.isEnsayoFueraTiempo === false &&
                e.resistenciaCalculada > 0 &&
                e.porcentajeCumplimiento !== null &&
                e.porcentajeCumplimiento !== undefined
              ).length, 0
            ), 0
          ), 0
        )
      };


      // Calculate averages with proper filtering
      const allValidEnsayos = remisiones.flatMap((r: any) =>
        r.muestreos.flatMap((m: any) =>
          m.muestras.flatMap((s: any) =>
            s.ensayos.filter((e: any) =>
              e.isEdadGarantia === true &&
              e.isEnsayoFueraTiempo === false &&
              e.resistenciaCalculada > 0 &&
              e.porcentajeCumplimiento !== null &&
              e.porcentajeCumplimiento !== undefined
            )
          )
        )
      );

      const averages = {
        resistencia: allValidEnsayos.length > 0
          ? allValidEnsayos.reduce((sum: number, e: any) => sum + (e.resistenciaCalculada || 0), 0) / allValidEnsayos.length
          : 0,
        complianceRate: allValidEnsayos.length > 0
          ? allValidEnsayos.reduce((sum: number, e: any) => sum + (e.porcentajeCumplimiento || 0), 0) / allValidEnsayos.length
          : 0,
        masaUnitaria: remisiones.reduce((sum: number, r: any) =>
          sum + r.muestreos.reduce((mSum: number, m: any) => mSum + (m.masaUnitaria || 0), 0), 0
        ) / totals.muestreos || 0,
        rendimientoVolumetrico: remisiones
          .filter((r: any) => r.rendimientoVolumetrico && r.rendimientoVolumetrico > 0)
          .reduce((sum: number, r: any) => sum + (r.rendimientoVolumetrico || 0), 0) / 
          remisiones.filter((r: any) => r.rendimientoVolumetrico && r.rendimientoVolumetrico > 0).length || 0
      };

      // Calculate performance metrics
      const performance = {
        complianceRate: averages.complianceRate,
        onTimeTestingRate: allValidEnsayos.length > 0
          ? (allValidEnsayos.filter(e => !e.isEnsayoFueraTiempo).length / allValidEnsayos.length) * 100
          : 0,
        volumeTrend: 'stable' as const, // Would need historical comparison
        qualityTrend: 'stable' as const  // Would need historical comparison
      };

      // Generate alerts based on metrics
      const alerts = [];
      if (averages.complianceRate < 85) {
        alerts.push({
          type: 'error' as const,
          message: `Tasa de cumplimiento baja: ${averages.complianceRate.toFixed(1)}%`,
          metric: 'compliance'
        });
      }
      if (performance.onTimeTestingRate < 90) {
        alerts.push({
          type: 'warning' as const,
          message: `Ensayos fuera de tiempo: ${(100 - performance.onTimeTestingRate).toFixed(1)}%`,
          metric: 'timing'
        });
      }
      if (totals.ensayos === 0) {
        alerts.push({
          type: 'info' as const,
          message: 'No hay ensayos registrados en el período seleccionado',
          metric: 'data'
        });
      }

      return {
        clientInfo,
        period: { from: fromDate, to: toDate },
        totals: {
          ...totals,
          remisionesMuestreadas: totals.remisionesMuestreadas ?? 0,
          remisionesConDatosCalidad: totals.remisionesConDatosCalidad ?? 0,
          porcentajeCoberturaMuestreo: totals.porcentajeCoberturaMuestreo ?? 0,
          porcentajeCoberturaCalidad: totals.porcentajeCoberturaCalidad ?? 0
        },
        averages,
        performance,
        alerts
      };

    } catch (error) {
      handleError(error, 'calculateQualitySummary');
      throw error;
    }
  }

  /**
   * Get list of clients with quality data available
   */
  static async getClientsWithQualityData(fromDate: string, toDate: string): Promise<ClientInfo[]> {
    try {
      // This is a simplified version - in practice, you'd need a more complex query
      // to find clients that actually have quality data in the specified date range
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          business_name,
          client_code,
          rfc
        `)
        .order('business_name');

      if (error) throw error;
      return data || [];

    } catch (error) {
      handleError(error, 'getClientsWithQualityData');
      return [];
    }
  }
}
