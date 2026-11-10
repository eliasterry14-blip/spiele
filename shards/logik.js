// SHARDS – Regeln + KI (ohne Bildschirm, darum auch mit Node testbar)
// 10×10-Brett, zwei Spieler mit je 12 Glasformen. Spieler 1 startet oben links, Spieler 2 unten rechts.
// Erster Stein bedeckt die eigene Startecke. Jeder weitere berührt einen eigenen Stein an einer ECKE,
// aber nie an einer KANTE. Wer nicht legen kann, setzt aus. Punkte = belegte Felder (+5 wenn alle 12 liegen).

export const N = 10;
export const START = [0, N * N - 1];
export const BONUS = 5;

// Formen – Reihenfolge = Reihenfolge in der Form-Leiste (groß → klein)
export const FORMEN = [
  { id: 'L5', zellen: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]] },
  { id: 'P5', zellen: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]] },
  { id: 'X5', zellen: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
  { id: 'I4', zellen: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: 'L4', zellen: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { id: 'T4', zellen: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: 'S4', zellen: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { id: 'O4', zellen: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: 'I3', zellen: [[0, 0], [1, 0], [2, 0]] },
  { id: 'V3', zellen: [[0, 0], [0, 1], [1, 1]] },
  { id: 'I2', zellen: [[0, 0], [1, 0]] },
  { id: 'I1', zellen: [[0, 0]] },
];
export const ANZAHL = FORMEN.length;
export const GESAMT = FORMEN.reduce((a, f) => a + f.zellen.length, 0);

// Drehen (dreh = 0..3, je 90° im Uhrzeigersinn) und Spiegeln, danach an (0,0) schieben und sortieren
export function lage(zellen, dreh = 0, spiegel = false) {
  let z = zellen.map(([x, y]) => [spiegel ? -x : x, y]);
  for (let i = 0; i < (dreh & 3); i++) z = z.map(([x, y]) => [-y, x]);
  const mx = Math.min(...z.map((c) => c[0])), my = Math.min(...z.map((c) => c[1]));
  return z.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
export const schluessel = (z) => z.map((c) => c.join(',')).join(';');
// alle verschiedenen Lagen jeder Form
export const LAGEN = FORMEN.map((f) => {
  const m = new Map();
  for (let sp = 0; sp < 2; sp++) for (let d = 0; d < 4; d++) { const z = lage(f.zellen, d, !!sp); const k = schluessel(z); if (!m.has(k)) m.set(k, z); }
  return [...m.values()];
});

export function neuesSpiel() {
  return { brett: new Int8Array(N * N).fill(-1), stueck: new Int16Array(N * N).fill(-1), uebrig: [Array(ANZAHL).fill(true), Array(ANZAHL).fill(true)],
    felder: [0, 0], gelegt: [0, 0], dran: 0, ende: false, zug: 0 };
}
export const klone = (s) => ({ brett: s.brett.slice(), stueck: s.stueck.slice(), uebrig: [s.uebrig[0].slice(), s.uebrig[1].slice()],
  felder: s.felder.slice(), gelegt: s.gelegt.slice(), dran: s.dran, ende: s.ende, zug: s.zug });

const kanteEigen = (b, i, p) => {
  const x = i % N;
  return (x > 0 && b[i - 1] === p) || (x < N - 1 && b[i + 1] === p) || (i >= N && b[i - N] === p) || (i < N * (N - 1) && b[i + N] === p);
};
const eckeEigen = (b, i, p) => {
  const x = i % N, y = (i / N) | 0;
  return (x > 0 && y > 0 && b[i - N - 1] === p) || (x < N - 1 && y > 0 && b[i - N + 1] === p)
    || (x > 0 && y < N - 1 && b[i + N - 1] === p) || (x < N - 1 && y < N - 1 && b[i + N + 1] === p);
};

// Felder, an denen Spieler p einen neuen Stein ansetzen kann (frei, Ecke ja, Kante nein)
export function ecken(s, p) {
  const b = s.brett, out = [];
  if (s.gelegt[p] === 0) { if (b[START[p]] < 0) out.push(START[p]); return out; }
  for (let i = 0; i < N * N; i++) if (b[i] < 0 && !kanteEigen(b, i, p) && eckeEigen(b, i, p)) out.push(i);
  return out;
}

// Absolute Felder einer Lage an Position (ax, ay) – oder null, wenn außerhalb
export function felderVon(z, ax, ay) {
  const out = [];
  for (const [cx, cy] of z) { const x = ax + cx, y = ay + cy; if (x < 0 || y < 0 || x >= N || y >= N) return null; out.push(y * N + x); }
  return out;
}

// Prüft eine Platzierung vollständig
export function gueltig(s, p, felder) {
  if (!felder || !felder.length) return false;
  const b = s.brett;
  let ecke = false;
  for (const i of felder) {
    if (b[i] >= 0 || kanteEigen(b, i, p)) return false;
    if (s.gelegt[p] === 0 ? i === START[p] : eckeEigen(b, i, p)) ecke = true;
  }
  return ecke;
}

function passt(b, p, z, ax, ay) {
  const out = [];
  for (const [cx, cy] of z) {
    const x = ax + cx, y = ay + cy;
    if (x < 0 || y < 0 || x >= N || y >= N) return null;
    const i = y * N + x;
    if (b[i] >= 0 || kanteEigen(b, i, p)) return null;
    out.push(i);
  }
  return out;
}

// Alle gültigen Züge von p: { f (Form), l (Lage), felder }
export function zuegeVon(s, p, nurZaehlen = false) {
  const ek = ecken(s, p);
  const zuege = [];
  let anzahl = 0;
  if (!ek.length) return nurZaehlen ? 0 : zuege;
  const gesehen = new Set();
  for (let f = 0; f < ANZAHL; f++) {
    if (!s.uebrig[p][f]) continue;
    const lagen = LAGEN[f];
    for (let li = 0; li < lagen.length; li++) {
      const z = lagen[li];
      for (const e of ek) {
        const ex = e % N, ey = (e / N) | 0;
        for (const [cx, cy] of z) {
          const ax = ex - cx, ay = ey - cy;
          const key = ((f * 8 + li) * 32 + ax + 8) * 32 + ay + 8;
          if (gesehen.has(key)) continue;
          gesehen.add(key);
          const fe = passt(s.brett, p, z, ax, ay);
          if (!fe) continue;
          anzahl++;
          if (!nurZaehlen) zuege.push({ f, l: li, felder: fe });
        }
      }
    }
  }
  return nurZaehlen ? anzahl : zuege;
}

export function kannZiehen(s, p) {
  const ek = ecken(s, p);
  if (!ek.length) return false;
  for (let f = 0; f < ANZAHL; f++) {
    if (!s.uebrig[p][f]) continue;
    for (const z of LAGEN[f]) for (const e of ek) {
      const ex = e % N, ey = (e / N) | 0;
      for (const [cx, cy] of z) if (passt(s.brett, p, z, ex - cx, ey - cy)) return true;
    }
  }
  return false;
}

// Stein legen (ohne Prüfung – vorher gueltig() benutzen)
export function lege(s, p, f, felder) {
  for (const i of felder) { s.brett[i] = p; s.stueck[i] = s.zug; }
  s.uebrig[p][f] = false;
  s.felder[p] += felder.length;
  s.gelegt[p]++;
  s.zug++;
}

// Wer ist als Nächstes dran? Setzt s.dran / s.ende. Gibt zurück, wer aussetzen musste (oder -1).
export function weiter(s) {
  const a = 1 - s.dran;
  if (kannZiehen(s, a)) { s.dran = a; return -1; }
  if (kannZiehen(s, s.dran)) return a;
  s.ende = true;
  return a;
}

export const punkte = (s, p) => s.felder[p] + (s.gelegt[p] === ANZAHL ? BONUS : 0);

// ═══ KI ═══
// 1: zufällig gültig · 2: lieber große Steine · 3: + neue Ecken · 4: + Gegner-Ecken blockieren, zur Mitte
// 5–6: + Blick auf die Möglichkeiten danach (5: Ecken zählen, 6: echte Zugzahl beider Seiten)
const fortschritt = (i, p) => { const x = i % N, y = (i / N) | 0; return p === 0 ? x + y : 2 * (N - 1) - x - y; };

// Gewichte je Stufe: groesse (Felder des Steins), meine (eigene Ansatz-Ecken danach), gegner (Gegner-Ecken danach),
// block (bedeckte Gegner-Ecken), weitFrueh/weit (Ausbreitung zur Mitte), rausch (Zufall),
// reich + kand: Blick nach vorn – bei den besten kand Zügen zählen, wie viele Felder beide Seiten danach noch erreichen
// (in KI-gegen-KI-Turnieren abgestimmt: jede Stufe schlägt die vorige klar)
const BASIS = { groesse: 4, meine: 1.1, block: 1.6, weitFrueh: 0.5, rausch: 2 };
export const GEWICHTE = {
  2: { groesse: 3, rausch: 6 },
  3: { groesse: 4, meine: 1.1, rausch: 3 },
  4: BASIS,
  5: { ...BASIS, rausch: 1, reich: 0.6, kand: 8 },
  6: { ...BASIS, rausch: 0.4, reich: 2, kand: 14 },
};

function zuruecknehmen(s, p, z) {
  for (const i of z.felder) { s.brett[i] = -1; s.stueck[i] = -1; }
  s.uebrig[p][z.f] = true; s.felder[p] -= z.felder.length; s.gelegt[p]--; s.zug--;
}

export function kiZug(s, stufe, zufall = Math.random, gew = GEWICHTE[stufe]) {
  const p = s.dran, q = 1 - p;
  const zuege = zuegeVon(s, p);
  if (!zuege.length) return null;
  if (stufe <= 1 || !gew) return zuege[Math.floor(zufall() * zuege.length)];

  const frueh = s.gelegt[p] < 5;
  const gegnerEcken = new Set(ecken(s, q));
  const b = s.brett;
  const bewerte = (z) => {
    let w = z.felder.length * gew.groesse;
    if (gew.meine || gew.gegner) {
      for (const i of z.felder) b[i] = p;
      if (gew.meine) w += ecken(s, p).length * gew.meine;
      if (gew.gegner) w -= ecken(s, q).length * gew.gegner;
      for (const i of z.felder) b[i] = -1;
    }
    if (gew.block || gew.weitFrueh || gew.weit) {
      let block = 0, weit = 0;
      for (const i of z.felder) { if (gegnerEcken.has(i)) block++; weit = Math.max(weit, fortschritt(i, p)); }
      w += block * (gew.block || 0) + weit * ((frueh ? gew.weitFrueh : gew.weit) || 0);
    }
    return w + zufall() * (gew.rausch || 0);
  };
  for (const z of zuege) z.w = bewerte(z);
  zuege.sort((a, b) => b.w - a.w);
  if (!gew.reich) return zuege[0];

  // Blick nach vorn: die besten Kandidaten genauer prüfen (Gegner-Möglichkeiten danach)
  const kandidaten = zuege.slice(0, gew.kand || 10);
  for (const z of kandidaten) {
    lege(s, p, z.f, z.felder);
    z.w += (reichweite(s, p) - reichweite(s, q)) * gew.reich;
    zuruecknehmen(s, p, z);
  }
  kandidaten.sort((a, b) => b.w - a.w);
  return kandidaten[0];
}

// Wie viele Felder könnte p mit seinen restlichen Steinen überhaupt noch erreichen?
export function reichweite(s, p) {
  const zz = zuegeVon(s, p);
  const da = new Uint8Array(N * N);
  let n = 0;
  for (const z of zz) for (const i of z.felder) if (!da[i]) { da[i] = 1; n++; }
  return n;
}
