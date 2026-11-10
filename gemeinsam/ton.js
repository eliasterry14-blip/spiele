// Kleine Klänge – werden direkt erzeugt (keine Ton-Dateien nötig, darum auch offline).
let ctx = null;
let an = true;

export function setzeTon(wert) { an = wert; }
export function istAn() { return an; }

// Browser erlauben Ton erst nach dem ersten Tippen
export function wecken() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); }
  if (ctx.state === 'suspended') ctx.resume();
}

function piep(frequenz, dauer = 0.12, { typ = 'sine', laut = 0.08, bis = null, verz = 0 } = {}) {
  if (!an || !ctx) return;
  const t = ctx.currentTime + verz;
  const o = ctx.createOscillator(), v = ctx.createGain();
  o.type = typ; o.frequency.setValueAtTime(frequenz, t);
  if (bis) o.frequency.exponentialRampToValueAtTime(bis, t + dauer);
  v.gain.setValueAtTime(0.0001, t);
  v.gain.exponentialRampToValueAtTime(laut, t + 0.012);
  v.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
  o.connect(v).connect(ctx.destination);
  o.start(t); o.stop(t + dauer + 0.02);
}

export const ton = {
  klick: () => piep(1400, 0.05, { typ: 'triangle', laut: 0.04 }),
  wahl: () => piep(880, 0.08, { typ: 'sine', laut: 0.05, bis: 1180 }),
  setzen: () => { piep(220, 0.12, { typ: 'triangle', laut: 0.09, bis: 140 }); piep(1800, 0.04, { laut: 0.02 }); },
  gut: () => { piep(660, 0.12, { laut: 0.06 }); piep(990, 0.18, { laut: 0.06, verz: 0.08 }); },
  schlecht: () => piep(180, 0.25, { typ: 'sawtooth', laut: 0.05, bis: 110 }),
  gegner: () => piep(520, 0.09, { typ: 'triangle', laut: 0.05, bis: 400 }),
  sieg: () => [523, 659, 784, 1047].forEach((f, i) => piep(f, 0.35, { laut: 0.07, verz: i * 0.11 })),
  niederlage: () => [392, 330, 262].forEach((f, i) => piep(f, 0.4, { typ: 'triangle', laut: 0.06, verz: i * 0.16 })),
  intro: () => { piep(55, 2.4, { typ: 'sine', laut: 0.12, bis: 70 }); piep(880, 1.6, { laut: 0.015, verz: 0.9, bis: 1320 }); },
};
