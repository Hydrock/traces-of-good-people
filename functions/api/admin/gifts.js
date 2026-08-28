import { isAdmin, jsonResponse, unauthorized } from '../../lib/admin.js';
import { ensureSeedGifts, listJson } from '../../lib/storage.js';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(existingCodes) {
  let code;
  do {
    code = '';
    while (code.length < 5) {
      const byte = crypto.getRandomValues(new Uint8Array(1))[0];
      if (byte >= 256 - (256 % alphabet.length)) continue;
      code += alphabet[byte % alphabet.length];
    }
  } while (existingCodes.has(code));
  existingCodes.add(code);
  return code;
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return unauthorized();
  if (!env.TRACES_BUCKET) return jsonResponse({ error: 'Storage is not configured.' }, 503);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return jsonResponse({ error: 'Invalid origin.' }, 403);

  const body = await request.json().catch(() => null);
  const quantity = Number(body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    return jsonResponse({ error: 'Quantity must be between 1 and 50.' }, 400);
  }

  try {
    await ensureSeedGifts(env);
    const existingGifts = (await listJson(env, 'gifts/')).filter(Boolean);
    const existingCodes = new Set(existingGifts.map((gift) => gift.code));
    const highestNumber = existingGifts.reduce((highest, gift) => Math.max(highest, Number(gift.id)), 0);
    if (highestNumber + quantity > 9999) return jsonResponse({ error: 'Four-digit gift numbers are exhausted.' }, 409);

    const createdAt = new Date().toISOString().slice(0, 10);
    const gifts = Array.from({ length: quantity }, (_, index) => ({
      id: String(highestNumber + index + 1).padStart(4, '0'),
      code: randomCode(existingCodes),
      createdAt,
      givenAt: null,
      city: null,
      country: null,
    }));

    await Promise.all(gifts.map((gift) => env.TRACES_BUCKET.put(
      `gifts/${gift.code}.json`,
      JSON.stringify(gift, null, 2),
      { httpMetadata: { contentType: 'application/json' } },
    )));
    return jsonResponse({ gifts }, 201);
  } catch (error) {
    console.error('Could not generate gifts', error);
    return jsonResponse({ error: 'Gift generation failed.' }, 500);
  }
}
