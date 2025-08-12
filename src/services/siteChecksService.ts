import { supabase } from '@/lib/supabase';

export type SiteCheckInput = {
  remision_id?: string | null;
  remision_number_manual: string;
  plant_id: string;
  fecha_muestreo: Date;
  hora_salida_planta?: string | null; // HH:MM
  hora_llegada_obra?: string | null; // HH:MM
  test_type: 'SLUMP' | 'EXTENSIBILIDAD';
  valor_inicial_cm?: number | null;
  fue_ajustado?: boolean;
  detalle_ajuste?: string | null;
  valor_final_cm?: number | null;
  temperatura_ambiente?: number | null;
  temperatura_concreto?: number | null;
  observaciones?: string | null;
  created_by?: string;
};

export type SiteCheck = SiteCheckInput & { id: string; created_at: string; updated_at: string };

export const siteChecksService = {
  async createSiteCheck(input: SiteCheckInput): Promise<string> {
    const payload: any = {
      ...input,
      remision_id: input.remision_id || null,
      fue_ajustado: Boolean(input.fue_ajustado),
      fecha_muestreo: input.fecha_muestreo,
    };

    const { data, error } = await supabase
      .from('site_checks')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    return data.id as string;
  },

  async getSiteCheckById(id: string) {
    const { data, error } = await supabase
      .from('site_checks')
      .select('*, remision:remision_id(*), plant:plant_id(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async listSiteChecks(params?: {
    from?: string; // yyyy-MM-dd
    to?: string;   // yyyy-MM-dd
    plant_id?: string;
    test_type?: 'SLUMP' | 'EXTENSIBILIDAD';
    linked?: boolean; // whether remision_id is not null
  }) {
    let query = supabase.from('site_checks').select('*').order('created_at', { ascending: false });
    if (params?.from) query = query.gte('fecha_muestreo', params.from);
    if (params?.to) query = query.lte('fecha_muestreo', params.to);
    if (params?.plant_id) query = query.eq('plant_id', params.plant_id);
    if (params?.test_type) query = query.eq('test_type', params.test_type);
    if (params?.linked === true) query = query.not('remision_id', 'is', null);
    if (params?.linked === false) query = query.is('remision_id', null);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async linkToRemision(siteCheckId: string, remisionId: string) {
    const { error } = await supabase
      .from('site_checks')
      .update({ remision_id: remisionId })
      .eq('id', siteCheckId);
    if (error) throw error;
  }
};


