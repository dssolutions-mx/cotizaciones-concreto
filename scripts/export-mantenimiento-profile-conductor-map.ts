/**
 * Export mantenimiento `profiles` canonical display names for conductor alignment.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/export-mantenimiento-profile-conductor-map.ts
 *
 * Requires: MANTENIMIENTO_SUPABASE_URL, MANTENIMIENTO_SUPABASE_SERVICE_ROLE_KEY
 *
 * Writes: scripts/tmp/mantenimiento-profile-conductor-map.json (id + display + normalizeDriverKey-style key)
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

function normalizeDriverKey(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';
  const noDiacritics = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noDiacritics.replace(/\s+/g, ' ').toLowerCase();
}

function displayName(nombre: string | null, apellido: string | null): string {
  return `${nombre ?? ''} ${apellido ?? ''}`.replace(/\s+/g, ' ').trim();
}

async function main() {
  const url = process.env.MANTENIMIENTO_SUPABASE_URL;
  const key = process.env.MANTENIMIENTO_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing MANTENIMIENTO_SUPABASE_URL or MANTENIMIENTO_SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const mnt = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await mnt
    .from('profiles')
    .select('id, nombre, apellido')
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const out = (rows ?? []).map((r: { id: string; nombre: string | null; apellido: string | null }) => {
    const display = displayName(r.nombre, r.apellido);
    return {
      id: r.id,
      display,
      match_key: normalizeDriverKey(display),
    };
  });

  const dir = path.join(process.cwd(), 'scripts', 'tmp');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'mantenimiento-profile-conductor-map.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${out.length} profiles to ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
