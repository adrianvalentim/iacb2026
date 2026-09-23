// A PÁGINA: os 3.745.984 parâmetros num único objeto impresso. Port direto de
// mergulho/build_page.py (mesma dobra, mesmos cartões, mesma célula-alvo).

const D = 64, G_IN = 6, G_CARD = 20, G_BAND = 56, FOLD_COLS = 54, FOLD_GUT = 4;
const CARD_W = 4 * D + 3 * G_IN, CARD_H = 268, CARD_COLS = 4;
const Y_R1 = 32, Y_R2 = 110, Y_R3 = 188, Y_V = 264;
export const INK_SCALE = 0.30, INK_GAMMA = 0.5;

export function buildPage(W) {
  const wte = W['wte.weight'], wpe = W['wpe.weight'];
  const nWte = wte.length / D, nWpe = wpe.length / D;
  const wteRows = Math.ceil(nWte / FOLD_COLS), wpeRows = Math.ceil(nWpe / FOLD_COLS);
  const bandW = FOLD_COLS * D + (FOLD_COLS - 1) * FOLD_GUT;
  const cardsW = CARD_COLS * CARD_W + (CARD_COLS - 1) * G_CARD, cardsH = 2 * CARD_H + G_CARD;
  const w = Math.max(bandW, cardsW);
  const h = wteRows + G_BAND + wpeRows + G_BAND + cardsH + G_BAND + 2;
  const xBand = (w - bandW) >> 1, xCards = (w - cardsW) >> 1;
  const ink = new Uint8Array(w * h);
  const cardsY = wteRows + G_BAND + wpeRows + G_BAND;
  // valores exatos (float32) da região dos cartões: é onde a câmera chega perto o bastante para ler
  const vals = new Float32Array(cardsW * (cardsH + G_BAND + 2));
  const labels = [], tiles = [];
  let placed = 0;

  const put = (x, y, v) => {
    const a = Math.min(1, Math.abs(v) / INK_SCALE) ** INK_GAMMA;
    ink[y * w + x] = Math.round(a * 255);
    const cx = x - xCards, cy = y - cardsY;
    if (cx >= 0 && cx < cardsW && cy >= 0) vals[cy * cardsW + cx] = v;
    placed++;
  };
  // tensor [rows × cols] (linha a linha) em (x, y)
  const place = (arr, rows, cols, x, y, name, kind) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) put(x + c, y + r, arr[r * cols + c]);
    if (name) tiles.push({ name, kind, x, y, w: cols, h: rows, n: rows * cols });
  };
  const placeFolded = (table, n, x, y, rows, name, kind) => {
    for (let c = 0; c < FOLD_COLS; c++) {
      const lo = c * rows, hi = Math.min((c + 1) * rows, n);
      if (lo >= n) break;
      const cx = x + c * (D + FOLD_GUT);
      for (let r = lo; r < hi; r++) for (let k = 0; k < D; k++) put(cx + k, y + r - lo, table[r * D + k]);
    }
    tiles.push({ name, kind, x, y, w: bandW, h: rows, n: n * D });
  };

  let y = 0;
  placeFolded(wte, nWte, xBand, y, wteRows, 'wte', 'emb');
  labels.push({ text: 'TABELA DE EMBEDDINGS · 50.257 × 64', x: xBand, y, ch: 46, tier: 1 });
  y += wteRows + G_BAND;
  placeFolded(wpe, nWpe, xBand, y, wpeRows, 'wpe', 'pos');
  labels.push({ text: 'POSIÇÕES · 2.048 × 64', x: xBand, y, ch: 40, tier: 1 });

  for (let i = 0; i < 8; i++) {
    const x = xCards + (i % CARD_COLS) * (CARD_W + G_CARD);
    const yc = cardsY + Math.floor(i / CARD_COLS) * (CARD_H + G_CARD);
    const p = k => W[`h.${i}.${k}`];
    labels.push({ text: `BLOCO ${i}`, x, y: yc, ch: 15, tier: 2 });
    [['k_proj', 'K'], ['q_proj', 'Q'], ['v_proj', 'V'], ['out_proj', 'OUT']].forEach(([k, s], j) => {
      const tx = x + j * (D + G_IN);
      place(p(`attn.${k}.weight`), D, D, tx, yc + Y_R1, `h${i}.attn.${k}`, 'attn');
      labels.push({ text: s, x: tx, y: yc + Y_R1, ch: 9, tier: 3 });
    });
    const cfc = p('mlp.c_fc.weight'); // 256 × 64
    for (let j = 0; j < 4; j++) place(cfc.subarray(j * D * D, (j + 1) * D * D), D, D, x + j * (D + G_IN), yc + Y_R2, `h${i}.mlp.c_fc[${j}]`, 'mlp');
    labels.push({ text: 'C_FC · 256 × 64', x, y: yc + Y_R2, ch: 9, tier: 3 });
    const cpj = p('mlp.c_proj.weight'); // 64 × 256, fatias de colunas
    for (let j = 0; j < 4; j++) {
      const tx = x + j * (D + G_IN);
      for (let r = 0; r < D; r++) for (let c = 0; c < D; c++) put(tx + c, yc + Y_R3 + r, cpj[r * 256 + j * D + c]);
      tiles.push({ name: `h${i}.mlp.c_proj[${j}]`, kind: 'mlp', x: tx, y: yc + Y_R3, w: D, h: D, n: D * D });
    }
    labels.push({ text: 'C_PROJ · 64 × 256', x, y: yc + Y_R3, ch: 9, tier: 3 });
    const keys = ['ln_1.weight', 'ln_1.bias', 'ln_2.weight', 'ln_2.bias', 'attn.out_proj.bias', 'mlp.c_fc.bias', 'mlp.c_proj.bias'];
    const vec = [];
    for (const k of keys) vec.push(...p(k));
    for (let n = 0; n < vec.length; n++) put(x + (n % CARD_W), yc + Y_V + Math.floor(n / CARD_W), vec[n]);
    tiles.push({ name: `h${i}.vetores`, kind: 'vec', x, y: yc + Y_V, w: CARD_W, h: Math.ceil(vec.length / CARD_W), n: vec.length });
    labels.push({ text: 'LAYERNORM · VIESES', x, y: yc + Y_V, ch: 8, tier: 3 });
  }
  const lnfX = (w - D) >> 1, lnfY = cardsY + cardsH + G_BAND;
  place(W['ln_f.weight'], 1, D, lnfX, lnfY);
  place(W['ln_f.bias'], 1, D, lnfX, lnfY + 1);
  tiles.push({ name: 'ln_f', kind: 'vec', x: lnfX, y: lnfY, w: D, h: 2, n: 2 * D });
  labels.push({ text: 'LN FINAL', x: lnfX + D + 14, y: lnfY + 2, ch: 26, tier: 2 });

  if (placed !== 3745984) throw new Error(`página com ${placed} parâmetros`);

  const qx = xCards + 1 * (D + G_IN), qy = cardsY + Y_R1;
  const target = { x: qx + 5 + 0.5, y: qy + 2 + 0.5, value: W['h.0.attn.q_proj.weight'][2 * D + 5] };
  return {
    w, h, ink, vals, labels, tiles, target, placed,
    cardsX: xCards, cardsY, cardsW, cardsH, cardW: CARD_W, cardH: CARD_H, gCard: G_CARD,
    wteRows, wpeRows, valsW: cardsW,
  };
}
