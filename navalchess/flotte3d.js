// NAVAL CHESS – die 3D-Schiffe
// Solange keine echten 3D-Modelle (GLB) im Ordner modelle/ liegen, baue ich die Schiffe aus
// einfachen Grundformen (Rumpf, Kästen, Zylinder). Liegen Modelle dort, werden diese benutzt.
// Maße: ein Brettfeld ist 1 x 1. Der Bug zeigt nach -z (Richtung Gegner von Weiß aus).
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { farbsatz } from './schiffe.js';

// ---------- Materialien: eines pro Seite, Farben lassen sich jederzeit ändern ----------
const MATERIAL = { w: null, b: null };
function neueMaterialien() {
  const std = (o) => new THREE.MeshStandardMaterial({ flatShading: true, ...o });
  return {
    rumpf: std({ roughness: 0.55, metalness: 0.25 }),
    unten: std({ roughness: 0.7, metalness: 0.1 }),
    deck: std({ roughness: 0.8, metalness: 0.05 }),
    aufbau: std({ roughness: 0.45, metalness: 0.2 }),
    dunkel: std({ roughness: 0.5, metalness: 0.5 }),
    akzent: std({ roughness: 0.4, metalness: 0.1, emissiveIntensity: 1.6 }),
    fenster: std({ roughness: 0.2, metalness: 0.1, emissiveIntensity: 1.2 }),
    // Leuchtring an der Wasserlinie: zeigt sofort, welche Flotte das ist
    ring: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  };
}
export function material(farbe) {
  if (!MATERIAL[farbe]) MATERIAL[farbe] = neueMaterialien();
  return MATERIAL[farbe];
}
// Nachts leuchten auch die Fenster der weißen Flotte warm
let nachtStaerke = 0;
export function nachtLichter(n) {
  nachtStaerke = n;
  for (const f of ['w', 'b']) if (tintFarbe[f]?.hell) material(f).fenster.emissiveIntensity = n * 1.7;
}
// Flotten-Farben setzen (aus den Einstellungen) – alle Schiffe der Seite ändern sich sofort
export function setzeFlotte(farbe, stil) {
  const f = farbsatz(stil, farbe);
  const m = material(farbe);
  m.rumpf.color.set(f.rumpf);
  m.deck.color.set(f.hell ? '#c9a877' : '#5c4b3c');      // Holzdeck
  m.unten.color.set(f.hell ? '#a8343f' : '#151a20');     // Unterwasserschiff
  m.aufbau.color.set(f.aufbau);
  m.dunkel.color.set(f.dunkel);
  m.akzent.color.set(f.akzent);
  m.akzent.emissive.set(f.akzent);
  m.akzent.emissiveIntensity = 0.9;
  m.fenster.color.set(f.fenster);
  m.fenster.emissive.set(f.hell ? '#ffc46b' : f.fenster);
  m.fenster.emissiveIntensity = f.hell ? nachtStaerke * 1.7 : 1.2;
  m.ring.color.set(f.akzent);
  for (const t of Object.values(tints[farbe])) t.color.set(f.hell ? '#ffffff' : f.rumpf);
  tintFarbe[farbe] = f;
  aktualisiereModellFarben(farbe);
}

// ---------- kleine Bau-Helfer ----------
// Kasten mit leicht gerundeten Kanten (weicher Low-Poly-Look)
function kasten(b, h, t, mat, x, y, z) {
  const r = Math.min(b, h, t) * 0.2;
  const m = new THREE.Mesh(r > 0.004 ? new RoundedBoxGeometry(b, h, t, 1, r) : new THREE.BoxGeometry(b, h, t), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}
function zylinder(rOben, rUnten, h, mat, x, y, z, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rOben, rUnten, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}
// Rumpf: Umriss von oben (Heck flach, Bug spitz), nach oben ausgezogen
function rumpf(M, laenge, breite, hoehe, tiefgang) {
  const l = laenge / 2;
  const b = breite / 2;
  const s = new THREE.Shape();
  s.moveTo(-b * 0.9, -l);
  s.lineTo(b * 0.9, -l);
  s.quadraticCurveTo(b, -l * 0.9, b, -l * 0.6);
  s.lineTo(b, l * 0.3);
  s.quadraticCurveTo(b * 0.9, l * 0.78, 0, l);
  s.quadraticCurveTo(-b * 0.9, l * 0.78, -b, l * 0.3);
  s.lineTo(-b, -l * 0.6);
  s.quadraticCurveTo(-b, -l * 0.9, -b * 0.9, -l);
  const g = new THREE.ExtrudeGeometry(s, { depth: hoehe, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);     // Umriss liegt jetzt flach, Bug zeigt nach -z
  const m = new THREE.Mesh(g, [M.deck, M.rumpf]);
  m.position.y = -tiefgang;
  // farbiges Unterwasserschiff mit Streifen knapp über der Wasserlinie
  const gu = new THREE.ExtrudeGeometry(s, { depth: tiefgang + 0.022, bevelEnabled: false, curveSegments: 6 });
  gu.rotateX(-Math.PI / 2);
  const unten = new THREE.Mesh(gu, M.unten);
  unten.scale.set(1.035, 1, 1.012);
  unten.position.y = -tiefgang - 0.004;
  const gruppe = new THREE.Group();
  gruppe.add(m, unten);
  return gruppe;
}
// Geschützturm mit Rohren (richtung -1 = nach vorne/-z, 1 = nach hinten)
function geschuetz(M, z, y, groesse, rohre = 1, richtung = -1) {
  const g = new THREE.Group();
  const sockel = zylinder(groesse * 0.9, groesse, groesse * 0.55, M.aufbau, 0, 0, 0, 10);
  g.add(sockel);
  for (let i = 0; i < rohre; i++) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(groesse * 0.11, groesse * 0.13, groesse * 2.1, 6), M.dunkel);
    r.rotation.x = Math.PI / 2;
    r.position.set((i - (rohre - 1) / 2) * groesse * 0.36, groesse * 0.3, richtung * groesse * 1.25);
    g.add(r);
  }
  g.position.set(0, y, z);
  return g;
}
function licht(M, x, y, z, r = 0.014) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), M.akzent);
  m.position.set(x, y, z);
  return m;
}
function fensterReihe(M, breite, y, z1, z2, anzahl) {
  const g = new THREE.Group();
  for (let i = 0; i < anzahl; i++) {
    const z = z1 + ((z2 - z1) * i) / Math.max(1, anzahl - 1);
    for (const seite of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.016), M.fenster);
      f.position.set(seite * (breite / 2 + 0.002), y, z);
      g.add(f);
    }
  }
  return g;
}

// ---------- die sechs Schiffe ----------
const BAUPLAN = {
  // Bauer: Patrouillenboot
  p(M) {
    const g = new THREE.Group();
    g.add(rumpf(M, 0.56, 0.17, 0.11, 0.04));
    g.add(kasten(0.11, 0.09, 0.2, M.aufbau, 0, 0.07, 0.04));
    g.add(fensterReihe(M, 0.11, 0.125, -0.03, 0.1, 3));
    g.add(kasten(0.1, 0.012, 0.02, M.fenster, 0, 0.12, -0.065));
    g.add(zylinder(0.006, 0.008, 0.14, M.dunkel, 0, 0.16, 0.05));
    g.add(kasten(0.07, 0.008, 0.01, M.dunkel, 0, 0.26, 0.05));
    g.add(licht(M, 0, 0.31, 0.05));
    g.add(geschuetz(M, -0.15, 0.07, 0.035, 1, -1));
    return g;
  },
  // Springer: U-Boot
  n(M) {
    const g = new THREE.Group();
    const koerper = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.56, 4, 10), M.rumpf);
    koerper.rotation.x = Math.PI / 2;
    koerper.scale.set(1, 1, 0.85);
    koerper.position.y = 0.0;
    g.add(koerper);
    const turm = kasten(0.07, 0.15, 0.17, M.aufbau, 0, 0.04, -0.02);
    g.add(turm);
    g.add(kasten(0.22, 0.012, 0.04, M.dunkel, 0, 0.13, -0.06));     // Tiefenruder
    g.add(zylinder(0.006, 0.006, 0.12, M.dunkel, -0.012, 0.19, 0.0));  // Periskop
    g.add(kasten(0.012, 0.012, 0.03, M.dunkel, -0.012, 0.3, -0.008));
    g.add(zylinder(0.004, 0.004, 0.09, M.dunkel, 0.015, 0.19, 0.03));  // Antenne
    g.add(licht(M, 0.015, 0.29, 0.03, 0.011));
    const ruder = kasten(0.012, 0.12, 0.08, M.dunkel, 0, 0.0, 0.33);
    g.add(ruder);
    g.add(kasten(0.075, 0.012, 0.03, M.akzent, 0, 0.19, -0.02));       // Kennstreifen am Turm
    return g;
  },
  // Läufer: Zerstörer – schräger Schornstein und Mast
  b(M) {
    const g = new THREE.Group();
    g.add(rumpf(M, 0.8, 0.17, 0.12, 0.045));
    g.add(kasten(0.11, 0.08, 0.26, M.aufbau, 0, 0.08, 0.06));
    g.add(fensterReihe(M, 0.11, 0.13, -0.04, 0.16, 4));
    const bruecke = kasten(0.12, 0.13, 0.1, M.aufbau, 0, 0.08, -0.1);
    g.add(bruecke);
    g.add(kasten(0.122, 0.022, 0.03, M.fenster, 0, 0.18, -0.14));
    const schorn = zylinder(0.03, 0.035, 0.16, M.dunkel, 0, 0.14, 0.1, 8);
    schorn.rotation.x = 0.35;
    g.add(schorn);
    const band = zylinder(0.031, 0.031, 0.025, M.akzent, 0, 0.27, 0.15, 8);
    band.rotation.x = 0.35;
    g.add(band);
    const mast = zylinder(0.006, 0.008, 0.3, M.dunkel, 0, 0.2, -0.08);
    mast.rotation.x = 0.3;
    g.add(mast);
    g.add(licht(M, 0, 0.49, -0.03));
    g.add(geschuetz(M, -0.27, 0.075, 0.04, 1, -1));
    g.add(geschuetz(M, 0.3, 0.075, 0.04, 1, 1));
    return g;
  },
  // Turm: Kreuzer – Burgturm mit Zinnen
  r(M) {
    const g = new THREE.Group();
    g.add(rumpf(M, 0.84, 0.2, 0.13, 0.05));
    g.add(kasten(0.16, 0.12, 0.3, M.aufbau, 0, 0.08, 0.0));
    g.add(fensterReihe(M, 0.16, 0.15, -0.11, 0.11, 5));
    g.add(kasten(0.13, 0.2, 0.14, M.aufbau, 0, 0.2, 0.0));
    g.add(fensterReihe(M, 0.13, 0.3, -0.04, 0.04, 2));
    g.add(kasten(0.131, 0.016, 0.141, M.akzent, 0, 0.36, 0.0));
    for (const [x, z] of [[-0.05, -0.055], [0.05, -0.055], [-0.05, 0.055], [0.05, 0.055], [0, -0.055], [0, 0.055]]) g.add(kasten(0.032, 0.05, 0.032, M.aufbau, x, 0.4, z));   // Zinnen
    g.add(geschuetz(M, -0.27, 0.08, 0.05, 2, -1));
    g.add(geschuetz(M, 0.29, 0.08, 0.05, 2, 1));
    return g;
  },
  // Dame: Schlachtschiff – gestufter Aufbau, schwere Türme, Krone am Mast
  q(M) {
    const g = new THREE.Group();
    g.add(rumpf(M, 0.92, 0.23, 0.14, 0.05));
    g.add(kasten(0.17, 0.08, 0.34, M.aufbau, 0, 0.09, 0.05));
    g.add(fensterReihe(M, 0.17, 0.13, -0.08, 0.18, 5));
    g.add(kasten(0.14, 0.08, 0.24, M.aufbau, 0, 0.17, 0.03));
    g.add(kasten(0.11, 0.08, 0.14, M.aufbau, 0, 0.25, 0.0));
    g.add(kasten(0.09, 0.07, 0.09, M.aufbau, 0, 0.33, -0.02));
    g.add(kasten(0.092, 0.018, 0.03, M.fenster, 0, 0.37, -0.055));
    g.add(zylinder(0.034, 0.038, 0.18, M.dunkel, 0, 0.17, 0.2, 8));
    g.add(zylinder(0.035, 0.035, 0.02, M.akzent, 0, 0.33, 0.2, 8));
    g.add(zylinder(0.007, 0.009, 0.17, M.dunkel, 0, 0.4, -0.02));
    // Krone
    const krone = new THREE.Group();
    krone.add(zylinder(0.04, 0.04, 0.02, M.akzent, 0, 0, 0, 12));
    for (let i = 0; i < 5; i++) {
      const w = (i / 5) * Math.PI * 2;
      const zacke = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 4), M.akzent);
      zacke.position.set(Math.cos(w) * 0.036, 0.04, Math.sin(w) * 0.036);
      krone.add(zacke);
    }
    krone.position.set(0, 0.57, -0.02);
    g.add(krone);
    g.add(geschuetz(M, -0.33, 0.09, 0.055, 3, -1));
    const b = geschuetz(M, -0.2, 0.17, 0.05, 3, -1);
    g.add(b);
    g.add(kasten(0.07, 0.08, 0.07, M.dunkel, 0, 0.09, -0.2));
    g.add(geschuetz(M, 0.33, 0.09, 0.055, 3, 1));
    return g;
  },
  // König: Flaggschiff – langer Aufbau, Mast mit Kreuz und Wimpel, Radarkuppel
  k(M) {
    const g = new THREE.Group();
    g.add(rumpf(M, 0.94, 0.23, 0.15, 0.05));
    g.add(kasten(0.18, 0.09, 0.5, M.aufbau, 0, 0.1, 0.07));
    g.add(fensterReihe(M, 0.18, 0.15, -0.14, 0.28, 7));
    g.add(kasten(0.15, 0.09, 0.32, M.aufbau, 0, 0.19, 0.04));
    g.add(fensterReihe(M, 0.15, 0.24, -0.08, 0.16, 5));
    g.add(kasten(0.14, 0.08, 0.12, M.aufbau, 0, 0.28, -0.06));
    g.add(kasten(0.142, 0.022, 0.03, M.fenster, 0, 0.32, -0.115));
    const kuppel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M.aufbau);
    kuppel.position.set(0.03, 0.39, -0.02);
    g.add(kuppel);
    g.add(zylinder(0.036, 0.04, 0.17, M.dunkel, 0, 0.19, 0.24, 8));
    g.add(zylinder(0.037, 0.037, 0.022, M.akzent, 0, 0.34, 0.24, 8));
    // Mast mit Kreuz
    g.add(zylinder(0.008, 0.01, 0.42, M.dunkel, 0, 0.36, 0.0));
    g.add(kasten(0.14, 0.014, 0.014, M.dunkel, 0, 0.7, 0.0));
    const wimpel = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), M.akzent);
    wimpel.material = M.akzent;
    wimpel.position.set(0, 0.63, 0.065);
    wimpel.rotation.y = Math.PI / 2;
    wimpel.name = 'wimpel';
    g.add(wimpel);
    g.add(licht(M, 0, 0.79, 0.0, 0.016));
    g.add(geschuetz(M, -0.3, 0.1, 0.05, 2, -1));
    return g;
  },
};

// ---------- echte 3D-Modelle (GLB) als zweite Flotte ----------
// Spaß-Flotte: Low-Poly-Schiffe von Quaternius (CC0). Bug zeigt nach dem Laden nach -z.
export const SAETZE = {
  spass: {
    // Elias' Boote von poly.pizza: Yacht (Alex Safayan, CC BY 3.0), Piratenschiff/Schlauchboot/Segelboot (Quaternius, CC0),
    // Kogge (Kenney, CC0), Schlepper („Some Random Person“, CC BY 3.0) – verkleinert mit werkzeug/glb_verkleinern.py
    k: { datei: 'modelle/spass/k.glb', laenge: 0.96, drehen: Math.PI / 2, name: 'Yacht' },
    q: { datei: 'modelle/spass/q.glb', laenge: 0.96, drehen: -Math.PI / 2, name: 'Piratenschiff' },
    r: { datei: 'modelle/spass/r.glb', laenge: 0.84, drehen: 0, name: 'Kogge' },
    b: { datei: 'modelle/spass/b.glb', laenge: 0.82, drehen: -Math.PI / 2, name: 'Schlepper' },
    // flache Boote liegen höher (sonst verschwinden sie in den Wellen)
    n: { datei: 'modelle/spass/n.glb', laenge: 0.62, drehen: 0, tiefgang: -0.04, name: 'Schlauchboot' },
    p: { datei: 'modelle/spass/p.glb', laenge: 0.56, drehen: 0, tiefgang: -0.025, name: 'Segelboot' },
  },
};
const modelle = { spass: {} };    // Satz -> typ -> fertig ausgerichtetes Modell
let aktiverSatz = 'kriegs';
export function setzeSatz(satz) { aktiverSatz = satz; }
export const satzGeladen = (satz) => satz === 'kriegs' || Object.keys(modelle[satz] || {}).length === 6;
const tints = { w: {}, b: {} }; // Materialkopien pro Seite und Original-Material
const tintFarbe = { w: null, b: null };

export async function ladeSatz(satz, basis = '') {
  if (satzGeladen(satz)) return true;
  const ergebnisse = await ladeModelle(Object.fromEntries(Object.entries(SAETZE[satz]).map(([t, e]) => [t, { ...e, datei: basis + e.datei }])), satz);
  return ergebnisse.every((e) => e.status === 'fulfilled');
}

export async function ladeModelle(liste, satz = 'spass') {
  const lader = new GLTFLoader();
  const ergebnisse = await Promise.allSettled(Object.entries(liste).map(async ([typ, eintrag]) => {
    const gltf = await lader.loadAsync(eintrag.datei);
    const szene = gltf.scene;
    // Ausrichten: Länge -> 0.92 Felder, Bug nach -z, Wasserlinie bei y = 0
    if (eintrag.drehen) szene.rotation.y = eintrag.drehen;
    szene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(szene);
    const groesse = box.getSize(new THREE.Vector3());
    const laenge = Math.max(groesse.x, groesse.z);
    const skala = (eintrag.laenge ?? 0.92) / laenge;
    const mitte = box.getCenter(new THREE.Vector3());
    const huelle = new THREE.Group();
    szene.position.set(-mitte.x * skala, -box.min.y * skala - (eintrag.tiefgang ?? 0.05), -mitte.z * skala);
    szene.scale.setScalar(skala);
    huelle.add(szene);
    szene.traverse((o) => { if (o.isMesh) { o.material.flatShading = true; o.material.needsUpdate = true; } });
    modelle[satz][typ] = huelle;
  }));
  for (const e of ergebnisse) if (e.status === 'rejected') console.warn('Modell fehlt:', e.reason);
  return ergebnisse;
}

// Material eines Modells für eine Seite einfärben (weiß = hell, schwarz = dunkel)
// Weiße Flotte behält die echten Farben (leicht getönt), schwarze Flotte wird dunkel eingefärbt
function toenung(f) { return f.hell ? new THREE.Color(f.rumpfHell) : new THREE.Color(f.aufbau).multiplyScalar(2.3); }
function getintet(original, farbe) {
  if (!tints[farbe][original.uuid]) {
    const m = original.clone();
    m.userData.original = original;
    if (tintFarbe[farbe]) m.color.copy(original.color).multiply(toenung(tintFarbe[farbe]));
    tints[farbe][original.uuid] = m;
  }
  return tints[farbe][original.uuid];
}
function aktualisiereModellFarben(farbe) {
  const f = tintFarbe[farbe];
  if (!f) return;
  const t = toenung(f);
  for (const m of Object.values(tints[farbe])) m.color.copy(m.userData.original.color).multiply(t);
}

// Ein Schiff bauen (aus dem aktiven Satz: Kriegsmarine = selbst gebaut, Spaß-Flotte = Modelle)
export function baueSchiff(typ, farbe) {
  const vorlage = modelle[aktiverSatz]?.[typ];
  let modell;
  const huelle = new THREE.Group();
  if (vorlage) {
    modell = vorlage.clone(true);
    modell.traverse((o) => {
      if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map((m) => getintet(m, farbe)) : getintet(o.material, farbe);
    });
    huelle.scale.set(1, 1.12, 1);
  } else {
    modell = BAUPLAN[typ](material(farbe));
    // etwas größer und höher, damit man die Schiffe auf dem Handy gut erkennt
    huelle.scale.set(1.08, 1.32, 1.08);
  }
  huelle.add(modell);
  return huelle;
}
