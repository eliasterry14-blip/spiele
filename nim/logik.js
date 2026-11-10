// NIM-Regeln + KI (ohne Bildschirm – darum auch mit Node testbar)
// Variante „Misère“: Wer das LETZTE Streichholz nehmen muss, verliert.

export const summe = (reihen) => reihen.reduce((a, b) => a + b, 0);

// Ist die Stellung für den, der JETZT dran ist, gewonnen (bei perfektem Spiel)?
export function gewinnstellung(reihen) {
  const gross = reihen.filter((r) => r > 1).length;
  const einser = reihen.filter((r) => r === 1).length;
  if (gross === 0) return einser % 2 === 0;           // nur noch Einzelne: gerade Anzahl = gut für mich
  return reihen.reduce((a, b) => a ^ b, 0) !== 0;      // sonst wie normales Nim
}

// Bester Zug: { reihe, anzahl } oder null, wenn alles verloren ist
export function besterZug(reihen) {
  const gross = reihen.map((r, i) => [r, i]).filter(([r]) => r > 1);
  const einser = reihen.filter((r) => r === 1).length;
  if (gross.length === 0) {
    if (einser % 2 === 1) return null;
    return { reihe: reihen.findIndex((r) => r === 1), anzahl: 1 };
  }
  if (gross.length === 1) {
    const [r, i] = gross[0];
    // so viel nehmen, dass eine UNGERADE Zahl Einzelner übrig bleibt
    return { reihe: i, anzahl: einser % 2 === 0 ? r - 1 : r };
  }
  const x = reihen.reduce((a, b) => a ^ b, 0);
  if (x === 0) return null;
  for (let i = 0; i < reihen.length; i++) {
    const ziel = reihen[i] ^ x;
    if (ziel < reihen[i]) return { reihe: i, anzahl: reihen[i] - ziel };
  }
  return null;
}

export function zufallsZug(reihen, zufall = Math.random) {
  const moeglich = reihen.map((r, i) => [r, i]).filter(([r]) => r > 0);
  const [r, i] = moeglich[Math.floor(zufall() * moeglich.length)];
  // eher kleine Züge, wie ein Mensch
  const anzahl = 1 + Math.floor(Math.pow(zufall(), 1.8) * r);
  return { reihe: i, anzahl: Math.min(r, anzahl) };
}

// KI-Zug je nach Stärke (0 = zufällig, 1 = perfekt)
export function kiZug(reihen, staerke, zufall = Math.random) {
  const gut = besterZug(reihen);
  if (gut && zufall() < staerke) return gut;
  // verloren oder „Fehler“: notfalls einen Zug, der nicht sofort das letzte Holz nimmt
  for (let v = 0; v < 6; v++) {
    const z = zufallsZug(reihen, zufall);
    const nach = reihen.slice(); nach[z.reihe] -= z.anzahl;
    if (summe(nach) > 0 || summe(reihen) === z.anzahl && summe(reihen) === 1) return z;
  }
  return zufallsZug(reihen, zufall);
}
