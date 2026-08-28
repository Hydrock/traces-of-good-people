import { isAdmin, jsonResponse, unauthorized } from '../../../lib/admin.js';

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function publishTrace(trace, env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) {
    throw new Error('GitHub publishing is not configured.');
  }

  const branch = env.GITHUB_BRANCH || 'main';
  const path = `data/traces/${trace.id}.json`;
  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/contents/${path}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'User-Agent': 'traces-of-good-people',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const existing = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
  const existingFile = existing.ok ? await existing.json() : null;
  const content = `${JSON.stringify(trace, null, 2)}\n`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Approve trace ${trace.id}`,
      content: encodeBase64(content),
      branch,
      ...(existingFile?.sha ? { sha: existingFile.sha } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status}.`);
  }
}

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
  if (!['approve', 'reject'].includes(body?.action)) {
    return jsonResponse({ error: 'Invalid action.' }, 400);
  }

  const pendingKey = `traces/pending/${id}.json`;
  const object = await env.TRACES_BUCKET.get(pendingKey);
  if (!object) return jsonResponse({ error: 'Trace not found.' }, 404);

  const trace = await object.json();
  if (trace.id !== id || trace.status !== 'pending') {
    return jsonResponse({ error: 'Invalid pending trace.' }, 409);
  }

  try {
    if (body.action === 'approve') {
      trace.status = 'approved';
      await publishTrace(trace, env);
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

    await env.TRACES_BUCKET.delete(pendingKey);
    return jsonResponse({ id, status: trace.status });
  } catch (error) {
    console.error('Could not moderate trace', error);
    return jsonResponse({ error: error.message || 'Moderation failed.' }, 500);
  }
}
