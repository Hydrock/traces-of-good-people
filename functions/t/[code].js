export function onRequest({ request, env }) {
  return env.ASSETS.fetch(new URL('/t/index.html', request.url));
}
