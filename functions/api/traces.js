import gifts from '../generated/gifts.js';
const languages = new Set(['en', 'ru', 'es', 'fr', 'pt', 'ar', 'zh', 'hi']);
const photoTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const jsonResponse = (body, status) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

async function hasValidPhotoSignature(photo) {
  const bytes = new Uint8Array(await photo.slice(0, 12).arrayBuffer());

  if (photo.type === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (photo.type === 'image/png') {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (byte, index) => bytes[index] === byte,
    );
  }

  return (
    photo.type === 'image/webp' &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  );
}

export async function onRequestPost({ request, env }) {
  if (!env.TRACES_BUCKET || !env.MEDIA_BUCKET) {
    return jsonResponse({ error: 'Storage is not configured.' }, 503);
  }

  const contentLength = Number(request.headers.get('content-length') || 0);

  if (contentLength > 10 * 1024 * 1024) {
    return jsonResponse({ error: 'Submission is too large.' }, 413);
  }

  let form;

  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: 'Invalid form data.' }, 400);
  }

  const giftCode = String(form.get('gift') || '').trim();
  const language = String(form.get('language') || 'en');
  const name = String(form.get('name') || '').trim();
  const location = String(form.get('location') || '').trim();
  const message = String(form.get('message') || '').trim();
  const consent = form.get('consent');
  const photo = form.get('photo');

  if (!gifts.some((gift) => gift.code === giftCode)) {
    return jsonResponse({ error: 'Unknown gift code.' }, 400);
  }

  if (!languages.has(language)) {
    return jsonResponse({ error: 'Unsupported language.' }, 400);
  }

  if (!message || message.length > 1000 || name.length > 80 || location.length > 120) {
    return jsonResponse({ error: 'Invalid field length.' }, 400);
  }

  if (consent !== 'yes') {
    return jsonResponse({ error: 'Publication consent is required.' }, 400);
  }

  const hasPhoto = photo instanceof File && photo.size > 0;

  if (hasPhoto && (!photoTypes[photo.type] || photo.size > 8 * 1024 * 1024)) {
    return jsonResponse({ error: 'Invalid photo.' }, 400);
  }

  if (hasPhoto && !(await hasValidPhotoSignature(photo))) {
    return jsonResponse({ error: 'Invalid photo.' }, 400);
  }

  const now = new Date();
  const id = `${now.getUTCFullYear()}-${crypto.randomUUID()}`;
  const photoKey = hasPhoto ? `photos/${id}.${photoTypes[photo.type]}` : null;
  const traceKey = `traces/pending/${id}.json`;

  try {
    if (hasPhoto) {
      await env.MEDIA_BUCKET.put(photoKey, photo.stream(), {
        httpMetadata: {
          contentType: photo.type,
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });
    }

    const trace = {
      id,
      gift: giftCode,
      name: name || null,
      location: location || null,
      message,
      photo: photoKey,
      language,
      status: 'pending',
      createdAt: now.toISOString(),
    };

    await env.TRACES_BUCKET.put(traceKey, JSON.stringify(trace, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });

    return jsonResponse({ id, status: 'pending' }, 201);
  } catch (error) {
    if (photoKey) {
      await env.MEDIA_BUCKET.delete(photoKey).catch(() => {});
    }

    console.error('Could not store trace', error);
    return jsonResponse({ error: 'Could not store submission.' }, 500);
  }
}
