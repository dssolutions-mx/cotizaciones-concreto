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

// Columns per COPY public.ensayos in backup:
// id, muestra_id, fecha_ensayo, carga_kg, resistencia_calculada, porcentaje_cumplimiento,
// observaciones, created_by, created_at, updated_at, plant_id, fecha_ensayo_ts, event_timezone

const inPath = path.join('quality_diff', 'ensayos_from_muestras_with_rem.tsv');
const outPath = path.join('quality_diff', 'sql', 'update_ensayos_full.sql');
const lines = readLines(inPath);
const out = fs.createWriteStream(outPath, {encoding:'utf8'});

for (const line of lines) {
  const f = line.split('\t');
  if (f.length < 13) continue;
  
  const [id, muestra_id, fecha_ensayo, carga_kg, resistencia_calculada, porcentaje_cumplimiento,
        observaciones, created_by, created_at, updated_at, plant_id, fecha_ensayo_ts, event_timezone] = f;
  
  const sql = `UPDATE public.ensayos SET
    muestra_id = ${qUuid(muestra_id)},
    fecha_ensayo = ${qDate(fecha_ensayo)},
    carga_kg = ${qNum(carga_kg)},
    resistencia_calculada = ${qNum(resistencia_calculada)},
    porcentaje_cumplimiento = ${qNum(porcentaje_cumplimiento)},
    observaciones = ${q(observaciones)},
    created_by = ${qUuid(created_by)},
    created_at = ${qTs(created_at)},
    updated_at = ${qTs(updated_at)},
    plant_id = ${qUuid(plant_id)},
    fecha_ensayo_ts = ${qTs(fecha_ensayo_ts)},
    event_timezone = ${q(event_timezone)}
  WHERE id = ${qUuid(id)};
`;
  out.write(sql);
}
out.end();
console.log('Wrote', outPath);
