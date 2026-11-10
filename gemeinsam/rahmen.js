// ═══════════════════════════════════════════════════════════════════
// RAHMEN – alles, was die 10 Spiele gemeinsam haben:
// Start-Animation → Menü (schräge Streifen) → Stufen (Gold) → Rangliste/Statistik (Signal) → Spiel → Ende
// Ein Spiel ruft nur starteApp({...}) auf und liefert sein Spielbrett über erstelle().
// ═══════════════════════════════════════════════════════════════════
import { Cover } from './cover.js';
import { ton, wecken, setzeTon } from './ton.js';

// ——— Linien-Icons ———
const I = {
  zurueck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  zu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  tonAn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/></svg>',
  tonAus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M17 10l4 4M21 10l-4 4"/></svg>',
  schloss: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
  stern: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z"/></svg>',
  schild: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M12 7v10M8.5 10.5h7"/></svg>',
};

const zahl = (n) => Math.round(n).toLocaleString('de-DE');
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// ——— Speicher (pro Spiel eigener Schlüssel) ———
function lade(def) {
  const leer = { frei: 1, gewaehlt: 1, punkte: 0, sterne: {}, ton: true,
    stat: { spiele: 0, siege: 0, niederlagen: 0, remis: 0, serie: 0, besteSerie: 0, duelle: 0, zeit: 0 } };
  try {
    const d = JSON.parse(localStorage.getItem(`spiele.${def.id}.v1`));
    if (d) return { ...leer, ...d, stat: { ...leer.stat, ...d.stat } };
  } catch {}
  return leer;
}

// Bots der Rangliste – feste Namen, Werte passend zum Spiel
const BOTS = ['Kaito', 'Mira', 'Jonas', 'Lea', 'Viktor', 'Sena', 'Noah', 'Theo', 'Ava'];
const BOT_PUNKTE = [14800, 9900, 7200, 5100, 3600, 2400, 1500, 800, 300];
const BOT_SIEGE = [96, 71, 52, 39, 27, 19, 12, 6, 2];

export function starteApp(def) {
  const app = document.getElementById('app');
  const wurzel = document.documentElement.style;
  wurzel.setProperty('--akzent', def.akzent);
  if (def.farben) { wurzel.setProperty('--eins', def.farben[0]); wurzel.setProperty('--zwei', def.farben[1]); }
  document.title = def.name;

  const d = lade(def);
  const speichern = () => { try { localStorage.setItem(`spiele.${def.id}.v1`, JSON.stringify(d)); } catch {} };
  setzeTon(d.ton);

  // ——— Gerüst ———
  const titelHtml = (fuer) => {
    const t = def.titel;
    if (t.stil === 'spalten') {
      const n = Math.max(t.oben.length, t.unten.length);
      let sp = '';
      for (let i = 0; i < n; i++) {
        const a = t.oben[i] || '', b = t.unten[i] || '';
        sp += a === b ? `<div class="sp" style="--i:${i}"><b class="ganz" style="--i:${i}">${a}</b></div>`
          : `<div class="sp" style="--i:${i}"><b class="oben">${a}</b><b class="unten">${b}</b></div>`;
      }
      return `<div class="titel spalten-titel" data-fuer="${fuer}"><div class="spalten">${sp}</div><span class="klein">${t.klein || ''}</span></div>`;
    }
    const buchst = [...t.gross].map((c, i) => c === ' ' ? '<span style="--i:' + i + '">&nbsp;</span>' : `<span style="--i:${i}">${c}</span>`).join('');
    return `<div class="titel ${t.stil === 'block' ? 'block' : ''}" data-fuer="${fuer}" style="--n:${Math.max(4, t.gross.length)}"><span class="gross">${buchst}</span>${t.klein ? `<span class="klein">${t.klein}</span>` : ''}</div>`;
  };

  const punkte = [
    { nr: '01', wort: 'Spielen', ziel: 'spielen' },
    ...(def.zweiSpieler ? [{ nr: '02', wort: 'Duell', klein: '2 Spieler', ziel: 'duell' }] : []),
    { wort: 'Stufen', ziel: 's-stufen' },
    { wort: 'Rangliste', ziel: 's-rang' },
    { wort: 'Statistik', ziel: 's-stat' },
  ].map((p, i) => ({ ...p, nr: String(i + 1).padStart(2, '0') }));

  app.innerHTML = `
    <canvas id="cover"></canvas>
    <div id="intro">${titelHtml('intro')}</div>

    <section class="seite" id="s-menue">
      <div class="m-kopf">
        <div class="rang"><span class="raute" id="m-stufe"></span><div><small>STUFE</small><br><b id="m-punkte"></b></div></div>
        <button class="rund" id="m-ton" aria-label="Ton"></button>
      </div>
      <div class="m-titelplatz">${titelHtml('menue')}</div>
      <nav class="streifen" id="m-streifen">
        ${punkte.map((p, i) => `<button style="--i:${i}" data-ziel="${p.ziel}"><span class="inhalt"><span class="nr">${p.nr}</span><span class="wort">${p.wort.toUpperCase()}${p.klein ? `<small>${p.klein.toUpperCase()}</small>` : ''}</span></span></button>`).join('')}
      </nav>
    </section>

    <section class="seite" id="s-stufen">
      <div class="g-kopf"><button class="rund" data-zurueck aria-label="Zurück">${I.zurueck}</button><div class="g-titel"><span>Stufen</span></div><div class="g-wert" id="st-punkte"></div></div>
      <div class="st-feld">
        <svg class="st-ringe" viewBox="0 0 600 200"><circle class="r2" cx="300" cy="100" r="96"/><circle class="r1" cx="300" cy="100" r="84"/><circle class="r3" cx="300" cy="100" r="70"/></svg>
        <svg class="st-karte" viewBox="0 0 400 400" id="st-karte"></svg>
      </div>
      <div class="st-panel">
        <div class="st-zeile"><div class="st-code" id="st-code"></div><div class="st-name"><b id="st-name"></b><div class="sterne" id="st-sterne"></div></div><div class="st-schild">${I.schild}</div></div>
        <div class="st-werte" id="st-werte"></div>
        <div class="st-zeile st-lohn"><div><small>BELOHNUNG</small><div class="rauten" id="st-rauten"></div></div><button class="g-start" id="st-start">START</button></div>
      </div>
    </section>

    <section class="seite signal" id="s-rang">
      <div class="s-kopf"><button class="rund" data-zurueck aria-label="Zurück">${I.zurueck}</button><h1>Rangliste</h1></div>
      <div class="s-panel scroll" id="r-panel"></div>
    </section>

    <section class="seite signal" id="s-stat">
      <div class="s-kopf"><button class="rund" data-zurueck aria-label="Zurück">${I.zurueck}</button><h1>Statistik</h1></div>
      <div class="s-panel scroll" id="t-panel"></div>
    </section>

    <section class="seite" id="s-spiel">
      <div class="sp-kopf"><button class="rund" id="sp-weg" aria-label="Verlassen">${I.zu}</button><div class="sp-mitte"><b>${def.name}</b><small id="sp-stufe"></small></div><div class="sp-info" id="sp-info"></div></div>
      <div class="buehne" id="buehne"></div>
      <div class="weiter" id="weiter"><i></i><b id="weiter-name"></b><button class="g-start" id="weiter-los">BEREIT</button></div>
      <div class="ende" id="ende">
        <div class="e-titel" id="e-titel"></div>
        <div class="e-linie"></div>
        <div class="e-sterne" id="e-sterne"></div>
        <div class="e-plus" id="e-plus"></div>
        <div class="e-werte" id="e-werte"></div>
        <div class="e-neu" id="e-neu"></div>
        <div class="e-knoepfe" id="e-knoepfe"></div>
      </div>
    </section>
    <div class="toast" id="toast"></div>`;

  const $ = (s) => app.querySelector(s);
  const cover = new Cover($('#cover'), def.cover);
  cover.start();

  // Am PC (eigener Starter, Adresse spiele://) zeigt das Spiel Elias' echtes Cover-Bild.
  // Diese Bilder liegen nur auf seinem PC und kommen nie ins öffentliche Online-Projekt.
  if (location.protocol === 'spiele:') {
    const bild = new Image();
    bild.id = 'coverbild'; bild.alt = '';
    bild.onload = () => {
      app.prepend(bild); cover.stop(); cover.start = () => {}; $('#cover').style.display = 'none';
      // Bilder mit eigenem Schriftzug (BLACK, ALCHEMY, RICH/RISK): in der Start-Animation nur das Bild zeigen
      if (['nim', 'turm', 'duell'].includes(def.cover)) introTitel.style.visibility = 'hidden';
    };
    bild.src = `/_pc/cover/${def.cover}.jpg`;
  }

  // ——— PC oder Handy? ———
  const breitPruefen = () => app.classList.toggle('breit', innerWidth >= 900 && innerWidth > innerHeight * 1.1);
  breitPruefen(); addEventListener('resize', breitPruefen);

  // ——— Seiten wechseln (mit diagonalem Wisch) ———
  let aktuell = null;
  const KLASSE = { 's-stufen': 'im-gold', 's-rang': 'im-signal', 's-stat': 'im-signal', 's-spiel': 'im-spiel' };
  function zeige(id) {
    const neu = $('#' + id);
    if (aktuell === neu) return;
    if (aktuell) {
      const alt = aktuell; alt.classList.remove('an', 'rein'); alt.classList.add('raus');
      setTimeout(() => alt.classList.remove('raus'), 500);
    }
    app.classList.remove('im-gold', 'im-signal', 'im-spiel');
    if (KLASSE[id]) app.classList.add(KLASSE[id]);
    neu.classList.add('an', 'rein');
    aktuell = neu;
    if (id === 's-spiel') cover.stop(); else cover.start();
    if (id === 's-menue') zeichneMenue();
    if (id === 's-stufen') zeichneStufen();
    if (id === 's-rang') zeichneRang();
    if (id === 's-stat') zeichneStat();
  }

  // ——— Toast ———
  let toastZeit;
  const toast = (text) => { const t = $('#toast'); t.textContent = text; t.classList.add('an'); clearTimeout(toastZeit); toastZeit = setTimeout(() => t.classList.remove('an'), 1600); };

  // ═══ INTRO ═══
  const intro = $('#intro');
  const introTitel = intro.querySelector('.titel');
  introTitel.style.top = `${(def.titel.y ?? 0.5) * 100}%`;
  introTitel.style.transform = 'translateY(-50%)';
  requestAnimationFrame(() => introTitel.classList.add('da'));
  let introVorbei = false;
  const introEnde = () => {
    if (introVorbei) return; introVorbei = true;
    wecken();
    // Titel fliegt an seinen Platz im Menü (FLIP)
    const ziel = $('#s-menue .titel');
    zeige('s-menue');
    const a = introTitel.getBoundingClientRect(), b = ziel.getBoundingClientRect();
    ziel.style.opacity = '0';
    if (a.width && b.width) {
      // 1) ohne Animation an die genaue Pixel-Stelle setzen, 2) dann zum Menü-Titel gleiten
      Object.assign(introTitel.style, { transition: 'none', transform: 'none', transformOrigin: '0 0', top: `${a.top}px`, left: `${a.left}px`, right: 'auto', width: `${a.width}px` });
      introTitel.offsetWidth;
      const gr = (x) => x.querySelector('.gross, .spalten')?.getBoundingClientRect();
      const ga = gr(introTitel), gb = gr(ziel);
      const s = ga && gb && ga.width ? gb.width / ga.width : 1;
      introTitel.style.transition = 'transform .9s cubic-bezier(.7,0,.2,1)';
      introTitel.style.transform = `translate(${b.left - a.left + (gb ? gb.left - b.left - (ga.left - a.left) * s : 0)}px, ${b.top - a.top + (gb ? gb.top - b.top - (ga.top - a.top) * s : 0)}px) scale(${s})`;
    }
    intro.classList.add('weg');
    setTimeout(() => { ziel.style.transition = 'opacity .3s'; ziel.style.opacity = '1'; intro.style.transition = 'opacity .4s'; intro.style.opacity = '0'; }, 850);
    setTimeout(() => intro.remove(), 1300);
  };
  intro.addEventListener('pointerdown', () => { wecken(); introEnde(); });
  addEventListener('keydown', function weg() { introEnde(); removeEventListener('keydown', weg); });
  setTimeout(introEnde, def.introDauer || 3900);
  document.addEventListener('pointerdown', () => wecken(), { once: true });

  // ═══ MENÜ ═══
  function zeichneMenue() {
    $('#m-stufe').textContent = d.gewaehlt;
    $('#m-punkte').textContent = `${zahl(d.punkte)} P`;
    $('#m-ton').innerHTML = d.ton ? I.tonAn : I.tonAus;
    // Streifen-Animation neu starten
    $('#m-streifen').querySelectorAll('button').forEach((b) => { b.style.animation = 'none'; b.offsetWidth; b.style.animation = ''; });
  }
  $('#m-ton').onclick = () => { d.ton = !d.ton; setzeTon(d.ton); speichern(); zeichneMenue(); ton.klick(); };
  $('#m-streifen').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    ton.wahl();
    const z = b.dataset.ziel;
    if (z === 'spielen') starteSpiel(d.gewaehlt, 'ki');
    else if (z === 'duell') starteSpiel(d.gewaehlt, 'zwei');
    else zeige(z);
  });
  app.addEventListener('click', (e) => { if (e.target.closest('[data-zurueck]')) { ton.klick(); zeige('s-menue'); } });

  // ═══ STUFEN (Gold-Missions-Oberfläche) ═══
  const ECKEN = [[70, 214], [140, 84], [286, 70], [346, 190], [276, 322], [120, 312]];
  const MITTE = [204, 192];
  let gezeigt = d.gewaehlt;
  function zeichneStufen() {
    gezeigt = Math.min(d.gewaehlt, def.stufen.length);
    const svg = $('#st-karte');
    const n = def.stufen.length;
    const akz = getComputedStyle(document.documentElement).getPropertyValue('--akzent').trim();
    let h = `<defs>
      <linearGradient id="fl1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a3150"/><stop offset="1" stop-color="#0a0c16"/></linearGradient>
      <linearGradient id="fl2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${akz}" stop-opacity=".55"/><stop offset="1" stop-color="#140c06" stop-opacity=".9"/></linearGradient>
      <radialGradient id="glanz"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;
    // Ringe + Rauten wie im Technologie-Baum
    h += `<g opacity=".5">${[188, 160].map((r) => `<circle cx="200" cy="200" r="${r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-dasharray="2 6"/>`).join('')}</g>`;
    h += '<g class="st-koerper">';
    for (let i = 0; i < 6; i++) {
      const a = ECKEN[i], b = ECKEN[(i + 1) % 6];
      const frei = i + 1 <= d.frei && i + 1 <= n;
      h += `<polygon points="${a} ${b} ${MITTE}" fill="url(#${frei && (i % 2 === 0) ? 'fl2' : 'fl1'})" stroke="${frei ? akz : 'rgba(255,255,255,.25)'}" stroke-opacity="${frei ? 0.9 : 0.5}" stroke-width="1"/>`;
    }
    h += `<circle cx="${MITTE[0]}" cy="${MITTE[1]}" r="30" fill="url(#glanz)" opacity=".35"/>`;
    for (let i = 0; i < n && i < 6; i++) {
      const [x, y] = ECKEN[i];
      const nr = i + 1, zu = nr > d.frei, wahl = nr === gezeigt;
      const dx = x - 200, dy = y - 200, l = Math.hypot(dx, dy);
      const lx = x + (dx / l) * 26, ly = y + (dy / l) * 22 + 4;
      h += `<g class="st-knoten ${zu ? 'zu' : ''} ${wahl ? 'gewaehlt' : ''}" data-nr="${nr}">
        <circle cx="${x}" cy="${y}" r="26" fill="transparent"/>
        <circle class="ring" cx="${x}" cy="${y}" r="13"/>
        <circle class="punkt" cx="${x}" cy="${y}" r="${wahl ? 6 : 4.5}"/>
        <text x="${lx}" y="${ly}" text-anchor="${dx < -10 ? 'end' : dx > 10 ? 'start' : 'middle'}">${def.stufen[i].name}</text></g>`;
    }
    h += '</g>';
    svg.innerHTML = h;
    svg.onclick = (e) => {
      const k = e.target.closest('.st-knoten'); if (!k) return;
      const nr = +k.dataset.nr;
      if (nr > d.frei) { ton.schlecht(); k.classList.add('wackeln'); setTimeout(() => k.classList.remove('wackeln'), 400); return; }
      ton.wahl(); gezeigt = nr; d.gewaehlt = nr; speichern(); zeichneStufen();
    };
    const st = def.stufen[gezeigt - 1];
    $('#st-punkte').textContent = `${zahl(d.punkte)} P`;
    $('#st-code').textContent = `S${gezeigt}`;
    $('#st-name').textContent = st.name;
    const stern = d.sterne[gezeigt] || 0;
    $('#st-sterne').innerHTML = [1, 2, 3].map((i) => I.stern.replace('<svg', `<svg class="${i <= stern ? 'an' : ''}"`)).join('');
    $('#st-werte').innerHTML = (st.werte || []).map((w) => `<span>${w}</span>`).join('');
    $('#st-rauten').innerHTML = [1, 2, 3, 4].map((i) => `<i class="${i <= Math.min(4, Math.ceil(gezeigt * 4 / def.stufen.length)) ? 'voll' : ''}"></i>`).join('');
    $('#st-start').onclick = () => { ton.wahl(); starteSpiel(gezeigt, 'ki'); };
  }

  // ═══ RANGLISTE (Liste im Stil der blauen Daten-Vorlage) ═══
  let rangArt = 'punkte';
  function rangDaten() {
    const liste = BOTS.map((n, i) => ({ name: n, punkte: Math.round(BOT_PUNKTE[i] * (def.botFaktor || 1)), siege: BOT_SIEGE[i] }));
    liste.push({ name: 'Du', punkte: d.punkte, siege: d.stat.siege, ich: true });
    liste.sort((a, b) => b[rangArt] - a[rangArt]);
    return liste;
  }
  function zeichneRang() {
    const liste = rangDaten();
    const ich = liste.findIndex((e) => e.ich) + 1;
    $('#r-panel').innerHTML = `
      <div class="reiter"><button data-art="punkte" class="${rangArt === 'punkte' ? 'an' : ''}">Punkte</button><button data-art="siege" class="${rangArt === 'siege' ? 'an' : ''}">Siege</button></div>
      <div class="s-metriken"><div><small>Deine ${rangArt === 'punkte' ? 'Punkte' : 'Siege'}</small><b class="pink">${zahl(rangArt === 'punkte' ? d.punkte : d.stat.siege)}</b></div><div><small>Dein Platz</small><b class="tuerk">${ich}</b></div></div>
      <div class="s-ueber">Top 10</div>
      ${liste.map((e, i) => `<div class="s-zeile ${e.ich ? 'ich' : ''}" style="--i:${i}"><span class="nr">${i + 1}</span><span class="name">${e.name}</span><span class="wert">${zahl(e[rangArt])}${rangArt === 'punkte' ? ' P' : ''}</span></div>`).join('')}`;
    $('#r-panel').querySelector('.reiter').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; ton.klick(); rangArt = b.dataset.art; zeichneRang(); };
  }

  // ═══ STATISTIK ═══
  function zeichneStat() {
    const s = d.stat;
    const quote = s.spiele ? Math.round((s.siege / s.spiele) * 100) : 0;
    const zeilen = [
      ['Spiele', zahl(s.spiele)], ['Siege', zahl(s.siege)], ['Niederlagen', zahl(s.niederlagen)],
      ...(s.remis ? [['Unentschieden', zahl(s.remis)]] : []),
      ['Aktuelle Serie', zahl(s.serie)], ['Beste Serie', zahl(s.besteSerie)],
      ['Höchste Stufe', `${d.frei > def.stufen.length ? def.stufen.length : d.frei} / ${def.stufen.length}`],
      ['Sterne', `${Object.values(d.sterne).reduce((a, b) => a + b, 0)} / ${def.stufen.length * 3}`],
      ...(def.zweiSpieler ? [['Duelle zu zweit', zahl(s.duelle)]] : []),
      ['Spielzeit', `${Math.floor(s.zeit / 60)} min`],
      ...(def.statistik || []).filter((x) => s[x.key] !== undefined).map((x) => [x.name, x.format ? x.format(s[x.key]) : zahl(s[x.key])]),
    ];
    $('#t-panel').innerHTML = `
      <div class="s-metriken"><div><small>Siege</small><b class="pink">${zahl(s.siege)}</b></div><div><small>Siegquote</small><b class="tuerk">${quote} %</b></div></div>
      <div class="s-ueber">Werte</div>
      ${zeilen.map(([a, b], i) => `<div class="s-zeile ${i % 2 ? 't' : 'p'}" style="--i:${i}"><span class="name">${a}</span><span class="wert">${b}</span></div>`).join('')}`;
  }

  // ═══ SPIEL ═══
  let laufend = null, spielStart = 0, modusJetzt = 'ki', stufeJetzt = 1;
  const buehne = $('#buehne');

  function starteSpiel(nr, modus) {
    nr = Math.min(nr, d.frei, def.stufen.length);
    stufeJetzt = nr; modusJetzt = modus;
    laufend?.weg?.(); buehne.innerHTML = '';
    $('#ende').classList.remove('an');
    $('#sp-stufe').textContent = modus === 'zwei' ? 'DUELL · 2 SPIELER' : `S${nr} · ${def.stufen[nr - 1].name.toUpperCase()}`;
    $('#sp-info').textContent = '';
    zeige('s-spiel');
    spielStart = performance.now();
    let beendet = false;
    const ktx = {
      stufe: def.stufen[nr - 1], nr, modus, ton, toast, warte,
      breit: app.classList.contains('breit'),
      info: (t) => { $('#sp-info').textContent = t; },
      weitergeben: (name, farbe) => new Promise((ok) => {
        const w = $('#weiter'); $('#weiter-name').textContent = name.toUpperCase(); w.style.setProperty('--c', farbe || 'var(--akzent)');
        w.classList.add('an'); $('#weiter-los').onclick = () => { ton.klick(); w.classList.remove('an'); ok(); };
      }),
      zugleiste: (namen) => {
        const z = el(`<div class="zug">${namen.map((n) => `<span><i></i>${n} <b></b></span>`).join('')}</div>`);
        const sp = [...z.children];
        return { el: z, dran: (i) => sp.forEach((s, k) => s.classList.toggle('dran', k === i)), wert: (i, v) => { sp[i].querySelector('b').textContent = v; } };
      },
      ende: (erg) => { if (!beendet) { beendet = true; spielEnde(erg); } },
    };
    laufend = def.erstelle(buehne, ktx) || {};
  }

  async function spielEnde(erg) {
    const s = d.stat;
    s.zeit += (performance.now() - spielStart) / 1000;
    let neuFrei = false, plus = 0;
    if (modusJetzt === 'zwei') {
      s.duelle++;
    } else {
      s.spiele++;
      if (erg.sieg === true) {
        s.siege++; s.serie++; s.besteSerie = Math.max(s.besteSerie, s.serie);
        const sterne = Math.max(1, Math.min(3, erg.sterne || 1));
        d.sterne[stufeJetzt] = Math.max(d.sterne[stufeJetzt] || 0, sterne);
        plus = erg.punkte ?? 100 * stufeJetzt * sterne;
        d.punkte += plus;
        if (stufeJetzt === d.frei && d.frei < def.stufen.length) { d.frei++; neuFrei = true; d.gewaehlt = d.frei; }
      } else if (erg.sieg === false) { s.niederlagen++; s.serie = 0; }
      else { s.remis++; }
      // eigene Werte des Spiels (Bestzeit usw.)
      for (const x of def.statistik || []) {
        const v = erg.extra?.[x.key]; if (v === undefined) continue;
        if (x.art === 'min') s[x.key] = s[x.key] === undefined ? v : Math.min(s[x.key], v);
        else if (x.art === 'max') s[x.key] = Math.max(s[x.key] ?? -Infinity, v);
        else s[x.key] = (s[x.key] || 0) + v;
      }
    }
    speichern();
    await warte(erg.verzoegerung ?? 900);
    if (modusJetzt === 'zwei' || erg.sieg === true) ton.sieg(); else if (erg.sieg === false) ton.niederlage();

    const titel = erg.titel || (erg.sieg === true ? 'SIEG' : erg.sieg === false ? 'NIEDERLAGE' : 'REMIS');
    const et = $('#e-titel'); et.textContent = titel; et.className = `e-titel ${erg.sieg === false && modusJetzt !== 'zwei' ? 'niederlage' : 'sieg'}`;
    const sterne = modusJetzt === 'ki' && erg.sieg === true ? Math.max(1, Math.min(3, erg.sterne || 1)) : 0;
    $('#e-sterne').innerHTML = modusJetzt === 'ki' ? [1, 2, 3].map((i) => I.stern.replace('<svg', `<svg class="${i <= sterne ? 'an' : ''}" style="--i:${i}"`)).join('') : '';
    $('#e-werte').innerHTML = (erg.werte || []).map(([a, b]) => `<div><b>${b}</b><small>${a.toUpperCase()}</small></div>`).join('');
    $('#e-neu').textContent = neuFrei ? `STUFE ${d.frei} · ${def.stufen[d.frei - 1].name.toUpperCase()} FREI` : '';
    const plusEl = $('#e-plus'); plusEl.textContent = '';
    if (plus) { const t0 = performance.now(); const lauf = () => { const f = Math.min(1, (performance.now() - t0) / 900); plusEl.textContent = `+${zahl(plus * (1 - Math.pow(1 - f, 3)))} P`; if (f < 1) requestAnimationFrame(lauf); }; setTimeout(lauf, 600); }

    const kn = $('#e-knoepfe'); kn.innerHTML = '';
    const knopf = (text, haupt, fn) => { const b = el(`<button class="g-start ${haupt ? '' : 'zweit'}">${text}</button>`); b.onclick = () => { ton.klick(); fn(); }; kn.append(b); };
    if (modusJetzt === 'ki' && erg.sieg === true && stufeJetzt < def.stufen.length && stufeJetzt + 1 <= d.frei) knopf('WEITER', true, () => starteSpiel(stufeJetzt + 1, 'ki'));
    knopf('NOCHMAL', !(modusJetzt === 'ki' && erg.sieg === true && stufeJetzt < d.frei), () => starteSpiel(stufeJetzt, modusJetzt));
    knopf('MENÜ', false, () => verlassen());
    $('#ende').classList.add('an');
  }

  function verlassen() {
    laufend?.weg?.(); laufend = null; buehne.innerHTML = '';
    $('#ende').classList.remove('an'); $('#weiter').classList.remove('an');
    zeige('s-menue');
  }
  $('#sp-weg').onclick = () => { ton.klick(); verlassen(); };
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !introVorbei) return;
    if (aktuell?.id === 's-spiel') verlassen(); else if (aktuell?.id !== 's-menue') zeige('s-menue');
  });

  // ——— Offline-Speicher anmelden ———
  if ('serviceWorker' in navigator && isSecureContext && !location.search.includes('nosw')) navigator.serviceWorker.register('sw.js').catch(() => {});

  // Nur für meine Tests (?test in der Adresse): Seiten direkt aufrufen
  if (location.search.includes('test')) window.__spiele = { zeige, starteSpiel, ende: spielEnde, daten: d, introEnde };
  return { zeige, starteSpiel, daten: d };
}

export { ton, warte, el };
