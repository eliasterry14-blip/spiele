// LINEUP – Karten spielen, Steine setzen, fünf in einer Reihe. Gekipptes Neon-Brett in Violett.
import { starteApp } from '../gemeinsam/rahmen.js';
import { ladeKlaenge } from '../gemeinsam/ton.js';
// Kenney-Sounds (CC0): ersetzen die gemeinsamen Klaenge durch passende eigene
ladeKlaenge({ gegner: 'ton/gegner.wav', gut: 'ton/gut.wav', setzen: 'ton/setzen.wav', wahl: 'ton/wahl.wav' });
import { baueBrett } from '../gemeinsam/brett.js';
import {
  neuesSpiel, spiele, tausche, passe, kiZug, kiTotKarte, zielFelder, istTot, kannTauschen, mussPassen,
  art, symbol, wert, SYMBOLE, N,
} from './logik.js';

// ——— Symbole (als SVG, damit sie überall gleich aussehen) ———
const FORM = {
  raute: '<path d="M10 1.4L18.6 10L10 18.6L1.4 10Z"/>',
  kreis: '<circle cx="10" cy="10" r="8.2"/>',
  dreieck: '<path d="M10 1.9L18.8 17.4H1.2Z"/>',
  quadrat: '<rect x="2.6" y="2.6" width="14.8" height="14.8" rx="1.6"/>',
};
const FARBE = ['#ffcf5c', '#7fb2ff', '#c49bff', '#ff8f6b'];
const JOKER = '<path d="M10 .6C10.9 6.5 13.5 9.1 19.4 10C13.5 10.9 10.9 13.5 10 19.4C9.1 13.5 6.5 10.9 .6 10C6.5 9.1 9.1 6.5 10 .6Z"/>';
const BANN = '<circle cx="10" cy="10" r="7.4" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M4.8 15.2L15.2 4.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
const SPIELER = ['var(--eins)', 'var(--zwei)'];

const svg = (inhalt, kl = '') => `<svg viewBox="0 0 20 20" class="${kl}">${inhalt}</svg>`;
const symSvg = (id) => (art(id) === 'joker' ? svg(JOKER, 'j') : art(id) === 'bann' ? svg(BANN, 'b') : svg(FORM[SYMBOLE[symbol(id)]]));
const kartenFarbe = (id) => (art(id) === 'joker' ? '#efe8ff' : art(id) === 'bann' ? '#ff5a6e' : FARBE[symbol(id)]);
function karteHtml(id) {
  const ecke = art(id) === 'zahl' ? `<b>${wert(id)}</b>${symSvg(id)}` : symSvg(id);
  return `<div class="lu-karte lu-${art(id)}" data-id="${id}" style="--s:${kartenFarbe(id)}"><span class="ecke o">${ecke}</span><span class="mitte">${symSvg(id)}</span><span class="ecke u">${ecke}</span></div>`;
}
const RUECKEN = '<div class="lu-ruecken"><svg viewBox="0 0 40 46"><path d="M20 2L38 12.5V33.5L20 44L2 33.5V12.5Z"/></svg><i></i><i></i><i></i><i></i><i></i></div>';

starteApp({
  id: 'lineup', name: 'LINEUP', cover: 'reihe', akzent: '#b48cff',
  titel: { gross: 'LINEUP', stil: 'weit', y: 0.8 },
  zweiSpieler: true,
  stufen: [
    { name: 'Rauch', werte: ['KI zufällig', '36 Karten'] },
    { name: 'Linie', werte: ['Baut Reihen', 'Blockt nie'] },
    { name: 'Akkord', werte: ['Baut + blockt', 'Spart Joker'] },
    { name: 'Takt', werte: ['Zählt Karten', 'Blockt'] },
    { name: 'Melodie', werte: ['Zählt Karten', 'Spart Bann'] },
    { name: 'Sinfonie', werte: ['1 Zug voraus', 'Präzise'] },
  ],
  statistik: [
    { key: 'schnellster', name: 'Schnellster Sieg', art: 'min', format: (v) => `${v} Züge` },
    { key: 'reihen', name: 'Fünfer-Reihen', art: 'summe' },
  ],

  erstelle(buehne, k) {
    const zwei = k.modus === 'zwei';
    const namen = zwei ? ['Spieler 1', 'Spieler 2'] : ['Du', 'KI'];
    const st = neuesSpiel(Math.random, 0);
    const t0 = performance.now();
    let aus = false, aktiv = false, gewaehlt = null, gezeigt = -1;

    const root = document.createElement('div');
    root.className = 'lu';
    const leiste = k.zugleiste(namen);
    const rest = document.createElement('span');
    rest.className = 'lu-rest';
    rest.innerHTML = '<em></em><b></b>';
    leiste.el.append(rest);
    root.append(leiste.el);
    const feldPlatz = document.createElement('div');
    feldPlatz.className = 'lu-feld';
    root.append(feldPlatz);
    const unten = document.createElement('div');
    unten.className = 'lu-unten';
    unten.innerHTML = `<div class="lu-stapel">${RUECKEN}${RUECKEN}${RUECKEN}<b></b></div><div class="lu-hand"></div><div class="lu-ablage"><i></i></div>`;
    root.append(unten);
    const knopfLeiste = document.createElement('div');
    knopfLeiste.className = 'leiste';
    knopfLeiste.innerHTML = '<button class="knopf lu-tausch" disabled>TAUSCHEN</button>';
    root.append(knopfLeiste);
    buehne.append(root);

    const handEl = unten.querySelector('.lu-hand'), stapelEl = unten.querySelector('.lu-stapel'), ablageEl = unten.querySelector('.lu-ablage');
    const tauschKnopf = knopfLeiste.querySelector('.lu-tausch');

    // ——— Brett ———
    const b = baueBrett(feldPlatz, { spalten: N, kipp: 30 });
    b.brett.classList.add('lu-brett');
    b.liste.forEach((f, i) => {
      const id = st.feldKarte[i];
      f.style.setProperty('--s', FARBE[symbol(id)]);
      f.innerHTML = `<span class="lu-f">${svg(FORM[SYMBOLE[symbol(id)]])}<b>${wert(id)}</b></span>`;
    });
    const groesse = () => b.brett.style.setProperty('--fg', `${b.brett.offsetWidth / N}px`);
    const ro = new ResizeObserver(groesse); ro.observe(b.brett); groesse();

    // ——— Anzeigen ———
    const zaehleSteine = (sp) => st.brett.filter((x) => x === sp).length;
    function zeigeWerte() {
      leiste.wert(0, String(zaehleSteine(0))); leiste.wert(1, String(zaehleSteine(1)));
      rest.querySelector('b').textContent = st.stapel.length;
      stapelEl.querySelector('b').textContent = st.stapel.length;
      stapelEl.style.setProperty('--n', Math.min(3, Math.ceil(st.stapel.length / 10)));
      stapelEl.classList.toggle('leer', st.stapel.length === 0);
    }
    function setzeStein(f, sp) {
      const s = document.createElement('div');
      s.className = 'stein lu-stein';
      s.style.setProperty('--c', SPIELER[sp]);
      const feld = b.liste[f];
      feld.append(s);
      b.liste.forEach((x) => x.classList.remove('neu'));
      feld.classList.remove('plopp'); feld.offsetWidth; feld.classList.add('plopp', 'neu');
    }
    function entferneStein(f) {
      const s = b.liste[f].querySelector('.lu-stein');
      if (!s) return;
      s.classList.add('weg');
      b.liste[f].classList.remove('neu');
      setTimeout(() => s.remove(), 650);
    }
    function markiereZiele() {
      b.liste.forEach((x) => x.classList.remove('ziel', 'bannziel'));
      b.brett.classList.toggle('joker-wahl', gewaehlt !== null && art(gewaehlt) === 'joker');
      if (gewaehlt === null) return;
      const ziele = zielFelder(st, gezeigt, gewaehlt);
      for (const f of ziele) b.liste[f].classList.add(art(gewaehlt) === 'bann' ? 'bannziel' : 'ziel');
    }

    // ——— Hand (leicht gefächerte 3D-Karten) ———
    const kartenEl = new Map();
    function ordneHand() {
      const ids = st.hand[gezeigt] || [];
      const n = ids.length, abst = Math.min(62, (handEl.offsetWidth - 70) / Math.max(1, n - 1));
      ids.forEach((id, i) => {
        const el = kartenEl.get(id);
        if (!el) return;
        const m = i - (n - 1) / 2;
        el.style.setProperty('--x', `${m * abst}px`);
        el.style.setProperty('--r', `${m * 6}deg`);
        el.style.setProperty('--y', `${Math.abs(m) * Math.abs(m) * 4}px`);
        el.style.zIndex = String(i + 1);
        el.classList.toggle('an', id === gewaehlt);
        el.classList.toggle('tot', istTot(st, id));
      });
      tauschKnopf.disabled = !(aktiv && gewaehlt !== null && kannTauschen(st, gezeigt, gewaehlt));
    }
    function zeigeHand(sp, neuVomStapel = null) {
      gezeigt = sp;
      handEl.style.setProperty('--c', SPIELER[sp]);
      const ids = st.hand[sp];
      for (const [id, el] of kartenEl) if (!ids.includes(id)) { el.remove(); kartenEl.delete(id); }
      for (const id of ids) {
        if (kartenEl.has(id)) continue;
        const t = document.createElement('template'); t.innerHTML = karteHtml(id);
        const el = t.content.firstElementChild;
        handEl.append(el); kartenEl.set(id, el);
        if (id === neuVomStapel) el.classList.add('neu-gezogen');
      }
      ordneHand();
      if (neuVomStapel !== null && kartenEl.has(neuVomStapel)) fliegeVon(kartenEl.get(neuVomStapel), stapelEl.getBoundingClientRect(), 560);
    }
    function leereHand() { for (const el of kartenEl.values()) el.remove(); kartenEl.clear(); gezeigt = -1; }

    // ——— Flug-Animationen ———
    function fliegeVon(el, q, dauer = 480) {
      const z = el.getBoundingClientRect();
      if (!q.width || !z.width) return;
      const dx = q.left + q.width / 2 - (z.left + z.width / 2), dy = q.top + q.height / 2 - (z.top + z.height / 2);
      el.animate([{ translate: `${dx}px ${dy}px`, scale: q.width / z.width, opacity: 0.3 }, { translate: '0 0', scale: 1, opacity: 1 }], { duration: dauer, easing: 'cubic-bezier(.2,.85,.25,1)' });
    }
    // Karte landet offen auf der Ablage (von quelle = Rechteck)
    function aufAblage(id, q) {
      ablageEl.innerHTML = karteHtml(id);
      const el = ablageEl.firstElementChild;
      if (q) {
        const z = el.getBoundingClientRect();
        const dx = q.left + q.width / 2 - (z.left + z.width / 2), dy = q.top + q.height / 2 - (z.top + z.height / 2);
        el.animate([{ translate: `${dx}px ${dy}px`, scale: q.width / (z.width || 1), rotate: '-14deg', opacity: 0.6 }, { translate: '0 0', scale: 1, rotate: '0deg', opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.2,.85,.25,1)' });
      }
    }
    const kiQuelle = () => { const r = leiste.el.children[1].getBoundingClientRect(); return { left: r.left + r.width / 2 - 20, top: r.top, width: 40, height: 56 }; };

    // ——— Ein Zug wird ausgeführt (Mensch oder KI) ———
    async function fuehreAus(sp, id, f, quelle) {
      aktiv = false; gewaehlt = null; markiereZiele();
      const handKarte = kartenEl.get(id);
      const q = quelle || handKarte?.getBoundingClientRect();
      if (handKarte) { handKarte.remove(); kartenEl.delete(id); }
      aufAblage(id, q);
      const bann = art(id) === 'bann';
      const e = spiele(st, sp, id, f);
      if (bann) { entferneStein(f); if (zwei || sp === 0) k.ton.gut(); else k.ton.schlecht(); }
      else { setzeStein(f, sp); k.ton.setzen(); }
      zeigeWerte();
      if (gezeigt === sp && zwei) leereHand();                 // Duell: Hand sofort verdecken
      else if (gezeigt === sp) { await k.warte(260); if (aus) return; zeigeHand(sp, e.gezogen); }
      if (e.reihe) { await gewonnen(sp, e.reihe); return; }
      if (st.sieger === null) { await k.warte(700); fertig(); return; }
      await k.warte(sp === 0 && !zwei ? 520 : 650); if (aus) return;
      naechster();
    }

    // ——— Sieg-Reihe: Lichtwelle ———
    async function gewonnen(sp, reihe) {
      await k.warte(450); if (aus) return;
      reihe.forEach((f, n) => { const s = b.liste[f].querySelector('.lu-stein'); if (s) { s.style.setProperty('--n', n); s.classList.add('welle'); } });
      const a = b.liste[reihe[0]], z = b.liste[reihe[reihe.length - 1]];
      const x1 = a.offsetLeft + a.offsetWidth / 2, y1 = a.offsetTop + a.offsetHeight / 2, x2 = z.offsetLeft + z.offsetWidth / 2, y2 = z.offsetTop + z.offsetHeight / 2;
      const strahl = document.createElement('div');
      strahl.className = 'lu-strahl';
      strahl.style.setProperty('--c', SPIELER[sp]);
      Object.assign(strahl.style, { left: `${x1}px`, top: `${y1}px`, width: `${Math.hypot(x2 - x1, y2 - y1)}px`, rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` });
      b.felder.append(strahl);
      if (zwei || sp === 0) k.ton.gut(); else k.ton.gegner();
      fertig(sp);
    }

    function fertig(sieger = st.sieger) {
      const sek = Math.round((performance.now() - t0) / 1000);
      const zeit = `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`;
      if (zwei) {
        k.ende({ titel: sieger === null || sieger === undefined ? 'REMIS' : namen[sieger].toUpperCase(), werte: [['Züge', st.zuege[0] + st.zuege[1]], ['Zeit', zeit]], verzoegerung: sieger === null ? 600 : 2200 });
        return;
      }
      const sieg = sieger === 0 ? true : sieger === 1 ? false : null;
      const z = st.zuege[0];
      k.ende({
        sieg, sterne: z <= 9 ? 3 : z <= 12 ? 2 : 1,
        werte: [['Züge', z], ['Steine', zaehleSteine(0)], ['Zeit', zeit]],
        extra: sieg ? { schnellster: z, reihen: 1 } : {},
        verzoegerung: sieg === null ? 600 : 2200,
      });
    }

    // ——— Wer ist dran? ———
    async function naechster() {
      if (aus || st.sieger !== undefined) return;
      const sp = st.dran;
      leiste.dran(sp);
      if (!zwei && sp === 1) { kiDran(); return; }
      if (zwei) {
        leereHand(); ablageEl.classList.add('still');
        await k.weitergeben(namen[sp], SPIELER[sp]); if (aus) return;
        ablageEl.classList.remove('still');
      }
      zeigeHand(sp);
      if (mussPassen(st, sp)) {
        await k.warte(700); if (aus) return;
        k.toast('PASSEN'); passe(st, sp); zeigeWerte();
        if (st.sieger === null) { await k.warte(700); fertig(); return; }
        await k.warte(900); naechster(); return;
      }
      aktiv = true; ordneHand();
    }

    async function kiDran() {
      await k.warte(650 + Math.random() * 600); if (aus) return;
      let t;
      while ((t = kiTotKarte(st, 1)) !== null) {
        tausche(st, 1, t); aufAblage(t, kiQuelle()); k.ton.klick(); zeigeWerte();
        await k.warte(520); if (aus) return;
      }
      const z = kiZug(st, 1, k.nr);
      if (!z) {
        k.toast('PASSEN'); passe(st, 1); zeigeWerte();
        if (st.sieger === null) { await k.warte(700); fertig(); return; }
        await k.warte(800); naechster(); return;
      }
      // Ziel kurz aufleuchten lassen, dann Karte ausspielen
      b.liste[z.feld].classList.add('hell');
      k.ton.gegner();
      await k.warte(420); if (aus) return;
      b.liste[z.feld].classList.remove('hell');
      await fuehreAus(1, z.karte, z.feld, kiQuelle());
    }

    // ——— Eingaben ———
    handEl.addEventListener('click', (e) => {
      const el = e.target.closest('.lu-karte'); if (!el || !aktiv) return;
      const id = +el.dataset.id;
      gewaehlt = gewaehlt === id ? null : id;
      k.ton.klick(); markiereZiele(); ordneHand();
    });
    b.beiTipp((x, y) => {
      if (!aktiv) return;
      const f = y * N + x;
      if (gewaehlt !== null && zielFelder(st, gezeigt, gewaehlt).includes(f)) { fuehreAus(gezeigt, gewaehlt, f); return; }
      // Feld angetippt, zu dem eine Zahlkarte passt → diese Karte auswählen (nochmal tippen = setzen)
      const passend = st.hand[gezeigt].find((id) => art(id) === 'zahl' && zielFelder(st, gezeigt, id).includes(f));
      if (passend !== undefined) { gewaehlt = passend; k.ton.klick(); markiereZiele(); ordneHand(); return; }
      if (gewaehlt !== null) { k.ton.schlecht(); b.liste[f].classList.add('wackeln'); setTimeout(() => b.liste[f].classList.remove('wackeln'), 380); }
    });
    tauschKnopf.onclick = () => {
      if (!aktiv || gewaehlt === null || !kannTauschen(st, gezeigt, gewaehlt)) return;
      const id = gewaehlt, el = kartenEl.get(id), q = el?.getBoundingClientRect();
      el?.remove(); kartenEl.delete(id);
      const neu = tausche(st, gezeigt, id);
      gewaehlt = null; markiereZiele();
      aufAblage(id, q); k.ton.wahl(); zeigeWerte();
      zeigeHand(gezeigt, neu);
      // Stapel jetzt leer und trotzdem nichts spielbar → aussetzen
      if (mussPassen(st, gezeigt)) {
        aktiv = false; ordneHand();
        setTimeout(async () => {
          if (aus) return;
          k.toast('PASSEN'); passe(st, gezeigt); zeigeWerte();
          if (st.sieger === null) { await k.warte(700); fertig(); return; }
          await k.warte(900); naechster();
        }, 700);
      }
    };

    // ——— Los ———
    zeigeWerte();
    if (!zwei) zeigeHand(0);
    setTimeout(() => { if (!aus) naechster(); }, 700);
    // nur für meine Tests: ein automatischer Zug für den Menschen (wie die KI der Stufe 6)
    if (location.search.includes('test')) window.__lu = {
      st, b, get aktiv() { return aktiv; }, spiele: (id, f) => fuehreAus(gezeigt, id, f), zielFelder,
      auto(nr = 6) {
        if (!aktiv) return false;
        const t = kiTotKarte(st, gezeigt);
        if (t !== null) { gewaehlt = t; ordneHand(); tauschKnopf.click(); return 'tausch'; }
        const z = kiZug(st, gezeigt, nr);
        if (z) fuehreAus(gezeigt, z.karte, z.feld);
        return !!z;
      },
    };
    return { weg() { aus = true; aktiv = false; b.weg(); ro.disconnect(); } };
  },
});
