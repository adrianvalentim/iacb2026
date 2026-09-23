// O modelo, ao vivo: escreva o começo de uma história; o TinyStories-1M mostra as
// próximas palavras mais prováveis. À esquerda, a arquitetura com o fluxo residual
// real do último token em cada camada (tinta = positivo, laranja = negativo).
import { COLORS } from '../lib.js';
import { load, onProgress, predict, generate } from '../model/client.js';

const PRESETS = [
  'Once upon a time, there was a little',
  'Tom and his dog went to the',
  'Lily found a shiny red',
  'The sun was hot, so Mia wanted to',
  'Ben was sad because his toy',
];

const show = s => (s === '\n' ? '↵' : s.startsWith(' ') ? s.slice(1) || '␣' : '…' + s);

export default function live(sec) {
  const root = sec.querySelector('.live');
  const text = sec.querySelector('.live-text'), toks = sec.querySelector('.live-tokens');
  const top = sec.querySelector('.live-top'), status = sec.querySelector('.live-status');
  const go = sec.querySelector('.live-go'), reset = sec.querySelector('.live-reset');
  const layersBox = sec.querySelector('.stk-layers');
  const strips = [sec.querySelector('.stk-strip[data-layer="0"]')];
  const rows = [];
  for (let l = 8; l >= 1; l--) {
    const d = document.createElement('div');
    d.className = 'stk-layer';
    d.innerHTML = `<span>Bloco ${l}<small>atenção · MLP</small></span><canvas class="stk-strip" data-layer="${l}"></canvas>`;
    layersBox.appendChild(d);
    rows[l] = d;
    strips[l] = d.querySelector('canvas');
  }
  strips.forEach(c => { c.width = 256; c.height = 14; });

  let promptText = text.textContent, genText = '', busy = false, req = 0, preset = 0;

  const offP = onProgress(m => { if (m.frac < 1) status.textContent = `TinyStories-1M · carregando ${Math.round(m.frac * 100)}%`; });
  load().then(() => {
    offP();
    root.classList.add('ready');
    status.textContent = 'TinyStories-1M · ao vivo no seu navegador';
    refresh();
  }).catch(() => { status.textContent = 'não foi possível carregar o modelo'; });

  function paintStrips(resid) {
    const ink = COLORS.ink, acc = COLORS.accent;
    for (let l = 0; l <= 8; l++) {
      const c = strips[l], g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      let mx = 1e-6;
      for (let i = 0; i < 64; i++) mx = Math.max(mx, Math.abs(resid[l * 64 + i]));
      for (let i = 0; i < 64; i++) {
        const v = resid[l * 64 + i] / mx;
        g.globalAlpha = Math.min(1, Math.abs(v) * 1.15);
        g.fillStyle = v >= 0 ? ink : acc;
        g.fillRect(i * 4, 0, 3.4, c.height);
      }
      g.globalAlpha = 1;
    }
  }
  function pulse() {
    const order = [1, 2, 3, 4, 5, 6, 7, 8];
    order.forEach((l, i) => setTimeout(() => { rows[l].classList.add('pulse'); setTimeout(() => rows[l].classList.remove('pulse'), 220); }, i * 35));
  }
  function render() {
    text.innerHTML = '';
    text.append(document.createTextNode(promptText));
    if (genText) { const s = document.createElement('span'); s.className = 'gen'; s.textContent = genText; text.append(s); }
  }
  async function refresh() {
    const full = promptText + genText;
    const my = ++req;
    const r = await predict({ text: full, k: 8 });
    if (my !== req) return;
    toks.innerHTML = '';
    r.pieces.slice(-40).forEach(p => { const s = document.createElement('span'); s.textContent = p === '\n' ? '↵' : p; toks.append(s); });
    top.innerHTML = '';
    r.top.forEach(t => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button"><span class="tk"></span><span class="bar"><i style="width:0"></i></span><span class="pc">${(t.p * 100).toFixed(1)}%</span></button>`;
      li.querySelector('.tk').textContent = show(t.s);
      li.querySelector('button').addEventListener('click', () => { genText += t.s; render(); refresh(); });
      top.append(li);
      requestAnimationFrame(() => { li.querySelector('.bar i').style.width = Math.max(1, t.p / r.top[0].p * 100) + '%'; });
    });
    paintStrips(r.resid);
    pulse();
  }

  let deb = 0;
  text.addEventListener('input', () => {
    promptText = text.innerText.replace(/ /g, ' ');
    genText = '';
    clearTimeout(deb);
    deb = setTimeout(refresh, 220);
  });
  text.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });

  go.addEventListener('click', async () => {
    if (busy) return;
    busy = true; go.classList.add('on');
    const base = genText;
    await generate({ text: promptText + genText, n: 28, rep: 1.3 }, m => {
      genText = base + m.text;
      render();
      if (m.resid) { paintStrips(m.resid); pulse(); }
      if (m.done) { busy = false; go.classList.remove('on'); refresh(); }
    });
  });
  reset.addEventListener('click', () => {
    preset = (preset + 1) % PRESETS.length;
    promptText = PRESETS[preset]; genText = '';
    render(); refresh();
  });
}
