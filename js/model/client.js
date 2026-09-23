// Cliente do worker do modelo: um só worker, compartilhado por todos os capítulos.

let worker = null, ready = null, reqId = 0;
const pending = new Map();
const streams = new Map();
const progressCbs = new Set();
let last = { params: 0, frac: 0 };
export let info = null; // { count, ponte, page }

function ensure() {
  if (worker) return;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = e => {
    const m = e.data;
    if (m.type === 'progress') { last = m; progressCbs.forEach(cb => cb(m)); return; }
    if (m.type === 'ready') { info = m; ready.resolve(m); return; }
    if (m.type === 'gen' || m.type === 'steer') {
      const s = streams.get(m.req);
      if (s) { s(m); if (m.done) streams.delete(m.req); }
      return;
    }
    const p = pending.get(m.req);
    if (!p) { if (m.type === 'error' && ready && !info) ready.reject(new Error(m.error)); return; }
    pending.delete(m.req);
    m.type === 'error' ? p.reject(new Error(m.error)) : p.resolve(m);
  };
  worker.onerror = e => { if (!info) ready.reject(e); };
}

export function load() {
  if (!ready) {
    let res, rej;
    ready = new Promise((a, b) => { res = a; rej = b; });
    ready.resolve = res; ready.reject = rej;
    ensure();
    worker.postMessage({ type: 'load' });
  }
  return ready;
}

export function onProgress(cb) { progressCbs.add(cb); cb(last); return () => progressCbs.delete(cb); }
export const isReady = () => !!info;

function call(type, args) {
  const req = ++reqId;
  return new Promise((resolve, reject) => {
    pending.set(req, { resolve, reject });
    worker.postMessage({ type, req, ...args });
  });
}

export async function predict(args) { await load(); return call('predict', args); }

// gera em streaming; onToken(msg) recebe {text, done}. Um pedido novo no mesmo canal cancela o anterior.
export async function generate(args, onToken, channel = 'gen') {
  await load();
  const req = ++reqId;
  streams.set(req, onToken);
  worker.postMessage({ type: 'generate', req, channel, ...args });
  return req;
}
