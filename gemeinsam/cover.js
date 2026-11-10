// ═══════════════════════════════════════════════════════════════════
// Die 10 Cover – selbst gezeichnet im Stil von Elias' Vorlagen, als Animation.
// Jede Szene bekommt: g = Zeichenfläche, w/h = Größe, t = Sekunden seit Start, s = eigener Speicher.
// Bis ca. 3,5 s läuft die Start-Animation, danach bewegt sich alles ruhig weiter.
// ═══════════════════════════════════════════════════════════════════

const klemm = (t, a = 0, b = 1) => Math.max(a, Math.min(b, t));
const phase = (t, a, b) => klemm((t - a) / (b - a));
const raus = (t) => 1 - Math.pow(1 - klemm(t), 3);
const weich = (t) => { t = klemm(t); return t * t * (3 - 2 * t); };
const PI2 = Math.PI * 2;

function zufall(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

function sternenhimmel(g, w, h, t, s, menge = 160, staerke = 1) {
  if (!s.sterne) { const z = zufall(3); s.sterne = Array.from({ length: menge }, () => [z(), z(), z()]); }
  g.fillStyle = '#fff';
  for (const [x, y, b] of s.sterne) {
    g.globalAlpha = staerke * (0.15 + b * 0.75) * (0.7 + 0.3 * Math.sin(t * 1.7 + b * 40));
    const r = b > 0.92 ? 1.6 : 1;
    g.fillRect(x * w, y * h, r, r);
  }
  g.globalAlpha = 1;
}

function leuchtPunkt(g, x, y, r, farbe, alpha = 1) {
  const v = g.createRadialGradient(x, y, 0, x, y, r);
  v.addColorStop(0, farbe.replace('A', alpha)); v.addColorStop(1, farbe.replace('A', 0));
  g.fillStyle = v; g.fillRect(x - r, y - r, r * 2, r * 2);
}

function vignette(g, w, h, staerke = 0.75) {
  const v = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.2, w / 2, h * 0.5, Math.max(w, h) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${staerke})`);
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}

// Sechseck mit leuchtenden Kanten (Vorlage: Hexagon im Raum)
function sechseck(g, w, h, t, s, cx, cy, R, start = 0.2) {
  // Raumecke: senkrechte Kante oben, Bodenlinie
  g.fillStyle = '#060606'; g.fillRect(0, 0, w, h);
  const wand = g.createLinearGradient(0, 0, w, 0);
  wand.addColorStop(0, '#0a0a0a'); wand.addColorStop(0.5, '#111'); wand.addColorStop(1, '#0a0a0a');
  g.fillStyle = wand; g.fillRect(0, 0, w, cy + R * 0.5);
  const boden = g.createLinearGradient(0, cy + R * 0.5, 0, h);
  boden.addColorStop(0, '#0d0d0d'); boden.addColorStop(1, '#030303');
  g.fillStyle = boden; g.fillRect(0, cy + R * 0.5, w, h);
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, cy - R); g.moveTo(0, cy + R * 0.5); g.lineTo(w, cy + R * 0.5); g.stroke();

  const ecken = [];
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; ecken.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  const an = raus(phase(t, start, start + 1.6));
  const atmen = 0.9 + 0.1 * Math.sin(t * 1.3);

  // Lichtschein auf dem Boden
  g.save(); g.translate(cx, cy + R * 0.62); g.scale(1, 0.28);
  const lb = g.createRadialGradient(0, 0, 0, 0, 0, R * 2.3);
  lb.addColorStop(0, `rgba(255,255,255,${0.32 * an * atmen})`); lb.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lb; g.beginPath(); g.arc(0, 0, R * 2.3, 0, PI2); g.fill(); g.restore();
  // Schein an der Wand
  const ws = g.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 2.2);
  ws.addColorStop(0, `rgba(255,255,255,${0.12 * an})`); ws.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = ws; g.fillRect(cx - R * 2.4, cy - R * 2.4, R * 4.8, R * 4.8);

  // Inneres schwarz
  g.fillStyle = '#020202'; g.beginPath(); ecken.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();

  // Kanten: unten hell, oben schwach – sie werden von unten aus „nachgezogen“
  const kanten = [[2, 3], [3, 4], [1, 2], [4, 5], [0, 1], [5, 0]];
  const helligkeit = [1, 1, 0.85, 0.85, 0.28, 0.28];
  kanten.forEach(([a, b], k) => {
    const teil = klemm(an * 3 - Math.floor(k / 2));
    if (teil <= 0) return;
    const [x1, y1] = ecken[a], [x2, y2] = ecken[b];
    const ex = x1 + (x2 - x1) * teil, ey = y1 + (y2 - y1) * teil;
    const hel = helligkeit[k] * atmen;
    g.lineCap = 'round';
    g.strokeStyle = `rgba(255,255,255,${0.12 * hel})`; g.lineWidth = 16; g.beginPath(); g.moveTo(x1, y1); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = `rgba(255,255,255,${0.3 * hel})`; g.lineWidth = 6; g.stroke();
    g.strokeStyle = `rgba(255,255,255,${hel})`; g.lineWidth = 2.2; g.stroke();
  });
  return { ecken, an };
}

function inSechseck(g, ecken, malen) {
  g.save(); g.beginPath(); ecken.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.clip(); malen(); g.restore();
}

// ═══════════════════════════════════════════════════════════════════
export const SZENEN = {

  // 1 · NIM — „BLACK“: orange Lichtlinie wie eine Streichholzflamme über einem Planetenhorizont
  nim(g, w, h, t, s) {
    g.fillStyle = '#060606'; g.fillRect(0, 0, w, h);
    const cx = w / 2, hy = h * 0.53;
    const R = Math.max(w, h) * 1.5;
    const pa = raus(phase(t, 0.7, 2.4));
    g.globalAlpha = pa;
    const pg = g.createRadialGradient(cx, hy + R, R * 0.6, cx, hy + R, R);
    pg.addColorStop(0, '#020202'); pg.addColorStop(0.985, '#0b0b0c'); pg.addColorStop(1, '#151517');
    g.fillStyle = pg; g.beginPath(); g.arc(cx, hy + R, R, 0, PI2); g.fill();
    const rl = g.createLinearGradient(cx - w * 0.6, 0, cx + w * 0.6, 0);
    rl.addColorStop(0, 'rgba(255,120,40,0)'); rl.addColorStop(0.5, 'rgba(255,170,90,.55)'); rl.addColorStop(1, 'rgba(255,120,40,0)');
    g.strokeStyle = rl; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, hy + R, R, Math.PI * 1.3, Math.PI * 1.7); g.stroke();
    g.globalAlpha = 1;

    const la = raus(phase(t, 0.15, 1.7));
    const flackern = 0.9 + 0.06 * Math.sin(t * 19) + 0.04 * Math.sin(t * 7.1);
    const oben = hy - h * 0.62 * la, unten = hy + h * 0.5 * la;
    g.globalCompositeOperation = 'lighter';
    const lg = g.createLinearGradient(0, oben, 0, unten);
    lg.addColorStop(0, 'rgba(255,80,10,0)'); lg.addColorStop(0.42, 'rgba(255,100,25,.9)'); lg.addColorStop(0.55, 'rgba(255,190,110,1)');
    lg.addColorStop(0.7, 'rgba(255,90,20,.5)'); lg.addColorStop(1, 'rgba(255,80,10,0)');
    g.fillStyle = lg;
    g.globalAlpha = 0.18 * flackern; g.fillRect(cx - 14, oben, 28, unten - oben);
    g.globalAlpha = 0.45 * flackern; g.fillRect(cx - 4, oben, 8, unten - oben);
    g.globalAlpha = flackern; g.fillRect(cx - 1, oben, 2, unten - oben);
    g.globalAlpha = 1;
    const fa = raus(phase(t, 1.0, 2.1)) * flackern;
    if (fa > 0) {
      leuchtPunkt(g, cx, hy, 110, 'rgba(255,120,30,A)', 0.55 * fa);
      leuchtPunkt(g, cx, hy, 26, 'rgba(255,230,170,A)', fa);
      const st = g.createLinearGradient(cx - w * 0.35, 0, cx + w * 0.35, 0);
      st.addColorStop(0, 'rgba(255,150,60,0)'); st.addColorStop(0.5, `rgba(255,210,140,${0.9 * fa})`); st.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = st; g.fillRect(cx - w * 0.35, hy - 1, w * 0.7, 2);
      // vierzackiger Stern
      g.fillStyle = `rgba(255,240,210,${fa})`;
      g.beginPath(); g.moveTo(cx, hy - 9); g.lineTo(cx + 2, hy); g.lineTo(cx, hy + 9); g.lineTo(cx - 2, hy); g.fill();
      g.beginPath(); g.moveTo(cx - 14, hy); g.lineTo(cx, hy - 1.6); g.lineTo(cx + 14, hy); g.lineTo(cx, hy + 1.6); g.fill();
    }
    // Funken steigen auf
    if (!s.funken) s.funken = [];
    if (t > 1.4 && Math.random() < 0.18) s.funken.push({ x: cx + (Math.random() - 0.5) * 6, y: hy, v: 20 + Math.random() * 40, l: 0, d: 2 + Math.random() * 2 });
    for (const f of s.funken) { f.l += 1 / 60; f.y -= f.v / 60; f.x += Math.sin(f.l * 3 + f.v) * 0.3; g.fillStyle = `rgba(255,170,90,${Math.max(0, 1 - f.l / f.d) * 0.8})`; g.fillRect(f.x, f.y, 1.4, 1.4); }
    s.funken = s.funken.filter((f) => f.l < f.d);
    g.globalCompositeOperation = 'source-over';
    vignette(g, w, h, 0.6);
  },

  // 2 · CODEBREAKER — geknackte Steinbirne mit goldenen Glühfäden
  code(g, w, h, t, s) {
    const z = zufall(11);
    if (!s.boden) {
      s.boden = Array.from({ length: 26 }, () => [z(), 0.86 + z() * 0.14, 6 + z() * 30, z()]);
      s.bokeh = Array.from({ length: 9 }, () => [z(), z() * 0.7, 30 + z() * 90]);
      const r = zufall(5);
      const n = 9;
      s.scherben = [];
      const winkel = Array.from({ length: n }, (_, i) => (i / n) * PI2 + (r() - 0.5) * 0.35);
      const innen = winkel.map((a) => [Math.cos(a) * (0.28 + r() * 0.12), Math.sin(a) * (0.28 + r() * 0.12) * 1.2 + 0.05]);
      for (let i = 0; i < n; i++) {
        const a1 = winkel[i], a2 = winkel[(i + 1) % n] + (i === n - 1 ? PI2 : 0);
        const pkt = [innen[i]];
        for (let k = 0; k <= 6; k++) { const a = a1 + (a2 - a1) * (k / 6); const rr = 1 + (r() - 0.5) * 0.06; pkt.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
        pkt.push(innen[(i + 1) % n]);
        const mitte = (a1 + a2) / 2;
        s.scherben.push({ pkt, dx: Math.cos(mitte), dy: Math.sin(mitte), dreh: (r() - 0.5) * 0.12, hell: 0.6 + r() * 0.4 });
      }
      s.innen = innen;
    }
    // Hintergrund mit Unschärfe-Kreisen
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#3a3a3c'); bg.addColorStop(0.55, '#1a1a1b'); bg.addColorStop(1, '#0c0c0c');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (const [x, y, r] of s.bokeh) { g.fillStyle = 'rgba(255,255,255,.035)'; g.beginPath(); g.arc(x * w, y * h, r, 0, PI2); g.fill(); }

    const cx = w / 2, R = Math.min(w * 0.3, h * 0.17), cy = h * 0.56;
    const schweben = Math.sin(t * 1.1) * 4;
    // Kabel + Fassung
    const fb = R * 0.82, ft = cy - R * 2.15 + schweben, fu = cy - R * 0.72 + schweben;
    g.fillStyle = '#0d0d0e'; g.fillRect(cx - 3, 0, 6, ft);
    const fg = g.createLinearGradient(cx - fb / 2, 0, cx + fb / 2, 0);
    fg.addColorStop(0, '#0a0a0a'); fg.addColorStop(0.35, '#2b2b2d'); fg.addColorStop(0.55, '#3a3a3d'); fg.addColorStop(1, '#070707');
    g.fillStyle = fg;
    g.beginPath(); g.moveTo(cx - fb * 0.35, ft); g.quadraticCurveTo(cx - fb * 0.5, ft + R * 0.1, cx - fb * 0.5, ft + R * 0.45); g.lineTo(cx + fb * 0.5, ft + R * 0.45); g.quadraticCurveTo(cx + fb * 0.5, ft + R * 0.1, cx + fb * 0.35, ft); g.fill();
    g.fillRect(cx - fb / 2, ft + R * 0.45, fb, fu - ft - R * 0.45);
    g.fillStyle = 'rgba(0,0,0,.55)';
    for (let i = 0; i < 6; i++) g.fillRect(cx - fb / 2, ft + R * 0.6 + i * ((fu - ft - R * 0.7) / 6), fb, 2.5);
    g.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 6; i++) g.fillRect(cx - fb / 2, ft + R * 0.6 + i * ((fu - ft - R * 0.7) / 6) - 1.5, fb, 1);

    // Gold-Licht innen (scheint durch die Risse)
    const an = raus(phase(t, 0.6, 2.4));
    const flackern = an * (0.92 + 0.08 * Math.sin(t * 13) * Math.sin(t * 3.7));
    const by = cy + schweben;
    g.globalCompositeOperation = 'lighter';
    leuchtPunkt(g, cx, by, R * 2.2, 'rgba(255,170,60,A)', 0.25 * flackern);
    g.globalCompositeOperation = 'source-over';
    const kern = g.createRadialGradient(cx, by, 0, cx, by, R);
    kern.addColorStop(0, `rgba(255,214,120,${flackern})`); kern.addColorStop(0.6, `rgba(230,140,40,${0.85 * flackern})`); kern.addColorStop(1, `rgba(120,60,10,${0.7 * flackern})`);
    g.fillStyle = kern; g.beginPath(); g.arc(cx, by, R * 0.97, 0, PI2); g.fill();
    // Glühfäden
    g.globalCompositeOperation = 'lighter';
    for (let i = -2; i <= 2; i++) {
      const x = cx + i * R * 0.13, hoch = R * (0.95 - Math.abs(i) * 0.12);
      g.strokeStyle = `rgba(255,220,140,${flackern})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, by - R * 0.9); g.lineTo(x, by - R * 0.9 + hoch * 1.2); g.stroke();
      g.strokeStyle = `rgba(255,180,80,${0.35 * flackern})`; g.lineWidth = 7; g.stroke();
    }
    g.globalCompositeOperation = 'source-over';

    // Steinscherben, die beim Aufknacken auseinanderrücken
    const auf = raus(phase(t, 0.4, 2.6)) * R * 0.06 + Math.sin(t * 1.4) * R * 0.008;
    for (const sc of s.scherben) {
      g.save();
      g.translate(cx + sc.dx * auf, by + sc.dy * auf);
      g.rotate(sc.dreh * (auf / R) * 4);
      g.beginPath(); sc.pkt.forEach(([x, y], i) => i ? g.lineTo(x * R, y * R) : g.moveTo(x * R, y * R)); g.closePath();
      const st = g.createLinearGradient(-R, -R, R, R);
      st.addColorStop(0, `rgb(${70 * sc.hell},${70 * sc.hell},${72 * sc.hell})`); st.addColorStop(0.5, '#232325'); st.addColorStop(1, '#0d0d0e');
      g.fillStyle = st; g.fill();
      g.strokeStyle = `rgba(255,190,90,${0.5 * flackern})`; g.lineWidth = 1.2; g.stroke();
      g.restore();
    }
    // Kern-Loch vorne: man sieht die Glühfäden
    g.globalCompositeOperation = 'lighter';
    leuchtPunkt(g, cx, by - R * 0.05, R * 0.45, 'rgba(255,200,110,A)', 0.55 * flackern);
    g.globalCompositeOperation = 'source-over';

    // Boden mit Steinen
    const bodenY = h * 0.86;
    const bo = g.createLinearGradient(0, bodenY - 30, 0, h);
    bo.addColorStop(0, 'rgba(10,10,10,0)'); bo.addColorStop(0.3, '#121213'); bo.addColorStop(1, '#070707');
    g.fillStyle = bo; g.fillRect(0, bodenY - 30, w, h);
    for (const [x, y, r, k] of s.boden) {
      g.fillStyle = k > 0.5 ? '#1c1c1e' : '#121214';
      g.beginPath(); g.ellipse(x * w, y * h, r, r * 0.55, k, 0, PI2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.ellipse(x * w - r * 0.2, y * h - r * 0.2, r * 0.5, r * 0.2, k, 0, PI2); g.fill();
    }
    vignette(g, w, h, 0.55);
  },

  // 3 · MINEFIELD PRO — schwarzes Loch, Formeln strömen hinein
  minen(g, w, h, t, s) {
    g.fillStyle = '#020204'; g.fillRect(0, 0, w, h);
    sternenhimmel(g, w, h, t, s, 220, raus(phase(t, 0, 1)));
    const hx = w * 0.33, hy = h * 0.4, r = Math.min(w, h) * 0.1;
    const an = raus(phase(t, 0.4, 2));
    // Formel-Strom
    const ZEICHEN = ['∂', '∇', 'Σ', 'π', '∫', 'ψ', 'λ', 'Δ', 'e', '=', 'mc²', '√', '∞', 'x', 'ħ', 'ρ', 'μ', 'n', '0', '1', '2', 'dt', 'ln', '∮'];
    if (!s.teile) {
      const z = zufall(9);
      s.teile = Array.from({ length: 260 }, () => ({ u: z(), y0: z(), v: 0.03 + z() * 0.05, c: ZEICHEN[Math.floor(z() * ZEICHEN.length)], gr: z() }));
    }
    const strom = raus(phase(t, 0.9, 2.8));
    g.textBaseline = 'middle'; g.textAlign = 'center';
    for (const p of s.teile) {
      p.u = (p.u + p.v / 60 * (0.4 + strom)) % 1;
      const u = p.u;
      // Bahn: von rechts (breit gefächert) in einer Kurve ins Loch
      const sx = w * 1.08, sy = h * (-0.1 + p.y0 * 1.2);
      const kx = w * (0.62 + p.y0 * 0.18), ky = hy + (sy - hy) * 0.45;
      const q = 1 - Math.pow(1 - u, 2);
      const x = (1 - q) * (1 - q) * sx + 2 * (1 - q) * q * kx + q * q * hx;
      const y = (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * ky + q * q * hy;
      const nah = Math.hypot(x - hx, y - hy) / (r * 6);
      const a = strom * klemm(nah) * klemm(u * 6) * (0.35 + p.gr * 0.65);
      if (a < 0.02) continue;
      const groesse = (7 + p.gr * 9) * (0.45 + 0.55 * klemm(nah));
      g.font = `${groesse.toFixed(0)}px Georgia, serif`;
      g.fillStyle = `rgba(235,240,255,${a})`;
      g.fillText(p.c, x, y);
    }
    // Akkretionsscheibe
    g.save(); g.translate(hx, hy); g.rotate(-0.45);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = `rgba(255,${140 + i * 30},${60 + i * 20},${(0.5 - i * 0.12) * an})`;
      g.lineWidth = 12 - i * 4;
      g.beginPath(); g.ellipse(0, 0, r * (2.1 - i * 0.12), r * (0.75 - i * 0.05), 0, 0, PI2); g.stroke();
    }
    if (!s.ring) { const z = zufall(4); s.ring = Array.from({ length: 140 }, () => [z() * PI2, 1.7 + z() * 0.6, z()]); }
    for (const p of s.ring) {
      p[0] += (0.6 / p[1]) / 60;
      const x = Math.cos(p[0]) * r * p[1], y = Math.sin(p[0]) * r * p[1] * 0.36;
      g.fillStyle = `rgba(255,${170 + p[2] * 80},${90 + p[2] * 100},${an * (0.4 + p[2] * 0.6)})`;
      g.fillRect(x, y, 1.6, 1.6);
    }
    g.restore();
    leuchtPunkt(g, hx, hy, r * 2.6, 'rgba(255,140,60,A)', 0.22 * an);
    g.globalCompositeOperation = 'source-over';
    // Ereignishorizont
    g.fillStyle = '#000'; g.beginPath(); g.arc(hx, hy, r, 0, PI2); g.fill();
    g.strokeStyle = `rgba(255,190,120,${0.85 * an})`; g.lineWidth = 1.6; g.beginPath(); g.arc(hx, hy, r * 1.03, 0, PI2); g.stroke();
    // vordere Hälfte der Scheibe über dem Loch
    g.save(); g.translate(hx, hy); g.rotate(-0.45); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(255,200,130,${0.7 * an})`; g.lineWidth = 5;
    g.beginPath(); g.ellipse(0, 0, r * 2, r * 0.72, 0, 0.05, Math.PI - 0.05); g.stroke();
    g.restore(); g.globalCompositeOperation = 'source-over';
    vignette(g, w, h, 0.5);
  },

  // 4 · WALL DUEL — leeres, leuchtendes Sechseck
  wand(g, w, h, t, s) {
    const R = Math.min(w * 0.27, h * 0.16);
    sechseck(g, w, h, t, s, w / 2, h * 0.43, R);
    vignette(g, w, h, 0.5);
  },

  // 5 · TOWER TACTICS — Kristall im schrägen Lichtstrahl (Vorlage ALCHEMY)
  turm(g, w, h, t, s) {
    g.fillStyle = '#050403'; g.fillRect(0, 0, w, h);
    const an = raus(phase(t, 0.2, 2));
    // Lichtstrahl von links oben
    g.save(); g.translate(-w * 0.1, -h * 0.1); g.rotate(0.62);
    const sb = g.createLinearGradient(0, -w * 0.25, 0, w * 0.25);
    sb.addColorStop(0, 'rgba(255,190,110,0)'); sb.addColorStop(0.5, `rgba(255,190,110,${0.16 * an})`); sb.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = sb; g.fillRect(0, -w * 0.25, Math.hypot(w, h) * 1.2, w * 0.5);
    g.restore();
    // Boden (glänzend)
    const by = h * 0.8;
    const bo = g.createLinearGradient(0, by, 0, h);
    bo.addColorStop(0, '#16110c'); bo.addColorStop(1, '#050403');
    g.fillStyle = bo; g.fillRect(0, by, w, h - by);
    // Kristall
    const cx = w / 2, kb = Math.min(w * 0.27, h * 0.15), kh = Math.min(h * 0.44, kb * 3.1);
    const unten = by - 2, schulter = unten - kh * 0.72, spitze = unten - kh;
    const kristall = (spiegel) => {
      g.save();
      if (spiegel) { g.translate(0, unten * 2); g.scale(1, -1); g.globalAlpha = 0.18; }
      const fl = [
        [[cx - kb * 0.5, unten], [cx - kb * 0.5, schulter], [cx - kb * 0.18, schulter - kb * 0.1], [cx - kb * 0.18, unten + 4], '#2a1a0e', '#6a4424'],
        [[cx - kb * 0.18, unten + 4], [cx - kb * 0.18, schulter - kb * 0.1], [cx + kb * 0.2, schulter - kb * 0.1], [cx + kb * 0.2, unten + 4], '#4a301a', '#c08a4c'],
        [[cx + kb * 0.2, unten + 4], [cx + kb * 0.2, schulter - kb * 0.1], [cx + kb * 0.5, schulter], [cx + kb * 0.5, unten], '#1b1009', '#5a3a1e'],
      ];
      const licht = weich(phase(t, 0.6, 2.6));
      for (const [a, b, c, d, f1, f2] of fl) {
        const v = g.createLinearGradient(0, unten, 0, spitze);
        v.addColorStop(0, f1); v.addColorStop(klemm(licht), f2); v.addColorStop(1, f1);
        g.fillStyle = v; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); g.fill();
      }
      // Spitze
      const sp = [[cx - kb * 0.5, schulter, cx - kb * 0.18, schulter - kb * 0.1, '#7a5228'], [cx - kb * 0.18, schulter - kb * 0.1, cx + kb * 0.2, schulter - kb * 0.1, '#e8b065'], [cx + kb * 0.2, schulter - kb * 0.1, cx + kb * 0.5, schulter, '#5a3a1e']];
      for (const [x1, y1, x2, y2, f] of sp) { g.fillStyle = f; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(cx + kb * 0.02, spitze); g.closePath(); g.fill(); }
      // Adern im Kristall
      if (!s.adern) { const z = zufall(21); s.adern = Array.from({ length: 22 }, () => [z(), z(), z(), z()]); }
      g.strokeStyle = `rgba(255,220,170,${0.18 * licht})`; g.lineWidth = 1;
      for (const [a, b, c, d] of s.adern) { g.beginPath(); g.moveTo(cx - kb * 0.45 + a * kb * 0.9, unten - b * kh * 0.7); g.lineTo(cx - kb * 0.45 + c * kb * 0.9, unten - d * kh * 0.7); g.stroke(); }
      g.restore();
    };
    kristall(true);
    kristall(false);
    // glühende Spitze
    const glut = raus(phase(t, 1.2, 2.6)) * (0.85 + 0.15 * Math.sin(t * 2.2));
    g.globalCompositeOperation = 'lighter';
    leuchtPunkt(g, cx, spitze + kb * 0.15, kb * 1.4, 'rgba(255,190,100,A)', 0.55 * glut);
    leuchtPunkt(g, cx, spitze + kb * 0.1, kb * 0.25, 'rgba(255,240,200,A)', glut);
    // Staub im Licht
    if (!s.staub) { const z = zufall(6); s.staub = Array.from({ length: 70 }, () => [z(), z(), z()]); }
    for (const p of s.staub) {
      p[1] = (p[1] + 0.0006 * (0.5 + p[2])) % 1; p[0] = (p[0] + 0.0002) % 1;
      const x = p[0] * w, y = p[1] * h;
      const imStrahl = Math.abs((y - x * Math.tan(0.62) * 0.9) - h * 0.05) < w * 0.25 ? 1 : 0.15;
      g.fillStyle = `rgba(255,210,150,${0.35 * an * imStrahl * p[2]})`; g.fillRect(x, y, 1.5, 1.5);
    }
    g.globalCompositeOperation = 'source-over';
    vignette(g, w, h, 0.55);
  },

  // 6 · GRID WARS — Würfel aus 27 Würfeln, Lichtstrahlen dahinter
  raster(g, w, h, t, s) {
    g.fillStyle = '#060606'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.46;
    const an = raus(phase(t, 0.3, 2.4));
    // Strahlen
    g.save(); g.translate(cx, cy); g.rotate(t * 0.05); g.globalCompositeOperation = 'lighter';
    const L = Math.hypot(w, h);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * PI2, b = a + 0.06 + (i % 3) * 0.03;
      const v = g.createRadialGradient(0, 0, 0, 0, 0, L * 0.6);
      v.addColorStop(0, `rgba(255,255,255,${0.16 * an})`); v.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = v; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, L, a, b); g.closePath(); g.fill();
    }
    g.restore();
    leuchtPunkt(g, cx, cy, Math.min(w, h) * 0.35, 'rgba(255,255,255,A)', 0.25 * an);
    g.globalCompositeOperation = 'source-over';
    // Würfel
    const c = Math.min(w, h) * 0.075, abst = c * 1.32;
    const iso = (x, y, z) => [cx + (x - y) * abst * 0.866, cy + (x + y) * abst * 0.5 - z * abst];
    if (!s.wuerfel) {
      const z = zufall(8); s.wuerfel = [];
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let k = -1; k <= 1; k++)
        s.wuerfel.push({ x, y, z: k, ox: (z() - 0.5) * 12, oy: (z() - 0.5) * 12, oz: (z() - 0.5) * 12, v: z() * 0.6, p: z() * 6 });
      s.wuerfel.sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z) || a.z - b.z);
    }
    for (const q of s.wuerfel) {
      const e = raus(phase(t, 0.2 + q.v, 1.8 + q.v));
      const wob = Math.sin(t * 1.2 + q.p) * 0.04 * e;
      const x = q.x + q.ox * (1 - e), y = q.y + q.oy * (1 - e), zz = q.z + q.oz * (1 - e) + wob;
      const [px, py] = iso(x, y, zz);
      const k = c * 0.866, k2 = c * 0.5;
      g.globalAlpha = klemm(e * 2);
      // oben
      g.fillStyle = '#121214'; g.beginPath(); g.moveTo(px, py - c); g.lineTo(px + k, py - c + k2); g.lineTo(px, py - c + c); g.lineTo(px - k, py - c + k2); g.closePath(); g.fill();
      // links
      g.fillStyle = '#060607'; g.beginPath(); g.moveTo(px - k, py - c + k2); g.lineTo(px, py); g.lineTo(px, py + c); g.lineTo(px - k, py + k2); g.closePath(); g.fill();
      // rechts
      g.fillStyle = '#0c0c0e'; g.beginPath(); g.moveTo(px + k, py - c + k2); g.lineTo(px, py); g.lineTo(px, py + c); g.lineTo(px + k, py + k2); g.closePath(); g.fill();
      // leuchtende Kanten
      g.strokeStyle = `rgba(255,255,255,${0.75 * e})`; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(px, py - c); g.lineTo(px + k, py - c + k2); g.lineTo(px, py); g.lineTo(px - k, py - c + k2); g.closePath();
      g.moveTo(px, py); g.lineTo(px, py + c); g.moveTo(px - k, py - c + k2); g.lineTo(px - k, py + k2); g.lineTo(px, py + c); g.lineTo(px + k, py + k2); g.lineTo(px + k, py - c + k2); g.stroke();
      g.globalAlpha = 1;
    }
    vignette(g, w, h, 0.6);
  },

  // 7 · NUMBER DUEL — nur Schwarz mit Lichtstreif (die Schrift RICH/RISK macht das Gerüst)
  duell(g, w, h, t, s) {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const an = raus(phase(t, 1.4, 3));
    const x = ((t * 0.12) % 1.6 - 0.3) * w;
    const v = g.createLinearGradient(x - 120, 0, x + 120, 0);
    v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.5, `rgba(255,255,255,${0.045 * an})`); v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    if (!s.korn) { const z = zufall(2); s.korn = Array.from({ length: 300 }, () => [z(), z(), z()]); }
    for (const [a, b, c] of s.korn) { g.fillStyle = `rgba(255,255,255,${0.04 * c})`; g.fillRect(a * w, b * h, 1, 1); }
  },

  // 8 · LINEUP — Sechseck mit fließendem Rauch, fünf Lichter in einer Reihe
  reihe(g, w, h, t, s) {
    const R = Math.min(w * 0.3, h * 0.18), cx = w / 2, cy = h * 0.43;
    const { ecken, an } = sechseck(g, w, h, t, s, cx, cy, R);
    inSechseck(g, ecken, () => {
      if (!s.rauch) { const z = zufall(14); s.rauch = Array.from({ length: 160 }, () => ({ u: z(), b: z(), v: 0.04 + z() * 0.06 })); }
      g.globalCompositeOperation = 'lighter';
      for (const p of s.rauch) {
        p.u = (p.u + p.v / 60) % 1;
        const x = cx - R + p.u * R * 2;
        const y = cy + Math.sin(p.u * 6 + t * 0.8 + p.b * 2) * R * 0.28 + (p.b - 0.5) * R * 0.35 + Math.sin(p.u * 15 + t) * 4;
        const a = Math.sin(p.u * Math.PI) * 0.12 * an;
        const r = 6 + p.b * 14;
        const v = g.createRadialGradient(x, y, 0, x, y, r);
        v.addColorStop(0, `rgba(220,215,255,${a})`); v.addColorStop(1, 'rgba(220,215,255,0)');
        g.fillStyle = v; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // fünf Steine in einer schrägen Reihe, leuchten nacheinander auf
      for (let i = 0; i < 5; i++) {
        const x = cx - R * 0.56 + i * R * 0.28, y = cy + R * 0.22 - i * R * 0.11;
        const welle = klemm(Math.sin(t * 2 - i * 0.6) * 0.5 + 0.5) * raus(phase(t, 1 + i * 0.2, 1.8 + i * 0.2));
        leuchtPunkt(g, x, y, R * 0.16, 'rgba(190,150,255,A)', 0.6 * welle);
        g.fillStyle = `rgba(245,240,255,${0.3 + 0.7 * welle})`; g.beginPath(); g.arc(x, y, R * 0.045, 0, PI2); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    });
    vignette(g, w, h, 0.5);
  },

  // 9 · LOGIC DUEL — Sechseck mit Schaltkreis-Herz (gegen die KI)
  logik(g, w, h, t, s) {
    const R = Math.min(w * 0.3, h * 0.18), cx = w / 2, cy = h * 0.43;
    const { ecken, an } = sechseck(g, w, h, t, s, cx, cy, R);
    if (!s.bahnen) {
      const z = zufall(31); s.bahnen = [];
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * PI2 + (z() - 0.5) * 0.2;
        let x = Math.cos(a) * R * 0.22, y = Math.sin(a) * R * 0.2;
        const pkt = [[x, y]];
        for (let k = 0; k < 4; k++) {
          const lang = R * (0.12 + z() * 0.16);
          const rich = k % 2 === 0 ? a : Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
          x += Math.cos(rich) * lang; y += Math.sin(rich) * lang;
          pkt.push([x, y]);
        }
        s.bahnen.push({ pkt, phase: z(), v: 0.25 + z() * 0.35 });
      }
    }
    inSechseck(g, ecken, () => {
      g.save(); g.translate(cx, cy);
      const zeichnen = raus(phase(t, 0.8, 2.6));
      g.lineWidth = 1.2; g.lineCap = 'round'; g.lineJoin = 'round';
      for (const b of s.bahnen) {
        g.strokeStyle = `rgba(47,227,194,${0.32 * zeichnen})`;
        g.beginPath(); b.pkt.forEach(([x, y], i) => i ? g.lineTo(x * zeichnen, y * zeichnen) : g.moveTo(x, y)); g.stroke();
        const [ex, ey] = b.pkt[b.pkt.length - 1];
        g.fillStyle = `rgba(47,227,194,${0.6 * zeichnen})`; g.beginPath(); g.arc(ex * zeichnen, ey * zeichnen, 2, 0, PI2); g.fill();
        // Impuls wandert nach außen
        const u = (t * b.v + b.phase) % 1;
        const seg = Math.min(b.pkt.length - 2, Math.floor(u * (b.pkt.length - 1)));
        const f = u * (b.pkt.length - 1) - seg;
        const [x1, y1] = b.pkt[seg], [x2, y2] = b.pkt[seg + 1];
        g.globalCompositeOperation = 'lighter';
        leuchtPunkt(g, (x1 + (x2 - x1) * f) * zeichnen, (y1 + (y2 - y1) * f) * zeichnen, 7, 'rgba(120,255,200,A)', 0.9 * zeichnen);
        g.globalCompositeOperation = 'source-over';
      }
      // Herz in der Mitte
      const schlag = 1 + 0.06 * Math.pow(Math.max(0, Math.sin(t * 3.4)), 8);
      g.scale(schlag, schlag);
      const hz = R * 0.2;
      const herz = new Path2D();
      herz.moveTo(0, hz * 0.9);
      herz.bezierCurveTo(-hz * 1.6, -hz * 0.1, -hz * 0.8, -hz * 1.3, 0, -hz * 0.45);
      herz.bezierCurveTo(hz * 0.8, -hz * 1.3, hz * 1.6, -hz * 0.1, 0, hz * 0.9);
      const hg = g.createRadialGradient(0, -hz * 0.2, 0, 0, 0, hz * 1.3);
      hg.addColorStop(0, `rgba(120,255,190,${0.9 * an})`); hg.addColorStop(0.6, `rgba(30,150,200,${0.85 * an})`); hg.addColorStop(1, `rgba(10,40,80,${0.9 * an})`);
      g.fillStyle = hg; g.fill(herz);
      g.strokeStyle = `rgba(160,255,220,${an})`; g.lineWidth = 1.4; g.stroke(herz);
      g.globalCompositeOperation = 'lighter';
      leuchtPunkt(g, 0, 0, hz * 2.6, 'rgba(47,227,194,A)', 0.35 * an * schlag);
      g.restore(); g.globalCompositeOperation = 'source-over';
    });
    vignette(g, w, h, 0.5);
  },

  // 10 · SHARDS — schwebende Glasscherben, die sich zu einer Form zusammensetzen
  scherben(g, w, h, t, s) {
    g.fillStyle = '#04060a'; g.fillRect(0, 0, w, h);
    const an = raus(phase(t, 0.2, 1.6));
    const lv = g.createLinearGradient(w / 2, 0, w / 2, h);
    lv.addColorStop(0, `rgba(150,200,255,${0.12 * an})`); lv.addColorStop(0.6, 'rgba(150,200,255,0)');
    g.fillStyle = lv; g.beginPath(); g.moveTo(w * 0.42, 0); g.lineTo(w * 0.58, 0); g.lineTo(w * 0.85, h); g.lineTo(w * 0.15, h); g.fill();
    const cx = w / 2, cy = h * 0.44, k = Math.min(w, h) * 0.075;
    if (!s.teile) {
      const z = zufall(17);
      // Form aus 5×5 Feldern (Kreuz-Muster wie ein Spielstein), jedes Feld zweigeteilt
      const form = ['01110', '11011', '10101', '11011', '01110'];
      s.teile = [];
      form.forEach((zeile, y) => [...zeile].forEach((c, x) => {
        if (c !== '1') return;
        for (const halb of [0, 1]) s.teile.push({ x: x - 2, y: y - 2, halb, ox: (z() - 0.5) * 14, oy: (z() - 0.5) * 14, rot: (z() - 0.5) * 6, v: z() * 0.7, p: z() * 6 });
      }));
    }
    const zusammen = raus(phase(t, 0.4, 2.6));
    for (const q of s.teile) {
      const e = raus(phase(t, 0.3 + q.v, 2 + q.v));
      const atmen = Math.sin(t * 0.9 + q.p) * 0.08;
      const x = cx + (q.x + q.ox * (1 - e) + q.x * atmen * 0.4) * k * 1.06;
      const y = cy + (q.y + q.oy * (1 - e) + q.y * atmen * 0.4) * k * 1.06;
      g.save(); g.translate(x, y); g.rotate(q.rot * (1 - e) + atmen * 0.3);
      g.beginPath();
      if (q.halb === 0) { g.moveTo(-k / 2, -k / 2); g.lineTo(k / 2, -k / 2); g.lineTo(-k / 2, k / 2); }
      else { g.moveTo(k / 2, -k / 2); g.lineTo(k / 2, k / 2); g.lineTo(-k / 2, k / 2); }
      g.closePath();
      const v = g.createLinearGradient(-k / 2, -k / 2, k / 2, k / 2);
      v.addColorStop(0, `rgba(190,225,255,${0.22 * e})`); v.addColorStop(1, `rgba(40,70,120,${0.12 * e})`);
      g.fillStyle = v; g.fill();
      g.strokeStyle = `rgba(200,235,255,${0.8 * e})`; g.lineWidth = 1; g.stroke();
      g.restore();
    }
    g.globalCompositeOperation = 'lighter';
    leuchtPunkt(g, cx, cy, k * 4, 'rgba(120,180,255,A)', 0.18 * zusammen);
    g.globalCompositeOperation = 'source-over';
    vignette(g, w, h, 0.55);
  },
};

// ═══════════════════════════════════════════════════════════════════
// Abspielen auf einer Leinwand
// ═══════════════════════════════════════════════════════════════════
export class Cover {
  constructor(canvas, id) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.id = id;
    this.szene = SZENEN[id]; this.s = {}; this.t0 = performance.now(); this.laeuft = false;
    this.groesse(); addEventListener('resize', () => this.groesse());
  }
  groesse() {
    const r = this.cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    this.w = r.width || innerWidth; this.h = r.height || innerHeight; this.d = d;
    this.cv.width = Math.round(this.w * d); this.cv.height = Math.round(this.h * d);
    this.s = {}; // Teilchen neu verteilen
  }
  start() { if (this.laeuft) return; this.laeuft = true; const los = () => { if (!this.laeuft) return; this.bild(); requestAnimationFrame(los); }; requestAnimationFrame(los); }
  stop() { this.laeuft = false; }
  zeit() { return (performance.now() - this.t0) / 1000; }
  bild(t = this.zeit()) {
    this.g.setTransform(this.d, 0, 0, this.d, 0, 0);
    this.szene(this.g, this.w, this.h, t, this.s);
  }
}

// Für Icons: ein fertiges Standbild in beliebiger Größe
export function standbild(canvas, id, groesse, t = 4) {
  canvas.width = canvas.height = groesse;
  const g = canvas.getContext('2d'), s = {};
  for (let i = 0; i < 10; i++) SZENEN[id](g, groesse, groesse, t - 0.5 + i * 0.05, s);
}
