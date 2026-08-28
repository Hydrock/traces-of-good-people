import { isAdmin, jsonResponse, unauthorized } from '../../lib/admin.js';
import { ensureSeedGifts, getGift, listJson, publicTrace } from '../../lib/storage.js';

async function prepareTraces(traces, request, env) {
  return Promise.all(traces.filter(Boolean).map(async (trace) => ({
    ...publicTrace(trace, request, env),
    giftNumber: (await getGift(env, trace.gift))?.id || null,
  })));
}

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return unauthorized();
  if (!env.TRACES_BUCKET) return jsonResponse({ error: 'Storage is not configured.' }, 503);

  await ensureSeedGifts(env);
  const [pendingData, approvedData] = await Promise.all([
    listJson(env, 'traces/pending/'),
    listJson(env, 'traces/approved/'),
  ]);
  const [pending, approved] = await Promise.all([
    prepareTraces(pendingData.filter((trace) => trace?.status === 'pending'), request, env),
    prepareTraces(approvedData.filter((trace) => trace?.status === 'approved'), request, env),
  ]);

  return jsonResponse({
    traces: pending.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    approved: approved.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    truncated: false,
  });
}
