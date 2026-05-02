/**
 * Supabase JS uses the JWT for REST/RPC. The **anon** key is rejected by RLS on `material_entries`
 * inserts even though the client "connects". Fails often look like empty errors or PGRST301.
 */
export function assertSupabaseServiceRoleKey(key: string): void {
  const parts = key.split('.');
  if (parts.length !== 3) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY must be the Supabase **service_role** JWT (three dot-separated segments). The anon/public key cannot insert opening FIFO layers under RLS.'
    );
  }
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { role?: string };
    if (payload.role !== 'service_role') {
      throw new Error(
        `JWT "role" is "${payload.role ?? '?'}" but must be "service_role". Copy the **service_role** secret from Supabase → Project Settings → API.`
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid SUPABASE_SERVICE_ROLE_KEY JWT: ${msg}`);
  }
}
