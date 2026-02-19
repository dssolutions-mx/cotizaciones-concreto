# Arkik Recipe Creation - Cautions and Governance

## Overview

The "Crear receta" flow in the Arkik processor allows EXECUTIVE, PLANT_MANAGER, and QUALITY_TEAM users to create missing recipes directly from validated Arkik data, with full governance (preview and confirm before creation).

## When to Use

- Only when the Arkik file has been parsed and validated, and "Recetas Faltantes" are shown
- Excel is already parsed; materials are already mapped via `arkik_material_mapping`
- User must have role EXECUTIVE, PLANT_MANAGER, or QUALITY_TEAM
- **Never automatic** – user must click "Crear receta" and confirm the preview

## Data Flow

1. **Master search order**: Remove suffix from Arkik code → search `master_recipes` by `master_code` first → if not found, create new master with parsed specs
2. **P not PAV**: New recipes use prefix `P` for pavimento (MR). Legacy masters may have `PAV` in `master_code`; search supports both
3. **Reference materials**: `recipe_reference_materials` (SSS) are **not** populated when Arkik lacks SSS data – we do not copy quantity as sss_value
4. **Materials**: Derived from `materials_teorico / volumen_fabricado` via `arkik_material_mapping`

## Limitations

- **PAV and non-standard codes** may not parse correctly. If parse fails, user must create manually at /recipes
- **Unmapped materials** require configuration in `arkik_material_mapping` before recipe creation
- **Volume = 0** blocks creation – cannot compute per-m³ quantities

## Post-Create

After registering each recipe, the user must configure a price for it (existing "Precios Faltantes" flow).

## Governance

- User must review specs and materials before confirming
- No bulk auto-create – one recipe per modal confirmation
- Code collision (recipe_code already exists) blocks create with clear message
