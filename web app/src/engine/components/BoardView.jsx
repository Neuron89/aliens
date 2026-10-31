import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame, boardCodeForTab, leaveBoard } from '../GameContext';
import { useUniverse } from '../UniverseContext';
import MapCanvas from './board/MapCanvas';
import Overlays from './board/Overlays';
import BoardAudio from './board/BoardAudio';
import { qrPath } from './board/qr';
import { mapVisuals } from './board/mapDefs';
import { reducedFx } from '../sfx';
import {
  normalizeCamera, edgeStyle, revealedSet, newlyRevealed, unionBox, roomBox, pointBox, tokenFocusBox, chooseShot,
  boxToLocal, frameLocal, contentLocal, restingCamera, levelRooms, shapeBox, scaleBox, spotPath, roundRect, lerpCam, lerpBox, ease,
  camClose, boxClose, camCss, IDENTITY, EASE_MS, SPOT_MS, PING_BEAT_MS, REVEAL_BEAT_MS, WIPE_MS, CINEMATIC_MIN,
} from './board/Camera';
import './board/camera.css';

/* ═══════════════════════════════════════════════════════════════
   BoardView — the `board` role: a TV lying flat on the table
   (docs/BOARD_AND_BUILDER.md §5). URL /?board=CODE, no chrome.
   Black background, map fitted with a 2 px margin honoring
   board.view (rotation / flipX / zoom), status strip on the bottom
   edge, screen wake lock, any tap → fullscreen. Reconnects on its
   own (GameContext re-sends join-board on every socket connect).
   Always has a way out: EXIT on the strip (or Esc when not fullscreen)
   forgets the board and returns to the app — the board is only ever
   shown while the URL carries ?board, so nothing else can get stuck here.
   ═══════════════════════════════════════════════════════════════ */

/* Before a map is up, the table screen doubles as the join screen: players scan this
   with their phone (the TV was opened on the host's LAN address, so origin is reachable). */
function JoinQr({ code }) {
  const url = `${window.location.origin}/?join=${code}`;
  const qr = useMemo(() => { try { return qrPath(url); } catch { return null; } }, [url]);
  if (!qr) return null;
  return (
    <div className="bv-join">
      <svg className="bv-join-qr" viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${url}`}>
        <rect width={qr.size} height={qr.size} fill="#fff" />
        <path d={qr.d} fill="#000" />
      </svg>
      <div className="bv-join-text">SCAN TO JOIN<small>{url}</small></div>
    </div>
  );
}

function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock.release().catch(() => {});
      } catch { /* not allowed (no gesture / not secure context) */ }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointerdown', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerdown', acquire);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

/* ═══ F2 — Director camera + combat spotlight (board/Camera.js, board/camera.css) ═══════
   The map sits in a clip box (never over the status strip); the camera is a CSS transform on
   .bv-cam written from a requestAnimationFrame ease (no React render per frame). FOLLOW frames
   the revealed rooms holding PCs, CINEMATIC adds a CSS drift + vignette + edge treatment,
   SPOTLIGHT dims all but the active initiative token's room (the hole slides on NEXT).
   Reveals play a wipe in the palette's style ('scan' / 'dust') when the camera is not FIXED.
   Reduced FX: instant cuts, no drift, no wipes. */
function RevealWipe({ room, W, H, unit, palette, kind, uid }) {
  const box = scaleBox(shapeBox(room.shape), W, H);
  if (!box) return null;
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const s = room.shape;
  const clip = s.type === 'rect'
    ? <rect x={box.x0} y={box.y0} width={w} height={h} />
    : <polygon points={s.points.map(([x, y]) => `${x * W},${y * H}`).join(' ')} />;
  const fog = palette.fog || '#000';
  const glow = palette.deck?.door || palette.door || '#9cf0d8';
  if (kind === 'dust') {
    const soft = w * 0.35;
    return (
      <g className="bvw bvw-dust" pointerEvents="none">
        <defs>
          <clipPath id={`${uid}-c`}>{clip}</clipPath>
          <linearGradient id={`${uid}-g`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={fog} stopOpacity="0" />
            <stop offset="0.55" stopColor={glow} stopOpacity="0.38" />
            <stop offset="1" stopColor={fog} stopOpacity="0.97" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${uid}-c)`}>
          <g className="bvw-sweep" style={{ '--bvw-d': `${w + soft}px` }}>
            <rect x={box.x0 - soft} y={box.y0} width={soft} height={h} fill={`url(#${uid}-g)`} />
            <rect x={box.x0} y={box.y0} width={w} height={h} fill={fog} opacity="0.97" />
            {Array.from({ length: 14 }, (_, i) => (
              <circle key={i} className="bvw-grain" cx={box.x0 - soft * (0.15 + ((i * 37) % 70) / 100)} cy={box.y0 + h * (((i * 53) % 97) / 97)}
                r={unit * (0.05 + (i % 3) * 0.03)} fill={glow} opacity={0.5} />
            ))}
          </g>
        </g>
      </g>
    );
  }
  /* 'scan' (and anything else): a phosphor line sweeps down, the fog rolls off below it. */
  const bar = Math.max(unit * 0.16, h * 0.012);
  const trail = Math.min(h * 0.4, unit * 3);
  return (
    <g className="bvw bvw-scan" pointerEvents="none">
      <defs>
        <clipPath id={`${uid}-c`}>{clip}</clipPath>
        <linearGradient id={`${uid}-g`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={glow} stopOpacity="0" />
          <stop offset="1" stopColor={glow} stopOpacity="0.32" />
        </linearGradient>
        <pattern id={`${uid}-p`} width={unit} height={unit * 0.3} patternUnits="userSpaceOnUse">
          <rect width={unit} height={unit * 0.08} fill={glow} opacity="0.16" />
        </pattern>
      </defs>
      <g clipPath={`url(#${uid}-c)`}>
        <g className="bvw-down" style={{ '--bvw-d': `${h + bar}px` }}>
          <rect x={box.x0} y={box.y0 - trail} width={w} height={trail} fill={`url(#${uid}-g)`} />
          <rect x={box.x0} y={box.y0} width={w} height={h} fill={fog} opacity="0.96" />
          <rect x={box.x0} y={box.y0} width={w} height={h} fill={`url(#${uid}-p)`} />
          <rect x={box.x0} y={box.y0 - bar / 2} width={w} height={bar} fill={glow} className="bvw-line" />
        </g>
      </g>
    </g>
  );
}

function DirectorStage({ board, mapDef, universe, pings, flash, activeTokenId }) {
  const cam = normalizeCamera(board?.view?.camera);
  const level = board?.level || mapDef?.levels?.[0]?.id || null;
  const palette = useMemo(() => mapVisuals(universe, mapDef).palette, [universe, mapDef]);
  const edge = edgeStyle(palette);
  const reduced = reducedFx();

  /* Geometry from MapCanvas + the svg's layout size. */
  const [geo, setGeo] = useState(null);
  const onGeometry = useCallback((g) => setGeo((p) => (p && Object.keys(g).every((k) => p[k] === g[k]) ? p : g)), []);
  const clipRef = useRef(null);
  const [size, setSize] = useState([0, 0]);
  useEffect(() => {
    const clipEl = clipRef.current;
    if (!clipEl) return undefined;
    const measure = () => {
      const svg = clipEl.querySelector('.bv-canvas > svg');
      const w = svg?.clientWidth || clipEl.clientWidth;
      const h = svg?.clientHeight || clipEl.clientHeight;
      setSize((p) => (p[0] === w && p[1] === h ? p : [w, h]));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(clipEl);
    const svg = clipEl.querySelector('.bv-canvas > svg');
    if (svg) ro.observe(svg);
    return () => ro.disconnect();
  }, [mapDef]);

  /* Timers (beats, wipes) die with the stage. */
  const timers = useRef(new Set());
  const later = useCallback((fn, ms) => {
    const t = setTimeout(() => { timers.current.delete(t); fn(); }, ms);
    timers.current.add(t);
  }, []);
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);

  /* Reveals: a wipe per newly revealed room + the room joins the frame for a beat. */
  const mapKey = `${board?.mapId}|${level}`;
  const revealed = revealedSet(board, mapDef, level);
  const revealedKey = [...revealed].sort().join(',');
  const prevReveal = useRef({ key: null, set: null });
  const [wipes, setWipes] = useState([]);
  const [revealBeat, setRevealBeat] = useState(null);
  const modeRef = useRef(cam.mode);
  modeRef.current = cam.mode;
  useEffect(() => {
    const pr = prevReveal.current;
    const fresh = pr.key === mapKey ? newlyRevealed(pr.set, revealed) : [];
    prevReveal.current = { key: mapKey, set: revealed };
    if (!fresh.length || modeRef.current === 'fixed') return;
    const at = Date.now();
    if (!reducedFx()) {
      const add = fresh.map((id) => ({ id, key: `${id}-${at}` }));
      setWipes((w) => [...w, ...add].slice(-8));
      later(() => setWipes((w) => w.filter((x) => !add.includes(x))), WIPE_MS * 1.4 + 250);
    }
    let box = null;
    for (const id of fresh) box = unionBox(box, roomBox(mapDef, level, id));
    if (box) {
      const beat = { box, at };
      setRevealBeat(beat);
      later(() => setRevealBeat((b) => (b === beat ? null : b)), REVEAL_BEAT_MS);
    }
  }, [revealedKey, mapKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* GM pings: zoom toward the ping for a beat, then back. */
  const seenPings = useRef(null);
  const [pingBeat, setPingBeat] = useState(null);
  useEffect(() => {
    const list = pings || [];
    if (!seenPings.current) { seenPings.current = new Set(list.map((p) => p.key)); return; }
    for (const p of list) {
      if (seenPings.current.has(p.key)) continue;
      seenPings.current.add(p.key);
      if (p.by !== 'dm' || modeRef.current === 'fixed' || !geo) continue;
      const beat = { box: pointBox(p.x, p.y, 7, mapDef?.grid, geo.W, geo.H), at: Date.now() };
      setPingBeat(beat);
      later(() => setPingBeat((b) => (b === beat ? null : b)), PING_BEAT_MS);
    }
  }, [pings]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Spotlight + the shot. */
  const spotBox = cam.spotlight && activeTokenId && geo
    ? tokenFocusBox({ mapDef, board, level, tokenId: activeTokenId, W: geo.W, H: geo.H }) : null;
  const shot = geo ? chooseShot({ cam, mapDef, board, level, W: geo.W, H: geo.H, spotBox, pingBox: pingBeat?.box, revealBox: revealBeat?.box }) : null;
  const [cw, ch] = size;
  const minScale = cam.mode === 'cinematic' ? CINEMATIC_MIN : 1;
  const target = shot && cw > 0
    ? frameLocal(boxToLocal(geo, cw, ch, shot.box), cw, ch, { maxScale: shot.maxScale, minScale, content: contentLocal(geo, cw, ch) })
    : restingCamera(cw, ch, minScale);

  /* rAF animator (camera transform + spotlight hole), state in a ref. */
  const camEl = useRef(null);
  const dimEl = useRef(null);
  const ringEl = useRef(null);
  const st = useRef({ cur: { ...IDENTITY }, anim: null, hole: null, spotAnim: null, raf: 0, size: null, geo: null });
  st.current.geo = geo;
  const writeSpot = useCallback(() => {
    const s = st.current;
    if (!s.hole || !s.geo) return;
    const { W, H } = s.geo;
    const r = (mapDef?.grid || 1 / 40) * W * 0.7;
    dimEl.current?.setAttribute('d', spotPath({ x0: -W, y0: -H, x1: 2 * W, y1: 2 * H }, s.hole, r));
    ringEl.current?.setAttribute('d', roundRect(s.hole, r));
  }, [mapDef]);
  const frame = useCallback((now) => {
    const s = st.current;
    s.raf = 0;
    let more = false;
    if (s.anim) {
      const t = Math.min(1, (now - s.anim.t0) / s.anim.dur);
      s.cur = t >= 1 ? s.anim.to : lerpCam(s.anim.from, s.anim.to, ease(t));
      if (t >= 1) s.anim = null; else more = true;
    }
    if (s.spotAnim) {
      const t = Math.min(1, (now - s.spotAnim.t0) / s.spotAnim.dur);
      s.hole = t >= 1 ? s.spotAnim.to : lerpBox(s.spotAnim.from, s.spotAnim.to, ease(t));
      if (t >= 1) s.spotAnim = null; else more = true;
      writeSpot();
    }
    const el = camEl.current;
    if (el) {
      el.style.transform = camCss(s.cur);
      el.style.willChange = s.anim ? 'transform' : 'auto'; // re-rasterise crisp once the move settles
    }
    if (more) s.raf = requestAnimationFrame(frame);
  }, [writeSpot]);
  const kick = useCallback(() => {
    const s = st.current;
    if (!s.raf) s.raf = requestAnimationFrame(frame);
  }, [frame]);
  useEffect(() => () => { if (st.current.raf) cancelAnimationFrame(st.current.raf); }, []);

  useLayoutEffect(() => {
    const s = st.current;
    if (!(cw > 0)) return;
    const resized = s.size && (s.size[0] !== cw || s.size[1] !== ch);
    s.size = [cw, ch];
    if (camClose(s.anim ? s.anim.to : s.cur, target)) return;
    if (reducedFx() || resized) {
      s.anim = null;
      s.cur = target;
      if (camEl.current) { camEl.current.style.transform = camCss(target); camEl.current.style.willChange = 'auto'; }
      return;
    }
    s.anim = { from: s.cur, to: target, t0: performance.now(), dur: EASE_MS };
    kick();
  }, [target.s, target.tx, target.ty, cw, ch, kick]); // eslint-disable-line react-hooks/exhaustive-deps

  const hole = spotBox && geo ? scaleBox(spotBox, geo.W, geo.H) : null;
  const holeKey = hole ? `${hole.x0.toFixed(1)},${hole.y0.toFixed(1)},${hole.x1.toFixed(1)},${hole.y1.toFixed(1)}` : '';
  const spotShown = useRef(false);
  useLayoutEffect(() => {
    const s = st.current;
    if (!hole) { spotShown.current = false; return; }
    if (!spotShown.current || !s.hole || reducedFx()) {
      s.spotAnim = null;
      s.hole = hole;
      writeSpot();
    } else if (!boxClose(s.spotAnim ? s.spotAnim.to : s.hole, hole, 0.5)) {
      s.spotAnim = { from: s.hole, to: hole, t0: performance.now(), dur: SPOT_MS };
      kick();
    }
    spotShown.current = true;
  }, [holeKey, writeSpot, kick]); // eslint-disable-line react-hooks/exhaustive-deps
  const setDim = useCallback((el) => { dimEl.current = el; if (el) writeSpot(); }, [writeSpot]);
  const setRing = useCallback((el) => { ringEl.current = el; if (el) writeSpot(); }, [writeSpot]);

  const rooms = useMemo(() => levelRooms(mapDef, level), [mapDef, level]);
  const wipeKind = palette.reveal === 'dust' ? 'dust' : 'scan';
  const overlay = ({ W, H, unit }) => (
    <g className="bv-cam-ov" pointerEvents="none">
      {wipes.map((w) => {
        const room = rooms.find((r) => r.id === w.id);
        return room ? <RevealWipe key={w.key} room={room} W={W} H={H} unit={unit} palette={palette} kind={wipeKind} uid={`bvw-${w.key.replace(/[^a-zA-Z0-9-]/g, '')}`} /> : null;
      })}
      <g className={`bv-spot${hole ? ' on' : ''}`}>
        <path ref={setDim} className="bv-spot-dim" fillRule="evenodd" fill={palette.bg || '#000'} />
        <path ref={setRing} className="bv-spot-ring" fill="none" strokeWidth={Math.max(unit * 0.14, 2)} />
      </g>
    </g>
  );

  const cine = cam.mode === 'cinematic';
  return (
    <div className={`bv-cam-clip cam-${cam.mode}${reduced ? ' cam-still' : ''}`} ref={clipRef} style={{ background: palette.bg }}
      data-camera={cam.mode} data-shot={shot?.why || 'rest'} data-spotlight={hole ? 'on' : 'off'}>
      <div className="bv-cam" ref={camEl}>
        <div className={`bv-cam-drift${cine && !reduced ? ' on' : ''}`}>
          <MapCanvas className="bv-canvas" mapDef={mapDef} board={board} role="board" universe={universe}
            view={board.view} pings={pings} flashTokens={flash} activeTokenId={activeTokenId}
            overlay={overlay} onGeometry={onGeometry} />
        </div>
      </div>
      {cine && (
        <div className={`bv-cine k-${edge}`} aria-hidden="true">
          <i className="bv-cine-vig" />
          <i className="bv-cine-edge" />
        </div>
      )}
    </div>
  );
}

const wantsAudio = () => { try { return new URLSearchParams(window.location.search).get('audio') === '1'; } catch { return false; } };

export default function BoardView() {
  const { board, mapDef, gameCode, connected, reconnecting, pings, boardError, joinBoard, role, on, table } = useGame();
  const [flash, setFlash] = useState({}); // tokenId -> key (TokenChip flash prop)
  const [audioOn] = useState(wantsAudio);
  useEffect(() => {
    const hit = (tokenId) => {
      if (!tokenId) return;
      const k = Date.now();
      setFlash((f) => ({ ...f, [tokenId]: k }));
      setTimeout(() => setFlash((f) => {
        if (f[tokenId] !== k) return f;
        const next = { ...f };
        delete next[tokenId];
        return next;
      }), 2600);
    };
    const offs = [on('board-flash', (e) => hit(e?.tokenId)), on('board-panic', (e) => hit(e?.tokenId))];
    return () => offs.forEach((f) => f());
  }, [on]);
  const activeTokenId = table?.initiative?.active ? table.initiative.current?.tokenId || null : null;
  const { universe } = useUniverse();
  const [fullscreen, setFullscreen] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  const [codeInput, setCodeInput] = useState('');
  const rootRef = useRef(null);
  useWakeLock(true);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('board-mode');
    return () => document.documentElement.classList.remove('board-mode');
  }, []);

  /* Esc leaves the board (the browser itself uses the first Esc to drop fullscreen). */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) leaveBoard(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goFullscreen = () => {
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
  };

  const code = gameCode || boardCodeForTab();
  const terminalName = universe?.terminal?.name || 'GAME TERMINAL';
  // the level label only when there is more than one (a one-level map read "HUB · HUB", "WRECK SITE · WRECK SITE")
  const title = mapDef ? `${mapDef.title}${board?.level && mapDef.levels?.length > 1 ? ` · ${mapDef.levels.find((l) => l.id === board.level)?.label || board.level}` : ''}` : '';

  /* No game: enter a code (only shown when the URL had none or the game is gone). */
  if (role !== 'board' && !reconnecting && (boardError || !code)) {
    return (
      <div className="bv-root bv-standby">
        <div className="bv-card">
          <div className="bv-term">{terminalName} — TABLE BOARD</div>
          {boardError && <div className="bv-error">{boardError}</div>}
          <form onSubmit={(e) => {
            e.preventDefault();
            const c = codeInput.trim().toUpperCase();
            if (!c) return;
            window.history.replaceState(null, '', `/?board=${c}`);
            joinBoard(c);
          }}>
            <input className="bv-code-input" value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              maxLength={4} placeholder="CODE" aria-label="Session code" autoFocus />
            <button className="bv-btn" type="submit">CONNECT</button>
          </form>
          <button type="button" className="bv-exit bv-exit-standby" onClick={leaveBoard}>✕ EXIT TABLE BOARD</button>
        </div>
      </div>
    );
  }

  /* Clocks / pools stack on the right edge: keep the map out from under them (an ASCII map fills the
     whole TV and its right column was unreadable behind the clock cards). */
  // F2 combat spotlight: the active actor's turn banner on the strip
  const spotTurn = role === 'board' && normalizeCamera(board?.view?.camera).spotlight && table?.initiative?.active ? table.initiative.current || null : null;
  const hasRail = role === 'board' && table?.boardMode !== 'theatre' && ((table?.clocks?.length || 0) + (table?.pools?.length || 0)) > 0;
  return (
    <div className={`bv-root${hasRail ? ' bv-has-rail' : ''}`} ref={rootRef} onPointerDown={goFullscreen}>
      <div className="bv-stage">
        {board?.mapId && mapDef ? (
          <DirectorStage board={board} mapDef={mapDef} universe={universe} pings={pings} flash={flash} activeTokenId={activeTokenId} />
        ) : (
          <div className="bv-wait">
            <div className="bv-term">{terminalName}</div>
            <div className="bv-big-code">{code || '----'}</div>
            <div className="bv-sub">{role === 'board' ? 'BOARD LINKED — WAITING FOR THE GAME MASTER TO SELECT A MAP' : 'CONNECTING…'}</div>
            {role === 'board' && code && <JoinQr code={code} />}
          </div>
        )}
        {role === 'board' && <Overlays terminalName={terminalName} hideTurn={!!spotTurn} />}{/* spotlight banner replaces the ROUND box */}
        {role === 'board' && audioOn && <BoardAudio ambient={table?.ambient || null} />}
      </div>
      <div className="bv-strip">
        <span className="bv-strip-term">{terminalName}</span>
        <span>SESSION {code}</span>
        {spotTurn && (
          <span key={`${spotTurn.id}-${table.initiative.round}`} className={`bv-turn k-${spotTurn.kind || 'pc'}`} role="status">
            {table.initiative.round > 0 && <span className="bv-turn-round">ROUND {table.initiative.round}</span>}
            <b>{String(spotTurn.label || '').toUpperCase()}</b> — {universe?.terms?.turnCall || 'ACT'}
          </span>
        )}
        {title && <span className="bv-strip-title">{title.toUpperCase()}</span>}
        <span className="bv-spacer" />
        {!fullscreen && <span className="bv-hint">TAP FOR FULLSCREEN</span>}
        <span className={`bv-link${connected && role === 'board' ? ' up' : ''}`}>
          <span className="link-dot" />{connected ? (role === 'board' ? 'LINK' : 'JOINING…') : 'RECONNECTING…'}
        </span>
        <button type="button" className="bv-exit" title="Leave the table board and return to the app (Esc)"
          onPointerDown={(e) => e.stopPropagation()} onClick={leaveBoard}>✕ EXIT</button>
      </div>
    </div>
  );
}
