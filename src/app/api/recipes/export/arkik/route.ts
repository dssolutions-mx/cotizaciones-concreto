import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { createServiceClient } from '@/lib/supabase/server';

function buildArkikHeader(materials: any[]) {
  const fixed = [
    'ORDEN DEL RECIP', 'CODIGO LARGO ARKIK', 'VERIFICACION', 'CODIGO', "f'c", 'EDAD', 'COLOC.', 'T.M.A.', 'REV.', 'VARIANTE',
    'Volumen de concreto', '% contenido de aire', 'Factor G', 'Costo de mezcla', 'Metodo'
  ];

  const dynamic: string[] = [];
  for (const m of materials) {
    const code = m.material_code || m.arkik_code || '';
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
        id, recipe_code, new_system_code, strength_fc, age_days, placement_type, max_aggregate_size, slump, recipe_type,
        recipe_versions!inner(id, version_number, is_current)
      `)
      .eq('recipe_versions.is_current', true)
      .order('recipe_code');
    if (plantId) recipesQuery = recipesQuery.eq('plant_id', plantId);
    const { data: recipes, error: recipesError } = await recipesQuery;
    if (recipesError) throw recipesError;

    const versionIds = recipes.map(r => r.recipe_versions[0].id);
    const { data: refs, error: refsError } = await supabase
      .from('recipe_reference_materials')
      .select('recipe_version_id, material_id, sss_value')
      .in('recipe_version_id', versionIds);
    if (refsError) throw refsError;

    const header = buildArkikHeader(orderedMaterials);
    const rows: any[][] = [header];
    const materialIndexById = new Map(orderedMaterials.map((m, idx) => [m.id, idx]));

    for (const r of recipes) {
      const fc = r.strength_fc;
      const edad = r.age_days || 28;
      const coloc = r.placement_type === 'BOMBEADO' ? 'B' : 'D';
      const tma = r.max_aggregate_size || 20;
      const rev = r.slump || 10;
      // Determine variant: if any PCE additive present and no explicit override, use PCE; else use provided or default '000'
      const rRefs = refs.filter(x => x.recipe_version_id === r.recipe_versions[0].id);
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
      const prefix = r.recipe_type === 'MR' ? 'PAV' : '5';
      const codigoLargo = `${prefix}-${fcCode}-${tmaFactor}-${typeCode}-${edadCode}-${revCode}-${coloc}-${numSegment}-${varianteCode}`;
      const shortCode = `${fcCode}${edadCode}${tmaFactor}${revCode}${coloc}`;

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
        volumenConcreto,
        contenidoAire,
        factorG ?? '',
        '',
        ''
      ];

      const dynamicCells: any[] = new Array(orderedMaterials.length * 2).fill('');
      for (const ref of rRefs) {
        const idx = materialIndexById.get(ref.material_id);
        if (idx === undefined) continue;
        const qCol = idx * 2;
        dynamicCells[qCol] = ref.sss_value ?? '';
        dynamicCells[qCol + 1] = '';
      }

      rows.push([...fixed, ...dynamicCells]);
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


