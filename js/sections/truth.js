// A direção da verdade (esquema): frases verdadeiras e falsas se separam ao longo de
// uma direção nas ativações. "Inverter" empurra as ativações ao longo dela, e o
// modelo passa a ler o falso como verdadeiro. Pontos ilustrativos, não dados do artigo.
import { fitCanvas, loop, COLORS, rng, clamp, smooth } from '../lib.js';

const PAIRS = [
  ['Paris', 'na França', 'no Japão'], ['Tóquio', 'no Japão', 'no Peru'], ['Lima', 'no Peru', 'na Noruega'],
  ['Recife', 'no Brasil', 'no Egito'], ['Nairóbi', 'no Quênia', 'na Itália'], ['Oslo', 'na Noruega', 'no Chile'],
  ['Cairo', 'no Egito', 'no Canadá'], ['Sydney', 'na Austrália', 'na Índia'], ['Montreal', 'no Canadá', 'na Austrália'],
  ['Mumbai', 'na Índia', 'no Brasil'], ['Roma', 'na Itália', 'no Quênia'], ['Santiago', 'no Chile', 'na França'],
  ['Lagos', 'na Nigéria', 'na Suécia'], ['Hanói', 'no Vietnã', 'na Argentina'], ['Rosário', 'na Argentina', 'no Vietnã'],
  ['Estocolmo', 'na Suécia', 'na Nigéria'], ['Manaus', 'no Brasil', 'na Coreia'], ['Seul', 'na Coreia do Sul', 'no México'],
];

export default function truth(sec) {
  const canvas = sec.querySelector('.truth');
  const sEl = sec.querySelector('.truth-s'), vEl = sec.querySelector('.truth-v'), lab = sec.querySelector('.truth-card .mono-label');
  const R = rng(31);
  const pts = [];
  PAIRS.forEach(([c, t, f]) => {
    [[t, true], [f, false]].forEach(([p, ok]) => {
      const u = (ok ? 1 : -1) * (0.55 + R() * 0.45) + (R() - 0.5) * 0.25;
      pts.push({ s: `${c} fica ${p}.`, ok, u, v: (R() - 0.5) * 1.6, shift: 0 });
    });
  });
  let ctx, W, H, flip = 0, target = 0, hover = null, t0 = 0;
  const ang = -0.42;
  const dir = [Math.cos(ang), Math.sin(ang)], ortho = [-dir[1], dir[0]];
  const pos = p => {
    const u = p.u + p.shift;
    const sc = Math.min(W, H * 1.6) * 0.3;
    return [W / 2 + (dir[0] * u + ortho[0] * p.v * 0.6) * sc, H / 2 + (dir[1] * u + ortho[1] * p.v * 0.6) * sc];
  };
  const layout = () => ({ ctx, w: W, h: H } = fitCanvas(canvas));
  layout(); addEventListener('resize', layout);

  function card(p) {
    if (!p) return;
    lab.textContent = p.ok ? 'Frase verdadeira' : 'Frase falsa';
    sEl.textContent = p.s;
    const reads = p.u + p.shift > 0;
    vEl.innerHTML = `o modelo lê: <span style="color:${reads ? 'var(--ink)' : 'var(--accent)'}">${reads ? 'VERDADEIRA' : 'FALSA'}</span>` + (reads !== p.ok ? ' ← empurrada pela intervenção' : '');
  }
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 30;
    for (const p of pts) { const [px, py] = pos(p); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = p; } }
    hover = best; card(best);
  });
  sec.querySelector('.truth-flip').addEventListener('click', e => {
    target = target ? 0 : 1; t0 = performance.now();
    e.currentTarget.setAttribute('aria-pressed', !!target);
    if (!hover) hover = pts.find(p => !p.ok);
    card(hover);
  });
  hover = pts[0]; card(hover);

  loop(canvas, dt => {
    flip += (target - flip) * Math.min(1, dt * 3.2);
    pts.forEach(p => { p.shift = p.ok ? 0 : smooth(clamp(flip)) * 1.9; });
    if (hover) card(hover);
    const ink = COLORS.ink, acc = COLORS.accent;
    ctx.clearRect(0, 0, W, H);
    // fronteira e direção
    const sc = Math.min(W, H * 1.6) * 0.3;
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.25; ctx.setLineDash([4, 6]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W / 2 - ortho[0] * sc * 1.2, H / 2 - ortho[1] * sc * 1.2); ctx.lineTo(W / 2 + ortho[0] * sc * 1.2, H / 2 + ortho[1] * sc * 1.2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    const ax0 = [W / 2 - dir[0] * sc * 1.55, H / 2 - dir[1] * sc * 1.55], ax1 = [W / 2 + dir[0] * sc * 1.55, H / 2 + dir[1] * sc * 1.55];
    ctx.strokeStyle = acc; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(...ax0); ctx.lineTo(...ax1); ctx.stroke();
    const hd = 14, a = Math.atan2(dir[1], dir[0]);
    ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(...ax1);
    ctx.lineTo(ax1[0] - hd * Math.cos(a - 0.4), ax1[1] - hd * Math.sin(a - 0.4)); ctx.lineTo(ax1[0] - hd * Math.cos(a + 0.4), ax1[1] - hd * Math.sin(a + 0.4)); ctx.fill();
    ctx.font = '500 11px "JetBrains Mono", monospace'; ctx.fillStyle = acc;
    ctx.fillText('VERDADEIRO →', ax1[0] - 110, ax1[1] - 14);
    ctx.fillStyle = ink; ctx.globalAlpha = 0.6; ctx.fillText('← FALSO', ax0[0] + 4, ax0[1] + 22); ctx.globalAlpha = 1;
    for (const p of pts) {
      const [x, y] = pos(p);
      ctx.beginPath(); ctx.arc(x, y, p === hover ? 8 : 5.5, 0, 7);
      if (p.ok) { ctx.fillStyle = ink; ctx.fill(); }
      else { ctx.fillStyle = COLORS.paper; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.stroke(); }
      if (p === hover) { ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.stroke(); }
    }
  });
}
