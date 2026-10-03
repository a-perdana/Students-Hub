/* Students Hub — badge catalogue + unlock celebration (Trophy Room, 2026-10-03).
 *
 * 16 badges in 4 families × 4 rarities, art in /assets/badges/<id>.webp (Stitch).
 * Everything is DERIVED from the student_points counters the Cloud Functions already
 * maintain (totalPoints, streak.longest, practiceRunsCompleted, perfectScores, level) —
 * no new collection, no writes. "Seen" state is per device (localStorage).
 *
 *   SH_BADGES.status(d)           → 16 badges with {cur, done, pct, goal}
 *   SH_BADGES.baseline(uid, d)    → remember what is already unlocked (silent, first visit only)
 *   SH_BADGES.checkNew(uid, d)    → badges unlocked since the last check (marks them seen)
 *   SH_BADGES.celebrate(list)     → full-screen "NEW BADGE" cards, one after another
 */
(function () {
  'use strict';

  var RARITY = {
    common:    { label: 'Common',    color: '#cd7f32', rank: 1 },
    uncommon:  { label: 'Uncommon',  color: '#cbd5e1', rank: 2 },
    rare:      { label: 'Rare',      color: '#fbbf24', rank: 3 },
    legendary: { label: 'Legendary', color: '#22d3ee', rank: 4 }
  };
  var CATS = { progress: 'Progress', streak: 'Streak', skill: 'Skill', honor: 'Honour' };

  // t: points | streak | practice | perfect | level — n: goal
  var LIST = [
    { id: 'fresh-start',     cat: 'progress', name: 'Fresh Start',     rar: 'common',    t: 'points',   n: 100 },
    { id: 'club-1000',       cat: 'progress', name: '1,000 Club',      rar: 'uncommon',  t: 'points',   n: 1000 },
    { id: 'treasure-hunter', cat: 'progress', name: 'Treasure Hunter', rar: 'rare',      t: 'points',   n: 5000 },
    { id: 'point-legend',    cat: 'progress', name: 'Point Legend',    rar: 'legendary', t: 'points',   n: 15000 },
    { id: 'spark',           cat: 'streak',   name: 'Spark',           rar: 'common',    t: 'streak',   n: 3 },
    { id: 'on-fire',         cat: 'streak',   name: 'On Fire',         rar: 'uncommon',  t: 'streak',   n: 7 },
    { id: 'blaze',           cat: 'streak',   name: 'Blaze',           rar: 'rare',      t: 'streak',   n: 14 },
    { id: 'phoenix',         cat: 'streak',   name: 'Phoenix',         rar: 'legendary', t: 'streak',   n: 30 },
    { id: 'warm-up',         cat: 'skill',    name: 'Warm-up',         rar: 'common',    t: 'practice', n: 10 },
    { id: 'full-speed',      cat: 'skill',    name: 'Full Speed',      rar: 'uncommon',  t: 'practice', n: 25 },
    { id: 'sharpshooter',    cat: 'skill',    name: 'Sharpshooter',    rar: 'rare',      t: 'perfect',  n: 3 },
    { id: 'big-brain',       cat: 'skill',    name: 'Big Brain',       rar: 'legendary', t: 'perfect',  n: 10 },
    { id: 'scholar',         cat: 'honor',    name: 'Scholar',         rar: 'common',    t: 'level',    n: 5 },
    { id: 'mentor',          cat: 'honor',    name: 'Mentor',          rar: 'uncommon',  t: 'level',    n: 10 },
    { id: 'master',          cat: 'honor',    name: 'Master',          rar: 'rare',      t: 'level',    n: 20 },
    { id: 'fellow',          cat: 'honor',    name: 'Cambridge Fellow', rar: 'legendary', t: 'level',   n: 35 }
  ];

  function metric(d, t) {
    d = d || {};
    switch (t) {
      case 'points':   return Number(d.totalPoints) || 0;
      case 'streak':   return Number(d.streak && (d.streak.longest || d.streak.current)) || 0;
      case 'practice': return Number(d.practiceRunsCompleted) || 0;
      case 'perfect':  return Number(d.perfectScores) || 0;
      case 'level':    return Number(d.level) || 1;
    }
    return 0;
  }
  function goalText(b) {
    var n = b.n.toLocaleString('en-GB');
    switch (b.t) {
      case 'points':   return 'Earn ' + n + ' points';
      case 'streak':   return 'Reach a ' + n + '-day streak';
      case 'practice': return 'Finish ' + n + ' practice runs';
      case 'perfect':  return 'Get ' + n + ' perfect runs';
      case 'level':    return 'Reach Level ' + n;
    }
    return '';
  }
  // real=true ignores tester mode (used for the seen/new bookkeeping so it never records fake unlocks)
  function status(d, real) {
    var all = !real && window.shTesterUnlockAll && window.shTesterUnlockAll();
    return LIST.map(function (b) {
      var v = metric(d, b.t);
      var cur = all ? b.n : Math.min(b.n, v);
      return Object.assign({}, b, { cur: cur, done: all || v >= b.n, pct: Math.round(cur / b.n * 100), goal: goalText(b) });
    });
  }
  function art(id) { return '/assets/badges/' + id + '.webp'; }

  var seenKey = function (uid) { return 'sh-badges-seen:' + uid; };
  function readSeen(uid) {
    try { var raw = localStorage.getItem(seenKey(uid)); return raw === null ? null : JSON.parse(raw); } catch (e) { return null; }
  }
  function writeSeen(uid, ids) { try { localStorage.setItem(seenKey(uid), JSON.stringify(ids)); } catch (e) {} }

  function baseline(uid, d) {
    if (!uid || readSeen(uid) !== null) return;
    writeSeen(uid, status(d, true).filter(function (b) { return b.done; }).map(function (b) { return b.id; }));
  }
  function checkNew(uid, d) {
    if (!uid) return [];
    if (window.shTesterUnlockAll && window.shTesterUnlockAll()) return [];   // testers see everything unlocked: nothing is "new"
    var seen = readSeen(uid);
    var st = status(d, true);
    if (seen === null) { baseline(uid, d); return []; }
    var fresh = st.filter(function (b) { return b.done && seen.indexOf(b.id) < 0; });
    if (fresh.length) writeSeen(uid, seen.concat(fresh.map(function (b) { return b.id; })));
    return fresh;
  }

  // ── celebration overlay (reuses the level-up overlay chrome from base.css) ──
  var queue = [], showing = false;
  function celebrate(list) {
    (list || []).forEach(function (b) { queue.push(b); });
    if (!showing) next();
  }
  function next() {
    var b = queue.shift();
    if (!b) { showing = false; return; }
    showing = true;
    var r = RARITY[b.rar] || RARITY.common;
    var ov = document.createElement('div');
    ov.className = 'fx-levelup-overlay';
    ov.style.pointerEvents = 'auto';
    ov.innerHTML = ''
      + '<div class="fx-levelup-card" style="background:linear-gradient(160deg,#1a1545,#0f0b24);border:2px solid ' + r.color + ';box-shadow:0 0 60px -6px ' + r.color + ',0 30px 60px -10px rgba(0,0,0,.7);max-width:min(340px,86vw)">'
      +   '<div class="fx-levelup-eyebrow" style="color:' + r.color + '">NEW BADGE UNLOCKED</div>'
      +   '<img src="' + art(b.id) + '" alt="" style="width:150px;height:150px;display:block;margin:8px auto 10px;filter:drop-shadow(0 0 22px ' + r.color + ')">'
      +   '<div class="fx-levelup-num" style="font-size:1.9rem;font-family:Outfit,sans-serif">' + b.name + '</div>'
      +   '<div class="fx-levelup-tier" style="color:' + r.color + ';letter-spacing:.12em;text-transform:uppercase;font-size:.8rem">' + r.label + '</div>'
      +   '<div style="margin-top:8px;font-size:.84rem;opacity:.85">' + b.goal + '</div>'
      + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('is-shown'); });
    if (window.fx) {
      window.fx.play('levelUp');
      window.fx.haptic([40, 60, 60]);
      window.fx.confetti({ count: b.rar === 'legendary' ? 320 : b.rar === 'rare' ? 220 : 140, y: window.innerHeight / 2 });
    }
    var done = function () {
      ov.classList.remove('is-shown');
      setTimeout(function () { ov.remove(); next(); }, 350);
    };
    var timer = setTimeout(done, 2600);
    ov.addEventListener('click', function () { clearTimeout(timer); done(); }, { once: true });
  }

  window.SH_BADGES = { list: LIST, rarity: RARITY, cats: CATS, status: status, art: art, baseline: baseline, checkNew: checkNew, celebrate: celebrate };
})();
