// Web Worker: baixa os pesos (contando parâmetros enquanto chegam), monta a página
// de parâmetros para o mergulho e roda o TinyStories-1M sem travar a interface.
import { parseWeights, Tokenizer, Model, softmaxTop, repetitionPenalty, argmax, EOS } from './tinystories.js';
import { buildPage } from './page.js';

const BASE = new URL('../../assets/model/', import.meta.url);
let model = null, tok = null, ponte = null, W = null;
let latest = { gen: 0 };

async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const total = +res.headers.get('content-length') || 8298708;
  if (!res.body || !res.body.getReader) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    onProgress(got, total);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

async function load() {
  const TOTAL = 3745984, BYTES = 8298708;
  let last = 0;
  const [buf, tj, pj] = await Promise.all([
    fetchWithProgress(new URL('tinystories-1m.bin', BASE), (got) => {
      const now = performance.now();
      if (now - last < 50) return;
      last = now;
      // estimativa de parâmetros recebidos: proporcional aos bytes (o cabeçalho é desprezível)
      postMessage({ type: 'progress', params: Math.min(TOTAL, Math.round(TOTAL * got / BYTES)), frac: Math.min(1, got / BYTES) });
    }),
    fetch(new URL('tokenizer.json', BASE)).then(r => r.json()),
    fetch(new URL('ponte.json', BASE)).then(r => r.json()),
  ]);
  const parsed = parseWeights(buf);
  W = parsed.W;
  tok = new Tokenizer(tj);
  ponte = pj;
  model = new Model(W, 320);
  postMessage({ type: 'progress', params: parsed.count, frac: 1 });
  const page = buildPage(W);
  postMessage({
    type: 'ready', count: parsed.count,
    ponte: { camada: ponte.camada, palavras: ponte.palavras, projecao: ponte.projecao, neuronios: ponte.neuronios },
    page: { ...page, ink: page.ink, vals: page.vals },
  }, [page.ink.buffer, page.vals.buffer]);
}

function steerFor(c) {
  if (!c) return null;
  const v = new Float32Array(64);
  for (let i = 0; i < 64; i++) v[i] = ponte.direcao[i] * c;
  return { layer: ponte.camada, vec: v };
}

function clip(ids, max = 240) { return ids.length > max ? ids.slice(ids.length - max) : ids; }

function predict({ req, text, c = 0, k = 8 }) {
  let ids = clip(tok.encode(text));
  if (!ids.length) ids = [EOS];
  const lg = model.prompt(ids, steerFor(c));
  const top = softmaxTop(lg, k).map(t => ({ ...t, s: tok.piece(t.id) }));
  postMessage({
    type: 'predict', req, top,
    pieces: ids.map(id => tok.piece(id)),
    resid: Float32Array.from(model.resid),
    mlp: Float32Array.from(model.mlpAct),
  });
}

// gera token a token, cedendo o controle entre um e outro (um pedido novo cancela o anterior)
async function generate({ req, text, c = 0, n = 40, rep = 1.3, stream = true, channel = 'gen' }) {
  latest[channel] = req;
  let ids = clip(tok.encode(text));
  if (!ids.length) ids = [EOS];
  const steer = steerFor(c);
  const seen = new Set(ids);
  let lg = model.prompt(ids, steer);
  const out = [];
  for (let i = 0; i < n; i++) {
    const l = Float32Array.from(lg);
    repetitionPenalty(l, seen, rep);
    const t = argmax(l);
    if (t === EOS) break;
    out.push(t); seen.add(t);
    if (stream) {
      postMessage({ type: channel, req, text: tok.decode(out), done: false, resid: Float32Array.from(model.resid) });
      await new Promise(r => setTimeout(r, 0));
      if (latest[channel] !== req) return;
    }
    if (ids.length + out.length >= model.maxT - 1) break;
    lg = model.step(t, steer);
  }
  postMessage({ type: channel, req, text: tok.decode(out), done: true });
}

onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') await load();
    else if (!model) postMessage({ type: 'error', req: m.req, error: 'modelo ainda não carregado' });
    else if (m.type === 'predict') predict(m);
    else if (m.type === 'generate') await generate(m);
    else if (m.type === 'tokenize') postMessage({ type: 'tokenize', req: m.req, pieces: tok.encode(m.text).map(id => tok.piece(id)) });
  } catch (err) {
    postMessage({ type: 'error', req: m.req, error: String(err && err.message || err) });
  }
};
