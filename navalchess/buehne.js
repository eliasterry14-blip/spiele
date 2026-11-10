// NAVAL CHESS – die 3D-Bühne: echtes Wasser als Brett, Kamera schräg von der Seite, schwimmende Schiffe, Effekte.
// Weltmaße: ein Feld = 1. Das Brett liegt von x = -4..4 und z = -4..4 auf dem Wasser (y = 0).
// Linie a liegt bei x = -3.5, Reihe 1 bei z = +3.5 (also bei der Kamera, wenn Weiß unten ist).
import * as THREE from './vendor/three.module.min.js';
import { baueSchiff, setzeFlotte, material, nachtLichter } from './flotte3d.js';

const glatt = (t) => t * t * (3 - 2 * t);
const zufall = (a, b) => a + Math.random() * (b - a);
function winkelDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

export function feldPos(feld, y = 0) {
  return new THREE.Vector3(feld.charCodeAt(0) - 97 - 3.5, y, 4.5 - +feld[1]);
}
function feldAusWelt(x, z) {
  const linie = Math.floor(x + 4);
  const reihe = Math.floor(4 - z) + 1;
  if (linie < 0 || linie > 7 || reihe < 1 || reihe > 8) return null;
  return String.fromCharCode(97 + linie) + reihe;
}

// ---------- Wellen: dieselben Zahlen im Shader (Wasser) und in JavaScript (Schiffe schwimmen darauf) ----------
// [Richtung x, Richtung z, Wellenzahl, Höhe, Tempo]
const WELLEN = [
  [1.0, 0.35, 0.9, 0.034, 1.1],
  [-0.55, 1.0, 1.35, 0.021, 1.45],
  [0.25, -1.0, 2.1, 0.012, 1.9],
  [-1.0, -0.4, 3.0, 0.007, 2.4],
  [0.7, 0.7, 4.4, 0.004, 3.0],
].map(([x, z, k, a, s]) => { const l = Math.hypot(x, z); return { dx: x / l, dz: z / l, k, a, s }; });
// feine Kräuselung nur für das Glitzern (keine Höhe)
const KRAEUSEL = [
  [0.8, -0.6, 9.0, 0.0028, 3.6], [-0.3, -0.95, 13.0, 0.0017, 4.2], [0.95, 0.3, 19.0, 0.0011, 5.1], [-0.7, 0.7, 27.0, 0.0007, 6.3],
].map(([x, z, k, a, s]) => { const l = Math.hypot(x, z); return { dx: x / l, dz: z / l, k, a, s }; });
export function wasserHoehe(x, z, t) {
  let h = 0;
  for (const w of WELLEN) h += w.a * Math.sin(w.k * (w.dx * x + w.dz * z) + w.s * t);
  return h;
}
const f = (n) => n.toFixed(4);
const GLSL_HOEHE = WELLEN.map((w) => `h += ${f(w.a)} * sin(${f(w.k)} * dot(vec2(${f(w.dx)}, ${f(w.dz)}), p) + ${f(w.s)} * uZeit);`).join('\n  ');
const steigung = (liste, ziel) => liste.map((w) => `${ziel} += vec2(${f(w.dx)}, ${f(w.dz)}) * (${f(w.a * w.k)} * cos(${f(w.k)} * dot(vec2(${f(w.dx)}, ${f(w.dz)}), p) + ${f(w.s)} * uZeit));`).join('\n  ');
const GLSL_STEIGUNG = steigung(WELLEN, 'g') + '\n  vec2 gk = vec2(0.0);\n  ' + steigung(KRAEUSEL, 'gk')
  // feine Kräuselung in der Ferne ausblenden (sonst flimmert es)
  + '\n  g += gk * (1.0 - smoothstep(uNebelNah * 0.45, uNebelNah * 1.2, length(uKamera - vWelt)));';

const WASSER_VERTEX = `
uniform float uZeit;
varying vec3 vWelt;
varying float vHoehe;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec2 p = w.xz;
  float h = 0.0;
  ${GLSL_HOEHE}
  w.y += h;
  vHoehe = h;
  vWelt = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WASSER_FRAGMENT = `
uniform float uZeit;
uniform vec3 uKamera;
uniform vec3 uLicht;
uniform vec3 uTief;
uniform vec3 uStreu;
uniform vec3 uHimmelOben;
uniform vec3 uHimmelHorizont;
uniform vec3 uSonne;
uniform vec3 uNebel;
uniform vec3 uFeldHell;
uniform vec3 uFeldDunkel;
uniform vec3 uTuerkis;
uniform vec3 uOrange;
uniform vec3 uRot;
uniform float uNebelNah;
uniform float uNebelFern;
uniform sampler2D uMarken;
uniform vec3 uLaterne;
uniform float uLaterneKraft;
varying vec3 vWelt;
varying float vHoehe;

void main() {
  vec2 p = vWelt.xz;
  vec2 g = vec2(0.0);
  ${GLSL_STEIGUNG}
  float imBrett = step(abs(p.x), 4.0) * step(abs(p.y), 4.0);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(uKamera - vWelt);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 r = reflect(-v, n);
  vec3 himmel = mix(uHimmelHorizont, uHimmelOben, clamp(r.y * 1.6, 0.0, 1.0));

  // Wasserfarbe: Wellenberge heller (Licht scheint durch), Täler tiefer
  vec3 wasser = mix(uTief, uStreu, clamp(vHoehe * 7.0 + 0.4, 0.0, 1.0) * 0.55);

  // Schachbrett: Felder sind helleres (flaches) und dunkleres (tiefes) Wasser
  vec2 fe = floor(p + 4.0);
  vec2 q = fract(p + 4.0) - 0.5;
  if (imBrett > 0.5) {
    float hell = 1.0 - mod(fe.x + fe.y, 2.0);
    vec3 feld = mix(uFeldDunkel, uFeldHell, hell);
    wasser = mix(wasser, feld * (0.88 + vHoehe * 3.0), 0.72);
    float kanteQ = max(abs(q.x), abs(q.y));
    wasser += uTuerkis * smoothstep(0.475, 0.5, kanteQ) * 0.06;
  }
  vec3 farbe = mix(wasser, himmel, fres * 0.85);

  // Sonnenglitzern
  float sp = max(dot(r, normalize(uLicht)), 0.0);
  farbe += uSonne * (pow(sp, 700.0) * 5.0 + pow(sp, 60.0) * 0.18);

  // Wellenkämme etwas heller (kein fleckiger Schaum)
  farbe += vec3(0.5, 0.75, 0.85) * smoothstep(0.03, 0.08, vHoehe) * 0.06;

  // warmer Schein der Laterne auf den Wellen (Menü)
  if (uLaterneKraft > 0.001) {
    vec3 zuL = uLaterne - vWelt;
    float lg = pow(max(dot(r, normalize(zuL)), 0.0), 40.0) * uLaterneKraft / (1.0 + dot(zuL, zuL) * 0.35);
    farbe += vec3(1.0, 0.62, 0.28) * lg * 2.2 + vec3(1.0, 0.6, 0.3) * uLaterneKraft * 0.06 / (1.0 + dot(zuL, zuL) * 1.5);
  }

  // Leuchtender Rand um das Brett
  float rand = max(abs(p.x), abs(p.y));
  farbe += uTuerkis * exp(-abs(rand - 4.0) * 30.0) * 0.55;

  // Markierungen (aus einer 8x8-Textur): R = Feld, G = Ziel
  if (imBrett > 0.5) {
    vec4 m = texture2D(uMarken, (fe + 0.5) / 8.0) * 255.0;
    float rq = length(q);
    float kanteQ = max(abs(q.x), abs(q.y));
    float rahmen = smoothstep(0.40, 0.44, kanteQ) * (1.0 - smoothstep(0.475, 0.5, kanteQ));
    float puls = 0.5 + 0.5 * sin(uZeit * 5.0);
    if (abs(m.r - 1.0) < 0.5) farbe += uTuerkis * 0.13;
    if (abs(m.r - 2.0) < 0.5) farbe = mix(farbe, uTuerkis, 0.22) + uTuerkis * rahmen * 0.9;
    if (abs(m.r - 3.0) < 0.5) farbe += vec3(0.9) * rahmen + 0.06;
    if (abs(m.r - 4.0) < 0.5) farbe = mix(farbe, uOrange, 0.22) + uOrange * rahmen * 0.9;
    if (abs(m.r - 5.0) < 0.5) farbe += uRot * (1.0 - smoothstep(0.0, 0.62, rq)) * (0.55 + 0.45 * puls);
    if (abs(m.r - 6.0) < 0.5) farbe += uOrange * rahmen * 0.55 + uOrange * 0.06;
    if (abs(m.g - 1.0) < 0.5) {
      float punkt = 1.0 - smoothstep(0.11, 0.135, rq);
      float welle = fract(uZeit * 0.65);
      float ring = (1.0 - smoothstep(0.0, 0.022, abs(rq - (0.13 + welle * 0.26)))) * (1.0 - welle);
      farbe = mix(farbe, uTuerkis * 1.15, punkt * 0.92) + uTuerkis * ring * 0.8;
    }
    if (abs(m.g - 2.0) < 0.5) {
      float ring = smoothstep(0.345, 0.365, rq) * (1.0 - smoothstep(0.44, 0.46, rq));
      farbe = mix(farbe, uTuerkis * 1.15, ring * 0.95);
    }
    if (abs(m.g - 3.0) < 0.5) {
      float w = uZeit * 0.8;
      vec2 qr = mat2(cos(w), -sin(w), sin(w), cos(w)) * q;
      float ring = 1.0 - smoothstep(0.0, 0.025, abs(rq - 0.3));
      float strich = (1.0 - smoothstep(0.012, 0.03, abs(qr.x))) * step(0.33, abs(qr.y)) * step(abs(qr.y), 0.46)
                   + (1.0 - smoothstep(0.012, 0.03, abs(qr.y))) * step(0.33, abs(qr.x)) * step(abs(qr.x), 0.46);
      float mitte = 1.0 - smoothstep(0.03, 0.045, rq);
      farbe = mix(farbe, uOrange * 1.2, clamp(ring + strich + mitte, 0.0, 1.0) * (0.8 + 0.2 * puls));
    }
  }

  float abstand = length(uKamera - vWelt);
  farbe = mix(farbe, uNebel, smoothstep(uNebelNah, uNebelFern, abstand));
  gl_FragColor = vec4(farbe, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------- Himmel: Abendverlauf mit Sonne – nachts Sterne, Milchstraße und Mond (alles im Shader) ----------
const HIMMEL_FRAGMENT = `
uniform vec3 uOben;
uniform vec3 uHorizont;
uniform vec3 uGlut;
uniform vec3 uSonne;
uniform float uNacht;
uniform float uZeit;
varying vec3 vR;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rauschen(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { s += a * rauschen(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 r = normalize(vR);
  float y = r.y;
  vec3 farbe = mix(uHorizont, uOben, pow(clamp(y, 0.0, 1.0), 0.42));
  float s = max(dot(r, normalize(uSonne)), 0.0);
  farbe += uGlut * (pow(s, 900.0) * 4.0 + pow(s, 40.0) * 0.45 + pow(s, 6.0) * 0.18) * (1.0 - uNacht * 0.55);
  if (uNacht > 0.01) {
    // Sterne: in jeder kleinen Himmelszelle vielleicht ein Stern, der funkelt
    vec3 q = r * 230.0;
    float h = hash(floor(q));
    float stern = step(0.9962, h) * smoothstep(0.5, 0.05, length(fract(q) - 0.5)) * (0.65 + 0.35 * sin(uZeit * (1.5 + h * 5.0) + h * 50.0));
    // Milchstraße: helles, wolkiges Band schräg über den Himmel
    vec3 achse = normalize(vec3(0.62, 0.42, 0.66));
    float band = 1.0 - smoothstep(0.0, 0.34, abs(dot(r, achse)));
    float wolke = fbm(r * 5.0 + 3.0) * band;
    float staub = step(0.982, hash(floor(r * 480.0))) * band;
    vec3 nacht = farbe + vec3(0.72, 0.78, 0.95) * (pow(wolke, 1.6) * 0.55 + staub * 0.45) + vec3(1.0, 0.98, 0.95) * stern * 1.5;
    farbe = mix(farbe, nacht, uNacht * smoothstep(-0.01, 0.1, y));
  }
  farbe = mix(farbe, uHorizont, smoothstep(0.035, -0.04, y));
  gl_FragColor = vec4(farbe, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------- Das Boot im Menü: Bug mit hohem Steven, Bank und Laterne (Blick aus dem Boot) ----------
function baueBoot() {
  const gruppe = new THREE.Group();
  const holz = new THREE.MeshStandardMaterial({ color: '#2a190e', roughness: 0.38, metalness: 0.1 });
  const holzHell = new THREE.MeshStandardMaterial({ color: '#46301d', roughness: 0.45 });
  const messing = new THREE.MeshStandardMaterial({ color: '#c9974a', roughness: 0.28, metalness: 0.9 });
  // Umriss von oben (Spitze vorne = +y, wird zu -z) – als Ring: außen Bordwand, innen offen
  const aussen = new THREE.Shape();
  aussen.moveTo(-0.72, -1.9); aussen.lineTo(-0.68, -0.5); aussen.quadraticCurveTo(-0.56, 0.6, 0, 1.55); aussen.quadraticCurveTo(0.56, 0.6, 0.68, -0.5); aussen.lineTo(0.72, -1.9); aussen.lineTo(-0.72, -1.9);
  const innen = new THREE.Path();
  innen.moveTo(-0.63, -1.8); innen.lineTo(-0.59, -0.5); innen.quadraticCurveTo(-0.47, 0.5, 0, 1.36); innen.quadraticCurveTo(0.47, 0.5, 0.59, -0.5); innen.lineTo(0.63, -1.8); innen.lineTo(-0.63, -1.8);
  aussen.holes.push(innen);
  const wand = new THREE.ExtrudeGeometry(aussen, { depth: 0.44, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 16 });
  wand.rotateX(-Math.PI / 2);
  const rumpf = new THREE.Mesh(wand, holz);
  rumpf.position.y = -0.32;
  const kante = new THREE.ExtrudeGeometry(aussen, { depth: 0.03, bevelEnabled: false, curveSegments: 16 });
  kante.rotateX(-Math.PI / 2);
  const reling = new THREE.Mesh(kante, holzHell);
  reling.position.y = 0.12;
  const bodenForm = new THREE.Shape(innen.getPoints(16));
  const bodenGeo = new THREE.ShapeGeometry(bodenForm);
  bodenGeo.rotateX(-Math.PI / 2);
  const boden = new THREE.Mesh(bodenGeo, new THREE.MeshStandardMaterial({ color: '#1e130b', roughness: 0.8 }));
  boden.position.y = -0.16;
  // hoher, nach hinten gebogener Steven vorne
  const kurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.08, -1.5), new THREE.Vector3(0, 0.36, -1.7), new THREE.Vector3(0, 0.62, -1.68), new THREE.Vector3(0, 0.78, -1.52)]);
  const steven = new THREE.Mesh(new THREE.TubeGeometry(kurve, 28, 0.034, 8, false), holz);
  const knauf = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), messing);
  knauf.position.set(0, 0.78, -1.52);
  // Bänke
  const bank1 = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.05, 0.22), holzHell);
  bank1.position.set(0, 0.0, -0.32);
  const bank2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.22), holzHell);
  bank2.position.set(0, 0.0, 0.75);
  // Laterne auf der vorderen Bank
  const laterne = new THREE.Group();
  laterne.position.set(0, 0.025, -0.32);
  const fuss = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.14), messing);
  fuss.position.y = 0.015;
  const glasMat = new THREE.MeshStandardMaterial({ color: '#ffd38a', emissive: '#ffae45', emissiveIntensity: 0, roughness: 0.2 });
  const glas = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), glasMat);
  glas.position.y = 0.1;
  laterne.add(fuss, glas);
  for (const [x, z] of [[-0.055, -0.055], [0.055, -0.055], [-0.055, 0.055], [0.055, 0.055]]) {
    const pfosten = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.012), messing);
    pfosten.position.set(x, 0.1, z);
    laterne.add(pfosten);
  }
  const dach = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.07, 4), messing);
  dach.rotation.y = Math.PI / 4;
  dach.position.y = 0.215;
  const griff = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 16), messing);
  griff.position.y = 0.27;
  laterne.add(dach, griff);
  const licht = new THREE.PointLight('#ffad55', 0, 6, 1.7);
  licht.position.y = 0.1;
  laterne.add(licht);
  const schein = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glut, color: '#ffb15a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  schein.scale.setScalar(0.7);
  schein.position.y = 0.1;
  laterne.add(schein);
  gruppe.add(rumpf, reling, boden, steven, knauf, bank1, bank2, laterne);
  return { gruppe, licht, glasMat, schein, laterne };
}

// ---------- Texturen (weicher Kreis, Ring, Schatten, Glut) ----------
function textur(zeichnen, groesse = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = groesse;
  zeichnen(c.getContext('2d'), groesse);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TEX = {};
function texturen() {
  const radial = (stops) => (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); for (const [o, c] of stops) r.addColorStop(o, c); g.fillStyle = r; g.fillRect(0, 0, s, s); };
  TEX.weich = textur(radial([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']]));
  TEX.schaum = textur((g, s) => {
    radial([[0, 'rgba(255,255,255,.9)'], [0.55, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']])(g, s);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 22; i++) { g.beginPath(); g.arc(Math.random() * s, Math.random() * s, Math.random() * s * 0.12, 0, Math.PI * 2); g.fill(); }
  });
  TEX.ring = textur((g, s) => { g.strokeStyle = '#fff'; g.lineWidth = s * 0.08; g.beginPath(); g.arc(s / 2, s / 2, s * 0.38, 0, Math.PI * 2); g.stroke(); });
  TEX.schatten = textur(radial([[0, 'rgba(0,8,18,.7)'], [1, 'rgba(0,8,18,0)']]));
  TEX.glut = textur(radial([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]), 128);
  TEX.oel = textur(radial([[0, 'rgba(5,8,12,.75)'], [0.7, 'rgba(5,8,12,.4)'], [1, 'rgba(5,8,12,0)']]));
}

export function erstelleBuehne(huelle, { tempo = (ms) => ms, ereignis = () => {} } = {}) {
  texturen();
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = 'leinwand';
  huelle.prepend(renderer.domElement);

  const szene = new THREE.Scene();
  const NEBEL = new THREE.Color('#2b5a86');
  szene.background = NEBEL;
  szene.fog = new THREE.Fog(NEBEL, 16, 46);
  const SONNE = new THREE.Vector3(0.18, 0.1, -1).normalize();

  // Himmel (Shader oben: HIMMEL_FRAGMENT)
  const himmelU = { uOben: { value: new THREE.Color('#061a35') }, uHorizont: { value: NEBEL }, uGlut: { value: new THREE.Color('#ffb877') }, uSonne: { value: SONNE }, uNacht: { value: 0 }, uZeit: { value: 0 } };
  const himmel = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: himmelU,
    vertexShader: 'varying vec3 vR; void main() { vR = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: HIMMEL_FRAGMENT,
  }));
  himmel.renderOrder = -1;
  szene.add(himmel);

  // Licht: Himmelslicht + tief stehende Sonne von vorne + Kantenlicht von hinten
  const lichter = new THREE.Group();
  const hemi = new THREE.HemisphereLight('#bfe4ff', '#0b2a4a', 1.2);
  lichter.add(hemi);
  const haupt = new THREE.DirectionalLight('#fff1dc', 2.4);
  haupt.position.set(-4, 9, 7);
  lichter.add(haupt);
  const kante = new THREE.DirectionalLight('#ffd0a0', 1.4);
  kante.position.set(2, 2, -9);
  lichter.add(kante);
  szene.add(lichter);
  const blitzLicht = new THREE.PointLight('#ffb35c', 0, 7, 1.6);
  szene.add(blitzLicht);

  // ---------- Wasser ----------
  const marken = new Uint8Array(64 * 4);
  const markenTex = new THREE.DataTexture(marken, 8, 8, THREE.RGBAFormat);
  markenTex.magFilter = THREE.NearestFilter;
  markenTex.minFilter = THREE.NearestFilter;
  markenTex.needsUpdate = true;
  const U = {
    uZeit: { value: 0 }, uKamera: { value: new THREE.Vector3() }, uLicht: { value: new THREE.Vector3(0.25, 0.3, -1) },
    uTief: { value: new THREE.Color('#032039') }, uStreu: { value: new THREE.Color('#126a86') },
    uHimmelOben: { value: new THREE.Color('#0b2546') }, uHimmelHorizont: { value: new THREE.Color('#3f74a3') },
    uSonne: { value: new THREE.Color('#ffd9a8') }, uNebel: { value: NEBEL },
    uFeldHell: { value: new THREE.Color('#2a86b4') }, uFeldDunkel: { value: new THREE.Color('#0b3762') },
    uTuerkis: { value: new THREE.Color('#2fe3c2') }, uOrange: { value: new THREE.Color('#ff7a3d') }, uRot: { value: new THREE.Color('#ff3b4a') },
    uNebelNah: { value: 16 }, uNebelFern: { value: 46 }, uMarken: { value: markenTex },
    uLaterne: { value: new THREE.Vector3() }, uLaterneKraft: { value: 0 },
  };
  const wasser = new THREE.Mesh(new THREE.PlaneGeometry(64, 64, 256, 256), new THREE.ShaderMaterial({ uniforms: U, vertexShader: WASSER_VERTEX, fragmentShader: WASSER_FRAGMENT }));
  wasser.rotation.x = -Math.PI / 2;
  wasser.position.z = -10;
  szene.add(wasser);
  const fern = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: NEBEL, fog: true }));
  fern.rotation.x = -Math.PI / 2;
  fern.position.y = -0.2;
  szene.add(fern);

  // ---------- Tag (Abendsonne) und Nacht (Sterne, Mond) ----------
  const FARBEN = {
    tag: { nebel: '#2b5a86', oben: '#061a35', glut: '#ffb877', tief: '#032039', streu: '#126a86', hOben: '#0b2546', hHor: '#3f74a3', sonne: '#ffd9a8', hell: '#2a86b4', dunkel: '#0b3762', haupt: '#fff1dc', hemi: 1.2, hauptI: 2.4, kanteI: 1.4 },
    nacht: { nebel: '#0a1524', oben: '#010308', glut: '#a9bfe0', tief: '#010811', streu: '#0b3046', hOben: '#03070f', hHor: '#1b2c42', sonne: '#dbe6f7', hell: '#20698f', dunkel: '#08294a', haupt: '#c4d4ff', hemi: 0.8, hauptI: 1.8, kanteI: 1.0 },
  };
  const FT = Object.fromEntries(Object.entries(FARBEN.tag).map(([k, v]) => [k, typeof v === 'string' ? new THREE.Color(v) : v]));
  const FN = Object.fromEntries(Object.entries(FARBEN.nacht).map(([k, v]) => [k, typeof v === 'string' ? new THREE.Color(v) : v]));
  let nacht = 0;
  function farbenAnwenden() {
    const n = nacht;
    const c = (k, ziel) => ziel.lerpColors(FT[k], FN[k], n);
    c('nebel', NEBEL);
    szene.fog.color.copy(NEBEL);
    fern.material.color.copy(NEBEL);
    c('oben', himmelU.uOben.value);
    c('glut', himmelU.uGlut.value);
    himmelU.uNacht.value = n;
    c('tief', U.uTief.value); c('streu', U.uStreu.value); c('hOben', U.uHimmelOben.value); c('hHor', U.uHimmelHorizont.value);
    c('sonne', U.uSonne.value); c('hell', U.uFeldHell.value); c('dunkel', U.uFeldDunkel.value);
    c('haupt', haupt.color);
    hemi.intensity = FT.hemi + (FN.hemi - FT.hemi) * n;
    haupt.intensity = FT.hauptI + (FN.hauptI - FT.hauptI) * n;
    kante.intensity = FT.kanteI + (FN.kanteI - FT.kanteI) * n;
    nachtLichter(n);
  }
  function setzeNacht(an, animiert = true) {
    const ziel = an ? 1 : 0;
    if (!animiert) { nacht = ziel; farbenAnwenden(); return Promise.resolve(); }
    const start = nacht;
    return tween(tempo(1400), (t) => { nacht = start + (ziel - start) * glatt(t); farbenAnwenden(); });
  }

  // Bojenkette um das Brett: kleine Schwimmer an jeder Feldecke, große Bojen an den Ecken
  const schwimmerPos = [];
  for (let i = -4; i <= 4; i++) for (const [x, z] of [[i, -4.12], [i, 4.12], [-4.12, i], [4.12, i]]) if (Math.abs(i) < 4) schwimmerPos.push([x, z]);
  const schwimmer = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: '#e9f4f8', emissive: '#2fe3c2', emissiveIntensity: 0.35, roughness: 0.4 }), schwimmerPos.length);
  szene.add(schwimmer);
  const hilfsObjekt = new THREE.Object3D();
  const bojen = [];
  for (const [x, z, farbe] of [[-4.3, 4.3, '#ff4d5e'], [4.3, 4.3, '#5dff9a'], [-4.3, -4.3, '#ff4d5e'], [4.3, -4.3, '#5dff9a']]) {
    const b = new THREE.Group();
    const koerper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.1, 0.24, 12), new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.5, flatShading: true }));
    koerper.position.y = 0.06;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.05, 12), new THREE.MeshStandardMaterial({ color: '#f2f5f7', roughness: 0.5 }));
    band.position.y = 0.05;
    const lampe = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: farbe, emissive: farbe, emissiveIntensity: 2 }));
    lampe.position.y = 0.21;
    b.add(koerper, band, lampe);
    b.position.set(x, 0, z);
    szene.add(b);
    bojen.push({ b, lampe, x, z });
  }

  // ---------- Kamera: Spiel-Ansicht (schräg über dem Brett) und Menü-Ansicht (im Boot mit Laterne) ----------
  const kamera = new THREE.PerspectiveCamera(48, 1, 0.1, 700);
  const blick = { azimut: 0, hoehe: THREE.MathUtils.degToRad(50), abstand: 16, ziel: new THREE.Vector3(0, 0, 0.15), beben: 0 };
  let freiraum = null;
  const versatz = { x: 0, y: 0 };   // Verschiebung, damit das Brett im freien Bereich zwischen den Leisten sitzt
  let mischung = 0;                 // 0 = Menü (im Boot), 1 = Spiel (über dem Brett)
  let leinwandB = 1;
  let leinwandH = 1;
  const boot = baueBoot();
  boot.gruppe.position.set(0, 0, 66);
  szene.add(boot.gruppe);
  let laterneAn = 0;
  const pose = () => ({ pos: new THREE.Vector3(), ziel: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 48, vx: 0, vy: 0 });
  const PS = pose();
  const PM = pose();
  const PJ = pose();
  const hilf = new THREE.Vector3();
  const bogenPunkt = new THREE.Vector3();
  // was der Spieler selbst an der Kamera verstellt (drehen, kippen, zoomen, verschieben)
  const benutzer = { azimut: 0, hoehe: 0, zoom: 1, x: 0, z: 0 };
  const OHNE = { azimut: 0, hoehe: 0, zoom: 1, x: 0, z: 0 };
  function poseSpiel(o, mitBenutzer = true) {
    const b = mitBenutzer ? benutzer : OHNE;
    const azimut = blick.azimut + b.azimut;
    const hoehe = THREE.MathUtils.clamp(blick.hoehe + b.hoehe, 0.2, 1.45);
    const abstand = blick.abstand * b.zoom;
    const zx = blick.ziel.x + b.x;
    const zz = blick.ziel.z + b.z;
    o.pos.set(zx + Math.sin(azimut) * Math.cos(hoehe) * abstand, blick.ziel.y + Math.sin(hoehe) * abstand, zz + Math.cos(azimut) * Math.cos(hoehe) * abstand);
    o.ziel.set(zx, blick.ziel.y, zz);
    o.up.set(0, 1, 0);
    o.fov = 48;
    o.vx = versatz.x;
    o.vy = versatz.y;
  }
  function poseMenue(o) {
    const b = boot.gruppe;
    b.updateMatrixWorld();
    // etwas links neben der Mitte sitzen: Boot und Laterne rechts, die Menü-Schrift links bleibt frei
    o.pos.copy(b.localToWorld(hilf.set(-0.42, 1.02, 2.15)));
    o.ziel.copy(b.localToWorld(hilf.set(-0.95, 1.12, -8)));
    o.up.set(0, 1, 0).applyQuaternion(b.quaternion);
    o.fov = 64;
    o.vx = 0;
    o.vy = 0;
  }
  let letzteProj = '';
  let letzteSicht = true;
  function kameraSetzen() {
    poseSpiel(PS);
    let P = PS;
    const k = mischung;
    if (k < 0.9999) {
      poseMenue(PM);
      if (k <= 0.0001) P = PM;
      else {
        // Flug im Bogen über das Wasser: vom Boot zum Brett
        bogenPunkt.copy(PM.pos).lerp(PS.pos, 0.5);
        bogenPunkt.y = Math.max(PM.pos.y, PS.pos.y) + 4;
        PJ.pos.copy(PM.pos).multiplyScalar((1 - k) * (1 - k)).addScaledVector(bogenPunkt, 2 * k * (1 - k)).addScaledVector(PS.pos, k * k);
        PJ.ziel.lerpVectors(PM.ziel, PS.ziel, glatt(k));
        PJ.up.lerpVectors(PM.up, PS.up, k).normalize();
        PJ.fov = PM.fov + (PS.fov - PM.fov) * k;
        PJ.vx = PS.vx * k;
        PJ.vy = PS.vy * k;
        P = PJ;
      }
    }
    kamera.position.copy(P.pos);
    if (blick.beben > 0) kamera.position.add(hilf.set(zufall(-1, 1), zufall(-1, 1), zufall(-1, 1)).multiplyScalar(blick.beben * 0.07));
    kamera.up.copy(P.up);
    kamera.lookAt(P.ziel);
    const sig = `${P.fov.toFixed(2)}|${P.vx.toFixed(1)}|${P.vy.toFixed(1)}|${leinwandB}x${leinwandH}`;
    if (sig !== letzteProj) {
      letzteProj = sig;
      kamera.fov = P.fov;
      kamera.aspect = leinwandB / leinwandH;
      if (P.vx || P.vy) kamera.setViewOffset(leinwandB, leinwandH, P.vx, P.vy, leinwandB, leinwandH); else kamera.clearViewOffset();
      kamera.updateProjectionMatrix();
    }
    const az = (blick.azimut + benutzer.azimut) * k;
    lichter.rotation.y = az;
    // Beschriftung umdrehen, wenn man von der anderen Seite schaut
    const weissSicht = Math.abs(winkelDiff(blick.azimut + benutzer.azimut, 0)) < Math.PI / 2;
    if (weissSicht !== letzteSicht) { letzteSicht = weissSicht; if (beschriftung) beschriften(); }
    // Sonne/Mond steht vorne am Horizont (gegenüber der Kamera) -> Glitzerpfad auf dem Wasser
    SONNE.set(0.18, 0.1 + nacht * 0.05, -1).applyAxisAngle(hilf.set(0, 1, 0), az).normalize();
    U.uLicht.value.copy(SONNE);
    himmel.position.copy(kamera.position);
    // Nebel: im Menü weit, über dem Brett wie berechnet
    const nah = 12 + (blick.abstand + 4 - 12) * k;
    const fern = 44 + (blick.abstand + 34 - 44) * k;
    U.uNebelNah.value = nah;
    U.uNebelFern.value = fern;
    szene.fog.near = nah;
    szene.fog.far = fern;
  }
  const PROBE = [];
  for (const x of [-4.45, 4.45]) for (const z of [-4.45, 4.45]) PROBE.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x * 0.92, 0.8, z * 0.92));
  function rahmen(w, h) {
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const p of PROBE) {
      v.copy(p).project(kamera);
      const x = (v.x + 1) / 2 * w;
      const y = (1 - v.y) / 2 * h;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return { minX, maxX, minY, maxY };
  }
  // Brett so groß wie möglich in den freien Bereich zwischen den Leisten einpassen
  function passe() {
    const w = huelle.clientWidth;
    const h = huelle.clientHeight;
    if (!w || !h) return;
    leinwandB = w;
    leinwandH = h;
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    kamera.fov = 48;
    kamera.clearViewOffset();
    kamera.updateProjectionMatrix();
    const fr = freiraum || { x: 0, y: 0, w, h };
    const merk = blick.azimut;
    blick.azimut = 0;
    const probe = () => { poseSpiel(PS, false); kamera.position.copy(PS.pos); kamera.up.set(0, 1, 0); kamera.lookAt(PS.ziel); kamera.updateMatrixWorld(); return rahmen(w, h); };
    let lo = 4;
    let hi = 140;
    for (let i = 0; i < 30; i++) {
      blick.abstand = (lo + hi) / 2;
      const r = probe();
      if (r.maxX - r.minX <= fr.w * 0.98 && r.maxY - r.minY <= fr.h * 0.98) hi = blick.abstand; else lo = blick.abstand;
    }
    blick.abstand = hi;
    const r = probe();
    versatz.x = (r.minX + r.maxX) / 2 - (fr.x + fr.w / 2);
    versatz.y = (r.minY + r.maxY) / 2 - (fr.y + fr.h / 2);
    blick.azimut = merk;
    letzteProj = '';
    kameraSetzen();
  }

  // ---------- Beschriftung (a–h, 1–8) ----------
  const beschriftung = new THREE.Group();
  szene.add(beschriftung);
  const schriftCache = {};
  function schriftMaterial(text) {
    if (!schriftCache[text]) {
      const t = textur((g, s) => { g.fillStyle = 'rgba(220,246,255,.9)'; g.shadowColor = 'rgba(0,10,25,.9)'; g.shadowBlur = s * 0.08; g.font = `800 ${s * 0.6}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, s / 2, s / 2 + s * 0.04); });
      schriftCache[text] = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, fog: false });
    }
    return schriftCache[text];
  }
  const schriftGeo = new THREE.PlaneGeometry(0.32, 0.32);
  function beschriften() {
    beschriftung.clear();
    const weiss = Math.abs(winkelDiff(blick.azimut + benutzer.azimut, 0)) < Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      for (const [text, x, z] of [[String.fromCharCode(97 + i), i - 3.5, weiss ? 4.42 : -4.42], [String(i + 1), weiss ? -4.42 : 4.42, 4.5 - (i + 1)]]) {
        const m = new THREE.Mesh(schriftGeo, schriftMaterial(text));
        m.rotation.set(-Math.PI / 2, 0, weiss ? 0 : Math.PI);
        m.position.set(x, 0.06, z);
        m.renderOrder = 5;
        beschriftung.add(m);
      }
    }
  }

  // ---------- Tweens ----------
  const tweens = [];
  function tween(dauer, update) {
    return new Promise((ok) => tweens.push({ start: performance.now(), dauer: Math.max(1, dauer), update, ok }));
  }
  const warte = (ms) => tween(ms, () => {});
  const uhr = { zeit: 0 };
  const hoehe = (x, z) => wasserHoehe(x, z, uhr.zeit);

  // ---------- Teilchen (in der Luft: Sprites) ----------
  const teilchen = [];
  function teilchenNeu(pos, { farbe = '#ffffff', groesse = 0.1, wachsen = 0.2, leben = 1, v = null, schwerkraft = 0, deckkraft = 0.85, additiv = false, tex = TEX.weich, boden = -Infinity } = {}) {
    if (teilchen.length > 450) return;
    const mat = new THREE.SpriteMaterial({ map: tex, color: farbe, transparent: true, depthWrite: false, opacity: deckkraft, blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.scale.setScalar(groesse);
    szene.add(s);
    teilchen.push({ s, v: v || new THREE.Vector3(), alter: 0, leben, groesse, wachsen, schwerkraft, deckkraft, boden });
  }
  // ---------- Schaum (flach auf dem Wasser, schwimmt mit den Wellen) ----------
  const schaum = [];
  const schaumGeo = new THREE.PlaneGeometry(1, 1);
  function schaumNeu(x, z, { groesse = 0.16, wachsen = 0.35, leben = 1.4, deckkraft = 0.55, tex = TEX.schaum, dreh = zufall(0, 6.3), farbe = '#ffffff', additiv = false } = {}) {
    if (schaum.length > 260) return;
    const m = new THREE.Mesh(schaumGeo, new THREE.MeshBasicMaterial({ map: tex, color: farbe, transparent: true, depthWrite: false, opacity: deckkraft, blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending }));
    m.rotation.set(-Math.PI / 2, 0, dreh);
    m.position.set(x, hoehe(x, z) + 0.02, z);
    m.scale.setScalar(groesse);
    szene.add(m);
    schaum.push({ m, alter: 0, leben, groesse, wachsen, deckkraft });
  }
  function wellenring(pos, { groesse = 0.75, leben = 0.95 } = {}) { schaumNeu(pos.x, pos.z, { tex: TEX.ring, groesse: 0.1, wachsen: groesse * 1.6, leben, deckkraft: 0.7, dreh: 0 }); }
  function spritzer(pos, anzahl = 10, staerke = 1) {
    for (let i = 0; i < anzahl; i++) {
      const w = zufall(0, Math.PI * 2);
      const r = zufall(0.4, 1.1) * staerke;
      teilchenNeu(new THREE.Vector3(pos.x, 0.06, pos.z), { groesse: zufall(0.05, 0.09), wachsen: -0.03, leben: zufall(0.55, 0.9), v: new THREE.Vector3(Math.cos(w) * r, zufall(1.4, 2.6) * staerke, Math.sin(w) * r), schwerkraft: 6, deckkraft: 0.95, boden: 0.0 });
    }
    wellenring(pos);
    for (let i = 0; i < 5; i++) schaumNeu(pos.x + zufall(-0.2, 0.2), pos.z + zufall(-0.2, 0.2), { groesse: 0.2, wachsen: 0.4, leben: 1.6 });
  }
  function blasen(pos, anzahl = 8, streu = 0.25) {
    for (let i = 0; i < anzahl; i++) {
      const x = pos.x + zufall(-streu, streu);
      const z = pos.z + zufall(-streu, streu);
      schaumNeu(x, z, { tex: TEX.ring, groesse: zufall(0.03, 0.07), wachsen: zufall(0.04, 0.1), leben: zufall(0.5, 1.0), deckkraft: 0.85, dreh: 0 });
    }
  }
  function rauch(pos, anzahl = 6, dunkel = false) {
    for (let i = 0; i < anzahl; i++) {
      teilchenNeu(new THREE.Vector3(pos.x + zufall(-0.12, 0.12), pos.y + zufall(0, 0.15), pos.z + zufall(-0.12, 0.12)), { farbe: dunkel ? '#353b43' : '#9aa8b4', groesse: zufall(0.18, 0.3), wachsen: zufall(0.5, 0.9), leben: zufall(1.3, 2.2), v: new THREE.Vector3(zufall(-0.1, 0.1), zufall(0.35, 0.65), zufall(-0.1, 0.1)), deckkraft: dunkel ? 0.7 : 0.5 });
    }
  }
  function explosion(pos, { wasserSaeule = false } = {}) {
    ereignis('explosion');
    const p = new THREE.Vector3(pos.x, 0.2, pos.z);
    teilchenNeu(p, { farbe: '#fff2c4', groesse: 0.5, wachsen: 1.8, leben: 0.32, additiv: true, tex: TEX.glut, deckkraft: 1 });
    for (let i = 0; i < 16; i++) {
      const w = zufall(0, Math.PI * 2);
      teilchenNeu(p.clone(), { farbe: i % 2 ? '#ffb347' : '#ff6a3d', groesse: zufall(0.14, 0.26), wachsen: 0.25, leben: zufall(0.4, 0.75), additiv: true, v: new THREE.Vector3(Math.cos(w) * zufall(0.6, 1.6), zufall(0.6, 2.2), Math.sin(w) * zufall(0.6, 1.6)), schwerkraft: 2.5, deckkraft: 1 });
    }
    for (let i = 0; i < 12; i++) {
      const w = zufall(0, Math.PI * 2);
      teilchenNeu(p.clone(), { farbe: '#1c2128', groesse: zufall(0.03, 0.06), wachsen: 0, leben: zufall(0.7, 1.1), v: new THREE.Vector3(Math.cos(w) * zufall(1, 2.4), zufall(1.5, 3.2), Math.sin(w) * zufall(1, 2.4)), schwerkraft: 7, deckkraft: 1, boden: 0.0 });
    }
    if (wasserSaeule) {
      for (let i = 0; i < 22; i++) teilchenNeu(new THREE.Vector3(pos.x + zufall(-0.12, 0.12), 0.05, pos.z + zufall(-0.12, 0.12)), { groesse: zufall(0.12, 0.24), wachsen: 0.3, leben: zufall(0.8, 1.25), v: new THREE.Vector3(zufall(-0.3, 0.3), zufall(2.6, 4.4), zufall(-0.3, 0.3)), schwerkraft: 6.5, deckkraft: 0.9, boden: 0.0 });
    }
    setTimeout(() => rauch(p, 7, true), 120);
    spritzer(pos, 12, 1.2);
    wellenring(pos, { groesse: 1.3, leben: 1.3 });
    schaumNeu(pos.x, pos.z, { tex: TEX.oel, groesse: 0.3, wachsen: 0.9, leben: 4.5, deckkraft: 0.6 });
    blitzLicht.position.set(pos.x, 0.8, pos.z);
    tween(tempo(650), (t) => { blitzLicht.intensity = (1 - t) * 16; });
    tween(tempo(380), (t) => { blick.beben = 1 - t; });
  }

  // ---------- Schiffe ----------
  const schiffe = new Map();
  const alle = new Set();
  const RING_GROESSE = { k: [0.2, 0.55], q: [0.2, 0.54], r: [0.18, 0.5], b: [0.16, 0.47], n: [0.14, 0.42], p: [0.15, 0.34] };
  // Wie stark folgt das Schiff den Wellen? (große Schiffe liegen ruhiger)
  const TRAEGHEIT = { k: 0.55, q: 0.55, r: 0.7, b: 0.8, n: 0.75, p: 1.0 };
  const ringGeoSchiff = new THREE.RingGeometry(0.82, 1, 40);
  const schattenGeo = new THREE.PlaneGeometry(1, 1);
  const schattenMat = new THREE.MeshBasicMaterial({ map: TEX.schatten, transparent: true, depthWrite: false });
  const trefferGeo = new THREE.BoxGeometry(0.44, 0.75, 0.92);
  const trefferBoxen = [];

  function neuesSchiff(feld, farbe, typ) {
    const gruppe = new THREE.Group();
    const kipp = new THREE.Group();
    const modell = baueSchiff(typ, farbe);
    const [rb, rl] = RING_GROESSE[typ];
    const ring = new THREE.Mesh(ringGeoSchiff, material(farbe).ring);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    ring.scale.set(rb, rl, 1);
    const schatten = new THREE.Mesh(schattenGeo, schattenMat);
    schatten.rotation.x = -Math.PI / 2;
    schatten.position.y = 0.006;
    schatten.scale.set(rb * 2.5, rl * 2.3, 1);
    kipp.add(modell, ring, schatten);
    const box = new THREE.Mesh(trefferGeo);
    box.visible = false;
    box.position.y = 0.3;
    gruppe.add(kipp, box);
    gruppe.position.copy(feldPos(feld));
    // Seitenansicht: Weiß fährt nach rechts (+x), Schwarz nach links – man sieht die Schiffe von der Seite
    const yaw = farbe === 'w' ? -Math.PI / 2 : Math.PI / 2;
    gruppe.rotation.y = yaw;
    szene.add(gruppe);
    const e = { gruppe, kipp, modell, ring, schatten, box, farbe, typ, feld, yaw, phase: zufall(0, 20), tauchen: 0, heben: 0, hebenZiel: 0, wahl: 0, wahlZiel: 0, sinkt: false, krengung: 0, nicken: 0, letzteRichtung: yaw, glattY: 0, glattP: 0, glattR: 0 };
    box.userData.eintrag = e;
    trefferBoxen.push(box);
    alle.add(e);
    return e;
  }
  function entferne(e) {
    szene.remove(e.gruppe);
    alle.delete(e);
    const i = trefferBoxen.indexOf(e.box);
    if (i >= 0) trefferBoxen.splice(i, 1);
  }

  // Bugwelle und Kielwasser während der Fahrt
  function fahrtSchaum(e, vorX, vorZ, staerke) {
    const p = e.gruppe.position;
    const seitX = -vorZ;
    const seitZ = vorX;
    const l = 0.4;
    // Kielwasser hinten
    schaumNeu(p.x - vorX * l + zufall(-0.03, 0.03), p.z - vorZ * l + zufall(-0.03, 0.03), { groesse: 0.12, wachsen: 0.5 * staerke, leben: 1.6, deckkraft: 0.55 * staerke });
    // Bugwelle: zwei Schaumstreifen schräg nach außen
    for (const s of [-1, 1]) {
      if (Math.random() < 0.7) schaumNeu(p.x + vorX * l * 0.8 + seitX * s * 0.09, p.z + vorZ * l * 0.8 + seitZ * s * 0.09, { groesse: 0.07, wachsen: 0.28 * staerke, leben: 0.9, deckkraft: 0.6 * staerke });
    }
  }

  // Normale Fahrt: anfahren, in Fahrtrichtung drehen (mit Krängung), fahren, abbremsen, zurückdrehen
  function fahrt(e, ziel, dauer) {
    const start = e.gruppe.position.clone();
    const d = ziel.clone().sub(start);
    const weite = Math.hypot(d.x, d.z);
    dauer = dauer ?? tempo(Math.min(1250, 520 + weite * 140));
    let richtung = Math.atan2(-d.x, -d.z);
    let delta = winkelDiff(richtung, e.yaw);
    let rueckwaerts = false;
    if (Math.abs(delta) > 2.0) { richtung += Math.PI; delta = winkelDiff(richtung, e.yaw); rueckwaerts = true; }
    const vorX = weite ? d.x / weite : 0;
    const vorZ = weite ? d.z / weite : 0;
    let letzteGischt = 0;
    let vorherDreh = 0;
    let vorherT = 0;
    // Tempo-Verlauf: sanft anfahren, gleiten, sanft abbremsen
    const weg = (t) => (t < 0.35 ? 0.5 * (t / 0.35) ** 2 * 0.35 / 0.65 : t > 0.65 ? 1 - 0.5 * ((1 - t) / 0.35) ** 2 * 0.35 / 0.65 : (0.175 + (t - 0.35)) / 0.65);
    return tween(dauer, (t) => {
      e.gruppe.position.lerpVectors(start, ziel, weg(t));
      const bogen = t < 0.22 ? glatt(t / 0.22) : t > 0.78 ? glatt((1 - t) / 0.22) : 1;
      const dreh = delta * bogen;
      e.gruppe.rotation.y = e.yaw + dreh;
      // Krängung: in der Drehung legt sich das Schiff zur Seite, beim Anfahren hebt sich der Bug
      const dt = Math.max(1e-3, t - vorherT);
      const drehTempo = (dreh - vorherDreh) / dt;
      vorherDreh = dreh;
      vorherT = t;
      e.krengung += (THREE.MathUtils.clamp(-drehTempo * 0.025, -0.22, 0.22) - e.krengung) * 0.25;
      const schub = t < 0.35 ? 1 : t > 0.65 ? -1 : 0.3;
      e.nicken += ((rueckwaerts ? -1 : 1) * schub * 0.05 - e.nicken) * 0.15;
      const speed = t > 0.1 && t < 0.92 ? Math.min(1, weite / 2 + 0.4) : 0;
      if (weite > 0.1 && speed > 0 && performance.now() - letzteGischt > 40) {
        letzteGischt = performance.now();
        const fx = rueckwaerts ? -vorX : vorX;
        const fz = rueckwaerts ? -vorZ : vorZ;
        fahrtSchaum(e, fx, fz, speed);
      }
      if (t >= 1) { e.krengung = 0; e.nicken = 0; }
    });
  }
  // U-Boot: abtauchen (Bug zuerst), unter Wasser fahren, auftauchen (Bug zuerst)
  function tauchfahrt(e, ziel) {
    const start = e.gruppe.position.clone();
    const dauer = tempo(1350);
    let b1 = false;
    let b2 = false;
    let letzte = 0;
    return tween(dauer, (t) => {
      if (t < 0.3) { const k = glatt(t / 0.3); e.tauchen = k; e.nicken = -0.35 * Math.sin(k * Math.PI); }
      else if (t < 0.7) { e.tauchen = 1; e.nicken = 0; e.gruppe.position.lerpVectors(start, ziel, glatt((t - 0.3) / 0.4)); }
      else { const k = glatt((t - 0.7) / 0.3); e.tauchen = 1 - k; e.nicken = 0.35 * Math.sin(k * Math.PI); e.gruppe.position.copy(ziel); }
      if (!b1 && t > 0.12) { b1 = true; blasen(start, 12); wellenring(start); }
      if (!b2 && t > 0.72) { b2 = true; blasen(ziel, 14); wellenring(ziel); spritzer(ziel, 6, 0.6); }
      if (t > 0.3 && t < 0.7 && performance.now() - letzte > 55) { letzte = performance.now(); blasen(e.gruppe.position, 2, 0.08); }
      if (t >= 1) e.nicken = 0;
    });
  }
  // Untergang: Schlagseite, Bug hebt sich, Schiff gleitet nach unten, Blasen und Ölfleck
  function versenke(e, schnell = false) {
    if (!e || e.sinkt) return;
    e.sinkt = true;
    const i = trefferBoxen.indexOf(e.box);
    if (i >= 0) trefferBoxen.splice(i, 1);
    const seite = Math.random() < 0.5 ? -1 : 1;
    const p = e.gruppe.position.clone();
    const y0 = e.kipp.position.y;
    rauch(new THREE.Vector3(p.x, 0.25, p.z), 5, true);
    schaumNeu(p.x, p.z, { tex: TEX.oel, groesse: 0.25, wachsen: 0.8, leben: 5, deckkraft: 0.55 });
    let letzte = 0;
    tween(tempo(schnell ? 1000 : 1900), (t) => {
      e.kipp.rotation.z = seite * 0.6 * glatt(Math.min(1, t * 1.6));
      e.kipp.rotation.x = 0.5 * glatt(Math.min(1, t * 1.2));
      e.kipp.position.y = y0 - 1.3 * t * t;
      if (performance.now() - letzte > 80) { letzte = performance.now(); blasen(p, 3, 0.2); }
    }).then(() => entferne(e));
  }
  function auftauchen(e, verzoegerung = 0) {
    e.tauchen = 1;
    return warte(verzoegerung).then(() => {
      blasen(e.gruppe.position, 8);
      return tween(tempo(800), (t) => { e.tauchen = 1 - glatt(t); e.nicken = 0.25 * Math.sin(glatt(t) * Math.PI); });
    }).then(() => { e.nicken = 0; });
  }

  function aufbauen(belegung, { animiert = true, staffel = false, neu = false } = {}) {
    if (neu) { for (const e of [...alle]) entferne(e); schiffe.clear(); }
    const ziel = new Map(belegung);
    const bleibt = new Map();
    const frei = [];
    for (const [feld, e] of schiffe) {
      const z = ziel.get(feld);
      if (z && z.farbe === e.farbe && z.typ === e.typ) { bleibt.set(feld, e); ziel.delete(feld); } else frei.push(e);
    }
    for (const [feld, z] of [...ziel]) {
      let beste = null;
      let bA = Infinity;
      for (const e of frei) {
        if (!e.benutzt && e.farbe === z.farbe && e.typ === z.typ) {
          const a = feldPos(feld).distanceTo(e.gruppe.position);
          if (a < bA) { bA = a; beste = e; }
        }
      }
      if (beste) {
        beste.benutzt = true;
        beste.hebenZiel = 0;
        if (animiert) fahrt(beste, feldPos(feld)); else beste.gruppe.position.copy(feldPos(feld));
        bleibt.set(feld, beste);
        ziel.delete(feld);
      }
    }
    for (const e of frei) { if (!e.benutzt) { if (animiert) versenke(e, true); else entferne(e); } delete e.benutzt; }
    let i = 0;
    for (const [feld, z] of ziel) {
      const e = neuesSchiff(feld, z.farbe, z.typ);
      if (animiert) auftauchen(e, staffel ? i * 40 : 0);
      bleibt.set(feld, e);
      i++;
    }
    schiffe.clear();
    for (const [feld, e] of bleibt) { e.feld = feld; schiffe.set(feld, e); }
  }

  async function zug(z, { gezogen = false } = {}) {
    const e = schiffe.get(z.von);
    if (!e) return;
    const opfer = z.schlag ? schiffe.get(z.schlagFeld) : null;
    schiffe.delete(z.von);
    if (opfer) schiffe.delete(z.schlagFeld);
    schiffe.set(z.nach, e);
    e.feld = z.nach;
    e.wahlZiel = 0;
    const ziel = feldPos(z.nach);
    let lauf;
    let dauer;
    if (gezogen) {
      dauer = tempo(180);
      const start = e.gruppe.position.clone();
      e.hebenZiel = 0;
      lauf = tween(dauer, (t) => e.gruppe.position.lerpVectors(start, ziel, glatt(t)));
      setTimeout(() => spritzer(ziel, 6, 0.5), dauer);
    } else if (z.figur === 'n') {
      dauer = tempo(1350);
      lauf = tauchfahrt(e, ziel);
    } else {
      const weite = feldPos(z.von).distanceTo(ziel);
      dauer = tempo(Math.min(1250, 520 + weite * 140));
      lauf = fahrt(e, ziel, dauer);
    }
    if (z.rochade) {
      const turm = schiffe.get(z.turmVon);
      if (turm) { schiffe.delete(z.turmVon); schiffe.set(z.turmNach, turm); turm.feld = z.turmNach; fahrt(turm, feldPos(z.turmNach)); }
    }
    if (opfer) {
      setTimeout(() => { const p = feldPos(z.schlagFeld); spritzer(p, 14, 1.1); explosion(p); versenke(opfer); }, Math.max(0, dauer * 0.8));
    }
    await lauf;
    wellenring(ziel, { groesse: 0.55 });
    if (z.umwandlung) await verwandle(e, z.umwandlung);
  }

  async function verwandle(e, typ) {
    const p = e.gruppe.position;
    teilchenNeu(new THREE.Vector3(p.x, 0.3, p.z), { farbe: '#bffcff', groesse: 0.6, wachsen: 1.3, leben: 0.55, additiv: true, tex: TEX.glut, deckkraft: 1 });
    blasen(p, 10);
    await tween(tempo(260), (t) => e.kipp.scale.setScalar(Math.max(0.001, 1 - t)));
    e.kipp.remove(e.modell);
    e.modell = baueSchiff(typ, e.farbe);
    e.kipp.add(e.modell);
    e.typ = typ;
    const [rb, rl] = RING_GROESSE[typ];
    e.ring.scale.set(rb, rl, 1);
    e.schatten.scale.set(rb * 2.5, rl * 2.3, 1);
    await tween(tempo(420), (t) => e.kipp.scale.setScalar(Math.max(0.001, glatt(t) + Math.sin(t * Math.PI) * 0.12)));
    e.kipp.scale.setScalar(1);
    wellenring(p);
  }

  function flug(von, nach, dauer, bogen, schritt) {
    const p = new THREE.Vector3();
    return tween(dauer, (t) => { p.lerpVectors(von, nach, t); p.y += Math.sin(Math.PI * t) * bogen; schritt(p, t); });
  }
  async function attacke(z) {
    const schuetze = schiffe.get(z.von);
    const opfer = schiffe.get(z.nach);
    schiffe.delete(z.nach);
    const a = feldPos(z.von, 0.28);
    const b = feldPos(z.nach, 0.2);
    const weite = a.distanceTo(b);
    if (schuetze) {
      const d = b.clone().sub(a);
      const richtung = Math.atan2(-d.x, -d.z);
      const delta = winkelDiff(richtung, schuetze.yaw);
      const dreh = Math.abs(delta) > 1.6 ? winkelDiff(richtung + Math.PI, schuetze.yaw) * 0.25 : delta * 0.6;
      await tween(tempo(280), (t) => { schuetze.gruppe.rotation.y = schuetze.yaw + dreh * glatt(t); });
      schuetze.nicken = -0.08;
    }
    const kugel = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glut, color: '#ffd27a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    kugel.scale.setScalar(0.16);
    let letzte = 0;
    switch (z.waffe) {
      case 'artillerie':
        teilchenNeu(a.clone(), { farbe: '#fff1c2', groesse: 0.4, wachsen: 0.6, leben: 0.2, additiv: true, tex: TEX.glut, deckkraft: 1 });
        rauch(a, 4);
        wellenring(a, { groesse: 0.9 });
        szene.add(kugel);
        await flug(a, b, tempo(680), 1.4 + weite * 0.15, (p) => { kugel.position.copy(p); if (performance.now() - letzte > 50) { letzte = performance.now(); teilchenNeu(p.clone(), { farbe: '#c9d2da', groesse: 0.05, wachsen: 0.15, leben: 0.6, deckkraft: 0.35 }); } });
        szene.remove(kugel);
        break;
      case 'rakete': {
        const rakete = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.16, 8), new THREE.MeshStandardMaterial({ color: '#dfe7ee', metalness: 0.4, roughness: 0.4 }));
        szene.add(rakete, kugel);
        const vorher = a.clone();
        rauch(a, 3);
        await flug(a, b, tempo(440 + weite * 70), 0.5 + weite * 0.06, (p) => {
          rakete.position.copy(p);
          const dir = p.clone().sub(vorher);
          if (dir.lengthSq() > 1e-7) rakete.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
          vorher.copy(p);
          kugel.position.copy(p);
          if (performance.now() - letzte > 28) { letzte = performance.now(); teilchenNeu(p.clone(), { farbe: '#c9d2da', groesse: 0.1, wachsen: 0.4, leben: 1.1, deckkraft: 0.55 }); }
        });
        szene.remove(rakete, kugel);
        break;
      }
      case 'torpedo': {
        const tA = feldPos(z.von);
        const tB = feldPos(z.nach);
        blasen(tA, 6);
        wellenring(tA, { groesse: 0.5 });
        await flug(tA, tB, tempo(420 + weite * 180), 0, (p) => {
          if (performance.now() - letzte > 32) { letzte = performance.now(); schaumNeu(p.x + zufall(-0.02, 0.02), p.z, { groesse: 0.07, wachsen: 0.3, leben: 1.6, deckkraft: 0.75 }); blasen(p, 1, 0.03); }
        });
        break;
      }
      case 'wasserbomben': {
        const bomben = [0, 1].map(() => new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 10), new THREE.MeshStandardMaterial({ color: '#2a3138', metalness: 0.6, roughness: 0.4 })));
        bomben.forEach((bo) => szene.add(bo));
        await Promise.all(bomben.map((bo, i) => warte(i * 110).then(() => flug(a, b.clone().add(new THREE.Vector3(i ? 0.12 : -0.12, -0.2, i ? 0.06 : -0.06)), tempo(500), 0.8, (p, t) => { bo.position.copy(p); bo.rotation.x = t * 6; }))));
        bomben.forEach((bo) => szene.remove(bo));
        spritzer(b, 8, 0.8);
        blasen(b, 10);
        await warte(tempo(320));
        break;
      }
      default: break;
    }
    explosion(b, { wasserSaeule: z.waffe === 'torpedo' || z.waffe === 'wasserbomben' });
    versenke(opfer);
    if (schuetze) {
      schuetze.nicken = 0;
      const jetzt = schuetze.gruppe.rotation.y;
      tween(tempo(420), (t) => { schuetze.gruppe.rotation.y = jetzt + winkelDiff(schuetze.yaw, jetzt) * glatt(t); });
    }
    await warte(tempo(560));
  }

  // ---------- Markierungen (werden direkt ins Wasser gezeichnet) ----------
  const FELD_CODE = { letzter: 1, auswahl: 2, ueber: 3, schuetze: 4, schach: 5, schuetzeLeicht: 6 };
  const ZIEL_CODE = { ziel: 1, schlag: 2, feuer: 3 };
  function setzeMarke(feld, kanal, wert) {
    const linie = feld.charCodeAt(0) - 97;
    const zeile = 8 - +feld[1];
    marken[(zeile * 8 + linie) * 4 + kanal] = wert;
  }
  function markiere({ auswahl = null, ziele = [], letzter = null, schach = null, schuetzen = [], ueber = null, feuer = false } = {}) {
    marken.fill(0);
    if (letzter) { setzeMarke(letzter.von, 0, FELD_CODE.letzter); setzeMarke(letzter.nach, 0, FELD_CODE.letzter); }
    for (const fl of schuetzen) setzeMarke(fl, 0, FELD_CODE.schuetzeLeicht);
    if (ueber) setzeMarke(ueber, 0, FELD_CODE.ueber);
    if (auswahl) setzeMarke(auswahl, 0, feuer ? FELD_CODE.schuetze : FELD_CODE.auswahl);
    if (schach) setzeMarke(schach, 0, FELD_CODE.schach);
    for (const z of ziele) setzeMarke(z.nach, 1, ZIEL_CODE[z.art] || 1);
    markenTex.needsUpdate = true;
    for (const e of alle) e.wahlZiel = e.feld === auswahl && !e.sinkt ? 1 : 0;
    zeigeWege(auswahl, ziele);
  }

  // ---------- Wege: leuchtende Pfeil-Bahnen vom Schiff zu allen Zielen ----------
  const wegGruppe = new THREE.Group();
  szene.add(wegGruppe);
  const wegTex = textur((g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = '#fff';
    // Pfeilspitze (zeigt in Fahrtrichtung = +x)
    g.beginPath(); g.moveTo(s * 0.12, s * 0.12); g.lineTo(s * 0.62, s * 0.5); g.lineTo(s * 0.12, s * 0.88); g.lineTo(s * 0.32, s * 0.5); g.closePath(); g.fill();
  }, 64);
  wegTex.wrapS = THREE.RepeatWrapping;
  const WEG_MAT = {
    ziel: new THREE.MeshBasicMaterial({ map: wegTex, color: '#46ffd9', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    feuer: new THREE.MeshBasicMaterial({ map: wegTex, color: '#ff8a4a', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  const BOGEN_MAT = {
    ziel: new THREE.MeshBasicMaterial({ color: '#46ffd9', transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending }),
    feuer: new THREE.MeshBasicMaterial({ color: '#ff8a4a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  function band(a, b, mat) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const laenge = Math.hypot(dx, dz) - 0.42;
    if (laenge <= 0.05) return;
    const geo = new THREE.PlaneGeometry(laenge, 0.16);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * laenge * 3.2);
    const m = new THREE.Mesh(geo, mat);
    const r = Math.hypot(dx, dz);
    m.position.set(a.x + (dx / r) * (0.3 + laenge / 2), 0.11, a.z + (dz / r) * (0.3 + laenge / 2));
    m.rotation.y = -Math.atan2(dz, dx);
    m.renderOrder = 3;
    wegGruppe.add(m);
  }
  function bogen(a, b, hoch, mat) {
    const mitte = a.clone().lerp(b, 0.5);
    mitte.y = hoch;
    const kurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, 0.15, a.z), mitte, new THREE.Vector3(b.x, 0.15, b.z));
    const m = new THREE.Mesh(new THREE.TubeGeometry(kurve, 24, 0.022, 6, false), mat);
    m.renderOrder = 3;
    wegGruppe.add(m);
  }
  function zeigeWege(auswahl, ziele) {
    for (const k of wegGruppe.children) k.geometry.dispose();
    wegGruppe.clear();
    if (!auswahl || !ziele.length) return;
    const e = schiffe.get(auswahl);
    const a = feldPos(auswahl);
    // pro Richtung nur die weiteste Bahn (die näheren Ziele liegen darauf)
    const weiteste = new Map();
    for (const z of ziele) {
      const b = feldPos(z.nach);
      const feuer = z.art === 'feuer';
      if (e?.typ === 'n' && !feuer) { bogen(a, b, 0.75, BOGEN_MAT.ziel); continue; }
      if (feuer && z.waffe === 'artillerie') { bogen(a, b, 1.3, BOGEN_MAT.feuer); continue; }
      if (feuer && z.waffe === 'wasserbomben') { bogen(a, b, 0.5, BOGEN_MAT.feuer); continue; }
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const g = Math.max(Math.abs(dx), Math.abs(dz));
      const schl = `${Math.round(dx / g)},${Math.round(dz / g)},${feuer}`;
      const alt = weiteste.get(schl);
      if (!alt || g > alt.g) weiteste.set(schl, { b, g, feuer });
    }
    for (const { b, feuer } of weiteste.values()) band(a, b, feuer ? WEG_MAT.feuer : WEG_MAT.ziel);
  }

  // ---------- Kamera selbst steuern (drehen, kippen, zoomen, verschieben) ----------
  function kameraDrehen(dAzimut, dHoehe) {
    benutzer.azimut += dAzimut;
    benutzer.hoehe = THREE.MathUtils.clamp(benutzer.hoehe + dHoehe, 0.2 - blick.hoehe, 1.45 - blick.hoehe);
  }
  function kameraZoom(faktor) { benutzer.zoom = THREE.MathUtils.clamp(benutzer.zoom * faktor, 0.38, 1.3); }
  function kameraSchieben(dxPx, dyPx) {
    const az = blick.azimut + benutzer.azimut;
    const s = (blick.abstand * benutzer.zoom) / Math.max(300, leinwandH) * 1.1;
    benutzer.x = THREE.MathUtils.clamp(benutzer.x - (Math.cos(az) * dxPx - Math.sin(az) * dyPx) * s, -4, 4);
    benutzer.z = THREE.MathUtils.clamp(benutzer.z - (-Math.sin(az) * dxPx - Math.cos(az) * dyPx) * s, -4, 4);
  }
  function kameraZurueck() {
    const start = { ...benutzer };
    const ziel = winkelDiff(0, start.azimut);
    return tween(tempo(700), (k) => {
      const g = glatt(k);
      benutzer.azimut = start.azimut + ziel * g;
      benutzer.hoehe = start.hoehe * (1 - g);
      benutzer.zoom = start.zoom + (1 - start.zoom) * g;
      benutzer.x = start.x * (1 - g);
      benutzer.z = start.z * (1 - g);
    }).then(() => Object.assign(benutzer, OHNE));
  }
  const kameraVeraendert = () => Math.abs(winkelDiff(benutzer.azimut, 0)) > 0.02 || Math.abs(benutzer.hoehe) > 0.02 || Math.abs(benutzer.zoom - 1) > 0.02 || Math.abs(benutzer.x) + Math.abs(benutzer.z) > 0.05;

  // ---------- Antippen ----------
  const strahl = new THREE.Raycaster();
  const ebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  function treffer(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    strahl.setFromCamera(ndc, kamera);
    const t = strahl.intersectObjects(trefferBoxen, false)[0];
    const p = new THREE.Vector3();
    const aufWasser = strahl.ray.intersectPlane(ebene, p);
    return { schiff: t ? t.object.userData.eintrag.feld : null, flaeche: aufWasser ? feldAusWelt(p.x, p.z) : null, punkt: aufWasser ? p : null };
  }
  let gezogen = null;
  function hebe(feld) { const e = schiffe.get(feld); if (!e) return; gezogen = e; e.hebenZiel = 1; }
  function ziehe(x, y) {
    if (!gezogen) return;
    const { punkt } = treffer(x, y);
    if (!punkt) return;
    const p = gezogen.gruppe.position;
    const nx = THREE.MathUtils.clamp(punkt.x, -4.3, 4.3);
    const nz = THREE.MathUtils.clamp(punkt.z, -4.3, 4.3);
    if (Math.hypot(nx - p.x, nz - p.z) > 0.05 && Math.random() < 0.6) schaumNeu(p.x, p.z, { groesse: 0.08, wachsen: 0.25, leben: 0.9, deckkraft: 0.4 });
    p.set(nx, 0, nz);
  }
  function zurueck(feld) {
    const e = schiffe.get(feld);
    gezogen = null;
    if (!e) return Promise.resolve();
    e.hebenZiel = 0;
    const start = e.gruppe.position.clone();
    const ziel = feldPos(feld);
    return tween(tempo(240), (t) => e.gruppe.position.lerpVectors(start, ziel, glatt(t)));
  }
  function loslassen() { if (gezogen) gezogen.hebenZiel = 0; gezogen = null; }

  async function setzeAusrichtung(gedreht, animiert = true) {
    const ziel = gedreht ? Math.PI : 0;
    if (Math.abs(winkelDiff(blick.azimut, ziel)) < 0.01 || !animiert) { blick.azimut = ziel; beschriften(); kameraSetzen(); return; }
    const start = blick.azimut;
    const delta = winkelDiff(ziel, start) || Math.PI;
    let umgeschrieben = false;
    await tween(tempo(1200), (t) => {
      blick.azimut = start + delta * glatt(t);
      if (!umgeschrieben && t > 0.5) { umgeschrieben = true; beschriften(); }
    });
    blick.azimut = ziel;
    beschriften();
  }

  // ---------- Hauptschleife ----------
  let aktiv = true;
  let letzteZeit = performance.now();
  function bild(jetzt) {
    const dt = Math.min(0.05, (jetzt - letzteZeit) / 1000);
    letzteZeit = jetzt;
    if (!aktiv && !tweens.length && !teilchen.length) return;
    uhr.zeit += dt;
    const t = uhr.zeit;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const k = Math.min(1, (jetzt - tw.start) / tw.dauer);
      tw.update(k);
      if (k >= 1) { tweens.splice(i, 1); tw.ok(); }
    }
    // Schiffe schwimmen auf den Wellen: Höhe, Nicken (vorne/hinten) und Rollen (seitlich)
    for (const e of alle) {
      if (e.sinkt) continue;
      const p = e.gruppe.position;
      const yaw = e.gruppe.rotation.y;
      const vx = -Math.sin(yaw);
      const vz = -Math.cos(yaw);
      const sx = Math.cos(yaw);
      const sz = -Math.sin(yaw);
      const L = 0.36;
      const B = 0.12;
      const h0 = hoehe(p.x, p.z);
      const nick = Math.atan2(hoehe(p.x + vx * L, p.z + vz * L) - hoehe(p.x - vx * L, p.z - vz * L), 2 * L);
      const roll = Math.atan2(hoehe(p.x + sx * B, p.z + sz * B) - hoehe(p.x - sx * B, p.z - sz * B), 2 * B);
      const tr = TRAEGHEIT[e.typ];
      const k = Math.min(1, dt * 6);
      e.glattY += (h0 * (0.6 + 0.4 * tr) - e.glattY) * k;
      e.glattP += (nick * tr - e.glattP) * k;
      e.glattR += (roll * tr - e.glattR) * k;
      e.heben += (e.hebenZiel - e.heben) * Math.min(1, dt * 14);
      e.wahl += (e.wahlZiel - e.wahl) * Math.min(1, dt * 10);
      const ruhe = 1 - e.heben;
      e.kipp.position.y = e.glattY * ruhe - e.tauchen * 0.6 + e.heben * 0.34 + e.wahl * 0.05 + Math.sin(t * 2.1 + e.phase) * 0.004;
      e.kipp.rotation.x = (e.glattP + e.nicken) * ruhe;
      e.kipp.rotation.z = (e.glattR + e.krengung) * ruhe + Math.sin(t * 0.8 + e.phase) * 0.012;
      const sichtbar = e.tauchen < 0.08 && e.heben < 0.5;
      e.ring.visible = sichtbar;
      e.schatten.visible = e.tauchen < 0.08;
      const w = e.kipp.getObjectByName('wimpel');
      if (w) w.rotation.x = Math.sin(t * 6 + e.phase) * 0.25;
    }
    // Schwimmer und Bojen
    schwimmerPos.forEach(([x, z], i) => { hilfsObjekt.position.set(x, hoehe(x, z) + 0.01, z); hilfsObjekt.updateMatrix(); schwimmer.setMatrixAt(i, hilfsObjekt.matrix); });
    schwimmer.instanceMatrix.needsUpdate = true;
    bojen.forEach((bo, i) => {
      bo.b.position.y = hoehe(bo.x, bo.z);
      bo.b.rotation.z = Math.sin(t * 1.1 + i) * 0.12;
      bo.b.rotation.x = Math.cos(t * 0.9 + i) * 0.1;
      bo.lampe.material.emissiveIntensity = Math.sin(t * 2.4 + i * 1.7) > 0.55 ? 3.2 : 0.35;
    });
    for (let i = teilchen.length - 1; i >= 0; i--) {
      const p = teilchen[i];
      p.alter += dt;
      const k = p.alter / p.leben;
      if (k >= 1) { szene.remove(p.s); p.s.material.dispose(); teilchen.splice(i, 1); continue; }
      p.v.y -= p.schwerkraft * dt;
      p.s.position.addScaledVector(p.v, dt);
      if (p.s.position.y < p.boden) { p.s.position.y = p.boden; p.v.set(0, 0, 0); }
      p.s.scale.setScalar(Math.max(0.001, p.groesse + p.wachsen * k));
      p.s.material.opacity = p.deckkraft * Math.pow(1 - k, 1.3);
    }
    for (let i = schaum.length - 1; i >= 0; i--) {
      const s = schaum[i];
      s.alter += dt;
      const k = s.alter / s.leben;
      if (k >= 1) { szene.remove(s.m); s.m.material.dispose(); schaum.splice(i, 1); continue; }
      s.m.position.y = hoehe(s.m.position.x, s.m.position.z) + 0.02;
      s.m.scale.setScalar(Math.max(0.001, s.groesse + s.wachsen * Math.sqrt(k)));
      s.m.material.opacity = s.deckkraft * (1 - k) * Math.min(1, k * 8);
    }
    // Menü-Boot schaukelt auf den Wellen, die Laterne flackert
    if (mischung < 0.999) {
      const bp = boot.gruppe.position;
      bp.y = hoehe(bp.x, bp.z) * 1.6 + Math.sin(t * 0.9) * 0.025;
      boot.gruppe.rotation.x = Math.atan2(hoehe(bp.x, bp.z - 1.2) - hoehe(bp.x, bp.z + 1.2), 2.4) * 2.2 + Math.sin(t * 0.7) * 0.018;
      boot.gruppe.rotation.z = Math.atan2(hoehe(bp.x + 0.7, bp.z) - hoehe(bp.x - 0.7, bp.z), 1.4) * 2 + Math.sin(t * 0.55 + 1) * 0.022;
      const flackern = laterneAn * (0.86 + Math.sin(t * 13.1) * 0.06 + Math.sin(t * 7.3 + 1) * 0.05 + Math.sin(t * 23.7) * 0.03);
      boot.licht.intensity = flackern * 1.5;
      boot.glasMat.emissiveIntensity = flackern * 3;
      boot.schein.material.opacity = flackern * 0.85;
      boot.laterne.getWorldPosition(U.uLaterne.value);
      U.uLaterne.value.y += 0.1;
    }
    U.uLaterneKraft.value = laterneAn * (1 - mischung) * (0.9 + Math.sin(t * 13.1) * 0.05);
    // Sternschnuppen in der Nacht
    naechsteSchnuppe -= dt;
    if (nacht > 0.5 && naechsteSchnuppe <= 0) { naechsteSchnuppe = zufall(4, 10); sternschnuppe(); }
    U.uZeit.value = t;
    himmelU.uZeit.value = t;
    wegTex.offset.x -= dt * 1.6;   // Pfeile auf den Bahnen wandern zum Ziel
    kameraSetzen();
    // Das Wasser-Netz wandert mit der Kamera mit (die Wellen selbst bleiben fest in der Welt)
    wasser.position.set(Math.round(kamera.position.x / 0.25) * 0.25, 0, Math.round((kamera.position.z - 22) / 0.25) * 0.25);
    fern.position.set(kamera.position.x, -0.2, kamera.position.z);
    U.uKamera.value.copy(kamera.position);
    renderer.render(szene, kamera);
  }
  let naechsteSchnuppe = 3;
  function sternschnuppe() {
    const vor = new THREE.Vector3();
    kamera.getWorldDirection(vor);
    vor.y = 0;
    vor.normalize();
    const seite = new THREE.Vector3(-vor.z, 0, vor.x);
    const start = kamera.position.clone().addScaledVector(vor, 160).addScaledVector(seite, zufall(-70, 70));
    start.y += zufall(45, 95);
    const weg = seite.clone().multiplyScalar(zufall(0, 1) > 0.5 ? 1 : -1).add(new THREE.Vector3(0, -0.5, 0)).normalize().multiplyScalar(zufall(45, 75));
    const geo = new THREE.BufferGeometry().setFromPoints([start, start.clone()]);
    const linie = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#eaf2ff', transparent: true, opacity: 1, fog: false, depthWrite: false }));
    szene.add(linie);
    const kopf = new THREE.Vector3();
    const schwanz = new THREE.Vector3();
    tween(750, (k) => {
      kopf.copy(start).addScaledVector(weg, k);
      schwanz.copy(start).addScaledVector(weg, Math.max(0, k - 0.3));
      geo.setFromPoints([schwanz, kopf]);
      linie.material.opacity = Math.sin(Math.PI * k);
    }).then(() => { szene.remove(linie); geo.dispose(); linie.material.dispose(); });
  }
  // Feuerwerk über dem Brett (beim Sieg)
  function feuerwerk(anzahl = 8) {
    const farben = ['#2fe3c2', '#ffd56b', '#ff6a8a', '#8fd0ff', '#ffffff', '#b892ff', '#ff9a4a'];
    for (let i = 0; i < anzahl; i++) {
      setTimeout(() => {
        const p = new THREE.Vector3(zufall(-4, 4), zufall(4.5, 8), zufall(-6, 0));
        const farbe = farben[i % farben.length];
        // Aufstieg: kleiner Funke von unten
        const start = new THREE.Vector3(p.x + zufall(-1, 1), 0.2, p.z + 2);
        flug(start, p, 520, 0, (q) => { if (Math.random() < 0.8) teilchenNeu(q.clone(), { farbe: '#ffe0a0', groesse: 0.08, wachsen: -0.05, leben: 0.5, additiv: true, deckkraft: 0.9 }); }).then(() => {
          ereignis('feuerwerk');
          teilchenNeu(p.clone(), { farbe: '#ffffff', groesse: 0.9, wachsen: 1.6, leben: 0.25, additiv: true, tex: TEX.glut, deckkraft: 1 });
          for (let j = 0; j < 44; j++) {
            const v = new THREE.Vector3(zufall(-1, 1), zufall(-1, 1), zufall(-1, 1)).normalize().multiplyScalar(zufall(2.2, 3.3));
            teilchenNeu(p.clone(), { farbe, groesse: 0.17, wachsen: -0.1, leben: zufall(1.0, 1.7), v, schwerkraft: 1.7, deckkraft: 1, additiv: true });
          }
          blitzLicht.position.copy(p);
          tween(500, (k) => { blitzLicht.intensity = (1 - k) * 9; });
        });
      }, i * 420);
    }
  }
  // Menü <-> Spiel: die Kamera fliegt vom Boot zum Brett (und zurück)
  function modus(name, animiert = true) {
    const ziel = name === 'spiel' ? 1 : 0;
    if (!animiert) { mischung = ziel; return Promise.resolve(); }
    if (Math.abs(mischung - ziel) < 0.001) return Promise.resolve();
    const start = mischung;
    return tween(tempo(ziel ? 2400 : 1600), (k) => { mischung = start + (ziel - start) * glatt(k); });
  }
  function zuenden() { const s = laterneAn; return tween(1100, (k) => { laterneAn = Math.max(s, Math.min(1, k * k * 1.2 + (Math.random() < 0.3 ? -0.2 : 0))); }).then(() => { laterneAn = 1; }); }
  renderer.setAnimationLoop(bild);

  new ResizeObserver(() => passe()).observe(huelle);
  beschriften();
  farbenAnwenden();
  passe();

  return {
    leinwand: renderer.domElement,
    setzeFreiraum(r) { freiraum = r; passe(); },
    passe,
    setzeAusrichtung,
    setzeBlickwinkel(grad) { blick.hoehe = THREE.MathUtils.degToRad(grad); passe(); },
    setzeKoordinaten(an) { beschriftung.visible = an; },
    setzeFlotten(w, b) { setzeFlotte('w', w); setzeFlotte('b', b); },
    aufbauen, zug, attacke, markiere, treffer, hebe, ziehe, zurueck, loslassen,
    modus, setzeNacht, zuenden, feuerwerk,
    kameraDrehen, kameraZoom, kameraSchieben, kameraZurueck, kameraVeraendert,
    // alle Schiffe gegen den neuen Satz tauschen (mit Glitzer, nacheinander)
    tauscheSchiffe() { [...alle].filter((e) => !e.sinkt).forEach((e, i) => setTimeout(() => verwandle(e, e.typ), i * 45)); },
    aktiv(an) { aktiv = an; if (an) letzteZeit = performance.now(); },
    debug: () => ({ tweens: tweens.length, teilchen: teilchen.length, schaum: schaum.length, schiffe: [...alle].slice(0, 4).map((e) => ({ feld: e.feld, tauchen: +e.tauchen.toFixed(2), y: +e.kipp.position.y.toFixed(3), gy: +e.gruppe.position.y.toFixed(3), s: e.kipp.scale.x })), kamera: kamera.position.toArray().map((v) => +v.toFixed(2)), abstand: blick.abstand }),
  };
}
