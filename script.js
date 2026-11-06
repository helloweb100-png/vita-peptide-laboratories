/* ==========================================================================
   Vita-Peptide Laboratories · script.js
   - Sin dependencias obligatorias: las escenas 3D están hechas en canvas 2D.
   - anime.js (opcional, cdnjs 3.2.2) solo mejora contadores y micro-animaciones.
   - Todo el contenido es visible aunque falle el JavaScript o la CDN.
   ========================================================================== */
(() => {
  'use strict';

  /* ======================================================================
     CONFIGURACIÓN DEL NEGOCIO
     Número de WhatsApp: 10 dígitos de México, solo números (sin +52 ni espacios).
     Mientras esté vacío, el botón flotante y el envío del formulario se ocultan.
     ====================================================================== */
  const WHATSAPP_NUMBER = '';
  const WHATSAPP_COUNTRY = '52';
  const DEFAULT_MESSAGE = 'Hola, vi la página de Vita-Peptide Laboratories y me gustaría recibir información y una cotización.';

  /* ======================================================================
     UTILIDADES
     ====================================================================== */
  const root = document.documentElement;
  root.classList.add('js');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const safe = (name, fn) => { try { fn(); } catch (err) { console.warn('[vita-peptide] ' + name + ':', err); } };
  const mulberry32 = seed => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let isReady = false;
  const readyCbs = [];
  const onReady = fn => (isReady ? safe('ready', fn) : readyCbs.push(fn));
  const setReady = () => {
    if (isReady) return;
    isReady = true;
    root.classList.add('is-ready');
    readyCbs.splice(0).forEach(fn => safe('ready', fn));
  };

  let revealedCount = 0;
  let heroScene = null;
  let storyScene = null;
  let contactScene = null;

  /* ======================================================================
     WHATSAPP
     ====================================================================== */
  const waDigits = String(WHATSAPP_NUMBER).replace(/\D/g, '');
  const waNumber = waDigits.length === 10 ? WHATSAPP_COUNTRY + waDigits : waDigits;
  const hasWA = waNumber.length >= 11 && waNumber.length <= 15;
  const waLink = msg => 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(msg || DEFAULT_MESSAGE);

  function initWhatsApp() {
    root.classList.toggle('has-wa', hasWA);
    root.classList.toggle('no-wa', !hasWA);
    $$('[data-wa]').forEach(a => {
      if (!hasWA) return; // sin número: los botones llevan a la sección de contacto
      a.href = waLink(a.dataset.waMsg);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
    const float = $('#wa-float');
    if (float) float.hidden = !hasWA;
    $$('[data-wa-only]').forEach(el => { el.hidden = !hasWA; });
    $$('[data-wa-fallback]').forEach(el => { el.hidden = hasWA; });
  }

  /* ======================================================================
     CARGADOR (máximo ~2 s; además hay un respaldo en CSS)
     ====================================================================== */
  function initLoader() {
    const el = $('#cargador');
    if (!el) { setReady(); return; }
    const pct = $('[data-loader-pct]', el);
    const bar = $('.loader__bar i', el);
    const DUR = reduced ? 450 : 1700;
    const t0 = performance.now();
    const finish = () => {
      if (el.classList.contains('is-done')) return;
      el.classList.add('is-done');
      setReady();
      setTimeout(() => { el.hidden = true; }, 520);
    };
    const tick = now => {
      const t = clamp((now - t0) / DUR);
      const e = easeOut(t);
      if (pct) pct.textContent = String(Math.round(e * 100)).padStart(3, '0');
      if (bar) bar.style.transform = 'scaleX(' + e.toFixed(3) + ')';
      if (t < 1) requestAnimationFrame(tick); else finish();
    };
    requestAnimationFrame(tick);
    setTimeout(finish, reduced ? 700 : 1900);
  }

  /* ======================================================================
     ENCABEZADO Y MENÚ MÓVIL
     ====================================================================== */
  function initHeader() {
    const burger = $('.burger');
    const nav = $('#menu');
    const header = $('.site-header');
    if (!burger || !nav || !header) return;
    const setOpen = open => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      nav.classList.toggle('is-open', open);
      header.classList.toggle('menu-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false); });
    const mq = window.matchMedia('(min-width: 1060px)');
    if (mq.addEventListener) mq.addEventListener('change', () => setOpen(false));
  }

  /* ======================================================================
     REVEAL AL HACER SCROLL + TEXTO DIVIDIDO POR PALABRAS
     ====================================================================== */
  function splitWords(el) {
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    let idx = 0;
    const walk = node => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            w.setAttribute('aria-hidden', 'true');
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.style.setProperty('--i', String(idx++));
            wi.textContent = part;
            w.appendChild(wi);
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
    el.setAttribute('aria-label', label);
  }

  function runCount(el) {
    const end = Number(el.dataset.count);
    if (!end) return;
    el.textContent = '0';
    if (window.anime) {
      const o = { v: 0 };
      window.anime({ targets: o, v: end, round: 1, duration: 1600, easing: 'easeOutExpo', update: () => { el.textContent = String(o.v); } });
    } else {
      const t0 = performance.now();
      const step = now => {
        const t = clamp((now - t0) / 1400);
        el.textContent = String(Math.round(end * easeOut(t)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }

  function initReveal() {
    $$('[data-split]').forEach(splitWords);
    const targets = $$('[data-reveal], [data-split]');
    const pending = new Set();
    const show = el => { el.classList.add('is-in'); revealedCount += 1; };
    if (!('IntersectionObserver' in window)) { targets.forEach(show); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        if (isReady) show(en.target); else pending.add(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(t => io.observe(t));
    onReady(() => { pending.forEach(show); pending.clear(); });

    const counters = $$('[data-count]');
    if (counters.length) {
      const co = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) { co.unobserve(en.target); runCount(en.target); } });
      }, { threshold: 0.6 });
      counters.forEach(c => co.observe(c));
    }

    // Seguro: si por alguna razón nada se reveló, se muestra todo el contenido.
    setTimeout(() => { if (revealedCount === 0) root.classList.add('reveal-all'); }, 5000);
  }

  /* ======================================================================
     TEXTO QUE SE ESCRIBE (hero)
     ====================================================================== */
  function initTyper() {
    const el = $('[data-typer]');
    if (!el || reduced) return;
    const words = el.dataset.typer.split('|');
    let wi = 0;
    let ci = words[0].length;
    let deleting = true;
    const tick = () => {
      if (deleting) {
        ci -= 1;
        el.textContent = words[wi].slice(0, Math.max(ci, 0));
        if (ci <= 0) { deleting = false; wi = (wi + 1) % words.length; setTimeout(tick, 260); return; }
        setTimeout(tick, 45);
      } else {
        ci += 1;
        el.textContent = words[wi].slice(0, ci);
        if (ci >= words[wi].length) { deleting = true; setTimeout(tick, 1700); return; }
        setTimeout(tick, 85);
      }
    };
    onReady(() => setTimeout(tick, 1800));
  }

  /* ======================================================================
     ESCENA 3D DEL HERO: jaula molecular (dos icosaedros anidados) en canvas 2D
     ====================================================================== */
  function icosahedron() {
    const P = (1 + Math.sqrt(5)) / 2;
    const raw = [[0, 1, P], [0, -1, P], [0, 1, -P], [0, -1, -P], [1, P, 0], [-1, P, 0], [1, -P, 0], [-1, -P, 0], [P, 0, 1], [-P, 0, 1], [P, 0, -1], [-P, 0, -1]];
    const len = Math.hypot(1, P);
    const v = raw.map(p => p.map(c => c / len));
    const e = [];
    for (let i = 0; i < 12; i++) {
      for (let j = i + 1; j < 12; j++) {
        const d = Math.hypot(raw[i][0] - raw[j][0], raw[i][1] - raw[j][1], raw[i][2] - raw[j][2]);
        if (Math.abs(d - 2) < 0.01) e.push([i, j]);
      }
    }
    return { v, e };
  }

  class Lattice {
    constructor(canvas, opt = {}) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.dark = !!opt.dark;
      this.maxDpr = opt.maxDpr || 2;
      this.cxK = opt.cx !== undefined ? opt.cx : 0.5;
      this.cyK = opt.cy !== undefined ? opt.cy : 0.5;
      this.sK = opt.scale !== undefined ? opt.scale : 0.31;
      this.assemble = reduced ? 1 : 0;
      this.started = reduced;
      this.visible = true;
      this.mx = 0; this.my = 0; this.px = 0; this.py = 0;
      this.yaw = 0.6;
      this.pulses = [];
      this.nextPulse = 0.6;
      this.drawn = false;
      const g = icosahedron();
      this.outer = g.v;
      this.inner = g.v.map(p => p.map(c => c * 0.5));
      this.edgeList = [];
      g.e.forEach(([a, b]) => this.edgeList.push([0, a, b]));
      g.e.forEach(([a, b]) => this.edgeList.push([1, a, b]));
      for (let i = 0; i < 12; i++) this.edgeList.push([2, i, i]);
      this.pts = new Array(this.edgeList.length);
      const r = mulberry32(opt.seed || 11);
      this.dust = Array.from({ length: opt.dust !== undefined ? opt.dust : 46 }, () => {
        const u = r() * 2 - 1, a = r() * 6.283, rr = 1.35 + r() * 1.1, s = Math.sqrt(1 - u * u);
        return { p: [rr * s * Math.cos(a), rr * u, rr * s * Math.sin(a)], s: 0.7 + r() * 1.3, ph: r() * 6.28 };
      });
      this.resize();
      if ('ResizeObserver' in window) new ResizeObserver(() => this.resize()).observe(canvas);
      if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; }).observe(canvas);
    }

    resize() {
      // clientWidth/Height = tamaño de layout (no cambia con transformaciones de entrada como scale)
      const w = this.c.clientWidth, h = this.c.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
      this.w = w; this.h = h; this.dpr = dpr;
      this.c.width = Math.max(1, Math.round(w * dpr));
      this.c.height = Math.max(1, Math.round(h * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.drawn = false;
    }

    draw(t, dt, sy) {
      if (!this.visible || !this.w) return;
      if (reduced && this.drawn) return;
      this.drawn = true;
      const ctx = this.ctx, W = this.w, H = this.h;
      if (this.started && this.assemble < 1) this.assemble = Math.min(1, this.assemble + dt / 2.4);
      const asm = easeOut(this.assemble);
      this.px = lerp(this.px, this.mx, 0.05);
      this.py = lerp(this.py, this.my, 0.05);
      if (!reduced) this.yaw += dt * 0.2;
      const yaw = this.yaw + this.px * 0.8 + sy * 0.0008;
      const pitch = 0.4 + this.py * 0.45 + Math.sin(t * 0.35) * 0.07;
      const cx = W * this.cxK, cy = H * this.cyK, S = Math.min(W, H) * this.sK, F = 3.4;
      const sinP = Math.sin(pitch), cosP = Math.cos(pitch);
      const tr = (p, ry, k) => {
        const kk = (k === undefined ? 1 : k) * asm;
        const x = p[0] * kk, y = p[1] * kk, z = p[2] * kk;
        const c = Math.cos(ry), s = Math.sin(ry);
        const x1 = x * c + z * s, z1 = -x * s + z * c;
        const y1 = y * cosP - z1 * sinP, z2 = y * sinP + z1 * cosP;
        const sc = F / (F - z2);
        return [cx + x1 * sc * S, cy + y1 * sc * S, z2, sc];
      };
      const ink = this.dark ? '168,194,255' : '11,31,74';
      const green = this.dark ? '79,209,127' : '52,180,98';

      ctx.clearRect(0, 0, W, H);

      // Resplandor central
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 1.25);
      halo.addColorStop(0, 'rgba(' + green + ',' + (0.2 * asm).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(' + green + ',0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);

      const po = this.outer.map(p => tr(p, yaw));
      const pi = this.inner.map(p => tr(p, -yaw * 1.5 + 0.6));

      // Aristas
      ctx.lineCap = 'round';
      this.edgeList.forEach((e, k) => {
        const A = e[0] === 1 ? pi[e[1]] : po[e[1]];
        const B = e[0] === 0 ? po[e[2]] : pi[e[2]];
        this.pts[k] = [A[0], A[1], B[0], B[1]];
        const d = clamp(((A[2] + B[2]) / 2 + 1.1) / 2.2);
        const a = (e[0] === 0 ? 0.2 + 0.4 * d : e[0] === 1 ? 0.14 + 0.36 * d : 0.08 + 0.22 * d) * asm;
        ctx.strokeStyle = 'rgba(' + ink + ',' + a.toFixed(3) + ')';
        ctx.lineWidth = (e[0] === 0 ? 1.5 : 1.1) * (0.7 + d * 0.5);
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      });

      // Órbitas con electrones
      const orbit = (R, tilt, spin, k) => {
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        const place = a => {
          const p = [Math.cos(a) * R, 0, Math.sin(a) * R];
          return tr([p[0], p[1] * ct - p[2] * st, p[1] * st + p[2] * ct], yaw * spin);
        };
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) {
          const q = place(i / 72 * Math.PI * 2);
          if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
        }
        ctx.strokeStyle = 'rgba(' + ink + ',' + (0.14 * asm).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
        const q = place(t * (0.7 + k * 0.25) * (k % 2 ? -1 : 1) + k * 2);
        const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], 11 * q[3]);
        g.addColorStop(0, 'rgba(' + green + ',0.65)');
        g.addColorStop(1, 'rgba(' + green + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(q[0], q[1], 11 * q[3], 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(' + green + ',1)';
        ctx.beginPath(); ctx.arc(q[0], q[1], 3 * q[3], 0, 6.283); ctx.fill();
      };
      orbit(1.5, 1.15, 0.6, 0);
      orbit(1.28, -0.7, -0.9, 1);

      // Nodos ordenados por profundidad
      const nodes = [];
      po.forEach((p, i) => nodes.push({ x: p[0], y: p[1], z: p[2], r: 3.4 * p[3], g: i % 4 === 0, o: 1 }));
      pi.forEach((p, i) => nodes.push({ x: p[0], y: p[1], z: p[2], r: 2.5 * p[3], g: i % 5 === 2, o: 0.9 }));
      this.dust.forEach(d => {
        const q = tr(d.p, yaw * 0.5, 1 + 0.05 * Math.sin(t * 0.6 + d.ph));
        nodes.push({ x: q[0], y: q[1], z: q[2], r: d.s * q[3], g: false, o: 0.5, dust: true });
      });
      nodes.sort((a, b) => a.z - b.z);
      nodes.forEach(n => {
        const d = clamp((n.z + 1.6) / 3.2);
        const al = n.dust ? 0.14 + 0.36 * d : (0.55 + 0.45 * d) * n.o * (0.4 + 0.6 * asm);
        if (n.g) {
          const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
          g.addColorStop(0, 'rgba(' + green + ',' + (0.45 * al).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(' + green + ',0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 4, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = 'rgba(' + (n.g ? green : ink) + ',' + al.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(0.6, n.r), 0, 6.283); ctx.fill();
      });

      // Pulsos de señal que viajan por las aristas
      if (!reduced) {
        this.nextPulse -= dt;
        if (this.started && this.nextPulse <= 0 && this.pulses.length < 14) {
          this.pulses.push({ e: (Math.random() * this.edgeList.length) | 0, t: 0, sp: 0.55 + Math.random() * 0.7, dir: Math.random() < 0.5 ? 1 : -1 });
          this.nextPulse = 0.26 + Math.random() * 0.3;
        }
        this.pulses = this.pulses.filter(p => (p.t += dt * p.sp) < 1);
        this.pulses.forEach(p => {
          const q = this.pts[p.e];
          if (!q) return;
          const f = p.dir > 0 ? p.t : 1 - p.t;
          const f0 = clamp(f - 0.16 * p.dir);
          const x = lerp(q[0], q[2], f), y = lerp(q[1], q[3], f);
          const x0 = lerp(q[0], q[2], f0), y0 = lerp(q[1], q[3], f0);
          const fade = Math.sin(p.t * Math.PI);
          ctx.strokeStyle = 'rgba(' + green + ',' + (0.85 * fade).toFixed(3) + ')';
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
          const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
          g.addColorStop(0, 'rgba(' + green + ',' + (0.9 * fade).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(' + green + ',0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.283); ctx.fill();
        });
      }
    }
  }

  function initHero() {
    const hero = $('.hero');
    const canvas = $('.hero__canvas');
    if (canvas) {
      heroScene = new Lattice(canvas, { dust: window.innerWidth < 700 ? 30 : 48 });
      onReady(() => { heroScene.started = true; });
    }
    if (hero && fine) {
      hero.addEventListener('pointermove', e => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        hero.style.setProperty('--my', (e.clientY - r.top) + 'px');
        if (heroScene) {
          heroScene.mx = (e.clientX / window.innerWidth - 0.5) * 2;
          heroScene.my = (e.clientY / window.innerHeight - 0.5) * 2;
        }
      });
    }
  }

  function initContactScene() {
    const canvas = $('.contact__canvas');
    if (!canvas) return;
    contactScene = new Lattice(canvas, { dark: true, dust: 26, cx: 0.8, cy: 0.3, scale: 0.2, maxDpr: 1.5, seed: 23 });
    contactScene.started = true;
  }

  /* ======================================================================
     ESCENA "DEL AMINOÁCIDO A LA SEÑAL" (anclada al scroll)
     ====================================================================== */
  class StoryScene {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.visible = true;
      this.target = 0;
      this.phase = 0;
      this.N = 22;
      const r = mulberry32(7);
      this.free = Array.from({ length: this.N }, () => {
        const u = r() * 2 - 1, a = r() * 6.283, rr = Math.cbrt(r()) * 1.55, s = Math.sqrt(1 - u * u);
        return [rr * s * Math.cos(a), rr * u * 0.95, rr * s * Math.sin(a)];
      });
      // Receptor: copa de dos anillos + base
      this.recv = [];
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; this.recv.push([0.95 * Math.cos(a), 0.9, 0.95 * Math.sin(a)]); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.52; this.recv.push([0.52 * Math.cos(a), 1.22, 0.52 * Math.sin(a)]); }
      this.recv.push([0, 1.5, 0]);
      this.rEdges = [];
      for (let i = 0; i < 8; i++) this.rEdges.push([i, (i + 1) % 8]);
      for (let i = 0; i < 6; i++) this.rEdges.push([8 + i, 8 + (i + 1) % 6]);
      for (let i = 0; i < 8; i++) this.rEdges.push([i, 8 + (Math.round(i * 6 / 8) % 6)]);
      for (let i = 0; i < 6; i++) this.rEdges.push([8 + i, 14]);
      this.stars = Array.from({ length: 70 }, () => ({ x: r(), y: r(), s: 0.4 + r() * 1.1, ph: r() * 6.28 }));
      this.resize();
      if ('ResizeObserver' in window) new ResizeObserver(() => this.resize()).observe(canvas);
      if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; }).observe(canvas);
    }

    resize() {
      const w = this.c.clientWidth, h = this.c.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      this.w = w; this.h = h;
      this.c.width = Math.max(1, Math.round(w * dpr));
      this.c.height = Math.max(1, Math.round(h * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    helix(i, t) {
      const a = i * 0.74 + t * 0.35, R = 0.5 + 0.05 * Math.sin(i * 0.9 + t);
      return [R * Math.cos(a), (i / (this.N - 1) - 0.5) * 2.7, R * Math.sin(a)];
    }

    dock(i, t) {
      const a = i * 0.95 + t * 0.5;
      return [0.32 * Math.cos(a), 0.95 - (i / (this.N - 1)) * 1.05, 0.32 * Math.sin(a)];
    }

    drift(i, t) {
      const f = this.free[i];
      return [f[0] + 0.07 * Math.sin(t * 0.6 + i), f[1] + 0.07 * Math.cos(t * 0.5 + i * 1.3), f[2] + 0.07 * Math.sin(t * 0.4 + i * 0.7)];
    }

    draw(t, dt) {
      if (!this.visible || !this.w) return;
      this.phase = lerp(this.phase, this.target * 3, 1 - Math.exp(-dt * 5));
      const ph = this.phase, ctx = this.ctx, W = this.w, H = this.h, N = this.N;
      ctx.clearRect(0, 0, W, H);

      const wide = W >= 900;
      const cx = wide ? W * 0.68 : W * 0.5;
      const cy = wide ? H * 0.5 : H * 0.43;
      const S = wide ? Math.min(W * 0.2, H * 0.3) : Math.min(W * 0.24, H * 0.17);
      const F = 3.8, yaw = t * 0.14 + ph * 0.45, pitch = 0.3;
      const yOff = -0.62 * smooth(1, 2, ph);
      const cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch);
      const tr = p => {
        const x = p[0], y = p[1] + yOff, z = p[2];
        const x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
        const y1 = y * cP - z1 * sP, z2 = y * sP + z1 * cP;
        const sc = F / (F - z2);
        return [cx + x1 * sc * S, cy + y1 * sc * S, z2, sc];
      };

      // Estrellas de fondo
      this.stars.forEach(s => {
        const a = 0.12 + 0.2 * (0.5 + 0.5 * Math.sin(t * 0.8 + s.ph));
        ctx.fillStyle = 'rgba(190,210,255,' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.s, 0, 6.283); ctx.fill();
      });

      const BLUE = [170, 196, 255], GREEN = [79, 209, 127];
      const sig = smooth(2.3, 2.9, ph);
      const col = BLUE.map((c, i) => Math.round(lerp(c, GREEN[i], sig)));
      const rgb = 'rgb(' + col.join(',') + ')';
      const rgba = a => 'rgba(' + col.join(',') + ',' + a.toFixed(3) + ')';

      // Posiciones de los aminoácidos
      const raw = [], pos = [];
      for (let i = 0; i < N; i++) {
        const f = this.drift(i, t), h = this.helix(i, t), d = this.dock(i, t);
        let p;
        if (ph < 1) p = mix3(f, h, smooth(0, 1, ph));
        else if (ph < 2) p = mix3(h, d, smooth(1, 2, ph));
        else p = d;
        raw.push(p);
        pos.push(tr(p));
      }

      // Resplandor de la señal
      if (sig > 0.01) {
        const rc = tr([0, 1.05, 0]);
        const g = ctx.createRadialGradient(rc[0], rc[1], 0, rc[0], rc[1], S * 1.9);
        g.addColorStop(0, 'rgba(79,209,127,' + (0.34 * sig).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(79,209,127,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // Ondas de señal (fase 4)
      const wa = smooth(2.2, 2.8, ph);
      if (wa > 0.01) {
        for (let k = 0; k < 3; k++) {
          const r = (t * 0.45 + k / 3) % 1, R = 0.95 + r * 1.6;
          ctx.beginPath();
          for (let i = 0; i <= 64; i++) {
            const a = i / 64 * 6.283, q = tr([Math.cos(a) * R, 0.9, Math.sin(a) * R]);
            if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
          }
          ctx.strokeStyle = 'rgba(79,209,127,' + ((1 - r) * 0.5 * wa).toFixed(3) + ')';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Líneas de proximidad entre aminoácidos sueltos (fase 1)
      const pa = 1 - smooth(0.3, 1, ph);
      if (pa > 0.02) {
        ctx.lineWidth = 1;
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            const d = Math.hypot(raw[i][0] - raw[j][0], raw[i][1] - raw[j][1], raw[i][2] - raw[j][2]);
            if (d < 0.95) {
              ctx.strokeStyle = 'rgba(170,196,255,' + (pa * 0.22 * (1 - d / 0.95)).toFixed(3) + ')';
              ctx.beginPath(); ctx.moveTo(pos[i][0], pos[i][1]); ctx.lineTo(pos[j][0], pos[j][1]); ctx.stroke();
            }
          }
        }
      }

      // Cadena peptídica
      const ca = smooth(0.55, 1.1, ph);
      if (ca > 0.01) {
        ctx.lineWidth = 1.7; ctx.lineCap = 'round';
        ctx.strokeStyle = rgba(0.75 * ca);
        ctx.beginPath();
        for (let i = 0; i < N; i++) { if (i) ctx.lineTo(pos[i][0], pos[i][1]); else ctx.moveTo(pos[i][0], pos[i][1]); }
        ctx.stroke();
      }

      // Receptor
      const ra = smooth(1.2, 1.9, ph);
      const rpos = this.recv.map(p => tr(p));
      if (ra > 0.01) {
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = rgba(0.5 * ra);
        this.rEdges.forEach(e => { ctx.beginPath(); ctx.moveTo(rpos[e[0]][0], rpos[e[0]][1]); ctx.lineTo(rpos[e[1]][0], rpos[e[1]][1]); ctx.stroke(); });
      }

      // Nodos (aminoácidos + receptor) ordenados por profundidad
      const nodes = [];
      pos.forEach((p, i) => nodes.push({ x: p[0], y: p[1], z: p[2], r: (2.6 + 0.8 * Math.sin(i * 1.7 + t * 2) * sig) * p[3] * (0.8 + 0.4 * ca), o: 1 }));
      if (ra > 0.01) rpos.forEach(p => nodes.push({ x: p[0], y: p[1], z: p[2], r: 2.7 * p[3], o: ra * 0.9 }));
      nodes.sort((a, b) => a.z - b.z);
      nodes.forEach(n => {
        const d = clamp((n.z + 1.8) / 3.6), al = (0.5 + 0.5 * d) * n.o;
        if (sig > 0.2) {
          const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3.6);
          g.addColorStop(0, rgba(0.35 * al * sig));
          g.addColorStop(1, rgba(0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 3.6, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = rgb;
        ctx.globalAlpha = clamp(al);
        ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(0.8, n.r), 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
  }

  function initStory() {
    const sec = $('[data-story]');
    if (!sec) return;
    const canvas = $('.story__canvas', sec);
    if (canvas && !reduced) storyScene = new StoryScene(canvas);
  }

  /* ======================================================================
     TARJETAS 3D + BOTONES MAGNÉTICOS (solo con puntero fino)
     ====================================================================== */
  function initTilt() {
    if (!fine || reduced) return;
    $$('[data-tilt]').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - py) * 8).toFixed(2) + 'deg');
        card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  function initMagnetic() {
    if (!fine || reduced) return;
    $$('[data-magnetic]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + (dx * 0.16).toFixed(1) + 'px,' + (dy * 0.26).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ======================================================================
     COMPARADOR TIRZEPATIDA / RETATRUTIDE
     ====================================================================== */
  function initCompare() {
    const wrap = $('[data-compare]');
    if (!wrap) return;
    const tabs = $$('[role="tab"]', wrap);
    const panes = $$('[role="tabpanel"]', wrap);
    const gcg = $('.rec--gcg', wrap);
    let touched = false, visible = false, current = 0;
    const select = (i, focus) => {
      current = i;
      tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
      panes.forEach((p, k) => { p.hidden = k !== i; });
      wrap.dataset.active = i ? 'rt' : 'tz';
      if (gcg) {
        gcg.classList.toggle('is-on', i === 1);
        const head = $('.rec__head', gcg);
        if (window.anime && head && !reduced) window.anime({ targets: head, r: [17, 25, 17], duration: 800, easing: 'easeOutElastic(1, .6)' });
      }
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { touched = true; select(i); });
      t.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); touched = true; select(i === 0 ? 1 : 0, true); }
      });
    });
    wrap.addEventListener('pointerenter', () => { touched = true; });
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.4 }).observe(wrap);
    if (!reduced) setInterval(() => { if (visible && !touched) select(current ? 0 : 1); }, 5200);
  }

  /* ======================================================================
     KIT: PUNTOS INTERACTIVOS SOBRE LA FOTO
     ====================================================================== */
  function initKit() {
    const sec = $('[data-kit]');
    if (!sec) return;
    const spots = $$('.hotspot', sec);
    const items = $$('.kit__item', sec);
    let cur = 0, last = 0, visible = false;
    const set = i => {
      cur = i;
      spots.forEach(s => s.classList.toggle('is-active', Number(s.dataset.item) === i));
      items.forEach(s => s.classList.toggle('is-active', Number(s.dataset.item) === i));
    };
    const user = i => { last = Date.now(); set(i); };
    spots.forEach(s => {
      const i = Number(s.dataset.item);
      s.addEventListener('click', () => user(i));
      s.addEventListener('mouseenter', () => user(i));
      s.addEventListener('focus', () => user(i));
    });
    items.forEach(s => {
      const i = Number(s.dataset.item);
      s.addEventListener('click', () => user(i));
      s.addEventListener('mouseenter', () => user(i));
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.25 }).observe(sec);
    if (!reduced) setInterval(() => { if (visible && Date.now() - last > 6000) set((cur + 1) % Math.max(1, spots.length)); }, 2600);
    set(0);
  }

  /* ======================================================================
     GALERÍA: arrastre, botones, paralaje y visor con animación
     ====================================================================== */
  function initGallery() {
    const sec = $('[data-gallery]');
    if (!sec) return;
    const track = $('.gallery__track', sec);
    const items = $$('.gallery__item', track);
    const viewer = $('#visor');
    if (!track || !items.length) return;

    let down = false, sx = 0, sl = 0, moved = 0, captured = false;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') return;
      down = true; moved = 0; captured = false; sx = e.clientX; sl = track.scrollLeft;
    });
    track.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 6 && !captured) { captured = true; track.classList.add('is-drag'); try { track.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ } }
      if (captured) track.scrollLeft = sl - dx;
    });
    const end = () => { if (!down) return; down = false; track.classList.remove('is-drag'); };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('pointerleave', end);

    const step = () => items[0].getBoundingClientRect().width + 16;
    const prev = $('[data-gal-prev]', sec), next = $('[data-gal-next]', sec);
    if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    if (next) next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

    // Paralaje de las fotos dentro de su marco
    let ticking = false;
    const parallax = () => {
      ticking = false;
      const tr = track.getBoundingClientRect(), mid = tr.left + tr.width / 2;
      items.forEach(it => {
        const r = it.getBoundingClientRect();
        const d = clamp(((r.left + r.width / 2) - mid) / tr.width, -1, 1);
        it.style.setProperty('--gx', (d * -5).toFixed(2) + '%');
      });
    };
    track.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }, { passive: true });
    parallax();

    // Visor con animación desde la miniatura
    if (!viewer) return;
    const big = $('.viewer__img', viewer), cap = $('.viewer__cap', viewer), close = $('.viewer__close', viewer);
    let origin = null, lastFocus = null;
    const fit = img => {
      const ar = (img.naturalWidth || 4) / (img.naturalHeight || 3);
      const maxW = window.innerWidth * 0.92, maxH = window.innerHeight * 0.78;
      let w = maxW, h = w / ar;
      if (h > maxH) { h = maxH; w = h * ar; }
      return { w, h };
    };
    const open = fig => {
      const img = $('img', fig);
      if (!img) return;
      origin = fig; lastFocus = document.activeElement;
      const r = img.getBoundingClientRect();
      const { w, h } = fit(img);
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      big.style.width = w + 'px'; big.style.height = h + 'px';
      const f = $('figcaption', fig);
      cap.textContent = f ? f.textContent.replace(/^FIG\. \d+/, '').trim() : '';
      viewer.hidden = false;
      document.body.style.overflow = 'hidden';
      if (!reduced && big.animate) {
        const t = big.getBoundingClientRect();
        big.animate([
          { transform: 'translate(' + (r.left - t.left) + 'px,' + (r.top - t.top) + 'px) scale(' + (r.width / t.width) + ',' + (r.height / t.height) + ')', borderRadius: '24px' },
          { transform: 'none', borderRadius: '14px' }
        ], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
        viewer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350 });
      }
      close.focus();
    };
    const shut = () => {
      if (viewer.hidden) return;
      const finish = () => { viewer.hidden = true; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); };
      const img = origin && $('img', origin);
      if (!reduced && big.animate && img) {
        const r = img.getBoundingClientRect(), t = big.getBoundingClientRect();
        const a = big.animate([
          { transform: 'none' },
          { transform: 'translate(' + (r.left - t.left) + 'px,' + (r.top - t.top) + 'px) scale(' + (r.width / t.width) + ',' + (r.height / t.height) + ')' }
        ], { duration: 480, easing: 'cubic-bezier(.4,0,.2,1)' });
        viewer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480 });
        a.onfinish = finish;
      } else finish();
    };
    items.forEach(it => {
      it.addEventListener('click', () => { if (moved > 6) return; open(it); });
      it.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(it); } });
    });
    close.addEventListener('click', shut);
    viewer.addEventListener('click', e => { if (e.target === viewer) shut(); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') shut(); });
  }

  /* ======================================================================
     PREGUNTAS FRECUENTES (acordeón: una abierta a la vez)
     ====================================================================== */
  function initFaq() {
    const list = $$('.faq details');
    list.forEach(d => d.addEventListener('toggle', () => {
      if (d.open) list.forEach(o => { if (o !== d) o.open = false; });
    }));
  }

  /* ======================================================================
     FORMULARIO → WHATSAPP
     ====================================================================== */
  function initForm() {
    const form = $('#form-contacto');
    if (!form) return;
    const err = $('#form-error');
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!hasWA) return;
      const nombre = form.elements.nombre.value.trim();
      const peptido = form.elements.peptido.value;
      const presentacion = form.elements.presentacion.value;
      const mensaje = form.elements.mensaje.value.trim();
      $$('.is-invalid', form).forEach(x => x.classList.remove('is-invalid'));
      const faltan = [];
      if (!nombre) faltan.push(form.elements.nombre);
      if (!peptido) faltan.push(form.elements.peptido);
      if (faltan.length) {
        faltan.forEach(f => f.classList.add('is-invalid'));
        err.textContent = 'Completa tu nombre y el péptido de interés para continuar.';
        err.hidden = false;
        faltan[0].focus();
        return;
      }
      err.hidden = true;
      const lineas = ['Hola, soy ' + nombre + '.', 'Me interesa: ' + peptido + (presentacion ? ' (' + presentacion + ')' : '') + '.'];
      if (mensaje) lineas.push(mensaje);
      lineas.push('Te escribo desde la página de Vita-Peptide Laboratories.');
      window.open(waLink(lineas.join('\n')), '_blank', 'noopener');
    });
  }

  /* ======================================================================
     NAVEGACIÓN LATERAL POR SECCIONES
     ====================================================================== */
  function initRail() {
    const links = $$('.rail a');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const map = new Map();
    links.forEach(a => { const s = document.getElementById(a.getAttribute('href').slice(1)); if (s) map.set(s, a); });
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(l => l.classList.remove('is-active'));
        const a = map.get(en.target);
        if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((a, s) => io.observe(s));
  }

  /* ======================================================================
     MOTOR DE SCROLL + BUCLE DE ANIMACIÓN
     ====================================================================== */
  const M = { vh: 0, vw: 0, docH: 0, story: null, expand: null, track: null, dark: [] };
  const dom = {};
  const last = {};

  function measure() {
    const sy = window.scrollY || 0;
    const top = el => el.getBoundingClientRect().top + sy;
    M.vh = window.innerHeight; M.vw = window.innerWidth;
    M.docH = document.documentElement.scrollHeight;
    if (dom.story) M.story = { top: top(dom.story), h: dom.story.offsetHeight };
    if (dom.expand) M.expand = { top: top(dom.expand), h: dom.expand.offsetHeight };
    if (dom.track) M.track = { top: top(dom.track), h: dom.track.offsetHeight };
    M.dark = dom.darkSecs.map(s => ({ top: top(s), bottom: top(s) + s.offsetHeight }));
  }

  function update(y) {
    const vh = M.vh;
    if (!vh) return;

    // Barra de progreso
    const sp = clamp(y / Math.max(1, M.docH - vh));
    if (dom.progress && Math.abs(sp - (last.sp || 0)) > 0.0005) { dom.progress.style.setProperty('--sp', sp.toFixed(4)); last.sp = sp; }

    // Encabezado: vidrio y modo oscuro
    const stuck = y > 12;
    if (stuck !== last.stuck && dom.header) { dom.header.classList.toggle('is-stuck', stuck); last.stuck = stuck; }
    const probe = y + 40;
    const onDark = M.dark.some(d => probe >= d.top && probe < d.bottom);
    if (onDark !== last.onDark && dom.header) { dom.header.classList.toggle('on-dark', onDark); last.onDark = onDark; }

    // Escena de la ciencia
    if (dom.story && M.story && !reduced) {
      const p = clamp((y - M.story.top) / Math.max(1, M.story.h - vh));
      if (Math.abs(p - (last.p || 0)) > 0.0004) {
        dom.story.style.setProperty('--p', p.toFixed(4));
        last.p = p;
        if (storyScene) storyScene.target = p;
        const idx = Math.min(3, Math.floor(p * 4));
        if (idx !== last.step) {
          dom.steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
          dom.ticks.forEach((s, i) => s.classList.toggle('is-active', i === idx));
          last.step = idx;
        }
      }
    }

    // Imagen que se expande
    if (dom.expand && M.expand && !reduced) {
      const q = clamp((y - (M.expand.top - vh * 0.6)) / ((M.expand.h - vh) + vh * 0.6));
      const e = smooth(0.04, 0.72, q);
      if (Math.abs(e - (last.e === undefined ? -1 : last.e)) > 0.002) { dom.expand.style.setProperty('--e', e.toFixed(4)); last.e = e; }
    }

    // Línea de tiempo del proceso
    if (dom.track && M.track) {
      const horizontal = M.vw >= 900;
      const lp = horizontal
        ? clamp((y + vh * 0.8 - M.track.top) / (vh * 0.55))
        : clamp((y + vh * 0.65 - M.track.top) / Math.max(1, M.track.h));
      if (Math.abs(lp - (last.lp || 0)) > 0.002) {
        if (dom.line) dom.line.style.setProperty('--lp', lp.toFixed(4));
        last.lp = lp;
        const n = dom.processSteps.length;
        dom.processSteps.forEach((s, i) => s.classList.toggle('is-lit', lp >= (i + 0.3) / n));
      }
    }
  }

  function startLoop() {
    dom.progress = $('#progreso');
    dom.header = $('.site-header');
    dom.story = $('[data-story]');
    dom.steps = $$('.story-step');
    dom.ticks = $$('.story__tick');
    dom.expand = $('[data-expand]');
    dom.track = $('.process__track');
    dom.line = $('.process__line');
    dom.processSteps = $$('.process__steps .step');
    dom.darkSecs = $$('.marquee, .story, .kit, .expand, .contact, .footer');

    measure();
    let timer = 0;
    const remeasure = () => { clearTimeout(timer); timer = setTimeout(measure, 120); };
    window.addEventListener('resize', remeasure);
    window.addEventListener('load', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);

    let prev = performance.now(), time = 0;
    const frame = now => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now; time += dt;
      const y = window.scrollY || window.pageYOffset || 0;
      update(y);
      if (heroScene) heroScene.draw(time, dt, y);
      if (storyScene) storyScene.draw(time, dt);
      if (contactScene) contactScene.draw(time, dt, y);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ======================================================================
     ARRANQUE (cada módulo está aislado: si uno falla, el resto sigue)
     ====================================================================== */
  safe('whatsapp', initWhatsApp);
  safe('cargador', initLoader);
  safe('encabezado', initHeader);
  safe('reveal', initReveal);
  safe('typer', initTyper);
  safe('hero', initHero);
  safe('story', initStory);
  safe('contacto-escena', initContactScene);
  safe('tilt', initTilt);
  safe('magnetic', initMagnetic);
  safe('comparador', initCompare);
  safe('kit', initKit);
  safe('galeria', initGallery);
  safe('faq', initFaq);
  safe('formulario', initForm);
  safe('rail', initRail);
  safe('bucle', startLoop);
})();
