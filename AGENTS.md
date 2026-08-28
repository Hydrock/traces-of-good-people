# Traces of Good People

## Project goal

Traces of Good People is a very small, low-maintenance website about people met while travelling.

Physical gifts, postcards, chocolate or other small items contain a QR code. Each QR code belongs to a specific numbered gift.

A person scans the QR code, opens the website, chooses a language, and can leave a short message and optionally attach a photo.

After moderation, the feedback becomes publicly visible on the website.

The project must remain extremely simple, cheap and easy to maintain.

---

## Core principles

1. Keep the architecture as simple as possible.
2. Do not introduce technologies unless they are necessary.
3. Prefer static generation.
4. Avoid databases.
5. Avoid a permanent backend server.
6. Avoid React or other frontend frameworks unless absolutely necessary.
7. Avoid TypeScript.
8. Use plain JavaScript.
9. Use minimal CSS.
10. Keep dependencies to a minimum.
11. Prefer readable code over abstractions.
12. Do not over-engineer for hypothetical future requirements.
13. The project should be understandable by opening the repository and reading a few files.

---

## Technology stack

Use:

* Astro
* JavaScript
* HTML
* CSS
* JSON
* GitHub
* Cloudflare Pages
* Cloudflare Workers where server-side functionality is required
* Cloudflare R2 for user photos

Do not use:

* TypeScript
* React
* Vue
* Svelte
* Redux
* Tailwind unless explicitly requested later
* PostgreSQL
* MySQL
* MongoDB
* ORM libraries
* Docker for the website
* a dedicated VPS backend

---

## Visual direction

The site should be very minimal.

Reference:
https://oleni.rent/

General visual style:

* black and white interface
* large typography
* strong use of whitespace
* almost no decorative UI
* beautiful user photographs should provide most of the visual interest
* photographs may remain in colour
* mobile-first
* no unnecessary animations
* no gradients
* no glassmorphism
* no large UI framework

Preferred base colours:

* black
* white
* very light grey

Use a simple modern sans-serif font.

Do not add visual complexity without a clear reason.

---

## Main user flow

A person receives a physical gift.

The gift has:

* a sequential public number, for example `TRACE #0047`
* a unique non-sequential QR code

Example QR destination:

`/t/K7M2Q`

The code in the URL must not simply be the public sequential number.

Example:

Public gift number:

`TRACE #0047`

Private URL code:

`K7M2Q`

---

## Feedback flow

When the QR page opens:

1. Show the project name.
2. Let the visitor choose a language.
3. Briefly explain the project.
4. Show the feedback form.

The form should allow:

* name or nickname, optional
* city/country, optional
* message
* photo, optional

Suggested prompts may include:

* Where are you from?
* Tell me something about yourself.
* What made you smile today?
* Tell me a random fact.
* What should a traveller see in your city?

Do not require excessive information.

---

## Privacy notice

Before submission, display a short warning.

Meaning:

Do not share sensitive or private information such as:

* home address
* phone number
* identification documents
* passwords
* financial information

Clearly explain that submitted text and photos may become publicly visible after moderation.

Require explicit consent before submission.

Do not intentionally collect unnecessary personal information.

Do not add:

* email field
* phone field
* exact GPS location
* surname field
* social network accounts

unless explicitly requested later.

---

## Languages

Initial language set:

* English
* Russian
* Spanish
* French
* Portuguese
* Arabic
* Chinese
* Hindi

English is the fallback language.

Keep translations in simple JSON files.

Example:

`src/i18n/en.json`

Do not introduce an i18n framework unless plain JSON becomes insufficient.

---

## Data model

Do not use a database.

Store gift metadata in JSON.

Example:

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

Prefer one JSON file per submitted trace instead of a single large JSON array.

Example:

```text
data/
  traces/
    2026-000001.json
    2026-000002.json
```

Example trace:

```json
{
  "id": "2026-000001",
  "gift": "K7M2Q",
  "name": "Amir",
  "location": "Lahore, Pakistan",
  "message": "Nice to meet you!",
  "photo": "https://media.example.com/2026-000001.webp",
  "language": "en",
  "status": "pending",
  "createdAt": "2026-08-28T12:00:00Z"
}
```

Supported statuses:

* pending
* approved
* rejected

Only approved traces may appear publicly.

---

## Images

Do not store uploaded user photos directly in the Git repository.

Use Cloudflare R2.

Before upload, images should be resized/compressed when practical.

Target approximately:

* maximum dimension around 1600–2000 px
* WebP preferred
* avoid storing unnecessary multi-megabyte originals

The JSON trace should contain only the final public image URL or object key.

---

## Public pages

Initial routes:

```text
/
```

Home page.

```text
/t/[code]
```

Gift landing page and feedback form.

```text
/people
```

Public gallery of approved traces.

```text
/people/[id]
```

Individual trace page.

```text
/about
```

Short explanation of the project.

---

## Admin

Admin functionality is part of version 1.

Initial routes:

```text
/admin
```

Moderation dashboard.

```text
/admin/gifts
```

Gift and QR generator.

The admin interface should remain extremely basic.

For pending traces show:

* gift number
* photo
* name
* location
* message
* submission date
* Approve
* Reject

Do not build a large CMS.

---

## Gift generator

The first version must include a generator for physical gift identifiers.

Each gift has:

* sequential public number
* random URL code
* QR code

Example:

```text
TRACE #0047
K7M2Q
```

The QR code should point to:

```text
https://DOMAIN/t/K7M2Q
```

The generator should support creating multiple gifts at once.

Example:

```text
Quantity: 10
```

Result:

```text
#0048  A8FK2
#0049  M9KQ7
#0050  PX7DA
```

QR codes should be downloadable.

Later, printable A4 sheets may be added, but this is not required for the initial implementation unless it is trivial.

---

## Moderation

Never publish submissions immediately.

Submission flow:

```text
visitor submits
↓
pending
↓
admin reviews
↓
approved or rejected
```

Only approved submissions appear on public pages.

---

## Security

Never expose GitHub tokens or Cloudflare secrets to browser JavaScript.

Any operation requiring secrets must happen server-side through a Cloudflare Worker or equivalent secure serverless environment.

Validate:

* gift code exists
* message size
* file size
* allowed file type
* request rate where practical

Consider Cloudflare Turnstile if spam becomes a problem.

Do not add it prematurely unless necessary.

---

## Suggested project structure

Keep this approximate and change it only when implementation requires it.

```text
src/
  components/
  layouts/
    Layout.astro
  pages/
    index.astro
    about.astro
    people/
      index.astro
      [id].astro
    t/
      [code].astro
    admin/
      index.astro
      gifts.astro
  i18n/
  styles/
    global.css

data/
  gifts/
  traces/

public/
```

Do not create empty abstractions or unused directories merely to match this structure.

---

## Implementation order

Implement sequentially.

### Phase 1 — static foundation

1. Create minimal Astro project.
2. Remove starter content.
3. Add global layout.
4. Add minimal global CSS.
5. Implement homepage.
6. Implement About page.

### Phase 2 — gifts

7. Define gift JSON format.
8. Add test gift data.
9. Implement `/t/[code]`.
10. Validate gift code.
11. Display public TRACE number.

### Phase 3 — feedback form

12. Implement language selector.
13. Add JSON translations.
14. Implement feedback form.
15. Add privacy notice and publication consent.
16. Add photo chooser/camera support.

### Phase 4 — storage

17. Implement secure submission endpoint.
18. Store trace metadata as JSON.
19. Store uploaded photos in R2.
20. New submissions must use `pending`.

### Phase 5 — public traces

21. Implement `/people`.
22. Show only approved traces.
23. Implement `/people/[id]`.
24. Make layouts work well on mobile.

### Phase 6 — admin

25. Implement minimal admin authentication.
26. Implement pending submissions list.
27. Add Approve.
28. Add Reject.

### Phase 7 — generator

29. Implement sequential gift numbering.
30. Generate random gift codes.
31. Generate QR codes.
32. Support generating multiple gifts.
33. Support QR download.

### Phase 8 — production

34. Configure Cloudflare Pages.
35. Configure Worker.
36. Configure R2.
37. Add production environment variables.
38. Verify mobile flow from QR scan to submission.
39. Deploy.

---

## Coding rules

Prefer simple code.

Good:

```js
const trace = await loadTrace(id);
```

Avoid unnecessary abstractions such as:

```js
TraceRepositoryFactory
TraceStorageAdapter
TraceServiceManager
```

unless there is an actual need.

Keep functions small and explicit.

Prefer native browser APIs.

Prefer Astro capabilities before adding npm packages.

Before adding any dependency, ask:

1. Can this be implemented reasonably with native JavaScript?
2. Does Astro already provide it?
3. Will this dependency meaningfully reduce complexity?

If not, do not add it.

---

## Working with Codex

When implementing a task:

1. Inspect the existing repository first.
2. Preserve the simplicity of the project.
3. Do not rewrite unrelated files.
4. Run the project after changes.
5. Run available checks/build commands.
6. Fix errors introduced by the change.
7. Report which files were changed.
8. Mention any architectural decision that materially changes this document.

When requirements are ambiguous, choose the simpler implementation.

Do not expand scope without being asked.

The priority is not building the most sophisticated system.

The priority is building the smallest reliable system that accomplishes the project goal.
