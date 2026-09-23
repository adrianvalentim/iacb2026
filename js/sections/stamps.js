// Três intuições: a tarja sai e o carimbo "→ Falso" cai, uma de cada vez.
import { revealOnce } from '../lib.js';

export default function stamps(sec) {
  revealOnce(sec.querySelectorAll('.claim'), { rootMargin: '0px 0px -30% 0px', stagger: 700 });
}
