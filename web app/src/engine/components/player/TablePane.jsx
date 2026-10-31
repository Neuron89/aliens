import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import MapCanvas from '../board/MapCanvas';
import Icon from './icons';
import { Glyph } from '../board/TokenChip';

/* ═══════════════════════════════════════════════════════════════
   TABLE tab: the board from this player's point of view.
   Data: the player-filtered `board-state` (server/board.js viewFor:
   no hidden tokens, nothing in unrevealed rooms, no GM notes) plus the
   public mapDef. Shows: YOU ARE IN <room>, the map with fog exactly as
   the TV shows it (NEAR ME = zoomed on your own token, WHOLE MAP), your
   token highlighted and your room outlined, what is visible in your
   room (item / marker / hazard tokens) and who is with you (other PCs,
   NPCs, creatures). Tap the map to ping (server rate-limits 1/s).
   TAKE picks an item up (`token-take`: the server checks same room,
   kind 'item', not locked; the item goes into your gear and vanishes
   from the TV; the GM can undo it). A locked item ("ask the GM")
   shows ASK instead, which sends the GM a private message.
   EXITS (AI GM wave 2, docs/AI_GM.md "Room entry"): the doors from your
   room (mapDef.doors, both directions) — unlocked → ENTER <ROOM>
   (`player-enter-room`; the server re-checks adjacency, locks and a 1 per
   2 s rate limit), locked → greyed LOCKED; rooms the GM flagged open
   (board.rooms[id].open) are enterable too. Off every room: ENTER the room
   that holds the map spawn. The GM's narration of what you find arrives
   through the normal caption path, not here.
   ═══════════════════════════════════════════════════════════════ */
const THINGS = new Set(['item', 'marker', 'hazard']);
const BEINGS = new Set(['pc', 'npc', 'creature']);
const KIND_GLYPH = { item: '◆', marker: '◎', hazard: '⚠', npc: '●', creature: '✖', pc: '●' };
const NEAR_ZOOM = 2.4;
const WHOLE = { rotation: 0, flipX: false, zoom: 1, pan: [0, 0] };
const ENTER_STUCK_MS = 6000;

/* Same hit-test as server/board.js pointInShape / roomAt (smallest containing room on the level). */
function inShape(s, x, y) {
  if (!s) return false;
  if (s.type === 'rect') return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
  let inside = false;
  const pts = s.points || [];
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function area(s) {
  if (s?.type === 'rect') return s.w * s.h;
  let a = 0;
  const pts = s?.points || [];
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return Math.abs(a / 2);
}
function roomAtPoint(mapDef, x, y, level) {
  let best = null;
  let bestArea = Infinity;
  for (const r of mapDef?.rooms || []) {
    if (level && r.level && r.level !== level) continue;
    if (!inShape(r.shape, x, y)) continue;
    const a = area(r.shape);
    if (a < bestArea) { best = r; bestArea = a; }
  }
  return best;
}

/** [{ id, name, locked }] the player could walk into from `me` (server: player-enter-room). */
function exitsFor(mapDef, board, me) {
  if (!me || !mapDef) return [];
  const level = me.level || mapDef.levels?.[0]?.id || null;
  const rooms = new Map((mapDef.rooms || []).filter((r) => !level || !r.level || r.level === level).map((r) => [r.id, r]));
  const nameOf = (r) => board?.rooms?.[r.id]?.name || r.name || r.id;
  const out = new Map();
  const add = (id, locked) => {
    const r = rooms.get(id);
    if (!r || id === me.roomId) return;
    const prev = out.get(id);
    // one unlocked door is enough to get in
    out.set(id, { id, name: nameOf(r), locked: prev ? prev.locked && locked : locked });
  };
  if (me.roomId) {
    for (const d of mapDef.doors || []) {
      if (d.from === me.roomId) add(d.to, !!d.locked);
      else if (d.to === me.roomId) add(d.from, !!d.locked);
    }
  } else {
    const sp = mapDef.spawn?.levels?.[level]?.pc || mapDef.spawn?.pc || [0.5, 0.5];
    const r = roomAtPoint(mapDef, sp[0], sp[1], level);
    if (r) add(r.id, false);
  }
  for (const [id, r] of Object.entries(board?.rooms || {})) if (r?.open && rooms.has(id)) add(id, false);
  return [...out.values()].sort((a, b) => Number(a.locked) - Number(b.locked));
}

function nearView(mapDef, tok) {
  const crop = mapDef?.crop || { x: 0, y: 0, w: 1, h: 1 };
  const lim = (1 - 1 / NEAR_ZOOM) / 2;
  const c = (v) => Math.max(-lim, Math.min(lim, v));
  return {
    rotation: 0, flipX: false, zoom: NEAR_ZOOM,
    pan: [c((tok.x - crop.x - crop.w / 2) / crop.w), c((tok.y - crop.y - crop.h / 2) / crop.h)],
  };
}

function Thing({ t, onTake, state, gmShort, offline }) {
  // token.glyph is a TokenChip glyph name ('crate', 'claw', …): draw the same SVG glyph the map uses
  // (it used to print the name, so a GM-placed item read "crate").
  const fallback = t.kind === 'hazard' ? 'Hazard' : t.kind === 'marker' ? 'Marker' : 'Item';
  const sub = t.sub || (t.kind === 'hazard' ? 'Danger in this room' : t.kind === 'marker' ? 'Point of interest' : 'Visible here');
  return (
    <li className={`pp-thing k-${t.kind}`}>
      <span className="pp-thing-ico" aria-hidden="true">
        {t.icon ? <img src={t.icon} alt="" />
          : t.glyph ? <svg viewBox="-12 -12 24 24" width="100%" height="100%"><Glyph name={t.glyph} r={9} color="currentColor" /></svg>
            : <span>{KIND_GLYPH[t.kind] || '◆'}</span>}
      </span>
      <span className="pp-thing-body">
        <b>{t.label || fallback}</b>
        <small>{sub}</small>
      </span>
      {t.kind === 'item' && (
        <button type="button" className={`pp-btn pp-btn-sm${t.locked ? '' : ' primary'}`} disabled={!!state || offline}
          aria-label={t.locked ? `Ask the ${gmShort} for ${t.label || 'this item'}` : `Take ${t.label || 'this item'}`} onClick={() => onTake(t)}>
          {state === 'asked' ? 'ASKED' : state === 'taking' ? '…' : t.locked ? 'ASK' : 'TAKE'}
        </button>
      )}
    </li>
  );
}

export default function TablePane() {
  const { board, mapDef, pings, boardPing, myPlayer, sendPlayerMessage, tokenTake, connected, playerEnterRoom, table } = useGame();
  const { universe } = useUniverse();
  const { terms } = universe;
  const gmShort = terms.gmShort || terms.gm;
  const [note, setNote] = useState(null);
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('muthur.tableView') || 'near'; } catch { return 'near'; } });
  const [taking, setTaking] = useState({}); // tokenId -> 'taking' | 'asked'
  const [entering, setEntering] = useState(null); // roomId while player-enter-room is in flight
  const [entered, setEntered] = useState(null);   // { text, error? } — YOU ENTER <ROOM> / refusal, a few seconds
  const enterTimer = useRef(null);
  useEffect(() => () => clearTimeout(enterTimer.current), []);
  useEffect(() => {
    if (!entered) return undefined;
    const t = setTimeout(() => setEntered(null), 4000);
    return () => clearTimeout(t);
  }, [entered]);
  useEffect(() => { try { localStorage.setItem('muthur.tableView', mode); } catch { /* ignore */ } }, [mode]);
  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), 1800);
    return () => clearTimeout(t);
  }, [note]);

  const myId = myPlayer?.id;
  const tokens = useMemo(() => Object.values(board?.tokens || {}), [board]);
  if (!board?.mapId || !mapDef) {
    return (
      <div className="pp-pane">
        <div className="pp-empty">
          <Icon name="table" size={40} />
          <p>No map on the table yet.</p>
          <small>When the {terms.gm} puts one up you will see where you are, what is in the room and who is with you.</small>
        </div>
      </div>
    );
  }

  const me = tokens.find((t) => t.kind === 'pc' && t.ownerPlayerId === myId) || null;
  const level = board.level || mapDef.levels?.[0]?.id || null;
  const myLevel = me?.level || level;
  const onShownLevel = !me || !level || !me.level || me.level === level;
  const roomDef = me?.roomId ? (mapDef.rooms || []).find((r) => r.id === me.roomId) : null;
  const roomName = (me?.roomId && (board.rooms?.[me.roomId]?.name || roomDef?.name)) || null;
  const here = me?.roomId
    ? tokens.filter((t) => t.id !== me.id && t.roomId === me.roomId && (t.level || myLevel) === myLevel)
    : [];
  const things = here.filter((t) => THINGS.has(t.kind))
    .sort((a, b) => Number(b.kind === 'hazard') - Number(a.kind === 'hazard'));
  const beings = here.filter((t) => BEINGS.has(t.kind));
  const levelLabel = (id) => mapDef.levels?.find((l) => l.id === id)?.label || id;
  const near = mode === 'near' && !!me && onShownLevel;
  const view = near ? nearView(mapDef, me) : WHOLE;

  const ping = (pt) => boardPing(pt.x, pt.y, (r) => setNote(r?.error ? 'WAIT…' : 'PING SENT'));
  const askGm = (t) => {
    sendPlayerMessage(`I take the ${t.label || 'item'}${roomName ? ` in ${roomName}` : ''}.`);
    setTaking((a) => ({ ...a, [t.id]: 'asked' }));
    setNote(`ASKED THE ${String(gmShort).toUpperCase()}`);
  };
  /* Pick up: token-take; a locked item (or a server that refuses with ASK THE GM) falls back to a message. */
  const take = (t) => {
    if (t.locked || !tokenTake) { askGm(t); return; }
    setTaking((a) => ({ ...a, [t.id]: 'taking' }));
    const clear = () => setTaking((a) => { if (a[t.id] !== 'taking') return a; const n = { ...a }; delete n[t.id]; return n; });
    const stuck = setTimeout(clear, 6000); // no ack (link dropped mid-request): let them try again
    tokenTake(t.id, (r) => {
      clearTimeout(stuck);
      if (r?.success) { setNote(`${String(r.item || t.label || 'ITEM').toUpperCase()} → YOUR GEAR`); return; }
      setTaking((a) => { const n = { ...a }; delete n[t.id]; return n; });
      if (r?.error === 'ASK THE GM.') { askGm(t); return; }
      setNote(r?.error || 'NOT TAKEN');
    });
  };

  const exits = exitsFor(mapDef, board, me);
  const aiEntry = table?.aiGm?.entry;
  const enter = (x) => {
    if (!playerEnterRoom || entering || x.locked) return;
    setEntering(x.id); setEntered(null);
    clearTimeout(enterTimer.current);
    enterTimer.current = setTimeout(() => { setEntering(null); setEntered({ text: 'NO ANSWER — TRY AGAIN', error: true }); }, ENTER_STUCK_MS);
    playerEnterRoom(x.id, (r) => {
      clearTimeout(enterTimer.current);
      setEntering(null);
      if (r?.success) setEntered({ text: `YOU ENTER ${String(r.name || x.name).toUpperCase()}` });
      else setEntered({ text: r?.error === 'RATE LIMITED.' ? 'WAIT A MOMENT…' : String(r?.error || 'YOU CANNOT GO THAT WAY.').toUpperCase(), error: true });
    });
  };

  return (
    <div className="pp-pane pp-table">
      <div className="pp-where">
        <span className="pp-k">{me ? 'YOU ARE IN' : 'YOUR POSITION'}</span>
        <span className="pp-where-room">{!me ? 'NOT ON THE MAP YET' : roomName || 'OPEN GROUND'}</span>
      </div>
      {me && !onShownLevel && (
        <p className="pp-note" role="status">
          YOU ARE ON {String(levelLabel(me.level)).toUpperCase()} · THE TABLE IS SHOWING {String(levelLabel(level)).toUpperCase()}
        </p>
      )}

      <div className="pp-mapbox">
        <div className="pp-maphead">
          <span className="pp-maptitle">{mapDef.title}{mapDef.levels?.length > 1 && level ? ` · ${levelLabel(level)}` : ''}</span>
          <div className="pp-seg2" role="group" aria-label="Map view">
            <button type="button" aria-pressed={near} disabled={!me || !onShownLevel} onClick={() => setMode('near')}>NEAR ME</button>
            <button type="button" aria-pressed={!near} onClick={() => setMode('whole')}>WHOLE MAP</button>
          </div>
        </div>
        <MapCanvas className="pp-map-canvas" mapDef={mapDef} board={board} role="player" universe={universe}
          view={view} pings={pings} highlightPlayerId={myId} selectedRoomId={onShownLevel ? me?.roomId || null : null}
          onTap={(pt) => ping(pt)} onTokenTap={(_id, pt) => ping(pt)} idleDrift={false} />
        <div className="pp-mapfoot" aria-live="polite">{note || 'TAP THE MAP TO PING THE TABLE'}{!connected ? ' · OFFLINE' : ''}</div>
      </div>

      {me && (exits.length > 0 || entered) && (
        <section className="pp-sec pp-exits" aria-labelledby="pp-exits-h">
          <h3 id="pp-exits-h" className="pp-k">EXITS</h3>
          {entered && <p className={`pp-entered${entered.error ? ' err' : ''}`} role="status">{entered.text}</p>}
          {exits.length > 0 && (
            <ul className="pp-exit-list">
              {exits.map((x) => (
                <li key={x.id}>
                  <button type="button" className={`pp-btn pp-exit${x.locked ? ' locked' : ' primary'}`}
                    disabled={x.locked || !!entering || !connected || !playerEnterRoom}
                    aria-label={x.locked ? `${x.name}: the door is locked` : `Enter ${x.name}`}
                    onClick={() => enter(x)}>
                    <span className="pp-exit-verb">{x.locked ? 'LOCKED' : entering === x.id ? 'ENTERING…' : 'ENTER'}</span>
                    <span className="pp-exit-room">{x.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(aiEntry === 'review' || aiEntry === 'live') && <p className="pp-dim pp-exit-ai">The {gmShort}&apos;s AI reacts when you enter.</p>}
        </section>
      )}

      {me && (
        <>
          <section className="pp-sec" aria-labelledby="pp-here-h">
            <h3 id="pp-here-h" className="pp-k">VISIBLE HERE</h3>
            {things.length === 0
              ? <p className="pp-dim">Nothing marked in this room.</p>
              : <ul className="pp-things">{things.map((t) => <Thing key={t.id} t={t} state={taking[t.id] || null} onTake={take} gmShort={gmShort} offline={!connected} />)}</ul>}
          </section>
          <section className="pp-sec" aria-labelledby="pp-with-h">
            <h3 id="pp-with-h" className="pp-k">WITH YOU</h3>
            {beings.length === 0
              ? <p className="pp-dim">Nobody else is here.</p>
              : (
                <ul className="pp-with">
                  {beings.map((t) => {
                    const panicking = (t.status || []).some((s) => s.startsWith('panicking'));
                    const danger = t.kind === 'creature' || panicking;
                    return (
                      <li key={t.id} className={`pp-chip${danger ? ' danger' : ''}${t.kind === 'npc' ? ' npc' : ''}`}
                        style={t.kind === 'pc' && t.color ? { '--chip': t.color } : undefined}>
                        {t.kind === 'pc' && <i className="pp-chip-dot" aria-hidden="true" />}
                        <span>{t.label || t.kind.toUpperCase()}</span>
                        {t.kind === 'npc' && <small>NPC</small>}
                        {t.kind === 'creature' && <small>THREAT</small>}
                        {panicking && <small>PANICKING</small>}
                      </li>
                    );
                  })}
                </ul>
              )}
          </section>
        </>
      )}
    </div>
  );
}
