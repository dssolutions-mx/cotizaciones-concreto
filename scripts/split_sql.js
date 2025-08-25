const fs = require('fs');
const path = require('path');

function splitFile(srcPath, outDir, batchSize) {
  const sql = fs.readFileSync(srcPath, 'utf8');
  // Split statements by semicolon followed by newline
  const stmts = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean).map(s => s + ';');
  let batch = [];
  let idx = 1;
  for (const s of stmts) {
    batch.push(s);
    if (batch.length >= batchSize) {
      const out = path.join(outDir, `batch_${String(idx).padStart(3, '0')}.sql`);
      fs.writeFileSync(out, batch.join('\n') + '\n');
      batch = [];
      idx++;
    }
  }
  if (batch.length) {
    const out = path.join(outDir, `batch_${String(idx).padStart(3, '0')}.sql`);
    fs.writeFileSync(out, batch.join('\n') + '\n');
  }
}

splitFile('quality_diff/sql/restore_muestreos.sql', 'quality_diff/sql/batches/muestreos', 100);
splitFile('quality_diff/sql/restore_muestras.sql', 'quality_diff/sql/batches/muestras', 100);
splitFile('quality_diff/sql/restore_ensayos.sql', 'quality_diff/sql/batches/ensayos', 100);
splitFile('quality_diff/sql/restore_queue.sql', 'quality_diff/sql/batches/queue', 100);
console.log('Split SQL into batches in quality_diff/sql/batches');
