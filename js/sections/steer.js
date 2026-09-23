// Golden Gate, em miniatura e de verdade: somamos a direção "ponte" ao fluxo residual
// do TinyStories-1M (camada 3) com a força escolhida no controle, e o modelo reescreve
// a história ao vivo. A ponte desenhada em cima se constrói conforme a força aumenta.
import { svg, clamp, smooth } from '../lib.js';
import { load, generate } from '../model/client.js';

// os começos de história ficam no HTML, nos botões data-prompt do capítulo
const BRIDGE = /^(bridge\w*|river\w*|hill\w*|road\w*|path\w*|tunnel\w*|mountain\w*|valley\w*|valleys|stream\w*|cliff\w*|across|cross\w*|steep\w*|slope\w*|lake\w*|ocean\w*|rope\w*|mile\w*|climb\w*|upstream\w*|winding|highway\w*)$/i;

function bridgeArt(S) {
  const g = svg('g', {}, S);
  for (let i = 0; i < 4; i++) svg('line', { x1: 40 + i * 30, x2: 960 - i * 40, y1: 262 + i * 9, y2: 262 + i * 9, class: 'br water' }, g);
  svg('path', { d: 'M10 206 H990 M10 214 H990', class: 'br' }, g);
  const towers = [300, 700].map(x => {
    const t = svg('g', {}, g);
    const legs = svg('path', { class: 'br' }, t);
    const bars = svg('path', { class: 'br' }, t);
    return { x, legs, bars };
  });
  const cable = svg('path', { class: 'br' }, g);
  const hangers = svg('path', { class: 'br' }, g);
  let len = 0;
  return a => {
    const t = clamp(a / 2.4);
    const th = smooth(clamp(t / 0.35));
    const top = 206 - (6 + 176 * th);
    towers.forEach(({ x, legs, bars }) => {
      legs.setAttribute('d', `M${x - 16} 214 V${top} M${x + 16} 214 V${top}`);
      let d = '';
      for (let k = 0; k < 4; k++) { const yy = top + (206 - top) * (k / 4.2); if (th > 0.2) d += `M${x - 16} ${yy + 6} H${x + 16} M${x - 16} ${yy + 12} H${x + 16} `; }
      bars.setAttribute('d', d);
    });
    // cabo principal: dos ancoradouros ao topo das torres, com a flecha no meio do vão
    const c = `M10 196 Q155 ${top + 70} 300 ${top} Q500 ${196 + (top - 196) * 0.02 + 8} 700 ${top} Q845 ${top + 70} 990 196`;
    cable.setAttribute('d', c);
    len = cable.getTotalLength();
    const tc = smooth(clamp((t - 0.2) / 0.4));
    cable.style.strokeDasharray = len; cable.style.strokeDashoffset = len * (1 - tc);
    const th2 = smooth(clamp((t - 0.5) / 0.3));
    let h = '';
    if (th2 > 0) {
      for (let x = 30; x < 990; x += 22) {
        if (Math.abs(x - 300) < 20 || Math.abs(x - 700) < 20) continue;
        const p = cable.getPointAtLength(len * (x / 1000));
        if (!p) continue;
        const y0 = p.y, y1 = 206;
        h += `M${x} ${y1} V${y1 - (y1 - y0) * th2}`;
      }
    }
    hangers.setAttribute('d', h);
    S.style.setProperty('--bridge', t > 0.72 ? 'var(--accent)' : 'var(--ink)');
    S.querySelectorAll('.br:not(.water)').forEach(e => { e.style.stroke = t > 0.72 ? 'var(--accent)' : 'var(--ink)'; });
  };
}

export default function steer(sec) {
  const S = sec.querySelector('.gg-bridge');
  const drawBridge = bridgeArt(S);
  const range = sec.querySelector('input[type=range]'), val = sec.querySelector('.steer-val');
  const pEl = sec.querySelector('.steer-prompt'), gEl = sec.querySelector('.steer-gen');
  const box = sec.querySelector('.steer-prompts');
  let prompt = box.querySelector('[aria-pressed="true"]').dataset.prompt, deb = 0, ready = false;

  // os botões das histórias já estão no HTML (data-prompt); aqui só ganham o clique
  box.querySelectorAll('button[data-prompt]').forEach(b => {
    b.addEventListener('click', () => { prompt = b.dataset.prompt; box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); run(); });
  });

  function paint(text) {
    gEl.innerHTML = '';
    text.split(/(\s+)/).forEach(tok => {
      const bare = tok.replace(/[^\p{L}]/gu, '');
      if (bare && BRIDGE.test(bare)) { const b = document.createElement('span'); b.className = 'b'; b.textContent = tok; gEl.append(b); }
      else gEl.append(tok);
    });
  }
  function run() {
    const c = +range.value;
    val.textContent = c.toFixed(1);
    drawBridge(c);
    pEl.textContent = prompt;
    if (!ready) { gEl.textContent = ' …carregando o modelo'; return; }
    generate({ text: prompt, c, n: 42, rep: 1.3 }, m => paint(m.text + (m.done ? '' : ' ▍')), 'steer');
  }
  range.addEventListener('input', () => { val.textContent = (+range.value).toFixed(1); drawBridge(+range.value); clearTimeout(deb); deb = setTimeout(run, 70); });
  run();
  load().then(() => { ready = true; run(); });
}
