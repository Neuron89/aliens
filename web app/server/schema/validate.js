/* Content-pack validation (ajv, JSON Schema draft 2020-12).
   Used by server/content.js, server/generate.js and scripts/*.mjs. */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const packSchema = JSON.parse(
  readFileSync(join(__dirname, 'content-pack.schema.json'), 'utf8'),
);

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
addFormats(ajv);
const validateFn = ajv.compile(packSchema);

/** Validate a pack object. Returns { ok, errors } where errors are readable strings. */
export function validatePack(obj) {
  const ok = validateFn(obj);
  if (ok) return { ok: true, errors: [] };
  const errors = (validateFn.errors || []).map((e) => {
    const where = e.instancePath || '(root)';
    const extra = e.params?.additionalProperty ? ` "${e.params.additionalProperty}"` : '';
    return `${where} ${e.message}${extra}`;
  });
  return { ok: false, errors };
}

/** Throws an Error (with .errors array) if the pack is invalid. Returns the pack otherwise. */
export function assertPack(obj) {
  const { ok, errors } = validatePack(obj);
  if (!ok) {
    const err = new Error(`Invalid content pack: ${errors.slice(0, 10).join('; ')}`);
    err.errors = errors;
    throw err;
  }
  return obj;
}
