#!/usr/bin/env node
/* ==========================================================================
   Eduversal Foundation — hub page generator
   --------------------------------------------------------------------------
   Reads every *-standalone.html lesson page in this folder, extracts its
   title / eyebrow / dek / LO codes straight from the markup, and writes:

     index.html      → programme landing page (all subjects)
     physics.html    → Physics subject page (all 4 topics, all lessons)
     topic-3.html    → Topic 3 · Waves
     topic-4.html    → Topic 4 · Electricity and magnetism
     topic-5.html    → Topic 5 · Nuclear physics
     topic-6.html    → Topic 6 · Space physics

   The lesson pages are the source of truth. Nothing here is retyped by
   hand — add a new lesson file and re-run `node _build-hub.js`.

   Progress badges read the SAME localStorage blob the lesson pages write
   (EIFP_STORAGE_KEY / "<lo>__pre" | "<lo>__post"), so the hub reflects real
   student self-assessment with no server and no login.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const STORAGE_KEY = 'eifp-physics-progress-v1';

/* ---------- Topic metadata (the only hand-authored table) ---------- */
const TOPICS = {
  '3': { num: '3', name: 'Waves',                     blurb: 'The wave model — how energy travels without matter travelling with it — then the whole electromagnetic family from radio to gamma.', icon: '〰️' },
  '4': { num: '4', name: 'Electricity and magnetism', blurb: 'From a balloon stuck to a wall to the national grid: charge, current, circuits, safety, magnetism and the machines they make possible.', icon: '⚡' },
  '5': { num: '5', name: 'Nuclear physics',           blurb: 'Inside the atom — the nucleus, isotopes, three kinds of radiation, decay equations, half-life and staying safe around it all.', icon: '⚛️' },
  '6': { num: '6', name: 'Space physics',             blurb: 'Out from the Earth\'s tilt to the Solar System, the life of stars, and the expanding Universe itself.', icon: '🪐' },
};

/* ---------- Subjects (Physics live; others announced) ---------- */
const SUBJECTS = [
  { id: 'physics',   name: 'Physics',   code: '0625', icon: '🔭', status: 'live',
    blurb: 'Waves, electricity and magnetism, nuclear and space physics — 30 guided lessons with quizzes, simulations and self-assessment.' },
  { id: 'maths',     name: 'Mathematics', code: '0580', icon: '📐', status: 'soon',
    blurb: 'Number, algebra, geometry, trigonometry, and probability and statistics. In preparation with our mathematics team.' },
  { id: 'biology',   name: 'Biology',   code: '0610', icon: '🧬', status: 'soon',
    blurb: 'Characteristics of living organisms, cells, transport, coordination, reproduction and ecology. In preparation.' },
  { id: 'chemistry', name: 'Chemistry', code: '0620', icon: '🧪', status: 'soon',
    blurb: 'States of matter, atoms and bonding, stoichiometry, reactions, the Periodic Table and organic chemistry. In preparation.' },
];

/* ---------- Helpers ---------- */
const decode = (s) => String(s || '')
  .replace(/&middot;/g, '·').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/&rsaquo;/g, '›').replace(/&lambda;/g, 'λ').replace(/&asymp;/g, '≈')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function grab(re, html) { const m = html.match(re); return m ? m[1] : ''; }

/* ---------- Read every lesson page ---------- */
function readLessons() {
  return fs.readdirSync(DIR)
    .filter((f) => f.endsWith('-standalone.html'))
    .map((file) => {
      const html = fs.readFileSync(path.join(DIR, file), 'utf8');

      // Strip the site-name suffix from "<code> <name> — <site>". Matches both
      // the original "— EIFP Physics Self-Study" and the rebranded
      // "— Eduversal Foundation" (see _patch-lessons.js), so the generator
      // keeps working whichever order the two scripts are run in.
      const rawTitle = grab(/<title>(.*?)<\/title>/s, html);
      const title    = decode(rawTitle.replace(/\s*—\s*(EIFP Physics Self-Study|Eduversal Foundation)\s*$/, ''));
      const eyebrow = decode(grab(/<span class="eyebrow">(.*?)<\/span>/s, html));
      const dek     = decode(grab(/<p class="dek">(.*?)<\/p>/s, html).replace(/<[^>]*>/g, ''));

      // "3.1 General properties of waves" → code 3.1, name "General properties…"
      const codeMatch = title.match(/^([\d.]+)\s+(.*)$/);
      const code = codeMatch ? codeMatch[1] : title;
      const name = codeMatch ? codeMatch[2] : title;

      const los = [...new Set(
        [...html.matchAll(/data-lo-code="([^"]+)"/g)].map((m) => m[1])
      )].sort((a, b) => {
        const na = parseInt(a.replace(/^.*-[CS]/, ''), 10);
        const nb = parseInt(b.replace(/^.*-[CS]/, ''), 10);
        return na - nb;
      });

      const core = los.filter((c) => /-C\d+$/.test(c)).length;
      const supp = los.filter((c) => /-S\d+$/.test(c)).length;

      // Coursebook chapter from the eyebrow, for ordering within a topic
      const chapter = decode(grab(/Chapter\s+(\d+)/, eyebrow)) || '0';

      return {
        file, title, eyebrow, dek, code, name, los, core, supp,
        topic: code.split('.')[0],
        chapter: parseInt(chapter, 10),
        quizzes: (html.match(/<div class="quiz-q"/g) || []).length,

        // Videos appear two ways: embedded <iframe> players and "Watch ↗"
        // link-out cards. Count distinct YouTube IDs across both so a video
        // that is embedded AND linked (the "not loading?" fallback) counts once.
        videos: [...new Set([
          ...[...html.matchAll(/youtube\.com\/embed\/([\w-]+)/g)].map((m) => m[1]),
          ...[...html.matchAll(/youtube\.com\/watch\?v=([\w-]+)/g)].map((m) => m[1]),
        ])].length,

        // Count .sim-card blocks, not iframes. Only lesson 14 embeds its PhET
        // sims inline (lazy, via data-src); every other lesson presents the
        // same thing as a "launch it" card linking out. Both are one
        // simulation to the student, so the card is the honest unit.
        sims: (html.match(/<div class="sim-card"/g) || []).length,
        cards: (html.match(/class="flash-card"/g) || []).length,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

/* ==========================================================================
   Shared chrome — matches the lesson pages' existing design language
   ========================================================================== */
const SHARED_CSS = `
:root{
  --navy:#1F4E5F; --navy-dark:#163A47; --teal:#2AA9A0; --teal-dark:#1F8880;
  --teal-light:#E6F5F3; --core-bg:#DCE9F0; --core-border:#B7D2E0;
  --supp-bg:#FDF1DC; --supp-border:#F0D9A6;
  --bg:#F6F9FA; --card-bg:#FFFFFF; --text:#1F2A30; --muted:#5B6B76;
  --border:#E1E8EB; --radius:12px; --radius-sm:8px;
  --shadow:0 1px 2px rgba(15,42,51,.06),0 4px 14px rgba(15,42,51,.06);
  --shadow-lg:0 2px 6px rgba(15,42,51,.08),0 14px 34px rgba(15,42,51,.10);
  --max-width:1080px;
  font-size:17px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);
  font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.6}
img{max-width:100%}
a{color:var(--teal-dark);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:var(--max-width);margin:0 auto;padding:0 20px}

/* ---------- Top bar ---------- */
.topbar{background:var(--navy);color:#fff;padding:14px 0;position:sticky;top:0;z-index:50;box-shadow:var(--shadow)}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:1.05rem;color:#fff}
.brand:hover{text-decoration:none;opacity:.9}
.brand .dot{width:10px;height:10px;border-radius:50%;background:var(--teal);display:inline-block}
.topbar nav a{color:#cfe3ea;margin-left:18px;font-size:.95rem}
.topbar nav a:hover{color:#fff}
.topbar nav a.active{color:#fff;font-weight:600}

/* ---------- Breadcrumb ---------- */
.breadcrumb{font-size:.88rem;color:var(--muted);margin:18px 0 4px}
.breadcrumb a{color:var(--muted)}
.breadcrumb a:hover{color:var(--teal-dark)}

/* ---------- Hero ---------- */
.hero{background:linear-gradient(135deg,var(--navy) 0%,var(--navy-dark) 55%,#0F2C36 100%);
  color:#fff;padding:56px 0 60px;position:relative;overflow:hidden}
.hero::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(900px 380px at 78% -8%,rgba(42,169,160,.30),transparent 62%)}
.hero .wrap{position:relative;z-index:1}
.hero .eyebrow{display:inline-block;font-size:.75rem;font-weight:700;letter-spacing:.06em;
  text-transform:uppercase;color:#9FE3DC;background:rgba(42,169,160,.16);
  border:1px solid rgba(42,169,160,.34);padding:5px 12px;border-radius:999px;margin-bottom:14px}
.hero h1{margin:6px 0 12px;font-size:2.3rem;line-height:1.2;letter-spacing:-.01em}
.hero .dek{color:#CFE3EA;font-size:1.08rem;max-width:660px;margin:0}
.hero-stats{display:flex;flex-wrap:wrap;gap:26px;margin-top:30px}
.hero-stat .n{font-size:1.7rem;font-weight:700;color:#fff;line-height:1.1}
.hero-stat .l{font-size:.8rem;color:#9FB9C4;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.hero-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.btn{display:inline-block;font-weight:600;font-size:.95rem;padding:12px 22px;border-radius:var(--radius-sm);border:1px solid transparent;cursor:pointer}
.btn-primary{background:var(--teal);color:#fff}
.btn-primary:hover{background:var(--teal-dark);text-decoration:none}
.btn-ghost{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.28)}
.btn-ghost:hover{background:rgba(255,255,255,.16);text-decoration:none}

/* ---------- Page header (inner pages) ---------- */
.page-header{padding:12px 0 22px}
.page-header .eyebrow{display:inline-block;font-size:.75rem;font-weight:700;letter-spacing:.04em;
  text-transform:uppercase;color:var(--teal-dark);background:var(--teal-light);
  padding:4px 10px;border-radius:999px;margin-bottom:10px}
.page-header h1{margin:4px 0 8px;font-size:1.85rem;color:var(--navy-dark)}
.page-header .dek{color:var(--muted);font-size:1.02rem;margin:0;max-width:720px}

/* ---------- Section heads ---------- */
.section-head{margin:44px 0 18px}
.section-head h2{margin:0 0 6px;font-size:1.35rem;color:var(--navy-dark)}
.section-head p{margin:0;color:var(--muted);font-size:.95rem}

/* ---------- Cards ---------- */
.card{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);
  padding:22px 24px;box-shadow:var(--shadow);margin-bottom:18px}

/* ---------- Subject grid ----------
   4 subjects: 4-up on wide, 2-up on mid, 1-up on phones. auto-fit alone
   left a lone card stranded on its own row at 1280px. */
.subject-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
@media(max-width:1000px){.subject-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.subject-grid{grid-template-columns:1fr}}
.subject-card{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);
  padding:24px;box-shadow:var(--shadow);display:flex;flex-direction:column;
  transition:transform .16s ease,box-shadow .16s ease;position:relative}
a.subject-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);text-decoration:none}
.subject-card.is-soon{opacity:.72;background:#FBFCFD}
.subject-icon{font-size:2rem;line-height:1;margin-bottom:12px}
.subject-card h3{margin:0 0 4px;font-size:1.2rem;color:var(--navy-dark)}
.subject-code{font-size:.78rem;color:var(--muted);font-weight:600;letter-spacing:.03em}
.subject-card p{color:var(--muted);font-size:.92rem;margin:10px 0 16px;flex:1}
/* Wraps to two lines at 4-up column width rather than squashing the pill. */
.subject-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.pill{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.04em;
  text-transform:uppercase;padding:4px 10px;border-radius:999px;white-space:nowrap}
.pill-live{background:var(--teal-light);color:var(--teal-dark);border:1px solid #BFE6E1}
.pill-soon{background:#F1F4F6;color:var(--muted);border:1px solid var(--border)}
.go{font-weight:600;font-size:.9rem;color:var(--teal-dark);white-space:nowrap}

/* ---------- Topic grid ----------
   4 topics: 2×2 on wide reads better than 3+1 stranded. */
.topic-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
@media(max-width:700px){.topic-grid{grid-template-columns:1fr}}
.topic-card{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);
  padding:22px 24px;box-shadow:var(--shadow);display:flex;flex-direction:column;
  transition:transform .16s ease,box-shadow .16s ease}
a.topic-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);text-decoration:none}
.topic-card .t-icon{font-size:1.7rem;line-height:1;margin-bottom:10px}
.topic-card h3{margin:0 0 6px;font-size:1.15rem;color:var(--navy-dark)}
.topic-card .t-num{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--teal-dark)}
.topic-card p{color:var(--muted);font-size:.92rem;margin:8px 0 16px;flex:1}
.topic-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.chip{display:inline-block;font-size:.76rem;font-weight:600;padding:3px 9px;border-radius:999px;
  background:#F1F4F6;color:var(--muted);border:1px solid var(--border)}
.chip-core{background:var(--core-bg);color:#1B4A60;border-color:var(--core-border)}
.chip-supp{background:var(--supp-bg);color:#8A6008;border-color:var(--supp-border)}

/* ---------- Lesson list ---------- */
.lesson-list{display:grid;gap:12px}
.lesson{display:flex;gap:16px;align-items:flex-start;background:var(--card-bg);
  border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;
  box-shadow:var(--shadow);transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease}
a.lesson:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg);border-color:#C9DCE4;text-decoration:none}
.lesson-code{flex:0 0 auto;min-width:52px;height:52px;border-radius:10px;background:var(--navy);
  color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.95rem;padding:0 8px}
.lesson-body{flex:1;min-width:0}
.lesson-body h4{margin:0 0 4px;font-size:1.05rem;color:var(--navy-dark)}
.lesson-body p{margin:0 0 10px;color:var(--muted);font-size:.9rem}
.lesson-meta{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.lesson-status{flex:0 0 auto;align-self:center;text-align:right;min-width:96px}
.rag-mini{display:inline-flex;gap:3px;margin-bottom:5px}
.rag-dot{width:9px;height:9px;border-radius:50%;background:#E3E9EC}
.rag-dot.green{background:#3FA45B}.rag-dot.amber{background:#E0A33E}.rag-dot.red{background:#D2544E}
.lesson-status .s-label{font-size:.74rem;color:var(--muted);display:block}

/* ---------- Progress summary ---------- */
.progress-band{background:linear-gradient(135deg,#EAF4F6 0%,#E6F5F3 100%);
  border:1px solid #CFE5E7;border-radius:var(--radius);padding:22px 24px;margin-bottom:8px}
.progress-band h3{margin:0 0 4px;font-size:1.08rem;color:var(--navy-dark)}
.progress-band p{margin:0;color:var(--muted);font-size:.9rem}
.pbar{height:10px;border-radius:999px;background:#fff;border:1px solid #D6E4E7;
  overflow:hidden;display:flex;margin:14px 0 10px}
.pseg{height:100%}
.pseg.green{background:#3FA45B}.pseg.amber{background:#E0A33E}.pseg.red{background:#D2544E}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:.82rem;color:var(--muted)}
.legend span{display:inline-flex;align-items:center;gap:6px}
.legend i{width:9px;height:9px;border-radius:50%;display:inline-block;font-style:normal}

/* ---------- Info / notice ---------- */
.notice{background:#FFFDF6;border:1px solid var(--supp-border);border-left:4px solid #E0A33E;
  border-radius:var(--radius-sm);padding:14px 18px;color:#6A5320;font-size:.9rem;margin:18px 0}
.notice strong{color:#4E3D12}

/* ---------- Steps ---------- */
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;margin-top:6px}
.step{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;box-shadow:var(--shadow)}
.step .n{width:28px;height:28px;border-radius:50%;background:var(--teal-light);color:var(--teal-dark);
  font-weight:700;font-size:.85rem;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
.step h4{margin:0 0 5px;font-size:1rem;color:var(--navy-dark)}
.step p{margin:0;color:var(--muted);font-size:.88rem}

/* ---------- Footer ---------- */
.site-footer{background:var(--navy-dark);color:#B8CED6;margin-top:56px;padding:36px 0 30px;font-size:.9rem}
.site-footer .wrap{display:flex;flex-wrap:wrap;gap:18px;justify-content:space-between;align-items:center}
.site-footer a{color:#9FE3DC}
.site-footer .fine{font-size:.82rem;color:#8AA6B0;margin-top:6px}

@media(max-width:640px){
  .hero{padding:40px 0 44px}
  .hero h1{font-size:1.75rem}
  .hero-stats{gap:18px}
  .lesson{flex-wrap:wrap}
  .lesson-status{text-align:left;min-width:0;width:100%}
}
`;

/* ---------- Progress script shared by hub pages ---------- */
const progressScript = (loMapJson) => `
/* Reads the SAME localStorage blob the lesson pages write. No server, no login. */
const EIFP_STORAGE_KEY=${JSON.stringify(STORAGE_KEY)};
const EIFP_LO_MAP=${loMapJson};
function eifpLoad(){try{const r=localStorage.getItem(EIFP_STORAGE_KEY);return r?JSON.parse(r):{}}catch(e){return{}}}
function eifpKey(c,p){return c+"__"+p}
/* Latest rating for an LO: prefer the "after" rating, fall back to "before". */
function eifpRating(state,code){return state[eifpKey(code,"post")]||state[eifpKey(code,"pre")]||""}
function eifpTally(codes,state){
  let g=0,a=0,r=0;
  codes.forEach(function(c){const v=eifpRating(state,c);
    if(v==="green")g++;else if(v==="amber")a++;else if(v==="red")r++;});
  return{green:g,amber:a,red:r,rated:g+a+r,total:codes.length};
}
document.addEventListener("DOMContentLoaded",function(){
  const state=eifpLoad();

  /* Per-lesson RAG dots */
  document.querySelectorAll("[data-lesson-los]").forEach(function(el){
    const codes=(el.getAttribute("data-lesson-los")||"").split(",").filter(Boolean);
    const t=eifpTally(codes,state);
    const dots=el.querySelector("[data-rag-mini]");
    const label=el.querySelector("[data-status-label]");
    if(dots){
      dots.innerHTML="";
      const order=[["green",t.green],["amber",t.amber],["red",t.red],["",t.total-t.rated]];
      order.forEach(function(pair){for(let i=0;i<pair[1];i++){
        const d=document.createElement("span");d.className="rag-dot"+(pair[0]?" "+pair[0]:"");dots.appendChild(d);}});
    }
    if(label){
      label.textContent = t.rated===0 ? "Not started"
        : (t.green===t.total ? "All confident" : t.green+"/"+t.total+" confident");
    }
  });

  /* Aggregate band(s) */
  document.querySelectorAll("[data-progress-scope]").forEach(function(band){
    const groups=(band.getAttribute("data-progress-scope")||"").split(",").filter(Boolean);
    let codes=[];
    groups.forEach(function(g){codes=codes.concat(EIFP_LO_MAP[g]||[])});
    const t=eifpTally(codes,state);
    const q=function(s){return band.querySelector(s)};
    const pc=function(n){return t.total?(n/t.total)*100+"%":"0%"};
    if(q("[data-seg-green]"))q("[data-seg-green]").style.width=pc(t.green);
    if(q("[data-seg-amber]"))q("[data-seg-amber]").style.width=pc(t.amber);
    if(q("[data-seg-red]"))q("[data-seg-red]").style.width=pc(t.red);
    const lbl=q("[data-progress-text]");
    if(lbl){
      lbl.textContent = t.rated===0
        ? "You haven't rated any objectives yet — open a lesson and start with the warm-up check."
        : t.green+" confident · "+t.amber+" getting there · "+t.red+" needs work · "+(t.total-t.rated)+" not yet rated";
    }
    const cnt=q("[data-progress-count]");
    if(cnt)cnt.textContent=t.green+" / "+t.total;
  });
});
`;

/* ---------- Page shell ---------- */
function shell({ title, desc, activeNav, body, script, breadcrumb }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<style>${SHARED_CSS}</style>
</head>
<body>

<header class="topbar">
  <div class="wrap">
    <a class="brand" href="index.html"><span class="dot"></span> Eduversal Foundation</a>
    <nav>
      <a href="index.html"${activeNav === 'home' ? ' class="active"' : ''}>Home</a>
      <a href="physics.html"${activeNav === 'physics' ? ' class="active"' : ''}>Physics</a>
    </nav>
  </div>
</header>

${body}

<footer class="site-footer">
  <div class="wrap">
    <div>
      <strong style="color:#fff">Eduversal Foundation</strong> — free self-paced Cambridge IGCSE preparation.
      <div class="fine">Your progress is saved in this browser only. No account, no sign-in, nothing sent to a server.</div>
    </div>
    <div class="fine">© Eduversal Education</div>
  </div>
</footer>

<script>${script || ''}</script>
</body>
</html>
`;
}

/* ==========================================================================
   Build
   ========================================================================== */
const lessons = readLessons();

// LO map for the progress script
const loMap = {};
lessons.forEach((l) => { loMap[l.code] = l.los; });
const loMapJson = JSON.stringify(loMap, null, 0);

const byTopic = {};
lessons.forEach((l) => { (byTopic[l.topic] ||= []).push(l); });
Object.values(byTopic).forEach((arr) =>
  arr.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));

const totalLOs = lessons.reduce((n, l) => n + l.los.length, 0);
const totalQ   = lessons.reduce((n, l) => n + l.quizzes, 0);
const totalVid = lessons.reduce((n, l) => n + l.videos, 0);
const totalSim = lessons.reduce((n, l) => n + l.sims, 0);

/* ---------- Renderers ---------- */
function lessonRow(l) {
  return `      <a class="lesson" href="${l.file}" data-lesson-los="${l.los.join(',')}">
        <div class="lesson-code">${esc(l.code)}</div>
        <div class="lesson-body">
          <h4>${esc(l.name)}</h4>
          <p>${esc(l.dek)}</p>
          <div class="lesson-meta">
            ${l.core ? `<span class="chip chip-core">${l.core} Core</span>` : ''}
            ${l.supp ? `<span class="chip chip-supp">${l.supp} Supplement</span>` : ''}
            <span class="chip">${l.quizzes} questions</span>
            ${l.videos ? `<span class="chip">${l.videos} videos</span>` : ''}
            ${l.sims ? `<span class="chip">${l.sims} simulation${l.sims > 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>
        <div class="lesson-status">
          <span class="rag-mini" data-rag-mini></span>
          <span class="s-label" data-status-label>Not started</span>
        </div>
      </a>`;
}

function progressBand(scope, heading, sub) {
  return `  <div class="progress-band" data-progress-scope="${scope}">
    <h3>${esc(heading)} <span style="float:right;font-weight:700;color:var(--teal-dark)" data-progress-count>0 / 0</span></h3>
    <p>${esc(sub)}</p>
    <div class="pbar">
      <div class="pseg green" data-seg-green style="width:0"></div>
      <div class="pseg amber" data-seg-amber style="width:0"></div>
      <div class="pseg red" data-seg-red style="width:0"></div>
    </div>
    <div class="legend">
      <span><i style="background:#3FA45B"></i> Confident</span>
      <span><i style="background:#E0A33E"></i> Getting there</span>
      <span><i style="background:#D2544E"></i> Needs work</span>
      <span><i style="background:#E3E9EC"></i> Not yet rated</span>
    </div>
    <p style="margin-top:10px" data-progress-text></p>
  </div>`;
}

/* ---------- index.html ---------- */
const subjectCards = SUBJECTS.map((s) => {
  const live = s.status === 'live';
  const tag = live
    ? `<span class="pill pill-live">${lessons.length} lessons</span>`
    : `<span class="pill pill-soon">Coming soon</span>`;
  const inner = `
    <div class="subject-icon">${s.icon}</div>
    <span class="subject-code">Cambridge IGCSE ${esc(s.code)}</span>
    <h3>${esc(s.name)}</h3>
    <p>${esc(s.blurb)}</p>
    <div class="subject-foot">${tag}${live ? '<span class="go">Start learning &rarr;</span>' : ''}</div>`;
  return live
    ? `      <a class="subject-card" href="${s.id}.html">${inner}\n      </a>`
    : `      <div class="subject-card is-soon">${inner}\n      </div>`;
}).join('\n');

const indexBody = `
<section class="hero">
  <div class="wrap">
    <span class="eyebrow">Free · Self-paced · No sign-in</span>
    <h1>Learn Cambridge IGCSE at your own pace.</h1>
    <p class="dek">Eduversal Foundation is a free, self-paced study programme built by the subject
      teachers of the Eduversal partner school network. Every lesson walks you through the same
      steps a good classroom would: check what you know, watch, read, practise, then rate your own
      confidence and see how far you have moved.</p>
    <div class="hero-cta">
      <a class="btn btn-primary" href="physics.html">Start with Physics &rarr;</a>
      <a class="btn btn-ghost" href="#how">How it works</a>
    </div>
    <div class="hero-stats">
      <div class="hero-stat"><div class="n">${lessons.length}</div><div class="l">Lessons</div></div>
      <div class="hero-stat"><div class="n">${totalLOs}</div><div class="l">Objectives</div></div>
      <div class="hero-stat"><div class="n">${totalQ}</div><div class="l">Questions</div></div>
      <div class="hero-stat"><div class="n">${totalSim}</div><div class="l">Simulations</div></div>
    </div>
  </div>
</section>

<main class="wrap">

  <div class="section-head" id="subjects">
    <h2>Choose your subject</h2>
    <p>Physics is ready now. Mathematics, Biology and Chemistry are being written by our subject teams.</p>
  </div>
  <div class="subject-grid">
${subjectCards}
  </div>

  <div class="section-head" id="how">
    <h2>How a lesson works</h2>
    <p>Every lesson follows the same rhythm, so you always know what comes next.</p>
  </div>
  <div class="steps">
    <div class="step"><div class="n">1</div><h4>Warm-up check</h4>
      <p>A short quiz <em>before</em> you study. It shows you what the topic is really about — getting things wrong here is the point.</p></div>
    <div class="step"><div class="n">2</div><h4>Rate yourself</h4>
      <p>Mark each learning objective red, amber or green. This is your "before" picture.</p></div>
    <div class="step"><div class="n">3</div><h4>Watch, read, try</h4>
      <p>Short videos, clear notes, key terms and interactive simulations you can play with.</p></div>
    <div class="step"><div class="n">4</div><h4>Check again</h4>
      <p>Theory and practical checks test whether the ideas actually stuck.</p></div>
    <div class="step"><div class="n">5</div><h4>See your progress</h4>
      <p>Rate yourself again. The page shows you exactly which objectives improved.</p></div>
  </div>

  <div class="notice">
    <strong>About your progress.</strong> Everything you do here is saved privately in your own
    browser — there is no account and nothing is sent anywhere. That also means your ratings live
    on one device only: if you clear your browser data or switch to another computer, you will
    start with a clean slate.
  </div>

</main>
`;

fs.writeFileSync(path.join(DIR, 'index.html'), shell({
  title: 'Eduversal Foundation — Free self-paced Cambridge IGCSE preparation',
  desc: 'Free, self-paced Cambridge IGCSE preparation from the Eduversal partner school network. Physics available now; Mathematics, Biology and Chemistry coming soon.',
  activeNav: 'home',
  body: indexBody,
  script: progressScript(loMapJson),
}));

/* ---------- physics.html ---------- */
const topicCards = Object.keys(TOPICS).sort().map((t) => {
  const meta = TOPICS[t];
  const ls = byTopic[t] || [];
  if (!ls.length) return '';
  const core = ls.reduce((n, l) => n + l.core, 0);
  const supp = ls.reduce((n, l) => n + l.supp, 0);
  return `      <a class="topic-card" href="topic-${t}.html">
        <div class="t-icon">${meta.icon}</div>
        <span class="t-num">Topic ${meta.num}</span>
        <h3>${esc(meta.name)}</h3>
        <p>${esc(meta.blurb)}</p>
        <div class="topic-meta">
          <span class="chip">${ls.length} lessons</span>
          <span class="chip chip-core">${core} Core</span>
          <span class="chip chip-supp">${supp} Supplement</span>
        </div>
      </a>`;
}).filter(Boolean).join('\n');

const allTopicScopes = Object.keys(byTopic).flatMap((t) => byTopic[t].map((l) => l.code)).join(',');

const physicsBody = `
<main class="wrap">
  <p class="breadcrumb"><a href="index.html">Home</a> &rsaquo; Physics</p>

  <section class="page-header">
    <span class="eyebrow">Cambridge IGCSE Physics 0625</span>
    <h1>Physics</h1>
    <p class="dek">${lessons.length} guided lessons across four topics, covering ${totalLOs} Cambridge
      learning objectives. Work through them in any order — each lesson stands on its own and takes
      roughly 45–70 minutes.</p>
  </section>

${progressBand(allTopicScopes, 'Your Physics progress', 'Objectives you have rated green across every lesson below.')}

  <div class="section-head">
    <h2>Topics</h2>
    <p>Pick a topic to see its lessons.</p>
  </div>
  <div class="topic-grid">
${topicCards}
  </div>

  <div class="notice">
    <strong>What this covers.</strong> These lessons cover Cambridge IGCSE Physics topics 3 to 6
    (Waves, Electricity and magnetism, Nuclear physics and Space physics). Topics 1 and 2
    (Motion, forces and energy; Thermal physics), plus 3.2 Sound and 3.4 Light, are being written
    now and will appear here when they are ready.
  </div>

  <div class="section-head">
    <h2>All lessons</h2>
    <p>Every Physics lesson currently available, in syllabus order.</p>
  </div>
  <div class="lesson-list">
${lessons.map(lessonRow).join('\n')}
  </div>

</main>
`;

fs.writeFileSync(path.join(DIR, 'physics.html'), shell({
  title: 'Physics — Eduversal Foundation',
  desc: `Free self-paced Cambridge IGCSE Physics (0625): ${lessons.length} lessons covering waves, electricity and magnetism, nuclear physics and space physics.`,
  activeNav: 'physics',
  body: physicsBody,
  script: progressScript(loMapJson),
}));

/* ---------- topic-N.html ---------- */
Object.keys(TOPICS).forEach((t) => {
  const meta = TOPICS[t];
  const ls = byTopic[t] || [];
  if (!ls.length) return;

  const core = ls.reduce((n, l) => n + l.core, 0);
  const supp = ls.reduce((n, l) => n + l.supp, 0);
  const scope = ls.map((l) => l.code).join(',');

  const body = `
<main class="wrap">
  <p class="breadcrumb"><a href="index.html">Home</a> &rsaquo; <a href="physics.html">Physics</a> &rsaquo; Topic ${meta.num}</p>

  <section class="page-header">
    <span class="eyebrow">Cambridge IGCSE Physics 0625 &middot; Topic ${meta.num}</span>
    <h1>${meta.icon} ${esc(meta.name)}</h1>
    <p class="dek">${esc(meta.blurb)}</p>
    <div class="topic-meta" style="margin-top:14px">
      <span class="chip">${ls.length} lessons</span>
      <span class="chip chip-core">${core} Core objectives</span>
      <span class="chip chip-supp">${supp} Supplement objectives</span>
    </div>
  </section>

${progressBand(scope, 'Your progress in this topic', 'Based on how you rated yourself in each lesson.')}

  <div class="section-head">
    <h2>Lessons</h2>
    <p>Work through them in order, or jump to whichever you need.</p>
  </div>
  <div class="lesson-list">
${ls.map(lessonRow).join('\n')}
  </div>

  <p style="margin:28px 0 0"><a href="physics.html">&larr; All Physics topics</a></p>
</main>
`;

  fs.writeFileSync(path.join(DIR, `topic-${t}.html`), shell({
    title: `Topic ${meta.num}: ${meta.name} — Eduversal Foundation Physics`,
    desc: `${meta.blurb} ${ls.length} free self-paced Cambridge IGCSE Physics lessons.`,
    activeNav: 'physics',
    body,
    script: progressScript(loMapJson),
  }));
});

/* ---------- Report ---------- */
console.log('Eduversal Foundation — hub pages built\n');
console.log(`  index.html      programme landing (${SUBJECTS.length} subjects, ${SUBJECTS.filter(s => s.status === 'live').length} live)`);
console.log(`  physics.html    ${lessons.length} lessons · ${totalLOs} LOs · ${totalQ} questions · ${totalVid} videos · ${totalSim} PhET sims`);
Object.keys(TOPICS).forEach((t) => {
  const ls = byTopic[t] || [];
  if (ls.length) console.log(`  topic-${t}.html    Topic ${t} · ${TOPICS[t].name} — ${ls.length} lessons`);
});
console.log('');
