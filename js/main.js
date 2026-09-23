// Orquestra a página: textura de papel, HUD (a rede do logo acende conforme a leitura),
// índice, e o carregamento preguiçoso de cada capítulo.
import { rng, svg, reduced } from './lib.js';
import { load as loadModel } from './model/client.js';

// ---------------------------------------------------------------- grão do papel
(function grain() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  const r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) {
    // ruído leve + algumas fibras mais escuras
    const n = 238 + r() * 17 - (r() < 0.012 ? 30 * r() : 0);
    img.data[i] = n; img.data[i + 1] = n - 2; img.data[i + 2] = n - 6; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`);
})();

// ---------------------------------------------------------------- capítulos
const sections = Array.from(document.querySelectorAll('main > section[data-num]'));

// ---------------------------------------------------------------- logo: a rede de 9 nós da capa
const NODES = [[14, 34], [42, 16], [42, 44], [74, 50], [42, 64], [14, 76], [42, 86], [80, 84], [74, 24]];
const EDGES = [[0, 2], [1, 2], [1, 8], [2, 3], [2, 4], [0, 4], [4, 6], [5, 6], [6, 7], [3, 7], [8, 3], [5, 4]];
const logo = document.querySelector('.hud-logo svg');
const gE = logo.querySelector('.net-edges'), gN = logo.querySelector('.net-nodes');
EDGES.forEach(([a, b]) => svg('line', { x1: NODES[a][0], y1: NODES[a][1], x2: NODES[b][0], y2: NODES[b][1] }, gE));
const nodeEls = NODES.map(([x, y]) => svg('circle', { cx: x, cy: y, r: 7.5 }, gN));

// ---------------------------------------------------------------- índice
const toc = document.getElementById('toc');
const tocList = toc.querySelector('.toc-list');
const logoBtn = document.querySelector('.hud-logo');
sections.forEach(s => {
  const li = document.createElement('li');
  li.innerHTML = `<a href="#${s.id}"><span>${s.dataset.num}</span>${s.dataset.title}</a>`;
  tocList.appendChild(li);
});
const tocItems = Array.from(tocList.children);
function setToc(open) {
  toc.hidden = !open;
  logoBtn.setAttribute('aria-expanded', open);
  document.documentElement.style.overflow = open ? 'hidden' : '';
  if (open) toc.querySelector('a').focus();
}
logoBtn.addEventListener('click', () => setToc(toc.hidden));
toc.querySelector('.toc-close').addEventListener('click', () => setToc(false));
toc.addEventListener('click', e => { if (e.target.closest('a')) setToc(false); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !toc.hidden) setToc(false); });

// ---------------------------------------------------------------- onde estou
const hudNum = document.querySelector('.hud-num'), hudTitle = document.querySelector('.hud-title');
const seen = new Set();
let current = null;
function where() {
  const y = innerHeight * 0.45;
  let cur = sections[0];
  for (const s of sections) if (s.getBoundingClientRect().top <= y) cur = s;
  if (cur !== current) {
    current = cur;
    hudNum.textContent = cur.dataset.num;
    hudTitle.textContent = cur.dataset.title;
    const i = sections.indexOf(cur);
    seen.add(i);
    tocItems.forEach((li, k) => li.classList.toggle('seen', seen.has(k)));
    // os 9 nós acendem conforme a leitura avança; o nó do momento fica laranja
    const frac = i / (sections.length - 1);
    const lit = Math.round(frac * NODES.length);
    nodeEls.forEach((n, k) => { n.classList.toggle('lit', k < lit); n.classList.toggle('now', k === Math.min(NODES.length - 1, lit) && i > 0); });
  }
  // HUD sobre fundo escuro
  let dark = false;
  for (const s of document.querySelectorAll('.inverse')) {
    const r = s.getBoundingClientRect();
    if (r.top < 40 && r.bottom > 40) dark = true;
  }
  document.body.classList.toggle('on-dark', dark);
}
addEventListener('scroll', () => requestAnimationFrame(where), { passive: true });
where();

// ---------------------------------------------------------------- carregamento preguiçoso
const started = new WeakSet();
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting || started.has(e.target)) return;
  started.add(e.target);
  const name = e.target.dataset.module;
  if (!name || name === 'none') return;
  import(`./sections/${name}.js`)
    .then(m => m.default(e.target))
    .catch(err => console.error(`[${name}]`, err));
}), { rootMargin: '120% 0px' });
sections.forEach(s => io.observe(s));

// o modelo (8,3 MB) começa a baixar quando o leitor se aproxima dos números;
// com "economia de dados" ligada, só quando ele chega lá
const dive = document.getElementById('numeros');
const saveData = navigator.connection && navigator.connection.saveData;
const warm = new IntersectionObserver(es => {
  if (es.some(e => e.isIntersecting)) { loadModel().catch(err => console.error(err)); warm.disconnect(); }
}, { rootMargin: saveData ? '0px' : '250% 0px' });
warm.observe(dive);
if (reduced) document.documentElement.classList.add('reduced');
