import React from 'react';

/* Line icons for the phone's bottom tabs and quick actions (stroke = currentColor). */
const PATHS = {
  sheet: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-5 3.5-8 8-8s8 3 8 8" /></>,
  gear: <path d="M4 7h16v13H4zM8 7V4h8v3" />,
  comms: <path d="M4 5h16v11H9l-5 4z" />,
  table: <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.2" /><circle cx="15" cy="15" r="1.2" /><circle cx="15" cy="9" r="1.2" /><circle cx="9" cy="15" r="1.2" /></>,
  stress: <path d="M12 3v10M12 17v.5M5 21h14L12 3z" />,
  panic: <><circle cx="12" cy="12" r="8" /><path d="M9 10v.5M15 10v.5M8.5 16q3.5-3 7 0" /></>,
  det: <><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  pin: <><path d="M12 21s-6-6.2-6-11a6 6 0 1112 0c0 4.8-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>,
};

export default function Icon({ name, size = 22, className = '' }) {
  return (
    <svg className={`pp-icon ${className}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {PATHS[name] || null}
    </svg>
  );
}
