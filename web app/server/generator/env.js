/* Tiny .env loader for the generator (server/index.js stays untouched).
   Reads `web app/.env` (next to package.json) if present. Existing
   process.env values always win. Supports KEY=value, quotes, # comments. */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let loaded = false;

export function loadEnv(file = join(APP_ROOT, '.env')) {
  if (loaded) return;
  loaded = true;
  if (!existsSync(file)) return;
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { return; }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, rest] = m;
    let value = rest.trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n');
    } else {
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const truthy = (v) => ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());
const falsy = (v) => ['0', 'false', 'no', 'off'].includes(String(v || '').toLowerCase());

export function generatorConfig() {
  loadEnv();
  return {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.GENERATOR_MODEL || 'claude-opus-5-5',
    effort: process.env.GENERATOR_EFFORT || 'high',
    mock: truthy(process.env.GENERATOR_MOCK),
    mockDelayMs: Number(process.env.GENERATOR_MOCK_DELAY) || 350,
    // Server-side refusal fallbacks (beta server-side-fallback-2026-07-01). GENERATOR_FALLBACKS=0 disables.
    fallbacks: !falsy(process.env.GENERATOR_FALLBACKS),
    maxTokens: Number(process.env.GENERATOR_MAX_TOKENS) || 64000,
  };
}
