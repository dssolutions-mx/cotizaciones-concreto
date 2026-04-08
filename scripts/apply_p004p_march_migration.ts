/**
 * Apply P004P March 2026 pumping migration using Supabase service role.
 * Reads SQL from supabase/migrations/20260407_p004p_march_pumping_remisiones.sql
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const sqlPath = path.join(
    process.cwd(),
    'supabase/migrations/20260407_p004p_march_pumping_remisiones.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.rpc('exec_sql', { query: sql } as never);
  if (!error) {
    console.log('OK: applied via exec_sql');
    return;
  }

  // Fallback: use fetch to PostgREST doesn't support raw SQL — use pg if available
  console.warn('exec_sql RPC not available, trying direct query...', error.message);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  if (!res.ok) {
    console.error('Fallback failed:', await res.text());
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
