/**
 * Supabase `Database` types for `createClient<Database>()`.
 * Regenerate the source file after schema changes:
 *   npx supabase gen types typescript --project-id <project-ref> > src/types/database.types.generated.ts
 *
 * `instrumentos.tipo` and `conjuntos_herramientas.tipo_defecto` are narrowed to match DB CHECKs;
 * the generator keeps them as `string` because they are `bpchar` + CHECK, not Postgres enums.
 */
import type { TipoInstrumento } from './ema'

import type {
  CompositeTypes,
  Constants,
  Database as DatabaseGenerated,
  Enums,
  Json,
} from './database.types.generated'

export type Database = DatabaseGenerated & {
  public: {
    Tables: {
      instrumentos: {
        Row: { tipo: TipoInstrumento }
        Insert: { tipo?: TipoInstrumento }
        Update: { tipo?: TipoInstrumento }
      }
      conjuntos_herramientas: {
        Row: { tipo_defecto: TipoInstrumento }
        Insert: { tipo_defecto: TipoInstrumento }
        Update: { tipo_defecto?: TipoInstrumento }
      }
    }
  }
}

export type { CompositeTypes, Constants, Enums, Json } from './database.types.generated'
