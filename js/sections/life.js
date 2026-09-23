// Jogo da Vida. Começa como a sopa aleatória de 240 × 240 da palestra; desenhe com o
// mouse ou o dedo. Um detector procura planadores e os pinta de laranja. Achar
// estruturas lá dentro é, em miniatura, o que a interpretabilidade tenta fazer.
import { fitCanvas, loop, COLORS, rng, reduced } from '../lib.js';

// todas as fases e orientações do planador, como máscaras 3 × 3
function gliderMasks() {
  const base = [[0, 1, 0], [0, 0, 1], [1, 1, 1]];
  const set = new Set();
  const N = 9;
  let g = Array.from({ length: N }, () => new Array(N).fill(0));
  base.forEach((r, y) => r.forEach((v, x) => (g[y + 3][x + 3] = v)));
  const phases = [];
  for (let t = 0; t < 4; t++) {
    let x0 = N, y0 = N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); }
    phases.push([0, 1, 2].map(y => [0, 1, 2].map(x => g[y0 + y]?.[x0 + x] || 0)));
    const n = g.map(r => r.slice());
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) s += g[y + dy][x + dx];
      n[y][x] = s === 3 || (s === 2 && g[y][x]) ? 1 : 0;
    }
    g = n;
  }
  const rot = m => [0, 1, 2].map(y => [0, 1, 2].map(x => m[2 - x][y]));
  const flip = m => m.map(r => r.slice().reverse());
  for (let m of phases) for (let f = 0; f < 2; f++) {
    let k = f ? flip(m) : m;
    for (let r = 0; r < 4; r++) { set.add(k.flat().reduce((a, v, i) => a | (v << i), 0)); k = rot(k); }
  }
  return set;
}

const GUN = ['........................O', '......................O.O', '............OO......OO............OO', '...........O...O....OO............OO',
  'OO........O.....O...OO', 'OO........O...O.OO....O.O', '..........O.....O.......O', '...........O...O', '............OO'];

export default function life(sec) {
  const canvas = sec.querySelector('.life'), stats = sec.querySelector('.life-stats');
  const playBtn = sec.querySelector('.life-play'), spot = sec.querySelector('.life-spot input');
  const R = rng(240);
  const masks = gliderMasks();
  let ctx, W, H, cell, cols, rows, a, b, mark, gen = 0, running = !reduced, acc = 0, gliders = 0;

  function layout() {
    ({ ctx, w: W, h: H } = fitCanvas(canvas));
    cell = Math.max(3, Math.min(8, W / 240));
    if (W < 700) cell = Math.max(4, W / 96);
    cols = Math.floor(W / cell); rows = Math.floor(H / cell);
    a = new Uint8Array(cols * rows); b = new Uint8Array(cols * rows); mark = new Uint8Array(cols * rows);
    soup();
  }
  function soup() {
    // um quadrado de 240 × 240 (ou o que couber) de sopa aleatória, como na palestra
    a.fill(0);
    const s = Math.min(240, cols, rows), ox = (cols - s) >> 1, oy = (rows - s) >> 1;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) a[(oy + y) * cols + ox + x] = R() < 0.5 ? 1 : 0;
    gen = 0; draw();
  }
  function stamp(rowsTxt, x0, y0) {
    rowsTxt.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'O') a[((y0 + y) % rows) * cols + (x0 + x) % cols] = 1; }));
  }
  function step() {
    for (let y = 0; y < rows; y++) {
      const ym = ((y - 1 + rows) % rows) * cols, y0 = y * cols, yp = ((y + 1) % rows) * cols;
      for (let x = 0; x < cols; x++) {
        const xm = (x - 1 + cols) % cols, xp = (x + 1) % cols;
        const n = a[ym + xm] + a[ym + x] + a[ym + xp] + a[y0 + xm] + a[y0 + xp] + a[yp + xm] + a[yp + x] + a[yp + xp];
        b[y0 + x] = n === 3 || (n === 2 && a[y0 + x]) ? 1 : 0;
      }
    }
    [a, b] = [b, a];
    gen++;
  }
  function detect() {
    mark.fill(0); gliders = 0;
    if (!spot.checked) return;
    for (let y = 1; y < rows - 4; y++) for (let x = 1; x < cols - 4; x++) {
      // janela 3 × 3 com exatamente 5 vivas...
      let m = 0, c = 0;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) { const v = a[(y + dy) * cols + x + dx]; m |= v << (dy * 3 + dx); c += v; }
      if (c !== 5 || !masks.has(m)) continue;
      // ...e a moldura em volta vazia
      let ring = 0;
      for (let dx = -1; dx <= 3; dx++) ring += a[(y - 1) * cols + x + dx] + a[(y + 3) * cols + x + dx];
      for (let dy = 0; dy < 3; dy++) ring += a[(y + dy) * cols + x - 1] + a[(y + dy) * cols + x + 3];
      if (ring) continue;
      gliders++;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) mark[(y + dy) * cols + x + dx] = 1;
    }
  }
  function draw() {
    ctx.fillStyle = COLORS.paper; ctx.fillRect(0, 0, W, H);
    const ink = COLORS.ink, acc = COLORS.accent;
    let pop = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!a[i]) continue;
      pop++;
      ctx.fillStyle = mark[i] ? acc : ink;
      ctx.fillRect(x * cell, y * cell, cell - (cell > 4 ? 1 : 0), cell - (cell > 4 ? 1 : 0));
    }
    stats.textContent = `geração ${gen.toLocaleString('pt-BR')} · ${pop.toLocaleString('pt-BR')} vivas · ${gliders} planador${gliders === 1 ? '' : 'es'}`;
  }

  loop(canvas, dt => {
    if (!running) return;
    acc += dt;
    if (acc < 1 / 14) return;
    acc = 0;
    step(); detect(); draw();
  });

  // desenhar
  let drawing = false, last = null;
  const paint = e => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / cell), y = Math.floor((e.clientY - r.top) / cell);
    const pts = [[x, y]];
    if (last) { const n = Math.max(Math.abs(x - last[0]), Math.abs(y - last[1])); for (let k = 1; k < n; k++) pts.push([Math.round(last[0] + (x - last[0]) * k / n), Math.round(last[1] + (y - last[1]) * k / n)]); }
    for (const [px, py] of pts) if (px >= 0 && py >= 0 && px < cols && py < rows) a[py * cols + px] = 1;
    last = [x, y];
    draw();
  };
  canvas.addEventListener('pointerdown', e => { drawing = true; last = null; canvas.setPointerCapture(e.pointerId); paint(e); });
  canvas.addEventListener('pointermove', e => { if (drawing) paint(e); });
  addEventListener('pointerup', () => { drawing = false; last = null; });

  playBtn.addEventListener('click', () => { running = !running; playBtn.textContent = running ? '❚❚ Pausar' : '▶ Continuar'; });
  sec.querySelector('.life-soup').addEventListener('click', soup);
  sec.querySelector('.life-clear').addEventListener('click', () => { a.fill(0); mark.fill(0); gen = 0; draw(); });
  sec.querySelector('.life-glider').addEventListener('click', () => {
    const g = [['.O.', '..O', 'OOO'], ['O.O', '.OO', '.O.'], ['..O', 'O.O', '.OO'], ['OOO', 'O..', '.O.']][Math.floor(R() * 4)];
    stamp(g, Math.floor(R() * (cols - 5)), Math.floor(R() * (rows - 5)));
    detect(); draw();
  });
  sec.querySelector('.life-gun').addEventListener('click', () => { a.fill(0); stamp(GUN, 4, 4); gen = 0; detect(); draw(); });
  spot.addEventListener('change', () => { detect(); draw(); });
  if (reduced) playBtn.textContent = '▶ Continuar';

  // as três regras, desenhadas
  sec.querySelectorAll('.life-rule canvas').forEach(c => {
    const g = c.getContext('2d'), k = c.dataset.r, s = 20;
    const on = { born: [0, 2, 7], live: [1, 5], die: [3] }[k];
    for (let i = 0; i < 9; i++) {
      const x = (i % 3) * s, y = Math.floor(i / 3) * s;
      const nb = i === 4 ? null : [0, 1, 2, 3, 5, 6, 7, 8].indexOf(i);
      const alive = i === 4 ? k !== 'born' : on.includes(nb);
      g.fillStyle = alive ? COLORS.ink : COLORS.paper3;
      g.fillRect(x + 1, y + 1, s - 2, s - 2);
      if (i === 4) { g.strokeStyle = COLORS.accent; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, s - 2, s - 2); }
    }
  });

  layout();
  let lw = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lw) { lw = innerWidth; layout(); } });
}
