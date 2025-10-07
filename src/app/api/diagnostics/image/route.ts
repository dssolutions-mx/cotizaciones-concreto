import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const imageUrl = new URL('/images/dcconcretos/hero1.jpg', origin);
    const res = await fetch(imageUrl, { method: 'HEAD', cache: 'no-store' });
    const size = res.headers.get('content-length');
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      url: imageUrl.toString(),
      size: size ? `${(parseInt(size) / 1024 / 1024).toFixed(2)} MB` : 'unknown',
      contentType: res.headers.get('content-type')
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 500 });
  }
}
