import React, { useMemo, useRef, useState } from 'react';
import { useContent } from '../../ContentContext';
import MapCanvas from './MapCanvas';
import { kebab, parseAsciiMap } from '../../maps/asciiMap';
import { engineBase } from './mapDefs';

/* ═══════════════════════════════════════════════════════════════
   RoomEditor — correct the room rectangles of a board map
   (docs/BOARD_AND_BUILDER.md §3): image maps (draw from scratch),
   ASCII maps (rooms the parser found) and engine maps (the deck plan's
   rooms). Tools: drag on empty map → new room; select a room (map or
   list) → drag inside it to MOVE, drag a corner handle to RESIZE;
   rename / delete in the list; nudge with the arrow buttons.
   Save:
   - runtime pack  → PUT /api/content/:universe/:packId with the map's rooms replaced
   - bundled pack  → overlay pack { kind:'maps', id:'<packId>-maps', maps:[...] },
                     merged by map id in ContentContext
   A saved list in which any room has a shape is authoritative for the
   board (mergeRooms in engine/maps/asciiMap.js): rooms keep their ids, so
   overlay rooms override the parsed / engine ones by id, deletions stick.
   Named rooms without a shape are "unplaced": select one, then draw it.
   ═══════════════════════════════════════════════════════════════ */

const r5 = (n) => Math.round(Math.min(1, Math.max(0, n)) * 1e5) / 1e5;
const MIN = 0.006;

function initialRooms(option, mapDef) {
  const seen = new Set();
  const out = [];
  const add = (r) => {
    let id = r.id || kebab(r.name);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, name: r.name || id.toUpperCase(), note: r.note || '', level: r.level || undefined, shape: r.shape || null });
  };
  // the current board definition first (parsed / engine / overlay shapes), then named pack rooms not on it
  for (const r of mapDef?.rooms || []) add(r);
  for (const r of option?.map?.rooms || []) {
    const id = r.id || kebab(r.name);
    const cur = out.find((o) => o.id === id);
    if (cur) { if (!cur.note && r.note) cur.note = r.note; continue; }
    add(r);
  }
  return out;
}

function generatedRooms(option, mapDef, universe) {
  const m = option?.map;
  if (!m) return null;
  if (mapDef?.kind === 'ascii' && m.ascii) {
    const hints = (m.rooms || []).map(({ shape, ...r }) => r); // eslint-disable-line no-unused-vars
    return parseAsciiMap(m.ascii, hints).rooms.map(({ id, name, note, shape }) => ({ id, name, note: note || '', shape }));
  }
  if (mapDef?.kind === 'engine') {
    const base = engineBase(universe, m);
    return base ? (base.rooms || []).map(({ id, name, note, level, shape }) => ({ id, name, note: note || '', level, shape })) : null;
  }
  return null;
}

export default function RoomEditor({ option, mapDef, level, universe, onClose, onSaved }) {
  const { byId, overlays, runtimeIds, save } = useContent();
  const [rooms, setRooms] = useState(() => initialRooms(option, mapDef));
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null); // { x0, y0, x1, y1 }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const gesture = useRef(null); // { mode: 'draw'|'move'|'resize', id, corner, orig }

  const board = useMemo(() => ({ fog: false, rooms: {}, tokens: {}, level, view: { rotation: 0 } }), [level]);
  const editDef = useMemo(() => ({ ...mapDef, rooms: rooms.filter((r) => r.shape) }), [mapDef, rooms]);
  const generated = useMemo(() => generatedRooms(option, mapDef, universe), [option, mapDef, universe]);
  const update = (fn) => { setRooms(fn); setDirty(true); };
  const selRoom = rooms.find((r) => r.id === sel && r.shape) || null;

  const hitCorner = (pt, s) => {
    const tol = 0.018;
    const corners = { nw: [s.x, s.y], ne: [s.x + s.w, s.y], sw: [s.x, s.y + s.h], se: [s.x + s.w, s.y + s.h] };
    for (const [k, [x, y]] of Object.entries(corners)) if (Math.abs(pt.x - x) < tol && Math.abs(pt.y - y) < tol * 1.4) return k;
    return null;
  };
  const inside = (pt, s) => pt.x >= s.x && pt.x <= s.x + s.w && pt.y >= s.y && pt.y <= s.y + s.h;

  const onBackgroundDrag = (phase, a, b) => {
    if (phase === 'start') {
      const s = selRoom?.shape?.type === 'rect' ? selRoom.shape : null;
      const corner = s ? hitCorner(a, s) : null;
      if (s && corner) gesture.current = { mode: 'resize', id: selRoom.id, corner, orig: s };
      else if (s && inside(a, s)) gesture.current = { mode: 'move', id: selRoom.id, orig: s };
      else gesture.current = { mode: 'draw' };
    }
    const g = gesture.current;
    if (!g) return;
    if (g.mode === 'draw') {
      if (phase === 'start' || phase === 'move') { setDraft({ x0: a.x, y0: a.y, x1: b.x, y1: b.y }); return; }
      setDraft(null);
      gesture.current = null;
      if (phase !== 'end') return;
      const shape = { type: 'rect', x: r5(Math.min(a.x, b.x)), y: r5(Math.min(a.y, b.y)), w: r5(Math.abs(b.x - a.x)), h: r5(Math.abs(b.y - a.y)) };
      if (shape.w < MIN || shape.h < MIN) return;
      const target = rooms.find((r) => r.id === sel && !r.shape);
      if (target) {
        update((rs) => rs.map((r) => (r.id === target.id ? { ...r, shape, level: level || undefined } : r)));
        return;
      }
      let n = rooms.filter((x) => x.shape).length + 1;
      while (rooms.some((r) => r.id === `room-${n}`)) n++;
      const id = `room-${n}`;
      update((rs) => [...rs, { id, name: `ROOM ${n}`, note: '', level: level || undefined, shape }]);
      setSel(id);
      return;
    }
    if (phase === 'cancel') { update((rs) => rs.map((r) => (r.id === g.id ? { ...r, shape: g.orig } : r))); gesture.current = null; return; }
    const dx = b.x - a.x; const dy = b.y - a.y;
    const o = g.orig;
    let s;
    if (g.mode === 'move') {
      s = { type: 'rect', x: r5(Math.min(1 - o.w, Math.max(0, o.x + dx))), y: r5(Math.min(1 - o.h, Math.max(0, o.y + dy))), w: o.w, h: o.h };
    } else {
      let x0 = o.x; let y0 = o.y; let x1 = o.x + o.w; let y1 = o.y + o.h;
      if (g.corner.includes('w')) x0 = Math.min(x1 - MIN, o.x + dx); else x1 = Math.max(x0 + MIN, x1 + dx);
      if (g.corner.includes('n')) y0 = Math.min(y1 - MIN, o.y + dy); else y1 = Math.max(y0 + MIN, y1 + dy);
      s = { type: 'rect', x: r5(x0), y: r5(y0), w: r5(x1 - x0), h: r5(y1 - y0) };
    }
    update((rs) => rs.map((r) => (r.id === g.id ? { ...r, shape: s } : r)));
    if (phase === 'end') gesture.current = null;
  };

  const patch = (id, p) => update((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id) => { update((rs) => rs.filter((r) => r.id !== id)); if (sel === id) setSel(null); };
  const nudge = (dx, dy) => {
    if (!selRoom || selRoom.shape.type !== 'rect') return;
    const s = selRoom.shape;
    patch(selRoom.id, { shape: { ...s, x: r5(Math.min(1 - s.w, Math.max(0, s.x + dx))), y: r5(Math.min(1 - s.h, Math.max(0, s.y + dy))) } });
  };
  const grow = (dw, dh) => {
    if (!selRoom || selRoom.shape.type !== 'rect') return;
    const s = selRoom.shape;
    patch(selRoom.id, { shape: { ...s, w: r5(Math.max(MIN, Math.min(1 - s.x, s.w + dw))), h: r5(Math.max(MIN, Math.min(1 - s.y, s.h + dh))) } });
  };
  const restore = () => {
    // eslint-disable-next-line no-alert
    if (!generated || !window.confirm('Replace every room with the shapes generated from the map? Unsaved edits are lost.')) return;
    update(() => generated.map((r) => ({ ...r, level: r.level || undefined })));
    setSel(null);
  };

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
      const size = mapDef.size && mapDef.kind === 'image' ? { size: mapDef.size } : {};
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
      setDirty(false);
      onSaved(clean);
    } catch (e) {
      setError(e.errors?.length ? `${e.message}: ${e.errors.slice(0, 3).join('; ')}` : e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const placed = rooms.filter((r) => r.shape && (!level || !r.level || r.level === level));
  const unplaced = rooms.filter((r) => !r.shape);
  const kindNote = mapDef.kind === 'ascii' ? 'Rooms come from the ASCII schematic — fix any the parser got wrong.'
    : mapDef.kind === 'engine' ? 'Rooms come from the deck plan.' : 'Drag on the map to draw a room.';

  return (
    <div className="re-root">
      <div className="re-top">
        <b>ROOM EDITOR — {(mapDef.title || '').toUpperCase()}</b>
        <span className="mc-hint">{kindNote} Select a room, then drag inside it to move or drag a corner to resize. Drag on empty map to add.</span>
        <span className="mc-spacer" />
        {error && <span className="mc-warn">{error}</span>}
        {generated && <button className="mc-btn" onClick={restore} disabled={saving} title="Discard corrections and use the generated rooms">RESTORE GENERATED</button>}
        <button className="mc-btn" onClick={onClose} disabled={saving}>{dirty ? 'DISCARD' : 'CLOSE'}</button>
        <button className="mc-btn primary" onClick={doSave} disabled={saving || !option.packId}>{saving ? 'SAVING…' : 'SAVE ROOMS'}</button>
      </div>
      <div className="re-main">
        <MapCanvas className="re-canvas" mapDef={editDef} board={board} role="dm" universe={universe} view={board.view}
          selectedRoomId={sel} showRoomLabels={mapDef.kind !== 'ascii'} showTokens={false} cursor="crosshair" idleDrift={false}
          onTap={(pt, roomId) => setSel(roomId || null)} onBackgroundDrag={onBackgroundDrag}
          overlay={({ W, H }) => (
            <g pointerEvents="none">
              {draft && (
                <rect x={Math.min(draft.x0, draft.x1) * W} y={Math.min(draft.y0, draft.y1) * H}
                  width={Math.abs(draft.x1 - draft.x0) * W} height={Math.abs(draft.y1 - draft.y0) * H}
                  fill="rgba(80,200,168,0.18)" stroke="#50c8a8" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="6 4" />
              )}
              {selRoom?.shape?.type === 'rect' && (() => {
                const s = selRoom.shape;
                const hs = Math.max(W, H) * 0.009;
                return (
                  <g className="re-handles">
                    <rect x={s.x * W} y={s.y * H} width={s.w * W} height={s.h * H} fill="rgba(255,255,255,0.08)" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    {[[s.x, s.y], [s.x + s.w, s.y], [s.x, s.y + s.h], [s.x + s.w, s.y + s.h]].map(([x, y], i) => (
                      <rect key={i} x={x * W - hs} y={y * H - hs} width={hs * 2} height={hs * 2} fill="#fff" stroke="#000" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    ))}
                  </g>
                );
              })()}
            </g>
          )} />
        <aside className="re-list">
          {selRoom && (
            <div className="re-sel">
              <h4>SELECTED</h4>
              <input className="mc-input" value={selRoom.name} onChange={(e) => patch(selRoom.id, { name: e.target.value })} aria-label="Selected room name" />
              <small className="mc-hint">id: {selRoom.id}</small>
              {selRoom.shape.type === 'rect' && (
                <div className="re-nudge">
                  <span className="mc-seg" aria-label="Move">
                    <button onClick={() => nudge(-0.005, 0)} aria-label="Move left">←</button>
                    <button onClick={() => nudge(0, -0.005)} aria-label="Move up">↑</button>
                    <button onClick={() => nudge(0, 0.005)} aria-label="Move down">↓</button>
                    <button onClick={() => nudge(0.005, 0)} aria-label="Move right">→</button>
                  </span>
                  <span className="mc-seg" aria-label="Resize">
                    <button onClick={() => grow(-0.005, 0)} aria-label="Narrower">W−</button>
                    <button onClick={() => grow(0.005, 0)} aria-label="Wider">W+</button>
                    <button onClick={() => grow(0, -0.005)} aria-label="Shorter">H−</button>
                    <button onClick={() => grow(0, 0.005)} aria-label="Taller">H+</button>
                  </span>
                </div>
              )}
            </div>
          )}
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
