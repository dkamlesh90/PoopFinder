// Generates all Expo icon assets from SVG using @resvg/resvg-js (pre-built binaries, no compilation).
// Run: node scripts/generate-icons.js

const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');

// ─── Icon SVG — 1024×1024 ────────────────────────────────────────────────────
// Purple gradient background, bold map-pin + toilet design

const ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9333EA"/>
      <stop offset="100%" stop-color="#3B0764"/>
    </linearGradient>
    <linearGradient id="pin" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="100%" stop-color="#EDE9FE" stop-opacity="1"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" rx="224" fill="url(#bg)"/>

  <!-- Subtle radial glow -->
  <circle cx="512" cy="420" r="380" fill="white" opacity="0.06"/>

  <!-- Map pin body -->
  <g filter="url(#shadow)">
    <!-- Pin circle -->
    <circle cx="512" cy="390" r="255" fill="url(#pin)"/>
    <!-- Pin tail -->
    <path d="M 352 590 Q 512 820 512 820 Q 512 820 672 590" fill="url(#pin)"/>
  </g>

  <!-- Toilet inside the pin -->
  <!-- Tank -->
  <rect x="432" y="270" width="160" height="95" rx="18" fill="#7C3AED"/>
  <!-- Tank lid -->
  <rect x="420" y="255" width="184" height="28" rx="14" fill="#6D28D9"/>
  <!-- Flush button -->
  <circle cx="560" cy="269" r="12" fill="#9333EA"/>

  <!-- Bowl outer -->
  <ellipse cx="512" cy="430" rx="115" ry="75" fill="#7C3AED"/>
  <!-- Bowl inner (water) -->
  <ellipse cx="512" cy="435" rx="88" ry="55" fill="#A78BFA"/>
  <!-- Water shimmer -->
  <ellipse cx="498" cy="428" rx="32" ry="12" fill="white" opacity="0.3"/>

  <!-- Seat -->
  <path d="M 397 390 Q 397 480 512 490 Q 627 480 627 390 Q 610 365 512 360 Q 414 365 397 390 Z" fill="none" stroke="#6D28D9" stroke-width="18" stroke-linecap="round"/>

  <!-- Base -->
  <rect x="462" y="497" width="100" height="28" rx="10" fill="#6D28D9"/>
  <rect x="442" y="520" width="140" height="18" rx="9" fill="#5B21B6"/>

  <!-- Location dot at bottom of pin -->
  <circle cx="512" cy="794" r="22" fill="white" opacity="0.9"/>
</svg>
`;

// ─── Adaptive icon foreground SVG — toilet centred on transparent bg ─────────

const ADAPTIVE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#3B0764" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Soft backing circle -->
  <circle cx="512" cy="490" r="340" fill="white" opacity="0.15"/>

  <g filter="url(#shadow)">
    <!-- Tank -->
    <rect x="392" y="300" width="240" height="130" rx="24" fill="white"/>
    <!-- Tank lid -->
    <rect x="374" y="278" width="276" height="38" rx="19" fill="white"/>
    <!-- Flush button -->
    <circle cx="570" cy="297" r="16" fill="#EDE9FE"/>

    <!-- Bowl outer -->
    <ellipse cx="512" cy="510" rx="160" ry="105" fill="white"/>
    <!-- Bowl inner -->
    <ellipse cx="512" cy="518" rx="122" ry="78" fill="#EDE9FE"/>
    <!-- Water shimmer -->
    <ellipse cx="496" cy="508" rx="44" ry="16" fill="white" opacity="0.6"/>

    <!-- Seat -->
    <path d="M 352 458 Q 352 572 512 584 Q 672 572 672 458 Q 650 424 512 414 Q 374 424 352 458 Z" fill="none" stroke="white" stroke-width="22" stroke-linecap="round"/>

    <!-- Base -->
    <rect x="452" y="604" width="120" height="36" rx="14" fill="white"/>
    <rect x="428" y="634" width="168" height="24" rx="12" fill="white" opacity="0.85"/>
  </g>
</svg>
`;

// ─── Favicon / web SVG ────────────────────────────────────────────────────────

const FAVICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9333EA"/>
      <stop offset="100%" stop-color="#3B0764"/>
    </linearGradient>
  </defs>
  <rect width="48" height="48" rx="12" fill="url(#bg)"/>
  <!-- Toilet (simplified) -->
  <rect x="16" y="10" width="16" height="9" rx="3" fill="white"/>
  <rect x="14" y="8" width="20" height="5" rx="2.5" fill="white"/>
  <ellipse cx="24" cy="27" rx="11" ry="8" fill="white"/>
  <ellipse cx="24" cy="28" rx="8" ry="6" fill="#A78BFA"/>
  <path d="M 13 22 Q 13 34 24 35 Q 35 34 35 22" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
  <rect x="19" y="34" width="10" height="4" rx="2" fill="white"/>
</svg>
`;

// ─── Splash screen SVG ────────────────────────────────────────────────────────

const SPLASH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9333EA"/>
      <stop offset="100%" stop-color="#3B0764"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="400" r="420" fill="white" opacity="0.05"/>
  <!-- Large toilet icon centred -->
  <g filter="url(#glow)" transform="translate(512,430) scale(1.6) translate(-512,-430)">
    <rect x="412" y="280" width="200" height="110" rx="22" fill="white"/>
    <rect x="396" y="260" width="232" height="34" rx="17" fill="white"/>
    <circle cx="558" cy="277" r="14" fill="#EDE9FE"/>
    <ellipse cx="512" cy="462" rx="135" ry="90" fill="white"/>
    <ellipse cx="512" cy="470" rx="104" ry="68" fill="#C4B5FD"/>
    <ellipse cx="498" cy="460" rx="37" ry="14" fill="white" opacity="0.4"/>
    <path d="M 377 416 Q 377 524 512 536 Q 647 524 647 416 Q 628 386 512 376 Q 396 386 377 416 Z" fill="none" stroke="white" stroke-width="20" stroke-linecap="round"/>
    <rect x="462" y="540" width="100" height="30" rx="12" fill="white"/>
    <rect x="442" y="565" width="140" height="20" rx="10" fill="white" opacity="0.85"/>
  </g>
  <!-- App name -->
  <text x="512" y="760" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="900" fill="white" letter-spacing="-2">Poop Finder</text>
  <text x="512" y="820" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="500" fill="rgba(255,255,255,0.7)">Find the best nearby restroom</text>
</svg>
`;

function render(svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

const jobs = [
  { file: 'icon.png',          svg: ICON_SVG,     size: 1024 },
  { file: 'adaptive-icon.png', svg: ADAPTIVE_SVG, size: 1024 },
  { file: 'favicon.png',       svg: FAVICON_SVG,  size: 48   },
  { file: 'splash-icon.png',   svg: SPLASH_SVG,   size: 1024 },
];

for (const { file, svg, size } of jobs) {
  const png = render(svg, size);
  const dest = path.join(ASSETS, file);
  fs.writeFileSync(dest, png);
  console.log(`✓ ${file} (${size}×${size})`);
}

console.log('\nAll icons written to assets/');
