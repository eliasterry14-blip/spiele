// SHARDS – Glasformen auf dem 10×10-Brett. Jeder neue Stein berührt einen eigenen nur an einer Ecke.
// Steine fliegen aus Splittern zusammen und rasten mit einem Lichtblitz ein.
import { starteApp } from '../gemeinsam/rahmen.js';
import { ladeKlaenge } from '../gemeinsam/ton.js';
// Kenney-Sounds (CC0): ersetzen die gemeinsamen Klaenge durch passende eigene
ladeKlaenge({ gegner: 'ton/gegner.wav', setzen: 'ton/setzen.wav', wahl: 'ton/wahl.wav' });
import { baueBrett } from '../gemeinsam/brett.js';
import { N, START, FORMEN, ANZAHL, lage, neuesSpiel, ecken, felderVon, gueltig, lege, weiter, punkte, kiZug } from './logik.js';

const STUFEN = ['Splitter', 'Scherbe', 'Prisma', 'Facette', 'Kristall', 'Spektrum']
  .map((name, i) => ({ name, ki: i + 1, werte: ['10 × 10', '12 Formen', `KI ${'◆'.repeat(i + 1)}`] }));

const ICON = {
  drehen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.6 4.2v4.6H15"/></svg>',
  spiegeln: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5v19" stroke-dasharray="2 2.6"/><path d="M9 6.5L3.5 17.5H9z"/><path d="M15 6.5l5.5 11H15z"/></svg>',
};

const neu = (klasse, eltern, html) => { const d = document.createElement('div'); d.className = klasse; if (html) d.innerHTML = html; if (eltern) eltern.append(d); return d; };
const zufall = (a, b) => a + Math.random() * (b - a);

// kleine Vorschau einer Form für die Form-Leiste
function formSvg(z) {
  const w = Math.max(...z.map((c) => c[0])) + 1, h = Math.max(...z.map((c) => c[1])) + 1;
  const g = 10, m = Math.max(w, h) * g;
  const ox = (m - w * g) / 2, oy = (m - h * g) / 2;
  const zellen = z.map(([x, y]) => `<rect x="${ox + x * g + .6}" y="${oy + y * g + .6}" width="${g - 1.2}" height="${g - 1.2}"/><path d="M${ox + x * g + .6} ${oy + y * g + g - .6}L${ox + x * g + g - .6} ${oy + y * g + .6}"/>`).join('');
  return `<svg viewBox="-1 -1 ${m + 2} ${m + 2}">${zellen}</svg>`;
}

starteApp({
  id: 'shards', name: 'SHARDS', cover: 'scherben', akzent: '#7cc8ff',
  titel: { gross: 'SHARDS', stil: 'weit', y: 0.8 },
  zweiSpieler: true,
  stufen: STUFEN,
  statistik: [
    { key: 'felder', name: 'Felder belegt', art: 'summe' },
    { key: 'rekord', name: 'Höchste Punktzahl', art: 'max' },
    { key: 'alle', name: 'Alle 12 gelegt', art: 'summe' },
  ],

  erstelle(buehne, k) {
    const zwei = k.modus === 'zwei';
    const namen = zwei ? ['Spieler 1', 'Spieler 2'] : ['Du', 'KI'];
    const maus = !location.search.includes('touch') && matchMedia('(hover: hover) and (pointer: fine)').matches;
    buehne.classList.add('sh-buehne');

    const leiste = k.zugleiste(namen);
    leiste.el.classList.add('sh-zug');
    const bo = baueBrett(buehne, { spalten: N, zeilen: N, kipp: 24, muster: (x, y) => ((x + y) % 2 ? 'sh-a' : '') });
    const brett = bo.brett;
    brett.classList.add('sh-brett');
    // Einflug-Animation (mit opacity) macht das Brett flach, solange sie anliegt → danach entfernen
    brett.addEventListener('animationend', (e) => { if (e.target === brett) brett.classList.remove('rein'); });
    setTimeout(() => brett.classList.remove('rein'), 1200);
    const ro = new ResizeObserver(() => { if (brett.offsetWidth) brett.style.setProperty('--k', `${brett.offsetWidth / N}px`); });
    ro.observe(brett);

    const seite = neu('sh-seite', buehne);
    seite.append(leiste.el);
    const ablage = neu('sh-ablage', seite);
    const knoepfe = neu('leiste sh-knoepfe', seite,
      `<button class="knopf sh-icon" data-a="drehen" aria-label="Drehen">${ICON.drehen}</button>`
      + `<button class="knopf sh-icon" data-a="spiegeln" aria-label="Spiegeln">${ICON.spiegeln}</button>`
      + '<button class="knopf haupt sh-setzen" data-a="setzen" disabled>SETZEN</button>');
    const kn = Object.fromEntries([...knoepfe.querySelectorAll('button')].map((b) => [b.dataset.a, b]));

    // Startecken markieren
    const startMarke = START.map((i, p) => neu(`sh-start p${p}`, bo.liste[i]));

    const s = neuesSpiel();
    let wahlF = 0, dreh = 0, spiegel = false, ziel = -1, vorschau = null;
    let sperre = false, aus = false, zuege = 0;
    const geister = [];
    const t0 = performance.now();
    const mensch = () => zwei || s.dran === 0;

    // ——— Form-Leiste ———
    function zeichneAblage() {
      const p = s.dran;
      ablage.className = `sh-ablage p${p}`;
      ablage.innerHTML = '';
      FORMEN.forEach((f, i) => {
        if (!s.uebrig[p][i]) return;
        const b = document.createElement('button');
        b.className = `sh-form ${i === wahlF ? 'an' : ''}`;
        b.dataset.f = i;
        b.innerHTML = formSvg(i === wahlF ? lage(f.zellen, dreh, spiegel) : f.zellen);
        ablage.append(b);
      });
    }
    ablage.addEventListener('click', (e) => {
      const b = e.target.closest('.sh-form');
      if (!b || sperre || !mensch()) return;
      const f = +b.dataset.f;
      if (f === wahlF) return;
      wahlF = f; dreh = 0; spiegel = false;
      k.ton.wahl();
      zeichneAblage(); berechne(); zeige();
    });

    // ——— Vorschau ———
    function berechne() {
      vorschau = null;
      if (wahlF < 0 || ziel < 0 || !s.uebrig[s.dran][wahlF]) return;
      const z = lage(FORMEN[wahlF].zellen, dreh, spiegel);
      const tx = ziel % N, ty = (ziel / N) | 0;
      const mx = z.reduce((a, c) => a + c[0], 0) / z.length, my = z.reduce((a, c) => a + c[1], 0) / z.length;
      const reihe = z.slice().sort((a, b) => ((a[0] - mx) ** 2 + (a[1] - my) ** 2) - ((b[0] - mx) ** 2 + (b[1] - my) ** 2));
      let erste = null;
      for (const c of reihe) {
        const fe = felderVon(z, tx - c[0], ty - c[1]);
        if (!fe) continue;
        if (!erste) erste = fe;
        if (gueltig(s, s.dran, fe)) { vorschau = { felder: fe, ok: true }; return; }
      }
      // Fingertipp knapp daneben: gültige Lage, die höchstens ein Feld vom Tipp entfernt ist
      let best = null, bd = Infinity;
      for (let ay = -4; ay < N; ay++) for (let ax = -4; ax < N; ax++) {
        const fe = felderVon(z, ax, ay);
        if (!fe || !gueltig(s, s.dran, fe)) continue;
        let nah = Infinity, sx = 0, sy = 0;
        for (const i of fe) { const x = i % N, y = (i / N) | 0; nah = Math.min(nah, Math.max(Math.abs(x - tx), Math.abs(y - ty))); sx += x; sy += y; }
        if (nah > 1) continue;
        const d = nah * 100 + (sx / fe.length - tx) ** 2 + (sy / fe.length - ty) ** 2;
        if (d < bd) { bd = d; best = fe; }
      }
      if (best) { vorschau = { felder: best, ok: true }; return; }
      if (!erste) {
        const w = Math.max(...z.map((c) => c[0])) + 1, h = Math.max(...z.map((c) => c[1])) + 1;
        const ax = Math.min(Math.max(tx - reihe[0][0], 0), N - w), ay = Math.min(Math.max(ty - reihe[0][1], 0), N - h);
        erste = felderVon(z, ax, ay);
      }
      vorschau = { felder: erste, ok: false };
    }

    function nachbarn(felder) {
      const set = new Set(felder);
      return (i) => {
        const x = i % N, y = (i / N) | 0;
        return { n: y > 0 && set.has(i - N), s: y < N - 1 && set.has(i + N), w: x > 0 && set.has(i - 1), o: x < N - 1 && set.has(i + 1) };
      };
    }
    const verbKlassen = (v) => ['n', 's', 'w', 'o'].filter((d) => v[d]).map((d) => `v${d}`).join(' ');

    function zeigeGeist(felder, ok, wer) {
      for (const g of geister) g.remove();
      geister.length = 0;
      if (!felder) return;
      const nb = nachbarn(felder);
      for (const i of felder) {
        const g = neu(`sh-geist p${wer} ${ok ? 'ok' : 'nein'} ${verbKlassen(nb(i))}`, bo.liste[i]);
        geister.push(g);
      }
    }

    // ——— Glasstein auf das Brett (fliegt aus Splittern zusammen) ———
    function zeichneStein(felder, wer) {
      const nb = nachbarn(felder);
      const mitte = felder.reduce((a, i) => [a[0] + (i % N), a[1] + ((i / N) | 0)], [0, 0]).map((v) => v / felder.length);
      felder.forEach((i, n) => {
        const v = nb(i);
        const z = neu(`sh-zelle neu p${wer} ${verbKlassen(v)}`, bo.liste[i]);
        z.style.setProperty('--d', `${n * 55}ms`);
        z.style.setProperty('--x', i % N); z.style.setProperty('--y', (i / N) | 0);
        let h = '';
        // Seitenwände nur außen (die Nordseite ist aus diesem Blickwinkel nie zu sehen)
        if (!v.s) h += '<i class="sv"></i>';
        if (!v.w) h += '<i class="sw"></i>';
        if (!v.o) h += '<i class="so"></i>';
        z.innerHTML = `${h}<i class="deckel"><b class="t1"></b><b class="t2"></b><b class="kante"></b></i>`;
        // Splitter starten verstreut – weg von der Mitte des Steins, hoch über dem Brett
        const x = i % N, y = (i / N) | 0;
        z.querySelectorAll('.t1, .t2').forEach((t) => {
          const ax = (x - mitte[0]) || zufall(-.5, .5), ay = (y - mitte[1]) || zufall(-.5, .5);
          t.style.setProperty('--dx', `calc(var(--k) * ${(ax * zufall(1.2, 2.4) + zufall(-1, 1)).toFixed(2)})`);
          t.style.setProperty('--dy', `calc(var(--k) * ${(ay * zufall(1.2, 2.4) + zufall(-1, 1)).toFixed(2)})`);
          t.style.setProperty('--dz', `calc(var(--k) * ${zufall(2.2, 4.2).toFixed(2)})`);
          t.style.setProperty('--r', `${zufall(-160, 160).toFixed(0)}deg`);
          t.style.setProperty('--rx', `${zufall(-70, 70).toFixed(0)}deg`);
        });
        setTimeout(() => z.classList.remove('neu'), 1600 + n * 55);
      });
    }

    function markiereEcken() {
      bo.liste.forEach((f) => f.classList.remove('sh-e'));
      if (sperre || s.ende || !mensch()) return;
      for (const i of ecken(s, s.dran)) bo.liste[i].classList.add('sh-e');
    }

    function zeige() {
      leiste.dran(s.ende ? -1 : s.dran);
      leiste.wert(0, `${punkte(s, 0)}`); leiste.wert(1, `${punkte(s, 1)}`);
      brett.classList.toggle('dran0', s.dran === 0); brett.classList.toggle('dran1', s.dran === 1);
      const frei = !sperre && !s.ende && mensch();
      buehne.classList.toggle('gesperrt', !frei);
      kn.drehen.disabled = !frei; kn.spiegeln.disabled = !frei;
      kn.setzen.disabled = !(frei && vorschau && vorschau.ok);
      startMarke.forEach((m, p) => m.classList.toggle('weg', s.gelegt[p] > 0));
      if (frei) zeigeGeist(vorschau?.felder, vorschau?.ok, s.dran);
      markiereEcken();
    }

    function ersteFreieForm() {
      const p = s.dran;
      if (wahlF >= 0 && s.uebrig[p][wahlF]) return wahlF;
      return s.uebrig[p].findIndex((x) => x);
    }

    // ——— Zug ausführen ———
    async function setze(f, felder, wer) {
      sperre = true;
      zeigeGeist(null);
      lege(s, wer, f, felder);
      zuege++;
      zeichneStein(felder, wer);
      k.ton.wahl();
      ziel = -1; vorschau = null;
      zeige();
      if (!zwei && wer === 0 || zwei) zeichneAblage();
      await k.warte(620 + felder.length * 55);
      if (aus) return;
      k.ton.setzen();
      await k.warte(420);
      if (aus) return;
      const pass = weiter(s);
      if (s.ende) { fertig(); return; }
      if (pass >= 0 && s.gelegt[pass] < ANZAHL) { k.toast(`${namen[pass].toUpperCase()} SETZT AUS`); k.ton.schlecht(); }
      wahlF = -1; dreh = 0; spiegel = false;
      wahlF = ersteFreieForm();
      if (mensch()) zeichneAblage();
      sperre = false;
      zeige();
    }

    async function kiLauf() {
      while (!aus && !zwei && !s.ende && s.dran === 1) {
        sperre = true; zeige();
        await k.warte(650 + Math.random() * 500);
        if (aus) return;
        const m = kiZug(s, k.stufe.ki);
        if (!m) break;
        zeigeGeist(m.felder, true, 1);
        await k.warte(420);
        if (aus) return;
        k.ton.gegner();
        await setze(m.f, m.felder, 1);
      }
    }

    async function spielerSetzt() {
      if (sperre || !vorschau || !vorschau.ok || !mensch()) return;
      await setze(wahlF, vorschau.felder, s.dran);
      if (!aus && !zwei) kiLauf();
    }

    // ——— Eingaben ———
    bo.beiTipp((x, y) => {
      if (sperre || s.ende || !mensch()) return;
      const i = y * N + x;
      if (maus && i === ziel && vorschau?.ok) { spielerSetzt(); return; }
      ziel = i; berechne();
      if (maus && vorschau?.ok) { spielerSetzt(); return; }
      if (maus && vorschau && !vorschau.ok) k.ton.schlecht(); else k.ton.klick();
      zeige();
    });
    if (maus) {
      bo.felder.addEventListener('pointerover', (e) => {
        const f = e.target.closest('.feld');
        if (!f || sperre || s.ende || !mensch()) return;
        const i = +f.dataset.y * N + +f.dataset.x;
        if (i === ziel) return;
        ziel = i; berechne(); zeige();
      });
      bo.felder.addEventListener('pointerleave', () => { if (sperre) return; ziel = -1; vorschau = null; zeige(); });
      bo.felder.addEventListener('contextmenu', (e) => { e.preventDefault(); drehe(); });
    }
    function drehe() { if (sperre || !mensch()) return; dreh = (dreh + 1) % 4; k.ton.klick(); zeichneAblage(); berechne(); zeige(); }
    function spiegle() { if (sperre || !mensch()) return; spiegel = !spiegel; k.ton.klick(); zeichneAblage(); berechne(); zeige(); }
    kn.drehen.onclick = drehe;
    kn.spiegeln.onclick = spiegle;
    kn.setzen.onclick = spielerSetzt;
    const taste = (e) => {
      if (aus) return;
      const t = e.key.toLowerCase();
      if (t === 'r') drehe(); else if (t === 'f' || t === 's') spiegle(); else if (t === 'enter' || t === ' ') { e.preventDefault(); spielerSetzt(); }
    };
    addEventListener('keydown', taste);

    function fertig() {
      sperre = true;
      zeigeGeist(null);
      const a = punkte(s, 0), b = punkte(s, 1);
      const sieger = a > b ? 0 : b > a ? 1 : -1;
      if (sieger >= 0) brett.classList.add(`sieg-p${sieger}`);
      zeige();
      const sek = Math.round((performance.now() - t0) / 1000);
      if (zwei) {
        k.ende({ titel: sieger < 0 ? 'REMIS' : namen[sieger].toUpperCase(), werte: [['Punkte', `${a} : ${b}`], ['Steine', `${s.gelegt[0]} : ${s.gelegt[1]}`], ['Zeit', `${sek}s`]], verzoegerung: 1500 });
        return;
      }
      const sieg = a > b ? true : a < b ? false : null;
      const sterne = sieg ? (s.gelegt[0] === ANZAHL || a - b >= 10 ? 3 : a - b >= 5 ? 2 : 1) : 0;
      k.ende({
        sieg, sterne, verzoegerung: 1500,
        werte: [['Punkte', `${a} : ${b}`], ['Steine', `${s.gelegt[0]} / ${ANZAHL}`], ['Zeit', `${sek}s`]],
        extra: { felder: s.felder[0], rekord: a, alle: s.gelegt[0] === ANZAHL ? 1 : 0 },
      });
    }

    zeichneAblage();
    zeige();
    // nur für meine Tests (?test): Stand ansehen und Züge machen
    if (location.search.includes('test')) {
      window.__sh = { s, kiZug, frei: () => !sperre && !s.ende && mensch(),
        zug: (m) => { if (sperre || aus || !mensch()) return; wahlF = m.f; vorschau = { felder: m.felder, ok: true }; spielerSetzt(); },
        tippe: (i) => { const f = bo.liste[i]; f.click(); }, drehe, spiegle };
    }
    return { weg() { aus = true; ro.disconnect(); bo.weg(); removeEventListener('keydown', taste); } };
  },
});
