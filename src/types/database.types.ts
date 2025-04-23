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