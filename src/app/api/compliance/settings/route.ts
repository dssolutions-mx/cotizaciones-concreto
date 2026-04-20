import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertComplianceCronOrUser } from '@/app/api/compliance/_auth';

export const runtime = 'nodejs';

type PlantPayload = {
  plantId: string;
  dosificadorEmail?: string | null;
  jefePlantaEmail?: string | null;
  extraCc?: string[];
  /** True if a row already exists — then clearing all fields deletes the override. */
  persistedOverride?: boolean;
};

async function requireUser(req: NextRequest) {
  const auth = await assertComplianceCronOrUser(req);
  if (!auth.ok) return auth;
  if (!auth.userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Debes iniciar sesión' }, { status: 401 }),
    };
  }
  return { ok: true as const, userId: auth.userId };
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const cot = createServiceClient();

  const { data: globalRow, error: gErr } = await cot
    .from('compliance_email_settings')
    .select('digest_recipients')
    .eq('id', 1)
    .maybeSingle();

  if (gErr) {
    return NextResponse.json({ error: gErr.message }, { status: 500 });
  }

  const { data: plants, error: pErr } = await cot
    .from('plants')
    .select('id, code, name, is_active')
    .order('code');
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { data: ovs, error: oErr } = await cot
    .from('compliance_plant_email_overrides')
    .select('plant_id, dosificador_email, jefe_planta_email, extra_cc');
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

  type OvRow = {
    plant_id: string;
    dosificador_email: string | null;
    jefe_planta_email: string | null;
    extra_cc: string[] | null;
  };
  const ovsRows = (ovs ?? []) as OvRow[];
  const ovByPlant = new Map(
    ovsRows.map((r) => [
      r.plant_id,
      {
        dosificadorEmail: r.dosificador_email,
        jefePlantaEmail: r.jefe_planta_email,
        extraCc: r.extra_cc ?? [],
      },
    ]),
  );

  type PlantRow = {
    id: string;
    code: string;
    name: string | null;
    is_active: boolean | null;
  };
  const plantRows = (plants ?? []) as PlantRow[];

  return NextResponse.json({
    digestRecipients: (globalRow as { digest_recipients?: string } | null)?.digest_recipients ?? '',
    envFallbackNote:
      'Si dejas el digest vacío, se usa COMPLIANCE_DIGEST_RECIPIENTS en el servidor (Vercel).',
    plants: plantRows.map((p) => {
      const o = ovByPlant.get(p.id);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        isActive: p.is_active,
        persistedOverride: Boolean(o),
        dosificadorEmail: o?.dosificadorEmail ?? null,
        jefePlantaEmail: o?.jefePlantaEmail ?? null,
        extraCc: o?.extraCc ?? [],
      };
    }),
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  let body: { digestRecipients?: string; plants?: PlantPayload[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const cot = createServiceClient();

  if (typeof body.digestRecipients === 'string') {
    const { error: uErr } = await cot
      .from('compliance_email_settings')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(
        {
          id: 1,
          digest_recipients: body.digestRecipients,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'id' },
      );
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  if (body.plants?.length) {
    for (const pl of body.plants) {
      const dos = pl.dosificadorEmail?.trim() ?? '';
      const jefe = pl.jefePlantaEmail?.trim() ?? '';
      const extra = (pl.extraCc ?? []).map((e) => e.trim()).filter((e) => e.includes('@'));
      const hadRow = Boolean(pl.persistedOverride);
      const hasAny = Boolean(dos || jefe || extra.length);

      if (!hasAny && !hadRow) {
        continue;
      }
      if (!hasAny && hadRow) {
        await cot.from('compliance_plant_email_overrides').delete().eq('plant_id', pl.plantId);
        continue;
      }

      const { error: oErr } = await cot
        .from('compliance_plant_email_overrides')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(
          {
            plant_id: pl.plantId,
            dosificador_email: dos || null,
            jefe_planta_email: jefe || null,
            extra_cc: extra,
            updated_at: new Date().toISOString(),
            updated_by: auth.userId,
          } as any,
          { onConflict: 'plant_id' },
        );
      if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
