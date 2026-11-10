// CODEBREAKER – Regeln (ohne Bildschirm → mit Node testbar)
// Ein geheimer Code aus L Steinen (Farben 0 … F-1). Pro Versuch gibt es Lichter:
// Gold = richtige Farbe am richtigen Platz, Silber = richtige Farbe am falschen Platz.

// Die 6 Stufen: L Steine, F Farben, V Versuche, doppelt = gleiche Farbe mehrmals erlaubt
export const STUFEN = [
  { name: 'Riss',  L: 4, F: 6, V: 10, doppelt: false },
  { name: 'Spalt', L: 4, F: 6, V: 9,  doppelt: true },
  { name: 'Bruch', L: 5, F: 7, V: 10, doppelt: false },
  { name: 'Kern',  L: 5, F: 8, V: 9,  doppelt: true },
  { name: 'Glut',  L: 6, F: 8, V: 10, doppelt: true },
  { name: 'Licht', L: 6, F: 9, V: 9,  doppelt: true },
].map((s) => ({ ...s, werte: [`${s.L} Steine · ${s.F} Farben`, `${s.V} Versuche`, s.doppelt ? 'Doppelt' : 'Einzeln'] }));

// Rückmeldung für einen Versuch
export function bewerte(code, versuch) {
  const L = code.length;
  let gold = 0;
  const restCode = new Map(), restVersuch = new Map();
  for (let i = 0; i < L; i++) {
    if (code[i] === versuch[i]) { gold++; continue; }
    restCode.set(code[i], (restCode.get(code[i]) || 0) + 1);
    restVersuch.set(versuch[i], (restVersuch.get(versuch[i]) || 0) + 1);
  }
  let silber = 0;
  for (const [farbe, n] of restVersuch) silber += Math.min(n, restCode.get(farbe) || 0);
  return { gold, silber };
}

// Ist eine Reihe/ein Code erlaubt?
export function istGueltig(code, laenge, farben, doppelt) {
  if (!Array.isArray(code) || code.length !== laenge) return false;
  if (code.some((c) => !Number.isInteger(c) || c < 0 || c >= farben)) return false;
  if (!doppelt && new Set(code).size !== code.length) return false;
  return true;
}

// Zufälliger Geheimcode passend zur Stufe
export function zufallsCode(laenge, farben, doppelt, zufall = Math.random) {
  if (!doppelt && laenge > farben) throw new Error('zu wenige Farben');
  if (doppelt) return Array.from({ length: laenge }, () => Math.floor(zufall() * farben));
  const topf = Array.from({ length: farben }, (_, i) => i);
  for (let i = 0; i < laenge; i++) {
    const r = i + Math.floor(zufall() * (farben - i));
    [topf[i], topf[r]] = [topf[r], topf[i]];
  }
  return topf.slice(0, laenge);
}

// Sterne: ≤ 50 % der Versuche → 3, ≤ 75 % → 2, sonst 1
export function sterneFuer(benutzt, max) {
  const q = benutzt / max;
  return q <= 0.5 ? 3 : q <= 0.75 ? 2 : 1;
}

// Alle möglichen Codes (für den Test-Löser)
export function alleCodes(laenge, farben, doppelt) {
  const aus = [], c = new Array(laenge).fill(0);
  const lauf = (pos) => {
    if (pos === laenge) { aus.push(c.slice()); return; }
    for (let f = 0; f < farben; f++) {
      if (!doppelt && c.slice(0, pos).includes(f)) continue;
      c[pos] = f; lauf(pos + 1);
    }
  };
  lauf(0);
  return aus;
}

// Nur die Codes behalten, die zu einer Rückmeldung passen
export function passendeCodes(kandidaten, versuch, erg) {
  return kandidaten.filter((k) => { const e = bewerte(k, versuch); return e.gold === erg.gold && e.silber === erg.silber; });
}

export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function zufallMitSamen(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
