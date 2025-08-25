import { supabase } from '@/lib/supabase';
import { handleError } from '@/utils/errorHandler';
import {
  Muestreo,
  Muestra,
  Ensayo,
  Evidencia,
  MuestreoWithRelations,
  MuestraWithRelations,
  EnsayoWithRelations,
  FiltrosCalidad,
  MetricasCalidad,
  DatoGraficoResistencia
} from '@/types/quality';
import { format, subMonths } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { formatDate, createSafeDate } from '@/lib/utils';

// Muestreos
export async function fetchMuestreos(filters?: FiltrosCalidad) {
  try {
    // If filtering by business unit, resolve to plant_ids first
    let resolvedPlantIds: string[] | undefined = filters?.plant_ids;
    if (!resolvedPlantIds && filters?.business_unit_id && !filters?.plant_id) {
      const { data: buPlants } = await supabase
        .from('plants')
        .select('id')
        .eq('business_unit_id', filters.business_unit_id)
        .eq('is_active', true);
      resolvedPlantIds = (buPlants || []).map(p => p.id);
    }

    let query = supabase
      .from('muestreos')
      .select(`
        *,
        remision:remision_id (
          *,
          recipe:recipes(*),
          orders(
            clients(*)
          )
        ),
        plant:plant_id (*, business_unit:business_units(*)),
        muestras(*)
      `)
      .order('fecha_muestreo', { ascending: false });

    // Apply filters if provided
    if (filters) {
      if (filters.fechaDesde) {
        query = query.gte('fecha_muestreo', format(filters.fechaDesde, 'yyyy-MM-dd'));
      }
      if (filters.fechaHasta) {
        query = query.lte('fecha_muestreo', format(filters.fechaHasta, 'yyyy-MM-dd'));
      }
      if (filters.planta) {
        query = query.eq('planta', filters.planta);
      }
      if (filters.plant_id) {
        query = query.eq('plant_id', filters.plant_id);
      }
      const plantIdsToUse = resolvedPlantIds && resolvedPlantIds.length > 0 ? resolvedPlantIds : filters?.plant_ids;
      if (plantIdsToUse && plantIdsToUse.length > 0) {
        query = query.in('plant_id', plantIdsToUse);
      }
      // Note: business_unit_id is handled via resolvedPlantIds
      if (filters.cliente) {
        query = query.filter('remision.orders.clients.business_name', 'ilike', `%${filters.cliente}%`);
      }
      if (filters.receta) {
        query = query.filter('remision.recipe.recipe_code', 'ilike', `%${filters.receta}%`);
      }
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data as MuestreoWithRelations[];
  } catch (error) {
    handleError(error, 'fetchMuestreos');
    return [] as MuestreoWithRelations[];
  }
}

export async function fetchMuestreoById(id: string) {
  try {
    const { data, error } = await supabase
      .from('muestreos')
      .select(`
        *,
        remision:remision_id (
          *,
          recipe:recipes(
            *,
            recipe_versions(*)
          )
        ),
        muestras(
          *,
          ensayos(*),
          alertas_ensayos(*)
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    // Now fetch the order information separately since we can't join through foreign keys easily
    if (data?.remision?.order_id) {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          construction_site,
          delivery_date,
          delivery_time,
          clients(
            id,
            business_name
          )
        `)
        .eq('id', data.remision.order_id)
        .single();
      
      if (!orderError && orderData) {
        data.remision.order = orderData;
      }
    }
    
    return data as MuestreoWithRelations;
  } catch (error) {
    handleError(error, `fetchMuestreoById:${id}`);
    throw new Error('Error al obtener muestreo');
  }
}

export async function createMuestreo(muestreo: Partial<Muestreo>) {
  try {
    // Map planta to plant_id if planta is provided
    let muestreoToCreate = { ...muestreo };
    if (muestreo.planta && !muestreo.plant_id) {
      const plantId = await mapPlantaToPlantId(muestreo.planta);
      if (plantId) {
        muestreoToCreate.plant_id = plantId;
      }
    }

    const { data, error } = await supabase
      .from('muestreos')
      .insert(muestreoToCreate)
      .select()
      .single();
    
    if (error) throw error;
    return data as Muestreo;
  } catch (error) {
    handleError(error, 'createMuestreo');
    throw new Error('Error al crear muestreo');
  }
}

// UI planning type for explicit sample creation (duplicate kept local to service)
export type PlannedSample = {
  id: string;
  tipo_muestra: 'CILINDRO' | 'VIGA' | 'CUBO';
  fecha_programada_ensayo: Date;
  diameter_cm?: number; // only for cylinders
  cube_side_cm?: number; // only for cubes
  age_days?: number; // days
  age_hours?: number; // optional precise age in hours
};

// Function to map planta codes to plant_id
async function mapPlantaToPlantId(planta: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('plants')
      .select('id')
      .eq('code', planta)
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.warn(`Could not map planta ${planta} to plant_id:`, error);
      return null;
    }
    
    return data?.id || null;
  } catch (error) {
    console.warn(`Error mapping planta ${planta} to plant_id:`, error);
    return null;
  }
}

type NewMuestreoInput = Omit<Partial<Muestreo>, 'fecha_muestreo'> & {
  fecha_muestreo: Date | string;
  created_by?: string;
  sampling_type?: 'REMISION_LINKED' | 'STANDALONE' | 'PROVISIONAL';
};

export async function createMuestreoWithSamples(
  data: NewMuestreoInput,
  plannedSamples: PlannedSample[]
) {
  try {
    const { 
      numero_cilindros, 
      numero_vigas,
      peso_recipiente_vacio,
      peso_recipiente_lleno,
      factor_recipiente,
      ...muestreoData 
    } = data as any;

    // Map planta to plant_id if planta is provided
    let plantId: string | null = null;
    if (muestreoData.planta) {
      plantId = await mapPlantaToPlantId(muestreoData.planta);
      if (!plantId) {
        throw new Error(`No se pudo mapear la planta ${muestreoData.planta} a un plant_id válido`);
      }
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const baseDateVal = typeof muestreoData.fecha_muestreo === 'string'
      ? new Date(`${muestreoData.fecha_muestreo}T00:00:00`)
      : muestreoData.fecha_muestreo;
    const muestreoToCreate = {
      ...muestreoData,
      plant_id: plantId, // Add the mapped plant_id
      fecha_muestreo: typeof muestreoData.fecha_muestreo === 'string' 
        ? muestreoData.fecha_muestreo 
        : formatDate(muestreoData.fecha_muestreo, 'yyyy-MM-dd'),
      fecha_muestreo_ts: baseDateVal ? new Date(baseDateVal).toISOString() : new Date().toISOString(),
      event_timezone: tz
    } as any;

    const { data: muestreo, error } = await supabase
      .from('muestreos')
      .insert(muestreoToCreate)
      .select()
      .single();
    if (error) throw error;

    if (plannedSamples && plannedSamples.length > 0) {
      let counter = 1;
      const samplesToInsert = plannedSamples.map((s) => {
        const baseDateStr = typeof muestreoToCreate.fecha_muestreo === 'string'
          ? muestreoToCreate.fecha_muestreo
          : formatDate(muestreoToCreate.fecha_muestreo, 'yyyy-MM-dd');

        // Use the precise sampling timestamp (including hour/minute) as the base for age calculations
        const baseTs = muestreoToCreate.fecha_muestreo_ts
          ? new Date(muestreoToCreate.fecha_muestreo_ts)
          : createSafeDate(baseDateStr)!;

        const idClas = s.tipo_muestra === 'VIGA' ? 'MR' : 'FC';
        const diameterSuffix = s.tipo_muestra === 'CILINDRO' && s.diameter_cm ? `-D${s.diameter_cm}` : '';
        const cubeSuffix = s.tipo_muestra === 'CUBO' && s.cube_side_cm ? `-S${s.cube_side_cm}` : '';
        const identification = `${idClas}-${baseDateStr.replace(/-/g, '')}-${String(counter++).padStart(3, '0')}${diameterSuffix}${cubeSuffix}`;

        // Programmed date derived from age_hours > age_days > given, preserving the sampling time of day
        let programmedDate = s.fecha_programada_ensayo;
        if (typeof s.age_hours === 'number' && isFinite(s.age_hours)) {
          const byHours = new Date(baseTs);
          byHours.setHours(byHours.getHours() + s.age_hours);
          programmedDate = byHours;
        } else if (typeof s.age_days === 'number' && isFinite(s.age_days)) {
          const byDays = new Date(baseTs);
          byDays.setDate(byDays.getDate() + s.age_days);
          programmedDate = byDays;
        }

        return {
          id: uuidv4(),
          muestreo_id: muestreo.id,
          plant_id: plantId, // Add plant_id to samples as well
          tipo_muestra: s.tipo_muestra,
          identificacion: identification,
          fecha_programada_ensayo: formatDate(programmedDate, 'yyyy-MM-dd'),
          fecha_programada_ensayo_ts: programmedDate.toISOString(),
          event_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          estado: 'PENDIENTE',
          created_at: new Date().toISOString(),
          diameter_cm: s.tipo_muestra === 'CILINDRO' ? (s.diameter_cm ?? null) : null,
          cube_side_cm: s.tipo_muestra === 'CUBO' ? (s.cube_side_cm ?? null) : null,
        } as any;
      });

      const { data: inserted, error: insertErr } = await supabase
        .from('muestras')
        .insert(samplesToInsert)
        .select('id');
      if (insertErr) throw insertErr;

      if (inserted && inserted.length > 0) {
        const alertsToCreate = samplesToInsert.map((sample: any) => {
          const tz2 = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const testTs = sample.fecha_programada_ensayo_ts ? new Date(sample.fecha_programada_ensayo_ts) : createSafeDate(sample.fecha_programada_ensayo)!;
          const alertTs = new Date(testTs.getTime() - 24 * 3600 * 1000);
          const alertLocal = new Date(alertTs);
          alertLocal.setUTCHours(9, 0, 0, 0);
          return {
            muestra_id: sample.id,
            fecha_alerta: formatDate(alertLocal, 'yyyy-MM-dd'),
            fecha_alerta_ts: alertLocal.toISOString(),
            event_timezone: tz2,
            estado: 'PENDIENTE',
            created_at: new Date().toISOString(),
          };
        });
        const { error: alertErr } = await supabase
          .from('alertas_ensayos')
          .insert(alertsToCreate);
        if (alertErr) throw alertErr;
      }
    }

    return muestreo.id as string;
  } catch (error) {
    handleError(error, 'createMuestreoWithSamples');
    throw new Error('Error al crear muestreo y muestras');
  }
}

// Muestras
export async function fetchMuestraById(id: string) {
  try {
    const { data, error } = await supabase
      .from('muestras')
      .select(`
        *,
        muestreo:muestreo_id (
          *,
          remision:remision_id (
            *,
            recipe:recipes(
              *,
              recipe_versions(*)
            ),
            orders(
              clients(*)
            )
          )
        ),
        ensayos(*),
        alertas_ensayos(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as MuestraWithRelations;
  } catch (error) {
    handleError(error, `fetchMuestraById:${id}`);
    throw new Error('Error al obtener muestra');
  }
}

export async function fetchMuestrasPendientes(filters?: FiltrosCalidad) {
  try {
    let query = supabase
      .from('muestras')
      .select(`
        *,
        muestreo:muestreo_id (
          *,
          plant:plant_id (*, business_unit:business_units(*)),
          remision:remision_id (
            *,
            recipe:recipes(*),
            orders(
              clients(*)
            )
          )
        ),
        alertas_ensayos(*)
      `)
      .eq('estado', 'PENDIENTE')
      .order('fecha_programada_ensayo', { ascending: true });

    // Apply filters if provided
    if (filters) {
      if (filters.fechaDesde) {
        query = query.gte('fecha_programada_ensayo', format(filters.fechaDesde, 'yyyy-MM-dd'));
      }
      if (filters.fechaHasta) {
        query = query.lte('fecha_programada_ensayo', format(filters.fechaHasta, 'yyyy-MM-dd'));
      }
      if (filters.planta) {
        query = query.filter('muestreo.planta', 'eq', filters.planta);
      }
      if (filters.plant_id) {
        query = query.filter('muestreo.plant_id', 'eq', filters.plant_id);
      }
      if (filters.plant_ids && filters.plant_ids.length > 0) {
        query = query.filter('muestreo.plant_id', 'in', `(${filters.plant_ids.map(id => `'${id}'`).join(',')})`);
      }
      if (filters.business_unit_id) {
        // Need to join plants; not supported directly via dot syntax on m2o in filter for RPC
        // We'll filter client-side once fetched
      }
      if (filters.clasificacion) {
        // This would need a join with recipes and recipe_versions to filter by clasificacion
        // For simplicity, we'll filter on the client side for classification
      }
    }

    const { data, error } = await query;
    
    if (error) throw error;
    
    // Filter by classification if needed (client-side)
    let filteredData = data as MuestraWithRelations[];
    
    // Client-side BU filter if requested
    if (filters?.business_unit_id) {
      filteredData = filteredData.filter(m => (m.muestreo as any)?.plant?.business_unit_id === filters.business_unit_id);
    }
    if (filters?.clasificacion) {
      filteredData = filteredData.filter(muestra => {
        const recipeNotes = muestra.muestreo?.remision?.recipe?.recipe_versions?.[0]?.notes || '';
        const clasificacion = recipeNotes.includes('MR') ? 'MR' : 'FC';
        return clasificacion === filters.clasificacion;
      });
    }
    
    return filteredData;
  } catch (error) {
    handleError(error, 'fetchMuestrasPendientes');
    return [] as MuestraWithRelations[];
  }
}

// Ensayos
export async function fetchEnsayoById(id: string) {
  try {
    const { data, error } = await supabase
      .from('ensayos')
      .select(`
        *,
        muestra:muestra_id (
          *,
          muestreo:muestreo_id (
            *,
            concrete_specs,
            remision:remision_id (
              *,
              recipe:recipes(
                *,
                recipe_versions(*)
              ),
              orders(
                clients(*)
              )
            )
          )
        ),
        evidencias(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as EnsayoWithRelations;
  } catch (error) {
    handleError(error, `fetchEnsayoById:${id}`);
    throw new Error('Error al obtener ensayo');
  }
}

export async function createEnsayo(data: {
  muestra_id: string;
  fecha_ensayo: Date | string;
  carga_kg: number;
  resistencia_calculada: number;
  porcentaje_cumplimiento: number;
  observaciones?: string;
  created_by?: string;
  evidencia_fotografica?: File[];
}) {
  try {
    // Get current user session to include in request
    const { data: authData } = await supabase.auth.getSession();
    
    if (!authData.session?.user?.id) {
      throw new Error('Usuario no autenticado. Debe iniciar sesión para registrar ensayos.');
    }
    
    const userId = authData.session.user.id;

    // First, get the muestra details to validate it exists
    const { data: muestra, error: muestraError } = await supabase
      .from('muestras')
      .select(`
        *,
        muestreos:muestreo_id(
          *,
          remision:remision_id(
            *,
            recipe:recipes(
              *,
              recipe_versions(*)
            )
          )
        )
      `)
      .eq('id', data.muestra_id)
      .single();

    if (muestraError) {
      console.error('Error getting muestra:', muestraError);
      throw new Error('Error al obtener la muestra');
    }

    if (!muestra) {
      throw new Error('Muestra no encontrada');
    }

    // Call our server-side API endpoint to create ensayo (bypasses RLS)
    const response = await fetch('/api/quality/ensayos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        muestra_id: data.muestra_id,
        fecha_ensayo: typeof data.fecha_ensayo === 'string' 
          ? data.fecha_ensayo 
          : format(data.fecha_ensayo, 'yyyy-MM-dd'),
        // Registrar también el timestamp exacto (hora/minuto/segundo) del ensayo
        fecha_ensayo_ts: new Date().toISOString(),
        event_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        carga_kg: data.carga_kg,
        resistencia_calculada: data.resistencia_calculada,
        porcentaje_cumplimiento: data.porcentaje_cumplimiento,
        observaciones: data.observaciones || '',
        created_by: userId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en createEnsayo:', errorData);
      throw new Error(errorData.error || 'Error al registrar ensayo');
    }

    const { ensayo } = await response.json();
    console.log('Ensayo created:', ensayo);

    // Upload evidence photos if any
    if (data.evidencia_fotografica && data.evidencia_fotografica.length > 0 && ensayo) {
      await Promise.all(
        data.evidencia_fotografica.map(async (file) => {
          // Create FormData for file upload
          const formData = new FormData();
          formData.append('ensayoId', ensayo.id);
          formData.append('muestraId', data.muestra_id);
          formData.append('file', file);

          // Upload to server endpoint that bypasses RLS
          const uploadResponse = await fetch('/api/quality/evidencias', {
            method: 'POST',
            body: formData
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            console.error('Error uploading evidence:', errorData);
          }
        })
      );
    }

    return ensayo;
  } catch (error) {
    console.error('Error in createEnsayo:', error);
    throw new Error('Error al registrar ensayo');
  }
}

export async function updateMuestraEstado(id: string, estado: 'ENSAYADO' | 'DESCARTADO') {
  try {
    const { error } = await supabase
      .from('muestras')
      .update({ estado })
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error) {
    handleError(error, `updateMuestraEstado:${id}`);
    throw new Error('Error al actualizar estado de la muestra');
  }
}

export async function updateAlertaEstado(muestraId: string, estado: 'VISTA' | 'COMPLETADA') {
  try {
    const { error } = await supabase
      .from('alertas_ensayos')
      .update({ estado })
      .eq('muestra_id', muestraId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    handleError(error, `updateAlertaEstado:${muestraId}`);
    throw new Error('Error al actualizar estado de alerta');
  }
}

// Evidencias
export async function uploadEvidencia(file: File, ensayoId: string) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${ensayoId}_${Date.now()}.${fileExt}`;
    const filePath = `evidencias/${fileName}`;
    
    // Upload file to Storage
    const { error: uploadError } = await supabase.storage
      .from('quality')
      .upload(filePath, file);
      
    if (uploadError) throw uploadError;
    
    // Create evidencia record
    const { data, error } = await supabase
      .from('evidencias')
      .insert({
        ensayo_id: ensayoId,
        path: filePath,
        nombre_archivo: file.name,
        tipo_archivo: file.type,
        tamano_kb: Math.round(file.size / 1024)
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as Evidencia;
  } catch (error) {
    handleError(error, `uploadEvidencia:${ensayoId}`);
    throw new Error('Error al subir evidencia');
  }
}

// Dashboard functions
export async function fetchMetricasCalidad(
  fechaDesde?: string | Date, 
  fechaHasta?: string | Date,
  client_id?: string,
  construction_site_id?: string,
  recipe_code?: string
) {
  try {
    // Default to last month if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 1), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    console.log('Fetching quality metrics with date range and filters:', { 
      desde, 
      hasta, 
      client_id, 
      construction_site_id, 
      recipe_code 
    });
    
    // First get the raw data without filters
    const { data: ensayosData, error: ensayosError } = await supabase
      .from('ensayos')
      .select(`
        id,
        fecha_ensayo,
        fecha_ensayo_ts,
        resistencia_calculada,
        porcentaje_cumplimiento,
        muestra:muestra_id (
          id,
          identificacion,
          tipo_muestra,
          fecha_programada_ensayo,
          fecha_programada_ensayo_ts,
          muestreo:muestreo_id (
            id,
            fecha_muestreo,
            fecha_muestreo_ts,
            planta,
            remision:remision_id (
              id,
              order:order_id(
                id,
                client_id,
                construction_site
              ),
              recipe:recipe_id(
                id,
                recipe_code,
                strength_fc,
                age_days,
                age_hours
              )
            )
          )
        )
      `)
      .gte('fecha_ensayo', desde)
      .lte('fecha_ensayo', hasta);
      
    if (ensayosError) {
      console.error('Error fetching ensayos data:', ensayosError);
      throw ensayosError;
    }
    
    console.log(`[DEBUG] Initial ensayos data: ${ensayosData?.length || 0} records found`);

    if (!ensayosData || ensayosData.length === 0) {
      console.warn('No ensayos found in date range');
      return {
        numeroMuestras: 0,
        muestrasEnCumplimiento: 0,
        resistenciaPromedio: 0,
        desviacionEstandar: 0,
        porcentajeResistenciaGarantia: 0,
        eficiencia: 0,
        rendimientoVolumetrico: 0,
        coeficienteVariacion: 0
      } as MetricasCalidad;
    }
    
    // Apply the same filters as in fetchDatosGraficoResistencia
    let filteredData = ensayosData;
    
    // Filter by client_id if provided
    if (client_id) {
      console.log(`[DEBUG] Filtering by client_id: ${client_id}`);
      filteredData = filteredData.filter((item: any) => {
        const muestra = item.muestra;
        if (!muestra) return false;
        
        const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
        if (!muestreo) return false;
        
        const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
        if (!remision) return false;
        
        const order = Array.isArray(remision.order) ? remision.order[0] : remision.order;
        if (!order) return false;
        
        const matches = order.client_id === client_id;
        console.log(`[DEBUG] Item client_id check: order.client_id=${order.client_id}, filter=${client_id}, matches=${matches}`);
        return matches;
      });
      console.log(`[DEBUG] After client filtering: ${filteredData.length} records remain`);
    }
    
    // Filter by construction_site_id if provided
    if (construction_site_id) {
      console.log(`[DEBUG] Filtering by construction_site_id: ${construction_site_id}`);
      // First try to get the construction site name
      let constructionSiteName: string | null = null;
      
      try {
        const { data: siteData } = await supabase
          .from('construction_sites')
          .select('name')
          .eq('id', construction_site_id)
          .single();
          
        if (siteData) {
          constructionSiteName = siteData.name;
          console.log(`[DEBUG] Found construction site name: ${constructionSiteName}`);
        }
      } catch (error) {
        console.error('Error getting construction site name:', error);
      }
      
      // Now filter by the name
      filteredData = filteredData.filter((item: any) => {
        const muestra = item.muestra;
        if (!muestra) return false;
        
        const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
        if (!muestreo) return false;
        
        const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
        if (!remision) return false;
        
        const order = Array.isArray(remision.order) ? remision.order[0] : remision.order;
        if (!order) return false;
        
        // If we have the name, match by name
        if (constructionSiteName) {
          const matches = order.construction_site === constructionSiteName;
          console.log(`[DEBUG] Item construction_site check: order.construction_site=${order.construction_site}, filter=${constructionSiteName}, matches=${matches}`);
          return matches;
        }
        
        // Otherwise, try a direct ID match (less likely to work)
        const matches = order.construction_site === construction_site_id || 
                       order.construction_site_id === construction_site_id;
        console.log(`[DEBUG] Item construction_site ID check: order.construction_site=${order.construction_site}, order.construction_site_id=${order.construction_site_id}, filter=${construction_site_id}, matches=${matches}`);
        return matches;
      });
      console.log(`[DEBUG] After construction site filtering: ${filteredData.length} records remain`);
    }
    
    // Filter by recipe_code if provided
    if (recipe_code) {
      console.log(`[DEBUG] Filtering by recipe_code: ${recipe_code}`);
      filteredData = filteredData.filter((item: any) => {
        const muestra = item.muestra;
        if (!muestra) return false;
        
        const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
        if (!muestreo) return false;
        
        const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
        if (!remision) return false;
        
        const recipe = Array.isArray(remision.recipe) ? remision.recipe[0] : remision.recipe;
        if (!recipe) return false;
        
        const matches = recipe.recipe_code === recipe_code;
        console.log(`[DEBUG] Item recipe check: recipe.recipe_code=${recipe.recipe_code}, filter=${recipe_code}, matches=${matches}`);
        return matches;
      });
      console.log(`[DEBUG] After recipe filtering: ${filteredData.length} records remain`);
    }
    
    console.log(`After filtering: ${filteredData.length} records remain`);
    
    if (filteredData.length === 0) {
      return {
        numeroMuestras: 0,
        muestrasEnCumplimiento: 0,
        resistenciaPromedio: 0,
        desviacionEstandar: 0,
        porcentajeResistenciaGarantia: 0,
        eficiencia: 0,
        rendimientoVolumetrico: 0,
        coeficienteVariacion: 0
      } as MetricasCalidad;
    }
    
    // Calculate metrics manually from the filtered data
    const numeroMuestras = filteredData.length;
    const muestrasEnCumplimiento = filteredData.filter(d => d.porcentaje_cumplimiento >= 100).length;
    
    // Calculate average resistance
    const sumResistencia = filteredData.reduce((sum, d) => sum + (d.resistencia_calculada || 0), 0);
    const resistenciaPromedio = numeroMuestras > 0 ? sumResistencia / numeroMuestras : 0;
    
    // Calculate standard deviation
    const sumSquaredDiff = filteredData.reduce((sum, d) => {
      const diff = (d.resistencia_calculada || 0) - resistenciaPromedio;
      return sum + (diff * diff);
    }, 0);
    const desviacionEstandar = numeroMuestras > 0 ? Math.sqrt(sumSquaredDiff / numeroMuestras) : 0;
    
    // Calculate percentage of resistance guarantee
    const sumPorcentaje = filteredData.reduce((sum, d) => sum + (d.porcentaje_cumplimiento || 0), 0);
    const porcentajeResistenciaGarantia = numeroMuestras > 0 ? sumPorcentaje / numeroMuestras : 0;
    
    // Calculate coefficient of variation
    const coeficienteVariacion = resistenciaPromedio > 0 ? (desviacionEstandar / resistenciaPromedio) * 100 : 0;
    
    const manualMetrics: MetricasCalidad = {
      numeroMuestras,
      muestrasEnCumplimiento,
      resistenciaPromedio,
      desviacionEstandar,
      porcentajeResistenciaGarantia,
      eficiencia: 0, // Can't calculate without more data - will be populated from RPC calls
      rendimientoVolumetrico: 0, // Can't calculate without more data - will be populated from RPC calls
      coeficienteVariacion
    };
    
    console.log('Manually calculated metrics from filtered data:', manualMetrics);
    
    // Log debugging info about efficiency calculation paths
    console.log('Note: eficiencia is initially set to 0 in fetchMetricasCalidad and should be populated through RPC calls in the component');
    
    return manualMetrics;
  } catch (error) {
    handleError(error, 'fetchMetricasCalidad');
    console.error('Full error in fetchMetricasCalidad:', error);
    
    // Return default values on error
    return {
      numeroMuestras: 0,
      muestrasEnCumplimiento: 0,
      resistenciaPromedio: 0,
      desviacionEstandar: 0,
      porcentajeResistenciaGarantia: 0,
      eficiencia: 0,
      rendimientoVolumetrico: 0,
      coeficienteVariacion: 0
    } as MetricasCalidad;
  }
}

export async function debugQueryMetricas(fechaDesde: string, fechaHasta: string) {
  try {
    console.log('DEBUG: Running direct query for metrics with dates:', { fechaDesde, fechaHasta });
    
    // Count total records in key tables to understand the database state
    const countPromises = [
      supabase.from('ensayos').select('*', { count: 'exact' }),
      supabase.from('muestras').select('*', { count: 'exact' }),
      supabase.from('muestreos').select('*', { count: 'exact' })
    ];
    
    const [ensayosTotal, muestrasTotal, muestreosTotal] = await Promise.all(countPromises);
    
    console.log('DEBUG: Total records in tables:', {
      ensayos: ensayosTotal.count || 0,
      ensayosError: ensayosTotal.error,
      muestras: muestrasTotal.count || 0,
      muestrasError: muestrasTotal.error,
      muestreos: muestreosTotal.count || 0,
      muestreosError: muestreosTotal.error
    });
    
    // First check if we can get any ensayos in this date range - using correct Supabase filter syntax
    const { data: ensayosCount, error: countError } = await supabase
      .from('ensayos')
      .select('id', { count: 'exact' })
      .gte('fecha_ensayo', fechaDesde)
      .lte('fecha_ensayo', fechaHasta);
      
    console.log('DEBUG: Ensayos count result for date range:', { 
      count: ensayosCount?.length || 0, 
      countError,
      dateRange: `${fechaDesde} to ${fechaHasta}`
    });
    
    // If we don't have data in the provided range, find what date ranges DO have data
    const { data: earliestDate } = await supabase
      .from('ensayos')
      .select('fecha_ensayo')
      .order('fecha_ensayo', { ascending: true })
      .limit(1);
      
    const { data: latestDate } = await supabase
      .from('ensayos')
      .select('fecha_ensayo')
      .order('fecha_ensayo', { ascending: false })
      .limit(1);
      
    console.log('DEBUG: Available date range in ensayos table:', {
      earliest: earliestDate?.[0]?.fecha_ensayo,
      latest: latestDate?.[0]?.fecha_ensayo
    });
    
    // Try direct SQL via stored procedure to bypass Supabase filter issues
    const { data: debugData, error: debugError } = await supabase
      .rpc('debug_metrics_query', {
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      });
      
    console.log('DEBUG: Simplified metrics query result:', { debugData, debugError });
    
    // Try making the RPC call with various date formats as fallback
    const formats = [
      { format: 'as-is', desde: fechaDesde, hasta: fechaHasta },
      { format: 'with-time', desde: `${fechaDesde}T00:00:00`, hasta: `${fechaHasta}T23:59:59` },
      { format: 'date-obj', desde: new Date(fechaDesde), hasta: new Date(fechaHasta) }
    ];
    
    const results = await Promise.all(formats.map(async (fmt) => {
      try {
        const { data, error } = await supabase
          .rpc('obtener_metricas_calidad', {
            p_fecha_desde: fmt.desde,
            p_fecha_hasta: fmt.hasta
          });
          
        return { format: fmt.format, data, error };
      } catch (e) {
        return { format: fmt.format, error: e };
      }
    }));
    
    console.log('DEBUG: RPC call results with different formats:', results);
    
    // Try alternative query approach for ensayos using range syntax
    try {
      const { data: directData, error: directError } = await supabase
        .from('ensayos')
        .select('*')
        .filter('fecha_ensayo', 'gte', fechaDesde)
        .filter('fecha_ensayo', 'lte', fechaHasta);
        
      console.log('DEBUG: Alternative query approach:', { 
        count: directData?.length || 0,
        error: directError
      });
    } catch (altErr) {
      console.error('DEBUG: Error in alternative query:', altErr);
    }
    
    // If we got data from the debug function, return it as first result
    if (debugData && !debugError) {
      return [{ format: 'debug_function', data: debugData, error: null }, ...results];
    }
    
    return {
      results,
      databaseInfo: {
        totalRecords: {
          ensayos: ensayosTotal.count || 0,
          muestras: muestrasTotal.count || 0,
          muestreos: muestreosTotal.count || 0
        },
        dateRange: {
          earliest: earliestDate?.[0]?.fecha_ensayo,
          latest: latestDate?.[0]?.fecha_ensayo
        }
      }
    };
  } catch (error) {
    console.error('DEBUG: Error in debug query:', error);
    return null;
  }
}

export async function fetchDatosGraficoResistencia(
  fechaDesde?: string | Date, 
  fechaHasta?: string | Date, 
  client_id?: string, 
  construction_site_id?: string, 
  recipe_code?: string, 
  soloEdadGarantia: boolean = false
) {
  try {
    // Ensure dates are formatted correctly
    const formattedFechaDesde = fechaDesde 
      ? (typeof fechaDesde === 'string' 
          ? fechaDesde 
          : format(fechaDesde, 'yyyy-MM-dd'))
      : undefined;

    const formattedFechaHasta = fechaHasta 
      ? (typeof fechaHasta === 'string' 
          ? fechaHasta 
          : format(fechaHasta, 'yyyy-MM-dd'))
      : undefined;

    console.log('🔍 Fetching Resistance Graph Data', {
      fechaDesde: formattedFechaDesde,
      fechaHasta: formattedFechaHasta,
      client_id,
      construction_site_id,
      recipe_code,
      soloEdadGarantia
    });

    let query = supabase
      .from('ensayos')
      .select(`
        id, 
        fecha_ensayo,
        porcentaje_cumplimiento,
        resistencia_calculada,
        muestra:muestra_id (
          id,
          identificacion,
          tipo_muestra,
          fecha_programada_ensayo,
          muestreo:muestreo_id (
            id,
            fecha_muestreo,
            planta,
            remision:remision_id (
              id,
              order:order_id(
                id,
                client_id,
                construction_site
              ),
              recipe:recipe_id(
                id,
                recipe_code,
                strength_fc,
                age_days
              )
            )
          )
        )
      `)
      .order('fecha_ensayo', { ascending: true });

    // Apply date filters if provided
    if (formattedFechaDesde) {
      query = query.gte('fecha_ensayo', formattedFechaDesde);
    }
    if (formattedFechaHasta) {
      query = query.lte('fecha_ensayo', formattedFechaHasta);
    }

    const { data, error } = await query;

    console.log('📊 Raw Ensayos Data', {
      count: data?.length || 0,
      firstRecord: data?.[0],
      error
    });

    if (error) {
      console.error('❌ Error fetching graph data:', error);
      throw error;
    }

    // Filter data based on provided filters
    let filteredData = data || [];

    // Filter by client_id if provided
    if (client_id) {
      filteredData = filteredData.filter((item: any) => {
        const muestra = item.muestra;
        if (!muestra) return false;
        
        const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
        if (!muestreo) return false;
        
        const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
        if (!remision) return false;
        
        const order = Array.isArray(remision.order) ? remision.order[0] : remision.order;
        if (!order) return false;
        
        return order.client_id === client_id;
      });
    }

    // Filter by construction_site_id if provided
    if (construction_site_id) {
      // First try to get the construction site data to know its name
      console.log('⚙️ Filtering by construction site ID:', construction_site_id);
      
      // We need to find the construction site name from its ID
      let constructionSiteName: string | null = null;
      
      try {
        const { data: siteData } = await supabase
          .from('construction_sites')
          .select('name')
          .eq('id', construction_site_id)
          .single();
        
        if (siteData) {
          constructionSiteName = siteData.name;
          console.log('📍 Found construction site name:', constructionSiteName);
        }
      } catch (error) {
        console.error('Error getting construction site name:', error);
      }
      
      filteredData = filteredData.filter((item: any) => {
        const muestra = item.muestra;
        if (!muestra) return false;
        
        const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
        if (!muestreo) return false;
        
        const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
        if (!remision) return false;
        
        const order = Array.isArray(remision.order) ? remision.order[0] : remision.order;
        if (!order) return false;
        
        // If we have the construction site name, compare with order.construction_site
        if (constructionSiteName) {
          return order.construction_site === constructionSiteName;
        }
        
        // Fallback: if we couldn't get the name, try direct comparison with ID
        // (though this likely won't match if order.construction_site is a name)
        return order.construction_site === construction_site_id || 
               order.construction_site_id === construction_site_id;
      });
    }

    // Filter by recipe_code if provided
    if (recipe_code) {
      filteredData = filteredData.filter((item: any) => {
        const muestra = item.muestra;
        if (!muestra) return false;
        
        const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
        if (!muestreo) return false;
        
        const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
        if (!remision) return false;
        
        const recipe = Array.isArray(remision.recipe) ? remision.recipe[0] : remision.recipe;
        if (!recipe) return false;
        
        return recipe.recipe_code === recipe_code;
      });
    }

    // Filter to only show ensayos at edad garantia if requested
    if (soloEdadGarantia) {
      console.log('🔍 Filtering for edad garantia - total records before filter:', filteredData.length);
      
      filteredData = filteredData.filter((item: any) => {
        const muestra = item.muestra;
        if (!muestra) return false;
        
        const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
        if (!muestreo || !muestreo.fecha_muestreo) return false;
        
        const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
        if (!remision) return false;
        
        const recipe = Array.isArray(remision.recipe) ? remision.recipe[0] : remision.recipe;
        if (!recipe) return false;

        // Calculate the guarantee age - prefer age_hours if available, otherwise use age_days
        let edadGarantia: number;
        if (recipe.age_hours && recipe.age_hours > 0) {
          edadGarantia = recipe.age_hours;
        } else if (recipe.age_days && recipe.age_days > 0) {
          edadGarantia = recipe.age_days * 24; // Convert days to hours
        } else {
          edadGarantia = 28 * 24; // Default 28 days in hours
        }

        // Calculate the guarantee age date using hours for precision
        const fechaMuestreo = new Date(muestreo.fecha_muestreo);
        const fechaEdadGarantia = new Date(fechaMuestreo.getTime() + (edadGarantia * 60 * 60 * 1000));

        // Access fecha_programada_ensayo from muestra
        const fechaProgramada = muestra.fecha_programada_ensayo ? new Date(muestra.fecha_programada_ensayo) : null;
        if (!fechaProgramada) return false;
        
        // Calculate difference in hours for more precise comparison
        const diffTime = Math.abs(fechaProgramada.getTime() - fechaEdadGarantia.getTime());
        const diffHours = diffTime / (1000 * 60 * 60);
        
        // Allow ±2 hours tolerance for hour-based ages, ±1 day for day-based
        const tolerance = recipe.age_hours ? 2 : 24;
        const isAtGuaranteeAge = diffHours <= tolerance;
        
        // Debug logging for first few items
        if (filteredData.length <= 5 || Math.random() < 0.1) {
          console.log('🔍 Edad Garantia Check:', {
            recipeCode: recipe.recipe_code,
            ageDays: recipe.age_days,
            ageHours: recipe.age_hours,
            calculatedAgeHours: edadGarantia,
            fechaMuestreo: fechaMuestreo.toISOString(),
            fechaEdadGarantia: fechaEdadGarantia.toISOString(),
            fechaProgramada: fechaProgramada.toISOString(),
            diffHours: diffHours.toFixed(2),
            tolerance,
            isAtGuaranteeAge
          });
        }
        
        return isAtGuaranteeAge;
      });
      
      console.log('🔍 Filtered for edad garantia - records after filter:', filteredData.length);
    }

    console.log('📊 Filtered Ensayos Data', {
      count: filteredData.length
    });

    // Process the chart data with detailed logging
    const processedData = processChartData(filteredData);

    console.log('📈 Processed Chart Data', {
      count: processedData.length,
      firstDataPoint: processedData[0],
      lastDataPoint: processedData[processedData.length - 1]
    });

    return processedData;
  } catch (error) {
    console.error('🚨 Comprehensive Error in fetchDatosGraficoResistencia:', error);
    return [];
  }
}

const processChartData = (data: any[]): DatoGraficoResistencia[] => {
  console.log('🔬 Processing Chart Data', {
    totalInputRecords: data.length
  });

  const validData = data.filter(item => {
    const isValid = item.fecha_ensayo && 
                    item.porcentaje_cumplimiento !== null && 
                    item.porcentaje_cumplimiento !== undefined;
    
    if (!isValid) {
      console.warn('❗ Filtered out invalid data point:', item);
    }
    
    return isValid;
  });

  console.log('✅ Valid Data Points', {
    validCount: validData.length
  });

  const processedData = validData.map(item => {
    try {
      // Try parsing the date in multiple formats
      let timestamp: number;
      
      // Try parsing DD/MM/YYYY format
      if (item.fecha_ensayo.includes('/')) {
        const [day, month, year] = item.fecha_ensayo.split('/').map(Number);
        timestamp = new Date(year, month - 1, day).getTime();
      } 
      // Try parsing YYYY-MM-DD format
      else {
        timestamp = new Date(item.fecha_ensayo).getTime();
      }

      if (isNaN(timestamp)) {
        console.warn('❌ Invalid timestamp for:', item.fecha_ensayo);
        return null;
      }

      const chartDataPoint: DatoGraficoResistencia = {
        x: timestamp,
        y: item.porcentaje_cumplimiento,
        clasificacion: item.muestra?.muestreo?.remision?.recipe?.recipe_code ? 
          (item.muestra.muestreo.remision.recipe.recipe_code.includes('MR') ? 'MR' : 'FC') 
          : 'FC',
        edad: (() => {
          // Get the actual age from the recipe, prefer age_hours if available
          const recipe = item.muestra?.muestreo?.remision?.recipe;
          if (recipe?.age_hours && recipe.age_hours > 0) {
            return Math.round(recipe.age_hours / 24); // Convert hours to days for display
          } else if (recipe?.age_days && recipe.age_days > 0) {
            return recipe.age_days;
          }
          return 28; // Default fallback
        })(),
        fecha_ensayo: item.fecha_ensayo,
        resistencia_calculada: item.resistencia_calculada,
        muestra: item.muestra
      };
      
      return chartDataPoint;
    } catch (parseError) {
      console.warn('❌ Error parsing data point:', parseError, item);
      return null;
    }
  }).filter(Boolean) as DatoGraficoResistencia[];

  console.log('🎉 Final Processed Data', {
    processedCount: processedData.length,
    firstDataPoint: processedData[0],
    lastDataPoint: processedData[processedData.length - 1]
  });

  return processedData;
};

// RPC Helper Functions
export async function calcularResistencia(clasificacion: 'FC' | 'MR', tipoMuestra: 'CILINDRO' | 'VIGA', cargaKg: number) {
  try {
    const { data, error } = await supabase
      .rpc('calcular_resistencia', {
        clasificacion,
        tipo_muestra: tipoMuestra,
        carga_kg: cargaKg
      });
      
    if (error) throw error;
    return data as number;
  } catch (error) {
    handleError(error, 'calcularResistencia');
    return 0;
  }
}

export async function calcularPorcentajeCumplimiento(
  resistenciaCalculada: number, 
  resistenciaDiseno: number,
  edadEnsayo: number,
  edadGarantia: number
) {
  try {
    const { data, error } = await supabase
      .rpc('calcular_porcentaje_cumplimiento', {
        resistencia_calculada: resistenciaCalculada,
        resistencia_diseno: resistenciaDiseno,
        edad_ensayo: edadEnsayo,
        edad_garantia: edadGarantia
      });
      
    if (error) throw error;
    return data as number;
  } catch (error) {
    handleError(error, 'calcularPorcentajeCumplimiento');
    return 0;
  }
}

export async function crearMuestrasPorEdad(
  muestreoId: string,
  clasificacion: 'FC' | 'MR',
  edadGarantia: number,
  cantidad: number
) {
  try {
    // Intenta usar la función RPC primero
    const { error } = await supabase
      .rpc('crear_muestras_por_edad', {
        p_muestreo_id: muestreoId,
        p_clasificacion: clasificacion,
        p_edad_garantia: edadGarantia,
        p_cantidad: cantidad
      });
      
    if (error) {
      console.warn('Falló la función RPC, usando fallback:', error);
      // Si falla la función RPC, implementamos la lógica aquí como fallback
      return await crearMuestrasPorEdadFallback(muestreoId, clasificacion, edadGarantia, cantidad);
    }
    
    return true;
  } catch (error) {
    handleError(error, `crearMuestrasPorEdad:${muestreoId}`);
    // Si falla completamente, intentamos el fallback
    try {
      console.warn('Error en RPC, intentando fallback');
      return await crearMuestrasPorEdadFallback(muestreoId, clasificacion, edadGarantia, cantidad);
    } catch (fallbackError) {
      handleError(fallbackError, `crearMuestrasPorEdadFallback:${muestreoId}`);
      throw new Error('Error al crear muestras automáticas');
    }
  }
}

// Función de respaldo que implementa la misma lógica que la función SQL pero en JavaScript
async function crearMuestrasPorEdadFallback(
  muestreoId: string, 
  clasificacion: 'FC' | 'MR', 
  edadGarantia: number, 
  cantidad: number
) {
  try {
    // Obtener información del muestreo
    const { data: muestreo, error: muestreoError } = await supabase
      .from('muestreos')
      .select('*')
      .eq('id', muestreoId)
      .single();
      
    if (muestreoError) throw muestreoError;
    if (!muestreo) throw new Error('Muestreo no encontrado');
    
    // Determinar edades de ensayo basadas en la edad de garantía
    let edades_ensayo: number[] = [];
    
    if (clasificacion === 'FC') {
      if (edadGarantia <= 3) {
        edades_ensayo = [edadGarantia];
      } else if (edadGarantia <= 7) {
        edades_ensayo = [3, edadGarantia];
      } else if (edadGarantia <= 14) {
        edades_ensayo = [3, 7, edadGarantia];
      } else {
        edades_ensayo = [3, 7, 14, edadGarantia];
      }
    } else if (clasificacion === 'MR') {
      if (edadGarantia <= 3) {
        edades_ensayo = [edadGarantia];
      } else if (edadGarantia <= 7) {
        edades_ensayo = [3, edadGarantia];
      } else {
        edades_ensayo = [3, 7, edadGarantia];
      }
    }
    
    // Crear fecha de muestreo como objeto Date
    const fechaMuestreo = new Date(muestreo.fecha_muestreo);
    
    // Generar contador para identificaciones únicas
    let contador = 1;
    
    // Para cada conjunto de muestras solicitado
    for (let i = 0; i < cantidad; i++) {
      // Para cada edad de ensayo
      for (let j = 0; j < edades_ensayo.length; j++) {
        const edad = edades_ensayo[j];
        
        // Calcular fecha programada de ensayo
        const fechaProgramada = new Date(fechaMuestreo);
        fechaProgramada.setDate(fechaProgramada.getDate() + edad);
        
        // Determinar tipo de muestra basado en clasificación
        const tipoMuestra = clasificacion === 'FC' ? 'CILINDRO' : 'VIGA';
        
        // Crear identificación única para la muestra
        const identificacion = `${clasificacion}-${fechaMuestreo.toISOString().split('T')[0].replace(/-/g, '')}-${String(contador).padStart(3, '0')}`;
        contador++;
        
        // Crear muestra
        const { data: muestra, error: muestraError } = await supabase
          .from('muestras')
          .insert({
            muestreo_id: muestreoId,
            tipo_muestra: tipoMuestra,
            identificacion: identificacion,
            estado: 'PENDIENTE',
            fecha_programada_ensayo: fechaProgramada.toISOString().split('T')[0]
          })
          .select()
          .single();
          
        if (muestraError) throw muestraError;
        
        // Crear alerta para el ensayo
        if (muestra) {
          const { error: alertaError } = await supabase
            .from('alertas_ensayos')
            .insert({
              muestra_id: muestra.id,
              fecha_alerta: fechaProgramada.toISOString().split('T')[0],
              estado: 'PENDIENTE',
              tipo: 'ENSAYO_PROGRAMADO'
            });
            
          if (alertaError) throw alertaError;
        }
      }
    }
    
    return true;
  } catch (error) {
    handleError(error, 'crearMuestrasPorEdadFallback');
    throw error;
  }
}

// Function to add a single sample to an existing muestreo
export async function addSampleToMuestreo(
  muestreoId: string,
  sampleData: {
    tipo_muestra: 'CILINDRO' | 'VIGA' | 'CUBO';
    fecha_programada_ensayo: Date | string;
    diameter_cm?: number;
    cube_side_cm?: number;
    age_days?: number;
    age_hours?: number;
  }
) {
  try {
    // Get muestreo details to generate proper identification
    const { data: muestreo, error: muestreoError } = await supabase
      .from('muestreos')
      .select('*')
      .eq('id', muestreoId)
      .single();
      
    if (muestreoError) throw muestreoError;
    if (!muestreo) throw new Error('Muestreo no encontrado');

    // Get existing samples count to generate proper identification
    const { data: existingSamples, error: samplesError } = await supabase
      .from('muestras')
      .select('identificacion')
      .eq('muestreo_id', muestreoId)
      .order('created_at', { ascending: true });
      
    if (samplesError) throw samplesError;

    // Generate identification based on existing pattern
    const baseDateStr = formatDate(muestreo.fecha_muestreo, 'yyyy-MM-dd');
    const counter = (existingSamples?.length || 0) + 1;
    const idClas = sampleData.tipo_muestra === 'VIGA' ? 'MR' : 'FC';
    const diameterSuffix = sampleData.tipo_muestra === 'CILINDRO' && sampleData.diameter_cm ? `-D${sampleData.diameter_cm}` : '';
    const cubeSuffix = sampleData.tipo_muestra === 'CUBO' && sampleData.cube_side_cm ? `-S${sampleData.cube_side_cm}` : '';
    const identification = `${idClas}-${baseDateStr.replace(/-/g, '')}-${String(counter).padStart(3, '0')}${diameterSuffix}${cubeSuffix}`;

    // Calculate programmed date if age is provided
    let programmedDate = sampleData.fecha_programada_ensayo;
    if (typeof sampleData.age_hours === 'number' && isFinite(sampleData.age_hours)) {
      const baseDate = new Date(muestreo.fecha_muestreo);
      baseDate.setHours(baseDate.getHours() + sampleData.age_hours);
      programmedDate = baseDate;
    } else if (typeof sampleData.age_days === 'number' && isFinite(sampleData.age_days)) {
      const baseDate = new Date(muestreo.fecha_muestreo);
      baseDate.setDate(baseDate.getDate() + sampleData.age_days);
      programmedDate = baseDate;
    }

    const sampleToInsert = {
      id: uuidv4(),
      muestreo_id: muestreoId,
      plant_id: muestreo.plant_id, // Add plant_id from muestreo for RLS policy
      tipo_muestra: sampleData.tipo_muestra,
      identificacion: identification,
      fecha_programada_ensayo: formatDate(programmedDate, 'yyyy-MM-dd'),
      fecha_programada_ensayo_ts: typeof programmedDate === 'string' ? new Date(programmedDate).toISOString() : programmedDate.toISOString(),
      event_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      estado: 'PENDIENTE',
      created_at: new Date().toISOString(),
      diameter_cm: sampleData.tipo_muestra === 'CILINDRO' ? (sampleData.diameter_cm ?? 15) : null,
      cube_side_cm: sampleData.tipo_muestra === 'CUBO' ? (sampleData.cube_side_cm ?? 15) : null,
    };

    // Insert the sample
    const { data: insertedSample, error: insertError } = await supabase
      .from('muestras')
      .insert(sampleToInsert)
      .select('id')
      .single();
      
    if (insertError) throw insertError;

    // Create alert for the test
    if (insertedSample) {
      const testDate = typeof programmedDate === 'string' ? new Date(programmedDate) : programmedDate;
      const alertDate = new Date(testDate.getTime() - 24 * 3600 * 1000); // 24 hours before
      
      const { error: alertError } = await supabase
        .from('alertas_ensayos')
        .insert({
          muestra_id: insertedSample.id,
          fecha_alerta: formatDate(alertDate, 'yyyy-MM-dd'),
          fecha_alerta_ts: alertDate.toISOString(),
          event_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          estado: 'PENDIENTE',
          tipo: 'ENSAYO_PROGRAMADO'
        });
        
      if (alertError) {
        console.warn('Error creating alert:', alertError);
        // Don't throw here, sample creation was successful
      }
    }

    return insertedSample;
  } catch (error) {
    handleError(error, `addSampleToMuestreo:${muestreoId}`);
    throw new Error('Error al agregar muestra al muestreo');
  }
}

// Reports functions
export async function fetchResistenciaReporteData(fechaDesde?: string | Date, fechaHasta?: string | Date, planta?: string, clasificacion?: string) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    let query = supabase
      .from('ensayos')
      .select(`
        id,
        fecha_ensayo,
        carga_kg,
        resistencia_calculada,
        porcentaje_cumplimiento,
        observaciones,
        muestra:muestra_id (
          id,
          tipo_muestra,
          identificacion,
          fecha_programada_ensayo,
          muestreo:muestreo_id (
            id,
            planta,
            fecha_muestreo,
            remision:remision_id (
              id,
              recipe:recipe_id (
                id,
                recipe_code,
                strength_fc,
                age_days,
                recipe_versions (
                  id,
                  notes,
                  is_current
                )
              )
            )
          )
        )
      `)
      .filter('fecha_ensayo', 'gte', desde)
      .filter('fecha_ensayo', 'lte', hasta)
      .order('fecha_ensayo', { ascending: false });
      
    // Apply plant filter if provided
    if (planta && planta !== 'all') {
      query = query.filter('muestra.muestreo.planta', 'eq', planta);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // If no data, return empty array
    if (!data || data.length === 0) {
      return [];
    }
    
    // Format data for report
    console.log('DEBUG: Starting resistance report data processing');
    console.log(`DEBUG: Found ${data.length} total resistance test records`);

    // Create a type-safe accumulator
    interface GroupedMuestreo {
      [key: string]: {
        muestreo: any;
        ensayos: any[];
        debug?: any;
      }
    }

    const groupedByMuestreo: GroupedMuestreo = data.reduce((acc: GroupedMuestreo, ensayo) => {
      // Type assertion for complex nested structure
      const muestra = ensayo.muestra as any;
      const muestreoId = muestra?.muestreo?.id;
      
      if (!muestreoId) return acc;
      
      if (!acc[muestreoId]) {
        acc[muestreoId] = {
          muestreo: muestra?.muestreo,
          ensayos: [],
          debug: {
            muestreoId,
            muestreoDate: muestra?.muestreo?.fecha_muestreo,
            recipeId: muestra?.muestreo?.remision?.recipe?.id,
            ageGuarantee: muestra?.muestreo?.remision?.recipe?.age_days
          }
        };
      }
      
      acc[muestreoId].ensayos.push({
        id: ensayo.id,
        fecha_ensayo: ensayo.fecha_ensayo,
        muestra_id: muestra?.id,
        fecha_programada_ensayo: muestra?.fecha_programada_ensayo,
        resistencia_calculada: ensayo.resistencia_calculada,
        porcentaje_cumplimiento: ensayo.porcentaje_cumplimiento,
        carga_kg: ensayo.carga_kg,
        identificacion: muestra?.identificacion
      });
      
      return acc;
    }, {});
    
    console.log(`DEBUG: Grouped into ${Object.keys(groupedByMuestreo).length} muestreos`);
    
    // Process each muestreo to filter for correct tests at guarantee age
    const reportData = Object.values(groupedByMuestreo)
      .map((group: any) => {
        const muestreo = group.muestreo;
        if (!muestreo) {
          console.log('DEBUG: Skipping group - No muestreo data');
          return null;
        }
        
        // Get recipe data
        const recipe = muestreo?.remision?.recipe;
        if (!recipe) {
          console.log(`DEBUG: Skipping muestreo ${muestreo.id} - No recipe data`);
          return null;
        }
        
        // Get classification
        const recipeVersions = recipe?.recipe_versions || [];
        const currentVersion = recipeVersions.find((v: any) => v.is_current === true);
        const clasificacionReceta = currentVersion?.notes?.includes('MR') ? 'MR' : 'FC';
        
        // Only include if classification matches filter (if provided)
        if (clasificacion && clasificacion !== 'all' && clasificacionReceta !== clasificacion) {
          console.log(`DEBUG: Skipping muestreo ${muestreo.id} - Classification doesn't match filter (${clasificacionReceta} vs ${clasificacion})`);
          return null;
        }
        
        // Get guarantee age
        const edadGarantia = recipe.age_days || 28;
        
        // Calculate guarantee date
        const fechaMuestreo = new Date(muestreo.fecha_muestreo);
        const fechaEdadGarantia = new Date(fechaMuestreo);
        fechaEdadGarantia.setDate(fechaMuestreo.getDate() + edadGarantia);
        const fechaEdadGarantiaStr = fechaEdadGarantia.toISOString().split('T')[0];
        
        console.log(`DEBUG: Muestreo ${muestreo.id} - Looking for tests on guarantee date ${fechaEdadGarantiaStr} (${edadGarantia} days)`);
        
        // Log all sample dates to help debug
        console.log('DEBUG: Available muestra scheduled dates:');
        group.ensayos.forEach((ensayo: any) => {
          console.log(`  - Ensayo ${ensayo.id}: programada=${ensayo.fecha_programada_ensayo}, real=${ensayo.fecha_ensayo}`);
        });
        
        // Find tests at guarantee age with 1-day tolerance
        const ensayosEdadGarantia = group.ensayos.filter((ensayo: any) => {
          // Check if the date is the exact guarantee date or ±1 day
          const fecha = ensayo.fecha_programada_ensayo ? new Date(ensayo.fecha_programada_ensayo) : null;
          if (!fecha) return false;
          
          const fechaGarantia = new Date(fechaEdadGarantiaStr);
          
          // Calculate difference in days
          const diffTime = Math.abs(fecha.getTime() - fechaGarantia.getTime());
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          
          const matches = diffDays <= 1; // Allow ±1 day tolerance
          
          console.log(`DEBUG: Checking ensayo ${ensayo.id} - fecha_programada=${ensayo.fecha_programada_ensayo}, garantia=${fechaEdadGarantiaStr}, diff=${diffDays} days, match=${matches}`);
          
          return matches;
        });
        
        console.log(`DEBUG: Found ${ensayosEdadGarantia.length} tests at guarantee age for muestreo ${muestreo.id}`);
        
        if (ensayosEdadGarantia.length === 0) {
          console.log(`DEBUG: No tests found at guarantee age for muestreo ${muestreo.id}`);
          
          // DEBUG - Include all tests with debug info
          return group.ensayos.map((ensayo: any) => ({
            id: ensayo.id,
            fechaEnsayo: format(new Date(ensayo.fecha_ensayo), 'dd/MM/yyyy'),
            muestra: ensayo.identificacion || '',
            clasificacion: clasificacionReceta,
            edadDias: edadGarantia,
            edadGarantia: edadGarantia,
            cargaKg: ensayo.carga_kg,
            resistencia: ensayo.resistencia_calculada,
            cumplimiento: ensayo.porcentaje_cumplimiento,
            planta: muestreo.planta || '',
            muestreoId: muestreo.id || '',
            muestreoFecha: format(new Date(muestreo.fecha_muestreo), 'dd/MM/yyyy'),
            muestraCodigo: ensayo.identificacion || '',
            _debug: {
              fecha_programada: ensayo.fecha_programada_ensayo,
              fecha_garantia_calculada: fechaEdadGarantiaStr,
              matches: ensayo.fecha_programada_ensayo === fechaEdadGarantiaStr,
              edad_garantia: edadGarantia,
              fecha_muestreo: muestreo.fecha_muestreo
            }
          }));
        }
        
        // Return data for each test at guarantee age
        return ensayosEdadGarantia.map((ensayo: any) => ({
          id: ensayo.id,
          fechaEnsayo: format(new Date(ensayo.fecha_ensayo), 'dd/MM/yyyy'),
          muestra: ensayo.identificacion || '',
          clasificacion: clasificacionReceta,
          edadDias: edadGarantia,
          edadGarantia: edadGarantia,
          cargaKg: ensayo.carga_kg,
          resistencia: ensayo.resistencia_calculada,
          cumplimiento: ensayo.porcentaje_cumplimiento,
          planta: muestreo.planta || '',
          muestreoId: muestreo.id || '',
          muestreoFecha: format(new Date(muestreo.fecha_muestreo), 'dd/MM/yyyy'),
          muestraCodigo: ensayo.identificacion || ''
        }));
      })
      .filter(Boolean) // Remove null entries
      .flat(); // Flatten the array of arrays
    
    console.log(`DEBUG: Final report data has ${reportData.length} entries`);
    return reportData;
  } catch (error) {
    handleError(error, 'fetchResistenciaReporteData');
    return [];
  }
}

export async function fetchEficienciaReporteData(fechaDesde?: string | Date, fechaHasta?: string | Date, planta?: string) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    // Get muestreos in the date range
    let query = supabase
      .from('muestreos')
      .select(`
        id,
        fecha_muestreo,
        planta,
        masa_unitaria,
        remision_id
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta);
      
    // Apply plant filter if provided
    if (planta && planta !== 'all') {
      query = query.eq('planta', planta);
    }
    
    const { data: muestreosData, error: muestreosError } = await query;
    
    if (muestreosError) throw muestreosError;
    
    // If no data, return empty array
    if (!muestreosData || muestreosData.length === 0) {
      return [];
    }
    
    // Get remisiones data
    const remisionIds = muestreosData.map(m => m.remision_id).filter(Boolean);
    
    // Log for debugging
    console.log('Remision IDs to fetch:', remisionIds);
    
    // Define types for our data
    interface RemisionData {
      id: string;
      recipe_id: string;
      volumen_fabricado: number;
      planta?: string;
      planta_nombre?: string;
    }
    
    interface RecipeVersionData {
      recipe_id: string;
      recipe_code: string;
      notes: string;
      age_days: number;
    }
    
    interface MaterialData {
      remision_id: string;
      material_type: string;
      cantidad_real: number;
    }
    
    // Fetch all related data in parallel
    let remisionesData: RemisionData[] = [];
    let materialesData: MaterialData[] = [];
    let recipeVersionsData: RecipeVersionData[] = [];
    
    // Handle each query separately to isolate errors
    try {
      // Fetch remisiones
      const { data, error } = await supabase
        .from('remisiones')
        .select('id, recipe_id, volumen_fabricado')
        .eq('id', remisionIds.length > 0 ? remisionIds[0] : ''); // Start with just one ID for debugging
        
      if (error) throw error;
      remisionesData = data || [];
      
      // Try fetching all remisiones if first one succeeded
      if (remisionIds.length > 1) {
        const promises = remisionIds.slice(1).map(id => 
          supabase
            .from('remisiones')
            .select('id, recipe_id, volumen_fabricado')
            .eq('id', id)
            .then(({ data }) => data && data.length > 0 ? data[0] as RemisionData : null)
        );
        
        const results = await Promise.all(promises);
        const validResults = results.filter((item): item is RemisionData => item !== null);
        remisionesData = [...remisionesData, ...validResults];
      }
    } catch (error) {
      console.error('Error fetching remisiones:', error);
    }
    
    try {
      // Fetch materiales in chunks to avoid URL length limits
      const chunkSize = 75;
      const materialesResults: any[] = [];
      for (let i = 0; i < remisionIds.length; i += chunkSize) {
        const chunk = remisionIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('remision_materiales')
          .select('remision_id, material_type, cantidad_real')
          .in('remision_id', chunk);
        if (error) {
          console.error('Error fetching remision_materiales chunk:', error);
          continue;
        }
        if (data) materialesResults.push(...data);
      }
      materialesData = materialesResults;
    } catch (error) {
      console.error('Error fetching materiales:', error);
    }
    
    try {
      // Fetch recipe data - we need to query both tables
      const recipeIds = remisionesData
        .map(r => r.recipe_id)
        .filter(Boolean);
        
      if (recipeIds.length > 0) {
        // First get the recipe_code and age_days from recipes table
        const { data: recipesData, error: recipesError } = await supabase
          .from('recipes')
          .select('id, recipe_code, age_days')
          .in('id', recipeIds);
          
        if (recipesError) throw recipesError;
        
        // Then get the notes from recipe_versions table
        const { data: versionsData, error: versionsError } = await supabase
          .from('recipe_versions')
          .select('recipe_id, notes')
          .in('recipe_id', recipeIds);
          
        if (versionsError) throw versionsError;
        
        // Combine the data
        recipeVersionsData = recipesData ? recipesData.map(recipe => {
          // Find matching version notes if available
          const versionData = versionsData?.find(v => v.recipe_id === recipe.id);
          
          return {
            recipe_id: recipe.id,
            recipe_code: recipe.recipe_code || '',
            notes: versionData?.notes || '',
            age_days: recipe.age_days || 28
          };
        }) : [];
      }
    } catch (error) {
      console.error('Error fetching recipe data:', error);
    }

    // Create type-safe lookup maps
    const remisionesMap = new Map<string, RemisionData>();
    const recipeVersionsMap = new Map<string, RecipeVersionData>();
    const materialesMap = new Map<string, MaterialData[]>();
    
    // Create a mapping between remision_id and planta from muestreos
    const muestreoPlantaMap = new Map<string, string>();
    muestreosData.forEach(muestreo => {
      if (muestreo.remision_id) {
        muestreoPlantaMap.set(muestreo.remision_id, muestreo.planta);
      }
    });

    // Populate maps
    remisionesData.forEach((remision: any) => {
      const plantaFromMuestreo = muestreoPlantaMap.get(remision.id) || '';
      remisionesMap.set(remision.id, {
        id: remision.id,
        recipe_id: remision.recipe_id,
        volumen_fabricado: remision.volumen_fabricado,
        planta: plantaFromMuestreo,
        planta_nombre: `Planta ${plantaFromMuestreo}` // Use planta from muestreo instead
      });
    });

    recipeVersionsData.forEach((version: any) => {
      recipeVersionsMap.set(version.recipe_id, {
        recipe_id: version.recipe_id,
        recipe_code: version.recipe_code,
        notes: version.notes,
        age_days: version.age_days
      });
    });

    materialesData.forEach((material: any) => {
      if (!materialesMap.has(material.remision_id)) {
        materialesMap.set(material.remision_id, []);
      }
      const materialesArray = materialesMap.get(material.remision_id);
      if (materialesArray) {
        materialesArray.push({
          remision_id: material.remision_id,
          material_type: material.material_type,
          cantidad_real: material.cantidad_real
        });
      }
    });

    // Get metrics for each muestreo using RPC and client-side data
    const eficienciaPromises = muestreosData.map(async (muestreo) => {
      try {
        // Get server metrics using RPC
        const { data: metricasRPC, error: metricasError } = await supabase
          .rpc('calcular_metricas_muestreo', {
            p_muestreo_id: muestreo.id
          });
        
        if (metricasError || !metricasRPC || metricasRPC.length === 0) return null;
        
        // Calculate client metrics
        let clasificacion = 'FC';
        const masaUnitaria = muestreo.masa_unitaria || 0;
        let sumaMateriales = 0;
        let kgCemento = 0;
        let volumenRegistrado = 0;
        let edadGarantia = 28;
        let resistenciaPromedio = 0;
        
        // Get additional data if available
        const remision = remisionesMap.get(muestreo.remision_id);
        if (remision) {
          volumenRegistrado = remision.volumen_fabricado || 0;
          
          // Get recipe version
          const recipeVersion = recipeVersionsMap.get(remision.recipe_id);
          if (recipeVersion) {
            clasificacion = recipeVersion.notes && recipeVersion.notes.toUpperCase().includes('MR') ? 'MR' : 'FC';
            edadGarantia = recipeVersion.age_days || 28;
          }
          
          // Calculate suma materiales and kg cemento
          const materiales = materialesMap.get(remision.id) || [];
          if (materiales.length > 0) {
            sumaMateriales = materiales.reduce((sum: number, mat: MaterialData) => sum + (mat.cantidad_real || 0), 0);
            const cementoMaterial = materiales.find((m: MaterialData) => m.material_type === 'cement');
            kgCemento = cementoMaterial ? cementoMaterial.cantidad_real || 0 : 0;
          }
        }
        
        // Get average resistance for this muestreo
        const { data: resistenciaData, error: resistenciaError } = await supabase
          .from('ensayos')
          .select(`
            resistencia_calculada,
            muestra:muestra_id (
              muestreo_id
            )
          `)
          .eq('muestra.muestreo_id', muestreo.id);
          
        if (!resistenciaError && resistenciaData && resistenciaData.length > 0) {
          resistenciaPromedio = resistenciaData.reduce((sum: number, item: any) => sum + (item.resistencia_calculada || 0), 0) / resistenciaData.length;
        }
        
        return {
          id: muestreo.id,
          fecha: format(new Date(muestreo.fecha_muestreo), 'dd/MM/yyyy'),
          planta: muestreo.planta,
          receta: remision && recipeVersionsMap.get(remision.recipe_id)?.recipe_code || 
                  (remision ? `${remision.recipe_id}` : 'N/A'),
          clasificacion,
          // Client-calculated fields
          masa_unitaria: masaUnitaria,
          suma_materiales: sumaMateriales,
          kg_cemento: kgCemento,
          volumen_registrado: volumenRegistrado,
          // Server-calculated fields from RPC
          volumen_real: metricasRPC[0].volumen_real,
          rendimiento_volumetrico: metricasRPC[0].rendimiento_volumetrico,
          consumo_cemento: metricasRPC[0].consumo_cemento_real,
          resistencia_promedio: resistenciaPromedio,
          eficiencia: metricasRPC[0].eficiencia || 0
        };
      } catch (err) {
        console.error('Error calculando métricas para muestreo:', muestreo.id, err);
        return null;
      }
    });
    
    // Filter out null values from failed calculations
    const eficienciaData = (await Promise.all(eficienciaPromises)).filter(Boolean);
    return eficienciaData;
  } catch (error) {
    handleError(error, 'fetchEficienciaReporteData');
    return [];
  }
}

export async function fetchDistribucionResistenciaData(
  fechaDesde?: string | Date, 
  fechaHasta?: string | Date, 
  clasificacion?: string,
  clientId?: string,
  constructionSiteId?: string,
  recipeCode?: string
) {
  try {
    // Fetch resistance data with all filters
    const resistenciaData = await fetchResistenciaReporteDataFixed(
      fechaDesde, 
      fechaHasta, 
      undefined, 
      clasificacion,
      clientId,
      constructionSiteId,
      recipeCode
    );
    
    // Group by resistance ranges
    const distribucion = [
      { rango: '<70%', cantidad: 0, color: '#F87171' },
      { rango: '70-80%', cantidad: 0, color: '#FB923C' },
      { rango: '80-90%', cantidad: 0, color: '#FBBF24' },
      { rango: '90-100%', cantidad: 0, color: '#A3E635' },
      { rango: '100-110%', cantidad: 0, color: '#4ADE80' },
      { rango: '110-120%', cantidad: 0, color: '#34D399' },
      { rango: '>120%', cantidad: 0, color: '#2DD4BF' }
    ];
    
    // Count occurrences in each range
    resistenciaData.forEach(dato => {
      if (!dato) return; // Skip null values
      
      const cumplimiento = dato.cumplimiento;
      
      if (cumplimiento < 70) {
        distribucion[0].cantidad++;
      } else if (cumplimiento < 80) {
        distribucion[1].cantidad++;
      } else if (cumplimiento < 90) {
        distribucion[2].cantidad++;
      } else if (cumplimiento < 100) {
        distribucion[3].cantidad++;
      } else if (cumplimiento < 110) {
        distribucion[4].cantidad++;
      } else if (cumplimiento < 120) {
        distribucion[5].cantidad++;
      } else {
        distribucion[6].cantidad++;
      }
    });
    
    return distribucion;
  } catch (error) {
    handleError(error, 'fetchDistribucionResistenciaData');
    return [];
  }
}

export async function fetchTendenciaResistenciaData(fechaDesde?: string | Date, fechaHasta?: string | Date, clasificacion?: string) {
  try {
    // Get resistance data
    const resistenciaData = await fetchResistenciaReporteData(fechaDesde, fechaHasta, undefined, clasificacion);
    
    // Group by date (month)
    const dataByMonth: Record<string, { resistenciaSum: number; count: number }> = {};
    
    resistenciaData.forEach(dato => {
      if (!dato) return; // Skip null values
      
      // Extract month/year from date
      const date = new Date(dato.fechaEnsayo.split('/').reverse().join('-'));
      const monthYear = format(date, 'MM/yyyy');
      
      if (!dataByMonth[monthYear]) {
        dataByMonth[monthYear] = { resistenciaSum: 0, count: 0 };
      }
      
      dataByMonth[monthYear].resistenciaSum += dato.cumplimiento;
      dataByMonth[monthYear].count++;
    });
    
    // Calculate averages and format for chart
    const categories = Object.keys(dataByMonth).sort((a, b) => {
      const [monthA, yearA] = a.split('/').map(Number);
      const [monthB, yearB] = b.split('/').map(Number);
      
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });
    
    const series = categories.map(month => {
      const avg = dataByMonth[month].resistenciaSum / dataByMonth[month].count;
      return parseFloat(avg.toFixed(2));
    });
    
    return { categories, series };
  } catch (error) {
    handleError(error, 'fetchTendenciaResistenciaData');
    return { categories: [], series: [] };
  }
}



export async function checkDatabaseContent() {
  try {
    console.log('Checking database contents...');
    
    // Check ensayos table
    const { data: ensayosData, error: ensayosError } = await supabase
      .from('ensayos')
      .select('id, fecha_ensayo', { count: 'exact' })
      .order('fecha_ensayo', { ascending: false })
      .limit(5);
      
    console.log('Ensayos check:', { 
      count: ensayosData?.length || 0, 
      error: ensayosError,
      samples: ensayosData 
    });
    
    // Check muestras table
    const { data: muestrasData, error: muestrasError } = await supabase
      .from('muestras')
      .select('id, fecha_programada_ensayo', { count: 'exact' })
      .order('fecha_programada_ensayo', { ascending: false })
      .limit(5);
      
    console.log('Muestras check:', { 
      count: muestrasData?.length || 0, 
      error: muestrasError,
      samples: muestrasData 
    });
    
    // Check muestreos table
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select('id, fecha_muestreo', { count: 'exact' })
      .order('fecha_muestreo', { ascending: false })
      .limit(5);
      
    console.log('Muestreos check:', { 
      count: muestreosData?.length || 0, 
      error: muestreosError,
      samples: muestreosData 
    });
    
    // Find date range of data
    const { data: dateRange, error: dateRangeError } = await supabase
      .from('ensayos')
      .select('fecha_ensayo')
      .order('fecha_ensayo', { ascending: true })
      .limit(1);
      
    const { data: dateRangeEnd, error: dateRangeEndError } = await supabase
      .from('ensayos')
      .select('fecha_ensayo')
      .order('fecha_ensayo', { ascending: false })
      .limit(1);
      
    console.log('Date range:', {
      earliest: dateRange?.[0]?.fecha_ensayo,
      latest: dateRangeEnd?.[0]?.fecha_ensayo,
      errorStart: dateRangeError,
      errorEnd: dateRangeEndError
    });
    
    return {
      ensayos: ensayosData || [],
      muestras: muestrasData || [],
      muestreos: muestreosData || [],
      dateRange: {
        earliest: dateRange?.[0]?.fecha_ensayo,
        latest: dateRangeEnd?.[0]?.fecha_ensayo
      }
    };
  } catch (error) {
    console.error('Error checking database:', error);
    return { error: 'Error checking database content' };
  }
}

export async function directTableAccess(fechaDesde: string, fechaHasta: string) {
  try {
    console.log('Performing direct table access with date range:', { fechaDesde, fechaHasta });
    
    // 1. Try a very simple query to ensure basic connectivity
    console.log('Step 1: Testing basic connectivity...');
    const { data: testConnection, error: testError } = await supabase
      .from('ensayos')
      .select('id')
      .limit(1);
    
    console.log('Basic connectivity test:', {
      success: !testError,
      error: testError,
      gotData: !!testConnection?.length
    });
    
    // 2. Find total record counts in each table
    console.log('Step 2: Checking total record counts...');
    const tablesInfo = await Promise.all([
      supabase.from('ensayos').select('id', { count: 'exact' }),
      supabase.from('muestras').select('id', { count: 'exact' }),
      supabase.from('muestreos').select('id', { count: 'exact' })
    ]);
    
    console.log('Total record counts:', {
      ensayos: tablesInfo[0].count,
      muestras: tablesInfo[1].count,
      muestreos: tablesInfo[2].count
    });
    
    // 3. Try to get actual records from 2025 with simple query
    console.log('Step 3: Checking for 2025 data with direct queries...');
    
    const { data: ensayos2025, error: ensayos2025Error } = await supabase
      .from('ensayos')
      .select('id, fecha_ensayo')
      .ilike('fecha_ensayo', '2025%')
      .limit(10);
    
    console.log('Ensayos with 2025 dates:', {
      found: ensayos2025?.length || 0,
      error: ensayos2025Error,
      samples: ensayos2025
    });
    
    // 4. Directly check the exact date range the user is requesting
    console.log('Step 4: Checking data for exact date range...');
    
    const { data: dateRangeData, error: dateRangeError } = await supabase
      .from('ensayos')
      .select('id, fecha_ensayo')
      .gte('fecha_ensayo', fechaDesde)
      .lte('fecha_ensayo', fechaHasta)
      .limit(20);
    
    console.log('Ensayos in exact date range:', {
      dateRange: `${fechaDesde} to ${fechaHasta}`,
      found: dateRangeData?.length || 0,
      error: dateRangeError,
      samples: dateRangeData
    });
    
    // 5. Try with string comparison instead of date comparison
    console.log('Step 5: Testing with string comparison...');
    
    const { data: stringCompData, error: stringCompError } = await supabase
      .rpc('custom_date_search', {
        start_date: fechaDesde,
        end_date: fechaHasta
      });
    
    console.log('String comparison search:', {
      found: stringCompData?.length || 0,
      error: stringCompError
    });
    
    // Return all the diagnostic information
    return {
      basicConnectivity: {
        success: !testError,
        error: testError?.message
      },
      totalRecords: {
        ensayos: tablesInfo[0].count,
        muestras: tablesInfo[1].count,
        muestreos: tablesInfo[2].count
      },
      dateSpecificData: {
        ensayos2025: {
          found: ensayos2025?.length || 0,
          samples: ensayos2025
        },
        dateRangeQuery: {
          found: dateRangeData?.length || 0,
          dateRange: `${fechaDesde} to ${fechaHasta}`,
          samples: dateRangeData
        }
      }
    };
  } catch (error) {
    console.error('Error in directTableAccess:', error);
    return { error: 'Error accessing database directly' };
  }
}

export async function fetchMetricasCalidadSimple(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    // Format dates
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 1), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    console.log('Fetching simplified quality metrics with date range:', { desde, hasta });
    
    // Get all relevant ensayos in the date range
    const { data: ensayosData, error: ensayosError } = await supabase
      .from('ensayos')
      .select(`
        id,
        fecha_ensayo,
        resistencia_calculada,
        porcentaje_cumplimiento,
        muestra_id
      `)
      .gte('fecha_ensayo', desde)
      .lte('fecha_ensayo', hasta);
      
    console.log('Simple metrics query result:', { 
      count: ensayosData?.length || 0, 
      error: ensayosError 
    });
    
    if (ensayosError) {
      console.error('Error fetching ensayos data:', ensayosError);
      throw ensayosError;
    }
    
    // If no data, return zeros
    if (!ensayosData || ensayosData.length === 0) {
      console.warn('No ensayos found in date range');
      return {
        numeroMuestras: 0,
        muestrasEnCumplimiento: 0,
        resistenciaPromedio: 0,
        desviacionEstandar: 0,
        porcentajeResistenciaGarantia: 0,
        eficiencia: 0,
        rendimientoVolumetrico: 0,
        coeficienteVariacion: 0
      };
    }
    
    // Calculate metrics manually
    const numeroMuestras = ensayosData.length;
    const muestrasEnCumplimiento = ensayosData.filter(e => e.porcentaje_cumplimiento >= 100).length;
    
    // Calculate average resistance
    const sumResistencia = ensayosData.reduce((sum, e) => sum + (e.resistencia_calculada || 0), 0);
    const resistenciaPromedio = numeroMuestras > 0 ? sumResistencia / numeroMuestras : 0;
    
    // Calculate standard deviation
    const sumSquaredDiff = ensayosData.reduce((sum, e) => {
      const diff = (e.resistencia_calculada || 0) - resistenciaPromedio;
      return sum + (diff * diff);
    }, 0);
    const desviacionEstandar = numeroMuestras > 0 ? Math.sqrt(sumSquaredDiff / numeroMuestras) : 0;
    
    // Calculate percentage of resistance guarantee
    const sumPorcentaje = ensayosData.reduce((sum, e) => sum + (e.porcentaje_cumplimiento || 0), 0);
    const porcentajeResistenciaGarantia = numeroMuestras > 0 ? sumPorcentaje / numeroMuestras : 0;
    
    // Calculate coefficient of variation
    const coeficienteVariacion = resistenciaPromedio > 0 ? (desviacionEstandar / resistenciaPromedio) * 100 : 0;
    
    const metricas = {
      numeroMuestras,
      muestrasEnCumplimiento,
      resistenciaPromedio,
      desviacionEstandar,
      porcentajeResistenciaGarantia,
      eficiencia: 0, // We can't calculate this without more data
      rendimientoVolumetrico: 0, // We can't calculate this without more data
      coeficienteVariacion
    };
    
    console.log('Calculated simple metrics:', metricas);
    return metricas;
  } catch (error) {
    console.error('Error in simplified metrics calculation:', error);
    // Return default values on error
    return {
      numeroMuestras: 0,
      muestrasEnCumplimiento: 0,
      resistenciaPromedio: 0,
      desviacionEstandar: 0,
      porcentajeResistenciaGarantia: 0,
      eficiencia: 0,
      rendimientoVolumetrico: 0,
      coeficienteVariacion: 0
    };
  }
} 

// Debug function to analyze relationships between muestreos and muestras
export async function debugMuestreosMuestras(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    console.log(`Fetching muestreos from ${desde} to ${hasta}`);
    
    // First, get all muestreos in date range
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select(`
        id,
        fecha_muestreo,
        planta,
        remision_id,
        remision:remision_id (
          recipe:recipe_id (
            id,
            recipe_code,
            age_days
          )
        )
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta)
      .order('fecha_muestreo', { ascending: false });
    
    if (muestreosError) {
      console.error('Error fetching muestreos:', muestreosError);
      return { error: muestreosError.message, results: [] };
    }
    
    if (!muestreosData || muestreosData.length === 0) {
      console.log('No muestreos found in date range');
      return { 
        total_muestreos: 0, 
        total_muestras_ensayado: 0, 
        results: [] 
      };
    }
    
    console.log(`Found ${muestreosData.length} muestreos`);
    
    // Now fetch all related muestras with ensayos
    const muestreoIds = muestreosData.map(m => m.id);
    
    // First get muestras without ensayos to avoid relationship error
    const { data: muestrasData, error: muestrasError } = await supabase
      .from('muestras')
      .select(`
        id,
        muestreo_id,
        identificacion,
        tipo_muestra,
        estado,
        fecha_programada_ensayo,
        created_at
      `)
      .in('muestreo_id', muestreoIds)
      .eq('estado', 'ENSAYADO');
    
    if (muestrasError) {
      console.error('Error fetching muestras:', muestrasError);
      return { error: muestrasError.message, results: [] };
    }
    
    if (!muestrasData || muestrasData.length === 0) {
      console.log('No ensayado muestras found');
      return { 
        total_muestreos: muestreosData.length, 
        total_muestras_ensayado: 0, 
        results: [] 
      };
    }
    
    console.log(`Found ${muestrasData.length} ensayado muestras`);
    
    // Now fetch ensayos separately
    const muestraIds = muestrasData.map(m => m.id);
    const { data: ensayosData, error: ensayosError } = await supabase
      .from('ensayos')
      .select(`
        id,
        muestra_id,
        fecha_ensayo,
        resistencia_calculada,
        porcentaje_cumplimiento
      `)
      .in('muestra_id', muestraIds);
    
    if (ensayosError) {
      console.error('Error fetching ensayos:', ensayosError);
      // Continue with muestras even if ensayos have errors
    }
    
    // Group ensayos by muestra_id
    const ensayosByMuestraId: Record<string, any[]> = {};
    if (ensayosData) {
      ensayosData.forEach(ensayo => {
        if (!ensayosByMuestraId[ensayo.muestra_id]) {
          ensayosByMuestraId[ensayo.muestra_id] = [];
        }
        ensayosByMuestraId[ensayo.muestra_id].push(ensayo);
      });
    }
    
    // Add ensayos to muestras
    const muestrasWithEnsayos = muestrasData.map(muestra => ({
      ...muestra,
      ensayos: ensayosByMuestraId[muestra.id] || []
    }));
    
    // Group muestras by muestreo
    const muestreoMuestrasMap: Record<string, any[]> = {};
    muestrasWithEnsayos.forEach(muestra => {
      if (!muestreoMuestrasMap[muestra.muestreo_id]) {
        muestreoMuestrasMap[muestra.muestreo_id] = [];
      }
      muestreoMuestrasMap[muestra.muestreo_id].push(muestra);
    });
    
    // Combine and analyze data
    const results = muestreosData.map((muestreo: any) => {
      const muestras = muestreoMuestrasMap[muestreo.id] || [];
      // Type assertion for nested objects to fix TypeScript errors
      const recipeData = muestreo.remision?.recipe as any;
      const edadGarantia = recipeData?.age_days || 28;
      
      // Calculate the guarantee date using UTC to avoid timezone issues
      const fechaMuestreoStr = muestreo.fecha_muestreo.split('T')[0];
      const fechaMuestreo = createUTCDate(fechaMuestreoStr);
      const fechaEdadGarantia = new Date(fechaMuestreo);
      fechaEdadGarantia.setUTCDate(fechaMuestreo.getUTCDate() + edadGarantia);
      const fechaEdadGarantiaStr = formatUTCDate(fechaEdadGarantia);
      
      // Analyze each muestra and its ensayos
      const muestrasAnalysis = muestras.map(muestra => {
        // Get ensayo data if available
        const ensayos = muestra.ensayos || [];
        
        // For each ensayo, calculate the age in days from muestreo
        const ensayosWithAge = ensayos.map((ensayo: any) => {
          const fechaEnsayoStr = ensayo.fecha_ensayo.split('T')[0];
          const fechaEnsayo = createUTCDate(fechaEnsayoStr);
          const diffTime = Math.abs(fechaEnsayo.getTime() - fechaMuestreo.getTime());
          const edadDias = Math.round(diffTime / (1000 * 60 * 60 * 24));
          
          return {
            ...ensayo,
            edad_dias: edadDias,
            is_edad_garantia: Math.abs(edadDias - edadGarantia) <= 1, // Within 1 day of guarantee age
            fecha_programada_matches_garantia: muestra.fecha_programada_ensayo === fechaEdadGarantiaStr
          };
        });
        
        return {
          muestra_id: muestra.id,
          identificacion: muestra.identificacion,
          tipo_muestra: muestra.tipo_muestra,
          fecha_programada: muestra.fecha_programada_ensayo,
          fecha_programada_matches_garantia: muestra.fecha_programada_ensayo === fechaEdadGarantiaStr,
          ensayos: ensayosWithAge
        };
      });
      
      return {
        muestreo_id: muestreo.id,
        fecha_muestreo: muestreo.fecha_muestreo,
        planta: muestreo.planta,
        recipe_id: recipeData?.id,
        recipe_code: recipeData?.recipe_code,
        edad_garantia: edadGarantia,
        fecha_garantia: fechaEdadGarantiaStr,
        muestras: muestrasAnalysis,
        muestras_count: muestras.length,
        muestras_garantia_count: muestras.filter(m => m.fecha_programada_ensayo === fechaEdadGarantiaStr).length
      };
    });
    
    return {
      total_muestreos: muestreosData.length,
      total_muestras_ensayado: muestrasData.length,
      results: results
    };
    
  } catch (error) {
    console.error('Error in debug function:', error);
    return { error: String(error), results: [] };
  }
}

// Fixed version that directly accesses related tables
export async function fetchResistenciaReporteDataFixed(
  fechaDesde?: string | Date, 
  fechaHasta?: string | Date, 
  planta?: string, 
  clasificacion?: string,
  clientId?: string,
  constructionSiteId?: string,
  recipeCode?: string
) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    // First get all muestreos with their related recipe data
    let muestreosQuery = supabase
      .from('muestreos')
      .select(`
        id,
        fecha_muestreo,
        planta,
        remision:remision_id (
          id,
          order_id,
          order:order_id (
            id,
            client_id,
            construction_site
          ),
          recipe:recipe_id (
            id, 
            recipe_code,
            age_days,
            recipe_versions (
              id,
              notes,
              is_current
            )
          )
        )
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta);
      
    // Apply plant filter if provided
    if (planta && planta !== 'all') {
      muestreosQuery = muestreosQuery.eq('planta', planta);
    }
    
    const { data: muestreosData, error: muestreosError } = await muestreosQuery;
    
    if (muestreosError) {
      console.error('Error fetching muestreos data:', muestreosError);
      throw muestreosError;
    }
    
    if (!muestreosData || muestreosData.length === 0) {
      return [];
    }
    
    console.log(`Found ${muestreosData.length} muestreos`);
    
    // Filter muestreos by client, construction site, and recipe if provided
    let filteredMuestreos = muestreosData;
    
    if (clientId) {
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        return muestreo.remision?.order?.client_id === clientId;
      });
      console.log(`After client filter: ${filteredMuestreos.length} muestreos`);
    }
    
    if (constructionSiteId) {
      // For construction site, we need to get the name first
      let constructionSiteName: string | null = null;
      
      try {
        const { data: siteData } = await supabase
          .from('construction_sites')
          .select('name')
          .eq('id', constructionSiteId)
          .single();
          
        if (siteData) {
          constructionSiteName = siteData.name;
        }
      } catch (error) {
        console.error('Error getting construction site name:', error);
      }
      
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        // If we have the name, compare with that first
        if (constructionSiteName) {
          return muestreo.remision?.order?.construction_site === constructionSiteName;
        }
        // Otherwise try direct ID comparison, which may not work if construction_site is a name
        return muestreo.remision?.order?.construction_site === constructionSiteId;
      });
      console.log(`After construction site filter: ${filteredMuestreos.length} muestreos`);
    }
    
    if (recipeCode) {
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        return muestreo.remision?.recipe?.recipe_code === recipeCode;
      });
      console.log(`After recipe filter: ${filteredMuestreos.length} muestreos`);
    }
    
    // Process each muestreo and get its samples at the guarantee age
    const reportPromises = filteredMuestreos.map(async (muestreo: any) => {
      // Skip if no recipe data
      if (!muestreo.remision?.recipe) {
        return null;
      }
      
      // Get recipe data
      const recipe = muestreo.remision.recipe;
      
      // Get classification from recipe versions
      const recipeVersions = recipe.recipe_versions || [];
      const currentVersion = recipeVersions.find((v: any) => v.is_current === true);
      const clasificacionReceta = currentVersion?.notes?.includes('MR') ? 'MR' : 'FC';
      
      // Apply classification filter
      if (clasificacion && clasificacion !== 'all' && clasificacionReceta !== clasificacion) {
        return null;
      }
      
      // Get guarantee age
      const edadGarantia = recipe.age_days || 28;
      
      // Calculate guarantee date - using UTC dates to avoid timezone issues
      const fechaMuestreoStr = muestreo.fecha_muestreo.split('T')[0];
      const fechaMuestreo = createUTCDate(fechaMuestreoStr);
      const fechaEdadGarantia = new Date(fechaMuestreo);
      fechaEdadGarantia.setUTCDate(fechaMuestreo.getUTCDate() + edadGarantia);
      const fechaEdadGarantiaStr = formatUTCDate(fechaEdadGarantia);
      
      console.log(`DEBUG: Muestreo ${muestreo.id} - Fecha muestreo: ${fechaMuestreoStr}, guarantee date: ${fechaEdadGarantiaStr} (${edadGarantia} days)`);
      
      // Get muestras for this muestreo that match the guarantee age
      const { data: muestrasData, error: muestrasError } = await supabase
        .from('muestras')
        .select(`
          id,
          identificacion,
          tipo_muestra,
          estado,
          fecha_programada_ensayo
        `)
        .eq('muestreo_id', muestreo.id)
        .eq('estado', 'ENSAYADO');
      
      if (muestrasError) {
        console.error('Error fetching muestras:', muestrasError);
        return null;
      }
      
      if (!muestrasData || muestrasData.length === 0) {
        return null;
      }
      
      console.log(`DEBUG: Found ${muestrasData.length} muestras for muestreo ${muestreo.id}`);
      
      // Filter muestras to those scheduled for the guarantee age ±1 day
      const garantiaMuestras = muestrasData.filter(muestra => {
        if (!muestra.fecha_programada_ensayo) return false;
        
        // Use UTC dates to avoid timezone shifts
        const fechaProgramadaStr = muestra.fecha_programada_ensayo.split('T')[0];
        const fechaProgramada = createUTCDate(fechaProgramadaStr);
        
        // Calculate difference in days - use UTC methods for consistency
        const diffTime = Math.abs(fechaProgramada.getTime() - fechaEdadGarantia.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        const matches = diffDays <= 1; // Allow ±1 day tolerance
        
        console.log(`DEBUG: Muestra ${muestra.id} - fecha_programada=${fechaProgramadaStr}, garantia=${fechaEdadGarantiaStr}, diff=${diffDays} days, match=${matches}`);
        
        return matches;
      });
      
      console.log(`DEBUG: Found ${garantiaMuestras.length} muestras at guarantee age for muestreo ${muestreo.id}`);
      
      if (garantiaMuestras.length === 0) {
        return null;
      }
      
      // Get ensayos for these muestras
      const muestraIds = garantiaMuestras.map(m => m.id);
      const { data: ensayosData, error: ensayosError } = await supabase
        .from('ensayos')
        .select(`
          id,
          fecha_ensayo,
          muestra_id,
          carga_kg,
          resistencia_calculada,
          porcentaje_cumplimiento
        `)
        .in('muestra_id', muestraIds);
      
      if (ensayosError) {
        console.error('Error fetching ensayos:', ensayosError);
        return null;
      }
      
      if (!ensayosData || ensayosData.length === 0) {
        return null;
      }
      
      // Create a mapping of muestras
      const muestrasMap = garantiaMuestras.reduce((acc, muestra) => {
        acc[muestra.id] = muestra;
        return acc;
      }, {} as Record<string, any>);
      
      // Format data for report
      return ensayosData.map(ensayo => {
        const muestra = muestrasMap[ensayo.muestra_id];
        
        // Format dates consistently - use replace to avoid timezone issues
        const fechaEnsayoStr = ensayo.fecha_ensayo.split('T')[0];
        const fechaMuestreoFormatted = format(new Date(fechaMuestreoStr.replace(/-/g, '/')), 'dd/MM/yyyy');
        const fechaEnsayoFormatted = format(new Date(fechaEnsayoStr.replace(/-/g, '/')), 'dd/MM/yyyy');
        
        return {
          id: ensayo.id,
          fechaEnsayo: fechaEnsayoFormatted,
          muestra: muestra?.identificacion || '',
          clasificacion: clasificacionReceta,
          edadDias: edadGarantia,
          edadGarantia: edadGarantia,
          cargaKg: ensayo.carga_kg,
          resistencia: ensayo.resistencia_calculada,
          cumplimiento: ensayo.porcentaje_cumplimiento,
          planta: muestreo.planta || '',
          muestreoId: muestreo.id || '',
          muestreoFecha: fechaMuestreoFormatted,
          muestraCodigo: muestra?.identificacion || '',
          fechaProgramada: muestra?.fecha_programada_ensayo || ''
        };
      });
    });
    
    // Wait for all promises to resolve and flatten the array
    const results = (await Promise.all(reportPromises))
      .filter(Boolean)
      .flat();
    
    console.log(`Fixed report found ${results.length} resistance test entries`);
    return results;
    
  } catch (error) {
    handleError(error, 'fetchResistenciaReporteDataFixed');
    return [];
  }
}

// Make helper functions exported so they can be used across the file
export function createUTCDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Helper to format a date as YYYY-MM-DD in UTC
export function formatUTCDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Completely rewrite the muestras processing in fetchEficienciaReporteDataFixed
export async function fetchEficienciaReporteDataFixed(
  fechaDesde?: string | Date, 
  fechaHasta?: string | Date, 
  planta?: string,
  clientId?: string,
  constructionSiteId?: string,
  recipeCode?: string
) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');

    console.log(`Fetching efficiency data from ${desde} to ${hasta}`);

    // First get muestreos with their relationships
    let query = supabase
      .from('muestreos')
      .select(`
        id,
        fecha_muestreo,
        planta,
        masa_unitaria,
        remision_id,
        remision:remision_id (
          id,
          order_id,
          order:order_id (
            id,
            client_id,
            construction_site
          ),
          recipe:recipe_id (
            id,
            recipe_code,
            age_days
          )
        )
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta);
      
    // Apply plant filter if provided
    if (planta && planta !== 'all') {
      query = query.eq('planta', planta);
    }
    
    const { data: muestreosData, error: muestreosError } = await query;
    
    if (muestreosError) {
      console.error('Error fetching muestreos:', muestreosError);
      throw muestreosError;
    }
    
    // If no data, return empty array
    if (!muestreosData || muestreosData.length === 0) {
      console.log('No muestreos found in date range');
      return [];
    }
    
    console.log(`Found ${muestreosData.length} muestreos for efficiency report`);
    
    // Filter muestreos by client, construction site, and recipe if provided
    let filteredMuestreos = muestreosData;
    
    if (clientId) {
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        return muestreo.remision?.order?.client_id === clientId;
      });
      console.log(`After client filter: ${filteredMuestreos.length} muestreos`);
    }
    
    if (constructionSiteId) {
      // For construction site, we need to get the name first
      let constructionSiteName: string | null = null;
      
      try {
        const { data: siteData } = await supabase
          .from('construction_sites')
          .select('name')
          .eq('id', constructionSiteId)
          .single();
          
        if (siteData) {
          constructionSiteName = siteData.name;
        }
      } catch (error) {
        console.error('Error getting construction site name:', error);
      }
      
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        // If we have the name, compare with that first
        if (constructionSiteName) {
          return muestreo.remision?.order?.construction_site === constructionSiteName;
        }
        // Otherwise try direct ID comparison, which may not work if construction_site is a name
        return muestreo.remision?.order?.construction_site === constructionSiteId;
      });
      console.log(`After construction site filter: ${filteredMuestreos.length} muestreos`);
    }
    
    if (recipeCode) {
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        return muestreo.remision?.recipe?.recipe_code === recipeCode;
      });
      console.log(`After recipe filter: ${filteredMuestreos.length} muestreos`);
    }
    
    // Continue with existing implementation using filtered muestreos
    // Get remisiones data
    const remisionIds = filteredMuestreos.map(m => m.remision_id).filter(Boolean);
    const muestreoIds = filteredMuestreos.map(m => m.id);
    
    // STEP 1: Fetch remisiones and materials
    // ====================================
    
    // Fetch detailed remision data
    const { data: remisionesData, error: remisionesError } = await supabase
      .from('remisiones')
      .select(`
        id, 
        recipe_id, 
        volumen_fabricado
      `)
      .in('id', remisionIds);
      
    if (remisionesError) {
      console.error('Error fetching remisiones data:', remisionesError);
      throw remisionesError;
    }
    
    // Fetch materiales
    const { data: materialesData, error: materialesError } = await supabase
      .from('remision_materiales')
      .select('remision_id, material_type, cantidad_real')
      .in('remision_id', remisionIds);
      
    if (materialesError) {
      console.error('Error fetching materiales data:', materialesError);
      throw materialesError;
    }
    
    // STEP 2: Fetch muestras and ensayos (using the exact same approach as debugMuestreosMuestras)
    // ======================================================================================
    
    // First get muestras without ensayos to avoid relationship error
    const { data: muestrasData, error: muestrasError } = await supabase
      .from('muestras')
      .select(`
        id,
        muestreo_id,
        identificacion,
        tipo_muestra,
        estado,
        fecha_programada_ensayo,
        created_at
      `)
      .in('muestreo_id', muestreoIds)
      .eq('estado', 'ENSAYADO');
    
    if (muestrasError) {
      console.error('Error fetching muestras:', muestrasError);
      // Continue with muestreos even if muestras have errors
    }
    
    if (!muestrasData || muestrasData.length === 0) {
      console.log('No ensayado muestras found');
    }
    
    // Now fetch ensayos separately
    const ensayosByMuestraId = new Map();
    
    if (muestrasData && muestrasData.length > 0) {
      const muestraIds = muestrasData.map(m => m.id);
      const { data: ensayosData, error: ensayosError } = await supabase
        .from('ensayos')
        .select(`
          id,
          muestra_id,
          fecha_ensayo,
          resistencia_calculada,
          porcentaje_cumplimiento
        `)
        .in('muestra_id', muestraIds);
      
      if (ensayosError) {
        console.error('Error fetching ensayos:', ensayosError);
      } else if (ensayosData && ensayosData.length > 0) {
        // Group ensayos by muestra_id
        ensayosData.forEach(ensayo => {
          if (!ensayosByMuestraId.has(ensayo.muestra_id)) {
            ensayosByMuestraId.set(ensayo.muestra_id, []);
          }
          ensayosByMuestraId.get(ensayo.muestra_id).push(ensayo);
        });
      }
    }
    
    // Add ensayos to muestras
    const muestrasWithEnsayos = muestrasData?.map(muestra => ({
      ...muestra,
      ensayos: ensayosByMuestraId.get(muestra.id) || []
    })) || [];
    
    // Group muestras by muestreo
    const muestreoMuestrasMap = new Map();
    muestrasWithEnsayos.forEach(muestra => {
      if (!muestreoMuestrasMap.has(muestra.muestreo_id)) {
        muestreoMuestrasMap.set(muestra.muestreo_id, []);
      }
      muestreoMuestrasMap.get(muestra.muestreo_id).push(muestra);
    });
    
    // STEP 3: Create mappings for efficiency metrics
    // ============================================
    
    // Create simple lookups for remisiones and materials
    const remisionesMap = new Map();
    remisionesData?.forEach(r => remisionesMap.set(r.id, r));
    
    // Group materials by remision
    const materialsByRemision = new Map();
    materialesData?.forEach(mat => {
      if (!materialsByRemision.has(mat.remision_id)) {
        materialsByRemision.set(mat.remision_id, []);
      }
      materialsByRemision.get(mat.remision_id).push(mat);
    });
    
    // STEP 4: Process each muestreo to construct final result
    // ===================================================
    
    const eficienciaPromises = filteredMuestreos.map(async (muestreo) => {
      try {
        // Get server metrics using RPC
        const { data: metricasRPC, error: metricasError } = await supabase
          .rpc('calcular_metricas_muestreo', {
            p_muestreo_id: muestreo.id
          });
        
        if (metricasError || !metricasRPC || metricasRPC.length === 0) {
          console.log(`No server metrics for muestreo ${muestreo.id}`);
          return null;
        }
        
        // Calculate client metrics
        const remision = remisionesMap.get(muestreo.remision_id);
        
        // Get materiales for this remision
        const materiales: any[] = materialsByRemision.get(muestreo.remision_id) || [];
        
        // Calculate sums and totals
        const sumaMateriales = materiales.reduce((sum: number, mat: any) => sum + (mat.cantidad_real || 0), 0);
        const kgCemento = (materiales.find((m: any) => m.material_type === 'cement')?.cantidad_real) || 0;
        
        // Get recipe data from nested object
        const recipeData = muestreo.remision?.recipe;
        const edadGarantia = recipeData?.age_days || 28;
        
        // Get resistance from ensayos
        let resistenciaPromedio = 0;
        const { data: resistenciaData } = await supabase
          .from('ensayos')
          .select(`
            resistencia_calculada,
            muestra:muestra_id (
              muestreo_id
            )
          `)
          .eq('muestra.muestreo_id', muestreo.id);
          
        if (resistenciaData && resistenciaData.length > 0) {
          resistenciaPromedio = resistenciaData.reduce((sum: number, item: any) => 
            sum + (item.resistencia_calculada || 0), 0) / resistenciaData.length;
        }
        
        // Handle dates with UTC methods
        const fechaMuestreoStr = muestreo.fecha_muestreo.split('T')[0];
        const fechaMuestreo = createUTCDate(fechaMuestreoStr);
        const fechaFormatted = format(new Date(fechaMuestreoStr.replace(/-/g, '/')), 'dd/MM/yyyy');
        
        // Calculate guarantee date
        const fechaEdadGarantia = new Date(fechaMuestreo);
        fechaEdadGarantia.setUTCDate(fechaMuestreo.getUTCDate() + edadGarantia);
        const fechaEdadGarantiaStr = formatUTCDate(fechaEdadGarantia);
        
        // Process muestras - EXACTLY the same as debugMuestreosMuestras
        const muestras = muestreoMuestrasMap.get(muestreo.id) || [];
        const muestrasProcessed = muestras.map((muestra: any) => {
          // Get ensayos for this muestra
          const ensayos = muestra.ensayos || [];
          
          // Add edad_dias and is_edad_garantia to each ensayo
          const ensayosWithAge = ensayos.map((ensayo: any) => {
            const fechaEnsayoStr = ensayo.fecha_ensayo.split('T')[0];
            const fechaEnsayo = createUTCDate(fechaEnsayoStr);
            const diffTime = Math.abs(fechaEnsayo.getTime() - fechaMuestreo.getTime());
            const edadDias = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            return {
              ...ensayo,
              edad_dias: edadDias,
              is_edad_garantia: Math.abs(edadDias - edadGarantia) <= 1 // Within 1 day of guarantee age
            };
          });
          
          return {
            muestra_id: muestra.id,
            id: muestra.id,
            identificacion: muestra.identificacion,
            codigo: muestra.identificacion, // In case codigo is used in UI
            tipo_muestra: muestra.tipo_muestra,
            fecha_programada: muestra.fecha_programada_ensayo,
            fecha_programada_matches_garantia: muestra.fecha_programada_ensayo === fechaEdadGarantiaStr,
            is_edad_garantia: ensayosWithAge.some((e: any) => e.is_edad_garantia),
            resistencia: ensayosWithAge.find((e: any) => e.is_edad_garantia)?.resistencia_calculada,
            cumplimiento: ensayosWithAge.find((e: any) => e.is_edad_garantia)?.porcentaje_cumplimiento,
            ensayos: ensayosWithAge
          };
        });
        
        // Determine classification from recipe data
        let clasificacion = 'FC';
        if (recipeData?.recipe_code?.includes('MR')) {
          clasificacion = 'MR';
        }
        
        // Return formatted result - same structure as debugMuestreosMuestras
        return {
          id: muestreo.id,
          remision_id: muestreo.remision_id,
          fecha: fechaFormatted,
          fecha_muestreo: fechaMuestreoStr,
          planta: muestreo.planta,
          receta: recipeData?.recipe_code || 'N/A',
          recipe_id: recipeData?.id,
          recipe_code: recipeData?.recipe_code,
          clasificacion,
          
          // Client-calculated metrics
          masa_unitaria: muestreo.masa_unitaria || 0,
          suma_materiales: sumaMateriales,
          kg_cemento: kgCemento,
          volumen_registrado: remision?.volumen_fabricado || 0,
          
          // Server-calculated metrics
          volumen_real: metricasRPC[0].volumen_real,
          rendimiento_volumetrico: metricasRPC[0].rendimiento_volumetrico,
          consumo_cemento: metricasRPC[0].consumo_cemento_real,
          resistencia_promedio: resistenciaPromedio,
          eficiencia: metricasRPC[0].eficiencia || 0,
          
          // Relationship data
          edad_garantia: edadGarantia,
          fecha_garantia: fechaEdadGarantiaStr,
          muestras: muestrasProcessed,
          muestras_count: muestras.length,
          muestras_garantia_count: muestras.filter((m: any) => m.fecha_programada_ensayo === fechaEdadGarantiaStr).length
        };
      } catch (err) {
        console.error('Error calculando métricas para muestreo:', muestreo.id, err);
        return null;
      }
    });
    
    // Resolve all promises and filter out nulls
    const eficienciaData = (await Promise.all(eficienciaPromises)).filter(Boolean);
    console.log(`Efficiency report processed ${eficienciaData.length} entries with muestras`);
    return eficienciaData;
  } catch (error) {
    handleError(error, 'fetchEficienciaReporteDataFixed');
    return [];
  }
}

// New function to get clients that have quality data in the specified date range
export async function fetchClientsWithQualityData(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');

    // First get muestreos in the date range
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select(`
        remision:remision_id (
          order:order_id (
            client_id
          )
        )
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta);
      
    if (muestreosError) {
      console.error('Error fetching muestreos for clients:', muestreosError);
      throw muestreosError;
    }
    
    if (!muestreosData || muestreosData.length === 0) {
      return [];
    }
    
    // Extract unique client IDs
    const clientIds: string[] = [];
    muestreosData.forEach(muestreo => {
      const clientId = muestreo.remision?.order?.client_id;
      if (clientId && !clientIds.includes(clientId)) {
        clientIds.push(clientId);
      }
    });
    
    if (clientIds.length === 0) {
      return [];
    }
    
    // Get clients data
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .in('id', clientIds)
      .order('business_name', { ascending: true });
      
    if (clientsError) {
      console.error('Error fetching clients data:', clientsError);
      throw clientsError;
    }
    
    return clientsData || [];
  } catch (error) {
    handleError(error, 'fetchClientsWithQualityData');
    return [];
  }
}

// New function to get construction sites that have quality data for a specific client and date range
export async function fetchConstructionSitesWithQualityData(
  clientId: string,
  fechaDesde?: string | Date, 
  fechaHasta?: string | Date
) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');

    // First get muestreos in the date range for this client
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select(`
        remision:remision_id (
          order:order_id (
            client_id,
            construction_site
          )
        )
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta);
      
    if (muestreosError) {
      console.error('Error fetching muestreos for construction sites:', muestreosError);
      throw muestreosError;
    }
    
    if (!muestreosData || muestreosData.length === 0) {
      return [];
    }
    
    // Filter by client and extract unique construction site names
    const siteNames: string[] = [];
    muestreosData.forEach(muestreo => {
      if (muestreo.remision?.order?.client_id === clientId) {
        const siteName = muestreo.remision?.order?.construction_site;
        if (siteName && !siteNames.includes(siteName)) {
          siteNames.push(siteName);
        }
      }
    });
    
    if (siteNames.length === 0) {
      return [];
    }
    
    // Get construction sites data
    const { data: sitesData, error: sitesError } = await supabase
      .from('construction_sites')
      .select('*')
      .eq('client_id', clientId)
      .in('name', siteNames)
      .order('name', { ascending: true });
      
    if (sitesError) {
      console.error('Error fetching construction sites data:', sitesError);
      throw sitesError;
    }
    
    return sitesData || [];
  } catch (error) {
    handleError(error, 'fetchConstructionSitesWithQualityData');
    return [];
  }
}

// New function to get recipes that have quality data in the specified date range
export async function fetchRecipesWithQualityData(
  fechaDesde?: string | Date, 
  fechaHasta?: string | Date,
  clientId?: string,
  constructionSiteId?: string
) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');

    // Get muestreos with recipe info in the date range
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select(`
        remision:remision_id (
          order:order_id (
            client_id,
            construction_site
          ),
          recipe:recipe_id (
            id,
            recipe_code
          )
        )
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta);
      
    if (muestreosError) {
      console.error('Error fetching muestreos for recipes:', muestreosError);
      throw muestreosError;
    }
    
    if (!muestreosData || muestreosData.length === 0) {
      return [];
    }
    
    // Filter by client and construction site if provided
    let filteredMuestreos = muestreosData;
    
    if (clientId) {
      filteredMuestreos = filteredMuestreos.filter(muestreo => 
        muestreo.remision?.order?.client_id === clientId
      );
    }
    
    if (constructionSiteId) {
      // First get the construction site name
      let constructionSiteName: string | null = null;
      
      try {
        const { data: siteData } = await supabase
          .from('construction_sites')
          .select('name')
          .eq('id', constructionSiteId)
          .single();
          
        if (siteData) {
          constructionSiteName = siteData.name;
        }
      } catch (error) {
        console.error('Error getting construction site name:', error);
      }
      
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        if (constructionSiteName) {
          return muestreo.remision?.order?.construction_site === constructionSiteName;
        }
        return false;
      });
    }
    
    // Extract unique recipe IDs
    const recipeIds: string[] = [];
    const recipeCodesMap: Record<string, string> = {};
    
    filteredMuestreos.forEach(muestreo => {
      const recipeId = muestreo.remision?.recipe?.id;
      const recipeCode = muestreo.remision?.recipe?.recipe_code;
      
      if (recipeId && recipeCode && !recipeIds.includes(recipeId)) {
        recipeIds.push(recipeId);
        recipeCodesMap[recipeId] = recipeCode;
      }
    });
    
    if (recipeIds.length === 0) {
      return [];
    }
    
    // Get recipes data
    const { data: recipesData, error: recipesError } = await supabase
      .from('recipes')
      .select('id, recipe_code, age_days')
      .in('id', recipeIds)
      .order('recipe_code', { ascending: true });
      
    if (recipesError) {
      console.error('Error fetching recipes data:', recipesError);
      throw recipesError;
    }
    
    return recipesData || [];
  } catch (error) {
    handleError(error, 'fetchRecipesWithQualityData');
    return [];
  }
}