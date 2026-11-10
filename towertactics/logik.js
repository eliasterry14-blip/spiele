// TOWER TACTICS – Regeln + KI (ohne Bildschirm, darum mit Node testbar)
// Quadratisches Brett. Abwechselnd setzt man einen Turm auf ein freies Feld, das NICHT nur vom Gegner beherrscht wird.
// Ein Turm beherrscht seine Reihe und Spalte in alle 4 Richtungen bis zum nächsten Turm (egal wessen).
// Feld gehört dir, wenn nur du es beherrschst · beide = neutral · Turmfelder gehören ihrem Besitzer.
// Wer nicht setzen kann, setzt aus; setzen beide hintereinander aus, ist Schluss. Mehr Felder gewinnt.

// feld[i]: 0 = leer, 1 = Turm von Spieler 0, 2 = Turm von Spieler 1 · i = y * n + x
export function neuesSpiel(n = 5) {
  return { n, feld: new Int8Array(n * n), dran: 0, aus: 0, zuege: 0 };
}
export const kopie = (s) => ({ n: s.n, feld: s.feld.slice(), dran: s.dran, aus: s.aus, zuege: s.zuege });

// Herrschaft je Feld als Bits: 1 = Spieler 0 beherrscht es, 2 = Spieler 1, 3 = beide
export function herrschaft(feld, n, h = new Uint8Array(n * n)) {
  h.fill(0);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const t = feld[y * n + x];
    if (!t) continue;
    for (let k = x + 1; k < n && !feld[y * n + k]; k++) h[y * n + k] |= t;
    for (let k = x - 1; k >= 0 && !feld[y * n + k]; k--) h[y * n + k] |= t;
    for (let k = y + 1; k < n && !feld[k * n + x]; k++) h[k * n + x] |= t;
    for (let k = y - 1; k >= 0 && !feld[k * n + x]; k--) h[k * n + x] |= t;
  }
  return h;
}

// Wem gehört Feld i? 0 / 1 = Spieler, 2 = neutral, -1 = niemand
export function besitzer(feld, h, i) {
  if (feld[i]) return feld[i] - 1;
  return h[i] === 1 ? 0 : h[i] === 2 ? 1 : h[i] === 3 ? 2 : -1;
}

export function punkte(feld, n, h = herrschaft(feld, n)) {
  let a = 0, b = 0;
  for (let i = 0; i < n * n; i++) {
    const t = feld[i];
    if (t === 1 || (!t && h[i] === 1)) a++;
    else if (t === 2 || (!t && h[i] === 2)) b++;
  }
  return [a, b];
}

// Darf Spieler p auf Feld i setzen? (frei und nicht NUR vom Gegner beherrscht)
export const darf = (feld, h, p, i) => !feld[i] && h[i] !== (p === 0 ? 2 : 1);

export function erlaubt(s, p = s.dran, h = herrschaft(s.feld, s.n)) {
  const out = [];
  for (let i = 0; i < s.n * s.n; i++) if (darf(s.feld, h, p, i)) out.push(i);
  return out;
}

export function setze(s, i) {
  const t = kopie(s);
  t.feld[i] = s.dran + 1; t.dran = 1 - s.dran; t.aus = 0; t.zuege++;
  return t;
}

export function passe(s) {
  const t = kopie(s);
  t.dran = 1 - s.dran; t.aus = s.aus + 1;
  return t;
}

// Nach einem Zug: muss jemand aussetzen? Ist Schluss?
// Gibt { s, aus: [Spieler, die ausgesetzt haben], ende }
export function naechster(s) {
  const aus = [];
  let t = s;
  for (;;) {
    if (erlaubt(t).length) return { s: t, aus, ende: false };
    aus.push(t.dran);
    t = passe(t);
    if (t.aus >= 2) return { s: t, aus, ende: true };
  }
}

// Wohin reicht der Strahl eines (neuen) Turms auf Feld i? Je Richtung die Anzahl Felder bis zum Blocker/Rand
export function strahlen(feld, n, i) {
  const x = i % n, y = (i / n) | 0, out = {};
  for (const [name, dx, dy] of [['r', 1, 0], ['l', -1, 0], ['u', 0, 1], ['o', 0, -1]]) {
    let k = 0, cx = x + dx, cy = y + dy;
    while (cx >= 0 && cy >= 0 && cx < n && cy < n && !feld[cy * n + cx]) { k++; cx += dx; cy += dy; }
    out[name] = k;
  }
  return out;
}

// ═══ KI ═══
const PUF = new Map();
const puffer = (n) => { if (!PUF.has(n)) PUF.set(n, new Uint8Array(n * n)); return PUF.get(n); };

// Wert für Spieler p: Felder-Vorsprung + etwas Beweglichkeit (wer nicht mehr setzen kann, verliert Züge)
export function bewerte(s, p, mob = 0) {
  const n = s.n, h = herrschaft(s.feld, n, puffer(n));
  let a = 0, b = 0, ma = 0, mb = 0;
  for (let i = 0; i < n * n; i++) {
    const t = s.feld[i], v = h[i];
    if (t === 1) a++;
    else if (t === 2) b++;
    else {
      if (v === 1) a++; else if (v === 2) b++;
      if (v !== 2) ma++;
      if (v !== 1) mb++;
    }
  }
  const w = a - b + mob * (Math.min(ma, 8) - Math.min(mb, 8));
  return p === 0 ? w : -w;
}

function endwert(s, p) {
  const [a, b] = punkte(s.feld, s.n);
  return (p === 0 ? a - b : b - a) * 100;
}

// Negamax mit Alpha-Beta. Wert aus Sicht dessen, der dran ist.
function negamax(s, tiefe, alpha, beta, cfg) {
  const p = s.dran;
  const zuege = erlaubt(s, p, herrschaft(s.feld, s.n, puffer(s.n)));
  if (!zuege.length) {
    if (s.aus >= 1) return endwert(s, p);
    return -negamax(passe(s), tiefe, -beta, -alpha, cfg);
  }
  if (tiefe === 0) return bewerte(s, p, cfg.mob);
  let kinder = zuege.map((i) => { const t = setze(s, i); return { t, w: -bewerte(t, t.dran, cfg.mob) }; });
  if (tiefe === 1) {
    let best = -Infinity;
    for (const k of kinder) if (k.w > best) best = k.w;
    return best;
  }
  kinder.sort((x, y) => y.w - x.w);
  if (cfg.breite && kinder.length > cfg.breite) kinder = kinder.slice(0, cfg.breite);
  let best = -Infinity;
  for (const k of kinder) {
    const v = -negamax(k.t, tiefe - 1, -beta, -alpha, cfg);
    if (v > best) { best = v; if (v > alpha) alpha = v; if (alpha >= beta) break; }
  }
  return best;
}

// Stufen 1–6 (Index 0–5) · Brett 5, 5, 6, 6, 7, 7
export const KI = [
  { zufall: 0.45, rauschen: 2.0, tiefe: 1, mob: 0 },              // Quarz: gierig + viel Zufall
  { zufall: 0.15, rauschen: 1.0, tiefe: 1, mob: 0 },              // Bernstein: gierig, etwas Zufall
  { zufall: 0.05, rauschen: 0.6, tiefe: 1, mob: 0.2 },            // Topas: gierig + Beweglichkeit
  { zufall: 0, rauschen: 0.7, tiefe: 2, mob: 0.25, breite: 10 },  // Citrin: sieht die Antwort voraus
  { zufall: 0, rauschen: 0.35, tiefe: 2, mob: 0.3 },              // Onyx: volle Antwort-Suche
  { zufall: 0, rauschen: 0.1, tiefe: 3, mob: 0.3, breite: 10 },   // Alchemie: Alpha-Beta Tiefe 3
];

export function kiZug(s, stufe, zufall = Math.random) {
  return kiZugMit(s, KI[Math.max(0, Math.min(KI.length - 1, stufe - 1))], zufall);
}

// Gibt den Feld-Index zurück (oder −1, wenn nichts geht)
export function kiZugMit(s, cfg, zufall = Math.random) {
  const p = s.dran;
  const zuege = erlaubt(s, p);
  if (!zuege.length) return -1;
  if (zufall() < (cfg.zufall || 0)) return zuege[Math.floor(zufall() * zuege.length)];
  let best = -Infinity, bi = zuege[0];
  const halb = (cfg.rauschen || 0) / 2;
  // Vorsortieren, damit Alpha-Beta viel abschneidet
  const kinder = zuege.map((i) => { const t = setze(s, i); return { i, t, w: -bewerte(t, t.dran, cfg.mob) }; }).sort((x, y) => y.w - x.w);
  for (const k of kinder) {
    let w;
    if (cfg.tiefe <= 1) w = k.w;
    else {
      // Gegner am Zug; wenn er nicht kann, setzt er aus (das zählt mit)
      const v = negamax(k.t, cfg.tiefe - 1, -Infinity, -(best - halb), cfg);
      w = -v;
    }
    w += (zufall() - 0.5) * (cfg.rauschen || 0);
    if (w > best) { best = w; bi = k.i; }
  }
  return bi;
}
