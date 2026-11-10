// WALL DUEL – zwei Figuren, ein 7×7-Brett, weiß leuchtende Mauern in den Rillen.
import { starteApp } from '../gemeinsam/rahmen.js';
import { ladeKlaenge } from '../gemeinsam/ton.js';
// Kenney-Sounds (CC0): ersetzen die gemeinsamen Klaenge durch passende eigene
ladeKlaenge({ gegner: 'ton/gegner.wav', setzen: 'ton/setzen.wav', wahl: 'ton/wahl.wav' });
import { baueBrett, figur } from '../gemeinsam/brett.js';
import * as R from './logik.js';

const N = R.GROESSE;
const HEX = ['#2fe3c2', '#ff4fa3'];
const ICON = {
  mauer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 12.5L6.5 9h14.5L17.5 12.5z" fill="currentColor" fill-opacity=".45"/><path d="M3 12.5h14.5V17H3z"/><path d="M17.5 12.5L21 9v4.5L17.5 17"/></svg>',
  drehen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4.6h-4.6"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

const div = (cls, eltern) => { const d = document.createElement('div'); d.className = cls; eltern?.append(d); return d; };

starteApp({
  id: 'wallduel', name: 'WALL DUEL', cover: 'wand', akzent: '#dfe7ff',
  titel: { gross: 'WALL DUEL', stil: 'weit', y: 0.76 },
  farben: HEX,
  zweiSpieler: true,
  stufen: [
    { name: 'Linie', werte: ['7 × 7', '6 Mauern', 'KI 15 %'] },
    { name: 'Kante', werte: ['7 × 7', '6 Mauern', 'KI 30 %'] },
    { name: 'Ecke', werte: ['7 × 7', '6 Mauern', 'KI 50 %'] },
    { name: 'Fläche', werte: ['7 × 7', '6 Mauern', 'KI 65 %'] },
    { name: 'Raum', werte: ['7 × 7', '6 Mauern', 'KI 80 %'] },
    { name: 'Hexagon', werte: ['7 × 7', '6 Mauern', 'KI 95 %'] },
  ],
  statistik: [
    { key: 'mauern', name: 'Mauern gesetzt', art: 'summe' },
    { key: 'schnell', name: 'Schnellster Sieg', art: 'min', format: (v) => `${v} Züge` },
  ],

  erstelle(buehne, k) {
    const zwei = k.modus === 'zwei';
    const namen = zwei ? ['Spieler 1', 'Spieler 2'] : ['Du', 'KI'];
    const wurzel = div('wd', buehne);
    const leiste = k.zugleiste(namen);
    wurzel.append(leiste.el);

    // ——— Brett ———
    const b = baueBrett(wurzel, {
      spalten: N, zeilen: N, kipp: 30,
      muster: (x, y) => (y === 0 ? 'wd-z0' : y === N - 1 ? 'wd-z1' : ['t1', 't2', 't3', 't4'][(x + 2 * y) % 4]),
    });
    const brett = b.brett;
    brett.classList.add('wd-brett');
    // Die Einflug-Animation hält opacity/transform fest – das macht alles 3D flach. Danach weg damit.
    const echt3d = () => brett.classList.remove('rein');
    brett.addEventListener('animationend', (e) => { if (e.target === brett) echt3d(); });
    setTimeout(echt3d, 1300);
    const linien = [div('wd-linie l0', brett), div('wd-linie l1', brett)];
    const ebene = div('wd-ebene', brett);
    const punkte = div('wd-punkte', brett);
    const ro = new ResizeObserver(() => brett.style.setProperty('--z', `${brett.offsetWidth / N}px`));
    ro.observe(brett);

    // ——— Figuren ———
    const figuren = [0, 1].map((p) => {
      const st = div(`wd-stand s${p}`, ebene);
      div('wd-schein', st);
      const hupf = div('wd-hupf', st);
      hupf.append(figur(HEX[p], 'bauer', 0.74));
      return st;
    });
    const stelle = (p, springen) => {
      const st = figuren[p], [x, y] = s.pos[p];
      st.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
      if (springen) { st.classList.remove('hupft'); void st.offsetWidth; st.classList.add('hupft'); }
    };

    // ——— Mauern ———
    const lege = (m, o, a, bb) => {
      const z = 100 / N;
      m.classList.remove('h', 'v'); m.classList.add(o);
      if (o === 'h') Object.assign(m.style, { left: `${(a + 0.07) * z}%`, width: `${1.86 * z}%`, top: `${(bb + 1) * z}%`, height: '' });
      else Object.assign(m.style, { top: `${(bb + 0.07) * z}%`, height: `${1.86 * z}%`, left: `${(a + 1) * z}%`, width: '' });
    };
    const mauerEl = (o, a, bb, extra = '') => {
      const m = div(`wd-mauer ${extra}`, ebene);
      m.innerHTML = '<i class="f-o"></i><i class="f-v"></i><i class="f-l"></i><i class="f-r"></i>';
      lege(m, o, a, bb);
      return m;
    };
    const vorschau = mauerEl('h', 0, 0, 'vorschau');
    vorschau.style.display = 'none';

    // Mauer-Vorrat: kleine Mauern auf einer Glasablage vor/hinter dem Brett (PC: links/rechts)
    const ablagen = [0, 1].map((p) => {
      const a = div(`wd-ablage a${p}`, brett);
      return Array.from({ length: R.VORRAT }, () => {
        const m = div('wd-mauer klein', a);
        m.innerHTML = '<i class="f-o"></i><i class="f-v"></i><i class="f-l"></i><i class="f-r"></i>';
        return m;
      });
    });
    const zeigeVorrat = () => ablagen.forEach((liste, p) => liste.forEach((m, i) => m.classList.toggle('weg', i >= s.vorrat[p])));

    // Kreuzungspunkte (nur im Mauer-Modus sichtbar). Jede Tippfläche ist so groß wie ein Feld → man trifft immer.
    const kreuze = [];
    for (let bb = 0; bb < N - 1; bb++) for (let a = 0; a < N - 1; a++) {
      const x0 = a === 0 ? 0 : a + 0.5, x1 = a === N - 2 ? N : a + 1.5;
      const y0 = bb === 0 ? 0 : bb + 0.5, y1 = bb === N - 2 ? N : bb + 1.5;
      const knopf = document.createElement('button');
      knopf.className = 'wd-kreuz';
      knopf.setAttribute('aria-label', `${a + 1}-${bb + 1}`);
      Object.assign(knopf.style, { left: `${(x0 / N) * 100}%`, top: `${(y0 / N) * 100}%`, width: `${((x1 - x0) / N) * 100}%`, height: `${((y1 - y0) / N) * 100}%` });
      knopf.innerHTML = `<i style="left:${((a + 1 - x0) / (x1 - x0)) * 100}%;top:${((bb + 1 - y0) / (y1 - y0)) * 100}%"></i>`;
      knopf.onclick = () => tippKreuz(a, bb);
      punkte.append(knopf);
      kreuze.push(knopf);
    }

    // ——— Knöpfe ———
    const knoepfe = div('leiste wd-leiste', wurzel);
    knoepfe.innerHTML = `<button class="knopf wd-mk" aria-label="Mauer">${ICON.mauer}<b></b></button>
      <button class="knopf wd-dreh" aria-label="Drehen">${ICON.drehen}</button>
      <button class="knopf haupt wd-ok" aria-label="Setzen">${ICON.ok}</button>`;
    const [knopfMauer, knopfDreh, knopfOk] = knoepfe.querySelectorAll('button');

    // ——— Zustand ———
    let s = R.neuesSpiel();
    let sperre = false, aus = false, modus = 'zug', wahl = null;
    let meineZuege = 0, meineMauern = 0;
    const t0 = performance.now();
    const istMensch = () => zwei || s.dran === 0;

    function zeige() {
      leiste.dran(s.dran);
      leiste.wert(0, s.vorrat[0]); leiste.wert(1, s.vorrat[1]);
      zeigeVorrat();
      wurzel.style.setProperty('--c', `var(--${s.dran ? 'zwei' : 'eins'})`);
      const frei = istMensch() && !sperre;
      for (const f of b.liste) f.classList.remove('ziel');
      if (frei && modus === 'zug') for (const z of R.schritte(s, s.dran)) b.feld(z.x, z.y).classList.add('ziel');
      if (modus === 'mauer' && (!frei || s.vorrat[s.dran] === 0)) { modus = 'zug'; wahl = null; }
      wurzel.classList.toggle('mauermodus', modus === 'mauer');
      knopfMauer.classList.toggle('an', modus === 'mauer');
      knopfMauer.disabled = !frei || s.vorrat[s.dran] === 0;
      knopfMauer.querySelector('b').textContent = s.vorrat[zwei ? s.dran : 0];
      kreuze.forEach((kz, i) => kz.classList.toggle('an', !!wahl && wahl.a + wahl.b * (N - 1) === i));
      const zeigen = modus === 'mauer' && !!wahl;
      vorschau.style.display = zeigen ? '' : 'none';
      knopfDreh.disabled = !zeigen;
      knopfOk.disabled = true;
      if (zeigen) {
        lege(vorschau, wahl.o, wahl.a, wahl.b);
        const gut = R.mauerErlaubt(s, wahl.o, wahl.a, wahl.b);
        vorschau.classList.toggle('ungueltig', !gut);
        knopfOk.disabled = !gut;
      }
    }

    b.beiTipp((x, y) => {
      if (sperre || !istMensch() || modus !== 'zug') return;
      const z = R.schritte(s, s.dran).find((q) => q.x === x && q.y === y);
      if (!z) return;
      k.ton.klick();
      fuehreAus(z);
    });

    knopfMauer.onclick = () => {
      if (sperre || !istMensch() || s.vorrat[s.dran] === 0) return;
      k.ton.wahl();
      modus = modus === 'mauer' ? 'zug' : 'mauer';
      wahl = null;
      zeige();
    };
    const andere = (o) => (o === 'h' ? 'v' : 'h');
    function tippKreuz(a, bb) {
      if (sperre || !istMensch() || modus !== 'mauer') return;
      if (wahl && wahl.a === a && wahl.b === bb) wahl.o = andere(wahl.o);
      else {
        let o = wahl ? wahl.o : 'h';
        if (!R.mauerErlaubt(s, o, a, bb) && R.mauerErlaubt(s, andere(o), a, bb)) o = andere(o);
        wahl = { a, b: bb, o };
      }
      k.ton.klick();
      zeige();
    }
    knopfDreh.onclick = () => { if (!wahl) return; k.ton.klick(); wahl.o = andere(wahl.o); zeige(); };
    knopfOk.onclick = () => {
      if (!wahl || sperre) return;
      if (!R.mauerErlaubt(s, wahl.o, wahl.a, wahl.b)) { k.ton.schlecht(); return; }
      fuehreAus({ art: 'mauer', o: wahl.o, a: wahl.a, b: wahl.b });
    };

    async function fuehreAus(z) {
      const wer = s.dran;
      sperre = true; modus = 'zug'; wahl = null;
      if (!zwei && wer === 0) { meineZuege++; if (z.art === 'mauer') meineMauern++; }
      s = R.ziehe(s, z);
      zeige();
      if (z.art === 'zug') {
        stelle(wer, true);
        k.ton.setzen();
        await k.warte(z.sprung ? 640 : 540);
      } else {
        const m = mauerEl(z.o, z.a, z.b, 'neu');
        k.ton.setzen();
        setTimeout(() => k.ton.klick(), 160);
        await k.warte(700);
        m.classList.remove('neu');
      }
      if (aus) return;
      const w = R.sieger(s);
      if (w >= 0) { siegEnde(w); return; }
      sperre = false;
      zeige();
      if (!zwei && s.dran === 1) kiZieht();
    }

    async function kiZieht() {
      sperre = true; zeige();
      const start = performance.now();
      const z = R.kiZug(s, k.nr);
      await k.warte(Math.max(150, 650 + Math.random() * 550 - (performance.now() - start)));
      if (aus) return;
      k.ton.gegner();
      fuehreAus(z);
    }

    async function siegEnde(w) {
      sperre = true; zeige();
      linien[w].classList.add('sieg');
      // Ziellinie leuchtet auf – vom Sieger aus nach außen
      const sx = s.pos[w][0];
      for (let x = 0; x < N; x++) { const f = b.feld(x, R.zielReihe(N, w)); f.style.setProperty('--i', Math.abs(x - sx)); f.classList.add('wd-sieg'); }
      if (zwei || w === 0) k.ton.gut(); else k.ton.schlecht();
      await k.warte(1100);
      if (aus) return;
      const sek = Math.round((performance.now() - t0) / 1000);
      if (zwei) {
        k.ende({ titel: namen[w].toUpperCase(), werte: [['Züge', s.zuege], ['Mauern', 2 * R.VORRAT - s.vorrat[0] - s.vorrat[1]], ['Zeit', `${sek}s`]], verzoegerung: 200 });
        return;
      }
      const sieg = w === 0;
      const rest = R.weg(s, 1);
      const sterne = !sieg ? 0 : rest >= 4 ? 3 : rest >= 2 ? 2 : 1;
      k.ende({
        sieg, sterne, verzoegerung: 200,
        werte: [['Züge', meineZuege], ['Mauern', meineMauern], ['Zeit', `${sek}s`]],
        extra: { mauern: meineMauern, ...(sieg ? { schnell: meineZuege } : {}) },
      });
    }

    stelle(0); stelle(1);
    zeige();
    if (location.search.includes('test')) window.__wd = { get s() { return s; }, R };
    return { weg() { aus = true; sperre = true; ro.disconnect(); b.weg(); } };
  },
});
