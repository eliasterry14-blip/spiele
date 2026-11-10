// LOGIC DUEL – Wettrennen gegen die KI beim Lösen von Denkaufgaben.
// Oben zwei Renn-Balken (Du / KI) + Herzschlag-Linie der KI, Mitte die Aufgaben-Karte, unten 2×2 Antworten.
import { starteApp } from '../gemeinsam/rahmen.js';
import { STUFEN, ZIEL, DAUER, SPERRE, erzeugeAufgabe, erzeugeTyp, kiPlan, kiFalscheWahl, sterne, ausgang, zf } from './logik.js';
import { ladeKlaenge } from '../gemeinsam/ton.js';

// Kenney-Sounds (CC0): eigener Impuls-Klang, wenn die KI punktet
ladeKlaenge({ ki: 'ton/ki.wav', impuls: 'ton/impuls.wav' });

const SYM = {
  dreieck: '<svg viewBox="0 0 24 24"><path d="M12 3.2 21.6 20H2.4z"/></svg>',
  quadrat: '<svg viewBox="0 0 24 24"><rect x="3.6" y="3.6" width="16.8" height="16.8" rx="1.2"/></svg>',
  kreis: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/></svg>',
};
const HERZ = '<svg viewBox="0 0 24 24"><path d="M12 20.5C6 16.3 2.8 13 2.8 8.9 2.8 6.2 4.9 4.2 7.4 4.2c1.9 0 3.5 1.1 4.6 2.7 1.1-1.6 2.7-2.7 4.6-2.7 2.5 0 4.6 2 4.6 4.7 0 4.1-3.2 7.4-9.2 11.6z"/><path class="ader" d="M2.6 11.6h5l1.6-3 2.3 6 1.9-4.2 1 1.2h7"/></svg>';
const KOMMA = (v) => v.toFixed(1).replace('.', ',');
const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const klemm = (x, a, b) => Math.max(a, Math.min(b, x));

// ——— Inhalt der Aufgaben-Karte (ohne Worte – die Aufgabe erklärt sich selbst) ———
function inhaltHtml(a) {
  const A = a.anzeige;
  switch (a.typ) {
    case 'reihe':
      return `<div class="ld-reihe">${A.werte.map((v) => `<span class="z">${zf(v)}</span>`).join('<i class="p"></i>')}<i class="p"></i><span class="z frage">?</span></div>`;
    case 'kette': {
      let h = `<div class="ld-kette" style="--n:${A.ops.length}"><div class="k-knoten start">${zf(A.start)}</div>`;
      A.ops.forEach((o, i) => {
        h += `<div class="k-schritt" style="--i:${i}"><span class="k-op">${o.z === '²' ? 'x²' : `${o.z}${o.w}`}</span></div>`;
        h += i < A.ops.length - 1 ? '<div class="k-knoten zw"></div>' : '<div class="k-knoten frage">?</div>';
      });
      return `${h}</div>`;
    }
    case 'sudoku':
      return `<div class="ld-sudoku">${A.felder.map((v, i) => `<span class="${i === A.ziel ? 'frage' : v ? 'v' : ''}" style="--i:${i}">${i === A.ziel ? '?' : v || ''}</span>`).join('')}</div>`;
    case 'waage': {
      const term = (g) => g.terme.map((t) => `<b class="sym ${t}">${SYM[t]}</b>`).join(`<em>${g.op}</em>`);
      const zeile = (g, erg, frage) => `<div class="w-links">${term(g)}</div><em>=</em><span class="w-erg${frage ? ' frage' : ''}">${erg}</span>`;
      return `<div class="ld-waage">${A.zeilen.map((g) => zeile(g, g.erg)).join('')}<i class="w-trenn"></i>${zeile(A.frage, '?', true)}</div>`;
    }
    case 'ausreisser': {
      const pkt = A.zahlen.map((_, i) => { const w = ((-90 + i * 60) * Math.PI) / 180; return [Math.cos(w), Math.sin(w)]; });
      const hex = (r) => [0, 1, 2, 3, 4, 5].map((i) => { const w = ((-90 + i * 60) * Math.PI) / 180; return `${(Math.cos(w) * r).toFixed(1)},${(Math.sin(w) * r).toFixed(1)}`; }).join(' ');
      const svg = `<svg class="h-netz" viewBox="-100 -100 200 200">
        <polygon class="h-ring" points="${hex(92)}"/>
        ${pkt.map(([x, y]) => `<path class="h-ader" d="M${(x * 25).toFixed(1)} ${(y * 25).toFixed(1)}L${(x * 54).toFixed(1)} ${(y * 54).toFixed(1)}"/><circle class="h-pad" cx="${(x * 57).toFixed(1)}" cy="${(y * 57).toFixed(1)}" r="2.6"/>`).join('')}
        <polygon class="h-kern" points="${hex(22)}"/></svg>`;
      return `<div class="ld-hex">${svg}${A.zahlen.map((v, i) => `<span class="h-zahl" style="left:${(50 + pkt[i][0] * 38).toFixed(1)}%;top:${(50 + pkt[i][1] * 38).toFixed(1)}%;--i:${i}">${v}</span>`).join('')}<b class="h-mitte">≠</b></div>`;
    }
    case 'raster':
      return `<div class="ld-raster">${A.felder.map((v, i) => `<span class="${v === null ? 'frage' : ''}" style="--i:${i}">${v === null ? '?' : v}</span>`).join('')}</div>`;
  }
  return '';
}

// Herzschlag-Form (EKG) für u ∈ [0,1)
function ekg(u) {
  const g = (m, s, a) => a * Math.exp(-((u - m) ** 2) / (2 * s * s));
  return g(0.12, 0.03, 0.14) - g(0.3, 0.012, 0.16) + g(0.36, 0.016, 1) - g(0.42, 0.014, 0.34) + g(0.66, 0.05, 0.24);
}

starteApp({
  id: 'logicduel', name: 'LOGIC DUEL', cover: 'logik', akzent: '#2fe3c2',
  titel: { gross: 'LOGIC DUEL', stil: 'weit', y: 0.8 },
  zweiSpieler: false,
  stufen: STUFEN,
  statistik: [
    { key: 'richtig', name: 'Richtige Antworten', art: 'summe' },
    { key: 'schnellste', name: 'Schnellste Antwort', art: 'min', format: (v) => `${KOMMA(v)} s` },
  ],

  erstelle(buehne, k) {
    const st = k.stufe;
    const segmente = Array.from({ length: ZIEL }, (_, i) => `<i class="ld-seg" style="--i:${i}"></i>`).join('');
    const root = el(`<div class="ld">
      <div class="ld-rennen">
        <span class="ld-name du"><i></i>DU</span><div class="ld-spur du">${segmente}</div><b class="ld-zahl du">0</b>
        <span class="ld-name ki"><i></i>KI</span><div class="ld-spur ki">${segmente}</div><b class="ld-zahl ki">0</b>
        <span class="ld-herz">${HERZ}</span><div class="ld-puls"><canvas></canvas></div>
      </div>
      <div class="ld-karte"><div class="ld-glas">
        <div class="ld-zeit"><i></i></div>
        <svg class="ld-deko oben" viewBox="0 0 120 80"><path d="M0 22H34L48 8H120"/><path d="M0 34H22L34 46V80"/><circle cx="48" cy="8" r="2.2"/><circle cx="34" cy="46" r="2.2"/><path class="lauf" d="M0 22H34L48 8H120"/></svg>
        <svg class="ld-deko unten" viewBox="0 0 120 80"><path d="M0 22H34L48 8H120"/><path d="M0 34H22L34 46V80"/><circle cx="48" cy="8" r="2.2"/><circle cx="34" cy="46" r="2.2"/><path class="lauf" d="M0 34H22L34 46V80"/></svg>
        <div class="ld-inhalt ld-leer"><i class="ld-kern"></i></div>
      </div></div>
      <div class="ld-antw">${[0, 1, 2, 3].map((i) => `<button class="knopf ld-a" data-i="${i}" disabled><b></b></button>`).join('')}</div>
      <svg class="ld-impulse"></svg>
    </div>`);
    buehne.append(root);
    const $ = (s) => root.querySelector(s);
    const glas = $('.ld-glas'), karte = $('.ld-karte'), antw = $('.ld-antw'), imp = $('.ld-impulse');
    const knoepfe = [...root.querySelectorAll('.ld-a')];
    const seg = { du: [...root.querySelectorAll('.ld-spur.du .ld-seg')], ki: [...root.querySelectorAll('.ld-spur.ki .ld-seg')] };
    const zahl = { du: $('.ld-zahl.du'), ki: $('.ld-zahl.ki') };
    const zeitBalken = $('.ld-zeit i'), herz = $('.ld-herz');
    let inhalt = $('.ld-inhalt');

    // ——— Zustand ———
    let du = 0, ki = 0, aufgabe = null, vorherTyp = null;
    let zustand = 'start'; // start → spiel ⇄ wechsel → ende
    let t0 = 0, aufgabeStart = 0, gesperrtBis = 0, letzteSek = -1;
    let kiStart = 0, kiZiel = 1, kiTrifft = false, kopfAlt = 0, pulsP = 0;
    const duWeg = new Set(), kiWeg = new Set();
    let richtigZahl = 0, schnellste = null, raf = 0, aus = false;
    const uhren = new Set();
    const spaeter = (ms, fn) => { const id = setTimeout(() => { uhren.delete(id); if (!aus) fn(); }, ms); uhren.add(id); };

    // ——— Stand der Balken ———
    const zeigeStand = () => {
      for (const wer of ['du', 'ki']) {
        const n = wer === 'du' ? du : ki;
        seg[wer].forEach((s, i) => s.classList.toggle('an', i < n));
        zahl[wer].textContent = n;
      }
    };
    const segmentNeu = (wer, i) => { const s = seg[wer][i]; if (!s) return; s.classList.remove('neu', 'weg'); void s.offsetWidth; s.classList.add('neu'); };
    const segmentWeg = (wer, i) => { const s = seg[wer][i]; if (!s) return; s.classList.remove('neu', 'weg'); void s.offsetWidth; s.classList.add('weg'); };
    const blitz = (art) => { karte.classList.remove('gut', 'kiblitz', 'falsch'); void karte.offsetWidth; karte.classList.add(art); };

    // ——— Impuls läuft die Leiterbahn entlang ———
    function bahn(punkte, farbe, dauer, fertig) {
      const d = punkte.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.setProperty('--c', farbe);
      g.innerHTML = `<path class="spur" d="${d}"/><path class="kopf" d="${d}"/>`;
      imp.append(g);
      const kopf = g.lastChild, spur = g.firstChild;
      const L = kopf.getTotalLength(), S = Math.min(70, L * 0.45);
      kopf.style.strokeDasharray = `${S} ${L + S}`;
      spur.style.strokeDasharray = `${L} ${L}`;
      kopf.animate([{ strokeDashoffset: S }, { strokeDashoffset: -L }], { duration: dauer, easing: 'cubic-bezier(.5,0,.3,1)' });
      spur.animate([{ strokeDashoffset: L, opacity: 0.9 }, { strokeDashoffset: 0, opacity: 0.5, offset: 0.7 }, { strokeDashoffset: 0, opacity: 0 }], { duration: dauer + 380, easing: 'ease-out' });
      spaeter(dauer, () => fertig?.());
      setTimeout(() => g.remove(), dauer + 420);
    }
    const mitte = (e) => { const r0 = root.getBoundingClientRect(), r = e.getBoundingClientRect(); return { x: r.left - r0.left + r.width / 2, y: r.top - r0.top + r.height / 2, l: r.left - r0.left, t: r.top - r0.top, w: r.width, h: r.height }; };
    // vom Knopf zur Lücke im Balken (rechtwinklig wie eine Leiterbahn)
    function impulsZuBalken(knopf, wer, i, fertig) {
      const a = mitte(knopf), b = mitte(seg[wer][Math.min(i, ZIEL - 1)]);
      const unter = b.y + b.h / 2 + 7;
      bahn([[a.x, a.t + 2], [a.x, unter], [b.x, unter], [b.x, b.y]], wer === 'du' ? 'var(--eins)' : 'var(--zwei)', 430, fertig);
    }
    // vom Kopf der Herzschlag-Linie zum Knopf, den die KI wählt
    function impulsVonKi(knopf, fertig) {
      const p = mitte($('.ld-puls')), b = mitte(knopf);
      const x0 = p.l + p.w * klemm(pulsP, 0, 1), y0 = p.y;
      bahn([[x0, y0], [x0, y0 + 10], [b.x, y0 + 10], [b.x, b.t + 2]], 'var(--zwei)', 300, fertig);
    }

    // ——— Herzschlag-Linie (Canvas) ———
    const cv = $('.ld-puls canvas'), g = cv.getContext('2d');
    let W = 1, H = 1, dpr = 1, welle = new Float32Array(1), schlaege = [];
    function neueWelle() {
      schlaege = [];
      let x = 0.04 + Math.random() * 0.05;
      while (x < 1.02) { schlaege.push(x); x += (0.17 - 0.115 * x) * (0.9 + Math.random() * 0.2); }
      const n = Math.max(2, Math.round(W));
      welle = new Float32Array(n);
      const breite = 0.075;
      for (let px = 0; px < n; px++) {
        const u = px / n;
        let y = 0;
        for (const s of schlaege) { const v = (u - s) / breite + 0.3; if (v > 0 && v < 1) y += ekg(v) * (0.45 + 0.55 * s); }
        welle[px] = y;
      }
    }
    function groesse() {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1); W = r.width || 1; H = r.height || 1;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      neueWelle();
    }
    const ro = new ResizeObserver(() => { groesse(); for (const r of root.querySelectorAll('.ld-reihe')) passe(r); });
    ro.observe(cv);

    function zeichnePuls(now) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const y0 = H * 0.66, amp = H * 0.58;
      const gesperrt = zustand === 'spiel' && now < kiStart;
      if (zustand === 'spiel') pulsP = gesperrt ? 0 : klemm((now - kiStart) / (kiZiel - kiStart), 0, 1);
      // gepunktete Grundlinie
      g.strokeStyle = gesperrt ? 'rgba(255,77,94,.35)' : 'rgba(255,79,163,.2)';
      g.lineWidth = 1; g.setLineDash([1.5, 4.5]);
      g.beginPath(); g.moveTo(0, y0); g.lineTo(W, y0); g.stroke(); g.setLineDash([]);
      const kopf = Math.min(welle.length - 1, Math.floor(pulsP * welle.length));
      if (kopf > 1) {
        const blass = zustand === 'spiel' ? 1 : 0.35;
        g.globalAlpha = blass;
        g.lineJoin = 'round';
        g.strokeStyle = '#ff4fa3'; g.lineWidth = 1.6; g.shadowColor = '#ff4fa3'; g.shadowBlur = 7;
        g.beginPath();
        for (let x = 0; x <= kopf; x++) { const y = y0 - welle[x] * amp; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
        // leuchtender Kopf
        const ky = y0 - welle[kopf] * amp;
        const glanz = g.createRadialGradient(kopf, ky, 0, kopf, ky, 10);
        glanz.addColorStop(0, 'rgba(255,220,240,.95)'); glanz.addColorStop(0.35, 'rgba(255,79,163,.6)'); glanz.addColorStop(1, 'rgba(255,79,163,0)');
        g.shadowBlur = 0; g.fillStyle = glanz; g.beginPath(); g.arc(kopf, ky, 10, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
      // Herz schlägt, wenn der Kopf über einen Schlag läuft
      if (zustand === 'spiel') {
        const vorher = kopfAlt / Math.max(1, welle.length), jetzt = kopf / Math.max(1, welle.length);
        if (schlaege.some((s) => s + 0.03 > vorher && s + 0.03 <= jetzt)) { herz.classList.remove('schlag'); void herz.offsetWidth; herz.classList.add('schlag'); }
        root.classList.toggle('ki-knapp', pulsP > 0.72);
      }
      kopfAlt = kopf;
    }

    // ——— Uhr ———
    function zeigeZeit(rest) {
      zeitBalken.style.transform = `scaleX(${(rest / DAUER).toFixed(4)})`;
      const s = Math.ceil(rest);
      if (s !== letzteSek) {
        letzteSek = s;
        k.info(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
        root.classList.toggle('knapp', s <= 10);
        if (s <= 5 && s > 0) k.ton.klick();
      }
    }

    function tick(now) {
      if (aus) return;
      raf = requestAnimationFrame(tick);
      if (zustand === 'spiel' || zustand === 'wechsel') {
        const rest = Math.max(0, DAUER - (now - t0) / 1000);
        zeigeZeit(rest);
        if (rest <= 0) { fertig(); return; }
        if (zustand === 'spiel' && now >= kiZiel) kiAntwort();
      }
      zeichnePuls(now);
    }

    // ——— Reihe in eine Zeile einpassen ———
    function passe(r) {
      r.style.fontSize = '';
      let fs = parseFloat(getComputedStyle(r).fontSize);
      while (r.scrollWidth > r.clientWidth + 1 && fs > 15) { fs -= 1.5; r.style.fontSize = `${fs}px`; }
    }

    // ——— Ablauf ———
    function planeKi(nachFehler) {
      const p = kiPlan(st, aufgabe, Math.random, nachFehler);
      kiTrifft = p.trifft;
      kiStart = performance.now() + (nachFehler ? SPERRE * 1000 : 0);
      kiZiel = kiStart + p.zeit * 1000;
      if (!nachFehler) neueWelle();
    }

    let erzwungen = null; // nur für Tests (?test)
    function neueAufgabe() {
      aufgabe = erzwungen ? erzeugeTyp(erzwungen, k.nr) : erzeugeAufgabe(k.nr, Math.random, vorherTyp);
      vorherTyp = aufgabe.typ;
      duWeg.clear(); kiWeg.clear(); gesperrtBis = 0;
      antw.classList.remove('gesperrt');
      root.classList.remove('ki-knapp');
      const alt = inhalt;
      alt.classList.add('raus');
      setTimeout(() => alt.remove(), 260);
      inhalt = el(`<div class="ld-inhalt rein typ-${aufgabe.typ}">${inhaltHtml(aufgabe)}</div>`);
      glas.append(inhalt);
      const reihe = inhalt.querySelector('.ld-reihe');
      if (reihe) passe(reihe);
      knoepfe.forEach((b, i) => {
        b.className = 'knopf ld-a rein';
        b.style.animationDelay = `${120 + i * 50}ms`;
        b.disabled = false;
        b.firstChild.textContent = zf(aufgabe.antworten[i]);
      });
      pulsP = 0; kopfAlt = 0;
      spaeter(360, () => {
        if (zustand === 'ende') return;
        zustand = 'spiel';
        aufgabeStart = performance.now();
        planeKi(false);
      });
    }

    function tippe(i) {
      if (zustand !== 'spiel') return;
      const now = performance.now();
      if (now < gesperrtBis || duWeg.has(i) || kiWeg.has(i)) return;
      const b = knoepfe[i];
      if (i === aufgabe.richtig) {
        zustand = 'wechsel';
        const sek = (now - aufgabeStart) / 1000;
        richtigZahl++;
        schnellste = schnellste === null ? sek : Math.min(schnellste, sek);
        du++;
        b.classList.add('richtig');
        k.ton.gut(); k.ton.spiele('impuls', { laut: 0.35, verz: 0.12 });
        blitz('gut');
        const ziel = du - 1;
        impulsZuBalken(b, 'du', ziel, () => { zeigeStand(); segmentNeu('du', ziel); });
        if (du >= ZIEL) spaeter(560, fertig); else spaeter(780, neueAufgabe);
      } else {
        duWeg.add(i);
        b.classList.add('falsch');
        k.ton.schlecht();
        blitz('falsch');
        if (du > 0) { du--; segmentWeg('du', du); zeigeStand(); }
        gesperrtBis = now + SPERRE * 1000;
        antw.classList.remove('gesperrt'); void antw.offsetWidth; antw.classList.add('gesperrt');
        spaeter(SPERRE * 1000, () => { if (performance.now() >= gesperrtBis - 5) antw.classList.remove('gesperrt'); });
      }
    }
    antw.addEventListener('click', (e) => { const b = e.target.closest('.ld-a'); if (b) tippe(+b.dataset.i); });
    const taste = (e) => {
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0 && !e.repeat) { e.preventDefault(); tippe(i); }
    };
    addEventListener('keydown', taste);

    function kiAntwort() {
      const offen = [0, 1, 2, 3].filter((i) => i !== aufgabe.richtig && !duWeg.has(i) && !kiWeg.has(i));
      if (kiTrifft || !offen.length) {
        zustand = 'wechsel';
        const b = knoepfe[aufgabe.richtig];
        ki++;
        const ziel = ki - 1;
        root.classList.remove('ki-knapp');
        impulsVonKi(b, () => {
          b.classList.add('kiwahl');
          k.ton.spiele('ki', { laut: 0.6 }) || k.ton.gegner();
          blitz('kiblitz');
          impulsZuBalken(b, 'ki', ziel, () => { zeigeStand(); segmentNeu('ki', ziel); });
        });
        if (ki >= ZIEL) spaeter(1000, fertig); else spaeter(1300, neueAufgabe);
      } else {
        const w = kiFalscheWahl(aufgabe, new Set([...duWeg, ...kiWeg]));
        kiWeg.add(w);
        planeKi(true);
        impulsVonKi(knoepfe[w], () => {
          knoepfe[w].classList.add('kifalsch');
          k.ton.klick();
          if (ki > 0) { ki--; segmentWeg('ki', ki); zeigeStand(); }
        });
      }
    }

    function fertig() {
      if (zustand === 'ende') return;
      zustand = 'ende';
      const sek = Math.min(DAUER, Math.round((performance.now() - t0) / 1000));
      const sieg = ausgang(du, ki);
      knoepfe.forEach((b) => { b.disabled = true; });
      root.classList.remove('ki-knapp', 'knapp');
      if (sieg !== null) root.classList.add(sieg ? 'sieg-du' : 'sieg-ki');
      k.ende({
        sieg, sterne: sieg ? sterne(du, ki, sek) : 0,
        werte: [['Stand', `${du} : ${ki}`], ['Zeit', `${sek} s`], ['Schnellste', schnellste === null ? '–' : `${KOMMA(schnellste)} s`]],
        extra: { richtig: richtigZahl, ...(schnellste !== null ? { schnellste: +schnellste.toFixed(1) } : {}) },
        verzoegerung: 1100,
      });
    }

    // ——— Start ———
    zeigeStand();
    k.info(`${Math.floor(DAUER / 60)}:${String(DAUER % 60).padStart(2, '0')}`);
    requestAnimationFrame(() => { groesse(); raf = requestAnimationFrame(tick); });
    spaeter(650, () => { t0 = performance.now(); neueAufgabe(); });

    if (location.search.includes('test')) {
      window.__ld = {
        richtig: () => aufgabe?.richtig, zustand: () => zustand, stand: () => [du, ki], aufgabe: () => aufgabe,
        typ: (t) => { erzwungen = t; }, kiStop: () => { kiZiel = Infinity; }, zeitSprung: (s) => { t0 -= s * 1000; },
      };
    }
    return {
      weg() {
        aus = true;
        cancelAnimationFrame(raf);
        uhren.forEach(clearTimeout); uhren.clear();
        ro.disconnect();
        removeEventListener('keydown', taste);
        if (window.__ld) delete window.__ld;
      },
    };
  },
});
