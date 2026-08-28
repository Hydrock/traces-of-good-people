# Traces of Good People

## Purpose of this file

This file contains repository-specific instructions for coding agents and contributors. Read it before changing the project.

The complete setup, operations, deployment, API, and troubleshooting documentation is in `README.md`. Keep this file focused on product invariants, architecture constraints, and safe implementation rules.

---

## Project goal

Traces of Good People is a small, low-maintenance website about people met while travelling.

Physical gifts, postcards, chocolate, or other small items contain a QR code. Every QR code belongs to a specific sequentially numbered gift. A recipient scans the QR code, selects a language, leaves a short message, and may attach a photograph. The submission becomes public only after manual moderation.

The project must remain simple, inexpensive, private by default, and easy to understand by reading a few files.

Production site:

`https://traces-of-good-people.pages.dev/`

---

## Current implementation status

The original implementation phases 1–8 are complete. The project currently includes:

- static Astro pages and a shared layout;
- gift lookup by private code;
- a translated feedback form;
- Cloudflare Pages Functions API;
- R2 storage for gifts, pending submissions, published submissions, rejected submissions, and photographs;
- public people gallery and individual trace pages;
- Cloudflare Access-compatible admin authentication;
- approve, reject, and delete moderation actions;
- sequential gift generation, random private codes, QR generation, and QR download;
- production deployment on Cloudflare Pages;
- responsive layouts and mobile photo upload handling;
- a forced first language choice and a language selector on public pages;
- eight complete public-site translations.

Do not repeat the phase implementation or restore superseded GitHub-based persistence. Treat the current repository as the source of truth.

---

## Core principles

1. Keep the architecture as simple as possible.
2. Do not introduce technology without a concrete current need.
3. Prefer static generation for page shells and content that changes only with deployments.
4. Keep mutable runtime data in R2.
5. Do not add a database.
6. Do not add a permanent backend server.
7. Do not add a frontend framework such as React, Vue, or Svelte.
8. Do not add TypeScript.
9. Use plain JavaScript, HTML, and CSS.
10. Keep dependencies to a minimum.
11. Prefer readable, explicit functions over abstractions.
12. Do not over-engineer for hypothetical scale.
13. Preserve progressive enhancement and mobile usability.
14. Never require a site rebuild for ordinary user submissions, moderation, or gift generation.
15. Never publish a submission before manual approval.

---

## Required technology stack

Use:

- Astro;
- JavaScript;
- HTML;
- plain CSS;
- JSON translation files;
- GitHub for source control and deployment integration only;
- Cloudflare Pages;
- Cloudflare Pages Functions for server-side functionality;
- Cloudflare R2 for all mutable data and uploaded photographs;
- Cloudflare Access for production admin protection;
- native browser APIs where practical.

Do not use unless a future user explicitly changes these constraints:

- TypeScript;
- React, Vue, Svelte, Redux, or another frontend state framework;
- Tailwind or a large component library;
- PostgreSQL, MySQL, MongoDB, SQLite, or another database;
- an ORM;
- Docker for the website;
- a dedicated VPS backend;
- Git commits as runtime persistence;
- GitHub API writes for gifts or traces;
- client-visible GitHub or Cloudflare credentials.

The only intentional runtime package beyond Astro is `qrcode`, used by the admin gift generator.

---

## Current architecture

```text
Browser
  │
  ├── static pages, CSS, and bundled assets ── Cloudflare Pages
  │
  └── /api/* and /media/* ─────────────────── Pages Functions
                                                    │
                          ┌─────────────────────────┴────────────────────────┐
                          │                                                  │
                    TRACES_BUCKET                                     MEDIA_BUCKET
              gifts and trace metadata                           uploaded photographs
```

Architecture rules:

- Astro builds static page shells into `dist/`.
- `/t/:code` and `/people/:id` use static shells served by Pages Functions and load current data from API endpoints.
- Mutable data must not be imported into the Astro build.
- Public data must be read from R2 at request time so that changes are immediately visible.
- Both R2 buckets may remain private.
- User photographs must be served through `/media/photos/*` unless `MEDIA_PUBLIC_URL` is deliberately configured.
- GitHub stores code only. `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, and `GITHUB_BRANCH` are not application requirements.

R2 bindings are defined in `wrangler.jsonc`:

```text
TRACES_BUCKET -> traces-of-good-people-traces
MEDIA_BUCKET  -> traces-of-good-people-media
```

Do not rename bindings or object prefixes without implementing and documenting a migration.

---

## Repository structure

```text
data/
  gifts/                       legacy source seed gift JSON
functions/
  api/
    gifts/[code].js            public gift lookup
    traces.js                  public trace list and submission
    traces/[id].js             public approved trace lookup
    admin/gifts.js             gift generation
    admin/traces.js            moderation lists
    admin/traces/[id].js       approve, reject, and delete actions
  lib/
    admin.js                   admin authorization helper
    storage.js                 direct R2 helpers
    seed-gifts.js              bundled initial gift data
  media/[[path]].js            controlled photo delivery
  people/[id].js               individual trace shell routing
  t/[code].js                  gift shell routing
src/
  assets/                      site illustrations
  components/                  small Astro components
  i18n/                        translation JSON files
  layouts/Layout.astro         shared page layout
  pages/                       Astro pages and dynamic shells
  scripts/                     browser-side JavaScript
  styles/global.css            global styles
public/                        files copied without processing
wrangler.jsonc                 Pages and R2 configuration
```

Do not create empty layers or generic repository/service/factory abstractions merely to mirror an imagined enterprise architecture.

---

## Runtime storage model

Do not use repository files for production writes. All current gift and trace metadata is stored as one JSON object per record in `TRACES_BUCKET`.

### R2 object prefixes

```text
TRACES_BUCKET
  gifts/<CODE>.json
  traces/pending/<ID>.json
  traces/approved/<ID>.json
  traces/rejected/<ID>.json

MEDIA_BUCKET
  photos/<ID>.<extension>
```

### Gift model

```json
{
  "id": "0047",
  "code": "K7M2Q",
  "createdAt": "2026-08-28",
  "givenAt": null,
  "city": null,
  "country": null
}
```

Gift invariants:

- `id` is a four-digit sequential public number.
- `code` is a random five-character private URL code.
- The URL code must not be derived from the public number.
- Codes use unambiguous uppercase letters and digits.
- Generated gifts must work immediately without a deployment.
- Initial bundled gifts are copied into R2 lazily by `ensureSeedGifts()`.

### Trace model

```json
{
  "id": "2026-32becf13-86a9-4b67-821f-0eaa2e2647fa",
  "gift": "K7M2Q",
  "name": "Amir",
  "location": "Lahore, Pakistan",
  "message": "Nice to meet you!",
  "photo": "photos/2026-32becf13-86a9-4b67-821f-0eaa2e2647fa.webp",
  "language": "en",
  "status": "pending",
  "createdAt": "2026-08-28T12:00:00.000Z"
}
```

Trace invariants:

- One trace equals one JSON object.
- `message` is required.
- `name`, `location`, and `photo` are optional.
- Store a photo object key, not a Git blob or local filesystem path.
- Status is exactly `pending`, `approved`, or `rejected`.
- Public endpoints may return only approved traces.
- Moving a trace between status prefixes and updating `status` must remain consistent.

---

## Public routes

Maintain these routes:

```text
/
/about
/t/:code
/people
/people/:id
/404
```

Current behavior:

- `/t/:code` validates the gift through `/api/gifts/:code` and displays its public TRACE number.
- `/people` fetches approved traces at runtime.
- `/people/:id` fetches one approved trace at runtime.
- Records without photographs use `src/assets/nophoto.png` to preserve layout.
- User content must be rendered as text, not trusted HTML.

Do not convert runtime routes back into build-time generated pages; that would reintroduce delayed visibility and rebuilds after moderation.

---

## Feedback form

The form includes only:

- name or nickname, optional;
- city/country, optional;
- message, required;
- photograph, optional;
- explicit publication/privacy consent, required.

Do not add email, phone, surname, exact GPS location, identification details, financial information, passwords, or social-network accounts unless explicitly requested later.

Before submission, clearly warn users not to share sensitive or private information and explain that approved text and photographs become public.

After a successful submission:

- hide the form;
- show a prominent success state;
- explain that the trace is awaiting moderation;
- show the small `sended.png` illustration;
- offer a translated link to `/people`.

Never publish directly from the submission endpoint.

---

## Photo handling

Do not store uploaded photographs in Git or in the Pages filesystem.

Current client behavior:

- offers the normal mobile chooser so the user can select from the gallery or take a photo;
- attempts browser-side resize to a maximum dimension of 1800 px;
- attempts JPEG conversion at approximately `0.82` quality;
- has a conversion timeout and falls back safely when conversion cannot finish;
- uses an upload timeout so iPhone Safari does not remain indefinitely in a sending state;
- shows a visible sending animation and disables duplicate submission.

Current server rules:

- accept JPEG, PNG, and WebP only;
- verify both MIME type and file signature;
- limit the photo to 8 MB;
- limit the whole request to 10 MB using `Content-Length` when present;
- store photos under `photos/` in `MEDIA_BUCKET`;
- serve only `photos/` keys through the media Function;
- send the stored content type, ETag, long immutable cache headers, and `nosniff`.

When changing upload code, test on desktop, Android, and iPhone. A desktop-only success is insufficient.

---

## Localization

Supported public languages:

- English (`en`)
- Russian (`ru`)
- Spanish (`es`)
- French (`fr`)
- Portuguese (`pt`)
- Arabic (`ar`)
- Chinese (`zh`)
- Hindi (`hi`)

Rules:

- English is always the fallback language.
- Keep translations in `src/i18n/<code>.json`.
- Do not introduce an i18n framework while plain JSON remains sufficient.
- The global public language selector must remain available on all public pages.
- `/t/:code` must show a forced language welcome screen when the language cookie is absent.
- Store selection in the `traces_language` cookie.
- Preserve Arabic RTL behavior.
- Localize static text, API error presentation, status messages, links, metadata labels, and dates.
- Do not machine-translate user-submitted content.
- Admin UI may remain English unless the user explicitly asks to translate it.

When adding a translation key, add it consistently to all eight locale files and verify English fallback.

---

## Visual direction

Reference:

`https://oleni.rent/`

The current site direction is:

- black and white interface;
- compact large typography rather than oversized headings that dominate the viewport;
- strong whitespace without excessive page height;
- simple modern sans-serif typography;
- minimal controls and decoration;
- colour may come from photographs and the provided illustrations;
- fixed, responsive illustration dimensions so intrinsic image size cannot break layouts;
- mobile-first layout;
- no gradients;
- no glassmorphism;
- no decorative animation.

Animations are acceptable only as functional feedback, such as the submission progress indicator.

Current illustrations are intentional assets:

```text
src/assets/hand.png       homepage
src/assets/letter.png     gift form
src/assets/backpack.png   About page
src/assets/people.png     People page
src/assets/sended.png     successful submission
src/assets/nophoto.png    missing-photo placeholder
src/assets/404.png        404 page
```

Keep heading and image sizes bounded with CSS. Verify that optional content does not alter the structural grid unexpectedly.

---

## Moderation rules

Submission flow is fixed:

```text
visitor submits
      ↓
    pending
      ↓
admin reviews
  ↙        ↘
approved  rejected
```

- `Approve` moves metadata from pending to approved.
- `Reject` moves metadata from pending to rejected and deletes its photograph.
- `Delete` applies to approved records and deletes both metadata and photograph.
- Public lists and detail endpoints expose only approved objects.
- New decisions must be visible immediately without triggering a Pages build.

The admin interface should remain a small moderation tool, not grow into a general CMS.

---

## Gift generator rules

The existing generator:

- accepts quantities from 1 to 50;
- assigns the next four-digit sequential public numbers;
- generates random five-character URL codes;
- excludes ambiguous characters;
- checks code uniqueness in R2;
- stores gifts directly in R2;
- points QR codes to `/t/<CODE>` on the selected site origin;
- supports QR image download.

Do not make gift generation depend on GitHub commits or deployments. Printable A4 sheets remain optional and should be added only if explicitly requested.

---

## API contract and validation

Maintain the following endpoints:

| Method and path | Responsibility | Access |
| --- | --- | --- |
| `GET /api/gifts/:code` | Validate and return a gift | Public |
| `GET /api/traces` | Return approved traces | Public |
| `POST /api/traces` | Create a pending trace | Public |
| `GET /api/traces/:id` | Return one approved trace | Public |
| `GET /api/admin/traces` | Return pending and approved traces | Admin |
| `POST /api/admin/traces/:id` | Approve, reject, or delete | Admin |
| `POST /api/admin/gifts` | Create gifts | Admin |
| `GET /media/photos/*` | Deliver a stored photograph | Public |

Current field limits:

```text
message       required, maximum 1000 characters
name          optional, maximum 80 characters
location      optional, maximum 120 characters
language      one of en, ru, es, fr, pt, ar, zh, hi
consent       required and exactly "yes"
photo         optional JPEG/PNG/WebP, maximum 8 MB
request       maximum 10 MB when Content-Length is available
gift quantity integer from 1 to 50
```

Return JSON errors from API routes. Browser code must tolerate non-JSON responses and show a useful localized message rather than exposing a raw parsing exception.

---

## Authentication and security

Production admin security has two layers:

1. Cloudflare Access must protect `/admin*` and `/api/admin*`.
2. `functions/lib/admin.js` validates `Cf-Access-Authenticated-User-Email` against `ADMIN_EMAILS`.

Security rules:

- Allow only administrator emails in the Access policy.
- Keep `ADMIN_EMAILS` as a server-side runtime variable.
- Never set `LOCAL_ADMIN` in production or preview.
- Local bypass is allowed only with `LOCAL_ADMIN=true` on `localhost` or `127.0.0.1`.
- Keep `/api/traces` public; do not accidentally place it behind Access.
- Validate same-origin `Origin` for administrative mutations.
- Never expose Cloudflare credentials or other secrets in browser code.
- Do not use `GITHUB_TOKEN`; the current application does not require it.
- Validate all user-controlled fields server-side even when the browser validates them.
- Keep pending and rejected metadata private.
- Use Cloudflare rate limiting for `POST /api/traces` if spam becomes real.
- Do not add Turnstile prematurely.

If changing authentication or storage boundaries, describe the security impact explicitly in the final report.

---

## Environment and configuration

Runtime values:

```text
ADMIN_EMAILS       required in production, comma-separated email addresses
LOCAL_ADMIN        localhost only, never production
MEDIA_PUBLIC_URL   optional; defaults to /media on the current origin
```

R2 bindings are resources, not string environment variables.

The local `.dev.vars` file is private and ignored by Git. `.dev.vars.example` may contain safe examples only. Never commit real emails when they are sensitive, access tokens, account IDs, or secrets.

Cloudflare production and preview environments have separate variable and binding configuration. When a change relies on either environment, document which one must be updated.

---

## Local development

Use Node.js 22 or newer.

Static UI development:

```bash
npm install
npm run dev
```

This runs Astro on port 4321 and does not provide Pages Functions.

Full local application:

```bash
cp .dev.vars.example .dev.vars
npm run dev:full
```

This builds Astro and starts Wrangler Pages dev, normally on port 8788. Local R2 state is stored under `.wrangler/` and is separate from production.

When testing API, gift generation, moderation, or media, always use the Wrangler URL rather than the Astro dev URL.

Do not add generated `dist/`, `.astro/`, `.wrangler/`, `.dev.vars`, or uploaded data to Git.

---

## Coding rules

Prefer simple code:

```js
const trace = await loadTrace(id);
```

Avoid unnecessary abstractions:

```js
TraceRepositoryFactory
TraceStorageAdapter
TraceServiceManager
```

unless a demonstrated need makes them simpler than direct functions.

Additional rules:

- Keep functions small and explicit.
- Prefer native browser APIs and Astro capabilities.
- Use `async`/`await` consistently for storage and network operations.
- Validate at the server boundary.
- Return early on invalid input.
- Preserve existing response shapes unless all consumers are updated.
- Keep client selectors and `data-*` contracts stable when changing markup.
- Avoid inline duplication when one small helper already exists, but do not build generic frameworks.
- Preserve accessible labels, focus behavior, disabled states, and status announcements.
- Keep CSS global and small unless a component has a clear isolated need.
- Do not rewrite unrelated files.

Before adding a dependency, ask:

1. Can this be implemented reasonably with native JavaScript?
2. Does Astro already provide it?
3. Will the dependency materially reduce total complexity?
4. Is it compatible with Cloudflare Pages Functions?

If not, do not add it.

---

## Change workflow

For every implementation task:

1. Read this file and inspect the relevant existing code.
2. Check `git status` and preserve unrelated user changes.
3. Choose the smallest implementation that satisfies the request.
4. Keep changes within the requested scope.
5. Update all affected translations when public UI text changes.
6. Test static and runtime behavior in proportion to the change.
7. Run `npm run build` before completion.
8. Run `git diff --check`.
9. Fix errors introduced by the change.
10. Report changed files and verification results.
11. Mention configuration or deployment actions the user must perform.
12. Update `README.md` and this file when architecture, operations, routes, data formats, or invariants materially change.

For photo, form, or responsive UI changes, explicitly consider desktop, Android, and iPhone behavior.

For storage mutations, confirm the behavior for metadata and the associated photo, including failure paths.

For admin changes, test both authorized and unauthorized behavior.

---

## Verification checklist

Minimum check for documentation or static UI work:

```bash
npm run build
git diff --check
```

For full-stack changes, also verify with `npm run dev:full`:

- gift lookup;
- language selection and cookie persistence;
- submission with and without a photograph;
- pending visibility only in admin;
- approve and immediate public visibility;
- reject and photograph removal;
- delete and photograph removal;
- gift generation and immediate URL availability;
- unauthorized admin API response;
- public media delivery;
- mobile layout.

Do not claim production verification unless the production deployment was actually tested.

---

## Known trade-offs

- Public list endpoints scan R2 object prefixes. This is appropriate for the current small project.
- Public dynamic pages fetch data client-side to avoid rebuilds.
- There is no database index or search engine.
- There is no automatic translation of user content.
- There is no Turnstile challenge until spam justifies it.
- Admin UI is deliberately basic and English-only.
- Local R2 emulation is not synchronized with production.

Do not solve these trade-offs pre-emptively. Revisit them only when there is a measured problem or an explicit request.

---

## Scope discipline

When requirements are ambiguous, choose the simpler implementation that preserves existing behavior and data.

Do not expand the task into a redesign, migration, new framework, database, CMS, authentication provider, analytics system, or general platform unless explicitly requested.

The goal is not the most sophisticated system. The goal is the smallest reliable system that supports gifts, submissions, moderation, public stories, photographs, and multiple languages.
