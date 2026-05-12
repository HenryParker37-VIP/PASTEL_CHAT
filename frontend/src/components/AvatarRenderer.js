// AvatarRenderer.js — Pure SVG chibi avatar generator for PastelChat
// generateAvatarSVG(opts) returns a 100x100 SVG string

const DEFAULTS = {
  skinColor: 'f8d9c4',
  hairColor: '4a2c2c',
  hairStyle: 'v01',
  bgColor: 'ffb6c1',
  expression: 'cheery',
  glasses: '',
  outfit: 'o1',
  earrings: false,
};

// ── Hair styles ──────────────────────────────────────────────────────────────
// Each returns { back: svgString, front: svgString }
function getHair(style, color) {
  const c = `#${color}`;
  const shade = shadeColor(color, -20);
  switch (style) {
    case 'v01': // Short
      return {
        back: `<ellipse cx="50" cy="30" rx="26" ry="20" fill="${c}"/>
               <rect x="24" y="28" width="7" height="14" rx="4" fill="${c}"/>
               <rect x="69" y="28" width="7" height="14" rx="4" fill="${c}"/>`,
        front: `<path d="M24 38 Q27 22 50 20 Q73 22 76 38 Q65 30 50 30 Q35 30 24 38Z" fill="${c}"/>
                <path d="M24 38 Q26 32 34 30" stroke="${shade}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
      };
    case 'v02': // Bob
      return {
        back: `<ellipse cx="50" cy="30" rx="26" ry="20" fill="${c}"/>
               <rect x="24" y="28" width="8" height="42" rx="5" fill="${c}"/>
               <rect x="68" y="28" width="8" height="42" rx="5" fill="${c}"/>
               <ellipse cx="50" cy="30" rx="26" ry="18" fill="${c}"/>`,
        front: `<path d="M24 40 Q27 22 50 20 Q73 22 76 40 Q65 31 50 31 Q35 31 24 40Z" fill="${c}"/>
                <path d="M24 40 Q25 33 32 30" stroke="${shade}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
      };
    case 'v03': // Wavy
      return {
        back: `<ellipse cx="50" cy="30" rx="27" ry="20" fill="${c}"/>
               <path d="M23 30 Q20 50 22 65 Q24 72 27 68 Q23 55 25 40Z" fill="${c}"/>
               <path d="M77 30 Q80 50 78 65 Q76 72 73 68 Q77 55 75 40Z" fill="${c}"/>`,
        front: `<path d="M24 40 Q28 21 50 19 Q72 21 76 40 Q70 30 62 32 Q56 28 50 30 Q44 28 38 32 Q30 30 24 40Z" fill="${c}"/>
                <path d="M26 38 Q32 26 40 29" stroke="${shade}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
                <path d="M60 29 Q68 27 74 37" stroke="${shade}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
      };
    case 'v04': // Long
      return {
        back: `<ellipse cx="50" cy="30" rx="27" ry="20" fill="${c}"/>
               <rect x="23" y="30" width="8" height="65" rx="5" fill="${c}"/>
               <rect x="69" y="30" width="8" height="65" rx="5" fill="${c}"/>`,
        front: `<path d="M24 40 Q27 21 50 19 Q73 21 76 40 Q65 30 50 30 Q35 30 24 40Z" fill="${c}"/>
                <path d="M24 40 Q25 34 31 30" stroke="${shade}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
      };
    case 'v05': // Ponytail
      return {
        back: `<ellipse cx="50" cy="30" rx="26" ry="19" fill="${c}"/>
               <rect x="24" y="28" width="7" height="12" rx="4" fill="${c}"/>
               <rect x="69" y="28" width="7" height="12" rx="4" fill="${c}"/>
               <ellipse cx="74" cy="40" rx="5" ry="4" fill="${c}"/>
               <path d="M74 44 Q80 60 76 80 Q72 90 74 95" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
        front: `<path d="M24 38 Q27 21 50 20 Q73 21 76 38 Q65 29 50 29 Q35 29 24 38Z" fill="${c}"/>
                <path d="M60 22 Q70 18 75 24" stroke="${shade}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
      };
    case 'v06': // Bun
      return {
        back: `<ellipse cx="50" cy="30" rx="26" ry="18" fill="${c}"/>
               <rect x="24" y="28" width="7" height="12" rx="4" fill="${c}"/>
               <rect x="69" y="28" width="7" height="12" rx="4" fill="${c}"/>
               <circle cx="50" cy="14" r="10" fill="${c}"/>
               <circle cx="50" cy="14" r="7" fill="${shade}"/>`,
        front: `<path d="M24 38 Q27 21 50 20 Q73 21 76 38 Q65 29 50 29 Q35 29 24 38Z" fill="${c}"/>
                <path d="M40 22 Q50 17 60 22" stroke="${shade}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
      };
    case 'v07': // Curly
      return {
        back: `<ellipse cx="50" cy="31" rx="28" ry="21" fill="${c}"/>
               <circle cx="23" cy="40" r="8" fill="${c}"/>
               <circle cx="77" cy="40" r="8" fill="${c}"/>
               <circle cx="20" cy="52" r="7" fill="${c}"/>
               <circle cx="80" cy="52" r="7" fill="${c}"/>`,
        front: `<path d="M24 40 Q26 20 50 18 Q74 20 76 40 Q68 28 58 30 Q54 26 50 28 Q46 26 42 30 Q32 28 24 40Z" fill="${c}"/>
                <circle cx="32" cy="33" r="4" fill="${c}"/>
                <circle cx="68" cy="33" r="4" fill="${c}"/>`,
      };
    case 'v08': // Pixie
      return {
        back: `<ellipse cx="50" cy="30" rx="24" ry="17" fill="${c}"/>
               <rect x="26" y="28" width="6" height="10" rx="3" fill="${c}"/>
               <rect x="68" y="28" width="6" height="10" rx="3" fill="${c}"/>`,
        front: `<path d="M26 38 Q29 22 50 21 Q71 22 74 38 Q66 29 58 31 Q54 27 50 29 Q46 27 42 31 Q34 29 26 38Z" fill="${c}"/>
                <path d="M36 25 Q42 19 50 20" stroke="${c}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
                <path d="M64 25 Q58 19 50 20" stroke="${shade}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                <path d="M30 32 Q28 25 32 22" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      };
    case 'v09': // Braids
      return {
        back: `<ellipse cx="50" cy="30" rx="26" ry="19" fill="${c}"/>
               <rect x="24" y="28" width="7" height="11" rx="4" fill="${c}"/>
               <rect x="69" y="28" width="7" height="11" rx="4" fill="${c}"/>
               <path d="M26 40 Q22 55 24 70 Q26 80 28 85 Q24 70 26 60 Q28 50 26 40Z" fill="${c}" stroke="${shade}" stroke-width="1"/>
               <path d="M74 40 Q78 55 76 70 Q74 80 72 85 Q76 70 74 60 Q72 50 74 40Z" fill="${c}" stroke="${shade}" stroke-width="1"/>`,
        front: `<path d="M24 39 Q27 21 50 20 Q73 21 76 39 Q65 30 50 30 Q35 30 24 39Z" fill="${c}"/>`,
      };
    case 'v10': // Side-swept
      return {
        back: `<ellipse cx="50" cy="30" rx="27" ry="19" fill="${c}"/>
               <path d="M23 30 Q20 50 22 70 Q24 78 26 75 Q23 60 25 42Z" fill="${c}"/>
               <rect x="68" y="28" width="7" height="12" rx="4" fill="${c}"/>`,
        front: `<path d="M24 40 Q27 20 50 19 Q74 20 76 36 Q65 28 52 28 Q40 26 30 32 Q25 36 24 40Z" fill="${c}"/>
                <path d="M24 40 Q24 30 30 24 Q38 20 50 20" stroke="${shade}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
      };
    case 'v11': // Twintails
      return {
        back: `<ellipse cx="50" cy="30" rx="26" ry="18" fill="${c}"/>
               <rect x="24" y="28" width="7" height="10" rx="4" fill="${c}"/>
               <rect x="69" y="28" width="7" height="10" rx="4" fill="${c}"/>
               <path d="M24 38 Q14 50 16 70 Q18 82 22 88 Q14 74 14 58 Q14 46 22 38Z" fill="${c}"/>
               <path d="M76 38 Q86 50 84 70 Q82 82 78 88 Q86 74 86 58 Q86 46 78 38Z" fill="${c}"/>`,
        front: `<path d="M24 38 Q27 21 50 20 Q73 21 76 38 Q65 29 50 29 Q35 29 24 38Z" fill="${c}"/>
                <circle cx="27" cy="35" r="3.5" fill="${shade}"/>
                <circle cx="73" cy="35" r="3.5" fill="${shade}"/>`,
      };
    default:
      return getHair('v01', color);
  }
}

// ── Expressions ───────────────────────────────────────────────────────────────
// Returns { eyes, eyebrows, mouth, blush }
function getExpression(expr) {
  switch (expr) {
    case 'cheery':
      return {
        eyes: `<path d="M36 46 Q40 42 44 46" stroke="#3d2b1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>
               <path d="M56 46 Q60 42 64 46" stroke="#3d2b1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
        eyebrows: `<path d="M34 41 Q40 38 45 40" stroke="#3d2b1f" stroke-width="1.6" fill="none" stroke-linecap="round"/>
                   <path d="M55 40 Q60 38 66 41" stroke="#3d2b1f" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M40 60 Q50 68 60 60" stroke="#c0627a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
        blush: true,
      };
    case 'curious':
      return {
        eyes: `<circle cx="40" cy="46" r="4.5" fill="#3d2b1f"/>
               <circle cx="60" cy="45" r="5.2" fill="#3d2b1f"/>
               <circle cx="42" cy="44.5" r="1.3" fill="white"/>
               <circle cx="62" cy="43.5" r="1.5" fill="white"/>`,
        eyebrows: `<path d="M34 40 Q40 37 46 39" stroke="#3d2b1f" stroke-width="1.6" fill="none" stroke-linecap="round"/>
                   <path d="M54 37 Q60 34 67 37" stroke="#3d2b1f" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M44 62 Q50 60 56 62" stroke="#c0627a" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
        blush: false,
      };
    case 'happy':
      return {
        eyes: `<circle cx="40" cy="46" r="5.5" fill="#3d2b1f"/>
               <circle cx="60" cy="46" r="5.5" fill="#3d2b1f"/>
               <circle cx="42" cy="44" r="1.8" fill="white"/>
               <circle cx="62" cy="44" r="1.8" fill="white"/>
               <circle cx="44" cy="46.5" r="0.9" fill="white"/>
               <circle cx="64" cy="46.5" r="0.9" fill="white"/>`,
        eyebrows: `<path d="M33 39 Q40 35 47 38" stroke="#3d2b1f" stroke-width="1.8" fill="none" stroke-linecap="round"/>
                   <path d="M53 38 Q60 35 67 39" stroke="#3d2b1f" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M37 59 Q50 72 63 59" stroke="#c0627a" stroke-width="2.2" fill="rgba(220,100,120,0.18)" stroke-linecap="round"/>`,
        blush: true,
      };
    case 'sleepy':
      return {
        eyes: `<path d="M35 46 Q40 50 45 46" stroke="#3d2b1f" stroke-width="2.4" fill="none" stroke-linecap="round"/>
               <path d="M55 46 Q60 50 65 46" stroke="#3d2b1f" stroke-width="2.4" fill="none" stroke-linecap="round"/>
               <line x1="36" y1="45" x2="44" y2="45" stroke="#3d2b1f" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
               <line x1="56" y1="45" x2="64" y2="45" stroke="#3d2b1f" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>`,
        eyebrows: `<path d="M35 41 Q40 42 45 41" stroke="#3d2b1f" stroke-width="2" fill="none" stroke-linecap="round"/>
                   <path d="M55 41 Q60 42 65 41" stroke="#3d2b1f" stroke-width="2" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M45 62 Q50 64 55 62" stroke="#c0627a" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
        blush: 'light',
      };
    case 'excited':
      return {
        eyes: `<circle cx="40" cy="46" r="5.5" fill="#3d2b1f"/>
               <circle cx="60" cy="46" r="5.5" fill="#3d2b1f"/>
               <circle cx="42" cy="44" r="1.6" fill="white"/>
               <circle cx="62" cy="44" r="1.6" fill="white"/>
               <circle cx="44.5" cy="47" r="0.9" fill="white"/>
               <circle cx="64.5" cy="47" r="0.9" fill="white"/>
               <circle cx="38" cy="47.5" r="0.6" fill="white"/>
               <circle cx="58" cy="47.5" r="0.6" fill="white"/>`,
        eyebrows: `<path d="M32 38 Q40 33 47 36" stroke="#3d2b1f" stroke-width="1.9" fill="none" stroke-linecap="round"/>
                   <path d="M53 36 Q60 33 68 38" stroke="#3d2b1f" stroke-width="1.9" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M35 58 Q50 74 65 58" stroke="#c0627a" stroke-width="2.4" fill="rgba(220,100,120,0.2)" stroke-linecap="round"/>`,
        blush: true,
      };
    case 'calm':
      return {
        eyes: `<circle cx="40" cy="46" r="4.8" fill="#3d2b1f"/>
               <circle cx="60" cy="46" r="4.8" fill="#3d2b1f"/>
               <circle cx="42" cy="44.5" r="1.4" fill="white"/>
               <circle cx="62" cy="44.5" r="1.4" fill="white"/>`,
        eyebrows: `<path d="M35 41 Q40 39 45 41" stroke="#3d2b1f" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                   <path d="M55 41 Q60 39 65 41" stroke="#3d2b1f" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M43 62 Q50 66 57 62" stroke="#c0627a" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
        blush: false,
      };
    case 'wink':
      return {
        eyes: `<circle cx="40" cy="46" r="4.8" fill="#3d2b1f"/>
               <circle cx="41.5" cy="44.5" r="1.3" fill="white"/>
               <path d="M55 46 Q60 42 65 46" stroke="#3d2b1f" stroke-width="2.5" fill="none" stroke-linecap="round"/>
               <path d="M56 48 L58 47" stroke="#3d2b1f" stroke-width="1.3" stroke-linecap="round"/>
               <path d="M62 48 L64 47" stroke="#3d2b1f" stroke-width="1.3" stroke-linecap="round"/>`,
        eyebrows: `<path d="M34 40 Q40 37 46 40" stroke="#3d2b1f" stroke-width="1.6" fill="none" stroke-linecap="round"/>
                   <path d="M54 37 Q60 34 66 38" stroke="#3d2b1f" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M41 61 Q50 67 59 61" stroke="#c0627a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
        blush: 'right',
      };
    case 'heart':
      return {
        eyes: `<path d="M37 43 C37 41 39 40 40 41.5 C41 40 43 41 43 43 C43 45 40 48 40 48 C40 48 37 45 37 43Z" fill="#ff4d6d"/>
               <path d="M57 43 C57 41 59 40 60 41.5 C61 40 63 41 63 43 C63 45 60 48 60 48 C60 48 57 45 57 43Z" fill="#ff4d6d"/>`,
        eyebrows: `<path d="M35 39 Q40 37 45 39" stroke="#3d2b1f" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                   <path d="M55 39 Q60 37 65 39" stroke="#3d2b1f" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
        mouth: `<path d="M40 60 Q50 68 60 60" stroke="#c0627a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
        blush: 'strong',
      };
    default:
      return getExpression('cheery');
  }
}

// ── Glasses ───────────────────────────────────────────────────────────────────
function getGlasses(style) {
  switch (style) {
    case 'g1': // Regular
      return `<rect x="30" y="42" width="16" height="13" rx="4" fill="none" stroke="#5a5a7a" stroke-width="1.8"/>
              <rect x="54" y="42" width="16" height="13" rx="4" fill="none" stroke="#5a5a7a" stroke-width="1.8"/>
              <line x1="46" y1="48" x2="54" y2="48" stroke="#5a5a7a" stroke-width="1.5"/>
              <line x1="30" y1="47" x2="24" y2="45" stroke="#5a5a7a" stroke-width="1.5"/>
              <line x1="70" y1="47" x2="76" y2="45" stroke="#5a5a7a" stroke-width="1.5"/>`;
    case 'g2': // Shades
      return `<rect x="30" y="42" width="16" height="13" rx="4" fill="#2a2a2a" fill-opacity="0.85" stroke="#1a1a1a" stroke-width="1.8"/>
              <rect x="54" y="42" width="16" height="13" rx="4" fill="#2a2a2a" fill-opacity="0.85" stroke="#1a1a1a" stroke-width="1.8"/>
              <line x1="46" y1="48" x2="54" y2="48" stroke="#1a1a1a" stroke-width="1.5"/>
              <line x1="30" y1="47" x2="24" y2="45" stroke="#1a1a1a" stroke-width="1.5"/>
              <line x1="70" y1="47" x2="76" y2="45" stroke="#1a1a1a" stroke-width="1.5"/>
              <line x1="32" y1="44" x2="38" y2="45" stroke="white" stroke-width="1" stroke-linecap="round" opacity="0.4"/>
              <line x1="56" y1="44" x2="62" y2="45" stroke="white" stroke-width="1" stroke-linecap="round" opacity="0.4"/>`;
    case 'g3': // Nerd
      return `<rect x="28" y="41" width="18" height="14" rx="2" fill="none" stroke="#7b4b2a" stroke-width="2.5"/>
              <rect x="54" y="41" width="18" height="14" rx="2" fill="none" stroke="#7b4b2a" stroke-width="2.5"/>
              <line x1="46" y1="48" x2="54" y2="48" stroke="#7b4b2a" stroke-width="2"/>
              <line x1="28" y1="47" x2="22" y2="45" stroke="#7b4b2a" stroke-width="2"/>
              <line x1="72" y1="47" x2="78" y2="45" stroke="#7b4b2a" stroke-width="2"/>`;
    case 'g4': // Cat-eye
      return `<path d="M29 50 Q33 41 44 41 Q47 41 46 47 Q45 52 38 52 Q31 52 29 50Z" fill="none" stroke="#c070d0" stroke-width="2" stroke-linejoin="round"/>
              <path d="M54 47 Q53 41 64 41 Q72 40 71 48 Q70 53 62 53 Q55 53 54 47Z" fill="none" stroke="#c070d0" stroke-width="2" stroke-linejoin="round"/>
              <line x1="46" y1="47" x2="54" y2="47" stroke="#c070d0" stroke-width="1.5"/>
              <line x1="29" y1="49" x2="23" y2="46" stroke="#c070d0" stroke-width="1.5"/>
              <line x1="71" y1="47" x2="77" y2="44" stroke="#c070d0" stroke-width="1.5"/>`;
    case 'g5': // Round
      return `<circle cx="37" cy="48" r="7.5" fill="none" stroke="#6a90c0" stroke-width="1.8"/>
              <circle cx="63" cy="48" r="7.5" fill="none" stroke="#6a90c0" stroke-width="1.8"/>
              <line x1="44.5" y1="48" x2="55.5" y2="48" stroke="#6a90c0" stroke-width="1.5"/>
              <line x1="29.5" y1="47" x2="24" y2="45" stroke="#6a90c0" stroke-width="1.5"/>
              <line x1="70.5" y1="47" x2="76" y2="45" stroke="#6a90c0" stroke-width="1.5"/>`;
    default:
      return '';
  }
}

// ── Outfits ───────────────────────────────────────────────────────────────────
function getOutfit(style) {
  switch (style) {
    case 'o1': // Casual light-blue t-shirt
      return `<path d="M0 100 Q15 72 35 72 Q42 78 50 78 Q58 78 65 72 Q85 72 100 100Z" fill="#a8d8ea"/>
              <path d="M35 72 Q42 78 50 78 Q58 78 65 72" fill="none" stroke="#8cc0d4" stroke-width="1.5" stroke-linecap="round"/>`;
    case 'o2': // Cute pink dress with bow
      return `<path d="M0 100 Q12 70 30 70 Q40 78 50 78 Q60 78 70 70 Q88 70 100 100Z" fill="#ffb8d0"/>
              <path d="M30 70 Q40 78 50 78 Q60 78 70 70" fill="none" stroke="#f090b0" stroke-width="1.2"/>
              <path d="M46 73 Q50 70 54 73 Q52 76 50 74 Q48 76 46 73Z" fill="#f060a0"/>
              <circle cx="50" cy="72" r="2" fill="#f060a0"/>`;
    case 'o3': // Floral yellow
      return `<path d="M0 100 Q14 72 32 72 Q41 79 50 79 Q59 79 68 72 Q86 72 100 100Z" fill="#fff0a0"/>
              <path d="M32 72 Q41 79 50 79 Q59 79 68 72" fill="none" stroke="#e0d060" stroke-width="1.2"/>
              <circle cx="40" cy="77" r="2.5" fill="#ff9999"/>
              <circle cx="40" cy="77" r="1" fill="#ffff80"/>
              <circle cx="55" cy="80" r="2.5" fill="#99ddff"/>
              <circle cx="55" cy="80" r="1" fill="#ffff80"/>
              <circle cx="63" cy="75" r="2" fill="#ffb870"/>
              <circle cx="63" cy="75" r="0.8" fill="#ffff80"/>`;
    case 'o4': // Sporty blue zip-up
      return `<path d="M0 100 Q13 71 31 71 Q40 78 50 78 Q60 78 69 71 Q87 71 100 100Z" fill="#6098d8"/>
              <path d="M31 71 Q40 78 50 78 Q60 78 69 71" fill="none" stroke="#4078b8" stroke-width="1.2"/>
              <line x1="50" y1="72" x2="50" y2="100" stroke="#4078b8" stroke-width="2"/>
              <rect x="47" y="72" width="3" height="5" rx="1" fill="#d0e8ff"/>`;
    case 'o5': // Smart lavender blazer
      return `<path d="M0 100 Q12 70 28 70 Q36 78 50 78 Q64 78 72 70 Q88 70 100 100Z" fill="#c8b0e8"/>
              <path d="M28 70 Q36 78 50 78" fill="none" stroke="white" stroke-width="2"/>
              <path d="M72 70 Q64 78 50 78" fill="none" stroke="white" stroke-width="2"/>
              <path d="M28 70 Q26 80 24 95" stroke="#b090d0" stroke-width="3" fill="none" stroke-linecap="round"/>
              <path d="M72 70 Q74 80 76 95" stroke="#b090d0" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case 'o6': // Academic green sweater
      return `<path d="M0 100 Q13 70 30 70 Q36 76 50 76 Q64 76 70 70 Q87 70 100 100Z" fill="#88c890"/>
              <path d="M30 70 Q36 76 50 76 Q64 76 70 70" fill="none" stroke="#60a870" stroke-width="1.5"/>
              <rect x="24" y="70" width="52" height="4" rx="2" fill="#60a870" opacity="0.6"/>
              <line x1="30" y1="77" x2="70" y2="77" stroke="#60a870" stroke-width="1" opacity="0.5"/>`;
    case 'o7': // Cozy peach fluffy sweater
      return `<path d="M0 100 Q14 72 30 70 Q38 78 50 78 Q62 78 70 70 Q86 72 100 100Z" fill="#f5c8a0"/>
              <path d="M30 70 Q38 78 50 78 Q62 78 70 70" fill="none" stroke="#e0a870" stroke-width="1.5"/>
              <path d="M18 80 Q22 76 26 80 Q30 76 34 80" stroke="#e0a870" stroke-width="1.5" fill="none" stroke-linecap="round"/>
              <path d="M66 80 Q70 76 74 80 Q78 76 82 80" stroke="#e0a870" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
    case 'o8': // Boho warm orange with fringe
      return `<path d="M0 100 Q14 70 30 69 Q39 78 50 78 Q61 78 70 69 Q86 70 100 100Z" fill="#e89050"/>
              <path d="M30 69 Q39 78 50 78 Q61 78 70 69" fill="none" stroke="#c07030" stroke-width="1.5"/>
              <line x1="28" y1="69" x2="25" y2="76" stroke="#c07030" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="34" y1="68" x2="32" y2="75" stroke="#c07030" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="63" y1="68" x2="61" y2="75" stroke="#c07030" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="69" y1="69" x2="67" y2="76" stroke="#c07030" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="40" y1="70" x2="39" y2="77" stroke="#c07030" stroke-width="1.2" stroke-linecap="round"/>
              <line x1="50" y1="70" x2="50" y2="78" stroke="#c07030" stroke-width="1.2" stroke-linecap="round"/>
              <line x1="60" y1="70" x2="59" y2="77" stroke="#c07030" stroke-width="1.2" stroke-linecap="round"/>`;
    default:
      return getOutfit('o1');
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────
function shadeColor(hex, percent) {
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = Math.max(0, Math.min(255, r + percent));
  g = Math.max(0, Math.min(255, g + percent));
  b = Math.max(0, Math.min(255, b + percent));
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ── Main generator ────────────────────────────────────────────────────────────
export function generateAvatarSVG(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const skin = `#${o.skinColor}`;
  const skinShade = shadeColor(o.skinColor, -15);
  const bg = `#${o.bgColor}`;

  const hair = getHair(o.hairStyle, o.hairColor);
  const expr = getExpression(o.expression);
  const glassesStr = o.glasses ? getGlasses(o.glasses) : '';
  const outfitStr = getOutfit(o.outfit);

  // Blush
  let blushStr = '';
  if (expr.blush === true || expr.blush === 'strong') {
    const op = expr.blush === 'strong' ? '0.45' : '0.3';
    blushStr = `<ellipse cx="29" cy="57" rx="7" ry="4" fill="#ffb0c8" opacity="${op}"/>
                <ellipse cx="71" cy="57" rx="7" ry="4" fill="#ffb0c8" opacity="${op}"/>`;
  } else if (expr.blush === 'light') {
    blushStr = `<ellipse cx="29" cy="57" rx="6" ry="3.5" fill="#ffb0c8" opacity="0.18"/>
                <ellipse cx="71" cy="57" rx="6" ry="3.5" fill="#ffb0c8" opacity="0.18"/>`;
  } else if (expr.blush === 'right') {
    blushStr = `<ellipse cx="71" cy="57" rx="7" ry="4" fill="#ffb0c8" opacity="0.3"/>`;
  }

  // Earrings
  const earringsStr = o.earrings
    ? `<circle cx="25.5" cy="59" r="2.5" fill="#f0d060" stroke="#c8a820" stroke-width="0.8"/>
       <circle cx="74.5" cy="59" r="2.5" fill="#f0d060" stroke="#c8a820" stroke-width="0.8"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <clipPath id="cc"><circle cx="50" cy="50" r="50"/></clipPath>
  </defs>
  <g clip-path="url(#cc)">
    <!-- Background -->
    <circle cx="50" cy="50" r="50" fill="${bg}"/>

    <!-- Hair back layer -->
    ${hair.back}

    <!-- Face -->
    <ellipse cx="50" cy="53" rx="25" ry="29" fill="${skin}"/>

    <!-- Ears -->
    <ellipse cx="25" cy="53" rx="4.5" ry="6.5" fill="${skin}"/>
    <ellipse cx="75" cy="53" rx="4.5" ry="6.5" fill="${skin}"/>
    <ellipse cx="24.5" cy="53" rx="2.2" ry="3.5" fill="${skinShade}" opacity="0.35"/>
    <ellipse cx="75.5" cy="53" rx="2.2" ry="3.5" fill="${skinShade}" opacity="0.35"/>

    <!-- Earrings -->
    ${earringsStr}

    <!-- Blush -->
    ${blushStr}

    <!-- Eyebrows -->
    ${expr.eyebrows}

    <!-- Eyes -->
    ${expr.eyes}

    <!-- Nose -->
    <circle cx="50" cy="57" r="1.2" fill="rgba(120,60,30,0.3)"/>

    <!-- Mouth -->
    ${expr.mouth}

    <!-- Glasses -->
    ${glassesStr}

    <!-- Hair front -->
    ${hair.front}

    <!-- Outfit -->
    ${outfitStr}
  </g>
</svg>`;
}

export default generateAvatarSVG;
