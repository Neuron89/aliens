import React, { useEffect, useState } from 'react';
import { useGame } from '../../GameContext';
import { useUniverse } from '../../UniverseContext';
import MapCanvas from './MapCanvas';

/* Player MAP tab: the board as the server filters it for players
   (revealed rooms, PCs, visible tokens), own token highlighted,
   tap anywhere to ping (server rate-limits to 1/s). Read-only. */
const PHONE_VIEW = { rotation: 0, flipX: false, zoom: 1, pan: [0, 0] };

export default function PlayerMapPane() {
  const { board, mapDef, pings, boardPing, myPlayer } = useGame();
  const { universe } = useUniverse();
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), 1500);
    return () => clearTimeout(t);
  }, [note]);

  if (!board?.mapId || !mapDef) {
    return (
      <div className="pv-pane">
        <section className="panel"><p className="pv-text dim">No map on the table yet.</p></section>
      </div>
    );
  }

  const ping = (pt) => boardPing(pt.x, pt.y, (r) => setNote(r?.error ? 'WAIT…' : 'PING SENT'));
  const level = mapDef.levels?.find((l) => l.id === board.level);

  return (
    <div className="pv-map">
      <div className="pv-map-head">
        <span>{mapDef.title}{level ? ` · ${level.label}` : ''}</span>
        <span className="pv-map-hint">{note || 'TAP TO PING'}</span>
      </div>
      <MapCanvas className="pv-map-canvas" mapDef={mapDef} board={board} role="player" universe={universe}
        view={PHONE_VIEW} pings={pings} highlightPlayerId={myPlayer?.id}
        onTap={(pt) => ping(pt)} onTokenTap={(_id, pt) => ping(pt)} />
    </div>
  );
}
