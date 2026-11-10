// Herz des Offline-Speichers. Jedes Spiel hat eine kleine sw.js, die VERSION + EIGENE setzt und diese Datei lädt.
// Wichtig: Alle 10 Spiele (und BLACK ACE) liegen auf derselben Adresse und teilen sich den Speicher.
// Darum löscht jedes Spiel NUR seine eigenen alten Versionen (gleicher Vorname), nie die der anderen.
const VORNAME = self.VERSION.split('-')[0] + '-';
const GEMEINSAM = ['stil.css', 'rahmen.js', 'cover.js', 'ton.js', 'brett.js',
  ...['klick', 'wahl', 'setzen', 'gut', 'schlecht', 'gegner', 'sieg', 'niederlage', 'seite'].map((n) => `ton/${n}.wav`)];
const DATEIEN = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png', ...self.EIGENE, ...GEMEINSAM.map((d) => '../gemeinsam/' + d)];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(self.VERSION).then((c) => c.addAll(DATEIEN)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((namen) => Promise.all(namen.filter((n) => n.startsWith(VORNAME) && n !== self.VERSION).map((n) => caches.delete(n)))));
  self.clients.claim();
});

// Erst aus dem Speicher, sonst aus dem Netz (und dann gleich merken)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(self.VERSION).then(async (c) => {
    const treffer = await c.match(e.request, { ignoreSearch: true });
    if (treffer) return treffer;
    try {
      const antwort = await fetch(e.request);
      if (antwort.ok && new URL(e.request.url).origin === location.origin) c.put(e.request, antwort.clone());
      return antwort;
    } catch (fehler) {
      return (await c.match('index.html')) || Response.error();
    }
  }));
});
