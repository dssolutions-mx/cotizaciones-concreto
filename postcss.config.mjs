import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // `base` defaults to process.cwd(); a parent-folder terminal cwd breaks scanning.
    '@tailwindcss/postcss': { base: __dirname },
  },
};

export default config;
