import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useUniverse } from './UniverseContext';
import { apiHeaders } from './apiToken';

/* ═══════════════════════════════════════════════════════════════
   ContentContext — bundled packs (import.meta.glob) merged with
   runtime packs from /api/content/:universe. Runtime packs override
   bundled packs on id collision. Exposes packs for the ACTIVE universe.
   ═══════════════════════════════════════════════════════════════ */

const bundledModules = import.meta.glob('../universes/*/content/*.json', { eager: true, import: 'default' });

const BUNDLED = Object.values(bundledModules).map((p) => ({
  ...p,
  meta: { ...p.meta, source: p.meta?.source || 'bundled' },
}));

const ContentContext = createContext(null);
export const useContent = () => useContext(ContentContext);

async function readError(res) {
  try {
    const body = await res.json();
    const err = new Error(`${body.error || `HTTP ${res.status}`}${body.hint ? ` ${body.hint}` : ''}`);
    err.errors = body.errors || [];
    return err;
  } catch {
    return new Error(`HTTP ${res.status}`);
  }
}

export function ContentProvider({ children }) {
  const { universe } = useUniverse();
  const universeId = universe.id;
  const [runtime, setRuntime] = useState({}); // { [universeId]: Pack[] }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async (uid = universeId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/${encodeURIComponent(uid)}`, { headers: apiHeaders() });
      if (!res.ok) throw await readError(res);
      const body = await res.json();
      setRuntime((prev) => ({ ...prev, [uid]: Array.isArray(body.packs) ? body.packs : [] }));
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [universeId]);

  useEffect(() => { reload(universeId); }, [universeId, reload]);

  const runtimePacks = runtime[universeId] || [];

  /* kind:"maps" overlay packs ("<packId>-maps", written by the board Room Editor for
     bundled packs) are not listed as packs: their maps[] merge into <packId> by map id. */
  const { packs, overlays } = useMemo(() => {
    const map = new Map();
    for (const p of BUNDLED) if (p.universe === universeId) map.set(p.id, p);
    for (const p of runtimePacks) if (p.universe === universeId) map.set(p.id, p);
    const all = [...map.values()];
    const ovl = all.filter((p) => p.kind === 'maps');
    const base = all.filter((p) => p.kind !== 'maps').map((p) => {
      const o = ovl.find((x) => x.id === `${p.id}-maps`);
      if (!o?.maps?.length) return p;
      const maps = (p.maps || []).map((m) => {
        const om = o.maps.find((x) => x.id === m.id);
        return om ? { ...m, ...om } : m;
      });
      for (const om of o.maps) if (!maps.some((m) => m.id === om.id)) maps.push(om);
      return { ...p, maps };
    });
    return { packs: base, overlays: ovl };
  }, [universeId, runtimePacks]);

  const byId = useMemo(() => Object.fromEntries(packs.map((p) => [p.id, p])), [packs]);
  const runtimeIds = useMemo(() => new Set(runtimePacks.map((p) => p.id)), [runtimePacks]);
  const bundledIds = useMemo(
    () => new Set(BUNDLED.filter((p) => p.universe === universeId).map((p) => p.id)),
    [universeId],
  );

  const save = useCallback(async (pack) => {
    if (!pack?.universe || !pack?.id) throw new Error('Pack needs universe and id.');
    const res = await fetch(`/api/content/${encodeURIComponent(pack.universe)}/${encodeURIComponent(pack.id)}`, {
      method: 'PUT',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(pack),
    });
    if (!res.ok) throw await readError(res);
    const body = await res.json();
    await reload(pack.universe);
    return body.pack || pack;
  }, [reload]);

  const remove = useCallback(async (id, uid = universeId) => {
    const res = await fetch(`/api/content/${encodeURIComponent(uid)}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: apiHeaders() });
    if (!res.ok && res.status !== 404) throw await readError(res);
    await reload(uid);
  }, [reload, universeId]);

  const value = useMemo(() => ({
    packs, byId, save, remove, reload, loading, error, runtimeIds, bundledIds, overlays,
  }), [packs, byId, save, remove, reload, loading, error, runtimeIds, bundledIds, overlays]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}
