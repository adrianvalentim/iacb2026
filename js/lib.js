// Utilidades compartilhadas pelos capítulos.

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const ramp = (x, a, b) => smooth(clamp((x - a) / (b - a)));
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const COLORS = {
  get paper() { return css('--paper') || '#F3EEE6'; },
  get paper2() { return css('--paper-2') || '#EAE3D8'; },
  get paper3() { return css('--paper-3') || '#DDD5C7'; },
  get ink() { return css('--ink') || '#1A1816'; },
  get ink2() { return css('--ink-2') || '#4A453F'; },
  get ink3() { return css('--ink-3') || '#8C857A'; },
  get ink4() { return css('--ink-4') || '#B9B1A4'; },
  get accent() { return css('--accent') || '#C0362C'; },
};

export const fmt = n => Math.round(n).toLocaleString('pt-BR');

// ajusta o canvas ao tamanho CSS × DPR (limitado); devolve o contexto e as dimensões CSS
export function fitCanvas(canvas, { maxDpr = 2, ctx = '2d', opts } = {}) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const c = ctx === '2d' ? canvas.getContext('2d', opts) : null;
  if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx: c, w: r.width, h: r.height, dpr };
}

// observa visibilidade; cb(true/false)
export function visible(el, cb, rootMargin = '0px', threshold = 0) {
  const io = new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting, e)), { rootMargin, threshold });
  io.observe(el);
  return () => io.disconnect();
}

// marca .in uma vez, quando entra na tela
export function revealOnce(els, { rootMargin = '0px 0px -12% 0px', stagger = 0, cls = 'in' } = {}) {
  const list = Array.from(els);
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const i = list.indexOf(e.target);
    setTimeout(() => e.target.classList.add(cls), reduced ? 0 : i * stagger);
    io.unobserve(e.target);
  }), { rootMargin });
  list.forEach(el => io.observe(el));
}

// progresso 0..1 de um trilho "pinned" (sticky): 0 quando o topo encosta no topo da tela,
// 1 quando o fim do trilho encosta no fim da tela
export function trackProgress(track) {
  const r = track.getBoundingClientRect();
  const span = r.height - innerHeight;
  return span <= 0 ? 0 : clamp(-r.top / span);
}

// laço de animação que só roda enquanto o elemento está perto da tela
export function loop(el, frame, { margin = '100px' } = {}) {
  let on = false, raf = 0, last = performance.now();
  const tick = now => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    frame(dt, now / 1000);
    if (on) raf = requestAnimationFrame(tick);
  };
  const stop = visible(el, v => {
    if (v && !on) { on = true; last = performance.now(); raf = requestAnimationFrame(tick); }
    else if (!v && on) { on = false; cancelAnimationFrame(raf); }
  }, margin);
  return () => { on = false; cancelAnimationFrame(raf); stop(); };
}

// ao rolar: chama cb(progresso) para um trilho pinned, via rAF, só enquanto visível
export function onTrack(track, cb) {
  let queued = false, active = false;
  const run = () => { queued = false; cb(trackProgress(track)); };
  const req = () => { if (active && !queued) { queued = true; requestAnimationFrame(run); } };
  visible(track, v => { active = v; if (v) req(); }, '50px');
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  return req;
}

export const svgNS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, parent) {
  const e = document.createElementNS(svgNS, tag);
  // var(--x) não vale em atributos de apresentação do SVG: vai para o style
  for (const k in attrs) {
    const v = attrs[k];
    if (typeof v === 'string' && v.includes('var(')) e.style.setProperty(k, v);
    else e.setAttribute(k, v);
  }
  if (parent) parent.appendChild(e);
  return e;
}

// PRNG determinístico (mulberry32)
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function onResize(cb) {
  let t = 0;
  const h = () => { clearTimeout(t); t = setTimeout(cb, 120); };
  addEventListener('resize', h);
  return () => removeEventListener('resize', h);
}
