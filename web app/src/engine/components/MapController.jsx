import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import { useContent } from '../ContentContext';
import MapCanvas from './board/MapCanvas';
import RoomEditor from './board/RoomEditor';
import { Glyph, MARKERS, careerGlyph, initials, statusOptions, tokenStatuses } from './board/TokenChip';
import { boardMapOptions, findMapOption, resolveMapDef } from './board/mapDefs';
import { qrPath } from './board/qr';

/* ═══════════════════════════════════════════════════════════════
   MapController — GM tablet controller for the table board
   (docs/BOARD_AND_BUILDER.md §4). DM nav tab "BOARD".
   Top bar: map / level, FOG, ROTATE, FLIP, FIT, ZOOM, PING, SNAP,
   EDIT ROOMS, RESET, OPEN BOARD (+QR), TV-linked dot.
   Canvas: drag tokens (30 Hz to the TV), tap token → token sheet,
   tap room → room sheet. Palette: drag (or tap-to-arm, then tap the
   map) from CREW / THREATS / NPCS / ITEMS / MARKERS; ROOMS tab lists
   reveal toggles for the current level.
   ═══════════════════════════════════════════════════════════════ */

const EMPTY_BOARD = { mapId: null, level: null, fog: true, view: { rotation: 0, flipX: false, zoom: 1, pan: [0, 0] }, rooms: {}, tokens: {}, pings: [] };
const DM_VIEW = { rotation: 0, flipX: false, zoom: 1, pan: [0, 0] };

function PaletteIcon({ item }) {
  const t = item.token;
  const color = t.color || (t.kind === 'pc' ? '#4fc3f7' : t.kind === 'npc' ? '#d4b46a' : t.kind === 'creature' ? '#e53935' : t.kind === 'item' ? '#9ccc65' : '#b0bec5');
  return (
    <svg className="mc-pal-icon" viewBox="-12 -12 24 24" aria-hidden="true">
      <circle r="10.5" fill="#0a0c10" stroke={color} strokeWidth={t.kind === 'pc' ? 2.4 : 1.6} />
      {t.icon ? (
        <>
          <clipPath id={`palclip-${item.key}`}><circle r="9.5" /></clipPath>
          <image href={t.icon} x="-10" y="-10" width="20" height="20" clipPath={`url(#palclip-${item.key})`} preserveAspectRatio="xMidYMid slice" />
        </>
      ) : t.kind === 'pc' ? (
        <text y="3.6" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff">{initials(t.label)}</text>
      ) : (
        <Glyph name={t.glyph} r={6.5} color={color} />
      )}
    </svg>
  );
}

function QrBox({ text }) {
  const qr = useMemo(() => { try { return qrPath(text); } catch { return null; } }, [text]);
  if (!qr) return null;
  return (
    <svg className="mc-qr" viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${text}`}>
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qr.d} fill="#000" />
    </svg>
  );
}

export default function MapController({ compact = false, onOpenFull }) {
  const g = useGame();
  const { universe } = useUniverse();
  const { packs, byId } = useContent();
  const board = g.board || EMPTY_BOARD;
  const { mapDef } = g;
  const [tab, setTab] = useState('crew');
  const [armed, setArmed] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [selTok, setSelTok] = useState(null);
  const [selRoom, setSelRoom] = useState(null);
  const [pingMode, setPingMode] = useState(false);
  const [snap, setSnap] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [editRooms, setEditRooms] = useState(false);
  const [custom, setCustom] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const [matchTv, setMatchTv] = useState(true);
  const [rootH, setRootH] = useState(null);
  const [cPanel, setCPanel] = useState(null); // compact (Run → MAP drawer): null | 'rooms' | 'token'

  /* Fill the viewport below the header/nav (the DM chrome height varies by universe). */
  useLayoutEffect(() => {
    if (compact) return undefined;
    const fitHeight = () => {
      const el = rootRef.current;
      if (!el || !el.offsetParent) return;
      if (window.innerWidth <= 900) { setRootH(null); return; }
      const top = el.getBoundingClientRect().top + window.scrollY;
      setRootH(Math.max(520, window.innerHeight - top - 10));
    };
    fitHeight();
    window.addEventListener('resize', fitHeight);
    const t = setInterval(fitHeight, 1000); // section switches change the layout without a resize
    return () => { window.removeEventListener('resize', fitHeight); clearInterval(t); };
  }, [compact]);

  useEffect(() => { if (g.role === 'dm' && !g.board) g.boardSync(); }, [g.role, g.board, g.boardSync]);
  useEffect(() => {
    if (!status) return undefined;
    const t = setTimeout(() => setStatus(null), 3500);
    return () => clearTimeout(t);
  }, [status]);

  const options = useMemo(() => boardMapOptions(universe, packs, g.packId), [universe, packs, g.packId]);
  /* Token statuses come from the universe rules (+ hidden / wounded), so Dune tokens never offer ALIEN panic. */
  const statusList = useMemo(() => statusOptions(universe), [universe]);
  const currentOpt = findMapOption(options, board.mapId);
  const activePack = g.packId ? byId[g.packId] : null;
  const levels = mapDef?.levels || [];
  const level = board.level || levels[0]?.id || null;
  const rooms = useMemo(() => (mapDef?.rooms || []).filter((r) => !level || !r.level || r.level === level), [mapDef, level]);
  const view = board.view || DM_VIEW;
  /* The tablet can mirror the TV orientation (rotation/flip, not zoom) so positions match what players see. */
  const canvasView = matchTv ? { ...DM_VIEW, rotation: view.rotation || 0, flipX: !!view.flipX } : DM_VIEW;

  /* ─── Map selection ─── */
  const chooseMap = async (mapId) => {
    const opt = findMapOption(options, mapId);
    if (!opt) return;
    setStatus('LOADING MAP…');
    const def = await resolveMapDef(universe, opt);
    g.boardSetMap(mapId, null, def, (r) => setStatus(r?.error ? `MAP ERROR: ${r.error}` : null));
    setSelTok(null);
    setSelRoom(null);
  };
  const chooseLevel = (lvl) => {
    if (!mapDef) return;
    g.boardSetMap(board.mapId, lvl, mapDef);
    setSelRoom(null);
  };

  /* ─── Palette ─── */
  /* THREATS: universe.catalog.creatures (Phase 3B) when present, else universe.reference.bestiary.
     Token art = cropped thumbnail only (never a full-page scan); otherwise a glyph. */
  const creatures = useMemo(() => {
    const best = universe.reference?.bestiary || [];
    const thumbOf = (id) => best.find((b) => b.id === id)?.thumb || null;
    const cat = universe.catalog?.creatures;
    if (Array.isArray(cat) && cat.length) {
      return cat.filter((c) => !['npc', 'synthetic', 'cyborg'].includes(c.type))
        .map((c) => ({ id: c.id, name: c.name, sub: c.stage || c.type || '', icon: c.thumb || c.art || thumbOf(c.id) }));
    }
    return best.map((b) => ({ id: b.id, name: b.name, sub: b.stage || '', icon: b.thumb || null }));
  }, [universe]);

  /* ITEMS: catalog weapons/armor/gear when present, else the universe.gear pick-list. */
  const gearList = useMemo(() => {
    const cat = universe.catalog;
    const fromCat = ['weapons', 'armor', 'gear'].flatMap((k) => (Array.isArray(cat?.[k]) ? cat[k] : [])
      .filter((x) => x?.name && !(x.tags || []).includes('vehicle-mounted'))
      .map((x) => ({ name: x.name, sub: (x.category || k).toUpperCase() })));
    if (fromCat.length) return fromCat;
    return (universe.gear || []).map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean).map((name) => ({ name, sub: 'ITEM' }));
  }, [universe]);

  const palette = useMemo(() => {
    const crew = Object.values(g.players || {}).filter((p) => p.character).map((p) => ({
      key: `pc-${p.id}`, label: p.character.name, sub: `${p.character.career || ''} · ${p.name}`,
      onMap: !!board.tokens[`pc-${p.id}`],
      token: { id: `pc-${p.id}`, kind: 'pc', label: p.character.name, sub: p.character.career || '', ownerPlayerId: p.id, glyph: careerGlyph(p.character.career) },
    }));
    const threatRefs = new Set((activePack?.threats || []).map((t) => t.ref).filter(Boolean));
    const threats = [...creatures].sort((a, b) => threatRefs.has(b.id) - threatRefs.has(a.id)).map((c) => ({
      key: `cr-${c.id}`, label: c.name, sub: `${c.sub}${threatRefs.has(c.id) ? ' · SCENARIO' : ''}`,
      token: { kind: 'creature', label: c.name, sub: c.sub, icon: c.icon, glyph: 'claw' },
    }));
    const npcs = (activePack?.npcs || []).map((n, i) => ({
      key: `npc-${i}`, label: n.name, sub: n.role || '',
      token: { kind: 'npc', label: n.name, sub: n.role || '', glyph: 'person', color: '#d4b46a' },
    }));
    const items = gearList.map(({ name, sub }, i) => ({
      key: `it-${i}`, label: name, sub,
      token: { kind: 'item', label: name, sub, glyph: 'crate', color: '#9ccc65' },
    }));
    const markers = MARKERS.map((m) => ({
      key: `mk-${m.glyph}`, label: m.label, sub: m.kind === 'hazard' ? 'HAZARD' : 'MARKER',
      token: { kind: m.kind, label: m.label, glyph: m.glyph, color: m.color },
    }));
    return { crew, threats, npcs, items, markers };
  }, [g.players, board.tokens, creatures, activePack, gearList]);

  const place = useCallback((item, pt) => {
    const id = item.token.id;
    if (id && board.tokens[id]) {
      if (board.tokens[id].level !== level) g.boardUpsertToken({ id, level, x: pt.x, y: pt.y });
      else g.boardMoveToken(id, pt.x, pt.y, true);
      setSelTok(id);
      return;
    }
    const newId = g.boardUpsertToken({ ...item.token, x: pt.x, y: pt.y, level, size: item.token.size || 1 });
    setSelTok(newId);
    setSelRoom(null);
  }, [board.tokens, level, g]);

  const onItemPointerDown = (e, item) => {
    if (!mapDef) { setStatus('SELECT A MAP FIRST'); return; }
    const start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    const el = e.currentTarget;
    let dragging = false;
    const move = (ev) => {
      if (ev.pointerId !== start.id) return;
      if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
        dragging = true;
        try { el.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
      }
      if (dragging) setGhost({ item, x: ev.clientX, y: ev.clientY });
    };
    const cleanup = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
    const up = (ev) => {
      if (ev.pointerId !== start.id) return;
      cleanup();
      setGhost(null);
      if (dragging) {
        if (canvasRef.current?.contains(ev.clientX, ev.clientY)) {
          const pt = canvasRef.current.clientToMap(ev.clientX, ev.clientY);
          if (pt) place(item, pt);
        }
      } else {
        setArmed((a) => (a?.key === item.key ? null : item));
        setPingMode(false);
      }
    };
    const cancel = () => { cleanup(); setGhost(null); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
  };

  /* ─── Canvas ─── */
  const ping = (pt) => g.boardPing(pt.x, pt.y, (r) => { if (r?.error) setStatus(r.error); });
  const onTap = (pt, roomId) => {
    if (pingMode) { ping(pt); return; }
    if (armed) { place(armed, pt); setArmed(null); return; }
    setSelTok(null);
    setSelRoom(roomId || null);
  };
  const onTokenTap = (id, pt) => {
    if (pingMode) { ping(pt); return; }
    if (armed) { place(armed, pt); setArmed(null); return; }
    setSelTok(id);
    setSelRoom(null);
  };
  const onTokenMove = (id, x, y, final) => g.boardMoveToken(id, x, y, final);

  /* ─── Top bar actions ─── */
  const rotate = () => g.boardSetView({ rotation: ((view.rotation || 0) + 90) % 360 });
  const flip = () => g.boardSetView({ flipX: !view.flipX });
  const fit = () => g.boardSetView({ zoom: 1, pan: [0, 0] });
  const zoomBy = (f) => g.boardSetView({ zoom: Math.min(6, Math.max(0.5, Math.round((view.zoom || 1) * f * 100) / 100)) });
  const reset = () => {
    // eslint-disable-next-line no-alert
    if (window.confirm('Reset the board? All tokens are removed and every room is fogged again.')) {
      g.boardReset();
      setSelTok(null);
      setSelRoom(null);
    }
  };

  const boardUrl = typeof window !== 'undefined' ? `${window.location.origin}/?board=${g.gameCode}` : '';
  const localHost = typeof window !== 'undefined' && /^(localhost|127\.|\[::1\])/.test(window.location.hostname);

  /* ─── Selection ─── */
  const tok = selTok ? board.tokens[selTok] : null;
  const roomDef = selRoom ? (mapDef?.rooms || []).find((r) => r.id === selRoom) : null;
  const roomSt = selRoom ? board.rooms[selRoom] || {} : {};
  const crewPlayers = Object.values(g.players || {}).filter((p) => p.character);
  const sendToPlayer = (pid) => {
    const p = g.players[pid];
    if (!p || !tok) return;
    g.updatePlayer(pid, { inventory: [...(p.inventory || []), tok.label || 'Item'] });
    g.boardRemoveToken(tok.id);
    setSelTok(null);
    setStatus(`${(tok.label || 'ITEM').toUpperCase()} → ${p.character?.name?.toUpperCase() || p.name}`);
  };

  const revealedCount = rooms.filter((r) => board.rooms[r.id]?.revealed).length;
  const list = tab === 'rooms' ? null : (palette[tab] || []).filter((it) => !query || `${it.label} ${it.sub}`.toLowerCase().includes(query.toLowerCase()));
  const groups = useMemo(() => {
    const out = [];
    for (const o of options) {
      let grp = out.find((x) => x.name === o.group);
      if (!grp) { grp = { name: o.group, items: [] }; out.push(grp); }
      grp.items.push(o);
    }
    return out;
  }, [options]);

  if (g.role !== 'dm') return null;

  /* ─── Token sheet ─── */
  const tokenSheet = tok && (
    <div className="mc-sheet" role="dialog" aria-label="Token">
      <div className="mc-sheet-head">
        <span className={`mc-kind k-${tok.kind}`}>{tok.kind.toUpperCase()}</span>
        <input className="mc-input mc-grow" key={`l-${tok.id}`} defaultValue={tok.label} aria-label="Token name"
          onBlur={(e) => e.target.value !== tok.label && g.boardUpsertToken({ id: tok.id, label: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <button className="mc-btn" onClick={() => setSelTok(null)}>CLOSE</button>
      </div>
      <div className="mc-sheet-row">
        <button className={`mc-btn${tok.hidden ? ' on warn' : ''}`} onClick={() => g.boardUpsertToken({ id: tok.id, hidden: !tok.hidden })}>
          {tok.hidden ? 'HIDDEN — SHOW' : 'VISIBLE — HIDE'}
        </button>
        {tok.kind === 'item' && (
          <button className={`mc-btn${tok.locked ? ' on warn' : ''}`} aria-pressed={!!tok.locked}
            title="Free pickup: a player in the same room can TAKE it from the phone. Ask first: the phone shows ASK and messages you."
            onClick={() => g.boardUpsertToken({ id: tok.id, locked: !tok.locked })}>
            {tok.locked ? 'ASK FIRST — ALLOW PICKUP' : 'FREE PICKUP — LOCK'}
          </button>
        )}
        <span className="mc-seg"><button onClick={() => g.boardUpsertToken({ id: tok.id, size: Math.max(0.5, (tok.size || 1) - 0.5) })} aria-label="Smaller">−</button>
          <span className="mc-seg-val">SIZE {tok.size || 1}</span>
          <button onClick={() => g.boardUpsertToken({ id: tok.id, size: Math.min(6, (tok.size || 1) + 0.5) })} aria-label="Bigger">+</button></span>
        <span className="mc-seg"><button onClick={() => g.boardUpsertToken({ id: tok.id, facing: (tok.facing || 0) - 45 })} aria-label="Turn left">⟲</button>
          <span className="mc-seg-val">FACING {tok.facing || 0}°</span>
          <button onClick={() => g.boardUpsertToken({ id: tok.id, facing: (tok.facing || 0) + 45 })} aria-label="Turn right">⟳</button></span>
        {levels.length > 1 && (
          <select className="mc-select" value={tok.level || level || ''} onChange={(e) => g.boardUpsertToken({ id: tok.id, level: e.target.value })} aria-label="Token level">
            {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        )}
        <span className="mc-meta">{tok.roomId ? (mapDef?.rooms.find((r) => r.id === tok.roomId)?.name || tok.roomId) : 'NO ROOM'}</span>
        {!tok.hidden && tok.kind !== 'pc' && board.fog && tok.roomId && !board.rooms?.[tok.roomId]?.revealed && (
          <span className="mc-meta mc-fogged" title="The table sees it once the room is revealed">IN FOG — NOT ON TV YET</span>
        )}
      </div>
      {tok.kind !== 'marker' && tok.kind !== 'hazard' && tok.kind !== 'item' && (
        <div className="mc-sheet-row" role="group" aria-label="Token status">
          <span className="mc-meta">STATUS</span>
          {statusList.map(({ key, ...def }) => {
            const cur = tokenStatuses(tok.status);
            const on = cur.find((s) => s.key === key);
            const write = (next) => g.boardUpsertToken({ id: tok.id, status: next.map((s) => (s.count ? `${s.key}:${s.count}` : s.key)) });
            const toggle = () => write(on ? cur.filter((s) => s.key !== key) : [...cur, { key, count: null }]);
            if (key === 'stress' && on) {
              const set = (n) => write(n <= 0 ? cur.filter((s) => s.key !== key) : cur.map((s) => (s.key === key ? { ...s, count: Math.min(10, n) } : s)));
              return (
                <span key={key} className="mc-seg">
                  <button onClick={() => set((on.count || 1) - 1)} aria-label="Less stress">−</button>
                  <span className="mc-seg-val" style={{ color: def.color }}>STRESS {on.count || 1}</span>
                  <button onClick={() => set((on.count || 1) + 1)} aria-label="More stress">+</button>
                </span>
              );
            }
            return (
              <button key={key} className={`mc-btn mc-status${on ? ' on' : ''}`} aria-pressed={!!on} onClick={toggle}
                style={on ? { borderColor: def.color, color: def.color, background: `color-mix(in srgb, ${def.color} 12%, transparent)` } : undefined}>
                {def.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="mc-sheet-row">
        <textarea className="mc-input mc-grow" key={`n-${tok.id}`} rows={2} defaultValue={tok.note || ''} placeholder="GM note (never shown on the board)"
          onBlur={(e) => e.target.value !== (tok.note || '') && g.boardUpsertToken({ id: tok.id, note: e.target.value })} />
      </div>
      <div className="mc-sheet-row">
        {tok.kind === 'item' && crewPlayers.length > 0 && (
          <select className="mc-select" value="" onChange={(e) => e.target.value && sendToPlayer(e.target.value)} aria-label="Send to player">
            <option value="">SEND TO {universe.terms.player.toUpperCase()}…</option>
            {crewPlayers.map((p) => <option key={p.id} value={p.id}>{p.character.name} ({p.name})</option>)}
          </select>
        )}
        <span className="mc-spacer" />
        <button className="mc-btn danger" onClick={() => { g.boardRemoveToken(tok.id); setSelTok(null); }}>REMOVE</button>
      </div>
    </div>
  );

  /* ─── Room sheet ─── */
  const roomSheet = !tok && roomDef && (
    <div className="mc-sheet" role="dialog" aria-label="Room">
      <div className="mc-sheet-head">
        <span className="mc-kind">ROOM</span>
        <input className="mc-input mc-grow" key={`rn-${roomDef.id}`} defaultValue={roomSt.name || roomDef.name} aria-label="Room name"
          onBlur={(e) => e.target.value !== (roomSt.name || roomDef.name) && g.boardSetRoom(roomDef.id, { name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <button className="mc-btn" onClick={() => setSelRoom(null)}>CLOSE</button>
      </div>
      <div className="mc-sheet-row">
        <button className={`mc-btn${roomSt.revealed ? ' on' : ''}`} onClick={() => g.boardSetRoom(roomDef.id, { revealed: !roomSt.revealed })}>
          {roomSt.revealed ? 'REVEALED — CONCEAL' : 'FOGGED — REVEAL'}
        </button>
        <button className="mc-btn" onClick={() => g.boardSetRoom(roomDef.id, { hideTokens: true })}>ALL TOKENS HERE → HIDDEN</button>
        {roomSt.entered && <span className="mc-meta">ENTERED BY CREW</span>}
      </div>
      {roomDef.note && <p className="mc-note">{roomDef.note}</p>}
      <div className="mc-sheet-row">
        <textarea className="mc-input mc-grow" key={`rnote-${roomDef.id}`} rows={2} defaultValue={roomSt.note || ''} placeholder="Session note for this room"
          onBlur={(e) => e.target.value !== (roomSt.note || '') && g.boardSetRoom(roomDef.id, { note: e.target.value })} />
      </div>
    </div>
  );

  /* ─── Room list (palette ROOMS tab; compact REVEAL panel) ─── */
  const roomList = (
    <>
      {rooms.length === 0 && <p className="mc-hint">{mapDef ? 'This map has no room shapes yet.' : 'No map selected.'}{mapDef && currentOpt?.packId ? ' Use EDIT ROOMS (Board) to draw them.' : ''}</p>}
      {rooms.length > 0 && (
        <div className="mc-row-btns">
          <button className="mc-btn" onClick={() => rooms.forEach((r) => !board.rooms[r.id]?.revealed && g.boardSetRoom(r.id, { revealed: true }))}>REVEAL ALL</button>
          <button className="mc-btn" onClick={() => rooms.forEach((r) => board.rooms[r.id]?.revealed && g.boardSetRoom(r.id, { revealed: false }))}>CONCEAL ALL</button>
        </div>
      )}
      {rooms.map((r) => {
        const st = board.rooms[r.id] || {};
        const count = Object.values(board.tokens).filter((t) => t.roomId === r.id).length;
        return (
          <div key={r.id} className={`mc-room${st.revealed ? ' on' : ''}${selRoom === r.id ? ' sel' : ''}`}>
            <button className="mc-room-name" onClick={() => { setSelRoom(r.id); setSelTok(null); }}>
              {st.name || r.name}{count ? <small> · {count} TOKEN{count > 1 ? 'S' : ''}</small> : null}
            </button>
            <button className={`mc-toggle${st.revealed ? ' on' : ''}`} onClick={() => g.boardSetRoom(r.id, { revealed: !st.revealed })} aria-pressed={!!st.revealed}
              aria-label={`${st.name || r.name}: ${st.revealed ? 'revealed — tap to fog' : 'fogged — tap to reveal'}`}>
              {st.revealed ? 'SEEN' : 'FOG'}
            </button>
          </div>
        );
      })}
    </>
  );

  /* ─── Palette body (tabs, filter, items) ─── */
  const paletteTabs = compact ? [['crew', universe.terms.players.toUpperCase()], ['threats', 'THREATS'], ['npcs', 'NPCS'], ['items', 'ITEMS'], ['markers', 'MARKERS']]
    : [['crew', 'CREW'], ['threats', 'THREATS'], ['npcs', 'NPCS'], ['items', 'ITEMS'], ['markers', 'MARKERS'], ['rooms', 'ROOMS']];
  const paletteBody = (
    <>
      <div className="mc-tabs" role="tablist">
        {paletteTabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setQuery(''); }}>
            {label}
          </button>
        ))}
      </div>
      {tab !== 'rooms' && tab !== 'markers' && tab !== 'crew' && (
        <input className="mc-input mc-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter…" aria-label="Filter palette" />
      )}
      {tab === 'items' && (
        <form className="mc-custom" onSubmit={(e) => {
          e.preventDefault();
          if (!custom.trim()) return;
          setArmed({ key: `custom-${custom}`, label: custom.trim(), sub: 'ITEM', token: { kind: 'item', label: custom.trim(), glyph: 'crate', color: '#9ccc65' } });
          setCustom('');
        }}>
          <input className="mc-input mc-grow" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom item label" aria-label="Custom item label" />
          <button className="mc-btn" type="submit">ARM</button>
        </form>
      )}
      <div className="mc-pal-list">
        {tab === 'rooms' ? roomList : (
          <>
            {list.length === 0 && (
              <p className="mc-hint">
                {tab === 'crew' ? `No ${universe.terms.players.toLowerCase()} with characters yet.` : tab === 'npcs' ? 'The active scenario has no NPCs.' : 'Nothing here.'}
              </p>
            )}
            {list.map((it) => (
              <div key={it.key} className={`mc-pal-item${armed?.key === it.key ? ' armed' : ''}${it.onMap ? ' placed' : ''}`}
                onPointerDown={(e) => onItemPointerDown(e, it)} role="button" tabIndex={0} aria-pressed={armed?.key === it.key}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setArmed(it); } }}>
                <PaletteIcon item={it} />
                <span className="mc-pal-text"><b>{it.label}</b><small>{it.sub}</small></span>
                {it.onMap && <span className="mc-pal-badge">ON MAP</span>}
              </div>
            ))}
          </>
        )}
      </div>
      <p className="mc-hint mc-pal-foot">Drag onto the map, or tap to arm and tap the map.</p>
    </>
  );

  const canvas = (
    <div className={`mc-canvas-wrap${pingMode ? ' mode-ping' : armed ? ' mode-place' : ''}`}>
      {mapDef ? (
        <MapCanvas ref={canvasRef} className="mc-canvas" mapDef={mapDef} board={board} role="dm" universe={universe}
          view={canvasView} editable selectedTokenId={selTok} selectedRoomId={selRoom} pings={g.pings} snap={snap}
          showRoomLabels={mapDef.kind === 'image'} onTap={onTap} onTokenTap={onTokenTap} onTokenMove={onTokenMove}
          showHp activeTokenId={g.table?.initiative?.active ? g.table.initiative.order?.[g.table.initiative.turn]?.tokenId : null} />
      ) : (
        <div className="mc-empty">
          <h3>NO MAP ON THE BOARD</h3>
          <p>Pick a map for the table screen.</p>
          <div className="mc-empty-list">
            {options.slice(0, compact ? 6 : 8).map((o) => (
              <button key={o.mapId} className="mc-btn" onClick={() => chooseMap(o.mapId)}>{o.title}</button>
            ))}
          </div>
        </div>
      )}
      <div className="mc-hud">
        {mapDef && !compact && <span>{(mapDef.title || '').toUpperCase()}{level ? ` · ${(levels.find((l) => l.id === level)?.label || level).toUpperCase()}` : ''}</span>}
        {mapDef && rooms.length > 0 && <span>{revealedCount}/{rooms.length} {compact ? 'REVEALED' : 'ROOMS REVEALED'}</span>}
        {!compact && (view.rotation || view.flipX || (view.zoom && view.zoom !== 1)) ? <span>TV: {view.rotation || 0}°{view.flipX ? ' FLIP' : ''}{view.zoom && view.zoom !== 1 ? ` ×${view.zoom}` : ''}</span> : null}
        {armed && <span className="mc-hud-mode">TAP MAP TO PLACE: {armed.label.toUpperCase()} <button onClick={() => setArmed(null)}>CANCEL</button></span>}
        {pingMode && <span className="mc-hud-mode warn">PING MODE — TAP THE MAP</span>}
        {status && <span className="mc-hud-status">{status}</span>}
      </div>
      {!compact && tokenSheet}
      {!compact && roomSheet}
    </div>
  );

  const mapSelect = (
    <select className="mc-select" value={board.mapId || ''} onChange={(e) => chooseMap(e.target.value)} aria-label="Map">
      <option value="" disabled>SELECT MAP…</option>
      {groups.map((grp) => (
        <optgroup key={grp.name} label={grp.name.toUpperCase()}>
          {grp.items.map((o) => <option key={o.mapId} value={o.mapId}>{o.title}</option>)}
        </optgroup>
      ))}
    </select>
  );
  const levelSeg = levels.length > 1 && (
    <div className="mc-seg" role="group" aria-label="Level">
      {levels.map((l) => (
        <button key={l.id} className={l.id === level ? 'on' : ''} aria-pressed={l.id === level} onClick={() => chooseLevel(l.id)} title={l.label}>
          {l.label.split(/\s+[—·-]\s+/)[0]}
        </button>
      ))}
    </div>
  );
  const ghostEl = ghost && (
    <div className="mc-ghost" style={{ left: ghost.x, top: ghost.y }}>
      <PaletteIcon item={ghost.item} /><span>{ghost.item.label}</span>
    </div>
  );

  /* ═══ Compact (Run → MAP drawer): canvas + FOG / REVEAL / PING / + TOKEN / OPEN FULL BOARD ═══ */
  if (compact) {
    return (
      <div className="mc-root mc-compact" ref={rootRef}>
        <div className="mc-ctop">
          {mapSelect}
          {levelSeg}
        </div>
        <div className="mc-cbtns">
          <button className={`mc-btn${board.fog ? ' on' : ''}`} aria-pressed={!!board.fog} onClick={() => g.boardSetFog(!board.fog)} disabled={!mapDef}>FOG {board.fog ? 'ON' : 'OFF'}</button>
          <button className={`mc-btn${cPanel === 'rooms' ? ' on' : ''}`} aria-expanded={cPanel === 'rooms'} onClick={() => setCPanel((p) => (p === 'rooms' ? null : 'rooms'))} disabled={!mapDef}>REVEAL</button>
          <button className={`mc-btn${pingMode ? ' on warn' : ''}`} aria-pressed={pingMode} onClick={() => { setPingMode((v) => !v); setArmed(null); }} disabled={!mapDef}>PING</button>
          <button className={`mc-btn${cPanel === 'token' ? ' on' : ''}`} aria-expanded={cPanel === 'token'} onClick={() => setCPanel((p) => (p === 'token' ? null : 'token'))} disabled={!mapDef}>+ TOKEN</button>
        </div>
        {canvas}
        {tokenSheet}
        {roomSheet}
        {cPanel === 'rooms' && <div className="mc-cpanel" aria-label="Rooms">{roomList}</div>}
        {cPanel === 'token' && <div className="mc-cpanel mc-palette" aria-label="Tokens">{paletteBody}</div>}
        <button type="button" className="fs-btn primary mc-openfull" onClick={onOpenFull}>OPEN FULL BOARD ▸</button>
        {ghostEl}
      </div>
    );
  }

  return (
    <div className="mc-root" ref={rootRef} style={rootH ? { height: rootH } : undefined}>
      {/* ─── Top bar ─── */}
      <div className="mc-top">
        {mapSelect}
        {levelSeg}
        <button className={`mc-btn${board.fog ? ' on' : ''}`} aria-pressed={!!board.fog} onClick={() => g.boardSetFog(!board.fog)} disabled={!mapDef}>FOG {board.fog ? 'ON' : 'OFF'}</button>
        <button className="mc-btn" onClick={rotate} disabled={!mapDef} title="Rotate the TV view"><span className="mc-wide">ROTATE </span>{view.rotation || 0}°</button>
        <button className={`mc-btn${view.flipX ? ' on' : ''}`} aria-pressed={!!view.flipX} onClick={flip} disabled={!mapDef}>FLIP</button>
        <button className="mc-btn" onClick={fit} disabled={!mapDef}>FIT</button>
        <span className="mc-seg">
          <button onClick={() => zoomBy(1 / 1.25)} disabled={!mapDef} aria-label="Zoom out">−</button>
          <button onClick={() => zoomBy(1.25)} disabled={!mapDef} aria-label="Zoom in">+</button>
        </span>
        <button className={`mc-btn${pingMode ? ' on warn' : ''}`} aria-pressed={pingMode} onClick={() => { setPingMode((v) => !v); setArmed(null); }} disabled={!mapDef}>PING</button>
        <button className={`mc-btn${snap ? ' on' : ''}`} aria-pressed={snap} onClick={() => setSnap((v) => !v)}>SNAP</button>
        <button className={`mc-btn${matchTv ? ' on' : ''}`} aria-pressed={matchTv} onClick={() => setMatchTv((v) => !v)} title="Show this map in the TV orientation">AS TV</button>
        {mapDef && currentOpt?.packId && (
          <button className="mc-btn" onClick={() => setEditRooms(true)} title="Correct the room shapes used for fog of war">EDIT ROOMS</button>
        )}
        <button className="mc-btn danger" onClick={reset} disabled={!mapDef}>RESET</button>
        <span className="mc-spacer" />
        <button className="mc-btn primary" onClick={() => setShowLink(true)}>OPEN BOARD</button>
        <span className={`mc-tv${g.boardLinked ? ' up' : ''}`} title={g.boardLinked ? `${g.boardLinked} board screen(s) attached` : 'No board screen attached'}>
          <span className="link-dot" />{g.boardLinked ? 'TV LINKED' : 'NO TV'}
        </span>
      </div>

      <div className={`mc-main${paletteOpen ? '' : ' mc-collapsed'}`}>
        {canvas}

        {/* ─── Palette ─── */}
        <aside className="mc-palette">
          <button className="mc-pal-toggle" onClick={() => setPaletteOpen((v) => !v)} aria-expanded={paletteOpen}>
            {paletteOpen ? 'HIDE PALETTE' : 'PALETTE'}
          </button>
          {paletteOpen && paletteBody}
        </aside>
      </div>

      {ghostEl}

      {/* ─── OPEN BOARD ─── */}
      {showLink && (
        <div className="mc-modal" onClick={() => setShowLink(false)}>
          <div className="mc-modal-box" role="dialog" aria-label="Table board link" onClick={(e) => e.stopPropagation()}>
            <h3>TABLE BOARD</h3>
            <p className="mc-hint">Open this on the TV browser (or scan the code with it):</p>
            <div className="mc-url">{boardUrl}</div>
            <QrBox text={boardUrl} />
            {localHost && <p className="mc-warn">This tablet is on localhost — the TV needs this machine's LAN address instead (e.g. http://192.168.x.x:{window.location.port || '80'}/?board={g.gameCode}).</p>}
            <div className="mc-row-btns">
              <a className="mc-btn" href={`/?board=${g.gameCode}`} target="_blank" rel="noreferrer">OPEN HERE</a>
              <button className="mc-btn" onClick={() => navigator.clipboard?.writeText(boardUrl)}>COPY LINK</button>
              <button className="mc-btn primary" onClick={() => setShowLink(false)}>DONE</button>
            </div>
          </div>
        </div>
      )}

      {editRooms && mapDef && currentOpt && (
        <RoomEditor option={currentOpt} mapDef={mapDef} level={level} universe={universe}
          onClose={() => setEditRooms(false)}
          onSaved={(rooms2) => {
            const def = { ...mapDef, rooms: rooms2.filter((r) => r.shape) };
            g.boardSetMap(board.mapId, level, def);
            setEditRooms(false);
            setStatus('ROOMS SAVED');
          }} />
      )}
    </div>
  );
}
