// NIM – Streichhölzer auf dem dunklen 3D-Brett. Wer das letzte nehmen muss, verliert.
import { starteApp } from '../gemeinsam/rahmen.js';
import { baueBrett } from '../gemeinsam/brett.js';
import { kiZug, gewinnstellung, summe } from './logik.js';
import { ladeKlaenge } from '../gemeinsam/ton.js';

// Kenney-Sounds (CC0): Streichholz anreißen + abbrennen
ladeKlaenge({ zisch: 'ton/zisch.wav', brennen: 'ton/brennen.wav' });

const HOLZ = `<svg viewBox="0 0 24 130"><defs>
  <linearGradient id="hz" x1="0" x2="1"><stop offset="0" stop-color="#6b4320"/><stop offset=".45" stop-color="#e8c38c"/><stop offset="1" stop-color="#7a4f26"/></linearGradient>
  <radialGradient id="kp" cx=".38" cy=".35"><stop offset="0" stop-color="#d9583a"/><stop offset=".6" stop-color="#8e1f12"/><stop offset="1" stop-color="#3a0905"/></radialGradient>
  <radialGradient id="fl" cx=".5" cy=".75" r=".6"><stop offset="0" stop-color="#fff6d8"/><stop offset=".35" stop-color="#ffc35a"/><stop offset=".75" stop-color="#ff6a1a"/><stop offset="1" stop-color="#ff3d00" stop-opacity="0"/></radialGradient></defs>
  <g class="flamme"><path d="M12 -26 C20 -12 21 -2 12 6 C3 -2 4 -12 12 -26 Z" fill="url(#fl)"/></g>
  <rect x="9.5" y="20" width="5" height="108" rx="1.5" fill="url(#hz)"/>
  <ellipse cx="12" cy="16" rx="7" ry="10" fill="url(#kp)"/>
  <ellipse cx="9.5" cy="12" rx="2" ry="3" fill="#fff" opacity=".25"/></svg>`;

starteApp({
  id: 'nim', name: 'NIM', cover: 'nim', akzent: '#ff7a1a',
  titel: { gross: 'NIM', stil: 'weit', y: 0.44 },
  farben: ['#ff9a3c', '#ffd27a'],
  zweiSpieler: true,
  stufen: [
    { name: 'Funke', reihen: [1, 3, 5], staerke: 0.15, werte: ['3 Reihen', '9 Hölzer', 'KI 15 %'] },
    { name: 'Glut', reihen: [2, 3, 5], staerke: 0.4, werte: ['3 Reihen', '10 Hölzer', 'KI 40 %'] },
    { name: 'Flamme', reihen: [1, 3, 5, 7], staerke: 0.6, werte: ['4 Reihen', '16 Hölzer', 'KI 60 %'] },
    { name: 'Feuer', reihen: [2, 4, 5, 7], staerke: 0.78, werte: ['4 Reihen', '18 Hölzer', 'KI 78 %'] },
    { name: 'Brand', reihen: [3, 4, 5, 6, 7], staerke: 0.9, werte: ['5 Reihen', '25 Hölzer', 'KI 90 %'] },
    { name: 'Inferno', reihen: [2, 4, 6, 8, 9], staerke: 1, werte: ['5 Reihen', '29 Hölzer', 'KI perfekt'] },
  ],
  statistik: [{ key: 'perfekt', name: 'Fehlerfreie Siege', art: 'summe' }, { key: 'hoelzer', name: 'Hölzer verbrannt', art: 'summe' }],

  erstelle(buehne, k) {
    const reihen = k.stufe.reihen.slice();
    const max = Math.max(...reihen);
    const zwei = k.modus === 'zwei';
    const namen = zwei ? ['Spieler 1', 'Spieler 2'] : ['Du', 'KI'];
    const leiste = k.zugleiste(namen);
    buehne.append(leiste.el);

    const b = baueBrett(buehne, {
      spalten: max, zeilen: reihen.length, kipp: 38, hoch: 1.9,
      muster: (x, y) => (x < reihen[y] ? 'bahn' : 'aus'),
      marken: [{ seite: 'links', text: `${summe(reihen)} H`, oben: '20%' }, { seite: 'rechts', text: `S${k.nr}`, oben: '70%' }],
    });
    b.brett.classList.add('nim-brett');
    const licht = document.createElement('div'); licht.className = 'nim-licht'; b.brett.append(licht);

    // Hölzer setzen
    const hoelzer = reihen.map((n, y) => Array.from({ length: n }, (_, x) => {
      const h = document.createElement('div'); h.className = 'figur holz'; h.innerHTML = HOLZ;
      h.style.animationDelay = `${(y * 4 + x) * 35}ms`;
      b.feld(x, y).append(h); return h;
    }));

    const knopf = document.createElement('div'); knopf.className = 'leiste';
    knopf.innerHTML = '<button class="knopf haupt" disabled>NEHMEN</button>';
    buehne.append(knopf);
    const nehmen = knopf.querySelector('button');

    let dran = 0, wahl = null, sperre = false, fehler = 0, zuege = 0, verbrannt = 0;
    const t0 = performance.now();

    const zeigeStand = () => {
      leiste.dran(dran); leiste.wert(0, ''); leiste.wert(1, '');
      k.info(`${summe(reihen)}`);
      hoelzer.forEach((r, y) => r.forEach((h, x) => h.classList.toggle('an', !!wahl && wahl.reihe === y && x >= wahl.ab && x < reihen[y])));
      nehmen.disabled = !wahl || sperre;
    };

    b.beiTipp((x, y) => {
      if (sperre || (!zwei && dran === 1)) return;
      if (x >= reihen[y]) { wahl = null; zeigeStand(); return; }
      if (wahl && wahl.reihe === y && wahl.ab === x) { wahl = null; k.ton.klick(); }
      else { wahl = { reihe: y, ab: x }; k.ton.spiele('zisch', { laut: 0.6 }) || k.ton.klick(); }
      zeigeStand();
    });

    async function ziehe(reihe, anzahl, wer) {
      sperre = true; nehmen.disabled = true;
      const vorher = reihen.slice();
      // Fehler zählen: Du warst in einer Gewinnstellung und hast sie verspielt
      if (!zwei && wer === 0 && gewinnstellung(vorher)) {
        const nach = vorher.slice(); nach[reihe] -= anzahl;
        if (gewinnstellung(nach)) fehler++;
      }
      const ab = reihen[reihe] - anzahl;
      const weg = hoelzer[reihe].slice(ab, reihen[reihe]);
      weg.forEach((h) => h.classList.add('an'));
      if (wer === 1 && !zwei) k.ton.spiele('zisch', { laut: 0.5 });
      await k.warte(wer === 1 && !zwei ? 650 : 180);
      k.ton.spiele('brennen', { laut: 0.7, tempo: 0.8 }) || k.ton.setzen();
      weg.forEach((h, i) => { h.style.animationDelay = `${i * 70}ms`; h.classList.add('brennt'); });
      reihen[reihe] = ab; wahl = null; zuege++; if (wer === 0) verbrannt += anzahl;
      await k.warte(500 + weg.length * 70);
      weg.forEach((h) => h.remove());
      hoelzer[reihe].length = ab;

      if (summe(reihen) === 0) {
        // wer das letzte genommen hat, verliert
        const verlierer = wer;
        const sek = Math.round((performance.now() - t0) / 1000);
        const werte = [['Züge', zuege], ['Zeit', `${sek}s`]];
        if (zwei) k.ende({ titel: `${namen[1 - verlierer].toUpperCase()}`, werte, verzoegerung: 400 });
        else {
          const sieg = verlierer === 1;
          const sterne = sieg ? (fehler === 0 ? 3 : fehler === 1 ? 2 : 1) : 0;
          k.ende({ sieg, sterne, werte: [...werte, ['Fehler', fehler]], extra: { perfekt: sieg && fehler === 0 ? 1 : 0, hoelzer: verbrannt }, verzoegerung: 400 });
        }
        return;
      }
      dran = 1 - dran; sperre = false; zeigeStand();
      if (!zwei && dran === 1) {
        await k.warte(700 + Math.random() * 600);
        const z = kiZug(reihen, k.stufe.staerke);
        k.ton.gegner();
        ziehe(z.reihe, z.anzahl, 1);
      }
    }

    nehmen.onclick = () => { if (!wahl || sperre) return; ziehe(wahl.reihe, reihen[wahl.reihe] - wahl.ab, dran); };
    zeigeStand();
    return { weg: () => { b.weg(); sperre = true; } };
  },
});
