// Computergegner als Web-Worker: Er rechnet in einem eigenen Faden,
// damit die Oberfläche beim Nachdenken nicht hängen bleibt.
// Die Seite schickt { id, startFen, zuege, stufe, zeitMs, munition } und bekommt
// { id, uci, wert, tiefe, knoten, ms, buch } zurück (bei einem Fehler zusätzlich "fehler").
import { denke } from './schach.js';

self.onmessage = (e) => {
  const { id, startFen, zuege, stufe, zeitMs, munition } = e.data;
  try {
    const r = denke({ startFen, zuege, stufe, zeitMs, munition });
    self.postMessage({ id, ...r });
  } catch (fehler) {
    self.postMessage({ id, uci: null, wert: 0, tiefe: 0, knoten: 0, ms: 0, buch: false, fehler: String(fehler && fehler.message || fehler) });
  }
};
