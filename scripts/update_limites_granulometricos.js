const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    // Parse CSV line handling quoted values
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.replace(/^"|"$/g, '') || '';
    });
    data.push(row);
  }
  
  return data;
}

// Group data by size
function groupBySizeNominal(data) {
  const grouped = {};
  
  data.forEach(row => {
    const tamañoNominal = row['Tamaño Nominal'] || row['Tama�o Nominal'];
    const malla = row['No. malla'];
    const limiteInferior = row['Límite inferior'] || row['L�mite inferior'];
    const limiteSuperior = row['Límite Superior'] || row['L�mite Superior'];
    
    // Skip rows with missing data or "--"
    if (!tamañoNominal || !malla || limiteInferior === '--' || limiteSuperior === '--') {
      return;
    }
    
    if (!grouped[tamañoNominal]) {
      grouped[tamañoNominal] = [];
    }
    
    grouped[tamañoNominal].push({
      malla: malla.replace(/"/g, ''),
      limite_inferior: parseInt(limiteInferior),
      limite_superior: parseInt(limiteSuperior)
    });
  });
  
  return grouped;
}

// Convert size nominal to simplified format
function simplifySize(tamañoNominal) {
  // Extract the main size range in mm
  const match = tamañoNominal.match(/(\d+\.?\d*)\s+a\s+(\d+\.?\d*)\s+mm/);
  if (match) {
    const [_, upper, lower] = match;
    // Remove decimals if .0
    const upperClean = parseFloat(upper) % 1 === 0 ? parseInt(upper) : upper;
    const lowerClean = parseFloat(lower) % 1 === 0 ? parseInt(lower) : lower;
    return `${upperClean}-${lowerClean}mm`;
  }
  return tamañoNominal;
}

async function main() {
  const csvPath = path.join(__dirname, '..', 'archivoexcel', 'limites_granulometricos.csv');
  
  console.log('📖 Leyendo archivo CSV...');
  const data = parseCSV(csvPath);
  
  console.log('📊 Agrupando datos por tamaño nominal...');
  const grouped = groupBySizeNominal(data);
  
  console.log(`\n✅ Encontradas ${Object.keys(grouped).length} clasificaciones de Grava:\n`);
  
  // Generate SQL migration
  const sqlStatements = [];
  
  Object.entries(grouped).forEach(([tamañoNominal, mallas], index) => {
    const tamañoSimplificado = simplifySize(tamañoNominal);
    const descripcion = `Límites granulométricos ${tamañoNominal}`;
    
    console.log(`${index + 1}. ${tamañoNominal}`);
    console.log(`   Tamaño: ${tamañoSimplificado}`);
    console.log(`   Mallas: ${mallas.length}`);
    console.log(`   Datos: ${JSON.stringify(mallas, null, 2)}`);
    console.log('');
    
    const mallasJSON = JSON.stringify(mallas);
    
    // Generate INSERT with ON CONFLICT UPDATE
    const sql = `
-- ${descripcion}
INSERT INTO public.limites_granulometricos (tipo_material, tamaño, descripcion, mallas, norma_referencia) 
VALUES (
  'Grava',
  '${tamañoSimplificado}',
  '${descripcion}',
  '${mallasJSON}'::jsonb,
  'NMX-C-111-ONNCCE-2014'
)
ON CONFLICT (tipo_material, tamaño) 
DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  mallas = EXCLUDED.mallas,
  norma_referencia = EXCLUDED.norma_referencia,
  updated_at = NOW();
`;
    
    sqlStatements.push(sql);
  });
  
  // Generate migration file
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '_');
  const migrationPath = path.join(__dirname, '..', 'migrations', `${timestamp}_update_limites_granulometricos_grava.sql`);
  
  const migrationContent = `-- Actualizar límites granulométricos para Grava según NMX-C-111-ONNCCE-2014
-- Basado en archivo: archivoexcel/limites_granulometricos.csv
-- Total de clasificaciones: ${Object.keys(grouped).length}

BEGIN;

${sqlStatements.join('\n')}

COMMIT;

-- Verificar datos insertados
SELECT tipo_material, tamaño, descripcion, jsonb_array_length(mallas) as num_mallas
FROM public.limites_granulometricos
WHERE tipo_material = 'Grava'
ORDER BY tamaño;
`;
  
  fs.writeFileSync(migrationPath, migrationContent);
  console.log(`\n✅ Migración SQL generada: ${migrationPath}`);
  console.log('\n📋 Resumen:');
  console.log(`   - Total clasificaciones: ${Object.keys(grouped).length}`);
  console.log(`   - Tipo material: Grava`);
  console.log(`   - Norma: NMX-C-111-ONNCCE-2014`);
  console.log('\n💡 Para aplicar la migración, ejecuta:');
  console.log(`   node scripts/apply_migration.js ${path.basename(migrationPath)}`);
}

main().catch(console.error);


