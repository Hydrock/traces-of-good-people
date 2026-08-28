import { ensureSeedGifts, getGift } from '../../lib/storage.js';

export async function onRequestGet({ env, params }) {
  if (!env.TRACES_BUCKET) return Response.json({ error: 'Storage is not configured.' }, { status: 503 });

  const code = String(params.code || '').toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) return Response.json({ error: 'Gift not found.' }, { status: 404 });

  await ensureSeedGifts(env);
  const gift = await getGift(env, code);
  return gift
    ? Response.json(gift, { headers: { 'Cache-Control': 'no-store' } })
    : Response.json({ error: 'Gift not found.' }, { status: 404 });
}
