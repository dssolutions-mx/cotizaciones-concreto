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
        const allEnsayos = muestreos.flatMap(muestreo =>
          muestreo.muestras?.flatMap(muestra => muestra.ensayos || []) || []
        );

        const ensayosEdadGarantia = allEnsayos.filter(e => e.is_edad_garantia);
        const complianceRate = ensayosEdadGarantia.length > 0
          ? (ensayosEdadGarantia.filter(e => e.porcentaje_cumplimiento >= 100).length / ensayosEdadGarantia.length) * 100
          : 0;

        const avgResistencia = ensayosEdadGarantia.length > 0
          ? ensayosEdadGarantia.reduce((sum, e) => sum + (e.resistencia_calculada || 0), 0) / ensayosEdadGarantia.length
          : 0;

        const minResistencia = ensayosEdadGarantia.length > 0
          ? Math.min(...ensayosEdadGarantia.map(e => e.resistencia_calculada || 0))
          : 0;

        const maxResistencia = ensayosEdadGarantia.length > 0
          ? Math.max(...ensayosEdadGarantia.map(e => e.resistencia_calculada || 0))
          : 0;

        return {
          id: remision.id,
          remisionNumber: remision.remision_number,
          fecha: remision.fecha,
          volume: remision.volumen_fabricado || 0,
          recipeCode: remision.recipes?.recipe_code || '',
          recipeFc: remision.recipes?.strength_fc || 0,
          constructionSite: remision.orders?.construction_site || '',
          muestreos: muestreos.map(muestreo => ({
            id: muestreo.id,
            fechaMuestreo: muestreo.fecha_muestreo,
            numeroMuestreo: muestreo.numero_muestreo,
            masaUnitaria: muestreo.masa_unitaria || 0,
            temperaturaAmbiente: muestreo.temperatura_ambiente || 0,
            temperaturaConcreto: muestreo.temperatura_concreto || 0,
            revenimientoSitio: muestreo.revenimiento_sitio || 0,
            muestras: muestreo.muestras?.map(muestra => ({
              id: muestra.id,
              tipoMuestra: muestra.tipo_muestra,
              identificacion: muestra.identificacion,
              fechaProgramadaEnsayo: muestra.fecha_programada_ensayo,
              ensayos: muestra.ensayos?.map(ensayo => ({
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
            const edadGarantiaEnsayos = muestra.ensayos.filter(e => e.isEdadGarantia);
            data.ensayos += edadGarantiaEnsayos.length;

            edadGarantiaEnsayos.forEach(ensayo => {
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
            const edadGarantiaEnsayos = muestra.ensayos.filter(e => e.isEdadGarantia);
            data.totalTests += edadGarantiaEnsayos.length;

            edadGarantiaEnsayos.forEach(ensayo => {
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
            const edadGarantiaEnsayos = muestra.ensayos.filter(e => e.isEdadGarantia);
            data.totalTests += edadGarantiaEnsayos.length;

            edadGarantiaEnsayos.forEach(ensayo => {
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
      // Calculate totals
      const totals = {
        volume: remisiones.reduce((sum, r) => sum + r.volume, 0),
        remisiones: remisiones.length,
        muestreos: remisiones.reduce((sum, r) => sum + r.muestreos.length, 0),
        ensayos: remisiones.reduce((sum, r) =>
          sum + r.muestreos.reduce((mSum, m) =>
            mSum + m.muestras.reduce((sSum, s) =>
              sSum + s.ensayos.length, 0
            ), 0
          ), 0
        ),
        ensayosEdadGarantia: remisiones.reduce((sum, r) =>
          sum + r.muestreos.reduce((mSum, m) =>
            mSum + m.muestras.reduce((sSum, s) =>
              sSum + s.ensayos.filter(e => e.isEdadGarantia).length, 0
            ), 0
          ), 0
        )
      };

      // Calculate averages
      const allEnsayosEdadGarantia = remisiones.flatMap(r =>
        r.muestreos.flatMap(m =>
          m.muestras.flatMap(s =>
            s.ensayos.filter(e => e.isEdadGarantia)
          )
        )
      );

      const averages = {
        resistencia: allEnsayosEdadGarantia.length > 0
          ? allEnsayosEdadGarantia.reduce((sum, e) => sum + (e.resistenciaCalculada || 0), 0) / allEnsayosEdadGarantia.length
          : 0,
        complianceRate: allEnsayosEdadGarantia.length > 0
          ? (allEnsayosEdadGarantia.filter(e => e.porcentajeCumplimiento >= 100).length / allEnsayosEdadGarantia.length) * 100
          : 0,
        masaUnitaria: remisiones.reduce((sum, r) =>
          sum + r.muestreos.reduce((mSum, m) => mSum + (m.masaUnitaria || 0), 0), 0
        ) / totals.muestreos || 0
      };

      // Calculate performance metrics
      const performance = {
        complianceRate: averages.complianceRate,
        onTimeTestingRate: allEnsayosEdadGarantia.length > 0
          ? (allEnsayosEdadGarantia.filter(e => !e.isEnsayoFueraTiempo).length / allEnsayosEdadGarantia.length) * 100
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
        totals,
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
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          business_name,
          client_code,
          rfc
        `)
        .eq('orders.remisiones.muestreos.muestras.ensayos.resistencia_calculada', 'not.is', null)
        .gte('orders.remisiones.fecha', fromDate)
        .lte('orders.remisiones.fecha', toDate)
        .order('business_name');

      if (error) throw error;
      return data || [];

    } catch (error) {
      handleError(error, 'getClientsWithQualityData');
      return [];
    }
  }
}
