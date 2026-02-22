import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';

const UNAUTHORIZED_HEADERS = { 'Cache-Control': 'no-store' as const };

export async function GET(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: UNAUTHORIZED_HEADERS });
    }
    const { searchParams } = new URL(request.url);
    const businessName = searchParams.get('business_name') || '';
    const clientCode = searchParams.get('client_code') || '';

    if (!businessName.trim()) {
      return NextResponse.json({ potentialDuplicates: [] });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('find_potential_duplicate_clients', {
      p_business_name: businessName.trim(),
      p_client_code: clientCode.trim() || null,
    });

    if (error) {
      console.error('check-duplicates RPC error:', error);
      return NextResponse.json({ potentialDuplicates: [] });
    }

    // Dedupe by id (same client can match multiple criteria)
    const seen = new Set<string>();
    const unique = (data || []).filter(
      (row: { id: string }) => (seen.has(row.id) ? false : (seen.add(row.id), true))
    );

    return NextResponse.json({ potentialDuplicates: unique });
  } catch (err) {
    console.error('check-duplicates error:', err);
    return NextResponse.json({ potentialDuplicates: [] });
  }
}
