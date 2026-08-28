function githubHeaders(env) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'User-Agent': 'traces-of-good-people',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function decodeContent(content) {
  const binary = atob(content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function requireGitHub(env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) {
    throw new Error('GitHub publishing is not configured.');
  }
}

export async function getPublishedTrace(id, env) {
  requireGitHub(env);

  const branch = env.GITHUB_BRANCH || 'main';
  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/contents/data/traces/${id}.json`;
  const headers = githubHeaders(env);
  const response = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);

  const file = await response.json();
  return { trace: decodeContent(file.content), sha: file.sha, url, headers, branch };
}

export async function loadPublishedTraces(env) {
  requireGitHub(env);

  const branch = env.GITHUB_BRANCH || 'main';
  const baseUrl = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}`;
  const headers = githubHeaders(env);
  const response = await fetch(
    `${baseUrl}/contents/data/traces?ref=${encodeURIComponent(branch)}`,
    { headers },
  );

  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);

  const files = (await response.json()).filter((file) => file.name.endsWith('.json'));
  return Promise.all(
    files.map(async (file) => {
      const fileResponse = await fetch(file.url, { headers });
      if (!fileResponse.ok) throw new Error(`GitHub returned ${fileResponse.status}.`);
      return decodeContent((await fileResponse.json()).content);
    }),
  );
}

export async function deletePublishedTrace(id, env) {
  const published = await getPublishedTrace(id, env);
  if (!published) return null;

  const response = await fetch(published.url, {
    method: 'DELETE',
    headers: { ...published.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Delete trace ${id}`,
      sha: published.sha,
      branch: published.branch,
    }),
  });

  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
  return published.trace;
}
