export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      additional_products: {
        Row: {
          base_price: number
          billing_type: Database["public"]["Enums"]["billing_type_enum"]
          category: string
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          distance_rate_per_km: number | null
          id: string
          is_active: boolean
          name: string
          plant_id: string | null
          requires_distance_calculation: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          billing_type?: Database["public"]["Enums"]["billing_type_enum"]
          category: string
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          distance_rate_per_km?: number | null
          id?: string
          is_active?: boolean
          name: string
          plant_id?: string | null
          requires_distance_calculation?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          billing_type?: Database["public"]["Enums"]["billing_type_enum"]
          category?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          distance_rate_per_km?: number | null
          id?: string
          is_active?: boolean
          name?: string
          plant_id?: string | null
          requires_distance_calculation?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "additional_products_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "additional_products_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_products_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      additional_services: {
        Row: {
          code: string
          created_at: string | null
          description: string
          id: string
          is_active: boolean | null
          price: number
        }
        Insert: {
          code: string
          created_at?: string | null
          description: string
          id?: string
          is_active?: boolean | null
          price: number
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string
          id?: string
          is_active?: boolean | null
          price?: number
        }
        Relationships: []
      }
      administrative_costs: {
        Row: {
          amount: number
          cost_type: string
          created_at: string | null
          description: string | null
          effective_date: string
          end_date: string | null
          id: string
          plant_id: string | null
        }
        Insert: {
          amount: number
          cost_type: string
          created_at?: string | null
          description?: string | null
          effective_date: string
          end_date?: string | null
          id?: string
          plant_id?: string | null
        }
        Update: {
          amount?: number
          cost_type?: string
          created_at?: string | null
          description?: string | null
          effective_date?: string
          end_date?: string | null
          id?: string
          plant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "administrative_costs_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "administrative_costs_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administrative_costs_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      alertas_ensayos: {
        Row: {
          created_at: string | null
          estado: string
          event_timezone: string | null
          fecha_alerta: string
          fecha_alerta_ts: string | null
          id: string
          muestra_id: string
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: string
          event_timezone?: string | null
          fecha_alerta: string
          fecha_alerta_ts?: string | null
          id?: string
          muestra_id: string
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: string
          event_timezone?: string | null
          fecha_alerta?: string
          fecha_alerta_ts?: string | null
          id?: string
          muestra_id?: string
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_ensayos_muestra_id_fkey"
            columns: ["muestra_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["muestra_id"]
          },
          {
            foreignKeyName: "alertas_ensayos_muestra_id_fkey"
            columns: ["muestra_id"]
            isOneToOne: false
            referencedRelation: "muestras"
            referencedColumns: ["id"]
          },
        ]
      }
      alta_estudio: {
        Row: {
          created_at: string | null
          fecha_elaboracion: string
          fecha_muestreo: string | null
          id: string
          id_muestra: string | null
          id_planta: string | null
          mina_procedencia: string
          nombre_material: string
          origen_material: string | null
          planta: string | null
          tamaño: string | null
          tecnico: string
          tipo_estudio: string[] | null
          tipo_material: string
          ubicacion: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fecha_elaboracion?: string
          fecha_muestreo?: string | null
          id?: string
          id_muestra?: string | null
          id_planta?: string | null
          mina_procedencia: string
          nombre_material: string
          origen_material?: string | null
          planta?: string | null
          tamaño?: string | null
          tecnico: string
          tipo_estudio?: string[] | null
          tipo_material: string
          ubicacion?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fecha_elaboracion?: string
          fecha_muestreo?: string | null
          id?: string
          id_muestra?: string | null
          id_planta?: string | null
          mina_procedencia?: string
          nombre_material?: string
          origen_material?: string | null
          planta?: string | null
          tamaño?: string | null
          tecnico?: string
          tipo_estudio?: string[] | null
          tipo_material?: string
          ubicacion?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alta_estudio_id_planta_fkey"
            columns: ["id_planta"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "alta_estudio_id_planta_fkey"
            columns: ["id_planta"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alta_estudio_id_planta_fkey"
            columns: ["id_planta"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      arkik_import_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          error_message: string | null
          error_rows: number
          error_summary: Json | null
          excluded_remisiones: number | null
          file_name: string
          file_size: number | null
          id: string
          materials_processed: number | null
          normal_remisiones: number | null
          order_items_created: number | null
          orders_created: number | null
          plant_id: string
          processed_rows: number
          processing_status: string | null
          processing_time_ms: number | null
          reassigned_remisiones: number | null
          remisiones_created: number | null
          status_processing_enabled: boolean | null
          total_rows: number
          updated_at: string | null
          valid_rows: number
          waste_remisiones: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          error_rows?: number
          error_summary?: Json | null
          excluded_remisiones?: number | null
          file_name: string
          file_size?: number | null
          id?: string
          materials_processed?: number | null
          normal_remisiones?: number | null
          order_items_created?: number | null
          orders_created?: number | null
          plant_id: string
          processed_rows?: number
          processing_status?: string | null
          processing_time_ms?: number | null
          reassigned_remisiones?: number | null
          remisiones_created?: number | null
          status_processing_enabled?: boolean | null
          total_rows?: number
          updated_at?: string | null
          valid_rows?: number
          waste_remisiones?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          error_rows?: number
          error_summary?: Json | null
          excluded_remisiones?: number | null
          file_name?: string
          file_size?: number | null
          id?: string
          materials_processed?: number | null
          normal_remisiones?: number | null
          order_items_created?: number | null
          orders_created?: number | null
          plant_id?: string
          processed_rows?: number
          processing_status?: string | null
          processing_time_ms?: number | null
          reassigned_remisiones?: number | null
          remisiones_created?: number | null
          status_processing_enabled?: boolean | null
          total_rows?: number
          updated_at?: string | null
          valid_rows?: number
          waste_remisiones?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "arkik_import_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "arkik_import_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arkik_import_sessions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "arkik_import_sessions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arkik_import_sessions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      arkik_quality_requests: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          payload: Json
          plant_id: string
          primary_code: string
          request_type: string
          resolved_at: string | null
          resolved_note: string | null
          resolved_recipe_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          payload?: Json
          plant_id: string
          primary_code: string
          request_type?: string
          resolved_at?: string | null
          resolved_note?: string | null
          resolved_recipe_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          payload?: Json
          plant_id?: string
          primary_code?: string
          request_type?: string
          resolved_at?: string | null
          resolved_note?: string | null
          resolved_recipe_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arkik_quality_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "arkik_quality_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arkik_quality_requests_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "arkik_quality_requests_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arkik_quality_requests_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "arkik_quality_requests_resolved_recipe_id_fkey"
            columns: ["resolved_recipe_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "arkik_quality_requests_resolved_recipe_id_fkey"
            columns: ["resolved_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "arkik_quality_requests_resolved_recipe_id_fkey"
            columns: ["resolved_recipe_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "arkik_quality_requests_resolved_recipe_id_fkey"
            columns: ["resolved_recipe_id"]
            isOneToOne: false
            referencedRelation: "quality_team_recipes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arkik_quality_requests_resolved_recipe_id_fkey"
            columns: ["resolved_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_log_uploads: {
        Row: {
          attestation_hash: string | null
          attestation_text: string | null
          attested_at: string | null
          attested_by: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          original_name: string
          plant_id: string | null
          selected_date: string | null
          upload_date: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          attestation_hash?: string | null
          attestation_text?: string | null
          attested_at?: string | null
          attested_by?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          original_name: string
          plant_id?: string | null
          selected_date?: string | null
          upload_date?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          attestation_hash?: string | null
          attestation_text?: string | null
          attested_at?: string | null
          attested_by?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          original_name?: string
          plant_id?: string | null
          selected_date?: string | null
          upload_date?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_log_uploads_attested_by_fkey"
            columns: ["attested_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "attendance_log_uploads_attested_by_fkey"
            columns: ["attested_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_log_uploads_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "attendance_log_uploads_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_log_uploads_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "attendance_log_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "attendance_log_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          iva_rate: number | null
          name: string
          updated_at: string | null
          vat_rate: number
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          iva_rate?: number | null
          name: string
          updated_at?: string | null
          vat_rate?: number
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          iva_rate?: number | null
          name?: string
          updated_at?: string | null
          vat_rate?: number
        }
        Relationships: []
      }
      certificados_calibracion: {
        Row: {
          acreditacion_laboratorio: string | null
          archivo_nombre_original: string | null
          archivo_path: string
          condiciones_ambientales: Json | null
          created_at: string
          created_by: string | null
          factor_cobertura: number | null
          fecha_emision: string
          fecha_vencimiento: string
          id: string
          incertidumbre_expandida: number | null
          incertidumbre_unidad: string | null
          instrumento_id: string
          is_vigente: boolean
          laboratorio_externo: string
          metodo_calibracion: string | null
          numero_certificado: string | null
          observaciones: string | null
          rango_medicion: string | null
          tecnico_responsable: string | null
        }
        Insert: {
          acreditacion_laboratorio?: string | null
          archivo_nombre_original?: string | null
          archivo_path: string
          condiciones_ambientales?: Json | null
          created_at?: string
          created_by?: string | null
          factor_cobertura?: number | null
          fecha_emision: string
          fecha_vencimiento: string
          id?: string
          incertidumbre_expandida?: number | null
          incertidumbre_unidad?: string | null
          instrumento_id: string
          is_vigente?: boolean
          laboratorio_externo: string
          metodo_calibracion?: string | null
          numero_certificado?: string | null
          observaciones?: string | null
          rango_medicion?: string | null
          tecnico_responsable?: string | null
        }
        Update: {
          acreditacion_laboratorio?: string | null
          archivo_nombre_original?: string | null
          archivo_path?: string
          condiciones_ambientales?: Json | null
          created_at?: string
          created_by?: string | null
          factor_cobertura?: number | null
          fecha_emision?: string
          fecha_vencimiento?: string
          id?: string
          incertidumbre_expandida?: number | null
          incertidumbre_unidad?: string | null
          instrumento_id?: string
          is_vigente?: boolean
          laboratorio_externo?: string
          metodo_calibracion?: string | null
          numero_certificado?: string | null
          observaciones?: string | null
          rango_medicion?: string | null
          tecnico_responsable?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificados_calibracion_instrumento_id_fkey"
            columns: ["instrumento_id"]
            isOneToOne: false
            referencedRelation: "instrumentos"
            referencedColumns: ["id"]
          },
        ]
      }
      client_balance_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          created_at: string | null
          created_by: string
          id: string
          notes: string
          source_client_id: string | null
          source_site: string | null
          target_client_id: string | null
          target_site: string | null
          transfer_type: string | null
        }
        Insert: {
          adjustment_type: string
          amount: number
          created_at?: string | null
          created_by: string
          id?: string
          notes: string
          source_client_id?: string | null
          source_site?: string | null
          target_client_id?: string | null
          target_site?: string | null
          transfer_type?: string | null
        }
        Update: {
          adjustment_type?: string
          amount?: number
          created_at?: string | null
          created_by?: string
          id?: string
          notes?: string
          source_client_id?: string | null
          source_site?: string | null
          target_client_id?: string | null
          target_site?: string | null
          transfer_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_balance_adjustments_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_balance_adjustments_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_balance_adjustments_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_balance_adjustments_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_balance_adjustments_target_client_id_fkey"
            columns: ["target_client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_balance_adjustments_target_client_id_fkey"
            columns: ["target_client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_balance_adjustments_target_client_id_fkey"
            columns: ["target_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_balance_adjustments_target_client_id_fkey"
            columns: ["target_client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_balances: {
        Row: {
          client_id: string
          construction_site: string | null
          construction_site_id: string | null
          created_at: string | null
          current_balance: number
          id: string
          last_updated: string | null
        }
        Insert: {
          client_id: string
          construction_site?: string | null
          construction_site_id?: string | null
          created_at?: string | null
          current_balance?: number
          id?: string
          last_updated?: string | null
        }
        Update: {
          client_id?: string
          construction_site?: string | null
          construction_site_id?: string | null
          created_at?: string | null
          current_balance?: number
          id?: string
          last_updated?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_balances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_balances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_balances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_balances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_balances_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      client_credit_documents: {
        Row: {
          client_id: string
          created_at: string
          document_amount: number | null
          document_type: string
          expiry_date: string | null
          file_name: string
          file_url: string
          id: string
          notes: string | null
          updated_at: string
          upload_date: string
          uploaded_by: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          document_amount?: number | null
          document_type: string
          expiry_date?: string | null
          file_name: string
          file_url: string
          id?: string
          notes?: string | null
          updated_at?: string
          upload_date?: string
          uploaded_by?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          document_amount?: number | null
          document_type?: string
          expiry_date?: string | null
          file_name?: string
          file_url?: string
          id?: string
          notes?: string | null
          updated_at?: string
          upload_date?: string
          uploaded_by?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_credit_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_credit_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_credit_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credit_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_credit_terms: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          credit_limit: number | null
          effective_date: string
          grace_period_days: number | null
          id: string
          is_active: boolean
          notes: string | null
          pagare_amount: number | null
          pagare_expiry_date: string | null
          payment_frequency_days: number | null
          payment_instrument_type: string | null
          status: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          effective_date?: string
          grace_period_days?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          pagare_amount?: number | null
          pagare_expiry_date?: string | null
          payment_frequency_days?: number | null
          payment_instrument_type?: string | null
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          effective_date?: string
          grace_period_days?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          pagare_amount?: number | null
          pagare_expiry_date?: string | null
          payment_frequency_days?: number | null
          payment_instrument_type?: string | null
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_credit_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_credit_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_credit_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credit_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_payment_distributions: {
        Row: {
          amount: number
          construction_site: string | null
          created_at: string | null
          id: string
          payment_id: string
        }
        Insert: {
          amount: number
          construction_site?: string | null
          created_at?: string | null
          id?: string
          payment_id: string
        }
        Update: {
          amount?: number
          construction_site?: string | null
          created_at?: string | null
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payment_distributions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "client_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payments: {
        Row: {
          amount: number
          client_id: string
          construction_site: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string
          reference_number: string | null
          verification_call_confirmed: boolean | null
        }
        Insert: {
          amount: number
          client_id: string
          construction_site?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method: string
          reference_number?: string | null
          verification_call_confirmed?: boolean | null
        }
        Update: {
          amount?: number
          client_id?: string
          construction_site?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string
          reference_number?: string | null
          verification_call_confirmed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "client_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_payments_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          new_row: Json | null
          old_row: Json | null
          payment_id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          payment_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          payment_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      client_portal_users: {
        Row: {
          client_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          permissions: Json
          role_within_client: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          permissions?: Json
          role_within_client: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          permissions?: Json
          role_within_client?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_portal_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_portal_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_portal_users_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "client_portal_users_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "client_portal_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          assigned_user_id: string | null
          business_name: string
          client_code: string | null
          client_type: Database["public"]["Enums"]["client_type_enum"]
          contact_name: string | null
          created_at: string | null
          created_by: string | null
          credit_status: string | null
          default_permissions: Json
          email: string | null
          id: string
          is_portal_enabled: boolean | null
          logo_path: string | null
          phone: string | null
          portal_user_id: string | null
          requires_internal_approval: boolean
          requires_invoice: boolean | null
          rfc: string | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          address?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_user_id?: string | null
          business_name: string
          client_code?: string | null
          client_type?: Database["public"]["Enums"]["client_type_enum"]
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_status?: string | null
          default_permissions?: Json
          email?: string | null
          id?: string
          is_portal_enabled?: boolean | null
          logo_path?: string | null
          phone?: string | null
          portal_user_id?: string | null
          requires_internal_approval?: boolean
          requires_invoice?: boolean | null
          rfc?: string | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          address?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_user_id?: string | null
          business_name?: string
          client_code?: string | null
          client_type?: Database["public"]["Enums"]["client_type_enum"]
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_status?: string | null
          default_permissions?: Json
          email?: string | null
          id?: string
          is_portal_enabled?: boolean | null
          logo_path?: string | null
          phone?: string | null
          portal_user_id?: string | null
          requires_internal_approval?: boolean
          requires_invoice?: boolean | null
          rfc?: string | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "clients_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "clients_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_terms: {
        Row: {
          description: string
          id: string
          is_active: boolean | null
          quote_id: string | null
          sort_order: number
          term_type: string
        }
        Insert: {
          description: string
          id?: string
          is_active?: boolean | null
          quote_id?: string | null
          sort_order: number
          term_type: string
        }
        Update: {
          description?: string
          id?: string
          is_active?: boolean | null
          quote_id?: string | null
          sort_order?: number
          term_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_terms_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      completed_verificacion_maestros: {
        Row: {
          completed_id: string
          id: string
          maestro_id: string
        }
        Insert: {
          completed_id: string
          id?: string
          maestro_id: string
        }
        Update: {
          completed_id?: string
          id?: string
          maestro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completed_verificacion_maestros_completed_id_fkey"
            columns: ["completed_id"]
            isOneToOne: false
            referencedRelation: "completed_verificaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_verificacion_maestros_maestro_id_fkey"
            columns: ["maestro_id"]
            isOneToOne: false
            referencedRelation: "instrumentos"
            referencedColumns: ["id"]
          },
        ]
      }
      completed_verificacion_measurements: {
        Row: {
          completed_id: string
          created_at: string
          cumple: boolean | null
          error_calculado: number | null
          id: string
          instance_code: string | null
          item_id: string
          observacion: string | null
          reference_point_value: number | null
          section_id: string
          section_repeticion: number
          updated_at: string
          valor_booleano: boolean | null
          valor_observado: number | null
          valor_texto: string | null
        }
        Insert: {
          completed_id: string
          created_at?: string
          cumple?: boolean | null
          error_calculado?: number | null
          id?: string
          instance_code?: string | null
          item_id: string
          observacion?: string | null
          reference_point_value?: number | null
          section_id: string
          section_repeticion?: number
          updated_at?: string
          valor_booleano?: boolean | null
          valor_observado?: number | null
          valor_texto?: string | null
        }
        Update: {
          completed_id?: string
          created_at?: string
          cumple?: boolean | null
          error_calculado?: number | null
          id?: string
          instance_code?: string | null
          item_id?: string
          observacion?: string | null
          reference_point_value?: number | null
          section_id?: string
          section_repeticion?: number
          updated_at?: string
          valor_booleano?: boolean | null
          valor_observado?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "completed_verificacion_measurements_completed_id_fkey"
            columns: ["completed_id"]
            isOneToOne: false
            referencedRelation: "completed_verificaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      completed_verificaciones: {
        Row: {
          condiciones_ambientales: Json | null
          created_at: string
          created_by: string | null
          estado: string
          fecha_proxima_verificacion: string | null
          fecha_verificacion: string
          id: string
          instrumento_id: string
          observaciones_generales: string | null
          resultado: string
          template_version_id: string
          updated_at: string
        }
        Insert: {
          condiciones_ambientales?: Json | null
          created_at?: string
          created_by?: string | null
          estado?: string
          fecha_proxima_verificacion?: string | null
          fecha_verificacion?: string
          id?: string
          instrumento_id: string
          observaciones_generales?: string | null
          resultado?: string
          template_version_id: string
          updated_at?: string
        }
        Update: {
          condiciones_ambientales?: Json | null
          created_at?: string
          created_by?: string | null
          estado?: string
          fecha_proxima_verificacion?: string | null
          fecha_verificacion?: string
          id?: string
          instrumento_id?: string
          observaciones_generales?: string | null
          resultado?: string
          template_version_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "completed_verificaciones_instrumento_id_fkey"
            columns: ["instrumento_id"]
            isOneToOne: false
            referencedRelation: "instrumentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_verificaciones_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "verificacion_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_daily_disputes: {
        Row: {
          body: string | null
          category: string
          finding_key: string | null
          id: string
          included_finding_keys: string[]
          operator_id: string | null
          payroll_day_date: string | null
          plant_id: string | null
          recipients: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_id: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          category: string
          finding_key?: string | null
          id?: string
          included_finding_keys?: string[]
          operator_id?: string | null
          payroll_day_date?: string | null
          plant_id?: string | null
          recipients?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          category?: string
          finding_key?: string | null
          id?: string
          included_finding_keys?: string[]
          operator_id?: string | null
          payroll_day_date?: string | null
          plant_id?: string | null
          recipients?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_daily_disputes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "compliance_daily_disputes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_daily_disputes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "compliance_daily_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_daily_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_daily_disputes_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "compliance_daily_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_daily_disputes_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_daily_disputes_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_daily_runs: {
        Row: {
          executed_at: string
          id: string
          report: Json
          summary: Json
          target_date: string
          triggered_by: string | null
        }
        Insert: {
          executed_at?: string
          id?: string
          report?: Json
          summary?: Json
          target_date: string
          triggered_by?: string | null
        }
        Update: {
          executed_at?: string
          id?: string
          report?: Json
          summary?: Json
          target_date?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      compliance_email_settings: {
        Row: {
          digest_recipients: string
          id: number
          updated_at: string
        }
        Insert: {
          digest_recipients?: string
          id: number
          updated_at?: string
        }
        Update: {
          digest_recipients?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      compliance_plant_email_overrides: {
        Row: {
          dosificador_email: string | null
          extra_cc: string[]
          jefe_planta_email: string | null
          plant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          dosificador_email?: string | null
          extra_cc?: string[]
          jefe_planta_email?: string | null
          plant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          dosificador_email?: string | null
          extra_cc?: string[]
          jefe_planta_email?: string | null
          plant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_plant_email_overrides_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: true
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "compliance_plant_email_overrides_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: true
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_plant_email_overrides_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: true
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "compliance_plant_email_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_plant_email_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_unit_aliases: {
        Row: {
          canonical_asset_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          remision_unit_name: string
        }
        Insert: {
          canonical_asset_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          remision_unit_name: string
        }
        Update: {
          canonical_asset_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          remision_unit_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_unit_aliases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_unit_aliases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_unit_exemptions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          reason: string | null
          unit_name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string | null
          unit_name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string | null
          unit_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_unit_exemptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_unit_exemptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conjuntos_herramientas: {
        Row: {
          business_unit_id: string | null
          cadencia_meses: number
          categoria: string
          codigo_conjunto: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          documentos_adicionales: Json
          id: string
          instrucciones_path: string | null
          is_active: boolean
          manual_path: string | null
          mes_fin_servicio: number | null
          mes_inicio_servicio: number | null
          nombre_conjunto: string
          norma_referencia: string | null
          rango_medicion_tipico: string | null
          secuencia_actual: number
          tipo_defecto: string
          tipo_servicio: string | null
          unidad_medicion: string | null
          updated_at: string
        }
        Insert: {
          business_unit_id?: string | null
          cadencia_meses?: number
          categoria: string
          codigo_conjunto: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          documentos_adicionales?: Json
          id?: string
          instrucciones_path?: string | null
          is_active?: boolean
          manual_path?: string | null
          mes_fin_servicio?: number | null
          mes_inicio_servicio?: number | null
          nombre_conjunto: string
          norma_referencia?: string | null
          rango_medicion_tipico?: string | null
          secuencia_actual?: number
          tipo_defecto: string
          tipo_servicio?: string | null
          unidad_medicion?: string | null
          updated_at?: string
        }
        Update: {
          business_unit_id?: string | null
          cadencia_meses?: number
          categoria?: string
          codigo_conjunto?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          documentos_adicionales?: Json
          id?: string
          instrucciones_path?: string | null
          is_active?: boolean
          manual_path?: string | null
          mes_fin_servicio?: number | null
          mes_inicio_servicio?: number | null
          nombre_conjunto?: string
          norma_referencia?: string | null
          rango_medicion_tipico?: string | null
          secuencia_actual?: number
          tipo_defecto?: string
          tipo_servicio?: string | null
          unidad_medicion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_instrumento_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_instrumento_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["business_unit_id"]
          },
        ]
      }
      construction_sites: {
        Row: {
          access_restrictions: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          plant_id: string | null
          special_conditions: string | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          access_restrictions?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          plant_id?: string | null
          special_conditions?: string | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          access_restrictions?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          plant_id?: string | null
          special_conditions?: string | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "construction_sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "construction_sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "construction_sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "construction_sites_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "construction_sites_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_sites_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      credit_action_tokens: {
        Row: {
          approve_token: string
          created_at: string
          expires_at: string
          id: string
          jwt_token: string | null
          order_id: string
          recipient_email: string
          reject_token: string
        }
        Insert: {
          approve_token: string
          created_at?: string
          expires_at: string
          id?: string
          jwt_token?: string | null
          order_id: string
          recipient_email: string
          reject_token: string
        }
        Update: {
          approve_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          jwt_token?: string | null
          order_id?: string
          recipient_email?: string
          reject_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_action_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "credit_action_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "credit_action_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "credit_action_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_terms_history: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          client_id: string
          document_reference: string | null
          id: string
          new_limit: number
          previous_limit: number | null
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          client_id: string
          document_reference?: string | null
          id?: string
          new_limit: number
          previous_limit?: number | null
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          client_id?: string
          document_reference?: string | null
          id?: string
          new_limit?: number
          previous_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_terms_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "credit_terms_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "credit_terms_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_terms_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "credit_terms_history_document_reference_fkey"
            columns: ["document_reference"]
            isOneToOne: false
            referencedRelation: "client_credit_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      cross_plant_pending_links: {
        Row: {
          created_at: string | null
          id: string
          session_id: string
          source_plant_id: string
          source_remision_id: string
          target_plant_id: string
          target_remision_number: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          session_id: string
          source_plant_id: string
          source_remision_id: string
          target_plant_id: string
          target_remision_number: string
        }
        Update: {
          created_at?: string | null
          id?: string
          session_id?: string
          source_plant_id?: string
          source_remision_id?: string
          target_plant_id?: string
          target_remision_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_plant_pending_links_source_plant_id_fkey"
            columns: ["source_plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "cross_plant_pending_links_source_plant_id_fkey"
            columns: ["source_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_plant_pending_links_source_plant_id_fkey"
            columns: ["source_plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "cross_plant_pending_links_source_remision_id_fkey"
            columns: ["source_remision_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["remision_id"]
          },
          {
            foreignKeyName: "cross_plant_pending_links_source_remision_id_fkey"
            columns: ["source_remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_plant_pending_links_target_plant_id_fkey"
            columns: ["target_plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "cross_plant_pending_links_target_plant_id_fkey"
            columns: ["target_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_plant_pending_links_target_plant_id_fkey"
            columns: ["target_plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      daily_inventory_log: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          daily_notes: string | null
          id: string
          is_closed: boolean | null
          log_date: string
          plant_id: string
          total_adjustments: number | null
          total_consumption: number | null
          total_entries: number | null
          updated_at: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          daily_notes?: string | null
          id?: string
          is_closed?: boolean | null
          log_date: string
          plant_id: string
          total_adjustments?: number | null
          total_consumption?: number | null
          total_entries?: number | null
          updated_at?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          daily_notes?: string | null
          id?: string
          is_closed?: boolean | null
          log_date?: string
          plant_id?: string
          total_adjustments?: number | null
          total_consumption?: number | null
          total_entries?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_inventory_log_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_inventory_log_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_inventory_log_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "daily_inventory_log_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_inventory_log_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      daily_inventory_snapshots: {
        Row: {
          calculated_at: string | null
          closing_stock: number
          created_at: string | null
          daily_adjustments_negative: number
          daily_adjustments_positive: number
          daily_consumption: number
          daily_entries: number
          daily_waste: number
          id: string
          last_recalculated_at: string | null
          material_id: string
          opening_stock: number
          plant_id: string
          seal_date: string | null
          snapshot_date: string
          status: string | null
        }
        Insert: {
          calculated_at?: string | null
          closing_stock?: number
          created_at?: string | null
          daily_adjustments_negative?: number
          daily_adjustments_positive?: number
          daily_consumption?: number
          daily_entries?: number
          daily_waste?: number
          id?: string
          last_recalculated_at?: string | null
          material_id: string
          opening_stock?: number
          plant_id: string
          seal_date?: string | null
          snapshot_date: string
          status?: string | null
        }
        Update: {
          calculated_at?: string | null
          closing_stock?: number
          created_at?: string | null
          daily_adjustments_negative?: number
          daily_adjustments_positive?: number
          daily_consumption?: number
          daily_entries?: number
          daily_waste?: number
          id?: string
          last_recalculated_at?: string | null
          material_id?: string
          opening_stock?: number
          plant_id?: string
          seal_date?: string | null
          snapshot_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_inventory_snapshots_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_inventory_snapshots_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "daily_inventory_snapshots_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_inventory_snapshots_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      delivery_feedback: {
        Row: {
          access_rating_accurate: boolean | null
          actual_conditions: string | null
          created_at: string
          encountered_issues: string[] | null
          feedback_photo_urls: string[] | null
          id: string
          operator_notes: string | null
          order_id: string
          submitted_at: string
          submitted_by: string | null
        }
        Insert: {
          access_rating_accurate?: boolean | null
          actual_conditions?: string | null
          created_at?: string
          encountered_issues?: string[] | null
          feedback_photo_urls?: string[] | null
          id?: string
          operator_notes?: string | null
          order_id: string
          submitted_at?: string
          submitted_by?: string | null
        }
        Update: {
          access_rating_accurate?: boolean | null
          actual_conditions?: string | null
          created_at?: string
          encountered_issues?: string[] | null
          feedback_photo_urls?: string[] | null
          id?: string
          operator_notes?: string | null
          order_id?: string
          submitted_at?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "delivery_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "delivery_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "delivery_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      diseños_matrix: {
        Row: {
          condicion_aditivo: string | null
          consumo_agua: number | null
          created_at: string | null
          created_by: string | null
          id: string
          kg_cemento: number | null
          masaunitaria_diseño: number | null
          matrix_id: string
          no_muestra: string
          nombre_muestra: string | null
          origen_ag: string | null
          origen_cemento: string | null
          plant_id: string
          rev_diseño: number | null
          tamaño_ag: string | null
          tipo_cemento: string | null
          updated_at: string | null
        }
        Insert: {
          condicion_aditivo?: string | null
          consumo_agua?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kg_cemento?: number | null
          masaunitaria_diseño?: number | null
          matrix_id: string
          no_muestra: string
          nombre_muestra?: string | null
          origen_ag?: string | null
          origen_cemento?: string | null
          plant_id: string
          rev_diseño?: number | null
          tamaño_ag?: string | null
          tipo_cemento?: string | null
          updated_at?: string | null
        }
        Update: {
          condicion_aditivo?: string | null
          consumo_agua?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kg_cemento?: number | null
          masaunitaria_diseño?: number | null
          matrix_id?: string
          no_muestra?: string
          nombre_muestra?: string | null
          origen_ag?: string | null
          origen_cemento?: string | null
          plant_id?: string
          rev_diseño?: number | null
          tamaño_ag?: string | null
          tipo_cemento?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diseños_matrix_matrix_id_fkey"
            columns: ["matrix_id"]
            isOneToOne: false
            referencedRelation: "id_matrix"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diseños_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "diseños_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diseños_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      distance_range_configs: {
        Row: {
          additive_te_per_m3: number | null
          bloque_number: number
          bonus_per_m3: number
          created_at: string
          created_by: string | null
          diesel_per_m3: number
          diesel_per_trip: number
          diferencial: number | null
          id: string
          is_active: boolean
          maintenance_per_m3: number
          maintenance_per_trip: number
          max_distance_km: number
          min_distance_km: number
          operator_bonus_per_trip: number
          plant_id: string
          range_code: string
          tires_per_m3: number
          tires_per_trip: number
          total_per_trip: number
          total_transport_per_m3: number
          updated_at: string
        }
        Insert: {
          additive_te_per_m3?: number | null
          bloque_number: number
          bonus_per_m3?: number
          created_at?: string
          created_by?: string | null
          diesel_per_m3?: number
          diesel_per_trip?: number
          diferencial?: number | null
          id?: string
          is_active?: boolean
          maintenance_per_m3?: number
          maintenance_per_trip?: number
          max_distance_km: number
          min_distance_km?: number
          operator_bonus_per_trip?: number
          plant_id: string
          range_code: string
          tires_per_m3?: number
          tires_per_trip?: number
          total_per_trip?: number
          total_transport_per_m3?: number
          updated_at?: string
        }
        Update: {
          additive_te_per_m3?: number | null
          bloque_number?: number
          bonus_per_m3?: number
          created_at?: string
          created_by?: string | null
          diesel_per_m3?: number
          diesel_per_trip?: number
          diferencial?: number | null
          id?: string
          is_active?: boolean
          maintenance_per_m3?: number
          maintenance_per_trip?: number
          max_distance_km?: number
          min_distance_km?: number
          operator_bonus_per_trip?: number
          plant_id?: string
          range_code?: string
          tires_per_m3?: number
          tires_per_trip?: number
          total_per_trip?: number
          total_transport_per_m3?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distance_range_configs_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "distance_range_configs_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distance_range_configs_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          plant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          plant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          plant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "drivers_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      ema_configuracion: {
        Row: {
          bloquear_vencidos: boolean
          dias_alerta_proximo_vencer: number
          id: string
          roles_notificar_vencimiento: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bloquear_vencidos?: boolean
          dias_alerta_proximo_vencer?: number
          id?: string
          roles_notificar_vencimiento?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bloquear_vencidos?: boolean
          dias_alerta_proximo_vencer?: number
          id?: string
          roles_notificar_vencimiento?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ensayo_instrumentos: {
        Row: {
          completed_verificacion_id: string | null
          created_at: string
          ensayo_id: string
          estado_al_momento: string
          fecha_vencimiento_al_momento: string
          id: string
          instrumento_id: string
          instrumento_maestro_snap_id: string | null
          observaciones: string | null
        }
        Insert: {
          completed_verificacion_id?: string | null
          created_at?: string
          ensayo_id: string
          estado_al_momento: string
          fecha_vencimiento_al_momento: string
          id?: string
          instrumento_id: string
          instrumento_maestro_snap_id?: string | null
          observaciones?: string | null
        }
        Update: {
          completed_verificacion_id?: string | null
          created_at?: string
          ensayo_id?: string
          estado_al_momento?: string
          fecha_vencimiento_al_momento?: string
          id?: string
          instrumento_id?: string
          instrumento_maestro_snap_id?: string | null
          observaciones?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ensayo_instrumentos_ensayo_id_fkey"
            columns: ["ensayo_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["ensayo_id"]
          },
          {
            foreignKeyName: "ensayo_instrumentos_ensayo_id_fkey"
            columns: ["ensayo_id"]
            isOneToOne: false
            referencedRelation: "ensayos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ensayo_instrumentos_instrumento_id_fkey"
            columns: ["instrumento_id"]
            isOneToOne: false
            referencedRelation: "instrumentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ensayos: {
        Row: {
          carga_kg: number
          created_at: string | null
          created_by: string | null
          event_timezone: string | null
          factor_correccion: number | null
          fecha_ensayo: string
          fecha_ensayo_ts: string | null
          hora_ensayo: string | null
          id: string
          is_edad_garantia: boolean | null
          is_ensayo_fuera_tiempo: boolean | null
          muestra_id: string
          observaciones: string | null
          plant_id: string | null
          porcentaje_cumplimiento: number
          resistencia_calculada: number
          resistencia_corregida: number | null
          specimen_type_spec_id: string | null
          tiempo_desde_carga: string | null
          updated_at: string | null
        }
        Insert: {
          carga_kg: number
          created_at?: string | null
          created_by?: string | null
          event_timezone?: string | null
          factor_correccion?: number | null
          fecha_ensayo?: string
          fecha_ensayo_ts?: string | null
          hora_ensayo?: string | null
          id?: string
          is_edad_garantia?: boolean | null
          is_ensayo_fuera_tiempo?: boolean | null
          muestra_id: string
          observaciones?: string | null
          plant_id?: string | null
          porcentaje_cumplimiento: number
          resistencia_calculada: number
          resistencia_corregida?: number | null
          specimen_type_spec_id?: string | null
          tiempo_desde_carga?: string | null
          updated_at?: string | null
        }
        Update: {
          carga_kg?: number
          created_at?: string | null
          created_by?: string | null
          event_timezone?: string | null
          factor_correccion?: number | null
          fecha_ensayo?: string
          fecha_ensayo_ts?: string | null
          hora_ensayo?: string | null
          id?: string
          is_edad_garantia?: boolean | null
          is_ensayo_fuera_tiempo?: boolean | null
          muestra_id?: string
          observaciones?: string | null
          plant_id?: string | null
          porcentaje_cumplimiento?: number
          resistencia_calculada?: number
          resistencia_corregida?: number | null
          specimen_type_spec_id?: string | null
          tiempo_desde_carga?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ensayos_muestra_id_fkey"
            columns: ["muestra_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["muestra_id"]
          },
          {
            foreignKeyName: "ensayos_muestra_id_fkey"
            columns: ["muestra_id"]
            isOneToOne: false
            referencedRelation: "muestras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ensayos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "ensayos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ensayos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "ensayos_specimen_type_spec_id_fkey"
            columns: ["specimen_type_spec_id"]
            isOneToOne: false
            referencedRelation: "specimen_type_specs"
            referencedColumns: ["id"]
          },
        ]
      }
      ensayos_matrix: {
        Row: {
          carga: number
          created_at: string | null
          created_by: string | null
          ensayado_por: string | null
          fecha_ensayo: string
          hora_ensayo: string | null
          id: string
          muestra_id: string
          observaciones: string | null
          plant_id: string
          resistencia_calculada: number
          updated_at: string | null
        }
        Insert: {
          carga: number
          created_at?: string | null
          created_by?: string | null
          ensayado_por?: string | null
          fecha_ensayo: string
          hora_ensayo?: string | null
          id?: string
          muestra_id: string
          observaciones?: string | null
          plant_id: string
          resistencia_calculada: number
          updated_at?: string | null
        }
        Update: {
          carga?: number
          created_at?: string | null
          created_by?: string | null
          ensayado_por?: string | null
          fecha_ensayo?: string
          hora_ensayo?: string | null
          id?: string
          muestra_id?: string
          observaciones?: string | null
          plant_id?: string
          resistencia_calculada?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ensayos_matrix_muestra_id_fkey"
            columns: ["muestra_id"]
            isOneToOne: false
            referencedRelation: "muestras_matrix"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ensayos_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "ensayos_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ensayos_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      estudios_seleccionados: {
        Row: {
          alta_estudio_id: string
          created_at: string | null
          descripcion: string | null
          estado: string | null
          fecha_completado: string | null
          fecha_programada: string | null
          id: string
          nombre_estudio: string
          norma_referencia: string | null
          observaciones: string | null
          resultados: Json | null
          tipo_estudio: string
          updated_at: string | null
        }
        Insert: {
          alta_estudio_id: string
          created_at?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_completado?: string | null
          fecha_programada?: string | null
          id?: string
          nombre_estudio: string
          norma_referencia?: string | null
          observaciones?: string | null
          resultados?: Json | null
          tipo_estudio: string
          updated_at?: string | null
        }
        Update: {
          alta_estudio_id?: string
          created_at?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_completado?: string | null
          fecha_programada?: string | null
          id?: string
          nombre_estudio?: string
          norma_referencia?: string | null
          observaciones?: string | null
          resultados?: Json | null
          tipo_estudio?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estudios_seleccionados_alta_estudio_id_fkey"
            columns: ["alta_estudio_id"]
            isOneToOne: false
            referencedRelation: "alta_estudio"
            referencedColumns: ["id"]
          },
        ]
      }
      evidencias: {
        Row: {
          created_at: string | null
          created_by: string | null
          ensayo_id: string
          id: string
          nombre_archivo: string
          path: string
          tamano_kb: number
          tipo_archivo: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          ensayo_id: string
          id?: string
          nombre_archivo: string
          path: string
          tamano_kb: number
          tipo_archivo: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          ensayo_id?: string
          id?: string
          nombre_archivo?: string
          path?: string
          tamano_kb?: number
          tipo_archivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidencias_ensayo_id_fkey"
            columns: ["ensayo_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["ensayo_id"]
          },
          {
            foreignKeyName: "evidencias_ensayo_id_fkey"
            columns: ["ensayo_id"]
            isOneToOne: false
            referencedRelation: "ensayos"
            referencedColumns: ["id"]
          },
        ]
      }
      finanzas_audit_log: {
        Row: {
          action: string
          actor_id: string
          actor_plant_id: string | null
          actor_role: string
          changes: Json
          client_id: string | null
          entity_id: string
          entity_type: string
          financial_delta: Json | null
          flags: Json | null
          id: string
          occurred_at: string
          order_id: string | null
          quote_id: string | null
          reason: string
          request_ip: string | null
          source: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id: string
          actor_plant_id?: string | null
          actor_role: string
          changes?: Json
          client_id?: string | null
          entity_id: string
          entity_type: string
          financial_delta?: Json | null
          flags?: Json | null
          id?: string
          occurred_at?: string
          order_id?: string | null
          quote_id?: string | null
          reason: string
          request_ip?: string | null
          source?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          actor_plant_id?: string | null
          actor_role?: string
          changes?: Json
          client_id?: string | null
          entity_id?: string
          entity_type?: string
          financial_delta?: Json | null
          flags?: Json | null
          id?: string
          occurred_at?: string
          order_id?: string | null
          quote_id?: string | null
          reason?: string
          request_ip?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finanzas_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "finanzas_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_action_tokens: {
        Row: {
          approve_token: string
          created_at: string
          entity_id: string
          entity_type: string
          expires_at: string
          id: string
          recipient_email: string
          reject_token: string
        }
        Insert: {
          approve_token: string
          created_at?: string
          entity_id: string
          entity_type: string
          expires_at: string
          id?: string
          recipient_email: string
          reject_token: string
        }
        Update: {
          approve_token?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          expires_at?: string
          id?: string
          recipient_email?: string
          reject_token?: string
        }
        Relationships: []
      }
      governance_notifications: {
        Row: {
          created_at: string
          delivery_status: string
          entity_id: string
          entity_type: string
          id: string
          notification_type: string
          recipient: string
          sent_at: string | null
        }
        Insert: {
          created_at?: string
          delivery_status?: string
          entity_id: string
          entity_type: string
          id?: string
          notification_type: string
          recipient: string
          sent_at?: string | null
        }
        Update: {
          created_at?: string
          delivery_status?: string
          entity_id?: string
          entity_type?: string
          id?: string
          notification_type?: string
          recipient?: string
          sent_at?: string | null
        }
        Relationships: []
      }
      granulometrias: {
        Row: {
          alta_estudio_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          no_malla: string
          orden_malla: number
          porc_acumulado: number
          porc_pasa: number
          porc_retenido: number
          retenido: number
          updated_at: string | null
        }
        Insert: {
          alta_estudio_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          no_malla: string
          orden_malla: number
          porc_acumulado?: number
          porc_pasa?: number
          porc_retenido?: number
          retenido?: number
          updated_at?: string | null
        }
        Update: {
          alta_estudio_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          no_malla?: string
          orden_malla?: number
          porc_acumulado?: number
          porc_pasa?: number
          porc_retenido?: number
          retenido?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "granulometrias_alta_estudio_id_fkey"
            columns: ["alta_estudio_id"]
            isOneToOne: false
            referencedRelation: "alta_estudio"
            referencedColumns: ["id"]
          },
        ]
      }
      id_matrix: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          no_matrix: string
          plant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          no_matrix: string
          plant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          no_matrix?: string
          plant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "id_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "id_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      incidentes_instrumento: {
        Row: {
          created_at: string
          descripcion: string
          estado: string
          evidencia_paths: string[]
          fecha_incidente: string
          id: string
          instrumento_id: string
          programa_id: string | null
          reportado_por: string | null
          resolucion: string | null
          resuelto_en: string | null
          resuelto_por: string | null
          severidad: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion: string
          estado?: string
          evidencia_paths?: string[]
          fecha_incidente: string
          id?: string
          instrumento_id: string
          programa_id?: string | null
          reportado_por?: string | null
          resolucion?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          severidad: string
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          estado?: string
          evidencia_paths?: string[]
          fecha_incidente?: string
          id?: string
          instrumento_id?: string
          programa_id?: string | null
          reportado_por?: string | null
          resolucion?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          severidad?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidentes_instrumento_instrumento_id_fkey"
            columns: ["instrumento_id"]
            isOneToOne: false
            referencedRelation: "instrumentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidentes_instrumento_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programa_calibraciones"
            referencedColumns: ["id"]
          },
        ]
      }
      instrumento_maestro_vinculos: {
        Row: {
          created_at: string
          id: string
          instrumento_id: string
          maestro_id: string
          orden: number
        }
        Insert: {
          created_at?: string
          id?: string
          instrumento_id: string
          maestro_id: string
          orden?: number
        }
        Update: {
          created_at?: string
          id?: string
          instrumento_id?: string
          maestro_id?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "instrumento_maestro_vinculos_instrumento_id_fkey"
            columns: ["instrumento_id"]
            isOneToOne: false
            referencedRelation: "instrumentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrumento_maestro_vinculos_maestro_id_fkey"
            columns: ["maestro_id"]
            isOneToOne: false
            referencedRelation: "instrumentos"
            referencedColumns: ["id"]
          },
        ]
      }
      instrumentos: {
        Row: {
          baja_observaciones: string | null
          codigo: string
          conjunto_id: string
          created_at: string
          created_by: string | null
          estado: string
          fecha_alta: string | null
          fecha_baja: string | null
          fecha_proximo_evento: string | null
          id: string
          incertidumbre_expandida: number | null
          incertidumbre_k: number | null
          incertidumbre_unidad: string | null
          marca: string | null
          mes_fin_servicio_override: number | null
          mes_inicio_servicio_override: number | null
          modelo_comercial: string | null
          motivo_inactivo: string | null
          nombre: string
          notas: string | null
          numero_serie: string | null
          plant_id: string
          tipo: string
          ubicacion_dentro_planta: string | null
          updated_at: string
        }
        Insert: {
          baja_observaciones?: string | null
          codigo: string
          conjunto_id: string
          created_at?: string
          created_by?: string | null
          estado?: string
          fecha_alta?: string | null
          fecha_baja?: string | null
          fecha_proximo_evento?: string | null
          id?: string
          incertidumbre_expandida?: number | null
          incertidumbre_k?: number | null
          incertidumbre_unidad?: string | null
          marca?: string | null
          mes_fin_servicio_override?: number | null
          mes_inicio_servicio_override?: number | null
          modelo_comercial?: string | null
          motivo_inactivo?: string | null
          nombre: string
          notas?: string | null
          numero_serie?: string | null
          plant_id: string
          tipo: string
          ubicacion_dentro_planta?: string | null
          updated_at?: string
        }
        Update: {
          baja_observaciones?: string | null
          codigo?: string
          conjunto_id?: string
          created_at?: string
          created_by?: string | null
          estado?: string
          fecha_alta?: string | null
          fecha_baja?: string | null
          fecha_proximo_evento?: string | null
          id?: string
          incertidumbre_expandida?: number | null
          incertidumbre_k?: number | null
          incertidumbre_unidad?: string | null
          marca?: string | null
          mes_fin_servicio_override?: number | null
          mes_inicio_servicio_override?: number | null
          modelo_comercial?: string | null
          motivo_inactivo?: string | null
          nombre?: string
          notas?: string | null
          numero_serie?: string | null
          plant_id?: string
          tipo?: string
          ubicacion_dentro_planta?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrumentos_modelo_id_fkey"
            columns: ["conjunto_id"]
            isOneToOne: false
            referencedRelation: "conjuntos_herramientas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrumentos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "instrumentos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrumentos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      inventory_documents: {
        Row: {
          adjustment_id: string | null
          created_at: string | null
          document_type: string
          entry_id: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          original_name: string
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          adjustment_id?: string | null
          created_at?: string | null
          document_type: string
          entry_id?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          original_name: string
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          adjustment_id?: string | null
          created_at?: string | null
          document_type?: string
          entry_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          original_name?: string
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_documents_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "material_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_documents_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "material_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_exceptions: {
        Row: {
          created_at: string | null
          description: string | null
          exception_date: string
          exception_type: string
          id: string
          material_id: string | null
          plant_id: string
          requires_manual_review: boolean | null
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          exception_date: string
          exception_type: string
          id?: string
          material_id?: string | null
          plant_id: string
          requires_manual_review?: boolean | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          exception_date?: string
          exception_type?: string
          id?: string
          material_id?: string | null
          plant_id?: string
          requires_manual_review?: boolean | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_exceptions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_exceptions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "inventory_exceptions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_exceptions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "inventory_exceptions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inventory_exceptions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_tokens: {
        Row: {
          client_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          metadata: Json | null
          role: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          role: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          role?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invitation_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invitation_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
        ]
      }
      limites_granulometricos: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id: string
          mallas: Json
          norma_referencia: string | null
          tamaño: string
          tipo_material: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          mallas: Json
          norma_referencia?: string | null
          tamaño: string
          tipo_material: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id?: string
          mallas?: Json
          norma_referencia?: string | null
          tamaño?: string
          tipo_material?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      list_prices: {
        Row: {
          base_price: number
          created_at: string
          created_by: string
          effective_date: string
          expires_at: string | null
          id: string
          is_active: boolean
          master_recipe_id: string
          updated_at: string
        }
        Insert: {
          base_price: number
          created_at?: string
          created_by: string
          effective_date?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          master_recipe_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          created_by?: string
          effective_date?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          master_recipe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "list_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_prices_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["master_id"]
          },
          {
            foreignKeyName: "list_prices_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_prices_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "v_master_recipe_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      location_geocode_cache: {
        Row: {
          administrative_area_level_1: string | null
          administrative_area_level_2: string | null
          country: string | null
          country_code: string | null
          enriched_at: string
          formatted_address: string | null
          locality: string | null
          location_key: string
          place_id: string | null
          postal_code: string | null
          sublocality: string | null
        }
        Insert: {
          administrative_area_level_1?: string | null
          administrative_area_level_2?: string | null
          country?: string | null
          country_code?: string | null
          enriched_at?: string
          formatted_address?: string | null
          locality?: string | null
          location_key: string
          place_id?: string | null
          postal_code?: string | null
          sublocality?: string | null
        }
        Update: {
          administrative_area_level_1?: string | null
          administrative_area_level_2?: string | null
          country?: string | null
          country_code?: string | null
          enriched_at?: string
          formatted_address?: string | null
          locality?: string | null
          location_key?: string
          place_id?: string | null
          postal_code?: string | null
          sublocality?: string | null
        }
        Relationships: []
      }
      mantenimientos_instrumento: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string | null
          fecha_mantenimiento: string
          fecha_proximo_mantenimiento: string | null
          id: string
          instrumento_id: string
          notas: string | null
          realizado_por: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha_mantenimiento: string
          fecha_proximo_mantenimiento?: string | null
          id?: string
          instrumento_id: string
          notas?: string | null
          realizado_por?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha_mantenimiento?: string
          fecha_proximo_mantenimiento?: string | null
          id?: string
          instrumento_id?: string
          notas?: string | null
          realizado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mantenimientos_instrumento_instrumento_id_fkey"
            columns: ["instrumento_id"]
            isOneToOne: false
            referencedRelation: "instrumentos"
            referencedColumns: ["id"]
          },
        ]
      }
      master_recipes: {
        Row: {
          age_days: number | null
          age_hours: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          master_code: string
          max_aggregate_size: number
          placement_type: string
          plant_id: string
          slump: number
          strength_fc: number
          updated_at: string | null
        }
        Insert: {
          age_days?: number | null
          age_hours?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          master_code: string
          max_aggregate_size: number
          placement_type: string
          plant_id: string
          slump: number
          strength_fc: number
          updated_at?: string | null
        }
        Update: {
          age_days?: number | null
          age_hours?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          master_code?: string
          max_aggregate_size?: number
          placement_type?: string
          plant_id?: string
          slump?: number
          strength_fc?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      material_adjustments: {
        Row: {
          adjusted_by: string
          adjustment_date: string
          adjustment_number: string
          adjustment_time: string | null
          adjustment_type: string
          created_at: string | null
          id: string
          inventory_after: number
          inventory_before: number
          material_id: string
          plant_id: string
          quantity_adjusted: number
          reference_notes: string | null
          reference_type: string | null
          updated_at: string | null
        }
        Insert: {
          adjusted_by: string
          adjustment_date: string
          adjustment_number: string
          adjustment_time?: string | null
          adjustment_type: string
          created_at?: string | null
          id?: string
          inventory_after: number
          inventory_before: number
          material_id: string
          plant_id: string
          quantity_adjusted: number
          reference_notes?: string | null
          reference_type?: string | null
          updated_at?: string | null
        }
        Update: {
          adjusted_by?: string
          adjustment_date?: string
          adjustment_number?: string
          adjustment_time?: string | null
          adjustment_type?: string
          created_at?: string | null
          id?: string
          inventory_after?: number
          inventory_before?: number
          material_id?: string
          plant_id?: string
          quantity_adjusted?: number
          reference_notes?: string | null
          reference_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_adjustments_adjusted_by_fkey"
            columns: ["adjusted_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "material_adjustments_adjusted_by_fkey"
            columns: ["adjusted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_adjustments_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_adjustments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_adjustments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_adjustments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      inter_plant_material_transfers: {
        Row: {
          id: string
          material_id: string
          from_plant_id: string
          to_plant_id: string
          quantity_kg: number
          transfer_date: string
          notes: string | null
          created_by: string
          source_adjustment_id: string
          dest_adjustment_id: string
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          from_plant_id: string
          to_plant_id: string
          quantity_kg: number
          transfer_date: string
          notes?: string | null
          created_by: string
          source_adjustment_id: string
          dest_adjustment_id: string
          created_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          from_plant_id?: string
          to_plant_id?: string
          quantity_kg?: number
          transfer_date?: string
          notes?: string | null
          created_by?: string
          source_adjustment_id?: string
          dest_adjustment_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inter_plant_material_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_plant_material_transfers_dest_adjustment_id_fkey"
            columns: ["dest_adjustment_id"]
            isOneToOne: false
            referencedRelation: "material_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_plant_material_transfers_from_plant_id_fkey"
            columns: ["from_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_plant_material_transfers_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_plant_material_transfers_source_adjustment_id_fkey"
            columns: ["source_adjustment_id"]
            isOneToOne: false
            referencedRelation: "material_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_plant_material_transfers_to_plant_id_fkey"
            columns: ["to_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      material_alert_events: {
        Row: {
          alert_id: string
          created_at: string | null
          details: Json | null
          event_type: string
          from_status: string | null
          id: string
          performed_by: string | null
          to_status: string | null
        }
        Insert: {
          alert_id: string
          created_at?: string | null
          details?: Json | null
          event_type: string
          from_status?: string | null
          id?: string
          performed_by?: string | null
          to_status?: string | null
        }
        Update: {
          alert_id?: string
          created_at?: string | null
          details?: Json | null
          event_type?: string
          from_status?: string | null
          id?: string
          performed_by?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_alert_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "material_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alert_events_performed_by_profile_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "material_alert_events_performed_by_profile_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_alerts: {
        Row: {
          alert_number: string
          confirmation_deadline: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          discrepancy_kg: number | null
          discrepancy_notes: string | null
          existing_po_id: string | null
          fleet_notes: string | null
          fleet_po_id: string | null
          id: string
          material_id: string
          needs_fleet: boolean
          physical_count_kg: number | null
          plant_id: string
          reorder_config_id: string | null
          reorder_point_kg: number
          resolved_at: string | null
          resolved_entry_id: string | null
          resolved_lot_id: string | null
          scheduled_at: string | null
          scheduled_by: string | null
          scheduled_delivery_date: string | null
          status: string
          triggered_at: string
          triggered_stock_kg: number
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
        }
        Insert: {
          alert_number: string
          confirmation_deadline?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          discrepancy_kg?: number | null
          discrepancy_notes?: string | null
          existing_po_id?: string | null
          fleet_notes?: string | null
          fleet_po_id?: string | null
          id?: string
          material_id: string
          needs_fleet?: boolean
          physical_count_kg?: number | null
          plant_id: string
          reorder_config_id?: string | null
          reorder_point_kg: number
          resolved_at?: string | null
          resolved_entry_id?: string | null
          resolved_lot_id?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          scheduled_delivery_date?: string | null
          status?: string
          triggered_at?: string
          triggered_stock_kg: number
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Update: {
          alert_number?: string
          confirmation_deadline?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          discrepancy_kg?: number | null
          discrepancy_notes?: string | null
          existing_po_id?: string | null
          fleet_notes?: string | null
          fleet_po_id?: string | null
          id?: string
          material_id?: string
          needs_fleet?: boolean
          physical_count_kg?: number | null
          plant_id?: string
          reorder_config_id?: string | null
          reorder_point_kg?: number
          resolved_at?: string | null
          resolved_entry_id?: string | null
          resolved_lot_id?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          scheduled_delivery_date?: string | null
          status?: string
          triggered_at?: string
          triggered_stock_kg?: number
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_alerts_confirmed_by_profile_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "material_alerts_confirmed_by_profile_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alerts_existing_po_id_fkey"
            columns: ["existing_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alerts_fleet_po_id_fkey"
            columns: ["fleet_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alerts_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alerts_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_alerts_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alerts_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_alerts_reorder_config_id_fkey"
            columns: ["reorder_config_id"]
            isOneToOne: false
            referencedRelation: "material_reorder_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alerts_resolved_entry_id_fkey"
            columns: ["resolved_entry_id"]
            isOneToOne: false
            referencedRelation: "material_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alerts_resolved_lot_id_fkey"
            columns: ["resolved_lot_id"]
            isOneToOne: false
            referencedRelation: "material_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alerts_scheduled_by_profile_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "material_alerts_scheduled_by_profile_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_alerts_validated_by_profile_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "material_alerts_validated_by_profile_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_certificates: {
        Row: {
          certificate_type: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          material_id: string
          notes: string | null
          original_name: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          certificate_type?: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          material_id: string
          notes?: string | null
          original_name: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          certificate_type?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          material_id?: string
          notes?: string | null
          original_name?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_certificates_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_consumption_allocations: {
        Row: {
          consumption_date: string
          cost_basis: string | null
          created_at: string | null
          created_by: string | null
          entry_id: string
          id: string
          lot_id: string | null
          material_id: string
          plant_id: string
          quantity_consumed_kg: number
          remision_id: string
          remision_material_id: string
          total_cost: number
          unit_price: number
        }
        Insert: {
          consumption_date: string
          cost_basis?: string | null
          created_at?: string | null
          created_by?: string | null
          entry_id: string
          id?: string
          lot_id?: string | null
          material_id: string
          plant_id: string
          quantity_consumed_kg: number
          remision_id: string
          remision_material_id: string
          total_cost: number
          unit_price: number
        }
        Update: {
          consumption_date?: string
          cost_basis?: string | null
          created_at?: string | null
          created_by?: string | null
          entry_id?: string
          id?: string
          lot_id?: string | null
          material_id?: string
          plant_id?: string
          quantity_consumed_kg?: number
          remision_id?: string
          remision_material_id?: string
          total_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_consumption_allocations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "material_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_allocations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "material_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_allocations_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_allocations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_consumption_allocations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_allocations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_consumption_allocations_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["remision_id"]
          },
          {
            foreignKeyName: "material_consumption_allocations_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_allocations_remision_material_id_fkey"
            columns: ["remision_material_id"]
            isOneToOne: false
            referencedRelation: "remision_materiales"
            referencedColumns: ["id"]
          },
        ]
      }
      material_entries: {
        Row: {
          ap_due_date_fleet: string | null
          ap_due_date_material: string | null
          created_at: string | null
          driver_name: string | null
          entered_by: string
          entry_date: string
          entry_number: string
          entry_time: string | null
          excluded_from_fifo: boolean
          fleet_cost: number | null
          fleet_invoice: string | null
          fleet_po_id: string | null
          fleet_po_item_id: string | null
          fleet_qty_entered: number | null
          fleet_supplier_id: string | null
          fleet_uom: string | null
          id: string
          inventory_after: number
          inventory_before: number
          landed_unit_price: number | null
          material_id: string
          notes: string | null
          original_unit_price: number | null
          plant_id: string
          po_id: string | null
          po_item_id: string | null
          price_adjusted_at: string | null
          price_adjusted_by: string | null
          pricing_status: string | null
          quantity_received: number
          receipt_document_url: string | null
          received_qty_entered: number | null
          received_qty_kg: number | null
          received_uom: Database["public"]["Enums"]["material_uom"] | null
          remaining_quantity_kg: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          supplier_id: string | null
          supplier_invoice: string | null
          total_cost: number | null
          truck_number: string | null
          unit_price: number | null
          updated_at: string | null
          volumetric_weight_kg_per_m3: number | null
          volumetric_weight_source: string | null
        }
        Insert: {
          ap_due_date_fleet?: string | null
          ap_due_date_material?: string | null
          created_at?: string | null
          driver_name?: string | null
          entered_by: string
          entry_date: string
          entry_number: string
          entry_time?: string | null
          excluded_from_fifo?: boolean
          fleet_cost?: number | null
          fleet_invoice?: string | null
          fleet_po_id?: string | null
          fleet_po_item_id?: string | null
          fleet_qty_entered?: number | null
          fleet_supplier_id?: string | null
          fleet_uom?: string | null
          id?: string
          inventory_after: number
          inventory_before: number
          landed_unit_price?: number | null
          material_id: string
          notes?: string | null
          original_unit_price?: number | null
          plant_id: string
          po_id?: string | null
          po_item_id?: string | null
          price_adjusted_at?: string | null
          price_adjusted_by?: string | null
          pricing_status?: string | null
          quantity_received: number
          receipt_document_url?: string | null
          received_qty_entered?: number | null
          received_qty_kg?: number | null
          received_uom?: Database["public"]["Enums"]["material_uom"] | null
          remaining_quantity_kg?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          supplier_id?: string | null
          supplier_invoice?: string | null
          total_cost?: number | null
          truck_number?: string | null
          unit_price?: number | null
          updated_at?: string | null
          volumetric_weight_kg_per_m3?: number | null
          volumetric_weight_source?: string | null
        }
        Update: {
          ap_due_date_fleet?: string | null
          ap_due_date_material?: string | null
          created_at?: string | null
          driver_name?: string | null
          entered_by?: string
          entry_date?: string
          entry_number?: string
          entry_time?: string | null
          excluded_from_fifo?: boolean
          fleet_cost?: number | null
          fleet_invoice?: string | null
          fleet_po_id?: string | null
          fleet_po_item_id?: string | null
          fleet_qty_entered?: number | null
          fleet_supplier_id?: string | null
          fleet_uom?: string | null
          id?: string
          inventory_after?: number
          inventory_before?: number
          landed_unit_price?: number | null
          material_id?: string
          notes?: string | null
          original_unit_price?: number | null
          plant_id?: string
          po_id?: string | null
          po_item_id?: string | null
          price_adjusted_at?: string | null
          price_adjusted_by?: string | null
          pricing_status?: string | null
          quantity_received?: number
          receipt_document_url?: string | null
          received_qty_entered?: number | null
          received_qty_kg?: number | null
          received_uom?: Database["public"]["Enums"]["material_uom"] | null
          remaining_quantity_kg?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          supplier_id?: string | null
          supplier_invoice?: string | null
          total_cost?: number | null
          truck_number?: string | null
          unit_price?: number | null
          updated_at?: string | null
          volumetric_weight_kg_per_m3?: number | null
          volumetric_weight_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_entries_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "material_entries_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_entries_fleet_po_id_fkey"
            columns: ["fleet_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_entries_fleet_po_item_id_fkey"
            columns: ["fleet_po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_entries_fleet_supplier_id_fkey"
            columns: ["fleet_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_entries_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_entries_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_entries_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_entries_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_entries_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_entries_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_entries_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "material_entries_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_inventory: {
        Row: {
          current_stock: number
          id: string
          last_adjustment_date: string | null
          last_consumption_date: string | null
          last_entry_date: string | null
          material_id: string
          maximum_stock: number | null
          minimum_stock: number
          plant_id: string
          stock_status: string | null
          updated_at: string | null
        }
        Insert: {
          current_stock?: number
          id?: string
          last_adjustment_date?: string | null
          last_consumption_date?: string | null
          last_entry_date?: string | null
          material_id: string
          maximum_stock?: number | null
          minimum_stock?: number
          plant_id: string
          stock_status?: string | null
          updated_at?: string | null
        }
        Update: {
          current_stock?: number
          id?: string
          last_adjustment_date?: string | null
          last_consumption_date?: string | null
          last_entry_date?: string | null
          material_id?: string
          maximum_stock?: number | null
          minimum_stock?: number
          plant_id?: string
          stock_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_inventory_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_inventory_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_inventory_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_inventory_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      material_inventory_backup_20260130: {
        Row: {
          current_stock: number | null
          id: string | null
          last_adjustment_date: string | null
          last_consumption_date: string | null
          last_entry_date: string | null
          material_id: string | null
          maximum_stock: number | null
          minimum_stock: number | null
          plant_id: string | null
          stock_status: string | null
          updated_at: string | null
        }
        Insert: {
          current_stock?: number | null
          id?: string | null
          last_adjustment_date?: string | null
          last_consumption_date?: string | null
          last_entry_date?: string | null
          material_id?: string | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          plant_id?: string | null
          stock_status?: string | null
          updated_at?: string | null
        }
        Update: {
          current_stock?: number | null
          id?: string | null
          last_adjustment_date?: string | null
          last_consumption_date?: string | null
          last_entry_date?: string | null
          material_id?: string | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          plant_id?: string | null
          stock_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      material_lots: {
        Row: {
          created_at: string | null
          entry_id: string
          expiry_date: string | null
          fleet_cost: number | null
          fleet_po_id: string | null
          fleet_po_item_id: string | null
          fleet_unit_cost: number | null
          id: string
          landed_unit_price: number | null
          lot_number: string
          material_id: string
          material_po_id: string | null
          material_po_item_id: string | null
          material_unit_price: number
          notes: string | null
          plant_id: string
          quality_certificate_url: string | null
          quality_status: string | null
          received_qty_kg: number
          remaining_quantity_kg: number | null
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entry_id: string
          expiry_date?: string | null
          fleet_cost?: number | null
          fleet_po_id?: string | null
          fleet_po_item_id?: string | null
          fleet_unit_cost?: number | null
          id?: string
          landed_unit_price?: number | null
          lot_number: string
          material_id: string
          material_po_id?: string | null
          material_po_item_id?: string | null
          material_unit_price?: number
          notes?: string | null
          plant_id: string
          quality_certificate_url?: string | null
          quality_status?: string | null
          received_qty_kg: number
          remaining_quantity_kg?: number | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entry_id?: string
          expiry_date?: string | null
          fleet_cost?: number | null
          fleet_po_id?: string | null
          fleet_po_item_id?: string | null
          fleet_unit_cost?: number | null
          id?: string
          landed_unit_price?: number | null
          lot_number?: string
          material_id?: string
          material_po_id?: string | null
          material_po_item_id?: string | null
          material_unit_price?: number
          notes?: string | null
          plant_id?: string
          quality_certificate_url?: string | null
          quality_status?: string | null
          received_qty_kg?: number
          remaining_quantity_kg?: number | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_lots_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "material_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_lots_fleet_po_id_fkey"
            columns: ["fleet_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_lots_fleet_po_item_id_fkey"
            columns: ["fleet_po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_lots_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_lots_material_po_id_fkey"
            columns: ["material_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_lots_material_po_item_id_fkey"
            columns: ["material_po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_lots_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_lots_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_lots_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_prices: {
        Row: {
          created_at: string | null
          created_by: string | null
          effective_date: string
          end_date: string | null
          id: string
          material_id: string | null
          material_type: string
          period_start: string
          plant_id: string | null
          price_per_unit: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effective_date: string
          end_date?: string | null
          id?: string
          material_id?: string | null
          material_type: string
          period_start: string
          plant_id?: string | null
          price_per_unit: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          end_date?: string | null
          id?: string
          material_id?: string | null
          material_type?: string
          period_start?: string
          plant_id?: string | null
          price_per_unit?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_prices_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_prices_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_prices_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      material_quantities: {
        Row: {
          created_at: string | null
          id: string
          material_id: string | null
          material_type: string
          quantity: number
          recipe_version_id: string | null
          unit: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          material_type: string
          quantity: number
          recipe_version_id?: string | null
          unit: string
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          material_type?: string
          quantity?: number
          recipe_version_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_quantities_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_quantities_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "material_quantities_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_latest_version_summary"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "material_quantities_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      material_reorder_config: {
        Row: {
          configured_at: string | null
          configured_by: string
          id: string
          is_active: boolean | null
          material_id: string
          notes: string | null
          plant_id: string
          reorder_point_kg: number
          reorder_qty_kg: number | null
        }
        Insert: {
          configured_at?: string | null
          configured_by: string
          id?: string
          is_active?: boolean | null
          material_id: string
          notes?: string | null
          plant_id: string
          reorder_point_kg: number
          reorder_qty_kg?: number | null
        }
        Update: {
          configured_at?: string | null
          configured_by?: string
          id?: string
          is_active?: boolean | null
          material_id?: string
          notes?: string | null
          plant_id?: string
          reorder_point_kg?: number
          reorder_qty_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_reorder_config_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_reorder_config_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_reorder_config_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_reorder_config_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      materials: {
        Row: {
          absorption_rate: number | null
          accounting_code: string | null
          aggregate_extraction: string | null
          aggregate_lithology: string | null
          aggregate_size: number | null
          aggregate_type: string | null
          arkik_code: string | null
          arkik_short_code: string | null
          arkik_supplier: string | null
          bulk_density_kg_per_m3: number | null
          category: string
          chemical_composition: Json | null
          created_at: string | null
          density: number | null
          density_kg_per_l: number | null
          fineness_modulus: number | null
          id: string
          is_active: boolean | null
          material_code: string
          material_name: string
          notes: string | null
          physical_properties: Json | null
          plant_id: string | null
          primary_supplier: string | null
          quality_standards: Json | null
          specific_gravity: number | null
          strength_class: string | null
          subcategory: string | null
          supplier_code: string | null
          supplier_id: string | null
          supplier_specifications: Json | null
          unit_of_measure: string
          updated_at: string | null
        }
        Insert: {
          absorption_rate?: number | null
          accounting_code?: string | null
          aggregate_extraction?: string | null
          aggregate_lithology?: string | null
          aggregate_size?: number | null
          aggregate_type?: string | null
          arkik_code?: string | null
          arkik_short_code?: string | null
          arkik_supplier?: string | null
          bulk_density_kg_per_m3?: number | null
          category: string
          chemical_composition?: Json | null
          created_at?: string | null
          density?: number | null
          density_kg_per_l?: number | null
          fineness_modulus?: number | null
          id?: string
          is_active?: boolean | null
          material_code: string
          material_name: string
          notes?: string | null
          physical_properties?: Json | null
          plant_id?: string | null
          primary_supplier?: string | null
          quality_standards?: Json | null
          specific_gravity?: number | null
          strength_class?: string | null
          subcategory?: string | null
          supplier_code?: string | null
          supplier_id?: string | null
          supplier_specifications?: Json | null
          unit_of_measure: string
          updated_at?: string | null
        }
        Update: {
          absorption_rate?: number | null
          accounting_code?: string | null
          aggregate_extraction?: string | null
          aggregate_lithology?: string | null
          aggregate_size?: number | null
          aggregate_type?: string | null
          arkik_code?: string | null
          arkik_short_code?: string | null
          arkik_supplier?: string | null
          bulk_density_kg_per_m3?: number | null
          category?: string
          chemical_composition?: Json | null
          created_at?: string | null
          density?: number | null
          density_kg_per_l?: number | null
          fineness_modulus?: number | null
          id?: string
          is_active?: boolean | null
          material_code?: string
          material_name?: string
          notes?: string | null
          physical_properties?: Json | null
          plant_id?: string | null
          primary_supplier?: string | null
          quality_standards?: Json | null
          specific_gravity?: number | null
          strength_class?: string | null
          subcategory?: string | null
          supplier_code?: string | null
          supplier_id?: string | null
          supplier_specifications?: Json | null
          unit_of_measure?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "materials_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_log: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          migration_name: string
          rollback_sql: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          migration_name: string
          rollback_sql?: string | null
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          migration_name?: string
          rollback_sql?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      muestras: {
        Row: {
          beam_height_cm: number | null
          beam_span_cm: number | null
          beam_width_cm: number | null
          created_at: string | null
          cube_side_cm: number | null
          diameter_cm: number | null
          estado: string
          event_timezone: string | null
          fecha_programada_ensayo: string
          fecha_programada_ensayo_ts: string | null
          id: string
          identificacion: string
          is_edad_garantia: boolean | null
          muestreo_id: string
          plant_id: string | null
          tipo_muestra: string
          updated_at: string | null
        }
        Insert: {
          beam_height_cm?: number | null
          beam_span_cm?: number | null
          beam_width_cm?: number | null
          created_at?: string | null
          cube_side_cm?: number | null
          diameter_cm?: number | null
          estado?: string
          event_timezone?: string | null
          fecha_programada_ensayo: string
          fecha_programada_ensayo_ts?: string | null
          id?: string
          identificacion: string
          is_edad_garantia?: boolean | null
          muestreo_id: string
          plant_id?: string | null
          tipo_muestra: string
          updated_at?: string | null
        }
        Update: {
          beam_height_cm?: number | null
          beam_span_cm?: number | null
          beam_width_cm?: number | null
          created_at?: string | null
          cube_side_cm?: number | null
          diameter_cm?: number | null
          estado?: string
          event_timezone?: string | null
          fecha_programada_ensayo?: string
          fecha_programada_ensayo_ts?: string | null
          id?: string
          identificacion?: string
          is_edad_garantia?: boolean | null
          muestreo_id?: string
          plant_id?: string | null
          tipo_muestra?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "muestras_muestreo_id_fkey"
            columns: ["muestreo_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["muestreo_id"]
          },
          {
            foreignKeyName: "muestras_muestreo_id_fkey"
            columns: ["muestreo_id"]
            isOneToOne: false
            referencedRelation: "mobile_sampling_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestras_muestreo_id_fkey"
            columns: ["muestreo_id"]
            isOneToOne: false
            referencedRelation: "muestreos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestras_muestreo_id_fkey"
            columns: ["muestreo_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestras_muestreo_id_fkey"
            columns: ["muestreo_id"]
            isOneToOne: false
            referencedRelation: "muestreos_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestras_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "muestras_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestras_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      muestras_matrix: {
        Row: {
          beam_height: number | null
          beam_span: number | null
          beam_width: number | null
          cantidad_tiempo: number | null
          contenido_aire: number | null
          created_at: string | null
          created_by: string | null
          cube_medida: number | null
          diametro_cilindro: number | null
          diseño_id: string
          fecha_elaboracion: string
          fecha_ensayo: string | null
          hora_elaboracion: string
          hora_ensayo: string | null
          id: string
          masa_real: number | null
          plant_id: string
          rev_real: number | null
          tipo_muestra: string | null
          unidad_tiempo: string | null
          updated_at: string | null
        }
        Insert: {
          beam_height?: number | null
          beam_span?: number | null
          beam_width?: number | null
          cantidad_tiempo?: number | null
          contenido_aire?: number | null
          created_at?: string | null
          created_by?: string | null
          cube_medida?: number | null
          diametro_cilindro?: number | null
          diseño_id: string
          fecha_elaboracion: string
          fecha_ensayo?: string | null
          hora_elaboracion: string
          hora_ensayo?: string | null
          id?: string
          masa_real?: number | null
          plant_id: string
          rev_real?: number | null
          tipo_muestra?: string | null
          unidad_tiempo?: string | null
          updated_at?: string | null
        }
        Update: {
          beam_height?: number | null
          beam_span?: number | null
          beam_width?: number | null
          cantidad_tiempo?: number | null
          contenido_aire?: number | null
          created_at?: string | null
          created_by?: string | null
          cube_medida?: number | null
          diametro_cilindro?: number | null
          diseño_id?: string
          fecha_elaboracion?: string
          fecha_ensayo?: string | null
          hora_elaboracion?: string
          hora_ensayo?: string | null
          id?: string
          masa_real?: number | null
          plant_id?: string
          rev_real?: number | null
          tipo_muestra?: string | null
          unidad_tiempo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "muestras_matrix_diseño_id_fkey"
            columns: ["diseño_id"]
            isOneToOne: false
            referencedRelation: "diseños_matrix"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestras_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "muestras_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestras_matrix_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      muestreo_instrumentos: {
        Row: {
          completed_verificacion_id: string | null
          created_at: string
          estado_al_momento: string
          fecha_vencimiento_al_momento: string
          id: string
          instrumento_id: string
          instrumento_maestro_snap_id: string | null
          muestreo_id: string
          observaciones: string | null
          paquete_id: string | null
        }
        Insert: {
          completed_verificacion_id?: string | null
          created_at?: string
          estado_al_momento: string
          fecha_vencimiento_al_momento: string
          id?: string
          instrumento_id: string
          instrumento_maestro_snap_id?: string | null
          muestreo_id: string
          observaciones?: string | null
          paquete_id?: string | null
        }
        Update: {
          completed_verificacion_id?: string | null
          created_at?: string
          estado_al_momento?: string
          fecha_vencimiento_al_momento?: string
          id?: string
          instrumento_id?: string
          instrumento_maestro_snap_id?: string | null
          muestreo_id?: string
          observaciones?: string | null
          paquete_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "muestreo_instrumentos_instrumento_id_fkey"
            columns: ["instrumento_id"]
            isOneToOne: false
            referencedRelation: "instrumentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestreo_instrumentos_muestreo_id_fkey"
            columns: ["muestreo_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["muestreo_id"]
          },
          {
            foreignKeyName: "muestreo_instrumentos_muestreo_id_fkey"
            columns: ["muestreo_id"]
            isOneToOne: false
            referencedRelation: "mobile_sampling_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestreo_instrumentos_muestreo_id_fkey"
            columns: ["muestreo_id"]
            isOneToOne: false
            referencedRelation: "muestreos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestreo_instrumentos_muestreo_id_fkey"
            columns: ["muestreo_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestreo_instrumentos_muestreo_id_fkey"
            columns: ["muestreo_id"]
            isOneToOne: false
            referencedRelation: "muestreos_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestreo_instrumentos_paquete_id_fkey"
            columns: ["paquete_id"]
            isOneToOne: false
            referencedRelation: "paquetes_equipo"
            referencedColumns: ["id"]
          },
        ]
      }
      muestreos: {
        Row: {
          concrete_specs: Json | null
          contenido_aire: number | null
          created_at: string | null
          created_by: string | null
          event_timezone: string | null
          fecha_muestreo: string
          fecha_muestreo_ts: string | null
          gps_location: Json | null
          hora_muestreo: string | null
          id: string
          manual_reference: string | null
          masa_unitaria: number | null
          numero_muestreo: number
          offline_created: boolean | null
          plant_id: string | null
          planta: string
          recovery_notes: string | null
          remision_id: string | null
          revenimiento_sitio: number | null
          sampling_notes: string | null
          sampling_type: string | null
          sync_status: string | null
          temperatura_ambiente: number | null
          temperatura_concreto: number | null
          updated_at: string | null
        }
        Insert: {
          concrete_specs?: Json | null
          contenido_aire?: number | null
          created_at?: string | null
          created_by?: string | null
          event_timezone?: string | null
          fecha_muestreo?: string
          fecha_muestreo_ts?: string | null
          gps_location?: Json | null
          hora_muestreo?: string | null
          id?: string
          manual_reference?: string | null
          masa_unitaria?: number | null
          numero_muestreo?: number
          offline_created?: boolean | null
          plant_id?: string | null
          planta: string
          recovery_notes?: string | null
          remision_id?: string | null
          revenimiento_sitio?: number | null
          sampling_notes?: string | null
          sampling_type?: string | null
          sync_status?: string | null
          temperatura_ambiente?: number | null
          temperatura_concreto?: number | null
          updated_at?: string | null
        }
        Update: {
          concrete_specs?: Json | null
          contenido_aire?: number | null
          created_at?: string | null
          created_by?: string | null
          event_timezone?: string | null
          fecha_muestreo?: string
          fecha_muestreo_ts?: string | null
          gps_location?: Json | null
          hora_muestreo?: string | null
          id?: string
          manual_reference?: string | null
          masa_unitaria?: number | null
          numero_muestreo?: number
          offline_created?: boolean | null
          plant_id?: string | null
          planta?: string
          recovery_notes?: string | null
          remision_id?: string | null
          revenimiento_sitio?: number | null
          sampling_notes?: string | null
          sampling_type?: string | null
          sync_status?: string | null
          temperatura_ambiente?: number | null
          temperatura_concreto?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "muestreos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "muestreos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestreos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "muestreos_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["remision_id"]
          },
          {
            foreignKeyName: "muestreos_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
        ]
      }
      muestreos_backup_manual_reference: {
        Row: {
          concrete_specs: Json | null
          created_at: string | null
          created_by: string | null
          event_timezone: string | null
          fecha_muestreo: string | null
          fecha_muestreo_ts: string | null
          gps_location: Json | null
          hora_muestreo: string | null
          id: string | null
          manual_reference: string | null
          masa_unitaria: number | null
          numero_muestreo: number | null
          offline_created: boolean | null
          plant_id: string | null
          planta: string | null
          remision_id: string | null
          revenimiento_sitio: number | null
          sampling_notes: string | null
          sampling_type: string | null
          sync_status: string | null
          temperatura_ambiente: number | null
          temperatura_concreto: number | null
          updated_at: string | null
        }
        Insert: {
          concrete_specs?: Json | null
          created_at?: string | null
          created_by?: string | null
          event_timezone?: string | null
          fecha_muestreo?: string | null
          fecha_muestreo_ts?: string | null
          gps_location?: Json | null
          hora_muestreo?: string | null
          id?: string | null
          manual_reference?: string | null
          masa_unitaria?: number | null
          numero_muestreo?: number | null
          offline_created?: boolean | null
          plant_id?: string | null
          planta?: string | null
          remision_id?: string | null
          revenimiento_sitio?: number | null
          sampling_notes?: string | null
          sampling_type?: string | null
          sync_status?: string | null
          temperatura_ambiente?: number | null
          temperatura_concreto?: number | null
          updated_at?: string | null
        }
        Update: {
          concrete_specs?: Json | null
          created_at?: string | null
          created_by?: string | null
          event_timezone?: string | null
          fecha_muestreo?: string | null
          fecha_muestreo_ts?: string | null
          gps_location?: Json | null
          hora_muestreo?: string | null
          id?: string | null
          manual_reference?: string | null
          masa_unitaria?: number | null
          numero_muestreo?: number | null
          offline_created?: boolean | null
          plant_id?: string | null
          planta?: string | null
          remision_id?: string | null
          revenimiento_sitio?: number | null
          sampling_notes?: string | null
          sampling_type?: string | null
          sync_status?: string | null
          temperatura_ambiente?: number | null
          temperatura_concreto?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      order_additional_products: {
        Row: {
          additional_product_id: string
          created_at: string
          id: string
          notes: string | null
          order_id: string
          quantity: number
          quote_additional_product_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          additional_product_id: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          quantity?: number
          quote_additional_product_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          additional_product_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          quote_additional_product_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_additional_products_additional_product_id_fkey"
            columns: ["additional_product_id"]
            isOneToOne: false
            referencedRelation: "additional_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_additional_products_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_additional_products_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_additional_products_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_additional_products_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_additional_products_quote_additional_product_id_fkey"
            columns: ["quote_additional_product_id"]
            isOneToOne: false
            referencedRelation: "quote_additional_products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_approval_history: {
        Row: {
          action: string
          actioned_by: string
          approval_stage: string
          created_at: string
          id: string
          notes: string | null
          order_id: string
          rejection_reason: string | null
        }
        Insert: {
          action: string
          actioned_by: string
          approval_stage: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          rejection_reason?: string | null
        }
        Update: {
          action?: string
          actioned_by?: string
          approval_stage?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_approval_history_actioned_by_fkey"
            columns: ["actioned_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_approval_history_actioned_by_fkey"
            columns: ["actioned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_approval_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_approval_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_approval_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_approval_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_concrete_evidence: {
        Row: {
          created_at: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          notes: string | null
          order_id: string
          original_name: string
          plant_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          notes?: string | null
          order_id: string
          original_name: string
          plant_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          notes?: string | null
          order_id?: string
          original_name?: string
          plant_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_concrete_evidence_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_concrete_evidence_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_concrete_evidence_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_concrete_evidence_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_creation_debug: {
        Row: {
          created_at: string | null
          debug_message: string | null
          id: number
          order_plant_id: string | null
          quote_id: string | null
          quote_plant_id: string | null
          user_email: string | null
          user_id: string | null
          user_plant_id: string | null
          user_role: string | null
        }
        Insert: {
          created_at?: string | null
          debug_message?: string | null
          id?: number
          order_plant_id?: string | null
          quote_id?: string | null
          quote_plant_id?: string | null
          user_email?: string | null
          user_id?: string | null
          user_plant_id?: string | null
          user_role?: string | null
        }
        Update: {
          created_at?: string | null
          debug_message?: string | null
          id?: number
          order_plant_id?: string | null
          quote_id?: string | null
          quote_plant_id?: string | null
          user_email?: string | null
          user_id?: string | null
          user_plant_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      order_history: {
        Row: {
          client_id: string | null
          concrete_price: number
          concrete_type: string
          created_at: string | null
          credit_validation_status: string | null
          delivery_date: string
          delivery_site: string
          delivery_time: string
          id: string
          location: string
          management_validation_status: string | null
          order_number: string
          pump_price: number | null
          pump_service: string | null
          special_requirements: string | null
          total_amount: number
          volume: number
          week_number: string
        }
        Insert: {
          client_id?: string | null
          concrete_price: number
          concrete_type: string
          created_at?: string | null
          credit_validation_status?: string | null
          delivery_date: string
          delivery_site: string
          delivery_time: string
          id?: string
          location: string
          management_validation_status?: string | null
          order_number: string
          pump_price?: number | null
          pump_service?: string | null
          special_requirements?: string | null
          total_amount: number
          volume: number
          week_number: string
        }
        Update: {
          client_id?: string | null
          concrete_price?: number
          concrete_type?: string
          created_at?: string | null
          credit_validation_status?: string | null
          delivery_date?: string
          delivery_site?: string
          delivery_time?: string
          id?: string
          location?: string
          management_validation_status?: string | null
          order_number?: string
          pump_price?: number | null
          pump_service?: string | null
          special_requirements?: string | null
          total_amount?: number
          volume?: number
          week_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "order_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "order_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
        ]
      }
      order_items: {
        Row: {
          billing_type: Database["public"]["Enums"]["billing_type_enum"] | null
          concrete_volume_delivered: number | null
          created_at: string | null
          empty_truck_price: number | null
          empty_truck_volume: number | null
          has_empty_truck_charge: boolean | null
          has_pump_service: boolean | null
          id: string
          master_recipe_id: string | null
          order_id: string
          product_type: string
          pump_price: number | null
          pump_volume: number | null
          pump_volume_delivered: number | null
          quote_detail_id: string | null
          recipe_id: string | null
          total_price: number
          unit_price: number
          volume: number
        }
        Insert: {
          billing_type?: Database["public"]["Enums"]["billing_type_enum"] | null
          concrete_volume_delivered?: number | null
          created_at?: string | null
          empty_truck_price?: number | null
          empty_truck_volume?: number | null
          has_empty_truck_charge?: boolean | null
          has_pump_service?: boolean | null
          id?: string
          master_recipe_id?: string | null
          order_id: string
          product_type: string
          pump_price?: number | null
          pump_volume?: number | null
          pump_volume_delivered?: number | null
          quote_detail_id?: string | null
          recipe_id?: string | null
          total_price: number
          unit_price: number
          volume: number
        }
        Update: {
          billing_type?: Database["public"]["Enums"]["billing_type_enum"] | null
          concrete_volume_delivered?: number | null
          created_at?: string | null
          empty_truck_price?: number | null
          empty_truck_volume?: number | null
          has_empty_truck_charge?: boolean | null
          has_pump_service?: boolean | null
          id?: string
          master_recipe_id?: string | null
          order_id?: string
          product_type?: string
          pump_price?: number | null
          pump_volume?: number | null
          pump_volume_delivered?: number | null
          quote_detail_id?: string | null
          recipe_id?: string | null
          total_price?: number
          unit_price?: number
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["master_id"]
          },
          {
            foreignKeyName: "order_items_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "v_master_recipe_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_quote_detail_id_fkey"
            columns: ["quote_detail_id"]
            isOneToOne: false
            referencedRelation: "quote_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "order_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "order_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "quality_team_recipes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_location_metadata: {
        Row: {
          administrative_area_level_1: string | null
          administrative_area_level_2: string | null
          country: string | null
          country_code: string | null
          enriched_at: string
          formatted_address: string | null
          id: string
          locality: string | null
          order_id: string
          place_id: string | null
          postal_code: string | null
          sublocality: string | null
        }
        Insert: {
          administrative_area_level_1?: string | null
          administrative_area_level_2?: string | null
          country?: string | null
          country_code?: string | null
          enriched_at?: string
          formatted_address?: string | null
          id?: string
          locality?: string | null
          order_id: string
          place_id?: string | null
          postal_code?: string | null
          sublocality?: string | null
        }
        Update: {
          administrative_area_level_1?: string | null
          administrative_area_level_2?: string | null
          country?: string | null
          country_code?: string | null
          enriched_at?: string
          formatted_address?: string | null
          id?: string
          locality?: string | null
          order_id?: string
          place_id?: string | null
          postal_code?: string | null
          sublocality?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_location_metadata_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_location_metadata_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_location_metadata_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_location_metadata_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_logs: {
        Row: {
          action: string
          action_method: string | null
          created_at: string | null
          details: Json | null
          id: string
          order_id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          action_method?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          order_id: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          action_method?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          order_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notifications: {
        Row: {
          delivery_status: string | null
          id: string
          notification_type: string
          order_id: string
          recipient: string
          sent_at: string | null
        }
        Insert: {
          delivery_status?: string | null
          id?: string
          notification_type: string
          order_id: string
          recipient: string
          sent_at?: string | null
        }
        Update: {
          delivery_status?: string | null
          id?: string
          notification_type?: string
          order_id?: string
          recipient?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_site_validations: {
        Row: {
          created_at: string
          evidence_photo_urls: string[]
          id: string
          order_id: string
          recent_weather_impact: string | null
          road_slope: string | null
          road_type: string | null
          route_incident_history: string | null
          validated_at: string
          validated_by: string | null
          validation_notes: string | null
        }
        Insert: {
          created_at?: string
          evidence_photo_urls?: string[]
          id?: string
          order_id: string
          recent_weather_impact?: string | null
          road_slope?: string | null
          road_type?: string | null
          route_incident_history?: string | null
          validated_at?: string
          validated_by?: string | null
          validation_notes?: string | null
        }
        Update: {
          created_at?: string
          evidence_photo_urls?: string[]
          id?: string
          order_id?: string
          recent_weather_impact?: string | null
          road_slope?: string | null
          road_type?: string | null
          route_incident_history?: string | null
          validated_at?: string
          validated_by?: string | null
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_site_validations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_site_validations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_site_validations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_site_validations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          auto_generated: boolean | null
          client_approval_date: string | null
          client_approval_status: string | null
          client_approved_by: string | null
          client_id: string
          client_rejection_reason: string | null
          comentarios_internos: string | null
          construction_site: string
          construction_site_id: string | null
          created_at: string | null
          created_by: string
          credit_status: string
          credit_validated_by: string | null
          credit_validation_date: string | null
          delivery_date: string
          delivery_google_maps_url: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_time: string
          effective_for_balance: boolean
          elemento: string | null
          final_amount: number | null
          generation_criteria: Json | null
          id: string
          invoice_amount: number | null
          location_data_status: string | null
          order_number: string
          order_status: string
          plant_id: string | null
          preliminary_amount: number
          previous_client_balance: number | null
          quote_id: string
          rejection_reason: string | null
          requires_invoice: boolean
          site_access_rating: string | null
          special_requirements: string | null
          total_amount: number
          updated_at: string | null
          vat_correction_applied: boolean
          vat_correction_at: string | null
          vat_correction_by: string | null
          vat_correction_pct: number | null
        }
        Insert: {
          auto_generated?: boolean | null
          client_approval_date?: string | null
          client_approval_status?: string | null
          client_approved_by?: string | null
          client_id: string
          client_rejection_reason?: string | null
          comentarios_internos?: string | null
          construction_site: string
          construction_site_id?: string | null
          created_at?: string | null
          created_by: string
          credit_status?: string
          credit_validated_by?: string | null
          credit_validation_date?: string | null
          delivery_date: string
          delivery_google_maps_url?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_time: string
          effective_for_balance?: boolean
          elemento?: string | null
          final_amount?: number | null
          generation_criteria?: Json | null
          id?: string
          invoice_amount?: number | null
          location_data_status?: string | null
          order_number: string
          order_status?: string
          plant_id?: string | null
          preliminary_amount?: number
          previous_client_balance?: number | null
          quote_id: string
          rejection_reason?: string | null
          requires_invoice?: boolean
          site_access_rating?: string | null
          special_requirements?: string | null
          total_amount: number
          updated_at?: string | null
          vat_correction_applied?: boolean
          vat_correction_at?: string | null
          vat_correction_by?: string | null
          vat_correction_pct?: number | null
        }
        Update: {
          auto_generated?: boolean | null
          client_approval_date?: string | null
          client_approval_status?: string | null
          client_approved_by?: string | null
          client_id?: string
          client_rejection_reason?: string | null
          comentarios_internos?: string | null
          construction_site?: string
          construction_site_id?: string | null
          created_at?: string | null
          created_by?: string
          credit_status?: string
          credit_validated_by?: string | null
          credit_validation_date?: string | null
          delivery_date?: string
          delivery_google_maps_url?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_time?: string
          effective_for_balance?: boolean
          elemento?: string | null
          final_amount?: number | null
          generation_criteria?: Json | null
          id?: string
          invoice_amount?: number | null
          location_data_status?: string | null
          order_number?: string
          order_status?: string
          plant_id?: string | null
          preliminary_amount?: number
          previous_client_balance?: number | null
          quote_id?: string
          rejection_reason?: string | null
          requires_invoice?: boolean
          site_access_rating?: string | null
          special_requirements?: string | null
          total_amount?: number
          updated_at?: string | null
          vat_correction_applied?: boolean
          vat_correction_at?: string | null
          vat_correction_by?: string | null
          vat_correction_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_approved_by_fkey"
            columns: ["client_approved_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_client_approved_by_fkey"
            columns: ["client_approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "orders_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      paquete_instrumentos: {
        Row: {
          id: string
          instrumento_id: string
          is_required: boolean
          orden: number
          paquete_id: string
        }
        Insert: {
          id?: string
          instrumento_id: string
          is_required?: boolean
          orden?: number
          paquete_id: string
        }
        Update: {
          id?: string
          instrumento_id?: string
          is_required?: boolean
          orden?: number
          paquete_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paquete_instrumentos_instrumento_id_fkey"
            columns: ["instrumento_id"]
            isOneToOne: false
            referencedRelation: "instrumentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paquete_instrumentos_paquete_id_fkey"
            columns: ["paquete_id"]
            isOneToOne: false
            referencedRelation: "paquetes_equipo"
            referencedColumns: ["id"]
          },
        ]
      }
      paquetes_equipo: {
        Row: {
          business_unit_id: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          is_active: boolean
          nombre: string
          plant_id: string | null
          tipo_prueba: string | null
          updated_at: string
        }
        Insert: {
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          is_active?: boolean
          nombre: string
          plant_id?: string | null
          tipo_prueba?: string | null
          updated_at?: string
        }
        Update: {
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          is_active?: boolean
          nombre?: string
          plant_id?: string | null
          tipo_prueba?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paquetes_equipo_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paquetes_equipo_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["business_unit_id"]
          },
          {
            foreignKeyName: "paquetes_equipo_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "paquetes_equipo_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paquetes_equipo_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      payable_items: {
        Row: {
          amount: number
          cost_category: string
          created_at: string
          entry_id: string
          id: string
          payable_id: string
          po_item_id: string | null
        }
        Insert: {
          amount: number
          cost_category: string
          created_at?: string
          entry_id: string
          id?: string
          payable_id: string
          po_item_id?: string | null
        }
        Update: {
          amount?: number
          cost_category?: string
          created_at?: string
          entry_id?: string
          id?: string
          payable_id?: string
          po_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payable_items_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "material_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_items_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          due_date: string
          entry_id: string | null
          id: string
          invoice_date: string | null
          invoice_number: string
          plant_id: string
          status: string
          subtotal: number
          supplier_id: string
          tax: number
          total: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date: string
          entry_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number: string
          plant_id: string
          status?: string
          subtotal?: number
          supplier_id: string
          tax?: number
          total?: number
          vat_rate: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string
          entry_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          plant_id?: string
          status?: string
          subtotal?: number
          supplier_id?: string
          tax?: number
          total?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "payables_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "material_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "payables_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "payables_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          payable_id: string
          payment_date: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          payable_id: string
          payment_date: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          payable_id?: string
          payment_date?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_certificates: {
        Row: {
          certificate_type: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          notes: string | null
          original_name: string | null
          plant_id: string
          uploaded_by: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          certificate_type?: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          notes?: string | null
          original_name?: string | null
          plant_id: string
          uploaded_by: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          certificate_type?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          notes?: string | null
          original_name?: string | null
          plant_id?: string
          uploaded_by?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plant_certificates_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "plant_certificates_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_certificates_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      plant_dossiers: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          notes: string | null
          original_name: string | null
          plant_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          notes?: string | null
          original_name?: string | null
          plant_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          notes?: string | null
          original_name?: string | null
          plant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_dossiers_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "plant_dossiers_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_dossiers_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      plant_financial_analysis_history: {
        Row: {
          consumo_cem_per_m3_kg: number
          costo_cem_per_m3: number
          costo_mp_percent: number
          costo_mp_total_concreto: number
          costo_mp_unitario: number
          created_at: string
          edad_ponderada_dias: number
          fc_ponderada_kg_cm2: number
          id: string
          period_end: string
          period_start: string
          plant_code: string
          plant_id: string
          plant_name: string
          pv_unitario: number
          remisiones_fabricated_count: number
          snapshot_date: string
          spread_unitario: number
          spread_unitario_percent: number
          ventas_total_concreto: number
          volumen_concreto_m3: number
          volumen_producido_m3: number
          volumen_sold_not_fabricated: number
        }
        Insert: {
          consumo_cem_per_m3_kg?: number
          costo_cem_per_m3?: number
          costo_mp_percent?: number
          costo_mp_total_concreto?: number
          costo_mp_unitario?: number
          created_at?: string
          edad_ponderada_dias?: number
          fc_ponderada_kg_cm2?: number
          id?: string
          period_end: string
          period_start: string
          plant_code: string
          plant_id: string
          plant_name: string
          pv_unitario?: number
          remisiones_fabricated_count?: number
          snapshot_date?: string
          spread_unitario?: number
          spread_unitario_percent?: number
          ventas_total_concreto?: number
          volumen_concreto_m3?: number
          volumen_producido_m3?: number
          volumen_sold_not_fabricated?: number
        }
        Update: {
          consumo_cem_per_m3_kg?: number
          costo_cem_per_m3?: number
          costo_mp_percent?: number
          costo_mp_total_concreto?: number
          costo_mp_unitario?: number
          created_at?: string
          edad_ponderada_dias?: number
          fc_ponderada_kg_cm2?: number
          id?: string
          period_end?: string
          period_start?: string
          plant_code?: string
          plant_id?: string
          plant_name?: string
          pv_unitario?: number
          remisiones_fabricated_count?: number
          snapshot_date?: string
          spread_unitario?: number
          spread_unitario_percent?: number
          ventas_total_concreto?: number
          volumen_concreto_m3?: number
          volumen_producido_m3?: number
          volumen_sold_not_fabricated?: number
        }
        Relationships: [
          {
            foreignKeyName: "plant_financial_analysis_history_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "plant_financial_analysis_history_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_financial_analysis_history_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      plant_indirect_material_costs: {
        Row: {
          amount: number
          created_at: string
          id: string
          period_end: string
          period_start: string
          plant_code: string | null
          plant_id: string
          plant_name: string | null
          remisiones_count: number
          source: string
          volumen_m3: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          plant_code?: string | null
          plant_id: string
          plant_name?: string | null
          remisiones_count?: number
          source?: string
          volumen_m3?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          plant_code?: string | null
          plant_id?: string
          plant_name?: string | null
          remisiones_count?: number
          source?: string
          volumen_m3?: number
        }
        Relationships: [
          {
            foreignKeyName: "plant_indirect_material_costs_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "plant_indirect_material_costs_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_indirect_material_costs_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      plant_operating_days: {
        Row: {
          fri: boolean
          mon: boolean
          plant_id: string
          sat: boolean
          sun: boolean
          thu: boolean
          tue: boolean
          updated_at: string | null
          wed: boolean
        }
        Insert: {
          fri?: boolean
          mon?: boolean
          plant_id: string
          sat?: boolean
          sun?: boolean
          thu?: boolean
          tue?: boolean
          updated_at?: string | null
          wed?: boolean
        }
        Update: {
          fri?: boolean
          mon?: boolean
          plant_id?: string
          sat?: boolean
          sun?: boolean
          thu?: boolean
          tue?: boolean
          updated_at?: string | null
          wed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plant_operating_days_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: true
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "plant_operating_days_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: true
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_operating_days_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: true
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      plant_shift_config: {
        Row: {
          end_time: string
          id: string
          is_active: boolean | null
          plant_id: string
          shift_name: string
          start_time: string
        }
        Insert: {
          end_time: string
          id?: string
          is_active?: boolean | null
          plant_id: string
          shift_name: string
          start_time: string
        }
        Update: {
          end_time?: string
          id?: string
          is_active?: boolean | null
          plant_id?: string
          shift_name?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_shift_config_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "plant_shift_config_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_shift_config_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      plant_verifications: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          notes: string | null
          original_name: string | null
          plant_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          notes?: string | null
          original_name?: string | null
          plant_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          notes?: string | null
          original_name?: string | null
          plant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_verifications_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "plant_verifications_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_verifications_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      plants: {
        Row: {
          accounting_concept: string | null
          address: string | null
          business_unit_id: string
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          updated_at: string | null
          warehouse_number: number | null
        }
        Insert: {
          accounting_concept?: string | null
          address?: string | null
          business_unit_id: string
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          updated_at?: string | null
          warehouse_number?: number | null
        }
        Update: {
          accounting_concept?: string | null
          address?: string | null
          business_unit_id?: string
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          updated_at?: string | null
          warehouse_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plants_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plants_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["business_unit_id"]
          },
        ]
      }
      po_item_credit_history: {
        Row: {
          applied_amount: number
          applied_at: string | null
          applied_by: string | null
          cumulative_amount_after: number
          id: string
          notes: string | null
          po_item_id: string
          unit_price_after: number
          unit_price_before: number
        }
        Insert: {
          applied_amount: number
          applied_at?: string | null
          applied_by?: string | null
          cumulative_amount_after: number
          id?: string
          notes?: string | null
          po_item_id: string
          unit_price_after: number
          unit_price_before: number
        }
        Update: {
          applied_amount?: number
          applied_at?: string | null
          applied_by?: string | null
          cumulative_amount_after?: number
          id?: string
          notes?: string | null
          po_item_id?: string
          unit_price_after?: number
          unit_price_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_item_credit_history_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          age_days: number
          approval_date: string | null
          base_price: number
          client_id: string | null
          code: string
          construction_site: string | null
          created_at: string | null
          description: string
          effective_date: string
          fc_mr_value: number
          id: string
          is_active: boolean | null
          master_recipe_id: string | null
          max_aggregate_size: number
          original_recipe_id: string | null
          placement_type: string
          plant_id: string | null
          quote_id: string | null
          recipe_id: string | null
          slump: number
          type: string
          updated_at: string | null
        }
        Insert: {
          age_days: number
          approval_date?: string | null
          base_price: number
          client_id?: string | null
          code: string
          construction_site?: string | null
          created_at?: string | null
          description: string
          effective_date: string
          fc_mr_value: number
          id?: string
          is_active?: boolean | null
          master_recipe_id?: string | null
          max_aggregate_size: number
          original_recipe_id?: string | null
          placement_type: string
          plant_id?: string | null
          quote_id?: string | null
          recipe_id?: string | null
          slump: number
          type: string
          updated_at?: string | null
        }
        Update: {
          age_days?: number
          approval_date?: string | null
          base_price?: number
          client_id?: string | null
          code?: string
          construction_site?: string | null
          created_at?: string | null
          description?: string
          effective_date?: string
          fc_mr_value?: number
          id?: string
          is_active?: boolean | null
          master_recipe_id?: string | null
          max_aggregate_size?: number
          original_recipe_id?: string | null
          placement_type?: string
          plant_id?: string | null
          quote_id?: string | null
          recipe_id?: string | null
          slump?: number
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "product_prices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "product_prices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "product_prices_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["master_id"]
          },
          {
            foreignKeyName: "product_prices_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "v_master_recipe_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_original_recipe_id_fkey"
            columns: ["original_recipe_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "product_prices_original_recipe_id_fkey"
            columns: ["original_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "product_prices_original_recipe_id_fkey"
            columns: ["original_recipe_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "product_prices_original_recipe_id_fkey"
            columns: ["original_recipe_id"]
            isOneToOne: false
            referencedRelation: "quality_team_recipes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_original_recipe_id_fkey"
            columns: ["original_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "product_prices_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "product_prices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "product_prices_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "product_prices_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "product_prices_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "quality_team_recipes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_calibraciones: {
        Row: {
          certificado_id: string | null
          completado_en: string | null
          completado_por: string | null
          created_at: string
          estado: string
          fecha_programada: string
          id: string
          instrumento_id: string
          notas: string | null
          notif_1dia_enviada: boolean
          notif_7dias_enviada: boolean
          roles_notificar: string[]
          tipo_evento: string
          updated_at: string
          verificacion_id: string | null
        }
        Insert: {
          certificado_id?: string | null
          completado_en?: string | null
          completado_por?: string | null
          created_at?: string
          estado?: string
          fecha_programada: string
          id?: string
          instrumento_id: string
          notas?: string | null
          notif_1dia_enviada?: boolean
          notif_7dias_enviada?: boolean
          roles_notificar?: string[]
          tipo_evento: string
          updated_at?: string
          verificacion_id?: string | null
        }
        Update: {
          certificado_id?: string | null
          completado_en?: string | null
          completado_por?: string | null
          created_at?: string
          estado?: string
          fecha_programada?: string
          id?: string
          instrumento_id?: string
          notas?: string | null
          notif_1dia_enviada?: boolean
          notif_7dias_enviada?: boolean
          roles_notificar?: string[]
          tipo_evento?: string
          updated_at?: string
          verificacion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programa_calibraciones_certificado_id_fkey"
            columns: ["certificado_id"]
            isOneToOne: false
            referencedRelation: "certificados_calibracion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_calibraciones_instrumento_id_fkey"
            columns: ["instrumento_id"]
            isOneToOne: false
            referencedRelation: "instrumentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_calibraciones_verificacion_id_fkey"
            columns: ["verificacion_id"]
            isOneToOne: false
            referencedRelation: "completed_verificaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          credit_amount: number | null
          credit_applied_at: string | null
          credit_applied_by: string | null
          credit_notes: string | null
          id: string
          is_service: boolean
          material_id: string | null
          material_supplier_id: string | null
          original_unit_price: number | null
          po_id: string
          qty_ordered: number
          qty_received: number
          qty_received_kg: number
          qty_received_native: number
          qty_remaining: number | null
          required_by: string | null
          service_description: string | null
          status: string
          unit_price: number
          uom: Database["public"]["Enums"]["material_uom"] | null
          volumetric_weight_kg_per_m3: number | null
        }
        Insert: {
          created_at?: string
          credit_amount?: number | null
          credit_applied_at?: string | null
          credit_applied_by?: string | null
          credit_notes?: string | null
          id?: string
          is_service?: boolean
          material_id?: string | null
          material_supplier_id?: string | null
          original_unit_price?: number | null
          po_id: string
          qty_ordered: number
          qty_received?: number
          qty_received_kg?: number
          qty_received_native?: number
          qty_remaining?: number | null
          required_by?: string | null
          service_description?: string | null
          status?: string
          unit_price: number
          uom?: Database["public"]["Enums"]["material_uom"] | null
          volumetric_weight_kg_per_m3?: number | null
        }
        Update: {
          created_at?: string
          credit_amount?: number | null
          credit_applied_at?: string | null
          credit_applied_by?: string | null
          credit_notes?: string | null
          id?: string
          is_service?: boolean
          material_id?: string | null
          material_supplier_id?: string | null
          original_unit_price?: number | null
          po_id?: string
          qty_ordered?: number
          qty_received?: number
          qty_received_kg?: number
          qty_received_native?: number
          qty_remaining?: number | null
          required_by?: string | null
          service_description?: string | null
          status?: string
          unit_price?: number
          uom?: Database["public"]["Enums"]["material_uom"] | null
          volumetric_weight_kg_per_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_material_supplier_id_fkey"
            columns: ["material_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          notes: string | null
          payment_terms_days: number | null
          plant_id: string
          po_date: string | null
          po_number: string | null
          status: string
          supplier_id: string
        }
        Insert: {
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          notes?: string | null
          payment_terms_days?: number | null
          plant_id: string
          po_date?: string | null
          po_number?: string | null
          status?: string
          supplier_id: string
        }
        Update: {
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          notes?: string | null
          payment_terms_days?: number | null
          plant_id?: string
          po_date?: string | null
          po_number?: string | null
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_notification_queue: {
        Row: {
          created_at: string | null
          estado: string
          fecha_envio_timestamp_utc: string | null
          fecha_programada_envio: string
          id: string
          intentos: number
          mensaje_error: string | null
          muestra_id: string
          plant_id: string | null
          timezone_local: string | null
          tipo_notificacion: string | null
          ultimo_intento: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: string
          fecha_envio_timestamp_utc?: string | null
          fecha_programada_envio: string
          id?: string
          intentos?: number
          mensaje_error?: string | null
          muestra_id: string
          plant_id?: string | null
          timezone_local?: string | null
          tipo_notificacion?: string | null
          ultimo_intento?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: string
          fecha_envio_timestamp_utc?: string | null
          fecha_programada_envio?: string
          id?: string
          intentos?: number
          mensaje_error?: string | null
          muestra_id?: string
          plant_id?: string | null
          timezone_local?: string | null
          tipo_notificacion?: string | null
          ultimo_intento?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_notification_queue_muestra_id_fkey"
            columns: ["muestra_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["muestra_id"]
          },
          {
            foreignKeyName: "quality_notification_queue_muestra_id_fkey"
            columns: ["muestra_id"]
            isOneToOne: false
            referencedRelation: "muestras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_notification_queue_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "quality_notification_queue_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_notification_queue_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      quote_action_tokens: {
        Row: {
          approve_token: string
          created_at: string
          expires_at: string
          id: string
          quote_id: string
          recipient_email: string
          reject_token: string
        }
        Insert: {
          approve_token: string
          created_at?: string
          expires_at: string
          id?: string
          quote_id: string
          recipient_email: string
          reject_token: string
        }
        Update: {
          approve_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          quote_id?: string
          recipient_email?: string
          reject_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_action_tokens_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_additional_products: {
        Row: {
          additional_product_id: string
          base_price: number
          billing_type: Database["public"]["Enums"]["billing_type_enum"]
          created_at: string
          id: string
          margin_percentage: number | null
          notes: string | null
          quantity: number
          quote_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          additional_product_id: string
          base_price: number
          billing_type?: Database["public"]["Enums"]["billing_type_enum"]
          created_at?: string
          id?: string
          margin_percentage?: number | null
          notes?: string | null
          quantity?: number
          quote_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          additional_product_id?: string
          base_price?: number
          billing_type?: Database["public"]["Enums"]["billing_type_enum"]
          created_at?: string
          id?: string
          margin_percentage?: number | null
          notes?: string | null
          quantity?: number
          quote_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_additional_products_additional_product_id_fkey"
            columns: ["additional_product_id"]
            isOneToOne: false
            referencedRelation: "additional_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_additional_products_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_details: {
        Row: {
          base_price: number
          created_at: string | null
          final_price: number
          id: string
          includes_vat: boolean
          master_recipe_id: string | null
          pricing_path: string | null
          product_id: string | null
          profit_margin: number
          pump_price: number | null
          pump_service: boolean | null
          quote_id: string | null
          recipe_id: string | null
          total_amount: number
          volume: number
        }
        Insert: {
          base_price: number
          created_at?: string | null
          final_price: number
          id?: string
          includes_vat?: boolean
          master_recipe_id?: string | null
          pricing_path?: string | null
          product_id?: string | null
          profit_margin: number
          pump_price?: number | null
          pump_service?: boolean | null
          quote_id?: string | null
          recipe_id?: string | null
          total_amount: number
          volume: number
        }
        Update: {
          base_price?: number
          created_at?: string | null
          final_price?: number
          id?: string
          includes_vat?: boolean
          master_recipe_id?: string | null
          pricing_path?: string | null
          product_id?: string | null
          profit_margin?: number
          pump_price?: number | null
          pump_service?: boolean | null
          quote_id?: string | null
          recipe_id?: string | null
          total_amount?: number
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_details_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["master_id"]
          },
          {
            foreignKeyName: "quote_details_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_details_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "v_master_recipe_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_details_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_details_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_details_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "quote_details_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "quote_details_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "quote_details_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "quality_team_recipes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_details_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_notifications: {
        Row: {
          delivery_status: string
          id: string
          notification_type: string
          quote_id: string
          recipient: string
          sent_at: string | null
        }
        Insert: {
          delivery_status?: string
          id?: string
          notification_type: string
          quote_id: string
          recipient: string
          sent_at?: string | null
        }
        Update: {
          delivery_status?: string
          id?: string
          notification_type?: string
          quote_id?: string
          recipient?: string
          sent_at?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          auto_approved: boolean | null
          bloque_number: number | null
          client_id: string | null
          construction_site: string
          construction_site_id: string | null
          created_at: string | null
          created_by: string
          distance_km: number | null
          distance_range_code: string | null
          id: string
          is_active: boolean | null
          location: string
          margin_percentage: number | null
          plant_id: string | null
          quote_number: string
          rejection_date: string | null
          rejection_reason: string | null
          status: string
          total_per_trip: number | null
          transport_cost_per_m3: number | null
          updated_at: string | null
          validity_date: string
        }
        Insert: {
          approval_date?: string | null
          approved_by?: string | null
          auto_approved?: boolean | null
          bloque_number?: number | null
          client_id?: string | null
          construction_site: string
          construction_site_id?: string | null
          created_at?: string | null
          created_by: string
          distance_km?: number | null
          distance_range_code?: string | null
          id?: string
          is_active?: boolean | null
          location: string
          margin_percentage?: number | null
          plant_id?: string | null
          quote_number: string
          rejection_date?: string | null
          rejection_reason?: string | null
          status?: string
          total_per_trip?: number | null
          transport_cost_per_m3?: number | null
          updated_at?: string | null
          validity_date: string
        }
        Update: {
          approval_date?: string | null
          approved_by?: string | null
          auto_approved?: boolean | null
          bloque_number?: number | null
          client_id?: string | null
          construction_site?: string
          construction_site_id?: string | null
          created_at?: string | null
          created_by?: string
          distance_km?: number | null
          distance_range_code?: string | null
          id?: string
          is_active?: boolean | null
          location?: string
          margin_percentage?: number | null
          plant_id?: string | null
          quote_number?: string
          rejection_date?: string | null
          rejection_reason?: string | null
          status?: string
          total_per_trip?: number | null
          transport_cost_per_m3?: number | null
          updated_at?: string | null
          validity_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quotes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_balances_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "quotes_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "quotes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      recipe_code_backup: {
        Row: {
          backed_up_at: string
          id: string
          old_code: string
          plant_id: string
        }
        Insert: {
          backed_up_at?: string
          id: string
          old_code: string
          plant_id: string
        }
        Update: {
          backed_up_at?: string
          id?: string
          old_code?: string
          plant_id?: string
        }
        Relationships: []
      }
      recipe_reference_materials: {
        Row: {
          created_at: string | null
          id: string
          material_id: string | null
          material_type: string
          recipe_version_id: string
          sss_value: number
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          material_type: string
          recipe_version_id: string
          sss_value: number
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          material_type?: string
          recipe_version_id?: string
          sss_value?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_reference_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_reference_materials_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "recipe_reference_materials_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_latest_version_summary"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "recipe_reference_materials_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_versions: {
        Row: {
          created_at: string | null
          effective_date: string
          id: string
          is_current: boolean | null
          loaded_to_arkik: boolean | null
          loaded_to_k2: boolean | null
          notes: string | null
          recipe_id: string | null
          version_number: number
        }
        Insert: {
          created_at?: string | null
          effective_date: string
          id?: string
          is_current?: boolean | null
          loaded_to_arkik?: boolean | null
          loaded_to_k2?: boolean | null
          notes?: string | null
          recipe_id?: string | null
          version_number: number
        }
        Update: {
          created_at?: string | null
          effective_date?: string
          id?: string
          is_current?: boolean | null
          loaded_to_arkik?: boolean | null
          loaded_to_k2?: boolean | null
          notes?: string | null
          recipe_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "quality_team_recipes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          age_days: number
          age_hours: number | null
          application_type: string | null
          arkik_contenido_aire: number | null
          arkik_factor_g: number | null
          arkik_long_code: string | null
          arkik_num: string | null
          arkik_short_code: string | null
          arkik_type_code: string | null
          arkik_variante: string | null
          arkik_volumen_concreto: number | null
          coding_system: string | null
          created_at: string | null
          has_waterproofing: boolean | null
          id: string
          master_recipe_id: string | null
          max_aggregate_size: number
          new_system_code: string | null
          performance_grade: string | null
          placement_type: string
          plant_id: string | null
          recipe_code: string
          slump: number
          special_properties: Json | null
          strength_fc: number
          updated_at: string | null
          variant_suffix: string | null
        }
        Insert: {
          age_days: number
          age_hours?: number | null
          application_type?: string | null
          arkik_contenido_aire?: number | null
          arkik_factor_g?: number | null
          arkik_long_code?: string | null
          arkik_num?: string | null
          arkik_short_code?: string | null
          arkik_type_code?: string | null
          arkik_variante?: string | null
          arkik_volumen_concreto?: number | null
          coding_system?: string | null
          created_at?: string | null
          has_waterproofing?: boolean | null
          id?: string
          master_recipe_id?: string | null
          max_aggregate_size: number
          new_system_code?: string | null
          performance_grade?: string | null
          placement_type: string
          plant_id?: string | null
          recipe_code: string
          slump: number
          special_properties?: Json | null
          strength_fc: number
          updated_at?: string | null
          variant_suffix?: string | null
        }
        Update: {
          age_days?: number
          age_hours?: number | null
          application_type?: string | null
          arkik_contenido_aire?: number | null
          arkik_factor_g?: number | null
          arkik_long_code?: string | null
          arkik_num?: string | null
          arkik_short_code?: string | null
          arkik_type_code?: string | null
          arkik_variante?: string | null
          arkik_volumen_concreto?: number | null
          coding_system?: string | null
          created_at?: string | null
          has_waterproofing?: boolean | null
          id?: string
          master_recipe_id?: string | null
          max_aggregate_size?: number
          new_system_code?: string | null
          performance_grade?: string | null
          placement_type?: string
          plant_id?: string | null
          recipe_code?: string
          slump?: number
          special_properties?: Json | null
          strength_fc?: number
          updated_at?: string | null
          variant_suffix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["master_id"]
          },
          {
            foreignKeyName: "recipes_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "v_master_recipe_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      release_announcement_views: {
        Row: {
          id: string
          release_version: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          release_version: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          release_version?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      remision_documents: {
        Row: {
          created_at: string
          document_category: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          original_name: string
          remision_id: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          document_category?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          original_name: string
          remision_id?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          document_category?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          original_name?: string
          remision_id?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "remision_documents_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["remision_id"]
          },
          {
            foreignKeyName: "remision_documents_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
        ]
      }
      remision_materiales: {
        Row: {
          ajuste: number | null
          cantidad_real: number | null
          cantidad_teorica: number | null
          fifo_allocated_at: string | null
          id: string
          material_id: string | null
          material_type: string
          remision_id: string
          total_cost_fifo: number | null
          unit_cost_weighted: number | null
        }
        Insert: {
          ajuste?: number | null
          cantidad_real?: number | null
          cantidad_teorica?: number | null
          fifo_allocated_at?: string | null
          id?: string
          material_id?: string | null
          material_type: string
          remision_id: string
          total_cost_fifo?: number | null
          unit_cost_weighted?: number | null
        }
        Update: {
          ajuste?: number | null
          cantidad_real?: number | null
          cantidad_teorica?: number | null
          fifo_allocated_at?: string | null
          id?: string
          material_id?: string | null
          material_type?: string
          remision_id?: string
          total_cost_fifo?: number | null
          unit_cost_weighted?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "remision_materiales_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remision_materiales_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["remision_id"]
          },
          {
            foreignKeyName: "remision_materiales_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
        ]
      }
      remision_materiales_duplicates_backup: {
        Row: {
          ajuste: number | null
          backup_timestamp: string | null
          cantidad_real: number | null
          cantidad_teorica: number | null
          duplicate_rank: number | null
          fecha: string | null
          id: string | null
          material_id: string | null
          material_type: string | null
          remision_id: string | null
          remision_number: string | null
        }
        Insert: {
          ajuste?: number | null
          backup_timestamp?: string | null
          cantidad_real?: number | null
          cantidad_teorica?: number | null
          duplicate_rank?: number | null
          fecha?: string | null
          id?: string | null
          material_id?: string | null
          material_type?: string | null
          remision_id?: string | null
          remision_number?: string | null
        }
        Update: {
          ajuste?: number | null
          backup_timestamp?: string | null
          cantidad_real?: number | null
          cantidad_teorica?: number | null
          duplicate_rank?: number | null
          fecha?: string | null
          id?: string | null
          material_id?: string | null
          material_type?: string | null
          remision_id?: string | null
          remision_number?: string | null
        }
        Relationships: []
      }
      remision_productos_adicionales: {
        Row: {
          cantidad: number
          created_at: string | null
          descripcion: string
          id: string
          precio_unitario: number
          remision_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string | null
          descripcion: string
          id?: string
          precio_unitario: number
          remision_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          descripcion?: string
          id?: string
          precio_unitario?: number
          remision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remision_productos_adicionales_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["remision_id"]
          },
          {
            foreignKeyName: "remision_productos_adicionales_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
        ]
      }
      remision_reassignments: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          materials_transferred: Json
          plant_id: string
          reason: string
          session_id: string
          source_remision_id: string | null
          source_remision_number: string
          target_remision_id: string | null
          target_remision_number: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          materials_transferred?: Json
          plant_id: string
          reason: string
          session_id: string
          source_remision_id?: string | null
          source_remision_number: string
          target_remision_id?: string | null
          target_remision_number: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          materials_transferred?: Json
          plant_id?: string
          reason?: string
          session_id?: string
          source_remision_id?: string | null
          source_remision_number?: string
          target_remision_id?: string | null
          target_remision_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remision_reassignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "remision_reassignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remision_reassignments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "remision_reassignments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remision_reassignments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      remisiones: {
        Row: {
          cancelled_reason: string | null
          conductor: string | null
          created_at: string | null
          created_by: string | null
          cross_plant_billing_plant_id: string | null
          cross_plant_billing_remision_id: string | null
          designacion_ehe: string | null
          fecha: string
          fifo_status: string | null
          hora_carga: string
          id: string
          is_production_record: boolean
          master_recipe_id: string | null
          order_id: string | null
          plant_id: string | null
          recipe_id: string | null
          remision_number: string
          tipo_remision: string
          unidad: string | null
          volumen_fabricado: number
        }
        Insert: {
          cancelled_reason?: string | null
          conductor?: string | null
          created_at?: string | null
          created_by?: string | null
          cross_plant_billing_plant_id?: string | null
          cross_plant_billing_remision_id?: string | null
          designacion_ehe?: string | null
          fecha: string
          fifo_status?: string | null
          hora_carga: string
          id?: string
          is_production_record?: boolean
          master_recipe_id?: string | null
          order_id?: string | null
          plant_id?: string | null
          recipe_id?: string | null
          remision_number: string
          tipo_remision: string
          unidad?: string | null
          volumen_fabricado: number
        }
        Update: {
          cancelled_reason?: string | null
          conductor?: string | null
          created_at?: string | null
          created_by?: string | null
          cross_plant_billing_plant_id?: string | null
          cross_plant_billing_remision_id?: string | null
          designacion_ehe?: string | null
          fecha?: string
          fifo_status?: string | null
          hora_carga?: string
          id?: string
          is_production_record?: boolean
          master_recipe_id?: string | null
          order_id?: string | null
          plant_id?: string | null
          recipe_id?: string | null
          remision_number?: string
          tipo_remision?: string
          unidad?: string | null
          volumen_fabricado?: number
        }
        Relationships: [
          {
            foreignKeyName: "remisiones_cross_plant_billing_plant_id_fkey"
            columns: ["cross_plant_billing_plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "remisiones_cross_plant_billing_plant_id_fkey"
            columns: ["cross_plant_billing_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_cross_plant_billing_plant_id_fkey"
            columns: ["cross_plant_billing_plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "remisiones_cross_plant_billing_remision_id_fkey"
            columns: ["cross_plant_billing_remision_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["remision_id"]
          },
          {
            foreignKeyName: "remisiones_cross_plant_billing_remision_id_fkey"
            columns: ["cross_plant_billing_remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["master_id"]
          },
          {
            foreignKeyName: "remisiones_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "v_master_recipe_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "remisiones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "remisiones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "remisiones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "remisiones_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "remisiones_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "remisiones_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "remisiones_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "quality_team_recipes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      site_checks: {
        Row: {
          created_at: string
          created_by: string | null
          detalle_ajuste: string | null
          fecha_muestreo: string
          fue_ajustado: boolean
          hora_llegada_obra: string | null
          hora_salida_planta: string | null
          id: string
          observaciones: string | null
          plant_id: string
          remision_id: string | null
          remision_number_manual: string
          temperatura_ambiente: number | null
          temperatura_concreto: number | null
          test_type: string
          updated_at: string
          valor_final_cm: number | null
          valor_inicial_cm: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detalle_ajuste?: string | null
          fecha_muestreo?: string
          fue_ajustado?: boolean
          hora_llegada_obra?: string | null
          hora_salida_planta?: string | null
          id?: string
          observaciones?: string | null
          plant_id: string
          remision_id?: string | null
          remision_number_manual: string
          temperatura_ambiente?: number | null
          temperatura_concreto?: number | null
          test_type: string
          updated_at?: string
          valor_final_cm?: number | null
          valor_inicial_cm?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detalle_ajuste?: string | null
          fecha_muestreo?: string
          fue_ajustado?: boolean
          hora_llegada_obra?: string | null
          hora_salida_planta?: string | null
          id?: string
          observaciones?: string | null
          plant_id?: string
          remision_id?: string | null
          remision_number_manual?: string
          temperatura_ambiente?: number | null
          temperatura_concreto?: number | null
          test_type?: string
          updated_at?: string
          valor_final_cm?: number | null
          valor_inicial_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "site_checks_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "site_checks_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_checks_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "site_checks_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["remision_id"]
          },
          {
            foreignKeyName: "site_checks_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
        ]
      }
      specimen_type_specs: {
        Row: {
          correction_factor: number
          created_at: string | null
          description: string | null
          dimension_key: string
          dimension_label: string
          id: string
          is_default: boolean
          tipo_muestra: string
          updated_at: string | null
        }
        Insert: {
          correction_factor?: number
          created_at?: string | null
          description?: string | null
          dimension_key: string
          dimension_label: string
          id?: string
          is_default?: boolean
          tipo_muestra: string
          updated_at?: string | null
        }
        Update: {
          correction_factor?: number
          created_at?: string | null
          description?: string | null
          dimension_key?: string
          dimension_label?: string
          id?: string
          is_default?: boolean
          tipo_muestra?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier_agreements: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_service: boolean
          material_id: string | null
          plant_id: string | null
          supplier_id: string
          vat_rate: number | null
          volumetric_weight_kg_per_m3: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          is_service: boolean
          material_id?: string | null
          plant_id?: string | null
          supplier_id: string
          vat_rate?: number | null
          volumetric_weight_kg_per_m3?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_service?: boolean
          material_id?: string | null
          plant_id?: string | null
          supplier_id?: string
          vat_rate?: number | null
          volumetric_weight_kg_per_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_agreements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_agreements_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "supplier_agreements_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_agreements_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "supplier_agreements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          default_payment_terms_days: number | null
          id: string
          internal_code: string | null
          is_active: boolean
          name: string
          plant_id: string | null
          provider_letter: string | null
          provider_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_payment_terms_days?: number | null
          id?: string
          internal_code?: string | null
          is_active?: boolean
          name: string
          plant_id?: string | null
          provider_letter?: string | null
          provider_number: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_payment_terms_days?: number | null
          id?: string
          internal_code?: string | null
          is_active?: boolean
          name?: string
          plant_id?: string | null
          provider_letter?: string | null
          provider_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "suppliers_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      system_audit_log: {
        Row: {
          execution_date: string | null
          execution_time_ms: number | null
          id: string
          notes: string | null
          process_name: string
          records_affected: number | null
          success: boolean | null
        }
        Insert: {
          execution_date?: string | null
          execution_time_ms?: number | null
          id?: string
          notes?: string | null
          process_name: string
          records_affected?: number | null
          success?: boolean | null
        }
        Update: {
          execution_date?: string | null
          execution_time_ms?: number | null
          id?: string
          notes?: string | null
          process_name?: string
          records_affected?: number | null
          success?: boolean | null
        }
        Relationships: []
      }
      system_notifications: {
        Row: {
          created_at: string | null
          delivery_status: string
          details: Json | null
          id: string
          notification_type: string
          recipient: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_status: string
          details?: Json | null
          id?: string
          notification_type: string
          recipient: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_status?: string
          details?: Json | null
          id?: string
          notification_type?: string
          recipient?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      trigger_execution_log: {
        Row: {
          details: Json | null
          execution_time: string | null
          id: number
          operation: string | null
          record_id: string | null
          table_name: string | null
          trigger_name: string | null
        }
        Insert: {
          details?: Json | null
          execution_time?: string | null
          id?: number
          operation?: string | null
          record_id?: string | null
          table_name?: string | null
          trigger_name?: string | null
        }
        Update: {
          details?: Json | null
          execution_time?: string | null
          id?: number
          operation?: string | null
          record_id?: string | null
          table_name?: string | null
          trigger_name?: string | null
        }
        Relationships: []
      }
      trigger_log: {
        Row: {
          action: string
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          trigger_timestamp: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          trigger_timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          trigger_timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          business_unit_id: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean | null
          is_portal_user: boolean
          last_name: string | null
          plant_id: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          business_unit_id?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id: string
          is_active?: boolean | null
          is_portal_user?: boolean
          last_name?: string | null
          plant_id?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          business_unit_id?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          is_portal_user?: boolean
          last_name?: string | null
          plant_id?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["business_unit_id"]
          },
          {
            foreignKeyName: "user_profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "user_profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      verificacion_evidence: {
        Row: {
          caption: string | null
          completed_id: string
          id: string
          mime_type: string | null
          section_id: string | null
          section_repeticion: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          completed_id: string
          id?: string
          mime_type?: string | null
          section_id?: string | null
          section_repeticion?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          completed_id?: string
          id?: string
          mime_type?: string | null
          section_id?: string | null
          section_repeticion?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verificacion_evidence_completed_id_fkey"
            columns: ["completed_id"]
            isOneToOne: false
            referencedRelation: "completed_verificaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacion_issues: {
        Row: {
          completed_id: string
          created_at: string
          created_by: string | null
          descripcion: string
          estado: string
          id: string
          measurement_id: string | null
          resuelto_at: string | null
          resuelto_por: string | null
          severidad: string | null
        }
        Insert: {
          completed_id: string
          created_at?: string
          created_by?: string | null
          descripcion: string
          estado?: string
          id?: string
          measurement_id?: string | null
          resuelto_at?: string | null
          resuelto_por?: string | null
          severidad?: string | null
        }
        Update: {
          completed_id?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string
          estado?: string
          id?: string
          measurement_id?: string | null
          resuelto_at?: string | null
          resuelto_por?: string | null
          severidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verificacion_issues_completed_id_fkey"
            columns: ["completed_id"]
            isOneToOne: false
            referencedRelation: "completed_verificaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verificacion_issues_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "completed_verificacion_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacion_signatures: {
        Row: {
          completed_id: string
          id: string
          rol: string
          signature_storage_path: string
          signed_at: string
          signer_name: string
          signer_user_id: string
        }
        Insert: {
          completed_id: string
          id?: string
          rol: string
          signature_storage_path: string
          signed_at?: string
          signer_name: string
          signer_user_id: string
        }
        Update: {
          completed_id?: string
          id?: string
          rol?: string
          signature_storage_path?: string
          signed_at?: string
          signer_name?: string
          signer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verificacion_signatures_completed_id_fkey"
            columns: ["completed_id"]
            isOneToOne: false
            referencedRelation: "completed_verificaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacion_template_header_fields: {
        Row: {
          created_at: string
          field_key: string
          formula: string | null
          id: string
          label: string
          orden: number
          source: string
          template_id: string
          updated_at: string
          variable_name: string | null
        }
        Insert: {
          created_at?: string
          field_key: string
          formula?: string | null
          id?: string
          label: string
          orden: number
          source: string
          template_id: string
          updated_at?: string
          variable_name?: string | null
        }
        Update: {
          created_at?: string
          field_key?: string
          formula?: string | null
          id?: string
          label?: string
          orden?: number
          source?: string
          template_id?: string
          updated_at?: string
          variable_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verificacion_template_header_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "verificacion_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacion_template_items: {
        Row: {
          contributes_to_cumple: boolean
          created_at: string
          depends_on: string[] | null
          formula: string | null
          id: string
          item_role: string | null
          observacion_prompt: string | null
          orden: number
          pass_fail_rule: Json | null
          primitive: string | null
          punto: string
          requerido: boolean
          section_id: string
          tipo: string
          tolerancia: number | null
          tolerancia_max: number | null
          tolerancia_min: number | null
          tolerancia_tipo: string
          unidad: string | null
          updated_at: string
          valor_esperado: number | null
          variable_name: string | null
        }
        Insert: {
          contributes_to_cumple?: boolean
          created_at?: string
          depends_on?: string[] | null
          formula?: string | null
          id?: string
          item_role?: string | null
          observacion_prompt?: string | null
          orden: number
          pass_fail_rule?: Json | null
          primitive?: string | null
          punto: string
          requerido?: boolean
          section_id: string
          tipo: string
          tolerancia?: number | null
          tolerancia_max?: number | null
          tolerancia_min?: number | null
          tolerancia_tipo?: string
          unidad?: string | null
          updated_at?: string
          valor_esperado?: number | null
          variable_name?: string | null
        }
        Update: {
          contributes_to_cumple?: boolean
          created_at?: string
          depends_on?: string[] | null
          formula?: string | null
          id?: string
          item_role?: string | null
          observacion_prompt?: string | null
          orden?: number
          pass_fail_rule?: Json | null
          primitive?: string | null
          punto?: string
          requerido?: boolean
          section_id?: string
          tipo?: string
          tolerancia?: number | null
          tolerancia_max?: number | null
          tolerancia_min?: number | null
          tolerancia_tipo?: string
          unidad?: string | null
          updated_at?: string
          valor_esperado?: number | null
          variable_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verificacion_template_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "verificacion_template_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacion_template_sections: {
        Row: {
          created_at: string
          descripcion: string | null
          evidencia_config: Json
          id: string
          instances_config: Json
          layout: string
          orden: number
          repetible: boolean
          repeticiones_default: number | null
          series_config: Json
          template_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          evidencia_config?: Json
          id?: string
          instances_config?: Json
          layout?: string
          orden: number
          repetible?: boolean
          repeticiones_default?: number | null
          series_config?: Json
          template_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          evidencia_config?: Json
          id?: string
          instances_config?: Json
          layout?: string
          orden?: number
          repetible?: boolean
          repeticiones_default?: number | null
          series_config?: Json
          template_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verificacion_template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "verificacion_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacion_template_versions: {
        Row: {
          id: string
          published_at: string
          published_by: string | null
          snapshot: Json
          template_id: string
          version_number: number
        }
        Insert: {
          id?: string
          published_at?: string
          published_by?: string | null
          snapshot: Json
          template_id: string
          version_number: number
        }
        Update: {
          id?: string
          published_at?: string
          published_by?: string | null
          snapshot?: Json
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "verificacion_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "verificacion_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacion_templates: {
        Row: {
          active_version_id: string | null
          codigo: string
          conjunto_id: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          estado: string
          id: string
          nombre: string
          norma_referencia: string | null
          updated_at: string
        }
        Insert: {
          active_version_id?: string | null
          codigo: string
          conjunto_id: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          nombre: string
          norma_referencia?: string | null
          updated_at?: string
        }
        Update: {
          active_version_id?: string | null
          codigo?: string
          conjunto_id?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          nombre?: string
          norma_referencia?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_active_version"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "verificacion_template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verificacion_templates_conjunto_id_fkey"
            columns: ["conjunto_id"]
            isOneToOne: false
            referencedRelation: "conjuntos_herramientas"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_materials: {
        Row: {
          actual_amount: number
          created_at: string | null
          fecha: string
          id: string
          material_code: string
          material_id: string | null
          material_name: string | null
          notes: string | null
          plant_id: string
          remision_number: string
          session_id: string
          theoretical_amount: number
          updated_at: string | null
          waste_amount: number
          waste_reason: string
        }
        Insert: {
          actual_amount?: number
          created_at?: string | null
          fecha: string
          id?: string
          material_code: string
          material_id?: string | null
          material_name?: string | null
          notes?: string | null
          plant_id: string
          remision_number: string
          session_id: string
          theoretical_amount?: number
          updated_at?: string | null
          waste_amount?: number
          waste_reason: string
        }
        Update: {
          actual_amount?: number
          created_at?: string | null
          fecha?: string
          id?: string
          material_code?: string
          material_id?: string | null
          material_name?: string | null
          notes?: string | null
          plant_id?: string
          remision_number?: string
          session_id?: string
          theoretical_amount?: number
          updated_at?: string | null
          waste_amount?: number
          waste_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_materials_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "waste_materials_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_materials_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
    }
    Views: {
      client_balances_view: {
        Row: {
          business_name: string | null
          client_id: string | null
          credit_status: string | null
          current_balance: number | null
          last_payment_date: string | null
        }
        Relationships: []
      }
      client_quality_data_mv: {
        Row: {
          business_name: string | null
          carga_kg: number | null
          client_code: string | null
          client_id: string | null
          construction_site: string | null
          delivery_date: string | null
          ensayo_id: string | null
          ensayo_is_edad_garantia: boolean | null
          fecha_ensayo: string | null
          fecha_muestreo: string | null
          fecha_programada_ensayo: string | null
          identificacion: string | null
          is_ensayo_fuera_tiempo: boolean | null
          is_valid_for_compliance: boolean | null
          masa_unitaria: number | null
          material_sum: number | null
          muestra_id: string | null
          muestra_is_edad_garantia: boolean | null
          muestreo_id: string | null
          numero_muestreo: number | null
          order_id: string | null
          order_number: string | null
          plant_id: string | null
          porcentaje_cumplimiento: number | null
          recipe_age_days: number | null
          recipe_age_hours: number | null
          recipe_code: string | null
          recipe_id: string | null
          remision_date: string | null
          remision_id: string | null
          remision_number: string | null
          rendimiento_volumetrico: number | null
          resistencia_calculada: number | null
          revenimiento_sitio: number | null
          site_check_count: number | null
          site_check_data: Json | null
          strength_fc: number | null
          temperatura_ambiente: number | null
          temperatura_concreto: number | null
          tipo_muestra: string | null
          volume: number | null
        }
        Relationships: [
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      inventory_system_health: {
        Row: {
          adjustable_snapshots: number | null
          last_calculation: string | null
          newest_snapshot: string | null
          oldest_snapshot: string | null
          pending_exceptions: number | null
          plant_id: string | null
          plant_name: string | null
          provisional_snapshots: number | null
          sealed_snapshots: number | null
          total_snapshots: number | null
        }
        Relationships: []
      }
      list_price_performance: {
        Row: {
          base_price: number | null
          effective_date: string | null
          list_price_id: string | null
          market_fit: string | null
          master_recipe_id: string | null
          placement_type: string | null
          plant_id: string | null
          slump: number | null
          strength_fc: number | null
          sub_floor_quotes: number | null
          sub_floor_volume_m3: number | null
          sub_floor_volume_pct: number | null
          total_quotes: number | null
          total_volume_m3: number | null
          volume_zone_ab_m3: number | null
          volume_zone_c_m3: number | null
          volume_zone_d_m3: number | null
          volume_zone_e_m3: number | null
          vw_avg_floor_delta: number | null
          vw_avg_price: number | null
          vw_delta_zone_ab: number | null
          vw_delta_zone_c: number | null
          vw_delta_zone_d: number | null
          vw_delta_zone_e: number | null
        }
        Relationships: [
          {
            foreignKeyName: "list_prices_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["master_id"]
          },
          {
            foreignKeyName: "list_prices_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "master_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_prices_master_recipe_id_fkey"
            columns: ["master_recipe_id"]
            isOneToOne: false
            referencedRelation: "v_master_recipe_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      master_quotebuilder_variant: {
        Row: {
          master_code: string | null
          master_id: string | null
          material_count: number | null
          plant_id: string | null
          recipe_code: string | null
          recipe_plant_id: string | null
          variant_id: string | null
          variant_suffix: string | null
          version_id: string | null
          version_timestamp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "recipes_plant_id_fkey"
            columns: ["recipe_plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "recipes_plant_id_fkey"
            columns: ["recipe_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_plant_id_fkey"
            columns: ["recipe_plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      material_costs_detailed: {
        Row: {
          category: string | null
          density: number | null
          effective_date: string | null
          end_date: string | null
          material_code: string | null
          material_created_at: string | null
          material_name: string | null
          period_start: string | null
          plant_id: string | null
          plant_name: string | null
          price_created_at: string | null
          price_per_kg: number | null
          price_per_unit: number | null
          price_record_id: string | null
          price_status: string | null
          primary_supplier: string | null
          specific_gravity: number | null
          subcategory: string | null
          supplier_code: string | null
          unit_of_measure: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_prices_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_prices_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_prices_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      material_usage_analysis: {
        Row: {
          avg_quantity_per_recipe: number | null
          category: string | null
          created_at: string | null
          density: number | null
          material_code: string | null
          material_name: string | null
          primary_supplier: string | null
          subcategory: string | null
          total_delivered_quantity: number | null
          unit_of_measure: string | null
          used_in_deliveries: number | null
          used_in_recipe_versions: number | null
        }
        Relationships: []
      }
      mobile_sampling_queue: {
        Row: {
          completed_samples: number | null
          fecha_muestreo: string | null
          id: string | null
          manual_reference: string | null
          numero_muestreo: number | null
          planta: string | null
          reference: string | null
          sampling_type: string | null
          sync_status: string | null
          total_samples: number | null
        }
        Relationships: []
      }
      muestreos_list_view: {
        Row: {
          age_days: number | null
          age_hours: number | null
          business_unit_id: string | null
          business_unit_name: string | null
          client_business_name: string | null
          client_code: string | null
          client_id: string | null
          concrete_specs: Json | null
          contenido_aire: number | null
          created_at: string | null
          created_by: string | null
          event_timezone: string | null
          fecha_muestreo: string | null
          fecha_muestreo_ts: string | null
          gps_location: Json | null
          hora_muestreo: string | null
          id: string | null
          manual_reference: string | null
          masa_unitaria: number | null
          muestras_json: Json | null
          numero_muestreo: number | null
          obra_nombre: string | null
          offline_created: boolean | null
          order_construction_site: string | null
          order_id: string | null
          order_number: string | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          planta: string | null
          recipe_code: string | null
          recipe_id: string | null
          recipe_notes: string | null
          recovery_notes: string | null
          remision_cross_plant_billing_remision_id: string | null
          remision_fecha: string | null
          remision_id: string | null
          remision_is_production_record: boolean | null
          remision_number: string | null
          remision_volumen_fabricado: number | null
          revenimiento_sitio: number | null
          sampling_notes: string | null
          sampling_type: string | null
          strength_fc: number | null
          sync_status: string | null
          temperatura_ambiente: number | null
          temperatura_concreto: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "muestreos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "muestreos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestreos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "muestreos_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["remision_id"]
          },
          {
            foreignKeyName: "muestreos_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_cross_plant_billing_remision_id_fkey"
            columns: ["remision_cross_plant_billing_remision_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["remision_id"]
          },
          {
            foreignKeyName: "remisiones_cross_plant_billing_remision_id_fkey"
            columns: ["remision_cross_plant_billing_remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
        ]
      }
      muestreos_summary: {
        Row: {
          concrete_specs: Json | null
          created_at: string | null
          ensayos_count: number | null
          fecha_muestreo: string | null
          id: string | null
          muestras_count: number | null
          plant_id: string | null
          planta: string | null
          remision: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "muestreos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "muestreos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muestreos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      mv_pumping_analysis_unified: {
        Row: {
          data_source: string | null
          period_end: string | null
          period_start: string | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          precio_unitario: number | null
          precio_unitario_promedio: number | null
          remisiones_count: number | null
          snapshot_date: string | null
          subtotal_total: number | null
          volumen_bombeo_m3: number | null
        }
        Relationships: []
      }
      mv_sales_assets_daily: {
        Row: {
          asset_name: string | null
          concrete_m3: number | null
          day: string | null
          plant_id: string | null
          remisiones_concrete_count: number | null
          remisiones_count: number | null
          subtotal_amount: number | null
          total_amount_with_vat: number | null
          total_m3: number | null
        }
        Relationships: []
      }
      mv_sales_assets_weekly: {
        Row: {
          asset_name: string | null
          concrete_m3: number | null
          plant_id: string | null
          remisiones_concrete_count: number | null
          remisiones_count: number | null
          subtotal_amount: number | null
          total_amount_with_vat: number | null
          total_m3: number | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      order_vat_mismatches: {
        Row: {
          created_at: string | null
          order_id: string | null
          order_number: string | null
          order_requires_invoice: boolean | null
          quote_includes_vat: boolean | null
          vat_correction_applied: boolean | null
          vat_correction_at: string | null
          vat_correction_pct: number | null
        }
        Relationships: []
      }
      quality_team_recipes_view: {
        Row: {
          age_days: number | null
          created_at: string | null
          id: string | null
          max_aggregate_size: number | null
          placement_type: string | null
          recipe_code: string | null
          slump: number | null
          strength_fc: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      recipe_latest_version_summary: {
        Row: {
          created_at: string | null
          effective_date: string | null
          has_materials: boolean | null
          is_current: boolean | null
          material_count: number | null
          recipe_id: string | null
          version_id: string | null
          version_number: number | null
          version_timestamp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "quality_team_recipes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_materials_enhanced: {
        Row: {
          absorption_rate: number | null
          age_days: number | null
          application_type: string | null
          category: string | null
          chemical_composition: Json | null
          coding_system: string | null
          created_at: string | null
          density: number | null
          fineness_modulus: number | null
          has_waterproofing: boolean | null
          is_current: boolean | null
          material_code: string | null
          material_name: string | null
          max_aggregate_size: number | null
          new_system_code: string | null
          performance_grade: string | null
          physical_properties: Json | null
          placement_type: string | null
          plant_id: string | null
          quality_standards: Json | null
          quantity: number | null
          recipe_code: string | null
          slump: number | null
          special_properties: Json | null
          specific_gravity: number | null
          strength_class: string | null
          strength_fc: number | null
          subcategory: string | null
          unit: string | null
          unit_of_measure: string | null
          version_created_at: string | null
          version_notes: string | null
          version_number: number | null
          weight_tons_per_m3: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      recipe_specifications_summary: {
        Row: {
          application_description: string | null
          application_type: string | null
          coding_system: string | null
          created_at: string | null
          current_version: number | null
          has_waterproofing: boolean | null
          material_count: number | null
          max_aggregate: string | null
          new_system_code: string | null
          performance_description: string | null
          performance_grade: string | null
          placement_method: string | null
          recipe_code: string | null
          slump_value: string | null
          strength: string | null
          strength_fc: number | null
          test_age: string | null
          version_count: number | null
        }
        Insert: {
          application_description?: never
          application_type?: string | null
          coding_system?: string | null
          created_at?: string | null
          current_version?: never
          has_waterproofing?: boolean | null
          material_count?: never
          max_aggregate?: never
          new_system_code?: string | null
          performance_description?: never
          performance_grade?: string | null
          placement_method?: never
          recipe_code?: string | null
          slump_value?: never
          strength?: never
          strength_fc?: number | null
          test_age?: never
          version_count?: never
        }
        Update: {
          application_description?: never
          application_type?: string | null
          coding_system?: string | null
          created_at?: string | null
          current_version?: never
          has_waterproofing?: boolean | null
          material_count?: never
          max_aggregate?: never
          new_system_code?: string | null
          performance_description?: never
          performance_grade?: string | null
          placement_method?: never
          recipe_code?: string | null
          slump_value?: never
          strength?: never
          strength_fc?: number | null
          test_age?: never
          version_count?: never
        }
        Relationships: []
      }
      remisiones_with_pricing: {
        Row: {
          fecha: string | null
          is_virtual: boolean | null
          order_has_pump_service: boolean | null
          order_id: string | null
          plant_id: string | null
          price_concrete: number | null
          price_ser001: number | null
          price_ser002: number | null
          pricing_method: string | null
          recipe_code: string | null
          recipe_id: string | null
          remision_id: string | null
          requires_invoice: boolean | null
          subtotal_amount: number | null
          tipo_remision: string | null
          total_amount_with_vat: number | null
          unidad: string | null
          unit_price_resolved: number | null
          volumen_fabricado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "remisiones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "remisiones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "remisiones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_vat_mismatches"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "remisiones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "remisiones_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "client_quality_data_mv"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "remisiones_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "master_quotebuilder_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "remisiones_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "muestreos_list_view"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "remisiones_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "quality_team_recipes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_assets_daily: {
        Row: {
          asset_name: string | null
          concrete_m3: number | null
          day: string | null
          plant_id: string | null
          remisiones_concrete_count: number | null
          remisiones_count: number | null
          subtotal_amount: number | null
          total_amount_with_vat: number | null
          total_m3: number | null
        }
        Relationships: []
      }
      sales_assets_daily_live: {
        Row: {
          asset_name: string | null
          concrete_m3: number | null
          day: string | null
          plant_id: string | null
          remisiones_concrete_count: number | null
          remisiones_count: number | null
          subtotal_amount: number | null
          total_amount_with_vat: number | null
          total_m3: number | null
        }
        Relationships: []
      }
      sales_assets_weekly: {
        Row: {
          asset_name: string | null
          concrete_m3: number | null
          plant_id: string | null
          remisiones_concrete_count: number | null
          remisiones_count: number | null
          subtotal_amount: number | null
          total_amount_with_vat: number | null
          total_m3: number | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      user_plant_access: {
        Row: {
          access_level: string | null
          business_unit_name: string | null
          email: string | null
          first_name: string | null
          last_name: string | null
          plant_code: string | null
          plant_name: string | null
          role: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_attendance_log_uploads: {
        Row: {
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string | null
          mime_type: string | null
          original_name: string | null
          plant_id: string | null
          plant_name: string | null
          selected_date: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_log_uploads_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "attendance_log_uploads_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_log_uploads_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "attendance_log_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_plant_access"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "attendance_log_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_master_recipe_summary: {
        Row: {
          age_days: number | null
          age_hours: number | null
          clients_with_pricing: number | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_active: boolean | null
          master_code: string | null
          max_aggregate_size: number | null
          placement_type: string | null
          plant_id: string | null
          plant_name: string | null
          slump: number | null
          strength_fc: number | null
          total_volume_30d: number | null
          variant_codes: string[] | null
          variant_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_recipes_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      vw_current_stock_status: {
        Row: {
          category: string | null
          current_stock: number | null
          last_adjustment_date: string | null
          last_consumption_date: string | null
          last_entry_date: string | null
          material_name: string | null
          maximum_stock: number | null
          minimum_stock: number | null
          plant_name: string | null
          stock_status: string | null
          unit_of_measure: string | null
        }
        Relationships: []
      }
      vw_daily_inventory_activity: {
        Row: {
          activity_date: string | null
          activity_time: string | null
          activity_type: string | null
          created_at: string | null
          inventory_after: number | null
          inventory_before: number | null
          material_name: string | null
          notes: string | null
          performed_by: string | null
          plant_id: string | null
          plant_name: string | null
          quantity: number | null
          reference_number: string | null
          total_cost: number | null
        }
        Relationships: []
      }
      vw_inventory_lock_status: {
        Row: {
          dead_row_percentage: number | null
          dead_rows: number | null
          last_analyze: string | null
          last_autoanalyze: string | null
          last_autovacuum: string | null
          last_vacuum: string | null
          live_rows: number | null
          schemaname: unknown
          table_name: unknown
        }
        Relationships: []
      }
      vw_inventory_trigger_performance: {
        Row: {
          earliest_date: string | null
          latest_date: string | null
          records_last_24h: number | null
          records_last_hour: number | null
          source_table: string | null
          total_records: number | null
          unique_materials: number | null
          unique_remisiones: number | null
        }
        Relationships: []
      }
      vw_material_update_frequency: {
        Row: {
          current_stock: number | null
          last_consumption_date: string | null
          last_update_date: string | null
          material_code: string | null
          material_name: string | null
          plant_id: string | null
          plant_name: string | null
          updates_last_24h: number | null
          updates_last_7d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_inventory_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "material_inventory_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_inventory_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      vw_plant_financial_analysis: {
        Row: {
          consumo_cem_per_m3_kg: number | null
          costo_cem_per_m3: number | null
          costo_mp_percent: number | null
          costo_mp_total_concreto: number | null
          costo_mp_unitario: number | null
          edad_ponderada_dias: number | null
          fc_ponderada_kg_cm2: number | null
          last_updated: string | null
          period_end: string | null
          period_start: string | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          pv_unitario: number | null
          remisiones_fabricated_count: number | null
          spread_unitario: number | null
          spread_unitario_percent: number | null
          ventas_total_concreto: number | null
          volumen_concreto_m3: number | null
          volumen_producido_m3: number | null
          volumen_sold_not_fabricated: number | null
        }
        Relationships: []
      }
      vw_plant_financial_analysis_unified: {
        Row: {
          consumo_cem_per_m3_kg: number | null
          costo_cem_per_m3: number | null
          costo_mp_percent: number | null
          costo_mp_total_concreto: number | null
          costo_mp_unitario: number | null
          data_source: string | null
          edad_ponderada_dias: number | null
          fc_ponderada_kg_cm2: number | null
          period_end: string | null
          period_start: string | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          pv_unitario: number | null
          remisiones_fabricated_count: number | null
          snapshot_date: string | null
          spread_unitario: number | null
          spread_unitario_percent: number | null
          ventas_total_concreto: number | null
          volumen_concreto_m3: number | null
          volumen_producido_m3: number | null
          volumen_sold_not_fabricated: number | null
        }
        Relationships: []
      }
      vw_pumping_analysis_by_plant_date: {
        Row: {
          fecha: string | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          precio_unitario: number | null
          precio_unitario_promedio: number | null
          remisiones_count: number | null
          subtotal_total: number | null
          volumen_bombeo_m3: number | null
        }
        Relationships: [
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_system_health"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "vw_plant_financial_analysis"
            referencedColumns: ["plant_id"]
          },
        ]
      }
      vw_pumping_analysis_unified: {
        Row: {
          data_source: string | null
          period_end: string | null
          period_start: string | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          precio_unitario: number | null
          precio_unitario_promedio: number | null
          remisiones_count: number | null
          snapshot_date: string | null
          subtotal_total: number | null
          volumen_bombeo_m3: number | null
        }
        Relationships: []
      }
      vw_pumping_analysis_unified_live: {
        Row: {
          data_source: string | null
          period_end: string | null
          period_start: string | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          precio_unitario: number | null
          precio_unitario_promedio: number | null
          remisiones_count: number | null
          snapshot_date: string | null
          subtotal_total: number | null
          volumen_bombeo_m3: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _client_payments_actor_user_id: { Args: never; Returns: string }
      add_historical_balance:
        | {
            Args: {
              p_amount: number
              p_balance_type: string
              p_client_id: string
              p_created_by: string
              p_notes: string
              p_site_name?: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_amount: number
              p_balance_type: string
              p_client_id: string
              p_created_by: string
              p_notes: string
              p_site_name: string
            }
            Returns: boolean
          }
      add_missing_alerts_and_queue_entries: {
        Args: never
        Returns: {
          alert_created: boolean
          identificacion: string
          muestra_id: string
          notification_time: string
          queue_created: boolean
        }[]
      }
      admin_delete_client_payment: {
        Args: { p_payment_id: string; p_reason?: string }
        Returns: undefined
      }
      admin_update_client_payment: {
        Args: {
          p_amount: number
          p_construction_site: string
          p_notes: string
          p_payment_date: string
          p_payment_id: string
          p_payment_method: string
          p_reason?: string
          p_reference_number: string
        }
        Returns: {
          amount: number
          client_id: string
          construction_site: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string
          reference_number: string | null
          verification_call_confirmed: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "client_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_general_credit_to_site: {
        Args: {
          p_amount: number
          p_client_id: string
          p_created_by: string
          p_site_name: string
        }
        Returns: boolean
      }
      approve_order_credit: { Args: { order_id: string }; Returns: string }
      archive_monthly_financial_analysis: { Args: never; Returns: Json }
      backfill_financial_analysis_month: {
        Args: { p_month: number; p_year: number }
        Returns: Json
      }
      backfill_indirect_material_costs: {
        Args: { p_month: number; p_year: number }
        Returns: Json
      }
      batch_assign_remision_id_to_muestreos: {
        Args: { p_batch_size?: number; p_planta_code: string }
        Returns: {
          details: Json
          matched_count: number
          processed_count: number
          unmatched_count: number
        }[]
      }
      batch_recalculate_ensayos_after_linking: {
        Args: { p_batch_size?: number }
        Returns: {
          details: Json
          error_count: number
          processed_count: number
          updated_count: number
        }[]
      }
      calcular_metricas_muestreo: {
        Args: { p_muestreo_id: string }
        Returns: {
          consumo_cemento_real: number
          eficiencia: number
          rendimiento_volumetrico: number
          volumen_real: number
        }[]
      }
      calcular_porcentaje_cumplimiento: {
        Args: {
          edad_ensayo: number
          edad_garantia: number
          resistencia_calculada: number
          resistencia_diseno: number
        }
        Returns: number
      }
      calcular_porcentaje_cumplimiento_horas: {
        Args: {
          edad_ensayo_horas: number
          edad_garantia_horas: number
          resistencia_calculada: number
          resistencia_diseno: number
        }
        Returns: number
      }
      calcular_resistencia: {
        Args: {
          beam_height_cm?: number
          beam_span_cm?: number
          beam_width_cm?: number
          carga_kg: number
          clasificacion: string
          cube_side_cm?: number
          diameter_cm?: number
          tipo_muestra: string
        }
        Returns: number
      }
      calculate_daily_inventory_snapshot: {
        Args: { p_date: string; p_plant_id: string }
        Returns: undefined
      }
      calculate_distance_km_haversine: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_guarantee_age_end: {
        Args: { concrete_specs: Json; start_timestamp: string }
        Returns: string
      }
      calculate_historical_inventory: {
        Args: {
          p_end_date: string
          p_material_ids?: string[]
          p_plant_id: string
          p_start_date: string
        }
        Returns: {
          actual_current_stock: number
          initial_stock: number
          material_code: string
          material_id: string
          material_name: string
          theoretical_final_stock: number
          total_entries: number
          total_manual_additions: number
          total_manual_withdrawals: number
          total_remisiones_consumption: number
          total_waste: number
          unit: string
        }[]
      }
      calculate_historical_stock: {
        Args: { p_material_id: string; p_target_date: string }
        Returns: number
      }
      calculate_order_final_amount: {
        Args: { p_order_id: string; p_requires_invoice: boolean }
        Returns: undefined
      }
      calculate_transport_cost_per_m3: {
        Args: { p_distance_km: number; p_plant_id: string }
        Returns: number
      }
      check_duplicate_remision: {
        Args: { p_plant_id: string; p_remision_number: string }
        Returns: boolean
      }
      check_notification_system_health: {
        Args: never
        Returns: {
          action_required: string
          check_name: string
          count_value: number
          details: string
          status: string
        }[]
      }
      cleanup_expired_credit_tokens: { Args: never; Returns: undefined }
      compute_instrumento_estado: {
        Args: {
          p_current_estado: string
          p_dias_alerta?: number
          p_fecha_proximo_evento: string
        }
        Returns: string
      }
      ema_refresh_compliance_and_programa: {
        Args: { p_instrumento_id?: string | null }
        Returns: Json
      }
      crear_muestras_por_edad: {
        Args: {
          p_cantidad: number
          p_clasificacion: string
          p_edad_garantia: number
          p_muestreo_id: string
        }
        Returns: undefined
      }
      create_client_with_sites: {
        Args: { client_data: Json; sites_data: Json }
        Returns: string
      }
      create_order_from_quote: {
        Args: {
          delivery_date: string
          delivery_time: string
          quote_id: string
          requires_invoice: boolean
          special_requirements?: string
        }
        Returns: string
      }
      create_order_with_details: {
        Args: {
          delivery_date: string
          delivery_time: string
          empty_truck_price?: number
          empty_truck_volume?: number
          has_empty_truck_charge?: boolean
          quote_id: string
          requires_invoice: boolean
          special_requirements?: string
        }
        Returns: string
      }
      create_recipe_simple: {
        Args: {
          p_age_days: number
          p_materials: Json
          p_max_aggregate_size: number
          p_new_system_code: string
          p_notes?: string
          p_placement_type: string
          p_plant_id: string
          p_recipe_code: string
          p_slump: number
          p_strength_fc: number
        }
        Returns: Json
      }
      create_recipe_version: {
        Args: {
          p_materials: Json
          p_new_system_code?: string
          p_notes?: string
          p_recipe_id: string
        }
        Returns: Json
      }
      create_recipe_with_specifications:
        | {
            Args: {
              p_age_days: number
              p_application_type?: string
              p_has_waterproofing?: boolean
              p_materials: Json
              p_max_aggregate_size: number
              p_new_system_code?: string
              p_notes?: string
              p_performance_grade?: string
              p_placement_type: string
              p_plant_id: string
              p_recipe_code: string
              p_recipe_type?: string
              p_slump: number
              p_strength_fc: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_age_days: number
              p_age_hours?: number
              p_application_type?: string
              p_has_waterproofing?: boolean
              p_materials: Json
              p_max_aggregate_size: number
              p_new_system_code?: string
              p_notes?: string
              p_performance_grade?: string
              p_placement_type: string
              p_plant_id: string
              p_recipe_code: string
              p_recipe_type?: string
              p_slump: number
              p_strength_fc: number
            }
            Returns: Json
          }
      current_user_is_external_client: { Args: never; Returns: boolean }
      daily_financial_analysis_maintenance: { Args: never; Returns: Json }
      debug_metrics_query: {
        Args: { p_fecha_desde: string; p_fecha_hasta: string }
        Returns: Json
      }
      debug_my_access: {
        Args: never
        Returns: {
          access_level: string
          accessible_plants: string[]
          business_unit_id: string
          business_unit_name: string
          email: string
          plant_id: string
          plant_name: string
          role: string
          user_id: string
        }[]
      }
      debug_order_calculation: {
        Args: { order_id_param: string }
        Returns: {
          adicionales_count: number
          bomba_items_count: number
          items_count: number
          total_adicionales: number
          total_bombeo: number
          total_concreto: number
          total_final: number
          total_vacio_olla: number
        }[]
      }
      debug_role_access_test: {
        Args: { test_email: string }
        Returns: {
          can_delete: boolean
          can_insert: boolean
          can_select: boolean
          can_update: boolean
          error_message: string
          table_name: string
        }[]
      }
      debug_user_access_levels: {
        Args: { user_email?: string }
        Returns: {
          access_level: string
          accessible_plants: string[]
          business_unit_id: string
          business_unit_name: string
          email: string
          plant_id: string
          plant_name: string
          role: string
          user_id: string
        }[]
      }
      debug_user_order_access: {
        Args: never
        Returns: {
          access_level: string
          business_unit_id: string
          can_create_orders: boolean
          email: string
          plant_code: string
          plant_id: string
          plant_name: string
          role: string
          user_id: string
        }[]
      }
      decode_recipe_specifications: { Args: never; Returns: number }
      determinar_clasificacion_receta: {
        Args: { p_notas: string }
        Returns: string
      }
      ema_effective_service_window: {
        Args: { p_instrumento_id: string }
        Returns: {
          cadencia_meses: number
          from_override: boolean
          mes_fin: number
          mes_inicio: number
          tipo_servicio: string
        }[]
      }
      ema_next_instrument_code: {
        Args: { p_conjunto_id: string }
        Returns: string
      }
      ema_next_service_date: {
        Args: {
          p_cadencia: number
          p_from: string
          p_mes_fin: number
          p_mes_inicio: number
        }
        Returns: string
      }
      expire_construction_sites_by_valid_until: { Args: never; Returns: number }
      find_potential_duplicate_clients: {
        Args: { p_business_name: string; p_client_code?: string }
        Returns: {
          business_name: string
          client_code: string
          id: string
          match_reason: string
        }[]
      }
      find_recipe_by_code:
        | { Args: { code: string }; Returns: string }
        | {
            Args: { code: string; p_has_waterproofing?: boolean }
            Returns: string
          }
      find_recipe_by_specifications: {
        Args: {
          p_age_days: number
          p_max_aggregate_size: number
          p_placement_type: string
          p_plant_id?: string
          p_slump: number
          p_strength_fc: number
        }
        Returns: {
          coding_system: string
          current_version_number: number
          new_system_code: string
          recipe_code: string
          recipe_id: string
          total_versions: number
        }[]
      }
      find_recipes_by_specifications:
        | {
            Args: {
              p_age_days?: number
              p_application_type?: string
              p_has_waterproofing?: boolean
              p_max_aggregate_size?: number
              p_performance_grade?: string
              p_placement_type?: string
              p_plant_id?: string
              p_recipe_type?: string
              p_slump?: number
              p_strength_fc?: number
            }
            Returns: {
              age_days: number
              application_type: string
              coding_system: string
              current_version_number: number
              has_waterproofing: boolean
              max_aggregate_size: number
              new_system_code: string
              performance_grade: string
              placement_type: string
              recipe_code: string
              recipe_id: string
              recipe_type: string
              slump: number
              strength_fc: number
              total_versions: number
            }[]
          }
        | {
            Args: {
              p_age_days?: number
              p_age_hours?: number
              p_application_type?: string
              p_has_waterproofing?: boolean
              p_max_aggregate_size?: number
              p_performance_grade?: string
              p_placement_type?: string
              p_plant_id?: string
              p_recipe_type?: string
              p_slump?: number
              p_strength_fc?: number
            }
            Returns: {
              age_days: number
              age_hours: number
              application_type: string
              coding_system: string
              current_version_number: number
              has_waterproofing: boolean
              max_aggregate_size: number
              new_system_code: string
              performance_grade: string
              placement_type: string
              recipe_code: string
              recipe_id: string
              recipe_type: string
              slump: number
              strength_fc: number
              total_versions: number
            }[]
          }
      fix_all_client_balances: {
        Args: never
        Returns: {
          client_id: string
          client_name: string
          fixed: boolean
        }[]
      }
      fix_empty_truck_prices: { Args: never; Returns: undefined }
      fix_missing_plant_ids: {
        Args: never
        Returns: {
          identificacion: string
          muestra_id: string
          muestras_updated: boolean
          new_plant_id: string
          old_plant_id: string
          queue_updated: boolean
        }[]
      }
      fix_order_final_amounts: { Args: never; Returns: string }
      fix_queue_entries: {
        Args: never
        Returns: {
          fixed_plant_ids: number
          fixed_timestamps: number
        }[]
      }
      fix_queue_timestamps: { Args: never; Returns: number }
      fix_remaining_missing_plant_ids_by_name: {
        Args: never
        Returns: {
          assigned_plant_id: string
          assigned_plant_name: string
          identificacion: string
          muestra_id: string
          muestras_updated: boolean
          plant_name: string
          queue_updated: boolean
        }[]
      }
      fn_batch_update_entry_remaining: {
        Args: { updates: Json }
        Returns: undefined
      }
      generate_daily_snapshots: {
        Args: { p_target_date?: string }
        Returns: string
      }
      get_arkik_material_mappings: {
        Args: { p_plant_id: string }
        Returns: {
          arkik_code: string
          category: string
          material_code: string
          material_id: string
          material_name: string
          unit_of_measure: string
        }[]
      }
      get_bloque_number: {
        Args: { p_distance_km: number; p_plant_id: string }
        Returns: number
      }
      get_client_balance_adjustments: {
        Args: {
          p_adjustment_type?: string
          p_client_id?: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          adjustment_type: string
          amount: number
          created_at: string
          created_by_name: string
          effect_on_client: number
          id: string
          notes: string
          source_client_id: string
          source_client_name: string
          source_site: string
          target_client_id: string
          target_client_name: string
          target_site: string
          transfer_type: string
        }[]
      }
      get_client_balance_summary: {
        Args: never
        Returns: {
          business_name: string
          client_id: string
          credit_status: string
          current_balance: number
          last_payment_date: string
          last_updated: string
        }[]
      }
      get_client_balances_export: {
        Args: { p_client_ids: string[] }
        Returns: {
          client_id: string
          net_adjustments: number
          total_consumed: number
          total_paid: number
        }[]
      }
      get_client_quality_cv_by_recipe: {
        Args: { p_client_id: string; p_from_date: string; p_to_date: string }
        Returns: {
          age_days: number
          avg_compliance: number
          avg_resistencia: number
          coefficient_variation: number
          ensayo_count: number
          muestreo_count: number
          recipe_code: string
          strength_fc: number
        }[]
      }
      get_client_quality_details: {
        Args: {
          p_client_id: string
          p_from_date: string
          p_limit?: number
          p_offset?: number
          p_to_date: string
        }
        Returns: {
          avg_compliance: number
          avg_resistencia: number
          compliance_status: string
          construction_site: string
          ensayo_count: number
          max_resistencia: number
          min_resistencia: number
          muestreo_count: number
          muestreos: Json
          order_number: string
          recipe_code: string
          remision_date: string
          remision_id: string
          remision_number: string
          rendimiento_volumetrico: number
          site_checks: Json
          strength_fc: number
          valid_ensayo_count: number
          volume: number
        }[]
      }
      get_client_quality_summary: {
        Args: { p_client_id: string; p_from_date: string; p_to_date: string }
        Returns: {
          avg_compliance: number
          avg_masa_unitaria: number
          avg_rendimiento_volumetrico: number
          avg_resistencia: number
          coefficient_variation: number
          ensayos_edad_garantia: number
          on_time_testing_rate: number
          orders_with_ensayos: number
          orders_with_muestreos: number
          remisiones_con_datos_calidad: number
          remisiones_muestreadas: number
          total_ensayos: number
          total_muestreos: number
          total_orders: number
          total_remisiones: number
          total_site_checks: number
          total_volume: number
        }[]
      }
      get_client_user_permissions: {
        Args: { p_client_id: string; p_user_id: string }
        Returns: Json
      }
      get_clients_with_quality_data: {
        Args: never
        Returns: {
          business_name: string
          id: string
        }[]
      }
      get_current_user_client_ids: { Args: never; Returns: string[] }
      get_distance_range_code: {
        Args: { p_distance_km: number; p_plant_id: string }
        Returns: string
      }
      get_effective_floor_price: {
        Args: { p_as_of_date?: string; p_master_recipe_id: string }
        Returns: {
          floor_price: number
          list_price_id: string
        }[]
      }
      get_external_agent_clients: { Args: never; Returns: string[] }
      get_external_agent_construction_sites: { Args: never; Returns: string[] }
      get_guarantee_age_tolerance_minutes: {
        Args: { concrete_specs: Json }
        Returns: number
      }
      get_inventory_exceptions_summary: {
        Args: { p_days_back?: number; p_plant_id?: string }
        Returns: {
          exception_count: number
          exception_type: string
          newest_exception: string
          oldest_exception: string
          pending_review: number
        }[]
      }
      get_inventory_report_smart: {
        Args: { p_end_date: string; p_plant_id: string; p_start_date: string }
        Returns: {
          data_quality: string
          final_stock: number
          has_provisional_data: boolean
          initial_stock: number
          material_id: string
          material_name: string
          snapshot_coverage: number
          total_adjustments: number
          total_consumption: number
          total_entries: number
        }[]
      }
      get_inventory_system_health: {
        Args: never
        Returns: {
          message: string
          metric_name: string
          metric_value: number
          status: string
        }[]
      }
      get_material_price_at_date: {
        Args: { p_date: string; p_material_id: string; p_plant_id: string }
        Returns: number
      }
      get_muestreos_paginated: {
        Args: {
          p_end_date: string
          p_limit?: number
          p_offset?: number
          p_plant_id?: string
          p_start_date: string
        }
        Returns: {
          concrete_specs: Json
          fecha_muestreo: string
          id: string
          muestras: Json
          plant_id: string
          planta: string
          remision: Json
          total_count: number
        }[]
      }
      get_notification_system_summary: {
        Args: never
        Returns: {
          count_value: number
          details: string
          metric_name: string
        }[]
      }
      get_or_create_driver: {
        Args: { p_driver_name: string; p_plant_id: string }
        Returns: string
      }
      get_or_create_truck: {
        Args: {
          p_license_plate: string
          p_plant_id: string
          p_truck_code: string
        }
        Returns: string
      }
      get_orders_for_geocode_backfill: {
        Args: { p_limit?: number }
        Returns: {
          delivery_latitude: number
          delivery_longitude: number
          id: string
        }[]
      }
      get_plant_financial_analysis: {
        Args: {
          p_end_date: string
          p_plant_ids: string[]
          p_start_date: string
        }
        Returns: {
          consumo_cem_per_m3_kg: number
          costo_cem_per_m3: number
          costo_mp_percent: number
          costo_mp_total_concreto: number
          costo_mp_unitario: number
          edad_ponderada_dias: number
          fc_ponderada_kg_cm2: number
          plant_code: string
          plant_id: string
          plant_name: string
          pv_unitario: number
          remisiones_fabricated_count: number
          spread_unitario: number
          spread_unitario_percent: number
          ventas_total_concreto: number
          volumen_concreto_m3: number
          volumen_producido_m3: number
          volumen_sold_not_fabricated: number
        }[]
      }
      get_plant_vat_rate: { Args: { p_plant_id: string }; Returns: number }
      get_po_summary: {
        Args: { p_po_id: string }
        Returns: {
          item_count: number
          net_total: number
          po_id: string
          total_credits: number
          total_ordered_value: number
          total_received_value: number
        }[]
      }
      get_price_last_used: {
        Args: { p_client_ids?: string[]; p_site_names?: string[] }
        Returns: {
          client_id: string
          construction_site: string
          last_used: string
          master_recipe_id: string
          recipe_id: string
        }[]
      }
      get_quality_chart_data: {
        Args: {
          p_from_date: string
          p_limit?: number
          p_plant_id?: string
          p_to_date: string
        }
        Returns: {
          avg_compliance: number
          avg_resistencia: number
          concrete_specs: Json
          ensayo_count: number
          fecha_muestreo: string
          fecha_muestreo_ts: string
          muestreo_id: string
          recipe_code: string
          strength_fc: number
        }[]
      }
      get_quality_dashboard_metrics: {
        Args: {
          p_business_unit_id?: string
          p_from_date: string
          p_limit?: number
          p_plant_id?: string
          p_to_date: string
        }
        Returns: Json
      }
      get_recipes_with_quality_data: {
        Args: never
        Returns: {
          id: string
          recipe_code: string
        }[]
      }
      get_total_per_trip_cost: {
        Args: { p_distance_km: number; p_plant_id: string }
        Returns: number
      }
      get_user_access_level: { Args: never; Returns: string }
      get_user_accessible_plant_ids: { Args: never; Returns: string[] }
      get_user_business_unit_id: { Args: never; Returns: string }
      get_user_client_id: { Args: never; Returns: string }
      get_user_clients: {
        Args: { p_user_id: string }
        Returns: {
          client_id: string
          client_name: string
          is_active: boolean
          permissions: Json
          role_within_client: string
        }[]
      }
      get_user_plant_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      handle_late_movement: {
        Args: {
          p_material_id: string
          p_movement_date: string
          p_movement_type: string
          p_plant_id: string
          p_quantity: number
        }
        Returns: string
      }
      internal_send_notification_http: {
        Args: {
          p_headers: Json
          p_payload: Json
          p_timeout?: number
          p_url: string
        }
        Returns: number
      }
      is_client_executive: {
        Args: { p_client_id: string; p_user_id: string }
        Returns: boolean
      }
      is_external_client: { Args: never; Returns: boolean }
      is_external_sales_agent: { Args: never; Returns: boolean }
      is_outside_guarantee_age_tolerance: {
        Args: {
          check_timestamp: string
          concrete_specs: Json
          start_timestamp: string
        }
        Returns: boolean
      }
      is_record_owned_by_external_agent: {
        Args: { created_by_field: string }
        Returns: boolean
      }
      is_within_guarantee_age: {
        Args: {
          check_timestamp: string
          concrete_specs: Json
          start_timestamp: string
          tolerance_minutes?: number
        }
        Returns: boolean
      }
      link_plant4_muestreos_to_remisiones: {
        Args: { p_batch_size?: number }
        Returns: {
          details: Json
          matched_count: number
          processed_count: number
          unmatched_count: number
        }[]
      }
      link_recipes_to_master: {
        Args: { p_master_recipe_id: string; p_recipe_ids: string[] }
        Returns: undefined
      }
      link_variant_to_master: {
        Args: { p_master_id: string; p_recipe_id: string }
        Returns: undefined
      }
      monthly_inventory_closing: {
        Args: { p_closing_date?: string }
        Returns: string
      }
      normalize_remision_number: {
        Args: { input_number: string }
        Returns: string
      }
      obtener_metricas_calidad: {
        Args: { p_fecha_desde: string; p_fecha_hasta: string }
        Returns: Json
      }
      populate_material_relationships: { Args: never; Returns: undefined }
      process_quality_notifications_enhanced: {
        Args: never
        Returns: undefined
      }
      procurement_plant_consumption_by_day: {
        Args: { p_from: string; p_plant_id: string; p_to: string }
        Returns: {
          consumption_kg: number
          fecha: string
        }[]
      }
      procurement_plant_consumption_range_summary: {
        Args: { p_from: string; p_plant_id: string; p_to: string }
        Returns: {
          adjustments_kg: number
          consumption_kg: number
          entries_kg: number
          material_id: string
          material_key: string
          material_name: string
        }[]
      }
      recalc_payable_totals: {
        Args: { p_payable_id: string }
        Returns: undefined
      }
      recalculate_order_from_remisiones: {
        Args: { p_order_id: string; p_skip_balance?: boolean }
        Returns: undefined
      }
      refresh_analytics_materialized_views: { Args: never; Returns: undefined }
      refresh_client_quality_mv: { Args: never; Returns: undefined }
      refresh_plant_financial_analysis: { Args: never; Returns: Json }
      refresh_plant_financial_analysis_mv: { Args: never; Returns: undefined }
      reject_credit_by_validator: {
        Args: { order_id: string; p_rejection_reason: string }
        Returns: string
      }
      reject_order_credit: {
        Args: { order_id: string; p_rejection_reason: string }
        Returns: string
      }
      reset_order_item_volumes: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      resolve_specimen_type_spec: {
        Args: {
          p_beam_height_cm: number
          p_beam_span_cm: number
          p_beam_width_cm: number
          p_cube_side_cm: number
          p_diameter_cm: number
          p_tipo_muestra: string
        }
        Returns: {
          correction_factor: number
          spec_id: string
        }[]
      }
      set_arkik_bulk_mode: { Args: { enabled: boolean }; Returns: undefined }
      set_flexible_initial_inventory: {
        Args: {
          p_initial_date: string
          p_plant_id: string
          p_use_current_stock?: boolean
        }
        Returns: string
      }
      set_initial_inventory_snapshot: {
        Args: { p_initial_date: string; p_plant_id: string }
        Returns: undefined
      }
      should_auto_approve_quote: {
        Args: { p_margin_percentage: number }
        Returns: boolean
      }
      transfer_client_balance: {
        Args: {
          p_amount: number
          p_created_by: string
          p_notes: string
          p_source_client_id: string
          p_target_client_id: string
          p_transfer_type: string
        }
        Returns: boolean
      }
      transfer_site_balance: {
        Args: {
          p_amount: number
          p_client_id: string
          p_created_by: string
          p_notes: string
          p_source_site: string
          p_target_site: string
          p_transfer_type: string
        }
        Returns: boolean
      }
      trigger_financial_analysis_archive: { Args: never; Returns: Json }
      trigger_financial_analysis_refresh: { Args: never; Returns: Json }
      unlink_variant_from_master: {
        Args: { p_recipe_id: string }
        Returns: undefined
      }
      update_client_balance: {
        Args: { p_client_id: string; p_site_name?: string }
        Returns: undefined
      }
      update_client_balance_atomic: {
        Args: { p_client_id: string; p_site_id?: string; p_site_name?: string }
        Returns: undefined
      }
      update_client_balance_enhanced: {
        Args: { p_client_id: string; p_site_id?: string; p_site_name?: string }
        Returns: undefined
      }
      update_client_balance_with_uuid: {
        Args: { p_client_id: string; p_site_id?: string; p_site_name?: string }
        Returns: undefined
      }
      update_compliance_percentage_for_plant: {
        Args: { p_batch_size?: number; p_planta_code?: string }
        Returns: {
          details: Json
          processed_count: number
          skipped_count: number
          updated_count: number
        }[]
      }
      update_order_delivered_volumes: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      update_porcentaje_cumplimiento_for_linked_ensayos: {
        Args: { p_batch_size?: number }
        Returns: {
          details: Json
          error_count: number
          processed_count: number
          skipped_count: number
          updated_count: number
        }[]
      }
      user_can_access_plant: { Args: { p_plant_id: string }; Returns: boolean }
      user_has_client_permission: {
        Args: {
          p_client_id: string
          p_permission_key: string
          p_user_id: string
        }
        Returns: boolean
      }
      user_has_global_access: { Args: never; Returns: boolean }
      user_is_sales_agent: { Args: never; Returns: boolean }
      validate_client_by_name: {
        Args: { p_client_name: string; p_plant_id: string }
        Returns: {
          client_id: string
          exact_match: boolean
          suggestions: Json
        }[]
      }
      validate_construction_site: {
        Args: { p_client_id: string; p_plant_id: string; p_site_name: string }
        Returns: {
          exact_match: boolean
          site_id: string
          suggestions: Json
        }[]
      }
      validate_material_exists: {
        Args: { p_material_name: string; p_plant_id: string }
        Returns: {
          found: boolean
          material_code: string
          material_id: string
        }[]
      }
      validate_payable_vs_po: { Args: { p_payable_id: string }; Returns: Json }
      validate_recipe_with_price: {
        Args: { p_plant_id: string; p_recipe_code: string }
        Returns: {
          base_price: number
          error_type: string
          has_price: boolean
          recipe_id: string
        }[]
      }
      validate_rls_hierarchy_standard: {
        Args: never
        Returns: {
          message: string
          status: string
        }[]
      }
      validate_snapshot_integrity: {
        Args: { p_date: string; p_plant_id: string }
        Returns: {
          calculated_closing: number
          difference: number
          material_name: string
          needs_attention: boolean
          snapshot_closing: number
        }[]
      }
    }
    Enums: {
      billing_type_enum: "PER_M3" | "PER_ORDER_FIXED" | "PER_UNIT"
      client_type_enum: "normal" | "de_la_casa" | "asignado" | "nuevo"
      material_uom:
        | "kg"
        | "l"
        | "trips"
        | "tons"
        | "hours"
        | "loads"
        | "units"
        | "m3"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      billing_type_enum: ["PER_M3", "PER_ORDER_FIXED", "PER_UNIT"],
      client_type_enum: ["normal", "de_la_casa", "asignado", "nuevo"],
      material_uom: [
        "kg",
        "l",
        "trips",
        "tons",
        "hours",
        "loads",
        "units",
        "m3",
      ],
    },
  },
} as const
