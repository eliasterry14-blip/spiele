// ═══════════════════════════════════════════════════════════════════
// LOGIC DUEL – Aufgaben-Erzeuger, Prüfer und KI-Zeitplan
// Ohne Bildschirm, darum auch mit Node testbar (tests/logicduel.test.mjs).
// Jede Aufgabe hat GENAU eine richtige Antwort unter 4 verschiedenen Zahlen.
// ═══════════════════════════════════════════════════════════════════

export const ZIEL = 10;      // wer zuerst 10 Punkte hat, gewinnt
export const DAUER = 120;    // Sekunden, danach gewinnt der höhere Stand
export const SPERRE = 1.2;   // Sekunden gesperrt nach einer falschen Antwort

// kiZeit = Denkzeit der KI für eine leichte Aufgabe (schwere Aufgaben dauern länger, siehe „last“)
export const STUFEN = [
  { name: 'Impuls', kiZeit: 9.0, treffer: 0.60 },
  { name: 'Synapse', kiZeit: 7.2, treffer: 0.68 },
  { name: 'Schaltkreis', kiZeit: 5.6, treffer: 0.76 },
  { name: 'Prozessor', kiZeit: 4.4, treffer: 0.83 },
  { name: 'Netz', kiZeit: 3.4, treffer: 0.89 },
  { name: 'Singularität', kiZeit: 2.6, treffer: 0.95 },
].map((s) => ({ ...s, werte: [`KI ${s.kiZeit.toFixed(1).replace('.', ',')} s`, `Treffer ${Math.round(s.treffer * 100)} %`] }));

// ——— Zufall (mit Startwert, damit Tests wiederholbar sind) ———
export function zufallsQuelle(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ganz = (z, a, b) => a + Math.floor(z() * (b - a + 1));
const wahl = (z, l) => l[Math.floor(z() * l.length)];
function mische(z, l) {
  const a = l.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(z() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function gewichtet(z, paare) {
  const p = paare.filter(([, g]) => g > 0);
  let r = z() * p.reduce((s, [, g]) => s + g, 0);
  for (const [w, g] of p) if ((r -= g) < 0) return w;
  return p[p.length - 1][0];
}
const bis = (len, fn) => Array.from({ length: len }, (_, i) => fn(i));

// Zahl mit echtem Minuszeichen
export const zf = (n) => (n < 0 ? `−${Math.abs(n)}` : String(n));

// ——— 4 Antworten: die richtige + 3 plausible Ablenker ———
// struktur = „Denkfehler“-Werte (andere Regel, Schritt vergessen …), nah = knapp daneben
function antworten(z, richtig, struktur, nah, { min = 0, max = 2500 } = {}) {
  const genommen = new Set([richtig]);
  const ablenker = [];
  const fenster = Math.max(15, Math.abs(richtig) * 1.5); // plausibel: nicht meilenweit daneben
  const nimm = (v) => {
    if (ablenker.length >= 3 || !Number.isInteger(v) || v < min || v > max || genommen.has(v)) return;
    if (Math.abs(v - richtig) > fenster) return;
    genommen.add(v); ablenker.push(v);
  };
  const s = mische(z, struktur), n = mische(z, nah);
  for (const v of s) { if (ablenker.length >= 2) break; nimm(v); }
  for (const v of n) { if (ablenker.length >= 3) break; nimm(v); }
  for (const v of s) nimm(v);
  for (const v of n) nimm(v);
  for (let k = 3; ablenker.length < 3 && k < 200; k++) { nimm(richtig + (z() < 0.5 ? k : -k)); nimm(richtig + k); }
  const liste = mische(z, [richtig, ...ablenker]);
  return { antworten: liste, richtig: liste.indexOf(richtig) };
}

// ═══════════════════════════════════════════════════════════════════
// 1 · ZAHLENREIHE   „2 · 4 · 8 · 16 · ?“
// ═══════════════════════════════════════════════════════════════════

// Alle Regeln, die ein Mensch in einer Reihe sehen könnte → ihre Vorhersagen.
// Eine Reihe ist nur gültig, wenn ALLE passenden Regeln dasselbe vorhersagen.
export function reiheVorhersagen(T) {
  const n = T.length, erg = [];
  const gleich = (a) => a.length >= 2 && a.every((x) => Math.abs(x - a[0]) < 1e-9);
  // konstante Differenzen 1.–3. Ordnung (gleichmäßig, Quadratzahlen, Kubikzahlen …)
  let d = T.slice(), summe = T[n - 1];
  for (let k = 1; k <= 3; k++) {
    d = d.slice(1).map((x, i) => x - d[i]);
    if (d.length < 2) break;
    summe += d[d.length - 1];
    if (gleich(d)) { erg.push(summe); break; }
  }
  // gleicher Faktor
  if (n >= 3 && T.every((x) => x !== 0)) {
    const r = T.slice(1).map((x, i) => x / T[i]);
    if (gleich(r)) erg.push(T[n - 1] * r[0]);
  }
  // x → q·x + c
  if (n >= 4 && T[1] !== T[0]) {
    const q = (T[2] - T[1]) / (T[1] - T[0]), c = T[1] - q * T[0];
    if (T.every((x, i) => i === 0 || Math.abs(q * T[i - 1] + c - x) < 1e-6)) erg.push(q * T[n - 1] + c);
  }
  // Fibonacci-artig: Summe der zwei Vorgänger
  if (n >= 4 && T.every((x, i) => i < 2 || x === T[i - 1] + T[i - 2])) erg.push(T[n - 1] + T[n - 2]);
  // zwei ineinander verschränkte gleichmäßige Reihen
  if (n >= 5) {
    const A = T.filter((_, i) => i % 2 === 0), B = T.filter((_, i) => i % 2 === 1);
    const arith = (x) => x.length < 3 || gleich(x.slice(1).map((v, i) => v - x[i]));
    if (arith(A) && arith(B)) {
      const P = n % 2 === 0 ? A : B;
      if (P.length >= 2) erg.push(2 * P[P.length - 1] - P[P.length - 2]);
    }
  }
  // zwei abwechselnde Rechenschritte (+a / ×b / −c)
  if (n >= 5) {
    const schritte = (p) => { const s = []; for (let i = p; i < n - 1; i += 2) s.push([T[i], T[i + 1]]); return s; };
    const regeln = (s) => {
      const r = [];
      const dd = s.map(([a, b]) => b - a);
      if (gleich(dd)) r.push((x) => x + dd[0]);
      if (s.every(([a]) => a !== 0)) { const qq = s.map(([a, b]) => b / a); if (gleich(qq)) r.push((x) => x * qq[0]); }
      return r;
    };
    const r0 = regeln(schritte(0)), r1 = regeln(schritte(1));
    if (r0.length && r1.length) for (const fn of ((n - 1) % 2 === 0 ? r0 : r1)) erg.push(fn(T[n - 1]));
  }
  return erg;
}

function reihe(z, s) {
  const arten = [['arith', 3], ['geo', 2.4]];
  if (s >= 2) arten.push(['quadrat', 1.3], ['wechsel', 2]);
  if (s >= 3) arten.push(['fibo', 1.3], ['stufe2', 2]);
  if (s >= 4) arten.push(['lin', 1.5]);
  if (s >= 5) arten.push(['kubik', 0.6]);
  let art = gewichtet(z, arten);
  let f, n = 5, last = 1, extra = [];
  switch (art) {
    case 'arith': {
      let d = ganz(z, [2, 3, 4, 6, 11, 13][s - 1], [9, 12, 15, 19, 29, 37][s - 1]);
      if (s >= 3 && z() < 0.4) d = -d;
      let a = ganz(z, 1, [15, 30, 60, 99, 150, 200][s - 1]);
      if (d < 0 && s < 5) a += -d * 5;
      if (d < 0 && s >= 5 && z() < 0.5) a = ganz(z, 2, 40); // läuft unter null
      f = bis(n + 1, (i) => a + i * d);
      last = 0.9;
      break;
    }
    case 'geo': {
      const v = s <= 2 ? 'auf' : gewichtet(z, [['auf', 2], ['ab', 1.5], ['minus', s >= 5 ? 1.2 : 0], ['anderthalb', s >= 6 ? 1 : 0]]);
      art = `geo-${v}`;
      if (v === 'auf') {
        const q = s === 1 ? 2 : wahl(z, s === 2 ? [2, 3] : [2, 3, 4, 5]);
        n = q >= 3 ? 4 : 5;
        const grenze = [200, 600, 1200, 2000, 2500, 2500][s - 1];
        const aMax = Math.max(1, Math.min(Math.floor(grenze / q ** n), [6, 8, 9, 12, 15, 15][s - 1]));
        const a = ganz(z, 1, aMax);
        f = bis(n + 1, (i) => a * q ** i);
        extra = [f[n - 1] * (q + 1), f[n - 1] * q - q, f[n - 1] * q + a];
        last = q >= 4 ? 1.05 : 0.95;
      } else if (v === 'ab') {
        const q = s === 3 ? 2 : wahl(z, [2, 2, 3]);
        n = q === 2 ? 5 : 4;
        const e = ganz(z, 1, q === 2 ? 12 : 9);
        f = bis(n + 1, (i) => e * q ** (n - i));
        extra = [f[n - 1] - e - 1, f[n - 1] - 2, f[n - 1] / 2 + 1, e * 2 + 1];
        last = 1.05;
      } else if (v === 'minus') {
        const q = wahl(z, [-2, -3]);
        n = q === -2 ? 5 : 4;
        const a = ganz(z, 1, q === -2 ? 9 : 5);
        f = bis(n + 1, (i) => a * q ** i);
        extra = [-f[n], f[n - 1] * 2, -f[n - 1] * 2 - Math.sign(f[n - 1])];
        last = 1.2;
      } else { // ×1,5
        const k = ganz(z, 1, 4);
        n = 4;
        f = bis(n + 1, (i) => (16 * k * 3 ** i) / 2 ** i);
        extra = [f[n - 1] * 2, f[n] + 1, f[n] - 3];
        last = 1.35;
      }
      break;
    }
    case 'quadrat': {
      const v = s === 2 ? 'rein' : gewichtet(z, [['rein', 1], ['plus', 1], ['pronic', s >= 4 ? 1 : 0], ['doppelt', s >= 4 ? 0.6 : 0], ['ab', s >= 5 ? 1 : 0]]);
      art = `quadrat-${v}`;
      const k0 = ganz(z, ...[[1, 5], [1, 5], [2, 7], [2, 8], [4, 11], [6, 14]][s - 1]);
      n = s >= 5 && v === 'rein' ? 4 : 5;
      const c = v === 'plus' ? wahl(z, [-1, 1, 2, 3]) : 0;
      const fn = { rein: (k) => k * k, plus: (k) => k * k + c, pronic: (k) => k * (k + 1), doppelt: (k) => 2 * k * k, ab: (k) => k * k }[v];
      f = v === 'ab' ? bis(n + 1, (i) => fn(k0 + n - i)) : bis(n + 1, (i) => fn(k0 + i));
      extra = [f[n] + 1, f[n] - 1, f[n] + 2];
      last = v === 'rein' ? 1.0 : 1.2;
      break;
    }
    case 'wechsel': {
      if (z() < 0.5) {
        art = 'wechsel-zwei';
        n = z() < 0.5 ? 6 : 7;
        const [aMax, dMax] = [[0, 0], [20, 6], [25, 7], [30, 9], [40, 12], [60, 15]][s - 1];
        const a = ganz(z, 1, aMax), b = ganz(z, 1, aMax);
        const d1 = ganz(z, 1, dMax);
        let d2 = ganz(z, 1, dMax); if (z() < 0.4) d2 = -d2;
        if (d2 === d1) return null;
        f = bis(n + 1, (i) => (i % 2 === 0 ? a + (i / 2) * d1 : b + ((i - 1) / 2) * d2));
        extra = [2 * f[n - 1] - f[n - 3], f[n - 1] + (f[n - 1] - f[n - 2]), f[n - 2] + (f[n] - f[n - 2]) * 2];
        last = 1.25;
      } else {
        art = 'wechsel-ops';
        const paare = s <= 3 ? [['+', '×'], ['×', '+'], ['+', '−']] : [['+', '×'], ['×', '+'], ['+', '−'], ['×', '−'], ['−', '×']];
        const [o1, o2] = wahl(z, paare);
        const wert = (o) => (o === '×' ? ganz(z, 2, s >= 5 ? 4 : 3) : ganz(z, 1, s >= 4 ? 12 : 9));
        const w1 = wert(o1), w2 = wert(o2);
        if (o1 === '+' && o2 === '−' && w1 === w2) return null;
        n = 6;
        f = [ganz(z, 1, s >= 4 ? 15 : 9)];
        for (let i = 0; i < n; i++) f.push(RECHNE[i % 2 ? o2 : o1](f[i], i % 2 ? w2 : w1));
        extra = [RECHNE[o1](f[n - 1], w1), f[n - 1] + (f[n - 1] - f[n - 2]), 2 * f[n - 1] - f[n - 3]];
        last = 1.35;
      }
      break;
    }
    case 'fibo': {
      n = s <= 4 ? 6 : 5;
      const a = ganz(z, 1, s <= 4 ? 9 : 20), b = ganz(z, 1, s <= 4 ? 12 : 25);
      if (a === b) return null;
      f = [a, b];
      while (f.length < n + 1) f.push(f[f.length - 1] + f[f.length - 2]);
      extra = [f[n - 1] * 2, 2 * f[n - 1] - f[n - 2], f[n] + f[n - 3] - f[n - 2]];
      last = 1.15;
      break;
    }
    case 'stufe2': {
      const a = ganz(z, 1, s <= 4 ? 30 : 60);
      const e = ganz(z, ...[[1, 1], [1, 2], [1, 3], [2, 4], [2, 5], [3, 6]][s - 1]);
      let d0 = ganz(z, 1, 6);
      if (s >= 5 && z() < 0.4) d0 = -ganz(z, e + 1, 3 * e + 2);
      n = 5;
      f = [a];
      for (let i = 0, d = d0; i < n; i++, d += e) f.push(f[i] + d);
      extra = [2 * f[n - 1] - f[n - 2], f[n] + e, f[n] - e, f[n] + 2 * e];
      last = 1.3;
      break;
    }
    case 'lin': {
      const q = wahl(z, [2, 2, 3]);
      let c = ganz(z, -3, 4); if (c === 0) c = 1;
      n = q === 2 ? 5 : 4;
      f = [ganz(z, 1, q === 2 ? 9 : 5)];
      for (let i = 0; i < n; i++) f.push(q * f[i] + c);
      extra = [q * f[n - 1], q * f[n - 1] + c + Math.sign(c), 2 * f[n - 1] - f[n - 2]];
      last = 1.5;
      break;
    }
    case 'kubik': {
      const k0 = ganz(z, 1, s === 5 ? 3 : 5);
      n = 5;
      f = bis(n + 1, (i) => (k0 + i) ** 3);
      extra = [2 * f[n - 1] - f[n - 2], (k0 + n) ** 2, f[n] + 1, f[n] - 8];
      last = 1.35;
      break;
    }
  }
  const sicht = f.slice(0, n), wert = f[n];
  if (!f.every(Number.isInteger) || f.some((x) => Math.abs(x) > 2500)) return null;
  if (s < 5 && f.some((x) => x < 0)) return null;
  if (new Set(sicht).size < 3) return null;
  const vh = reiheVorhersagen(sicht);
  if (!vh.length || vh.some((v) => Math.abs(v - wert) > 1e-6)) return null;
  const L = sicht[n - 1], D = L - sicht[n - 2];
  const struktur = [...extra, L + D, L + 2 * D, wert + (z() < 0.5 ? D : -D), L * 2];
  const nah = [wert + 1, wert - 1, wert + 2, wert - 2, wert + 10, wert - 10];
  const min = sicht.every((x) => x >= 0) && wert >= 0 ? 0 : -2500;
  return { art, anzeige: { werte: sicht }, wert, last, ...antworten(z, wert, struktur, nah, { min }) };
}

// ═══════════════════════════════════════════════════════════════════
// 2 · KOPFRECHEN-KETTE   „8 → +6 → ×3 → −10 → ?“ (Schritt für Schritt)
// ═══════════════════════════════════════════════════════════════════
export const RECHNE = { '+': (x, w) => x + w, '−': (x, w) => x - w, '×': (x, w) => x * w, '÷': (x, w) => x / w, '²': (x) => x * x };

export function rechneKette(start, ops) { return ops.reduce((x, o) => RECHNE[o.z](x, o.w), start); }

// typischer Fehler: Punkt-vor-Strich, obwohl Schritt für Schritt gerechnet wird
function punktVorStrich(start, ops) {
  const terme = [start], zeichen = [];
  for (const o of ops) {
    if (o.z === '×' || o.z === '÷') terme[terme.length - 1] = RECHNE[o.z](terme[terme.length - 1], o.w);
    else { zeichen.push(o.z); terme.push(o.w); }
  }
  return terme.reduce((a, t, i) => (i === 0 ? t : zeichen[i - 1] === '+' ? a + t : a - t), 0);
}

function kette(z, s) {
  const anzahl = [2, 3, 3, 3, 4, 4][s - 1] + (s === 4 && z() < 0.35 ? 1 : 0);
  const grenze = [50, 100, 150, 250, 400, 600][s - 1];
  const [p0, p1] = [[2, 9], [3, 15], [4, 25], [6, 40], [11, 60], [12, 90]][s - 1];
  const [m0, m1] = [[2, 3], [2, 5], [2, 6], [3, 8], [3, 9], [4, 12]][s - 1];
  const tMax = [0, 2, 4, 6, 9, 12][s - 1];
  const start = ganz(z, ...[[2, 12], [3, 20], [4, 30], [6, 40], [8, 60], [10, 80]][s - 1]);
  const unten = s >= 6 ? -60 : 0;
  let x = start;
  const ops = [];
  for (let i = 0; i < anzahl; i++) {
    const moegl = [];
    const p = ganz(z, p0, p1);
    if (x + p <= grenze) moegl.push(['+', p, 1]);
    const m = ganz(z, p0, p1);
    if (x - m >= unten && x - m !== 0) moegl.push(['−', m, 1]);
    const f = ganz(z, m0, m1);
    if (Math.abs(x * f) <= grenze && Math.abs(x) >= 2) moegl.push(['×', f, s >= 3 ? 1.4 : 1]);
    if (tMax) {
      const t = [];
      for (let w = 2; w <= tMax; w++) if (x % w === 0 && Math.abs(x / w) >= 2) t.push(w);
      if (t.length) moegl.push(['÷', wahl(z, t), s >= 3 ? 1.5 : 1]);
    }
    if (s >= 5 && Math.abs(x) >= 3 && Math.abs(x) <= 14 && x * x <= grenze && !ops.some((o) => o.z === '²')) moegl.push(['²', 0, 0.7]);
    const vor = ops.length ? ops[ops.length - 1].z : null;
    let w = moegl.filter(([o]) => o !== vor && !(vor === '+' && o === '−') && !(vor === '−' && o === '+'));
    if (!w.length) w = moegl.filter(([o]) => o !== vor);
    if (!w.length) return null;
    const [o, wert] = gewichtet(z, w.map((e) => [e, e[2]]));
    ops.push(o === '²' ? { z: '²' } : { z: o, w: wert });
    x = RECHNE[o](x, wert);
  }
  const wert = x;
  if (!Number.isInteger(wert) || wert === start) return null;
  const ohne = (skip) => ops.reduce((v, o, i) => (i === skip ? v : RECHNE[o.z](v, o.w)), start);
  const struktur = ops.map((_, i) => ohne(i));
  if (!ops.some((o) => o.z === '²')) struktur.push(punktVorStrich(start, ops));
  const l = ops[ops.length - 1], vorletzt = ohne(ops.length - 1);
  const um = { '+': '−', '−': '+', '×': '÷', '÷': '×' }[l.z];
  if (um) struktur.push(RECHNE[um](vorletzt, l.w));
  const nah = [wert + 1, wert - 1, wert + 2, wert - 2, wert + 10, wert - 10];
  return {
    art: `${ops.length}-schritte`, anzeige: { start, ops }, wert, last: 0.45 + 0.3 * ops.length,
    ...antworten(z, wert, struktur, nah, { min: wert >= 0 ? 0 : -999, max: 9999 }),
  };
}

// ═══════════════════════════════════════════════════════════════════
// 3 · MINI-SUDOKU 4×4 mit einem gesuchten Feld
// ═══════════════════════════════════════════════════════════════════
let ALLE = null;
export function alleSudokus() {
  if (ALLE) return ALLE;
  ALLE = [];
  const g = new Array(16).fill(0);
  const ok = (i, v) => {
    const r = i >> 2, c = i & 3;
    for (let k = 0; k < 4; k++) if (g[r * 4 + k] === v || g[k * 4 + c] === v) return false;
    const br = r & 2, bc = c & 2;
    for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 2; dc++) if (g[(br + dr) * 4 + bc + dc] === v) return false;
    return true;
  };
  const rek = (i) => {
    if (i === 16) { ALLE.push(g.slice()); return; }
    for (let v = 1; v <= 4; v++) if (ok(i, v)) { g[i] = v; rek(i + 1); g[i] = 0; }
  };
  rek(0);
  return ALLE;
}
// Zeile, Spalte, Kasten eines Feldes (ohne das Feld selbst)
export function einheiten(i) {
  const r = i >> 2, c = i & 3, br = r & 2, bc = c & 2;
  return [
    [0, 1, 2, 3].map((k) => r * 4 + k).filter((j) => j !== i),
    [0, 1, 2, 3].map((k) => k * 4 + c).filter((j) => j !== i),
    [0, 1].flatMap((dr) => [0, 1].map((dc) => (br + dr) * 4 + bc + dc)).filter((j) => j !== i),
  ];
}
// Welche Werte kann das Feld in IRGENDEINER gültigen Lösung haben? (alle 288 Gitter durchprobieren)
export function sudokuWerte(felder, ziel) {
  const w = new Set();
  for (const g of alleSudokus()) if (felder.every((v, i) => !v || g[i] === v)) w.add(g[ziel]);
  return w;
}
// Wie viele Einheiten braucht man, um das Feld direkt festzulegen? (1 = eine Einheit voll, 9 = gar nicht direkt)
export function brauchtEinheiten(felder, ziel) {
  const E = einheiten(ziel);
  const deckt = (idx) => { const s = new Set(); for (const e of idx) for (const j of E[e]) if (felder[j]) s.add(felder[j]); return s.size === 3; };
  if ([0, 1, 2].some((e) => deckt([e]))) return 1;
  if ([[0, 1], [0, 2], [1, 2]].some((p) => deckt(p))) return 2;
  if (deckt([0, 1, 2])) return 3;
  return 9;
}

function sudoku(z, s) {
  const loesung = wahl(z, alleSudokus());
  const ziel = ganz(z, 0, 15);
  const [g0, g1] = [[9, 11], [8, 10], [7, 9], [6, 8], [6, 8], [5, 7]][s - 1];
  const G = ganz(z, g0, g1);
  const soll = s <= 2 ? 1 : s <= 4 ? 2 : 3;
  const andere = bis(16, (i) => i).filter((i) => i !== ziel);
  let vorgabe;
  if (soll === 1) {
    const einheit = wahl(z, einheiten(ziel));
    vorgabe = [...einheit, ...mische(z, andere.filter((i) => !einheit.includes(i))).slice(0, G - 3)];
  } else if (soll === 3) {
    // je ein Feld, das NUR in Zeile, NUR in Spalte und NUR im Kasten liegt
    const [zl, sp, bx] = einheiten(ziel);
    const nurZ = zl.filter((j) => !bx.includes(j)), nurS = sp.filter((j) => !bx.includes(j)), nurB = bx.filter((j) => !zl.includes(j) && !sp.includes(j));
    const pflicht = [wahl(z, nurZ), wahl(z, nurS), nurB[0]];
    vorgabe = [...pflicht, ...mische(z, andere.filter((i) => !pflicht.includes(i))).slice(0, G - 3)];
  } else vorgabe = mische(z, andere).slice(0, G);
  const felder = new Array(16).fill(0);
  for (const i of vorgabe) felder[i] = loesung[i];
  if (brauchtEinheiten(felder, ziel) !== soll) return null;
  const werte = sudokuWerte(felder, ziel);
  if (werte.size !== 1) return null;
  const wert = loesung[ziel];
  return { art: `einheiten-${soll}`, anzeige: { felder, ziel }, wert, antworten: [1, 2, 3, 4], richtig: wert - 1, last: [0, 1.0, 1.25, 1.45][soll] };
}

// ═══════════════════════════════════════════════════════════════════
// 4 · SYMBOL-GLEICHUNGEN   „▲ + ▲ = 8 · ■ + ▲ = 11 · ■ + ■ = ?“
// ═══════════════════════════════════════════════════════════════════
export const SYMBOLE = ['dreieck', 'quadrat', 'kreis'];
const OPF = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b };
export const auswerten = (terme, op, v) => terme.map((t) => v[t]).reduce((a, b) => OPF[op](a, b));

// alle Belegungen mit ganzen Zahlen 1…max, die jede Gleichung erfüllen
export function waageLoesungen(zeilen, max = 40) {
  const syms = [...new Set(zeilen.flatMap((g) => g.terme))];
  // Gleichung prüfen, sobald alle ihre Symbole belegt sind (spart fast alles Durchprobieren)
  const fertigBei = zeilen.map((g) => Math.max(...g.terme.map((t) => syms.indexOf(t))));
  const erg = [], v = {};
  const rek = (i) => {
    if (i === syms.length) { erg.push({ ...v }); return; }
    for (let w = 1; w <= max; w++) {
      v[syms[i]] = w;
      if (zeilen.every((g, k) => fertigBei[k] !== i || auswerten(g.terme, g.op, v) === g.erg)) rek(i + 1);
    }
    delete v[syms[i]];
  };
  rek(0);
  return erg;
}
const gleicheGleichung = (a, b) => a.op === b.op && (a.op === '−'
  ? a.terme.join() === b.terme.join()
  : a.terme.slice().sort().join() === b.terme.slice().sort().join());

function waage(z, s) {
  const [X, Y, Z] = mische(z, SYMBOLE);
  const max = s <= 2 ? 9 : s <= 4 ? 12 : 15;
  const v = { [X]: ganz(z, 2, max), [Y]: ganz(z, 1, max), [Z]: ganz(z, 1, max) };
  if (v[X] === v[Y] || v[Y] === v[Z] || v[X] === v[Z]) return null;
  const G = (terme, op) => ({ terme, op, erg: auswerten(terme, op, v) });
  const erste = wahl(z, [[X, X], [X, X, X]]);
  let zeilen, frage, last, art = 'kette';
  switch (s) {
    case 1:
      zeilen = [G(erste, '+'), G([X, Y], '+')];
      frage = wahl(z, [G([Y, Y], '+'), G([X, Y, Y], '+'), G([Y, X], '−')]);
      last = 1.35; break;
    case 2:
      zeilen = [G(erste, '+'), wahl(z, [G([Y, X], '−'), G([X, Y], '+'), G([X, Y, Y], '+')])];
      frage = wahl(z, [G([Y, X], '×'), G([Y, Y, Y], '+'), G([Y, Y, X], '+')]);
      last = 1.45; break;
    case 3:
      zeilen = [G(erste, '+'), G([X, Y], wahl(z, ['+', '−'])), G([Y, Z], wahl(z, ['+', '−']))];
      frage = wahl(z, [G([Z, X], '+'), G([Z, Z], '+'), G([Z, X], '×')]);
      last = 1.7; break;
    case 4:
      zeilen = [G([X, X, X], '+'), G([Y, X], '×'), G([Z, Y], wahl(z, ['+', '−']))];
      frage = wahl(z, [G([Z, X], '×'), G([Z, Z, Y], '+')]);
      last = 1.75; break;
    case 5:
      zeilen = [wahl(z, [G([X, X], '×'), G([X, X, X], '+')]), G([X, Y, Y], '+'), wahl(z, [G([Z, Y], '×'), G([Z, X], '−')])];
      frage = wahl(z, [G([Z, Y], '+'), G([Z, X], '×'), G([Z, Z], '+')]);
      last = 1.75; break;
    default:
      if (z() < 0.5) {
        art = 'paar';
        zeilen = [G([X, Y], '+'), G([X, Y], '−'), wahl(z, [G([Z, X], '×'), G([Z, Y, Y], '+')])];
        last = 1.95;
      } else {
        zeilen = [wahl(z, [G([X, X], '×'), G([X, X, X], '+')]), G([Y, X], '×'), G([Z, Y], '−')];
        last = 1.75;
      }
      frage = wahl(z, [G([Z, Y], '+'), G([Z, X], '×'), G([Z, Y], '−')]);
  }
  if (s >= 5 && z() < 0.5) { zeilen = mische(z, zeilen); art += '-gemischt'; last += 0.12; }
  const alle = [...zeilen, frage];
  if (alle.some((g) => !Number.isInteger(g.erg) || g.erg < 1 || g.erg > 300)) return null;
  if (zeilen.some((g) => gleicheGleichung(g, frage))) return null;
  const loes = waageLoesungen(zeilen);
  if (loes.length !== 1) return null;
  const wert = frage.erg;
  const anders = (ersetze) => auswerten(frage.terme, frage.op, { ...v, ...ersetze });
  const struktur = [
    anders({ [Z]: v[Y] }), anders({ [Y]: v[X] }), anders({ [X]: v[Y] }), anders({ [Z]: v[X] }),
    frage.op === '×' ? auswerten(frage.terme, '+', v) : auswerten(frage.terme, '×', v),
    zeilen[zeilen.length - 1].erg, wert + v[X],
  ];
  const nah = [wert + 1, wert - 1, wert + 2, wert - 2];
  return {
    art, anzeige: { zeilen: zeilen.map(({ terme, op, erg }) => ({ terme, op, erg })), frage: { terme: frage.terme, op: frage.op } },
    wert, last, ...antworten(z, wert, struktur, nah, { min: 1, max: 999 }),
  };
}

// ═══════════════════════════════════════════════════════════════════
// 5 · AUSREISSER   „Welche Zahl passt nicht?“
// ═══════════════════════════════════════════════════════════════════
export const istPrim = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
export const istQuadrat = (n) => n >= 0 && Math.round(Math.sqrt(n)) ** 2 === n;
export const istKubik = (n) => n >= 0 && Math.round(Math.cbrt(n)) ** 3 === n;
export const istZweier = (n) => n > 0 && (n & (n - 1)) === 0;
export const quersumme = (n) => String(Math.abs(n)).split('').reduce((a, c) => a + +c, 0);
const gleicheZiffern = (n) => n >= 11 && new Set(String(n)).size === 1;

const vielfache = (k, ab, bis2 = 6, last = 1.2) => ({
  id: `v${k}`, ab, bis: bis2, last,
  baue: (z, s) => {
    const kMax = Math.floor((s >= 5 ? 400 : 150) / k);
    return {
      test: (n) => n % k === 0,
      mit: () => k * ganz(z, 2, Math.max(6, kMax)),
      aus: () => k * ganz(z, 2, Math.max(6, kMax)) + wahl(z, k >= 6 ? [-2, -1, 1, 2, 3] : [-1, 1, 2]),
    };
  },
});
const PRIMZAHLEN = bis(200, (i) => i).filter(istPrim);
const UNGERADE_ZUS = bis(200, (i) => i).filter((n) => n > 9 && n % 2 && n % 5 && !istPrim(n));

export const REGELN = [
  { id: 'gerade', ab: 1, bis: 3, last: 0.95, baue: (z) => ({ test: (n) => n % 2 === 0, mit: () => 2 * ganz(z, 3, 49), aus: () => 2 * ganz(z, 3, 49) + 1 }) },
  { id: 'ungerade', ab: 1, bis: 3, last: 0.95, baue: (z) => ({ test: (n) => n % 2 === 1, mit: () => 2 * ganz(z, 3, 49) + 1, aus: () => 2 * ganz(z, 3, 49) }) },
  vielfache(5, 1, 4, 1.0), vielfache(10, 1, 2, 0.95),
  vielfache(3, 2, 5, 1.2), vielfache(4, 2, 5, 1.2),
  vielfache(6, 3), vielfache(7, 3), vielfache(8, 3),
  vielfache(9, 4, 6, 1.3), vielfache(11, 4, 6, 1.3), vielfache(12, 5, 6, 1.4), vielfache(13, 6, 6, 1.5),
  { id: 'quadrat', ab: 3, bis: 6, last: 1.3, baue: (z, s) => {
    const k = s >= 5 ? 25 : 12;
    return { test: istQuadrat, mit: () => ganz(z, 2, k) ** 2, aus: () => ganz(z, 3, k) ** 2 + wahl(z, [-1, 1, 2, -2]) };
  } },
  { id: 'prim', ab: 4, bis: 6, last: 1.5, baue: (z, s) => {
    const g = s >= 6 ? 199 : 99;
    return { test: istPrim, mit: () => wahl(z, PRIMZAHLEN.filter((p) => p > 10 && p <= g)), aus: () => wahl(z, UNGERADE_ZUS.filter((n) => n <= g)) };
  } },
  { id: 'zweier', ab: 5, bis: 6, last: 1.4, baue: (z) => ({
    test: istZweier, mit: () => 2 ** ganz(z, 2, 9),
    aus: () => { const k = 2 ** ganz(z, 3, 8); return wahl(z, [k + k / 2, k + 2, k - 2, k * 3]); },
  }) },
  { id: 'kubik', ab: 5, bis: 6, last: 1.45, baue: (z) => ({ test: istKubik, mit: () => ganz(z, 2, 9) ** 3, aus: () => ganz(z, 2, 9) ** 3 + wahl(z, [-1, 1, 2]) }) },
  { id: 'quersumme', ab: 5, bis: 6, last: 1.6, baue: (z, s) => {
    const q = ganz(z, 7, 14);
    const zahl = (soll) => { for (let v = 0; v < 400; v++) { const n = ganz(z, 12, s >= 6 ? 999 : 299); if (quersumme(n) === soll) return n; } return 0; };
    return { test: (n) => quersumme(n) === q, mit: () => zahl(q), aus: () => zahl(q + wahl(z, [-1, 1])) };
  } },
];

// Jede Eigenschaft, die einem Menschen bei 6 Zahlen auffallen könnte
function pruefFamilien(zahlen) {
  const f = [(n) => n % 2 === 0, (n) => n % 2 === 1, istQuadrat, istKubik, istPrim, istZweier, gleicheZiffern,
    (n) => n < 10, (n) => n >= 10 && n < 100, (n) => n >= 100];
  for (let k = 3; k <= 25; k++) f.push((n) => n % k === 0);
  for (const q of new Set(zahlen.map(quersumme))) f.push((n) => quersumme(n) === q);
  for (const e of new Set(zahlen.map((n) => n % 10))) f.push((n) => n % 10 === e);
  return f;
}
// mehrdeutig = irgendeine andere Eigenschaft hat genau EINEN anderen Ausreißer
export function ausreisserMehrdeutig(zahlen, aus) {
  for (const f of pruefFamilien(zahlen)) {
    const weg = zahlen.filter((n) => !f(n));
    if (weg.length === 1 && weg[0] !== aus) return true;
  }
  return false;
}

function ausreisser(z, s) {
  const regel = wahl(z, REGELN.filter((r) => s >= r.ab && s <= r.bis));
  const r = regel.baue(z, s);
  const set = new Set(), mitglieder = [];
  for (let v = 0; v < 80 && mitglieder.length < 5; v++) {
    const m = r.mit();
    if (m > 1 && m <= 999 && !set.has(m) && r.test(m)) { set.add(m); mitglieder.push(m); }
  }
  if (mitglieder.length < 5) return null;
  let aus = null;
  for (let v = 0; v < 40 && aus === null; v++) { const a = r.aus(); if (a > 1 && a <= 999 && !set.has(a) && !r.test(a)) aus = a; }
  if (aus === null) return null;
  const zahlen = mische(z, [...mitglieder, aus]);
  if (ausreisserMehrdeutig(zahlen, aus)) return null;
  const knoepfe = mische(z, [aus, ...mische(z, mitglieder).slice(0, 3)]);
  return { art: regel.id, anzeige: { zahlen }, wert: aus, antworten: knoepfe, richtig: knoepfe.indexOf(aus), last: regel.last };
}

// ═══════════════════════════════════════════════════════════════════
// 6 · ZAHLENRASTER 3×3   jede Zeile folgt derselben Rechnung
// ═══════════════════════════════════════════════════════════════════
const RASTER_REGELN = [
  { fit: (a, b, c) => a + b === c, los: ([a, b, c]) => (a === null ? c - b : b === null ? c - a : a + b) },
  { fit: (a, b, c) => a - b === c, los: ([a, b, c]) => (a === null ? c + b : b === null ? a - c : a - b) },
  { fit: (a, b, c) => b - a === c, los: ([a, b, c]) => (a === null ? b - c : b === null ? a + c : b - a) },
  { fit: (a, b, c) => a * b === c, los: ([a, b, c]) => (a === null ? c / b : b === null ? c / a : a * b) },
  { fit: (a, b, c) => b !== 0 && a / b === c, los: ([a, b, c]) => (a === null ? b * c : b === null ? a / c : a / b) },
  { fit: (a, b, c) => a !== 0 && b / a === c, los: ([a, b, c]) => (a === null ? b / c : b === null ? a * c : b / a) },
];
// alle Vorhersagen für das leere Feld (Zeilen- und Spalten-Regeln, gleiche Summen)
export function rasterVorhersagen(f) {
  const erg = [];
  const linien = {
    zeilen: [0, 1, 2].map((r) => [0, 1, 2].map((c) => r * 3 + c)),
    spalten: [0, 1, 2].map((c) => [0, 1, 2].map((r) => r * 3 + c)),
  };
  for (const art of ['zeilen', 'spalten']) {
    const L = linien[art].map((idx) => idx.map((i) => f[i]));
    const voll = L.filter((l) => l.every((x) => x !== null)), offen = L.find((l) => l.some((x) => x === null));
    if (voll.length < 2 || !offen) continue;
    for (const r of RASTER_REGELN) if (voll.every(([a, b, c]) => r.fit(a, b, c))) erg.push(r.los(offen));
    const S = voll.map((l) => l[0] + l[1] + l[2]);
    if (S.every((x) => x === S[0])) erg.push(S[0] - offen.reduce((a, x) => a + (x ?? 0), 0));
  }
  return erg;
}

function raster(z, s) {
  const ops = s === 3 ? ['+', '−'] : s === 4 ? ['+', '−', '×'] : ['+', '−', '×', '÷'];
  const op = wahl(z, ops);
  const zeile = () => {
    if (op === '+') { const a = ganz(z, 2, 9 + 4 * s), b = ganz(z, 2, 9 + 4 * s); return [a, b, a + b]; }
    if (op === '−') { const b = ganz(z, 2, 6 + 3 * s), c = ganz(z, 1, 6 + 4 * s); return [b + c, b, c]; }
    if (op === '×') { const a = ganz(z, 2, s >= 6 ? 12 : 9), b = ganz(z, 2, 9); return [a, b, a * b]; }
    const b = ganz(z, 2, 9), c = ganz(z, 2, 9); return [b * c, b, c];
  };
  const reihen = [zeile(), zeile(), zeile()];
  if (new Set(reihen.map((r) => r.join())).size < 3) return null;
  const quer = s >= 6 && z() < 0.4; // Regel läuft von oben nach unten
  const pos = s >= 5 ? ganz(z, 0, 2) : 2;
  const ziel = quer ? pos * 3 + 2 : 6 + pos;
  const felder = bis(9, (i) => { const r = Math.floor(i / 3), c = i % 3; return quer ? reihen[c][r] : reihen[r][c]; });
  if (felder.some((x) => x < 1 || x > 199)) return null;
  const wert = felder[ziel];
  const anzeige = felder.slice(); anzeige[ziel] = null;
  const vh = rasterVorhersagen(anzeige);
  if (!vh.length || vh.some((x) => Math.abs(x - wert) > 1e-9)) return null;
  const offen = (quer ? [2, 5, 8] : [6, 7, 8]).map((i) => anzeige[i]);
  const struktur = RASTER_REGELN.map((r) => r.los(offen));
  const nah = [wert + 1, wert - 1, wert + 2, wert - 2, wert + 10];
  return {
    art: `${op}${pos < 2 ? '-innen' : ''}${quer ? '-quer' : ''}`, anzeige: { felder: anzeige, ziel }, wert,
    last: (op === '×' ? 1.45 : op === '÷' ? 1.55 : 1.35) + (pos < 2 ? 0.2 : 0) + (quer ? 0.15 : 0),
    ...antworten(z, wert, struktur, nah, { min: 1, max: 999 }),
  };
}

// ═══════════════════════════════════════════════════════════════════
// Mischung je Stufe + öffentliche Funktionen
// ═══════════════════════════════════════════════════════════════════
const ERZEUGER = { reihe, kette, sudoku, waage, ausreisser, raster };
export const TYPEN = Object.keys(ERZEUGER);
const MIX = {
  reihe: [3, 3, 3, 3, 3, 3],
  kette: [2.2, 2.2, 2, 1.8, 1.6, 1.4],
  sudoku: [1.4, 1.4, 1.5, 1.5, 1.6, 1.6],
  waage: [1.6, 1.6, 1.5, 1.4, 1.2, 1.1],
  ausreisser: [1.5, 1.5, 1.5, 1.6, 1.7, 1.8],
  raster: [0, 0, 1.3, 1.4, 1.4, 1.4],
};
export const typenFuer = (nr) => TYPEN.filter((t) => MIX[t][nr - 1] > 0);

export function erzeugeTyp(typ, nr, z = Math.random) {
  for (let v = 0; v < 500; v++) {
    const a = ERZEUGER[typ](z, nr);
    // größere Zahlen auf höheren Stufen brauchen auch etwas länger
    if (a) return { typ, ...a, last: +(a.last * (1 + 0.03 * (nr - 1))).toFixed(3) };
  }
  throw new Error(`Keine Aufgabe für ${typ} auf Stufe ${nr}`);
}

// nächste Aufgabe (nie zweimal derselbe Typ hintereinander)
export function erzeugeAufgabe(nr, z = Math.random, vorher = null) {
  const typ = gewichtet(z, TYPEN.filter((t) => t !== vorher).map((t) => [t, MIX[t][nr - 1]]));
  return erzeugeTyp(typ, nr, z);
}

// ——— KI ———
// Wann „löst“ die KI diese Aufgabe, und liegt sie richtig?
export function kiPlan(stufe, aufgabe, z = Math.random, nachFehler = false) {
  const zeit = stufe.kiZeit * aufgabe.last * (0.8 + 0.45 * z()) * (nachFehler ? 0.5 : 1);
  return { zeit, trifft: z() < stufe.treffer };
}
// Daneben getippt: eine falsche Antwort, die noch nicht ausgeschlossen ist
export function kiFalscheWahl(aufgabe, weg, z = Math.random) {
  const moegl = [0, 1, 2, 3].filter((i) => i !== aufgabe.richtig && !weg.has(i));
  return moegl.length ? wahl(z, moegl) : aufgabe.richtig;
}

// Sterne nach Vorsprung und Tempo
export function sterne(du, ki, sek) {
  const vorsprung = du - ki;
  if (du >= ZIEL && vorsprung >= 5) return 3;
  if (vorsprung >= 3 || (du >= ZIEL && sek <= 60)) return 2;
  return 1;
}
// Wer hat gewonnen? true / false / null (Remis)
export function ausgang(du, ki) { return du > ki ? true : du < ki ? false : null; }
