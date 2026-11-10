// NAVAL CHESS – Offline-Speicher (Service Worker)
// Beim ersten Öffnen werden alle Dateien gespeichert. Danach läuft das Spiel ohne Internet.
// Die VERSION setzt hochladen.ps1 automatisch (Fingerabdruck aller Dateien).
self.VERSION = 'navalchess-6856a812';
const VORNAME = 'navalchess-';
const DATEIEN = [
  './', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png',
  'stil.css', 'app.js', 'schach.js', 'ki.js', 'schiffe.js', 'ton.js', 'buehne.js', 'flotte3d.js',
  'vendor/three.module.min.js', 'vendor/GLTFLoader.js', 'vendor/BufferGeometryUtils.js', 'vendor/RoundedBoxGeometry.js',
  'modelle/spass/k.glb', 'modelle/spass/q.glb', 'modelle/spass/r.glb', 'modelle/spass/b.glb', 'modelle/spass/n.glb', 'modelle/spass/p.glb',
  'ton/zug.wav', 'ton/schlag.wav', 'ton/knopf.wav', 'ton/umwandlung.wav',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(self.VERSION).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

// Alte Versionen DIESES Spiels löschen (andere Spiele auf derselben Adresse bleiben unberührt)
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((namen) => Promise.all(namen.filter((n) => n.startsWith(VORNAME) && n !== self.VERSION).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Zuerst aus dem Speicher, sonst aus dem Netz (und dann merken)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((treffer) => treffer || fetch(e.request).then((antwort) => {
    if (antwort.ok && new URL(e.request.url).origin === location.origin) {
      const kopie = antwort.clone();
      caches.open(self.VERSION).then((c) => c.put(e.request, kopie));
    }
    return antwort;
  }).catch(() => caches.match('index.html'))));
});
