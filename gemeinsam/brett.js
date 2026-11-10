// ═══════════════════════════════════════════════════════════════════
// Baukasten für das gekippte 3D-Neon-Brett (Vorlage: isometrisches Brett in Türkis/Lila/Pink)
// und kleine 3D-Spielfiguren, die aufrecht auf dem Brett stehen.
// ═══════════════════════════════════════════════════════════════════

// Brett bauen. muster(x, y) gibt eine Farbklasse zurück: 't1'…'t4' oder ''.
// hoch = Höhe eines Feldes im Verhältnis zur Breite (1 = quadratisch, 1.6 = länglich)
export function baueBrett(ziel, { spalten, zeilen = spalten, muster = () => '', kipp = 26, marken = [], hoch = 1 }) {
  const szene = document.createElement('div');
  szene.className = 'szene';
  const brett = document.createElement('div');
  brett.className = 'brett rein';
  brett.style.setProperty('--kipp', `${kipp}deg`);
  const felder = document.createElement('div');
  felder.className = 'felder';
  felder.style.gridTemplateColumns = `repeat(${spalten}, 1fr)`;
  felder.style.gridTemplateRows = `repeat(${zeilen}, 1fr)`;
  const liste = [];
  for (let y = 0; y < zeilen; y++) for (let x = 0; x < spalten; x++) {
    const f = document.createElement('div');
    f.className = `feld ${muster(x, y) || ''}`;
    f.dataset.x = x; f.dataset.y = y;
    felder.append(f); liste.push(f);
  }
  brett.append(felder);
  // dünne Beschriftungs-Linien wie in der Vorlage
  for (const m of marken) {
    const t = document.createElement('div');
    t.className = `markierung ${m.seite}`; t.textContent = m.text; t.style.top = m.oben;
    brett.append(t);
  }
  szene.append(brett);
  ziel.append(szene);

  // Größe an den freien Platz anpassen (auch beim Drehen des Handys)
  const verh = spalten / (zeilen * hoch);
  const passen = () => {
    const r = szene.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // Durch die Perspektive wird die vordere Kante größer – darum nicht mehr als ~90 % der Höhe nehmen
    const k = Math.cos((kipp * Math.PI) / 180);
    const breite = Math.min(r.width * 0.94, (r.height * (0.78 + 0.12 * (1 - k)) / k) * verh * k * 1.05, 760);
    brett.style.width = `${breite}px`;
    brett.style.height = `${breite / verh}px`;
  };
  const ro = new ResizeObserver(passen); ro.observe(szene);
  requestAnimationFrame(passen);

  return {
    szene, brett, felder, liste,
    feld: (x, y) => liste[y * spalten + x],
    beiTipp(fn) {
      felder.addEventListener('click', (e) => { const f = e.target.closest('.feld'); if (f) fn(+f.dataset.x, +f.dataset.y, f, e); });
    },
    weg() { ro.disconnect(); },
  };
}

// ——— 3D-Figuren als SVG (rund schattiert, dadurch plastisch) ———
let zaehler = 0;
function schattierung(id, farbe) {
  return `<linearGradient id="${id}" x1="0" x2="1">
    <stop offset="0" stop-color="${farbe}" stop-opacity="1" style="stop-color:color-mix(in srgb, ${farbe} 35%, #000)"/>
    <stop offset=".38" stop-color="${farbe}" style="stop-color:color-mix(in srgb, ${farbe} 70%, #fff)"/>
    <stop offset=".6" stop-color="${farbe}"/>
    <stop offset="1" stop-color="${farbe}" style="stop-color:color-mix(in srgb, ${farbe} 25%, #000)"/></linearGradient>`;
}

export const FORMEN = {
  // Bauer (wie auf dem Neon-Brett der Vorlage)
  bauer: (f) => `<ellipse cx="50" cy="150" rx="40" ry="10" fill="url(#${f})"/><path d="M14 150 Q14 132 30 128 L36 118 Q22 112 30 100 L38 98 Q40 80 34 66 Q24 62 26 52 L36 50 A20 20 0 1 1 64 50 L74 52 Q76 62 66 66 Q60 80 62 98 L70 100 Q78 112 64 118 L70 128 Q86 132 86 150 Z" fill="url(#${f})"/><ellipse cx="44" cy="34" rx="7" ry="9" fill="#fff" opacity=".25"/>`,
  // Turm mit Zinnen
  turm: (f) => `<ellipse cx="50" cy="150" rx="40" ry="10" fill="url(#${f})"/><path d="M12 150 Q12 134 24 130 L28 70 L20 68 L20 30 L32 30 L32 40 L44 40 L44 30 L56 30 L56 40 L68 40 L68 30 L80 30 L80 68 L72 70 L76 130 Q88 134 88 150 Z" fill="url(#${f})"/><rect x="28" y="72" width="44" height="4" fill="#000" opacity=".25"/><rect x="34" y="44" width="10" height="16" rx="5" fill="#000" opacity=".35"/>`,
  // Kristall-Spitze
  kristall: (f) => `<ellipse cx="50" cy="150" rx="34" ry="9" fill="url(#${f})"/><path d="M22 148 L22 60 L50 12 L78 60 L78 148 Z" fill="url(#${f})"/><path d="M50 12 L50 148" stroke="#fff" stroke-opacity=".25"/><path d="M22 60 L50 40 L78 60" fill="none" stroke="#fff" stroke-opacity=".35"/>`,
  // Scheibe/Spielstein (flach)
  stein: (f) => `<ellipse cx="50" cy="138" rx="44" ry="14" fill="#000" opacity=".3"/><path d="M6 118 L6 132 A44 14 0 0 0 94 132 L94 118 Z" fill="url(#${f})"/><ellipse cx="50" cy="118" rx="44" ry="14" fill="url(#${f})"/><ellipse cx="50" cy="116" rx="30" ry="8" fill="#fff" opacity=".18"/>`,
};

// Figur-Element erzeugen, das aufrecht auf einem Feld steht
export function figur(farbe, form = 'bauer', groesse = 0.62) {
  const id = `sch${++zaehler}`;
  const d = document.createElement('div');
  d.className = 'figur';
  d.style.width = `${groesse * 100}%`;
  d.innerHTML = `<svg viewBox="0 0 100 160"><defs>${schattierung(id, farbe)}</defs>${FORMEN[form](id)}</svg>`;
  return d;
}
