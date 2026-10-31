import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import MapCanvas from '../board/MapCanvas';
import Icon from './icons';

/* ═══════════════════════════════════════════════════════════════
   TABLE tab: the board from this player's point of view.
   Data: the player-filtered `board-state` (server/board.js viewFor:
   no hidden tokens, nothing in unrevealed rooms, no GM notes) plus the
   public mapDef. Shows: YOU ARE IN <room>, the map with fog exactly as
   the TV shows it (NEAR ME = zoomed on your own token, WHOLE MAP), your
   token highlighted and your room outlined, what is visible in your
   room (item / marker / hazard tokens) and who is with you (other PCs,
   NPCs, creatures). Tap the map to ping (server rate-limits 1/s).
   TAKE sends the GM a private message ("I take the …"); the GM decides.
   ═══════════════════════════════════════════════════════════════ */
const THINGS = new Set(['item', 'marker', 'hazard']);
const BEINGS = new Set(['pc', 'npc', 'creature']);
const KIND_GLYPH = { item: '◆', marker: '◎', hazard: '⚠', npc: '●', creature: '✖', pc: '●' };
const NEAR_ZOOM = 2.4;
const WHOLE = { rotation: 0, flipX: false, zoom: 1, pan: [0, 0] };

function nearView(mapDef, tok) {
  const crop = mapDef?.crop || { x: 0, y: 0, w: 1, h: 1 };
  const lim = (1 - 1 / NEAR_ZOOM) / 2;
  const c = (v) => Math.max(-lim, Math.min(lim, v));
  return {
    rotation: 0, flipX: false, zoom: NEAR_ZOOM,
    pan: [c((tok.x - crop.x - crop.w / 2) / crop.w), c((tok.y - crop.y - crop.h / 2) / crop.h)],
  };
}

function Thing({ t, onAsk, asked, gmShort }) {
  const glyph = t.glyph || KIND_GLYPH[t.kind] || '◆';
  const fallback = t.kind === 'hazard' ? 'Hazard' : t.kind === 'marker' ? 'Marker' : 'Item';
  const sub = t.sub || (t.kind === 'hazard' ? 'Danger in this room' : t.kind === 'marker' ? 'Point of interest' : 'Visible here');
  return (
    <li className={`pp-thing k-${t.kind}`}>
      <span className="pp-thing-ico" aria-hidden="true">
        {t.icon ? <img src={t.icon} alt="" /> : <span>{glyph}</span>}
      </span>
      <span className="pp-thing-body">
        <b>{t.label || fallback}</b>
        <small>{sub}</small>
      </span>
      {t.kind === 'item' && (
        <button type="button" className="pp-btn pp-btn-sm" disabled={asked}
          aria-label={`Ask the ${gmShort} to take ${t.label || 'this item'}`} onClick={() => onAsk(t)}>
          {asked ? 'ASKED' : 'TAKE'}
        </button>
      )}
    </li>
  );
}

export default function TablePane() {
  const { board, mapDef, pings, boardPing, myPlayer, sendPlayerMessage, connected } = useGame();
  const { universe } = useUniverse();
  const { terms } = universe;
  const gmShort = terms.gmShort || terms.gm;
  const [note, setNote] = useState(null);
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('muthur.tableView') || 'near'; } catch { return 'near'; } });
  const [asked, setAsked] = useState({});
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
  const ask = (t) => {
    sendPlayerMessage(`I take the ${t.label || 'item'}${roomName ? ` in ${roomName}` : ''}.`);
    setAsked((a) => ({ ...a, [t.id]: true }));
    setNote(`ASKED THE ${String(gmShort).toUpperCase()}`);
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

      {me && (
        <>
          <section className="pp-sec" aria-labelledby="pp-here-h">
            <h3 id="pp-here-h" className="pp-k">VISIBLE HERE</h3>
            {things.length === 0
              ? <p className="pp-dim">Nothing marked in this room.</p>
              : <ul className="pp-things">{things.map((t) => <Thing key={t.id} t={t} asked={!!asked[t.id]} onAsk={ask} gmShort={gmShort} />)}</ul>}
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
