// NAVAL CHESS – Klänge
// Selbst erzeugt (WebAudio): Sonar-Ping, Schiffshorn, Platschen, Blubbern, Explosion, Alarm.
// Dazu einige Kenney-Sounds (CC0) aus dem Ordner ton/.
let ctx = null;
let haupt = null;
let an = true;
const puffer = {};
const DATEIEN = { zug: 'ton/zug.wav', schlag: 'ton/schlag.wav', knopf: 'ton/knopf.wav', umwandlung: 'ton/umwandlung.wav' };

export function tonAn(wert) { an = wert; }

// Den Audio-Kontext gibt es erst nach dem ersten Antippen (Regel von iOS und Chrome)
function kontext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    haupt = ctx.createGain();
    haupt.gain.value = 0.8;
    haupt.connect(ctx.destination);
    ladeDateien();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function wecken() { if (an) kontext(); }

async function ladeDateien() {
  for (const [name, url] of Object.entries(DATEIEN)) {
    try {
      const daten = await (await fetch(url)).arrayBuffer();
      puffer[name] = await new Promise((ok, fehler) => ctx.decodeAudioData(daten, ok, fehler));
    } catch { /* ohne Datei geht es mit erzeugten Klängen weiter */ }
  }
}

function probe(name, { laut = 1, tempo = 1, verz = 0 } = {}) {
  const c = kontext();
  if (!c || !puffer[name]) return false;
  const quelle = c.createBufferSource();
  quelle.buffer = puffer[name];
  quelle.playbackRate.value = tempo * (0.95 + Math.random() * 0.1);
  const g = c.createGain();
  g.gain.value = laut;
  quelle.connect(g).connect(haupt);
  quelle.start(c.currentTime + verz);
  return true;
}

// Lautstärke-Hülle: anschwellen, halten, ausklingen
function huelle(g, t, an_, halten, aus, laut) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(laut, t + an_);
  g.gain.setValueAtTime(laut, t + an_ + halten);
  g.gain.exponentialRampToValueAtTime(0.0001, t + an_ + halten + aus);
}
function ton(freq, t, { typ = 'sine', an_ = 0.005, halten = 0, aus = 0.3, laut = 0.3, bis = null, filter = null } = {}) {
  const c = ctx;
  const o = c.createOscillator();
  o.type = typ;
  o.frequency.setValueAtTime(freq, t);
  if (bis) o.frequency.exponentialRampToValueAtTime(bis, t + an_ + halten + aus);
  const g = c.createGain();
  huelle(g, t, an_, halten, aus, laut);
  let kette = o;
  if (filter) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; kette.connect(f); kette = f; }
  kette.connect(g).connect(haupt);
  o.start(t);
  o.stop(t + an_ + halten + aus + 0.05);
}
let rauschPuffer = null;
function rauschen(t, { dauer = 0.4, laut = 0.3, von = 2000, bis = 300, typ = 'bandpass', q = 0.8 } = {}) {
  const c = ctx;
  if (!rauschPuffer) {
    rauschPuffer = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
    const d = rauschPuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const q_ = c.createBufferSource();
  q_.buffer = rauschPuffer;
  const f = c.createBiquadFilter();
  f.type = typ; f.Q.value = q;
  f.frequency.setValueAtTime(von, t);
  f.frequency.exponentialRampToValueAtTime(bis, t + dauer);
  const g = c.createGain();
  huelle(g, t, 0.01, 0, dauer, laut);
  q_.connect(f).connect(g).connect(haupt);
  q_.start(t, Math.random() * 0.5);
  q_.stop(t + dauer + 0.05);
}

function los(fn) { if (!an) return; const c = kontext(); if (c) fn(c.currentTime + 0.01); }

export const klang = {
  // Schiff auswählen: Sonar-Ping mit Echo
  wahl: () => los((t) => { ton(1320, t, { aus: 0.35, laut: 0.16 }); ton(1320, t + 0.17, { aus: 0.3, laut: 0.05 }); }),
  // normaler Zug: dumpfes Anlegen + leises Wasser
  zug: () => los((t) => { if (!probe('zug', { laut: 0.55 })) ton(180, t, { aus: 0.12, laut: 0.25, bis: 90 }); rauschen(t, { dauer: 0.35, laut: 0.07, von: 900, bis: 300 }); }),
  // U-Boot taucht: Blubbern
  tauchen: () => los((t) => { for (let i = 0; i < 9; i++) { const s = t + i * 0.045 + Math.random() * 0.03; const f = 300 + Math.random() * 500; ton(f, s, { aus: 0.06, laut: 0.07, bis: f * 2.2 }); } }),
  // Schlagen: Metall + großes Platschen
  schlag: () => los((t) => { probe('schlag', { laut: 0.5 }); rauschen(t + 0.02, { dauer: 0.6, laut: 0.28, von: 2600, bis: 250 }); }),
  // Explosion für Attacken
  explosion: () => los((t) => { rauschen(t, { dauer: 0.9, laut: 0.5, von: 1200, bis: 60, typ: 'lowpass', q: 0.5 }); ton(90, t, { aus: 0.6, laut: 0.45, bis: 35 }); rauschen(t + 0.25, { dauer: 0.7, laut: 0.18, von: 2400, bis: 300 }); }),
  // Abschuss: Kanone / Rakete / Torpedo / Wasserbombe
  kanone: () => los((t) => { ton(120, t, { aus: 0.25, laut: 0.4, bis: 50 }); rauschen(t, { dauer: 0.25, laut: 0.3, von: 3000, bis: 400, typ: 'lowpass' }); }),
  rakete: () => los((t) => { rauschen(t, { dauer: 0.7, laut: 0.22, von: 600, bis: 3500, typ: 'bandpass', q: 1.5 }); }),
  torpedo: () => los((t) => { rauschen(t, { dauer: 0.9, laut: 0.12, von: 400, bis: 900, q: 2 }); for (let i = 0; i < 6; i++) ton(260 + Math.random() * 300, t + i * 0.12, { aus: 0.05, laut: 0.05, bis: 700 }); }),
  bombe: () => los((t) => { ton(70, t + 0.35, { aus: 0.5, laut: 0.5, bis: 30 }); rauschen(t + 0.35, { dauer: 0.7, laut: 0.25, von: 800, bis: 100, typ: 'lowpass' }); }),
  // Rochade: zwei Schiffe legen an
  rochade: () => los(() => { probe('zug', { laut: 0.5 }); probe('zug', { laut: 0.45, verz: 0.14 }); }),
  // Schach: zwei Alarmtöne
  schach: () => los((t) => { ton(880, t, { typ: 'square', aus: 0.12, halten: 0.05, laut: 0.06, filter: 2200 }); ton(660, t + 0.2, { typ: 'square', aus: 0.14, halten: 0.05, laut: 0.06, filter: 2200 }); }),
  umwandlung: () => los((t) => { if (!probe('umwandlung', { laut: 0.5 })) [523, 659, 784].forEach((f, i) => ton(f, t + i * 0.08, { typ: 'triangle', aus: 0.3, laut: 0.12 })); }),
  // Schiffshorn zum Spielstart
  horn: () => los((t) => { [98, 147, 196].forEach((f, i) => ton(f, t, { typ: 'sawtooth', an_: 0.08, halten: 0.55, aus: 0.45, laut: i === 2 ? 0.04 : 0.09, filter: 520 })); }),
  sieg: () => los((t) => { [523, 659, 784, 1047].forEach((f, i) => ton(f, t + i * 0.12, { typ: 'triangle', aus: 0.5, laut: 0.14 })); ton(1047, t + 0.5, { aus: 1.2, laut: 0.08 }); }),
  niederlage: () => los((t) => { [196, 165, 131].forEach((f, i) => ton(f, t + i * 0.22, { typ: 'sawtooth', an_: 0.04, halten: 0.15, aus: 0.4, laut: 0.07, filter: 700 })); }),
  remis: () => los((t) => { ton(440, t, { typ: 'triangle', aus: 0.5, laut: 0.12 }); ton(440, t + 0.25, { typ: 'triangle', aus: 0.6, laut: 0.1 }); }),
  knopf: () => los((t) => { if (!probe('knopf', { laut: 0.45 })) ton(900, t, { aus: 0.05, laut: 0.08 }); }),
  feuerAn: () => los((t) => { ton(520, t, { typ: 'square', aus: 0.08, laut: 0.05, filter: 1800 }); ton(780, t + 0.07, { typ: 'square', aus: 0.1, laut: 0.05, filter: 1800 }); }),
};
