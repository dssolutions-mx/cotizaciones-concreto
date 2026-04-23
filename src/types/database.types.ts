export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_permissions: {
        Row: {
          id: number
          user_id: string
          permission_id: number
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          permission_id: number
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          permission_id?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          }
        ]
      }
      permissions: {
        Row: {
          id: number
          name: string
          description: string
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          description: string
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          description?: string
          created_at?: string
        }
      }
      order_concrete_evidence: {
        Row: {
          id: string
          order_id: string
          plant_id: string
          file_path: string
          original_name: string
          file_size: number
          mime_type: string
          uploaded_by: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          plant_id: string
          file_path: string
          original_name: string
          file_size: number
          mime_type: string
          uploaded_by: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          plant_id?: string
          file_path?: string
          original_name?: string
          file_size?: number
          mime_type?: string
          uploaded_by?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_concrete_evidence_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          }
        ]
      }
      finanzas_audit_log: {
        Row: {
          id: string
          occurred_at: string
          actor_id: string
          actor_role: string
          actor_plant_id: string | null
          entity_type: string
          entity_id: string
          order_id: string | null
          quote_id: string | null
          client_id: string | null
          action: string
          reason: string
          changes: Json
          financial_delta: Json | null
          flags: Json | null
          source: string
          request_ip: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          occurred_at?: string
          actor_id: string
          actor_role: string
          actor_plant_id?: string | null
          entity_type: string
          entity_id: string
          order_id?: string | null
          quote_id?: string | null
          client_id?: string | null
          action: string
          reason: string
          changes?: Json
          financial_delta?: Json | null
          flags?: Json | null
          source?: string
          request_ip?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          occurred_at?: string
          actor_id?: string
          actor_role?: string
          actor_plant_id?: string | null
          entity_type?: string
          entity_id?: string
          order_id?: string | null
          quote_id?: string | null
          client_id?: string | null
          action?: string
          reason?: string
          changes?: Json
          financial_delta?: Json | null
          flags?: Json | null
          source?: string
          request_ip?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'finanzas_audit_log_actor_id_fkey'
            columns: ['actor_id']
            referencedRelation: 'user_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      compliance_daily_runs: {
        Row: {
          id: string
          target_date: string
          executed_at: string
          triggered_by: string | null
          report: Json
          summary: Json
        }
        Insert: {
          id?: string
          target_date: string
          executed_at?: string
          triggered_by?: string | null
          report?: Json
          summary?: Json
        }
        Update: {
          id?: string
          target_date?: string
          executed_at?: string
          triggered_by?: string | null
          report?: Json
          summary?: Json
        }
        Relationships: []
      }
      compliance_daily_disputes: {
        Row: {
          id: string
          run_id: string | null
          plant_id: string | null
          category: string
          finding_key: string | null
          included_finding_keys: string[]
          recipients: Json | null
          subject: string | null
          body: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          operator_id: string | null
          payroll_day_date: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          id?: string
          run_id?: string | null
          plant_id?: string | null
          category: string
          finding_key?: string | null
          included_finding_keys?: string[]
          recipients?: Json | null
          subject?: string | null
          body?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          operator_id?: string | null
          payroll_day_date?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          id?: string
          run_id?: string | null
          plant_id?: string | null
          category?: string
          finding_key?: string | null
          included_finding_keys?: string[]
          recipients?: Json | null
          subject?: string | null
          body?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          operator_id?: string | null
          payroll_day_date?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      }
      plant_operating_days: {
        Row: {
          plant_id: string
          mon: boolean
          tue: boolean
          wed: boolean
          thu: boolean
          fri: boolean
          sat: boolean
          sun: boolean
          updated_at: string | null
        }
        Insert: {
          plant_id: string
          mon?: boolean
          tue?: boolean
          wed?: boolean
          thu?: boolean
          fri?: boolean
          sat?: boolean
          sun?: boolean
          updated_at?: string | null
        }
        Update: {
          plant_id?: string
          mon?: boolean
          tue?: boolean
          wed?: boolean
          thu?: boolean
          fri?: boolean
          sat?: boolean
          sun?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      compliance_unit_aliases: {
        Row: {
          id: string
          remision_unit_name: string
          canonical_asset_id: string
          notes: string | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          remision_unit_name: string
          canonical_asset_id: string
          notes?: string | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          remision_unit_name?: string
          canonical_asset_id?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      compliance_unit_exemptions: {
        Row: {
          id: string
          unit_name: string
          reason: string | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          unit_name: string
          reason?: string | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          unit_name?: string
          reason?: string | null
          created_by?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      compliance_email_settings: {
        Row: {
          id: number
          digest_recipients: string
          updated_at: string
        }
        Insert: {
          id?: number
          digest_recipients?: string
          updated_at?: string
        }
        Update: {
          id?: number
          digest_recipients?: string
          updated_at?: string
        }
        Relationships: []
      }
      compliance_plant_email_overrides: {
        Row: {
          plant_id: string
          dosificador_email: string | null
          jefe_planta_email: string | null
          extra_cc: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          plant_id: string
          dosificador_email?: string | null
          jefe_planta_email?: string | null
          extra_cc?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          plant_id?: string
          dosificador_email?: string | null
          jefe_planta_email?: string | null
          extra_cc?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 