// O MERGULHO: de um parâmetro (+0,13115) até os 3.745.984 do TinyStories-1M, e dali
// até GPT-3 e Kimi K2. Mesmo desenho de mergulho/ (o vídeo da palestra), agora guiado
// pela rolagem e calculado ao vivo a partir dos pesos reais:
//   célula ≥ 58 px   → o número escrito;
//   58 … 1,75 px     → meio-tom: um ponto de área proporcional a |peso|;
//   < 1,15 px        → mipmap: cada pixel é a média da tinta daquele pedaço.
import { onTrack, clamp, lerp, ramp, smooth, fmt, COLORS, onResize } from '../lib.js';
import { load, onProgress } from '../model/client.js';

const TEXT_LO = 30, TEXT_HI = 58, MIP_LO = 1.15, MIP_HI = 1.75, DOT_FULL = 10, DOT_POW = 1.3;
const TOTAL = 3745984;
const MODELS = [
  { name: 'GPT-3', n: 175e9, pages: 46718, cap: 'GPT-3: 175.000.000.000.', sub: '46.718 páginas como esta' },
  { name: 'KIMI K2', n: 1e12, pages: 266952, cap: 'Kimi K2: 1.000.000.000.000.', sub: '266.952 páginas. O TinyStories inteiro é o pontinho no canto' },
];

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uInk;
uniform vec2 uPage, uView;
uniform vec3 uCam;          // cx, cy (células), s (px de dispositivo por célula)
uniform float uWDots, uWText, uGain, uFocusK;
uniform vec4 uFocus;
uniform vec3 uInkColor;
out vec4 o;
void main() {
  vec2 frag = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);
  vec2 cell = uCam.xy + (frag - uView * .5) / uCam.z;
  vec2 uv = cell / uPage;
  float mip = texture(uInk, uv).r;           // LOD pelas derivadas: média real dos pesos
  if (cell.x < 0. || cell.y < 0. || cell.x >= uPage.x || cell.y >= uPage.y) { o = vec4(0.); return; }
  vec2 ic = floor(cell);
  float ink = texelFetch(uInk, ivec2(ic), 0).r;
  float d = length(cell - ic - .5);
  float r = sqrt(max(ink, 0.) * uGain / 3.14159265) * (1. - uWText);
  float aa = .5 / uCam.z;
  float dots = clamp((r - d) / (2. * aa) + .5, 0., 1.);
  float cov = mix(mip, dots, uWDots) * (1. - uWText);
  bool inF = cell.x >= uFocus.x && cell.y >= uFocus.y && cell.x < uFocus.z && cell.y < uFocus.w;
  if (!inF) cov *= 1. - .84 * uFocusK;
  o = vec4(uInkColor * cov, cov);
}`;

function hexRgb(h) { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

export default function dive(sec) {
  const stage = sec.querySelector('.dive-stage'), track = sec.querySelector('.pin-track');
  const glc = sec.querySelector('.dive-gl'), c2 = sec.querySelector('.dive-2d');
  const start = sec.querySelector('.dive-start');
  const capA = sec.querySelector('.dive-cap-a'), capB = sec.querySelector('.dive-cap-b'), capBox = sec.querySelector('.dive-cap');
  const nEl = sec.querySelector('.dive-n'), countLabel = sec.querySelector('.dive-count .mono-label');
  const loadBox = sec.querySelector('.dive-load'), loadN = sec.querySelector('.dive-load-n'), loadBar = sec.querySelector('.dive-load-bar b');
  const scrollHint = sec.querySelector('.dive-scroll');
  let P = null, gl = null, prog = null, uni = {}, ctx2, W = 0, H = 0, dpr = 1, fallback = null;
  let progress = 0, curCap = -1;

  // ------------------------------------------------ carregamento
  loadBox.hidden = false;
  const offP = onProgress(m => {
    loadN.textContent = `${fmt(m.params)} / ${fmt(TOTAL)}`;
    loadBar.style.width = (m.frac * 100).toFixed(1) + '%';
  });
  load().then(info => {
    offP();
    P = info.page;
    loadN.textContent = `${fmt(TOTAL)} / ${fmt(TOTAL)}`;
    setTimeout(() => { loadBox.hidden = true; }, 500);
    setup();
    render();
  }).catch(err => { loadN.textContent = 'não foi possível carregar os pesos'; console.error(err); });

  // ------------------------------------------------ WebGL
  function setup() {
    gl = glc.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
    if (!gl) { setupFallback(); return; }
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, P.w, P.h, 0, gl.RED, gl.UNSIGNED_BYTE, P.ink);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    for (const n of ['uInk', 'uPage', 'uView', 'uCam', 'uWDots', 'uWText', 'uGain', 'uFocusK', 'uFocus', 'uInkColor']) uni[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(uni.uInk, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  function setupFallback() {
    // sem WebGL2: a página inteira como imagem, ampliada/reduzida pelo navegador
    const cv = document.createElement('canvas');
    cv.width = P.w; cv.height = P.h;
    const g = cv.getContext('2d');
    const img = g.createImageData(P.w, P.h);
    const [r, gg, b] = hexRgb(COLORS.ink).map(v => v * 255);
    for (let i = 0; i < P.ink.length; i++) { const o = i * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = P.ink[i]; }
    g.putImageData(img, 0, 0);
    fallback = cv;
    glc.style.display = 'none';
  }

  // ------------------------------------------------ câmera
  function size() {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(W < 700 ? 1.5 : 2, devicePixelRatio || 1);
    for (const c of [glc, c2]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    ctx2 = c2.getContext('2d');
  }
  function box() {
    const pad = Math.max(16, Math.min(W * 0.042, 72));
    const mobile = W < 700;
    return [pad, mobile ? 120 : 130, W - pad, H - (mobile ? 190 : 150)];
  }
  function fit(x, y, w, h, padk = 1) {
    const [bx0, by0, bx1, by1] = box();
    const s = Math.min((bx1 - bx0) / (w * padk), (by1 - by0) / (h * padk));
    return { s, cx: x + w / 2 - ((bx0 + bx1) / 2 - W / 2) / s, cy: y + h / 2 - ((by0 + by1) / 2 - H / 2) / s };
  }
  // retângulos dos modelos maiores, em células; ancorados no canto inferior esquerdo da página
  function modelRect(m) {
    const cols = Math.ceil(Math.sqrt(m.pages)), rows = Math.ceil(m.pages / cols);
    return { cols, rows, x: 0, y: P.h - rows * P.h, w: cols * P.w, h: rows * P.h, last: m.pages - cols * (rows - 1) };
  }

  let KEYS = null, FOCUS = null, CAPS = null;
  function storyboard() {
    const t = P.target, qx = t.x - 5.5, qy = t.y - 2.5, qc = [qx + 32, qy + 32];
    const f = Math.min(W / 1920, H / 1080) * (W < 700 ? 1.6 : 1);
    const m = fit(qx, qy, 64, 64), c = fit(P.cardsX, P.cardsY, P.cardW, P.cardH);
    const s = fit(P.cardsX, P.cardsY, P.cardsW, P.cardsH), w = fit(0, 0, P.w, P.h);
    const g = modelRect(MODELS[0]), k = modelRect(MODELS[1]);
    const G = fit(g.x, g.y, g.w, g.h, 1.02), K = fit(k.x, k.y, k.w, k.h, 1.02);
    // começo: só UMA célula na tela (na vertical também, em telas em pé)
    const s0 = Math.max(W * 0.92, H * 0.52, 260);
    KEYS = [
      [0.000, s0, t.x, t.y], [0.045, s0 * 0.88, t.x, t.y],
      [0.125, 70 * f, qx + 24, qy + 18], [0.160, 62 * f, qx + 26, qy + 20],
      [0.200, 26 * f, ...qc], [0.235, 24 * f, ...qc],
      [0.290, m.s, m.cx, m.cy], [0.325, m.s * 0.96, m.cx, m.cy],
      [0.385, c.s, c.cx, c.cy], [0.420, c.s * 0.97, c.cx, c.cy],
      [0.475, s.s, s.cx, s.cy], [0.510, s.s * 0.97, s.cx, s.cy],
      [0.600, w.s, w.cx, w.cy], [0.650, w.s * 0.97, w.cx, w.cy],
      [0.760, G.s, G.cx, G.cy], [0.800, G.s * 0.985, G.cx, G.cy],
      [0.930, K.s, K.cx, K.cy], [1.000, K.s * 0.985, K.cx, K.cy],
    ];
    const Fq = [qx, qy, qx + 64, qy + 64], Fc = [P.cardsX, P.cardsY, P.cardsX + P.cardW, P.cardsY + P.cardH];
    const Fs = [P.cardsX, P.cardsY, P.cardsX + P.cardsW, P.cardsY + P.cardsH];
    FOCUS = [[0, ...Fq, 0], [0.215, ...Fq, 0], [0.26, ...Fq, 1], [0.33, ...Fq, 1], [0.38, ...Fc, 1], [0.425, ...Fc, 1],
      [0.47, ...Fs, 0.85], [0.515, ...Fs, 0.85], [0.56, ...Fs, 0], [1, ...Fs, 0]];
    CAPS = [
      [0.000, 'Um parâmetro.', 'bloco 0 · projeção query · linha 2, coluna 5'],
      [0.115, 'Um entre os 4.096 desta matriz.', 'ninguém escolheu este valor: o treino escolheu'],
      [0.190, 'Aqui a leitura acaba.', 'e ainda não saímos de uma única matriz'],
      [0.280, 'Uma matriz: 64 × 64.', 'a projeção query do primeiro bloco'],
      [0.375, 'Um bloco: 49.792.', 'atenção, MLP e normalizações'],
      [0.465, 'Os oito blocos: 398.464.', 'tudo o que este modelo calcula'],
      [0.545, 'Mais a tabela de embeddings.', '50.257 pedaços de palavra, 64 números cada'],
      [0.595, 'O modelo inteiro: 3.745.984.', 'cada número conhecido, cada conta também'],
      [0.720, MODELS[0].cap, MODELS[0].sub],
      [0.880, MODELS[1].cap, MODELS[1].sub],
    ];
  }
  function camAt(p) {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const [t0, s0, x0, y0] = KEYS[i], [t1, s1, x1, y1] = KEYS[i + 1];
    const u = smooth(clamp((p - t0) / (t1 - t0)));
    const s = Math.exp(lerp(Math.log(s0), Math.log(s1), u));
    // centro interpolado em 1/s: um ponto comum às duas câmeras fica parado durante o zoom
    const w = Math.abs(1 / s1 - 1 / s0) > 1e-12 ? (1 / s - 1 / s0) / (1 / s1 - 1 / s0) : u;
    return { s, cx: lerp(x0, x1, w), cy: lerp(y0, y1, w) };
  }
  function focusAt(p) {
    let i = 0;
    while (i < FOCUS.length - 2 && p > FOCUS[i + 1][0]) i++;
    const a = FOCUS[i], b = FOCUS[i + 1], u = smooth(clamp((p - a[0]) / (b[0] - a[0])));
    return a.slice(1).map((v, k) => lerp(v, b[k + 1], u));
  }

  // ------------------------------------------------ contagem de parâmetros na tela
  function countIn(x0, y0, x1, y1) {
    let n = 0;
    for (const t of P.tiles) {
      const ax = Math.max(x0, t.x), ay = Math.max(y0, t.y), bx = Math.min(x1, t.x + t.w), by = Math.min(y1, t.y + t.h);
      if (bx <= ax || by <= ay) continue;
      // células cujo centro está dentro do retângulo visível
      const cx = Math.max(0, Math.floor(bx - 0.5) - Math.ceil(ax - 0.5) + 1);
      const cy = Math.max(0, Math.floor(by - 0.5) - Math.ceil(ay - 0.5) + 1);
      n += Math.min(t.n, cx * cy * t.n / (t.w * t.h));
    }
    return Math.round(Math.min(TOTAL, n));
  }

  // ------------------------------------------------ desenho
  const fmtV = v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(5);
  function render() {
    if (!P) return;
    if (!KEYS) storyboard();
    const { s, cx, cy } = camAt(progress);
    const sd = s * dpr;
    const wDots = ramp(sd, MIP_LO, MIP_HI), wText = ramp(s, TEXT_LO, TEXT_HI);
    const gain = s <= DOT_FULL ? 1 : Math.pow(DOT_FULL / s, DOT_POW);
    const [fx0, fy0, fx1, fy1, fk] = focusAt(progress);
    const ink = hexRgb(COLORS.ink);
    if (gl) {
      gl.viewport(0, 0, glc.width, glc.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uni.uPage, P.w, P.h);
      gl.uniform2f(uni.uView, glc.width, glc.height);
      gl.uniform3f(uni.uCam, cx, cy, sd);
      gl.uniform1f(uni.uWDots, wDots); gl.uniform1f(uni.uWText, wText); gl.uniform1f(uni.uGain, gain);
      gl.uniform4f(uni.uFocus, fx0, fy0, fx1, fy1); gl.uniform1f(uni.uFocusK, fk);
      gl.uniform3f(uni.uInkColor, ...ink);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    const g = ctx2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const X = x => (x - cx) * s + W / 2, Y = y => (y - cy) * s + H / 2;
    if (fallback) {
      g.save(); g.imageSmoothingEnabled = s < 2;
      g.globalAlpha = 1 - wText;
      g.drawImage(fallback, X(0), Y(0), P.w * s, P.h * s);
      g.restore();
    }
    const vx0 = cx - W / 2 / s, vy0 = cy - H / 2 / s, vx1 = cx + W / 2 / s, vy1 = cy + H / 2 / s;

    // números escritos (só existem valores exatos na região dos cartões, que é onde a câmera chega perto)
    if (wText > 0.001) {
      const i0 = Math.max(P.cardsX, Math.floor(vx0)), i1 = Math.min(P.cardsX + P.valsW - 1, Math.ceil(vx1));
      const j0 = Math.max(P.cardsY, Math.floor(vy0)), j1 = Math.min(P.h - 1, Math.ceil(vy1));
      const fs = Math.min(s * 0.19, (W - 32) / 5);
      g.font = `500 ${fs}px "JetBrains Mono", Menlo, monospace`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = COLORS.ink;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = (j - P.cardsY) * P.valsW + (i - P.cardsX);
        if (P.ink[j * P.w + i] === 0 && P.vals[k] === 0) continue;
        const inF = i >= fx0 && i < fx1 && j >= fy0 && j < fy1;
        g.globalAlpha = wText * (inF ? 1 : 1 - 0.84 * fk);
        g.fillText(fmtV(P.vals[k]), X(i + 0.5), Y(j + 0.5));
      }
      g.globalAlpha = 1;
    }
    // a célula de partida
    const tA = ramp(s, 40, 160) * (1 - ramp(s, 380, 700));
    if (tA > 0.01) {
      g.strokeStyle = COLORS.accent; g.lineWidth = 2; g.globalAlpha = tA;
      g.strokeRect(X(P.target.x - 0.5) + 2, Y(P.target.y - 0.5) + 2, s - 4, s - 4);
      g.globalAlpha = 1;
    }

    // rótulos
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    for (const L of P.labels) {
      const px = L.ch * s * 0.42;
      const want = L.tier === 1 ? ramp(px, 6, 10) * (1 - ramp(px, 60, 90))
        : L.tier === 2 ? ramp(px, 7, 11) * (1 - ramp(px, 70, 110))
          : ramp(px, 7, 11) * (1 - ramp(s, 20, 30));
      if (want < 0.02) continue;
      const size = clamp(px, 9, L.tier === 1 ? 20 : 15);
      g.font = `${L.tier === 3 ? 500 : 700} ${size}px "JetBrains Mono", Menlo, monospace`;
      g.fillStyle = COLORS.ink; g.globalAlpha = want * 0.85;
      g.fillText(L.text, X(L.x), Y(L.y) - size * 0.55);
    }
    g.globalAlpha = 1;

    // os modelos maiores
    const scaleA = ramp(progress, 0.64, 0.7);
    let maxModel = null;
    if (scaleA > 0) {
      const page = { w: P.w * s, h: P.h * s };
      MODELS.forEach((m, mi) => {
        const R = modelRect(m);
        const a = mi === 0 ? scaleA : ramp(progress, 0.8, 0.86);
        if (a <= 0) return;
        const x0 = X(R.x), y0 = Y(R.y), w = R.w * s, h = R.h * s;
        g.globalAlpha = a;
        g.fillStyle = mi === 0 ? 'rgba(26,24,22,.045)' : 'rgba(26,24,22,.03)';
        g.fillRect(x0, y0, w, h);
        // grade: cada célula é uma página inteira do TinyStories
        const gridA = ramp(page.w, 3, 9) * a;
        if (gridA > 0.01) {
          g.strokeStyle = COLORS.ink; g.lineWidth = 0.5; g.globalAlpha = gridA * 0.35;
          g.beginPath();
          const cA = Math.max(0, Math.floor((0 - x0) / page.w)), cB = Math.min(R.cols, Math.ceil((W - x0) / page.w));
          for (let c = cA; c <= cB; c++) { g.moveTo(x0 + c * page.w, Math.max(0, y0)); g.lineTo(x0 + c * page.w, Math.min(H, y0 + h)); }
          const rA = Math.max(0, Math.floor((0 - y0) / page.h)), rB = Math.min(R.rows, Math.ceil((H - y0) / page.h));
          for (let r = rA; r <= rB; r++) { g.moveTo(Math.max(0, x0), y0 + r * page.h); g.lineTo(Math.min(W, x0 + w), y0 + r * page.h); }
          g.stroke();
        }
        g.globalAlpha = a; g.strokeStyle = COLORS.ink; g.lineWidth = 1.5;
        g.strokeRect(x0, y0, w, h);
        g.font = '700 12px "JetBrains Mono", Menlo, monospace'; g.fillStyle = COLORS.ink;
        g.fillText(`${m.name} · ${fmt(m.n)}`, x0 + 8, Math.max(y0 + 18, 118));
        g.globalAlpha = 1;
        if (x0 > -W && w < W * 1.2) maxModel = m;
      });
      // o TinyStories: um ponto no canto, circulado quando some
      const pw = P.w * s;
      if (pw < 14) {
        const px = X(P.w / 2), py = Y(P.h / 2);
        g.strokeStyle = COLORS.accent; g.lineWidth = 1.5; g.globalAlpha = ramp(14 - pw, 0, 6);
        g.beginPath(); g.arc(px, py, 9, 0, 7); g.stroke();
        g.font = '500 10px "JetBrains Mono", Menlo, monospace'; g.fillStyle = COLORS.accent;
        g.fillText('TINYSTORIES-1M', px + 14, py + 4);
        g.globalAlpha = 1;
      }
    }

    // HUD
    const n = maxModel ? maxModel.n : countIn(vx0, vy0, vx1, vy1);
    nEl.textContent = fmt(n);
    let ci = 0;
    for (let i = 0; i < CAPS.length; i++) if (progress >= CAPS[i][0]) ci = i;
    if (ci !== curCap) {
      curCap = ci;
      capBox.style.opacity = 0;
      setTimeout(() => { capA.textContent = CAPS[ci][1]; capB.textContent = CAPS[ci][2]; capBox.style.opacity = 1; }, 180);
    }
    start.classList.add('gone');
    scrollHint.style.opacity = progress > 0.03 ? 0 : 1;
  }

  size();
  onResize(() => { size(); KEYS = null; render(); });
  onTrack(track, p => { progress = p; if (P) render(); else scrollHint.style.opacity = p > 0.03 ? 0 : 1; });
}
