// NAVAL CHESS – die Schiffe
// Jede Schachfigur ist ein kleines Schiff in Seitenansicht, gezeichnet als SVG (100 x 100 Einheiten).
// Weiß fährt nach rechts, Schwarz wird gespiegelt und fährt nach links.
//   König = Flaggschiff (Mast mit Kreuz + Wimpel)   Dame = Schlachtschiff (Krone auf dem Mast)
//   Turm  = Kreuzer (Burgturm mit Zinnen)            Läufer = Zerstörer (schräger Schornstein und Mast)
//   Springer = U-Boot (taucht unter den anderen durch)   Bauer = Patrouillenboot

export const NAMEN = { k: 'Flaggschiff', q: 'Schlachtschiff', r: 'Kreuzer', b: 'Zerstörer', n: 'U-Boot', p: 'Patrouillenboot' };

// ---------- Flotten-Farben ----------
// Die weiße Flotte hat immer helle Rümpfe, die schwarze immer dunkle – so bleiben beide Seiten klar erkennbar.
// rumpf/aufbau/dunkel sind Farbverläufe [oben, (mitte,) unten], der Rest einfache Farben.
const FARBSAETZE = {
  // helle Flotten (für Weiß)
  weiss:   { name: 'Weiß · Türkis',     hell: true,  rumpf: ['#f8fbfd', '#d2dde6', '#94a7b7'], aufbau: ['#ffffff', '#d3dee7'], dunkel: ['#a3b5c3', '#6b8091'], mast: '#7d91a2', akzent: '#2fe3c2', fenster: '#1d3a55' },
  eis:     { name: 'Eis · Blau',        hell: true,  rumpf: ['#eef7ff', '#c2d9ec', '#86a3bd'], aufbau: ['#f5fbff', '#cfe2f1'], dunkel: ['#9fb9cf', '#5f7c96'], mast: '#6f8ba3', akzent: '#6fc8ff', fenster: '#17324d' },
  gold:    { name: 'Elfenbein · Gold',  hell: true,  rumpf: ['#fffaf0', '#efe2c6', '#bfa77a'], aufbau: ['#fffdf7', '#efe4cc'], dunkel: ['#c9b58c', '#8c7650'], mast: '#8f7a55', akzent: '#f2c14e', fenster: '#3a2a12' },
  signal:  { name: 'Weiß · Signalrot',  hell: true,  rumpf: ['#fbfbfb', '#dcdfe2', '#a4aab0'], aufbau: ['#ffffff', '#e1e4e7'], dunkel: ['#b0b6bc', '#737b83'], mast: '#868d94', akzent: '#ff4d5e', fenster: '#2a2f36' },
  // dunkle Flotten (für Schwarz) – mit heller Kante, damit sie auf dem dunklen Meer gut zu sehen sind
  graphit: { name: 'Graphit · Bernstein', hell: false, rumpf: ['#5a6673', '#323b46', '#161b22'], aufbau: ['#6c7886', '#3b4450'], dunkel: ['#2e3640', '#141920'], mast: '#222a33', akzent: '#ffb547', fenster: '#ffc56a', kante: 'rgba(190,220,240,.62)' },
  tiefsee: { name: 'Tiefsee · Violett',   hell: false, rumpf: ['#4f4874', '#2c2752', '#14112b'], aufbau: ['#615b8a', '#37315e'], dunkel: ['#2a2548', '#110e24'], mast: '#1d1938', akzent: '#b892ff', fenster: '#d6c0ff', kante: 'rgba(210,195,255,.62)' },
  rost:    { name: 'Rost · Feuerrot',     hell: false, rumpf: ['#6e4c40', '#412b24', '#1d1310'], aufbau: ['#7d5d4f', '#48342b'], dunkel: ['#35251f', '#160f0c'], mast: '#2a1d18', akzent: '#ff6a4d', fenster: '#ffb08a', kante: 'rgba(255,212,192,.58)' },
  neon:    { name: 'Schwarz · Neongrün',  hell: false, rumpf: ['#3e4642', '#232927', '#0e1110'], aufbau: ['#4e5753', '#2b312e'], dunkel: ['#1f2522', '#0b0e0d'], mast: '#171c1a', akzent: '#5dff9a', fenster: '#a8ffc8', kante: 'rgba(190,255,215,.55)' },
};
export const FLOTTEN = {
  w: ['weiss', 'eis', 'gold', 'signal'].map((id) => ({ id, name: FARBSAETZE[id].name, akzent: FARBSAETZE[id].akzent, rumpf: FARBSAETZE[id].rumpf[1] })),
  b: ['graphit', 'tiefsee', 'rost', 'neon'].map((id) => ({ id, name: FARBSAETZE[id].name, akzent: FARBSAETZE[id].akzent, rumpf: FARBSAETZE[id].rumpf[1] })),
};
export const STANDARD_FLOTTE = { w: 'weiss', b: 'graphit' };

// Ein senkrechter Farbverlauf als SVG-Text
function verlauf(id, farben) {
  const stops = farben.map((f, i) => `<stop offset="${(i / (farben.length - 1)).toFixed(2)}" stop-color="${f}"/>`).join('');
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
}
// Alle Farbverläufe: einmal pro Seite in ein verstecktes <svg> gesetzt, alle Schiffe benutzen sie.
export const VERLAEUFE = Object.entries(FARBSAETZE).map(([id, s]) =>
  verlauf(`nc-${id}-rumpf`, s.rumpf) + verlauf(`nc-${id}-aufbau`, s.aufbau) + verlauf(`nc-${id}-dunkel`, s.dunkel)).join('')
  + '<radialGradient id="nc-schatten"><stop offset="0" stop-color="#000d1a" stop-opacity=".55"/><stop offset="1" stop-color="#000d1a" stop-opacity="0"/></radialGradient>';

// Rohe Farben eines Farbsatzes (für die 3D-Schiffe)
export function farbsatz(id, farbe) {
  if (!FARBSAETZE[id] || FARBSAETZE[id].hell !== (farbe === 'w')) id = STANDARD_FLOTTE[farbe];
  const s = FARBSAETZE[id];
  return { rumpf: s.rumpf[1], rumpfHell: s.rumpf[0], aufbau: s.aufbau[0], aufbauDunkel: s.aufbau[1], dunkel: s.dunkel[1], mast: s.mast, akzent: s.akzent, fenster: s.fenster, hell: s.hell };
}

// Zeichen-Palette für einen Farbsatz
function palette(id) {
  const s = FARBSAETZE[id];
  return {
    rumpf: `url(#nc-${id}-rumpf)`, aufbau: `url(#nc-${id}-aufbau)`, dunkel: `url(#nc-${id}-dunkel)`,
    mast: s.mast, akzent: s.akzent, fenster: s.fenster, licht: s.akzent,
    kante: s.hell ? 'rgba(6,24,40,.62)' : s.kante,
    glanz: s.hell ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.3)',
  };
}

// ---------- kleine Zeichen-Helfer ----------
const kante = (P, breite = 0.8) => ` stroke="${P.kante}" stroke-width="${breite}" stroke-linejoin="round"`;
const rechteck = (x, y, b, h, farbe, extra = '') => `<rect x="${x}" y="${y}" width="${b}" height="${h}" fill="${farbe}"${extra}/>`;
const pfad = (d, farbe, extra = '') => `<path d="${d}" fill="${farbe}"${extra}/>`;
const kreis = (x, y, r, farbe) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${farbe}"/>`;

// Fensterreihe (kleine Rechtecke)
function fenster(P, x1, x2, y, abstand, b = 2.2, h = 1.8) {
  let s = '';
  for (let x = x1; x <= x2 + 0.01; x += abstand) s += rechteck(+x.toFixed(2), y, b, h, P.fenster, ' rx=".4"');
  return s;
}
// runde Bullaugen im Rumpf
function bullaugen(P, x1, x2, y, abstand) {
  let s = '';
  for (let x = x1; x <= x2 + 0.01; x += abstand) s += kreis(+x.toFixed(2), y, 0.85, P.fenster);
  return s;
}

// Rumpf: Heck links (x1), Bug rechts (x2) mit schräg nach vorn gezogenem Steven.
// deck = Höhe des Decks, wl = Wasserlinie, bug = wie weit der Bug nach oben gezogen ist.
function rumpf(P, x1, x2, deck, wl, bug) {
  const bugY = deck - bug;             // Bugspitze oben
  const bugX = x2 - 9;                 // Bug unten an der Wasserlinie
  const t = (wl - 2.6 - bugY) / (wl - bugY);
  const streifenX = +(x2 - 9 * t).toFixed(2);
  return pfad(`M${x1},${deck} L${x2 - 12},${deck} Q${x2 - 4},${deck - 0.4} ${x2},${bugY} L${bugX},${wl} L${x1 + 4},${wl} Z`, P.rumpf, kante(P))
    // farbiger Streifen an der Wasserlinie
    + pfad(`M${x1 + 3.3},${wl - 2.6} L${streifenX},${wl - 2.6} L${bugX},${wl} L${x1 + 4},${wl} Z`, P.akzent, ' opacity=".9"')
    // Glanzlinie an der Deckkante
    + `<path d="M${x1 + 1},${deck + 0.8} L${x2 - 12},${deck + 0.8} Q${x2 - 4.5},${deck + 0.4} ${x2 - 1.2},${bugY + 1.3}" fill="none" stroke="${P.glanz}" stroke-width=".7" opacity=".75"/>`;
}

// Gischt: Schaumlinie an der Wasserlinie + Bugwelle vorne
function gischt(x1, x2, wl) {
  let d = `M${x1 + 3},${wl + 0.6}`;
  for (let x = x1 + 3; x < x2 - 14; x += 6) d += ' q1.5,-1.4 3,0 t3,0';
  return `<path d="${d}" fill="none" stroke="#e6fbff" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>`
    + pfad(`M${x2 - 14},${wl + 0.4} Q${x2 - 7},${wl - 0.6} ${x2 - 3.5},${wl - 4.2} Q${x2 - 4.5},${wl - 0.6} ${x2 + 1.5},${wl + 0.5} Z`, '#e6fbff', ' opacity=".85"');
}

// Geschützturm mit n Rohren. richtung 1 = Rohre nach vorne (rechts), -1 = nach hinten.
function geschuetz(P, x, y, b, h, lauf, n = 1, richtung = 1) {
  let s = '';
  const abstand = n > 1 ? Math.min(1.5, (h - 1.6) / (n - 1)) : 0;
  for (let i = 0; i < n; i++) s += rechteck(+(x + b * 0.55).toFixed(2), +(y + 0.9 + i * abstand).toFixed(2), lauf, 1.05, P.mast, ' rx=".45"');
  s += pfad(`M${x},${y + h} L${x},${y + 1.5} Q${x},${y} ${x + 1.5},${y} L${x + b - 3},${y} Q${x + b},${y + 0.4} ${x + b},${y + h * 0.6} L${x + b},${y + h} Z`, P.aufbau, kante(P, 0.7));
  if (richtung === -1) return `<g transform="translate(${2 * x + b} 0) scale(-1 1)">${s}</g>`;
  return s;
}

// ---------- die sechs Schiffe ----------
const ZEICHNER = {
  // Bauer: Patrouillenboot, klein und flink
  p: (P) =>
    rumpf(P, 24, 78, 66, 75, 3)
    + rechteck(27.2, 55, 0.8, 11, P.mast) + pfad('M28,55.3 L33.5,57.2 L28,59.1 Z', P.akzent)            // Heckflagge
    + pfad('M37,66 L37,57.5 Q37,56.5 38,56.5 L53,56.5 L58.5,66 Z', P.aufbau, kante(P))               // Kajüte
    + pfad('M51.6,58.2 L53.7,58.2 L56.7,63.2 L51.6,63.2 Z', P.fenster)                                 // Frontscheibe
    + fenster(P, 39.5, 47.5, 59, 4)
    + rechteck(44.6, 47.5, 1.2, 9, P.mast) + rechteck(41, 49.5, 8.4, 1.3, P.mast, ' rx=".6"')       // Mast mit Radar
    + kreis(45.2, 47, 1.1, P.licht)
    + geschuetz(P, 62, 62, 6.5, 4, 6.5, 1, 1)
    + gischt(24, 78, 75),

  // Springer: U-Boot – flacher Rücken, Turm mit Periskop
  n: (P) =>
    pfad('M10,73 Q11,65.5 22,64.5 L80,64.5 Q90,65 95,73 Z', P.rumpf, kante(P))
    + `<path d="M14,69 L90.5,69" stroke="${P.akzent}" stroke-width="1.1" opacity=".85"/>`
    + `<path d="M22,65.4 L80,65.4" stroke="${P.glanz}" stroke-width=".7" opacity=".7"/>`
    + pfad('M14.5,67 L10.5,58.5 L14.5,58.5 L19.5,65.2 Z', P.dunkel, kante(P, 0.6))                    // Heckruder
    + rechteck(45.6, 33.5, 1.4, 13.5, P.mast) + rechteck(45.6, 33.5, 4, 1.8, P.mast, ' rx=".6"')     // Periskop
    + rechteck(50.6, 38.5, 0.9, 8.5, P.mast) + kreis(51.05, 38.2, 0.9, P.licht)                       // Antenne
    + pfad('M37,64.8 L40.2,48.2 Q40.6,46.6 42.4,46.6 L53,46.6 Q54.8,46.6 55.2,48.2 L57.8,64.8 Z', P.aufbau, kante(P)) // Turm
    + rechteck(33.5, 53.2, 27, 1.7, P.dunkel, ' rx=".8"')                                                 // Tiefenruder
    + rechteck(43, 49.2, 2, 1.5, P.fenster, ' rx=".4"') + rechteck(47, 49.2, 2, 1.5, P.fenster, ' rx=".4"') + rechteck(51, 49.2, 2, 1.5, P.fenster, ' rx=".4"')
    + rechteck(26, 63.6, 5, 1.2, P.mast, ' rx=".5"') + rechteck(66, 63.6, 5, 1.2, P.mast, ' rx=".5"')  // Luken
    + gischt(12, 98, 73),

  // Läufer: Zerstörer – schräger Mast und Schornstein (die Diagonale des Läufers)
  b: (P) =>
    rumpf(P, 10, 94, 63, 74, 4) + bullaugen(P, 16, 81, 66.5, 5)
    + `<path d="M58.6,52.5 L53.4,29.5" stroke="${P.mast}" stroke-width="1.4" stroke-linecap="round"/>`
    + `<path d="M50.4,35.4 L57.8,33.6" stroke="${P.mast}" stroke-width="1.1" stroke-linecap="round"/>`
    + kreis(53.3, 29, 1, P.licht)
    + pfad('M28,63 L28,57.4 Q28,56.6 28.8,56.6 L52,56.6 L52,63 Z', P.aufbau, kante(P)) + fenster(P, 30.5, 46.5, 58.6, 4)
    + pfad('M35.5,57 L38.8,44.5 L45.4,44.5 L44,57 Z', P.dunkel, kante(P)) + pfad('M38.4,46.1 L38.8,44.5 L45.4,44.5 L45.2,46.1 Z', P.akzent)
    + pfad('M50,63 L50,52.4 Q50,51.6 50.8,51.6 L61.5,51.6 L68.5,63 Z', P.aufbau, kante(P))
    + pfad('M55.5,53.4 L61.8,53.4 L64.2,57.4 L55.5,57.4 Z', P.fenster)
    + geschuetz(P, 72, 58.2, 8, 4.8, 9, 1, 1) + geschuetz(P, 15, 58.2, 8, 4.8, 9, 1, -1)
    + gischt(10, 94, 74),

  // Turm: Kreuzer – Burgturm mit Zinnen in der Mitte
  r: (P) =>
    rumpf(P, 8, 94, 63, 74, 3.5) + bullaugen(P, 14, 84, 66.5, 5)
    + pfad('M35,63 L35,51 Q35,50 36,50 L63,50 Q64,50 64,51 L64,63 Z', P.aufbau, kante(P)) + fenster(P, 37.5, 59.5, 53, 4)
    + pfad('M40.5,50.2 L40.5,36 L58.5,36 L58.5,50.2 Z', P.aufbau, kante(P))
    + [40.5, 45.3, 50.1, 54.9].map((x) => rechteck(x, 31.5, 3.6, 5, P.aufbau, kante(P, 0.7))).join('')   // Zinnen
    + fenster(P, 43.5, 53.5, 39.5, 5, 2.4, 2.4) + fenster(P, 43.5, 53.5, 44.2, 5, 2.4, 2.4)
    + rechteck(40.5, 47.6, 18, 1.3, P.akzent)
    + geschuetz(P, 69, 57.4, 10, 5.6, 10, 2, 1) + geschuetz(P, 19, 57.4, 10, 5.6, 10, 2, -1)
    + gischt(8, 94, 74),

  // Dame: Schlachtschiff – gestufter Turmaufbau, schwere Drillingstürme, Krone auf dem Mast
  q: (P) =>
    rumpf(P, 4, 97, 62, 74, 4) + bullaugen(P, 10, 84, 65.6, 4.6)
    + pfad('M21.5,62 L23,47 L29,47 L29.5,62 Z', P.dunkel, kante(P)) + rechteck(22.85, 47, 6.1, 1.6, P.akzent)   // Schornstein
    + pfad('M28,62 L28,54.6 Q28,54 28.6,54 L60,54 L62,62 Z', P.aufbau, kante(P)) + fenster(P, 31, 55, 56.4, 4)
    + pfad('M34,54.2 L34,46.6 Q34,46 34.6,46 L56.6,46 L57.6,54.2 Z', P.aufbau, kante(P)) + fenster(P, 36.5, 52.5, 48.4, 4)
    + pfad('M39.5,46.2 L39.5,39.6 Q39.5,39 40.1,39 L53.6,39 L54.4,46.2 Z', P.aufbau, kante(P))
    + pfad('M42.5,39.2 L42.5,33.6 Q42.5,33 43.1,33 L51.4,33 L53.2,39.2 Z', P.aufbau, kante(P))
    + pfad('M46.4,34.6 L51.5,34.6 L52.4,37.4 L46.4,37.4 Z', P.fenster)
    + rechteck(46.7, 23.6, 1.5, 9.6, P.mast)
    + pfad('M42.9,24.4 L42.9,19.6 L45.2,22.1 L47.45,17.6 L49.7,22.1 L52,19.6 L52,24.4 Z', P.akzent, kante(P, 0.5))   // Krone
    + rechteck(63.6, 55, 8.6, 7, P.dunkel, kante(P, 0.6))                                                           // Sockel
    + geschuetz(P, 63.2, 50.6, 9.6, 5, 11, 3, 1) + geschuetz(P, 74, 56.6, 10.5, 5.4, 11.5, 3, 1)
    + geschuetz(P, 13.5, 56.6, 10.5, 5.4, 11.5, 3, -1)
    + gischt(4, 97, 74),

  // König: Flaggschiff – langer, eleganter Aufbau, Mast mit Kreuz und Admiralswimpel
  k: (P) =>
    rumpf(P, 4, 97, 62, 74, 5) + bullaugen(P, 10, 82, 65.6, 4.6)
    + pfad('M24.5,54 L26.3,42.5 L32.5,42.5 L32.2,54 Z', P.dunkel, kante(P)) + pfad('M26.05,44.1 L26.3,42.5 L32.5,42.5 L32.45,44.1 Z', P.akzent)
    + pfad('M21,62 L21,54.6 Q21,54 21.6,54 L69,54 L74.5,62 Z', P.aufbau, kante(P)) + fenster(P, 35, 67, 56.6, 4)
    + pfad('M31,54.2 L31,45.6 Q31,45 31.6,45 L61.5,45 L65,54.2 Z', P.aufbau, kante(P)) + fenster(P, 34, 58, 47.6, 4)
    + rechteck(46.8, 11, 1.6, 26.2, P.mast) + rechteck(42.6, 15.2, 10, 1.6, P.mast, ' rx=".5"')   // Mast mit Kreuz
    + pfad('M46.8,20 L35,22.6 L46.8,25.2 Z', P.akzent)                                                 // Wimpel
    + kreis(47.6, 10.4, 1, P.licht)
    + pfad('M37.5,45.2 L37.5,37.6 Q37.5,37 38.1,37 L57,37 L60,45.2 Z', P.aufbau, kante(P))         // Brücke
    + pfad('M40,39 L57.4,39 L58.5,41.8 L40,41.8 Z', P.fenster)
    + `<circle cx="54" cy="35.2" r="2.4" fill="${P.aufbau}"${kante(P, 0.6)}/>`                         // Radarkuppel
    + geschuetz(P, 77, 57.2, 8.5, 4.8, 8.5, 2, 1)
    + gischt(4, 97, 74),
};

// Schatten im Wasser (Mitte x, halbe Breite) – passend zur Länge des Schiffs
const SCHATTEN = { k: [50, 46], q: [50, 46], r: [51, 44], b: [52, 43], n: [53, 43], p: [51, 28] };

// Fertiges Schiff als SVG-Text. typ: 'k','q','r','b','n','p'  farbe: 'w' oder 'b'
// stil: Farbsatz der Flotte (siehe FLOTTEN), sonst der Standard der Seite
const zwischenspeicher = new Map();
export function schiffSVG(typ, farbe, stil, klasse = 'schiff') {
  if (!FARBSAETZE[stil] || FARBSAETZE[stil].hell !== (farbe === 'w')) stil = STANDARD_FLOTTE[farbe];
  const schluessel = typ + farbe + stil + klasse;
  if (zwischenspeicher.has(schluessel)) return zwischenspeicher.get(schluessel);
  const P = palette(stil);
  const [cx, rx] = SCHATTEN[typ];
  const spiegel = farbe === 'b' ? ' transform="translate(100 0) scale(-1 1)"' : '';
  const svg = `<svg class="${klasse}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">`
    + `<ellipse cx="${farbe === 'b' ? 100 - cx : cx}" cy="76.5" rx="${rx}" ry="5.5" fill="url(#nc-schatten)"/>`
    + `<g${spiegel}>${ZEICHNER[typ](P)}</g></svg>`;
  zwischenspeicher.set(schluessel, svg);
  return svg;
}

// Das versteckte <svg> mit den Farbverläufen einmal in die Seite setzen
export function verlaeufeEinsetzen() {
  if (document.getElementById('nc-verlaeufe')) return;
  const d = document.createElement('div');
  d.innerHTML = `<svg id="nc-verlaeufe" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true"><defs>${VERLAEUFE}</defs></svg>`;
  document.body.prepend(d.firstChild);
}
