const fs = require('fs');
const path = require('path');

function escStr(s) {
  return String(s).replace(/'/g, "''");
}

function readLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.split(/\r?\n/).filter(Boolean);
}

function qUuid(v) { return v && v !== '\\N' ? `'${v}'::uuid` : 'NULL'; }
function qDate(v) { return v && v !== '\\N' ? `'${escStr(v)}'::date` : 'NULL'; }
function qText(v) { return v && v !== '\\N' ? `'${escStr(v)}'` : 'NULL'; }
function qNum(v) { return v && v !== '\\N' ? String(Number(v)) : 'NULL'; }

function generateMuestreos(src, out) {
  const lines = readLines(src);
  const sql = [];
  for (const line of lines) {
    const f = line.split('\t');
    if (f.length < 13) continue;
    const id = f[0];
    const fecha = f[2];
    const numero = f[3];
    const planta = f[4];
    const plantId = f[12];
    if (!id || id === '\\N') continue;
    sql.push(`INSERT INTO public.muestreos (id, remision_id, fecha_muestreo, numero_muestreo, planta, plant_id)
VALUES (${qUuid(id)}, NULL, ${qDate(fecha)}, ${qNum(numero)}, ${qText(planta)}, ${qUuid(plantId)})
ON CONFLICT (id) DO NOTHING;`);
  }
  fs.writeFileSync(out, sql.join('\n') + '\n');
}

function generateMuestras(src, out) {
  const lines = readLines(src);
  const sql = [];
  for (const line of lines) {
    const f = line.split('\t');
    if (f.length < 9) continue;
    const id = f[0];
    const muestreoId = f[1];
    const tipo = f[2];
    const ident = f[3];
    const fechaProg = f[4];
    const estado = f[5];
    const plantId = f[8];
    if (!id || id === '\\N') continue;
    sql.push(`INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES (${qUuid(id)}, ${qUuid(muestreoId)}, ${qText(tipo)}, ${qText(ident)}, ${qDate(fechaProg)}, ${qText(estado)}, ${qUuid(plantId)})
ON CONFLICT (id) DO NOTHING;`);
  }
  fs.writeFileSync(out, sql.join('\n') + '\n');
}

function generateEnsayos(src, out) {
  const lines = readLines(src);
  const sql = [];
  for (const line of lines) {
    const f = line.split('\t');
    if (f.length < 12) continue;
    const id = f[0];
    const muestraId = f[1];
    const fecha = f[2];
    const carga = f[3];
    const resistencia = f[4];
    const pct = f[5];
    const plantId = f[10];
    if (!id || id === '\\N') continue;
    sql.push(`INSERT INTO public.ensayos (id, muestra_id, fecha_ensayo, carga_kg, resistencia_calculada, porcentaje_cumplimiento, plant_id)
VALUES (${qUuid(id)}, ${qUuid(muestraId)}, ${qDate(fecha)}, ${qNum(carga)}, ${qNum(resistencia)}, ${qNum(pct)}, ${qUuid(plantId)})
ON CONFLICT (id) DO NOTHING;`);
  }
  fs.writeFileSync(out, sql.join('\n') + '\n');
}

function generateQueue(src, out) {
  const lines = readLines(src);
  const sql = [];
  for (const line of lines) {
    const f = line.split('\t');
    if (f.length < 11) continue;
    const id = f[0];
    const muestraId = f[1];
    const fechaEnv = f[2];
    const estado = f[3];
    const intentos = f[4];
    const plantId = f[9];
    if (!id || id === '\\N') continue;
    sql.push(`INSERT INTO public.quality_notification_queue (id, muestra_id, fecha_programada_envio, estado, intentos, plant_id)
VALUES (${qUuid(id)}, ${qUuid(muestraId)}, ${qDate(fechaEnv)}, ${qText(estado)}, ${qNum(intentos)}, ${qUuid(plantId)})
ON CONFLICT (id) DO NOTHING;`);
  }
  fs.writeFileSync(out, sql.join('\n') + '\n');
}

const base = path.join('quality_diff');

generateMuestreos(path.join(base, 'muestreos_with_rem.tsv'), path.join(base, 'sql', 'restore_muestreos.sql'));
generateMuestras(path.join(base, 'muestras_from_muestreos_with_rem.tsv'), path.join(base, 'sql', 'restore_muestras.sql'));
generateEnsayos(path.join(base, 'ensayos_from_muestras_with_rem.tsv'), path.join(base, 'sql', 'restore_ensayos.sql'));
generateQueue(path.join(base, 'queue_from_muestras_with_rem.tsv'), path.join(base, 'sql', 'restore_queue.sql'));

console.log('Generated SQL files in quality_diff/sql');
