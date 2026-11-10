// NUMBER DUEL – Regeln + KI (ohne Bildschirm, darum mit Node testbar)
// Jeder hat die Karten 1–9. Ein verdeckter Preis-Stapel 1–9 wird gemischt.
// Pro Runde wird ein Preis aufgedeckt, beide wählen geheim eine Karte, die höhere gewinnt den Preis (+ Topf).
// Gleichstand: Der Preis bleibt im Topf und kommt zur nächsten Runde dazu. Nach 9 Runden zählen die Punkte.

export const KARTEN = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const summe = (a) => a.reduce((x, y) => x + y, 0);

export function mischen(liste, zufall = Math.random) {
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function neuesSpiel(zufall = Math.random) {
  return { preise: mischen(KARTEN, zufall), hand: [KARTEN.slice(), KARTEN.slice()], punkte: [0, 0], topf: [], runde: 0, verlauf: [] };
}

export const vorbei = (st) => st.runde >= st.preise.length;
export const preis = (st) => st.preise[st.runde];
// Wert, um den in dieser Runde gespielt wird: aktueller Preis + liegengebliebener Topf
export const topfWert = (st) => summe(st.topf) + (vorbei(st) ? 0 : preis(st));

// Eine Runde auflösen: a = Karte von Spieler 0, b = Karte von Spieler 1
export function spieleRunde(st, a, b) {
  if (vorbei(st)) throw new Error('Spiel ist vorbei');
  const ia = st.hand[0].indexOf(a), ib = st.hand[1].indexOf(b);
  if (ia < 0 || ib < 0) throw new Error('Karte nicht auf der Hand');
  st.hand[0].splice(ia, 1); st.hand[1].splice(ib, 1);
  const p = preis(st), wert = topfWert(st);
  const sieger = a > b ? 0 : b > a ? 1 : null;
  const eintrag = { runde: st.runde, preis: p, topf: st.topf.slice(), karten: [a, b], sieger, wert };
  if (sieger === null) st.topf.push(p);
  else { st.punkte[sieger] += wert; st.topf = []; }
  st.verlauf.push(eintrag);
  st.runde++;
  if (vorbei(st)) eintrag.verfallen = summe(st.topf); // Topf nach der letzten Runde geht an niemanden
  return eintrag;
}

// 0 / 1 = Sieger, null = Remis, undefined = läuft noch
export function ergebnis(st) {
  if (!vorbei(st)) return undefined;
  const [a, b] = st.punkte;
  return a > b ? 0 : b > a ? 1 : null;
}

// ═══════════════════════════════════════════════════════════════════
// KI
// ═══════════════════════════════════════════════════════════════════
const aufsteigend = (a) => a.slice().sort((x, y) => x - y);
const nimm = (a, zufall) => a[Math.floor(zufall() * a.length)];
const wackel = (z, p) => (z() < p ? (z() < 0.5 ? -1 : 1) : 0);

// fester Zufall (für „gleiche gedachte Partien“ bei jeder Kandidatenkarte)
function prng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

// Rang eines Wertes unter den danach noch offenen Preisen (0 = kleinster … n-1 = größter)
function rangVon(wert, andere) {
  let r = 0; for (const p of andere) r += p < wert ? 1 : p === wert ? 0.5 : 0;
  return r;
}
const rang = (st) => rangVon(topfWert(st), st.preise.slice(st.runde + 1));

// „Rang-Abgleich“: die eigene Karte, die vom Rang her zum Topf passt
function rangKarte(hand, st, verschiebung = 0) {
  const s = aufsteigend(hand);
  const i = Math.max(0, Math.min(s.length - 1, Math.round(rang(st) + verschiebung)));
  return s[i];
}

// Gedächtnis: nicht mehr bezahlen als nötig, keine sicheren Niederlagen teuer machen
function mitGedaechtnis(karte, meine, seine) {
  const s = aufsteigend(meine), maxSein = Math.max(...seine), minSein = Math.min(...seine);
  if (karte > maxSein) return s.find((c) => c > maxSein); // sicherer Sieg: so billig wie möglich
  if (karte < minSein) return s[0];                       // kann nur verlieren → kleinste abwerfen
  return karte;
}

// Wie unberechenbar spielt der Gegner bisher? 0,1 = streng nach Rang … 0,95 = völlig zufällig
export function zufallsAnteil(st, gegner) {
  const hand = KARTEN.slice();
  let abw = 0, n = 0;
  for (const e of st.verlauf) {
    const s = aufsteigend(hand), k = s.length;
    if (k > 1) { abw += Math.abs(s.indexOf(e.karten[gegner]) - rangVon(e.wert, st.preise.slice(e.runde + 1))) / (k - 1); n++; }
    hand.splice(hand.indexOf(e.karten[gegner]), 1);
  }
  const mittel = (abw + 0.2) / (n + 1); // Vorwissen: „etwas berechenbar“
  return Math.max(0.1, Math.min(0.95, (mittel - 0.04) / 0.28));
}

// Stufe 1 · Bluff: blind
function stufe1(st, ich, zufall) { return nimm(st.hand[ich], zufall); }

// Stufe 2 · Einsatz: bietet ungefähr den Wert des Preises
function stufe2(st, ich, zufall) {
  if (zufall() < 0.4) return nimm(st.hand[ich], zufall);
  const ziel = Math.min(9, topfWert(st)) + Math.round((zufall() - 0.5) * 7);
  let beste = null, abst = Infinity;
  for (const c of mischen(st.hand[ich], zufall)) { const d = Math.abs(c - ziel); if (d < abst) { abst = d; beste = c; } }
  return beste;
}

// Stufe 3 · Risiko: Rang-Abgleich mit Streuung + merkt sich eigene und gegnerische Restkarten
function stufe3(st, ich, zufall) {
  const v = zufall() < 0.8 ? (zufall() < 0.5 ? -1 : 1) * (zufall() < 0.5 ? 2 : 1) : 0;
  return mitGedaechtnis(rangKarte(st.hand[ich], st, v), st.hand[ich], st.hand[1 - ich]);
}

// Stufe 4 · Reichtum: kleine Preise bekommen die kleinsten Karten, die hohen werden gespart
function stufe4(st, ich, zufall) {
  const meine = aufsteigend(st.hand[ich]), seine = st.hand[1 - ich];
  const n = meine.length, r = rang(st);
  if (n > 1 && r < n * 0.45) return meine[0];
  let k = rangKarte(meine, st, wackel(zufall, 0.8) * (zufall() < 0.3 ? 2 : 1));
  if (k === meine[n - 1] && n > 1 && r < n - 1.5) k = meine[n - 2]; // die Höchste bleibt für den größten Preis
  return mitGedaechtnis(k, meine, seine);
}

// Stufe 5 · Tresor: schätzt das Gebot des Gegners aus dessen Restkarten und überbietet knapp
function stufe5(st, ich, zufall) {
  const meine = aufsteigend(st.hand[ich]), seine = aufsteigend(st.hand[1 - ich]);
  const n = meine.length;
  if (n === 1) return meine[0];
  const r = rang(st), i = Math.max(0, Math.min(n - 1, Math.round(r)));
  let k = meine[i];
  if (zufallsAnteil(st, 1 - ich) < 0.6) {
    // Gegner spielt berechenbar: sein wahrscheinliches Gebot knapp überbieten
    const erwartet = seine[i];
    if (r >= (n - 1) / 2) {
      const knapp = meine.find((c) => c > erwartet);
      if (knapp !== undefined && meine.indexOf(knapp) <= i + 1) k = knapp;
    } else if (r < n / 3) k = meine[0];
    else if (zufall() < 0.6) k = meine[Math.max(0, i - 1)];
  } else if (r < n / 4) k = meine[0];     // unberechenbarer Gegner: sauber nach Rang, Billiges abwerfen
  if (zufall() < 0.35) k = meine[Math.max(0, Math.min(n - 1, i + (zufall() < 0.5 ? -1 : 1)))];
  return mitGedaechtnis(k, meine, seine);
}

// Gegner in Gedanken: mit Anteil u zufällig, sonst nach Rang
function gedachteKarte(hand, st, u, z) {
  return z() < u ? nimm(hand, z) : rangKarte(hand, st, wackel(z, 0.35));
}

// Rest der Partie in Gedanken ausspielen → Punktedifferenz aus meiner Sicht
function ausspielen(hand0, hand1, preise, topf, u, z) {
  const a = aufsteigend(hand0), b = aufsteigend(hand1);
  let diff = 0, tp = topf;
  for (let r = 0; r < preise.length; r++) {
    const wert = tp + preise[r], n = a.length;
    let kl = 0; for (let k = r + 1; k < preise.length; k++) kl += preise[k] < wert ? 1 : 0;
    const ia = Math.max(0, Math.min(n - 1, kl + wackel(z, 0.25)));
    const ib = z() < u ? Math.floor(z() * n) : Math.max(0, Math.min(n - 1, kl + wackel(z, 0.35)));
    const ca = a[ia], cb = b[ib];
    a.splice(ia, 1); b.splice(ib, 1);
    if (ca > cb) { diff += wert; tp = 0; } else if (cb > ca) { diff -= wert; tp = 0; } else tp = wert;
  }
  return diff;
}

// Gegner-Modell als Wahrscheinlichkeit für jede seiner (aufsteigend sortierten) Karten
function gegnerVerteilung(n, r, u) {
  const p = new Array(n).fill(u / n);
  const i = Math.max(0, Math.min(n - 1, Math.round(r))), rest = 1 - u;
  p[i] += rest * 0.65; p[Math.max(0, i - 1)] += rest * 0.175; p[Math.min(n - 1, i + 1)] += rest * 0.175;
  return p;
}
const ausMaske = (m) => { const a = []; for (let c = 1; c <= 9; c++) if (m & (1 << c)) a.push(c); return a; };
const zuMaske = (a) => a.reduce((m, c) => m | (1 << c), 0);

// Was zählt, ist der Sieg – ein dickerer Vorsprung nur ein klein wenig
const nutzen = (d) => (d > 0 ? 1 : d === 0 ? 0.5 : 0) + d * 0.004;

// Endspiel exakt durchrechnen (alle Preis-Reihenfolgen, Gegner nach Modell) → [[karte, Siegchance], …]
function endspiel(meine, seine, p0, rest, topf, u, d0) {
  const memo = new Map();
  function V(mm, om, pm, tp, d) { // nächster Preis noch verdeckt
    if (pm === 0) return nutzen(d);
    const key = ((((d + 50) * 64 + tp) * 1024 + pm) * 1024 + om) * 1024 + mm;
    const h = memo.get(key); if (h !== undefined) return h;
    const ps = ausMaske(pm);
    let s = 0;
    for (const p of ps) s += Q(mm, om, pm & ~(1 << p), p, tp, d).best;
    memo.set(key, s / ps.length);
    return s / ps.length;
  }
  function Q(mm, om, rm, p, tp, d) {
    const my = ausMaske(mm), op = ausMaske(om), n = my.length, wert = tp + p;
    const vert = gegnerVerteilung(n, rangVon(wert, ausMaske(rm)), u);
    let best = -Infinity; const q = [];
    for (const c of my) {
      let e = 0;
      for (let j = 0; j < n; j++) {
        const b = op[j];
        let imm = 0, ntp = 0;
        if (c > b) imm = wert; else if (b > c) imm = -wert; else ntp = wert;
        e += vert[j] * V(mm & ~(1 << c), om & ~(1 << b), rm, ntp, d + imm);
      }
      q.push([c, e]); if (e > best) best = e;
    }
    return { best, q };
  }
  return Q(zuMaske(meine), zuMaske(seine), zuMaske(rest), p0, topf, d0).q;
}

// Stufe 6 · All-in: liest den Gegner, denkt die Partie zu Ende (am Schluss exakt), wählt gemischt
function stufe6(st, ich, zufall, proben = 160) {
  const meine = st.hand[ich], seine = st.hand[1 - ich];
  if (meine.length === 1) return meine[0];
  const u = zufallsAnteil(st, 1 - ich);
  const rest = st.preise.slice(st.runde + 1), wert = topfWert(st);
  const d0 = st.punkte[ich] - st.punkte[1 - ich];
  const erg = meine.length <= 5 ? endspiel(meine, seine, preis(st), rest, summe(st.topf), u, d0) : mcWerte(st, meine, seine, rest, wert, u, d0, zufall, proben);
  // gemischte Strategie: unter den guten Karten nach Güte gewichtet würfeln
  const best = Math.max(...erg.map((e) => e[1]));
  const gew = erg.map(([c, w]) => [c, Math.exp((w - best) / 0.015)]);
  let z = zufall() * summe(gew.map((g) => g[1]));
  for (const [c, g] of gew) { z -= g; if (z <= 0) return c; }
  return gew[gew.length - 1][0];
}

// Früh in der Partie: viele gedachte Partien (für jede Kandidatenkarte dieselben)
function mcWerte(st, meine, seine, rest, wert, u, d0, zufall, proben) {
  const samen = Array.from({ length: proben }, () => Math.floor(zufall() * 4294967296));
  return meine.map((c) => {
    const m = meine.filter((x) => x !== c);
    let s = 0;
    for (const sd of samen) {
      const z = prng(sd);
      const b = gedachteKarte(seine, st, u, z);
      const so = seine.filter((x) => x !== b);
      let jetzt = 0, tp = 0;
      if (c > b) jetzt = wert; else if (b > c) jetzt = -wert; else tp = wert; // Gleichstand: Topf wandert weiter
      s += nutzen(d0 + jetzt + ausspielen(m, so, mischen(rest, z), tp, u, z));
    }
    return [c, s / proben];
  });
}

const STUFEN = [stufe1, stufe2, stufe3, stufe4, stufe5, stufe6];

// Karte der KI wählen (nr 1–6). Gibt immer eine Karte zurück, die sie wirklich noch hat.
export function kiWahl(st, ich, nr, zufall = Math.random) {
  const f = STUFEN[Math.max(1, Math.min(6, nr)) - 1];
  const k = f(st, ich, zufall);
  return st.hand[ich].includes(k) ? k : st.hand[ich][0];
}
