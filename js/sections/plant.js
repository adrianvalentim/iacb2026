// "Não são criados, mas cultivados": uma planta a nanquim que cresce com a rolagem.
// Mesmas regras de crescimento, outra semente, outra planta. No fim, flores que
// ninguém plantou (em laranja).
import { fitCanvas, onTrack, rng, COLORS, clamp, smooth, reduced } from '../lib.js';

function grow(seed, W, H) {
  const R = rng(seed);
  const segs = [], leaves = [], flowers = [];
  const mobile = W < 900;
  const baseX = mobile ? W * 0.55 : W * 0.72, baseY = H - (mobile ? 96 : 70);
  const scale = Math.min(H * (mobile ? 0.62 : 0.92), W * (mobile ? 1.1 : 0.6)) / 100;
  let maxT = 0;

  function branch(x, y, ang, len, width, depth, t) {
    const n = Math.max(4, Math.round(len / 2.2));
    const step = len / n;
    let curve = (R() - 0.5) * 0.05;
    for (let i = 0; i < n; i++) {
      curve += (R() - 0.5) * 0.035;
      ang += curve + (-Math.PI / 2 - ang) * 0.035; // leve fototropismo
      const nx = x + Math.cos(ang) * step * scale, ny = y + Math.sin(ang) * step * scale;
      const w = width * (1 - i / n * 0.55);
      segs.push({ x, y, nx, ny, w, t0: t, t1: t + step * 0.012 });
      t += step * 0.012;
      x = nx; y = ny;
      if (depth > 0 && i > 1 && R() < 0.1 + depth * 0.02) {
        const side = R() < 0.5 ? -1 : 1;
        branch(x, y, ang + side * (0.45 + R() * 0.55), len * (0.42 + R() * 0.28), w * 0.62, depth - 1, t + 0.02);
      }
      if (i > 0 && R() < 0.36) {
        const side = i % 2 ? 1 : -1;
        leaves.push({ x, y, a: ang + side * (0.7 + R() * 0.5), s: (4 + R() * 4) * scale * (0.6 + width / 6), t0: t + 0.03 });
      }
    }
    maxT = Math.max(maxT, t);
    if (depth <= 1 && R() < 0.55) flowers.push({ x, y, s: (2.2 + R() * 1.6) * scale, t0: t, rot: R() * 6 });
    else leaves.push({ x, y, a: ang, s: 4.5 * scale, t0: t });
  }
  branch(baseX, baseY, -Math.PI / 2 + (R() - 0.5) * 0.2, 56 + R() * 10, 6, 4, 0);
  // normaliza os tempos para [0, 0.86]; as flores abrem por último
  const k = 0.86 / maxT;
  for (const s of segs) { s.t0 *= k; s.t1 *= k; }
  for (const l of leaves) l.t0 = Math.min(0.9, l.t0 * k);
  for (const f of flowers) f.t0 = 0.86 + (f.t0 * k / 0.86) * 0.1;
  return { segs, leaves, flowers, baseX, baseY };
}

export default function plant(sec) {
  const canvas = sec.querySelector('.plant');
  const track = sec.querySelector('.pin-track');
  const b = sec.querySelector('.grow-b');
  let W, H, ctx, P, seed = 2026, g = 0, shown = 0, anim = null;

  const layout = () => { ({ ctx, w: W, h: H } = fitCanvas(canvas)); P = grow(seed, W, H); draw(shown); };

  function draw(G) {
    ctx.clearRect(0, 0, W, H);
    const ink = COLORS.ink, paper = COLORS.paper2, acc = COLORS.accent;
    // chão
    ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(P.baseX - 140, P.baseY + 1); ctx.lineTo(P.baseX + 140, P.baseY + 1); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    for (const s of P.segs) {
      if (s.t0 > G) continue;
      const u = clamp((G - s.t0) / (s.t1 - s.t0));
      const thick = s.w * (0.35 + 0.65 * clamp((G - s.t0) / 0.35));
      ctx.lineWidth = Math.max(0.6, thick);
      ctx.strokeStyle = ink;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + (s.nx - s.x) * u, s.y + (s.ny - s.y) * u); ctx.stroke();
    }
    for (const l of P.leaves) {
      const u = smooth(clamp((G - l.t0) / 0.07));
      if (u <= 0) continue;
      const s = l.s * u;
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.a);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 0.5, -s * 0.42, s, 0); ctx.quadraticCurveTo(s * 0.5, s * 0.42, 0, 0);
      ctx.fillStyle = paper; ctx.fill();
      ctx.lineWidth = 1.1; ctx.strokeStyle = ink; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.85, 0); ctx.lineWidth = 0.7; ctx.stroke();
      ctx.restore();
    }
    for (const f of P.flowers) {
      const u = smooth(clamp((G - f.t0) / 0.05));
      if (u <= 0) continue;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot + u * 0.6);
      for (let i = 0; i < 5; i++) {
        ctx.rotate(Math.PI * 2 / 5);
        ctx.beginPath(); ctx.ellipse(f.s * 0.62 * u, 0, f.s * 0.55 * u, f.s * 0.3 * u, 0, 0, 7);
        ctx.fillStyle = acc; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(0, 0, f.s * 0.22 * u, 0, 7); ctx.fillStyle = ink; ctx.fill();
      ctx.restore();
    }
  }

  layout();
  addEventListener('resize', layout);
  onTrack(track, p => {
    g = reduced ? 1 : clamp(p / 0.82);
    b.classList.toggle('in', g > 0.45);
    if (!anim) { shown = g; draw(g); }
  });
  sec.querySelector('.reseed').addEventListener('click', () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    P = grow(seed, W, H);
    const t0 = performance.now(), target = Math.max(g, 0.6);
    cancelAnimationFrame(anim);
    const step = now => {
      const u = clamp((now - t0) / 2600);
      shown = target * smooth(u);
      draw(shown);
      anim = u < 1 ? requestAnimationFrame(step) : null;
    };
    anim = requestAnimationFrame(step);
  });
}
