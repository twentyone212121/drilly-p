import { memo, useEffect, useRef } from "react";
import "./computer-background.css";

/** Decorative circuitry aligned with the background image's cover crop. */
export const ComputerBackground = memo(function ComputerBackground() {
  const surface = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const syncVisibility = () => {
      surface.current?.setAttribute("data-hidden", String(document.hidden));
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  return (
    <svg
      ref={surface}
      className="computer-background"
      viewBox="0 0 1599 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="ambient-cyan">
          <stop stopColor="#3cdbef" stopOpacity="0.25" />
          <stop offset="1" stopColor="#3cdbef" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ambient-violet">
          <stop stopColor="#a473ff" stopOpacity="0.26" />
          <stop offset="1" stopColor="#a473ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fan-recess">
          <stop stopColor="#18203b" />
          <stop offset="1" stopColor="#080e1e" />
        </radialGradient>
        <linearGradient id="fan-blade" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#373054" />
          <stop offset="0.55" stopColor="#211f3c" />
          <stop offset="1" stopColor="#131a2d" />
        </linearGradient>
      </defs>

      <g transform="translate(410 55) scale(1 1.06)">
        {/* Cover only the old rotor; the painted housing stays fixed. */}
        <circle r="83" fill="url(#fan-recess)" />
        <g className="fan-rotor">
          {[0, 72, 144, 216, 288].map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <path
                d="M -12 -22 C -34 -38 -40 -62 -22 -77 C 0 -83 28 -76 39 -60 C 8 -63 15 -38 9 -23 Z"
                fill="url(#fan-blade)"
                stroke="#343050"
                strokeWidth="1"
              />
              <path
                d="M -22 -76 Q 11 -79 35 -61"
                fill="none"
                stroke="#8663b5"
                strokeWidth="1.5"
                opacity="0.45"
              />
            </g>
          ))}
        </g>
        <circle r="28" fill="#11182a" stroke="#363051" strokeWidth="3" />
        <circle r="21" fill="#1a1d35" />
        <circle cx="-5" cy="-7" r="13" fill="#282541" opacity="0.45" />
      </g>

      <g className="ambient-breathe ambient-slow">
        <ellipse cx="410" cy="68" rx="155" ry="135" fill="url(#ambient-violet)" />
        <path
          d="M 491 18 A 83 83 0 0 1 480 109"
          stroke="#b487f5"
          strokeWidth="3"
          fill="none"
          opacity="0.6"
        />
      </g>
      <g className="ambient-breathe ambient-medium">
        <ellipse cx="70" cy="345" rx="115" ry="235" fill="url(#ambient-cyan)" />
        <path
          d="M 74 211 Q 17 300 68 403"
          stroke="#59d0ef"
          strokeWidth="4"
          fill="none"
          opacity="0.45"
        />
      </g>
      <g className="ambient-breathe ambient-fast">
        <ellipse cx="1430" cy="792" rx="210" ry="110" fill="url(#ambient-violet)" />
      </g>

      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          className="circuit-pulse circuit-cyan"
          d="M 380 194 H 465 L 500 215 H 655 L 687 190"
        />
        <path
          className="circuit-pulse circuit-violet"
          d="M 282 570 H 411 L 449 605 H 694 L 766 686 H 928"
        />
        <path className="circuit-pulse circuit-amber" d="M 969 662 H 1176 L 1230 609 H 1298" />
        <path
          className="circuit-pulse circuit-cyan circuit-offset"
          d="M 843 210 H 1071 L 1131 258 H 1284"
        />
      </g>

      {[
        [158, 116],
        [352, 412],
        [1213, 86],
        [1466, 348],
        [158, 640],
        [1263, 696],
      ].map(([x, y], index) => (
        <g key={index} transform={`translate(${x} ${y})`}>
          <rect x="-5" y="-5" width="23" height="49" rx="4" fill="#0b1c24" />
          <g className={`status-lights status-lights-${index % 3}`}>
            <rect x="-4" y="-3" width="21" height="45" rx="7" fill="#aff57a" opacity="0.1" />
            <path
              d="M 0 0 H 11 V 7 H 0 Z M 0 15 H 9 V 20 H 0 Z M 0 30 H 11 V 37 H 0 Z"
              fill={index % 2 ? "#73dfde" : "#b4ec7c"}
            />
          </g>
        </g>
      ))}

      <g className="broken-wire" fill="none" strokeLinecap="round">
        <path
          d="M 1520 37 C 1435 30 1360 57 1331 111 L 1306 164 M 1290 207 L 1282 247 Q 1275 273 1309 296"
          stroke="#020c15"
          strokeWidth="17"
        />
        <path
          d="M 1520 35 C 1435 28 1360 55 1331 109 L 1306 162 M 1290 207 L 1282 247 Q 1275 273 1309 296"
          stroke="#294657"
          strokeWidth="10"
        />
        <path
          d="M 1520 32 C 1435 25 1360 52 1331 106 L 1306 159 M 1287 210 L 1279 247"
          stroke="#537485"
          strokeWidth="2"
          opacity="0.6"
        />
        <path
          d="M 1304 161 L 1299 173 M 1308 162 L 1307 173 M 1288 208 L 1290 198 M 1293 209 L 1297 198"
          stroke="#c49360"
          strokeWidth="2"
        />
        <g className="wire-discharge">
          <circle cx="1302" cy="172" r="17" fill="url(#ambient-cyan)" />
          <circle cx="1293" cy="198" r="16" fill="url(#ambient-cyan)" />
          <path d="M 1302 171 L 1294 182 L 1302 184 L 1293 198" stroke="#7ce5f2" strokeWidth="2" />
          <path
            d="M 1302 171 L 1294 182 L 1302 184 L 1293 198"
            stroke="#ecffff"
            strokeWidth="0.7"
          />
          <path
            d="M 1296 166 L 1289 159 M 1310 172 L 1319 168 M 1289 201 L 1280 205 M 1300 200 L 1306 207"
            stroke="#ffe3a0"
            strokeWidth="1.6"
          />
        </g>
        <g className="wire-filings" stroke="#ffe4ad" strokeWidth="1.7">
          <path d="M 1282 180 l -4 -3 M 1317 187 l 4 2 M 1283 214 l -3 4 M 1307 220 l 2 4" />
        </g>
      </g>
    </svg>
  );
});
