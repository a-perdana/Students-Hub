/* partials/feedback-fx.js — Students Hub micro-feedback toolkit
 *
 * Single global window.fx with:
 *   fx.play(name)              — Web Audio synth sound (no mp3 hosting needed)
 *   fx.confetti(opts)          — canvas confetti burst
 *   fx.haptic(ms)              — navigator.vibrate wrapper
 *   fx.countUp(el, from, to, ms) — animated number counter
 *   fx.levelUpOverlay(level, tier) — full-screen LEVEL UP card
 *   fx.pulse(el, variant)      — one-shot pulse animation on an element
 *   fx.toggleMute()            — flip mute state (persisted in localStorage)
 *   fx.muted                   — getter
 *
 * Design:
 *   - Synth sounds via Web Audio API (oscillator + envelope) so we
 *     ship no audio assets. ~50 lines per sound, deterministic.
 *   - Confetti uses a temporary <canvas> appended to body, removed
 *     when last particle settles. Brand palette (mor + cyan + gold).
 *   - All effects are no-op when muted; visual effects still play
 *     because they're not noisy in the same way audio is.
 *   - localStorage key: 'sh-fx-muted' ('1' or '0').
 *   - First sound triggers AudioContext lazily; browsers require a
 *     user gesture, so the first /practice-run answer creates it.
 */
(function () {
  if (window.fx) return;     // idempotent — multiple imports OK

  // ─── State ──────────────────────────────────────────────────────
  let audioCtx = null;
  const LS_KEY = 'sh-fx-muted';

  function isMuted() {
    try { return localStorage.getItem(LS_KEY) === '1'; }
    catch { return false; }
  }
  let muted = isMuted();

  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem(LS_KEY, muted ? '1' : '0'); } catch {}
    document.dispatchEvent(new CustomEvent('fx-mute-changed', { detail: { muted } }));
  }

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  // ─── Sound primitives ───────────────────────────────────────────
  // Each "sound" is a sequence of (frequency, duration, type) notes
  // played through a shared gain envelope. Keeps the file small.
  function playNote(ctx, freq, durMs, type, when, gainMul) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    osc.connect(gain).connect(ctx.destination);
    const start = ctx.currentTime + (when || 0);
    const end = start + durMs / 1000;
    const peak = 0.18 * (gainMul == null ? 1 : gainMul);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.start(start);
    osc.stop(end + 0.02);
  }

  // SOUNDS: each fn takes (ctx) and schedules notes
  const SOUNDS = {
    // Bright two-tone "ding" — major third up
    correct(ctx) {
      playNote(ctx, 880, 80,  'sine', 0,    1);
      playNote(ctx, 1320, 140, 'sine', 0.05, 1);
    },
    // Soft descending two-tone — not punitive
    wrong(ctx) {
      playNote(ctx, 440, 90, 'triangle', 0,    0.7);
      playNote(ctx, 330, 140, 'triangle', 0.06, 0.7);
    },
    // Quick ascending arpeggio for streak ≥ 3
    streak(ctx) {
      playNote(ctx, 660, 60, 'square', 0,    0.55);
      playNote(ctx, 880, 60, 'square', 0.05, 0.55);
      playNote(ctx, 1100, 80, 'square', 0.10, 0.6);
      playNote(ctx, 1320, 120, 'square', 0.16, 0.65);
    },
    // Triumphant fanfare for level up / perfect run
    levelUp(ctx) {
      playNote(ctx, 523, 100, 'triangle', 0.0,  1);    // C5
      playNote(ctx, 659, 100, 'triangle', 0.08, 1);    // E5
      playNote(ctx, 784, 100, 'triangle', 0.16, 1);    // G5
      playNote(ctx, 1047, 220, 'sine',    0.26, 1);    // C6 hold
      playNote(ctx, 1319, 280, 'sine',    0.32, 0.7);  // E6 over
    },
    // Subtle "tap" — for hover / minor confirm
    tick(ctx) {
      playNote(ctx, 1100, 30, 'sine', 0, 0.45);
    },
    // Mid-tone "click" — for submit / next
    submit(ctx) {
      playNote(ctx, 660, 50, 'sine', 0, 0.6);
      playNote(ctx, 990, 60, 'sine', 0.04, 0.5);
    },
  };

  function play(name) {
    if (muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    // Resume context if suspended (autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();
    try { fn(ctx); } catch (e) { /* silent */ }
  }

  // ─── Haptic ─────────────────────────────────────────────────────
  function haptic(ms) {
    if (muted) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(ms || 30); } catch {}
    }
  }

  // ─── Confetti ───────────────────────────────────────────────────
  // DOM-based: each particle is an absolutely-positioned <span> with
  // a CSS keyframe animation driving its full lifecycle (translate +
  // rotate + opacity). The previous canvas + requestAnimationFrame
  // implementation rendered one stale frame on some browsers and
  // never advanced — switching to CSS keyframes is more reliable
  // and looks just as snappy. Self-cleans after the longest
  // animation duration via a single setTimeout.
  const CONFETTI_COLORS = [
    '#6c5ce7', // mor
    '#0891b2', // cyan
    '#f59e0b', // gold
    '#10b981', // emerald
    '#ec4899', // pink (kid-friendly accent)
  ];

  // Inject the keyframes + base class once, lazily.
  function ensureConfettiStyles() {
    if (document.getElementById('fx-confetti-styles')) return;
    const s = document.createElement('style');
    s.id = 'fx-confetti-styles';
    s.textContent = `
      .fx-confetti-layer {
        position: fixed; inset: 0;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
      }
      .fx-confetti-piece {
        position: absolute;
        will-change: transform, opacity;
        animation: fx-confetti-fly 1.8s cubic-bezier(.15,.6,.4,1) forwards;
      }
      @keyframes fx-confetti-fly {
        0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
        60%  { opacity: 1; }
        100% { transform: translate3d(var(--tx,0px), var(--ty,400px), 0) rotate(var(--tr,360deg));
               opacity: 0; }
      }
    `;
    document.head.appendChild(s);
  }

  function confetti(opts) {
    ensureConfettiStyles();
    const o = opts || {};
    const count = o.count || 80;
    const originX = o.x != null ? o.x : window.innerWidth / 2;
    const originY = o.y != null ? o.y : window.innerHeight / 3;
    const burst = o.burst != null ? o.burst : 12;

    const layer = document.createElement('div');
    layer.className = 'fx-confetti-layer';
    document.body.appendChild(layer);

    const spread = burst * 22;       // horizontal spread in px
    const dropMin = 280;             // baseline fall in px
    const dropVar = 280;             // extra random fall
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      piece.className = 'fx-confetti-piece';
      const size = 6 + Math.random() * 8;
      const isRound = Math.random() < 0.4;
      const tx = (Math.random() - 0.5) * spread * 2;
      const ty = dropMin + Math.random() * dropVar;
      const tr = (Math.random() - 0.5) * 720;     // up to ±360deg
      const delay = Math.random() * 0.12;          // stagger 0..120ms
      const color = CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0];
      piece.style.cssText =
        `left:${originX - size/2}px;top:${originY - size/2}px;` +
        `width:${isRound ? size : size}px;height:${isRound ? size : size/2}px;` +
        `background:${color};` +
        `border-radius:${isRound ? '50%' : '2px'};` +
        `--tx:${tx}px;--ty:${ty}px;--tr:${tr}deg;` +
        `animation-delay:${delay}s;`;
      layer.appendChild(piece);
    }

    // Clean up after longest piece finishes (1.8s anim + 0.12s delay)
    setTimeout(() => layer.remove(), 2200);
  }

  // ─── Animated counter ──────────────────────────────────────────
  // Animates a number in an element from `from` to `to` over `ms`.
  // Easing: out-cubic so the number lands gently. Prefix/suffix kept
  // as plain strings so '+50' style works.
  function countUp(el, from, to, ms, opts) {
    if (!el) return;
    const o = opts || {};
    const prefix = o.prefix || '';
    const suffix = o.suffix || '';
    const duration = ms || 800;
    const start = performance.now();
    const delta = to - from;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(from + delta * eased);
      el.textContent = prefix + val.toLocaleString('en-GB') + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ─── Pulse (one-shot CSS class application) ─────────────────────
  // Add 'fx-pulse-<variant>' class to an element, auto-removes after
  // animation end. Variants: 'success', 'warn', 'gold'.
  function pulse(el, variant) {
    if (!el) return;
    const cls = 'fx-pulse-' + (variant || 'success');
    el.classList.remove(cls);
    // force reflow so re-adding triggers the animation
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 700);
  }

  // ─── Level up overlay ───────────────────────────────────────────
  // Brief (1.6s) full-screen card celebrating a tier transition.
  // Used by dashboard when student_points.level crosses a tier
  // boundary since last visit.
  function levelUpOverlay(level, tierLabel) {
    const ov = document.createElement('div');
    ov.className = 'fx-levelup-overlay';
    ov.innerHTML = ''
      + '<div class="fx-levelup-card">'
      +   '<div class="fx-levelup-eyebrow">LEVEL UP</div>'
      +   '<div class="fx-levelup-num">' + level + '</div>'
      +   '<div class="fx-levelup-tier">' + (tierLabel || '') + '</div>'
      + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('is-shown'));
    play('levelUp');
    haptic([40, 60, 60]);
    confetti({ count: 200, y: window.innerHeight / 2 });
    setTimeout(() => {
      ov.classList.remove('is-shown');
      setTimeout(() => ov.remove(), 400);
    }, 1800);
  }

  // ─── Public API ─────────────────────────────────────────────────
  window.fx = {
    play, haptic, confetti, countUp, pulse, levelUpOverlay,
    toggleMute() { setMuted(!muted); return muted; },
    setMuted, get muted() { return muted; },
  };
})();
