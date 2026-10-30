import React, { useState, useMemo, useRef } from 'react';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import { characterGroups, CUSTOM_CHARACTERS_PACK_ID, downloadJson } from '../rulesUtils';
import { termsFor } from '../catalogUtils';
import CharacterSheet from './CharacterSheet';
import CharacterBuilder from './CharacterBuilder';
import { CHARACTER_KEYS, newCharacterId } from './builder/builderState';

const LEGACY_KEY = 'muthur-custom-chars';
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function readLegacy() {
  try { return JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]'); } catch { return []; }
}

/* Coerce any character-like object into a schema-valid character. */
function sanitize(c) {
  const out = Object.fromEntries(Object.entries(c || {}).filter(([k]) => CHARACTER_KEYS.includes(k)));
  out.id = KEBAB.test(out.id || '') ? out.id : newCharacterId();
  for (const k of ['name', 'career', 'appearance', 'talent', 'signatureItem', 'personalAgenda', 'buddy', 'rival']) out[k] = String(out[k] ?? '');
  if (!out.name) out.name = 'Unnamed';
  if (!out.career) out.career = 'Unknown';
  out.attributes = out.attributes && typeof out.attributes === 'object' ? out.attributes : {};
  out.skills = out.skills && typeof out.skills === 'object' ? out.skills : {};
  out.gear = Array.isArray(out.gear) ? out.gear.map(String) : [];
  if (!Number.isInteger(out.health)) delete out.health;
  return out;
}

/* Characters tab: library of characters grouped by pack (bundled scenario pre-gens,
   runtime packs, and the per-universe "Custom Characters" pack), plus the guided builder. */
export default function Characters() {
  const { universe } = useUniverse();
  const T = termsFor(universe);
  const { packs, byId, save } = useContent();
  const [selected, setSelected] = useState(null); // { packId, id }
  const [packFilter, setPackFilter] = useState('all');
  const [careerFilter, setCareerFilter] = useState('all');
  const [mode, setMode] = useState('browse'); // browse | build
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [legacy, setLegacy] = useState(readLegacy);
  const fileRef = useRef(null);

  const groups = useMemo(() => {
    const g = characterGroups(packs);
    return [...g.filter((x) => x.packId !== CUSTOM_CHARACTERS_PACK_ID), ...g.filter((x) => x.packId === CUSTOM_CHARACTERS_PACK_ID)];
  }, [packs]);
  const customPack = byId[CUSTOM_CHARACTERS_PACK_ID];
  const careers = useMemo(() => [...new Set(groups.flatMap((g) => g.characters.map((c) => c.career)).filter(Boolean))].sort(), [groups]);

  /** Upsert characters by id into the per-universe custom pack. */
  const upsertCustom = async (chars, { remove } = {}) => {
    const base = customPack || {
      packVersion: 1,
      id: CUSTOM_CHARACTERS_PACK_ID,
      universe: universe.id,
      kind: 'characters',
      meta: { title: 'Custom Characters', tagline: 'Characters created at the terminal.', source: 'custom' },
      characters: [],
    };
    let list = [...(base.characters || [])];
    for (const c of chars) {
      const i = list.findIndex((x) => x.id === c.id);
      if (i >= 0) list[i] = c; else list.push(c);
    }
    if (remove) list = list.filter((c) => c.id !== remove);
    await save({ ...base, universe: universe.id, characters: list });
  };

  const fail = (prefix, e) => setError(`${prefix}: ${e.message}${e.errors?.length ? ' — ' + e.errors.slice(0, 3).join('; ') : ''}`);

  const handleSaveBuilt = async (char) => {
    setSaving(true);
    setError('');
    try {
      await upsertCustom([char]);
      setMode('browse');
      setEditing(null);
      setSelected({ packId: CUSTOM_CHARACTERS_PACK_ID, id: char.id });
      return true;
    } catch (e) {
      fail('SAVE FAILED', e);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (char) => {
    const copy = sanitize({ ...char, id: newCharacterId(), name: `${char.name} (copy)` });
    try {
      await upsertCustom([copy]);
      setSelected({ packId: CUSTOM_CHARACTERS_PACK_ID, id: copy.id });
      setNotice(`Duplicated into Custom Characters.`);
    } catch (e) { fail('DUPLICATE FAILED', e); }
  };

  const importLegacy = async () => {
    const chars = legacy.map(({ scenario, ...c }) => sanitize(c));
    try {
      await upsertCustom(chars);
      localStorage.removeItem(LEGACY_KEY);
      setLegacy([]);
    } catch (e) { fail('IMPORT FAILED', e); }
  };

  const importFile = async (file) => {
    setError('');
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : Array.isArray(data?.characters) ? data.characters : [data];
      if (data?.universe && data.universe !== universe.id) throw new Error(`file is for universe "${data.universe}"`);
      const chars = list.filter((c) => c && typeof c === 'object' && (c.name || c.attributes)).map(sanitize);
      if (!chars.length) throw new Error('no characters found');
      await upsertCustom(chars);
      setPackFilter(CUSTOM_CHARACTERS_PACK_ID);
      setNotice(`Imported ${chars.length} character${chars.length > 1 ? 's' : ''}.`);
    } catch (e) { fail('IMPORT FAILED', e); }
  };

  const removeCustom = async (id) => {
    if (!customPack || !confirm('Delete this custom character?')) return;
    try {
      await upsertCustom([], { remove: id });
      setSelected(null);
    } catch (e) { fail('DELETE FAILED', e); }
  };

  if (mode === 'build') {
    return (
      <CharacterBuilder initial={editing} onSave={handleSaveBuilt} onBack={() => { setMode('browse'); setEditing(null); }} saving={saving} error={error} />
    );
  }

  if (selected) {
    const group = groups.find((g) => g.packId === selected.packId);
    const character = group?.characters.find((c) => c.id === selected.id);
    if (character) {
      const isCustom = group.packId === CUSTOM_CHARACTERS_PACK_ID;
      const actions = (
        <>
          {isCustom
            ? <button className="cb-btn primary" onClick={() => { setError(''); setEditing(character); setMode('build'); }}>EDIT</button>
            : <button className="cb-btn primary" onClick={() => duplicate(character)}>DUPLICATE TO CUSTOM</button>}
          <button className="cb-btn" onClick={() => downloadJson(character, `${character.id}.json`)}>EXPORT</button>
          {isCustom && <button className="cb-btn danger" onClick={() => removeCustom(character.id)}>DELETE</button>}
        </>
      );
      return (
        <div>
          {error && <p className="cb-errors">{error}</p>}
          <CharacterSheet character={character} source={group.title} onBack={() => setSelected(null)} actions={actions} />
        </div>
      );
    }
  }

  const visible = groups
    .filter((g) => packFilter === 'all' || g.packId === packFilter)
    .map((g) => ({ ...g, characters: g.characters.filter((c) => careerFilter === 'all' || c.career === careerFilter) }))
    .filter((g) => g.characters.length > 0);
  const total = groups.reduce((n, g) => n + g.characters.length, 0);

  return (
    <div>
      <div className="panel">
        <h2>CHARACTERS</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          Pre-generated characters from every pack, plus your own. Build a new character step by step, or duplicate a pre-gen to customise it.
        </p>
        <div className="cb-lib-actions">
          <button className="cb-btn primary" onClick={() => { setError(''); setEditing(null); setMode('build'); }}>+ NEW CHARACTER</button>
          <button className="cb-btn" onClick={() => fileRef.current?.click()}>IMPORT</button>
          {customPack?.characters?.length > 0 && (
            <button className="cb-btn" onClick={() => downloadJson(customPack, `${universe.id}-custom-characters.json`)}>EXPORT CUSTOM</button>
          )}
          {legacy.length > 0 && (
            <button className="cb-btn" onClick={importLegacy}>IMPORT {legacy.length} LEGACY CUSTOM CHARACTER{legacy.length > 1 ? 'S' : ''}</button>
          )}
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f); }} />
        </div>
        {error && <p className="cb-errors">{error}</p>}
        {notice && <p className="cb-ok">{notice}</p>}
      </div>

      <div className="cb-lib-filters">
        <select className="cb-input" value={packFilter} onChange={(e) => setPackFilter(e.target.value)} aria-label="Filter by pack">
          <option value="all">ALL PACKS ({total})</option>
          {groups.map((g) => <option key={g.packId} value={g.packId}>{g.title} ({g.characters.length})</option>)}
        </select>
        <select className="cb-input" value={careerFilter} onChange={(e) => setCareerFilter(e.target.value)} aria-label={`Filter by ${T.career}`}>
          <option value="all">ALL {T.career.toUpperCase()}S</option>
          {careers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {visible.map((g) => (
        <div key={g.packId} className="cb-lib-group">
          <h3 className="cb-section-title">
            {g.title.toUpperCase()}
            <span>{g.packId === CUSTOM_CHARACTERS_PACK_ID ? 'CUSTOM' : g.source === 'bundled' ? 'SCENARIO PRE-GENS' : (g.source || g.kind || '').toUpperCase()}</span>
          </h3>
          <div className="character-grid">
            {g.characters.map((c) => (
              <div key={`${g.packId}:${c.id}`} className="character-card" role="button" tabIndex={0}
                onClick={() => setSelected({ packId: g.packId, id: c.id })}
                onKeyDown={(e) => e.key === 'Enter' && setSelected({ packId: g.packId, id: c.id })}>
                <div className="char-career">{c.career}</div>
                <div className="char-name">{c.name}</div>
                <div className="cb-lib-card-actions" onClick={(e) => e.stopPropagation()}>
                  {g.packId === CUSTOM_CHARACTERS_PACK_ID
                    ? <button className="cb-btn sm" onClick={() => { setError(''); setEditing(c); setMode('build'); }}>EDIT</button>
                    : <button className="cb-btn sm" onClick={() => duplicate(c)}>DUPLICATE</button>}
                  <button className="cb-btn sm" onClick={() => downloadJson(c, `${c.id}.json`)}>EXPORT</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {visible.length === 0 && <p className="cs-empty">No characters match.</p>}
    </div>
  );
}
