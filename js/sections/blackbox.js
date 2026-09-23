// Abrir a caixa-preta: a tampa sobe e revela uma rede; circuitos acendem lá dentro.
// Embaixo, as três afirmações do "Zoom In" (Olah et al., 2020), em miniatura.
import { svg, rng, revealOnce, visible, reduced } from '../lib.js';

function circuitBox(S) {
  const R = rng(14);
  const layers = [5, 6, 6, 5, 4], nodes = [], edges = [];
  layers.forEach((n, l) => {
    const col = [];
    for (let i = 0; i < n; i++) col.push({ x: 50 + l * 75, y: 200 + (i - (n - 1) / 2) * 62 + (R() - 0.5) * 18, l });
    nodes.push(col);
  });
  for (let l = 0; l < layers.length - 1; l++) for (const a of nodes[l]) for (const b of nodes[l + 1]) if (R() < 0.42) edges.push([a, b]);
  const eEls = edges.map(([a, b]) => ({ a, b, el: svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, S) }));
  const nEls = nodes.flat().map(n => ({ n, el: svg('circle', { cx: n.x, cy: n.y, r: 9 }, S) }));
  // um "circuito": um caminho da primeira à última camada
  const path = () => {
    let cur = nodes[0][Math.floor(R() * nodes[0].length)];
    const out = [cur];
    for (let l = 1; l < layers.length; l++) {
      const opts = edges.filter(([a]) => a === cur).map(([, b]) => b);
      if (!opts.length) break;
      cur = opts[Math.floor(R() * opts.length)]; out.push(cur);
    }
    return out;
  };
  return () => {
    const p = path();
    nEls.forEach(({ n, el }) => el.classList.toggle('hot', p.includes(n)));
    eEls.forEach(({ a, b, el }) => el.classList.toggle('hot', p.includes(a) && p.includes(b) && p.indexOf(b) === p.indexOf(a) + 1));
  };
}

function claimFeature(S) {
  const R = rng(3);
  const cs = [];
  for (let i = 0; i < 16; i++) cs.push(svg('circle', { cx: 30 + (i % 8) * 20, cy: 40 + Math.floor(i / 8) * 26, r: 6 }, S));
  const pick = [2, 5, 9, 12, 14];
  svg('text', { x: 100, y: 118, 'text-anchor': 'middle' }, S).textContent = 'uma feature = um padrão de ativação';
  return on => cs.forEach((c, i) => c.classList.toggle('hot', on && pick.includes(i) && R() < 2));
}
function claimCircuit(S) {
  const pts = { jan: [36, 36], roda: [36, 100], carro: [160, 68] };
  const l1 = svg('path', { d: 'M48 38 C100 40 110 64 148 66' }, S);
  const l2 = svg('path', { d: 'M48 98 C100 96 110 72 148 70' }, S);
  const cs = Object.entries(pts).map(([k, [x, y]]) => {
    const c = svg('circle', { cx: x, cy: y, r: 11 }, S);
    svg('text', { x, y: y + (k === 'jan' ? -18 : 26), 'text-anchor': 'middle' }, S).textContent = { jan: 'janela', roda: 'roda', carro: 'carro' }[k];
    return c;
  });
  return on => [...cs, l1, l2].forEach(e => e.classList.toggle('hot', on));
}
function claimUniversal(S) {
  const R = rng(9);
  const hot = [];
  [[10, 'rede A'], [110, 'rede B']].forEach(([ox, name], k) => {
    const pts = [];
    for (let i = 0; i < 7; i++) pts.push([ox + 12 + R() * 66, 18 + R() * 84]);
    for (let i = 0; i < 9; i++) { const a = pts[Math.floor(R() * 7)], b = pts[Math.floor(R() * 7)]; svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, S); }
    pts.forEach((p, i) => { const c = svg('circle', { cx: p[0], cy: p[1], r: 5.5 }, S); if (i === 3 + k) hot.push(c); });
    svg('text', { x: ox + 45, y: 124, 'text-anchor': 'middle' }, S).textContent = name;
  });
  // o mesmo detector de "curva" nas duas
  hot.forEach(c => { svg('path', { d: `M${+c.getAttribute('cx') - 8} ${+c.getAttribute('cy') - 12} q8 -8 16 0`, class: 'curve' }, S); });
  return on => hot.forEach(c => c.classList.toggle('hot', on));
}

export default function blackbox(sec) {
  const box = sec.querySelector('.blackbox');
  const flash = circuitBox(sec.querySelector('.bb-circuit'));
  let timer = 0;
  visible(box, v => {
    clearInterval(timer);
    if (!v) return;
    setTimeout(() => box.classList.add('open'), reduced ? 0 : 500);
    flash();
    if (!reduced) timer = setInterval(flash, 1800);
  }, '0px 0px -25% 0px');

  const makers = [claimFeature, claimCircuit, claimUniversal];
  const items = Array.from(sec.querySelectorAll('.claims3 li'));
  const toggles = items.map((li, i) => makers[i](li.querySelector('svg')));
  items.forEach((li, i) => {
    li.classList.add('rv');
    li.addEventListener('pointerenter', () => toggles[i](true));
    li.addEventListener('pointerleave', () => toggles[i](false));
  });
  revealOnce(items, { stagger: 300 });
  // acendem sozinhos, um de cada vez, enquanto visíveis
  let k = 0, t2 = 0;
  visible(sec.querySelector('.claims3'), v => {
    clearInterval(t2);
    if (!v || reduced) return;
    t2 = setInterval(() => { toggles.forEach((t, i) => t(i === k % 3)); k++; }, 1400);
  });
}
