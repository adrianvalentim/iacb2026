// Wir müssen wissen. Wir werden wissen. As letras viram português com a rolagem.
import { onTrack, clamp, rng } from '../lib.js';

const GLYPHS = 'abcdefghijklmnopqrstuvwxyzäöüßçãõêé';

export default function hilbert(sec) {
  const lines = Array.from(sec.querySelectorAll('.hil-line'));
  const R = rng(1930);
  const noise = lines.map(l => Array.from({ length: 40 }, () => R()));
  onTrack(sec.querySelector('.pin-track'), p => {
    lines.forEach((el, k) => {
      const de = el.dataset.de, pt = el.dataset.pt;
      const n = Math.max(de.length, pt.length);
      // vai de antes do começo a depois do fim, para que nenhuma letra fique no meio da troca
      const u = clamp((p - 0.22 - k * 0.08) / 0.42, -0.2, 1.3);
      let html = '';
      for (let i = 0; i < n; i++) {
        const th = noise[k][i % 40] * 0.5 + (i / n) * 0.5; // cada letra troca num momento seu
        const a = de[i] || '', b = pt[i] || '';
        if (u < th - 0.12) html += a;
        else if (u > th + 0.12) html += b;
        else { const c = (a === ' ' || b === ' ') ? ' ' : GLYPHS[Math.floor(R() * GLYPHS.length)]; html += `<span class="sc">${c}</span>`; }
      }
      el.innerHTML = html;
    });
  });
}
