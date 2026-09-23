// Regra 110: oito regras locais, uma célula preta, e um padrão que ninguém desenhou.
// Clique nas saídas das regras para trocar o número da regra; clique na primeira linha
// para mudar o começo.
import { fitCanvas, loop, COLORS, visible, rng } from '../lib.js';

export default function rule110(sec) {
  const tiles = sec.querySelector('.rule-tiles'), canvas = sec.querySelector('.ca'), num = sec.querySelector('.rule-n');
  let rule = 110, cols = 0, rows = 0, cell = 4, grid = null, row = 0, ctx, W, H, init = null;
  const R = rng(110);

  const pats = [7, 6, 5, 4, 3, 2, 1, 0];
  const btns = pats.map(p => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rt';
    b.innerHTML = `<span class="rt-in">${[4, 2, 1].map(m => `<i class="${p & m ? 'b' : ''}"></i>`).join('')}</span><span class="arr">↓</span><span class="rt-in"><i class="out"></i></span>`;
    b.setAttribute('aria-label', `Padrão ${[4, 2, 1].map(m => (p & m ? '■' : '□')).join('')}: clique para trocar a saída`);
    b.addEventListener('click', () => { rule ^= 1 << p; sync(); restart(); });
    tiles.append(b);
    return { b, p };
  });
  function sync() {
    num.textContent = rule;
    btns.forEach(({ b, p }) => b.querySelector('.out').classList.toggle('b', !!(rule >> p & 1)));
    sec.querySelectorAll('[data-rule]').forEach(x => x.classList.toggle('on', +x.dataset.rule === rule));
  }

  function layout() {
    ({ ctx, w: W, h: H } = fitCanvas(canvas));
    cell = W < 700 ? 3 : 4;
    cols = Math.floor(W / cell); rows = Math.floor(H / cell);
    if (!init || init.length !== cols) { init = new Uint8Array(cols); init[cols - 2] = 1; }
    restart();
  }
  function restart() {
    grid = new Uint8Array(init);
    row = 0;
    ctx.fillStyle = COLORS.paper; ctx.fillRect(0, 0, W, H);
    drawRow(grid, 0);
  }
  function drawRow(g, r) {
    ctx.fillStyle = COLORS.ink;
    for (let i = 0; i < cols; i++) if (g[i]) ctx.fillRect(i * cell, r * cell, cell, cell);
  }
  function step() {
    const n = new Uint8Array(cols);
    for (let i = 0; i < cols; i++) {
      const p = (grid[(i - 1 + cols) % cols] << 2) | (grid[i] << 1) | grid[(i + 1) % cols];
      n[i] = rule >> p & 1;
    }
    grid = n;
    row++;
    drawRow(grid, row);
  }

  let started = false;
  visible(canvas, v => { if (v) started = true; }, '0px 0px -20% 0px');
  loop(canvas, dt => {
    if (!started || row >= rows - 1) return;
    const k = Math.max(1, Math.round(dt * 70));
    for (let i = 0; i < k && row < rows - 1; i++) step();
  });

  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left) / cell);
    if (i >= 0 && i < cols) { init[i] ^= 1; restart(); }
  });
  sec.querySelectorAll('[data-rule]').forEach(b => b.addEventListener('click', () => {
    rule = +b.dataset.rule;
    init = new Uint8Array(cols);
    init[rule === 110 ? cols - 2 : cols >> 1] = 1;
    sync(); restart();
  }));
  sec.querySelector('.ca-random').addEventListener('click', () => {
    init = new Uint8Array(cols).map(() => (R() < 0.5 ? 1 : 0));
    restart();
  });
  sync();
  layout();
  let lw = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lw) { lw = innerWidth; init = null; layout(); } });
}
