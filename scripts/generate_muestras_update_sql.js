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
function qUuid(v){ return v==null||v==='\\N'? 'NULL' : `'${esc(v)}'::uuid`; }

// Columns per COPY public.muestras in backup:
// id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, 
// created_at, updated_at, plant_id, diameter_cm, cube_side_cm, beam_width_cm, 
// beam_height_cm, beam_span_cm, fecha_programada_ensayo_ts, event_timezone

const inPath = path.join('quality_diff', 'muestras_from_muestreos_with_rem.tsv');
const outPath = path.join('quality_diff', 'sql', 'update_muestras_full.sql');
const lines = readLines(inPath);
const out = fs.createWriteStream(outPath, {encoding:'utf8'});

for (const line of lines) {
  const f = line.split('\t');
  if (f.length < 16) continue;
  
  const [id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, 
        created_at, updated_at, plant_id, diameter_cm, cube_side_cm, beam_width_cm, 
        beam_height_cm, beam_span_cm, fecha_programada_ensayo_ts, event_timezone] = f;
  
  const sql = `UPDATE public.muestras SET
    muestreo_id = ${qUuid(muestreo_id)},
    tipo_muestra = ${q(tipo_muestra)},
    identificacion = ${q(identificacion)},
    fecha_programada_ensayo = ${qDate(fecha_programada_ensayo)},
    estado = ${q(estado)},
    created_at = ${qTs(created_at)},
    updated_at = ${qTs(updated_at)},
    plant_id = ${qUuid(plant_id)},
    diameter_cm = ${qNum(diameter_cm)},
    cube_side_cm = ${qNum(cube_side_cm)},
    beam_width_cm = ${qNum(beam_width_cm)},
    beam_height_cm = ${qNum(beam_height_cm)},
    beam_span_cm = ${qNum(beam_span_cm)},
    fecha_programada_ensayo_ts = ${qTs(fecha_programada_ensayo_ts)},
    event_timezone = ${q(event_timezone)}
  WHERE id = ${qUuid(id)};
`;
  out.write(sql);
}
out.end();
console.log('Wrote', outPath);
