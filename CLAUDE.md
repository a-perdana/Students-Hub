# Students Hub — Architecture Reference

## What This App Is

Eduversal partner-school **student** portal. Audience: 12–18 year-old students in partner schools, primarily Grade 7–8 for the MVP pilot.

Single mission: **assessment delivery + growth tracking**. Not a Student Information System — there is no class roster management, no homework, no messaging, no announcements, no attendance, no grade book. Those belong to other systems (or other hubs).

Two assessment modes flow through this hub:

| Mode | Purpose | Frequency |
|---|---|---|
| **Chapter Tests** | "Did the student master this Cambridge unit?" — per-chapter mastery check, network-uniform, authored by HQ Subject Specialists | Per pacing-collection unit (≈8–12/year/subject) |
| **EASE Growth** | "How much has the student grown in Math/English/Science across the year?" — adaptive, cross-grade scale score | 3 windows/year (Term 1 / Term 2 / Term 3) |

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
       ├─ isObserverDomain = emailLower endsWith '@eduversal.org' ?
       │   ├─ YES — HQ Specialist fast-path (skip partner_schools query
       │   │   + class picker + waiting), self-create directly into
       │   │   status='active' + is_hq_observer=true + school='Eduversal HQ'
       │   └─ NO  — regular student path:
       │       query partner_schools where domain == emailDomain
       │       ├─ no match            → signOut + /login?error=invalid-domain
       │       ├─ 1 school            → schoolId pre-set
       │       └─ N schools           → schoolId left null (picker resolves)
       ├─ getDoc students/{uid}
       │   ├─ doesn't exist           → create with status (per fast-path above)
       │   └─ exists                  → touch lastLoginAt + back-fill
       │                                 is_hq_observer if eduversal.org
       └─ status routing
           ├─ needs_class             → /class-picker (unless already there)
           ├─ pending_approval        → /waiting (unless already there)
           ├─ active                  → reveal page (bounce off auth pages)
           ├─ graduated               → signOut + /login?error=graduated
           └─ rejected                → signOut + /login?error=rejected
3. Reveal body + dispatch authReady event
```

**HQ observer fast-path (2026-05-13):** `@eduversal.org` email domain is the only gate — no users/{uid} lookup, no sub-role join. The reasoning: only HQ Workspace accounts carry that domain, so domain match ⇒ trusted observer. Firestore rule mirrors the check on the server side via `request.auth.token.email.lower().matches('.*@eduversal\\.org$')` in the students self-create + back-fill update branches. Real students keep the unchanged needs_class → pending_approval flow. See root CLAUDE.md "HQ Observer Flag System" for the full system.

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
| `index.html` | `/` | active | Dashboard — upcoming chapter tests, recent results, EASE growth summary (open-window CTA + per-subject latest RIT + growth chip) |
| `login.html` | `/login` | none | Google SSO landing |
| `class-picker.html` | `/class-picker` | signed-in, status=`needs_class` | School + class self-enrol (filtered to `ALLOWED_GRADES = [7, 8]`) |
| `waiting.html` | `/waiting` | signed-in, status=`pending_approval` | Polls every 30s for approval |
| `tests.html` | `/tests` | active | Upcoming + past chapter tests list. Live `chapter_test_attempts` subscription. |
| `test.html` | `/test?attemptId=…` | active | **Chapter test runner** (Phase 1). Auto-grades MCQ/numeric/short. Tab-switch counter. Timer-based auto-submit. |
| `ease-test.html` | `/ease-test` (or `?sessionId=…`) | active | **EASE Growth adaptive runner** (Phase 2). Subject picker → Rasch-lite engine → RIT-equivalent submit. Resumable mid-window. |
| `report.html` | `/report?attemptId=…` | active | Single-chapter-attempt result detail + Share-with-parent token generator. |
| `growth.html` | `/growth` | active | EASE growth journey — per-subject SVG sparkline reading `ease_growth/{uid}_{subjectId}` aggregate. Open-window CTA. Phase 2. |
| `profile.html` | `/profile` | active | Read-only profile + sign-out |
| `shared.html` | `/shared?token=…` | NONE | Parent share link landing. Token-gated `get`; renders chapter attempt OR EASE session report based on which field the token doc carries. Phase 2. |
| `how-points-work.html` | `/how-points-work` | active | Student-facing gamification guide (formulas, level table, tier ladder, what we DON'T do panel). |

12 pages total. Resist the urge to add ödev / messaging / announcement pages — those break the hub's mission.

### HQ Observer Strip (2026-05-13) — all 3 runners

Shared helper `partials/observer-strip.js` renders an amber bug-report strip below the question card on `practice-run.html`, `test.html` and `ease-test.html`. The strip is **invisible to regular students** — `.obs-strip[hidden]` CSS rule + `is_hq_observer !== true` JS gate together keep the helper a no-op for non-observers. When observer mode is active:

- Item id + metadata visible (subject / topic / difficulty / type / sourceCode if present)
- Copy id button → clipboard
- Open-in-CH deeplink → bank-specific authoring page (`/practice-bank-admin`, `/question-bank`, `/ease-item-author`)
- Flag button → reason modal → write to `practice_question_flags` (status `'open'`)

Each runner installs the helper with its bank discriminator (`'practice_questions'` / `'chapter_test_items'` / `'ease_items'`) so flags carry the right `collection` field. CSS lives in `base.css` (`.obs-strip`, `.obs-modal-back`, `.obs-modal`) — shared, no duplication.

See root CLAUDE.md "HQ Observer Flag System" for the rule contract + CH triage queue end.

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

**Heavy-handed kiosk mode** (forced fullscreen, copy/paste disable, right-click block) is intentionally **deferred to Phase 3** — current implementation tab-switch counter is informational only.

### Chapter test runner (`test.html`)

Live and production-ready as of 2026-05-10. Loads a `chapter_test_attempts/{attemptId}` doc, fetches the parent `chapter_tests/{id}` definition + `items/` subcollection, walks the student through each item one at a time. Saves progress to the attempt doc on every change (debounced 500ms persist). Timer-based auto-submit when window closes. `rawScorePct + earnedMarks + passed` computed at submit; status flips `in_progress → scored` (no `flagged` path yet — short-text uses exact match).

### EASE adaptive runner (`ease-test.html`)

Live and production-ready as of 2026-05-10 — Phase 2. Distinct from `test.html` because it adapts in flight rather than walking a fixed item set.

- **Engine: Rasch-lite (client-side).** Item difficulty band → logit (`easy −1.2`, `medium 0`, `hard +1.2`). Theta updates per item via Bayesian-ish step: `theta += se * (isCorrect ? (1 - pCorrect) : -pCorrect)`. SE shrinks `0.92×` per item.
- **Stop conditions.** Hit `itemCountTarget` (default 25) OR `answered ≥ 10 AND SE < seStopThreshold` (default 0.4). Both come from the `ease_test_windows/{windowId}` doc.
- **Item selection.** `bank.filter(i => !usedItemIds.has(i.id))` then sort by `Math.abs(DIFF_LOGIT[i.difficulty] - theta)` ascending. Pick the closest to current theta.
- **No going back.** UI explicitly states "every answer changes what comes next; there's no going back" — adaptive integrity.
- **RIT-equivalent submit.** `200 + theta * 33` clamped to [100, 300]. Updates `ease_growth/{uid}_{subjectId}` aggregate with `growthVsPrev = clamped - lastWindow.ritScore`.
- **Resume.** If a session is `in_progress` for the same (student, window, subject), resume from `currentTheta` / `currentSE` / `itemsAnswered` and reload already-used itemIds from `ease_responses where sessionId == X`.

### Rendering imported items (both runners, 2026-05-11)

Items imported from latihan.id carry rich content in `stemHtml` + `optionsHtml[]` (HTML with inline `\(…\)` LaTeX, optional `<img>` to `latihan.id/storage/…`) alongside the plain `stem` + `options[]`. HQ-authored items only carry the plain fields.

- **Both runners load MathJax 3 (tex-svg)** lazily in `<head>`, with `inlineMath: [['\(', '\)']]` ONLY — never `$…$` (math word problems use `$` as literal currency / variable name `$a`, `$b`). Past incident 2026-05-11: registering `$…$` ate the run between two dollars as one matheified italic blob.
- **Stem render path** prefers `stemHtml` via `sanitiseQuestionHtml()` → `innerHTML`; falls back to plain `stem` via `textContent`. After paint, call `typesetMath()` on the stem + options containers so any inline math renders.
- **Option render path** prefers `optionsHtml[i]` per index via the same sanitiser; falls back to escaped `options[i]`.
- **Sanitiser** (allowlist: `P/SPAN/IMG/BR/STRONG/EM/B/I/U/UL/OL/LI/TABLE/TR/TD/TH/TBODY/THEAD/SUP/SUB/DIV`) — replaces non-allowed elements with their `textContent`. `<img>` keeps only `src/alt/width/height/loading` and only `https://` scheme. Relative `/storage/…` URLs from upstream are rebased to `https://latihan.id/storage/…`.

### Parent share

Student clicks "Generate share link" on `report.html` → writes `parent_share_tokens/{token}` (random URL-safe ≥24 chars) with `studentUid`, `attemptId` (or `sessionId`), `expiresAt: now + 30 days`, `createdAt`. Token IS the credential. Rule allows `get` by id (lint allow-listed under `PUBLIC_COLLECTIONS`); `list` blocked even for admin (Charter NN5 spirit). `/shared?token=X` resolves the token doc, then loads the chapter attempt OR EASE session and renders read-only.

Owner (student) can revoke by deleting the token doc — owner-delete path in rule.

---

## Firestore Collections (Students-Hub-touching)

| Collection | Purpose | Write |
|---|---|---|
| `students/{uid}` | Student profile (separate from `users/{uid}`). Fields: email, emailLower, displayName, photoURL, schoolId, school, classId, className, gradeLevel, status, **is_hq_observer** (HQ Observer Flag System, 2026-05-13), createdAt, lastLoginAt, classPickedAt | self-create on first login (real students pin `status:'needs_class'`; @eduversal.org domain fast-path pins `status:'active'` + `is_hq_observer:true`); self-update during `needs_class → pending_approval` only (real students), or login-touch back-fill of `is_hq_observer` for eduversal docs; teachers/admin flip to `active`/`rejected`/`graduated` |
| `practice_question_flags` | **HQ Observer Flag System (2026-05-13).** Mid-runner bug-report channel. Active observer students (`students/{uid}.is_hq_observer == true`) create rows with `status:'open'`; CH reviewers (`director` / `coordinator` / `central_admin`) triage from `/practice-bank-flags`. See root CLAUDE.md "HQ Observer Flag System". | observer-student create · CH reviewer read/update |
| `partner_schools/{schoolId}` | Read-only here. Used to validate the email domain. | central_admin (CH) |
| `partner_schools/{id}/classes/{classId}` | Read-only here. Class picker source. | TH teachers + central_admin |
| `chapter_tests/{testId}` (+ `items/`) | Read-only here. Loaded in `test.html` to render the question-by-question runner. Active students can `get` published tests (rule). | CH coordinator (subject specialist) |
| `chapter_test_attempts/{attemptId}` | **Created by TH `/test-session-launcher` writeBatch** at session schedule time, NOT by the student. Student self-update path: append `responses[]`, flip `status` to `submitted`/`scored`, write `rawScorePct` + `passed`. Once `submitted`/`scored`/`flagged`, immutable for student. | TH teacher (creates batch); student (own attempt update); teacher / admin (any field) |
| `ease_items/{itemId}` | Read by `ease-test.html` runner — fetches all items for chosen subject and the adaptive engine picks one at a time. Active students can read. | CH coordinator (CH `/ease-item-author`) |
| `ease_test_windows/{windowId}` | Read by `ease-test.html` (subject picker + stop conditions) and `growth.html` + dashboard CTA (open-window detection). | central_admin (CH `/ease-window-admin`) |
| `ease_sessions/{sessionId}` | Created on subject pick by the student themselves (rule pins `studentUid == auth.uid` + `schoolId == students/{uid}.schoolId`). Self-update while `in_progress`; immutable post-`submitted`. | active student (own session only) |
| `ease_responses/{responseId}` | Per-item adaptive trail row. Student appends own response while session is `in_progress`. **Immutable** after creation. | active student (own row append only) |
| `ease_growth/{uid}_{subjectId}` | Cross-window aggregate. Student writes own doc on submit (current MVP); Phase 3 Cloud Function will recompute server-side. | active student (own doc); admin/staff read |
| `parent_share_tokens/{token}` | Token-gated shared attempt reads. Token IS the credential (`get` allow-listed in lint `PUBLIC_COLLECTIONS`); `list:false` even for admin. Owner can revoke (delete). | active student creates own; owner-delete |

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
- **MathJax inline delimiter is `\(…\)` ONLY — never `$…$`.** Math word problems use literal `$` for currency / variable name. If MathJax sees `$…$`, it greedily eats the run between two dollar signs as math and drops the spaces. Both runners (`test.html` + `ease-test.html`) register only `\(…\)` and `\[…\]` / `$$…$$` (display). Past incident 2026-05-11.
- **Stem + options use `stemHtml` / `optionsHtml[i]` if present, else `stem` / `options[i]`.** Imported items ship rich HTML in the `*Html` fields; HQ-authored items only have plain text. Prefer rich source via `sanitiseQuestionHtml()` → `innerHTML`; never assume one or the other.
- **Reserved Firestore doc IDs.** `__name__`-style (double-underscore start AND end) is reserved by Firestore. If you add an `_uncategorized_settings_`-style meta doc, use single underscores.
- **`@eduversal.org` email gets the HQ observer fast-path.** Auth-guard skips `partner_schools` resolution + `/class-picker` + `/waiting` for these accounts, self-creates `students/{uid}` with `status:'active'` + `is_hq_observer:true`. Pre-existing eduversal docs get the flag back-filled on next sign-in. Don't add `users/{uid}` lookups in SH auth-guard to gate this further — domain alone is the trust signal (root CLAUDE.md #43). If you need finer-grained observer scoping in future, add a separate `observer_subjects[]` field on `students/{uid}` and have CH write it.
- **HTML `hidden` attribute is overridden by any explicit CSS `display: flex/grid`.** If you have a toggleable element with a non-`block` default display, add `.<class>[hidden] { display: none }` so the attribute selector wins on specificity. Past incident 2026-05-13: `.obs-strip` rendered for every student because `display:flex` beat the inline `hidden` attribute. Same pattern applies anywhere you have `<div class="… " hidden>` paired with a flex/grid base rule.
- **`authReady` is dispatched on `window`** in SH (`window.addEventListener('authReady', …)`). CH does the opposite (dispatches on `document`). When porting code between hubs always check the actual auth-guard dispatch target — silent listener-never-fires is the failure mode. See CH CLAUDE.md Common Mistake #13.

---

## Phase status (closed gaps)

Phase 1 / 1.5 / 2 are all SHIPPED as of 2026-05-10. Only Phase 3 work remains; the original "scaffolding gaps" list is closed:

- ~~`/test` page is a scaffold~~ → **Live** (chapter test runner with auto-grade + tab-switch counter + timer auto-submit).
- ~~`/report` shows empty state~~ → **Live** (score hero + per-question breakdown + Share-with-parent button).
- ~~`/growth` shows empty state~~ → **Live** (real per-subject SVG sparkline reading `ease_growth`).
- ~~`/shared` is a placeholder~~ → **Live** (`parent_share_tokens` get-by-id token landing for chapter or EASE attempts).
- ~~Class picker hardcoded to 7–8~~ → **Still hardcoded; intentional for pilot** — bump `ALLOWED_GRADES` const in `class-picker.html` when expanding.
- ~~No `/test-session-launcher` on TH~~ → **Live in TH** (`/test-session-launcher` + `/student-approvals`).

### Phase 3 backlog (deferred work)

- **Server-side EASE scoring + calibration.** Cloud Function trigger on `ease_responses` to recompute theta server-side (current implementation is client-side; trustable for pilot but not adversarial). Same Function will calibrate item logits/discrimination from accumulated response data, leaving `ease_items.difficulty` as a bootstrap and `ease_items.pilotPhase` flipping to `false`.
- **`chapter_mastery/{studentUid}_{subjectId}_{unitCode}` aggregate** + Cloud Function trigger on `chapter_test_attempts` write. Current TH `/class-assessment` heatmap computes from raw attempts — fine for one class but not for `/teaching-progress`-style cross-school dashboards. Once aggregates land, pacing dashboards can read mastery directly without re-scanning attempts.
- **Heavy-handed kiosk lockdown** — forced fullscreen, copy/paste disable, right-click block, exam-style network heartbeats. Current implementation is informational `tabSwitches` counter only.
- **Item exposure cap** — adaptive engine currently has no exposure ceiling, so a popular medium-difficulty item could dominate the bank. Phase 3 should track `seenCount` ratio and weight item selection accordingly.
- **Cross-window growth claims.** UI must label first 3 windows as "window-specific norm"; growth claims are reliable from window 4 only (item calibration unstable until then).
- **Parent persistent login.** Current parent flow is token-share-only. Phase 3 may add parent Auth (separate from student domain whitelist) + multi-child linking. Token-share keeps working in parallel.
- **`/teaching-progress` mastery integration.** TH pacing dashboards still read teacher self-report; once `chapter_mastery` aggregates ship, swap pacing data source to objective mastery.
- **Religion / PPKn / IPS coverage.** Old EASE handbook covered these; new EASE Growth = Math/English/Science only. Decision pending: (a) chapter tests cover them, OR (b) "EASE Achievement" parallel product, OR (c) drop from network assessment scope. Talk to directors.
