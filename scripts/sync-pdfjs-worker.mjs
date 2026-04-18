import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const dest = path.join(root, 'public/pdf.worker.min.mjs');

if (!fs.existsSync(src)) {
  console.warn('[sync-pdfjs-worker] pdfjs-dist worker not found at', src, '(skip)');
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('[sync-pdfjs-worker] copied pdf.worker.min.mjs → public/');
