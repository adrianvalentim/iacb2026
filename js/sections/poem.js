// Planejamento: no fim da primeira linha, a palavra que vai rimar já está ativa;
// a segunda linha é escrita em direção a ela. Suprimida, o modelo rima com outra.
// Exemplo de Lindsey et al. (2025), "On the Biology of a Large Language Model".
import { visible, reduced } from '../lib.js';

const L1 = 'He saw a carrot and had to grab it,';
const L2 = { normal: ['His hunger was like a starving ', 'rabbit'], supp: ['His hunger was a powerful ', 'habit'] };

export default function poem(sec) {
  const t1 = sec.querySelector('.poem-1 .typed'), t2 = sec.querySelector('.poem-2 .typed');
  const ghost = sec.querySelector('.poem-2 .ghost'), plan = sec.querySelector('.poem-plan'), pw = sec.querySelector('.plan-words');
  const supp = sec.querySelector('.poem-suppress');
  let run = 0;
  const wait = ms => new Promise(r => setTimeout(r, reduced ? 0 : ms));
  async function type(el, s, my, speed = 42) {
    for (let i = 1; i <= s.length; i++) {
      if (my !== run) return false;
      el.innerHTML = s.slice(0, i).replace(/&/g, '&amp;') + '<span class="cursor"></span>';
      await wait(speed);
    }
    el.textContent = s;
    return true;
  }
  async function play() {
    const my = ++run;
    const S = supp.checked ? L2.supp : L2.normal;
    t1.textContent = ''; t2.textContent = ''; ghost.textContent = ''; ghost.classList.remove('on'); plan.classList.remove('on');
    await wait(400);
    if (!(await type(t1, L1, my))) return;
    await wait(500);
    if (my !== run) return;
    // o plano: as candidatas a rima já ativas antes de a linha 2 começar
    pw.innerHTML = supp.checked ? '<span class="off">rabbit</span><span>habit</span>' : '<span>rabbit</span><span>habit</span>';
    plan.classList.add('on');
    await wait(900);
    if (my !== run) return;
    ghost.textContent = S[1];
    ghost.classList.add('on');
    await wait(900);
    if (!(await type(t2, S[0], my, 55))) return;
    ghost.classList.remove('on');
    ghost.textContent = '';
    t2.innerHTML = S[0] + `<span class="rhyme">${S[1]}</span>`;
  }
  let played = false;
  visible(sec.querySelector('.poem'), v => { if (v && !played) { played = true; play(); } }, '0px 0px -25% 0px');
  sec.querySelector('.poem-play').addEventListener('click', play);
  supp.addEventListener('change', play);
}
