// MINEFIELD PRO – flaches Glas-Brett im Weltall. Jedes Feld ist ohne Raten lösbar.
import { starteApp } from '../gemeinsam/rahmen.js';
import { ladeKlaenge } from '../gemeinsam/ton.js';
// Kenney-Sounds (CC0): ersetzen die gemeinsamen Klaenge durch passende eigene
ladeKlaenge({ gegner: 'ton/gegner.wav', schlecht: 'ton/schlecht.wav', setzen: 'ton/setzen.wav', wahl: 'ton/wahl.wav' });
import { baueBrett } from '../gemeinsam/brett.js';
import { STUFEN, einVersuch, aufdecken, akkordZiele, gewonnen, sterneFuer, mmss } from './logik.js';

const ICON = {
  schaufel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5l6 6"/><path d="M17.5 6.5l-6.8 6.8"/><path d="M10.7 13.3l-1.6-1.6a1.4 1.4 0 00-2 0L4.3 14.5a2 2 0 00-.5 1.9l.9 3.5a.9.9 0 001.1.7l3.5-.9a2 2 0 001-.5l2.7-2.7a1.4 1.4 0 000-2z"/></svg>',
  fahne: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V3.8"/><path d="M6.4 4.2h11.2l-3 4.3 3 4.3H6.4"/></svg>',
};
const FAHNE = '<svg class="mf-fahne" viewBox="0 0 24 24"><defs><linearGradient id="mfg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd2a3"/><stop offset=".5" stop-color="#ff9a4a"/><stop offset="1" stop-color="#d4561a"/></linearGradient></defs><path d="M7.4 20.5V4" stroke="#e9eefc" stroke-width="1.5" stroke-linecap="round"/><path d="M8 4.3h10.2l-2.9 4 2.9 4H8z" fill="url(#mfg)"/><ellipse cx="7.4" cy="20.6" rx="3.6" ry="1" fill="#e9eefc" opacity=".35"/></svg>';
const FORMELN = [
  'r<sub>s</sub> = 2GM / c²',
  'ds² = −(1 − r<sub>s</sub>/r) c²dt² + (1 − r<sub>s</sub>/r)<sup>−1</sup> dr² + r² dΩ²',
  'T<sub>H</sub> = ħc³ / 8πGMk<sub>B</sub>',
  'S = k<sub>B</sub>A / 4ℓ<sub>p</sub>²',
  '∇²Φ = 4πGρ',
  'G<sub>μν</sub> + Λg<sub>μν</sub> = 8πG T<sub>μν</sub> / c⁴',
];

starteApp({
  id: 'minefield', name: 'MINEFIELD PRO', cover: 'minen', akzent: '#ff9a4a',
  titel: { gross: 'MINEFIELD', klein: 'PRO', stil: 'weit', y: 0.8 },
  zweiSpieler: false,
  stufen: STUFEN,
  statistik: [
    { key: 'bestzeit', name: 'Bestzeit', art: 'min', format: mmss },
    { key: 'entschaerft', name: 'Minen markiert', art: 'summe' },
  ],

  erstelle(buehne, k) {
    const st = k.stufe;
    const { sp, ze } = st, minenZahl = st.minen, n = sp * ze, sicher = n - minenZahl;
    let aus = false;

    const wurzel = document.createElement('div');
    wurzel.className = 'mf';
    wurzel.innerHTML = `
      <div class="mf-himmel" aria-hidden="true">
        <div class="mf-sl"><i></i></div>
        ${FORMELN.map((f, i) => `<span class="mf-formel f${i}">${f}</span>`).join('')}
      </div>
      <div class="mf-feld"></div>
      <div class="mf-zaehler"><i class="mf-mini"><b></b></i><b class="mf-rest">${minenZahl}</b></div>
      <div class="mf-schalter" role="group">
        <button data-m="graben" class="an" aria-label="Aufdecken">${ICON.schaufel}</button>
        <button data-m="fahne" aria-label="Fahne">${ICON.fahne}</button>
      </div>`;
    buehne.append(wurzel);
    const $ = (s) => wurzel.querySelector(s);

    const b = baueBrett($('.mf-feld'), { spalten: sp, zeilen: ze, kipp: 8 });
    b.brett.classList.add('mf-brett');
    const lichtband = document.createElement('div'); lichtband.className = 'mf-lichtband'; b.brett.append(lichtband);
    const ro = new ResizeObserver(() => { const w = b.brett.getBoundingClientRect().width; if (w) b.brett.style.setProperty('--z', `${(b.brett.offsetWidth / sp).toFixed(2)}px`); });
    ro.observe(b.brett);

    // ——— Zustand ———
    let minen = null, zahlen = null;
    const offen = new Uint8Array(n), fahnen = new Uint8Array(n);
    let modus = 'graben', fertig = false, sperre = false, startZeit = 0, uhr = 0, offenAnzahl = 0;
    const feld = (i) => b.liste[i];
    const xy = (i) => [i % sp, Math.floor(i / sp)];
    k.info('0:00');

    const zaehler = $('.mf-rest');
    const zeigeZaehler = () => { let f = 0; for (let i = 0; i < n; i++) f += fahnen[i]; zaehler.textContent = minenZahl - f; };
    const sekunden = () => (startZeit ? Math.floor((performance.now() - startZeit) / 1000) : 0);
    const starteUhr = () => { startZeit = performance.now(); uhr = setInterval(() => k.info(mmss(sekunden())), 250); };

    // ——— Modus-Schalter ———
    const schalter = $('.mf-schalter');
    const setzeModus = (m) => { modus = m; schalter.querySelectorAll('button').forEach((x) => x.classList.toggle('an', x.dataset.m === m)); wurzel.classList.toggle('fahnen-modus', m === 'fahne'); };
    schalter.addEventListener('click', (e) => { const x = e.target.closest('button'); if (!x) return; x.blur(); k.ton.klick(); setzeModus(x.dataset.m); });

    // ——— Feld erzeugen (erst nach dem ersten Tipp, in kleinen Zeitscheiben) ———
    async function erzeugen(start) {
      sperre = true;
      feld(start).classList.add('laedt');
      let f = null;
      while (!f && !aus) {
        const ende = performance.now() + 10;
        while (!f && performance.now() < ende) f = einVersuch(sp, ze, minenZahl, start);
        if (!f) await new Promise((r) => requestAnimationFrame(r));
      }
      feld(start).classList.remove('laedt');
      if (aus) return false;
      minen = f.minen; zahlen = f.zahlen;
      sperre = false;
      starteUhr();
      return true;
    }

    // ——— Aufdecken mit Welle ———
    function zeigeOffen(liste, schritt) {
      const stufen = new Map();
      for (const { i, d } of liste) { if (!stufen.has(d)) stufen.set(d, []); stufen.get(d).push(i); }
      const maxD = Math.max(0, ...stufen.keys());
      const ms = schritt ?? Math.min(34, 520 / Math.max(1, maxD));
      for (const [d, felder] of stufen) {
        setTimeout(() => {
          if (aus) return;
          for (const i of felder) {
            const el = feld(i);
            el.classList.remove('fahne', 'halten');
            el.classList.add('offen', `n${zahlen[i]}`);
            el.innerHTML = zahlen[i] > 0 ? `<b>${zahlen[i]}</b>` : '';
          }
        }, d * ms);
      }
      return maxD * ms;
    }

    function oeffne(ziele) {
      // ziele: Felder, die geöffnet werden sollen (eins beim Tippen, mehrere beim Akkord)
      const mine = ziele.find((i) => minen[i] && !fahnen[i] && !offen[i]);
      if (mine !== undefined) return treffer(mine);
      let neu = [];
      for (const i of ziele) neu = neu.concat(aufdecken(sp, ze, zahlen, offen, fahnen, i).map((x) => ({ i: x.i, d: x.d + (ziele.length > 1 ? 1 : 0) })));
      if (!neu.length) return;
      offenAnzahl += neu.length;
      if (neu.length > 4) k.ton.setzen(); else k.ton.klick();
      const dauer = zeigeOffen(neu);
      if (gewonnen(minen, offen)) { fertig = true; clearInterval(uhr); setTimeout(sieg, dauer + 250); }
    }

    async function tippe(i) {
      if (fertig || sperre || aus) return;
      if (!minen) {
        if (modus === 'fahne') return fahneUmschalten(i);
        if (fahnen[i]) return;
        if (!(await erzeugen(i))) return;
        return oeffne([i]);
      }
      if (offen[i]) {
        const ziele = akkordZiele(sp, ze, zahlen, offen, fahnen, i);
        if (ziele.length) oeffne(ziele);
        else if (zahlen[i] > 0) { const el = feld(i); el.classList.remove('stups'); void el.offsetWidth; el.classList.add('stups'); }
        return;
      }
      if (modus === 'fahne') return fahneUmschalten(i);
      if (fahnen[i]) { const el = feld(i); el.classList.remove('stups'); void el.offsetWidth; el.classList.add('stups'); return; }
      oeffne([i]);
    }

    function fahneUmschalten(i) {
      if (fertig || aus || offen[i]) return;
      fahnen[i] ^= 1;
      const el = feld(i);
      if (fahnen[i]) { el.insertAdjacentHTML('beforeend', FAHNE); el.classList.add('fahne'); k.ton.wahl(); if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(12); }
      else { el.querySelector('.mf-fahne')?.remove(); el.classList.remove('fahne'); k.ton.klick(); }
      zeigeZaehler();
    }

    // ——— Tippen / langes Drücken / Rechtsklick ———
    let druck = null;
    const felder = b.felder;
    felder.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest('.feld'); if (!el) return;
      const i = +el.dataset.y * sp + +el.dataset.x;
      const d = { i, x: e.clientX, y: e.clientY, lang: false, el };
      d.timer = setTimeout(() => { d.lang = true; el.classList.remove('halten'); if (!offen[i]) fahneUmschalten(i); }, 420);
      if (!offen[i] && !fertig) el.classList.add('halten');
      druck = d;
    });
    const abbrechen = () => { if (!druck) return; clearTimeout(druck.timer); druck.el.classList.remove('halten'); druck = null; };
    felder.addEventListener('pointermove', (e) => { if (druck && Math.hypot(e.clientX - druck.x, e.clientY - druck.y) > 12) abbrechen(); });
    felder.addEventListener('pointerup', () => {
      if (!druck) return;
      const d = druck; abbrechen();
      if (!d.lang) tippe(d.i);
    });
    felder.addEventListener('pointercancel', abbrechen);
    felder.addEventListener('pointerleave', abbrechen);
    felder.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const el = e.target.closest('.feld'); if (!el) return;
      if (e.pointerType === 'touch' || druck) return;
      fahneUmschalten(+el.dataset.y * sp + +el.dataset.x);
    });
    const taste = (e) => { if (aus || fertig) return; if (e.key === ' ' || e.key === 'f' || e.key === 'F') { e.preventDefault(); setzeModus(modus === 'fahne' ? 'graben' : 'fahne'); k.ton.klick(); } };
    addEventListener('keydown', taste);

    // ——— Treffer: Implosion in ein schwarzes Loch, dann erscheinen alle Minen ———
    async function treffer(i) {
      fertig = true; clearInterval(uhr);
      const sek = sekunden();
      const [hx, hy] = xy(i);
      const el = feld(i);
      el.classList.add('treffer', 'mine');
      el.insertAdjacentHTML('beforeend', '<i class="mf-loch gross"><b></b></i>');
      const imp = document.createElement('div'); imp.className = 'mf-implosion';
      imp.style.left = `${((hx + 0.5) / sp) * 100}%`; imp.style.top = `${((hy + 0.5) / ze) * 100}%`;
      imp.innerHTML = '<i class="ring"></i><i class="kern"></i><i class="welle"></i>';
      b.brett.append(imp);
      b.brett.classList.add('bebt');
      // Felder ringsum werden zum Loch gezogen
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const [x, y] = xy(j), dist = Math.hypot(x - hx, y - hy);
        if (dist > 4.2) continue;
        const f = feld(j);
        f.style.setProperty('--sx', ((hx - x) * (0.42 / Math.max(1, dist * 0.6))).toFixed(2));
        f.style.setProperty('--sy', ((hy - y) * (0.42 / Math.max(1, dist * 0.6))).toFixed(2));
        f.style.setProperty('--v', `${Math.round(dist * 45)}ms`);
        f.classList.add('sog');
      }
      k.ton.schlecht();
      await k.warte(900); if (aus) return;
      // alle anderen Minen nacheinander (nach Abstand)
      const andere = [];
      for (let j = 0; j < n; j++) if (minen[j] && j !== i && !fahnen[j]) { const [x, y] = xy(j); andere.push([Math.hypot(x - hx, y - hy), j]); }
      andere.sort((a, c) => a[0] - c[0]);
      const schritt = Math.min(110, 1500 / Math.max(1, andere.length));
      andere.forEach(([, j], idx) => setTimeout(() => {
        if (aus) return;
        const f = feld(j); f.classList.add('mine', 'zeigen'); f.insertAdjacentHTML('beforeend', '<i class="mf-loch"><b></b></i>');
        if (idx % 2 === 0) k.ton.gegner();
      }, idx * schritt));
      for (let j = 0; j < n; j++) if (fahnen[j] && !minen[j]) feld(j).classList.add('falsch');
      await k.warte(andere.length * schritt + 1000); if (aus) return;
      k.ende({ sieg: false, werte: [['Zeit', mmss(sek)], ['Felder', `${offenAnzahl}/${sicher}`], ['Minen', minenZahl]], verzoegerung: 300 });
    }

    // ——— Sieg: Lichtwelle über das Feld ———
    async function sieg() {
      if (aus) return;
      const sek = sekunden();
      k.info(mmss(sek));
      for (let j = 0; j < n; j++) if (minen[j] && !fahnen[j]) { fahnen[j] = 1; const f = feld(j); f.insertAdjacentHTML('beforeend', FAHNE); f.classList.add('fahne'); }
      zeigeZaehler();
      for (let j = 0; j < n; j++) { const [x, y] = xy(j); const f = feld(j); f.style.setProperty('--v', `${(x + y) * 32}ms`); f.classList.add('licht'); }
      b.brett.classList.add('geschafft');
      k.ton.gut();
      await k.warte((sp + ze) * 32 + 1100); if (aus) return;
      k.ende({ sieg: true, sterne: sterneFuer(sek, st.sterne), werte: [['Zeit', mmss(sek)], ['Minen', minenZahl], ['Felder', sicher]], extra: { bestzeit: sek, entschaerft: minenZahl }, verzoegerung: 300 });
    }

    // Für Tests (nur mit ?test): Minen kennen, um ein echtes Spiel durchzuspielen
    if (location.search.includes('test')) window.__mf = { get minen() { return minen; }, get zahlen() { return zahlen; }, offen, fahnen, sp, ze };

    return { weg() { aus = true; clearInterval(uhr); ro.disconnect(); b.weg(); removeEventListener('keydown', taste); } };
  },
});
