// Máquina de Turing: as campeãs "castor ocupado" de 2 a 5 estados. A de 5 estados
// para depois de exatamente 47.176.870 passos, um número que só foi provado em 2024.
import { svg, visible, reduced } from '../lib.js';

// notação padrão: por estado, [lendo 0][lendo 1] = escreve, move, próximo (Z = parar)
const MACHINES = {
  2: { t: '1RB1LB_1LA1RZ', steps: 6 },
  3: { t: '1LB1RZ_1RB0LC_1RC1RA', steps: 21 },
  4: { t: '1RB1LB_1LA0LC_1RZ1LD_1RD0RA', steps: 107 },
  5: { t: '1RB1LC_1RC1RB_1RD0LE_1LA1LD_1RZ0LA', steps: 47176870 },
};
const CELLS = 23, CW = 44, CY = 196;

export default function turing(sec) {
  const S = sec.querySelector('.tm-svg');
  const stepsEl = sec.querySelector('.tm-steps'), stateEl = sec.querySelector('.tm-state'), verdict = sec.querySelector('.tm-verdict');
  const table = sec.querySelector('.tm-table');
  const picks = sec.querySelectorAll('[data-bb]');

  // ---- desenho: fita, cabeçote isométrico
  const tapeG = svg('g', {}, S);
  const cells = [];
  for (let i = 0; i < CELLS; i++) {
    const x = 500 + (i - (CELLS >> 1)) * CW - CW / 2;
    const g = svg('g', {}, tapeG);
    svg('rect', { x, y: CY, width: CW, height: CW, class: 'cell' }, g);
    const m = svg('rect', { x: x + 13, y: CY + 13, width: 18, height: 18, class: 'mark', opacity: 0 }, g);
    cells.push(m);
  }
  svg('text', { x: 500 - (CELLS >> 1) * CW - CW - 14, y: CY + 28, 'text-anchor': 'end' }, S).textContent = '…';
  svg('text', { x: 500 + (CELLS >> 1) * CW + CW + 14, y: CY + 28 }, S).textContent = '…';
  // cabeçote: cubo em perspectiva cavaleira
  const hx = 452, hy = 58, hw = 96, hh = 96, dx = 30, dy = -22;
  svg('path', { d: `M${hx} ${hy} l${dx} ${dy} h${hw} l${-dx} ${-dy} Z`, class: 'box-top' }, S);
  svg('path', { d: `M${hx + hw} ${hy} l${dx} ${dy} v${hh} l${-dx} ${-dy} Z`, class: 'box-side' }, S);
  svg('rect', { x: hx, y: hy, width: hw, height: hh, class: 'box' }, S);
  const stateTxt = svg('text', { x: hx + hw / 2, y: hy + hh / 2 + 14, 'text-anchor': 'middle' }, S);
  stateTxt.style.fontSize = '40px'; stateTxt.style.fontWeight = 700;
  svg('path', { d: `M${500 - 10} ${hy + hh} L500 ${CY - 8} L${500 + 10} ${hy + hh}`, class: 'head' }, S);
  svg('rect', { x: 500 - CW / 2 - 3, y: CY - 3, width: CW + 6, height: CW + 6, class: 'head', fill: 'none' }, S);

  let M = null, T = null, tape = null, head = 0, state = 0, steps = 0, halted = false, timer = 0, raf = 0, sel = 3, visibleNow = false;
  const N = 1 << 16;

  function parse(s) { return s.split('_').map(r => [r.slice(0, 3), r.slice(3, 6)]); }
  function buildTable() {
    table.innerHTML = '<tr><th></th><th>lê 0</th><th>lê 1</th></tr>' + T.map((r, i) =>
      `<tr><th>${String.fromCharCode(65 + i)}</th>${r.map((t, k) => `<td data-s="${i}" data-r="${k}">${t.replace('Z', '■')}</td>`).join('')}</tr>`).join('');
  }
  function paint() {
    for (let i = 0; i < CELLS; i++) cells[i].setAttribute('opacity', tape[head + i - (CELLS >> 1)] ? 1 : 0);
    stateTxt.textContent = halted ? '■' : String.fromCharCode(65 + state);
    stateEl.textContent = halted ? 'parou' : String.fromCharCode(65 + state);
    stepsEl.textContent = steps.toLocaleString('pt-BR');
    table.querySelectorAll('td').forEach(td => td.classList.toggle('now', !halted && +td.dataset.s === state && +td.dataset.r === tape[head]));
  }
  function one() {
    const [w, d, n] = T[state][tape[head]];
    tape[head] = +w; head += d === 'R' ? 1 : -1; steps++;
    if (n === 'Z') halted = true; else state = n.charCodeAt(0) - 65;
  }
  function stop() { clearTimeout(timer); cancelAnimationFrame(raf); }
  function start(k) {
    stop();
    sel = k; M = MACHINES[k]; T = parse(M.t);
    tape = new Uint8Array(N); head = N >> 1; state = 0; steps = 0; halted = false;
    picks.forEach(p => p.setAttribute('aria-pressed', +p.dataset.bb === k));
    buildTable(); paint();
    verdict.textContent = 'vai parar? rodando…';
    if (reduced) { while (!halted) one(); paint(); done(); return; }
    let visibleSteps = 0;
    const slow = () => {
      if (!visibleNow) { timer = setTimeout(slow, 300); return; }
      one(); visibleSteps++; paint();
      if (halted) return done();
      // a de 5 estados: depois de alguns passos à vista, acelera até o fim
      if (k === 5 && visibleSteps > 36) return fast();
      timer = setTimeout(slow, k >= 4 ? 110 : 320);
    };
    timer = setTimeout(slow, 500);
  }
  function fast() {
    let per = 50;
    const f = () => {
      for (let i = 0; i < per && !halted; i++) one();
      per = Math.min(900000, Math.ceil(per * 1.09));
      paint();
      if (halted) return done();
      raf = requestAnimationFrame(f);
    };
    verdict.textContent = 'vai parar? acelerando…';
    raf = requestAnimationFrame(f);
  }
  function done() {
    paint();
    verdict.textContent = `parou em ${steps.toLocaleString('pt-BR')} passos`;
    if (steps !== M.steps) console.warn('passos inesperados', steps, M.steps);
  }
  picks.forEach(p => p.addEventListener('click', () => start(+p.dataset.bb)));
  visible(S, v => { visibleNow = v; });
  let begun = false;
  visible(S, v => { if (v && !begun) { begun = true; start(3); } }, '0px 0px -15% 0px');
  if (!begun) { T = parse(MACHINES[3].t); tape = new Uint8Array(N); head = N >> 1; buildTable(); paint(); }
}
