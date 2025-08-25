const fs = require('fs');
const path = require('path');

function splitFile(srcPath, outDir, batchSize){
  const sql = fs.readFileSync(srcPath, 'utf8');
  const stmts = sql.split(/;\s*\n/).map(s=>s.trim()).filter(Boolean).map(s=>s+';');
  let idx = 1;
  for (let i=0; i<stmts.length; i+=batchSize){
    const chunk = stmts.slice(i, i+batchSize).join('\n') + '\n';
    const outPath = path.join(outDir, 'batch_' + String(idx).padStart(3,'0') + '.sql');
    fs.writeFileSync(outPath, chunk, 'utf8');
    idx++;
  }
}

splitFile('quality_diff/sql/update_muestreos_full.sql', 'quality_diff/sql/batches/muestreos_updates', 100);
console.log('Done.');
