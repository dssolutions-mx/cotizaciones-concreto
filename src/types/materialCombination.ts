export interface MaterialCombination {
  id: string
  plant_id: string
  combination_date: string
  combination_time: string
  output_material_id: string
  output_quantity_kg: number
  output_unit_cost: number
  output_total_cost: number
  output_adjustment_id: string | null
  output_entry_id: string | null
  notes: string | null
  created_by: string
  created_at: string
  /** Joined */
  output_material?: { material_name: string; unit_of_measure: string } | null
  inputs?: MaterialCombinationInput[]
}

export interface MaterialCombinationInput {
  id: string
  combination_id: string
  material_id: string
  quantity_kg: number
  total_cost: number
  source_adjustment_id: string | null
  /** Joined */
  material?: { material_name: string; unit_of_measure: string } | null
}

export interface MaterialCombinationInputSpec {
  material_id: string
  quantity_kg: number
}

export interface CreateMaterialCombinationParams {
  plant_id: string
  combination_date: string
  output_material_id: string
  output_quantity_kg: number
  inputs: MaterialCombinationInputSpec[]
  notes?: string | null
  user_id: string
}

export type CreateMaterialCombinationResult =
  | {
      ok: true
      combination_id: string
      output_unit_cost: number
      output_total_cost: number
      input_costs: Array<{ material_id: string; quantity_kg: number; total_cost: number }>
    }
  | {
      ok: false
      error: string
      code?: 'INSUFFICIENT_INVENTORY' | 'NO_ENTRIES' | 'VALIDATION_ERROR'
      insufficient_material_id?: string
    }
