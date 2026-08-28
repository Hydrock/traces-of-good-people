# Traces of Good People

Small gifts. Random meetings. Good people around the world.

## Local website

Use Astro when you only need to work on static pages:

```bash
npm install
npm run dev
```

The site opens at `http://localhost:4321`. Forms and admin API calls do not work
in this mode because Astro does not run Cloudflare Pages Functions.

## Full local environment

Install Wrangler once, copy the local variables, build the site, and start
Cloudflare Pages locally:

```bash
npm install --save-dev wrangler
cp .dev.vars.example .dev.vars
npm run dev:full
```

Open the URL printed by Wrangler, normally `http://localhost:8788`. Local R2
data is stored under `.wrangler/` and is ignored by Git.

`LOCAL_ADMIN=true` works only for requests whose hostname is `localhost` or
`127.0.0.1`. Do not configure this variable in Cloudflare production.

Submitting a trace and rejecting it can be tested entirely locally. Approving
a trace and generating gifts write to GitHub, so add `GITHUB_TOKEN` to
`.dev.vars` only if that is intentional. Prefer a test repository.

## Production setup

1. Create two R2 buckets:

   ```bash
   npx wrangler r2 bucket create traces-of-good-people-traces
   npx wrangler r2 bucket create traces-of-good-people-media
   ```

2. In Cloudflare Pages, connect `Hydrock/traces-of-good-people` and configure:

   ```text
   Build command: npm run build
   Build output directory: dist
   Node.js version: 22 or newer
   ```

3. Add the two R2 bindings from `wrangler.jsonc` to both Production and Preview:

   ```text
   TRACES_BUCKET -> traces-of-good-people-traces
   MEDIA_BUCKET  -> traces-of-good-people-media
   ```

4. Configure these runtime variables and secrets:

   ```text
   ADMIN_EMAILS       comma-separated administrator emails
   GITHUB_REPOSITORY  Hydrock/traces-of-good-people
   GITHUB_BRANCH      main
   GITHUB_TOKEN       fine-grained token with Contents: Read and write
   ```

   `GITHUB_TOKEN` must be stored as an encrypted secret, never as a public build
   variable or committed file.

5. Protect these paths with a Cloudflare Access self-hosted application:

   ```text
   /admin*
   /api/admin*
   ```

   Allow only the same email addresses listed in `ADMIN_EMAILS`. The public
   submission endpoint `/api/traces` must remain outside the Access policy.

6. Deploy through the Git integration, or manually:

   ```bash
   npm run build
   npx wrangler pages deploy dist --project-name traces-of-good-people
   ```

7. Add a Cloudflare rate-limiting rule for `POST /api/traces` if real traffic
   shows spam. Start conservatively and keep legitimate QR visitors unblocked.

The public media endpoint is `/media/photos/...`. JSON metadata stays in the
private `TRACES_BUCKET`; only photo objects can be read through that endpoint.

## Production checklist

- Scan a real QR code and open `/t/[code]` on a phone.
- Switch every language, including Arabic RTL.
- Submit text with and without a photo.
- Confirm the new item appears only in `/admin` as pending.
- Approve it and wait for the GitHub-triggered Pages rebuild.
- Confirm it appears in `/people` only after that rebuild.
- Reject a test item and confirm its photo returns 404.
- Confirm unauthenticated requests cannot open `/admin` or `/api/admin`.
