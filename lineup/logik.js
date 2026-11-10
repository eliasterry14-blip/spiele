// LINEUP – Regeln + KI (ohne Bildschirm, darum mit Node testbar)
// 8×8-Brett. 32 Zahlkarten (4 Symbole × Werte 1–8), jede Karte ist auf GENAU 2 Feldern abgebildet.
// Dazu 2 Joker (beliebiges freies Feld) und 2 Bann-Karten (einen gegnerischen Stein entfernen) = 36 Karten.
// Jeder hat 4 Karten. Zug: Karte spielen → Stein setzen (oder bannen), dann nachziehen.
// Tote Karte (beide Felder belegt): zu Beginn des Zuges abwerfen und neu ziehen.
// Wer zuerst 5 eigene Steine in einer Reihe hat (waagerecht, senkrecht, diagonal), gewinnt.
// Stapel leer und keiner kann mehr ziehen → Remis.

export const N = 8, FELDER = 64, HAND = 4;
export const SYMBOLE = ['raute', 'kreis', 'dreieck', 'quadrat'];
export const art = (id) => (id < 32 ? 'zahl' : id < 34 ? 'joker' : 'bann');
export const symbol = (id) => Math.floor(id / 8);
export const wert = (id) => (id % 8) + 1;
const RICHTUNGEN = [[1, 0], [0, 1], [1, 1], [1, -1]];

export function mischen(liste, zufall = Math.random) {
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const bis = (n) => Array.from({ length: n }, (_, i) => i);

// Alle Fünfer-Fenster auf dem Brett (für die KI-Bewertung)
export const FENSTER = [];
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (const [dx, dy] of RICHTUNGEN) {
  const ex = x + 4 * dx, ey = y + 4 * dy;
  if (ex < 0 || ex >= N || ey < 0 || ey >= N) continue;
  FENSTER.push(bis(5).map((i) => (y + i * dy) * N + x + i * dx));
}

export function neuesSpiel(zufall = Math.random, start = 0) {
  const plaetze = mischen(bis(FELDER), zufall);
  const feldKarte = new Array(FELDER), kartenFelder = [];
  for (let id = 0; id < 32; id++) {
    const a = plaetze[2 * id], b = plaetze[2 * id + 1];
    kartenFelder.push([a, b]); feldKarte[a] = id; feldKarte[b] = id;
  }
  const stapel = mischen(bis(36), zufall);
  const hand = [stapel.splice(0, HAND), stapel.splice(0, HAND)];
  return { brett: new Array(FELDER).fill(-1), feldKarte, kartenFelder, stapel, hand, ablage: [], dran: start, zuege: [0, 0], sieger: undefined, reihe: null, letzter: null };
}

// ——— Reihen ———
export function reiheDurch(brett, f, sp) {
  if (brett[f] !== sp) return null;
  const x0 = f % N, y0 = Math.floor(f / N);
  for (const [dx, dy] of RICHTUNGEN) {
    const lauf = [[0, f]];
    for (const s of [1, -1]) {
      let x = x0 + dx * s, y = y0 + dy * s, t = s;
      while (x >= 0 && x < N && y >= 0 && y < N && brett[y * N + x] === sp) { lauf.push([t, y * N + x]); x += dx * s; y += dy * s; t += s; }
    }
    if (lauf.length >= 5) return lauf.sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  }
  return null;
}
export const inFertigerReihe = (brett, f) => brett[f] >= 0 && reiheDurch(brett, f, brett[f]) !== null;

// ——— Karten und Züge ———
export function istTot(st, id) {
  return art(id) === 'zahl' && st.kartenFelder[id].every((f) => st.brett[f] !== -1);
}

export function zielFelder(st, sp, id) {
  const a = art(id);
  if (a === 'zahl') return st.kartenFelder[id].filter((f) => st.brett[f] === -1);
  if (a === 'joker') return bis(FELDER).filter((f) => st.brett[f] === -1);
  return bis(FELDER).filter((f) => st.brett[f] === 1 - sp && !inFertigerReihe(st.brett, f));
}

export function alleZuege(st, sp) {
  const z = [];
  for (const id of st.hand[sp]) for (const f of zielFelder(st, sp, id)) z.push({ karte: id, feld: f });
  return z;
}
export const hatZug = (st, sp) => st.hand[sp].some((id) => zielFelder(st, sp, id).length > 0);
export const kannTauschen = (st, sp, id) => st.sieger === undefined && st.dran === sp && st.stapel.length > 0 && st.hand[sp].includes(id) && istTot(st, id);
export const mussPassen = (st, sp) => !hatZug(st, sp) && !st.hand[sp].some((id) => kannTauschen(st, sp, id));

function pruefeRemis(st) {
  if (st.sieger === undefined && st.stapel.length === 0 && !hatZug(st, 0) && !hatZug(st, 1)) st.sieger = null;
}

// Tote Karte abwerfen und neu ziehen → neue Karte
export function tausche(st, sp, id) {
  if (!kannTauschen(st, sp, id)) throw new Error('Tauschen nicht erlaubt');
  st.hand[sp].splice(st.hand[sp].indexOf(id), 1);
  st.ablage.push(id);
  const neu = st.stapel.pop();
  st.hand[sp].push(neu);
  return neu;
}

// Karte spielen → { gezogen, reihe, entfernt }
export function spiele(st, sp, id, feld) {
  if (st.sieger !== undefined) throw new Error('Partie ist vorbei');
  if (st.dran !== sp) throw new Error('nicht dran');
  if (!st.hand[sp].includes(id)) throw new Error('Karte nicht auf der Hand');
  if (!zielFelder(st, sp, id).includes(feld)) throw new Error('Feld nicht erlaubt');
  st.hand[sp].splice(st.hand[sp].indexOf(id), 1);
  st.ablage.push(id);
  const bann = art(id) === 'bann';
  st.brett[feld] = bann ? -1 : sp;
  st.zuege[sp]++;
  const gezogen = st.stapel.length ? st.stapel.pop() : null;
  if (gezogen !== null) st.hand[sp].push(gezogen);
  const reihe = bann ? null : reiheDurch(st.brett, feld, sp);
  st.letzter = { spieler: sp, karte: id, feld, bann };
  if (reihe) { st.sieger = sp; st.reihe = reihe; }
  st.dran = 1 - sp;
  pruefeRemis(st);
  return { gezogen, reihe, entfernt: bann ? feld : null };
}

// Kein Zug möglich (und nichts zu tauschen) → aussetzen
export function passe(st, sp) {
  if (st.sieger !== undefined || st.dran !== sp || !mussPassen(st, sp)) throw new Error('Passen nicht erlaubt');
  st.letzter = { spieler: sp, pass: true };
  st.dran = 1 - sp;
  pruefeRemis(st);
}

// ═══════════════════════════════════════════════════════════════════
// KI
// ═══════════════════════════════════════════════════════════════════
const nimm = (a, z) => a[Math.floor(z() * a.length)];
const W = [0, 1, 6, 36, 320, 20000];

// Erreichbarkeit jedes Feldes aus Sicht der KI (ich) – für mich und für den Gegner
function erreichbarkeit(st, ich, hand = st.hand[ich], ablage = st.ablage) {
  const meine = new Set(hand), weg = new Set(ablage);
  const jokerUnbekannt = [32, 33].filter((j) => !meine.has(j) && !weg.has(j)).length;
  const jokerMeine = [32, 33].filter((j) => meine.has(j)).length;
  const ich_ = new Array(FELDER), er = new Array(FELDER);
  for (let f = 0; f < FELDER; f++) {
    const c = st.feldKarte[f];
    if (meine.has(c)) { ich_[f] = 1; er[f] = 0.04; }
    else if (weg.has(c)) { ich_[f] = jokerMeine ? 0.5 : jokerUnbekannt ? 0.12 : 0.02; er[f] = jokerUnbekannt ? 0.12 : 0.02; }
    else { ich_[f] = 0.55; er[f] = 0.5; }
  }
  return [ich_, er];
}

function fensterSumme(brett, sp, reach, hoch = 0.5) {
  let s = 0;
  for (const w of FENSTER) {
    let m = 0, r = 1;
    for (const f of w) {
      const b = brett[f];
      if (b === sp) m++;
      else if (b === -1) r *= reach ? reach[f] : 1;
      else { m = -1; break; }
    }
    // Vierer, dessen letztes Feld ich sicher auf der Hand habe = fast schon gewonnen
    if (m > 0) s += m === 4 && reach && r > 0.99 ? 4000 : W[m] * (reach ? Math.pow(r, hoch) : 1);
  }
  return s;
}

const PARAM = {
  2: { beta: 0, rauschen: 0.45, joker: 0, bann: 0, reach: false },
  3: { beta: 0.7, rauschen: 0.2, joker: 25, bann: 25, reach: false },
  4: { beta: 0.9, rauschen: 0.4, joker: 50, bann: 40, reach: true },
  5: { beta: 1.1, rauschen: 0.15, joker: 70, bann: 55, reach: true },
  6: { beta: 1.1, rauschen: 0, joker: 70, bann: 55, reach: true, hoch: 1, voraus: true },
};

// Bewertung der Stellung für „ich“ (positiv = gut für mich)
function bewerte(st, brett, ich, reachIch, reachEr, beta, hoch) {
  return fensterSumme(brett, ich, reachIch, hoch) - beta * fensterSumme(brett, 1 - ich, reachEr, hoch);
}

// Vorausschau 1: Wie wahrscheinlich gewinnt der Gegner gleich im nächsten Zug?
// (Er hat eine Karte, die ich nicht sehe, oder einen Joker)
function gegnerSiegChance(st, brett, ich, hand, ablage) {
  const er = 1 - ich, meine = new Set(hand), weg = new Set(ablage);
  const unbekannt = Math.max(1, 36 - hand.length - ablage.length);
  const pKarte = Math.min(1, st.hand[er].length / unbekannt);
  const jokerFrei = [32, 33].filter((j) => !meine.has(j) && !weg.has(j)).length;
  const pJoker = 1 - Math.pow(1 - pKarte, jokerFrei);
  let keiner = 1, gibt = false;
  for (let f = 0; f < FELDER; f++) {
    if (brett[f] !== -1) continue;
    brett[f] = er;
    const sieg = reiheDurch(brett, f, er);
    brett[f] = -1;
    if (!sieg) continue;
    gibt = true;
    const c = st.feldKarte[f];
    keiner *= 1 - (meine.has(c) || weg.has(c) ? 0 : pKarte);
  }
  return gibt ? 1 - keiner * (1 - pJoker) : 0;
}

// Vorausschau 2: mein bester nächster Zug mit den Karten, die mir dann bleiben
function folgeZug(st, brett, ich, hand, rIch, rEr, P) {
  const basis = bewerte(st, brett, ich, rIch, rEr, P.beta, P.hoch);
  let best = 0;
  for (const id of hand) {
    const a = art(id);
    const felder = a === 'zahl' ? st.kartenFelder[id].filter((f) => brett[f] === -1)
      : a === 'joker' ? bis(FELDER).filter((f) => brett[f] === -1)
      : bis(FELDER).filter((f) => brett[f] === 1 - ich && !inFertigerReihe(brett, f));
    for (const f of felder) {
      const alt = brett[f];
      brett[f] = a === 'bann' ? -1 : ich;
      let g = bewerte(st, brett, ich, rIch, rEr, P.beta, P.hoch) - basis - (a === 'joker' ? P.joker : a === 'bann' ? P.bann : 0);
      if (a !== 'bann' && reiheDurch(brett, f, ich)) g += W[5];
      brett[f] = alt;
      if (g > best) best = g;
    }
  }
  return best;
}

// Eine tote Karte, die die KI jetzt abwerfen möchte (oder null)
export function kiTotKarte(st, sp) {
  if (!st.stapel.length) return null;
  return st.hand[sp].find((id) => istTot(st, id)) ?? null;
}

// Zug der KI (nr 1–6) → { karte, feld } oder null (muss passen)
export function kiZug(st, sp, nr, zufall = Math.random) {
  const zuege = alleZuege(st, sp);
  if (!zuege.length) return null;
  if (nr <= 1) return nimm(zuege, zufall);
  const P = PARAM[Math.min(6, nr)];
  const brett = st.brett.slice();
  // 1) sofort gewinnen (lieber mit Zahlkarte als mit Joker)
  const sortiert = zuege.slice().sort((a, b) => (art(a.karte) === 'zahl' ? 0 : 1) - (art(b.karte) === 'zahl' ? 0 : 1));
  for (const z of sortiert) {
    if (art(z.karte) === 'bann') continue;
    brett[z.feld] = sp;
    const sieg = reiheDurch(brett, z.feld, sp);
    brett[z.feld] = -1;
    if (sieg) return z;
  }
  // 2) alle Züge bewerten
  const [rIch0, rEr0] = P.reach ? erreichbarkeit(st, sp) : [null, null];
  const vorher = bewerte(st, brett, sp, rIch0, rEr0, P.beta, P.hoch);
  const kandidaten = [];
  for (const z of zuege) {
    const a = art(z.karte);
    let rIch = rIch0, rEr = rEr0;
    const hand = st.hand[sp].filter((id) => id !== z.karte), ablage = [...st.ablage, z.karte];
    if (P.reach) [rIch, rEr] = erreichbarkeit(st, sp, hand, ablage);
    brett[z.feld] = a === 'bann' ? -1 : sp;
    let wert_ = bewerte(st, brett, sp, rIch, rEr, P.beta, P.hoch) - vorher;
    brett[z.feld] = a === 'bann' ? 1 - sp : -1;
    if (a === 'joker') wert_ -= P.joker;
    if (a === 'bann') wert_ -= P.bann;
    if (P.rauschen) wert_ *= 1 + (zufall() * 2 - 1) * P.rauschen;
    wert_ += zufall() * 0.01;
    kandidaten.push({ z, wert: wert_, hand, ablage, rIch, rEr });
  }
  kandidaten.sort((a, b) => b.wert - a.wert);
  if (!P.voraus) return kandidaten[0].z;
  // 3) Stufe 6: einen Zug vorausdenken – kann er danach sofort gewinnen? Was kann ich danach?
  let beste = null, besterWert = -Infinity;
  for (const k of kandidaten.slice(0, 8)) {
    const a = art(k.z.karte);
    brett[k.z.feld] = a === 'bann' ? -1 : sp;
    const gefahr = gegnerSiegChance(st, brett, sp, k.hand, k.ablage);
    const folge = folgeZug(st, brett, sp, k.hand, k.rIch, k.rEr, P);
    brett[k.z.feld] = a === 'bann' ? 1 - sp : -1;
    const w = k.wert + 0.1 * folge - 3000 * gefahr;
    if (w > besterWert) { besterWert = w; beste = k.z; }
  }
  return beste;
}
