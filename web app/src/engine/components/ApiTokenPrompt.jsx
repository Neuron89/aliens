import React, { useState } from 'react';
import { getApiToken, setApiToken } from '../apiToken';

/* Inline API-token prompt. A server that sets API_TOKEN answers every write to /api/* with
   401 "API token required." — instead of sending the GM hunting for the ADVANCED fold on the
   session screen, drawers render this right under the error. Saved to localStorage.apiToken
   (apiToken.js), so it is remembered on this device; the action is simply tried again. */
export default function ApiTokenPrompt({ onSaved }) {
  const [value, setValue] = useState(getApiToken);
  const [saved, setSaved] = useState(false);
  const save = () => {
    const v = value.trim();
    if (!v) return;
    setApiToken(v);
    setSaved(true);
    onSaved?.(v);
  };
  return (
    <form className="api-token-prompt" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label className="fs-label" htmlFor="api-token-inline">THIS SERVER NEEDS ITS API TOKEN</label>
      <div className="api-token-row">
        <input id="api-token-inline" type="password" value={value} autoComplete="off" placeholder="paste the token the host gave you"
          onChange={(e) => { setValue(e.target.value); setSaved(false); }} aria-label="API token" />
        <button type="submit" className="run-btn" disabled={!value.trim()}>{saved ? 'SAVED ✓' : 'SAVE'}</button>
      </div>
      <p className="run-dim">{saved ? 'Saved on this device — tap the action again.' : 'Entered once per device; players and the TV never need it.'}</p>
    </form>
  );
}
