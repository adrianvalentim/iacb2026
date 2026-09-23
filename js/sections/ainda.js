// Parte 2: os parênteses se fecham em volta do "ainda".
import { onTrack, clamp, smooth } from '../lib.js';

export default function ainda(sec) {
  const l = sec.querySelector('.ap-l'), r = sec.querySelector('.ap-r'), w = sec.querySelector('.ainda-w'), sub = sec.querySelector('.ainda-sub');
  onTrack(sec.querySelector('.pin-track'), p => {
    const u = smooth(clamp(p / 0.5));
    const d = (1 - u) * 34;
    l.style.transform = `translateX(${-d}vw)`;
    r.style.transform = `translateX(${d}vw)`;
    w.style.opacity = 0.15 + 0.85 * smooth(clamp((p - 0.15) / 0.35));
    w.style.letterSpacing = `${(1 - u) * 0.35 - 0.03}em`;
    sub.classList.toggle('in', p > 0.55);
  });
}
