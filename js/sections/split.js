// "Entendemos perfeitamente" × "não temos a mínima ideia": uma divisória para arrastar.
// Embaixo, a resolução: o treinamento é uma curva limpa; a rede resultante, um emaranhado.
import { loop, revealOnce, fitCanvas, rng, COLORS, svg, clamp, reduced } from '../lib.js';

export default function split(sec) {
  const box = sec.querySelector('.split'), handle = box.querySelector('.split-handle');
  let x = 50, touched = false, t0 = performance.now();
  const set = v => { x = clamp(v, 4, 96); box.style.setProperty('--x', x + '%'); };

  // balança sozinha até alguém mexer
  loop(box, () => {
    if (touched || reduced) return;
    const t = (performance.now() - t0) / 1000;
    set(50 + Math.sin(t * 0.9) * 16 * Math.min(1, t / 2));
  });
  const move = e => {
    const r = box.getBoundingClientRect();
    set((e.clientX - r.left) / r.width * 100);
  };
  box.addEventListener('pointerdown', e => {
    touched = true;
    box.setPointerCapture(e.pointerId);
    move(e);
    const up = () => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', up);
  });
  handle.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { touched = true; set(x + (e.key === 'ArrowLeft' ? -5 : 5)); e.preventDefault(); }
  });

  // curva de perda do treinamento: limpa, previsível
  const loss = sec.querySelector('.loss');
  svg('line', { x1: 10, y1: 110, x2: 290, y2: 110, class: 'ax' }, loss);
  svg('line', { x1: 10, y1: 110, x2: 10, y2: 8, class: 'ax' }, loss);
  const r = rng(11);
  let d = 'M10 14';
  for (let i = 1; i <= 140; i++) {
    const t = i / 140;
    const y = 14 + 90 * (1 - Math.exp(-t * 5.5)) + (r() - 0.5) * 6 * (1 - t * 0.7);
    d += ` L${(10 + t * 280).toFixed(1)} ${y.toFixed(1)}`;
  }
  const p = svg('path', { d }, loss);
  const len = p.getTotalLength();
  p.style.strokeDasharray = len; p.style.strokeDashoffset = len;

  // o emaranhado
  const tangle = sec.querySelector('.tangle');
  const drawTangle = () => {
    const { ctx, w, h } = fitCanvas(tangle);
    const q = rng(5);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = COLORS.ink;
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = 0.12 + q() * 0.4;
      ctx.lineWidth = 0.6 + q() * 1.1;
      ctx.beginPath();
      ctx.moveTo(q() * w, q() * h);
      ctx.bezierCurveTo(q() * w, q() * h, q() * w, q() * h, q() * w, q() * h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  const cols = sec.querySelectorAll('.resolve-col');
  cols.forEach(c => c.classList.add('rv'));
  revealOnce(cols, { stagger: 350 });
  const io = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    p.style.transition = 'stroke-dashoffset 2.4s cubic-bezier(.65,0,.35,1) .3s';
    p.style.strokeDashoffset = 0;
    drawTangle();
  }, { rootMargin: '0px 0px -20% 0px' });
  io.observe(loss);
  addEventListener('resize', drawTangle);
}
