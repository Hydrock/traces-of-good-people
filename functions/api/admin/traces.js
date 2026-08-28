import { isAdmin, jsonResponse, unauthorized } from '../../lib/admin.js';
import gifts from '../../generated/gifts.js';

const giftsByCode = new Map(gifts.map((gift) => [gift.code, gift]));

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return unauthorized();
  if (!env.TRACES_BUCKET) return jsonResponse({ error: 'Storage is not configured.' }, 503);

  const listed = await env.TRACES_BUCKET.list({
    prefix: 'traces/pending/',
    limit: 100,
  });

  const traces = (
    await Promise.all(
      listed.objects.map(async ({ key }) => {
        const object = await env.TRACES_BUCKET.get(key);
        return object ? object.json() : null;
      }),
    )
  )
    .filter((trace) => trace?.status === 'pending')
    .map((trace) => ({
      ...trace,
      giftNumber: giftsByCode.get(trace.gift)?.id || null,
      photoUrl:
        trace.photo
          ? `${(env.MEDIA_PUBLIC_URL || `${new URL(request.url).origin}/media`).replace(/\/$/, '')}/${trace.photo}`
          : null,
    }))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return jsonResponse({ traces, truncated: listed.truncated });
}
