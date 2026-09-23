// Emergência: o meio-sol dos slides nasce com a rolagem.
import { svg, clamp, revealOnce } from '../lib.js';

export default function emergence(sec) {
  const S = sec.querySelector('.sun');
  svg('line', { x1: -110, y1: 0, x2: 110, y2: 0, class: 'hz' }, S);
  const rays = [];
  const n = 23;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const r0 = 14, r1 = 60 + (i % 2 ? 22 : 40) + (i % 3 === 0 ? 12 : 0);
    const l = svg('line', { x1: Math.cos(a) * r0, y1: Math.sin(a) * r0, x2: Math.cos(a) * r1, y2: Math.sin(a) * r1 }, S);
    const len = r1 - r0;
    l.style.strokeDasharray = len; l.style.strokeDashoffset = len;
    rays.push({ l, len, i });
  }
  let q = false;
  const upd = () => {
    q = false;
    const r = S.getBoundingClientRect();
    const u = clamp((innerHeight * 0.95 - r.top) / (innerHeight * 0.6));
    rays.forEach(({ l, len, i }) => {
      const mid = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2); // do centro para as bordas
      const v = clamp((u - mid * 0.45) / 0.55);
      l.style.strokeDashoffset = len * (1 - v);
    });
  };
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(upd); } }, { passive: true });
  upd();
  const items = sec.querySelectorAll('.emerge li, .recap');
  items.forEach(i => i.classList.add('rv'));
  revealOnce(items, { stagger: 250 });
}
