// GRID WARS – Regeln + KI (ohne Bildschirm, darum auch mit Node testbar)
// Punkte-Raster mit B×H Kästchen. Abwechselnd eine Linie zwischen zwei Nachbarpunkten ziehen.
// Wer die 4. Seite eines Kästchens schließt, erobert es und ist nochmal dran.

// ——— Geometrie: Linien und Kästchen durchnummeriert ———
// waagrechte Linien zuerst (B pro Zeile, H+1 Zeilen), danach senkrechte (B+1 pro Zeile, H Zeilen)
const GEO = new Map();
export function geometrie(B, H) {
  const key = `${B}x${H}`;
  if (GEO.has(key)) return GEO.get(key);
  const nW = B * (H + 1), nS = (B + 1) * H, n = nW + nS;
  const anKaestchen = [], lage = [], linien = [];
  for (let l = 0; l < n; l++) {
    const k = [];
    if (l < nW) {
      const x = l % B, y = Math.floor(l / B);
      lage.push({ waag: true, x, y });
      if (y > 0) k.push((y - 1) * B + x);
      if (y < H) k.push(y * B + x);
    } else {
      const i = l - nW, x = i % (B + 1), y = Math.floor(i / (B + 1));
      lage.push({ waag: false, x, y });
      if (x > 0) k.push(y * B + x - 1);
      if (x < B) k.push(y * B + x);
    }
    anKaestchen.push(k);
  }
  // Kästchen → [oben, unten, links, rechts]
  for (let y = 0; y < H; y++) for (let x = 0; x < B; x++) {
    linien.push([y * B + x, (y + 1) * B + x, nW + y * (B + 1) + x, nW + y * (B + 1) + x + 1]);
  }
  const g = { B, H, nW, n, anKaestchen, lage, linien };
  GEO.set(key, g);
  return g;
}

// ——— Spielstand ———
export function neuesSpiel(B, H) {
  const g = geometrie(B, H);
  return { g, frei: g.n, linien: new Uint8Array(g.n), seiten: new Uint8Array(B * H), besitz: new Int8Array(B * H).fill(-1), dran: 0, punkte: [0, 0] };
}
export const klone = (s) => ({ g: s.g, frei: s.frei, linien: s.linien.slice(), seiten: s.seiten.slice(), besitz: s.besitz.slice(), dran: s.dran, punkte: s.punkte.slice() });
export const istEnde = (s) => s.frei === 0;

// Linie ziehen. Gibt die eroberten Kästchen zurück (leer → der andere ist dran).
export function ziehe(s, l) {
  if (l < 0 || l >= s.g.n || s.linien[l]) throw new Error(`ungültige Linie ${l}`);
  s.linien[l] = 1; s.frei--;
  const zu = [];
  for (const k of s.g.anKaestchen[l]) {
    if (++s.seiten[k] === 4) { s.besitz[k] = s.dran; s.punkte[s.dran]++; zu.push(k); }
  }
  if (!zu.length) s.dran = 1 - s.dran;
  return zu;
}

export function freieLinien(s) { const f = []; for (let l = 0; l < s.g.n; l++) if (!s.linien[l]) f.push(l); return f; }
// schließt ein Kästchen
export const istFang = (s, l) => s.g.anKaestchen[l].some((k) => s.seiten[k] === 3);
// gibt dem Gegner nichts (kein Kästchen bekommt die 3. Seite)
export const istSicher = (s, l) => s.g.anKaestchen[l].every((k) => s.seiten[k] < 2);
export const sichereLinien = (s) => freieLinien(s).filter((l) => istSicher(s, l));

function freieLinieVon(s, k, ausser = -1) { for (const l of s.g.linien[k]) if (!s.linien[l] && l !== ausser) return l; return -1; }
function nachbar(s, l, k) { const a = s.g.anKaestchen[l]; return a.length === 2 ? (a[0] === k ? a[1] : a[0]) : -1; }

// Alles Fangbare abräumen (für den, der dran ist). Gibt die Anzahl zurück.
export function gierig(t) {
  let n = 0; const st = [];
  for (let k = 0; k < t.seiten.length; k++) if (t.seiten[k] === 3) st.push(k);
  while (st.length) {
    const k = st.pop();
    if (t.seiten[k] !== 3) continue;
    const l = freieLinieVon(t, k);
    n += ziehe(t, l).length;
    for (const k2 of t.g.anKaestchen[l]) if (t.seiten[k2] === 3) st.push(k2);
  }
  return n;
}

// Fangbare Pfade: Ketten von Kästchen, die man nacheinander schließen kann.
// kaest = Kästchen der Reihe nach, lin[0] = Fang-Linie, lin[1] = Linie für die Doppel-Abgabe,
// beide = auch das Ende ist schon fangbar (Rest eines Rings)
export function fangPfade(s) {
  const gesehen = new Uint8Array(s.seiten.length), pfade = [];
  for (let k0 = 0; k0 < s.seiten.length; k0++) {
    if (s.seiten[k0] !== 3 || gesehen[k0]) continue;
    const kaest = [k0], lin = []; gesehen[k0] = 1;
    let k = k0, via = -1, beide = false;
    for (let schritt = 0; schritt < 999; schritt++) {
      const l = freieLinieVon(s, k, via);
      if (l < 0) break;
      lin.push(l);
      const nb = nachbar(s, l, k);
      if (nb < 0 || gesehen[nb]) break;
      if (s.seiten[nb] === 3) { kaest.push(nb); gesehen[nb] = 1; beide = true; break; }
      if (s.seiten[nb] !== 2) break;
      kaest.push(nb); gesehen[nb] = 1; via = l; k = nb;
    }
    pfade.push({ kaest, lin, beide });
  }
  return pfade;
}

// ——— Zerlegung des Endspiels in Ketten und Ringe ———
function regionen(t) {
  const N = t.seiten.length, reg = new Int16Array(N).fill(-1), liste = [];
  for (let k0 = 0; k0 < N; k0++) {
    if (t.besitz[k0] !== -1 || reg[k0] >= 0) continue;
    const r = { kaest: [], knoten: false, boden: 0 };
    const st = [k0]; reg[k0] = liste.length;
    while (st.length) {
      const k = st.pop(); r.kaest.push(k);
      if (4 - t.seiten[k] !== 2) r.knoten = true;
      for (const l of t.g.linien[k]) {
        if (t.linien[l]) continue;
        const nb = nachbar(t, l, k);
        if (nb < 0) { r.boden++; continue; }
        if (reg[nb] < 0) { reg[nb] = liste.length; st.push(nb); }
      }
    }
    liste.push(r);
  }
  return liste;
}

// Kästchen „wegnehmen“ (alle ihre Linien ziehen, ohne Punkte)
function entferne(t, kaest) {
  for (const k of kaest) t.besitz[k] = 2;
  for (const k of kaest) for (const l of t.g.linien[k]) {
    if (t.linien[l]) continue;
    t.linien[l] = 1; t.frei--;
    for (const k2 of t.g.anKaestchen[l]) if (++t.seiten[k2] === 4 && t.besitz[k2] === -1) t.besitz[k2] = 2;
  }
}

function kleinsterArm(t, regs) {
  let best = null;
  for (const r of regs) {
    if (!r.knoten) continue;
    for (const j of r.kaest) {
      if (4 - t.seiten[j] < 3) continue;
      for (const l of t.g.linien[j]) {
        if (t.linien[l]) continue;
        const arm = []; let via = l, nb = nachbar(t, l, j);
        while (nb >= 0 && 4 - t.seiten[nb] === 2 && !arm.includes(nb)) {
          arm.push(nb);
          const l2 = freieLinieVon(t, nb, via);
          via = l2; nb = nachbar(t, l2, nb);
        }
        if (arm.length && (!best || arm.length < best.length)) best = arm;
      }
    }
  }
  return best;
}

// Zerlegt eine Stellung ohne sichere Züge in Ketten- und Ringlängen.
// Verzweigungen werden genähert: der kürzeste Arm wird zuerst abgegeben.
export function zerlege(s) {
  const t = klone(s), ketten = [], ringe = [];
  gierig(t);
  for (let sicherheit = 0; sicherheit < 400; sicherheit++) {
    const regs = regionen(t);
    if (!regs.length) break;
    let einfach = false;
    for (const r of regs) {
      if (r.knoten) continue;
      einfach = true;
      (r.boden ? ketten : ringe).push(r.kaest.length);
      entferne(t, r.kaest);
    }
    if (einfach) { gierig(t); continue; }
    const arm = kleinsterArm(t, regs);
    if (!arm) { for (const r of regs) { ketten.push(r.kaest.length); entferne(t, r.kaest); } gierig(t); continue; }
    entferne(t, arm);
    ketten.push(arm.length + gierig(t));
  }
  return { ketten, ringe };
}

// Wert des Endspiels (nur noch Ketten/Ringe) für den, der jetzt eine öffnen MUSS.
// = (seine Kästchen) − (Gegner-Kästchen) ab hier bei bestem Spiel beider.
const G_MEMO = new Map();
export function gWert(ketten, ringe) {
  if (!ketten.length && !ringe.length) return 0;
  const k = ketten.slice().sort((a, b) => a - b), r = ringe.slice().sort((a, b) => a - b);
  const key = `${k.join(',')}|${r.join(',')}`;
  const m = G_MEMO.get(key);
  if (m !== undefined) return m;
  let best = -Infinity;
  for (let i = 0; i < k.length; i++) {
    if (i && k[i] === k[i - 1]) continue;
    const c = k[i], g2 = gWert(k.slice(0, i).concat(k.slice(i + 1)), r);
    // kurze Ketten (1, 2) gibt man so ab, dass der Gegner nicht ablehnen kann
    const empf = c <= 2 ? c + g2 : Math.max(c + g2, c - 4 - g2);
    best = Math.max(best, -empf);
  }
  for (let i = 0; i < r.length; i++) {
    if (i && r[i] === r[i - 1]) continue;
    const c = r[i], g2 = gWert(k, r.slice(0, i).concat(r.slice(i + 1)));
    best = Math.max(best, -Math.max(c + g2, c - 8 - g2));
  }
  G_MEMO.set(key, best);
  return best;
}

// ═══ KI ═══
// Stufe 1: zufällig, nimmt freie Kästchen nur manchmal
// Stufe 2: nimmt meist, vermeidet manchmal die 3. Seite
// Stufe 3: nimmt immer, vermeidet 3. Seiten
// Stufe 4: + gibt im Zwang die kleinste Kette ab
// Stufe 5: + Doppel-Abgabe am Ende langer Ketten
// Stufe 6: + Ketten-Kontrolle (Suche über die letzten sicheren Züge + Endspiel-Wert)
export const SUCHE_MAX = 13;

export function kiZug(s, stufe, zufall = Math.random) {
  const frei = freieLinien(s);
  if (!frei.length) return -1;
  const wahl = (a) => a[Math.floor(zufall() * a.length)];
  const faenge = frei.filter((l) => istFang(s, l));
  const sichere = frei.filter((l) => istSicher(s, l));

  if (stufe <= 1) {
    if (faenge.length && zufall() < 0.4) return wahl(faenge);
    return wahl(frei);
  }
  if (stufe === 2) {
    if (faenge.length && zufall() < 0.85) return wahl(faenge);
    if (sichere.length && zufall() < 0.55) return wahl(sichere);
    return wahl(frei);
  }
  if (faenge.length) return stufe <= 4 ? wahl(faenge) : fangZug(s, stufe);
  if (sichere.length) {
    if (stufe >= 6 && sichere.length <= SUCHE_MAX) { const z = sucheSicher(s, sichere, zufall); if (z >= 0) return z; }
    return wahl(sichere);
  }
  if (stufe === 3) return wahl(frei);
  if (stufe <= 5) return kleinsteAbgabe(s, frei, zufall);
  return besteAbgabe(s, frei, zufall);
}

const ddSpaeter = (p) => (!p.beide && p.kaest.length >= 2) || (p.beide && p.kaest.length >= 4);
const ddJetzt = (p) => (!p.beide && p.kaest.length === 2) || (p.beide && p.kaest.length === 4);

function fangZug(s, stufe) {
  const pfade = fangPfade(s);
  if (pfade.length > 1) {
    // einen Pfad für den Schluss aufheben (dort ist die Doppel-Abgabe möglich)
    const halten = pfade.find(ddSpaeter);
    return pfade.find((p) => p !== halten).lin[0];
  }
  const p = pfade[0];
  if (!ddJetzt(p)) return p.lin[0];
  // Entscheidung: alles nehmen oder die letzten 2 (bzw. 4) abgeben und die Kontrolle behalten
  const rest = klone(s); gierig(rest);
  if (istEnde(rest) || sichereLinien(rest).length) return p.lin[0];
  const { ketten, ringe } = zerlege(rest);
  let dd;
  if (stufe === 5) dd = ketten.some((c) => c >= 3) || ringe.length > 0;
  else { const gw = gWert(ketten, ringe); dd = p.beide ? gw < -4 : gw < -2; }
  return dd ? p.lin[1] : p.lin[0];
}

// Was bekommt der Gegner, wenn ich Linie l ziehe? (Stufe 4/5)
function kleinsteAbgabe(s, frei, zufall) {
  let best = [], bestK = Infinity;
  for (const l of frei) {
    const t = klone(s); ziehe(t, l);
    const dd = fangPfade(t).some(ddSpaeter);
    const k = gierig(t) * 2 + (dd ? 1 : 0);
    if (k < bestK) { bestK = k; best = [l]; } else if (k === bestK) best.push(l);
  }
  return best[Math.floor(zufall() * best.length)];
}

// Stufe 6: jede Abgabe mit dem Endspiel-Wert bewerten
function besteAbgabe(s, frei, zufall) {
  let best = [], bestW = -Infinity;
  for (const l of frei) {
    const t = klone(s); ziehe(t, l);
    const pf = fangPfade(t);
    const k = pf.some((p) => !p.beide && p.kaest.length >= 2) ? 2 : pf.some((p) => p.beide && p.kaest.length >= 4) ? 4 : 0;
    const c = gierig(t);
    let gw = 0;
    if (!istEnde(t)) { const z = zerlege(t); gw = gWert(z.ketten, z.ringe); }
    const empf = Math.max(c + gw, k ? c - 2 * k - gw : -Infinity);
    const w = -empf * 4 - (k ? 1 : 0);
    if (w > bestW) { bestW = w; best = [l]; } else if (w === bestW) best.push(l);
  }
  return best[Math.floor(zufall() * best.length)];
}

// Stufe 6: Suche über die verbleibenden sicheren Züge, Endbewertung mit gWert
const ABBRUCH = {};
function sucheSicher(s, sichere, zufall) {
  const idx = new Map(sichere.map((l, i) => [l, i]));
  const memo = new Map();
  let knoten = 0;
  const wert = (t, maske) => {
    const m = memo.get(maske);
    if (m !== undefined) return m;
    if (++knoten > 40000) throw ABBRUCH;
    let best = -Infinity, irgendein = false;
    for (const l of sichere) {
      if (t.linien[l] || !istSicher(t, l)) continue;
      irgendein = true;
      const u = klone(t); ziehe(u, l);
      const v = -wert(u, maske | (1 << idx.get(l)));
      if (v > best) best = v;
    }
    if (!irgendein) { const z = zerlege(t); best = gWert(z.ketten, z.ringe); }
    memo.set(maske, best);
    return best;
  };
  try {
    let best = [], bw = -Infinity;
    for (const l of sichere) {
      const u = klone(s); ziehe(u, l);
      const v = -wert(u, 1 << idx.get(l));
      if (v > bw) { bw = v; best = [l]; } else if (v === bw) best.push(l);
    }
    return best[Math.floor(zufall() * best.length)];
  } catch (e) {
    if (e === ABBRUCH) return -1;
    throw e;
  }
}
