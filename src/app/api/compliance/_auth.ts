import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const COMPLIANCE_READ_ROLES = new Set(['EXECUTIVE']);

export async function assertComplianceCronOrUser(
  req: Request,
): Promise<
  | { ok: true; userId: string | null; via: 'cron' | 'user' }
  | { ok: false; response: NextResponse }
> {
  const secret =
    process.env.COMPLIANCE_CRON_SECRET ?? process.env.CRON_SECRET ?? null;
  const header = req.headers.get('x-compliance-secret');
  if (secret && header === secret) {
    return { ok: true, userId: null, via: 'cron' };
  }

  const auth = req.headers.get('authorization');
  if (secret && auth === `Bearer ${secret}`) {
    return { ok: true, userId: null, via: 'cron' };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role as string | undefined;
  if (!role || !COMPLIANCE_READ_ROLES.has(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, via: 'user' };
}
