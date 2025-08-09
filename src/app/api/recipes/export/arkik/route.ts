import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { createServiceClient } from '@/lib/supabase/server';

function buildArkikHeader(materials: any[]) {
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

export async function GET(req: Request) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const plantId = searchParams.get('plant_id');
    const recipeCodesParam = searchParams.get('recipe_codes');
    const recipeCodes = recipeCodesParam ? recipeCodesParam.split(',').map(s => s.trim()).filter(Boolean) : null;
    const varianteParam = searchParams.get('variante'); // '000' | 'PCE' | null (auto)
    const typeCode = searchParams.get('type_code') || 'B'; // unclear segment in long code
    const numSegment = searchParams.get('num') || '2';
    const factorGParam = searchParams.get('factor_g');
    const factorG = factorGParam !== null ? parseFloat(factorGParam) : null; // default null/blank
    const contenidoAire = parseFloat(searchParams.get('contenido_aire') || '1.5');
    const volumenConcreto = parseFloat(searchParams.get('volumen_concreto') || '1000');
    const preview = searchParams.get('preview') === 'true';

    // 1) Load active materials with ARKIK mapping
    let materialsQuery = supabase
      .from('materials')
      .select('id, material_name, material_code, category, subcategory, arkik_short_code, arkik_supplier, supplier_code, primary_supplier')
      .eq('is_active', true)
      .order('material_name');
    if (plantId) materialsQuery = materialsQuery.eq('plant_id', plantId);
    const { data: materials, error: materialsError } = await materialsQuery;
    if (materialsError) throw materialsError;

    const sortByCode = (arr: any[]) => arr.sort((a, b) => String(a.material_code).localeCompare(String(b.material_code)));
    const orderedMaterials = [
      ...sortByCode(materials.filter(m => m.category === 'cemento')),
      ...sortByCode(materials.filter(m => m.category === 'agua')),
      ...sortByCode(materials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_grueso')),
      ...sortByCode(materials.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_fino')),
      ...sortByCode(materials.filter(m => m.category === 'aditivo'))
    ];

    // 2) Load recipes with current version and SSS references
    let recipesQuery = supabase
      .from('recipes')
      .select(`
        id, recipe_code, new_system_code, strength_fc, age_days, placement_type, max_aggregate_size, slump,
        arkik_long_code, arkik_short_code, arkik_type_code, arkik_num, arkik_variante,
        arkik_volumen_concreto, arkik_contenido_aire, arkik_factor_g,
        recipe_versions!inner(id, version_number, is_current)
      `)
      .eq('recipe_versions.is_current', true)
      .order('recipe_code');
    if (plantId) recipesQuery = recipesQuery.eq('plant_id', plantId);
    if (recipeCodes && recipeCodes.length > 0) recipesQuery = recipesQuery.in('recipe_code', recipeCodes);
    const { data: recipes, error: recipesError } = await recipesQuery;
    if (recipesError) throw recipesError;

    const versionIds = recipes.map(r => r.recipe_versions[0].id);
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

    const header = buildArkikHeader(orderedMaterials);
    const rows: any[][] = [header];
    const materialIndexById = new Map(orderedMaterials.map((m, idx) => [m.id, idx]));
    const materialIndexByCode = new Map(orderedMaterials.map((m, idx) => [String(m.material_code || '').toUpperCase(), idx]));
    const firstCementIdx = orderedMaterials.findIndex(m => m.category === 'cemento');
    const firstWaterIdx = orderedMaterials.findIndex(m => m.category === 'agua');
    const fineAggregatesStart = orderedMaterials.findIndex(m => m.category === 'agregado' && m.subcategory === 'agregado_fino');
    const coarseAggregatesStart = orderedMaterials.findIndex(m => m.category === 'agregado' && m.subcategory === 'agregado_grueso');
    const additivesStart = orderedMaterials.findIndex(m => m.category === 'aditivo');

    for (const r of recipes) {
      const fc = r.strength_fc;
      const edad = r.age_days || 28;
      const coloc = r.placement_type === 'BOMBEADO' ? 'B' : 'D';
      const tma = r.max_aggregate_size || 20;
      const rev = r.slump || 10;
      // Determine variant: if any PCE additive present and no explicit override, use PCE; else use provided or default '000'
      const rRefs = refs.filter(x => x.recipe_version_id === r.recipe_versions[0].id);
      const rQuants = quants.filter(x => x.recipe_version_id === r.recipe_versions[0].id);
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

      const fixed = [
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

      // Build dynamic row respecting header order: cement(s) [1-col], water(s) [1-col], rest [pairs]
      const cementValues: any[] = [];
      const waterValues: any[] = [];
      const restValues: any[] = [];

      const placeValue = (matIdx: number, value: any) => {
        const m = orderedMaterials[matIdx];
        if (!m) return;
        if (m.category === 'cemento') {
          // push single cell
          cementValues.push(value ?? '');
        } else if (m.category === 'agua') {
          waterValues.push(value ?? '');
        } else {
          restValues.push(value ?? '', ''); // value + empty %
        }
      };

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

      // Iterate ordered materials to align exactly with header
      orderedMaterials.forEach((m, idx) => {
        const val = (m.id && valueById.get(String(m.id))) ?? valueByType.get(String(m.material_code || '').toUpperCase()) ?? '';
        if (m.category === 'cemento') {
          cementValues.push(val);
        } else if (m.category === 'agua') {
          waterValues.push(val);
        } else {
          restValues.push(val, '');
        }
      });

      rows.push([...fixed, ...cementValues, ...waterValues, ...restValues]);
    }

    if (preview) {
      return NextResponse.json({ header, rows: rows.slice(1) });
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


