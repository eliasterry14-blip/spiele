// CODEBREAKER – Steinplatte mit Mulden, Edelsteine als Farben, Gold-/Silber-Lichter, Tresor-Deckel bricht auf.
import { starteApp } from '../gemeinsam/rahmen.js';
import { ladeKlaenge } from '../gemeinsam/ton.js';
// Kenney-Sounds (CC0): ersetzen die gemeinsamen Klaenge durch passende eigene
ladeKlaenge({ gegner: 'ton/gegner.wav', gut: 'ton/gut.wav', setzen: 'ton/setzen.wav' });
import { STUFEN, bewerte, zufallsCode, sterneFuer, mmss } from './logik.js';

// 9 Edelstein-Farben – jede zusätzlich mit eigenem Zeichen (für Farbschwache)
const SYM = {
  kreis: '<circle cx="12" cy="12" r="4.3"/>',
  dreieck: '<path d="M12 6.6l5.6 9.8H6.4z"/>',
  quadrat: '<rect x="7.9" y="7.9" width="8.2" height="8.2" rx=".8"/>',
  raute: '<path d="M12 6l6 6-6 6-6-6z"/>',
  plus: '<path d="M10.3 6.8h3.4v3.5h3.5v3.4h-3.5v3.5h-3.4v-3.5H6.8v-3.4h3.5z"/>',
  stern: '<path d="M12 5.8l1.9 4 4.4.5-3.3 3 .9 4.3L12 15.4l-3.9 2.2.9-4.3-3.3-3 4.4-.5z"/>',
  sechseck: '<path d="M12 6.2l5 2.9v5.8l-5 2.9-5-2.9V9.1z"/>',
  ring: '<circle cx="12" cy="12" r="3.6" fill="none" stroke-width="2.3"/>',
  kreuz: '<path d="M7.8 9.6l1.8-1.8L12 10.2l2.4-2.4 1.8 1.8-2.4 2.4 2.4 2.4-1.8 1.8L12 13.8l-2.4 2.4-1.8-1.8 2.4-2.4z"/>',
};
const FARBEN = [
  { c: '#e8364f', hell: false, sym: 'kreis' },     // Rubin
  { c: '#ff8a1e', hell: true, sym: 'dreieck' },    // Bernstein
  { c: '#f3da36', hell: true, sym: 'quadrat' },    // Zitrin
  { c: '#25c96c', hell: true, sym: 'raute' },      // Smaragd
  { c: '#3767ff', hell: false, sym: 'plus' },      // Saphir
  { c: '#9d55ff', hell: false, sym: 'stern' },     // Amethyst
  { c: '#22d1e6', hell: true, sym: 'sechseck' },   // Aquamarin
  { c: '#ff5bb5', hell: false, sym: 'ring' },      // Rosa
  { c: '#eef1f6', hell: true, sym: 'kreuz' },      // Perle
];
const gemHtml = (f) => {
  const F = FARBEN[f];
  return `<div class="gem ${F.hell ? 'hell' : ''}" style="--c:${F.c}"><svg viewBox="0 0 24 24">${SYM[F.sym]}</svg></div>`;
};
const gemEl = (f) => { const t = document.createElement('template'); t.innerHTML = gemHtml(f); return t.content.firstElementChild; };
const SCHLOSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';

// Deckel über dem Geheimcode: zackige Risse zwischen den Mulden → 2·L Stücke
function deckelBauen(L, zufall = Math.random) {
  const j = (a) => (zufall() - 0.5) * a;
  const hm = 50 + j(14);
  const risse = [];
  for (let k = 0; k <= L; k++) {
    const x = (k / L) * 100, rand = k === 0 || k === L;
    const mitY = rand ? hm + j(10) : hm + j(18);
    risse.push({
      t: [rand ? x : x + j(10), 0], q1: [rand ? x : x + j(9), mitY * 0.5], m: [rand ? x : x + j(8), mitY],
      q3: [rand ? x : x + j(9), (mitY + 100) / 2], b: [rand ? x : x + j(10), 100],
    });
  }
  const zack = [];
  for (let k = 0; k < L; k++) {
    const a = risse[k].m, b = risse[k + 1].m;
    zack.push([(a[0] + b[0]) / 2 + j(6), (a[1] + b[1]) / 2 + j(16)]);
  }
  const P = (p) => `${p[0].toFixed(1)}% ${p[1].toFixed(1)}%`;
  const stuecke = [];
  for (let k = 0; k < L; k++) {
    const A = risse[k], B = risse[k + 1];
    const oben = [A.t, B.t, B.q1, B.m, zack[k], A.m, A.q1];
    const unten = [A.m, zack[k], B.m, B.q3, B.b, A.b, A.q3];
    for (const [poly, seite] of [[oben, -1], [unten, 1]]) {
      const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
      const dx = (cx - 50) / 50;
      stuecke.push({
        clip: `polygon(${poly.map(P).join(',')})`,
        tx: `${(dx * 70 + j(30)).toFixed(0)}px`, ty: `${(seite * 26 - 30 + j(30)).toFixed(0)}px`, rz: `${(dx * 50 + j(60)).toFixed(0)}deg`,
      });
    }
  }
  const linie = (pkte) => pkte.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const pfade = [linie([risse[0].m, ...risse.slice(1).flatMap((r, k) => [zack[k], r.m])])];
  for (let k = 1; k < L; k++) { const r = risse[k]; pfade.push(linie([r.t, r.q1, r.m, r.q3, r.b])); }
  // Reihenfolge, in der die Risse zu glühen beginnen: waagrecht zuerst, dann von innen nach außen
  const innen = Array.from({ length: L - 1 }, (_, i) => i + 1).sort((a, b) => Math.abs(a - L / 2) - Math.abs(b - L / 2));
  const reihenfolge = [0, ...innen];
  return { stuecke, pfade, reihenfolge };
}

starteApp({
  id: 'codebreaker', name: 'CODEBREAKER', cover: 'code', akzent: '#f0b23c',
  titel: { gross: 'CODEBREAKER', stil: 'weit', y: 0.12 },
  farben: ['#f0b23c', '#cfd6e2'],
  zweiSpieler: true,
  stufen: STUFEN,
  statistik: [
    { key: 'geknackt', name: 'Codes geknackt', art: 'summe' },
    { key: 'besteVersuche', name: 'Wenigste Versuche', art: 'min' },
  ],

  erstelle(buehne, k) {
    const { L, F, V, doppelt } = k.stufe;
    const zwei = k.modus === 'zwei';
    const lk = Math.ceil(L / 2);
    let aus = false;

    const wurzel = document.createElement('div');
    wurzel.className = `cb ${zwei ? 'duell' : ''}`;
    wurzel.style.setProperty('--L', L);
    wurzel.style.setProperty('--lk', lk);
    buehne.append(wurzel);

    let leiste = null;
    if (zwei) { leiste = k.zugleiste(['Spieler 1', 'Spieler 2']); leiste.el.classList.add('cb-zug'); wurzel.append(leiste.el); }

    const deckel = deckelBauen(L);
    const mulden = (n) => Array.from({ length: n }, (_, i) => `<div class="mulde" data-i="${i}"></div>`).join('');
    const lichter = Array.from({ length: L }, () => '<i></i>').join('');
    const reihenHtml = Array.from({ length: V }, (_, r) => `
      <div class="cb-reihe cb-zeile zukunft" data-r="${r}" style="--r:${r}">
        <span class="cb-nr">${String(r + 1).padStart(2, '0')}</span>
        <div class="cb-mulden">${mulden(L)}</div>
        <div class="cb-lichter">${lichter}</div>
      </div>`).join('');

    wurzel.insertAdjacentHTML('beforeend', `
      <div class="cb-platte">
        <div class="cb-stein"></div>
        <svg class="cb-adern" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline class="ader breit" points="0,21 2.6,23.5 1.8,27 4,30.5 3.2,34"/><polyline class="ader" points="0,21 2.6,23.5 1.8,27 4,30.5 3.2,34"/>
          <polyline class="ader breit" points="100,62 97.6,64.5 98.4,68 96.6,71"/><polyline class="ader" points="100,62 97.6,64.5 98.4,68 96.6,71"/>
          <polyline class="ader breit" points="62,0 61,1.2 62.4,2.1"/><polyline class="ader" points="62,0 61,1.2 62.4,2.1"/>
        </svg>
        <div class="cb-tresor cb-zeile ${zwei ? 'offen' : ''}">
          <span class="cb-nr cb-raute"><i></i></span>
          <div class="cb-fach">
            <div class="cb-glut"></div>
            <div class="cb-mulden">${mulden(L)}</div>
            <div class="cb-deckel">
              ${deckel.stuecke.map((s, i) => `<div class="stueck" style="clip-path:${s.clip};-webkit-clip-path:${s.clip};--tx:${s.tx};--ty:${s.ty};--rz:${s.rz};--i:${i}"></div>`).join('')}
              <svg class="cb-risse" viewBox="0 0 100 100" preserveAspectRatio="none">
                ${deckel.pfade.map((p, i) => `<polyline class="schein" data-k="${i}" points="${p}"/><polyline class="riss" data-k="${i}" points="${p}"/>`).join('')}
              </svg>
            </div>
            <div class="cb-blitz"></div>
          </div>
          <span class="cb-gold" aria-hidden="true"></span>
        </div>
        <div class="cb-reihen">${reihenHtml}</div>
      </div>
      <div class="cb-unten">
        <div class="cb-palette">${Array.from({ length: F }, (_, f) => `<button data-f="${f}" aria-label="Farbe ${f + 1}">${gemHtml(f)}</button>`).join('')}</div>
        <button class="knopf haupt cb-pruefen" disabled>PRÜFEN</button>
      </div>`);

    const $ = (s) => wurzel.querySelector(s);
    const platte = $('.cb-platte'), tresor = $('.cb-tresor'), reihenBox = $('.cb-reihen');
    const reihenEl = [...wurzel.querySelectorAll('.cb-reihe')];
    const tresorMulden = [...tresor.querySelectorAll('.mulde')];
    const palette = $('.cb-palette'), knopf = $('.cb-pruefen');
    const paletteKnoepfe = [...palette.querySelectorAll('button')];

    // ——— Größe: alle Reihen passen immer ohne Scrollen ———
    const passen = () => {
      const p = platte.getBoundingClientRect();
      if (!p.width || !p.height) return;
      const breit = document.getElementById('app').classList.contains('breit');
      // Höhe: Tresor ≈ 1.75 s, jede Reihe ≈ s / 0.8; Breite: Nummer + L Mulden + Lichter
      const sH = (p.height - 22) / (V / 0.8 + 1.85);
      const sW = (p.width - 22) / (0.7 + L * 1.2 + lk * 0.4 + 0.75);
      const s = Math.max(18, Math.min(sH, sW, breit ? 60 : 52));
      wurzel.style.setProperty('--s', `${s.toFixed(1)}px`);
    };
    const ro = new ResizeObserver(passen); ro.observe(platte); ro.observe(wurzel);
    requestAnimationFrame(passen);

    // ——— Zustand ———
    let phase = zwei ? 'legen' : 'raten';   // legen (Duell: Spieler 1 legt den Code) · raten · aus
    let code = zwei ? null : zufallsCode(L, F, doppelt);
    let reihe = 0, auswahl = new Array(L).fill(null), besteGold = 0, sperre = zwei;
    let t0 = performance.now();

    const zielMulden = () => (phase === 'legen' ? tresorMulden : [...reihenEl[reihe].querySelectorAll('.mulde')]);

    function aktualisiere() {
      const voll = auswahl.every((x) => x !== null);
      knopf.disabled = !voll || sperre || phase === 'aus';
      paletteKnoepfe.forEach((b, f) => b.classList.toggle('aus', !doppelt && auswahl.includes(f)));
      palette.classList.toggle('gesperrt', sperre || phase === 'aus');
      if (phase === 'raten') k.info(`${reihe + 1}/${V}`); else k.info('');
    }

    function aktiviere(r) {
      reihenEl.forEach((el, i) => {
        el.classList.toggle('aktiv', i === r && phase === 'raten');
        el.classList.toggle('zukunft', i > r || phase !== 'raten');
      });
    }

    function glut() {
      // Risse im Deckel beginnen zu glühen, je mehr Gold-Lichter schon einmal da waren
      deckel.reihenfolge.forEach((k2, i) => tresor.querySelectorAll(`.cb-risse [data-k="${k2}"]`).forEach((p) => p.classList.toggle('an', i < besteGold)));
      tresor.style.setProperty('--glut', (besteGold / L).toFixed(2));
    }

    // ——— Steine setzen / herausnehmen ———
    function fliege(vonEl, zielMulde, gem) {
      const b = buehne.getBoundingClientRect(), a = vonEl.getBoundingClientRect(), z = zielMulde.getBoundingClientRect();
      if (!a.width || !z.width) { gem.classList.add('faellt'); return; }
      const klon = gemEl(+gem.dataset.f);
      klon.classList.add('cb-flug');
      Object.assign(klon.style, { left: `${a.left - b.left}px`, top: `${a.top - b.top}px`, width: `${a.width}px`, height: `${a.height}px` });
      buehne.append(klon);
      const dx = z.left + z.width / 2 - (a.left + a.width / 2), dy = z.top + z.height / 2 - (a.top + a.height / 2);
      const sc = (z.width * 0.86) / a.width;
      gem.style.visibility = 'hidden';
      const anim = klon.animate([
        { transform: 'translate(0,0) scale(1)' },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - Math.min(60, Math.abs(dy) * 0.25 + 18)}px) scale(${Math.max(sc, 1) * 1.12})`, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sc})` },
      ], { duration: 300, easing: 'cubic-bezier(.45,0,.25,1)' });
      anim.onfinish = () => { klon.remove(); gem.style.visibility = ''; if (gem.isConnected) { gem.classList.add('faellt'); zielMulde.classList.remove('staub'); void zielMulde.offsetWidth; zielMulde.classList.add('staub'); } };
    }

    function setze(f, vonEl) {
      if (sperre || phase === 'aus') return;
      if (!doppelt && auswahl.includes(f)) { k.ton.schlecht(); vonEl?.classList.add('wackeln'); setTimeout(() => vonEl?.classList.remove('wackeln'), 380); return; }
      const idx = auswahl.indexOf(null);
      if (idx < 0) { k.ton.schlecht(); return; }
      auswahl[idx] = f;
      const m = zielMulden()[idx];
      m.innerHTML = ''; const gem = gemEl(f); gem.dataset.f = f; m.append(gem);
      k.ton.setzen();
      if (vonEl) fliege(vonEl, m, gem); else gem.classList.add('faellt');
      aktualisiere();
    }

    function nimm(idx) {
      if (sperre || phase === 'aus' || auswahl[idx] === null) return;
      auswahl[idx] = null;
      const m = zielMulden()[idx], gem = m.querySelector('.gem');
      k.ton.klick();
      if (gem) { gem.classList.remove('faellt'); gem.classList.add('hebt'); setTimeout(() => gem.remove(), 200); }
      aktualisiere();
    }

    palette.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); setze(+b.dataset.f, b); } });
    wurzel.addEventListener('click', (e) => {
      const m = e.target.closest('.mulde'); if (!m) return;
      const inZiel = phase === 'legen' ? tresor.contains(m) : reihenEl[reihe]?.contains(m);
      if (inZiel) nimm(+m.dataset.i);
    });

    // ——— PRÜFEN ———
    async function pruefen() {
      if (sperre || auswahl.includes(null)) return;
      if (phase === 'legen') return versiegeln();
      sperre = true; aktualisiere();
      const versuch = auswahl.slice();
      const e = bewerte(code, versuch);
      const zeile = reihenEl[reihe];
      zeile.classList.remove('aktiv'); zeile.classList.add('geprueft');
      k.ton.klick();
      const li = [...zeile.querySelectorAll('.cb-lichter i')];
      const arten = [...Array(e.gold).fill('gold'), ...Array(e.silber).fill('silber')];
      for (let i = 0; i < arten.length; i++) {
        await k.warte(i === 0 ? 220 : 170); if (aus) return;
        li[i].classList.add(arten[i]);
        if (arten[i] === 'gold') k.ton.wahl(); else k.ton.klick();
      }
      if (!arten.length) { await k.warte(260); if (aus) return; zeile.classList.add('dunkel'); k.ton.gegner(); }
      if (e.gold > besteGold) { besteGold = e.gold; glut(); }
      const benutzt = reihe + 1;
      await k.warte(260); if (aus) return;
      if (e.gold === L) return geknackt(benutzt);
      if (benutzt >= V) return verloren(benutzt);
      reihe++; auswahl = new Array(L).fill(null);
      sperre = false; aktiviere(reihe); aktualisiere();
    }
    knopf.addEventListener('click', pruefen);

    // ——— Ausgang ———
    const zeigeCode = () => code.forEach((f, i) => { tresorMulden[i].innerHTML = ''; tresorMulden[i].append(gemEl(f)); });
    const sekunden = () => Math.round((performance.now() - t0) / 1000);

    async function geknackt(benutzt) {
      phase = 'aus'; aktualisiere(); aktiviere(-1);
      reihenEl[benutzt - 1].classList.add('treffer');
      zeigeCode();
      besteGold = L; glut();
      tresor.classList.add('bricht');
      k.ton.gut();
      await k.warte(1500); if (aus) return;
      const sek = sekunden();
      if (zwei) k.ende({ titel: 'SPIELER 2', werte: [['Versuche', `${benutzt}/${V}`], ['Zeit', mmss(sek)]], verzoegerung: 300 });
      else k.ende({ sieg: true, sterne: sterneFuer(benutzt, V), werte: [['Versuche', `${benutzt}/${V}`], ['Zeit', mmss(sek)]], extra: { geknackt: 1, besteVersuche: benutzt }, verzoegerung: 300 });
    }

    async function verloren(benutzt) {
      phase = 'aus'; aktualisiere(); aktiviere(-1);
      zeigeCode();
      tresor.classList.add('zerfaellt');
      k.ton.schlecht();
      await k.warte(1900); if (aus) return;
      const sek = sekunden();
      const werte = [['Versuche', `${benutzt}/${V}`], ['Zeit', mmss(sek)], ['Gold', `${besteGold}/${L}`]];
      if (zwei) k.ende({ titel: 'SPIELER 1', werte, verzoegerung: 300 });
      else k.ende({ sieg: false, werte, verzoegerung: 300 });
    }

    // ——— Duell: Spieler 1 legt den Code geheim ———
    async function versiegeln() {
      sperre = true; aktualisiere();
      code = auswahl.slice();
      tresor.classList.remove('offen', 'legen');
      k.ton.setzen();
      await k.warte(900); if (aus) return;
      tresorMulden.forEach((m) => { m.innerHTML = ''; });
      await k.weitergeben('Spieler 2', 'var(--zwei)'); if (aus) return;
      phase = 'raten'; leiste.dran(1);
      auswahl = new Array(L).fill(null); reihe = 0;
      knopf.textContent = 'PRÜFEN';
      sperre = false; t0 = performance.now();
      aktiviere(0); aktualisiere();
    }

    async function duellStart() {
      leiste.dran(0);
      await k.weitergeben('Spieler 1', 'var(--eins)'); if (aus) return;
      tresor.classList.add('legen');
      knopf.innerHTML = `${SCHLOSS} FERTIG`;
      sperre = false; aktiviere(-1); aktualisiere();
    }

    // ——— Tastatur (PC): 1–9 = Farbe, Rücktaste = letzten Stein raus, Enter = prüfen ———
    const taste = (e) => {
      if (aus || document.getElementById('weiter')?.classList.contains('an')) return;
      if (/^[1-9]$/.test(e.key) && +e.key <= F) setze(+e.key - 1, paletteKnoepfe[+e.key - 1]);
      else if (e.key === 'Backspace') { e.preventDefault(); for (let i = L - 1; i >= 0; i--) if (auswahl[i] !== null) { nimm(i); break; } }
      else if (e.key === 'Enter') { e.preventDefault(); pruefen(); }
    };
    addEventListener('keydown', taste);

    glut();
    if (zwei) { aktiviere(-1); aktualisiere(); duellStart(); }
    else { aktiviere(0); aktualisiere(); }

    return { weg() { aus = true; ro.disconnect(); removeEventListener('keydown', taste); } };
  },
});
