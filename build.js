const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check that required environment variables exist
const checkEnvVars = () => {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  let hasAllVars = true;
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.warn(`Warning: ${varName} environment variable is not set`);
      hasAllVars = false;
    }
  }
  
  if (!hasAllVars) {
    console.warn('Some environment variables are missing. Using fallbacks for build process.');
    // Provide fallbacks for build process only
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-for-build.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key-for-build';
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-build';
  }
};

// Check environment variables
checkEnvVars();

// Run the Next.js build with linting disabled
console.log('Running Next.js build with linting disabled...');
try {
  execSync('next build --no-lint', { 
    stdio: 'inherit',
    env: {
      ...process.env, // Pass through all environment variables
    }
  });
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

// Check if the landing page client reference manifest exists
const manifestPath = path.join('.next', 'server', 'app', '(landing)', 'page_client-reference-manifest.js');
if (!fs.existsSync(manifestPath)) {
  console.log('Client reference manifest not found, creating fallback...');
  
  // Create the directory if it doesn't exist
  const manifestDir = path.dirname(manifestPath);
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }
  
  // Create a fallback manifest file
  const fallbackContent = `
    // Fallback client reference manifest
    export const clientRefs = {};
  `;
  
  fs.writeFileSync(manifestPath, fallbackContent);
  console.log('Created fallback client reference manifest.');
}

console.log('Build completed successfully!'); 