/* Validate + normalize generator params (ajv against params.schema.json). */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Ajv2020 from 'ajv/dist/2020.js';

const here = dirname(fileURLToPath(import.meta.url));
export const paramsSchema = JSON.parse(readFileSync(join(here, 'params.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, useDefaults: true, strict: true });
const validateFn = ajv.compile(paramsSchema);

/** Short CLI aliases → canonical playtime values. */
export const PLAYTIME_ALIASES = {
  'one-shot': 'one-shot 2-3h', oneshot: 'one-shot 2-3h', short: 'one-shot 2-3h',
  session: 'session 3-5h', standard: 'session 3-5h',
  long: 'long 5-8h',
};

/** Returns { ok, params, errors }. `params` is a normalized deep copy with defaults applied. */
export function validateParams(input) {
  const params = JSON.parse(JSON.stringify(input ?? {}));
  if (typeof params.playtime === 'string' && PLAYTIME_ALIASES[params.playtime.toLowerCase()]) {
    params.playtime = PLAYTIME_ALIASES[params.playtime.toLowerCase()];
  }
  if (typeof params.tone === 'string') params.tone = params.tone.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(params.playerNames)) {
    params.playerNames = params.playerNames.map((s) => String(s).trim()).filter(Boolean);
    if (!params.playerNames.length) delete params.playerNames;
  }
  if (typeof params.seedTitle === 'string' && !params.seedTitle.trim()) delete params.seedTitle;
  const ok = validateFn(params);
  const errors = ok ? [] : (validateFn.errors || []).map((e) => {
    const extra = e.params?.additionalProperty ? ` "${e.params.additionalProperty}"`
      : e.params?.allowedValues ? ` (${e.params.allowedValues.join(' | ')})` : '';
    return `params${e.instancePath} ${e.message}${extra}`;
  });
  if (ok && params.playerNames && params.playerNames.length !== params.players) {
    errors.push(`params.playerNames has ${params.playerNames.length} names but players is ${params.players}`);
  }
  if (ok && params.playerNames && new Set(params.playerNames.map((n) => n.toLowerCase())).size !== params.playerNames.length) {
    errors.push('params.playerNames must be unique');
  }
  return { ok: errors.length === 0, params, errors };
}

/** Number of acts the pack should have: 1–2 for a one-shot, 3 otherwise. */
export function actRange(params) {
  return params.playtime === 'one-shot 2-3h' ? { min: 1, max: 2 } : { min: 3, max: 3 };
}
