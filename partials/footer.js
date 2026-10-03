/* Students Hub — "this portal is an Eduversal service" footer (2026-10-03).
 * One self-contained injector shared by every student page, so the wording lives in one place.
 * Uses CSS variables (--ink-3, --border) so it follows the Arcade / Bloom / light themes. */
(function () {
  'use strict';
  if (document.getElementById('shFooter')) return;

  var style = document.createElement('style');
  style.textContent = ''
    + '.sh-footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 10px;'
    + 'padding:26px 16px 34px;margin:12px auto 0;max-width:920px;border-top:1px solid var(--border,rgba(128,128,128,.25));'
    + 'font-size:.78rem;line-height:1.5;color:var(--ink-3,#7d869c);text-align:center}'
    + '.sh-footer a{color:inherit;font-weight:700;text-decoration:none;border-bottom:1px dotted currentColor}'
    + '.sh-footer a:hover{color:var(--ink,#1a1d29)}'
    + '.sh-footer .sh-dot{opacity:.5}'
    + '.sh-footer img{width:22px;height:22px;border-radius:6px;vertical-align:middle;margin-right:6px}';
  document.head.appendChild(style);

  var f = document.createElement('footer');
  f.id = 'shFooter';
  f.className = 'sh-footer';
  f.innerHTML = ''
    + '<span><img src="/assets/brand/students-hub-mark.webp" alt="" onerror="this.remove()">'
    + 'Students Hub is a service of <a href="https://eduversal.org" target="_blank" rel="noopener">Eduversal Education</a></span>'
    + '<span class="sh-dot" aria-hidden="true">·</span>'
    + '<span>For partner-school students</span>';

  function mount() { document.body.appendChild(f); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
