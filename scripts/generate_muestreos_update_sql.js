const fs = require('fs');
const path = require('path');

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
}
function esc(v){ return String(v).replace(/'/g, "''"); }
function q(v){ return v==null||v==='\\N'? 'NULL' : `'${esc(v)}'`; }
function qNum(v){ return v==null||v==='\\N'? 'NULL' : String(Number(v)); }
function qDate(v){ return v==null||v==='\\N'? 'NULL' : `'${esc(v)}'::date`; }
function qTs(v){ return v==null||v==='\\N'? 'NULL' : `'${esc(v)}'::timestamptz`; }
function qTime(v){ return v==null||v==='\\N'? 'NULL' : `'${esc(v)}'::time`; }
function qUuid(v){ return v==null||v==='\\N'? 'NULL' : `'${esc(v)}'::uuid`; }
function qJson(v){ return v==null||v==='\\N'? 'NULL' : `${q(v)}::jsonb`; }

// Columns per COPY public.muestreos in backup
// id, remision_id, fecha_muestreo, numero_muestreo, planta, revenimiento_sitio, masa_unitaria, temperatura_ambiente, temperatura_concreto,
// created_by, created_at, updated_at, plant_id, sampling_type, manual_reference, gps_location, concrete_specs,
// offline_created, sync_status, sampling_notes, fecha_muestreo_ts, event_timezone, hora_muestreo

const inPath = path.join('quality_diff', 'muestreos_with_rem.tsv');
const outPath = path.join('quality_diff', 'sql', 'update_muestreos_full.sql');
const lines = readLines(inPath);
const out = fs.createWriteStream(outPath, {encoding:'utf8'});

for (const line of lines) {
  const f = line.split('\t');
  if (f.length < 23) continue;
  const [id, remision_id, fecha_muestreo, numero_muestreo, planta, revenimiento_sitio, masa_unitaria, temperatura_ambiente, temperatura_concreto, created_by, created_at, updated_at, plant_id, sampling_type, manual_reference, gps_location, concrete_specs, offline_created, sync_status, sampling_notes, fecha_muestreo_ts, event_timezone, hora_muestreo] = f;
  const sql = `UPDATE public.muestreos SET
    remision_id = NULL,
    fecha_muestreo = ${qDate(fecha_muestreo)},
    numero_muestreo = ${qNum(numero_muestreo)},
    planta = ${q(planta)},
    revenimiento_sitio = ${qNum(revenimiento_sitio)},
    masa_unitaria = ${qNum(masa_unitaria)},
    temperatura_ambiente = ${qNum(temperatura_ambiente)},
    temperatura_concreto = ${qNum(temperatura_concreto)},
    created_by = ${qUuid(created_by)},
    created_at = ${qTs(created_at)},
    updated_at = ${qTs(updated_at)},
    plant_id = ${qUuid(plant_id)},
    sampling_type = ${q(sampling_type)},
    manual_reference = ${q(manual_reference)},
    gps_location = ${qJson(gps_location)},
    concrete_specs = ${qJson(concrete_specs)},
    offline_created = ${offline_created==='t' ? 'true' : offline_created==='f' ? 'false' : 'NULL'},
    sync_status = ${q(sync_status)},
    sampling_notes = ${q(sampling_notes)},
    fecha_muestreo_ts = ${qTs(fecha_muestreo_ts)},
    event_timezone = ${q(event_timezone)},
    hora_muestreo = ${qTime(hora_muestreo)}
  WHERE id = ${qUuid(id)};
`;
  out.write(sql);
}
out.end();
console.log('Wrote', outPath);
