// A citação de Turing acende palavra por palavra conforme passa pela tela.
import { clamp, revealOnce } from '../lib.js';

export default function quote(sec) {
  const p = sec.querySelector('.reveal-words');
  const words = [];
  const wrap = node => {
    for (const n of Array.from(node.childNodes)) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(t => {
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.append(t); return; }
          const s = document.createElement('span');
          s.className = 'w'; s.textContent = t; words.push(s); frag.append(s);
        });
        n.replaceWith(frag);
      } else wrap(n);
    }
  };
  wrap(p);
  sec.querySelectorAll('.q-lines span').forEach(s => s.classList.add('rv'));
  revealOnce(sec.querySelectorAll('.q-lines span'), { stagger: 500 });
  let queued = false;
  const upd = () => {
    queued = false;
    const r = p.getBoundingClientRect();
    // começa a acender quando o topo passa de 85% da tela; termina quando o fim chega a 45%
    const u = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.4));
    const n = Math.round(u * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(upd); } }, { passive: true });
  upd();
}
