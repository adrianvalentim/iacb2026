// A unidade básica: neurônio ou direção? Dados reais do TinyStories-1M (camada 3).
// À esquerda, as palavras que mais ativam um neurônio sorteado do MLP. À direita, as
// mesmas palavras numa régua: a projeção de cada uma na direção "ponte".
import { rng, revealOnce } from '../lib.js';

export default function direction(sec) {
  const list = sec.querySelector('.neu-words'), idEl = sec.querySelector('.neu-id');
  const ruler = sec.querySelector('.dir-ruler');
  const R = rng(Date.now() % 100000);
  fetch(new URL('../../assets/model/ponte.json', import.meta.url)).then(r => r.json()).then(D => {
    const words = D.palavras, proj = D.projecao, A = D.neuronios.ativ, N = D.neuronios.n;
    // neurônios que de fato disparam nessas frases
    const active = [];
    for (let n = 0; n < N; n++) { let mx = 0; for (const row of A) mx = Math.max(mx, row[n]); if (mx > 0.08) active.push(n); }

    // ---- régua
    const els = new Map();
    const lo = Math.min(...proj), hi = Math.max(...proj);
    const axis = document.createElement('i'); axis.className = 'dir-axis'; ruler.append(axis);
    const order = words.map((w, i) => i).sort((a, b) => proj[b] - proj[a]);
    const top10 = new Set(order.slice(0, 10));
    function place() {
      const H = ruler.clientHeight, Wd = ruler.clientWidth;
      const colW = Math.min(118, (Wd - 20) / 3);
      const y = i => 10 + (hi - proj[i]) / (hi - lo) * (H - 20);
      const lastY = [-1e9, -1e9, -1e9];
      // rotula das pontas para o meio; se não couber em nenhuma coluna, fica só o traço
      const seq = [];
      for (let a = 0, b = order.length - 1; a <= b; a++, b--) { seq.push(order[a]); if (a !== b) seq.push(order[b]); }
      const placed = [];
      for (const i of seq) {
        const yy = y(i);
        let col = -1;
        for (let c = 0; c < 3; c++) if (placed.every(p => p.c !== c || Math.abs(p.y - yy) > 15)) { col = c; break; }
        placed.push({ i, y: yy, c: col });
      }
      for (const p of placed) {
        let el = els.get(p.i);
        if (!el) {
          el = document.createElement('span');
          el.className = 'dir-word' + (top10.has(p.i) ? ' hi' : '');
          el.textContent = words[p.i] === 'bridge' ? 'bridge  ← a única usada no cálculo' : words[p.i];
          el.title = `${words[p.i]}: ${proj[p.i].toFixed(3)}`;
          el.style.top = '50%'; el.style.opacity = 0;
          ruler.append(el); els.set(p.i, el);
        }
        el.style.setProperty('--tick', `${14 + Math.max(0, p.c) * colW}px`);
        el.dataset.hidden = p.c < 0;
        requestAnimationFrame(() => {
          el.style.top = `${p.y}px`;
          el.style.opacity = p.c < 0 ? 0.25 : 1;
          if (p.c < 0) el.style.color = 'transparent';
        });
      }
      lastY.length = 0;
    }
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); place(); } }, { rootMargin: '0px 0px -20% 0px' });
    io.observe(ruler);
    addEventListener('resize', () => { if (els.size) place(); });

    // ---- neurônio sorteado
    function shuffle() {
      const n = active[Math.floor(R() * active.length)];
      idEl.textContent = `nº ${n} · camada ${D.neuronios.camada}`;
      const ranked = words.map((w, i) => [A[i][n], i]).sort((a, b) => b[0] - a[0]).slice(0, 9);
      const mx = ranked[0][0] || 1;
      list.innerHTML = '';
      ranked.forEach(([v, i], k) => {
        const li = document.createElement('li');
        li.textContent = words[i];
        li.style.setProperty('--w', Math.max(0, v / mx).toFixed(3));
        li.style.setProperty('--i', k);
        li.addEventListener('pointerenter', () => { const e = els.get(i); if (e) e.style.outline = '1px solid var(--accent)'; });
        li.addEventListener('pointerleave', () => { const e = els.get(i); if (e) e.style.outline = ''; });
        list.append(li);
      });
    }
    sec.querySelector('.neu-shuffle').addEventListener('click', shuffle);
    shuffle();
  });
  revealOnce(sec.querySelectorAll('.unit-col'));
}
