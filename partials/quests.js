/* Students Hub — daily quest "twist" (2026-10-03).
 *
 * The home page shows three quests per day: today's daily challenge, a rotating TWIST, and keeping
 * the streak alive. The twist is picked from uid + Jakarta day, so it is the same on every device and
 * the server can verify it when the student opens the chest (claimDailyChest).
 *
 * KEEP IN SYNC with questHash / QUEST_VARIANTS in Central Hub/functions/index.js — a node test checks
 * that client and server pick the same quest for thousands of (uid, day) pairs.
 *
 *   SH_QUESTS.pick(uid, dayISO)              → variant {id, label, target, ...}
 *   SH_QUESTS.progress(variant, attempts)    → 0..target   (attempts = today's scored practice runs)
 */
(function () {
  'use strict';
  function hash(str) {                       // FNV-1a 32-bit (identical to the server)
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  var SUBJ = { math: 'Math', english: 'English', science: 'Science' };
  function bySubject(id) { return function (a) { return a.filter(function (x) { return x.subjectId === id; }).length; }; }
  var VARIANTS = [
    { id: 'subject-math',    glyph: '➗', title: 'Finish a Math run',            sub: 'Any Math topic counts. One scored run is enough.',               target: 1, progress: bySubject('math') },
    { id: 'subject-english', glyph: '📖', title: 'Finish an English run',        sub: 'Reading, grammar or vocabulary. One scored run is enough.',      target: 1, progress: bySubject('english') },
    { id: 'subject-science', glyph: '🔬', title: 'Finish a Science run',         sub: 'Biology, chemistry or physics. One scored run is enough.',       target: 1, progress: bySubject('science') },
    { id: 'score-80',        glyph: '🎯', title: 'Score 80% or higher in a run', sub: 'Take your time and aim for 8 out of 10.',                         target: 1, progress: function (a) { return a.some(function (x) { return Number(x.rawScorePct) >= 80; }) ? 1 : 0; } },
    { id: 'two-runs',        glyph: '🔁', title: 'Finish 2 practice runs today', sub: 'Two scored runs, any subject.',                                   target: 2, progress: function (a) { return Math.min(2, a.length); } }
  ];
  function pick(uid, dayISO) { return VARIANTS[hash(String(uid) + '|' + String(dayISO)) % VARIANTS.length]; }
  function progress(v, attempts) { return Math.min(v.target, v.progress(attempts || [])); }
  var ITEM_NAMES = { 'goggles-cap': 'Explorer Cap', 'starfire-beret': 'Starfire Beret', 'laurel-crown': 'Laurel Crown', 'page-halo': 'Halo of Pages',
    'leather-satchel': 'Leather Satchel', 'cyber-satchel': 'Cyber Satchel', 'comet-cape': 'Comet Cape', 'quill-staff': 'Golden Quill Staff',
    'paper-crane': 'Paper Crane', 'lantern-sprite': 'Lantern Sprite', 'phoenix-chick': 'Phoenix Chick', 'study-aura': 'Study Aura',
    'study-nook': 'Cosy Study Nook', 'observatory': 'Starry Observatory', 'aurora-peak': 'Aurora Peak', 'golden-library': 'Golden Library' };
  var ITEM_ART = function (id) { return /^(study-nook|observatory|aurora-peak|golden-library)$/.test(id) ? null : '/assets/mascot/item-' + id + '.webp'; };
  window.SH_QUESTS = { variants: VARIANTS, pick: pick, progress: progress, subjects: SUBJ, itemNames: ITEM_NAMES, itemArt: ITEM_ART };
})();
