/* Client for POST /api/generate (Server-Sent Events over fetch, so it can POST
   a body and be cancelled with an AbortController). */

export class GenerateError extends Error {
  constructor(message, { code, status, errors, hint } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.errors = errors || [];
    this.hint = hint;
  }
}

/** GET /api/generate/status → { configured, mock, model, effort, fallbacks } (null on failure). */
export async function fetchGeneratorStatus() {
  try {
    const res = await fetch('/api/generate/status');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Run a generation. Resolves with { pack, repaired }; rejects with GenerateError
 * (or an AbortError if `signal` aborts).
 * handlers: { onStatus({message, ...}), onDelta(chars) }
 */
export async function runGeneration({ universeId, params, signal, onStatus, onDelta }) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ universeId, params }),
    signal,
  });

  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.includes('text/event-stream')) {
    let body = {};
    try { body = await res.json(); } catch { /* not JSON */ }
    throw new GenerateError(body.message || body.error || `HTTP ${res.status}`, {
      code: body.error, status: res.status, errors: body.errors, hint: body.hint,
    });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;
  let failure = null;

  const handle = (block) => {
    let event = 'message';
    const data = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue; // keepalive comment
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (!data.length) return;
    let payload;
    try { payload = JSON.parse(data.join('\n')); } catch { return; }
    if (event === 'status') onStatus?.(payload);
    else if (event === 'delta') onDelta?.(payload.chars);
    else if (event === 'done') result = payload;
    else if (event === 'error') {
      failure = new GenerateError(payload.message || payload.error || 'Generation failed.', {
        code: payload.error, status: payload.status, errors: payload.errors, hint: payload.hint,
      });
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.trim()) handle(buffer);
  if (failure) throw failure;
  if (!result?.pack) throw new GenerateError('Connection closed before the pack arrived.', { code: 'incomplete' });
  return result;
}
