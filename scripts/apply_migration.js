/**
 * Script genérico para aplicar migraciones SQL a Supabase
 * 
 * Uso:
 *   node scripts/apply_migration.js <nombre-del-archivo-de-migracion>
 * 
 * Ejemplo:
 *   node scripts/apply_migration.js 20251013_224234_update_limites_granulometricos_grava.sql
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Obtener argumentos de línea de comandos
const migrationFileName = process.argv[2];

if (!migrationFileName) {
  console.error('❌ Error: Debe especificar el nombre del archivo de migración');
  console.log('\nUso:');
  console.log('  node scripts/apply_migration.js <nombre-del-archivo>');
  console.log('\nEjemplo:');
  console.log('  node scripts/apply_migration.js 20251013_224234_update_limites_granulometricos_grava.sql');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', 'migrations', migrationFileName);

// Verificar que el archivo existe
if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Error: No se encontró el archivo ${migrationPath}`);
  process.exit(1);
}

console.log('🔍 Leyendo archivo de migración...');
console.log(`📁 Ruta: ${migrationPath}\n`);

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Verificar variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno no configuradas');
  console.log('\n📝 Opciones para aplicar la migración:');
  console.log('\n1. Manualmente desde Supabase Dashboard:');
  console.log('   a. Abre tu proyecto en Supabase Dashboard');
  console.log('   b. Ve a SQL Editor');
  console.log('   c. Crea una nueva query');
  console.log('   d. Copia y pega el contenido del archivo:');
  console.log(`      ${migrationPath}`);
  console.log('   e. Ejecuta la query\n');
  
  console.log('2. Usando Supabase CLI:');
  console.log('   a. Copia el archivo a supabase/migrations/');
  console.log('   b. Ejecuta: npx supabase db push\n');
  
  console.log('3. Configurar variables de entorno y volver a ejecutar este script:');
  console.log('   NEXT_PUBLIC_SUPABASE_URL=tu-url');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key\n');
  
  // Mostrar vista previa del SQL
  console.log('📋 Vista previa del SQL a ejecutar:');
  console.log('━'.repeat(80));
  console.log(migrationSQL.substring(0, 500) + (migrationSQL.length > 500 ? '\n...\n[contenido truncado]' : ''));
  console.log('━'.repeat(80));
  
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('🚀 Aplicando migración a Supabase...\n');
    
    // Dividir el SQL en statements individuales
    // Esto es necesario porque Supabase no ejecuta bien múltiples statements en una sola llamada
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📊 Total de statements SQL: ${statements.length}\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.trim() === ';') {
        continue;
      }
      
      console.log(`Ejecutando statement ${i + 1}/${statements.length}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { 
          query: statement 
        });
        
        if (error) {
          // Si la función exec_sql no existe, intentar con query directo
          console.log('⚠️  exec_sql no disponible, usando método alternativo...');
          
          // Para INSERT/UPDATE/DELETE usamos .from().insert() etc
          // Para este caso específico, simplemente logueamos el SQL
          console.log(`   SQL: ${statement.substring(0, 100)}...`);
          console.log(`   ⚠️  Ejecutar manualmente desde Dashboard`);
          errorCount++;
        } else {
          console.log(`   ✅ Statement ${i + 1} ejecutado`);
          successCount++;
        }
      } catch (err) {
        console.error(`   ❌ Error en statement ${i + 1}:`, err.message);
        errorCount++;
      }
    }
    
    console.log('\n' + '━'.repeat(80));
    console.log('📈 Resumen de ejecución:');
    console.log(`   ✅ Exitosos: ${successCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log('━'.repeat(80));
    
    if (errorCount > 0) {
      console.log('\n⚠️  Algunos statements fallaron.');
      console.log('💡 Recomendación: Ejecutar manualmente desde Supabase Dashboard SQL Editor\n');
      console.log('📋 Contenido completo del archivo:');
      console.log('━'.repeat(80));
      console.log(migrationSQL);
      console.log('━'.repeat(80));
    } else {
      console.log('\n✅ Migración aplicada exitosamente!');
      
      // Verificar resultados
      console.log('\n🔍 Verificando datos insertados...');
      const { data, error } = await supabase
        .from('limites_granulometricos')
        .select('tipo_material, tamaño, descripcion')
        .eq('tipo_material', 'Grava')
        .order('tamaño');
      
      if (error) {
        console.log('⚠️  No se pudieron verificar los datos:', error.message);
      } else {
        console.log(`\n📊 Total de registros de Grava: ${data?.length || 0}`);
        if (data && data.length > 0) {
          console.log('\nTamaños disponibles:');
          data.forEach((row, idx) => {
            console.log(`  ${idx + 1}. ${row.tamaño} - ${row.descripcion}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error general aplicando migración:', error.message);
    console.log('\n💡 Intenta ejecutar manualmente desde Supabase Dashboard:\n');
    console.log('━'.repeat(80));
    console.log(migrationSQL);
    console.log('━'.repeat(80));
    process.exit(1);
  }
}

// Ejecutar
applyMigration();


