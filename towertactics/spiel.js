// TOWER TACTICS – Kristall-Türme beherrschen Reihe und Spalte. Wer mehr Felder hält, gewinnt.
import { starteApp } from '../gemeinsam/rahmen.js';
import { ladeKlaenge } from '../gemeinsam/ton.js';
// Kenney-Sounds (CC0): ersetzen die gemeinsamen Klaenge durch passende eigene
ladeKlaenge({ gegner: 'ton/gegner.wav', klick: 'ton/klick.wav', setzen: 'ton/setzen.wav' });
import { baueBrett } from '../gemeinsam/brett.js';
import * as L from './logik.js';

const FARBEN = ['#f2b04e', '#9a8cff'];
// Kristall-Farben je Spieler: Körper (dunkel → hell), Spitze (links, mitte, rechts), Glühen
const KRISTALL = [
  { k: ['#1e1209', '#4a2e16', '#a8743c'], s: ['#9a6428', '#ffd88a', '#c4852f'], g: '#ffc35a' },
  { k: ['#130f24', '#2e2658', '#7a6cd6'], s: ['#5a4bb0', '#e2daff', '#8476e8'], g: '#b8acff' },
];
let nr = 0;
function kristallSvg(p) {
  const c = KRISTALL[p], id = `tk${++nr}`;
  return `<svg viewBox="0 0 100 160"><defs>
    <linearGradient id="${id}a" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c.k[0]}"/><stop offset=".75" stop-color="${c.k[1]}"/><stop offset="1" stop-color="${c.k[2]}"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c.k[1]}"/><stop offset=".55" stop-color="${c.k[2]}"/><stop offset="1" stop-color="${c.s[1]}"/></linearGradient>
    <linearGradient id="${id}c" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c.k[0]}"/><stop offset="1" stop-color="${c.k[1]}"/></linearGradient>
    <radialGradient id="${id}g"><stop offset="0" stop-color="${c.g}" stop-opacity=".95"/><stop offset=".35" stop-color="${c.g}" stop-opacity=".35"/><stop offset="1" stop-color="${c.g}" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="50" cy="151" rx="36" ry="8" fill="${c.g}" opacity=".35"/>
    <path d="M24 146 L24 64 L40 56 L40 153 Z" fill="url(#${id}a)"/>
    <path d="M40 153 L40 56 L61 56 L61 153 Z" fill="url(#${id}b)"/>
    <path d="M61 153 L61 56 L76 64 L76 146 Z" fill="url(#${id}c)"/>
    <path d="M24 64 L40 56 L50 9 Z" fill="${c.s[0]}"/>
    <path d="M40 56 L61 56 L50 9 Z" fill="${c.s[1]}"/>
    <path d="M61 56 L76 64 L50 9 Z" fill="${c.s[2]}"/>
    <path d="M40 56 L40 153 M61 56 L61 153" stroke="#fff" stroke-opacity=".16" stroke-width="1"/>
    <path d="M24 64 L50 9 L76 64" fill="none" stroke="${c.g}" stroke-opacity=".8" stroke-width="1.2"/>
    <path d="M46 140 L47 74 M55 122 L57 70 M31 132 L33 84" stroke="#fff" stroke-opacity=".14" stroke-width="1.2" stroke-linecap="round"/>
    <circle class="tt-glut" cx="50" cy="22" r="22" fill="url(#${id}g)"/></svg>`;
}

const div = (cls, eltern) => { const d = document.createElement('div'); d.className = cls; eltern?.append(d); return d; };

starteApp({
  id: 'towertactics', name: 'TOWER TACTICS', cover: 'turm', akzent: '#e8a24c',
  titel: { gross: 'TOWER', klein: 'TACTICS', stil: 'weit', y: 0.6 },
  farben: FARBEN,
  zweiSpieler: true,
  stufen: [
    { name: 'Quarz', n: 5, werte: ['5 × 5', 'KI 15 %'] },
    { name: 'Bernstein', n: 5, werte: ['5 × 5', 'KI 35 %'] },
    { name: 'Topas', n: 6, werte: ['6 × 6', 'KI 50 %'] },
    { name: 'Citrin', n: 6, werte: ['6 × 6', 'KI 65 %'] },
    { name: 'Onyx', n: 7, werte: ['7 × 7', 'KI 80 %'] },
    { name: 'Alchemie', n: 7, werte: ['7 × 7', 'KI 95 %'] },
  ],
  statistik: [
    { key: 'tuerme', name: 'Türme gesetzt', art: 'summe' },
    { key: 'vorsprung', name: 'Größter Vorsprung', art: 'max', format: (v) => `+${v}` },
  ],

  erstelle(buehne, k) {
    const n = k.stufe.n;
    const zwei = k.modus === 'zwei';
    const namen = zwei ? ['Spieler 1', 'Spieler 2'] : ['Du', 'KI'];
    const wurzel = div(`tt n${n}`, buehne);
    const leiste = k.zugleiste(namen);
    wurzel.append(leiste.el);

    // ——— Brett ———
    const b = baueBrett(wurzel, { spalten: n, zeilen: n, kipp: 32, muster: (x, y) => ((x + y) % 2 ? 'tt-a' : 'tt-b') });
    const brett = b.brett;
    brett.classList.add('tt-brett');
    // Die Einflug-Animation hält opacity/transform fest – das macht alles 3D flach. Danach weg damit.
    const echt3d = () => brett.classList.remove('rein');
    brett.addEventListener('animationend', (e) => { if (e.target === brett) echt3d(); });
    setTimeout(echt3d, 1300);
    div('tt-licht', brett);
    const strahlEbene = div('tt-strahlen', brett);
    const ro = new ResizeObserver(() => brett.style.setProperty('--z', `${brett.offsetWidth / n}px`));
    ro.observe(brett);

    // Macht-Balken: Anteil Gold · neutral/frei · Violett
    const waage = div('tt-waage', wurzel);
    waage.innerHTML = '<i class="w0"></i><i class="wn"></i><i class="w1"></i>';
    const [w0, wn, w1] = waage.children;

    const knoepfe = div('leiste tt-leiste', wurzel);
    knoepfe.innerHTML = '<button class="knopf haupt" disabled>SETZEN</button>';
    const knopf = knoepfe.querySelector('button');

    // ——— Zustand ———
    let s = L.neuesSpiel(n);
    let sperre = false, aus = false, wahl = -1;
    let geist = null;
    const tuerme = new Array(n * n).fill(null);
    const t0 = performance.now();
    const istMensch = () => zwei || s.dran === 0;

    function zeige() {
      const h = L.herrschaft(s.feld, n);
      const [a, bb] = L.punkte(s.feld, n, h);
      const frei = istMensch() && !sperre;
      let leer = 0;
      b.liste.forEach((f, i) => {
        const w = L.besitzer(s.feld, h, i);
        f.classList.toggle('b0', w === 0);
        f.classList.toggle('b1', w === 1);
        f.classList.toggle('neutral', w === 2);
        f.classList.toggle('turm', !!s.feld[i]);
        f.classList.toggle('zu', frei && !s.feld[i] && !L.darf(s.feld, h, s.dran, i));
        f.classList.toggle('wahl', i === wahl);
        if (!s.feld[i]) leer++;
      });
      leiste.dran(s.dran);
      leiste.wert(0, a); leiste.wert(1, bb);
      k.info(`${leer}`);
      w0.style.flexGrow = a; w1.style.flexGrow = bb; wn.style.flexGrow = n * n - a - bb;
      waage.classList.toggle('vorne0', a > bb); waage.classList.toggle('vorne1', bb > a);
      wurzel.style.setProperty('--c', `var(--${s.dran ? 'zwei' : 'eins'})`);
      knopf.disabled = !frei || wahl < 0;
    }

    // ——— Lichtstrahlen entlang Reihe/Spalte bis zum Blocker ———
    function strahlen(i, wer, vorschau) {
      const x = i % n, y = (i / n) | 0, r = L.strahlen(s.feld, n, i);
      const z = 100 / n, out = [];
      for (const [richt, len] of Object.entries(r)) {
        if (!len) continue;
        const st = div(`tt-strahl ${richt} p${wer}${vorschau ? ' vor' : ''}`, strahlEbene);
        const l = (len + 0.5) * z;
        if (richt === 'r') Object.assign(st.style, { left: `${(x + 0.5) * z}%`, top: `${(y + 0.5) * z}%`, width: `${l}%` });
        if (richt === 'l') Object.assign(st.style, { left: `${(x - len) * z}%`, top: `${(y + 0.5) * z}%`, width: `${l}%` });
        if (richt === 'u') Object.assign(st.style, { top: `${(y + 0.5) * z}%`, left: `${(x + 0.5) * z}%`, height: `${l}%` });
        if (richt === 'o') Object.assign(st.style, { top: `${(y - len) * z}%`, left: `${(x + 0.5) * z}%`, height: `${l}%` });
        st.style.setProperty('--dauer', `${120 + len * 70}ms`);
        out.push(st);
      }
      return out;
    }

    function zeigeWahl() {
      geist?.remove(); geist = null;
      strahlEbene.querySelectorAll('.vor').forEach((e) => e.remove());
      if (wahl < 0) return;
      geist = div('figur tt-turm geist');
      geist.innerHTML = kristallSvg(s.dran);
      b.liste[wahl].append(geist);
      strahlen(wahl, s.dran, true);
    }

    b.beiTipp((x, y, f) => {
      if (sperre || !istMensch()) return;
      const i = y * n + x;
      const h = L.herrschaft(s.feld, n);
      if (!L.darf(s.feld, h, s.dran, i)) {
        if (!s.feld[i]) { k.ton.schlecht(); f.classList.remove('wackeln'); void f.offsetWidth; f.classList.add('wackeln'); }
        return;
      }
      if (wahl === i) { setzen(i); return; }
      k.ton.klick();
      wahl = i; zeigeWahl(); zeige();
    });
    knopf.onclick = () => { if (wahl >= 0 && !sperre) setzen(wahl); };

    async function setzen(i) {
      const wer = s.dran;
      sperre = true; wahl = -1; zeigeWahl();
      const x = i % n, y = (i / n) | 0;
      // Kristall fällt aufs Brett
      const t = div('figur tt-turm neu');
      t.innerHTML = kristallSvg(wer);
      b.liste[i].append(t);
      tuerme[i] = t;
      s = L.setze(s, i);
      zeige();
      // Felder färben sich der Reihe nach, wie vom Licht getroffen
      b.liste.forEach((f, j) => {
        const fx = j % n, fy = (j / n) | 0;
        f.style.setProperty('--d', fx === x || fy === y ? `${380 + (Math.abs(fx - x) + Math.abs(fy - y)) * 70}ms` : '380ms');
      });
      setTimeout(() => k.ton.setzen(), 330);
      await k.warte(380);
      if (aus) return;
      const strahl = strahlen(i, wer, false);
      t.classList.remove('neu');
      await k.warte(900);
      strahl.forEach((e) => e.remove());
      b.liste.forEach((f) => f.style.setProperty('--d', '0ms'));
      if (aus) return;
      const nx = L.naechster(s);
      s = nx.s;
      const voll = s.feld.every((v) => v);
      for (const p of voll ? [] : nx.aus) {
        k.toast(`${namen[p].toUpperCase()} SETZT AUS`);
        k.ton.schlecht();
        await k.warte(1100);
        if (aus) return;
      }
      if (nx.ende) { ende(); return; }
      sperre = false;
      zeige();
      if (!zwei && s.dran === 1) kiZieht();
    }

    async function kiZieht() {
      sperre = true; zeige();
      const start = performance.now();
      const i = L.kiZug(s, k.nr);
      await k.warte(Math.max(150, 650 + Math.random() * 550 - (performance.now() - start)));
      if (aus || i < 0) return;
      k.ton.gegner();
      setzen(i);
    }

    async function ende() {
      sperre = true; zeige();
      const [a, bb] = L.punkte(s.feld, n);
      const w = a === bb ? -1 : a > bb ? 0 : 1;
      if (w >= 0) {
        tuerme.forEach((t, i) => { if (t && s.feld[i] === w + 1) { t.style.setProperty('--i', (i % n) + ((i / n) | 0)); t.classList.add('sieg'); } });
        if (zwei || w === 0) k.ton.gut();
      }
      await k.warte(1400);
      if (aus) return;
      const sek = Math.round((performance.now() - t0) / 1000);
      const werte = [['Felder', `${a} : ${bb}`], ['Vorsprung', `${a === bb ? 0 : '+' + Math.abs(a - bb)}`], ['Zeit', `${sek}s`]];
      if (zwei) { k.ende({ titel: w < 0 ? 'REMIS' : namen[w].toUpperCase(), werte, verzoegerung: 200 }); return; }
      const sieg = w < 0 ? null : w === 0;
      const rel = (a - bb) / (n * n);
      const sterne = sieg ? (rel >= 0.2 ? 3 : rel >= 0.08 ? 2 : 1) : 0;
      const meine = s.feld.reduce((z, v) => z + (v === 1 ? 1 : 0), 0);
      k.ende({ sieg, sterne, werte, verzoegerung: 200, extra: { tuerme: meine, ...(sieg ? { vorsprung: a - bb } : {}) } });
    }

    zeige();
    if (location.search.includes('test')) window.__tt = { get s() { return s; }, get sperre() { return sperre; }, L };
    return { weg() { aus = true; sperre = true; ro.disconnect(); b.weg(); } };
  },
});
