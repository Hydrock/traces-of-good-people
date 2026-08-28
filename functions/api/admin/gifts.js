import { isAdmin, jsonResponse, unauthorized } from '../../lib/admin.js';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function githubHeaders(env) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'User-Agent': 'traces-of-good-people',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function githubRequest(env, path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`, {
    ...options,
    headers: {
      ...githubHeaders(env),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status}.`);
  }

  return response.json();
}

function randomCode(existingCodes) {
  let code;

  do {
    code = '';
    while (code.length < 5) {
      const bytes = crypto.getRandomValues(new Uint8Array(5));

      for (const byte of bytes) {
        if (byte >= 256 - (256 % alphabet.length)) continue;
        code += alphabet[byte % alphabet.length];
        if (code.length === 5) break;
      }
    }
  } while (existingCodes.has(code));

  existingCodes.add(code);
  return code;
}

function decodeJsonContent(content) {
  const binary = atob(content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return unauthorized();

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: 'Invalid origin.' }, 403);
  }

  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) {
    return jsonResponse({ error: 'GitHub publishing is not configured.' }, 503);
  }

  const body = await request.json().catch(() => null);
  const quantity = Number(body?.quantity);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    return jsonResponse({ error: 'Quantity must be between 1 and 50.' }, 400);
  }

  const branch = env.GITHUB_BRANCH || 'main';

  try {
    const files = await githubRequest(
      env,
      `/contents/data/gifts?ref=${encodeURIComponent(branch)}`,
    );
    const giftFiles = files.filter((file) => /^\d{4}\.json$/.test(file.name));
    const existingGifts = await Promise.all(
      giftFiles.map(async (file) => {
        const path = file.url.replace(
          `https://api.github.com/repos/${env.GITHUB_REPOSITORY}`,
          '',
        );
        const storedFile = await githubRequest(env, path);
        return decodeJsonContent(storedFile.content);
      }),
    );
    const existingCodes = new Set(existingGifts.map((gift) => gift.code));
    const highestNumber = existingGifts.reduce(
      (highest, gift) => Math.max(highest, Number(gift.id)),
      0,
    );

    if (highestNumber + quantity > 9999) {
      return jsonResponse({ error: 'Four-digit gift numbers are exhausted.' }, 409);
    }

    const createdAt = new Date().toISOString().slice(0, 10);
    const gifts = Array.from({ length: quantity }, (_, index) => ({
      id: String(highestNumber + index + 1).padStart(4, '0'),
      code: randomCode(existingCodes),
      createdAt,
      givenAt: null,
      city: null,
      country: null,
    }));

    const reference = await githubRequest(env, `/git/ref/heads/${encodeURIComponent(branch)}`);
    const commit = await githubRequest(env, `/git/commits/${reference.object.sha}`);
    const blobs = await Promise.all(
      gifts.map((gift) =>
        githubRequest(env, '/git/blobs', {
          method: 'POST',
          body: JSON.stringify({
            content: `${JSON.stringify(gift, null, 2)}\n`,
            encoding: 'utf-8',
          }),
        }),
      ),
    );
    const tree = await githubRequest(env, '/git/trees', {
      method: 'POST',
      body: JSON.stringify({
        base_tree: commit.tree.sha,
        tree: gifts.map((gift, index) => ({
          path: `data/gifts/${gift.id}.json`,
          mode: '100644',
          type: 'blob',
          sha: blobs[index].sha,
        })),
      }),
    });
    const newCommit = await githubRequest(env, '/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: `Create ${quantity} gift${quantity === 1 ? '' : 's'}`,
        tree: tree.sha,
        parents: [reference.object.sha],
      }),
    });

    await githubRequest(env, `/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });

    return jsonResponse({ gifts }, 201);
  } catch (error) {
    console.error('Could not generate gifts', error);
    return jsonResponse({ error: error.message || 'Gift generation failed.' }, 500);
  }
}
