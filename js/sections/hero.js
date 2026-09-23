// Abertura: a rede do logo, viva. Ativações correm pelas arestas; o cursor é uma sonda
// que acende o que toca; um clique num nó dispara uma onda. Ao fundo, uma rede enorme e apagada.
import { fitCanvas, loop, rng, COLORS, reduced, clamp } from '../lib.js';

const NODES = [[14, 34], [42, 16], [42, 44], [74, 50], [42, 64], [14, 76], [42, 86], [80, 84], [74, 24]];
const EDGES = [[0, 2], [1, 2], [1, 8], [2, 3], [2, 4], [0, 4], [4, 6], [5, 6], [6, 7], [3, 7], [8, 3], [5, 4]];

export default function hero(sec) {
  const canvas = sec.querySelector('.hero-net');
  const ainda = sec.querySelector('.ainda'), tc = sec.querySelector('.t-c');
  const R = rng(3);
  let W = 0, H = 0, ctx, big = [], bigEdges = [], fg = [], box = null;
  const pulses = [];
  const mouse = { x: -1e4, y: -1e4, on: false };

  // "(ainda)" digitado
  const word = 'ainda';
  ainda.textContent = '';
  let k = 0;
  const type = () => { ainda.textContent = word.slice(0, ++k); if (k < word.length) setTimeout(type, 140 + R() * 90); else setTimeout(() => tc.classList.add('done'), 1600); };
  setTimeout(type, reduced ? 0 : 1100);

  function layout() {
    ({ ctx, w: W, h: H } = fitCanvas(canvas));
    const mobile = W < 900;
    const s = mobile ? Math.min(W * 0.34, 160) : Math.min(W * 0.26, H * 0.56, 480);
    const cx = mobile ? W - s * 0.62 - 16 : Math.max(24, Math.min(W * 0.06, 90)) + s * 0.5;
    const cy = mobile ? Math.max(70, H * 0.1) + s * 0.5 : H * 0.5;
    box = { s, x0: cx - s / 2, y0: cy - s / 2 };
    fg = NODES.map(([x, y], i) => ({ x: box.x0 + x / 100 * s, y: box.y0 + y / 100 * s, a: 0, i }));
    // rede de fundo: camadas em colunas, ligações esparsas entre vizinhas
    big = []; bigEdges = [];
    const cols = mobile ? 7 : 14, rows = mobile ? 11 : 9;
    const cols0 = [];
    for (let c = 0; c < cols; c++) {
      const col = [];
      for (let r = 0; r < rows; r++) {
        if (R() < 0.18) continue;
        const n = { x: (c + 0.5 + (R() - 0.5) * 0.5) / cols * W, y: (r + 0.5 + (R() - 0.5) * 0.6) / rows * H, a: 0 };
        col.push(big.length); big.push(n);
      }
      cols0.push(col);
    }
    for (let c = 0; c < cols - 1; c++) for (const a of cols0[c]) for (const b of cols0[c + 1]) if (R() < 0.22) bigEdges.push([a, b]);
  }
  layout();
  addEventListener('resize', layout);

  const out = i => EDGES.filter(e => e[0] === i || e[1] === i).map(e => (e[0] === i ? e[1] : e[0]));
  function fire(i, depth = 3, from = -1) {
    fg[i].a = 1;
    if (depth <= 0) return;
    for (const j of out(i)) if (j !== from && R() < 0.8) pulses.push({ fg: true, a: i, b: j, t: 0, v: 0.9 + R() * 0.8, depth: depth - 1 });
  }
  let auto = 0;

  sec.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true; });
  sec.addEventListener('pointerleave', () => { mouse.on = false; mouse.x = mouse.y = -1e4; });
  sec.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = 1e9;
    fg.forEach((n, i) => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = i; } });
    if (bd < box.s * 0.25) fire(best, 4);
    else {
      // clique no fundo: uma onda pela rede grande a partir do ponto
      big.forEach(n => { const d = Math.hypot(n.x - x, n.y - y); if (d < 180) n.a = Math.max(n.a, 1 - d / 180); });
      for (const [a, b] of bigEdges) if (Math.hypot(big[a].x - x, big[a].y - y) < 160) pulses.push({ fg: false, a, b, t: 0, v: 0.6 + R() * 0.6 });
    }
  });

  loop(sec, (dt, t) => {
    const ink = COLORS.ink, acc = COLORS.accent;
    ctx.clearRect(0, 0, W, H);
    // disparos automáticos, bem espaçados
    auto -= dt;
    if (auto <= 0 && !reduced) { fire(Math.floor(R() * fg.length), 2); auto = 1.4 + R() * 1.8; }
    if (!reduced && R() < dt * 3) { const [a, b] = bigEdges[Math.floor(R() * bigEdges.length)] || [0, 0]; pulses.push({ fg: false, a, b, t: 0, v: 0.35 + R() * 0.4 }); }

    // sonda do cursor
    if (mouse.on) {
      for (const n of big) { const d = Math.hypot(n.x - mouse.x, n.y - mouse.y); if (d < 120) n.a = Math.max(n.a, (1 - d / 120) * 0.8); }
      for (const n of fg) { const d = Math.hypot(n.x - mouse.x, n.y - mouse.y); if (d < box.s * 0.14) n.a = Math.max(n.a, 0.9); }
    }

    // rede de fundo
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.045;
    ctx.beginPath();
    for (const [a, b] of bigEdges) { ctx.moveTo(big[a].x, big[a].y); ctx.lineTo(big[b].x, big[b].y); }
    ctx.stroke();
    for (const n of big) {
      ctx.globalAlpha = 0.07 + n.a * 0.8;
      ctx.fillStyle = n.a > 0.25 ? acc : ink;
      ctx.beginPath(); ctx.arc(n.x, n.y, 2 + n.a * 2.5, 0, 7); ctx.fill();
      n.a = Math.max(0, n.a - dt * 0.9);
    }
    ctx.globalAlpha = 1;

    // rede do logo
    const s = box.s, lw = s * 0.026, rr = s * 0.075;
    ctx.lineWidth = lw; ctx.strokeStyle = ink; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [a, b] of EDGES) { ctx.moveTo(fg[a].x, fg[a].y); ctx.lineTo(fg[b].x, fg[b].y); }
    ctx.stroke();

    // pulsos
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += dt * p.v * (p.fg ? 1.3 : 0.7);
      const A = p.fg ? fg[p.a] : big[p.a], B = p.fg ? fg[p.b] : big[p.b];
      if (!A || !B) { pulses.splice(i, 1); continue; }
      const u = clamp(p.t);
      const x = A.x + (B.x - A.x) * u, y = A.y + (B.y - A.y) * u;
      ctx.fillStyle = acc;
      ctx.globalAlpha = p.fg ? 1 : 0.55;
      ctx.beginPath(); ctx.arc(x, y, p.fg ? lw * 0.9 : 2, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      if (p.t >= 1) {
        pulses.splice(i, 1);
        if (p.fg) fire(p.b, p.depth, p.a); else big[p.b].a = Math.max(big[p.b].a, 0.7);
      }
    }
    for (const n of fg) {
      ctx.beginPath(); ctx.arc(n.x, n.y, rr, 0, 7);
      ctx.fillStyle = ink; ctx.fill();
      if (n.a > 0.01) {
        ctx.beginPath(); ctx.arc(n.x, n.y, rr * (0.55 + 0.45 * n.a), 0, 7);
        ctx.fillStyle = acc; ctx.globalAlpha = n.a; ctx.fill(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(n.x, n.y, rr * (1 + (1 - n.a) * 0.9), 0, 7);
        ctx.strokeStyle = acc; ctx.lineWidth = 1.2; ctx.globalAlpha = n.a * 0.6; ctx.stroke(); ctx.globalAlpha = 1;
        ctx.lineWidth = lw; ctx.strokeStyle = ink;
      }
      n.a = Math.max(0, n.a - dt * 1.4);
    }
  });
}
