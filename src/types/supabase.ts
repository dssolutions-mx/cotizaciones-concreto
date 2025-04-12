export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          business_name: string;
          client_code: string;
          rfc: string | null;
          requires_invoice: boolean;
          credit_status: string;
          created_at: string;
          updated_at: string | null;
          is_active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['clients']['Row']>;
      };
      construction_sites: {
        Row: {
          id: string;
          name: string;
          location: string;
          access_restrictions: string | null;
          special_conditions: string | null;
          client_id: string;
          created_at: string;
          is_active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['construction_sites']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['construction_sites']['Row']>;
      };
      user_profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          role: string;
          created_at: string;
          updated_at: string;
          is_active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_profiles']['Row']>;
      };
      quotes: {
        Row: {
          id: string;
          quote_number: string;
          client_id: string;
          construction_site: string;
          location: string;
          status: string;
          validity_date: string | null;
          created_by: string;
          approved_by: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['quotes']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['quotes']['Row']>;
      };
      product_prices: {
        Row: {
          id: string;
          code: string;
          description: string;
          fc_mr_value: number | null;
          type: string;
          age_days: number | null;
          placement_type: string | null;
          max_aggregate_size: string | null;
          slump: string | null;
          base_price: number;
          construction_site: string | null;
          recipe_id: string | null;
          client_id: string | null;
          original_recipe_id: string | null;
          quote_id: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['product_prices']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['product_prices']['Row']>;
      };
      recipes: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['recipes']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['recipes']['Row']>;
      };
      activity_log: {
        Row: {
          id: string;
          description: string;
          user_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['activity_log']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['activity_log']['Row']>;
      };
      // Add other tables as needed
    };
    Views: Record<string, object>;
    Functions: Record<string, object>;
    Enums: Record<string, object>;
  };
};
