import React, { useMemo, useState } from 'react';
import { useContent } from '../../ContentContext';
import MapCanvas from './MapCanvas';

/* ═══════════════════════════════════════════════════════════════
   RoomEditor — draw rectangular rooms over an image map, name them,
   delete them, save (docs/BOARD_AND_BUILDER.md §3).
   - runtime pack  → PUT /api/content/:universe/:packId with the map's rooms replaced
   - bundled pack  → overlay pack { kind:'maps', id:'<packId>-maps', maps:[...] },
                     merged by map id in ContentContext
   Named rooms from the pack that have no shape yet are listed as
   "unplaced": select one, then drag on the map to place it.
   ═══════════════════════════════════════════════════════════════ */

const r5 = (n) => Math.round(Math.min(1, Math.max(0, n)) * 1e5) / 1e5;
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'room';

function initialRooms(option, mapDef) {
  const fromPack = option?.map?.rooms || [];
  const seen = new Set();
  const out = [];
  const add = (r) => {
    let id = r.id || slug(r.name);
    while (seen.has(id)) id += '-2';
    seen.add(id);
    out.push({ id, name: r.name || id.toUpperCase(), note: r.note || '', level: r.level || undefined, shape: r.shape || null });
  };
  fromPack.forEach(add);
  for (const r of mapDef?.rooms || []) if (!out.some((o) => o.id === r.id)) add(r);
  return out;
}

export default function RoomEditor({ option, mapDef, level, universe, onClose, onSaved }) {
  const { byId, overlays, runtimeIds, save } = useContent();
  const [rooms, setRooms] = useState(() => initialRooms(option, mapDef));
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null); // { x0, y0, x1, y1 }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const board = useMemo(() => ({ fog: false, rooms: {}, tokens: {}, level, view: { rotation: 0 } }), [level]);
  const editDef = useMemo(() => ({ ...mapDef, rooms: rooms.filter((r) => r.shape) }), [mapDef, rooms]);

  const onBackgroundDrag = (phase, a, b) => {
    if (phase === 'start' || phase === 'move') { setDraft({ x0: a.x, y0: a.y, x1: b.x, y1: b.y }); return; }
    setDraft(null);
    if (phase !== 'end') return;
    const shape = { type: 'rect', x: r5(Math.min(a.x, b.x)), y: r5(Math.min(a.y, b.y)), w: r5(Math.abs(b.x - a.x)), h: r5(Math.abs(b.y - a.y)) };
    if (shape.w < 0.005 || shape.h < 0.005) return;
    const target = rooms.find((r) => r.id === sel && !r.shape);
    if (target) {
      setRooms((rs) => rs.map((r) => (r.id === target.id ? { ...r, shape, level: level || undefined } : r)));
      return;
    }
    let n = rooms.filter((x) => x.shape).length + 1;
    while (rooms.some((r) => r.id === `room-${n}`)) n++;
    const id = `room-${n}`;
    setRooms((rs) => [...rs, { id, name: `ROOM ${n}`, note: '', level: level || undefined, shape }]);
    setSel(id);
  };

  const patch = (id, p) => setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id) => { setRooms((rs) => rs.filter((r) => r.id !== id)); if (sel === id) setSel(null); };

  const doSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const clean = rooms.map(({ id, name, note, level: lv, shape }) => ({
        id, name: name || id.toUpperCase(), ...(note ? { note } : {}), ...(lv ? { level: lv } : {}), ...(shape ? { shape } : {}),
      }));
      const pack = byId[option.packId];
      if (!pack) throw new Error('Pack not found.');
      const mapId = option.map.id;
      const size = mapDef.size ? { size: mapDef.size } : {};
      if (runtimeIds.has(pack.id)) {
        await save({ ...pack, maps: (pack.maps || []).map((m) => (m.id === mapId ? { ...m, ...size, rooms: clean } : m)) });
      } else {
        const oid = `${pack.id}-maps`;
        const existing = overlays.find((o) => o.id === oid);
        const baseMap = (pack.maps || []).find((m) => m.id === mapId) || option.map;
        const maps = (existing?.maps || []).filter((m) => m.id !== mapId);
        maps.push({ ...baseMap, ...size, rooms: clean });
        await save({
          packVersion: 1, id: oid, universe: pack.universe, kind: 'maps',
          meta: { title: `${pack.meta?.title || pack.id} — Map Rooms`, tagline: 'Room shapes for the table board (Room Editor overlay).', source: 'custom' },
          maps,
        });
      }
      onSaved(clean);
    } catch (e) {
      setError(e.errors?.length ? `${e.message}: ${e.errors.slice(0, 3).join('; ')}` : e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const placed = rooms.filter((r) => r.shape && (!level || !r.level || r.level === level));
  const unplaced = rooms.filter((r) => !r.shape);

  return (
    <div className="re-root">
      <div className="re-top">
        <b>ROOM EDITOR — {(mapDef.title || '').toUpperCase()}</b>
        <span className="mc-hint">Drag on the map to draw a room. Select an unplaced room first to give it a shape.</span>
        <span className="mc-spacer" />
        {error && <span className="mc-warn">{error}</span>}
        <button className="mc-btn" onClick={onClose} disabled={saving}>CANCEL</button>
        <button className="mc-btn primary" onClick={doSave} disabled={saving}>{saving ? 'SAVING…' : 'SAVE ROOMS'}</button>
      </div>
      <div className="re-main">
        <MapCanvas className="re-canvas" mapDef={editDef} board={board} role="dm" universe={universe} view={board.view}
          selectedRoomId={sel} showRoomLabels showTokens={false} cursor="crosshair"
          onTap={(pt, roomId) => setSel(roomId || null)} onBackgroundDrag={onBackgroundDrag}
          overlay={({ W, H }) => draft && (
            <rect x={Math.min(draft.x0, draft.x1) * W} y={Math.min(draft.y0, draft.y1) * H}
              width={Math.abs(draft.x1 - draft.x0) * W} height={Math.abs(draft.y1 - draft.y0) * H}
              fill="rgba(80,200,168,0.18)" stroke="#50c8a8" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="6 4" />
          )} />
        <aside className="re-list">
          <h4>ROOMS ({placed.length})</h4>
          {placed.map((r) => (
            <div key={r.id} className={`re-room${sel === r.id ? ' sel' : ''}`} onClick={() => setSel(r.id)}>
              <input className="mc-input mc-grow" value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} aria-label="Room name" />
              <button className="mc-btn danger" onClick={(e) => { e.stopPropagation(); remove(r.id); }} aria-label={`Delete ${r.name}`}>DEL</button>
            </div>
          ))}
          {unplaced.length > 0 && <h4>UNPLACED ({unplaced.length})</h4>}
          {unplaced.map((r) => (
            <div key={r.id} className={`re-room unplaced${sel === r.id ? ' sel' : ''}`} onClick={() => setSel(r.id)}>
              <span className="mc-grow">{r.name}</span>
              <button className="mc-btn danger" onClick={(e) => { e.stopPropagation(); remove(r.id); }}>DEL</button>
            </div>
          ))}
          {!option.packId && <p className="mc-warn">Universe maps can't be saved from here.</p>}
        </aside>
      </div>
    </div>
  );
}
