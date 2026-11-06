# Portfolio owner & member features — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CV upload/replace for the owner, open sign-in to any Google/GitHub account, a header inbox button (owner), a header compose button (signed-in members), and an inbox popup for reading messages — all with HeroUI.

**Architecture:** Postgres (`pg`) app tables (`cv`, `message`) alongside Better Auth's tables, accessed through a single shared pool in `lib/db.ts`. Server component `app/page.tsx` computes `isOwner()` + CV/unread state per request and passes it down. Six Next.js route handlers (`/api/cv`, `/api/messages`, `/api/messages/[id]`) enforce ownership server-side. New header controls are HeroUI `Button isIconOnly` plus HeroUI `Modal` popups controlled by `useOverlayState()`.

**Tech Stack:** Next.js 16.1.1 (App Router, route handlers), Better Auth 1.7.17, `pg` 8.23.1, `@heroui/react` 3.0.0-beta.3, React 19.2.3, TypeScript 5.9.3, Node 26 (type-stripped `.ts` tests via `node --test`).

**Spec:** `docs/superpowers/specs/2026-11-05-portfolio-owner-member-features-design.md`

## Global Constraints

- CV limit is **4 MB** (Next route-handler body cap is 4.5 MB), PDF only, `%PDF-` magic bytes required.
- `ALLOWED_EMAILS` is the owner flag only; sign-in is open to any Google/GitHub account.
- Every mutating route re-checks `isOwner()` server-side regardless of UI visibility.
- Message bodies rendered as plain text (`whitespace-pre-wrap`), never HTML.
- Compose: subject ≤ 120 chars, body ≤ 2000 chars, 1 message per 60 s per user.
- HeroUI for all new UI; no Radix.
- Tests use `node --test` (type-stripped `.ts`) + route probes against the dev server; no new test framework.

## Review Focus

| # | Input / condition | Expected behavior | Task |
|---|-------------------|-------------------|------|
| 1 | `GET /api/cv` with no CV row | 404 | 5 |
| 2 | `GET /api/cv` with `?download=1` | `Content-Disposition: attachment`; otherwise `inline` | 5 |
| 3 | `POST /api/cv` signed out | 401 | 5 |
| 4 | `POST /api/cv` non-owner session | 403 | 5 |
| 5 | `POST /api/cv` non-PDF or >4 MB | 400 / 413 | 5 |
| 6 | `POST /api/messages` signed out | 401 | 6 |
| 7 | `POST /api/messages` subject/body empty or over limits | 400 | 6 |
| 8 | Second `POST /api/messages` from same user within 60 s | 429 with retry seconds | 6 |
| 9 | `GET /api/messages` or `PATCH/DELETE` as non-owner | 403 | 6, 7 |
|10 | Message body containing `<script>` | Rendered as escaped text, not executed | 11 |

---

### Task 1: Shared DB pool + migration script

**Files:**
- Create: `lib/db.ts`
- Create: `scripts/migrate-app.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: none.
- Produces: `lib/db.ts` exports `pool` (a `pg.Pool` singleton) and `query<T>(sql, params?) => Promise<T[]>`.

- [ ] **Step 1:** Write failing test `lib/db.test.ts`: `query("select 1 as ok")` returns `[{ ok: 1 }]`.
- [ ] **Step 2:** Run `node --test lib/db.test.ts`; expect FAIL (module not found / no export).
- [ ] **Step 3:** Implement `lib/db.ts` — globalThis-guarded `Pool` from `DATABASE_URL` plus `query` helper.
- [ ] **Step 4:** Run `node --test lib/db.test.ts`; expect PASS.
- [ ] **Step 5:** Implement `scripts/migrate-app.mjs` — idempotent `CREATE TABLE IF NOT EXISTS cv` and `message` with the spec's indexes.
- [ ] **Step 6:** Run `node scripts/migrate-app.mjs`; expect success; verify `information_schema.tables` lists `cv`, `message`.
- [ ] **Step 7:** Add `db:migrate:app` script to `package.json`; run `npm run db:migrate:app`.
- [ ] **Step 8:** Commit.

---

### Task 2: Drop the sign-in allowlist hook; share the pool

**Files:**
- Modify: `lib/auth.ts`

**Interfaces:**
- Consumes: `lib/db.ts` `pool`.
- Produces: `auth` config no longer has `databaseHooks.user.create.before`; `isAllowedEmail` kept for owner predicate.

- [ ] **Step 1:** Write failing test (server-level, via `npx tsc --noEmit`): `lib/auth.ts` imports `pool` from `./db` and has no `databaseHooks` key.
- [ ] **Step 2:** Run `npx tsc --noEmit`; expect compile error until edit applied.
- [ ] **Step 3:** Edit `lib/auth.ts`: import `pool` from `./db`, pass `database: pool`, delete the `databaseHooks` block, keep `account.accountLinking` and `trustedProviders`.
- [ ] **Step 4:** Run `npx tsc --noEmit`; expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 3: CV read/write helpers

**Files:**
- Create: `lib/cv.ts`

**Interfaces:**
- Consumes: `lib/db.ts` `query`.
- Produces:
  - `getCvMeta(): Promise<{ id, filename, mimeType, byteSize, updatedAt } | null>`
  - `getCvFile(): Promise<{ data: Buffer, mimeType, filename } | null>`
  - `saveCv({ filename, mimeType, byteSize, data }): Promise<void>` — upsert on `id = 1`.

- [ ] **Step 1:** Write failing test `lib/cv.test.ts`: `getCvMeta()` returns `null` before insert; after `saveCv(...)`, `getCvMeta()` returns the row and `getCvFile()` returns the Buffer.
- [ ] **Step 2:** Run `node --test lib/cv.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement `lib/cv.ts` per signatures.
- [ ] **Step 4:** Run `node --test lib/cv.test.ts`; expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 4: Message read/write helpers + rate limit

**Files:**
- Create: `lib/messages.ts`

**Interfaces:**
- Consumes: `lib/db.ts` `query`.
- Produces:
  - `listMessages(): Promise<Message[]>` — newest first, limit 50, full body.
  - `createMessage({ userId, senderName, senderEmail, subject, body }): Promise<Message>`
  - `setMessageRead(id, read): Promise<void>`
  - `deleteMessage(id): Promise<void>`
  - `countUnread(): Promise<number>`
  - In-memory per-user `Map<string, number>` timestamp gate for 60 s limit.

- [ ] **Step 1:** Write failing test `lib/messages.test.ts`: `createMessage(...)` then `listMessages()` returns it newest-first; `countUnread()` returns 1; `setMessageRead(id, true)` makes `countUnread()` return 0; immediate second `createMessage` from same user throws 429-like error.
- [ ] **Step 2:** Run `node --test lib/messages.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement `lib/messages.ts` per signatures.
- [ ] **Step 4:** Run `node --test lib/messages.test.ts`; expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 5: `GET`/`POST /api/cv`

**Files:**
- Create: `app/api/cv/route.ts`

**Interfaces:**
- Consumes: `lib/cv.ts`, `lib/session.ts` `isOwner()`.
- Produces: route handler; `GET` streams `data` as `application/pdf` (inline unless `?download=1`), 404 when none; `POST` owner-only, multipart `file`, `%PDF-` magic + MIME + ≤4 MB, upserts via `saveCv`.

- [ ] **Step 1:** Write failing route probe `scripts/probe-cv.sh`: GET 404 before upload; POST signed out → 401; POST non-owner → 403; POST owner with PDF → 200; GET → `application/pdf` + bytes; `?download=1` → attachment disposition; POST >4 MB → 413.
- [ ] **Step 2:** Run probes against dev server; expect failures until route exists.
- [ ] **Step 3:** Implement `app/api/cv/route.ts` (Next route handler, `request.formData()`, `Buffer.from(await file.arrayBuffer())`).
- [ ] **Step 4:** Run probes; expect all PASS.
- [ ] **Step 5:** Commit.

---

### Task 6: `GET`/`POST /api/messages`

**Files:**
- Create: `app/api/messages/route.ts`

**Interfaces:**
- Consumes: `lib/messages.ts`, `lib/session.ts` `getCurrentUser`, `isOwner()`.
- Produces: route handler; `GET` owner-only → latest 50 newest first; `POST` signed-in → validates subject/body, rate limit, snapshots sender, 201.

- [ ] **Step 1:** Write failing route probe `scripts/probe-messages.sh`: GET signed out → 401; GET non-owner → 403; GET owner → 200 array newest first; POST signed out → 401; POST signed in → 201 row; POST empty subject → 400; second POST within 60 s → 429.
- [ ] **Step 2:** Run probes; expect failures.
- [ ] **Step 3:** Implement `app/api/messages/route.ts`.
- [ ] **Step 4:** Run probes; expect all PASS.
- [ ] **Step 5:** Commit.

---

### Task 7: `PATCH`/`DELETE /api/messages/:id`

**Files:**
- Create: `app/api/messages/[id]/route.ts`

**Interfaces:**
- Consumes: `lib/messages.ts`, `lib/session.ts` `isOwner()`.
- Produces: route handler; `PATCH { read: boolean }` owner-only sets/clears `read_at`; `DELETE` owner-only removes row; 404 when missing, 403 when non-owner.

- [ ] **Step 1:** Write failing route probe `scripts/probe-message-id.sh`: PATCH/DELETE signed out → 401; non-owner → 403; missing id → 404; owner PATCH `read:true` then GET shows `read_at` set; owner DELETE removes row.
- [ ] **Step 2:** Run probes; expect failures.
- [ ] **Step 3:** Implement `app/api/messages/[id]/route.ts`.
- [ ] **Step 4:** Run probes; expect all PASS.
- [ ] **Step 5:** Commit.

---

### Task 8: New icons

**Files:**
- Modify: `app/components/icons.tsx`

**Interfaces:**
- Consumes: none.
- Produces: exported `InboxIcon`, `SendIcon`, `UploadIcon`, `TrashIcon` in existing SVG style (stroke `currentColor`, `1em` viewBox).

- [ ] **Step 1:** Add the four icons following the existing icon pattern.
- [ ] **Step 2:** Run `npx tsc --noEmit`; expect PASS.
- [ ] **Step 3:** Commit.

---

### Task 9: Header auth cluster → HeroUI + new buttons

**Files:**
- Modify: `app/components/auth-buttons.tsx`

**Interfaces:**
- Consumes: `isOwner` prop (boolean), `authClient`, `router`.
- Produces: `AuthButtons({ isOwner })` client component; signed-out shows Google/GitHub HeroUI `Button isIconOnly`; signed-in shows avatar + sign-out HeroUI button; owner additionally gets inbox button (with unread badge); signed-in non-owner gets compose button. Both new buttons sit left of the avatar/sign-out cluster.

- [ ] **Step 1:** Migrate existing provider/sign-out buttons to HeroUI `Button isIconOnly variant="tertiary" size="sm"`.
- [ ] **Step 2:** Add `isOwner` prop; render inbox/compose buttons conditionally left of avatar cluster.
- [ ] **Step 3:** Run `npx tsc --noEmit`; expect PASS.
- [ ] **Step 4:** Commit.

---

### Task 10: Inbox button + inbox popup

**Files:**
- Create: `app/components/inbox-button.tsx`

**Interfaces:**
- Consumes: `unreadCount` (number), `router`.
- Produces: `InboxButton({ unreadCount })` — HeroUI `Button isIconOnly` with `InboxIcon` + unread badge (`Chip` or text), opens HeroUI `Modal size="lg" scroll="inside"` controlled by `useOverlayState()`; lists messages newest first (fetches `/api/messages`), unread dot, sender/subject/time, click to mark read and expand plain-text body, per-row delete via `DELETE /api/messages/:id`, `EmptyState` when empty, `router.refresh()` after mutations.

- [ ] **Step 1:** Write failing component test (render + `npx tsc --noEmit`): component mounts, fetches messages, renders list; delete button calls `DELETE` route.
- [ ] **Step 2:** Run `npx tsc --noEmit`; expect PASS once file exists with correct types.
- [ ] **Step 3:** Implement `inbox-button.tsx`.
- [ ] **Step 4:** Run `npx tsc --noEmit`; expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 11: Compose button + compose popup

**Files:**
- Create: `app/components/compose-button.tsx`

**Interfaces:**
- Consumes: none (reads session via `authClient.useSession()`).
- Produces: `ComposeButton()` — HeroUI `Button isIconOnly` with `SendIcon`, opens HeroUI `Modal` with `TextField` (subject) + `TextArea` (body) + submit `Button`; validates locally, POSTs to `/api/messages`, shows inline error/success, closes on success; disabled while pending.

- [ ] **Step 1:** Implement `compose-button.tsx`.
- [ ] **Step 2:** Run `npx tsc --noEmit`; expect PASS.
- [ ] **Step 3:** Commit.

---

### Task 12: CV upload/replace actions

**Files:**
- Create: `app/components/cv-actions.tsx`

**Interfaces:**
- Consumes: `hasCv`, `isOwner`.
- Produces: `CvActions({ hasCv, isOwner })` — owner: HeroUI `Button` "Upload/Replace CV" opening a HeroUI `Modal` wrapping a hidden native `<input type="file" accept="application/pdf">`, POSTs to `/api/cv`, shows success; non-owner with CV: nothing extra; download link target decided by parent.

- [ ] **Step 1:** Implement `cv-actions.tsx`.
- [ ] **Step 2:** Run `npx tsc --noEmit`; expect PASS.
- [ ] **Step 3:** Commit.

---

### Task 13: Wire page — async owner/CV state

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `lib/session.ts` `isOwner()`, `lib/cv.ts` `getCvMeta()`, `lib/messages.ts` `countUnread()`.
- Produces: async Page; download CV → `/api/cv` when `hasCv` else "CV coming soon"; passes `isOwner`, `hasCv`, `unreadCount` to `AuthButtons`/`CvActions`.

- [ ] **Step 1:** Convert `Page` to async; fetch `isOwner()`, `getCvMeta()`, `countUnread()`.
- [ ] **Step 2:** Replace `/saurabh-kirve-cv.pdf` link with `/api/cv` when CV exists.
- [ ] **Step 3:** Pass state into `AuthButtons`, `InboxButton`, `ComposeButton`, `CvActions`.
- [ ] **Step 4:** Run `npx tsc --noEmit`; expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 14: Error-page copy + remaining copy

**Files:**
- Modify: `app/auth/error/page.tsx`

**Interfaces:**
- Consumes: none.
- Produces: updated copy reflecting open sign-in (remove "owner accounts only" line).

- [ ] **Step 1:** Edit copy.
- [ ] **Step 2:** Commit.

---

### Task 15: Verify end-to-end

**Files:**
- Test: `scripts/probe-cv.sh`, `scripts/probe-messages.sh`, `scripts/probe-message-id.sh`, `node --test lib/*.test.ts`

**Interfaces:** none.

- [ ] **Step 1:** Run `npx tsc --noEmit`; expect PASS.
- [ ] **Step 2:** Run `npm run build`; expect PASS.
- [ ] **Step 3:** Start dev server, run all three probe scripts; expect PASS.
- [ ] **Step 4:** Run `node --test lib/*.test.ts`; expect PASS.
- [ ] **Step 5:** Manual browser check: sign in with non-owner account → header shows compose, no inbox; sign in as owner → header shows inbox with badge; compose a message; open inbox; mark read; delete.
- [ ] **Step 6:** Clean up probe rows from `cv` and `message` tables.
- [ ] **Step 7:** Commit.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-05-portfolio-owner-member-features.md`.

Which execution approach would you prefer?

- **Subagent-driven** — a fresh subagent implements each task and a fresh reviewer checks it before the next starts, then a whole-branch review at the end. Most thorough; fresh context per task and per review.
- **Native** — I implement every task myself in this session, then one fresh reviewer checks the whole branch. Cheapest and fastest; no independent review until the end.

I recommend **Native**, because the 15 tasks are small and tightly coupled through shared `lib/db.ts`/`lib/cv.ts`/`lib/messages.ts` interfaces, and a shipped mistake costs one round trip to fix rather than re-dispatching. Does the plan capture what you want, and which approach should we use?
