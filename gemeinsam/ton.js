// Klänge: echte Sounds von Kenney.nl (CC0, frei) als kleine WAV-Dateien.
// Falls eine Datei fehlt oder (noch) nicht geladen ist, spielt automatisch ein selbst erzeugter Ton.
let ctx = null;
let an = true;
const roh = new Map();      // Name -> Promise<ArrayBuffer>  (früh laden, noch ohne Ton-Erlaubnis)
const fertig = new Map();   // Name -> AudioBuffer           (nach dem ersten Tippen entpackt)

export function setzeTon(wert) { an = wert; }
export function istAn() { return an; }

// Sounds anmelden: { name: 'pfad/zur/datei.wav' } (Pfad relativ zur Seite des Spiels)
export function ladeKlaenge(liste) {
  for (const [name, datei] of Object.entries(liste)) {
    if (roh.has(name)) continue;
    roh.set(name, fetch(datei).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
    if (ctx) entpacke(name);
  }
}
function entpacke(name) {
  roh.get(name)?.then((daten) => {
    if (!daten || fertig.has(name)) return;
    ctx.decodeAudioData(daten.slice(0)).then((b) => fertig.set(name, b)).catch(() => {});
  });
}
ladeKlaenge({
  klick: '../gemeinsam/ton/klick.wav', wahl: '../gemeinsam/ton/wahl.wav', setzen: '../gemeinsam/ton/setzen.wav',
  gut: '../gemeinsam/ton/gut.wav', schlecht: '../gemeinsam/ton/schlecht.wav', gegner: '../gemeinsam/ton/gegner.wav',
  sieg: '../gemeinsam/ton/sieg.wav', niederlage: '../gemeinsam/ton/niederlage.wav', seite: '../gemeinsam/ton/seite.wav',
});

// Browser erlauben Ton erst nach dem ersten Tippen
export function wecken() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    for (const name of roh.keys()) entpacke(name);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

// Eine geladene Datei abspielen. Gibt false zurück, wenn es sie (noch) nicht gibt.
function probe(name, { laut = 0.7, tempo = 1, verz = 0 } = {}) {
  if (!an || !ctx) return !an;
  const b = fertig.get(name); if (!b) return false;
  const q = ctx.createBufferSource(); q.buffer = b;
  q.playbackRate.value = tempo * (0.96 + Math.random() * 0.08);   // jedes Mal minimal anders, klingt natürlicher
  const v = ctx.createGain(); v.gain.value = laut;
  q.connect(v).connect(ctx.destination); q.start(ctx.currentTime + verz);
  return true;
}

// Ersatz: einfacher erzeugter Ton
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
  klick: () => probe('klick', { laut: 0.5 }) || piep(1400, 0.05, { typ: 'triangle', laut: 0.04 }),
  wahl: () => probe('wahl', { laut: 0.55 }) || piep(880, 0.08, { laut: 0.05, bis: 1180 }),
  setzen: () => probe('setzen', { laut: 0.8 }) || piep(220, 0.12, { typ: 'triangle', laut: 0.09, bis: 140 }),
  gut: () => probe('gut', { laut: 0.6 }) || (piep(660, 0.12, { laut: 0.06 }), piep(990, 0.18, { laut: 0.06, verz: 0.08 })),
  schlecht: () => probe('schlecht', { laut: 0.6 }) || piep(180, 0.25, { typ: 'sawtooth', laut: 0.05, bis: 110 }),
  gegner: () => probe('gegner', { laut: 0.6 }) || piep(520, 0.09, { typ: 'triangle', laut: 0.05, bis: 400 }),
  seite: () => probe('seite', { laut: 0.35 }),
  sieg: () => { probe('sieg', { laut: 0.7 }); [523, 659, 784, 1047].forEach((f, i) => piep(f, 0.35, { laut: 0.045, verz: 0.15 + i * 0.11 })); },
  niederlage: () => { probe('niederlage', { laut: 0.7 }); [392, 330, 262].forEach((f, i) => piep(f, 0.4, { typ: 'triangle', laut: 0.04, verz: 0.1 + i * 0.16 })); },
  intro: () => { piep(55, 2.4, { laut: 0.12, bis: 70 }); piep(880, 1.6, { laut: 0.015, verz: 0.9, bis: 1320 }); },
  // eigene Sounds eines Spiels (vorher mit ladeKlaenge anmelden)
  spiele: (name, optionen) => probe(name, optionen),
};
