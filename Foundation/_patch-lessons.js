#!/usr/bin/env node
/* ==========================================================================
   Self-Paced IGCSE Foundation — lesson page patcher
   --------------------------------------------------------------------------
   Makes the 30 teacher-authored lesson pages safe and coherent for a PUBLIC
   audience, without touching any of their teaching content.

   Four changes, all idempotent (re-running changes nothing):

     1. Brand   "EIFP Physics Self-Study" / "Eduversal Foundation"
                → "Self-Paced IGCSE Foundation" (top bar + <title> suffix)

     2. Nav     Adds a "Physics" link beside "Topics" so a visitor who lands
                on a deep link can climb back up to the subject page.

     3. Worksheets — the consolidation assignment linked
                `downloads/worksheet-*.pdf`, which does not exist, and the
                description cited the Cambridge coursebook by chapter.
                Those worksheets are Cambridge University Press material:
                fine to reference in a school, NOT redistributable from a
                public site. The download button is replaced with an honest
                "ask your teacher" note. Nothing is silently linked to a
                dead file, and no third-party PDF is republished.

     4. Edunav  "Submit via Edunav" is an internal Eduversal SIS instruction
                and meaningless to a public learner — reworded.

   Run:  node _patch-lessons.js          (writes)
         node _patch-lessons.js --dry    (reports only)
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const DRY = process.argv.includes('--dry');

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('-standalone.html')).sort();

let changed = 0;
const report = [];

files.forEach((file) => {
  const p = path.join(DIR, file);
  const before = fs.readFileSync(p, 'utf8');
  let html = before;
  const hits = [];

  /* ---- 1. Brand ----
     Two historical names collapse to the current one. Listing both keeps
     this idempotent AND lets it fix a page from either earlier pass. */
  if (/EIFP Physics Self-Study|Eduversal Foundation/.test(html)) {
    html = html.replace(/EIFP Physics Self-Study|Eduversal Foundation/g,
                        'Self-Paced IGCSE Foundation');
    hits.push('brand');
  }

  /* ---- 2. Nav: add Physics link before Topics ---- */
  if (!html.includes('href="physics.html"')) {
    html = html.replace(
      /(<nav>\s*)(<a href="topic-\d\.html">Topics<\/a>)/,
      '$1<a href="physics.html">Physics</a>\n      $2'
    );
    if (html.includes('href="physics.html"')) hits.push('nav');
  }

  /* ---- 3. Worksheet download → honest note ---- */
  // Anchor on the dead PDF link so the match ends at the real closing </div>
  // of the download-card, not at the first nested one. `.dl-body` contains
  // sibling <div>s, so a lazy [\s\S]*?</div></div> overshoots/undershoots
  // depending on the page — matching through the anchor is unambiguous.
  const dlRe = /[ \t]*<div class="download-card">[\s\S]*?href="downloads\/[^"]*"[^>]*>[\s\S]*?<\/a>\s*<\/div>\s*\n?/;
  if (dlRe.test(html)) {
    const m = html.match(/<div class="dl-title">(.*?)<\/div>/);
    const wsTitle = m ? m[1] : 'Consolidation worksheet';
    html = html.replace(dlRe,
`    <div class="worksheet-note">
      <div class="ws-icon">📄</div>
      <div class="ws-body">
        <div class="ws-title">${wsTitle}</div>
        <p>This consolidation worksheet is based on the Cambridge IGCSE&trade; Physics
          Coursebook and is handed out by your teacher — we are not able to publish it
          here. <strong>If you are studying at an Eduversal partner school, ask your
          physics teacher for it.</strong> If you are studying on your own, the quizzes,
          flashcards and simulations above already cover the same objectives.</p>
      </div>
    </div>
`);
    hits.push('worksheet');
  }

  /* ---- 1b. Narrow-phone brand sizing ----
     "Self-Paced IGCSE Foundation" is longer than the old name and wrapped to
     two lines under ~520px, shoving the nav links out of line. Lesson pages
     carry their own inlined CSS, so the fix has to be injected here rather
     than inherited from the hub stylesheet. */
  if (html.includes('Self-Paced IGCSE Foundation') && !html.includes('/* brand-fit */')) {
    // Wrap the brand text in swappable spans (full name / short name).
    html = html.replace(
      /(<a class="brand" href="index\.html"><span class="dot"><\/span>)\s*Self-Paced IGCSE Foundation(<\/a>)/,
      '$1 <span class="brand-full">Self-Paced IGCSE Foundation</span>' +
      '<span class="brand-short">IGCSE Foundation</span>$2');

    html = html.replace(/(\n\.breadcrumb\s*\{)/,
`
/* brand-fit */
.brand .brand-short { display: none; }
@media (max-width: 560px) {
  .topbar { padding: 11px 0; }
  .brand { font-size: 0.95rem; gap: 7px; min-width: 0; white-space: nowrap; }
  .brand .brand-full { display: none; }
  .brand .brand-short { display: inline; }
  .topbar nav a { margin-left: 14px; font-size: 0.9rem; white-space: nowrap; }
}
@media (max-width: 360px) {
  .brand { font-size: 0.88rem; }
  .topbar nav a { margin-left: 11px; font-size: 0.85rem; }
}
$1`);
    if (html.includes('/* brand-fit */')) hits.push('brand-fit');
  }

  /* ---- 3b. Worksheet note styles (once per page) ---- */
  if (html.includes('class="worksheet-note"') && !html.includes('.worksheet-note{')) {
    html = html.replace(/(\n\.download-card)/,
`
.worksheet-note{display:flex;gap:16px;align-items:flex-start;border:1px solid var(--supp-border);
  background:#FFFDF6;border-radius:var(--radius-sm);padding:16px 18px}
.worksheet-note .ws-icon{font-size:1.6rem;line-height:1}
.worksheet-note .ws-title{font-weight:700;color:var(--navy-dark);margin-bottom:4px}
.worksheet-note p{margin:0;font-size:.92rem;color:#6A5320}
$1`);
    hits.push('ws-css');
  }

  /* ---- 4. Edunav wording ---- */
  if (html.includes('Edunav')) {
    html = html
      .replace(
        /A short worksheet to complete after finishing the steps above,\s*submitted\s*through Edunav for your teacher to check\./g,
        'A short worksheet to complete after finishing the steps above, for your teacher to check.'
      )
      .replace(
        /📌 <strong>Submit via Edunav:<\/strong>[\s\S]*?<\/p>/g,
        '📌 <strong>Working on your own?</strong> You do not need this worksheet to finish the ' +
        'lesson — rate yourself in step 8 above and check your before/after progress in step 11.</p>'
      );
    if (!html.includes('Edunav')) hits.push('edunav');
    else hits.push('edunav(partial)');
  }

  if (html !== before) {
    changed++;
    if (!DRY) fs.writeFileSync(p, html);
  }
  report.push(`${file.padEnd(50)} ${hits.length ? hits.join(', ') : '— no change'}`);
});

console.log(report.join('\n'));
console.log(`\n${DRY ? '[DRY] would change' : 'changed'} ${changed} / ${files.length} files`);
