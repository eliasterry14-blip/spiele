// NAVAL CHESS – die App: Menü, Brett, Touch-Steuerung, Animationen, Computergegner, Speichern.
// Die Schachregeln stecken in schach.js, die Schiffe in schiffe.js, die Klänge in ton.js.
import { Partie, START_FEN, denke } from './schach.js';
import { schiffSVG, verlaeufeEinsetzen, FLOTTEN, STANDARD_FLOTTE, NAMEN } from './schiffe.js';
import { klang, tonAn, wecken } from './ton.js';
import { erstelleBuehne } from './buehne.js';
import { ladeSatz, setzeSatz, SAETZE } from './flotte3d.js';

const $ = (s) => document.querySelector(s);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const zufall = (a, b) => a + Math.random() * (b - a);
const TEST = new URLSearchParams(location.search).has('test');

// =====================================================================
// Speichern (im Browser des Handys)
// =====================================================================
const SCHLUESSEL = 'navalchess.v1';
const STANDARD = {
  einst: { ton: true, vibration: true, markierungen: true, koordinaten: true, drehen: false, schnell: false, blick: 'flach', satz: 'kriegs', flotteW: STANDARD_FLOTTE.w, flotteB: STANDARD_FLOTTE.b },
  wahl: { stufe: 2, farbe: 'w', artKi: 'klassisch', artZwei: 'klassisch' },
  partie: null, // { modus: 'ki'|'zwei', art: 'klassisch'|'gefecht', stufe, spielerFarbe, start, zuege: [uci...], ende }
};
function lade() {
  try {
    const d = JSON.parse(localStorage.getItem(SCHLUESSEL));
    if (d) return { einst: { ...STANDARD.einst, ...d.einst }, wahl: { ...STANDARD.wahl, ...d.wahl }, partie: d.partie || null };
  } catch { /* kaputter Speicher: neu anfangen */ }
  return JSON.parse(JSON.stringify(STANDARD));
}
function speichere() { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(daten)); } catch { /* privates Fenster */ } }
const daten = lade();

const STUFEN = [
  { name: 'Matrose', art: 'Leicht' },
  { name: 'Maat', art: 'Mittel' },
  { name: 'Kapitän', art: 'Stark' },
  { name: 'Admiral', art: 'Sehr stark' },
];
const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Rangabzeichen für die Stufen (Winkel, Streifen, Stern)
function abzeichen(nr) {
  const winkel = (y) => `<path d="M7 ${y + 6} L17 ${y} L27 ${y + 6}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const streifen = (y) => `<rect x="6" y="${y}" width="22" height="3.2" rx="1.2" fill="currentColor"/>`;
  const stern = '<path d="M17 3l2.3 4.8 5.2.6-3.9 3.6 1 5.2L17 14.6l-4.6 2.6 1-5.2-3.9-3.6 5.2-.6z" fill="currentColor"/>';
  const inhalt = [winkel(14), winkel(10) + winkel(18), streifen(10) + streifen(16) + streifen(22), stern + streifen(21) + streifen(26.5)][nr - 1];
  return `<svg class="abzeichen" viewBox="0 0 34 34">${inhalt}</svg>`;
}

// =====================================================================
// Seiten wechseln
// =====================================================================
let aktuelleSeite = null;
let einstHerkunft = 's-menue';
function zeige(id, zurueck = false) {
  const neu = document.getElementById(id);
  const alt = aktuelleSeite;
  if (neu === alt) return;
  neu.style.transition = 'none';
  neu.classList.toggle('links', zurueck);
  void neu.offsetWidth;
  neu.style.transition = '';
  if (alt) { alt.classList.remove('aktiv'); alt.classList.toggle('links', !zurueck); }
  neu.classList.remove('links');
  neu.classList.add('aktiv');
  aktuelleSeite = neu;
  if (id === 's-menue') menueInfo();
  if (buehne) { buehne.aktiv(id === 's-spiel'); if (id === 's-spiel') requestAnimationFrame(passeFreiraum); }
}

function menueInfo() {
  const p = daten.partie;
  const info = $('#spielen-info');
  if (p && !p.ende && p.zuege.length) info.textContent = `Weiter · Zug ${Math.floor(p.zuege.length / 2) + 1}${p.art === 'gefecht' ? ' · Gefecht' : ''}`;
  else info.textContent = `Gegen Computer · ${STUFEN[daten.wahl.stufe - 1].name}${daten.wahl.artKi === 'gefecht' ? ' · Gefecht' : ''}`;
}

// =====================================================================
// Spiel einrichten (Gegen Computer / Zwei Spieler)
// =====================================================================
let wahlModus = 'ki';
function zeigeWahl(modus) {
  wahlModus = modus;
  $('#wahl-titel').textContent = modus === 'ki' ? 'Gegen Computer' : 'Zwei Spieler';
  $('#wahl-gegner').hidden = modus !== 'ki';
  $('#wahl-farbe').hidden = modus !== 'ki';
  $('#stufen').innerHTML = STUFEN.map((s, i) =>
    `<button class="stufe${daten.wahl.stufe === i + 1 ? ' an' : ''}" data-aktion="stufe" data-wert="${i + 1}">${abzeichen(i + 1)}<span><b>${s.name}</b><small>${s.art}</small></span></button>`).join('');
  const art = modus === 'ki' ? daten.wahl.artKi : daten.wahl.artZwei;
  for (const b of $('#modus-wahl').children) b.classList.toggle('an', b.dataset.wert === art);
  for (const b of $('#farb-wahl').children) b.classList.toggle('an', b.dataset.wert === daten.wahl.farbe);
  zeige('s-wahl');
}

// =====================================================================
// Einstellungen (aus dem Menü UND mitten im Spiel)
// =====================================================================
function zeigeEinstellungen() {
  const e = daten.einst;
  const flotten = (farbe) => {
    const gewaehlt = farbe === 'w' ? e.flotteW : e.flotteB;
    const name = FLOTTEN[farbe].find((f) => f.id === gewaehlt)?.name || '';
    return `<div class="flotten">${FLOTTEN[farbe].map((f) =>
      `<button class="flotte${f.id === gewaehlt ? ' an' : ''}" style="--akz:${f.akzent}" data-aktion="flotte" data-farbe="${farbe}" data-wert="${f.id}" aria-label="${f.name}">${schiffSVG('q', farbe, f.id)}</button>`).join('')}</div>
      <div class="flotte-name">${name}</div>`;
  };
  const schalter = (schl, titel, info = '') =>
    `<button class="einst-zeile" data-aktion="schalter" data-wert="${schl}"><span><b>${titel}</b>${info ? `<small>${info}</small>` : ''}</span><span class="schalter" role="switch" aria-checked="${!!e[schl]}"></span></button>`;
  $('#einst-inhalt').innerHTML = `
    <div class="einst-gruppe"><h3 class="einst-titel">Schiffe</h3>
      <div class="segment kamera">${[['kriegs', 'Kriegsmarine', 'Kanonen & Torpedos'], ['spass', 'Spaß-Flotte', 'Yacht, Piraten …']].map(([w, n, k]) =>
        `<button class="${(e.satz || 'kriegs') === w ? 'an' : ''}" data-aktion="satz" data-wert="${w}"><b>${n}</b><small>${k}</small></button>`).join('')}</div>
    </div>
    <div class="einst-gruppe"><h3 class="einst-titel">Weiße Flotte</h3>${flotten('w')}</div>
    <div class="einst-gruppe"><h3 class="einst-titel">Schwarze Flotte</h3>${flotten('b')}</div>
    <div class="einst-gruppe"><h3 class="einst-titel">Kamera</h3>
      <div class="segment kamera">${[['flach', 'Seite'], ['mittel', 'Schräg'], ['steil', 'Oben']].map(([w, n]) =>
        `<button class="${(e.blick || 'flach') === w ? 'an' : ''}" data-aktion="blick" data-wert="${w}"><b>${n}</b><small>${BLICK[w]}°</small></button>`).join('')}</div>
    </div>
    <div class="einst-gruppe"><h3 class="einst-titel">Spiel</h3>
      ${schalter('markierungen', 'Mögliche Züge zeigen')}
      ${schalter('koordinaten', 'Koordinaten')}
      ${schalter('drehen', 'Brett drehen', 'Bei zwei Spielern nach jedem Zug')}
      ${schalter('schnell', 'Schnelle Animationen')}
    </div>
    <div class="einst-gruppe"><h3 class="einst-titel">Ton</h3>
      ${schalter('ton', 'Sound')}
      ${'vibrate' in navigator ? schalter('vibration', 'Vibration') : ''}
    </div>
    <div class="einst-fuss">NAVAL CHESS · 3D: three.js (MIT) · Sounds: Kenney (CC0)<br>
      Spaß-Flotte (poly.pizza, verkleinert): Quaternius &amp; Kenney (CC0) · „Yacht“ von Alex Safayan (CC BY 3.0) · „TugBoat“ von Some “Random” Person (CC BY 3.0)</div>`;
}

function einstellungAendern(schl) {
  daten.einst[schl] = !daten.einst[schl];
  speichere();
  if (schl === 'ton') { tonAn(daten.einst.ton); if (daten.einst.ton) klang.knopf(); }
  if (schl === 'vibration' && daten.einst.vibration) vibriere(20);
  if (schl === 'koordinaten') buehne?.setzeKoordinaten(daten.einst.koordinaten);
  if (schl === 'markierungen') markiere();
  if (schl === 'drehen' && spiel.partie && spiel.modus === 'zwei') setzeAusrichtung(daten.einst.drehen && spiel.partie.amZug === 'b');
  zeigeEinstellungen();
}

function flotteAendern(farbe, id) {
  if (farbe === 'w') daten.einst.flotteW = id; else daten.einst.flotteB = id;
  speichere();
  klang.wahl();
  // alle Schiffe dieser Farbe sofort neu anmalen
  buehne?.setzeFlotten(daten.einst.flotteW, daten.einst.flotteB);
  for (const s of document.querySelectorAll(`.fw-schiff[data-farbe="${farbe}"]`)) s.innerHTML = schiffSVG('k', farbe, id);
  if (spiel.partie) { panels(); zugliste(); }
  zeigeEinstellungen();
}
const stilVon = (farbe) => (farbe === 'w' ? daten.einst.flotteW : daten.einst.flotteB);

// =====================================================================
// Spielzustand
// =====================================================================
const spiel = {
  partie: null,
  modus: 'ki',          // 'ki' oder 'zwei'
  art: 'klassisch',     // 'klassisch' oder 'gefecht'
  stufe: 2,
  spielerFarbe: 'w',
  gedreht: false,       // Ansicht gedreht (Schwarz unten)
  auswahl: null,        // ausgewähltes Feld, z. B. 'e2'
  ziele: [],            // erlaubte Züge des ausgewählten Schiffs
  feuerModus: false,
  sperre: false,        // während Animationen keine Eingabe
  ende: null,
  kiId: 0,
  kiDenkt: false,
};

// =====================================================================
// 3D-Bühne (Meer, Schiffe, Kamera) – siehe buehne.js
// =====================================================================
const tempo = (ms) => (daten.einst.schnell ? ms * 0.55 : ms);
const BLICK = { flach: 32, mittel: 42, steil: 56 };
let buehne = null;
let buehneHatSchiffe = false;
function stelleBuehneBereit() {
  if (buehne) return true;
  try {
    buehne = erstelleBuehne($('#buehne'), { tempo, ereignis: buehnenEreignis });
  } catch (fehler) {
    console.error(fehler);
    zeigeToast('3D wird auf diesem Gerät nicht unterstützt');
    return false;
  }
  buehne.setzeFlotten(daten.einst.flotteW, daten.einst.flotteB);
  buehne.setzeKoordinaten(daten.einst.koordinaten);
  buehne.setzeBlickwinkel(BLICK[daten.einst.blick] ?? BLICK.flach);
  new ResizeObserver(passeFreiraum).observe($('#brett-zelle'));
  passeFreiraum();
  return true;
}
// Der freie Bereich zwischen den Spieler-Leisten: dort soll das ganze Brett hineinpassen
function passeFreiraum() {
  if (!buehne) return;
  const a = $('#buehne').getBoundingClientRect();
  const r = $('#brett-zelle').getBoundingClientRect();
  if (!r.width || !r.height) return;
  buehne.setzeFreiraum({ x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height });
}
// Schiffs-Satz wechseln: Kriegsmarine (selbst gebaut) oder Spaß-Flotte (3D-Modelle)
async function wechsleSatz(satz) {
  if (satz !== 'kriegs' && !(await ladeSatz(satz))) { zeigeToast('Spaß-Flotte konnte nicht laden'); return; }
  if (daten.einst.satz !== satz) return;
  setzeSatz(satz);
  buehne?.tauscheSchiffe();
}
const schiffName = (t) => (daten.einst.satz === 'spass' ? SAETZE.spass[t].name : NAMEN[t]);
function setzeVh() { document.documentElement.style.setProperty('--vh', (window.innerHeight / 100) + 'px'); }
function belegung() {
  const m = new Map();
  spiel.partie.brett().forEach((f, i) => { if (f) m.set(String.fromCharCode(97 + (i % 8)) + (8 - Math.floor(i / 8)), f); });
  return m;
}
function setzeAusrichtung(gedreht, animiert = true) {
  if (!buehne) return Promise.resolve();
  spiel.gedreht = gedreht;
  if (spiel.partie) panels();
  return buehne.setzeAusrichtung(gedreht, animiert);
}
function vibriere(muster) { if (daten.einst.vibration && navigator.vibrate) try { navigator.vibrate(muster); } catch { /* egal */ } }

// Großes Wort über dem Brett („VOLLTREFFER!“, „SCHACH!“)
let rufZeit = 0;
function ruf(text, art = '') {
  const el = $('#ruf');
  el.textContent = text;
  el.className = 'ruf ' + art;
  void el.offsetWidth;
  el.classList.add('zeigen');
  clearTimeout(rufZeit);
  rufZeit = setTimeout(() => el.classList.remove('zeigen'), 1400);
}
// Was auf der Bühne passiert (Abschuss, Einschlag) -> Klang + Vibration
function buehnenEreignis(name) {
  if (name === 'explosion') { klang.explosion(); vibriere([30, 40, 70]); }
  if (name === 'spritzer') klang.schlag();
}

async function animiereZug(zug, opt = {}) {
  if (zug.feuer) {
    const abschuss = { artillerie: klang.kanone, rakete: klang.rakete, torpedo: klang.torpedo, wasserbomben: klang.bombe }[zug.waffe];
    setTimeout(() => abschuss && abschuss(), tempo(280));
    await buehne.attacke(zug);
    ruf('Volltreffer!', 'feuer');
    return;
  }
  if (zug.figur === 'n' && !opt.gezogen) klang.tauchen();
  const lauf = buehne.zug(zug, opt);
  if (!opt.gezogen && zug.figur !== 'n') setTimeout(() => klang.zug(), tempo(120));
  await lauf;
  if (zug.schlag && WERT[zug.schlag] >= 3) ruf('Versenkt!', 'feuer');
  if (zug.umwandlung) { klang.umwandlung(); ruf('Befördert!', 'sieg'); }
  if (zug.rochade) klang.rochade();
  if (opt.gezogen) klang.zug();
  vibriere(zug.schlag ? 30 : 10);
}

// =====================================================================
// Markierungen, Anzeigen
// =====================================================================
function markiere(ueber = null) {
  if (!spiel.partie || !buehne) return;
  const p = spiel.partie;
  const v = p.verlauf();
  const letzter = v[v.length - 1] || null;
  const ziele = [];
  if (spiel.auswahl && (daten.einst.markierungen || spiel.feuerModus)) {
    for (const z of spiel.ziele) ziele.push({ nach: z.nach, art: spiel.feuerModus ? 'feuer' : (z.schlag ? 'schlag' : 'ziel') });
  }
  const schuetzen = spiel.feuerModus && !spiel.auswahl ? [...new Set(p.zuege().filter((z) => z.feuer).map((z) => z.von))] : [];
  buehne.markiere({
    auswahl: spiel.auswahl, ziele, schuetzen, ueber, feuer: spiel.feuerModus,
    letzter: letzter ? { von: letzter.von, nach: letzter.nach } : null,
    schach: p.imSchach() ? p.koenigFeld(p.amZug) : null,
  });
}

const mini = (typ, farbe) => schiffSVG(typ, farbe, stilVon(farbe), 'mini');
const ZIELKREUZ = '<svg class="mini" viewBox="0 0 24 24" style="color:#ff9a6a"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function statusText() {
  const p = spiel.partie;
  if (spiel.ende) return ['vorbei', kurzErgebnis(spiel.ende)];
  if (spiel.kiDenkt) return ['denkt', 'Computer denkt …'];
  if (spiel.feuerModus) return ['feuer', 'Feuer bereit'];
  if (p.imSchach()) return ['schach', 'Schach!'];
  if (spiel.modus === 'ki') return ['', p.amZug === spiel.spielerFarbe ? 'Du bist am Zug' : 'Computer am Zug'];
  return ['', p.amZug === 'w' ? 'Weiß am Zug' : 'Schwarz am Zug'];
}
function kurzErgebnis(st) {
  return { matt: 'Schachmatt', patt: 'Patt', aufgabe: 'Aufgegeben', wiederholung: 'Remis', fuenfzig: 'Remis', material: 'Remis', einigung: 'Remis' }[st.art] || 'Ende';
}

function panels() {
  const unten = spiel.gedreht ? 'b' : 'w';
  fuellePanel($('#spieler-unten'), unten);
  fuellePanel($('#spieler-oben'), unten === 'w' ? 'b' : 'w');
}
function fuellePanel(el, farbe) {
  const p = spiel.partie;
  el.querySelector('.sp-flagge').innerHTML = schiffSVG('k', farbe, stilVon(farbe));
  let name;
  let unter;
  if (spiel.modus === 'ki' && farbe !== spiel.spielerFarbe) { name = 'Computer'; unter = STUFEN[spiel.stufe - 1].name; }
  else { name = spiel.modus === 'ki' ? 'Du' : (farbe === 'w' ? 'Weiß' : 'Schwarz'); unter = farbe === 'w' ? 'Weiße Flotte' : 'Schwarze Flotte'; }
  el.querySelector('.sp-name b').textContent = name;
  el.querySelector('.sp-name small').textContent = unter;
  // Munition (nur Gefecht)
  const schuss = spiel.art === 'gefecht' && p.munition ? p.munition(farbe) : 0;
  el.querySelector('.sp-munition').innerHTML = spiel.art === 'gefecht' ? [0, 1, 2].map((i) => `<i class="${i < schuss ? '' : 'leer'}"></i>`).join('') : '';
  // versenkte gegnerische Schiffe + Materialvorsprung
  const gegner = farbe === 'w' ? 'b' : 'w';
  const beute = p.verlauf().filter((z) => z.farbe === farbe && z.schlag).map((z) => z.schlag).sort((a, b) => WERT[b] - WERT[a]);
  let material = 0;
  for (const f of p.brett()) if (f) material += (f.farbe === farbe ? 1 : -1) * WERT[f.typ];
  el.querySelector('.sp-beute').innerHTML = beute.map((t) => mini(t, gegner)).join('') + (material > 0 ? `<em>+${material}</em>` : '');
  el.classList.toggle('dran', !spiel.ende && p.amZug === farbe);
  el.classList.toggle('denkt', spiel.kiDenkt && p.amZug === farbe);
}

function zugliste() {
  const v = spiel.partie.verlauf();
  const el = $('#zugliste');
  if (!v.length) { el.innerHTML = '<span class="zl-leer">—</span>'; return; }
  let h = '';
  v.forEach((z, i) => {
    if (i % 2 === 0) h += `<span class="zl-nr">${i / 2 + 1}.</span>`;
    const san = (z.san || z.uci).replace(/[KQRBN]/g, (b) => mini(b.toLowerCase(), z.farbe)).replace('*', ZIELKREUZ);
    h += `<span class="zl-zug${z.feuer ? ' attacke' : ''}${i === v.length - 1 ? ' neu' : ''}">${san}</span>`;
  });
  el.innerHTML = h;
  el.scrollLeft = el.scrollWidth;
}

function menschDran() { return spiel.modus === 'zwei' || spiel.partie.amZug === spiel.spielerFarbe; }
function kiIstDran() { return spiel.modus === 'ki' && !spiel.ende && spiel.partie && spiel.partie.amZug !== spiel.spielerFarbe; }
function feuerMoeglich() {
  const p = spiel.partie;
  return !!p && spiel.art === 'gefecht' && !spiel.ende && !spiel.sperre && !spiel.kiDenkt && menschDran()
    && !!p.munition && p.munition(p.amZug) > 0 && p.zuege().some((z) => z.feuer);
}
function zurueckMoeglich() {
  const v = spiel.partie.verlauf();
  if (!v.length || spiel.sperre) return false;
  return spiel.modus === 'zwei' || v.some((z) => z.farbe === spiel.spielerFarbe);
}

function aktualisiere() {
  if (!spiel.partie) return;
  const [klasse, text] = statusText();
  $('#status').className = `status ${klasse}${spiel.partie.amZug === 'b' ? ' schwarz' : ''}`;
  $('#status-text').textContent = text;
  $('#s-spiel').classList.toggle('gefecht', spiel.art === 'gefecht');
  panels();
  zugliste();
  markiere();
  const p = spiel.partie;
  const farbe = spiel.modus === 'ki' ? spiel.spielerFarbe : p.amZug;
  $('#feuer-zahl').textContent = p.munition ? p.munition(farbe) : 0;
  $('#k-feuer').disabled = !spiel.feuerModus && !feuerMoeglich();
  $('#k-feuer').classList.toggle('an', spiel.feuerModus);
  $('#k-zurueck').disabled = !zurueckMoeglich();
}

// =====================================================================
// Spielablauf
// =====================================================================
function eingabeGesperrt() {
  return !spiel.partie || spiel.sperre || !!spiel.ende || spiel.kiDenkt || !$('#blatt').hidden || !$('#ende').hidden || !menschDran();
}
function zieleFuer(feld) { return spiel.partie.zuege(feld).filter((z) => !!z.feuer === spiel.feuerModus); }
function waehle(feld) { spiel.auswahl = feld; spiel.ziele = zieleFuer(feld); klang.wahl(); vibriere(6); markiere(); }
function entwaehle() { spiel.auswahl = null; spiel.ziele = []; markiere(); }

function neuesSpiel({ modus, art, stufe, spielerFarbe }) {
  brichKiAb();
  if (!stelleBuehneBereit()) return;
  const warGedreht = spiel.gedreht;
  Object.assign(spiel, { modus, art, stufe, spielerFarbe, ende: null, auswahl: null, ziele: [], feuerModus: false, sperre: false });
  spiel.partie = new Partie(START_FEN, { munition: art === 'gefecht' ? 3 : 0 });
  const gedreht = modus === 'ki' && spielerFarbe === 'b';
  daten.partie = { modus, art, stufe, spielerFarbe, start: START_FEN, zuege: [], ende: null };
  speichere();
  $('#ende').hidden = true;
  zeige('s-spiel');
  // Neustart: Schiffe fahren zurück auf ihre Plätze; sonst tauchen alle nacheinander auf
  setzeAusrichtung(gedreht, buehneHatSchiffe && warGedreht !== gedreht);
  buehne.aufbauen(belegung(), { animiert: true, staffel: true, neu: !buehneHatSchiffe });
  buehneHatSchiffe = true;
  aktualisiere();
  klang.horn();
  if (kiIstDran()) setTimeout(() => { if (kiIstDran() && !spiel.kiDenkt) kiZug(); }, 1100);
}

function fortsetzen() {
  const d = daten.partie;
  try {
    spiel.partie = Partie.ausZuegen(d.start, d.zuege, { munition: d.art === 'gefecht' ? 3 : 0 });
  } catch {
    zeigeToast('Spielstand defekt – neues Spiel');
    neuesSpiel({ modus: 'ki', art: daten.wahl.artKi, stufe: daten.wahl.stufe, spielerFarbe: 'w' });
    return;
  }
  brichKiAb();
  if (!stelleBuehneBereit()) return;
  Object.assign(spiel, { modus: d.modus, art: d.art || 'klassisch', stufe: d.stufe, spielerFarbe: d.spielerFarbe, ende: d.ende || null, auswahl: null, ziele: [], feuerModus: false, sperre: false });
  zeige('s-spiel');
  setzeAusrichtung(d.modus === 'ki' ? d.spielerFarbe === 'b' : (daten.einst.drehen && spiel.partie.amZug === 'b'), false);
  buehne.aufbauen(belegung(), { animiert: true, staffel: true, neu: true });
  buehneHatSchiffe = true;
  aktualisiere();
  if (kiIstDran()) setTimeout(() => { if (kiIstDran() && !spiel.kiDenkt) kiZug(); }, 900);
}

async function fuehreAus(von, nach, { gezogen = false } = {}) {
  const kandidaten = spiel.ziele.filter((m) => m.nach === nach);
  if (!kandidaten.length) return;
  spiel.sperre = true;
  let umwandlung = null;
  if (kandidaten[0].umwandlung) {
    umwandlung = await waehleUmwandlung(spiel.partie.amZug);
    if (!umwandlung) {
      if (gezogen) buehne.zurueck(von);
      spiel.sperre = false;
      markiere();
      return;
    }
  }
  const auftrag = { von, nach };
  if (umwandlung) auftrag.umwandlung = umwandlung;
  if (spiel.feuerModus) auftrag.feuer = true;
  const zug = spiel.partie.ziehe(auftrag);
  if (!zug) { spiel.sperre = false; return; }
  spiel.auswahl = null;
  spiel.ziele = [];
  spiel.feuerModus = false;
  markiere();
  await animiereZug(zug, { gezogen });
  spiel.sperre = false;
  await nachZug(zug);
}

async function nachZug(zug) {
  daten.partie.zuege = spiel.partie.verlauf().map((z) => z.uci);
  const st = spiel.partie.status();
  if (zug.schach && !st.ende) { klang.schach(); vibriere([40, 60, 40]); ruf('Schach!', 'schach'); }
  if (st.ende) {
    spiel.ende = st;
    daten.partie.ende = st;
    speichere();
    aktualisiere();
    await pause(tempo(st.art === 'matt' ? 700 : 450));
    zeigeEnde();
    return;
  }
  speichere();
  aktualisiere();
  if (spiel.modus === 'zwei' && daten.einst.drehen) { await pause(250); await setzeAusrichtung(spiel.partie.amZug === 'b'); }
  if (kiIstDran()) kiZug();
}

function zugZurueck() {
  if (!zurueckMoeglich()) return;
  const p = spiel.partie;
  brichKiAb();
  if (spiel.modus === 'ki') {
    let eigene = 0;
    while (p.verlauf().length) {
      const z = p.zuruecknehmen();
      if (z.farbe === spiel.spielerFarbe) eigene++;
      if (eigene > 0 && p.amZug === spiel.spielerFarbe) break;
    }
  } else p.zuruecknehmen();
  Object.assign(spiel, { ende: null, auswahl: null, ziele: [], feuerModus: false });
  daten.partie.ende = null;
  daten.partie.zuege = p.verlauf().map((z) => z.uci);
  speichere();
  $('#ende').hidden = true;
  buehne.aufbauen(belegung(), { animiert: true });
  aktualisiere();
  klang.knopf();
  if (spiel.modus === 'zwei' && daten.einst.drehen) setzeAusrichtung(p.amZug === 'b');
  if (kiIstDran()) kiZug();
}

function feuerUmschalten() {
  if (!spiel.feuerModus && !feuerMoeglich()) return;
  spiel.feuerModus = !spiel.feuerModus;
  klang.feuerAn();
  vibriere(15);
  if (spiel.auswahl) {
    spiel.ziele = zieleFuer(spiel.auswahl);
    if (spiel.feuerModus && !spiel.ziele.length) { spiel.auswahl = null; spiel.ziele = []; }
  }
  aktualisiere();
}

function beenden(art) {
  const p = spiel.partie;
  const verlierer = spiel.modus === 'ki' ? spiel.spielerFarbe : p.amZug;
  brichKiAb();
  spiel.ende = art === 'aufgabe' ? { ende: true, art: 'aufgabe', sieger: verlierer === 'w' ? 'b' : 'w' } : { ende: true, art: 'einigung', sieger: null };
  daten.partie.ende = spiel.ende;
  speichere();
  Object.assign(spiel, { auswahl: null, ziele: [], feuerModus: false });
  aktualisiere();
  zeigeEnde();
}

function zeigeEnde() {
  const st = spiel.ende;
  const name = (f) => (f === 'w' ? 'Weiß' : 'Schwarz');
  let titel = kurzErgebnis(st);
  let text = '';
  let ergebnis = 'remis';
  if (st.sieger) {
    if (spiel.modus === 'ki') {
      ergebnis = st.sieger === spiel.spielerFarbe ? 'sieg' : 'verloren';
      text = ergebnis === 'sieg' ? 'Du hast gewonnen!' : (st.art === 'aufgabe' ? 'Du hast aufgegeben' : 'Der Computer gewinnt');
      if (ergebnis === 'sieg' && st.art === 'aufgabe') text = 'Der Computer gibt auf';
    } else {
      ergebnis = 'sieg';
      text = st.art === 'aufgabe' ? `${name(st.sieger === 'w' ? 'b' : 'w')} gibt auf – ${name(st.sieger)} gewinnt` : `${name(st.sieger)} gewinnt`;
    }
  } else {
    text = { patt: 'Patt – keiner kann mehr ziehen', wiederholung: 'Dreimal dieselbe Stellung', fuenfzig: '50 Züge ohne Schlagen', material: 'Zu wenig Schiffe für ein Matt', einigung: 'Unentschieden vereinbart' }[st.art] || 'Unentschieden';
  }
  const bildFarbe = st.sieger ? (ergebnis === 'verloren' ? spiel.spielerFarbe : st.sieger) : 'w';
  const bild = $('#ende-bild');
  bild.className = 'ende-bild ' + (ergebnis === 'verloren' ? 'verloren' : 'sieg');
  bild.innerHTML = schiffSVG('k', bildFarbe, stilVon(bildFarbe));
  $('#ende-titel').textContent = titel;
  $('#ende-titel').className = 'ende-titel' + (ergebnis === 'sieg' ? ' sieg' : '');
  $('#ende-text').textContent = text;
  $('#ende').hidden = false;
  if (ergebnis === 'sieg') { klang.sieg(); funken(); } else if (ergebnis === 'verloren') klang.niederlage(); else klang.remis();
  vibriere(ergebnis === 'sieg' ? [30, 50, 30, 50, 80] : 60);
}

function funken() {
  const app = $('#app');
  const farben = ['#2fe3c2', '#ffd56b', '#ffffff', '#7fd4ff'];
  for (let i = 0; i < 40; i++) {
    const f = document.createElement('i');
    f.className = 'funke';
    f.style.background = farben[i % 4];
    f.style.left = '50%';
    f.style.top = '36%';
    app.appendChild(f);
    const w = zufall(0, Math.PI * 2);
    const d = zufall(70, 190);
    f.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(w) * d}px), calc(-50% + ${Math.sin(w) * d + 70}px)) scale(.3)`, opacity: 0 },
    ], { duration: zufall(900, 1600), delay: zufall(0, 250), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).finished.then(() => f.remove(), () => f.remove());
  }
}

// Umwandlung: vier Schiffe zur Auswahl (unten als Blatt)
let umwandlungFertig = null;
function waehleUmwandlung(farbe) {
  return new Promise((ok) => {
    umwandlungFertig = ok;
    oeffneBlatt(`<h3>Beförderung</h3><div class="umw-reihe">${['q', 'r', 'b', 'n'].map((t) =>
      `<button class="umw-knopf" data-aktion="umw" data-wert="${t}">${schiffSVG(t, farbe, stilVon(farbe))}<span>${schiffName(t)}</span></button>`).join('')}</div>`);
  });
}
function beendeUmwandlung(typ) {
  if (!umwandlungFertig) return;
  const ok = umwandlungFertig;
  umwandlungFertig = null;
  ok(typ);
}

// =====================================================================
// Computergegner (läuft im Hintergrund-Worker, damit nichts ruckelt)
// =====================================================================
let worker = null;
let workerKaputt = false;
let kiStart = 0;
function holeWorker() {
  if (workerKaputt) return null;
  if (worker) return worker;
  try {
    worker = new Worker('ki.js', { type: 'module' });
    worker.onmessage = kiAntwort;
    worker.onerror = () => {
      worker = null;
      workerKaputt = true;
      if (spiel.kiDenkt) { spiel.kiDenkt = false; kiZug(); }
    };
  } catch {
    workerKaputt = true;
    worker = null;
  }
  return worker;
}
function kiZug() {
  const id = ++spiel.kiId;
  spiel.kiDenkt = true;
  kiStart = performance.now();
  aktualisiere();
  const auftrag = {
    id, startFen: spiel.partie.startFen, zuege: spiel.partie.verlauf().map((z) => z.uci),
    stufe: spiel.stufe, munition: spiel.art === 'gefecht' ? 3 : 0,
  };
  const w = holeWorker();
  if (w) w.postMessage(auftrag);
  else setTimeout(() => { if (id === spiel.kiId) kiAntwort({ data: { id, ...denke(auftrag) } }); }, 60);
}
async function kiAntwort(e) {
  const { id, uci } = e.data;
  if (id !== spiel.kiId) return;
  const rest = 550 - (performance.now() - kiStart);
  if (rest > 0) await pause(rest);
  if (id !== spiel.kiId) return;
  spiel.kiDenkt = false;
  const zug = uci ? spiel.partie.ziehe(uci) : null;
  if (!zug) { aktualisiere(); return; }
  spiel.sperre = true;
  aktualisiere();
  await animiereZug(zug);
  spiel.sperre = false;
  await nachZug(zug);
}
function brichKiAb() {
  spiel.kiId++;
  spiel.kiDenkt = false;
  if (worker) { worker.terminate(); worker = null; }
}

// =====================================================================
// Touch-Steuerung: Schiff antippen und Ziel antippen – ODER Schiff mit dem Finger ziehen
// =====================================================================
const spielEl = $('#s-spiel');
const aufBrett = (e) => !e.target.closest('.spiel-kopf, .spieler, .zugliste, .aktionen');
let zieh = null;
function fingerFeld(x, y) {
  const t = buehne.treffer(x, y);
  const istZiel = (f) => f && spiel.auswahl && spiel.ziele.some((m) => m.nach === f);
  // Liegt ein Zielfeld unter dem Finger, gewinnt es; sonst das Schiff, das man sieht; sonst das Wasserfeld
  if (istZiel(t.schiff)) return t.schiff;
  if (istZiel(t.flaeche)) return t.flaeche;
  return t.schiff || t.flaeche;
}
spielEl.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary || e.button > 0 || !buehne || !aufBrett(e)) return;
  wecken();
  if (eingabeGesperrt()) return;
  const feld = fingerFeld(e.clientX, e.clientY);
  if (!feld) { if (spiel.auswahl) entwaehle(); return; }
  const p = spiel.partie;
  const fig = p.figurAuf(feld);
  const eigene = !!fig && fig.farbe === p.amZug;
  zieh = { start: feld, x: e.clientX, y: e.clientY, aktiv: false, eigene, war: spiel.auswahl === feld, id: e.pointerId, ueber: null };
  if (eigene && spiel.auswahl !== feld) waehle(feld);
  if (eigene) { try { spielEl.setPointerCapture(e.pointerId); } catch { /* egal */ } }
});
spielEl.addEventListener('pointermove', (e) => {
  if (!zieh || e.pointerId !== zieh.id || !zieh.eigene || spiel.feuerModus || spiel.sperre) return;
  if (!zieh.aktiv && Math.hypot(e.clientX - zieh.x, e.clientY - zieh.y) < 10) return;
  if (!zieh.aktiv) { zieh.aktiv = true; buehne.hebe(zieh.start); vibriere(8); }
  buehne.ziehe(e.clientX, e.clientY);
  const ueber = buehne.treffer(e.clientX, e.clientY).flaeche;
  if (ueber !== zieh.ueber) { zieh.ueber = ueber; markiere(ueber && ueber !== zieh.start ? ueber : null); }
});
spielEl.addEventListener('pointerup', async (e) => {
  if (!zieh || e.pointerId !== zieh.id) return;
  const z = zieh;
  zieh = null;
  if (z.aktiv) {
    const ziel = buehne.treffer(e.clientX, e.clientY).flaeche;
    if (ziel && spiel.ziele.some((m) => m.nach === ziel)) await fuehreAus(z.start, ziel, { gezogen: true });
    else { buehne.zurueck(z.start); markiere(); }
    return;
  }
  const feld = z.start;
  if (spiel.auswahl && spiel.auswahl !== feld && spiel.ziele.some((m) => m.nach === feld)) { await fuehreAus(spiel.auswahl, feld); return; }
  if (z.eigene) { if (z.war) entwaehle(); return; }
  if (spiel.auswahl) entwaehle();
});
spielEl.addEventListener('pointercancel', () => {
  if (zieh?.aktiv) buehne.zurueck(zieh.start);
  zieh = null;
  markiere();
});
spielEl.addEventListener('contextmenu', (e) => e.preventDefault());

// =====================================================================
// Blatt (Menü im Spiel, Nachfragen)
// =====================================================================
const ICON = {
  weiter: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  drehen: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 2.8v4h-4M6 21.2v-4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  remis: '<svg viewBox="0 0 24 24"><path d="M5 9h14M5 15h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  flagge: '<svg viewBox="0 0 24 24"><path d="M6 21V4M6 4h11l-2.5 4L17 12H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  einst: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  haus: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
};
function oeffneBlatt(html) {
  $('#blatt-karte').innerHTML = html;
  const b = $('#blatt');
  b.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('offen')));
}
function schliesseBlatt() {
  const b = $('#blatt');
  b.classList.remove('offen');
  setTimeout(() => { if (!b.classList.contains('offen')) b.hidden = true; }, 340);
}
function spielMenue() {
  const knopf = (aktion, icon, text, extra = '') => `<button class="blatt-knopf ${extra}" data-aktion="${aktion}">${ICON[icon]}${text}</button>`;
  const laeuft = !spiel.ende;
  oeffneBlatt(`<h3>Menü</h3>
    ${knopf('blatt-zu', 'weiter', 'Weiterspielen')}
    ${knopf('ansicht-drehen', 'drehen', 'Brett drehen')}
    ${laeuft && spiel.modus === 'zwei' ? knopf('remis', 'remis', 'Remis vereinbaren') : ''}
    ${laeuft ? knopf('aufgeben', 'flagge', 'Aufgeben', 'gefahr') : ''}
    ${knopf('einst-spiel', 'einst', 'Einstellungen')}
    ${knopf('menue', 'haus', 'Hauptmenü')}`);
}
function frage(titel, text, jaAktion, jaText) {
  oeffneBlatt(`<h3>${titel}</h3><p>${text}</p>
    <button class="blatt-knopf haupt" data-aktion="${jaAktion}">${jaText}</button>
    <button class="blatt-knopf" data-aktion="blatt-zu" style="justify-content:center">Abbrechen</button>`);
}

let toastZeit = 0;
function zeigeToast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('zeigen');
  clearTimeout(toastZeit);
  toastZeit = setTimeout(() => t.classList.remove('zeigen'), 2200);
}

// =====================================================================
// Alle Knöpfe (ein gemeinsamer Klick-Verteiler)
// =====================================================================
const letzterKlick = {};
let introBis = 0;
function neuParameter() {
  const farbe = daten.wahl.farbe === 'z' ? (Math.random() < 0.5 ? 'w' : 'b') : daten.wahl.farbe;
  return { modus: 'ki', art: daten.wahl.artKi, stufe: daten.wahl.stufe, spielerFarbe: farbe };
}
document.addEventListener('click', (e) => {
  const k = e.target.closest('[data-aktion]');
  if (!k || k.disabled) return;
  if (performance.now() < introBis && k.closest('#s-menue')) return;   // erster Tipp beendet nur das Intro
  const aktion = k.dataset.aktion;
  const jetzt = performance.now();
  if (jetzt - (letzterKlick[aktion] || 0) < 350) return;               // versehentliche Doppeltipps
  letzterKlick[aktion] = jetzt;
  wecken();
  switch (aktion) {
    case 'spielen': {
      klang.knopf();
      const p = daten.partie;
      if (p && !p.ende && p.zuege.length) fortsetzen(); else neuesSpiel(neuParameter());
      break;
    }
    case 'ki-wahl': klang.knopf(); zeigeWahl('ki'); break;
    case 'zwei-wahl': klang.knopf(); zeigeWahl('zwei'); break;
    case 'stufe':
      daten.wahl.stufe = +k.dataset.wert; speichere(); klang.wahl();
      for (const b of $('#stufen').children) b.classList.toggle('an', b === k);
      break;
    case 'los': {
      klang.knopf();
      if (wahlModus === 'ki') neuesSpiel(neuParameter());
      else neuesSpiel({ modus: 'zwei', art: daten.wahl.artZwei, stufe: daten.wahl.stufe, spielerFarbe: 'w' });
      break;
    }
    case 'einstellungen': klang.knopf(); einstHerkunft = 's-menue'; zeigeEinstellungen(); zeige('s-einst'); break;
    case 'einst-spiel': schliesseBlatt(); einstHerkunft = 's-spiel'; zeigeEinstellungen(); zeige('s-einst'); break;
    case 'einst-zurueck': klang.knopf(); zeige(einstHerkunft, true); break;
    case 'schalter': einstellungAendern(k.dataset.wert); break;
    case 'flotte': flotteAendern(k.dataset.farbe, k.dataset.wert); break;
    case 'menue':
      klang.knopf(); schliesseBlatt(); $('#ende').hidden = true; zeige('s-menue', true); break;
    case 'zurueck-zug': zugZurueck(); break;
    case 'feuer': feuerUmschalten(); break;
    case 'neustart':
      klang.knopf();
      if (spiel.ende || !spiel.partie.verlauf().length) neuesSpiel({ modus: spiel.modus, art: spiel.art, stufe: spiel.stufe, spielerFarbe: spiel.spielerFarbe });
      else frage('Neues Spiel?', 'Die laufende Partie wird beendet.', 'neustart-ja', 'Neu starten');
      break;
    case 'neustart-ja':
    case 'nochmal':
      schliesseBlatt(); klang.knopf();
      neuesSpiel({ modus: spiel.modus, art: spiel.art, stufe: spiel.stufe, spielerFarbe: spiel.spielerFarbe });
      break;
    case 'spielmenue': klang.knopf(); spielMenue(); break;
    case 'blatt-zu': schliesseBlatt(); beendeUmwandlung(null); break;
    case 'umw': schliesseBlatt(); klang.knopf(); beendeUmwandlung(k.dataset.wert); break;
    case 'satz':
      daten.einst.satz = k.dataset.wert; speichere(); klang.umwandlung();
      wechsleSatz(daten.einst.satz);
      zeigeEinstellungen();
      break;
    case 'blick':
      daten.einst.blick = k.dataset.wert; speichere(); klang.wahl();
      buehne?.setzeBlickwinkel(BLICK[daten.einst.blick]);
      zeigeEinstellungen();
      break;
    case 'ansicht-drehen': schliesseBlatt(); setzeAusrichtung(!spiel.gedreht); break;
    case 'aufgeben': frage('Aufgeben?', spiel.modus === 'ki' ? 'Der Computer gewinnt die Partie.' : `${spiel.partie.amZug === 'w' ? 'Weiß' : 'Schwarz'} gibt die Partie auf.`, 'aufgeben-ja', 'Aufgeben'); break;
    case 'aufgeben-ja': schliesseBlatt(); beenden('aufgabe'); break;
    case 'remis': frage('Remis?', 'Beide Spieler einigen sich auf Unentschieden.', 'remis-ja', 'Remis'); break;
    case 'remis-ja': schliesseBlatt(); beenden('einigung'); break;
    case 'ansehen': $('#ende').hidden = true; break;
    default: break;
  }
});
// Auswahl-Knöpfe ohne eigene Aktion (Modus, Farbe)
$('#modus-wahl').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (wahlModus === 'ki') daten.wahl.artKi = b.dataset.wert; else daten.wahl.artZwei = b.dataset.wert;
  speichere(); klang.wahl();
  for (const x of $('#modus-wahl').children) x.classList.toggle('an', x === b);
});
$('#farb-wahl').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  daten.wahl.farbe = b.dataset.wert; speichere(); klang.wahl();
  for (const x of $('#farb-wahl').children) x.classList.toggle('an', x === b);
});

// Kein Zoomen und kein Wackeln der Seite
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// =====================================================================
// Start
// =====================================================================
function start() {
  verlaeufeEinsetzen();
  setzeVh();
  window.addEventListener('resize', setzeVh);
  tonAn(daten.einst.ton);
  if (daten.einst.satz !== 'kriegs') wechsleSatz(daten.einst.satz);
  // Sterne am Himmel
  $('#sterne').innerHTML = Array.from({ length: 46 }, () =>
    `<i style="left:${zufall(0, 100).toFixed(1)}%;top:${zufall(0, 92).toFixed(1)}%;--d:${zufall(-3, 0).toFixed(2)}s;opacity:${zufall(0.25, 0.8).toFixed(2)}"></i>`).join('');
  $('#logo-schiff').innerHTML = schiffSVG('k', 'w', daten.einst.flotteW);
  for (const s of document.querySelectorAll('.fw-schiff')) s.innerHTML = schiffSVG('k', s.dataset.farbe, stilVon(s.dataset.farbe));
  // Start-Animation; erster Tipp überspringt sie
  const menue = $('#s-menue');
  menue.classList.add('aktiv');
  aktuelleSeite = menue;
  menueInfo();
  introBis = performance.now() + 1500;
  const introFertig = () => { menue.classList.add('gesehen'); introBis = Math.min(introBis, performance.now() + 250); };
  menue.addEventListener('pointerdown', () => { wecken(); if (performance.now() < introBis) introFertig(); }, { once: false });
  setTimeout(introFertig, 2600);
  if ('serviceWorker' in navigator && !location.search.includes('nosw')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (TEST) window.__nc = { get buehne() { return buehne; }, spiel, daten, neuesSpiel, fortsetzen, zeige, zeigeEinstellungen, zeigeWahl, fuehreAus, waehle, feuerUmschalten, zeigeEnde, setzeAusrichtung, intro: introFertig };
}
start();
