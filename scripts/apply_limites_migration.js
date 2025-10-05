/**
 * Script para aplicar la migración de límites granulométricos
 * 
 * Este script lee el archivo de migración y lo ejecuta en Supabase
 * 
 * Uso:
 *   node scripts/apply_limites_migration.js
 */

const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250203_create_limites_granulometricos.sql');

console.log('🔍 Leyendo archivo de migración...');

try {
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('✅ Archivo de migración leído exitosamente');
  console.log('\n📋 Contenido de la migración:');
  console.log('━'.repeat(80));
  console.log(migrationSQL);
  console.log('━'.repeat(80));
  
  console.log('\n📝 Instrucciones para aplicar la migración:');
  console.log('\n1. Opción A - Usando Supabase CLI (recomendado):');
  console.log('   npx supabase db push');
  
  console.log('\n2. Opción B - Manualmente desde el Dashboard:');
  console.log('   a. Abre tu proyecto en Supabase Dashboard');
  console.log('   b. Ve a la sección SQL Editor');
  console.log('   c. Crea una nueva query');
  console.log('   d. Copia y pega el contenido del archivo:');
  console.log(`      ${migrationPath}`);
  console.log('   e. Ejecuta la query');
  
  console.log('\n3. Opción C - Usando este script con supabase-js:');
  console.log('   Descomentar el código al final de este archivo');
  console.log('   y configurar las variables de entorno SUPABASE_URL y SUPABASE_KEY');
  
  console.log('\n✨ La migración creará:');
  console.log('   - Tabla limites_granulometricos');
  console.log('   - Políticas RLS para QUALITY_TEAM y EXECUTIVE');
  console.log('   - 8 registros de límites para gravas (10mm, 13mm, 20mm, etc.)');
  
  console.log('\n⚠️  IMPORTANTE:');
  console.log('   - Asegúrate de tener backup de tu base de datos');
  console.log('   - Esta migración es segura y no modifica datos existentes');
  console.log('   - Solo crea nueva tabla y políticas RLS');
  
} catch (error) {
  console.error('❌ Error leyendo archivo de migración:', error.message);
  process.exit(1);
}

// Descomentar el siguiente código para ejecutar automáticamente con supabase-js
// Requiere: npm install @supabase/supabase-js
/*
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usar service role key, no anon key

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('\n🚀 Aplicando migración...');
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Migración aplicada exitosamente');
    console.log('📊 Datos:', data);
    
  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    process.exit(1);
  }
}

// Ejecutar
applyMigration();
*/


