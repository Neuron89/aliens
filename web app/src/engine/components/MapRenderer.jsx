import React, { useMemo } from 'react';
import { AsciiDeckPlan } from './board/AsciiLayer';
import { mapVisuals } from './board/mapDefs';

/**
 * Resolve the interactive MapEngine component for a map entry.
 * - universe.maps entries carry `engine` as a React component.
 * - content-pack maps carry `engine` as a string id referencing a universe map.
 */
export function resolveEngine(universe, map) {
  if (!map) return null;
  if (typeof map.engine === 'function') return map.engine;
  if (typeof map.engine === 'string') {
    const ref = (universe.maps || []).find(m => m.id === map.engine);
    if (ref && typeof ref.engine === 'function') return ref.engine;
  }
  return null;
}

/**
 * MapRenderer — renders one map in a given view: 'engine' (interactive
 * MapEngine deck plan), 'image', 'vector' (the ASCII schematic drawn as a
 * themed deck plan, board/AsciiLayer) or 'ascii' (the original text).
 * With no view, picks the best.
 */
export default function MapRenderer({ universe, map, view }) {
  const Engine = resolveEngine(universe, map);
  const src = map.src || map.image;
  const v = view || (Engine ? 'engine' : src ? 'image' : map.ascii ? 'vector' : 'ascii');
  const palette = useMemo(() => mapVisuals(universe, { id: map.id, kind: 'ascii' }).palette, [universe, map.id]);

  if (v === 'vector' && map.ascii) {
    return (
      <div className="panel map-vector-panel" style={{ padding: '0.5rem' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
          <AsciiDeckPlan map={map} palette={palette} />
        </div>
      </div>
    );
  }

  if (v === 'engine' && Engine) {
    return (
      <div className="panel" style={{ padding: '0.5rem', background: 'transparent', border: 'none' }}>
        <Engine />
      </div>
    );
  }

  if (v === 'image' && src) {
    return (
      <div className="panel">
        <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-input)' }}>
          <img
            src={src}
            alt={map.title}
            style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
            onClick={() => window.open(src, '_blank')}
            title="Click to open full size"
          />
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: '0.5rem', textAlign: 'center', opacity: 0.6 }}>
          Click image to open full size
        </p>
      </div>
    );
  }

  if (map.ascii) {
    return (
      <div className="panel">
        <h2>SCHEMATIC</h2>
        <div className="map-ascii-container">
          <pre className="map-ascii">{map.ascii}</pre>
        </div>
      </div>
    );
  }

  return null;
}
