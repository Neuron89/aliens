import React, { useState } from 'react';

export default function AudioPanel({ audio }) {
  const [collapsed, setCollapsed] = useState(true);
  const { preset, volume, presets, applyPreset, updateVolume, isActive } = audio;

  return (
    <div className={`audio-panel${collapsed ? ' collapsed' : ''}`}>
      <div className="audio-panel-header" onClick={() => setCollapsed(!collapsed)}>
        <span>{isActive ? '♫ AMBIENT: ' + (presets[preset]?.label || 'OFF') : '♫ AUDIO'}</span>
        <span style={{ fontSize: '0.9rem' }}>{collapsed ? '▲' : '▼'}</span>
      </div>
      <div className="audio-panel-body">
        <div className="audio-presets">
          {Object.entries(presets).map(([key, val]) => (
            <button
              key={key}
              className={preset === key ? 'active' : ''}
              onClick={() => applyPreset(key)}
            >
              {val.label}
            </button>
          ))}
        </div>
        <div className="volume-control">
          <span>VOL</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={e => updateVolume(parseFloat(e.target.value))}
          />
          <span>{Math.round(volume * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
