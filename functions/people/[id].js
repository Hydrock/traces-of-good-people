export function onRequest({ request, env }) {
  return env.ASSETS.fetch(new URL('/people/person/index.html', request.url));
}
