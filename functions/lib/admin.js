export function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function isAdmin(request, env) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email')?.toLowerCase();
  const allowedEmails = String(env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(email && allowedEmails.includes(email));
}

export function unauthorized() {
  return jsonResponse({ error: 'Unauthorized.' }, 401);
}
