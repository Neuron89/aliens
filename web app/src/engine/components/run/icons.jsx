import React from 'react';

/* Line icons for the GM shell (rail, dock, strip). 24×24, stroke = currentColor, decorative
   (every button that uses one carries a visible label or an aria-label). */
const P = {
  run: <path d="M7 4.5v15l12-7.5z" />,
  board: <><rect x="3.5" y="4" width="17" height="16" /><path d="M3.5 10h17M10 4v16" /></>,
  crew: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16.2 14.3c2.4.2 4.2 1.9 4.8 4.7" /></>,
  stories: <><path d="M6 3.5h8.5L19 8v12.5H6z" /><path d="M14.5 3.5V8H19M9 12h7M9 15.5h7" /></>,
  characters: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20.5c.8-4.2 3.6-6.4 7-6.4s6.2 2.2 7 6.4" /></>,
  maps: <><path d="M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5l-5.5 2.5-6-2.5-5.5 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  rules: <><path d="M4.5 5.5c2.8-1 5.2-.8 7.5 1 2.3-1.8 4.7-2 7.5-1v13c-2.8-1-5.2-.8-7.5 1-2.3-1.8-4.7-2-7.5-1z" /><path d="M12 6.5v13" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.1" fill="currentColor" /><circle cx="15" cy="15" r="1.1" fill="currentColor" /><circle cx="15" cy="9" r="1.1" fill="currentColor" /><circle cx="9" cy="15" r="1.1" fill="currentColor" /></>,
  audio: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9q1.6 3 0 6M18 7q3 5 0 10" /></>,
  next: <><path d="M6 5v14l10-7z" /><path d="M18.5 5v14" /></>,
  narrate: <><path d="M4 5h16v11H10l-4.5 3.5V16H4z" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  handout: <><path d="M6 3.5h12v17H6z" /><path d="M9 8h6M9 11.5h6M9 15h4" /></>,
  threat: <><path d="M12 3.5l8.5 15H3.5z" /><path d="M12 9.5v4.5M12 16.5v.5" /></>,
  more: <><path d="M4.5 7h15M4.5 12h15M4.5 17h15" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  list: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4 6.5h1.5M4 12h1.5M4 17.5h1.5" /></>,
  qr: <><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" /></>,
  tv: <><rect x="3" y="5" width="18" height="12" /><path d="M8.5 20.5h7" /></>,
};

export default function Icon({ name, size = 22, className = '' }) {
  return (
    <svg className={`ic ${className}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      {P[name] || null}
    </svg>
  );
}
