import { isAdmin, jsonResponse, unauthorized } from '../../../lib/admin.js';

export async function onRequestPost({ request, env, params }) {
  if (!isAdmin(request, env)) return unauthorized();

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: 'Invalid origin.' }, 403);
  }

  if (!env.TRACES_BUCKET || !env.MEDIA_BUCKET) {
    return jsonResponse({ error: 'Storage is not configured.' }, 503);
  }

  const id = String(params.id || '');
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return jsonResponse({ error: 'Invalid trace ID.' }, 400);

  const body = await request.json().catch(() => null);
  if (!['approve', 'reject', 'delete'].includes(body?.action)) {
    return jsonResponse({ error: 'Invalid action.' }, 400);
  }

  const sourceStatus = body.action === 'delete' ? 'approved' : 'pending';
  const sourceKey = `traces/${sourceStatus}/${id}.json`;
  const object = await env.TRACES_BUCKET.get(sourceKey);
  if (!object) return jsonResponse({ error: 'Trace not found.' }, 404);

  const trace = await object.json();
  if (trace.id !== id || trace.status !== sourceStatus) {
    return jsonResponse({ error: `Invalid ${sourceStatus} trace.` }, 409);
  }

  try {
    if (body.action === 'delete') {
      await env.TRACES_BUCKET.delete(sourceKey);
      if (trace.photo) await env.MEDIA_BUCKET.delete(trace.photo);
      return jsonResponse({ id, status: 'deleted' });
    }

    if (body.action === 'approve') {
      trace.status = 'approved';
      await env.TRACES_BUCKET.put(`traces/approved/${id}.json`, JSON.stringify(trace, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });
    } else {
      trace.status = 'rejected';
      await env.TRACES_BUCKET.put(`traces/rejected/${id}.json`, JSON.stringify(trace, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });

      if (trace.photo) await env.MEDIA_BUCKET.delete(trace.photo);
    }

    await env.TRACES_BUCKET.delete(sourceKey);
    return jsonResponse({ id, status: trace.status });
  } catch (error) {
    console.error('Could not moderate trace', error);
    return jsonResponse({ error: error.message || 'Moderation failed.' }, 500);
  }
}
