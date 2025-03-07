export interface Database {
  public: {
    Tables: {
      product_prices: {
        Row: {
          id: string;
          code: string;
          description: string;
          fc_mr_value: number;
          type: 'STANDARD' | 'SPECIAL' | 'QUOTED';
          age_days: number;
          placement_type: string;
          max_aggregate_size: number;
          slump: number;
          base_price: number;
          recipe_id: string | null;
          is_active: boolean;
          effective_date: string;
          created_at: string | null;
          updated_at: string | null;
          quote_id: string | null;
          original_recipe_id: string | null;
          approval_date: string | null;
          client_id: string;
        };
      };
      clients: {
        Row: {
          id: string;
          business_name: string;
          client_code: string | null;
          rfc: string | null;
          requires_invoice: boolean;
          address: string | null;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          credit_status: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
      };
      recipes: {
        Row: {
          id: string;
          recipe_code: string;
          strength_fc: number;
          age_days: number;
          placement_type: string;
          max_aggregate_size: number;
          slump: number;
          created_at: string | null;
          updated_at: string | null;
        };
      };
      quotes: {
        Row: {
          id: string;
          quote_number: string;
          client_id: string | null;
          construction_site: string;
          location: string;
          status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
          validity_date: string;
          created_by: string;
          approved_by: string | null;
          created_at: string | null;
          updated_at: string | null;
          approval_date: string | null;
          rejection_date: string | null;
          rejection_reason: string | null;
        };
      };
    };
  };
} 