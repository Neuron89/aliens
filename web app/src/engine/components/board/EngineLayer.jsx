import React, { useMemo } from 'react';
import { MapPatterns, MapThemeProvider, SandBackdrop, configBackdrop, createTheme, DEFAULT_THEME, purl, pid, seededRandom } from '../MapEngine';

/* ═══════════════════════════════════════════════════════════════
   EngineLayer — one deck of a MapEngine config, without the GM-screen
   chrome (frame, sidebar, legend, specs). Drawn in the engine's own
   W×H px space so normalized room shapes line up with the deck plan.
   `config` is the MapEngine config (e.g. MonteroMap.config); `level`
   matches decks[].level or decks[].id.

   Palette: the map's own theme (config.theme, e.g. the Dune sand-and-
   stone theme) is provided to every primitive, so a Dune map renders
   in ochre on the TV, not in the default ALIEN teal. `backdrop`
   ('space' | 'sand' | 'none'; default from the config) decides whether
   the star field is drawn — stars only behind space ships.
   ═══════════════════════════════════════════════════════════════ */

export default function EngineLayer({ config, level, backdrop: backdropProp }) {
  const { width: W = 1100, height: H = 920, stars = { count: 200, seed: 1979 }, hull, exteriorDetails, decks = [], fixedOverlays } = config;
  const C = useMemo(() => (config.theme ? createTheme(config.theme) : DEFAULT_THEME), [config.theme]);
  const backdrop = backdropProp || configBackdrop(config);
  const deck = decks.find((d) => d.level === level || d.id === level) || decks[0];
  const DeckComp = deck?.component;
  const hullClip = hull?.path ? `url(#${pid('hullClip')})` : undefined;
  const starData = useMemo(() => {
    if (backdrop !== 'space') return [];
    const rng = seededRandom(stars.seed);
    const count = stars.count || 200;
    return Array.from({ length: count }, () => ({ x: rng() * W, y: rng() * H, r: 0.2 + rng() * 1.0, o: 0.04 + rng() * 0.18 }));
  }, [W, H, stars.count, stars.seed, backdrop]);

  return (
    <MapThemeProvider theme={config.theme}>
      <g className="engine-layer">
        <MapPatterns hullPath={hull?.path} />
        <rect width={W} height={H} fill={purl('bgGrad')} />
        {starData.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#c8d8e8" opacity={s.o} />)}
        {backdrop === 'sand' && <SandBackdrop W={W} H={H} seed={stars.seed} />}
        {hull?.background?.(C)}
        {hull?.path && (
          <>
            <path d={hull.path} fill={purl('hullGrad')} stroke={C.hullOutline} strokeWidth="1.2" />
            <g clipPath={hullClip} opacity="0.3"><rect x="0" y="0" width={W} height={H} fill={purl('plate')} /></g>
            <g clipPath={hullClip}><rect x="0" y="0" width={W} height={H} fill={purl('hullRivet')} /></g>
          </>
        )}
        {hull?.overlays && <g clipPath={hullClip}>{hull.overlays(C)}</g>}
        {exteriorDetails?.(C)}
        <g clipPath={hullClip}>{DeckComp && <DeckComp />}</g>
        {fixedOverlays && <g clipPath={hullClip}>{fixedOverlays(C)}</g>}
      </g>
    </MapThemeProvider>
  );
}
