import React from 'react';

export default function Header() {
  return (
    <header className="header">
      <h1>MU/TH/UR</h1>
      <p className="subtitle">INTERFACE 2037 — Game Mother Terminal</p>
      <div className="status-bar">
        <span><span className="status-dot green"></span>SYSTEMS NOMINAL</span>
        <span><span className="status-dot amber"></span>CREW MONITORING</span>
        <span><span className="status-dot green"></span>UPLINK ACTIVE</span>
      </div>
    </header>
  );
}
