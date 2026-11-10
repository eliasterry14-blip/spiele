// =====================================================================
//  NAVAL CHESS – Schach-Engine (Regeln + Computergegner)
// =====================================================================
//  Diese Datei hat keine Abhängigkeiten und benutzt kein DOM. Sie läuft
//  im Browser, in einem Web-Worker (ki.js) und in Node (für die Tests).
//
//  Aufbau:
//   1. Grundlagen: Figuren, Felder, Zufallszahlen für den "Fingerabdruck"
//   2. Bewertungs-Tabellen: wie viel ist eine Figur auf welchem Feld wert
//   3. Klasse Brett: die schnelle innere Stellung mit mache() / nimm()
//   4. Klasse Partie: die bequeme Schnittstelle für die Oberfläche
//   5. perft: zählt alle Zugfolgen (damit prüfen wir die Regeln)
//   6. Computergegner: Bewertung, Suche, Eröffnungsbuch, denke()
//
//  Wie das Brett intern aussieht ("0x88-Brett"):
//   Wir benutzen 128 Plätze statt 64. Jede Reihe hat 16 Plätze, aber nur
//   die ersten 8 sind echte Felder. Der Trick: Ein Platz liegt genau dann
//   NEBEN dem Brett, wenn (platz & 0x88) nicht 0 ist. So merkt man beim
//   Ziehen sofort, wenn eine Figur über den Rand laufen würde.
//   Platz 0 = a8, 7 = h8, 0x70 (=112) = a1, 0x77 (=119) = h1.
//   Eine Reihe nach oben (Richtung Schwarz) = -16, nach rechts = +1.
//
//  Zwei Modi:
//   - Klassisch (munition 0): ganz normales Schach nach FIDE-Regeln.
//   - Gefecht (z. B. munition 3): Statt zu ziehen darf eine Seite FEUERN.
//     Das Schiff bleibt stehen, ein gegnerisches Schiff (nie der König) wird versenkt.
//     Dame = Artillerie (genau 2 Felder weit), Turm = Rakete (erstes Schiff auf der Linie),
//     Läufer = Wasserbomben (Nachbarfeld), Springer = Torpedo (geradeaus, max. 4 Felder).
// =====================================================================

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ---------------------------------------------------------------------
// 1. Grundlagen
// ---------------------------------------------------------------------

// Figuren als kleine Zahlen. Schwarz bekommt zusätzlich das Farb-Bit 8.
// Beispiel: weißer Turm = 4, schwarzer Turm = 4 | 8 = 12.
const BAUER = 1, SPRINGER = 2, LAEUFER = 3, TURM = 4, DAME = 5, KOENIG = 6;
const WEISS = 0, SCHWARZ = 8;

const TYP_BUCHSTABE = ['', 'p', 'n', 'b', 'r', 'q', 'k'];  // für Zug-Objekte und FEN
const SAN_BUCHSTABE = ['', '', 'N', 'B', 'R', 'Q', 'K'];   // für die Notation (englisch)
const BUCHSTABE_TYP = { p: BAUER, n: SPRINGER, b: LAEUFER, r: TURM, q: DAME, k: KOENIG };
const LINIEN = 'abcdefgh';

// Ein Zug wird intern als EINE Zahl gespeichert (das ist schnell):
//   Bits 0–6   : von-Feld
//   Bits 7–13  : nach-Feld
//   Bits 14–16 : Umwandlungs-Figur (0 = keine)
//   dazu einzelne Merker-Bits:
const EP = 1 << 17;       // en passant
const ROCHADE = 1 << 18;  // Rochade
const DOPPEL = 1 << 19;   // Bauer zieht zwei Felder
const FEUER = 1 << 20;    // Attacke im Gefecht-Modus: von = Schütze (bleibt stehen), nach = Ziel

// Gefecht-Modus: Welche Waffe hat welches Schiff? (Index = Figurtyp)
const WAFFE = [null, null, 'torpedo', 'wasserbomben', 'rakete', 'artillerie', null];
const MAX_MUNITION = 15;

// Richtungen auf dem 0x88-Brett
const SPRUNG = [-33, -31, -18, -14, 14, 18, 31, 33];        // Springer
const RUND = [-17, -16, -15, -1, 1, 15, 16, 17];            // König (alle Nachbarn)
const GLEIT = [-17, -15, 15, 17, -16, -1, 1, 16];           // 0–3 schräg, 4–7 gerade

// Die 64 echten Felder als 0x88-Plätze, in der Reihenfolge a8, b8, … h1
const FELDER = new Int32Array(64);
for (let i = 0; i < 64; i++) FELDER[i] = (i >> 3) * 16 + (i & 7);

// 'e4' <-> Platz
function feldName(sq) { return LINIEN[sq & 7] + (8 - (sq >> 4)); }
function feldIndex(name) {
  if (typeof name !== 'string' || name.length !== 2) return -1;
  const linie = name.charCodeAt(0) - 97;   // 'a' = 97
  const reihe = name.charCodeAt(1) - 49;   // '1' = 49
  if (linie < 0 || linie > 7 || reihe < 0 || reihe > 7) return -1;
  return (7 - reihe) * 16 + linie;
}

// Rochade-Rechte als 4 Bits: 1 = Weiß kurz, 2 = Weiß lang, 4 = Schwarz kurz, 8 = Schwarz lang.
// Zieht (oder wird geschlagen) etwas auf einem dieser Felder, fallen Rechte weg.
const RECHTE = new Int32Array(128).fill(15);
RECHTE[0x74] = 12; // e1: Weiß verliert beide
RECHTE[0x77] = 14; // h1
RECHTE[0x70] = 13; // a1
RECHTE[0x04] = 3;  // e8: Schwarz verliert beide
RECHTE[0x07] = 11; // h8
RECHTE[0x00] = 7;  // a8

// "Zobrist-Fingerabdruck": Jede Figur auf jedem Feld bekommt eine feste Zufallszahl.
// Alle Zahlen der Stellung mit XOR verknüpft ergeben einen Fingerabdruck (Hash).
// Gleiche Stellung = gleicher Fingerabdruck. Wir nehmen zwei 32-Bit-Zahlen (lo + hi),
// damit zwei verschiedene Stellungen praktisch nie gleich aussehen.
let saat = 0x2545F491;
function zufall32() { saat ^= saat << 13; saat ^= saat >>> 17; saat ^= saat << 5; return saat | 0; }
const Z_LO = new Int32Array(16 * 128), Z_HI = new Int32Array(16 * 128);
for (let i = 0; i < 16 * 128; i++) { Z_LO[i] = zufall32(); Z_HI[i] = zufall32(); }
const ROCH_LO = new Int32Array(16), ROCH_HI = new Int32Array(16);
for (let i = 1; i < 16; i++) { ROCH_LO[i] = zufall32(); ROCH_HI[i] = zufall32(); }
const EP_LO = new Int32Array(8), EP_HI = new Int32Array(8);
for (let i = 0; i < 8; i++) { EP_LO[i] = zufall32(); EP_HI[i] = zufall32(); }
const SEITE_LO = zufall32(), SEITE_HI = zufall32();
// Munition gehört auch zur Stellung: Platz = Farbe * 16 + Anzahl Schuss (0 Schuss = 0, damit Klassisch gleich bleibt)
const MUN_LO = new Int32Array(32), MUN_HI = new Int32Array(32);
for (let i = 0; i < 32; i++) if (i & 15) { MUN_LO[i] = zufall32(); MUN_HI[i] = zufall32(); }

// ---------------------------------------------------------------------
// 2. Bewertungs-Tabellen (nach "PeSTO")
// ---------------------------------------------------------------------
// Für jede Figur gibt es zwei Tabellen: Mittelspiel (mg) und Endspiel (eg).
// Gelesen wird wie ein Brett von Weiß aus gesehen: erste Zeile = Reihe 8.
// Die Werte sind "Centipawns": 100 = ungefähr ein Bauer.

const MG_WERT = [0, 82, 337, 365, 477, 1025, 0];
const EG_WERT = [0, 94, 281, 297, 512, 936, 0];
const PHASE_WERT = [0, 0, 1, 1, 2, 4, 0];   // wie viel "Mittelspiel" eine Figur bringt (max. 24)

const MG_TAB = [null,
  [ // Bauer
    0, 0, 0, 0, 0, 0, 0, 0,
    98, 134, 61, 95, 68, 126, 34, -11,
    -6, 7, 26, 31, 65, 56, 25, -20,
    -14, 13, 6, 21, 23, 12, 17, -23,
    -27, -2, -5, 12, 17, 6, 10, -25,
    -26, -4, -4, -10, 3, 3, 33, -12,
    -35, -1, -20, -23, -15, 24, 38, -22,
    0, 0, 0, 0, 0, 0, 0, 0],
  [ // Springer
    -167, -89, -34, -49, 61, -97, -15, -107,
    -73, -41, 72, 36, 23, 62, 7, -17,
    -47, 60, 37, 65, 84, 129, 73, 44,
    -9, 17, 19, 53, 37, 69, 18, 22,
    -13, 4, 16, 13, 28, 19, 21, -8,
    -23, -9, 12, 10, 19, 17, 25, -16,
    -29, -53, -12, -3, -1, 18, -14, -19,
    -105, -21, -58, -33, -17, -28, -19, -23],
  [ // Läufer
    -29, 4, -82, -37, -25, -42, 7, -8,
    -26, 16, -18, -13, 30, 59, 18, -47,
    -16, 37, 43, 40, 35, 50, 37, -2,
    -4, 5, 19, 50, 37, 37, 7, -2,
    -6, 13, 13, 26, 34, 12, 10, 4,
    0, 15, 15, 15, 14, 27, 18, 10,
    4, 15, 16, 0, 7, 21, 33, 1,
    -33, -3, -14, -21, -13, -12, -39, -21],
  [ // Turm
    32, 42, 32, 51, 63, 9, 31, 43,
    27, 32, 58, 62, 80, 67, 26, 44,
    -5, 19, 26, 36, 17, 45, 61, 16,
    -24, -11, 7, 26, 24, 35, -8, -20,
    -36, -26, -12, -1, 9, -7, 6, -23,
    -45, -25, -16, -17, 3, 0, -5, -33,
    -44, -16, -20, -9, -1, 11, -6, -71,
    -19, -13, 1, 17, 16, 7, -37, -26],
  [ // Dame
    -28, 0, 29, 12, 59, 44, 43, 45,
    -24, -39, -5, 1, -16, 57, 28, 54,
    -13, -17, 7, 8, 29, 56, 47, 57,
    -27, -27, -16, -16, -1, 17, -2, 1,
    -9, -26, -9, -10, -2, -4, 3, -3,
    -14, 2, -11, -2, -5, 2, 14, 5,
    -35, -8, 11, 2, 8, 15, -3, 1,
    -1, -18, -9, 10, -15, -25, -31, -50],
  [ // König
    -65, 23, 16, -15, -56, -34, 2, 13,
    29, -1, -20, -7, -8, -4, -38, -29,
    -9, 24, 2, -16, -20, 6, 22, -22,
    -17, -20, -12, -27, -30, -25, -14, -36,
    -49, -1, -27, -39, -46, -44, -33, -51,
    -14, -14, -22, -46, -44, -30, -15, -27,
    1, 7, -8, -64, -43, -16, 9, 8,
    -15, 36, 12, -54, 8, -28, 24, 14],
];

const EG_TAB = [null,
  [ // Bauer
    0, 0, 0, 0, 0, 0, 0, 0,
    178, 173, 158, 134, 147, 132, 165, 187,
    94, 100, 85, 67, 56, 53, 82, 84,
    32, 24, 13, 5, -2, 4, 17, 17,
    13, 9, -3, -7, -7, -8, 3, -1,
    4, 7, -6, 1, 0, -5, -1, -8,
    13, 8, 8, 10, 13, 0, 2, -7,
    0, 0, 0, 0, 0, 0, 0, 0],
  [ // Springer
    -58, -38, -13, -28, -31, -27, -63, -99,
    -25, -8, -25, -2, -9, -25, -24, -52,
    -24, -20, 10, 9, -1, -9, -19, -41,
    -17, 3, 22, 22, 22, 11, 8, -18,
    -18, -6, 16, 25, 16, 17, 4, -18,
    -23, -3, -1, 15, 10, -3, -20, -22,
    -42, -20, -10, -5, -2, -20, -23, -44,
    -29, -51, -23, -15, -22, -18, -50, -64],
  [ // Läufer
    -14, -21, -11, -8, -7, -9, -17, -24,
    -8, -4, 7, -12, -3, -13, -4, -14,
    2, -8, 0, -1, -2, 6, 0, 4,
    -3, 9, 12, 9, 14, 10, 3, 2,
    -6, 3, 13, 19, 7, 10, -3, -9,
    -12, -3, 8, 10, 13, 3, -7, -15,
    -14, -18, -7, -1, 4, -9, -15, -27,
    -23, -9, -23, -5, -9, -16, -5, -17],
  [ // Turm
    13, 10, 18, 15, 12, 12, 8, 5,
    11, 13, 13, 11, -3, 3, 8, 3,
    7, 7, 7, 5, 4, -3, -5, -3,
    4, 3, 13, 1, 2, 1, -1, 2,
    3, 5, 8, 4, -5, -6, -8, -11,
    -4, 0, -5, -1, -7, -12, -8, -16,
    -6, -6, 0, 2, -9, -9, -11, -3,
    -9, 2, 3, -1, -5, -13, 4, -20],
  [ // Dame
    -9, 22, 22, 27, 27, 19, 10, 20,
    -17, 20, 32, 41, 58, 25, 30, 0,
    -20, 6, 9, 49, 47, 35, 19, 9,
    3, 22, 24, 45, 57, 40, 57, 36,
    -18, 28, 19, 47, 31, 34, 39, 23,
    -16, -27, 15, 6, 9, 17, 10, 5,
    -22, -23, -30, -16, -16, -23, -36, -32,
    -33, -28, -22, -43, -5, -32, -20, -41],
  [ // König
    -74, -35, -18, -18, -11, 15, 4, -17,
    -12, 17, 14, 17, 17, 38, 23, 11,
    10, 17, 23, 15, 20, 45, 44, 13,
    -8, 22, 24, 27, 26, 33, 26, 3,
    -18, -4, 21, 24, 27, 23, 9, -11,
    -19, -3, 11, 21, 23, 16, 7, -9,
    -27, -11, 4, 13, 14, 4, -5, -17,
    -53, -34, -21, -11, -28, -14, -24, -43],
];

// Fertige Tabellen pro Figur-Code und Platz: Wert aus Sicht von Weiß
// (schwarze Figuren zählen negativ, ihre Tabelle wird gespiegelt).
const PST_MG = new Int32Array(16 * 128), PST_EG = new Int32Array(16 * 128);
for (let typ = 1; typ <= 6; typ++) {
  for (let i = 0; i < 64; i++) {
    const sq = FELDER[i];
    PST_MG[(typ << 7) | sq] = MG_WERT[typ] + MG_TAB[typ][i];
    PST_EG[(typ << 7) | sq] = EG_WERT[typ] + EG_TAB[typ][i];
    PST_MG[((typ | SCHWARZ) << 7) | sq] = -(MG_WERT[typ] + MG_TAB[typ][i ^ 56]);   // i ^ 56 spiegelt die Reihe
    PST_EG[((typ | SCHWARZ) << 7) | sq] = -(EG_WERT[typ] + EG_TAB[typ][i ^ 56]);
  }
}

// ---------------------------------------------------------------------
// 3. Brett: die schnelle innere Stellung
// ---------------------------------------------------------------------
// mache(zug) führt einen Zug aus, nimm() nimmt ihn zurück. Alles, was man
// zum Zurücknehmen braucht, liegt auf "Stapeln" (Typed Arrays), damit
// während der Suche keine neuen Objekte entstehen (das wäre langsam).

class Brett {
  constructor() {
    this.f = new Int8Array(128);      // die Felder
    this.seite = WEISS;               // wer am Zug ist (0 oder 8)
    this.rochade = 0;                 // Rochade-Rechte (4 Bits)
    this.ep = -1;                     // en-passant-Feld oder -1
    this.epH = -1;                    // Linie des ep-Feldes im Fingerabdruck (nur wenn ep-Schlag wirklich möglich)
    this.halbzug = 0;                 // Zähler für die 50-Züge-Regel
    this.zugNr = 1;
    this.kf = new Int32Array(2);      // Königsfelder [weiß, schwarz]
    this.hLo = 0; this.hHi = 0;       // Fingerabdruck
    this.mgD = 0; this.egD = 0;       // Tabellenwerte Weiß minus Schwarz (laufend mitgerechnet)
    this.phase = 0;                   // 24 = volles Mittelspiel, 0 = reines Endspiel
    this.anz = new Int32Array(16);    // Anzahl jeder Figur
    this.mun = new Int32Array(2);     // Gefecht-Modus: verbleibende Schuss [weiß, schwarz]
    this.ply = 0;                     // wie viele Züge auf dem Stapel liegen
    this.kap = 0;
    this.wachse(256);
    this.puffer = new Int32Array(1024);
  }

  // Stapel vergrößern (lange Partien)
  wachse(neu = this.kap * 2) {
    const kopie = (alt, Typ) => { const n = new Typ(neu); if (alt) n.set(alt); return n; };
    this.stZug = kopie(this.stZug, Int32Array);
    this.stGeschl = kopie(this.stGeschl, Int8Array);
    this.stRoch = kopie(this.stRoch, Int8Array);
    this.stEp = kopie(this.stEp, Int16Array);
    this.stEpH = kopie(this.stEpH, Int8Array);
    this.stHalb = kopie(this.stHalb, Int32Array);
    this.stHLo = kopie(this.stHLo, Int32Array);
    this.stHHi = kopie(this.stHHi, Int32Array);
    this.stMg = kopie(this.stMg, Int32Array);
    this.stEg = kopie(this.stEg, Int32Array);
    this.stPh = kopie(this.stPh, Int16Array);
    this.kap = neu;
  }

  // Figur hinstellen / wegnehmen – dabei Fingerabdruck und Bewertung mitführen
  setze(sq, c) {
    this.f[sq] = c;
    const i = (c << 7) | sq;
    this.hLo ^= Z_LO[i]; this.hHi ^= Z_HI[i];
    this.mgD += PST_MG[i]; this.egD += PST_EG[i];
    this.phase += PHASE_WERT[c & 7];
    this.anz[c]++;
  }
  entferne(sq) {
    const c = this.f[sq];
    this.f[sq] = 0;
    const i = (c << 7) | sq;
    this.hLo ^= Z_LO[i]; this.hHi ^= Z_HI[i];
    this.mgD -= PST_MG[i]; this.egD -= PST_EG[i];
    this.phase -= PHASE_WERT[c & 7];
    this.anz[c]--;
  }

  // ---------- FEN lesen und schreiben ----------
  ladeFen(fen) {
    const teile = String(fen).trim().split(/\s+/);
    const fehler = (was) => { throw new Error(`Ungültige FEN (${was}): ${fen}`); };
    if (teile.length < 4) fehler('zu wenige Teile');
    this.f.fill(0); this.anz.fill(0); this.mun.fill(0);
    this.hLo = 0; this.hHi = 0; this.mgD = 0; this.egD = 0; this.phase = 0; this.ply = 0;
    const reihen = teile[0].split('/');
    if (reihen.length !== 8) fehler('8 Reihen');
    let koenigeW = 0, koenigeS = 0;
    for (let r = 0; r < 8; r++) {
      let linie = 0;
      for (const ch of reihen[r]) {
        if (ch >= '1' && ch <= '8') { linie += ch.charCodeAt(0) - 48; continue; }
        const typ = BUCHSTABE_TYP[ch.toLowerCase()];
        if (!typ || linie > 7) fehler('Figur');
        const farbe = ch === ch.toLowerCase() ? SCHWARZ : WEISS;
        const sq = r * 16 + linie;
        this.setze(sq, typ | farbe);
        if (typ === KOENIG) { this.kf[farbe >> 3] = sq; if (farbe) koenigeS++; else koenigeW++; }
        linie++;
      }
      if (linie !== 8) fehler('Reihenlänge');
    }
    if (koenigeW !== 1 || koenigeS !== 1) fehler('genau ein König pro Seite');
    if (teile[1] !== 'w' && teile[1] !== 'b') fehler('Seite');
    this.seite = teile[1] === 'w' ? WEISS : SCHWARZ;
    this.rochade = 0;
    if (teile[2] !== '-') {
      for (const ch of teile[2]) { const bit = 'KQkq'.indexOf(ch); if (bit < 0) fehler('Rochade'); this.rochade |= 1 << bit; }
    }
    // Rechte ohne König/Turm auf dem Startfeld gelten nicht
    const f = this.f;
    if (f[0x74] !== KOENIG) this.rochade &= ~3;
    if (f[0x77] !== TURM) this.rochade &= ~1;
    if (f[0x70] !== TURM) this.rochade &= ~2;
    if (f[0x04] !== (KOENIG | SCHWARZ)) this.rochade &= ~12;
    if (f[0x07] !== (TURM | SCHWARZ)) this.rochade &= ~4;
    if (f[0x00] !== (TURM | SCHWARZ)) this.rochade &= ~8;
    this.ep = -1; this.epH = -1;
    if (teile[3] !== '-') {
      const ep = feldIndex(teile[3]);
      if (ep < 0) fehler('en passant');
      // Nur übernehmen, wenn der Bauer, der gerade zwei Felder gezogen ist, wirklich dahinter steht
      const g = this.seite ^ SCHWARZ;
      const bauerFeld = ep + (this.seite === WEISS ? 16 : -16);
      const reiheOk = (ep >> 4) === (this.seite === WEISS ? 2 : 5);
      if (reiheOk && f[ep] === 0 && f[bauerFeld] === (BAUER | g)) this.ep = ep;
    }
    this.halbzug = teile.length > 4 ? Math.max(0, parseInt(teile[4], 10) || 0) : 0;
    this.zugNr = teile.length > 5 ? Math.max(1, parseInt(teile[5], 10) || 1) : 1;
    // Fingerabdruck vervollständigen
    if (this.seite === SCHWARZ) { this.hLo ^= SEITE_LO; this.hHi ^= SEITE_HI; }
    this.hLo ^= ROCH_LO[this.rochade]; this.hHi ^= ROCH_HI[this.rochade];
    if (this.ep >= 0) {
      const g = this.seite ^ SCHWARZ;
      if (this.epMoeglich(this.ep + (this.seite === WEISS ? 16 : -16), g)) {
        this.epH = this.ep & 7; this.hLo ^= EP_LO[this.epH]; this.hHi ^= EP_HI[this.epH];
      }
    }
  }

  // Gefecht-Modus: Munition beider Seiten setzen (gehört zum Fingerabdruck)
  setzeMunition(weiss, schwarz) {
    const neu = [weiss, schwarz];
    for (let i = 0; i < 2; i++) {
      const m = Math.max(0, Math.min(MAX_MUNITION, Math.floor(Number(neu[i])) || 0));
      this.hLo ^= MUN_LO[(i << 4) | this.mun[i]] ^ MUN_LO[(i << 4) | m];
      this.hHi ^= MUN_HI[(i << 4) | this.mun[i]] ^ MUN_HI[(i << 4) | m];
      this.mun[i] = m;
    }
  }

  fen() {
    const f = this.f;
    let s = '';
    for (let r = 0; r < 8; r++) {
      let leer = 0;
      for (let l = 0; l < 8; l++) {
        const c = f[r * 16 + l];
        if (c === 0) { leer++; continue; }
        if (leer) { s += leer; leer = 0; }
        const b = TYP_BUCHSTABE[c & 7];
        s += (c & SCHWARZ) ? b : b.toUpperCase();
      }
      if (leer) s += leer;
      if (r < 7) s += '/';
    }
    let roch = '';
    if (this.rochade & 1) roch += 'K';
    if (this.rochade & 2) roch += 'Q';
    if (this.rochade & 4) roch += 'k';
    if (this.rochade & 8) roch += 'q';
    return `${s} ${this.seite === WEISS ? 'w' : 'b'} ${roch || '-'} ${this.ep >= 0 ? feldName(this.ep) : '-'} ${this.halbzug} ${this.zugNr}`;
  }

  // ---------- Angriffe ----------
  // Wird das Feld sq von der Farbe "von" (0 oder 8) angegriffen?
  angegriffen(sq, von) {
    const f = this.f;
    // Bauern: ein weißer Bauer auf x greift x-15 und x-17 an
    if (von === WEISS) {
      let t = sq + 15; if (!(t & 0x88) && f[t] === BAUER) return true;
      t = sq + 17; if (!(t & 0x88) && f[t] === BAUER) return true;
    } else {
      let t = sq - 15; if (!(t & 0x88) && f[t] === (BAUER | SCHWARZ)) return true;
      t = sq - 17; if (!(t & 0x88) && f[t] === (BAUER | SCHWARZ)) return true;
    }
    // Springer und König
    const sp = SPRINGER | von, ko = KOENIG | von;
    for (let k = 0; k < 8; k++) {
      let t = sq + SPRUNG[k];
      if (!(t & 0x88) && f[t] === sp) return true;
      t = sq + RUND[k];
      if (!(t & 0x88) && f[t] === ko) return true;
    }
    // Gleiter: schräg Läufer/Dame, gerade Turm/Dame
    const la = LAEUFER | von, tu = TURM | von, da = DAME | von;
    for (let k = 0; k < 8; k++) {
      const d = GLEIT[k];
      const passt = k < 4 ? la : tu;
      let t = sq + d;
      while (!(t & 0x88)) {
        const c = f[t];
        if (c !== 0) { if (c === passt || c === da) return true; break; }
        t += d;
      }
    }
    return false;
  }

  imSchach() { return this.angegriffen(this.kf[this.seite >> 3], this.seite ^ SCHWARZ); }
  // Nach mache(): steht der König dessen, der gerade gezogen hat, im Schach? Dann war der Zug illegal.
  zugIllegal() { return this.angegriffen(this.kf[(this.seite ^ SCHWARZ) >> 3], this.seite); }

  // ---------- Züge erzeugen ----------
  // Schreibt alle "pseudo-legalen" Züge (König darf evtl. noch im Schach stehen)
  // ab Position n in die Liste und gibt das neue Ende zurück.
  // nurSchlag = true: nur Schlagzüge, Damen-Umwandlungen und Attacken (für die Ruhesuche).
  erzeuge(liste, n, nurSchlag) {
    const f = this.f, s = this.seite, g = s ^ SCHWARZ;
    const feuern = this.mun[s >> 3] > 0;   // Gefecht-Modus: noch Schuss übrig?
    for (let i = 0; i < 64; i++) {
      const von = FELDER[i], c = f[von];
      if (c === 0 || (c & SCHWARZ) !== s) continue;
      const typ = c & 7;
      if (typ === BAUER) { n = this.bauernZuege(liste, n, von, nurSchlag); continue; }
      if (feuern && typ !== KOENIG) n = this.feuerZuege(liste, n, von, typ);
      if (typ === SPRINGER || typ === KOENIG) {
        const richt = typ === SPRINGER ? SPRUNG : RUND;
        for (let k = 0; k < 8; k++) {
          const nach = von + richt[k];
          if (nach & 0x88) continue;
          const z = f[nach];
          if (z === 0) { if (!nurSchlag) liste[n++] = von | (nach << 7); }
          else if ((z & SCHWARZ) === g) liste[n++] = von | (nach << 7);
        }
        if (typ === KOENIG && !nurSchlag) n = this.rochaden(liste, n, von);
        continue;
      }
      // Läufer, Turm, Dame gleiten, bis sie anstoßen
      const start = typ === TURM ? 4 : 0, ende = typ === LAEUFER ? 4 : 8;
      for (let k = start; k < ende; k++) {
        const d = GLEIT[k];
        let nach = von + d;
        while (!(nach & 0x88)) {
          const z = f[nach];
          if (z === 0) { if (!nurSchlag) liste[n++] = von | (nach << 7); }
          else { if ((z & SCHWARZ) === g) liste[n++] = von | (nach << 7); break; }
          nach += d;
        }
      }
    }
    return n;
  }

  bauernZuege(liste, n, von, nurSchlag) {
    const f = this.f, s = this.seite, g = s ^ SCHWARZ;
    const vor = s === WEISS ? -16 : 16;
    const zielReihe = s === WEISS ? 0 : 7;   // dort wird umgewandelt
    const startReihe = s === WEISS ? 6 : 1;  // von dort darf er zwei Felder
    const nach = von + vor;
    if (!(nach & 0x88) && f[nach] === 0) {
      if ((nach >> 4) === zielReihe) n = umwandlungen(liste, n, von | (nach << 7), nurSchlag);
      else if (!nurSchlag) {
        liste[n++] = von | (nach << 7);
        const nach2 = nach + vor;
        if ((von >> 4) === startReihe && f[nach2] === 0) liste[n++] = von | (nach2 << 7) | DOPPEL;
      }
    }
    // schräg schlagen (auch en passant)
    for (let k = -1; k <= 1; k += 2) {
      const ziel = nach + k;
      if (ziel & 0x88) continue;
      const z = f[ziel];
      if (z !== 0) {
        if ((z & SCHWARZ) !== g) continue;
        if ((ziel >> 4) === zielReihe) n = umwandlungen(liste, n, von | (ziel << 7), nurSchlag);
        else liste[n++] = von | (ziel << 7);
      } else if (ziel === this.ep) liste[n++] = von | (ziel << 7) | EP;
    }
    return n;
  }

  // Attacken im Gefecht-Modus: Der Schütze bleibt stehen, ein gegnerisches Schiff
  // (nie der König) auf dem Zielfeld wird versenkt.
  feuerZuege(liste, n, von, typ) {
    const f = this.f, g = this.seite ^ SCHWARZ, basis = von | FEUER;
    if (typ === DAME || typ === LAEUFER) {
      // Dame = Artillerie: genau 2 Felder weit in 8 Richtungen, fliegt über alles drüber.
      // Läufer = Wasserbomben: eines der 8 Nachbarfelder.
      const weite = typ === DAME ? 2 : 1;
      for (let k = 0; k < 8; k++) {
        const t = von + weite * RUND[k];
        if (t & 0x88) continue;
        const c = f[t];
        if (c !== 0 && (c & SCHWARZ) === g && (c & 7) !== KOENIG) liste[n++] = basis | (t << 7);
      }
    } else if (typ === TURM) {
      // Turm = Rakete: das erste Schiff auf jeder geraden Linie (eigenes oder König = kein Ziel)
      for (let k = 4; k < 8; k++) {
        const d = GLEIT[k];
        let t = von + d;
        while (!(t & 0x88) && f[t] === 0) t += d;
        if (t & 0x88) continue;
        const c = f[t];
        if ((c & SCHWARZ) === g && (c & 7) !== KOENIG) liste[n++] = basis | (t << 7);
      }
    } else if (typ === SPRINGER) {
      // Springer = Torpedo (U-Boot): geradeaus Richtung Gegner, höchstens 4 Felder.
      // Unter eigenen Schiffen taucht er durch, das erste gegnerische ist das Ziel.
      const vor = this.seite === WEISS ? -16 : 16;
      let t = von;
      for (let k = 0; k < 4; k++) {
        t += vor;
        if (t & 0x88) break;
        const c = f[t];
        if (c === 0 || (c & SCHWARZ) !== g) continue;   // leer oder eigenes Schiff: weiter
        if ((c & 7) !== KOENIG) liste[n++] = basis | (t << 7);
        break;                                           // am ersten Gegner ist Schluss
      }
    }
    return n;
  }

  rochaden(liste, n, von) {
    const f = this.f, r = this.rochade;
    if (this.seite === WEISS) {
      if (von !== 0x74 || (r & 3) === 0 || this.angegriffen(0x74, SCHWARZ)) return n;
      if ((r & 1) && f[0x75] === 0 && f[0x76] === 0 && f[0x77] === TURM &&
          !this.angegriffen(0x75, SCHWARZ) && !this.angegriffen(0x76, SCHWARZ)) liste[n++] = 0x74 | (0x76 << 7) | ROCHADE;
      if ((r & 2) && f[0x73] === 0 && f[0x72] === 0 && f[0x71] === 0 && f[0x70] === TURM &&
          !this.angegriffen(0x73, SCHWARZ) && !this.angegriffen(0x72, SCHWARZ)) liste[n++] = 0x74 | (0x72 << 7) | ROCHADE;
    } else {
      if (von !== 0x04 || (r & 12) === 0 || this.angegriffen(0x04, WEISS)) return n;
      if ((r & 4) && f[0x05] === 0 && f[0x06] === 0 && f[0x07] === (TURM | SCHWARZ) &&
          !this.angegriffen(0x05, WEISS) && !this.angegriffen(0x06, WEISS)) liste[n++] = 0x04 | (0x06 << 7) | ROCHADE;
      if ((r & 8) && f[0x03] === 0 && f[0x02] === 0 && f[0x01] === 0 && f[0x00] === (TURM | SCHWARZ) &&
          !this.angegriffen(0x03, WEISS) && !this.angegriffen(0x02, WEISS)) liste[n++] = 0x04 | (0x02 << 7) | ROCHADE;
    }
    return n;
  }

  // Kann der Gegner nach einem Doppelschritt auf "nach" wirklich en passant schlagen?
  // (Nur dann zählt das ep-Feld für Stellungswiederholungen – so will es die FIDE.)
  epMoeglich(nach, ziehender) {
    const f = this.f, g = ziehender ^ SCHWARZ, bauer = BAUER | g, ep = this.ep;
    for (let k = -1; k <= 1; k += 2) {
      const q = nach + k;
      if ((q & 0x88) || f[q] !== bauer) continue;
      // Probeweise schlagen, König prüfen, alles zurückstellen
      f[q] = 0; f[nach] = 0; f[ep] = bauer;
      const ok = !this.angegriffen(this.kf[g >> 3], ziehender);
      f[q] = bauer; f[nach] = BAUER | ziehender; f[ep] = 0;
      if (ok) return true;
    }
    return false;
  }

  // ---------- Zug ausführen / zurücknehmen ----------
  mache(z) {
    const p = this.ply;
    if (p >= this.kap) this.wachse();
    const f = this.f, s = this.seite;
    const von = z & 127, nach = (z >> 7) & 127, umw = (z >> 14) & 7;
    const fig = f[von];
    // alles merken, was wir zum Zurücknehmen brauchen
    this.stZug[p] = z; this.stRoch[p] = this.rochade; this.stEp[p] = this.ep; this.stEpH[p] = this.epH;
    this.stHalb[p] = this.halbzug; this.stHLo[p] = this.hLo; this.stHHi[p] = this.hHi;
    this.stMg[p] = this.mgD; this.stEg[p] = this.egD; this.stPh[p] = this.phase;
    // alte Rochade- und ep-Anteile aus dem Fingerabdruck nehmen
    this.hLo ^= ROCH_LO[this.rochade]; this.hHi ^= ROCH_HI[this.rochade];
    if (this.epH >= 0) { this.hLo ^= EP_LO[this.epH]; this.hHi ^= EP_HI[this.epH]; }

    if (z & FEUER) {
      // Attacke: Ziel versenken, Schütze bleibt stehen, ein Schuss weniger
      this.stGeschl[p] = f[nach];
      this.entferne(nach);
      const i = s >> 3, m = this.mun[i];
      this.hLo ^= MUN_LO[(i << 4) | m] ^ MUN_LO[(i << 4) | (m - 1)];
      this.hHi ^= MUN_HI[(i << 4) | m] ^ MUN_HI[(i << 4) | (m - 1)];
      this.mun[i] = m - 1;
      this.rochade &= RECHTE[nach];          // versenkter Turm auf dem Startfeld: Recht weg
      this.ep = -1; this.epH = -1;
      this.halbzug = 0;
    } else {
      let geschl = 0;
      if (z & EP) {
        const opfer = nach + (s === WEISS ? 16 : -16);
        geschl = f[opfer]; this.entferne(opfer);
      } else if (f[nach] !== 0) {
        geschl = f[nach]; this.entferne(nach);
      }
      this.stGeschl[p] = geschl;
      this.entferne(von);
      this.setze(nach, umw !== 0 ? (umw | s) : fig);
      if ((fig & 7) === KOENIG) {
        this.kf[s >> 3] = nach;
        if (z & ROCHADE) {   // Turm springt mit
          if ((nach & 7) === 6) { this.entferne(nach + 1); this.setze(nach - 1, TURM | s); }
          else { this.entferne(nach - 2); this.setze(nach + 1, TURM | s); }
        }
      }
      this.rochade &= RECHTE[von] & RECHTE[nach];
      this.ep = -1; this.epH = -1;
      if (z & DOPPEL) {
        this.ep = (von + nach) >> 1;
        if (this.epMoeglich(nach, s)) { this.epH = nach & 7; this.hLo ^= EP_LO[this.epH]; this.hHi ^= EP_HI[this.epH]; }
      }
      this.halbzug = ((fig & 7) === BAUER || geschl !== 0) ? 0 : this.halbzug + 1;
    }
    if (s === SCHWARZ) this.zugNr++;
    this.seite = s ^ SCHWARZ;
    this.hLo ^= SEITE_LO ^ ROCH_LO[this.rochade]; this.hHi ^= SEITE_HI ^ ROCH_HI[this.rochade];
    this.ply = p + 1;
  }

  nimm() {
    const p = --this.ply;
    const z = this.stZug[p], f = this.f;
    const s = this.seite ^ SCHWARZ;   // wer den Zug gemacht hatte
    this.seite = s;
    const von = z & 127, nach = (z >> 7) & 127, umw = (z >> 14) & 7;
    const geschl = this.stGeschl[p];
    if (z & FEUER) {
      // Attacke zurück: versenktes Schiff taucht wieder auf, Schuss zurück
      f[nach] = geschl; this.anz[geschl]++;
      this.mun[s >> 3]++;
    } else {
      const fig = f[nach];
      if (umw !== 0) { f[von] = BAUER | s; this.anz[fig]--; this.anz[BAUER | s]++; }
      else f[von] = fig;
      if (z & EP) { f[nach] = 0; f[nach + (s === WEISS ? 16 : -16)] = geschl; }
      else f[nach] = geschl;
      if (geschl !== 0) this.anz[geschl]++;
      if ((fig & 7) === KOENIG) {
        this.kf[s >> 3] = von;
        if (z & ROCHADE) {
          if ((nach & 7) === 6) { f[nach - 1] = 0; f[nach + 1] = TURM | s; }
          else { f[nach + 1] = 0; f[nach - 2] = TURM | s; }
        }
      }
    }
    this.rochade = this.stRoch[p]; this.ep = this.stEp[p]; this.epH = this.stEpH[p];
    this.halbzug = this.stHalb[p]; this.hLo = this.stHLo[p]; this.hHi = this.stHHi[p];
    this.mgD = this.stMg[p]; this.egD = this.stEg[p]; this.phase = this.stPh[p];
    if (s === SCHWARZ) this.zugNr--;
  }

  // "Null-Zug": einfach aussetzen (nur in der Suche, um schnell zu prüfen, ob die Stellung sehr gut ist)
  macheNull() {
    const p = this.ply;
    if (p >= this.kap) this.wachse();
    this.stZug[p] = 0; this.stGeschl[p] = 0; this.stRoch[p] = this.rochade; this.stEp[p] = this.ep; this.stEpH[p] = this.epH;
    this.stHalb[p] = this.halbzug; this.stHLo[p] = this.hLo; this.stHHi[p] = this.hHi;
    this.stMg[p] = this.mgD; this.stEg[p] = this.egD; this.stPh[p] = this.phase;
    if (this.epH >= 0) { this.hLo ^= EP_LO[this.epH]; this.hHi ^= EP_HI[this.epH]; }
    this.ep = -1; this.epH = -1;
    this.halbzug = 0;   // Wiederholungen nicht über einen Null-Zug hinweg suchen
    this.seite ^= SCHWARZ;
    this.hLo ^= SEITE_LO; this.hHi ^= SEITE_HI;
    this.ply = p + 1;
  }
  nimmNull() {
    const p = --this.ply;
    this.seite ^= SCHWARZ;
    this.ep = this.stEp[p]; this.epH = this.stEpH[p]; this.halbzug = this.stHalb[p];
    this.hLo = this.stHLo[p]; this.hHi = this.stHHi[p];
  }

  // ---------- Hilfen für Partie und Suche ----------
  legaleZuege() {
    const puffer = this.puffer, n = this.erzeuge(puffer, 0, false), erg = [];
    for (let i = 0; i < n; i++) {
      const z = puffer[i];
      this.mache(z);
      if (!this.zugIllegal()) erg.push(z);
      this.nimm();
    }
    return erg;
  }
  hatLegalenZug() {
    const puffer = this.puffer, n = this.erzeuge(puffer, 0, false);
    for (let i = 0; i < n; i++) {
      this.mache(puffer[i]);
      const illegal = this.zugIllegal();
      this.nimm();
      if (!illegal) return true;
    }
    return false;
  }
  // UCI-Text ('e7e8q', Attacke 'd1d3f') -> interne Zugzahl (0, wenn nicht legal)
  findeUci(uci) {
    if (typeof uci !== 'string') return 0;
    const u = uci.trim().toLowerCase();
    if (u.length < 4 || u.length > 5) return 0;
    const von = feldIndex(u.slice(0, 2)), nach = feldIndex(u.slice(2, 4));
    const feuer = u[4] === 'f';
    const umw = u.length === 5 && !feuer ? (BUCHSTABE_TYP[u[4]] || -1) : 0;
    if (von < 0 || nach < 0 || umw < 0) return 0;
    for (const z of this.legaleZuege()) {
      if ((z & 127) === von && ((z >> 7) & 127) === nach && ((z >> 14) & 7) === umw && ((z & FEUER) !== 0) === feuer) return z;
    }
    return 0;
  }

  // Wie oft stand genau diese Stellung schon da? (nur seit dem letzten Bauernzug/Schlag)
  wiederholungen() {
    let n = 0;
    const grenze = Math.max(0, this.ply - this.halbzug);
    for (let i = this.ply - 4; i >= grenze; i -= 2) {
      if (this.stHLo[i] === this.hLo && this.stHHi[i] === this.hHi) n++;
    }
    return n;
  }
  // Für die Suche reicht: Stand die Stellung schon einmal da?
  wiederholung() {
    const grenze = Math.max(0, this.ply - this.halbzug);
    for (let i = this.ply - 4; i >= grenze; i -= 2) {
      if (this.stHLo[i] === this.hLo && this.stHHi[i] === this.hHi) return true;
    }
    return false;
  }

  // Ungenügendes Material: Kein Matt mehr möglich (K–K, K+L–K, K+S–K, Läufer nur auf einer Feldfarbe)
  materialUngenuegend() {
    const a = this.anz;
    if (a[BAUER] || a[BAUER | SCHWARZ] || a[TURM] || a[TURM | SCHWARZ] || a[DAME] || a[DAME | SCHWARZ]) return false;
    const springer = a[SPRINGER] + a[SPRINGER | SCHWARZ];
    const laeufer = a[LAEUFER] + a[LAEUFER | SCHWARZ];
    if (springer + laeufer <= 1) return true;
    if (springer > 0) return false;
    // nur Läufer: stehen alle auf derselben Feldfarbe?
    let farbe = -1;
    for (let i = 0; i < 64; i++) {
      const sq = FELDER[i];
      if ((this.f[sq] & 7) !== LAEUFER) continue;
      const fc = ((sq >> 4) + (sq & 7)) & 1;
      if (farbe < 0) farbe = fc; else if (fc !== farbe) return false;
    }
    return true;
  }
  // schnelle Version für die Suche
  totesRemis() {
    const a = this.anz;
    if (a[BAUER] || a[BAUER | SCHWARZ] || a[TURM] || a[TURM | SCHWARZ] || a[DAME] || a[DAME | SCHWARZ]) return false;
    return a[SPRINGER] + a[SPRINGER | SCHWARZ] + a[LAEUFER] + a[LAEUFER | SCHWARZ] <= 1;
  }
  // Hat die Seite am Zug noch Leicht- oder Schwerfiguren? (sonst kein Null-Zug: Zugzwang-Gefahr)
  hatFiguren() {
    const a = this.anz, s = this.seite;
    return a[SPRINGER | s] + a[LAEUFER | s] + a[TURM | s] + a[DAME | s] > 0;
  }
}

function umwandlungen(liste, n, basis, nurDame) {
  liste[n++] = basis | (DAME << 14);
  if (!nurDame) {
    liste[n++] = basis | (TURM << 14);
    liste[n++] = basis | (LAEUFER << 14);
    liste[n++] = basis | (SPRINGER << 14);
  }
  return n;
}

function zugZuUci(z) {
  const umw = (z >> 14) & 7;
  return feldName(z & 127) + feldName((z >> 7) & 127) + ((z & FEUER) ? 'f' : umw ? TYP_BUCHSTABE[umw] : '');
}

// ---------------------------------------------------------------------
// 4. Partie: die Schnittstelle für die Oberfläche
// ---------------------------------------------------------------------

// Zug-Objekt bauen (Stellung VOR dem Zug)
function zugObjekt(b, z) {
  const f = b.f, von = z & 127, nach = (z >> 7) & 127, umw = (z >> 14) & 7;
  const fig = f[von];
  if (z & FEUER) {
    // Attacke: von = Schütze, nach = schlagFeld = Ziel
    return {
      von: feldName(von), nach: feldName(nach),
      farbe: (fig & SCHWARZ) ? 'b' : 'w', figur: TYP_BUCHSTABE[fig & 7],
      schlag: TYP_BUCHSTABE[f[nach] & 7], schlagFeld: feldName(nach), umwandlung: null,
      rochade: null, turmVon: null, turmNach: null, enPassant: false,
      feuer: true, waffe: WAFFE[fig & 7], uci: zugZuUci(z),
    };
  }
  let schlag = null, schlagFeld = null;
  if (z & EP) { schlag = 'p'; schlagFeld = feldName(nach + ((fig & SCHWARZ) ? -16 : 16)); }
  else if (f[nach] !== 0) { schlag = TYP_BUCHSTABE[f[nach] & 7]; schlagFeld = feldName(nach); }
  let rochade = null, turmVon = null, turmNach = null;
  if (z & ROCHADE) {
    if ((nach & 7) === 6) { rochade = 'kurz'; turmVon = feldName(nach + 1); turmNach = feldName(nach - 1); }
    else { rochade = 'lang'; turmVon = feldName(nach - 2); turmNach = feldName(nach + 1); }
  }
  const umwandlung = umw ? TYP_BUCHSTABE[umw] : null;
  return {
    von: feldName(von), nach: feldName(nach),
    farbe: (fig & SCHWARZ) ? 'b' : 'w', figur: TYP_BUCHSTABE[fig & 7],
    schlag, schlagFeld, umwandlung, rochade, turmVon, turmNach,
    enPassant: !!(z & EP), feuer: false, waffe: null, uci: zugZuUci(z),
  };
}

// Kurze Notation (SAN) ohne + / # – das wird nach dem Zug ergänzt
function sanText(b, z, legal) {
  const f = b.f, von = z & 127, nach = (z >> 7) & 127, umw = (z >> 14) & 7;
  if (z & ROCHADE) return (nach & 7) === 6 ? 'O-O' : 'O-O-O';
  const fig = f[von], typ = fig & 7;
  const feuer = z & FEUER;
  const schlag = (z & EP) !== 0 || f[nach] !== 0;
  if (typ === BAUER && !feuer) {
    let s = schlag ? LINIEN[von & 7] + 'x' : '';
    s += feldName(nach);
    if (umw) s += '=' + SAN_BUCHSTABE[umw];
    return s;
  }
  let s = SAN_BUCHSTABE[typ];
  // Kann eine gleiche Figur auch dorthin (bzw. dorthin schießen)? Dann Linie, Reihe oder beides dazuschreiben.
  let andere = false, gleicheLinie = false, gleicheReihe = false;
  for (const z2 of legal) {
    if (z2 === z || (z2 & FEUER) !== feuer) continue;
    const v2 = z2 & 127;
    if (((z2 >> 7) & 127) !== nach || f[v2] !== fig) continue;
    andere = true;
    if ((v2 & 7) === (von & 7)) gleicheLinie = true;
    if ((v2 >> 4) === (von >> 4)) gleicheReihe = true;
  }
  if (andere) {
    if (!gleicheLinie) s += LINIEN[von & 7];
    else if (!gleicheReihe) s += 8 - (von >> 4);
    else s += feldName(von);
  }
  if (feuer) return s + '*' + feldName(nach);   // Attacke: z. B. Q*d3
  if (schlag) s += 'x';
  return s + feldName(nach);
}

export class Partie {
  // optionen.munition: Schuss pro Seite (Gefecht-Modus 3, klassisches Schach 0)
  constructor(fen = START_FEN, optionen = {}) {
    this._b = new Brett();
    this._b.ladeFen(fen || START_FEN);
    this._b.setzeMunition((optionen && optionen.munition) || 0, (optionen && optionen.munition) || 0);
    this.startFen = fen || START_FEN;
    this._verlauf = [];  // Zug-Objekte
    this._zahlen = [];   // dieselben Züge als interne Zahlen (zum Zurücknehmen)
  }

  // Neue Partie und alle UCI-Züge nachspielen. Wirft einen Fehler bei einem illegalen Zug.
  static ausZuegen(startFen = START_FEN, ucis = [], optionen = {}) {
    const p = new Partie(startFen || START_FEN, optionen);
    for (const u of ucis || []) {
      if (!p.ziehe(u)) throw new Error(`Illegaler Zug: ${u}`);
    }
    return p;
  }

  get amZug() { return this._b.seite === WEISS ? 'w' : 'b'; }

  // Gefecht-Modus: verbleibende Schuss einer Farbe ('w' | 'b')
  munition(farbe) { return this._b.mun[farbe === 'b' ? 1 : 0]; }

  // Array(64): 0 = a8 … 63 = h1
  brett() {
    const f = this._b.f, erg = new Array(64);
    for (let i = 0; i < 64; i++) {
      const c = f[FELDER[i]];
      erg[i] = c ? { farbe: (c & SCHWARZ) ? 'b' : 'w', typ: TYP_BUCHSTABE[c & 7] } : null;
    }
    return erg;
  }

  figurAuf(feld) {
    const sq = feldIndex(String(feld || '').toLowerCase());
    if (sq < 0) return null;
    const c = this._b.f[sq];
    return c ? { farbe: (c & SCHWARZ) ? 'b' : 'w', typ: TYP_BUCHSTABE[c & 7] } : null;
  }

  // Alle legalen Züge (optional nur von einem Feld)
  zuege(feld) {
    const b = this._b;
    let liste = b.legaleZuege();
    if (feld !== undefined && feld !== null) {
      const sq = feldIndex(String(feld).toLowerCase());
      if (sq < 0) return [];
      liste = liste.filter((z) => (z & 127) === sq);
    }
    return liste.map((z) => zugObjekt(b, z));
  }

  // zug = 'e2e4' | 'e7e8q' | 'd1d3f' (Attacke) | { von, nach, umwandlung?, feuer? } -> Zug-Objekt oder null
  ziehe(zug) {
    const b = this._b;
    let von, nach, umw = 0, feuer = false;
    if (typeof zug === 'string') {
      const u = zug.trim().toLowerCase();
      if (u.length < 4 || u.length > 5) return null;
      von = feldIndex(u.slice(0, 2)); nach = feldIndex(u.slice(2, 4));
      if (u.length === 5) { if (u[4] === 'f') feuer = true; else umw = BUCHSTABE_TYP[u[4]] || -1; }
    } else if (zug && typeof zug === 'object') {
      von = feldIndex(String(zug.von || '').toLowerCase());
      nach = feldIndex(String(zug.nach || '').toLowerCase());
      feuer = !!zug.feuer;
      if (zug.umwandlung && !feuer) umw = BUCHSTABE_TYP[String(zug.umwandlung).toLowerCase()] || -1;
    } else return null;
    if (von < 0 || nach < 0 || umw < 0) return null;

    const legal = b.legaleZuege();
    let gefunden = 0;
    for (const z of legal) {
      if ((z & 127) !== von || ((z >> 7) & 127) !== nach || ((z & FEUER) !== 0) !== feuer) continue;
      const zu = (z >> 14) & 7;
      if (zu === 0 || zu === umw) { gefunden = z; break; }   // ohne Angabe gibt es keine Umwandlung
    }
    if (!gefunden) return null;

    const obj = zugObjekt(b, gefunden);
    let san = sanText(b, gefunden, legal);
    b.mache(gefunden);
    obj.schach = b.imSchach();
    obj.matt = obj.schach && !b.hatLegalenZug();
    obj.san = san + (obj.matt ? '#' : obj.schach ? '+' : '');
    this._verlauf.push(obj);
    this._zahlen.push(gefunden);
    return { ...obj };
  }

  zuruecknehmen() {
    if (this._zahlen.length === 0) return null;
    this._b.nimm();
    this._zahlen.pop();
    return { ...this._verlauf.pop() };
  }

  verlauf() { return this._verlauf.map((z) => ({ ...z })); }

  imSchach() { return this._b.imSchach(); }

  koenigFeld(farbe) { return feldName(this._b.kf[farbe === 'b' ? 1 : 0]); }

  status() {
    const b = this._b;
    if (!b.hatLegalenZug()) {
      if (b.imSchach()) return { ende: true, art: 'matt', sieger: b.seite === WEISS ? 'b' : 'w' };
      return { ende: true, art: 'patt', sieger: null };
    }
    if (b.halbzug >= 100) return { ende: true, art: 'fuenfzig', sieger: null };
    if (b.wiederholungen() >= 2) return { ende: true, art: 'wiederholung', sieger: null };
    if (b.materialUngenuegend()) return { ende: true, art: 'material', sieger: null };
    return { ende: false };
  }

  fen() { return this._b.fen(); }
}

// ---------------------------------------------------------------------
// 5. perft: alle Zugfolgen bis zur Tiefe zählen
// ---------------------------------------------------------------------
// Für viele Stellungen kennt man die richtige Anzahl. Stimmt unsere Zahl,
// sind die Regeln (Rochade, en passant, Umwandlung, Fesselung …) richtig.

function perftRek(b, tiefe, puffer, start) {
  const ende = b.erzeuge(puffer, start, false);
  let n = 0;
  for (let i = start; i < ende; i++) {
    b.mache(puffer[i]);
    if (!b.zugIllegal()) n += tiefe === 1 ? 1 : perftRek(b, tiefe - 1, puffer, ende);
    b.nimm();
  }
  return n;
}

export function perft(fen, tiefe, optionen = {}) {
  const b = new Brett();
  b.ladeFen(fen);
  b.setzeMunition((optionen && optionen.munition) || 0, (optionen && optionen.munition) || 0);
  if (tiefe <= 0) return 1;
  return perftRek(b, tiefe, new Int32Array(512 * (tiefe + 1)), 0);
}

// ---------------------------------------------------------------------
// 6. Computergegner
// ---------------------------------------------------------------------
//  Idee: Der Computer probiert Züge im Kopf aus (mache/nimm), schaut ein paar
//  Züge voraus und bewertet die Stellungen am Ende mit Punkten.
//  - Negamax + Alpha-Beta: Was für mich +50 ist, ist für dich −50. Äste, die
//    sowieso schlechter sind als etwas schon Gefundenes, werden abgeschnitten.
//  - PVS: Nach dem ersten (hoffentlich besten) Zug werden die anderen nur mit
//    einem "Null-Fenster" geprüft – das geht schneller.
//  - Ruhesuche: Am Ende werden noch alle Schlagzüge zu Ende gerechnet, damit
//    der Computer nicht mitten in einem Abtausch aufhört zu denken.
//  - Iterative Vertiefung: erst 1 Zug tief, dann 2, 3, … bis die Zeit um ist.

const MATT = 30000;
const MATT_GRENZE = MATT - 1000;   // Werte darüber bedeuten "Matt in X"
const UNENDLICH = 32000;
const MAX_PLY = 100;
const FIGUR_WERT = [0, 100, 320, 330, 500, 900, 0];

const jetzt = (typeof performance !== 'undefined' && typeof performance.now === 'function')
  ? () => performance.now() : () => Date.now();

// Transpositionstabelle (TT): ein Gedächtnis für schon untersuchte Stellungen.
// Platz = Fingerabdruck & Maske. Gespeichert: Prüfzahl, bester Zug, Wert, Tiefe, Art.
const TT_GROESSE = 1 << 19, TT_MASKE = TT_GROESSE - 1;
const EXAKT = 1, UNTERGRENZE = 2, OBERGRENZE = 3;
let ttPruef = null, ttZug = null, ttWert = null, ttTiefe = null, ttArt = null;
let LISTE = null, WERTE = null, KILLER = null, HISTORIE = null;

function vorbereiten() {
  if (ttPruef) return;   // nur einmal Speicher holen
  ttPruef = new Int32Array(TT_GROESSE);
  ttZug = new Int32Array(TT_GROESSE);
  ttWert = new Int16Array(TT_GROESSE);
  ttTiefe = new Int8Array(TT_GROESSE);
  ttArt = new Uint8Array(TT_GROESSE);
  LISTE = new Int32Array(1 << 16);          // Zugliste für alle Ebenen der Suche
  WERTE = new Int32Array(1 << 16);          // Sortier-Werte dazu
  KILLER = new Int32Array(MAX_PLY * 2);     // zwei "Killerzüge" pro Ebene
  HISTORIE = new Int32Array(2 * 128 * 128); // wie oft war ein ruhiger Zug gut?
}

// Zustand der laufenden Suche
let B = null;
let knoten = 0, stopp = false, zeitPruefen = false, abgabe = 0, oben = 0;

// ---------- Bewertung ----------
const FREI_MG = [0, 0, 5, 10, 20, 30, 0, 0];     // Freibauer nach Fortschritt (0 = Startreihe)
const FREI_EG = [0, 5, 10, 20, 35, 55, 0, 0];
const W_MAX = new Int32Array(10), S_MIN = new Int32Array(10);   // pro Linie (1–8, mit Rand 0 und 9)
const W_ANZ = new Int32Array(10), S_ANZ = new Int32Array(10);
const W_LISTE = new Int32Array(64), S_LISTE = new Int32Array(64);

// Bauernschild vor dem König (nur wenn der König zur Seite rochiert hat)
function schild(f, k, farbe) {
  const r = k >> 4, l = k & 7;
  if (farbe === WEISS ? r < 6 : r > 1) return 0;
  if (l === 3 || l === 4) return 0;
  const vor = farbe === WEISS ? -16 : 16, bauer = BAUER | farbe;
  let w = 0;
  for (let x = -1; x <= 1; x++) {
    const t = k + vor + x;
    if (t & 0x88) continue;
    if (f[t] === bauer) w += 12;
    else if (!((t + vor) & 0x88) && f[t + vor] === bauer) w += 6;
    else w -= 8;
  }
  return w;
}

// Wert der Stellung aus Sicht der Seite am Zug (positiv = gut für sie)
function bewerte(b) {
  const f = b.f, a = b.anz;
  let mg = b.mgD, eg = b.egD;
  // Läuferpaar
  if (a[LAEUFER] >= 2) { mg += 25; eg += 45; }
  if (a[LAEUFER | SCHWARZ] >= 2) { mg -= 25; eg -= 45; }
  // Bauernstruktur
  if (a[BAUER] + a[BAUER | SCHWARZ] > 0) {
    for (let i = 0; i < 10; i++) { W_MAX[i] = -1; S_MIN[i] = 8; W_ANZ[i] = 0; S_ANZ[i] = 0; }
    let nw = 0, ns = 0;
    for (let sq = 16; sq < 112; sq++) {          // Bauern stehen nur auf den Reihen 7 bis 2
      if (sq & 8) { sq += 7; continue; }
      const c = f[sq];
      if (c === BAUER) {
        const l = (sq & 7) + 1, r = sq >> 4;
        W_ANZ[l]++; if (r > W_MAX[l]) W_MAX[l] = r; W_LISTE[nw++] = sq;
      } else if (c === (BAUER | SCHWARZ)) {
        const l = (sq & 7) + 1, r = sq >> 4;
        S_ANZ[l]++; if (r < S_MIN[l]) S_MIN[l] = r; S_LISTE[ns++] = sq;
      }
    }
    for (let k = 0; k < nw; k++) {
      const sq = W_LISTE[k], l = (sq & 7) + 1, r = sq >> 4;
      // Freibauer: kein schwarzer Bauer vor ihm auf seiner oder den Nachbarlinien
      if (S_MIN[l - 1] >= r && S_MIN[l] >= r && S_MIN[l + 1] >= r) { mg += FREI_MG[6 - r]; eg += FREI_EG[6 - r]; }
      if (W_ANZ[l - 1] === 0 && W_ANZ[l + 1] === 0) { mg -= 10; eg -= 10; }   // isoliert
    }
    for (let k = 0; k < ns; k++) {
      const sq = S_LISTE[k], l = (sq & 7) + 1, r = sq >> 4;
      if (W_MAX[l - 1] <= r && W_MAX[l] <= r && W_MAX[l + 1] <= r) { mg -= FREI_MG[r - 1]; eg -= FREI_EG[r - 1]; }
      if (S_ANZ[l - 1] === 0 && S_ANZ[l + 1] === 0) { mg += 10; eg += 10; }
    }
    for (let l = 1; l <= 8; l++) {                // Doppelbauern
      if (W_ANZ[l] > 1) { mg -= 10 * (W_ANZ[l] - 1); eg -= 20 * (W_ANZ[l] - 1); }
      if (S_ANZ[l] > 1) { mg += 10 * (S_ANZ[l] - 1); eg += 20 * (S_ANZ[l] - 1); }
    }
  }
  // Königssicherheit
  mg += schild(f, b.kf[0], WEISS) - schild(f, b.kf[1], SCHWARZ);
  // Mittelspiel und Endspiel nach Phase mischen
  const ph = b.phase < 24 ? b.phase : 24;
  let w = ((mg * ph + eg * (24 - ph)) / 24) | 0;
  // Gefecht-Modus: übrige Schuss sind etwas wert (der letzte am meisten)
  w += MUN_WERT[b.mun[0]] - MUN_WERT[b.mun[1]];
  return (b.seite === WEISS ? w : -w) + 10;   // +10: wer am Zug ist, hat einen kleinen Vorteil
}
// Gesamtwert von 0, 1, 2, … Schuss: 1. Schuss 95, 2. +85, 3. +75 … (abnehmend)
const MUN_WERT = [0, 95, 180, 255, 320, 375, 420, 455, 480, 500, 515, 525, 530, 535, 540, 545];

// ---------- Ruhesuche ----------
function ruhe(alpha, beta, ply) {
  if ((++knoten & 2047) === 0 && zeitPruefen && jetzt() >= abgabe) stopp = true;
  if (stopp) return 0;
  if (ply >= MAX_PLY) return bewerte(B);
  const schach = B.imSchach();
  let best = -MATT + ply, stand = 0;
  if (!schach) {
    // "stehen bleiben" ist erlaubt: Wenn das schon reicht, nicht weiter schlagen
    stand = bewerte(B);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    best = stand;
  }
  const start = oben;
  const ende = B.erzeuge(LISTE, start, !schach);   // im Schach: alle Züge (Flucht), sonst nur Schläge
  oben = ende;
  const f = B.f;
  for (let i = start; i < ende; i++) {
    const z = LISTE[i];
    const opfer = (z & EP) ? BAUER : (f[(z >> 7) & 127] & 7);
    // MVV-LVA: wertvollstes Opfer zuerst, billigster Täter zuerst
    WERTE[i] = opfer * 16 - (f[z & 127] & 7) + (((z >> 14) & 7) === DAME ? 80 : 0);
  }
  for (let i = start; i < ende; i++) {
    let bi = i;
    for (let j = i + 1; j < ende; j++) if (WERTE[j] > WERTE[bi]) bi = j;
    const z = LISTE[bi];
    if (bi !== i) { LISTE[bi] = LISTE[i]; LISTE[i] = z; const t = WERTE[bi]; WERTE[bi] = WERTE[i]; WERTE[i] = t; }
    if (!schach && ((z >> 14) & 7) === 0) {
      // Delta: Selbst mit der geschlagenen Figur kommen wir nicht über alpha -> überspringen
      const opfer = (z & EP) ? BAUER : (f[(z >> 7) & 127] & 7);
      if (stand + FIGUR_WERT[opfer] + 200 <= alpha) continue;
    }
    B.mache(z);
    if (B.zugIllegal()) { B.nimm(); continue; }
    const w = -ruhe(-beta, -alpha, ply + 1);
    B.nimm();
    if (stopp) { oben = start; return 0; }
    if (w > best) {
      best = w;
      if (w > alpha) { alpha = w; if (w >= beta) break; }
    }
  }
  oben = start;
  return best;
}

function halbiereHistorie() { for (let i = 0; i < HISTORIE.length; i++) HISTORIE[i] >>= 1; }

// ---------- Hauptsuche (Negamax mit Alpha-Beta / PVS) ----------
function suche(alpha, beta, tiefe, ply, nullErlaubt) {
  const pv = beta - alpha > 1;   // "Hauptlinie": hier genau rechnen
  if (ply > 0) {
    // Remis durch Wiederholung, 50-Züge-Regel oder zu wenig Material
    if (B.halbzug >= 100 || B.wiederholung() || B.totesRemis()) return 0;
    // Ein schnelleres Matt als hier gibt es nicht mehr
    const ma = -MATT + ply; if (ma > alpha) { alpha = ma; if (alpha >= beta) return alpha; }
    const mb = MATT - ply - 1; if (mb < beta) { beta = mb; if (alpha >= beta) return beta; }
  }
  if (ply >= MAX_PLY) return bewerte(B);
  const schach = B.imSchach();
  if (schach) tiefe++;                     // Schach-Verlängerung: im Schach genauer hinschauen
  if (tiefe <= 0) return ruhe(alpha, beta, ply);
  if ((++knoten & 2047) === 0 && zeitPruefen && jetzt() >= abgabe) stopp = true;
  if (stopp) return 0;

  // Gedächtnis fragen
  const idx = B.hLo & TT_MASKE;
  let ttz = 0;
  if (ttPruef[idx] === B.hHi) {
    ttz = ttZug[idx];
    if (!pv && ttTiefe[idx] >= tiefe) {
      let w = ttWert[idx];
      if (w > MATT_GRENZE) w -= ply; else if (w < -MATT_GRENZE) w += ply;
      const art = ttArt[idx];
      if (art === EXAKT || (art === UNTERGRENZE && w >= beta) || (art === OBERGRENZE && w <= alpha)) return w;
    }
  }

  // Null-Zug: Wenn ich sogar nach dem Aussetzen noch über beta bin, ist die Stellung sicher gut
  if (!pv && !schach && nullErlaubt && tiefe >= 3 && B.hatFiguren() && bewerte(B) >= beta) {
    const R = tiefe >= 7 ? 3 : 2;
    B.macheNull();
    const w = -suche(-beta, -beta + 1, tiefe - 1 - R, ply + 1, false);
    B.nimmNull();
    if (stopp) return 0;
    if (w >= beta) return w >= MATT_GRENZE ? beta : w;
  }

  // Züge erzeugen und sortieren: TT-Zug, Schläge, Killer, History
  const start = oben;
  const ende = B.erzeuge(LISTE, start, false);
  oben = ende;
  const f = B.f;
  const k1 = KILLER[ply * 2], k2 = KILLER[ply * 2 + 1];
  const hBasis = (B.seite >> 3) << 14;
  for (let i = start; i < ende; i++) {
    const z = LISTE[i];
    let w;
    if (z === ttz) w = 4000000;
    else {
      const opfer = (z & EP) ? BAUER : (f[(z >> 7) & 127] & 7);
      const umw = (z >> 14) & 7;
      if (umw !== 0 && umw !== DAME) w = -1000000;                    // Unterverwandlung zuletzt
      else if (opfer !== 0 || umw === DAME) w = 2000000 + opfer * 16 - (f[z & 127] & 7) + (umw ? 80 : 0);
      else if (z === k1) w = 1000002;
      else if (z === k2) w = 1000001;
      else w = HISTORIE[hBasis | (z & 16383)];
    }
    WERTE[i] = w;
  }

  let best = -UNENDLICH, besterZug = 0, legal = 0;
  const altAlpha = alpha;
  for (let i = start; i < ende; i++) {
    let bi = i;
    for (let j = i + 1; j < ende; j++) if (WERTE[j] > WERTE[bi]) bi = j;
    const z = LISTE[bi];
    if (bi !== i) { LISTE[bi] = LISTE[i]; LISTE[i] = z; const t = WERTE[bi]; WERTE[bi] = WERTE[i]; WERTE[i] = t; }
    const ruhig = f[(z >> 7) & 127] === 0 && !(z & EP) && ((z >> 14) & 7) === 0;
    B.mache(z);
    if (B.zugIllegal()) { B.nimm(); continue; }
    legal++;
    let w;
    if (legal === 1) {
      w = -suche(-beta, -alpha, tiefe - 1, ply + 1, true);
    } else {
      // Späte ruhige Züge erst etwas weniger tief prüfen (LMR)
      let red = 0;
      if (tiefe >= 3 && legal > 3 && ruhig && !schach && z !== k1 && z !== k2 && !B.imSchach()) {
        red = (legal > 8 && tiefe >= 5) ? 2 : 1;
      }
      w = -suche(-alpha - 1, -alpha, tiefe - 1 - red, ply + 1, true);
      if (red && w > alpha && !stopp) w = -suche(-alpha - 1, -alpha, tiefe - 1, ply + 1, true);
      if (w > alpha && w < beta && !stopp) w = -suche(-beta, -alpha, tiefe - 1, ply + 1, true);
    }
    B.nimm();
    if (stopp) { oben = start; return 0; }
    if (w > best) {
      best = w; besterZug = z;
      if (w > alpha) {
        alpha = w;
        if (w >= beta) {
          if (ruhig) {   // ruhiger Zug hat abgeschnitten: merken
            if (z !== KILLER[ply * 2]) { KILLER[ply * 2 + 1] = KILLER[ply * 2]; KILLER[ply * 2] = z; }
            const hi = hBasis | (z & 16383);
            HISTORIE[hi] += tiefe * tiefe;
            if (HISTORIE[hi] > 400000) halbiereHistorie();
          }
          break;
        }
      }
    }
  }
  oben = start;
  if (legal === 0) return schach ? -MATT + ply : 0;   // Matt oder Patt

  // im Gedächtnis ablegen (Matt-Werte relativ zu dieser Stelle)
  let sw = best;
  if (sw > MATT_GRENZE) sw += ply; else if (sw < -MATT_GRENZE) sw -= ply;
  ttPruef[idx] = B.hHi; ttZug[idx] = besterZug; ttWert[idx] = sw; ttTiefe[idx] = tiefe;
  ttArt[idx] = best >= beta ? UNTERGRENZE : (best > altAlpha ? EXAKT : OBERGRENZE);
  return best;
}

// ---------- Wurzel und iterative Vertiefung ----------
function wurzelSuche(zuege, tiefe, alpha, beta) {
  let best = -UNENDLICH, besterZug = 0;
  for (let i = 0; i < zuege.length; i++) {
    const z = zuege[i];
    B.mache(z);
    let w;
    if (i === 0) w = -suche(-beta, -alpha, tiefe - 1, 1, true);
    else {
      w = -suche(-alpha - 1, -alpha, tiefe - 1, 1, true);
      if (!stopp && w > alpha && w < beta) w = -suche(-beta, -alpha, tiefe - 1, 1, true);
    }
    B.nimm();
    if (stopp) break;
    if (w > best) {
      best = w; besterZug = z;
      if (w > alpha) { alpha = w; if (w >= beta) break; }
    }
  }
  return { zug: besterZug, wert: best };
}

function nachVorne(zuege, z) {
  const i = zuege.indexOf(z);
  if (i > 0) { zuege.splice(i, 1); zuege.unshift(z); }
}

function sucheBesten(wurzel, maxTiefe, zeitMs, t0) {
  abgabe = t0 + zeitMs;
  // Startsortierung: Schlagzüge (MVV-LVA) nach vorn
  const f = B.f;
  const wert = (z) => ((z & EP) ? BAUER : (f[(z >> 7) & 127] & 7)) * 16 - (f[z & 127] & 7) + (((z >> 14) & 7) === DAME ? 80 : 0);
  wurzel.sort((x, y) => wert(y) - wert(x));
  let besterZug = wurzel[0], besterWert = 0, fertig = 0;
  for (let t = 1; t <= maxTiefe; t++) {
    zeitPruefen = t > 1;   // Tiefe 1 wird immer fertig gerechnet
    let a = -UNENDLICH, bt = UNENDLICH;
    if (t >= 4 && Math.abs(besterWert) < MATT_GRENZE) { a = besterWert - 40; bt = besterWert + 40; }  // Suchfenster
    let erg;
    for (;;) {
      erg = wurzelSuche(wurzel, t, a, bt);
      if (stopp) break;
      nachVorne(wurzel, erg.zug);
      if (erg.wert <= a) { a = -UNENDLICH; continue; }   // Fenster zu klein -> neu mit vollem Fenster
      if (erg.wert >= bt) { bt = UNENDLICH; continue; }
      break;
    }
    if (stopp) {
      // halb fertige Tiefe: Wurde der bisher beste Zug schon geprüft und etwas Besseres gefunden, nehmen wir das
      if (erg.zug) { besterZug = erg.zug; besterWert = erg.wert; }
      break;
    }
    besterZug = erg.zug; besterWert = erg.wert; fertig = t;
    if (wurzel.length === 1) break;                                  // nur ein Zug möglich
    if (besterWert > MATT_GRENZE && MATT - besterWert <= t) break;   // sicheres Matt gefunden
    if (jetzt() - t0 > zeitMs * 0.55) break;                         // nächste Tiefe schafft man nicht mehr
  }
  return { zug: besterZug, wert: besterWert, tiefe: fertig };
}

// Zug per "Softmax" auswählen: gute Züge sind wahrscheinlicher, aber nicht sicher.
// Je größer die Temperatur, desto zufälliger.
function softmaxWahl(werte, temperatur) {
  let max = -Infinity;
  for (const w of werte) if (w > max) max = w;
  const gewichte = werte.map((w) => Math.exp((w - max) / temperatur));
  let summe = 0;
  for (const g of gewichte) summe += g;
  let r = Math.random() * summe;
  for (let i = 0; i < gewichte.length; i++) { r -= gewichte[i]; if (r <= 0) return i; }
  return gewichte.length - 1;
}

// ---------- Eröffnungsbuch ----------
// Bekannte Eröffnungen als UCI-Zugfolgen. Passt der bisherige Verlauf zum Anfang
// einer Linie, spielt der Computer (Stufe 2–4) zufällig eine passende Fortsetzung.
export const BUCH_LINIEN = [
  // Italienisch
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6 e1g1 e8g8',
  'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8e7 e1g1 e8g8 f1e1 d7d6',
  // Spanisch
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8',
  'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6 d4e5 d6f5',
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5c6 d7c6 e1g1 f7f6 d2d4 e5d4',
  // Schottisch, Vierspringer, Russisch, Königsgambit
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6 e4e5 d8e7',
  'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f1b5 f8b4 e1g1 e8g8 d2d3 d7d6',
  'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5 f1d3',
  'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 h2h4 g5g4 f3e5',
  // Sizilianisch
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3',
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 d7d6 c1g5 e7e6',
  'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3 d8c7 c1e3 a7a6',
  'e2e4 c7c5 c2c3 g8f6 e4e5 f6d5 d2d4 c5d4 g1f3 b8c6',
  'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 d2d3 d7d6',
  // Französisch
  'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7',
  'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6',
  'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6 e4e5 f6d7 f1d3 c7c5 c2c3 b8c6',
  // Caro-Kann
  'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6',
  'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2 c6c5',
  // Skandinavisch, Pirc
  'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c8f5',
  'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1',
  // Damengambit
  'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6',
  'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4 c7c5 e1g1 a7a6',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5',
  // Indische Verteidigungen
  'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6',
  'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7',
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5',
  'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7 e1g1 e8g8',
  'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1',
  'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6',
  // Londoner System, Holländisch
  'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 c7c5 c2c3 b8c6',
  'd2d4 f7f5 g2g3 g8f6 f1g2 e7e6 g1f3 f8e7 e1g1 e8g8 c2c4',
  // Englisch, Réti
  'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5',
  'c2c4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 g1f3 e7e6',
  'g1f3 d7d5 g2g3 g8f6 f1g2 e7e6 e1g1 f8e7 d2d3 e8g8',
].map((s) => s.split(' '));

function istStartstellung(fen) {
  const teile = String(fen || START_FEN).trim().split(/\s+/).slice(0, 4).join(' ');
  return teile === START_FEN.split(' ').slice(0, 4).join(' ');
}

function buchZug(zuege) {
  const kandidaten = [];
  for (const linie of BUCH_LINIEN) {
    if (linie.length <= zuege.length) continue;
    let passt = true;
    for (let i = 0; i < zuege.length; i++) if (linie[i] !== zuege[i]) { passt = false; break; }
    if (passt) kandidaten.push(linie[zuege.length]);   // Züge aus mehreren Linien kommen öfter vor
  }
  if (kandidaten.length === 0) return null;
  return kandidaten[Math.floor(Math.random() * kandidaten.length)];
}

// ---------- denke: die Hauptfunktion für den Computerzug ----------
// Stufen: 1 Matrose, 2 Maat, 3 Kapitän, 4 Admiral
// Rückgabe: { uci, wert, tiefe, knoten, ms, buch }  (wert aus Sicht der Seite am Zug, in Centipawns)
// munition > 0: Gefecht-Modus (Attacken gehören zu den Zügen, uci endet dann auf 'f')
export function denke({ startFen = START_FEN, zuege = [], stufe = 2, zeitMs, munition = 0 } = {}) {
  const t0 = jetzt();
  vorbereiten();
  const b = new Brett();
  b.ladeFen(startFen || START_FEN);
  b.setzeMunition(munition || 0, munition || 0);
  const verlauf = (zuege || []).map((u) => String(u).trim().toLowerCase());
  for (const u of verlauf) {
    const z = b.findeUci(u);
    if (!z) throw new Error(`Illegaler Zug im Verlauf: ${u}`);
    b.mache(z);
  }
  stufe = Math.min(4, Math.max(1, Math.round(Number(stufe)) || 2));
  const ms = () => Math.round(jetzt() - t0);

  const legal = b.legaleZuege();
  if (legal.length === 0) return { uci: null, wert: b.imSchach() ? -MATT : 0, tiefe: 0, knoten: 0, ms: ms(), buch: false };

  // Eröffnungsbuch (ab Stufe 2, nur klassisch und nur aus der Grundstellung)
  if (stufe >= 2 && !munition && istStartstellung(startFen)) {
    const u = buchZug(verlauf);
    if (u && b.findeUci(u)) return { uci: u, wert: 0, tiefe: 0, knoten: 0, ms: ms(), buch: true };
  }

  // Suche vorbereiten
  B = b; knoten = 0; stopp = false; zeitPruefen = false; oben = 0;
  KILLER.fill(0); HISTORIE.fill(0); ttPruef.fill(0); ttZug.fill(0);

  if (stufe <= 2) {
    // Jeden Zug einzeln bewerten (Stufe 1: 1 Zug + Ruhesuche, Stufe 2: 2 Züge tief) und per Softmax wählen
    const werte = legal.map((z) => {
      b.mache(z);
      const w = stufe === 1 ? -ruhe(-UNENDLICH, UNENDLICH, 1) : -suche(-UNENDLICH, UNENDLICH, 1, 1, true);
      b.nimm();
      return w;
    });
    let wahl;
    if (stufe === 1 && Math.random() < 0.1) wahl = Math.floor(Math.random() * legal.length);  // ab und zu ein Zufallszug
    else wahl = softmaxWahl(werte, stufe === 1 ? 200 : 70);
    return { uci: zugZuUci(legal[wahl]), wert: werte[wahl], tiefe: stufe, knoten, ms: ms(), buch: false };
  }

  // Stufe 3: höchstens 700 ms und Tiefe 5. Stufe 4: volle Zeit, keine Tiefengrenze.
  const zeit = stufe === 3 ? Math.min(zeitMs ?? 700, 700) : (zeitMs ?? 1800);
  const erg = sucheBesten(legal, stufe === 3 ? 5 : 64, Math.max(1, zeit), t0);
  return { uci: zugZuUci(erg.zug), wert: erg.wert, tiefe: erg.tiefe, knoten, ms: ms(), buch: false };
}
