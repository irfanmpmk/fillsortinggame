/* Potion Sort - a color sorting puzzle.
 * Pour colored potion layers between test tubes until each tube holds a single color.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const COLORS = [
    '#e6194b', // red
    '#4363d8', // blue
    '#ffe119', // yellow
    '#3cb44b', // green
    '#f58231', // orange
    '#911eb4', // purple
    '#42d4f4', // cyan
    '#f032e6', // magenta
    '#bfef45', // lime
    '#fabed4', // pink
    '#9a6324', // brown
    '#ffffff', // white
    '#469990', // teal
    '#800000', // maroon
  ];
  const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚', '♥', '♠',
    '♣', '☀', '☾', '✿', '✦', '✖'];

  const UNDO_PER_LEVEL = 5;
  const HINTS_PER_LEVEL = 3;
  const TUBES_PER_LEVEL = 1;

  const STORE = 'potionsort.';

  // ---------------------------------------------------------------------------
  // Storage (wrapped: may be unavailable)
  // ---------------------------------------------------------------------------

  function load(key, fallback) {
    try {
      const v = localStorage.getItem(STORE + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  const progress = {
    unlocked: load('unlocked', 1),
    stars: load('stars', {}),
    sound: load('sound', true),
    symbols: load('symbols', false),
  };

  // ---------------------------------------------------------------------------
  // Difficulty curve
  // ---------------------------------------------------------------------------

  function levelConfig(level) {
    // One more color every 3 levels, from 3 colors up to 14.
    const colors = Math.min(COLORS.length, 3 + Math.floor((level - 1) / 3));
    // Taller tubes later on mean longer, more tangled stacks.
    const capacity = level >= 25 ? 5 : 4;
    // "Mystery" layers: everything below the top may be hidden until uncovered.
    const hidden = level >= 12 ? Math.min(0.8, 0.3 + (level - 12) * 0.02) : 0;
    return { colors, capacity, empty: 2, hidden };
  }

  function difficultyName(level) {
    if (level <= 6) return 'Easy';
    if (level <= 15) return 'Medium';
    if (level <= 30) return 'Hard';
    if (level <= 50) return 'Expert';
    return 'Master';
  }

  // ---------------------------------------------------------------------------
  // Puzzle logic (pure functions, colors are ints)
  // ---------------------------------------------------------------------------

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function topRun(tube) {
    const n = tube.length;
    if (!n) return 0;
    const c = tube[n - 1];
    let run = 1;
    while (run < n && tube[n - 1 - run] === c) run++;
    return run;
  }

  function isComplete(tube, cap) {
    return tube.length === cap && topRun(tube) === cap;
  }

  function isSolved(tubes, cap) {
    return tubes.every((t) => t.length === 0 || isComplete(t, cap));
  }

  // Number of units that would move from a to b, or 0 if the pour is illegal.
  function pourAmount(tubes, a, b, cap) {
    if (a === b) return 0;
    const src = tubes[a];
    const dst = tubes[b];
    if (!src.length || dst.length >= cap || isComplete(src, cap)) return 0;
    if (dst.length && dst[dst.length - 1] !== src[src.length - 1]) return 0;
    return Math.min(topRun(src), cap - dst.length);
  }

  function legalMoves(tubes, cap) {
    const moves = [];
    for (let a = 0; a < tubes.length; a++) {
      for (let b = 0; b < tubes.length; b++) {
        if (pourAmount(tubes, a, b, cap)) moves.push([a, b]);
      }
    }
    return moves;
  }

  /* Depth-first search with memoisation and move ordering. Returns a list of
   * [from, to] moves, or null if nothing was found within the node budget. */
  function solve(start, cap, limit) {
    const seen = new Set();
    const path = [];
    let nodes = 0;

    const key = (ts) => ts.map((t) => t.join(',')).sort().join('|');

    function candidates(ts) {
      const res = [];
      for (let a = 0; a < ts.length; a++) {
        const src = ts[a];
        if (!src.length || isComplete(src, cap)) continue;
        const run = topRun(src);
        const uniform = run === src.length;
        const color = src[src.length - 1];
        let triedEmpty = false;
        for (let b = 0; b < ts.length; b++) {
          if (a === b) continue;
          const dst = ts[b];
          if (dst.length >= cap) continue;
          if (!dst.length) {
            // Moving a single-colored tube into an empty one is pointless,
            // and all empty tubes are equivalent.
            if (uniform || triedEmpty) continue;
            triedEmpty = true;
            res.push([a, b, 0]);
          } else if (dst[dst.length - 1] === color) {
            const n = Math.min(run, cap - dst.length);
            let score = n === run ? 3 : 1;
            if (topRun(dst) === dst.length) score += 2;
            if (n === run && run === src.length) score += 1;
            res.push([a, b, score]);
          }
        }
      }
      res.sort((x, y) => y[2] - x[2]);
      return res;
    }

    function dfs(ts) {
      if (isSolved(ts, cap)) return true;
      if (++nodes > limit) return false;
      const k = key(ts);
      if (seen.has(k)) return false;
      seen.add(k);
      for (const [a, b] of candidates(ts)) {
        const n = Math.min(topRun(ts[a]), cap - ts[b].length);
        const next = ts.slice();
        next[a] = ts[a].slice(0, ts[a].length - n);
        next[b] = ts[b].concat(ts[a].slice(ts[a].length - n));
        path.push([a, b]);
        if (dfs(next)) return true;
        path.pop();
        if (nodes > limit) return false;
      }
      return false;
    }

    return dfs(start.map((t) => t.slice())) ? path.slice() : null;
  }

  /* Deterministic puzzle for a level: same level number, same puzzle. */
  function generateLevel(level) {
    const cfg = levelConfig(level);
    let fallback = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const rng = mulberry32(level * 100003 + attempt * 7919 + 17);
      const pool = [];
      for (let c = 0; c < cfg.colors; c++) {
        for (let i = 0; i < cfg.capacity; i++) pool.push(c);
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const tubes = [];
      for (let t = 0; t < cfg.colors; t++) {
        tubes.push(pool.slice(t * cfg.capacity, (t + 1) * cfg.capacity));
      }
      // Reject puzzles that start with a nearly-sorted tube.
      if (tubes.some((t) => topRun(t) >= cfg.capacity - 1)) continue;
      for (let e = 0; e < cfg.empty; e++) tubes.push([]);

      const hidden = tubes.map((t) => t.map((_, i) => i < t.length - 1 && rng() < cfg.hidden));
      const solution = solve(tubes, cfg.capacity, 40000);
      const candidate = { level, cfg, tubes, hidden, par: solution ? solution.length : 0 };
      if (solution) return candidate;
      if (!fallback) fallback = candidate;
    }
    return fallback;
  }

  // ---------------------------------------------------------------------------
  // Sound (tiny WebAudio synth)
  // ---------------------------------------------------------------------------

  let audio = null;

  function tone(freq, dur, type, vol, delay, slideTo) {
    if (!progress.sound) return;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime + (delay || 0);
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) { /* audio unavailable */ }
  }

  const sfx = {
    select: () => tone(520, 0.08, 'triangle', 0.1),
    invalid: () => tone(160, 0.18, 'square', 0.06),
    pour: (n) => tone(300, 0.25 + n * 0.12, 'sine', 0.12, 0, 700),
    complete: () => [660, 880, 1320].forEach((f, i) => tone(f, 0.2, 'triangle', 0.12, i * 0.07)),
    win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.1)),
  };

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------

  const state = {
    level: 1,
    puzzle: null,
    tubes: [],      // arrays of color ints, bottom -> top
    hidden: [],     // parallel arrays of booleans
    cap: 4,
    history: [],
    moves: 0,
    undos: UNDO_PER_LEVEL,
    hints: HINTS_PER_LEVEL,
    extraTubes: TUBES_PER_LEVEL,
    selected: -1,
    won: false,
  };

  function startLevel(level) {
    state.level = level;
    state.puzzle = generateLevel(level);
    state.cap = state.puzzle.cfg.capacity;
    state.tubes = state.puzzle.tubes.map((t) => t.slice());
    state.hidden = state.puzzle.hidden.map((h) => h.slice());
    state.history = [];
    state.moves = 0;
    state.undos = UNDO_PER_LEVEL;
    state.hints = HINTS_PER_LEVEL;
    state.extraTubes = TUBES_PER_LEVEL;
    state.selected = -1;
    state.won = false;
    view.anim = null;
    view.hint = null;
    view.particles = [];
    view.visual = [];
    layoutBoard();
    updateHud();
    requestDraw();
  }

  function snapshot() {
    return {
      tubes: state.tubes.map((t) => t.slice()),
      hidden: state.hidden.map((h) => h.slice()),
      moves: state.moves,
    };
  }

  function revealTops() {
    state.tubes.forEach((t, i) => {
      if (t.length) state.hidden[i][t.length - 1] = false;
    });
  }

  function doPour(a, b) {
    const n = pourAmount(state.tubes, a, b, state.cap);
    if (!n) return 0;
    state.history.push(snapshot());
    const src = state.tubes[a];
    const moved = src.splice(src.length - n, n);
    state.hidden[a].splice(state.hidden[a].length - n, n);
    state.tubes[b].push(...moved);
    for (let i = 0; i < n; i++) state.hidden[b].push(false);
    revealTops();
    state.moves++;
    return n;
  }

  function undo() {
    if (view.anim || state.won) return;
    if (!state.history.length) return toast('Nothing to undo');
    if (state.undos <= 0) return toast('No undos left - try Restart');
    const snap = state.history.pop();
    const hadExtra = state.tubes.length;
    state.tubes = snap.tubes;
    state.hidden = snap.hidden;
    // Keep an extra tube that was added after the snapshot.
    while (state.tubes.length < hadExtra) {
      state.tubes.push([]);
      state.hidden.push([]);
    }
    state.moves = snap.moves;
    state.undos--;
    state.selected = -1;
    view.hint = null;
    updateHud();
    requestDraw();
  }

  function addTube() {
    if (view.anim || state.won) return;
    if (state.extraTubes <= 0) return toast('Only one extra tube per level');
    state.extraTubes--;
    state.tubes.push([]);
    state.hidden.push([]);
    // Undo history snapshots get the extra tube too.
    state.history.forEach((s) => { s.tubes.push([]); s.hidden.push([]); });
    state.selected = -1;
    view.hint = null;
    layoutBoard();
    updateHud();
    requestDraw();
  }

  function hint() {
    if (view.anim || state.won) return;
    if (state.hints <= 0) return toast('No hints left for this level');
    const solution = solve(state.tubes, state.cap, 150000);
    if (!solution || !solution.length) {
      return toast(state.undos > 0 ? 'Stuck! Try Undo or Restart' : 'Stuck! Try Restart');
    }
    state.hints--;
    state.selected = -1;
    view.hint = { from: solution[0][0], to: solution[0][1], until: now() + 2600 };
    updateHud();
    requestDraw();
  }

  function onTubeTap(i) {
    if (view.anim || state.won) return;
    view.hint = null;
    if (state.selected === -1) {
      const t = state.tubes[i];
      if (!t.length || isComplete(t, state.cap)) {
        shake(i);
        return;
      }
      state.selected = i;
      sfx.select();
    } else if (state.selected === i) {
      state.selected = -1;
    } else {
      const from = state.selected;
      const before = state.tubes[from].slice();
      const color = before[before.length - 1];
      const dstBefore = state.tubes[i].length;
      const n = doPour(from, i);
      if (n) {
        state.selected = -1;
        startPourAnim(from, i, color, n, before.length, dstBefore);
        sfx.pour(n);
        updateHud();
      } else {
        // Re-select a different tube if it is pourable, otherwise shake.
        const t = state.tubes[i];
        if (t.length && !isComplete(t, state.cap) && t[t.length - 1] !== color) {
          state.selected = i;
          sfx.select();
        } else {
          shake(i);
          state.selected = -1;
        }
      }
    }
    requestDraw();
  }

  function afterPour(to) {
    if (isComplete(state.tubes[to], state.cap)) {
      sfx.complete();
      burst(to, state.tubes[to][0], 26);
    }
    if (isSolved(state.tubes, state.cap)) {
      state.won = true;
      onWin();
    } else if (!legalMoves(state.tubes, state.cap).length) {
      toast(state.undos > 0 ? 'No moves left! Undo or Restart' : 'No moves left! Restart');
    }
  }

  function starsFor() {
    const par = state.puzzle.par || state.moves;
    if (state.moves <= par) return 3;
    if (state.moves <= Math.ceil(par * 1.4)) return 2;
    return 1;
  }

  function onWin() {
    sfx.win();
    const stars = starsFor();
    const key = String(state.level);
    if (!progress.stars[key] || progress.stars[key] < stars) progress.stars[key] = stars;
    if (progress.unlocked < state.level + 1) progress.unlocked = state.level + 1;
    save('stars', progress.stars);
    save('unlocked', progress.unlocked);
    confetti();
    setTimeout(() => {
      $('modalTitle').textContent = 'Level ' + state.level + ' Complete!';
      $('modalStars').innerHTML = [1, 2, 3].map((s) => '<span class="' + (s <= stars ? 'on' : '') + '">★</span>').join('');
      $('modalText').textContent = 'Solved in ' + state.moves + ' moves';
      show('modal', true);
    }, 900);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const view = {
    w: 0, h: 0, dpr: 1,
    tw: 40, unit: 34, th: 180,
    pos: [],        // base positions {x, y} (x = center, y = top)
    visual: [],     // per tube animated {lift, shake}
    anim: null,
    hint: null,
    particles: [],
    dirty: true,
  };

  const now = () => performance.now();

  function requestDraw() { view.dirty = true; }

  function resizeCanvas() {
    const r = canvas.getBoundingClientRect();
    view.dpr = Math.min(window.devicePixelRatio || 1, 3);
    view.w = r.width;
    view.h = r.height;
    canvas.width = Math.round(r.width * view.dpr);
    canvas.height = Math.round(r.height * view.dpr);
    layoutBoard();
    requestDraw();
  }

  function tubeHeight(tw, unit) {
    return state.cap * unit + tw * 0.55;
  }

  function layoutBoard() {
    const n = state.tubes.length;
    if (!n || !view.w) return;
    const W = view.w;
    const H = view.h;
    let best = null;
    for (let rows = 1; rows <= 4; rows++) {
      const cols = Math.ceil(n / rows);
      // Width: each tube takes tw, gaps of 0.7 tw.
      const twW = (W * 0.94) / (cols + (cols + 1) * 0.7);
      // Height: per row tube height + room for lifting.
      const per = (H * 0.92) / rows;
      const k = state.cap * 0.95 + 0.55 + 1.1; // tube + lift space in units of tw
      const twH = per / k;
      const tw = Math.min(twW, twH, 64);
      if (!best || tw > best.tw + 0.5) best = { rows, cols, tw };
    }
    const tw = best.tw;
    const unit = tw * 0.95;
    const th = tubeHeight(tw, unit);
    const rowH = th + tw * 1.1;
    const totalH = best.rows * rowH;
    const top = (H - totalH) / 2 + tw * 0.8;
    view.tw = tw;
    view.unit = unit;
    view.th = th;
    view.pos = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / best.cols);
      const inRow = row === best.rows - 1 ? n - row * best.cols : best.cols;
      const col = i - row * best.cols;
      const gap = tw * 0.7;
      const rowW = inRow * tw + (inRow - 1) * gap;
      const x = (W - rowW) / 2 + col * (tw + gap) + tw / 2;
      const y = top + row * rowH;
      view.pos.push({ x, y });
    }
    while (view.visual.length < n) view.visual.push({ lift: 0, shake: 0 });
    view.visual.length = n;
  }

  function tubePath(x, y, tw, th) {
    const r = tw / 2;
    const left = x - r;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left, y + th - r);
    ctx.arc(x, y + th - r, r, Math.PI, 0, true);
    ctx.lineTo(left + tw, y);
  }

  /* Draws one tube with its liquid. `fill` is a fractional unit count used during
   * pouring; layers beyond it are not drawn. Local coords: x is center, y is top. */
  function drawTube(i, x, y, angle, layers, hiddenFlags, fill, highlight) {
    const tw = view.tw;
    const th = view.th;
    const unit = view.unit;
    ctx.save();
    if (angle) {
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.translate(-x, -y);
    }

    const complete = layers.length === state.cap && isComplete(layers, state.cap) && fill >= state.cap;

    // Glow for selection / hints / completion.
    if (highlight) {
      ctx.save();
      ctx.shadowColor = highlight;
      ctx.shadowBlur = tw * 0.6;
      tubePath(x, y, tw, th);
      ctx.strokeStyle = highlight;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // Glass body.
    tubePath(x, y, tw, th);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();

    // Liquid.
    ctx.save();
    const inset = Math.max(2, tw * 0.07);
    tubePath(x, y + inset, tw - inset * 2, th - inset * 2);
    ctx.clip();
    const bottom = y + th - inset;
    const count = Math.min(layers.length, Math.ceil(fill - 1e-6));
    for (let k = 0; k < count; k++) {
      const amount = Math.min(1, fill - k);
      if (amount <= 0) break;
      const y1 = bottom - (k + amount) * unit;
      const y0 = k === 0 ? y + th + tw : bottom - k * unit;
      const isHidden = hiddenFlags && hiddenFlags[k];
      const color = isHidden ? '#3d3566' : COLORS[layers[k]];
      ctx.fillStyle = color;
      ctx.fillRect(x - tw, y1, tw * 2, y0 - y1 + 0.5);
      // Soft shading for a rounded look.
      const g = ctx.createLinearGradient(x - tw / 2, 0, x + tw / 2, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.18)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g;
      ctx.fillRect(x - tw, y1, tw * 2, y0 - y1 + 0.5);
      // Surface line on the top layer.
      if (k === count - 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x - tw, y1, tw * 2, Math.max(1.5, unit * 0.07));
      }
      if (amount > 0.6) {
        const cy = bottom - (k + 0.5) * unit;
        if (isHidden) {
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.font = 'bold ' + Math.round(unit * 0.5) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', x, cy + 1);
        } else if (progress.symbols) {
          ctx.fillStyle = layers[k] === 11 || layers[k] === 2 || layers[k] === 9 || layers[k] === 8
            ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)';
          ctx.font = Math.round(unit * 0.45) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(SYMBOLS[layers[k]], x, cy + 1);
        }
      }
    }
    ctx.restore();

    // Glass outline and shine.
    tubePath(x, y, tw, th);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1.5, tw * 0.05);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x - tw * 0.32, y + tw * 0.25, tw * 0.1, th - tw * 0.9);

    // Rim.
    const rimH = Math.max(4, tw * 0.14);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    roundRect(x - tw / 2 - tw * 0.1, y - rimH / 2, tw * 1.2, rimH, rimH / 2);
    ctx.fill();

    // Cork on completed tubes.
    if (complete && !angle) {
      ctx.fillStyle = '#c98b4e';
      roundRect(x - tw * 0.38, y - tw * 0.42, tw * 0.76, tw * 0.42, tw * 0.1);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x - tw * 0.38, y - tw * 0.16, tw * 0.76, tw * 0.06);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // --- Pour animation ---------------------------------------------------------

  function startPourAnim(from, to, color, n, srcBefore, dstBefore) {
    const t = now();
    const tilt = 0.12 * n;
    view.anim = {
      from, to, color, n, srcBefore, dstBefore,
      t0: t,
      tMove: 230,
      tPour: 260 + n * 110,
      tBack: 230,
      tilt,
    };
    requestDraw();
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function animFrame(a, t) {
    const el = t - a.t0;
    const { tMove, tPour, tBack } = a;
    let move, pour;
    if (el < tMove) { move = ease(el / tMove); pour = 0; }
    else if (el < tMove + tPour) { move = 1; pour = (el - tMove) / tPour; }
    else if (el < tMove + tPour + tBack) { move = 1 - ease((el - tMove - tPour) / tBack); pour = 1; }
    else return null;
    return { move, pour };
  }

  function drawAnimTube(a, f) {
    const tw = view.tw;
    const src = view.pos[a.from];
    const dst = view.pos[a.to];
    const dir = dst.x >= src.x ? 1 : -1;
    const maxAngle = dir * (Math.PI / 2 - 0.25);
    const angle = maxAngle * f.move;
    // Rotate about the mouth; the mouth travels to just above the target.
    const startX = src.x;
    const startY = src.y - tw * 0.6;
    const endX = dst.x - dir * tw * 0.35;
    const endY = dst.y - tw * 1.1;
    const mx = startX + (endX - startX) * f.move;
    const my = startY + (endY - startY) * f.move;
    const remaining = a.srcBefore - a.n * f.pour;
    const layers = state.tubes[a.from].concat(new Array(a.n).fill(a.color));
    const hidden = state.hidden[a.from].concat(new Array(a.n).fill(false));
    drawTube(a.from, mx, my, angle, layers, hidden, remaining, null);

    // Stream of liquid while pouring.
    if (f.move === 1 && f.pour > 0 && f.pour < 1) {
      const dstFill = a.dstBefore + a.n * f.pour;
      const surface = dst.y + view.th - Math.max(2, tw * 0.07) - dstFill * view.unit;
      // The lip corner facing the target, rotated about the mouth.
      const lipX = mx + dir * (tw / 2) * Math.cos(angle);
      const lipY = my + (tw / 2) * Math.abs(Math.sin(angle));
      const sw = Math.max(3, tw * 0.18);
      ctx.fillStyle = COLORS[a.color];
      ctx.fillRect(lipX - sw / 2, lipY, sw, surface - lipY);
    }
  }

  // --- Particles --------------------------------------------------------------

  function burst(i, color, count) {
    const p = view.pos[i];
    if (!p) return;
    for (let k = 0; k < count; k++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3.5;
      view.particles.push({
        x: p.x, y: p.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2,
        life: 1, color: COLORS[color], size: 2 + Math.random() * 3, star: true,
      });
    }
  }

  function confetti() {
    for (let k = 0; k < 140; k++) {
      view.particles.push({
        x: Math.random() * view.w, y: -20 - Math.random() * view.h * 0.4,
        vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
        life: 2.2, color: COLORS[k % COLORS.length], size: 4 + Math.random() * 4,
        spin: Math.random() * 6, star: false,
      });
    }
  }

  function stepParticles() {
    view.particles = view.particles.filter((p) => p.life > 0 && p.y < view.h + 40);
    for (const p of view.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.star ? 0.12 : 0.03;
      p.life -= p.star ? 0.025 : 0.008;
      if (p.spin !== undefined) p.spin += 0.15;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      if (p.star) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  function shake(i) {
    if (view.visual[i]) view.visual[i].shake = now();
    sfx.invalid();
    requestDraw();
  }

  // --- Main loop --------------------------------------------------------------

  function frame() {
    requestAnimationFrame(frame);
    const t = now();
    let busy = view.dirty || !!view.anim || view.particles.length > 0 || !!view.hint;
    // Smooth lift towards target.
    for (let i = 0; i < view.visual.length; i++) {
      const v = view.visual[i];
      const target = state.selected === i ? -view.tw * 0.6 : 0;
      if (Math.abs(v.lift - target) > 0.3) {
        v.lift += (target - v.lift) * 0.3;
        busy = true;
      } else {
        v.lift = target;
      }
      if (v.shake && t - v.shake < 350) busy = true;
    }
    if (!busy || !view.w) return;
    view.dirty = false;

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);

    let a = view.anim;
    let f = null;
    if (a) {
      f = animFrame(a, t);
      if (!f) {
        view.anim = null;
        const to = a.to;
        a = null;
        afterPour(to);
      }
    }
    if (view.hint && t > view.hint.until) view.hint = null;

    for (let i = 0; i < state.tubes.length; i++) {
      if (a && i === a.from) continue;
      const p = view.pos[i];
      if (!p) continue;
      const v = view.visual[i];
      let dx = 0;
      if (v.shake) {
        const st = t - v.shake;
        if (st < 350) dx = Math.sin(st / 25) * view.tw * 0.15 * (1 - st / 350);
        else v.shake = 0;
      }
      let fill = state.tubes[i].length;
      if (a && i === a.to) fill = a.dstBefore + a.n * f.pour;
      let hl = null;
      if (state.selected === i) hl = '#ffe27a';
      if (view.hint && (view.hint.from === i || view.hint.to === i)) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 120);
        hl = 'rgba(120,255,170,' + (0.4 + 0.6 * pulse).toFixed(2) + ')';
      }
      drawTube(i, p.x + dx, p.y + v.lift, 0, state.tubes[i], state.hidden[i], fill, hl);
    }
    if (a && f) drawAnimTube(a, f);
    stepParticles();
  }

  // --- Input --------------------------------------------------------------------

  function tubeAt(px, py) {
    const tw = view.tw;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < view.pos.length; i++) {
      const p = view.pos[i];
      const x0 = p.x - tw / 2 - tw * 0.35;
      const x1 = p.x + tw / 2 + tw * 0.35;
      const y0 = p.y - tw * 1.2;
      const y1 = p.y + view.th + tw * 0.3;
      if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
        const d = Math.abs(px - p.x);
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const i = tubeAt(e.clientX - r.left, e.clientY - r.top);
    if (i >= 0) onTubeTap(i);
    else if (state.selected !== -1) { state.selected = -1; requestDraw(); }
  });

  // ---------------------------------------------------------------------------
  // Screens and HUD
  // ---------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);

  function show(id, on) { $(id).classList.toggle('hidden', !on); }

  let current = 'home';

  function goto(screen) {
    current = screen;
    ['home', 'levels', 'game'].forEach((s) => show(s, s === screen));
    show('modal', false);
    if (screen === 'game') resizeCanvas();
    if (screen === 'levels') buildLevelGrid();
    if (screen === 'home') $('btnPlay').textContent = 'Play  •  Level ' + progress.unlocked;
  }

  function updateHud() {
    const cfg = state.puzzle.cfg;
    $('levelLabel').textContent = 'Level ' + state.level;
    $('levelInfo').textContent = difficultyName(state.level) + ' • ' + cfg.colors + ' colors • Moves ' + state.moves;
    $('undoCount').textContent = state.undos;
    $('hintCount').textContent = state.hints;
    $('tubeCount').textContent = state.extraTubes;
    $('btnUndo').disabled = state.undos <= 0;
    $('btnHint').disabled = state.hints <= 0;
    $('btnTube').disabled = state.extraTubes <= 0;
  }

  function buildLevelGrid() {
    const grid = $('levelGrid');
    grid.innerHTML = '';
    const total = Math.max(60, Math.ceil((progress.unlocked + 10) / 10) * 10);
    for (let l = 1; l <= total; l++) {
      const b = document.createElement('button');
      const stars = progress.stars[String(l)] || 0;
      b.innerHTML = l + '<small>' + (stars ? '★'.repeat(stars) : '&nbsp;') + '</small>';
      if (l > progress.unlocked) {
        b.classList.add('locked');
        b.disabled = true;
      } else {
        if (l === progress.unlocked) b.classList.add('current');
        b.addEventListener('click', () => { goto('game'); startLevel(l); });
      }
      grid.appendChild(b);
    }
    const cur = grid.querySelector('.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  let toastTimer = 0;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    show('toast', true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => show('toast', false), 2200);
  }

  // Called by the Android wrapper on the hardware back button. Returns true if handled.
  window.handleBack = function () {
    if (!$('modal').classList.contains('hidden')) { show('modal', false); goto('levels'); return true; }
    if (current === 'game') {
      if (state.selected !== -1) { state.selected = -1; requestDraw(); return true; }
      goto('home');
      return true;
    }
    if (current === 'levels') { goto('home'); return true; }
    return false;
  };

  $('btnPlay').addEventListener('click', () => { goto('game'); startLevel(progress.unlocked); });
  $('btnLevels').addEventListener('click', () => goto('levels'));
  $('levelsBack').addEventListener('click', () => goto('home'));
  $('gameHome').addEventListener('click', () => goto('home'));
  $('gameRestart').addEventListener('click', () => { if (!view.anim) startLevel(state.level); });
  $('btnUndo').addEventListener('click', undo);
  $('btnTube').addEventListener('click', addTube);
  $('btnHint').addEventListener('click', hint);
  $('modalNext').addEventListener('click', () => { show('modal', false); startLevel(state.level + 1); });
  $('modalReplay').addEventListener('click', () => { show('modal', false); startLevel(state.level); });

  $('optSound').checked = progress.sound;
  $('optSymbols').checked = progress.symbols;
  $('optSound').addEventListener('change', (e) => { progress.sound = e.target.checked; save('sound', progress.sound); });
  $('optSymbols').addEventListener('change', (e) => { progress.symbols = e.target.checked; save('symbols', progress.symbols); });

  window.addEventListener('resize', () => { if (current === 'game') resizeCanvas(); });

  // --- Home logo: a few decorative tubes -----------------------------------------

  function drawLogo() {
    const c = $('logo');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = 260 * dpr;
    c.height = 170 * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const sets = [[0, 2, 1, 3], [3, 3, 0, 1], [1, 0, 2, 2], [2, 1, 3, 0]];
    sets.forEach((layers, i) => {
      const x = 50 + i * 53;
      const y = 22 - (i % 2) * 10;
      const tw = 34;
      const unit = 30;
      const th = 4 * unit + tw * 0.5;
      const path = () => {
        g.beginPath();
        g.moveTo(x - tw / 2, y);
        g.lineTo(x - tw / 2, y + th - tw / 2);
        g.arc(x, y + th - tw / 2, tw / 2, Math.PI, 0, true);
        g.lineTo(x + tw / 2, y);
      };
      g.save();
      path();
      g.clip();
      layers.forEach((col, k) => {
        g.fillStyle = COLORS[[0, 1, 2, 7][col]];
        g.fillRect(x - tw, y + th - (k + 1) * unit, tw * 2, k === 0 ? unit + tw : unit);
      });
      g.restore();
      path();
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.2)';
      g.fillRect(x - tw * 0.3, y + 8, 4, th - 30);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(x - tw / 2 - 4, y - 3, tw + 8, 6);
    });
  }

  // Exposed for automated tests.
  window.__potion = { state, solve, generateLevel, levelConfig, onTubeTap, pourAmount, view };
  window.__startForTest = (l) => { goto('game'); startLevel(l); };

  drawLogo();
  goto('home');
  requestAnimationFrame(frame);
})();
