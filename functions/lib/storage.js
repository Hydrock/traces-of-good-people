import seedGifts from '../generated/gifts.js';

export async function ensureSeedGifts(env) {
  await Promise.all(
    seedGifts.map(async (gift) => {
      const key = `gifts/${gift.code}.json`;
      if (await env.TRACES_BUCKET.head(key)) return;
      await env.TRACES_BUCKET.put(key, JSON.stringify(gift, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });
    }),
  );
}

export async function getGift(env, code) {
  const object = await env.TRACES_BUCKET.get(`gifts/${code}.json`);
  return object ? object.json() : null;
}

export async function listJson(env, prefix) {
  const objects = [];
  let cursor;

  do {
    const page = await env.TRACES_BUCKET.list({ prefix, cursor });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return Promise.all(
    objects.map(async ({ key }) => {
      const object = await env.TRACES_BUCKET.get(key);
      return object ? object.json() : null;
    }),
  );
}

export function publicTrace(trace, request, env) {
  const mediaUrl = (env.MEDIA_PUBLIC_URL || `${new URL(request.url).origin}/media`).replace(/\/$/, '');
  return {
    ...trace,
    photoUrl: trace.photo
      ? (/^https?:\/\//.test(trace.photo) || trace.photo.startsWith('/')
          ? trace.photo
          : `${mediaUrl}/${trace.photo}`)
      : null,
  };
}
