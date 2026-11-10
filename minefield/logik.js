// MINEFIELD PRO – Regeln, Generator und Logik-Löser (ohne Bildschirm → mit Node testbar)
// „PRO“: Jedes Feld ist ohne Raten lösbar. Das Feld entsteht erst NACH dem ersten Tipp.

// Die 6 Stufen: Spalten × Zeilen / Minen, Stern-Grenzen in Sekunden (3 Sterne, 2 Sterne)
export const STUFEN = [
  { name: 'Rand',        sp: 8,  ze: 8,  minen: 8,  sterne: [45, 90] },
  { name: 'Feld',        sp: 8,  ze: 10, minen: 12, sterne: [70, 130] },
  { name: 'Zone',        sp: 9,  ze: 12, minen: 18, sterne: [100, 180] },
  { name: 'Sog',         sp: 10, ze: 13, minen: 24, sterne: [140, 240] },
  { name: 'Abgrund',     sp: 10, ze: 15, minen: 30, sterne: [180, 300] },
  { name: 'Horizont',    sp: 12, ze: 16, minen: 40, sterne: [240, 400] },
].map((s) => ({ ...s, werte: [`${s.sp} × ${s.ze}`, `${s.minen} Minen`, `★★★ ${Math.floor(s.sterne[0] / 60)}:${String(s.sterne[0] % 60).padStart(2, '0')}`] }));

// ——— Nachbarn (pro Brettgröße einmal berechnet) ———
const NB_SPEICHER = new Map();
export function nachbarn(w, h) {
  const key = `${w}x${h}`;
  if (NB_SPEICHER.has(key)) return NB_SPEICHER.get(key);
  const liste = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nb = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) nb.push(ny * w + nx);
    }
    liste.push(nb);
  }
  NB_SPEICHER.set(key, liste);
  return liste;
}

// Zahl pro Feld = Minen ringsum (Minenfelder selbst bekommen -1)
export function zaehle(w, h, minen) {
  const NB = nachbarn(w, h);
  const z = new Int8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (minen[i]) { z[i] = -1; continue; }
    let n = 0; for (const j of NB[i]) n += minen[j];
    z[i] = n;
  }
  return z;
}

// Startfeld + Nachbarn bleiben frei
export function sicherZone(w, h, start) {
  return new Set([start, ...nachbarn(w, h)[start]]);
}

// Minen zufällig verteilen (nicht in der Sicherheitszone)
export function zufallsMinen(w, h, anzahl, start, zufall = Math.random) {
  const frei = sicherZone(w, h, start);
  const kandidaten = [];
  for (let i = 0; i < w * h; i++) if (!frei.has(i)) kandidaten.push(i);
  if (anzahl > kandidaten.length) throw new Error('zu viele Minen');
  for (let k = 0; k < anzahl; k++) {
    const r = k + Math.floor(zufall() * (kandidaten.length - k));
    [kandidaten[k], kandidaten[r]] = [kandidaten[r], kandidaten[k]];
  }
  const minen = new Uint8Array(w * h);
  for (let k = 0; k < anzahl; k++) minen[kandidaten[k]] = 1;
  return minen;
}

// ——— Logik-Löser ———
// Spielt wie ein Mensch ohne Raten: Einzelfeld-Regeln + Teilmengen-Regel zwischen zwei Zahlen.
// Gibt zurück, ob ALLE sicheren Felder aufgedeckt werden können.
// (wirft einen Fehler, falls er jemals eine Mine öffnen würde – darf nie passieren)
export function loese(w, h, minen, zahlen, start) {
  const n = w * h, NB = nachbarn(w, h);
  let minenZahl = 0; for (let i = 0; i < n; i++) minenZahl += minen[i];
  const ziel = n - minenZahl;
  const st = new Uint8Array(n); // 0 = unbekannt, 1 = offen, 2 = sicher Mine
  let offen = 0, regeln = 0, teilmengen = 0;

  const oeffne = (i0) => {
    const stapel = [i0];
    while (stapel.length) {
      const i = stapel.pop();
      if (st[i]) continue;
      if (minen[i]) throw new Error('Löser hat eine Mine geöffnet');
      st[i] = 1; offen++;
      if (zahlen[i] === 0) for (const j of NB[i]) if (!st[j]) stapel.push(j);
    }
  };
  oeffne(start);

  const unbek = [];
  while (offen < ziel) {
    let weiter = false;
    // 1) Einzelfeld-Regeln
    for (let i = 0; i < n; i++) {
      if (st[i] !== 1 || zahlen[i] === 0) continue;
      unbek.length = 0; let fahnen = 0;
      for (const j of NB[i]) { if (st[j] === 0) unbek.push(j); else if (st[j] === 2) fahnen++; }
      if (!unbek.length) continue;
      const rest = zahlen[i] - fahnen;
      if (rest === 0) { for (const j of unbek) oeffne(j); weiter = true; regeln++; }
      else if (rest === unbek.length) { for (const j of unbek) st[j] = 2; weiter = true; regeln++; }
    }
    if (weiter) continue;

    // 2) Teilmengen-Regel: zwei Zahlen A, B mit gemeinsamen unbekannten Feldern.
    //    Wenn rest(B) − rest(A) = |B \ A|  →  B \ A sind Minen und A \ B sind sicher.
    const bed = [], proFeld = new Map();
    for (let i = 0; i < n; i++) {
      if (st[i] !== 1 || zahlen[i] === 0) continue;
      const u = []; let fahnen = 0;
      for (const j of NB[i]) { if (st[j] === 0) u.push(j); else if (st[j] === 2) fahnen++; }
      if (!u.length) continue;
      const id = bed.length;
      bed.push({ u, set: new Set(u), rest: zahlen[i] - fahnen });
      for (const j of u) { if (!proFeld.has(j)) proFeld.set(j, []); proFeld.get(j).push(id); }
    }
    suche: for (let a = 0; a < bed.length; a++) {
      const A = bed[a], gesehen = new Set();
      for (const j of A.u) for (const b of proFeld.get(j)) {
        if (b === a || gesehen.has(b)) continue;
        gesehen.add(b);
        const B = bed[b];
        const bOhneA = B.u.filter((x) => !A.set.has(x));
        const aOhneB = A.u.filter((x) => !B.set.has(x));
        if (!bOhneA.length && !aOhneB.length) continue;
        if (B.rest - A.rest === bOhneA.length) {
          for (const x of bOhneA) st[x] = 2;
          for (const x of aOhneB) oeffne(x);
          weiter = true; teilmengen++;
          break suche;
        }
      }
    }
    if (!weiter) break;
  }
  return { geloest: offen === ziel, offen, ziel, regeln, teilmengen };
}

// ——— Generator ———
// Ein einzelner Versuch: Minen legen, mit dem Löser prüfen. null, wenn Raten nötig wäre.
export function einVersuch(w, h, anzahl, start, zufall = Math.random) {
  const minen = zufallsMinen(w, h, anzahl, start, zufall);
  const zahlen = zaehle(w, h, minen);
  const erg = loese(w, h, minen, zahlen, start);
  return erg.geloest ? { minen, zahlen, teilmengen: erg.teilmengen } : null;
}

// Komplett (für Tests): so lange würfeln, bis der Löser das Feld schafft.
export function erzeuge(w, h, anzahl, start, { zufall = Math.random, maxVersuche = 200000 } = {}) {
  const t0 = Date.now();
  for (let v = 1; v <= maxVersuche; v++) {
    const f = einVersuch(w, h, anzahl, start, zufall);
    if (f) return { ...f, versuche: v, ms: Date.now() - t0 };
  }
  return null;
}

// ——— Spielzüge (für die Oberfläche) ———
// Aufdecken ab Feld i: gibt die neu geöffneten Felder mit Abstand (für die Welle) zurück.
export function aufdecken(w, h, zahlen, offen, fahnen, i0) {
  const NB = nachbarn(w, h);
  const neu = [];
  if (offen[i0] || fahnen[i0]) return neu;
  const schlange = [[i0, 0]];
  offen[i0] = 1;
  for (let k = 0; k < schlange.length; k++) {
    const [i, d] = schlange[k];
    neu.push({ i, d });
    if (zahlen[i] !== 0) continue;
    for (const j of NB[i]) if (!offen[j] && !fahnen[j]) { offen[j] = 1; schlange.push([j, d + 1]); }
  }
  return neu;
}

// Akkord: Zahl antippen, wenn genug Fahnen ringsum stehen → alle anderen Nachbarn öffnen.
// Gibt die Nachbarn zurück, die geöffnet werden sollen (leer, wenn es nicht passt).
export function akkordZiele(w, h, zahlen, offen, fahnen, i) {
  if (!offen[i] || zahlen[i] <= 0) return [];
  const NB = nachbarn(w, h);
  let f = 0; const ziele = [];
  for (const j of NB[i]) { if (fahnen[j]) f++; else if (!offen[j]) ziele.push(j); }
  return f === zahlen[i] ? ziele : [];
}

export function gewonnen(minen, offen) {
  for (let i = 0; i < minen.length; i++) if (!minen[i] && !offen[i]) return false;
  return true;
}

// Sterne nach Zeit (Sekunden)
export function sterneFuer(sek, grenzen) {
  return sek <= grenzen[0] ? 3 : sek <= grenzen[1] ? 2 : 1;
}

export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Reproduzierbarer Zufall (für Tests)
export function zufallMitSamen(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
