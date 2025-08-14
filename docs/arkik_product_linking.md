## Arkik product mapping and order inference

### Objective
Link each Arkik remisión to the correct product (recipe), price, client, and construction site using only the fields we extract from the Excel. Standardize to `remisiones.designacion_ehe` for product identity and persist grouping context on the order with `orders.elemento`.

### Excel fields consumed
- Remisión number → `remisiones.remision_number`
- Fecha → `remisiones.fecha`
- Hora Carga → `remisiones.hora_carga`
- Volumen → `remisiones.volumen_fabricado`
- Placas → `remisiones.unidad`
- Chofer → `remisiones.conductor`
- Product Description (Arkik) → `remisiones.designacion_ehe`
- Comentarios Externos (Arkik) → `orders.elemento`
- Materials (dynamic, per plant): Teórica and Real only → `remision_materiales`

### Remisión/plant parsing rules
- Arkik format example: `P002-007797`
- Extract plant code using regex: `^P(?<digits>\d{3})-` → plant code is `P` + `digits` (e.g., `P002`).
- Extract folio: the numeric tail after the dash (e.g., `007797`). Take the rightmost 5 digits and convert to integer to drop leading zeros (e.g., `07797` → `7797`).
- Store the normalized folio as `remisiones.remision_number` (string form of the integer, e.g., `'7797'`).
- Resolve plant by matching `plants.code = 'P' || digits` and set `orders.plant_id` accordingly.

### Canonical mappings
- Product identity: use `remisiones.designacion_ehe` (standardized; set from Arkik Product Description)
- Grouping context: use `orders.elemento` (set from Arkik Comentarios Externos)
- Plant: source of truth is `orders.plant_id` (keep `remisiones.plant_id` aligned by policy)

### Matching pipeline (recipe → price → client/site)
1) Normalize product identity
   - Read Arkik Product Description and store it in `remisiones.designacion_ehe`.
   - Use as the canonical key to find the recipe.

2) Recipe match (product → recipe)
   - Primary: exact match `recipes.recipe_code = remisiones.designacion_ehe`.
   - Optional fallbacks (if needed): case-insensitive compare; sanitized compare (remove spaces/accents); curated alias table.
   - Result: `recipe_id` established.

3) Price lookup (plant-aware)
   - For the remisión’s plant (from the order context), find price rows in `product_prices` for the matched `recipe_id`.
   - Selection precedence (suggested):
     - Prefer client-specific prices over generic.
     - Prefer rows linked to a `quote_id` for the intended construction site when available.
     - Prefer active/most recent effective date.
   - Result: price row that anchors client and site inference.

4) Client and construction site inference
   - Client:
     - Use `product_prices.client_id` when present.
     - If not present but `product_prices.quote_id` exists, join `quotes` to derive client.
   - Construction site:
     - If `product_prices.quote_id` exists, join `quotes` to get `construction_site` (or associated `construction_site_id` via your flow).
     - If the price row carries a site field (e.g., `product_prices.construction_site`), use it when `quote_id` is null.
   - Result: `client_id` and site resolved for order association or creation.

5) Order linking/creation
   - Try to find an existing order on the same date/plant for the inferred `client_id` and site.
   - Create a new order when none exists; set:
     - `orders.client_id`, `orders.construction_site_id` (or name), `orders.plant_id`
     - `orders.elemento` = Arkik Comentarios Externos (primary grouping key)
   - Attach the remisión to the order.

### Validations and safeguards
- Require: `remision_number`, `fecha`, `volumen_fabricado`.
- Volume must be > 0.
- Recipe must exist for `designacion_ehe`; otherwise flag for manual resolution.
- Price selection should be plant-aware and prefer client/site-specific rows.
- Ensure `orders.plant_id` and `remisiones.plant_id` remain consistent (policy alignment).

### Materials capture (per plant)
- Detect material columns dynamically from headers (Teórica/Real variants with aliases).
- Persist to `remision_materiales` as totals per remisión:
  - `cantidad_teorica` = (theoretical per m³) × `volumen_fabricado`
  - `cantidad_real` = total dosificado real
  - `material_type` = Arkik code (or mapped internal id via `arkik_material_mapping` per plant)

### Minimal write set
- `orders`: `client_id`, `construction_site_id`/`construction_site`, `plant_id`, `elemento`
- `remisiones`: `order_id`, `remision_number`, `fecha`, `hora_carga`, `volumen_fabricado`, `conductor`, `unidad`, `tipo_remision='CONCRETO'`, `recipe_id`, `designacion_ehe`
- `remision_materiales`: `remision_id`, `material_type|material_id`, `cantidad_teorica`, `cantidad_real`

### Notes
- Standardize to `designacion_ehe` only (drop `product_description` in `remisiones`).
- Keep `orders.elemento` as the persisted grouping parameter from Arkik Comentarios Externos.

