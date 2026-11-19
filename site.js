/* Stefan Kelly — natural and artificial minds.
   Everything drawn on this site is generated here:
     1. World state and the switch
     2. The instrument (hero): a face in a halo, with a tree that re-lays itself as a circuit
     3. The landscape plate
     4. Sigils for each line of inquiry
     5. The spiral disc
     6. The scroll rail */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const ease = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ================= 1. World state ================= */

  const sw = document.querySelector('.switch');
  let state = root.dataset.state;
  let world = root.dataset.world;
  const onWorld = [];           // run synchronously when the world flips
  const onWorldAnimated = [];   // told a flip is starting, so they can animate

  function remember(w) { try { localStorage.setItem('world', w); } catch (e) {} }

  function setWorld(w) {
    if (state !== 'chosen' || w === world) return;
    const apply = () => {
      world = w; root.dataset.world = w;
      if (sw) sw.setAttribute('aria-checked', String(w === 'artificial'));
      remember(w);
      onWorld.forEach(f => f(w));
    };
    onWorldAnimated.forEach(f => f(w));
    if (!reduced && document.startViewTransition) document.startViewTransition(apply); else apply();
  }
  if (sw) {
    sw.setAttribute('aria-checked', String(world === 'artificial'));
    sw.addEventListener('click', e => {
      const side = e.target.closest('[data-side]');
      setWorld(side ? side.dataset.side : world === 'natural' ? 'artificial' : 'natural');
    });
  }

  /* ================= About =================
     A layer over the page. Opens from any link to #about; closes with the button,
     Escape, or a click on the empty space around the text. */
  const about = document.querySelector('dialog.about');
  if (about) {
    const open = () => { if (!about.open) about.showModal(); };
    document.addEventListener('click', e => {
      if (!e.target.closest('a[href="#about"]')) return;
      e.preventDefault(); open();
    });
    about.addEventListener('click', e => { if (!e.target.closest('p, dl')) about.close(); });
    about.addEventListener('close', () => { if (location.hash === '#about') history.replaceState(null, '', location.pathname + location.search); });
    if (location.hash === '#about') open();
  }

  /* Size the hero image so no words ever sit on it: the largest circle that starts below the
     intro line and clears every title and Enter button, on the threshold and after choosing. */
  const heroEl = document.querySelector('.hero');
  if (heroEl) {
    const fit = () => {
      const intro = document.querySelector('.mast .intro');
      const hr = heroEl.getBoundingClientRect(), vw = hr.width, vh = hr.height;
      const top0 = (intro ? intro.getBoundingClientRect().bottom - hr.top : 0) + 18;
      const avail = vh - top0 - Math.max(16, vh * .03);
      const phone = innerWidth <= 760;
      // Measure the words themselves (a heading's box is wider than its text), line by line.
      const rects = e => { const r = document.createRange(); r.selectNodeContents(e); return [...r.getClientRects()]; };
      const boxes = sel => [...heroEl.querySelectorAll(sel)].flatMap(rects)
        .filter(q => q.width > 0).map(q => ({ l: q.left - hr.left - 14, r: q.right - hr.left + 14, t: q.top - hr.top - 14, b: q.bottom - hr.top + 14 }));
      const all = boxes('.hero-title, .hero-text button, .hero-text a');
      const nat = boxes('.pane[data-world="natural"] .hero-title, .pane[data-world="natural"] .hero-text button');
      const art = boxes('.pane[data-world="artificial"] .hero-title, .pane[data-world="artificial"] .hero-text button');
      const cases = [[.5, all]];
      if (innerWidth >= 900) cases.push([.66, nat], [.34, art]);
      // Try two bands: the full height below the intro, and the space between the intro and the titles
      // (which is what fits on a phone). Use whichever allows the bigger circle.
      const titleTop = Math.min(...all.map(q => q.t));
      const bands = [[top0, top0 + avail], [top0, titleTop]];
      const clear = (h, a, b) => {
        const cy = (a + b) / 2, R = h * .48;
        return cases.every(([fx, list]) => list.every(q => {
          const cx = vw * fx, nx = Math.max(q.l, Math.min(cx, q.r)), ny = Math.max(q.t, Math.min(cy, q.b));
          return Math.hypot(nx - cx, ny - cy) >= R;
        }));
      };
      let best = { h: 0, top: top0 };
      for (const [a, b] of bands) {
        let lo = 0, hi = Math.min(b - a, vw * (phone ? .96 : 1.25));
        if (hi <= 0) continue;
        if (clear(hi, a, b)) lo = hi; else for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (clear(m, a, b)) lo = m; else hi = m; }
        if (lo > best.h) best = { h: lo, top: (a + b) / 2 - lo / 2 };
      }
      heroEl.style.setProperty('--art-h', Math.floor(best.h) + 'px');
      heroEl.style.setProperty('--art-top', Math.round(best.top) + 'px');
    };
    fit(); addEventListener('resize', fit); if (document.fonts) document.fonts.ready.then(fit);
    new MutationObserver(() => { fit(); setTimeout(fit, 1600); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-state'] });
  }

  /* ================= Art slots =================
     Any element with data-art="name" looks for art/name-natural.* and art/name-artificial.*
     (webp, jpg or png). Where a file exists it is shown; where it does not, the
     code-drawn fallback stays. A slot with data-world only loads that world's image. */
  document.querySelectorAll('[data-art]').forEach(el => {
    const only = el.dataset.artWorld || el.dataset.world;
    for (const w of only ? [only] : ['natural', 'artificial']) {
      const exts = ['webp', 'jpg', 'png'];
      const img = new Image();
      let i = 0;
      img.alt = ''; img.className = 'art-img'; img.decoding = 'async';
      if (!only) img.dataset.in = w;
      img.onload = () => { el.classList.add('has-' + w); img.classList.add('is-loaded'); if (el.dataset.artVideo) addVideo(el, w, img); if (el.dataset.artAwake === w) addAwake(el, w, img); };
      img.onerror = () => { if (++i < exts.length) img.src = `/art/${el.dataset.art}-${w}.${exts[i]}`; else img.remove(); };
      img.src = `/art/${el.dataset.art}-${w}.${exts[0]}`;
      el.prepend(img);
    }
  });

  /* A slot with data-art-awake="world" has a second picture, name-world-awake.jpg, that fades in over
     the first once that world has been chosen (the human face opens its eyes; its third eye closes). */
  function addAwake(el, w, img) {
    const a = new Image();
    a.alt = ''; a.className = 'art-img art-awake'; a.decoding = 'async';
    if (img.dataset.in) a.dataset.in = img.dataset.in;
    a.onerror = () => a.remove();
    a.src = `/art/${el.dataset.art}-${w}-awake.jpg`;
    img.after(a);
  }

  /* A slot with data-art-video also gets art/name-world.mp4 laid over its still.
     "loop" repeats quietly; "once" plays a single time when it comes into view and then rests
     on its last frame, which is the still. Nothing moves for people who ask for reduced motion. */
  function addVideo(el, w, img) {
    if (reduced) return;
    const once = el.dataset.artVideo === 'once';
    const v = document.createElement('video');
    v.className = 'art-img art-video'; v.muted = true; v.playsInline = true; v.loop = !once;
    v.preload = 'auto'; v.setAttribute('aria-hidden', 'true');
    if (img.dataset.in) v.dataset.in = img.dataset.in;
    v.src = `/art/${el.dataset.art}-${w}.mp4`;
    if (once) img.classList.add('awaits-video');
    const reveal = () => img.classList.remove('awaits-video');
    setTimeout(() => { if (!v.classList.contains('is-playing')) reveal(); }, 2500);
    v.addEventListener('error', () => { reveal(); v.remove(); });
    v.addEventListener('playing', () => { v.classList.add('is-playing'); reveal(); });
    img.after(v);
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { if (!(once && v.ended)) v.play().catch(() => {}); }
      else if (!v.ended) v.pause();
    }, { threshold: 0.15 }).observe(v);
  }

  /* ================= 2. The instrument ================= */

  const hero = document.querySelector('.hero');
  if (hero) instrument();

  function instrument() {
    const SEG = 16;
    const LEVEL_R = [0.385, 0.49, 0.6, 0.71, 0.82, 0.925];
    const LINE_W = [2.3, 1.8, 1.4, 1.05, 0.85];
    const P = 11;

    const PAL = {
      natural: {
        line: ['#5a4529', '#69532f', '#786037', '#876f41', '#957d4c'],
        bead: '#96773a', leaf: ['#2c4f3e', '#44705a', '#6f9474'],
        via: '#96773a', viaCore: '#2f5241',
        ring: 'rgba(87,72,58,.42)', tick: 'rgba(87,72,58,.5)', guide: null, lace: 'rgba(120,98,60,.13)',
        enamel: ['#3a6350', '#27473a'], disc: '#f6f1e4', ray: 'rgba(150,119,58,.3)', gold: '#a08040', goldHi: '#c2a05a',
        eyeWhite: '#fbf7ec', iris: '#3f6b52', pupil: '#14241c', orb: ['#4f7c65', '#1f3a2e'],
      },
      artificial: {
        line: ['#e6c680', '#dcb96f', '#cfab63', '#c09c57', '#b08d4c'],
        bead: '#f0d896', leaf: ['#2e7a5b', '#3f9a74', '#1f5a43'],
        via: '#e6c680', viaCore: '#56d6a0',
        ring: 'rgba(217,182,110,.5)', tick: 'rgba(217,182,110,.55)', guide: 'rgba(217,182,110,.11)', lace: 'rgba(217,182,110,.09)',
        enamel: ['#1f5a44', '#0c241b'], disc: '#091510', ray: 'rgba(217,182,110,.26)', gold: '#dcb96f', goldHi: '#f5e0a6',
        eyeWhite: '#0d1f18', iris: '#dcb96f', pupil: '#56d6a0', orb: ['#2f8a68', '#061510'],
      },
    };

    /* ----- Branch structure, built once ----- */
    const branches = [], byDepth = [[], [], [], [], []], tips = [];
    (function build() {
      const rnd = mulberry32(1922);
      function grow(parent, depth, centre, width, o0, c0, sway) {
        const c1 = { r: LEVEL_R[depth + 1], th: centre };
        const o1 = { r: LEVEL_R[depth + 1] + (rnd() - 0.5) * 0.05, th: centre + (rnd() - 0.5) * width * 0.55 };
        const b = { parent, depth, o0, o1, c0, c1, sway, bend: (rnd() - 0.5) * width, kids: 0, leaves: [],
          pts: new Float32Array((SEG + 1) * 2), tt: new Float32Array(SEG + 1) };
        branches.push(b); byDepth[depth].push(b);
        let n = 0; const p = rnd();
        if (depth < 2) n = 2;
        else if (depth === 2) n = p < 0.15 ? 1 : p < 0.85 ? 2 : 3;
        else if (depth === 3) n = p < 0.14 ? 0 : p < 0.4 ? 1 : p < 0.9 ? 2 : 3;
        b.kids = n;
        for (let k = 0; k < n; k++) { const w = width / n; grow(b, depth + 1, centre - width / 2 + w * (k + 0.5), w, o1, c1, sway); }
        const tip = n === 0;
        const count = tip ? 6 + Math.floor(rnd() * 4) : depth >= 2 ? 2 + Math.floor(rnd() * 3) : depth === 1 ? Math.floor(rnd() * 2) : 0;
        for (let i = 0; i < count; i++) {
          b.leaves.push({
            i: tip ? SEG - Math.floor(rnd() * 4) : 5 + Math.floor(rnd() * (SEG - 5)),
            dx: (rnd() - 0.5) * (tip ? 0.08 : 0.055), dy: (rnd() - 0.5) * (tip ? 0.08 : 0.055),
            rad: tip ? 0.007 + rnd() * 0.009 : 0.005 + rnd() * 0.006, k: Math.floor(rnd() * 3),
          });
        }
        if (tip) tips.push(b);
      }
      for (let i = 0; i < P; i++) {
        const c = (i / P) * TAU;
        grow(null, 0, c, TAU / P, { r: LEVEL_R[0], th: c + (rnd() - 0.5) * 0.04 }, { r: LEVEL_R[0], th: c }, rnd() * TAU);
      }
    })();

    const pulseRnd = mulberry32(7);
    function newPulse(p) {
      const chain = [];
      for (let b = tips[Math.floor(pulseRnd() * tips.length)]; b; b = b.parent) chain.unshift(b);
      p.chain = chain; p.u = 0; p.speed = 0.25 + pulseRnd() * 0.25;
      return p;
    }
    const pulses = Array.from({ length: 18 }, () => { const p = newPulse({}); p.u = pulseRnd(); return p; });
    const orbs = [{ a: 0.6, s: 0.05 }, { a: 2.9, s: -0.035 }, { a: 4.6, s: 0.022 }];

    /* ----- State ----- */
    const panes = [...hero.querySelectorAll('.pane')].map(el => ({
      el, world: el.dataset.world, canvas: el.querySelector('canvas'), ctx: el.querySelector('canvas').getContext('2d'),
    }));
    let W = 0, H = 0, DPR = 1, band = 80;
    let M = world === 'artificial' ? 1 : 0;
    let split = 0, commit = null, morph = null, fx = 0.5;
    let px = null, py = null;
    let time = 0, last = 0, running = false, onScreen = true;
    const G = { cx: 0, cy: 0, R: 1, rot: 0, s: 1, F: 1, eyeX: 0, eyeY: 0, eyeR: 0 };

    function field(x) {
      if (state === 'chosen') return M;
      const u = clamp01((x - (split - band)) / (2 * band));
      return u * u * (3 - 2 * u);
    }

    function resize() {
      const box = hero.getBoundingClientRect();
      if (Math.abs(box.width - W) < 0.5 && Math.abs(box.height - H) < 0.5) return;
      W = box.width; H = box.height;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      band = Math.max(46, W * 0.06);
      for (const p of panes) { p.canvas.width = Math.round(W * DPR); p.canvas.height = Math.round(H * DPR); }
      if (state === 'threshold') { split = W / 2; hero.style.setProperty('--split', split + 'px'); }
      if (!running) renderOnce();
    }

    /* ----- Geometry ----- */
    function computeGeometry() {
      const wide = W >= 900;
      const target = (state === 'chosen' || commit) && wide ? ((commit ? commit.world : world) === 'artificial' ? 0.34 : 0.66) : 0.5;
      fx += (target - fx) * (reduced ? 1 : 0.045);
      G.cx = W * fx;
      G.cy = H * (wide ? 0.52 : 0.42);
      G.R = wide ? Math.min(W * 0.3, H * 0.385) : Math.min(W * 0.42, H * 0.3);
      G.s = Math.max(0.55, Math.min(1.25, G.R / 340));
      G.rot = time * 0.016;
      G.F = G.R * 0.272;
      G.eyeX = G.cx; G.eyeY = G.cy - G.F * 0.56; G.eyeR = G.F * 0.24;
      const { cx, cy, R, rot } = G;
      for (const b of branches) {
        const { o0, o1, c0, c1, pts, tt } = b;
        for (let i = 0; i <= SEG; i++) {
          const s = i / SEG, e = s * s * (3 - 2 * s);
          const ro = o0.r + (o1.r - o0.r) * s;
          const to = o0.th + (o1.th - o0.th) * e + Math.sin(Math.PI * s) * b.bend * 0.3
            + 0.02 * Math.sin(time * 0.7 + ro * 5 + b.sway) * (ro - 0.3) * 1.5 + rot;
          let rc, tc;
          if (s < 0.5) { rc = c0.r; tc = c0.th + (c1.th - c0.th) * (s * 2); }
          else { rc = c0.r + (c1.r - c0.r) * ((s - 0.5) * 2); tc = c1.th; }
          tc += rot;
          const xo = cx + R * ro * Math.cos(to), yo = cy + R * ro * Math.sin(to);
          const xc = cx + R * rc * Math.cos(tc), yc = cy + R * rc * Math.sin(tc);
          const t = field((xo + xc) / 2);
          pts[i * 2] = xo + (xc - xo) * t; pts[i * 2 + 1] = yo + (yc - yo) * t; tt[i] = t;
        }
      }
    }

    /* ----- Drawing ----- */
    function draw(p) {
      const c = p.ctx, pal = PAL[p.world], art = p.world === 'artificial';
      const { cx, cy, R, rot, s } = G;
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      c.clearRect(0, 0, W, H);
      c.lineCap = 'round'; c.lineJoin = 'round';

      // Lace: a rosette of large overlapping circles behind everything.
      c.strokeStyle = pal.lace; c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < P * 2; i++) {
        const a = (i / (P * 2)) * TAU + rot, x = cx + R * 0.62 * Math.cos(a), y = cy + R * 0.62 * Math.sin(a);
        c.moveTo(x + R * 0.36, y); c.arc(x, y, R * 0.36, 0, TAU);
      }
      c.stroke();

      if (pal.guide) {
        c.strokeStyle = pal.guide; c.lineWidth = 1;
        for (let i = 1; i < LEVEL_R.length; i++) { c.beginPath(); c.arc(cx, cy, R * LEVEL_R[i], 0, TAU); c.stroke(); }
      }

      // Outer astrolabe rings, ticks and orbiting spheres.
      c.strokeStyle = pal.ring; c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, R * 1.03, 0, TAU); c.stroke();
      c.lineWidth = 0.6;
      c.beginPath(); c.arc(cx, cy, R * 1.085, 0, TAU); c.stroke();
      c.strokeStyle = pal.tick; c.lineWidth = 0.8;
      c.beginPath();
      for (let i = 0; i < 144; i++) {
        const a = (i / 144) * TAU - rot * 2.5;
        const r1 = R * (i % 12 === 0 ? 1.062 : i % 6 === 0 ? 1.05 : 1.042);
        c.moveTo(cx + R * 1.03 * Math.cos(a), cy + R * 1.03 * Math.sin(a));
        c.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      }
      c.stroke();
      for (const o of orbs) {
        const a = o.a + time * o.s;
        const x = cx + R * 1.085 * Math.cos(a), y = cy + R * 1.085 * Math.sin(a), r = R * 0.021;
        const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
        g.addColorStop(0, pal.orb[0]); g.addColorStop(1, pal.orb[1]);
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        c.strokeStyle = pal.gold; c.lineWidth = 1; c.stroke();
        c.lineWidth = 0.6; c.beginPath(); c.arc(x, y, r * 1.75, 0, TAU); c.stroke();
      }

      // Branches, thickest first.
      for (let d = 0; d < byDepth.length; d++) {
        c.beginPath();
        for (const b of byDepth[d]) {
          const q = b.pts; c.moveTo(q[0], q[1]);
          for (let i = 1; i <= SEG; i++) c.lineTo(q[i * 2], q[i * 2 + 1]);
        }
        c.strokeStyle = pal.line[d]; c.lineWidth = LINE_W[d] * s; c.stroke();
      }
      // Beads at forks.
      c.fillStyle = pal.bead; c.beginPath();
      for (const b of branches) {
        if (!b.kids) continue;
        const x = b.pts[SEG * 2], y = b.pts[SEG * 2 + 1], r = (b.depth < 2 ? 2.6 : 1.9) * s;
        c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
      }
      c.fill();
      // Foliage shrinks to nothing as a branch becomes a trace.
      for (let k = 0; k < 3; k++) {
        c.fillStyle = pal.leaf[k]; c.beginPath();
        for (const b of branches) for (const l of b.leaves) {
          if (l.k !== k) continue;
          const t = b.tt[l.i], r = l.rad * R * (1 - t);
          if (r < 0.35) continue;
          const x = b.pts[l.i * 2] + l.dx * R * (1 - t * 0.7), y = b.pts[l.i * 2 + 1] + l.dy * R * (1 - t * 0.7);
          c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
        }
        c.fill();
      }
      // Terminal nodes appear as a branch becomes a trace.
      c.strokeStyle = pal.via; c.lineWidth = 1; c.beginPath();
      for (const b of tips) {
        const r = 3.4 * s * b.tt[SEG]; if (r < 0.4) continue;
        const x = b.pts[SEG * 2], y = b.pts[SEG * 2 + 1]; c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
      }
      c.stroke();
      c.fillStyle = pal.viaCore; c.beginPath();
      for (const b of tips) {
        const r = 1.5 * s * b.tt[SEG]; if (r < 0.3) continue;
        const x = b.pts[SEG * 2], y = b.pts[SEG * 2 + 1]; c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
      }
      c.fill();
      // Signals travelling outward along the traces.
      if (art) {
        c.save();
        c.shadowColor = 'rgba(255,225,150,.9)'; c.shadowBlur = 9 * s; c.fillStyle = '#fff4d2';
        for (const pu of pulses) {
          const f = pu.u * pu.chain.length;
          const b = pu.chain[Math.min(pu.chain.length - 1, Math.floor(f))];
          const g = (f - Math.floor(f)) * SEG, i = Math.min(SEG - 1, Math.floor(g)), fr = g - i;
          const a = b.tt[i] * Math.sin(Math.PI * pu.u);
          if (a < 0.05) continue;
          c.globalAlpha = a; c.beginPath();
          c.arc(b.pts[i * 2] + (b.pts[i * 2 + 2] - b.pts[i * 2]) * fr, b.pts[i * 2 + 1] + (b.pts[i * 2 + 3] - b.pts[i * 2 + 1]) * fr, 1.9 * s, 0, TAU);
          c.fill();
        }
        c.restore();
      }

      drawHalo(c, pal);
      if (faceImg[p.world]) drawFaceImage(c, faceImg[p.world], pal); else drawFace(c, pal, art);
    }

    function drawHalo(c, pal) {
      const { cx, cy, R, rot, s } = G;
      c.fillStyle = pal.disc; c.beginPath(); c.arc(cx, cy, R * 0.372, 0, TAU); c.fill();
      c.strokeStyle = pal.gold; c.lineWidth = 1.6 * s; c.stroke();
      const g = c.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 0.358);
      g.addColorStop(0, pal.enamel[1]); g.addColorStop(0.5, pal.enamel[0]); g.addColorStop(1, pal.enamel[1]);
      c.fillStyle = g; c.beginPath();
      c.arc(cx, cy, R * 0.358, 0, TAU); c.arc(cx, cy, R * 0.3, 0, TAU, true); c.fill();
      c.strokeStyle = pal.gold; c.lineWidth = 1 * s;
      c.beginPath(); c.arc(cx, cy, R * 0.358, 0, TAU); c.stroke();
      c.beginPath(); c.arc(cx, cy, R * 0.3, 0, TAU); c.stroke();

      // Rosette that squares off into a gear.
      const K = 26, N = 720;
      for (let row = 0; row < 2; row++) {
        c.beginPath();
        for (let i = 0; i <= N; i++) {
          const th = (i / N) * TAU, a = th - rot * 3 + (row ? Math.PI / K : 0);
          const t = field(cx + R * 0.33 * Math.cos(a));
          const sn = Math.abs(Math.sin((K * th) / 2));
          const petal = Math.pow(sn, 0.75), tooth = clamp01((sn - 0.42) * 6);
          const w = petal + (tooth - petal) * t;
          const r = R * ((row ? 0.307 : 0.312) + (row ? 0.022 : 0.036) * w);
          const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.strokeStyle = row ? pal.gold : pal.goldHi; c.lineWidth = (row ? 0.8 : 1.2) * s; c.stroke();
      }

      // Inner field: pearls and a sunburst behind the head.
      c.fillStyle = pal.goldHi; c.beginPath();
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU + rot * 2, x = cx + R * 0.286 * Math.cos(a), y = cy + R * 0.286 * Math.sin(a), r = R * 0.0042;
        c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
      }
      c.fill();
      c.strokeStyle = pal.ray; c.lineWidth = 0.8;
      c.beginPath();
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * TAU + rot * 2, r0 = R * 0.1, r1 = R * (i % 2 ? 0.245 : 0.272);
        c.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)); c.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      }
      c.stroke();
    }

    /* A rendered face can replace the drawn one: art/face-natural.* and art/face-artificial.*
       (square, face centred). It is set into the round field inside the halo. */
    const faceImg = {};
    for (const w of ['natural', 'artificial']) {
      const exts = ['webp', 'jpg', 'png'], im = new Image();
      let i = 0;
      im.onload = () => { faceImg[w] = im; if (!running) renderOnce(); };
      im.onerror = () => { if (++i < exts.length) im.src = `/art/face-${w}.${exts[i]}`; };
      im.src = `/art/face-${w}.${exts[0]}`;
    }
    function drawFaceImage(c, im, pal) {
      const { cx, cy, R, s } = G, r = R * 0.298;
      const k = Math.max((2 * r) / im.naturalWidth, (2 * r) / im.naturalHeight);
      c.save();
      c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
      c.drawImage(im, cx - (im.naturalWidth * k) / 2, cy - (im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
      c.restore();
      c.strokeStyle = pal.gold; c.lineWidth = 1.2 * s; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
    }

    /* The face, in a unit space where the head runs from y = -1 (crown) to y = 1 (chin). */
    function headPath(c) {
      c.beginPath(); c.moveTo(0, -1);
      c.bezierCurveTo(0.42, -1.02, 0.7, -0.72, 0.7, -0.3);
      c.bezierCurveTo(0.7, 0.1, 0.6, 0.48, 0.39, 0.78);
      c.bezierCurveTo(0.27, 0.94, 0.12, 1, 0, 1);
      c.bezierCurveTo(-0.12, 1, -0.27, 0.94, -0.39, 0.78);
      c.bezierCurveTo(-0.6, 0.48, -0.7, 0.1, -0.7, -0.3);
      c.bezierCurveTo(-0.7, -0.72, -0.42, -1.02, 0, -1);
      c.closePath();
    }
    function featurePath(c) {
      c.beginPath();
      for (const m of [1, -1]) {
        c.moveTo(0.06 * m, -0.16); c.bezierCurveTo(0.18 * m, -0.3, 0.42 * m, -0.33, 0.57 * m, -0.2);     // brow
        c.moveTo(0.19 * m, -0.06); c.quadraticCurveTo(0.36 * m, 0.035, 0.53 * m, -0.07);                 // closed lid
        c.moveTo(0.06 * m, -0.16); c.lineTo(0.085 * m, 0.27);                                            // nose ridge
        c.bezierCurveTo(0.19 * m, 0.28, 0.19 * m, 0.39, 0.07 * m, 0.385); c.lineTo(0, 0.41);             // nostril
      }
      c.moveTo(-0.2, 0.61); c.quadraticCurveTo(-0.1, 0.555, 0, 0.588); c.quadraticCurveTo(0.1, 0.555, 0.2, 0.61); // upper lip
      c.moveTo(-0.2, 0.61); c.quadraticCurveTo(0, 0.652, 0.2, 0.61);                                               // parting
      c.moveTo(-0.13, 0.672); c.quadraticCurveTo(0, 0.74, 0.13, 0.672);                                            // lower lip
    }

    function drawFace(c, pal, art) {
      const { cx, cy, F, s } = G;
      const px1 = 1 / F;   // one screen pixel in face units
      c.save();
      c.translate(cx, cy); c.scale(F, F);

      if (!art) {
        // Carved ivory mask.
        c.save();
        c.shadowColor = 'rgba(60,42,20,.38)'; c.shadowBlur = 22 * s; c.shadowOffsetX = 5 * s; c.shadowOffsetY = 10 * s;
        const g = c.createLinearGradient(-0.7, -1, 0.7, 1);
        g.addColorStop(0, '#fffcf3'); g.addColorStop(0.55, '#ece2cc'); g.addColorStop(1, '#cfc0a0');
        headPath(c); c.fillStyle = g; c.fill();
        c.restore();
        c.strokeStyle = '#b7a37c'; c.lineWidth = px1; headPath(c); c.stroke();
        c.save(); headPath(c); c.clip();
        c.fillStyle = 'rgba(110,88,56,.11)';
        for (const m of [1, -1]) { c.beginPath(); c.ellipse(0.36 * m, -0.09, 0.23, 0.13, 0, 0, TAU); c.fill(); }
        c.beginPath(); c.moveTo(0.06, -0.16); c.lineTo(0.085, 0.27); c.lineTo(0.2, 0.34); c.lineTo(0.15, -0.08); c.closePath(); c.fill();
        c.beginPath(); c.ellipse(0, 0.86, 0.3, 0.1, 0, 0, TAU); c.fill();
        c.restore();
        c.save(); c.translate(1.3 * px1, 1.3 * px1); featurePath(c); c.strokeStyle = '#fffdf6'; c.lineWidth = 1.7 * px1 * s; c.stroke(); c.restore();
        featurePath(c); c.strokeStyle = '#75613f'; c.lineWidth = 1.35 * px1 * s; c.stroke();
        // Gold inlay: a line from the third eye to the bridge, and three beads under each eye.
        c.strokeStyle = pal.gold; c.lineWidth = px1;
        c.beginPath(); c.moveTo(0, -0.33); c.lineTo(0, -0.19); c.stroke();
        c.fillStyle = pal.goldHi; c.beginPath();
        for (const m of [1, -1]) for (let i = 0; i < 3; i++) { const y = 0.1 + i * 0.085, r = 0.017 - i * 0.003; c.moveTo(0.36 * m + r, y); c.arc(0.36 * m, y, r, 0, TAU); }
        c.fill();
      } else {
        // Gilded wire mask.
        c.save();
        c.shadowColor = 'rgba(217,182,110,.45)'; c.shadowBlur = 18 * s;
        const g = c.createRadialGradient(0, -0.3, 0.1, 0, 0, 1.1);
        g.addColorStop(0, '#17402f'); g.addColorStop(1, '#06120d');
        headPath(c); c.fillStyle = g; c.fill();
        c.restore();
        c.strokeStyle = pal.gold; c.lineWidth = 1.5 * px1 * s; headPath(c); c.stroke();
        c.globalAlpha = 0.32;
        for (const k of [0.9, 0.8]) { c.save(); c.scale(k, k); c.lineWidth = (0.8 * px1) / k; headPath(c); c.stroke(); c.restore(); }
        c.globalAlpha = 1;
        // Cheek dials and traces.
        c.lineWidth = px1;
        for (const m of [1, -1]) {
          const x = 0.385 * m, y = 0.2;
          c.beginPath(); c.arc(x, y, 0.135, 0, TAU); c.moveTo(x + 0.07, y); c.arc(x, y, 0.07, 0, TAU);
          for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.moveTo(x + 0.105 * Math.cos(a), y + 0.105 * Math.sin(a)); c.lineTo(x + 0.135 * Math.cos(a), y + 0.135 * Math.sin(a)); }
          c.moveTo(x, y + 0.135); c.lineTo(x, 0.5); c.lineTo(0.2 * m, 0.8);
          c.moveTo(x + 0.135 * m, y); c.lineTo(0.62 * m, y); c.lineTo(0.66 * m, y - 0.16);
          c.moveTo(0.57 * m, -0.2); c.lineTo(0.64 * m, -0.34);
          c.stroke();
          c.save(); c.shadowColor = pal.pupil; c.shadowBlur = 8 * s; c.fillStyle = pal.pupil;
          c.beginPath(); c.arc(x, y, 0.028, 0, TAU); c.fill();
          c.beginPath(); c.arc(0.2 * m, 0.8, 0.018, 0, TAU); c.fill();
          c.restore();
        }
        c.setLineDash([px1 * 1.5, px1 * 4]);
        c.beginPath(); c.moveTo(0, -0.3); c.lineTo(0, -0.18); c.moveTo(0, 0.76); c.lineTo(0, 0.98); c.stroke();
        c.setLineDash([]);
        featurePath(c); c.strokeStyle = pal.goldHi; c.lineWidth = 1.3 * px1 * s; c.stroke();
        // A line of light under each closed lid.
        c.save(); c.shadowColor = pal.pupil; c.shadowBlur = 7 * s; c.strokeStyle = pal.pupil; c.lineWidth = px1;
        c.beginPath();
        for (const m of [1, -1]) { c.moveTo(0.22 * m, -0.025); c.quadraticCurveTo(0.36 * m, 0.06, 0.5 * m, -0.035); }
        c.stroke(); c.restore();
      }

      // The third eye: open, follows the pointer, blinks.
      const ey = -0.56;
      c.strokeStyle = pal.gold; c.lineWidth = px1;
      c.beginPath(); c.arc(0, ey, 0.235, 0, TAU);
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, r0 = 0.235, r1 = i % 2 ? 0.26 : 0.285; c.moveTo(r0 * Math.cos(a), ey + r0 * Math.sin(a)); c.lineTo(r1 * Math.cos(a), ey + r1 * Math.sin(a)); }
      c.stroke();
      const cyc = time % 6.5;
      const blink = reduced ? 1 : 1 - Math.exp(-Math.pow((cyc - 6.2) / 0.09, 2));
      const aw = 0.185, ah = 0.085 * Math.max(0.04, blink);
      let lx = 0, ly = 0;
      if (px !== null) {
        const dx = px - G.eyeX, dy = py - G.eyeY, d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / (G.R * 1.2));
        lx = (dx / d) * m * 0.055; ly = (dy / d) * m * 0.022;
      }
      c.beginPath();
      c.moveTo(-aw, ey); c.quadraticCurveTo(0, ey - ah * 2.1, aw, ey); c.quadraticCurveTo(0, ey + ah * 2.1, -aw, ey); c.closePath();
      c.fillStyle = pal.eyeWhite; c.fill();
      c.save(); c.clip();
      c.fillStyle = pal.iris; c.beginPath(); c.arc(lx, ey + ly, 0.078, 0, TAU); c.fill();
      if (art) { c.shadowColor = pal.pupil; c.shadowBlur = 10 * s; }
      c.fillStyle = pal.pupil; c.beginPath(); c.arc(lx, ey + ly, 0.036, 0, TAU); c.fill();
      c.restore();
      c.strokeStyle = pal.gold; c.lineWidth = 1.2 * px1 * s; c.stroke();
      c.restore();
    }

    /* ----- Loop ----- */
    const hasArt = p => p.el.classList.contains('has-' + p.world);   // an image has replaced the drawing
    const visiblePanes = () => (state === 'chosen' ? panes.filter(p => p.world === world) : panes).filter(p => !hasArt(p));
    function renderOnce() { computeGeometry(); for (const p of visiblePanes()) draw(p); }
    function frame(now) {
      if (!running) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0));   // the first frame can predate start()
      last = now; time += dt;
      if (state === 'threshold') {
        const target = W / 2 - (px !== null ? (px - W / 2) * 0.36 : 0) + Math.sin(time * 0.55) * W * 0.012;
        split += (target - split) * Math.min(1, dt * 4.5);
        hero.style.setProperty('--split', split.toFixed(1) + 'px');
        root.style.setProperty('--split', split.toFixed(1) + 'px');
      } else if (commit) {
        const p = clamp01((now - commit.t0) / commit.dur);
        split = commit.from + (commit.to - commit.from) * ease(p);
        hero.style.setProperty('--split', split.toFixed(1) + 'px');
        root.style.setProperty('--split', split.toFixed(1) + 'px');
        if (p >= 1) finishCommit();
      }
      if (morph) {
        const p = clamp01((now - morph.t0) / morph.dur);
        M = morph.from + (morph.to - morph.from) * ease(p);
        if (p >= 1) morph = null;
      }
      for (const pu of pulses) { pu.u += dt * pu.speed; if (pu.u >= 1) newPulse(pu); }
      renderOnce();
      requestAnimationFrame(frame);
    }
    function start() { if (running || reduced || !onScreen || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
    function stop() { running = false; }

    /* ----- Choosing a world at the threshold ----- */
    function choose(w) {
      if (state !== 'threshold') return;
      world = w; root.dataset.world = w;
      commit = { world: w, from: split, to: w === 'natural' ? W + band + 24 : -band - 24, t0: performance.now(), dur: 1350 };
      state = 'committing'; root.dataset.state = 'committing';
      remember(w);
      onWorld.forEach(f => f(w));
      if (location.search) history.replaceState(null, '', location.pathname);
      if (reduced || !running) finishCommit();
      else setTimeout(() => { if (commit) finishCommit(); }, commit.dur + 400);   // if frames are throttled
    }
    function finishCommit() {
      if (state === 'chosen') return;
      commit = null;
      state = 'chosen'; root.dataset.state = 'chosen';
      M = world === 'artificial' ? 1 : 0;
      hero.style.removeProperty('--split');
      root.style.removeProperty('--split');
      if (sw) sw.setAttribute('aria-checked', String(world === 'artificial'));
      if (!running) renderOnce();
    }

    onWorldAnimated.push(w => {
      const target = w === 'artificial' ? 1 : 0;
      if (reduced) { M = target; return; }
      morph = { from: M, to: target, t0: performance.now(), dur: 1600 };
      start();
    });
    onWorld.push(() => { if (state === 'chosen') renderOnce(); });

    /* ----- Wiring ----- */
    const overEye = () => px !== null && Math.hypot(px - G.eyeX, py - G.eyeY) < G.eyeR * 1.15;
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      px = e.clientX - r.left; py = e.clientY - r.top;
      hero.classList.toggle('on-eye', state === 'chosen' && overEye());
    });
    hero.addEventListener('pointerleave', () => { px = py = null; hero.classList.remove('on-eye'); });

    // Three clicks on the third eye open the cabinet.
    let eyeClicks = 0, eyeTimer = 0;
    hero.addEventListener('click', e => {
      const r = hero.getBoundingClientRect();
      if (state === 'threshold') {
        const btn = e.target.closest('[data-choose]');
        return choose(btn ? btn.dataset.choose : e.clientX - r.left < split ? 'natural' : 'artificial');
      }
      if (state !== 'chosen') return;
      px = e.clientX - r.left; py = e.clientY - r.top;
      if (!overEye()) return;
      clearTimeout(eyeTimer);
      if (++eyeClicks >= 3) { location.href = hero.dataset.cabinet || 'cabinet.html'; return; }
      eyeTimer = setTimeout(() => { eyeClicks = 0; }, 2500);
    });

    new IntersectionObserver(es => { onScreen = es[0].isIntersecting; onScreen ? start() : stop(); }).observe(hero);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    // The hero's box can change without a window resize (toolbars, late layout), which would stretch the drawing.
    new ResizeObserver(resize).observe(hero);

    // Test hook: ?t=12 freezes the figure at a given time for screenshots.
    const frozen = new URLSearchParams(location.search).get('t');
    if (frozen !== null) { time = parseFloat(frozen) || 0; fx = state === 'chosen' && innerWidth >= 900 ? (world === 'artificial' ? 0.34 : 0.66) : 0.5; }
    resize();
    if (frozen === null) start(); else renderOnce();
  }

  /* ================= 3. The landscape plate ================= */

  document.querySelectorAll('canvas.landscape').forEach(cv => {
    const c = cv.getContext('2d');
    const RIDGES = 9, FIG_RIDGE = 5;
    const rnd = mulberry32(88);
    const motes = Array.from({ length: 26 }, () => ({ x: rnd(), y: 0.2 + rnd() * 0.6, r: 0.6 + rnd() * 2.2, s: 0.004 + rnd() * 0.012, ph: rnd() * TAU }));
    let W = 0, H = 0, DPR = 1, time = 0, last = 0, running = false, visible = false;

    const NAT = ['#d5d8c0', '#bfc8ab', '#a4b594', '#86a17f', '#688c6c', '#4d775a', '#3a624b', '#2c4f3e', '#213d30'];
    function resize() {
      const r = cv.getBoundingClientRect();
      W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      draw();
    }
    function ridgeY(x, j) {
      const u = x / W, f = 1 + j * 0.33;
      const h = Math.sin(u * TAU * 1.1 * f + j * 1.7 + time * 0.012 * (j + 1)) * 0.5
        + Math.sin(u * TAU * 2.3 * f + j * 4.1) * 0.28
        + Math.sin(u * TAU * 5.3 * f + j * 2.3 + time * 0.03) * 0.12;
      return H * (0.42 + 0.062 * j) - H * (0.03 + 0.011 * j) * h;
    }
    function ridge(j) {
      c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W + 6; x += 6) c.lineTo(x, ridgeY(x, j));
      c.lineTo(W, H); c.closePath();
    }
    function draw() {
      if (!W) return;
      const art = root.dataset.world === 'artificial';
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      c.clearRect(0, 0, W, H);
      const sky = c.createLinearGradient(0, 0, 0, H);
      if (art) { sky.addColorStop(0, '#050d0a'); sky.addColorStop(0.6, '#0c2018'); sky.addColorStop(1, '#07110d'); }
      else { sky.addColorStop(0, '#f3ecda'); sky.addColorStop(0.5, '#ebe6d0'); sky.addColorStop(1, '#dfe0c8'); }
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      // Sun (natural) or target (artificial)
      const sx = W * 0.7, sy = H * 0.34, sr = Math.min(W, H) * 0.2;
      if (art) {
        c.strokeStyle = 'rgba(217,182,110,.55)'; c.lineWidth = 1;
        for (let i = 1; i <= 5; i++) { c.globalAlpha = 0.9 - i * 0.14; c.beginPath(); c.arc(sx, sy, (sr * i) / 4, 0, TAU); c.stroke(); }
        c.globalAlpha = 0.5; c.beginPath(); c.moveTo(sx - sr * 1.5, sy); c.lineTo(sx + sr * 1.5, sy); c.moveTo(sx, sy - sr * 1.5); c.lineTo(sx, sy + sr * 1.5); c.stroke();
        c.globalAlpha = 1;
        c.fillStyle = 'rgba(240,216,150,.5)';
        for (let i = 0; i < 16; i++) for (let j = 0; j < 5; j++) c.fillRect((W / 16) * (i + 0.5), ((H * 0.4) / 5) * (j + 0.5), 1, 1);
      } else {
        const g = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.2);
        g.addColorStop(0, 'rgba(255,252,238,1)'); g.addColorStop(0.42, 'rgba(250,240,205,.75)'); g.addColorStop(1, 'rgba(250,240,205,0)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.strokeStyle = 'rgba(150,119,58,.6)'; c.lineWidth = 1; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.stroke();
        c.strokeStyle = 'rgba(150,119,58,.28)'; c.beginPath(); c.arc(sx, sy, sr * 1.18, 0, TAU); c.stroke();
      }
      // Ridges, far to near
      for (let j = 0; j < RIDGES; j++) {
        ridge(j);
        if (art) {
          c.fillStyle = '#07110d'; c.fill();
          c.strokeStyle = `rgba(217,182,110,${0.16 + j * 0.075})`; c.lineWidth = 1; c.stroke();
        } else {
          c.fillStyle = NAT[j]; c.fill();
          const m = c.createLinearGradient(0, H * (0.4 + 0.062 * j), 0, H * (0.52 + 0.062 * j));
          m.addColorStop(0, 'rgba(243,236,218,0)'); m.addColorStop(1, `rgba(243,236,218,${0.3 - j * 0.03})`);
          c.fillStyle = m; c.fill();
        }
        if (j === FIG_RIDGE) figure(art);
      }
      // Pollen (natural) or lights (artificial)
      for (const m of motes) {
        const x = ((m.x + time * m.s) % 1) * W, y = H * m.y + Math.sin(time * 0.4 + m.ph) * 8;
        c.save();
        if (art) { c.shadowColor = '#56d6a0'; c.shadowBlur = 10; c.fillStyle = `rgba(210,255,235,${0.35 + 0.4 * Math.abs(Math.sin(time * 0.5 + m.ph))})`; }
        else c.fillStyle = 'rgba(184,150,80,.55)';
        c.beginPath(); c.arc(x, y, art ? m.r * 0.9 : m.r * 0.7, 0, TAU); c.fill(); c.restore();
      }
    }
    function figure(art) {
      const x = W * 0.3, y = ridgeY(x, FIG_RIDGE) + 2, h = Math.max(26, H * 0.085);
      c.save();
      if (art) { c.shadowColor = '#7dffc8'; c.shadowBlur = 22; c.fillStyle = '#eafff4'; }
      else c.fillStyle = '#16261e';
      c.beginPath(); c.arc(x, y - h * 0.9, h * 0.085, 0, TAU); c.fill();
      c.beginPath();
      c.moveTo(x - h * 0.1, y - h * 0.78); c.quadraticCurveTo(x, y - h * 0.84, x + h * 0.1, y - h * 0.78);
      c.lineTo(x + h * 0.06, y); c.lineTo(x - h * 0.06, y); c.closePath(); c.fill();
      c.restore();
    }
    function frame(now) {
      if (!running) return;
      time += Math.max(0, Math.min(0.05, (now - last) / 1000 || 0)); last = now;
      draw(); requestAnimationFrame(frame);
    }
    const go = () => { if (running || reduced || !visible || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(frame); };
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) go(); else running = false; }).observe(cv);
    document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else go(); });
    new ResizeObserver(resize).observe(cv);
    onWorld.push(draw);
    resize();
  });

  /* ================= 4. Sigils ================= */

  function sigil(seed) {
    const r = mulberry32(hash(seed));
    const pick = a => a[Math.floor(r() * a.length)];
    const f = n => n.toFixed(2);
    const poly = (k, rad, rot) => 'M' + Array.from({ length: k }, (_, i) => { const a = rot + (i / k) * TAU; return f(rad * Math.cos(a)) + ' ' + f(rad * Math.sin(a)); }).join('L') + 'Z';
    let s = '<circle r="54"/>';
    const n = pick([12, 16, 24, 36]);
    if (r() < 0.5) {
      s += '<circle r="47"/><path d="' + Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return `M${f(47 * Math.cos(a))} ${f(47 * Math.sin(a))}L${f(54 * Math.cos(a))} ${f(54 * Math.sin(a))}`; }).join('') + '"/>';
    } else {
      s += Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return `<circle class="dot" cx="${f(48 * Math.cos(a))}" cy="${f(48 * Math.sin(a))}" r="1.5"/>`; }).join('');
    }
    const k = pick([3, 4, 5, 6, 8]), rot = -Math.PI / 2;
    const mid = pick(['poly', 'star', 'petals', 'rays']);
    if (mid === 'poly') s += `<path d="${poly(k, 40, rot)}"/>`;
    else if (mid === 'star') s += `<path d="${poly(k, 40, rot)}"/><path d="${poly(k, 40, rot + Math.PI / k)}"/>`;
    else if (mid === 'petals') s += Array.from({ length: k }, (_, i) => `<ellipse rx="8" ry="19" cy="-22" transform="rotate(${f((i / k) * 360)})"/>`).join('');
    else s += '<path d="' + Array.from({ length: k * 2 }, (_, i) => { const a = rot + (i / (k * 2)) * TAU, r1 = i % 2 ? 30 : 41; return `M${f(18 * Math.cos(a))} ${f(18 * Math.sin(a))}L${f(r1 * Math.cos(a))} ${f(r1 * Math.sin(a))}`; }).join('') + '"/>';
    const core = pick(['eye', 'spiral', 'moon', 'rings', 'orbit', 'tri']);
    if (core === 'eye') s += '<path d="M-14 0Q0 -11 14 0Q0 11 -14 0Z"/><circle r="4.5"/><circle class="dot" r="1.6"/>';
    else if (core === 'spiral') s += '<path d="M0 0a2 2 0 0 1 4 0a4 4 0 0 1-8 0a6 6 0 0 1 12 0a8 8 0 0 1-16 0a10 10 0 0 1 20 0a12 12 0 0 1-24 0"/>';
    else if (core === 'moon') s += '<path d="M6 10.5A11 11 0 1 1 3-10.6a8.5 8.5 0 0 0 3 21.1z"/>';
    else if (core === 'rings') s += '<circle r="13"/><circle r="7"/><circle class="dot" r="1.8"/>';
    else if (core === 'orbit') s += '<circle r="12"/><circle cx="12" r="3.5"/><circle class="dot" r="2"/>';
    else s += `<path d="${poly(3, 14, rot)}"/><circle r="5"/>`;
    return `<svg viewBox="-60 -60 120 120" aria-hidden="true">${s}</svg>`;
  }
  document.querySelectorAll('[data-sigil]').forEach(el => { el.innerHTML = sigil(el.dataset.sigil); });

  /* ================= 5. The spiral disc ================= */

  function disc() {
    const f = n => n.toFixed(1);
    let s = '';
    [62, 88, 114, 140, 166].forEach((R, bi) => {
      const n = Math.floor((TAU * R) / 27), cell = 11;
      let g = '';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, bx = R * Math.cos(a), by = R * Math.sin(a), dir = i % 2 ? 1 : -1;
        let d = '';
        for (let k = 0; k <= 26; k++) {
          const u = k / 26, th = a + dir * u * TAU * 1.9, rr = cell * (1 - u * 0.92);
          d += (k ? 'L' : 'M') + f(bx + rr * Math.cos(th)) + ' ' + f(by + rr * Math.sin(th));
        }
        g += `<path d="${d}"/>`;
      }
      s += `<g class="band" style="--dur:${180 + bi * 60}s;--dir:${bi % 2 ? 'reverse' : 'normal'}">${g}</g><circle r="${R + 13}"/>`;
    });
    let rays = '';
    for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU, r1 = i % 2 ? 40 : 46; rays += `M${f(17 * Math.cos(a))} ${f(17 * Math.sin(a))}L${f(r1 * Math.cos(a))} ${f(r1 * Math.sin(a))}`; }
    s += `<circle r="49"/><path class="thin" d="${rays}"/><path class="eye" d="M-13 0Q0 -9.5 13 0Q0 9.5 -13 0Z"/><circle class="iris" r="4.6"/><circle class="dot" r="1.8"/>`;
    return `<svg viewBox="-184 -184 368 368" aria-hidden="true">${s}</svg>`;
  }
  const discEls = document.querySelectorAll('.disc');
  if (discEls.length) { const svg = disc(); discEls.forEach(el => { el.innerHTML = svg; }); }

  /* ================= 6. The scroll rail ================= */

  const rail = document.querySelector('.rail');
  if (rail) {
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      rail.style.setProperty('--p', max > 0 ? clamp01(scrollY / max).toFixed(4) : '0');
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }
})();
