/**
 * Script para actualizar las normativas ASTM a NMX en estudios_seleccionados
 * 
 * Uso:
 *   node scripts/update-normas-to-nmx.js
 * 
 * Este script actualiza todos los registros existentes en la tabla estudios_seleccionados
 * para reemplazar las referencias ASTM con sus equivalentes NMX
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan las variables de entorno de Supabase');
  console.error('Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Mapeo de normativas a actualizar
const normaMappings = [
  {
    nombre_estudio: 'Análisis Granulométrico',
    nuevaNorma: 'NMX-C-077',
    descripcion: 'Análisis Granulométrico'
  },
  {
    nombre_estudio: 'Densidad',
    nuevaNorma: 'NMX-C-164 / NMX-C-165',
    descripcion: 'Densidad'
  },
  {
    nombre_estudio: 'Masa Volumétrico',
    nuevaNorma: 'NMX-C-073',
    descripcion: 'Masa Volumétrico'
  },
  {
    nombre_estudio: 'Pérdida por Lavado',
    nuevaNorma: 'NMX-C-084',
    descripcion: 'Pérdida por Lavado'
  },
  {
    nombre_estudio: 'Absorción',
    nuevaNorma: 'NMX-C-164 / NMX-C-165',
    descripcion: 'Absorción'
  }
];

async function updateNormas() {
  console.log('🔄 Iniciando actualización de normativas ASTM a NMX...\n');

  let totalActualizados = 0;

  for (const mapping of normaMappings) {
    console.log(`📋 Actualizando: ${mapping.descripcion}`);
    
    // Primero, obtener los registros que necesitan actualización
    const { data: registrosAntiguos, error: fetchError } = await supabase
      .from('estudios_seleccionados')
      .select('id, norma_referencia')
      .eq('nombre_estudio', mapping.nombre_estudio)
      .neq('norma_referencia', mapping.nuevaNorma);

    if (fetchError) {
      console.error(`   ❌ Error al buscar registros: ${fetchError.message}`);
      continue;
    }

    if (!registrosAntiguos || registrosAntiguos.length === 0) {
      console.log(`   ✅ No hay registros que actualizar (ya están con NMX o no existen)`);
      continue;
    }

    console.log(`   📊 Registros encontrados: ${registrosAntiguos.length}`);
    
    // Mostrar algunos ejemplos de normativas antiguas
    const ejemplos = registrosAntiguos.slice(0, 3).map(r => r.norma_referencia);
    console.log(`   📝 Ejemplos de normativas antiguas: ${ejemplos.join(', ')}`);

    // Actualizar cada registro
    const { error: updateError } = await supabase
      .from('estudios_seleccionados')
      .update({ 
        norma_referencia: mapping.nuevaNorma,
        updated_at: new Date().toISOString()
      })
      .eq('nombre_estudio', mapping.nombre_estudio)
      .neq('norma_referencia', mapping.nuevaNorma);

    if (updateError) {
      console.error(`   ❌ Error al actualizar: ${updateError.message}`);
      continue;
    }

    totalActualizados += registrosAntiguos.length;
    console.log(`   ✅ Actualizados: ${registrosAntiguos.length} registros a "${mapping.nuevaNorma}"\n`);
  }

  // Verificar resultados finales
  console.log('\n📊 Verificando resultados finales...\n');
  
  const { data: resumen, error: resumenError } = await supabase
    .from('estudios_seleccionados')
    .select('nombre_estudio, norma_referencia');

  if (resumenError) {
    console.error('❌ Error al obtener resumen:', resumenError.message);
  } else {
    // Agrupar por nombre_estudio y norma_referencia
    const grouped = resumen.reduce((acc, item) => {
      const key = `${item.nombre_estudio} - ${item.norma_referencia}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    console.log('Estado actual de las normativas:\n');
    Object.entries(grouped).forEach(([key, count]) => {
      const hasASTM = key.includes('ASTM') || key.includes('C127') || key.includes('C128') || 
                      key.includes('C136') || key.includes('C29') || key.includes('C117');
      const icon = hasASTM ? '⚠️ ' : '✅ ';
      console.log(`${icon}${key}: ${count} registros`);
    });
  }

  console.log(`\n✨ Proceso completado. Total de registros actualizados: ${totalActualizados}`);
  
  if (totalActualizados > 0) {
    console.log('\n💡 Recuerda recargar la página en tu aplicación para ver los cambios.');
  }
}

// Ejecutar el script
updateNormas()
  .then(() => {
    console.log('\n✅ Script finalizado correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });

