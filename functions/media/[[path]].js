export async function onRequestGet({ env, params }) {
  if (!env.MEDIA_BUCKET) return new Response('Media storage is not configured.', { status: 503 });

  const segments = Array.isArray(params.path) ? params.path : [params.path];
  const key = segments.filter(Boolean).join('/');
  if (!key.startsWith('photos/')) return new Response('Not found.', { status: 404 });

  const object = await env.MEDIA_BUCKET.get(key);
  if (!object) return new Response('Not found.', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(object.body, { headers });
}
