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
  // Canvas overlay, ~150 particles, brand palette. Particles fall
  // with gravity + drift, fade after ~1.5s. Self-cleans the canvas.
  const CONFETTI_COLORS = [
    '#6c5ce7', // mor
    '#0891b2', // cyan
    '#f59e0b', // gold
    '#10b981', // emerald
    '#ec4899', // pink (kid-friendly accent)
  ];

  function confetti(opts) {
    const o = opts || {};
    const count = o.count || 140;
    const originX = o.x != null ? o.x : window.innerWidth / 2;
    const originY = o.y != null ? o.y : window.innerHeight / 3;
    const burst = o.burst != null ? o.burst : 12;

    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;' +
      'pointer-events:none;z-index:9999';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const parts = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2) * Math.random();
      const speed = burst + Math.random() * burst;
      parts.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - burst * 0.6,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.4,
        size: 6 + Math.random() * 6,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        life: 1,
        // square vs rect for variety
        shape: Math.random() < 0.5 ? 'rect' : 'circle',
      });
    }

    const start = performance.now();
    const TOTAL_MS = 1800;

    function frame(now) {
      const elapsed = now - start;
      const t = elapsed / TOTAL_MS;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of parts) {
        // physics
        p.vy += 0.35; // gravity
        p.vx *= 0.992; // air drag
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = 1 - t;
        if (p.life <= 0) continue;
        alive = true;
        // draw
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (alive && elapsed < TOTAL_MS) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
      }
    }
    requestAnimationFrame(frame);
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
