import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const imageUrl = new URL('/images/dcconcretos/hero1.jpg', origin);
    const res = await fetch(imageUrl, { method: 'HEAD', cache: 'no-store' });
    return NextResponse.json({ ok: res.ok, status: res.status, url: imageUrl.toString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 500 });
  }
}
