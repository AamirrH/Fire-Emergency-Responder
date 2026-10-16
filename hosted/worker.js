// The hosted view never simulates a second incident. It serves the latest signed
// upload of the actual Node backend's computed state to every phone.
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function authorized(request, token) {
  if (!token) return false;
  const header = request.headers.get('Authorization') || '';
  const encoder = new TextEncoder();
  const [a,b] = await Promise.all([header, `Bearer ${token}`].map(s => crypto.subtle.digest('SHA-256', encoder.encode(s))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0; for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

async function limitedJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 262144) { await reader.cancel(); throw new Error('Payload too large'); }
    chunks.push(value);
  }
  const combined = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(combined));
}

export function createWorker(assets = {}) {
  return { async fetch(request, env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/ingest') {
        if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
        if (!await authorized(request, env.PUBLISH_TOKEN)) return json({ error: 'Unauthorized' }, 401);
        let payload;
        try { payload = await limitedJson(request); } catch { return json({ error: 'Invalid payload' }, 400); }
        if (!Number.isFinite(payload.state?.server_time) || !Number.isInteger(payload.state?.revision) || !Array.isArray(payload.state?.devices) || !payload.state?.summary || !Array.isArray(payload.building?.floor_plans)) return json({ error: 'Invalid snapshot' }, 400);
        await env.BUCKET.put('incident/latest.json', JSON.stringify({ ...payload, received_at: Date.now() }), { httpMetadata: { contentType: 'application/json' } });
        return json({ ok: true });
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'This field dashboard is read-only.' }, 403);
      if (path === '/api/runtime') return json({ transport: 'poll', can_control: false, share: { url: `${env.PUBLIC_DASHBOARD_URL}/?view=field`, qr_url: '/share-qr.png' } });
      if (path.startsWith('/api/') || path === '/building.json') {
        const object = await env.BUCKET.get('incident/latest.json');
        if (!object) return json({ error: 'Waiting for the command station.' }, 503);
        const record = await object.json();
        if (path === '/api/building' || path === '/building.json') return json(record.building);
        if (path === '/api/state') return json({ ...record.state, source_age_ms: Math.max(0, Date.now() - record.received_at) });
        if (path === '/api/summary') return json(record.state.summary);
        if (path === '/api/floors') return json(record.state.floors);
        return json({ error: 'Not found' }, 404);
      }
      const asset = assets[path === '/' ? '/index.html' : path];
      if (!asset) return new Response('Not found', { status: 404 });
      const body = asset.base64 ? Uint8Array.from(atob(asset.body), c => c.charCodeAt(0)) : asset.body;
      return new Response(request.method === 'HEAD' ? null : body, { headers: { 'Content-Type': asset.type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' } });
    } catch { return json({ error: 'Live feed temporarily unavailable.' }, 503); }
  } };
}
