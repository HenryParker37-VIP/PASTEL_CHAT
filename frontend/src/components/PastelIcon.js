import React from 'react';

/*
 * Pastel Chat's code-owned icon system. Every icon shares a 24px grid, round
 * caps/joins and the same 1.8px optical stroke so UI glyphs stay crisp in
 * browsers, installed PWAs and the Capacitor shell.
 */
const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Dot = ({ cx, cy, r = 1.25 }) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

const glyphs = {
  'profile-edit': <><path d="M5 20.5h14" {...common}/><path d="M7.5 16.8 16.9 7.4a2.1 2.1 0 0 1 3 3L10.5 19.8l-3.8.8z" {...common}/><path d="m15.5 8.8 2.8 2.8" {...common}/><circle cx="7.5" cy="6.5" r="2.5" {...common}/></>,
  'chat-friends': <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h7A3.5 3.5 0 0 1 18 5.5v4A3.5 3.5 0 0 1 14.5 13H10l-3.8 3v-3.2A3.5 3.5 0 0 1 4 9.5z" {...common}/><path d="M14.8 16.3h1.7a3.5 3.5 0 0 0 3.5-3.5V9.7" {...common}/><Dot cx="8" cy="7.5"/><Dot cx="11" cy="7.5"/><Dot cx="14" cy="7.5"/></>,
  users: <><circle cx="9" cy="8" r="3" {...common}/><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20" {...common}/><path d="M16 4.5a3 3 0 0 1 0 5.8M17.5 14.5a4.5 4.5 0 0 1 3 4.2V20" {...common}/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" {...common}/><circle cx="9" cy="9" r="1.7" {...common}/><path d="m4.5 17 4.8-4.8a2 2 0 0 1 2.8 0l2.4 2.4 1.6-1.6a2 2 0 0 1 2.8 0l2.1 2.1" {...common}/></>,
  notebook: <><rect x="6" y="3" width="12" height="18" rx="2.5" {...common}/><path d="M9 3v18M12 8h3M12 12h3M12 16h2" {...common}/><path d="M5 7H3.8M5 12H3.8M5 17H3.8" {...common}/></>,
  'shield-heart': <><path d="M12 2.8 19 5.6v5.2c0 4.7-2.9 8.4-7 10.4-4.1-2-7-5.7-7-10.4V5.6z" {...common}/><path d="M12 15.6s-3.1-1.8-3.1-4a1.8 1.8 0 0 1 3.1-1.2 1.8 1.8 0 0 1 3.1 1.2c0 2.2-3.1 4-3.1 4Z" {...common}/></>,
  close: <><path d="m6 6 12 12M18 6 6 18" {...common}/></>,
  search: <><circle cx="10.7" cy="10.7" r="5.7" {...common}/><path d="m15 15 4.5 4.5" {...common}/></>,
  phone: <><path d="M8.1 3.8 6.4 5.4c-1.1 1.1.3 4.2 3.1 7s5.9 4.2 7 3.1l1.6-1.7-2.6-2.6-1.5 1c-.7.4-2.2-.4-3.5-1.7s-2.1-2.8-1.7-3.5l1-1.5z" {...common}/></>,
  video: <><rect x="3" y="6" width="12" height="12" rx="3" {...common}/><path d="m15 10 5-2.8v9.6L15 14" {...common}/></>,
  send: <><path d="m21 3-8.3 18-2.1-7.6L3 11.3zM10.6 13.4 16 8" {...common}/></>,
  attachment: <><path d="m9.4 12.8 5.2-5.2a3 3 0 1 1 4.2 4.2l-7.4 7.4a4.6 4.6 0 0 1-6.5-6.5l7.1-7.1" {...common}/></>,
  smile: <><circle cx="12" cy="12" r="8.5" {...common}/><path d="M8.5 14.3c1 1.4 2.1 2 3.5 2s2.5-.6 3.5-2M9 9.5h.01M15 9.5h.01" {...common}/></>,
  gif: <><rect x="3" y="5" width="18" height="14" rx="3" {...common}/><path d="M8.5 10.2a2 2 0 1 0 0 3.6h1.2v-1.5H8.5M12.5 10v4M15.5 14v-4h3" {...common}/></>,
  file: <><path d="M7 3h7l4 4v14H7z" {...common}/><path d="M14 3v5h4M9.5 13h5M9.5 16h4" {...common}/></>,
  pin: <><path d="m14.5 4 5.5 5.5-2.2 1.1-2.2 4.1-2.9-2.9-4.1 2.2L7.5 12l4.1-2.2zM12 14.5 6 20.5" {...common}/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l.8 13h8.4L17 7M10 11v5M14 11v5" {...common}/></>,
  edit: <><path d="m5 19 3.7-.8L19 7.9a2.1 2.1 0 0 0-3-3L5.8 15.2zM14.5 6.5l3 3" {...common}/></>,
  bell: <><path d="M18 10.5a6 6 0 0 0-12 0c0 6-2.5 6.5-2.5 7.5h17c0-1-2.5-1.5-2.5-7.5M10 21h4" {...common}/></>,
  sparkles: <><path d="m12 3 1.1 4.1L17 8.2l-3.9 1.1L12 13.5l-1.1-4.2L7 8.2l3.9-1.1z" {...common}/><path d="m19 14 .6 2.4L22 17l-2.4.6L19 20l-.6-2.4L16 17l2.4-.6zM5 14l.5 1.8L7.5 16l-2 .5L5 18.5 4.5 16l-2-.5 2-.2z" {...common}/></>,
  pulse: <><path d="M3 12h4l2-6 4 12 2-6h6" {...common}/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2.5" {...common}/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" {...common}/></>,
  globe: <><circle cx="12" cy="12" r="8.5" {...common}/><path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.3-5.1-3.3-8.5S9.8 5.8 12 3.5" {...common}/></>,
  sun: <><circle cx="12" cy="12" r="3.5" {...common}/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" {...common}/></>,
  moon: <><path d="M19.5 15.4A8.2 8.2 0 0 1 8.6 4.5 8.5 8.5 0 1 0 19.5 15.4Z" {...common}/></>,
  palette: <><path d="M12 3.5a8.5 8.5 0 0 0 0 17h1.2a1.8 1.8 0 0 0 0-3.6h-.4a1.8 1.8 0 0 1 0-3.6H15a5.5 5.5 0 0 0 5.5-5.5A4.3 4.3 0 0 0 16.2 3.5z" {...common}/><Dot cx="7.5" cy="10"/><Dot cx="10" cy="7"/><Dot cx="14" cy="7"/></>,
  'chevron-left': <path d="m14.5 5-7 7 7 7" {...common}/>,
  'chevron-down': <path d="m6 9 6 6 6-6" {...common}/>,
  'chevron-right': <path d="m9.5 5 7 7-7 7" {...common}/>,
  'arrow-left': <><path d="M20 12H4M10 6l-6 6 6 6" {...common}/></>,
  'arrow-down': <><path d="M12 4v16M6 14l6 6 6-6" {...common}/></>,
  home: <><path d="m4 11 8-7 8 7v9H4z" {...common}/><path d="M9 20v-5h6v5" {...common}/></>,
  reply: <><path d="M9 8 4 12l5 4v-3h4.2a5.8 5.8 0 0 1 5.3 3.5c.3-4.7-2.4-8.5-7.2-8.5z" {...common}/></>,
  check: <path d="m5 12 4.2 4.2L19 6.5" {...common}/>,
  alert: <><path d="M12 3 21 20H3z" {...common}/><path d="M12 9v4M12 16.5h.01" {...common}/></>,
  online: <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />,
  offline: <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" {...common}/><circle cx="12" cy="13" r="3.5" {...common}/></>,
  'camera-off': <><path d="M3 3l18 18" {...common}/><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" {...common}/><path d="M9.5 13a2.5 2.5 0 0 0 3.5 2.3" {...common}/></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" {...common}/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" {...common}/></>,
  'mic-off': <><path d="M3 3l18 18" {...common}/><path d="M9 4.2V11a3 3 0 0 0 4.7 2.5M6 11a6 6 0 0 0 9.1 5.1M12 17v4M9 21h6" {...common}/></>,
  speaker: <><path d="M4 10h4l5-4v12l-5-4H4zM16 9a4.2 4.2 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" {...common}/></>,
  'speaker-low': <><path d="M4 10h4l5-4v12l-5-4H4zM16 10.2a3 3 0 0 1 0 3.6" {...common}/></>,
  'end-call': <path d="M5 6.5c4.7-2.7 9.3-2.7 14 0l-1.5 3.7-2.4-1c-2-.7-4-.7-6 0l-2.4 1z" {...common}/>,
  flip: <><path d="M7 7h10l-2.5-2.5M17 7l-2.5 2.5M17 17H7l2.5 2.5M7 17l2.5-2.5" {...common}/></>,
  'picture-in-picture': <><rect x="3" y="5" width="18" height="14" rx="2" {...common}/><rect x="13" y="12" width="5" height="4" rx=".8" {...common}/></>,
  gift: <><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M8.3 7C6 7 5.5 4 7.7 4c1.9 0 3.2 2 4.3 3M15.7 7c2.3 0 2.8-3 0-3-1.9 0-3.2 2-4.3 3" {...common}/></>,
};

export const PastelIcon = ({ name, size = 20, title, className = '', strokeWidth, ...props }) => {
  const glyph = glyphs[name] || glyphs.alert;
  const labelled = Boolean(title);
  return (
    <svg
      className={`pastel-icon pastel-icon--${name} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      {...props}
    >
      {title && <title>{title}</title>}
      {strokeWidth ? <g strokeWidth={strokeWidth}>{glyph}</g> : glyph}
    </svg>
  );
};

export default PastelIcon;
