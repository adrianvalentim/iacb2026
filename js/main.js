// Orquestra a página: textura de papel, HUD (menu e capítulo atual),
// índice, e o carregamento preguiçoso de cada capítulo.
import { rng, reduced } from './lib.js';
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

// ---------------------------------------------------------------- índice (o botão de menu vira um X)
const toc = document.getElementById('toc');
const tocList = toc.querySelector('.toc-list');
const menuBtn = document.querySelector('.hud-menu');
sections.forEach(s => {
  const li = document.createElement('li');
  li.innerHTML = `<a href="#${s.id}"><span>${s.dataset.num}</span>${s.dataset.title}</a>`;
  tocList.appendChild(li);
});
const tocItems = Array.from(tocList.children);
function setToc(open) {
  toc.hidden = !open;
  menuBtn.setAttribute('aria-expanded', open);
  menuBtn.setAttribute('aria-label', open ? 'Fechar o índice' : 'Abrir o índice');
  document.body.classList.toggle('toc-open', open);
  document.documentElement.style.overflow = open ? 'hidden' : '';
  // o índice é claro: o HUD volta ao tema claro enquanto ele estiver aberto
  if (open) { document.body.classList.remove('on-dark'); toc.querySelector('a').focus(); }
  else { where(); menuBtn.focus(); }
}
menuBtn.addEventListener('click', () => setToc(toc.hidden));
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
const started = new Map();
function initSection(sec) {
  if (started.has(sec)) return started.get(sec);
  const name = sec.dataset.module;
  const p = !name || name === 'none' ? Promise.resolve()
    : import(`./sections/${name}.js`)
      .then(m => m.default(sec))
      .catch(err => console.error(`[${name}]`, err));
  started.set(sec, p);
  return p;
}
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) initSection(e.target); }), { rootMargin: '120% 0px' });
sections.forEach(s => io.observe(s));

// ---------------------------------------------------------------- saltos para um capítulo
// Alguns capítulos crescem quando montam seus experimentos. Antes de saltar, monta tudo o
// que está acima do destino; assim o destino não escorrega para baixo depois do salto.
const MODEL_CHAPTERS = new Set(['dive', 'live', 'steer']);
async function jumpTo(id, push = true) {
  const target = document.getElementById(id);
  if (!target) return;
  const upTo = sections.findIndex(s => s === target || s.contains(target));
  // os capítulos do modelo (8 MB) não entram: têm altura fixa desde o HTML/CSS
  const pending = sections.slice(0, upTo + 1)
    .filter(s => !MODEL_CHAPTERS.has(s.dataset.module) || s === sections[upTo])
    .map(initSection);
  await Promise.race([Promise.all(pending), new Promise(r => setTimeout(r, 1500))]);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  target.scrollIntoView({ block: 'start' });
  if (push) history.pushState(null, '', `#${id}`);
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const id = decodeURIComponent(a.getAttribute('href').slice(1));
  if (!id || !document.getElementById(id)) return;
  e.preventDefault();
  jumpTo(id);
});
addEventListener('popstate', () => { if (location.hash) jumpTo(decodeURIComponent(location.hash.slice(1)), false); });
if (location.hash) jumpTo(decodeURIComponent(location.hash.slice(1)), false);

// o modelo (8,3 MB) começa a baixar quando o leitor se aproxima dos números;
// com "economia de dados" ligada, só quando ele chega lá
const dive = document.getElementById('numeros');
const saveData = navigator.connection && navigator.connection.saveData;
const warm = new IntersectionObserver(es => {
  if (es.some(e => e.isIntersecting)) { loadModel().catch(err => console.error(err)); warm.disconnect(); }
}, { rootMargin: saveData ? '0px' : '250% 0px' });
warm.observe(dive);
if (reduced) document.documentElement.classList.add('reduced');
