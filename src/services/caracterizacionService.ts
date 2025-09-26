import { supabase } from '@/lib/supabase/client';
import { Material } from '@/types/recipes';

export interface AltaEstudio {
  id?: string;
  id_planta: string;
  tipo_material: 'Arena' | 'Grava';
  mina_procedencia: string;
  nombre_material: string;
  origen_material?: string;
  tecnico: string;
  tipo_estudio: string[];
  planta?: string;
  fecha_elaboracion: string;
  created_at?: string;
  updated_at?: string;
}

export interface Caracterizacion {
  id?: string;
  alta_estudio_id: string;
  masa_especifica?: number;
  masa_especifica_sss?: number;
  masa_especifica_seca?: number;
  masa_volumetrica_suelta?: number;
  masa_volumetrica_compactada?: number;
  masa_seca?: number;
  absorcion?: number;
  absorcion_porcentaje?: number;
  perdida_lavado?: number;
  perdida_lavado_porcentaje?: number;
  masa_muestra_sss?: number;
  masa_muestra_seca_lavada?: number;
  volumen_desplazado?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface Granulometria {
  id?: string;
  alta_estudio_id: string;
  no_malla: string;
  retenido: number;
  porc_retenido: number;
  porc_acumulado: number;
  porc_pasa: number;
  orden_malla: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export const caracterizacionService = {
  // Obtener materiales filtrados por tipo y planta
  async getMaterialesPorTipoYPlanta(plantId: string, tipoMaterial: 'Arena' | 'Grava'): Promise<Material[]> {
    try {
      // Obtener todos los materiales agregados de la planta
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('plant_id', plantId)
        .eq('category', 'agregado')
        .eq('is_active', true)
        .order('material_name');

      if (error) throw error;

      // Filtrar en el cliente según el tipo de material
      const filteredData = (data || []).filter((material: Material) => {
        // Primero verificar que el material tenga nombre válido
        if (!material.material_name || material.material_name.trim() === '') {
          return false;
        }
        
        const materialName = material.material_name.toLowerCase();
        
        if (tipoMaterial === 'Arena') {
          // Criterios para Arena:
          // 1. aggregate_type = 'AR'
          // 2. subcategory = 'agregado_fino'
          // 3. nombre contiene 'arena'
          return material.aggregate_type === 'AR' || 
                 material.subcategory === 'agregado_fino' ||
                 materialName.includes('arena');
        } else if (tipoMaterial === 'Grava') {
          // Criterios para Grava:
          // 1. aggregate_type = 'GR'
          // 2. subcategory = 'agregado_grueso'
          // 3. nombre contiene palabras clave de grava
          // 4. NO es agregado_fino Y contiene patrones típicos de grava
          const esGravaPorTipo = material.aggregate_type === 'GR';
          const esGravaPorSubcategoria = material.subcategory === 'agregado_grueso';
          const esGravaPorNombre = materialName.includes('grava') || 
                                   materialName.includes('piedra') ||
                                   materialName.includes('gravilla');
          const esGravaPorPatron = (material.subcategory !== 'agregado_fino') && 
                                   (materialName.includes('mm') || 
                                    materialName.includes('10') || 
                                    materialName.includes('20') || 
                                    materialName.includes('40') ||
                                    materialName.includes('agregado grueso'));
          
          return esGravaPorTipo || esGravaPorSubcategoria || esGravaPorNombre || esGravaPorPatron;
        }
        
        return false;
      });

      return filteredData;
    } catch (error) {
      console.error('Error al obtener materiales:', error);
      throw error;
    }
  },

  // Crear nuevo estudio de caracterización
  async crearAltaEstudio(estudio: Omit<AltaEstudio, 'id' | 'created_at' | 'updated_at'>): Promise<AltaEstudio> {
    try {
      console.log('Datos del estudio a insertar:', estudio);

      // Validar campos requeridos
      if (!estudio.tipo_material) {
        throw new Error('tipo_material es requerido');
      }
      if (!estudio.mina_procedencia) {
        throw new Error('mina_procedencia es requerido');
      }
      if (!estudio.nombre_material) {
        throw new Error('nombre_material es requerido');
      }
      if (!estudio.tecnico) {
        throw new Error('tecnico es requerido');
      }
      if (!estudio.id_planta) {
        throw new Error('id_planta es requerido');
      }

      const { data, error } = await supabase
        .from('alta_estudio')
        .insert([estudio])
        .select()
        .single();

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error(`Error de base de datos: ${error.message || 'Error desconocido'}`);
      }
      
      console.log('Estudio creado exitosamente:', data);
      return data;
    } catch (error) {
      console.error('Error al crear estudio:', error);
      throw error;
    }
  },

  // Obtener estudios de caracterización por planta
  async getEstudiosPorPlanta(plantId: string): Promise<AltaEstudio[]> {
    try {
      const { data, error } = await supabase
        .from('alta_estudio')
        .select('*')
        .eq('id_planta', plantId)
        .order('fecha_elaboracion', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener estudios:', error);
      throw error;
    }
  },

  // Obtener estudio por ID
  async getEstudioPorId(id: string): Promise<AltaEstudio | null> {
    try {
      const { data, error } = await supabase
        .from('alta_estudio')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al obtener estudio:', error);
      throw error;
    }
  },

  // Actualizar estudio
  async actualizarEstudio(id: string, estudio: Partial<AltaEstudio>): Promise<AltaEstudio> {
    try {
      const { data, error } = await supabase
        .from('alta_estudio')
        .update(estudio)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al actualizar estudio:', error);
      throw error;
    }
  },

  // Eliminar estudio
  async eliminarEstudio(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('alta_estudio')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error al eliminar estudio:', error);
      throw error;
    }
  },

  // Crear datos de caracterización
  async crearCaracterizacion(caracterizacion: Omit<Caracterizacion, 'id' | 'created_at' | 'updated_at'>): Promise<Caracterizacion> {
    try {
      const { data, error } = await supabase
        .from('caracterizacion')
        .insert([caracterizacion])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al crear caracterización:', error);
      throw error;
    }
  },

  // Obtener caracterización por estudio
  async getCaracterizacionPorEstudio(altaEstudioId: string): Promise<Caracterizacion | null> {
    try {
      const { data, error } = await supabase
        .from('caracterizacion')
        .select('*')
        .eq('alta_estudio_id', altaEstudioId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data || null;
    } catch (error) {
      console.error('Error al obtener caracterización:', error);
      throw error;
    }
  },

  // Actualizar caracterización
  async actualizarCaracterizacion(id: string, caracterizacion: Partial<Caracterizacion>): Promise<Caracterizacion> {
    try {
      const { data, error } = await supabase
        .from('caracterizacion')
        .update(caracterizacion)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al actualizar caracterización:', error);
      throw error;
    }
  },

  // Crear múltiples datos granulométricos
  async crearGranulometrias(granulometrias: Omit<Granulometria, 'id' | 'created_at' | 'updated_at'>[]): Promise<Granulometria[]> {
    try {
      const { data, error } = await supabase
        .from('granulometrias')
        .insert(granulometrias)
        .select();

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al crear granulometrías:', error);
      throw error;
    }
  },

  // Obtener granulometrías por estudio
  async getGranulometriasPorEstudio(altaEstudioId: string): Promise<Granulometria[]> {
    try {
      const { data, error } = await supabase
        .from('granulometrias')
        .select('*')
        .eq('alta_estudio_id', altaEstudioId)
        .order('orden_malla');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener granulometrías:', error);
      throw error;
    }
  },

  // Actualizar granulometría
  async actualizarGranulometria(id: string, granulometria: Partial<Granulometria>): Promise<Granulometria> {
    try {
      const { data, error } = await supabase
        .from('granulometrias')
        .update(granulometria)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al actualizar granulometría:', error);
      throw error;
    }
  },

  // Eliminar granulometrías por estudio
  async eliminarGranulometriasPorEstudio(altaEstudioId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('granulometrias')
        .delete()
        .eq('alta_estudio_id', altaEstudioId);

      if (error) throw error;
    } catch (error) {
      console.error('Error al eliminar granulometrías:', error);
      throw error;
    }
  },

  // Obtener estudio completo con todos los datos relacionados
  async getEstudioCompleto(id: string): Promise<{
    estudio: AltaEstudio;
    caracterizacion?: Caracterizacion;
    granulometrias: Granulometria[];
  } | null> {
    try {
      const estudio = await this.getEstudioPorId(id);
      if (!estudio) return null;

      const [caracterizacion, granulometrias] = await Promise.all([
        this.getCaracterizacionPorEstudio(id),
        this.getGranulometriasPorEstudio(id)
      ]);

      return {
        estudio,
        caracterizacion: caracterizacion || undefined,
        granulometrias
      };
    } catch (error) {
      console.error('Error al obtener estudio completo:', error);
      throw error;
    }
  },

  // Guardar datos de caracterización (masa específica, absorción, etc.)
  async guardarCaracterizacion(altaEstudioId: string, datos: any): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('caracterizacion')
        .upsert([{
          alta_estudio_id: altaEstudioId,
          ...datos,
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al guardar caracterización:', error);
      throw error;
    }
  },

  // Obtener datos de caracterización por estudio
  async getCaracterizacion(altaEstudioId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('caracterizacion')
        .select('*')
        .eq('alta_estudio_id', altaEstudioId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error al obtener caracterización:', error);
      throw error;
    }
  },

  // Guardar datos de granulometría
  async guardarGranulometria(altaEstudioId: string, mallas: any[]): Promise<any[]> {
    try {
      // Primero eliminar registros existentes
      await supabase
        .from('granulometrias')
        .delete()
        .eq('alta_estudio_id', altaEstudioId);

      // Insertar nuevos registros
      const datosParaInsertar = mallas.map(malla => ({
        alta_estudio_id: altaEstudioId,
        ...malla,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('granulometrias')
        .insert(datosParaInsertar)
        .select();

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al guardar granulometría:', error);
      throw error;
    }
  },

  // Obtener datos de granulometría por estudio
  async getGranulometria(altaEstudioId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('granulometrias')
        .select('*')
        .eq('alta_estudio_id', altaEstudioId)
        .order('orden_malla');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener granulometría:', error);
      throw error;
    }
  }
};
