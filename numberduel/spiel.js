// NUMBER DUEL – Bietduell in reiner Schwarz-Weiß-Typografie (Spalten, Haarlinien, große dünne Zahlen)
import { starteApp } from '../gemeinsam/rahmen.js';
import { ladeKlaenge } from '../gemeinsam/ton.js';
// Kenney-Sounds (CC0): ersetzen die gemeinsamen Klaenge durch passende eigene
ladeKlaenge({ gegner: 'ton/gegner.wav', gut: 'ton/gut.wav', setzen: 'ton/setzen.wav', wahl: 'ton/wahl.wav' });
import { neuesSpiel, spieleRunde, kiWahl, ergebnis, vorbei, preis, topfWert, KARTEN } from './logik.js';

const FARBEN = ['#ffffff', '#ff3d7f'];
const zahlHtml = (n) => `<span class="zahl"><span class="o">${n}</span><span class="u">${n}</span></span>`;
const RAUTE = '<svg viewBox="0 0 10 10"><path d="M5 0L10 5L5 10L0 5Z"/></svg>';

starteApp({
  id: 'numberduel', name: 'NUMBER DUEL', cover: 'duell', akzent: '#f2f2f2',
  titel: { stil: 'spalten', oben: 'RICH', unten: 'RISK', klein: 'NUMBER DUEL', y: 0.45 },
  farben: FARBEN,
  zweiSpieler: true,
  stufen: [
    { name: 'Bluff', werte: ['KI blind', '9 Runden'] },
    { name: 'Einsatz', werte: ['Gebot ≈ Preis', '9 Runden'] },
    { name: 'Risiko', werte: ['Merkt Karten', 'Rang'] },
    { name: 'Reichtum', werte: ['Spart Hohe', 'Wirft Kleine'] },
    { name: 'Tresor', werte: ['Liest Gebote', 'Knapp drüber'] },
    { name: 'All-in', werte: ['Rechnet voraus', 'Gemischt'] },
  ],
  statistik: [
    { key: 'vorsprung', name: 'Größter Vorsprung', art: 'max' },
    { key: 'preise', name: 'Gewonnene Preise', art: 'summe' },
  ],

  erstelle(buehne, k) {
    const zwei = k.modus === 'zwei';
    const namen = zwei ? ['Spieler 1', 'Spieler 2'] : ['Du', 'KI'];
    const st = neuesSpiel();
    let aus = false;

    const root = document.createElement('div');
    root.className = 'nd';
    root.innerHTML = `
      <div class="nd-linien"></div>
      <div class="nd-seite-wert" data-s="0"><small></small><div class="nd-sz"></div></div>
      <div class="nd-seite-wert" data-s="1"><small></small><div class="nd-sz"></div></div>
      <div class="nd-reihe nd-oben"></div>
      <div class="nd-tisch">
        <div class="nd-platz" data-s="0"><i>${RAUTE}</i></div>
        <div class="nd-preis"><div class="nd-topf"></div><div class="nd-pkarte"></div><div class="nd-summe"></div></div>
        <div class="nd-platz" data-s="1"><i>${RAUTE}</i></div>
      </div>
      <div class="nd-reihe nd-preise"></div>
      <div class="nd-hand"></div>
      <div class="leiste"><button class="knopf haupt nd-setzen" disabled>SETZEN</button></div>`;
    const leiste = k.zugleiste(namen);
    root.insertBefore(leiste.el, root.querySelector('.nd-oben'));
    buehne.append(root);
    leiste.wert(0, '0'); leiste.wert(1, '0');

    const $ = (s) => root.querySelector(s);
    const oben = $('.nd-oben'), hand = $('.nd-hand'), preise = $('.nd-preise'), setzen = $('.nd-setzen');
    const pkarte = $('.nd-pkarte'), topfEl = $('.nd-topf'), summeEl = $('.nd-summe'), preisEl = $('.nd-preis');
    const plaetze = [$('.nd-platz[data-s="0"]'), $('.nd-platz[data-s="1"]')];
    plaetze.forEach((p, i) => p.style.setProperty('--c', FARBEN[i]));
    // PC: große Punktzahlen links und rechts, Ziffern in Spalten wie RICH/RISK
    const seiten = [...root.querySelectorAll('.nd-seite-wert')];
    const seitenWert = (i, v) => { seiten[i].querySelector('.nd-sz').innerHTML = [...String(v)].map((z) => `<span><b class="o">${z}</b><b class="u">${z}</b></span>`).join(''); };
    seiten.forEach((s, i) => { s.style.setProperty('--c', FARBEN[i]); s.querySelector('small').textContent = namen[i].toUpperCase(); seitenWert(i, 0); });

    let picker = -1, unten = 0, ausgewaehlt = null, fertigMit = null;
    let wahl = [null, null], karten = [null, null], gezeigt = [0, 0];

    // ——— Zeichnen ———
    function zeichneOben(sp) {
      oben.style.setProperty('--c', FARBEN[sp]);
      oben.innerHTML = KARTEN.map((c) => `<span class="nd-g ${st.hand[sp].includes(c) ? '' : 'weg'}">${c}</span>`).join('');
    }
    function zeichneHand(sp) {
      hand.style.setProperty('--c', FARBEN[sp]);
      hand.innerHTML = KARTEN.map((c) => {
        const weg = !st.hand[sp].includes(c) || wahl[sp] === c;
        return `<button class="nd-hk ${weg ? 'weg' : ''} ${ausgewaehlt === c && !weg ? 'an' : ''}" data-w="${c}" ${weg ? 'tabindex="-1"' : ''}><b>${c}</b><i></i><s>${RAUTE}</s></button>`;
      }).join('');
      setzen.disabled = picker < 0 || ausgewaehlt === null;
    }
    function zeichnePreise() {
      const gewinner = {};
      for (const e of st.verlauf) if (e.sieger !== null) for (const p of [...e.topf, e.preis]) gewinner[p] = e.sieger;
      const jetzt = vorbei(st) ? null : preis(st);
      preise.innerHTML = KARTEN.map((v) => {
        let cl = '';
        if (v in gewinner) cl = `g${gewinner[v]}`;
        else if (st.topf.includes(v)) cl = vorbei(st) ? 'verfallen' : 'topf';
        else if (v === jetzt) cl = 'jetzt';
        return `<span class="nd-p ${cl}">${v}</span>`;
      }).join('');
    }
    function zeichneTopf() {
      topfEl.innerHTML = st.topf.map((p, i) => `<div class="nd-tk" style="--i:${st.topf.length - 1 - i}"><b>${p}</b></div>`).join('');
      summeEl.innerHTML = st.topf.length ? `<span>Σ</span>${topfWert(st)}` : '';
      summeEl.classList.toggle('an', st.topf.length > 0);
    }
    function zeigePreis() {
      pkarte.innerHTML = `<div class="nd-pinnen">${zahlHtml(preis(st))}</div>`;
      pkarte.classList.remove('rein', 'weg'); pkarte.offsetWidth; pkarte.classList.add('rein');
      zeichneTopf();
    }
    const zaehle = (i, ziel) => {
      const von = gezeigt[i], t0 = performance.now();
      gezeigt[i] = ziel;
      seitenWert(i, ziel); seiten[i].classList.remove('neu'); seiten[i].offsetWidth; seiten[i].classList.add('neu');
      const lauf = () => { if (aus) return; const f = Math.min(1, (performance.now() - t0) / 500); leiste.wert(i, String(Math.round(von + (ziel - von) * f))); if (f < 1) requestAnimationFrame(lauf); };
      lauf();
    };

    // ——— Karte auf den Tisch legen (verdeckt) ———
    function legeKarte(sp, c, quelle) {
      const el = document.createElement('div');
      el.className = 'nd-karte';
      el.style.setProperty('--c', FARBEN[sp]);
      el.innerHTML = `<div class="flip"><div class="nd-seite hinten"><i>${RAUTE}</i></div><div class="nd-seite vorne">${zahlHtml(c)}</div></div>`;
      plaetze[sp].append(el);
      karten[sp] = el;
      if (quelle) {
        const q = quelle.getBoundingClientRect ? quelle.getBoundingClientRect() : quelle, z = el.getBoundingClientRect();
        if (q.width && z.width) {
          const dx = q.left + q.width / 2 - (z.left + z.width / 2), dy = q.top + q.height / 2 - (z.top + z.height / 2);
          el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${q.width / z.width})`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
            { duration: 520, easing: 'cubic-bezier(.2,.85,.25,1)' });
        }
      }
    }

    // ——— Wählen ———
    function waehle(sp) {
      picker = sp; unten = sp; ausgewaehlt = null;
      zeichneOben(1 - sp); zeichneHand(sp);
      hand.classList.remove('zu');
      leiste.dran(sp);
      return new Promise((ok) => { fertigMit = ok; });
    }
    function markiere(c) {
      if (picker < 0 || !st.hand[picker].includes(c) || wahl[picker] === c) return;
      if (ausgewaehlt === c) { bestaetige(); return; }
      ausgewaehlt = c; k.ton.klick(); zeichneHand(picker);
    }
    function bestaetige() {
      if (picker < 0 || ausgewaehlt === null) return;
      const sp = picker, c = ausgewaehlt, knopf = hand.querySelector(`[data-w="${c}"]`);
      picker = -1; ausgewaehlt = null; wahl[sp] = c;
      k.ton.setzen();
      legeKarte(sp, c, knopf);
      zeichneHand(sp); hand.classList.add('zu');
      const ok = fertigMit; fertigMit = null; ok?.(c);
    }
    hand.addEventListener('click', (e) => { const b = e.target.closest('.nd-hk'); if (b) markiere(+b.dataset.w); });
    setzen.onclick = bestaetige;
    const taste = (e) => {
      if (/^[1-9]$/.test(e.key)) markiere(+e.key);
      else if ((e.key === 'Enter' || e.key === ' ') && picker >= 0 && ausgewaehlt !== null) { e.preventDefault(); bestaetige(); }
    };
    addEventListener('keydown', taste);

    // ——— Aufdecken ———
    async function preisFliegt(sieger) {
      const span = leiste.el.children[sieger];
      const r0 = root.getBoundingClientRect(), a = preisEl.getBoundingClientRect(), b = span.getBoundingClientRect();
      const kopie = preisEl.cloneNode(true);
      kopie.classList.add('nd-flug');
      Object.assign(kopie.style, { left: `${a.left - r0.left}px`, top: `${a.top - r0.top}px`, width: `${a.width}px`, height: `${a.height}px`, '--c': FARBEN[sieger] });
      kopie.style.setProperty('--c', FARBEN[sieger]);
      root.append(kopie);
      pkarte.innerHTML = ''; topfEl.innerHTML = ''; summeEl.classList.remove('an');
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const flug = kopie.animate([
        { transform: 'none', opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.15}px, ${dy * 0.1 - 10}px) scale(1.06)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${dx}px, ${dy}px) scale(.12)`, opacity: 0.2, offset: 1 },
      ], { duration: 720, easing: 'cubic-bezier(.5,0,.2,1)' });
      await flug.finished.catch(() => {});
      kopie.remove();
      span.classList.add('nd-blitz'); setTimeout(() => span.classList.remove('nd-blitz'), 700);
    }
    async function inDenTopf() {
      const a = pkarte.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-26%) scale(.55)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
      await a.finished.catch(() => {});
      a.cancel(); pkarte.innerHTML = '';
      zeichneTopf();
    }

    async function aufdecken() {
      const e = spieleRunde(st, wahl[0], wahl[1]);
      leiste.dran(-1);
      karten.forEach((el) => el.classList.add('offen'));
      k.ton.wahl();
      await k.warte(820); if (aus) return;
      zeichneOben(1 - unten); zeichneHand(unten);
      if (e.sieger !== null) {
        karten[e.sieger].classList.add('sieger'); karten[1 - e.sieger].classList.add('verlierer');
        if (zwei || e.sieger === 0) k.ton.gut(); else k.ton.schlecht();
        await k.warte(520); if (aus) return;
        await preisFliegt(e.sieger); if (aus) return;
        zaehle(e.sieger, st.punkte[e.sieger]);
      } else {
        karten.forEach((el) => el.classList.add('gleich'));
        k.ton.gegner();
        if (!vorbei(st)) k.toast('GLEICHSTAND');
        await k.warte(650); if (aus) return;
        if (vorbei(st)) {
          const a = preisEl.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(8px)' }], { duration: 700, fill: 'forwards' });
          await a.finished.catch(() => {});
        } else await inDenTopf();
      }
      zeichnePreise();
      await k.warte(380); if (aus) return;
      karten.forEach((el) => {
        const a = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px)' }], { duration: 360, fill: 'forwards' });
        a.finished.then(() => el.remove()).catch(() => {});
      });
      karten = [null, null];
      await k.warte(380); if (aus) return;
      if (vorbei(st)) fertig(); else runde();
    }

    // ——— Eine Runde ———
    async function runde() {
      if (aus) return;
      wahl = [null, null];
      k.info(`${st.runde + 1}/9`);
      zeichnePreise(); zeigePreis();
      if (!zwei) {
        const kiKarte = kiWahl(st, 1, k.nr);
        const kiLegt = (async () => {
          await k.warte(650 + Math.random() * 650);
          if (aus) return;
          const r = oben.getBoundingClientRect();
          wahl[1] = kiKarte; legeKarte(1, kiKarte, { left: r.left + r.width / 2 - 16, top: r.top, width: 32, height: r.height }); k.ton.gegner();
        })();
        await k.warte(380); if (aus) return;
        await waehle(0); if (aus) return;
        await kiLegt; if (aus) return;
      } else {
        const erster = st.runde % 2;
        await k.warte(380); if (aus) return;
        await waehle(erster); if (aus) return;
        await k.warte(480); if (aus) return;
        await k.weitergeben(namen[1 - erster], FARBEN[1 - erster]); if (aus) return;
        await waehle(1 - erster); if (aus) return;
      }
      await k.warte(420); if (aus) return;
      await aufdecken();
    }

    function fertig() {
      const [p0, p1] = st.punkte, erg = ergebnis(st);
      const gew = [0, 0];
      for (const e of st.verlauf) if (e.sieger !== null) gew[e.sieger] += 1 + e.topf.length;
      if (zwei) {
        k.ende({ titel: erg === null ? 'REMIS' : namen[erg].toUpperCase(), werte: [['Punkte', `${p0} : ${p1}`], ['Preise', `${gew[0]} : ${gew[1]}`]], verzoegerung: 500 });
        return;
      }
      const d = p0 - p1, sieg = erg === 0 ? true : erg === 1 ? false : null;
      k.ende({
        sieg, sterne: d >= 15 ? 3 : d >= 7 ? 2 : 1,
        werte: [['Punkte', `${p0} : ${p1}`], ['Preise', `${gew[0]} / 9`], ['Vorsprung', d > 0 ? `+${d}` : `${d}`]],
        extra: sieg ? { vorsprung: d, preise: gew[0] } : { preise: gew[0] },
        verzoegerung: 500,
      });
    }

    zeichneOben(1); zeichneHand(0); zeichnePreise();
    runde();
    // für meine Tests
    if (location.search.includes('test')) window.__nd = { st, markiere, bestaetige, get wahl() { return wahl; } };
    return { weg() { aus = true; removeEventListener('keydown', taste); } };
  },
});
