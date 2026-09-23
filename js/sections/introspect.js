// Introspecção (Lindsey, 2025): injetar um conceito nas ativações e perguntar ao modelo
// se ele percebe. E a injeção retroativa de "pão". Respostas parafraseadas.
import { fitCanvas, loop, COLORS, rng, reduced } from '../lib.js';

const A = {
  off: 'Não detecto nenhum pensamento injetado. Parece tudo normal por aqui.',
  on: 'Percebo algo: parece um pensamento injetado… algo como <b>ALTO</b>, como <b>GRITAR</b>.',
};
const B = {
  off: '“Foi um acidente. ‘Pão’ não tem nada a ver com a frase. Eu quis dizer outra coisa.”',
  on: '“Foi de propósito: eu estava pensando em <b>pão</b>…” E ainda inventa um motivo.',
};

async function typeHTML(el, html, my, ref) {
  // digita o texto preservando as tags
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  const full = tmp.textContent;
  for (let i = 1; i <= full.length; i++) {
    if (ref.run !== my) return;
    let n = i;
    const walk = node => {
      const out = node.cloneNode(false);
      for (const c of node.childNodes) {
        if (n <= 0) break;
        if (c.nodeType === 3) { out.append(c.textContent.slice(0, n)); n -= c.textContent.length; }
        else out.append(walk(c));
      }
      return out;
    };
    el.innerHTML = walk(tmp).innerHTML;
    await new Promise(r => setTimeout(r, reduced ? 0 : 18));
  }
}

export default function introspect(sec) {
  const [e1, e2] = sec.querySelectorAll('.intro-exp');
  const btn1 = sec.querySelector('.intro-inject'), btn2 = sec.querySelector('.intro-bread');
  const a = sec.querySelector('.intro-a'), b = sec.querySelector('.intro-b');
  const canvas = sec.querySelector('.intro-strip');
  const R = rng(8);
  const base = Array.from({ length: 64 }, () => (R() - 0.5) * 0.9);
  const caps = Array.from({ length: 64 }, (_, i) => Math.exp(-((i - 38) ** 2) / 30) * 1.6 - Math.exp(-((i - 17) ** 2) / 12) * 0.9);
  let inj = 0, target = 0, ctx, W, H;
  const ref1 = { run: 0 }, ref2 = { run: 0 };
  const layout = () => ({ ctx, w: W, h: H } = fitCanvas(canvas));
  layout(); addEventListener('resize', layout);

  typeHTML(a, A.off, 0, ref1);
  typeHTML(b, B.off, 0, ref2);
  btn1.addEventListener('click', () => {
    target = target ? 0 : 1;
    btn1.setAttribute('aria-pressed', !!target);
    e1.classList.toggle('injected', !!target);
    typeHTML(a, target ? A.on : A.off, ++ref1.run, ref1);
  });
  btn2.addEventListener('click', () => {
    const on = btn2.getAttribute('aria-pressed') !== 'true';
    btn2.setAttribute('aria-pressed', on);
    typeHTML(b, on ? B.on : B.off, ++ref2.run, ref2);
  });

  loop(canvas, (dt, t) => {
    inj += (target - inj) * Math.min(1, dt * 4);
    ctx.clearRect(0, 0, W, H);
    const bw = W / 64;
    for (let i = 0; i < 64; i++) {
      const v = base[i] * (0.85 + 0.15 * Math.sin(t * 1.3 + i)) + caps[i] * inj;
      const h = Math.min(H / 2 - 1, Math.abs(v) * H * 0.3);
      ctx.fillStyle = Math.abs(caps[i] * inj) > 0.25 ? COLORS.accent : COLORS.ink;
      ctx.fillRect(i * bw + 1, v > 0 ? H / 2 - h : H / 2, bw - 2, h);
    }
    ctx.fillStyle = COLORS.ink; ctx.globalAlpha = 0.3; ctx.fillRect(0, H / 2, W, 1); ctx.globalAlpha = 1;
  });
}
