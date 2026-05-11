// Light kiosk lockdown for chapter test + EASE test runners (2026-05-11).
//
// What this is: a "make it socially awkward to cheat" layer. Pilot students
// running a Cambridge chapter test or EASE Growth window. NOT a true kiosk
// — a determined student with devtools + a second device can defeat any of
// it. The goal is to (a) discourage casual switching to other tabs / copy-
// pasting, and (b) leave an audit trail (tabSwitches + lockdownEvents) so
// teachers can spot patterns.
//
// Pattern A — forced fullscreen on start:
//   const lockdown = createKioskLockdown({
//     onEvent: (kind, meta) => { ... persist to attempt/session doc ... },
//   });
//   await lockdown.enter();    // request fullscreen + install blockers
//   lockdown.exit();           // call on submit (or auto-submit)
//
// Pattern B — events recorded:
//   tab_hidden        — student left the tab
//   fullscreen_exit   — student left fullscreen (Esc or DevTools)
//   copy_blocked      — student tried to copy
//   paste_blocked     — student tried to paste
//   context_blocked   — student tried right-click
//   devtools_keyguess — student pressed F12 / Ctrl+Shift+I / Ctrl+U
//
// Production-grade lockdown (DOM mutation observer, eval shutdown, network
// heartbeat) is Phase 3 backlog. This module is the pilot floor.

export function createKioskLockdown(opts = {}) {
  const { onEvent = noop } = opts;
  let installed = false;
  let listeners = [];

  function add(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  }

  function fire(kind, meta = {}) {
    try { onEvent(kind, { ...meta, at: Date.now() }); }
    catch (err) { console.error('[kiosk] onEvent threw', err); }
  }

  async function enter() {
    if (installed) return;
    installed = true;

    // Request fullscreen — fire-and-forget; some browsers (iOS Safari)
    // refuse fullscreen API and we fall back to "tab is in focus" check.
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch (err) {
      // Don't bubble — student may have already declined, or device
      // doesn't support it. The tab-switch counter still works.
      console.warn('[kiosk] fullscreen request failed', err?.message);
    }

    add(document, 'visibilitychange', () => {
      if (document.hidden) fire('tab_hidden');
    });

    add(document, 'fullscreenchange', () => {
      if (!document.fullscreenElement) fire('fullscreen_exit');
    });

    add(document, 'copy', (e) => {
      e.preventDefault();
      fire('copy_blocked');
    });

    add(document, 'paste', (e) => {
      e.preventDefault();
      fire('paste_blocked');
    });

    add(document, 'contextmenu', (e) => {
      e.preventDefault();
      fire('context_blocked');
    });

    // Keyboard shortcuts that students commonly use to inspect / view source.
    add(document, 'keydown', (e) => {
      const k = (e.key || '').toLowerCase();
      const cmd = e.ctrlKey || e.metaKey;
      const isDevtools =
        k === 'f12' ||
        (cmd && e.shiftKey && (k === 'i' || k === 'c' || k === 'j')) ||
        (cmd && (k === 'u' || k === 's' || k === 'p'));
      if (isDevtools) {
        e.preventDefault();
        fire('devtools_keyguess', { key: k });
      }
    });
  }

  function exit() {
    if (!installed) return;
    listeners.forEach((off) => { try { off(); } catch {} });
    listeners = [];
    installed = false;
    if (document.fullscreenElement) {
      try { document.exitFullscreen(); } catch {}
    }
  }

  return { enter, exit };
}

function noop() {}
