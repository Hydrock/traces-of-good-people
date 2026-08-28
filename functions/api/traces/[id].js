import { publicTrace } from '../../lib/storage.js';

export async function onRequestGet({ request, env, params }) {
  if (!env.TRACES_BUCKET) return Response.json({ error: 'Storage is not configured.' }, { status: 503 });

  const id = String(params.id || '');
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return Response.json({ error: 'Trace not found.' }, { status: 404 });

  const object = await env.TRACES_BUCKET.get(`traces/approved/${id}.json`);
  if (!object) return Response.json({ error: 'Trace not found.' }, { status: 404 });

  const trace = await object.json();
  return Response.json(publicTrace(trace, request, env), { headers: { 'Cache-Control': 'no-store' } });
}
