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

// Columns per COPY public.quality_notification_queue in backup:
// id, muestra_id, fecha_programada_envio, estado, intentos, ultimo_intento, mensaje_error,
// created_at, updated_at, plant_id, fecha_envio_timestamp_utc, tipo_notificacion, timezone_local

const inPath = path.join('quality_diff', 'queue_from_muestras_with_rem.tsv');
const outPath = path.join('quality_diff', 'sql', 'update_queue_full.sql');
const lines = readLines(inPath);
const out = fs.createWriteStream(outPath, {encoding:'utf8'});

for (const line of lines) {
  const f = line.split('\t');
  if (f.length < 13) continue;
  
  const [id, muestra_id, fecha_programada_envio, estado, intentos, ultimo_intento, mensaje_error,
        created_at, updated_at, plant_id, fecha_envio_timestamp_utc, tipo_notificacion, timezone_local] = f;
  
  const sql = `UPDATE public.quality_notification_queue SET
    muestra_id = ${qUuid(muestra_id)},
    fecha_programada_envio = ${qDate(fecha_programada_envio)},
    estado = ${q(estado)},
    intentos = ${qNum(intentos)},
    ultimo_intento = ${qTs(ultimo_intento)},
    mensaje_error = ${q(mensaje_error)},
    created_at = ${qTs(created_at)},
    updated_at = ${qTs(updated_at)},
    plant_id = ${qUuid(plant_id)},
    fecha_envio_timestamp_utc = ${qTs(fecha_envio_timestamp_utc)},
    tipo_notificacion = ${q(tipo_notificacion)},
    timezone_local = ${q(timezone_local)}
  WHERE id = ${qUuid(id)};
`;
  out.write(sql);
}
out.end();
console.log('Wrote', outPath);
