// build.js — Students Hub
// ─────────────────────────────────────────────────────────────────
// Mirrors the Teachers Hub build pattern: source HTML files at the
// repo root → dist/<slug>/index.html with clean URLs.
//
// What this build does:
//   1. Substitutes __FIREBASE_*__ placeholders from Vercel env vars
//   2. Strips the local-dev firebase-config.js script tag
//   3. Inlines partials/firebase-env.html where <!-- FIREBASE_ENV --> appears
//   4. Rewrites internal .html href → clean URLs
//   5. Writes auth-guard.js + base.css + partials/* into dist/
//
// Routes: see ROUTES below.  Source filenames are kept descriptive
// (login.html, class-picker.html etc.) and the build maps them to
// clean URLs.
// ─────────────────────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

const envVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

// Source filename → clean URL slug (relative to dist root)
const ROUTES = {
  'index.html':        '',              // /            → dashboard (auth required)
  'login.html':        'login',         // /login       → Google SSO landing
  'class-picker.html': 'class-picker',  // first-login class selection
  'waiting.html':      'waiting',       // pending teacher approval
  'tests.html':        'tests',         // upcoming + past tests
  'test.html':         'test',          // active test taking
  'report.html':       'report',        // single-attempt result
  'growth.html':       'growth',        // EASE growth journey
  'profile.html':      'profile',       // read-only profile + sign out
  'shared.html':       'shared',        // parent share link landing
  'ease-test.html':    'ease-test',     // EASE Growth adaptive runner
  'leaderboard.html':  'leaderboard',   // Mathletics-style 4-tab leaderboard
  'practice.html':       'practice',         // /practice         → picker page
  'practice-run.html':   'practice-run',     // /practice-run     → solo runner (also handles daily-challenge via ?challenge=)
  'daily-challenge.html':'daily-challenge',  // /daily-challenge  → today's 5-Q + class leaderboard
};

// Internal href rewrites — same pattern as TH/AH/CH builds.
const LINK_REWRITES = [
  [/href="index\.html"/g,        'href="/"'],
  [/href="login\.html"/g,        'href="/login"'],
  [/href="class-picker\.html"/g, 'href="/class-picker"'],
  [/href="waiting\.html"/g,      'href="/waiting"'],
  [/href="tests\.html"/g,        'href="/tests"'],
  [/href="test\.html(\?[^"]*)?"/g,   (m, q) => `href="/test${q || ''}"`],
  [/href="report\.html(\?[^"]*)?"/g, (m, q) => `href="/report${q || ''}"`],
  [/href="growth\.html"/g,       'href="/growth"'],
  [/href="profile\.html"/g,      'href="/profile"'],
  [/href="shared\.html(\?[^"]*)?"/g, (m, q) => `href="/shared${q || ''}"`],
  [/href="ease-test\.html(\?[^"]*)?"/g, (m, q) => `href="/ease-test${q || ''}"`],
  [/href="leaderboard\.html"/g, 'href="/leaderboard"'],
  [/href="practice\.html"/g,        'href="/practice"'],
  [/href="practice-run\.html(\?[^"]*)?"/g, (m, q) => `href="/practice-run${q || ''}"`],
  [/href="daily-challenge\.html"/g, 'href="/daily-challenge"'],
];

// Read partials/firebase-env.html once (injected via comment placeholder).
const firebaseEnvPartial = fs.readFileSync(
  path.join(__dirname, 'partials', 'firebase-env.html'), 'utf8'
);

function processFile(filename) {
  let html = fs.readFileSync(path.join(__dirname, filename), 'utf8');

  // 1. Inject firebase-env partial
  html = html.replace(/<!-- FIREBASE_ENV -->/g, firebaseEnvPartial);

  // 2. Substitute Firebase config placeholders from env
  envVars.forEach(name => {
    const value = process.env[name] || '';
    if (!value) console.warn(`Warning: ${name} env var not set`);
    html = html.replace(new RegExp(`__${name}__`, 'g'), value);
  });

  // 3. Strip local-dev firebase-config.js tag (production uses the
  //    injected window.ENV from firebase-env partial)
  html = html.replace(/<script src="firebase-config\.js"><\/script>\n?/g, '');

  // 4. Absolute paths so subdirectory pages resolve auth-guard / base.css / partials
  html = html.replace(/src="auth-guard\.js"/g,            'src="/auth-guard.js"');
  html = html.replace(/href="base\.css"/g,                'href="/base.css"');
  html = html.replace(/fetch\('partials\/navbar\.html'\)/g, "fetch('/partials/navbar.html')");

  // 5. Rewrite internal .html links → clean URLs
  LINK_REWRITES.forEach(([pat, repl]) => { html = html.replace(pat, repl); });

  // 6. Write to dist/<slug>/index.html (or dist/index.html for root)
  const slug = ROUTES[filename];
  let outPath;
  if (slug === '') {
    outPath = path.join(distDir, 'index.html');
  } else {
    const dir = path.join(distDir, slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    outPath = path.join(dir, 'index.html');
  }
  fs.writeFileSync(outPath, html);
  console.log(`Output: dist/${slug ? slug + '/' : ''}index.html  (/${slug})`);
}

Object.keys(ROUTES).forEach(processFile);

// Copy auth-guard.js to dist root
fs.copyFileSync(
  path.join(__dirname, 'auth-guard.js'),
  path.join(distDir, 'auth-guard.js')
);
console.log('Copied: dist/auth-guard.js');

// Copy base.css to dist root
fs.copyFileSync(
  path.join(__dirname, 'base.css'),
  path.join(distDir, 'base.css')
);
console.log('Copied: dist/base.css');

// Copy partials/ folder (skip firebase-env.html — already inlined)
const partialsSrc  = path.join(__dirname, 'partials');
const partialsDist = path.join(distDir, 'partials');
if (fs.existsSync(partialsSrc)) {
  if (!fs.existsSync(partialsDist)) fs.mkdirSync(partialsDist, { recursive: true });
  fs.readdirSync(partialsSrc).forEach(file => {
    if (file === 'firebase-env.html') return; // injected inline, no need to serve
    const srcFile  = path.join(partialsSrc, file);
    const destFile = path.join(partialsDist, file);
    if (file.endsWith('.html')) {
      let content = fs.readFileSync(srcFile, 'utf8');
      LINK_REWRITES.forEach(([pat, repl]) => { content = content.replace(pat, repl); });
      fs.writeFileSync(destFile, content);
    } else {
      fs.copyFileSync(srcFile, destFile);
    }
    console.log(`Copied: dist/partials/${file}`);
  });
}

console.log('Build completed successfully!');
