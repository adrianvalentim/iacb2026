// TinyStories-1M (GPT-Neo, 8 camadas, d=64) em JavaScript puro.
// Os pesos são os do checkpoint real; ver site-dados/exportar.py.
// Conferido contra a implementação numpy (que por sua vez bate com o transformers):
// site-dados/teste_modelo.mjs.

export const D = 64, HEADS = 16, HD = 4, LAYERS = 8, FF = 256, VOCAB = 50257, EOS = 50256;

// ------------------------------------------------------------------ pesos

const F16 = (() => {
  // tabela float16 -> float32 (65.536 entradas); mais rápido que decodificar bit a bit
  const t = new Float32Array(65536);
  for (let h = 0; h < 65536; h++) {
    const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
    t[h] = e === 0 ? s * Math.pow(2, -14) * (f / 1024)
      : e === 31 ? (f ? NaN : s * Infinity)
      : s * Math.pow(2, e - 15) * (1 + f / 1024);
  }
  return t;
})();

export function parseWeights(buf) {
  const u8 = new Uint8Array(buf);
  const magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (magic !== 'TS1M') throw new Error('arquivo de pesos inválido');
  const hlen = new DataView(buf).getUint32(4, true);
  const head = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + hlen)));
  const base = 8 + hlen;
  const W = {};
  let count = 0;
  for (const t of head.tensors) {
    const n = t.shape.reduce((a, b) => a * b, 1);
    count += n;
    if (t.dtype === 'f32') {
      W[t.name] = new Float32Array(buf, base + t.offset, n);
    } else {
      const src = new Uint16Array(buf, base + t.offset, n);
      const dst = new Float32Array(n);
      for (let i = 0; i < n; i++) dst[i] = F16[src[i]];
      W[t.name] = dst;
    }
  }
  if (count !== head.params) throw new Error(`contagem ${count} ≠ ${head.params}`);
  return { W, head, count };
}

// ------------------------------------------------------------------ tokenizer (BPE byte-level do GPT-2)

const PAT = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

function bytesToUnicode() {
  const bs = [];
  for (let i = 33; i <= 126; i++) bs.push(i);
  for (let i = 161; i <= 172; i++) bs.push(i);
  for (let i = 174; i <= 255; i++) bs.push(i);
  const cs = bs.slice();
  let n = 0;
  for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++; }
  const enc = new Array(256), dec = new Map();
  bs.forEach((b, i) => { enc[b] = String.fromCharCode(cs[i]); dec.set(String.fromCharCode(cs[i]), b); });
  return { enc, dec };
}

export class Tokenizer {
  constructor({ vocab, merges }) {
    this.vocab = vocab;
    this.ids = new Map(vocab.map((s, i) => [s, i]));
    this.ranks = new Map(merges.map((m, i) => [m, i]));
    const { enc, dec } = bytesToUnicode();
    this.benc = enc; this.bdec = dec;
    this.cache = new Map();
    this.utf8 = new TextEncoder();
    this.utf8d = new TextDecoder('utf-8', { fatal: false });
  }

  bpe(word) {
    const hit = this.cache.get(word);
    if (hit) return hit;
    let parts = Array.from(word);
    while (parts.length > 1) {
      let best = -1, bestRank = Infinity;
      for (let i = 0; i < parts.length - 1; i++) {
        const r = this.ranks.get(parts[i] + ' ' + parts[i + 1]);
        if (r !== undefined && r < bestRank) { bestRank = r; best = i; }
      }
      if (best < 0) break;
      const a = parts[best], b = parts[best + 1], out = [];
      for (let i = 0; i < parts.length; i++) {
        if (i < parts.length - 1 && parts[i] === a && parts[i + 1] === b) { out.push(a + b); i++; }
        else out.push(parts[i]);
      }
      parts = out;
    }
    this.cache.set(word, parts);
    return parts;
  }

  encode(text) {
    const out = [];
    for (const m of text.matchAll(PAT)) {
      const bytes = this.utf8.encode(m[0]);
      let s = '';
      for (const b of bytes) s += this.benc[b];
      for (const p of this.bpe(s)) out.push(this.ids.get(p));
    }
    return out;
  }

  decode(ids) {
    const bytes = [];
    for (const id of ids) for (const ch of this.vocab[id]) bytes.push(this.bdec.get(ch));
    return this.utf8d.decode(new Uint8Array(bytes));
  }

  // texto de um token isolado, para exibir (pode ser um pedaço de caractere UTF-8)
  piece(id) { return this.decode([id]); }
}

// ------------------------------------------------------------------ modelo

function layerNorm(x, w, b, out) {
  let mu = 0;
  for (let i = 0; i < D; i++) mu += x[i];
  mu /= D;
  let v = 0;
  for (let i = 0; i < D; i++) { const d = x[i] - mu; v += d * d; }
  const inv = 1 / Math.sqrt(v / D + 1e-5);
  for (let i = 0; i < D; i++) out[i] = (x[i] - mu) * inv * w[i] + b[i];
}

// y = W x (+ b); W em [rows × cols], linha a linha (convenção nn.Linear do PyTorch)
function matvec(W, x, rows, cols, bias, out) {
  for (let r = 0; r < rows; r++) {
    let s = bias ? bias[r] : 0;
    const o = r * cols;
    for (let c = 0; c < cols; c++) s += W[o + c] * x[c];
    out[r] = s;
  }
}

const GELU_K = Math.sqrt(2 / Math.PI);
const gelu = x => 0.5 * x * (1 + Math.tanh(GELU_K * (x + 0.044715 * x * x * x)));

export class Model {
  constructor(W, maxT = 512) {
    this.W = W;
    this.maxT = maxT;
    this.L = [];
    for (let l = 0; l < LAYERS; l++) {
      const g = k => W[`h.${l}.${k}`];
      this.L.push({
        ln1w: g('ln_1.weight'), ln1b: g('ln_1.bias'), ln2w: g('ln_2.weight'), ln2b: g('ln_2.bias'),
        q: g('attn.q_proj.weight'), k: g('attn.k_proj.weight'), v: g('attn.v_proj.weight'),
        o: g('attn.out_proj.weight'), ob: g('attn.out_proj.bias'),
        fc: g('mlp.c_fc.weight'), fcb: g('mlp.c_fc.bias'), pj: g('mlp.c_proj.weight'), pjb: g('mlp.c_proj.bias'),
        K: new Float32Array(maxT * D), V: new Float32Array(maxT * D),
        local: l % 2 === 1,
      });
    }
    this.wte = W['wte.weight']; this.wpe = W['wpe.weight'];
    this.lnfw = W['ln_f.weight']; this.lnfb = W['ln_f.bias'];
    this.x = new Float32Array(D); this.h = new Float32Array(D);
    this.q = new Float32Array(D); this.kk = new Float32Array(D); this.vv = new Float32Array(D);
    this.att = new Float32Array(D); this.tmp = new Float32Array(D);
    this.ff = new Float32Array(FF); this.sc = new Float32Array(maxT);
    this.logits = new Float32Array(VOCAB);
    this.resid = new Float32Array((LAYERS + 1) * D); // fluxo residual do último token, entrada de cada camada + saída
    this.mlpAct = new Float32Array(LAYERS * FF);
    this.t = 0;
  }

  reset() { this.t = 0; }

  // processa um token; steer = {layer, vec: Float32Array(64)} somado na entrada da camada
  step(id, steer = null, wantLogits = true) {
    const { x, h, q, kk, vv, att, tmp, ff, sc } = this;
    const t = this.t;
    if (t >= this.maxT) throw new Error('contexto cheio');
    for (let i = 0; i < D; i++) x[i] = this.wte[id * D + i] + this.wpe[t * D + i];
    for (let l = 0; l < LAYERS; l++) {
      const P = this.L[l];
      if (steer && steer.layer === l) for (let i = 0; i < D; i++) x[i] += steer.vec[i];
      this.resid.set(x, l * D);
      layerNorm(x, P.ln1w, P.ln1b, h);
      matvec(P.q, h, D, D, null, q);
      matvec(P.k, h, D, D, null, kk);
      matvec(P.v, h, D, D, null, vv);
      P.K.set(kk, t * D); P.V.set(vv, t * D);
      const j0 = P.local ? Math.max(0, t - 255) : 0;
      for (let hh = 0; hh < HEADS; hh++) {
        const ho = hh * HD;
        let mx = -Infinity;
        for (let j = j0; j <= t; j++) {
          const ko = j * D + ho;
          // GPT-Neo não divide por sqrt(d)
          const s = q[ho] * P.K[ko] + q[ho + 1] * P.K[ko + 1] + q[ho + 2] * P.K[ko + 2] + q[ho + 3] * P.K[ko + 3];
          sc[j] = s; if (s > mx) mx = s;
        }
        let z = 0;
        for (let j = j0; j <= t; j++) { const e = Math.exp(sc[j] - mx); sc[j] = e; z += e; }
        let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
        for (let j = j0; j <= t; j++) {
          const p = sc[j] / z, vo = j * D + ho;
          a0 += p * P.V[vo]; a1 += p * P.V[vo + 1]; a2 += p * P.V[vo + 2]; a3 += p * P.V[vo + 3];
        }
        att[ho] = a0; att[ho + 1] = a1; att[ho + 2] = a2; att[ho + 3] = a3;
      }
      matvec(P.o, att, D, D, P.ob, tmp);
      for (let i = 0; i < D; i++) x[i] += tmp[i];
      layerNorm(x, P.ln2w, P.ln2b, h);
      matvec(P.fc, h, FF, D, P.fcb, ff);
      for (let i = 0; i < FF; i++) ff[i] = gelu(ff[i]);
      this.mlpAct.set(ff, l * FF);
      matvec(P.pj, ff, D, FF, P.pjb, tmp);
      for (let i = 0; i < D; i++) x[i] += tmp[i];
    }
    this.resid.set(x, LAYERS * D);
    this.t = t + 1;
    if (!wantLogits) return null;
    layerNorm(x, this.lnfw, this.lnfb, h);
    matvec(this.wte, h, VOCAB, D, null, this.logits);
    return this.logits;
  }

  // roda um prompt inteiro; devolve os logits do último token
  prompt(ids, steer = null) {
    this.reset();
    let lg = null;
    ids.forEach((id, i) => { lg = this.step(id, steer, i === ids.length - 1); });
    return lg;
  }
}

// ------------------------------------------------------------------ utilidades de decodificação

export function softmaxTop(logits, k, temperature = 1) {
  let mx = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > mx) mx = logits[i];
  let z = 0;
  for (let i = 0; i < logits.length; i++) z += Math.exp((logits[i] - mx) / temperature);
  // seleção parcial dos k maiores
  const top = [];
  for (let i = 0; i < logits.length; i++) {
    const v = logits[i];
    if (top.length < k) { top.push(i); top.sort((a, b) => logits[b] - logits[a]); }
    else if (v > logits[top[k - 1]]) { top[k - 1] = i; top.sort((a, b) => logits[b] - logits[a]); }
  }
  return top.map(i => ({ id: i, p: Math.exp((logits[i] - mx) / temperature) / z }));
}

// penalidade de repetição exatamente como no transformers (divide positivos, multiplica negativos)
export function repetitionPenalty(logits, seen, rep) {
  if (rep === 1) return;
  for (const id of seen) {
    const s = logits[id];
    logits[id] = s > 0 ? s / rep : s * rep;
  }
}

export function argmax(a) {
  let b = 0;
  for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i;
  return b;
}
