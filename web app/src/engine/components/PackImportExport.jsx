import React, { useState, useRef } from 'react';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import { quickCheckPack, downloadJson } from '../rulesUtils';
import { S } from './ScenarioPanels';

/** EXPORT button — downloads a pack as <id>.json */
export function ExportPackButton({ pack, label = 'EXPORT', style }) {
  return (
    <button style={{ ...S.btn(false), ...style }}
      onClick={(e) => { e.stopPropagation(); downloadJson(pack, `${pack.id}.json`); }}>
      {label}
    </button>
  );
}

/**
 * IMPORT PACK panel — paste JSON or choose a file, run a lightweight client-side
 * check, then save through ContentContext (the server runs full schema validation).
 */
export default function PackImportExport({ onDone }) {
  const { universe } = useUniverse();
  const { save, byId, bundledIds, runtimeIds } = useContent();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const parse = () => {
    try {
      return { pack: JSON.parse(text) };
    } catch (e) {
      return { error: `Invalid JSON: ${e.message}` };
    }
  };

  const parsed = text.trim() ? parse() : null;
  const pack = parsed?.pack;
  const collision = pack?.id && byId[pack.id];

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setErrors([]);
    setStatus('');
    e.target.value = '';
  };

  const doImport = async () => {
    setStatus('');
    if (!parsed) return;
    if (parsed.error) { setErrors([parsed.error]); return; }
    const errs = quickCheckPack(pack, { universeId: universe.id });
    setErrors(errs);
    if (errs.length) return;
    if (collision && !confirm(
      bundledIds.has(pack.id) && !runtimeIds.has(pack.id)
        ? `A bundled pack with id "${pack.id}" exists. The imported pack will override it. Continue?`
        : `Pack "${pack.id}" already exists and will be replaced. Continue?`,
    )) return;
    setBusy(true);
    try {
      const toSave = { ...pack, meta: { ...pack.meta, source: pack.meta.source === 'generated' ? 'generated' : 'custom' } };
      await save(toSave);
      setStatus(`IMPORTED "${pack.meta.title}".`);
      setText('');
      onDone?.(pack.id);
    } catch (e) {
      setErrors([e.message, ...(e.errors || []).slice(0, 12)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...S.panel, borderColor: 'var(--accent)' }}>
      <h3 style={{ ...S.h3, marginBottom: '0.5rem' }}>IMPORT CONTENT PACK — {universe.name}</h3>
      <p style={{ ...S.dim, fontSize: '0.72rem', marginBottom: '0.5rem' }}>
        Paste a pack JSON or choose a .json file. Packs are validated against the content-pack schema and stored on the server
        in <code>content/{universe.id}/</code>.
      </p>
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button style={S.btn(false)} onClick={() => fileRef.current?.click()}>CHOOSE FILE…</button>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFile} style={{ display: 'none' }} />
        {pack?.meta?.title && (
          <span style={{ ...S.dim, fontSize: '0.7rem', alignSelf: 'center' }}>
            DETECTED: <span style={{ color: 'var(--accent)' }}>{pack.meta.title}</span> ({pack.kind}, {pack.universe}/{pack.id})
            {collision && <span style={{ color: 'var(--warn)' }}> — WILL REPLACE EXISTING</span>}
          </span>
        )}
      </div>
      <textarea value={text} onChange={e => { setText(e.target.value); setErrors([]); setStatus(''); }}
        placeholder='{ "packVersion": 1, "id": "my-scenario", "universe": "…", "kind": "scenario", "meta": { … }, "acts": [ … ] }'
        rows={8} style={{ ...S.input, width: '100%', resize: 'vertical', fontSize: '0.7rem' }} />
      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem' }}>
        <button style={S.btn(!!text.trim())} disabled={!text.trim() || busy} onClick={doImport}>
          {busy ? 'VALIDATING…' : 'VALIDATE & IMPORT'}
        </button>
        {onDone && <button style={S.btn(false)} onClick={() => onDone(null)}>CLOSE</button>}
      </div>
      {errors.length > 0 && (
        <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', color: 'var(--danger)', fontSize: '0.7rem' }}>
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
      {status && <p style={{ marginTop: '0.5rem', color: 'var(--success)', fontSize: '0.75rem' }}>{status}</p>}
    </div>
  );
}
