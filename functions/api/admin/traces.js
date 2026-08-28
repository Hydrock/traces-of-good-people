import { isAdmin, jsonResponse, unauthorized } from '../../lib/admin.js';
import { loadPublishedTraces } from '../../lib/github-traces.js';
import gifts from '../../generated/gifts.js';

const giftsByCode = new Map(gifts.map((gift) => [gift.code, gift]));

async function loadTraces(env, prefix, status, mediaUrl) {
  const listed = await env.TRACES_BUCKET.list({ prefix, limit: 100 });
  const traces = await Promise.all(
    listed.objects.map(async ({ key }) => {
      const object = await env.TRACES_BUCKET.get(key);
      return object ? object.json() : null;
    }),
  );

  return {
    traces: traces
      .filter((trace) => trace?.status === status)
      .map((trace) => ({
        ...trace,
        giftNumber: giftsByCode.get(trace.gift)?.id || null,
        photoUrl: trace.photo ? `${mediaUrl}/${trace.photo}` : null,
      }))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    truncated: listed.truncated,
  };
}

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return unauthorized();
  if (!env.TRACES_BUCKET) return jsonResponse({ error: 'Storage is not configured.' }, 503);

  const mediaUrl = (env.MEDIA_PUBLIC_URL || `${new URL(request.url).origin}/media`).replace(
    /\/$/,
    '',
  );
  const [pending, published] = await Promise.all([
    loadTraces(env, 'traces/pending/', 'pending', mediaUrl),
    loadPublishedTraces(env),
  ]);
  const approved = published
    .filter((trace) => trace.status === 'approved')
    .map((trace) => ({
      ...trace,
      giftNumber: giftsByCode.get(trace.gift)?.id || null,
      photoUrl: trace.photo ? `${mediaUrl}/${trace.photo}` : null,
    }))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return jsonResponse({
    traces: pending.traces,
    approved,
    truncated: pending.truncated,
  });
}
