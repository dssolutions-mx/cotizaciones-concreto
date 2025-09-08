import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { url } = await req.json().catch(() => ({ url: null }));
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'url'" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    let finalUrl = url;
    const debug: Record<string, unknown> = { input: url };

    // Follow short-link redirects server-side with bounds
    try {
      const allowedHosts = ["maps.app.goo.gl", "goo.gl", "g.co"];
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const isAllowed = allowedHosts.some(h => host === h || host.endsWith("." + h));
      debug.allowedHost = isAllowed;
      if (isAllowed) {
        const maxRedirects = 5;
        let currentUrl = url;
        for (let i = 0; i < maxRedirects; i++) {
          const resp = await fetch(currentUrl, { method: "GET", redirect: "manual" });
          const location = resp.headers.get("location");
          debug[`redirect_${i}`] = { status: resp.status, location };
          if (location) {
            currentUrl = new URL(location, currentUrl).toString();
            if (/https?:\/\/([\w-]+\.)?google\.[\w.]+\/maps\//i.test(currentUrl)) {
              finalUrl = currentUrl;
              break;
            }
            continue;
          }
          finalUrl = resp.url || currentUrl;
          break;
        }
      }
    } catch (e) {
      debug.redirect_error = String(e);
    }

    // 1) Try extracting coords from URLs
    let extracted = extractBestCoords(finalUrl) || extractBestCoords(url);

    // 2) Geocode fallback if needed
    if (!extracted) {
      const originalAddress = extractAddressFromUrl(finalUrl) || extractAddressFromUrl(url);
      debug.address = originalAddress || null;

      if (originalAddress) {
        const variants = buildAddressVariants(originalAddress);
        debug.variants = variants;
        for (let i = 0; i < variants.length; i++) {
          const q = variants[i];
          const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
          const geoResp = await fetch(nominatimUrl, {
            method: "GET",
            headers: {
              "User-Agent": "cotizaciones-concreto/1.0 (+contact@cotizaciones-concreto.local)",
              "Accept": "application/json",
            }
          });
          const status = geoResp.status;
          let lat: number | null = null;
          let lon: number | null = null;
          if (geoResp.ok) {
            const text = await geoResp.text();
            debug[`geocode_${i}_status`] = status;
            debug[`geocode_${i}_len`] = text.length;
            try {
              const arr = JSON.parse(text);
              if (Array.isArray(arr) && arr.length > 0 && arr[0]?.lat && arr[0]?.lon) {
                lat = parseFloat(arr[0].lat);
                lon = parseFloat(arr[0].lon);
              }
            } catch { /* ignore */ }
          } else {
            debug[`geocode_${i}_status`] = status;
          }

          if (lat !== null && lon !== null && isValidLatLng(lat, lon)) {
            extracted = { lat: String(lat), lng: String(lon) };
            debug.geocoded = { variantIndex: i, lat: extracted.lat, lng: extracted.lng, query: q };
            break;
          }
        }
      }
    }

    debug.finalUrl = finalUrl;
    debug.extracted = extracted;
    console.log(JSON.stringify({ expand_maps_debug: debug }));

    return new Response(JSON.stringify({ finalUrl, lat: extracted?.lat ?? null, lng: extracted?.lng ?? null }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    console.error("expand-maps-url error:", e);
    return new Response(JSON.stringify({ error: "Internal error", details: String(e) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function extractAddressFromUrl(href: string | null | undefined): string | null {
  if (!href) return null;
  try {
    const u = new URL(href);
    const q = u.searchParams.get("q");
    if (q && !/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.test(q)) {
      return decodeURIComponent(q);
    }
  } catch { /* ignore */ }
  return null;
}

function buildAddressVariants(address: string): string[] {
  const variants: string[] = [];
  const trimmed = address.trim();
  variants.push(trimmed);

  // Remove diacritics
  const noDiacritics = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (noDiacritics !== trimmed) variants.push(noDiacritics);

  // Remove potential business names (common patterns) - more aggressive
  let noBusiness = noDiacritics;

  // Remove business name patterns at the start
  const businessPatterns = [
    /^(depósito|tienda|restaurante|hotel|oficina|banco|estación|centro|plaza|mercado|supermercado|tienda|ferretería|papelería|cafetería|panadería|tortillería|librería|farmacia|veterinaria|abarrotes|frutas|verduras|carnicería|pollería|panadería|pastelería|joyería|zapatería|boutique|salón|peluquería|barbería|taller|mecánico|lavandería|limpieza|aseo)\s+/i,
    /^(dr\.|dra\.|sr\.|sra\.|lic\.|ing\.|arq\.|c\.|cp\.|prof\.)\s+/i,
    /^[^,]*?(constructora|empresa|compañía|corporación|s\.a\.|s\.r\.l\.|s\.c\.)\s+/i
  ];

  for (const pattern of businessPatterns) {
    noBusiness = noBusiness.replace(pattern, '').trim();
  }

  // If the address starts with a business-like word followed by a comma, remove it
  noBusiness = noBusiness.replace(/^[^,]*?,\s*/, '').trim();
  if (noBusiness !== noDiacritics && noBusiness.length > 10) variants.push(noBusiness);

  // Expand common MX state abbreviations
  const expanded = noDiacritics
    .replace(/\bGto\.?/gi, "Guanajuato")
    .replace(/\bCDMX\b/gi, "Ciudad de Mexico")
    .replace(/\bEdo\.?\s*Mex\.?/gi, "Estado de Mexico");
  if (expanded !== noDiacritics) variants.push(expanded);

  // Also expand with business names removed
  const expandedNoBusiness = noBusiness
    .replace(/\bGto\.?/gi, "Guanajuato")
    .replace(/\bCDMX\b/gi, "Ciudad de Mexico")
    .replace(/\bEdo\.?\s*Mex\.?/gi, "Estado de Mexico");
  if (expandedNoBusiness !== expanded && expandedNoBusiness !== noBusiness) variants.push(expandedNoBusiness);

  // Add country if not present
  const hasCountry = /(mexico|méxico)/i.test(trimmed);
  if (!hasCountry) {
    variants.push(`${trimmed}, Mexico`);
    variants.push(`${noDiacritics}, Mexico`);
    if (noBusiness !== noDiacritics) variants.push(`${noBusiness}, Mexico`);
    if (expanded !== noDiacritics) variants.push(`${expanded}, Mexico`);
    if (expandedNoBusiness !== expanded) variants.push(`${expandedNoBusiness}, Mexico`);
  }

  // Light cleanup: remove double spaces
  return Array.from(new Set(variants.map(v => v.replace(/\s{2,}/g, " "))));
}

function extractBestCoords(href: string | null | undefined): { lat: string; lng: string } | null {
  if (!href) return null;
  const candidates: Array<{ lat: number; lng: number; priority: number; pattern: string }> = [];

  // 1) @lat,lng
  const at = href.match(/@\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (at) {
    const lat = parseFloat(at[1]);
    const lng = parseFloat(at[2]);
    if (isValidLatLng(lat, lng)) candidates.push({ lat, lng, priority: 1, pattern: "at" });
  }

  // 2) !3dLAT!4dLNG
  const bang = href.match(/!3d\s*(-?\d+(?:\.\d+)?)!4d\s*(-?\d+(?:\.\d+)?)/);
  if (bang) {
    const lat = parseFloat(bang[1]);
    const lng = parseFloat(bang[2]);
    if (isValidLatLng(lat, lng)) candidates.push({ lat, lng, priority: 2, pattern: "bang" });
  }

  // 3) Query params
  try {
    const u = new URL(href);
    const keys = ["q", "query", "ll", "center", "daddr", "saddr"];
    for (const k of keys) {
      const val = u.searchParams.get(k);
      if (!val) continue;
      const m = val.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (m) {
        const lat = parseFloat(m[1]);
        const lng = parseFloat(m[2]);
        if (isValidLatLng(lat, lng)) candidates.push({ lat, lng, priority: 3, pattern: `query:${k}` });
      }
    }
  } catch { /* skip */ }

  // 4) Loose fallback
  const loose = href.match(/(-?\d+(?:\.\d+)?)%2C(-?\d+(?:\.\d+)?)/i) || href.match(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (loose) {
    const lat = parseFloat(loose[1]);
    const lng = parseFloat(loose[2]);
    if (isValidLatLng(lat, lng)) candidates.push({ lat, lng, priority: 9, pattern: "loose" });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.priority - b.priority);
  const best = candidates[0];
  return { lat: String(best.lat), lng: String(best.lng) };
}
