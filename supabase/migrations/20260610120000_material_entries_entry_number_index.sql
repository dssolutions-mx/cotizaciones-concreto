-- Speed up per-plant entry number sequence lookups (ENT-YYYYMMDD-###)
CREATE INDEX IF NOT EXISTS idx_material_entries_plant_entry_number
  ON material_entries (plant_id, entry_number);

COMMENT ON INDEX idx_material_entries_plant_entry_number IS
  'Optimizes daily entry_number sequence generation for material receipts';
