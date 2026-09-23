// LLM + bloco de notas = computador universal; e a descida do gradiente, para mexer.
import { svg, fitCanvas, loop, COLORS, rng, visible, reduced, clamp } from '../lib.js';

function notepad(sec) {
  const S = sec.querySelector('.np-svg');
  // --- o transformer, com cara de gente
  const bot = svg('g', { transform: 'translate(120 30)' }, S);
  svg('rect', { x: 0, y: 40, width: 190, height: 250, rx: 16, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2.5 }, bot);
  for (let i = 0; i < 3; i++) {
    const y = 150 + i * 44;
    svg('rect', { x: 22, y, width: 68, height: 32, rx: 4, fill: 'var(--paper-2)', stroke: 'var(--ink)', 'stroke-width': 1.5 }, bot);
    svg('rect', { x: 100, y, width: 68, height: 32, rx: 4, fill: 'var(--paper-3)', stroke: 'var(--ink)', 'stroke-width': 1.5 }, bot);
    svg('text', { x: 56, y: y + 20, 'text-anchor': 'middle', style: 'font-size:10px' }, bot).textContent = 'ATENÇÃO';
    svg('text', { x: 134, y: y + 20, 'text-anchor': 'middle', style: 'font-size:10px' }, bot).textContent = 'MLP';
  }
  const eyes = [55, 135].map(x => {
    svg('circle', { cx: x, cy: 96, r: 26, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2.5 }, bot);
    return svg('circle', { cx: x, cy: 96, r: 10, fill: 'var(--ink)' }, bot);
  });
  const lids = [55, 135].map(x => svg('rect', { x: x - 27, y: 69, width: 54, height: 0, fill: 'var(--paper)' }, bot));
  svg('path', { d: 'M78 128 Q95 140 112 128', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, bot);
  svg('path', { d: 'M0 180 C-30 170 -40 150 -34 128', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, bot);
  const arm = svg('path', { d: 'M190 180 C230 180 250 170 270 160', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, bot);
  svg('path', { d: 'M60 290 v26 h-14 M130 290 v26 h14', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, bot);

  // --- o "+" e o bloco de notas
  svg('path', { d: 'M440 170 h40 M460 150 v40', stroke: 'var(--ink)', 'stroke-width': 10, 'stroke-linecap': 'round' }, S);
  const pad = svg('g', { transform: 'translate(560 30) rotate(3)' }, S);
  svg('rect', { x: 0, y: 12, width: 250, height: 300, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2.5 }, pad);
  for (let i = 0; i < 9; i++) svg('circle', { cx: 22 + i * 26, cy: 12, r: 6, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 }, pad);
  for (let i = 0; i < 10; i++) svg('line', { x1: 14, x2: 236, y1: 60 + i * 24, y2: 60 + i * 24, stroke: 'var(--ink-4)', 'stroke-width': 1 }, pad);
  svg('line', { x1: 40, x2: 40, y1: 24, y2: 306, stroke: 'var(--accent)', 'stroke-width': 1, opacity: .6 }, pad);
  const linesG = svg('g', {}, pad);
  const pen = svg('circle', { r: 4, fill: 'var(--accent)', opacity: 0 }, pad);

  // um pequeno programa sendo executado: o modelo lê a última linha e escreve a próxima
  const program = ['estado A · lê 0', 'escreve 1 · →', 'estado B · lê 0', 'escreve 1 · ←', 'estado A · lê 1', 'escreve 1 · ←', 'estado B · lê 0', 'escreve 1 · ←', 'estado A · lê 0', 'escreve 1 · →', 'estado B · lê 1', 'escreve 1 · →', 'fim ■'];
  let k = 0, lines = [], on = false;
  visible(S, v => { on = v; });
  const tick = () => {
    if (on && !reduced) {
      if (lines.length >= 10) { lines.forEach(l => l.remove()); lines = []; }
      const y = 55 + lines.length * 24;
      const t = svg('text', { x: 48, y, style: 'font-size:14px' }, linesG);
      const s = program[k % program.length];
      t.textContent = '';
      let c = 0;
      pen.setAttribute('opacity', 1);
      const type = () => {
        t.textContent = s.slice(0, ++c);
        pen.setAttribute('cx', 50 + c * 8.4); pen.setAttribute('cy', y + 2);
        if (c < s.length) setTimeout(type, 38); else pen.setAttribute('opacity', 0);
      };
      type();
      lines.push(t);
      k++;
      if (k % program.length === 0) setTimeout(() => { lines.forEach(l => l.remove()); lines = []; }, 1600);
      // olhos: lê o bloco (olha à direita), pisca de vez em quando
      eyes.forEach(e => { e.setAttribute('cx', +e.getAttribute('cx') < 100 ? 64 : 144); });
      arm.setAttribute('d', k % 2 ? 'M190 180 C230 180 250 170 280 150' : 'M190 180 C230 185 250 178 270 168');
      if (k % 5 === 0) { lids.forEach(l => { l.setAttribute('height', 54); setTimeout(() => l.setAttribute('height', 0), 140); }); }
    }
    setTimeout(tick, 1100);
  };
  tick();
}

function descent(sec) {
  const canvas = sec.querySelector('.gd');
  const R = rng(42);
  const wells = Array.from({ length: 7 }, () => ({ x: 0.1 + R() * 0.8, y: 0.12 + R() * 0.76, a: 0.35 + R() * 0.6, s: 0.06 + R() * 0.1 }));
  const f = (x, y) => {
    let v = 0.9 * ((x - 0.5) ** 2 + (y - 0.5) ** 2);
    for (const w of wells) v -= w.a * Math.exp(-((x - w.x) ** 2 + (y - w.y) ** 2) / (2 * w.s * w.s));
    return v;
  };
  const grad = (x, y) => {
    let gx = 1.8 * (x - 0.5), gy = 1.8 * (y - 0.5);
    for (const w of wells) {
      const e = w.a * Math.exp(-((x - w.x) ** 2 + (y - w.y) ** 2) / (2 * w.s * w.s)) / (w.s * w.s);
      gx += e * (x - w.x); gy += e * (y - w.y);
    }
    return [gx, gy];
  };
  let ctx, W, H, bg, balls = [];
  function layout() {
    ({ ctx, w: W, h: H } = fitCanvas(canvas));
    // curvas de nível por marching squares, desenhadas uma vez
    bg = document.createElement('canvas');
    const dpr = canvas.width / W;
    bg.width = canvas.width; bg.height = canvas.height;
    const g = bg.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = 6, gw = Math.ceil(W / n) + 1, gh = Math.ceil(H / n) + 1;
    const F = new Float32Array(gw * gh);
    let lo = 1e9, hi = -1e9;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const v = f(i * n / W, j * n / H); F[j * gw + i] = v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const L = 26;
    for (let l = 1; l < L; l++) {
      const iso = lo + (hi - lo) * (l / L) ** 1.4;
      g.strokeStyle = COLORS.ink; g.globalAlpha = l % 5 === 0 ? 0.5 : 0.22; g.lineWidth = l % 5 === 0 ? 1.2 : 0.8;
      g.beginPath();
      for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
        const a = F[j * gw + i], b = F[j * gw + i + 1], c = F[(j + 1) * gw + i + 1], d = F[(j + 1) * gw + i];
        const pts = [];
        const e = (p, q, x0, y0, x1, y1) => { if ((p < iso) !== (q < iso)) { const t = (iso - p) / (q - p); pts.push([(x0 + (x1 - x0) * t) * n, (y0 + (y1 - y0) * t) * n]); } };
        e(a, b, i, j, i + 1, j); e(b, c, i + 1, j, i + 1, j + 1); e(d, c, i, j + 1, i + 1, j + 1); e(a, d, i, j, i, j + 1);
        if (pts.length >= 2) { g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); }
        if (pts.length === 4) { g.moveTo(pts[2][0], pts[2][1]); g.lineTo(pts[3][0], pts[3][1]); }
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  const drop = (x, y) => balls.push({ x, y, vx: 0, vy: 0, trail: [[x, y]], done: false });
  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    drop((e.clientX - r.left) / W, (e.clientY - r.top) / H);
    if (balls.length > 40) balls.shift();
  });
  let seeded = false;
  visible(canvas, v => { if (v && !seeded) { seeded = true; for (let i = 0; i < 5; i++) setTimeout(() => drop(0.08 + R() * 0.84, 0.08 + R() * 0.84), i * 500); } }, '0px 0px -20% 0px');
  layout();
  let lw = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lw) { lw = innerWidth; layout(); } });
  loop(canvas, dt => {
    const acc = COLORS.accent, ink = COLORS.ink;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bg, 0, 0, W, H);
    for (const b of balls) {
      if (!b.done) {
        for (let k = 0; k < 4; k++) {
          let [gx, gy] = grad(b.x, b.y);
          const gn = Math.hypot(gx, gy);
          if (gn > 5) { gx *= 5 / gn; gy *= 5 / gn; }
          b.vx = 0.72 * b.vx - 0.00055 * gx; b.vy = 0.72 * b.vy - 0.00055 * gy;
          b.x = clamp(b.x + b.vx, 0, 1); b.y = clamp(b.y + b.vy, 0, 1);
        }
        b.trail.push([b.x, b.y]);
        if (Math.hypot(b.vx, b.vy) < 4e-6 && b.trail.length > 30) b.done = true;
      }
      ctx.strokeStyle = acc; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.8;
      ctx.beginPath();
      b.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
      ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.arc(b.x * W, b.y * H, 5, 0, 7); ctx.fill();
      if (b.done) { ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x * W, b.y * H, 10, 0, 7); ctx.stroke(); }
      const [x0, y0] = b.trail[0];
      ctx.strokeStyle = acc; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x0 * W, y0 * H, 3.5, 0, 7); ctx.stroke();
    }
  });
}

export default function universal(sec) {
  notepad(sec);
  descent(sec);
}
