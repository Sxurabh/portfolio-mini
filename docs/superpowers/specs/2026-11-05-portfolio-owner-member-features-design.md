# Portfolio owner & member features — design

Date: 2026-11-05
Status: approved

## Intent

The site is a personal portfolio. Today only the owner can sign in
(`ALLOWED_EMAILS` is enforced at user-create time), the "Download CV"
button points at a file that does not exist, and there is no way for a
visitor to reach the owner from inside the site.

This change opens the site to any Google or GitHub account so visitors
can leave the owner a message, adds an owner-only inbox for reading those
messages, and lets the owner upload or replace the CV that visitors
download. The owner flag becomes a permission, not a gate.

## Why now

The site already has working OAuth (Google, GitHub), a Postgres database
for Better Auth, and HeroUI installed. The remaining work is application
tables, a few routes, and UI — there is no new infrastructure to stand up.

## Goals

- Any Google or GitHub account can sign in; `ALLOWED_EMAILS` means
  "owner", not "may enter".
- Owner can upload or replace a PDF CV from the page; visitors download
  whatever is current.
- Signed-in non-owners can send the owner a message from a compose
  popup in the header.
- Owner can read messages in an inbox popup, with unread state and
  delete.
- Every new control is built with HeroUI (`@heroui/react` 3.0.0-beta.3).

## Non-goals

- No roles table, no admin console, no user management.
- No replies inside the app — the owner replies by email via `mailto:`.
- No email or push notifications for new messages.
- No message threading, attachments, search, or pagination UI beyond a
  newest-first list of the latest 50.
- No CV version history; one current CV row that gets replaced.
- No file storage service: the CV lives in Postgres.

## Anti-goals

- A UI-only permission model. Every mutating route re-checks ownership
  server-side.
- Rendering message content as HTML or markdown. Message bodies are
  plain text.
- A second database pool or a second auth path.
- Restyling the page around Radix or another component library.

## Constraints

- Next.js 16 route handlers cap request bodies at 4.5 MB, so the CV
  limit is **4 MB**, not 5 MB.
- Better Auth owns the `user` table; app tables reference it and cascade
  on delete.
- `pg` returns `bytea` as a `Buffer`; the CV route streams that buffer.
- The page already reads request headers for the session, so it is
  per-request dynamic; adding owner/CV lookups does not change that.
- HeroUI beta 3 has no file-input component; the CV picker wraps a hidden
  native `<input type="file">` in a HeroUI `Button`/label.
- `@heroui/styles` is already imported in `app/global.css`; no provider
  is required.

## Approaches considered

### Data storage

- **A. Postgres tables (chosen).** One `cv` row and a `message` table in
  the database already provisioned for auth. No new service, no token,
  transactional, and trivially backed up with the rest of the DB.
- **B. Vercel Blob for the CV + DB for messages.** Better for large
  files and CDN delivery, but adds a token, a store, and a second source
  of truth for a 4 MB PDF.
- **C. Filesystem / static file.** Can't survive deploys and isn't
  writable at runtime on Vercel.

### Role awareness

- **A. Server component computes `isOwner()` and passes it down
  (chosen).** One session lookup per request, no client round trip, no
  flash of owner controls. The page is already dynamic.
- **B. Client hook reads the session and compares email.** Duplicates
  the allowlist in the bundle and flashes the wrong header state.
- **C. Middleware injects a header.** Extra moving part for one boolean.

### Popup / UI kit

- **A. Radix.** Already a dependency, but explicitly ruled out by the
  owner for this work.
- **B. Hand-rolled.** Consistent with the current button classes, but
  re-implements focus trapping and dismissal.
- **C. HeroUI (chosen).** Already installed and styled; Modal, Button,
  TextField, TextArea, EmptyState, Chip, Spinner cover everything.

## Decisions

### Sign-in

- Remove the `databaseHooks.user.create.before` rejection from
  `lib/auth.ts`.
- Keep `allowedEmails` / `isAllowedEmail` as the owner predicate, used
  only by `isOwner()`.
- Update `/auth/error` copy: it currently tells non-owners they may not
  sign in.

### Schema

```sql
create table if not exists cv (
  id          integer primary key default 1 check (id = 1),
  filename    text not null,
  mime_type   text not null,
  byte_size   integer not null,
  data        bytea not null,
  updated_at  timestamptz not null default now()
);

create table if not exists message (
  id           bigserial primary key,
  user_id      text not null references "user"(id) on delete cascade,
  sender_name  text not null,
  sender_email text not null,
  subject      text not null,
  body         text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists message_created_at_idx on message (created_at desc);
create index if not exists message_unread_idx on message (id) where read_at is null;
```

`CV_ID = 1` is a constant; uploads upsert on that id.

### Routes

| Route | Auth | Behaviour |
|---|---|---|
| `GET /api/cv` | public | Streams `data` as `application/pdf`, 404 when empty. `?download=1` sets `Content-Disposition: attachment`. |
| `POST /api/cv` | owner | `multipart/form-data` field `file`; PDF magic bytes + MIME + 4 MB; upserts row. |
| `GET /api/messages` | owner | Latest 50, newest first, full body. |
| `POST /api/messages` | signed in | `{ subject, body }`; trims, validates lengths; snapshots sender name/email; 1 message per 60 s per user. |
| `PATCH /api/messages/:id` | owner | `{ read: boolean }` sets/clears `read_at`. |
| `DELETE /api/messages/:id` | owner | Deletes one message. |

All routes return JSON errors shaped `{ error: string }` with proper
status codes (400 validation, 401 signed out, 403 non-owner, 404 missing,
413 too large, 429 rate limited).

### UI

Header, right-hand cluster, left to right:

```
signed out:                          [G] [GH]
signed in (member):        [✉] [+]   [avatar] [→]
signed in (owner):         [✉ ③]     [avatar] [→]
```

- Inbox button: owner only, HeroUI `Button isIconOnly variant="tertiary"`,
  unread-count badge from the server.
- Compose button: signed-in non-owner only, same treatment.
- Existing provider and sign-out buttons migrate to HeroUI `Button`
  `isIconOnly` for visual consistency.
- CV row: "Download CV" links to `/api/cv` when a CV exists; owner gets
  an adjacent "Upload/Replace CV" button that opens a HeroUI `Modal` with
  a hidden native file input.
- Compose: HeroUI `Modal` + `TextField` + `TextArea` + `Button`,
  controlled with `useOverlayState`.
- Inbox: HeroUI `Modal size="lg" scroll="inside"`; newest first; unread
  dot; sender, subject, relative time; click to expand plain-text body;
  marks read on expand; per-row delete; HeroUI `EmptyState` when empty.
- After any mutation, `router.refresh()` so the page-level unread count
  and CV state catch up.

### Limits and validation

- Subject ≤ 120 chars, body ≤ 2000 chars, both trimmed and non-empty.
- 1 message per 60 seconds per user; 429 includes retry seconds.
- CV: PDF only, ≤ 4 MB, `%PDF-` magic bytes.
- Message bodies are rendered with `whitespace-pre-wrap`, never as HTML.

### Files

New:

- `lib/db.ts` — global `pg` pool + `query` helper.
- `lib/cv.ts` — `getCvMeta`, `getCvFile`, `saveCv`.
- `lib/messages.ts` — `listMessages`, `createMessage`,
  `setMessageRead`, `deleteMessage`, `countUnread`.
- `scripts/migrate-app.mjs` — idempotent schema creation.
- `app/api/cv/route.ts`
- `app/api/messages/route.ts`
- `app/api/messages/[id]/route.ts`
- `app/components/inbox-button.tsx`
- `app/components/compose-button.tsx`
- `app/components/cv-actions.tsx`

Changed:

- `lib/auth.ts` — drop the allowlist hook; import the shared pool.
- `lib/session.ts` — unchanged public API, recheck after `auth.ts` edit.
- `app/page.tsx` — async, fetch owner + CV state, pass to header/CV row.
- `app/components/auth-buttons.tsx` — accept `isOwner`, add buttons,
  migrate to HeroUI.
- `app/components/icons.tsx` — inbox, send, upload, trash.
- `app/auth/error/page.tsx` — copy.
- `package.json` — `db:migrate:app` script.

## Verification

- `npx tsc --noEmit` and `npm run build`.
- `GET /api/cv` → 404 before upload, `application/pdf` after.
- `POST /api/cv` without a session → 401; with a non-owner session → 403;
  with an owner session → 200 and a DB row.
- `POST /api/messages` signed out → 401; signed in → 201 and a row;
  immediate second post → 429.
- `GET /api/messages` as non-owner → 403; as owner → rows newest first.
- `PATCH`/`DELETE` as non-owner → 403.
- Sign in with a non-allowlisted account succeeds and the header shows
  compose but no inbox.
- Clean up probe rows afterwards.

## Left to the builder

- Exact HeroUI class tuning to match the existing surface tokens.
- Wording of success/error copy inside the modals.
- Whether to include a CV delete control (explicitly left out here).
- Relative-time formatting helper (no dependency; small inline function).
