// GRID WARS – Punkte-Raster auf dem gekippten Neon-Brett.
// Linien ziehen; wer ein Kästchen schließt, lässt dort einen leuchtenden Würfel wachsen und ist nochmal dran.
import { starteApp } from '../gemeinsam/rahmen.js';
import { ladeKlaenge } from '../gemeinsam/ton.js';
// Kenney-Sounds (CC0): ersetzen die gemeinsamen Klaenge durch passende eigene
ladeKlaenge({ gegner: 'ton/gegner.wav', gut: 'ton/gut.wav', setzen: 'ton/setzen.wav' });
import { baueBrett } from '../gemeinsam/brett.js';
import { neuesSpiel, ziehe, istEnde, kiZug } from './logik.js';

const STUFEN = [
  { name: 'Würfel', b: 3, h: 3, ki: 1 },
  { name: 'Gitter', b: 4, h: 4, ki: 2 },
  { name: 'Matrix', b: 4, h: 5, ki: 3 },
  { name: 'Raster', b: 5, h: 5, ki: 4 },
  { name: 'Kubus', b: 5, h: 6, ki: 5 },
  { name: 'Tesserakt', b: 6, h: 6, ki: 6 },
].map((s) => ({ ...s, werte: [`${s.b} × ${s.h}`, `${s.b * s.h} Kästchen`, `KI ${'◆'.repeat(s.ki)}`] }));

// Quader-Seiten: links, rechts, vorne, oben (die Rückseite ist aus diesem Blickwinkel nie zu sehen)
const QUADER = '<i class="l"></i><i class="r"></i><i class="v"></i><i class="o"></i>';
const neu = (klasse, eltern) => { const d = document.createElement('div'); d.className = klasse; if (eltern) eltern.append(d); return d; };
const prozent = (wert) => `${wert * 100}%`;

starteApp({
  id: 'gridwars', name: 'GRID WARS', cover: 'raster', akzent: '#d6e4ff',
  titel: { gross: 'GRID WARS', stil: 'block', y: 0.85 },
  farben: ['#2fe3c2', '#ff4fa3'],
  zweiSpieler: true,
  stufen: STUFEN,
  statistik: [
    { key: 'kaestchen', name: 'Kästchen erobert', art: 'summe' },
    { key: 'kette', name: 'Längste Kette', art: 'max' },
  ],

  erstelle(buehne, k) {
    const { b: B, h: H } = k.stufe;
    const zwei = k.modus === 'zwei';
    const namen = zwei ? ['Spieler 1', 'Spieler 2'] : ['Du', 'KI'];
    // Touch: erst antippen (Vorschau), dann bestätigen. Maus: Klick zieht sofort.
    const touch = location.search.includes('touch') || !matchMedia('(hover: hover) and (pointer: fine)').matches;
    buehne.classList.add('gw-buehne');

    const leiste = k.zugleiste(namen);
    leiste.el.classList.add('gw-zug');
    buehne.append(leiste.el);

    const bo = baueBrett(buehne, { spalten: B, zeilen: H, kipp: 34, muster: (x, y) => ((x + y) % 2 ? 'gw-a' : 'gw-b') });
    const brett = bo.brett;
    brett.classList.add('gw-brett');
    // Die Einflug-Animation des Bretts (mit opacity) macht in Chromium/WebKit alles darauf flach,
    // solange sie anliegt → nach dem Einflug entfernen, damit Würfel und Pfosten echt 3D sind.
    brett.addEventListener('animationend', (e) => { if (e.target === brett) brett.classList.remove('rein'); });
    setTimeout(() => brett.classList.remove('rein'), 1200);
    // Kästchen-Größe in Pixeln (für 3D-Höhen der Würfel und Pfosten)
    const ro = new ResizeObserver(() => { if (brett.offsetWidth) brett.style.setProperty('--k', `${brett.offsetWidth / B}px`); });
    ro.observe(brett);

    const s = neuesSpiel(B, H), g = s.g;
    const netz = neu('gw-netz', brett);

    // Linien (sichtbar) + große Tipp-Zonen (Rauten, die das ganze Brett lückenlos abdecken)
    const linEl = [];
    for (let l = 0; l < g.n; l++) {
      const { waag, x, y } = g.lage[l];
      const li = neu(`gw-linie ${waag ? 'w' : 's'}`, netz);
      li.style.left = prozent(x / B); li.style.top = prozent(y / H);
      if (waag) li.style.width = prozent(1 / B); else li.style.height = prozent(1 / H);
      linEl.push(li);
    }
    for (let l = 0; l < g.n; l++) {
      const { waag, x, y } = g.lage[l];
      const zo = neu('gw-zone', netz);
      zo.dataset.l = l;
      zo.style.left = prozent((x + (waag ? 0.5 : 0)) / B);
      zo.style.top = prozent((y + (waag ? 0 : 0.5)) / H);
    }
    // Pfosten an jedem Punkt
    const pfosten = [];
    for (let y = 0; y <= H; y++) for (let x = 0; x <= B; x++) {
      const p = neu('gw-pfosten gw-quader', netz);
      p.style.left = prozent(x / B); p.style.top = prozent(y / H);
      p.style.animationDelay = `${300 + (x + y) * 45}ms`;
      p.innerHTML = QUADER;
      pfosten.push(p);
    }
    const pfostenVon = (l) => {
      const { waag, x, y } = g.lage[l];
      return [pfosten[y * (B + 1) + x], pfosten[(y + (waag ? 0 : 1)) * (B + 1) + x + (waag ? 1 : 0)]];
    };

    let knopf = null;
    if (touch) {
      const lst = neu('leiste gw-leiste', buehne);
      lst.innerHTML = '<button class="knopf haupt" disabled>ZIEHEN</button>';
      knopf = lst.querySelector('button');
    }

    let wahl = -1, schwebt = -1, sperre = false, aus = false, letzte = null;
    let lauf = 0, besteSerie = 0, zuege = 0;
    const t0 = performance.now();

    function zeige() {
      const menschDran = !sperre && !istEnde(s) && (zwei || s.dran === 0);
      leiste.dran(istEnde(s) ? -1 : s.dran);
      leiste.wert(0, `${s.punkte[0]}`); leiste.wert(1, `${s.punkte[1]}`);
      k.info(`${B * H - s.punkte[0] - s.punkte[1]}`);
      netz.classList.toggle('dran0', s.dran === 0); netz.classList.toggle('dran1', s.dran === 1);
      netz.classList.toggle('frei', menschDran);
      linEl.forEach((li, l) => {
        li.classList.toggle('wahl', l === wahl && menschDran);
        li.classList.toggle('schwebt', l === schwebt && menschDran && !s.linien[l]);
      });
      if (knopf) knopf.disabled = !(menschDran && wahl >= 0);
    }

    function erobere(b, wer) {
      const f = bo.liste[b];
      f.classList.add('gw-erobert', `p${wer}`);
      const w = neu(`gw-wuerfel gw-quader p${wer}`, f);
      w.innerHTML = QUADER;
      const plus = neu(`gw-plus p${wer}`, f);
      plus.textContent = '+1';
      setTimeout(() => plus.remove(), 1100);
    }

    async function zug(l) {
      sperre = true; wahl = -1; schwebt = -1;
      const wer = s.dran;
      const zu = ziehe(s, l);
      zuege++;
      const li = linEl[l];
      li.classList.remove('ki-ziel');
      li.classList.add('an', `p${wer}`);
      letzte?.classList.remove('neu');
      li.classList.add('neu'); letzte = li;
      for (const p of pfostenVon(l)) { p.classList.remove('p0', 'p1', 'blitz'); void p.offsetWidth; p.classList.add(`p${wer}`, 'blitz'); }
      k.ton.setzen();
      zeige();
      if (zu.length) {
        lauf += zu.length;
        if (zwei || wer === 0) besteSerie = Math.max(besteSerie, lauf);
        await k.warte(170);
        zu.forEach((b, i) => setTimeout(() => { if (!aus) erobere(b, wer); }, i * 150));
        k.ton.gut();
        await k.warte(330 + zu.length * 150);
      } else {
        lauf = 0;
        await k.warte(220);
      }
      if (aus) return;
      zeige();
      if (istEnde(s)) { fertig(); return; }
      sperre = false;
      zeige();
    }

    async function kiLauf() {
      let erster = true;
      while (!aus && !zwei && !istEnde(s) && s.dran === 1) {
        sperre = true; zeige();
        await k.warte(erster ? 650 + Math.random() * 550 : 200);
        if (aus) return;
        const l = kiZug(s, k.stufe.ki);
        linEl[l].classList.add('ki-ziel');
        await k.warte(erster ? 300 : 110);
        if (aus) return;
        k.ton.gegner();
        await zug(l);
        erster = false;
      }
      if (!aus && !istEnde(s)) { sperre = false; zeige(); }
    }

    async function spielerZug(l) {
      await zug(l);
      if (!aus && !zwei && s.dran === 1) kiLauf();
    }

    function tippe(l) {
      if (sperre || aus || istEnde(s) || (!zwei && s.dran === 1)) return;
      if (s.linien[l]) { wahl = -1; zeige(); return; }
      if (touch && wahl !== l) { wahl = l; k.ton.klick(); zeige(); return; }
      spielerZug(l);
    }

    netz.addEventListener('click', (e) => { const z = e.target.closest('.gw-zone'); if (z) tippe(+z.dataset.l); });
    if (!touch) {
      netz.addEventListener('pointerover', (e) => { const z = e.target.closest('.gw-zone'); const l = z ? +z.dataset.l : -1; if (l !== schwebt) { schwebt = l; zeige(); } });
      netz.addEventListener('pointerleave', () => { schwebt = -1; zeige(); });
    }
    if (knopf) knopf.onclick = () => { if (wahl >= 0) tippe(wahl); };

    function fertig() {
      sperre = true;
      const [a, b] = s.punkte;
      const sieger = a > b ? 0 : b > a ? 1 : -1;
      if (sieger >= 0) brett.classList.add(`sieg-p${sieger}`);
      letzte?.classList.remove('neu');
      zeige();
      const sek = Math.round((performance.now() - t0) / 1000);
      if (zwei) {
        k.ende({ titel: sieger < 0 ? 'REMIS' : namen[sieger].toUpperCase(), werte: [['Kästchen', `${a} : ${b}`], ['Züge', zuege], ['Zeit', `${sek}s`]], verzoegerung: 1500 });
        return;
      }
      const sieg = a > b ? true : a < b ? false : null;
      const vor = (a - b) / (B * H);
      const sterne = sieg ? (vor >= 0.3 ? 3 : vor >= 0.12 ? 2 : 1) : 0;
      k.ende({
        sieg, sterne, verzoegerung: 1500,
        werte: [['Kästchen', `${a} : ${b}`], ['Vorsprung', `${a - b > 0 ? '+' : ''}${a - b}`], ['Zeit', `${sek}s`]],
        extra: { kaestchen: a, kette: besteSerie },
      });
    }

    zeige();
    // nur für meine Tests (?test): Stand ansehen und „menschliche“ Züge machen
    if (location.search.includes('test')) window.__gw = { s, tippe, kiZug, frei: () => !sperre && (zwei || s.dran === 0) };
    return { weg() { aus = true; ro.disconnect(); bo.weg(); } };
  },
});
