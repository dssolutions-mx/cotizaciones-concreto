import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';

const UNAUTHORIZED_HEADERS = { 'Cache-Control': 'no-store' as const };

function buildArkikHeaderUpdate(materials: any[]) {
  const fixed = [
    'ORDEN DEL RECIP', 'CODIGO LARGO ARKIK', 'VERIFICACION', 'CODIGO', "f'c", 'EDAD', 'COLOC.', 'T.M.A.', 'REV.', 'VARIANTE',
    'Volumen de concreto', '% contenido de aire', 'Factor G', 'Costo de mezcla', 'Metodo'
  ];

  const dynamic: string[] = [];
  const cements = materials.filter(m => m.category === 'cemento');
  const waters = materials.filter(m => m.category === 'agua');
  const rest = materials.filter(m => m.category !== 'cemento' && m.category !== 'agua');

  // Cement(s): single column per cement, no percentage
  for (const m of cements) {
    const code = m.material_code || '';
    const shortCode = m.arkik_short_code || m.supplier_code || '';
    const supplier = m.arkik_supplier || m.primary_supplier || '';
    dynamic.push(`${code}${shortCode ? ' / ' + shortCode : ''}${supplier ? ' / ' + supplier : ''}`);
  }

  // Water(s): single column per water, no percentage
  for (const m of waters) {
    const code = m.material_code || '';
    const shortCode = m.arkik_short_code || m.supplier_code || '';
    const supplier = m.arkik_supplier || m.primary_supplier || '';
    dynamic.push(`${code}${shortCode ? ' / ' + shortCode : ''}${supplier ? ' / ' + supplier : ''}`);
  }

  // Aggregates and additives: value + % columns
  for (const m of rest) {
    const code = m.material_code || '';
    const shortCode = m.arkik_short_code || m.supplier_code || '';
    const supplier = m.arkik_supplier || m.primary_supplier || '';
    const label = `${code}${shortCode ? ' / ' + shortCode : ''}${supplier ? ' / ' + supplier : ''}`;
    dynamic.push(label, `% - ${code}`);
  }

  return [...fixed, ...dynamic];
}

function buildArkikHeaderNew(materials: any[], debug = false) {
  const fixed = [
    'Planta', 'Certify Index', 'ID Producto Técnico', 'ID Comercial', 'Código largo', 'Descripción comercial',
    'Grupo de aplicación', 'Estándar', 'Exposición', 'Resistencia', 'Edad', 'Edad técnica', 'Tamaño Máx. Agregado',
    'Origen', 'Consistencia', 'Cons. Técnica', 'Bomba', 'Tipo Binder', 'Variante', 'Id Receta',
    'Tiempo de Mezclado', 'AggRecicladoMaximo', 'TiempoDisparoEspuma', 'Max Tamaño de Carga',
    'Etiqueta Curva Granulometría', 'AguaRecDeFinosMáx', '% de agua reciclada', 'Clase de cloruro',
    'Clases de álcali', 'Nivel de aire mínimo', 'Adición de agua Máx.', 'Desarrollo de resistencia',
    'Otra limitante', 'Contenido por cliente min', 'Plastificante máximo permitido',
    'Lugar para agregar plastificante', 'Máximo autorizado de adición de agua', 'Tiempo de uso',
    'Comentario1', 'Comentario2', 'Comentario3', 'Comentario interno', 'Fecha de validez', 'Estatus',
    'Consistencia', 'Exposure class', 'Lugar para agregar la consistencia', 'ml de adición máx',
    'PlaceAddAdmixtureML', 'Volumen de concreto', '% contenido de aire', 'Factor G', 'Costo de mezcla', 'Metodo'
  ];

  // Sort materials in correct order: cement → water → coarse agg → fine agg → additives
  const sortByCode = (arr: any[]) => arr.sort((a, b) => String(a.material_code || '').localeCompare(String(b.material_code || '')));
  const cements = sortByCode(materials.filter(m => m.category === 'cemento'));
  const waters = sortByCode(materials.filter(m => m.category === 'agua'));
  const coarseAggregates = sortByCode(materials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_grueso'));
  const fineAggregates = sortByCode(materials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_fino'));
  const additives = sortByCode(materials.filter(m => m.category === 'aditivo'));

  if (debug) {
    console.log(`[buildArkikHeaderNew] Cements: ${cements.length}, Waters: ${waters.length}, Coarse: ${coarseAggregates.length}, Fine: ${fineAggregates.length}, Additives: ${additives.length}`);
  }

  const dynamic: string[] = [];

  // Cement(s): single column per cement, no percentage
  for (const m of cements) {
    const code = m.material_code || '';
    const shortCode = m.arkik_short_code || m.supplier_code || '';
    const supplier = m.arkik_supplier || m.primary_supplier || '';
    dynamic.push(`${code}${shortCode ? ' / ' + shortCode : ''}${supplier ? ' / ' + supplier : ''}`);
  }
  if (debug) console.log(`[buildArkikHeaderNew] After cements: ${dynamic.length} material columns`);

  // Water(s): single column per water, no percentage
  for (const m of waters) {
    const code = m.material_code || '';
    const shortCode = m.arkik_short_code || m.supplier_code || '';
    const supplier = m.arkik_supplier || m.primary_supplier || '';
    dynamic.push(`${code}${shortCode ? ' / ' + shortCode : ''}${supplier ? ' / ' + supplier : ''}`);
  }
  if (debug) console.log(`[buildArkikHeaderNew] After waters: ${dynamic.length} material columns`);

  // Coarse aggregates: value + % columns
  for (const m of coarseAggregates) {
    const code = m.material_code || '';
    const shortCode = m.arkik_short_code || m.supplier_code || '';
    const supplier = m.arkik_supplier || m.primary_supplier || '';
    const label = `${code}${shortCode ? ' / ' + shortCode : ''}${supplier ? ' / ' + supplier : ''}`;
    dynamic.push(label, `% - ${code}`);
  }
  if (debug) console.log(`[buildArkikHeaderNew] After coarse aggregates: ${dynamic.length} material columns`);

  // Fine aggregates: value + % columns
  for (const m of fineAggregates) {
    const code = m.material_code || '';
    const shortCode = m.arkik_short_code || m.supplier_code || '';
    const supplier = m.arkik_supplier || m.primary_supplier || '';
    const label = `${code}${shortCode ? ' / ' + shortCode : ''}${supplier ? ' / ' + supplier : ''}`;
    dynamic.push(label, `% - ${code}`);
  }
  if (debug) console.log(`[buildArkikHeaderNew] After fine aggregates: ${dynamic.length} material columns`);

  // Additives: value + % columns
  for (const m of additives) {
    const code = m.material_code || '';
    const shortCode = m.arkik_short_code || m.supplier_code || '';
    const supplier = m.arkik_supplier || m.primary_supplier || '';
    const label = `${code}${shortCode ? ' / ' + shortCode : ''}${supplier ? ' / ' + supplier : ''}`;
    dynamic.push(label, `% - ${code}`);
  }
  if (debug) console.log(`[buildArkikHeaderNew] After additives: ${dynamic.length} material columns`);

  return [...fixed, ...dynamic];
}

// Build material code row that matches header EXACTLY - column by column
// This function must match the structure of buildArkikHeaderNew
function buildMaterialCodeRow(materials: any[], debug = false): string[] {
  const row: string[] = [];
  
  // Sort materials in SAME order as buildArkikHeaderNew
  const sortByCode = (arr: any[]) => arr.sort((a, b) => String(a.material_code || '').localeCompare(String(b.material_code || '')));
  const cements = sortByCode(materials.filter(m => m.category === 'cemento'));
  const waters = sortByCode(materials.filter(m => m.category === 'agua'));
  const coarseAggregates = sortByCode(materials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_grueso'));
  const fineAggregates = sortByCode(materials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_fino'));
  const additives = sortByCode(materials.filter(m => m.category === 'aditivo'));

  if (debug) {
    console.log(`[buildMaterialCodeRow] Cements: ${cements.length}, Waters: ${waters.length}, Coarse: ${coarseAggregates.length}, Fine: ${fineAggregates.length}, Additives: ${additives.length}`);
  }

  // Track order numbers across categories
  let cementOrder = 1;
  let waterOrder = 3; // Starts at 3
  let coarseOrder = 10; // Starts at 10
  let fineOrder = 10; // Starts at 10 (can vary, but we'll use sequential)
  let additiveOrder = 13; // Starts at 13

  // Cement(s): single code per cement (matches header: 1 column per cement)
  for (const m of cements) {
    const category = '1';
    const code = m.material_code || '';
    const order = String(cementOrder++);
    const defaultVal = '1';
    row.push(`${category}@${code}@${order}@D@${defaultVal}`);
  }
  if (debug) console.log(`[buildMaterialCodeRow] After cements: ${row.length} columns`);

  // Water(s): single code per water (matches header: 1 column per water)
  for (const m of waters) {
    const category = '3';
    const code = m.material_code || '';
    const order = String(waterOrder++);
    const defaultVal = '1';
    row.push(`${category}@${code}@${order}@D@${defaultVal}`);
  }
  if (debug) console.log(`[buildMaterialCodeRow] After waters: ${row.length} columns`);

  // Coarse aggregates: D code + P code per aggregate (matches header: 2 columns per aggregate)
  for (const m of coarseAggregates) {
    const category = '4';
    const code = m.material_code || '';
    const order = String(coarseOrder++);
    const defaultVal = '1';
    row.push(`${category}@${code}@${order}@D@${defaultVal}`, `${category}@${code}@${order}@P@0`);
  }
  if (debug) console.log(`[buildMaterialCodeRow] After coarse aggregates: ${row.length} columns`);

  // Fine aggregates: D code + P code per aggregate (matches header: 2 columns per aggregate)
  for (const m of fineAggregates) {
    const category = '5';
    const code = m.material_code || '';
    const order = String(fineOrder++);
    const defaultVal = '1';
    row.push(`${category}@${code}@${order}@D@${defaultVal}`, `${category}@${code}@${order}@P@0`);
  }
  if (debug) console.log(`[buildMaterialCodeRow] After fine aggregates: ${row.length} columns`);

  // Additives: D code + P code per additive (matches header: 2 columns per additive)
  for (const m of additives) {
    const category = '6';
    const code = m.material_code || '';
    const order = String(additiveOrder++);
    const defaultVal = '1';
    row.push(`${category}@${code}@${order}@D@${defaultVal}`, `${category}@${code}@${order}@P@0`);
  }
  if (debug) console.log(`[buildMaterialCodeRow] After additives: ${row.length} columns`);

  return row;
}

export async function GET(req: Request) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: UNAUTHORIZED_HEADERS });
    }
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const plantId = searchParams.get('plant_id');
    const recipeCodesParam = searchParams.get('recipe_codes');
    const recipeCodes = recipeCodesParam ? recipeCodesParam.split(',').map(s => s.trim()).filter(Boolean) : null;
    const exportType = searchParams.get('export_type') || 'update'; // 'new' or 'update'
    const varianteParam = searchParams.get('variante'); // '000' | 'PCE' | null (auto)
    const typeCode = searchParams.get('type_code') || 'B'; // unclear segment in long code
    const numSegment = searchParams.get('num') || '2';
    const factorGParam = searchParams.get('factor_g');
    const factorG = factorGParam !== null ? parseFloat(factorGParam) : null; // default null/blank
    const contenidoAire = parseFloat(searchParams.get('contenido_aire') || '1.5');
    const volumenConcreto = parseFloat(searchParams.get('volumen_concreto') || '1000');
    const preview = searchParams.get('preview') === 'true';

    // 1) Load active materials with ARKIK mapping - FILTER BY PLANT
    let materialsQuery = supabase
      .from('materials')
      .select('id, material_name, material_code, category, subcategory, arkik_short_code, arkik_supplier, supplier_code, primary_supplier, plant_id')
      .eq('is_active', true)
      .order('material_name');
    if (plantId) {
      materialsQuery = materialsQuery.eq('plant_id', plantId);
      console.log(`[Export] Filtering materials by plant_id: ${plantId}`);
    } else {
      console.warn(`[Export] WARNING: No plant_id provided, loading materials from ALL plants!`);
    }
    const { data: materials, error: materialsError } = await materialsQuery;
    if (materialsError) throw materialsError;

    console.log(`[Export] Loaded ${materials?.length || 0} total materials`);
    if (materials && materials.length > 0) {
      const cementsCount = materials.filter(m => m.category === 'cemento').length;
      const watersCount = materials.filter(m => m.category === 'agua').length;
      const coarseCount = materials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_grueso').length;
      const fineCount = materials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_fino').length;
      const additivesCount = materials.filter(m => m.category === 'aditivo').length;
      console.log(`[Export] Materials breakdown: Cements=${cementsCount}, Waters=${watersCount}, Coarse=${coarseCount}, Fine=${fineCount}, Additives=${additivesCount}`);
      
      // Check for duplicates by material_code
      const materialCodes = new Map<string, number>();
      materials.forEach(m => {
        const code = m.material_code || '';
        materialCodes.set(code, (materialCodes.get(code) || 0) + 1);
      });
      const duplicates = Array.from(materialCodes.entries()).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        console.warn(`[Export] WARNING: Found duplicate material codes: ${duplicates.map(([code, count]) => `${code} (${count}x)`).join(', ')}`);
      }
      
      // Log cement materials specifically
      const cements = materials.filter(m => m.category === 'cemento');
      console.log(`[Export] Cement materials (${cements.length}):`, cements.map(m => `${m.material_code} (ID: ${m.id}, Plant: ${m.plant_id})`).join(', '));
    }

    // Sort materials in correct order: cement → water → coarse agg → fine agg → additives
    const sortByCode = (arr: any[]) => arr.sort((a, b) => String(a.material_code).localeCompare(String(b.material_code)));
    const orderedMaterials = [
      ...sortByCode(materials.filter(m => m.category === 'cemento')),
      ...sortByCode(materials.filter(m => m.category === 'agua')),
      ...sortByCode(materials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_grueso')),
      ...sortByCode(materials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_fino')),
      ...sortByCode(materials.filter(m => m.category === 'aditivo'))
    ];
    
    console.log(`[Export] Ordered materials total: ${orderedMaterials.length}`);

    // 2) Load recipes with current version and SSS references
    // IMPORTANT: Only export variants (recipes with master_recipe_id), not master recipes
    // Use single() to ensure only one version per recipe, or filter after
    let recipesQuery = supabase
      .from('recipes')
      .select(`
        id, recipe_code, new_system_code, strength_fc, age_days, placement_type, max_aggregate_size, slump,
        arkik_long_code, arkik_short_code, arkik_type_code, arkik_num, arkik_variante,
        arkik_volumen_concreto, arkik_contenido_aire, arkik_factor_g, plant_id, master_recipe_id,
        recipe_versions!inner(id, version_number, is_current)
      `)
      .eq('recipe_versions.is_current', true)
      .not('master_recipe_id', 'is', null) // Only variants, not masters
      .order('recipe_code');
    if (plantId) recipesQuery = recipesQuery.eq('plant_id', plantId);
    if (recipeCodes && recipeCodes.length > 0) recipesQuery = recipesQuery.in('recipe_code', recipeCodes);
    const { data: recipesRaw, error: recipesError } = await recipesQuery;
    if (recipesError) throw recipesError;

    console.log(`[Export] Raw recipes from query: ${recipesRaw?.length || 0}`);

    // Deduplicate recipes - Supabase inner join can sometimes return duplicates
    // Also handle case where a recipe might have multiple current versions (shouldn't happen, but be safe)
    // Group by recipe id and take the first one (they should all be the same)
    const recipeMap = new Map<string, any>();
    const seenRecipeCodes = new Set<string>();
    
    for (const r of recipesRaw || []) {
      // Double-check: if we've seen this recipe ID before, skip
      if (recipeMap.has(r.id)) {
        console.warn(`[Export] Duplicate recipe ID found: ${r.recipe_code} (ID: ${r.id}), skipping duplicate`);
        continue;
      }
      
      // Also check by recipe_code to catch any edge cases
      if (seenRecipeCodes.has(r.recipe_code)) {
        console.warn(`[Export] Duplicate recipe_code found: ${r.recipe_code} (ID: ${r.id}), skipping duplicate`);
        continue;
      }
      
      // Normalize recipe_versions to always be an array with single current version
      const versions = Array.isArray(r.recipe_versions) ? r.recipe_versions : [r.recipe_versions];
      const currentVersions = versions.filter((v: any) => v.is_current);
      
      if (currentVersions.length === 0) {
        console.warn(`[Export] Recipe ${r.recipe_code} has no current version, skipping`);
        continue;
      }
      
      if (currentVersions.length > 1) {
        console.warn(`[Export] Recipe ${r.recipe_code} has ${currentVersions.length} current versions! Using first one.`);
      }
      
      // Take first current version and normalize the recipe object
      const normalizedRecipe = {
        ...r,
        recipe_versions: [currentVersions[0]] // Ensure single version
      };
      
      recipeMap.set(r.id, normalizedRecipe);
      seenRecipeCodes.add(r.recipe_code);
    }
    
    const recipes = Array.from(recipeMap.values());
    
    console.log(`[Export] After deduplication: ${recipes.length} unique recipe(s) for export`);
    if (recipeCodes && recipeCodes.length > 0) {
      console.log(`[Export] Requested recipe codes: ${recipeCodes.join(', ')}`);
      console.log(`[Export] Found recipe codes: ${recipes.map(r => r.recipe_code).join(', ')}`);
    }
    
    // Final validation: ensure no duplicates by recipe_code
    const recipeCodesFound = recipes.map(r => r.recipe_code);
    const uniqueCodes = new Set(recipeCodesFound);
    if (recipeCodesFound.length !== uniqueCodes.size) {
      console.error(`[Export] CRITICAL: Still have duplicate recipe codes after deduplication!`);
      console.error(`[Export] Recipe codes: ${recipeCodesFound.join(', ')}`);
      // Filter to only unique codes
      const finalRecipes: any[] = [];
      const codesSeen = new Set<string>();
      for (const r of recipes) {
        if (!codesSeen.has(r.recipe_code)) {
          finalRecipes.push(r);
          codesSeen.add(r.recipe_code);
        }
      }
      console.log(`[Export] After final deduplication: ${finalRecipes.length} unique recipe(s)`);
      // Replace recipes array with deduplicated version
      recipes.length = 0;
      recipes.push(...finalRecipes);
    }

    // Ensure each recipe has exactly one current version
    const versionIds = recipes.map(r => {
      const versions = Array.isArray(r.recipe_versions) ? r.recipe_versions : [r.recipe_versions];
      const currentVersion = versions.find((v: any) => v.is_current) || versions[0];
      if (!currentVersion) {
        throw new Error(`Recipe ${r.recipe_code} has no current version`);
      }
      return currentVersion.id;
    });
    const { data: refs, error: refsError } = await supabase
      .from('recipe_reference_materials')
      .select('recipe_version_id, material_id, material_type, sss_value')
      .in('recipe_version_id', versionIds);
    if (refsError) throw refsError;

    // Fallback: load material_quantities for current versions
    const { data: quants, error: quantsError } = await supabase
      .from('material_quantities')
      .select('recipe_version_id, material_id, material_type, quantity, unit')
      .in('recipe_version_id', versionIds);
    if (quantsError) throw quantsError;

    // Get plant code for new format
    let plantCode = '';
    if (plantId && recipes.length > 0) {
      const { data: plant } = await supabase
        .from('plants')
        .select('code')
        .eq('id', plantId)
        .single();
      plantCode = plant?.code || '';
    }

    // Build header based on export type
    const header = exportType === 'new' ? buildArkikHeaderNew(orderedMaterials, true) : buildArkikHeaderUpdate(orderedMaterials);
    const rows: any[][] = [header];
    console.log(`[Export] Header row length: ${header.length} columns`);

    // Add second header row for new format (material code row)
    if (exportType === 'new') {
      // Count actual fixed columns from the header function
      const fixedColumnsCount = 54; // Fixed columns in header (counted: Planta through Metodo)
      const materialColumnsInHeader = header.length - fixedColumnsCount;
      
      const secondRow: string[] = [];
      // Empty cells for fixed columns (54 fixed columns before materials)
      for (let i = 0; i < fixedColumnsCount; i++) {
        secondRow.push('');
      }
      // Material code row - should match header material columns exactly
      const materialCodeRow = buildMaterialCodeRow(orderedMaterials, true);
      
      console.log(`[Export] Header total columns: ${header.length}`);
      console.log(`[Export] Header fixed columns: ${fixedColumnsCount}`);
      console.log(`[Export] Header material columns: ${materialColumnsInHeader}`);
      console.log(`[Export] Material code row length: ${materialCodeRow.length}`);
      
      if (materialCodeRow.length !== materialColumnsInHeader) {
        console.error(`[Export] CRITICAL MISMATCH: Material code row has ${materialCodeRow.length} columns but header has ${materialColumnsInHeader} material columns!`);
        console.error(`[Export] This will cause column misalignment in Excel!`);
        // Try to fix by padding or truncating
        if (materialCodeRow.length < materialColumnsInHeader) {
          console.warn(`[Export] Padding material code row with empty strings`);
          while (materialCodeRow.length < materialColumnsInHeader) {
            materialCodeRow.push('');
          }
        } else {
          console.warn(`[Export] Truncating material code row`);
          materialCodeRow.length = materialColumnsInHeader;
        }
      }
      
      console.log(`[Export] Material code row sample: ${materialCodeRow.slice(0, 5).join(', ')}...`);
      const finalSecondRow = [...secondRow, ...materialCodeRow];
      console.log(`[Export] Final second row length: ${finalSecondRow.length} (should match header: ${header.length})`);
      
      if (finalSecondRow.length !== header.length) {
        console.error(`[Export] CRITICAL: Second row length (${finalSecondRow.length}) does not match header length (${header.length})!`);
      }
      
      rows.push(finalSecondRow);
    }

    const materialIndexById = new Map(orderedMaterials.map((m, idx) => [m.id, idx]));
    const materialIndexByCode = new Map(orderedMaterials.map((m, idx) => [String(m.material_code || '').toUpperCase(), idx]));

    console.log(`[Export] Processing ${recipes.length} recipe(s) for data rows`);
    
    // Track processed recipes to prevent duplicates in the loop
    const processedRecipeIds = new Set<string>();
    let rowCount = 0;
    
    for (const r of recipes) {
      // Safety check: skip if we've already processed this recipe ID
      if (processedRecipeIds.has(r.id)) {
        console.error(`[Export] CRITICAL: Attempting to process duplicate recipe ${r.recipe_code} (ID: ${r.id}) in loop! Skipping.`);
        continue;
      }
      processedRecipeIds.add(r.id);
      
      console.log(`[Export] Processing recipe ${rowCount + 1}/${recipes.length}: ${r.recipe_code} (ID: ${r.id})`);
      
      const fc = r.strength_fc;
      const edad = r.age_days || 28;
      const coloc = r.placement_type === 'BOMBEADO' ? 'B' : 'D';
      const tma = r.max_aggregate_size || 20;
      const rev = r.slump || 10;
      
      // Get current version for this recipe
      const versions = Array.isArray(r.recipe_versions) ? r.recipe_versions : [r.recipe_versions];
      const currentVersion = versions.find((v: any) => v.is_current) || versions[0];
      if (!currentVersion) {
        console.error(`[Export] Recipe ${r.recipe_code} has no current version, skipping`);
        continue;
      }
      
      console.log(`[Export] Recipe ${r.recipe_code} using version ${currentVersion.id}`);
      
      // Determine variant: if any PCE additive present and no explicit override, use PCE; else use provided or default '000'
      const rRefs = refs.filter(x => x.recipe_version_id === currentVersion.id);
      const rQuants = quants.filter(x => x.recipe_version_id === currentVersion.id);
      const pcePresent = rRefs.some(ref => {
        const mat = orderedMaterials.find(m => m.id === ref.material_id);
        if (!mat) return false;
        if (mat.category !== 'aditivo') return false;
        const name = (mat.material_name || '').toUpperCase();
        const short = (mat.arkik_short_code || mat.supplier_code || '').toUpperCase();
        return name.includes('PCE') || short.includes('PCE');
      });
      const varianteCode = varianteParam ?? (pcePresent ? 'PCE' : '000');

      const fcCode = String(fc).padStart(3, '0');
      const edadCode = String(edad).padStart(2, '0');
      const revCode = String(rev).padStart(2, '0');
      const tmaFactor = tma === 40 ? '4' : '2';
      const prefix = '5'; // use saved codes instead when available
      const savedType = r.arkik_type_code || typeCode;
      const savedNum = r.arkik_num || numSegment;
      const savedVar = r.arkik_variante || varianteCode;
      const codigoLargo = r.arkik_long_code || `${prefix}-${fcCode}-${tmaFactor}-${savedType}-${edadCode}-${revCode}-${coloc}-${savedNum}-${savedVar}`;
      const shortCode = r.arkik_short_code || `${fcCode}${edadCode}${tmaFactor}${revCode}${coloc}`;

      // Build fixed columns based on export type
      let fixed: any[];
      if (exportType === 'new') {
        // Extract short code from recipe_code for Descripción comercial (e.g., "5-200-2-B-28-10-D-2-00M" -> "5-200-2-B-28-10")
        // Pattern: remove everything from "-D-" onwards (placement type + num + variant)
        const descComercial = r.recipe_code || codigoLargo;
        const shortDescMatch = descComercial.match(/^(.+?)(?:-[DB]-\d+-(?:[A-Z0-9]+)?)?$/);
        const descComercialShort = shortDescMatch ? shortDescMatch[1] : descComercial;
        
        // Format values to match CSV spacing (add trailing spaces where needed)
        const formatValue = (val: any, trailingSpaces = 0) => {
          if (val === null || val === undefined || val === '') return '';
          const str = String(val);
          return trailingSpaces > 0 ? str + ' '.repeat(trailingSpaces) : str;
        };
        
        fixed = [
          plantCode, // Planta
          '', // Certify Index
          '', // ID Producto Técnico
          '', // ID Comercial
          codigoLargo, // Código largo
          descComercialShort, // Descripción comercial (shortened version)
          '', // Grupo de aplicación
          '', // Estándar
          '      ', // Exposición (6 spaces as in CSV)
          formatValue(fc, 1), // Resistencia (with trailing space)
          formatValue(edadCode, 1), // Edad (with trailing space)
          formatValue(edadCode, 1), // Edad técnica (with trailing space)
          formatValue(tma, 1), // Tamaño Máx. Agregado (with trailing space)
          '', // Origen
          formatValue(rev, 1), // Consistencia (with trailing space)
          formatValue(rev, 1), // Cons. Técnica (with trailing space)
          coloc, // Bomba
          savedType, // Tipo Binder
          formatValue(varianteCode, 3), // Variante (with 3 trailing spaces: "00M   ")
          '', // Id Receta
          '', // Tiempo de Mezclado
          '', // AggRecicladoMaximo
          '', // TiempoDisparoEspuma
          '', // Max Tamaño de Carga
          '', // Etiqueta Curva Granulometría
          '', // AguaRecDeFinosMáx
          '', // % de agua reciclada
          '', // Clase de cloruro
          '', // Clases de álcali
          '', // Nivel de aire mínimo
          '', // Adición de agua Máx.
          '', // Desarrollo de resistencia
          '', // Otra limitante
          '', // Contenido por cliente min
          '', // Plastificante máximo permitido
          '', // Lugar para agregar plastificante
          '', // Máximo autorizado de adición de agua
          '', // Tiempo de uso
          '', // Comentario1
          '', // Comentario2
          '', // Comentario3
          '', // Comentario interno
          '01/01/2050', // Fecha de validez
          'Active', // Estatus
          `REVENIMIENTO ${rev} cm +/- 2.5`, // Consistencia
          '', // Exposure class
          '', // Lugar para agregar la consistencia
          '', // ml de adición máx
          '', // PlaceAddAdmixtureML
          (r.arkik_volumen_concreto ?? volumenConcreto).toFixed(2), // Volumen de concreto (2 decimals)
          (r.arkik_contenido_aire ?? contenidoAire).toFixed(2), // % contenido de aire (2 decimals)
          String((r.arkik_factor_g ?? factorG) ?? ''), // Factor G
          '', // Costo de mezcla
          '' // Metodo
        ];
      } else {
        fixed = [
          '',
          codigoLargo,
          'DIFERENTES',
          shortCode,
          fc,
          edadCode,
          coloc,
          tma,
          rev,
          varianteCode,
          r.arkik_volumen_concreto ?? volumenConcreto,
          r.arkik_contenido_aire ?? contenidoAire,
          (r.arkik_factor_g ?? factorG) ?? '',
          '',
          ''
        ];
      }

      // Build dynamic row respecting header order EXACTLY: cement(s) → water(s) → coarse agg → fine agg → additives
      // Must match the exact structure of buildArkikHeaderNew
      const sortByCode = (arr: any[]) => arr.sort((a, b) => String(a.material_code || '').localeCompare(String(b.material_code || '')));
      const cements = sortByCode(orderedMaterials.filter(m => m.category === 'cemento'));
      const waters = sortByCode(orderedMaterials.filter(m => m.category === 'agua'));
      const coarseAggregates = sortByCode(orderedMaterials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_grueso'));
      const fineAggregates = sortByCode(orderedMaterials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_fino'));
      const additives = sortByCode(orderedMaterials.filter(m => m.category === 'aditivo'));

      // Build quick maps for values
      const valueById = new Map<string, number>();
      const valueByType = new Map<string, number>();
      rRefs.forEach(ref => {
        if (ref.material_id) valueById.set(String(ref.material_id), Number(ref.sss_value));
        if (ref.material_type) valueByType.set(String(ref.material_type).toUpperCase(), Number(ref.sss_value));
      });
      // Fallback fill with material_quantities where SSS missing
      rQuants.forEach(q => {
        const keyT = String(q.material_type || '').toUpperCase();
        if (q.material_id && !valueById.has(String(q.material_id))) valueById.set(String(q.material_id), Number(q.quantity));
        if (keyT && !valueByType.has(keyT)) valueByType.set(keyT, Number(q.quantity));
      });

      // Helper to get formatted value for a material
      const getValue = (m: any): string => {
        const rawVal = (m.id && valueById.get(String(m.id))) ?? valueByType.get(String(m.material_code || '').toUpperCase()) ?? '';
        return typeof rawVal === 'number' && rawVal > 0 ? rawVal.toFixed(2) : '';
      };

      // Build values in EXACT same order as header
      const materialValues: any[] = [];
      
      // Cements: single value per cement (matches header: 1 column per cement)
      for (const m of cements) {
        materialValues.push(getValue(m));
      }
      
      // Waters: single value per water (matches header: 1 column per water)
      for (const m of waters) {
        materialValues.push(getValue(m));
      }
      
      // Coarse aggregates: value + empty % (matches header: 2 columns per aggregate)
      for (const m of coarseAggregates) {
        materialValues.push(getValue(m), ''); // value + empty %
      }
      
      // Fine aggregates: value + empty % (matches header: 2 columns per aggregate)
      for (const m of fineAggregates) {
        materialValues.push(getValue(m), ''); // value + empty %
      }
      
      // Additives: value + empty % (matches header: 2 columns per additive)
      for (const m of additives) {
        materialValues.push(getValue(m), ''); // value + empty %
      }

      const dataRow = [...fixed, ...materialValues];
      console.log(`[Export] Recipe ${r.recipe_code} data row length: ${dataRow.length} (should match header: ${header.length})`);
      if (dataRow.length !== header.length) {
        console.error(`[Export] WARNING: Row length mismatch for ${r.recipe_code}! Header: ${header.length}, Row: ${dataRow.length}`);
      }
      
      rowCount++;
      rows.push(dataRow);
      console.log(`[Export] Added data row ${rowCount} for recipe ${r.recipe_code} (ID: ${r.id})`);
    }

    const expectedDataRows = recipes.length;
    const actualDataRows = rowCount;
    console.log(`[Export] Total rows generated: ${rows.length} (${exportType === 'new' ? '2 header rows + ' : '1 header row + '}${actualDataRows} data row(s))`);
    if (actualDataRows !== expectedDataRows) {
      console.error(`[Export] CRITICAL: Row count mismatch! Expected ${expectedDataRows} data rows but created ${actualDataRows}`);
    }

    if (preview) {
      return NextResponse.json({ header, rows: rows.slice(exportType === 'new' ? 2 : 1) });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ARKIK');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="arkik_export_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });
  } catch (error: any) {
    console.error('ARKIK export error:', error);
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
  }
}
