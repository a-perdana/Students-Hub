# Students Hub — Architecture Reference

## What This App Is

Eduversal partner-school **student** portal. Audience: 12–18 year-old students in partner schools, primarily Grade 7–8 for the MVP pilot.

Single mission: **assessment delivery + growth tracking**. Not a Student Information System — there is no class roster management, no homework, no messaging, no announcements, no attendance, no grade book. Those belong to other systems (or other hubs).

Two assessment modes flow through this hub:

| Mode | Purpose | Frequency |
|---|---|---|
| **Chapter Tests** | "Did the student master this Cambridge unit?" — per-chapter mastery check, network-uniform, authored by HQ Subject Specialists | Per pacing-collection unit (≈8–12/year/subject) |
| **EASE Growth** | "How much has the student grown in Math/English/Science across the year?" — adaptive, cross-grade scale score | 3 windows/year (Fall / Winter / Spring) |

**Vanilla HTML/CSS/JS** (no React, no bundler). Pages load Firebase via CDN.

**Deployment:** Vercel (`dist/`). Domain target: `studentshub.eduversal.org`.

---

## Critical differences from CH / AH / TH

This hub is intentionally simpler — but the differences are easy to miss when copying patterns from the other three hubs. Read this list before changing anything.

| Concern | CH / AH / TH | **Students Hub** |
|---|---|---|
| User collection | `users/{uid}` | **`students/{uid}`** — separate collection. |
| Role field | `role_centralhub` / `role_academichub` / `role_teachershub` | **None.** Every active student has identical access. |
| Sub-roles | `ch_sub_roles[]` etc. | **None.** |
| Page-access | `page_access_config` + sub-role gating | **None.** All authenticated students see the same pages. |
| Domain whitelist | Hardcoded array in auth-guard | **Derived from `partner_schools.domain` at runtime.** |
| Login method | Google SSO + email/password fallback | **Google SSO only.** No password accounts. |
| Profile editor | Profile modal in navbar | **Read-only** (`/profile`). Even displayName is read-only — Google account is source of truth. |
| Cambridge crossref | `cambridge-crossref.js` build-injected | **NOT injected.** Students never see CTS chips. |
| Navbar | Multi-column dropdowns | **Single flat top bar.** 4 links: Dashboard / Tests / Growth / Profile. |
| Mobile drawer | Per-hub bespoke | **None — top bar is mobile-friendly as-is.** |
| Approval | `approval_status_*hub` | **`students/{uid}.status`** with values `needs_class` / `pending_approval` / `active` / `rejected` / `graduated`. |

If you find yourself reaching for `users/{uid}`, `role_*`, or `applyStaffBridge` — STOP. You are in the wrong hub or pattern.

---

## Shared Firebase Backend

**Project:** `centralhub-8727b` (shared with CH / AH / TH / Research Hub). Students Hub does NOT use a separate Firebase project — same Firestore, same Auth, same Storage. Data isolation is by COLLECTION, not by project.

**SDK:** Firebase modular v10.7.1 from CDN. NEVER use compat (`firebase.firestore()`).

**Config pattern:**
- `firebase-config.js` (gitignored) sets `window.ENV.*` for local dev
- `partials/firebase-env.html` is inlined at build time; provides a fallback that reads `__FIREBASE_*__` env-var placeholders
- `build.js` substitutes those placeholders from Vercel env vars and strips the local script tag

**Firestore rules:** maintained EXCLUSIVELY in `Central Hub/firestore.rules` (single source of truth for all 5 apps). NEVER create a `firestore.rules` here. Deploy from CH:
```bash
cd "Central Hub" && firebase deploy --only firestore:rules --project centralhub-8727b
```

For full schema + collection catalogue, see [`docs/FIRESTORE_SCHEMA.md`](../docs/FIRESTORE_SCHEMA.md) (§18 covers Students Hub-specific collections) and the root `CLAUDE.md`.

---

## Auth Flow

`auth-guard.js` is loaded as a module on every page. There is no email/password fallback — students must use Google SSO with their school account.

```
1. Hide body (display:none) to prevent flash
2. onAuthStateChanged
   ├─ no user
   │   ├─ on /login or /shared        → reveal page (signed-out OK)
   │   └─ otherwise                   → /login
   └─ user signed in
       ├─ derive emailLower
       ├─ query partner_schools where domain == emailDomain
       │   ├─ no match                → signOut + /login?error=invalid-domain
       │   ├─ 1 school                → schoolId pre-set
       │   └─ N schools (multi-school)→ schoolId left null (picker resolves)
       ├─ getDoc students/{uid}
       │   ├─ doesn't exist           → create with status='needs_class'
       │   └─ exists                  → touch lastLoginAt
       └─ status routing
           ├─ needs_class             → /class-picker (unless already there)
           ├─ pending_approval        → /waiting (unless already there)
           ├─ active                  → reveal page (bounce off auth pages)
           ├─ graduated               → signOut + /login?error=graduated
           └─ rejected                → signOut + /login?error=rejected
3. Reveal body + dispatch authReady event
```

**Globals after `authReady`:** `window.firebaseApp`, `window.auth`, `window.db`, `window.currentUser`, `window.studentProfile`. Plus helpers `window.signInWithGoogle()` and `window.signOutStudent()`.

**`authReady` event detail:** `{ signedIn: boolean, status?: string, schoolId?: string }`.

**`signed_out_OK` set** (auth-guard internal): `['/login', '/shared']`. These pages render even with no auth. The shared `/shared?token=…` route is for parents (no login needed).

---

## Status field on `students/{uid}`

```
needs_class      ← first-login state; user must finish /class-picker
pending_approval ← class picked, waiting for teacher to approve
active           ← can use the hub
rejected         ← teacher declined the join request (sign-out on next login)
graduated        ← end-of-year off-board (sign-out on next login)
```

Status transitions are written by:

| From → To | Where |
|---|---|
| `(absent)` → `needs_class` | Auth-guard auto-create on first login |
| `needs_class` → `pending_approval` | `class-picker.html` after user confirms class |
| `pending_approval` → `active` | TH `/test-session-launcher` (or future `/class-roster`) by class teacher |
| `pending_approval` → `rejected` | Same TH page — "this student isn't in my class" |
| `active` → `graduated` | AH `/student-roster` end-of-year batch action |

The `students/{uid}` rule (in `firestore.rules`) restricts who can flip these — students can self-write their own `classId/className/gradeLevel/schoolId/status` ONLY when transitioning from `needs_class` to `pending_approval`. Anything else (especially `active`) requires a teacher / admin write path.

---

## Domain whitelist — runtime derivation

There is no hardcoded list of allowed domains. Auth-guard queries `partner_schools where domain == <emailDomain>` at sign-in. Three outcomes:

| Domain match count | Behaviour |
|---|---|
| **0** | Rejected — `signOut + /login?error=invalid-domain` |
| **1** | `schoolId` auto-set on the new student doc |
| **N (>1)** | Multi-school domain (e.g. `semesta.sch.id` is shared by Semesta Gunung Pati + Semesta Jangli). `schoolId` left null. Class picker shows a school picker first, then class. |

This means **adding a new partner school to `partner_schools` automatically lets its students sign in** — no auth-guard code change needed. Conversely, deleting a `partner_schools` doc locks that school's students out on their next login.

---

## Class picker

Self-enrolment surface. After Google SSO + domain validation, first-time users land on `/class-picker`. Reads `partner_schools/{schoolId}/classes/{classId}` subcollection (already used by TH pacing pages) and shows only **Grade 7 and 8** classes for the MVP pilot.

**Allowed grades constant** lives inline in `class-picker.html`:
```js
const ALLOWED_GRADES = [7, 8];
```
Bump this when expanding the pilot to other grades.

**Trust-but-verify model:** the student's class pick lands them in `pending_approval`, not `active`. A teacher confirms in TH (`/test-session-launcher` or future `/class-roster`) — only then does the student get into the dashboard. This prevents accidental wrong-class enrolment from corrupting growth data.

---

## Pages & routes

| Source file | Route | Auth | Purpose |
|---|---|---|---|
| `index.html` | `/` | active | Dashboard — upcoming tests, recent results, growth summary |
| `login.html` | `/login` | none | Google SSO landing |
| `class-picker.html` | `/class-picker` | signed-in, status=`needs_class` | School + class self-enrol |
| `waiting.html` | `/waiting` | signed-in, status=`pending_approval` | Polls every 30s for approval |
| `tests.html` | `/tests` | active | Upcoming + past tests list |
| `test.html` | `/test?attemptId=…` | active | Active test taking surface (chapter or EASE) |
| `report.html` | `/report?attemptId=…` | active | Single-attempt result detail |
| `growth.html` | `/growth` | active | EASE growth journey (line chart per subject) |
| `profile.html` | `/profile` | active | Read-only profile + sign-out |
| `shared.html` | `/shared?token=…` | NONE | Parent share link landing — token-gated read of one attempt |

10 pages total. Resist the urge to add ödev / messaging / announcement pages — those break the hub's mission.

---

## Test-taking surface (`test.html`)

Special-cased layout — `<body class="test-mode">` strips the topbar and replaces it with a minimal header (title + countdown). Distractions removed:
- No navbar
- No dashboard chrome
- Single-question focus, large tap targets (mobile-first)
- Progress bar mor → cyan gradient

**Lockdown (light-touch only at MVP):**
- `document.visibilitychange` increments a `tabSwitches` counter persisted to the attempt doc
- `beforeunload` warning until submit (cleared by setting `window.__submitted = true`)

**Heavy-handed kiosk mode** (forced fullscreen, copy/paste disable, right-click block) is intentionally **deferred to Phase 2** — the MVP scaffolds this page but the real adaptive engine + chapter test renderer aren't wired yet.

---

## Firestore Collections (Students-Hub-touching)

| Collection | Purpose | Write |
|---|---|---|
| `students/{uid}` | Student profile (separate from `users/{uid}`). Fields: email, emailLower, displayName, photoURL, schoolId, school, classId, className, gradeLevel, status, createdAt, lastLoginAt, classPickedAt | self-create on first login (constrained); self-update during `needs_class → pending_approval` only; teachers/admin flip to `active`/`rejected`/`graduated` |
| `partner_schools/{schoolId}` | Read-only here. Used to validate the email domain. | central_admin (CH) |
| `partner_schools/{id}/classes/{classId}` | Read-only here. Class picker source. | TH teachers + central_admin |
| `chapter_tests/{testId}` (Phase 2) | Network-uniform chapter test definitions | CH coordinator (subject specialist) |
| `chapter_test_attempts/{attemptId}` (Phase 2) | Per-student attempt records | student write own; teacher + admin update |
| `ease_sessions/{sessionId}` (Phase 2) | Adaptive growth sessions | student own session only |
| `parent_share_tokens/{token}` (Phase 2) | Token-gated shared attempt reads | student create own; auto-expire |

Phase 2 collections are documented in `docs/FIRESTORE_SCHEMA.md §18` but not yet enforced in rules — the assessment engine ships in a later phase.

**Timestamp:** `createdAt` (serverTimestamp). NEVER `timestamp`.

---

## Build & Deployment

`node build.js` → `dist/`. What it does:
1. Reads source HTML files in `ROUTES` map (10 entries)
2. Inlines `partials/firebase-env.html` where `<!-- FIREBASE_ENV -->` appears
3. Substitutes `__FIREBASE_*__` placeholders from Vercel env vars
4. Strips the local-dev `<script src="firebase-config.js">` tag
5. Rewrites internal `.html` href → clean URLs via `LINK_REWRITES`
6. Writes `dist/<slug>/index.html` (or `dist/index.html` for `''` slug)
7. Copies `auth-guard.js`, `base.css`, `partials/` (minus `firebase-env.html`)

**Vercel env vars required:** `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`. NO mail-service vars (Students Hub doesn't send mail).

**Vercel project setup:**
- Domain: `studentshub.eduversal.org`
- `cleanUrls: true`, `trailingSlash: false`
- Same Firebase web app credentials as the other 3 hubs (same `appId` from the `centralhub-8727b` project's web-app entry — Firebase Auth needs `authDomain == centralhub-8727b.firebaseapp.com` for SSO to work seamlessly across hubs).

---

## Key Files

| File | Purpose |
|---|---|
| `auth-guard.js` | Google SSO + domain whitelist + students/{uid} auto-create + status routing |
| `build.js` | Vercel build — ROUTES map, link rewrites, partial inlining, asset copy |
| `base.css` | Shared design tokens + components. Brand: mor #6c5ce7, cyan #0891b2 |
| `partials/firebase-env.html` | Inlined window.ENV bootstrap with __FIREBASE_*__ placeholders |
| `partials/navbar.html` | 4-link top bar (Dashboard / Tests / Growth / Profile). Auto-highlights active route. |
| `firebase-config.js` / `.example.js` | Local dev config (gitignored) / template |
| `vercel.json` | Vercel config |
| `dist/` | Build output (not committed) |

---

## Important Conventions

- **Modular SDK v10 only.** Never compat (`firebase.firestore()`).
- **`createdAt` not `timestamp`.**
- **`students/{uid}`, NEVER `users/{uid}`** in this hub.
- **No role / sub-role / page-access in this hub.** If a future feature needs sub-role gating, that feature probably belongs in TH or AH.
- **Auth guard goes first** on every page (first `<script type="module">`).
- **Use `authReady`** — never call `window.db` before the event fires.
- **`firebase-config.js` BEFORE `auth-guard.js`** (auth-guard reads `window.ENV` at module load — same race-window incident as TH `design-system.html`).
- **Login redirects use clean URLs:** `/login`, NOT `/login.html`.
- **All UI text in English.** Match the other three hubs (no Turkish).
- **Dates use `en-GB` locale** (`toLocaleDateString('en-GB', ...)`). NEVER `id-ID`.
- **Profile is read-only.** Even `displayName` mirrors the Google account; do NOT add an inline edit form (past incident in AH 2026-05-05 where users self-promoted via inline edit).
- **Cambridge crossref runtime is NOT injected.** Build.js does not load `cambridge-crossref.js`. Students don't need CTS chip popovers.
- **No mail.** Students Hub never calls the mail-service. Parent share is token-based, not email.
- **`shared.html` skips the Auth-required path.** It is in the `SIGNED_OUT_OK` set in auth-guard. New parent-facing pages (if any) need the same flag.
- **Reserved Firestore doc IDs.** `__name__`-style (double-underscore start AND end) is reserved by Firestore. If you add an `_uncategorized_settings_`-style meta doc, use single underscores.

---

## Known scaffolding gaps (Phase 2 work)

The following are stubbed but not functional yet — calling them out so future-you doesn't think they're broken:

1. **`/test` page** is a scaffold. Real chapter test renderer + EASE adaptive engine are Phase 2.
2. **`/report`** shows "no attempt id" empty state — wire to `chapter_test_attempts/{attemptId}` once the data model lands.
3. **`/growth`** shows empty state — needs `ease_sessions` + `egas_growth` aggregator.
4. **`/shared`** is a placeholder — needs Cloud Function endpoint + `parent_share_tokens` collection.
5. **Class picker** filters to grade 7–8 hardcoded — relax via `ALLOWED_GRADES` const when pilot expands.
6. **No `/test-session-launcher` on TH yet** — class teachers can't approve `pending_approval` students from inside the system. MVP workflow needs this before pilot day-1. Manually editing `students/{uid}.status` in Firestore Console works as a stopgap.

When you start Phase 2, update this section as gaps close.
