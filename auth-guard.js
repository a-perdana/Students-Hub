// auth-guard.js — Students Hub
// ─────────────────────────────────────────────────────────────────
// Authenticates students via Google SSO, validates the email domain
// against partner_schools.domain, then bridges the auth user onto a
// students/{uid} doc.
//
// CRITICAL DIFFERENCES from CH/AH/TH auth-guard:
//
// 1. NO `users/{uid}` doc.  Student profiles live in students/{uid}.
//    Auth-guard NEVER reads or writes users/{uid} — that collection
//    is exclusively for staff/HQ across the other 3 hubs.
//
// 2. NO role / sub-role fields.  Every authenticated student has the
//    same access; there is no `role_studentshub`, no sub-roles, no
//    page-access gating.  All student-facing pages are open to every
//    active student.
//
// 3. NO `applyStaffBridge()`.  Students aren't in `staff/`.  We use
//    a simpler "self-enrol via class picker" flow instead.
//
// 4. Domain whitelist is DERIVED from `partner_schools.domain`, not
//    hardcoded.  `@fatih.sch.id` matches partner_schools where
//    `domain == 'fatih.sch.id'` and stamps schoolId on the student.
//    Multi-school domains (e.g. semesta.sch.id used by 2 schools)
//    leave schoolId null and the user picks the school in
//    /class-picker.
//
// 5. status flow:
//    - First login (no doc)         → /class-picker (pick class)
//    - status='pending_approval'    → /waiting (teacher approves)
//    - status='active'              → dashboard
//    - status='graduated' / 'rejected' → /login?error=...  (signed out)
//
// Helper is NOT shared with the other hubs.  Don't paste this into
// the staff-bridge helpers.
// ─────────────────────────────────────────────────────────────────

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp,
  collection, query, where, getDocs, limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ─── Hide body until auth completes ───────────────────────────────
document.body.style.display = 'none';

// ─── Init Firebase ────────────────────────────────────────────────
// Defensive: surface a clear error if window.ENV didn't load. Possible causes:
//   1. partials/firebase-env.html wasn't inlined (build pipeline broken)
//   2. Vercel env vars not set (FIREBASE_API_KEY empty string)
//   3. firebase-config.js missing locally (gitignored — copy from sibling hub)
if (!window.ENV || !window.ENV.FIREBASE_API_KEY) {
  document.body.style.display = '';
  document.body.innerHTML =
    '<div style="font-family:DM Sans,system-ui,sans-serif; max-width:520px; margin:80px auto; padding:24px; border:1px solid #fecaca; background:#fef2f2; color:#991b1b; border-radius:12px;">'
    + '<h2 style="margin:0 0 8px;font-family:Lora,serif;">Configuration error</h2>'
    + '<p style="margin:0 0 12px;line-height:1.5;">Firebase config is missing. If you are the deployer, set Vercel env vars (FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID) and redeploy.</p>'
    + '<p style="margin:0;font-size:.85rem;color:#7f1d1d;">For local dev: copy <code>firebase-config.example.js</code> to <code>firebase-config.js</code> with real values from the sibling Hub.</p>'
    + '</div>';
  throw new Error('window.ENV.FIREBASE_API_KEY is not set — see banner.');
}
const cfg = {
  apiKey:            window.ENV.FIREBASE_API_KEY,
  authDomain:        window.ENV.FIREBASE_AUTH_DOMAIN,
  projectId:         window.ENV.FIREBASE_PROJECT_ID,
  storageBucket:     window.ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window.ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId:             window.ENV.FIREBASE_APP_ID,
};
const app  = getApps().length ? getApps()[0] : initializeApp(cfg);
const auth = getAuth(app);
const db   = getFirestore(app);

window.firebaseApp = app;
window.auth        = auth;
window.db          = db;

// ─── Public helpers (used by login.html, class-picker.html, etc.) ─
window.signInWithGoogle = async function () {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
};
window.signOutStudent = async function () {
  await signOut(auth);
  window.location.href = '/login';
};

// ─── Stage theme helper ──────────────────────────────────────────
// Maps gradeLevel to a stage band — sets body[data-stage] so base.css
// can recolour the whole hub per grade. Used by every page; safe to
// call with null/undefined (defaults to 'igcse').
//   Grade 7-8   → checkpoint (emerald + amber)
//   Grade 9-10  → igcse      (mor + cyan — brand default)
//   Grade 11-12 → alevel     (navy + crimson)
window.stageForGrade = function (gradeLevel) {
  const g = Number(gradeLevel);
  if (g >= 7  && g <= 8)  return 'checkpoint';
  if (g >= 9  && g <= 10) return 'igcse';
  if (g >= 11 && g <= 12) return 'alevel';
  return 'igcse';
};
window.applyStageTheme = function (gradeLevel) {
  const stage = window.stageForGrade(gradeLevel);
  document.body.setAttribute('data-stage', stage);
  return stage;
};

// ─── Avatar URL (DiceBear — cosmetic) ────────────────────────────
// Deterministic avatar keyed off uid (or per-student override via
// students/{uid}.avatarSeed + avatarStyle, set on the /avatar page).
// NEVER pulls from photoURL (Google profile picture stays internal).
// Cosmetic only — never feeds assessment. Same (style, seed) →
// same avatar across every render surface.
//
// Default style: bottts (robot, CC0, no human likeness — safest
// floor for a school setting with parent visibility). Students can
// switch to adventurer / lorelei / notionists / shapes / fun-emoji
// via /avatar; the rule envelope in students/{uid} pins the allow
// list to those 6 styles.
//
// Opts:
//   uid:    auth uid (required) — also identifies "self" vs "peer":
//           if uid === currentUser.uid, falls back to the current
//           profile's avatarStyle/avatarSeed; otherwise peer renders
//           with default style + seed=uid (we don't have their
//           preferences loaded, and leaking the current user's
//           style/seed onto peer rows is a visible bug).
//   size:   pixel size (default 96)
//   style:  explicit override; takes precedence over profile fallback
//   seed:   explicit override; same precedence
//
// To render peer avatars with their actual preferences, the calling
// page must fetch students/{peerUid}.avatarStyle/avatarSeed itself
// (cost: N reads for N rows) and pass them via opts. The dashboard
// leaderboard preview, /leaderboard, /daily-challenge class board do
// NOT do this today — they accept the default bottts(seed=uid) for
// peer rows, which is still deterministic + on-brand.
const AVATAR_STYLE_ALLOWLIST = new Set([
  'bottts', 'adventurer', 'lorelei', 'notionists', 'shapes', 'fun-emoji'
]);
window.studentAvatarUrl = function (uid, opts) {
  if (!uid) return '';
  const o = opts || {};
  const size = o.size || 96;
  const selfUid = window.currentUser && window.currentUser.uid;
  const isSelf  = uid === selfUid;
  const profile = isSelf ? (window.studentProfile || {}) : {};
  // Style precedence: explicit opts → profile (self only) → bottts default.
  let style = o.style || profile.avatarStyle || 'bottts';
  if (!AVATAR_STYLE_ALLOWLIST.has(style)) style = 'bottts';
  // Seed precedence: explicit opts → profile seed (self only) → uid.
  const seed = o.seed || profile.avatarSeed || uid;
  // brand palette without the # — most DiceBear styles accept a CSV;
  // multiple values mean "pick one deterministically per seed".
  const bg = 'efedfb,ecfeff,fef3c7,d1fae5,fee2e2,e0e7ff';
  return 'https://api.dicebear.com/9.x/' + style + '/svg'
    + '?seed=' + encodeURIComponent(seed)
    + '&size=' + size
    + '&backgroundColor=' + bg
    + '&radius=50';
};

// ─── Bypass: pages that don't need a logged-in active student ────
const PATH       = window.location.pathname.replace(/\/$/, '') || '/';
// /login and /shared can render without an authed student.
// /class-picker and /waiting REQUIRE auth but tolerate non-active status.
// /ease-test is auth-required (active student); status-required path
// is enforced via the test runner's session-create rule.
const SIGNED_OUT_OK = new Set(['/login', '/shared']);

// ─── Resolve schoolId from email domain ───────────────────────────
async function resolveSchoolFromDomain(emailLower) {
  const at  = emailLower.indexOf('@');
  if (at < 0) return null;
  const dom = emailLower.slice(at + 1);
  const q   = await getDocs(query(
    collection(db, 'partner_schools'),
    where('domain', '==', dom),
    limit(2) // need to detect multi-school domains
  ));
  if (q.empty)        return { schools: [],   domain: dom };
  if (q.size === 1)   return { schools: [{ id: q.docs[0].id, ...q.docs[0].data() }], domain: dom };
  return { schools: q.docs.map(d => ({ id: d.id, ...d.data() })), domain: dom };
}

// ─── Main auth flow ───────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  // 1. Not signed in → /login (unless already on a signed-out-OK page)
  if (!user) {
    if (SIGNED_OUT_OK.has(PATH)) {
      document.body.style.display = '';
      window.dispatchEvent(new CustomEvent('authReady', { detail: { signedIn: false } }));
      return;
    }
    window.location.href = '/login';
    return;
  }

  // 2. Domain check — must be a partner school's domain
  const emailLower = (user.email || '').toLowerCase();
  if (!emailLower) {
    await signOut(auth);
    window.location.href = '/login?error=no-email';
    return;
  }

  const resolved = await resolveSchoolFromDomain(emailLower);
  if (!resolved || resolved.schools.length === 0) {
    await signOut(auth);
    window.location.href = '/login?error=invalid-domain';
    return;
  }

  // 3. Fetch / auto-create students/{uid}
  const studentRef = doc(db, 'students', user.uid);
  let snap = await getDoc(studentRef);
  let profile;

  if (!snap.exists()) {
    // First login — derive schoolId if single-school domain, else null
    const singleSchool = resolved.schools.length === 1 ? resolved.schools[0] : null;
    profile = {
      uid:           user.uid,
      email:         user.email,
      emailLower,
      displayName:   user.displayName || user.email.split('@')[0],
      photoURL:      user.photoURL || null,
      schoolId:      singleSchool ? singleSchool.id   : null,
      school:        singleSchool ? singleSchool.name : null,
      classId:       null,
      gradeLevel:    null,
      status:        'needs_class',  // → /class-picker
      createdAt:     serverTimestamp(),
      lastLoginAt:   serverTimestamp(),
    };
    await setDoc(studentRef, profile, { merge: true });
  } else {
    profile = snap.data();
    // touch lastLoginAt (best-effort, non-blocking)
    setDoc(studentRef, { lastLoginAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }

  window.currentUser     = user;
  window.studentProfile  = profile;

  // 4. Status routing
  const status = profile.status || 'needs_class';

  if (status === 'graduated') {
    await signOut(auth);
    window.location.href = '/login?error=graduated';
    return;
  }
  if (status === 'rejected') {
    await signOut(auth);
    window.location.href = '/login?error=rejected';
    return;
  }
  if (status === 'needs_class') {
    if (PATH !== '/class-picker') { window.location.href = '/class-picker'; return; }
  } else if (status === 'pending_approval') {
    if (PATH !== '/waiting') { window.location.href = '/waiting'; return; }
  } else if (status === 'active') {
    // signed-in active student landing on auth-flow page → bounce home
    if (PATH === '/login' || PATH === '/class-picker' || PATH === '/waiting') {
      window.location.href = '/';
      return;
    }
  } else {
    // unknown status — fail safe
    await signOut(auth);
    window.location.href = '/login?error=unknown-status';
    return;
  }

  // 5. Apply stage theme (recolours whole hub via base.css var swaps)
  const stage = window.applyStageTheme(profile.gradeLevel);

  // 6. Reveal page + emit authReady
  document.body.style.display = '';
  window.dispatchEvent(new CustomEvent('authReady', {
    detail: { signedIn: true, status, schoolId: profile.schoolId, gradeLevel: profile.gradeLevel || null, stage }
  }));
});
