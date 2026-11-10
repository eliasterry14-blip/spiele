// WALL DUEL – Regeln + KI (ohne Bildschirm, darum mit Node testbar)
// 7×7-Brett. Spieler 0 startet unten in der Mitte und will nach oben (Reihe 0),
// Spieler 1 startet oben in der Mitte und will nach unten (letzte Reihe).
// Pro Zug: 1 Schritt ODER 1 Mauer. Jeder hat 6 Mauern.
// Mauern liegen in den Rillen, sind 2 Felder lang und hängen an einem Kreuzungspunkt (a, b) mit a, b = 0 … n-2:
//   waagerecht 'h' bei (a, b): trennt Reihe b von Reihe b+1 in den Spalten a und a+1
//   senkrecht  'v' bei (a, b): trennt Spalte a von Spalte a+1 in den Reihen b und b+1

export const GROESSE = 7;
export const VORRAT = 6;

export function neuesSpiel(n = GROESSE, vorrat = VORRAT) {
  const m = n - 1, mitte = (n - 1) >> 1;
  return { n, pos: [[mitte, n - 1], [mitte, 0]], h: new Uint8Array(m * m), v: new Uint8Array(m * m), vorrat: [vorrat, vorrat], dran: 0, zuege: 0 };
}

export const kopie = (s) => ({ n: s.n, pos: [[...s.pos[0]], [...s.pos[1]]], h: s.h.slice(), v: s.v.slice(), vorrat: [...s.vorrat], dran: s.dran, zuege: s.zuege });
export const zielReihe = (n, p) => (p === 0 ? 0 : n - 1);

const wand = (arr, n, a, b) => a >= 0 && b >= 0 && a < n - 1 && b < n - 1 && arr[b * (n - 1) + a] === 1;
export const hatMauer = (s, o, a, b) => wand(o === 'h' ? s.h : s.v, s.n, a, b);

// Kann man von (x, y) einen Schritt in Richtung (dx, dy) gehen? (Rand + Mauern, Figuren egal)
export function offen(s, x, y, dx, dy) {
  const n = s.n, nx = x + dx, ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= n || ny >= n) return false;
  if (dy === 1) return !wand(s.h, n, x - 1, y) && !wand(s.h, n, x, y);
  if (dy === -1) return !wand(s.h, n, x - 1, y - 1) && !wand(s.h, n, x, y - 1);
  if (dx === 1) return !wand(s.v, n, x, y - 1) && !wand(s.v, n, x, y);
  return !wand(s.v, n, x - 1, y - 1) && !wand(s.v, n, x - 1, y);
}

// ——— Kürzester Weg zur Ziellinie (Breitensuche, Figuren zählen nicht als Hindernis) ———
let DIST = new Int16Array(64), VOR = new Int16Array(64), SCHLANGE = new Int16Array(64);
const ORDNUNG = [[[0, -1], [-1, 0], [1, 0], [0, 1]], [[0, 1], [-1, 0], [1, 0], [0, -1]]];

// Ergebnis: Länge (−1 = kein Weg). Mit mitPfad = true: { laenge, pfad: [[x, y], …] } vom Standort bis ins Ziel
export function weg(s, p, mitPfad = false, von = s.pos[p]) {
  const n = s.n, ziel = zielReihe(n, p), nn = n * n;
  const [sx, sy] = von;
  if (sy === ziel) return mitPfad ? { laenge: 0, pfad: [[sx, sy]] } : 0;
  if (DIST.length < nn) { DIST = new Int16Array(nn); VOR = new Int16Array(nn); SCHLANGE = new Int16Array(nn); }
  DIST.fill(-1, 0, nn);
  const start = sy * n + sx;
  let kopf = 0, ende = 0;
  DIST[start] = 0; SCHLANGE[ende++] = start;
  const ord = ORDNUNG[p];
  while (kopf < ende) {
    const c = SCHLANGE[kopf++], x = c % n, y = (c / n) | 0;
    for (const [dx, dy] of ord) {
      if (!offen(s, x, y, dx, dy)) continue;
      const j = (y + dy) * n + x + dx;
      if (DIST[j] >= 0) continue;
      DIST[j] = DIST[c] + 1; VOR[j] = c;
      if (y + dy === ziel) {
        if (!mitPfad) return DIST[j];
        const pfad = [];
        for (let k = j; k !== start; k = VOR[k]) pfad.push([k % n, (k / n) | 0]);
        pfad.push([sx, sy]); pfad.reverse();
        return { laenge: DIST[j], pfad };
      }
      SCHLANGE[ende++] = j;
    }
  }
  return mitPfad ? { laenge: -1, pfad: [] } : -1;
}

// ——— Figur-Schritte (mit Springen und seitlichem Ausweichen) ———
export function schritte(s, p) {
  const [x, y] = s.pos[p], [ox, oy] = s.pos[1 - p];
  const out = [];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    if (!offen(s, x, y, dx, dy)) continue;
    const nx = x + dx, ny = y + dy;
    if (nx !== ox || ny !== oy) { out.push({ art: 'zug', x: nx, y: ny }); continue; }
    // Gegner steht direkt daneben: gerade drüber springen …
    if (offen(s, ox, oy, dx, dy)) { out.push({ art: 'zug', x: ox + dx, y: oy + dy, sprung: true }); continue; }
    // … oder (Mauer/Rand dahinter) schräg seitlich vorbei
    for (const [px, py] of dx ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]) {
      if (offen(s, ox, oy, px, py)) out.push({ art: 'zug', x: ox + px, y: oy + py, sprung: true });
    }
  }
  return out;
}

// ——— Mauern ———
// Nur die Lage: im Brett, nichts überlappt, nichts kreuzt sich in der Mitte
export function mauerPasst(s, o, a, b) {
  const m = s.n - 1;
  if (a < 0 || b < 0 || a >= m || b >= m) return false;
  if (o === 'h') return !wand(s.h, s.n, a, b) && !wand(s.h, s.n, a - 1, b) && !wand(s.h, s.n, a + 1, b) && !wand(s.v, s.n, a, b);
  return !wand(s.v, s.n, a, b) && !wand(s.v, s.n, a, b - 1) && !wand(s.v, s.n, a, b + 1) && !wand(s.h, s.n, a, b);
}

// Lage ok UND beide Spieler kommen danach noch ins Ziel
export function mauerErlaubt(s, o, a, b) {
  if (!mauerPasst(s, o, a, b)) return false;
  const arr = o === 'h' ? s.h : s.v, i = b * (s.n - 1) + a;
  arr[i] = 1;
  const ok = weg(s, 0) >= 0 && weg(s, 1) >= 0;
  arr[i] = 0;
  return ok;
}

export function alleMauern(s) {
  const out = [], m = s.n - 1;
  for (const o of ['h', 'v']) for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) if (mauerErlaubt(s, o, a, b)) out.push({ art: 'mauer', o, a, b });
  return out;
}

export function alleZuege(s) {
  const out = schritte(s, s.dran);
  if (s.vorrat[s.dran] > 0) out.push(...alleMauern(s));
  return out;
}

export function zugGueltig(s, z) {
  if (!z) return false;
  if (z.art === 'zug') return schritte(s, s.dran).some((q) => q.x === z.x && q.y === z.y);
  return z.art === 'mauer' && s.vorrat[s.dran] > 0 && mauerErlaubt(s, z.o, z.a, z.b);
}

export function ziehe(s, z) {
  const t = kopie(s), p = s.dran;
  if (z.art === 'zug') t.pos[p] = [z.x, z.y];
  else { (z.o === 'h' ? t.h : t.v)[z.b * (s.n - 1) + z.a] = 1; t.vorrat[p]--; }
  t.dran = 1 - p; t.zuege++;
  return t;
}

// −1 = läuft noch, sonst Nummer des Siegers
export function sieger(s) {
  if (s.pos[0][1] === 0) return 0;
  if (s.pos[1][1] === s.n - 1) return 1;
  return -1;
}

// ═══ KI ═══
// Bewertung = (Weglänge Gegner − eigene Weglänge) + Mauer-Vorrat (+ sicheres Wettrennen, wenn der andere keine Mauern mehr hat)
const GEW_MAUER = 0.55;
export function bewerte(s, p, gew = GEW_MAUER) {
  const dIch = weg(s, p), dEr = weg(s, 1 - p);
  if (dIch === 0) return 1000;
  if (dEr === 0) return -1000;
  let w = dEr - dIch + gew * (s.vorrat[p] - s.vorrat[1 - p]);
  // Wettrennen: wer am Zug ist, gewinnt bei gleich langem Weg
  const amZug = s.dran, dZug = amZug === p ? dIch : dEr, dAnder = amZug === p ? dEr : dIch;
  if (s.vorrat[1 - amZug] === 0 && dZug <= dAnder) w += amZug === p ? 40 : -40;
  else if (s.vorrat[amZug] === 0 && dAnder < dZug) w += amZug === p ? -40 : 40;
  return w;
}

// Mauern, die den Weg von Spieler p stören (rund um die ersten `tiefe` Schritte seines kürzesten Wegs)
export function mauerKandidaten(s, p, tiefe = 4, breit = true) {
  const r = weg(s, p, true);
  const gesehen = new Set(), out = [];
  const dazu = (o, a, b) => {
    const k = `${o}${a},${b}`;
    if (gesehen.has(k)) return; gesehen.add(k);
    if (mauerErlaubt(s, o, a, b)) out.push({ art: 'mauer', o, a, b });
  };
  const bis = Math.min(r.pfad.length - 1, tiefe);
  for (let i = 0; i < bis; i++) {
    const [x1, y1] = r.pfad[i], [x2, y2] = r.pfad[i + 1];
    if (x1 === x2) { const b = Math.min(y1, y2); dazu('h', x1 - 1, b); dazu('h', x1, b); }
    else { const a = Math.min(x1, x2); dazu('v', a, y1 - 1); dazu('v', a, y1); }
  }
  if (breit) for (let i = 0; i <= bis; i++) {
    const [x, y] = r.pfad[i];
    for (const a of [x - 1, x]) for (const b of [y - 1, y]) { dazu('h', a, b); dazu('v', a, b); }
  }
  return out;
}

function kandidaten(s, p, tiefe, breit = true) {
  const out = schritte(s, p);
  if (s.vorrat[p] > 0) out.push(...mauerKandidaten(s, p === 0 ? 1 : 0, tiefe, breit));
  return out;
}

const wahl = (liste, zufall) => liste[Math.floor(zufall() * liste.length)];

function besterSchritt(s, p, zufall) {
  let best = Infinity, liste = [];
  for (const z of schritte(s, p)) {
    const d = weg(s, p, false, [z.x, z.y]);
    if (d < best) { best = d; liste = [z]; } else if (d === best) liste.push(z);
  }
  return wahl(liste, zufall);
}

// Stufen 1–6 (Index 0–5)
export const KI = [
  { art: 'weg', fehler: 0.3, mauer: 0.07 },                 // Linie: meist kürzester Weg, oft Fehler, Mauern zufällig
  { art: 'weg', fehler: 0.12, mauer: 0.32, gezielt: true }, // Kante: Mauern vor den Gegnerweg, wenn er vorne liegt
  { art: 'gier', fehler: 0.06, rauschen: 1.0, tiefe: 3 },   // Ecke: bester Zug ohne Vorausschau, mit Unschärfe
  { art: 'suche', rauschen: 1.4, tiefe: 2, breit: false },  // Fläche: 2 Halbzüge, aber unscharf und nur Mauern direkt im Weg
  { art: 'suche', rauschen: 0.7, tiefe: 3 },                // Raum: Minimax 2 Halbzüge, Mauern nahe am Gegnerweg
  { art: 'suche', rauschen: 0.08, tiefe: 5 },               // Hexagon: Minimax 2 Halbzüge, mehr Kandidaten, kaum Unschärfe
];

export function kiZug(s, stufe, zufall = Math.random) {
  return kiZugMit(s, KI[Math.max(0, Math.min(KI.length - 1, stufe - 1))], zufall);
}

export function kiZugMit(s, cfg, zufall = Math.random) {
  const p = s.dran, q = 1 - p;
  // Sofort gewinnen geht immer vor
  for (const z of schritte(s, p)) if (z.y === zielReihe(s.n, p)) return z;

  if (cfg.art === 'weg') {
    if (zufall() < cfg.fehler) return wahl(schritte(s, p), zufall);
    if (s.vorrat[p] > 0 && zufall() < cfg.mauer) {
      const dIch = weg(s, p), dEr = weg(s, q);
      if (!cfg.gezielt) { const m = mauerKandidaten(s, q, 2, false); if (m.length) return wahl(m, zufall); }
      else if (dEr <= dIch) {
        let best = 0.99, bz = null;
        for (const m of mauerKandidaten(s, q, 4)) {
          const t = ziehe(s, m), g = weg(t, q) - dEr - (weg(t, p) - dIch);
          if (g > best || (g === best && zufall() < 0.4)) { best = g; bz = m; }
        }
        if (bz) return bz;
      }
    }
    return besterSchritt(s, p, zufall);
  }

  if (cfg.art === 'gier') {
    if (zufall() < cfg.fehler) return wahl(schritte(s, p), zufall);
    let best = -Infinity, bz = null;
    for (const z of kandidaten(s, p, cfg.tiefe)) {
      const w = bewerte(ziehe(s, z), p) + (zufall() - 0.5) * cfg.rauschen + fortschritt(s, p, z);
      if (w > best) { best = w; bz = z; }
    }
    return bz || besterSchritt(s, p, zufall);
  }

  // 'suche': Minimax über `ply` Halbzüge (Standard 2: mein Zug, beste Antwort des Gegners), mit Alpha-Beta
  const ply = cfg.ply || 2, gew = cfg.gew ?? GEW_MAUER;
  let best = -Infinity, bz = null;
  const halb = cfg.rauschen / 2 + druck(s);
  for (const z of kandidaten(s, p, cfg.tiefe, cfg.breit)) {
    const w0 = -negamax(ziehe(s, z), ply - 1, -Infinity, -(best - halb), cfg, gew);
    const w = w0 + (zufall() - 0.5) * cfg.rauschen + fortschritt(s, p, z);
    if (w > best) { best = w; bz = z; }
  }
  return bz || besterSchritt(s, p, zufall);
}

// Je länger ein Spiel dauert, desto mehr zählt echter Fortschritt (verhindert endloses Hin-und-Her)
const druck = (s) => (s.zuege > 40 ? Math.min(8, (s.zuege - 40) / 40) : 0);
function fortschritt(s, p, z) {
  if (z.art === 'mauer') return -0.05;
  const d = druck(s);
  return d ? d * (weg(s, p) - weg(s, p, false, [z.x, z.y])) : 0;
}

// Wert der Stellung für den, der dran ist
function negamax(s, tiefe, alpha, beta, cfg, gew) {
  const w = sieger(s);
  if (w >= 0) return w === s.dran ? 1000 + tiefe : -1000 - tiefe;
  if (tiefe === 0) return bewerte(s, s.dran, gew);
  let best = -Infinity;
  for (const z of kandidaten(s, s.dran, cfg.tiefe, cfg.breit)) {
    const v = -negamax(ziehe(s, z), tiefe - 1, -beta, -alpha, cfg, gew);
    if (v > best) { best = v; if (v > alpha) alpha = v; if (alpha >= beta) break; }
  }
  return best;
}
