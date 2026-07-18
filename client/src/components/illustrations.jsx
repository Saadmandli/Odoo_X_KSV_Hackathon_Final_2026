import { useId } from "react";

/**
 * Hand-drawn artwork for the product, as inline SVG.
 *
 * Deliberately not photography. The rest of the app already self-hosts its
 * typeface so a venue network that blocks a CDN cannot change how the product
 * looks — a hero photo fetched from an image host would reintroduce exactly the
 * dependency that decision removed, and a broken image on the sign-in screen is
 * worse than no image at all. Vector artwork ships in the bundle, scales to any
 * display without a second asset, and is drawn from the brand ramp so it can
 * never drift out of palette.
 *
 * Every export is decorative: it carries aria-hidden and no accessible name, so
 * a screen reader is never made to describe scenery.
 */

/* The brand ramp, repeated here so the artwork reads as a single palette rather
   than a pile of hex codes chosen per shape. Matches tailwind.config brand.*  */
const C = {
  b50: "#ecfdf5",
  b100: "#d1fae5",
  b200: "#a7f3d0",
  b300: "#6ee7b7",
  b400: "#34d399",
  b500: "#10b981",
  b600: "#059669",
  b700: "#047857",
  b800: "#065f46",
  b900: "#064e3b",
  sun: "#fbbf24",
  sunSoft: "#fde68a",
  glass: "#bae6fd",
  lamp: "#fca5a5",
};

/**
 * The commute, drawn: a road running to the horizon with a car on it, trees
 * either side, hills and a wind turbine behind.
 *
 * It states the product's premise before a word is read — this is about
 * travelling together, and it is about travelling cleanly.
 */
export function CommuteScene({ className = "" }) {
  // Gradients live in <defs> and are referenced by id. The component can appear
  // more than once on a page, so the ids are per-instance rather than global —
  // duplicate ids would make one instance adopt the other's fills.
  const uid = useId().replace(/:/g, "");
  const sky = `sky-${uid}`;
  const road = `road-${uid}`;
  const far = `far-${uid}`;
  const near = `near-${uid}`;
  const glow = `glow-${uid}`;

  return (
    <svg
      viewBox="0 0 520 360"
      className={className}
      role="presentation"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0fdfa" />
          <stop offset="100%" stopColor={C.b100} />
        </linearGradient>
        <linearGradient id={far} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.b200} />
          <stop offset="100%" stopColor={C.b300} />
        </linearGradient>
        <linearGradient id={near} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.b300} />
          <stop offset="100%" stopColor={C.b400} />
        </linearGradient>
        {/* Darkest at the bottom, lightest at the horizon, so the road reads as
            receding rather than as a flat wedge. */}
        <linearGradient id={road} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <radialGradient id={glow}>
          <stop offset="0%" stopColor={C.sunSoft} stopOpacity="0.85" />
          <stop offset="100%" stopColor={C.sunSoft} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* sky and ground ------------------------------------------------- */}
      <rect x="0" y="0" width="520" height="360" fill={`url(#${sky})`} />
      <rect x="0" y="200" width="520" height="160" fill={C.b100} />

      {/* sun ------------------------------------------------------------ */}
      <circle cx="410" cy="86" r="62" fill={`url(#${glow})`} />
      <circle cx="410" cy="86" r="30" fill={C.sun} />

      {/* clouds --------------------------------------------------------- */}
      <g fill="#ffffff" opacity="0.8">
        <ellipse cx="118" cy="72" rx="26" ry="17" />
        <ellipse cx="146" cy="66" rx="32" ry="21" />
        <ellipse cx="178" cy="74" rx="22" ry="14" />
        <ellipse cx="300" cy="46" rx="19" ry="12" />
        <ellipse cx="322" cy="42" rx="24" ry="15" />
      </g>

      {/* hills ---------------------------------------------------------- */}
      <path
        d="M0,200 C40,166 92,156 142,176 C192,196 232,150 292,158 C352,166 402,188 452,174 C482,166 506,178 520,171 L520,200 Z"
        fill={`url(#${far})`}
      />
      <path
        d="M0,200 C56,184 108,177 168,190 C228,203 278,180 338,186 C398,192 460,201 520,193 L520,200 Z"
        fill={`url(#${near})`}
      />

      {/* wind turbine — the scene's one explicit note that this is clean travel */}
      <g stroke={C.b700} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.72">
        <path d="M92,178 L92,132" />
        <path d="M92,132 L92,106" />
        <path d="M92,132 L115,147" />
        <path d="M92,132 L69,147" />
      </g>
      <circle cx="92" cy="132" r="3.4" fill={C.b700} opacity="0.72" />

      {/* road ----------------------------------------------------------- */}
      <path
        d="M150,360 C190,300 226,250 243,200 L277,200 C295,250 350,304 410,360 Z"
        fill={`url(#${road})`}
      />
      {/* Centre line. Each dash is shorter, narrower and nudged toward the
          vanishing point, which is what sells the perspective. */}
      <g fill="#f8fafc" opacity="0.9">
        <rect x="274.5" y="336" width="7" height="18" rx="3" />
        <rect x="270.4" y="300" width="6" height="15" rx="2.6" />
        <rect x="267" y="270" width="5" height="12" rx="2.2" />
        <rect x="264" y="245" width="4" height="9" rx="1.8" />
        <rect x="262" y="226" width="3.2" height="7" rx="1.5" />
        <rect x="260.2" y="210" width="2.6" height="5" rx="1.2" />
      </g>

      {/* car, seen from behind, heading for the horizon ------------------ */}
      <g>
        <ellipse cx="272" cy="330" rx="52" ry="8" fill="#0f172a" opacity="0.12" />
        {/* wheels first, so the body sits over them */}
        <rect x="230" y="308" width="16" height="14" rx="4" fill="#1e293b" />
        <rect x="298" y="308" width="16" height="14" rx="4" fill="#1e293b" />
        {/* cabin */}
        <path d="M244,264 h56 a10,10 0 0 1 9,7 l6,20 h-86 l6,-20 a10,10 0 0 1 9,-7 z" fill={C.b600} />
        <path d="M250,270 h44 a6,6 0 0 1 5,4 l4,13 h-62 l4,-13 a6,6 0 0 1 5,-4 z" fill={C.glass} />
        {/* body */}
        <rect x="226" y="288" width="92" height="30" rx="9" fill={C.b700} />
        {/* tail lights */}
        <rect x="233" y="297" width="13" height="8" rx="3" fill={C.lamp} />
        <rect x="298" y="297" width="13" height="8" rx="3" fill={C.lamp} />
        {/* plate */}
        <rect x="262" y="303" width="20" height="7" rx="2" fill={C.b100} />
      </g>

      {/* trees ---------------------------------------------------------- */}
      <Tree x={70} y={336} r={30} />
      <Tree x={128} y={288} r={20} />
      <Tree x={174} y={244} r={13} />
      <Tree x={452} y={342} r={32} />
      <Tree x={400} y={288} r={21} />
      <Tree x={332} y={242} r={13} />
    </svg>
  );
}

/**
 * One roadside tree. Scaled entirely from its canopy radius so a single number
 * places it at any depth in the scene and the trunk stays in proportion.
 */
function Tree({ x, y, r }) {
  const trunkW = Math.max(3, r * 0.22);
  const trunkH = r * 0.85;

  return (
    <g>
      <rect x={x - trunkW / 2} y={y - trunkH} width={trunkW} height={trunkH} rx={trunkW / 3} fill="#78716c" />
      <circle cx={x - r * 0.58} cy={y - trunkH - r * 0.45} r={r * 0.72} fill={C.b500} />
      <circle cx={x + r * 0.58} cy={y - trunkH - r * 0.45} r={r * 0.72} fill={C.b500} />
      <circle cx={x} cy={y - trunkH - r * 0.95} r={r} fill={C.b600} />
      {/* A lighter cap on the sunward side keeps the canopy from reading flat. */}
      <circle cx={x + r * 0.28} cy={y - trunkH - r * 1.15} r={r * 0.52} fill={C.b500} opacity="0.75" />
    </g>
  );
}

/**
 * Two people and a car, for places that need a lighter touch than the full
 * scene — an empty trip list, or a panel beside a form.
 */
export function RideTogetherArt({ className = "" }) {
  const uid = useId().replace(/:/g, "");
  const ring = `ring-${uid}`;

  return (
    <svg
      viewBox="0 0 240 180"
      className={className}
      role="presentation"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.b100} />
          <stop offset="100%" stopColor={C.b200} />
        </linearGradient>
      </defs>

      <circle cx="120" cy="92" r="74" fill={`url(#${ring})`} />

      {/* car, three-quarter */}
      <g>
        <ellipse cx="120" cy="140" rx="62" ry="9" fill="#0f172a" opacity="0.1" />
        <path
          d="M70,126 v-14 a8,8 0 0 1 5,-7 l12,-18 a12,12 0 0 1 10,-6 h46 a12,12 0 0 1 10,6 l12,18 a8,8 0 0 1 5,7 v14 a6,6 0 0 1 -6,6 h-88 a6,6 0 0 1 -6,-6 z"
          fill={C.b700}
        />
        <path d="M92,92 h16 v18 h-28 z" fill={C.glass} />
        <path d="M116,92 h24 a4,4 0 0 1 3,2 l10,16 h-37 z" fill={C.glass} />
        <circle cx="90" cy="132" r="11" fill="#1e293b" />
        <circle cx="150" cy="132" r="11" fill="#1e293b" />
        <circle cx="90" cy="132" r="4" fill={C.b200} />
        <circle cx="150" cy="132" r="4" fill={C.b200} />
      </g>

      {/* two riders, shown as the app's own initials-avatar shape */}
      <g>
        <circle cx="98" cy="58" r="16" fill={C.b600} />
        <circle cx="98" cy="53" r="6" fill={C.b100} />
        <path d="M86,68 a12,12 0 0 1 24,0 z" fill={C.b100} />
        <circle cx="142" cy="58" r="16" fill={C.b800} />
        <circle cx="142" cy="53" r="6" fill={C.b100} />
        <path d="M130,68 a12,12 0 0 1 24,0 z" fill={C.b100} />
      </g>

      {/* a leaf, tying the pair back to the eco premise */}
      <g transform="translate(176,40)">
        <path
          d="M0,20 A14,14 0 0 1 12,0 C20,6 22,14 18,22 C14,29 6,28 0,20 Z"
          fill={C.b500}
        />
        <path d="M2,22 C6,16 10,11 16,7" stroke={C.b100} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * An empty road. Used where there is nothing to show yet — no trips, no
 * results — because a blank card reads as a bug and a drawn one reads as a
 * state.
 */
export function EmptyRoadArt({ className = "" }) {
  return (
    <svg
      viewBox="0 0 200 140"
      className={className}
      role="presentation"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="100" cy="70" r="58" fill={C.b50} />
      <path d="M64,132 C78,96 92,66 96,44 L104,44 C108,66 122,96 136,132 Z" fill="#e2e8f0" />
      <g fill="#ffffff">
        <rect x="97.4" y="112" width="5.2" height="13" rx="2.2" />
        <rect x="98.2" y="88" width="4.2" height="10" rx="1.8" />
        <rect x="98.8" y="69" width="3.2" height="7" rx="1.4" />
        <rect x="99.2" y="55" width="2.4" height="5" rx="1" />
      </g>
      <Tree x={48} y={124} r={16} />
      <Tree x={154} y={126} r={18} />
      <circle cx="140" cy="34" r="13" fill={C.sunSoft} />
    </svg>
  );
}
