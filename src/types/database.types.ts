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