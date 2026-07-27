# Self-Paced IGCSE Foundation — public IGCSE prep

Free, **public, no-sign-in** self-study programme for the Eduversal partner school
network. Deployed at `studentshub.eduversal.org/foundation/`.

Physics is live (30 lessons). Mathematics, Biology and Chemistry are announced on the
landing page as "Coming soon" and will slot into the same structure.

---

## Why this is NOT inside the authenticated Students Hub

Students Hub is Google SSO + `students/{uid}` + partner-school domain whitelist. Every
route except `/login` and `/shared` is gated by `auth-guard.js`.

Foundation is the opposite trust model — **anonymous, public, localStorage-only**. Rather
than punch a permanent unauthenticated hole in the SH auth model, these pages:

- never load `auth-guard.js`
- never load the Firebase SDK
- are **not** in `build.js` `ROUTES` (which would pull in the Firebase bootstrap)
- are copied verbatim into `dist/foundation/` by a dedicated block at the end of `build.js`

No student data ever leaves the browser, so there is no PDPA / child-data surface and
nothing to secure server-side. That is precisely what lets this ship publicly.

**Do not add these pages to `ROUTES`.** See the comment block in `Students Hub/build.js`.

---

## Files

| Kind | Files | Origin |
|---|---|---|
| **Lessons** | `*-standalone.html` (30) | Authored by the Eduversal physics teachers. Self-contained: CSS + JS inlined, embeds are absolute URLs. |
| **Hub pages** | `index.html`, `physics.html`, `topic-{3,4,5,6}.html` (6) | **Generated** — do not hand-edit. |
| **Tooling** | `_build-hub.js`, `_patch-lessons.js` | Not deployed (`build.js` skips `_`-prefixed files). |

---

## Regenerating after adding a lesson

The hub pages read the lesson files themselves — titles, descriptions, LO codes, quiz
counts and simulation counts are all extracted from the markup, never retyped.

```bash
cd "Students Hub/Foundation"
node _build-hub.js
```

Add a new `*-standalone.html` and re-run; it appears automatically in the right topic.
A **new topic** needs one entry in the `TOPICS` table in `_build-hub.js`. A **new
subject** needs one entry in `SUBJECTS` (set `status: 'live'` when its lessons land).

---

## Progress tracking

Shared with the lesson pages via `localStorage`, no server:

- **Key:** `eifp-physics-progress-v1`
- **Entry format:** `"<loCode>__<phase>"` → `"red" | "amber" | "green"`, phase ∈ `pre | post`

Each lesson asks the student to rate every learning objective **twice** — once before
studying (`pre`) and once after (`post`) — which is what makes the before/after
comparison table work. Hub pages read the same blob and prefer the `post` rating,
falling back to `pre`.

This is deliberately per-device and per-browser. Clearing browser data resets it. The
landing page and footer both say so plainly.

**Personalisation (accounts, cross-device sync, teacher visibility) is a later phase.**
When it lands, the natural path is to keep localStorage as the anonymous default and
sync it upward for signed-in students — not to gate the content behind a login.

---

## Content notes

- **Coverage is partial and stated honestly on `physics.html`.** Topics 3–6 (Waves,
  Electricity and magnetism, Nuclear physics, Space physics) are complete: 169 Cambridge
  learning objectives (104 Core + 65 Supplement), 389 questions, 58 simulations, 79
  videos. Topics 1–2 (Motion/forces/energy, Thermal physics) plus 3.2 Sound and 3.4
  Light are not yet written.
- **Consolidation worksheets are not published here.** They are derived from the
  Cambridge IGCSE™ Physics Coursebook (Sang, Follows & Tarpey) — fine to hand out in a
  classroom, **not ours to redistribute publicly**. `_patch-lessons.js` replaced the dead
  `downloads/*.pdf` links with a note pointing students to their teacher. Do not
  reintroduce those links on the public site; if Eduversal authors original worksheets,
  those can be published freely.
- **External embeds** (YouTube, PhET, Walter Fendt, astro.unl.edu, FarLabs, NASA) are
  third-party and can rot. Lesson pages already provide a "Video not loading?" fallback
  link for each embedded video.
