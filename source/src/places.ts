// The places behind the other planets. Each one is a wall, a floor and a few things to walk up to (room.ts does the rest):
// a cabin on the space station for About, a lecture hall for Education, a small street for Experience,
// an observatory for Skills and a post office for Contact. Every word shown comes from data.ts.
import devotion from './assets/devotion.jpg';
import free from './assets/free.jpg';
import mountains from './assets/mountains.jpg';
import untourable from './assets/untourable.jpg';
import { resume } from './data';
import { clamp, esc, hash, type Env, type SceneFactory, type Stop } from './room';
import { GALAXY_R, PHI, zones, type ZoneKind } from './zones';

const zone = (id: ZoneKind) => zones.find((z) => z.id === id)!;
const picture = (src: string) => {
  const im = new Image();
  im.src = src;
  return im;
};
const ready = (im: HTMLImageElement) => im.complete && im.naturalWidth > 0;

/** Brushes the places share. */
function kit(env: Env) {
  const { g } = env;
  const pick = <T>(dark: T, light: T) => (env.light ? light : dark);
  /** A floor of square tiles laid in rows that deepen toward you. `tone` colours one tile. */
  const tiles = (tw: number, tone: (col: number, row: number) => string, seam: string, stagger = false): CanvasPattern | null => {
    const { dpr, vh, floorY, u } = env;
    const H = Math.ceil(vh - floorY) + 4;
    const cols = 8;
    const tile = document.createElement('canvas');
    tile.width = Math.round(cols * tw * dpr);
    tile.height = H * dpr;
    const c = tile.getContext('2d')!;
    c.scale(tile.width / (cols * tw), dpr);
    let y = 0;
    let rh = 3 * u;
    for (let row = 0; y < H; row++) {
      const off = stagger && row % 2 ? tw / 2 : 0;
      for (let col = -1; col < cols; col++) {
        c.fillStyle = tone((col + cols) % cols, row);
        c.fillRect(col * tw + off, y, tw + 0.5, rh + 0.5);
        c.fillStyle = seam;
        c.fillRect(col * tw + off, y, 0.8, rh);
      }
      c.fillStyle = seam;
      c.fillRect(0, y, cols * tw, 0.8);
      y += rh;
      rh *= 1.42;
    }
    const pat = g.createPattern(tile, 'repeat');
    pat?.setTransform(new DOMMatrix().scale((cols * tw) / tile.width, 1 / dpr));
    return pat;
  };
  /** Lays a floor pattern and lets it fall into shade under the wall and at your feet. */
  const lay = (pat: CanvasPattern | null, fallback: string, x0: number, x1: number, dusk: number) => {
    const { floorY, vh } = env;
    const H = vh - floorY + 60;
    g.save();
    g.translate(0, floorY);
    g.fillStyle = pat ?? fallback;
    g.fillRect(x0, 0, x1 - x0, H);
    g.restore();
    const sh = g.createLinearGradient(0, floorY, 0, vh);
    sh.addColorStop(0, `rgba(0,0,0,${dusk})`);
    sh.addColorStop(0.18, 'rgba(0,0,0,0)');
    sh.addColorStop(0.7, 'rgba(0,0,0,0)');
    sh.addColorStop(1, `rgba(0,0,0,${dusk * 0.6})`);
    g.fillStyle = sh;
    g.fillRect(x0, floorY, x1 - x0, H);
  };
  /** A rectangle with a soft shadow under it. */
  const slab = (l: number, t: number, w: number, h: number, fill: string, shadow: string, blur = 14) => {
    g.save();
    g.shadowColor = shadow;
    g.shadowBlur = blur;
    g.shadowOffsetY = blur * 0.45 * env.dpr;
    g.fillStyle = fill;
    g.fillRect(l, t, w, h);
    g.restore();
  };
  /** Sets a font that makes `s` fit `max`, starting from `size`. Returns the size used. */
  const fit = (s: string, max: number, weight: number, size: number, family: string) => {
    g.font = `${weight} ${size}px ${family}`;
    const w = g.measureText(s).width;
    if (w > max) {
      size *= max / w;
      g.font = `${weight} ${size}px ${family}`;
    }
    return size;
  };
  /** The small label under something on the wall. It takes the stop's colour while you stand at it. */
  const caption = (cx: number, y: number, s: string, glow: number, acc: string, dim: string, e: number) => {
    if (env.size < 3) return; // on a phone he stands where the label would be, and the panel below already names it
    g.globalAlpha = 1 - e;
    g.font = `500 ${clamp(1.9 * env.u, 7, 10)}px ${env.MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillStyle = glow > 0.5 ? acc : dim;
    g.fillText(s.toUpperCase(), cx, y);
    g.globalAlpha = 1;
  };
  const rr = (l: number, t: number, w: number, h: number, r: number) => {
    g.beginPath();
    g.roundRect(l, t, w, h, r);
  };
  return { pick, tiles, lay, slab, fit, caption, rr };
}

// ================================================================== About: a cabin on the space station
export const cabinScene: SceneFactory = (env) => {
  const { g, DISPLAY, MONO } = env;
  const K = kit(env);
  const z = zone('brief');
  const C = {
    wall: K.pick('#1a1f2a', '#e7ebf1'), wallLow: K.pick('#141822', '#dce1e9'), trim: K.pick('#2b3242', '#f8fafc'),
    seam: K.pick('rgba(255,255,255,0.07)', 'rgba(40,50,80,0.12)'), line: K.pick('rgba(210,225,255,0.22)', 'rgba(40,50,80,0.24)'),
    text: K.pick('#98a1b4', '#727988'), strong: K.pick('#e9edf3', '#262a35'), shadow: K.pick('rgba(0,0,0,0.6)', 'rgba(50,60,90,0.3)'),
    glowLine: K.pick('rgba(140,220,255,0.75)', 'rgba(120,170,230,0.7)'), acc: K.pick('#9fc4ff', '#2f5fae'),
    door: K.pick('#232a38', '#d5dbe5'), doorLine: K.pick('rgba(210,225,255,0.26)', 'rgba(40,50,80,0.3)'),
    plinth: K.pick('#cfd5df', '#ffffff'), plinthTop: K.pick('#e4e8ef', '#f1f4f8'), deck: K.pick([218, 14, 19], [218, 18, 80]),
    board: K.pick('#e6e8ec', '#ffffff'), ink: '#1f2733', screen: '#060b14', bezel: K.pick('#0d1118', '#2a303c'),
  };
  const about = resume.about;
  const pics = { photo: picture(mountains), covers: [picture(untourable), picture(free), picture(devotion)] };
  const [listening, ...rest] = about.offClock;
  const stops: Stop[] = [
    { title: 'Where I’m from', meta: resume.location, body: esc(about.paras[0]), accent: C.acc, w: 0, h: 0 },
    { title: 'Why math', body: esc(about.paras[1]), accent: C.acc, w: 0, h: 0 },
    { title: listening.label, body: esc(listening.text), accent: C.acc, w: 0, h: 0 },
    { title: 'Off the clock', body: esc(`${about.paras[2]} ${rest.map((o) => `${o.label}: ${o.text}.`).join(' ')}`), accent: C.acc, w: 0, h: 0 },
    {
      title: 'This map',
      body: `Each planet on this map holds one section of my resume, laid out along a golden spiral. Visit them in any order, or use Next to go straight through. Fly with WASD or the arrow keys, click a planet or press 1 to ${zones.length} to travel, E to land, M for the map, L for light mode and R for the resume. On a phone, hold to fly and tap a planet to land.`,
      accent: C.acc, w: 0, h: 0,
    },
  ];
  let u = 1;
  let floor: CanvasPattern | null = null;
  const bay = () => 34 * u;

  const HOLO = K.pick('120,225,255', '40,120,220');
  const hologram = (cx: number, glow: number, t: number) => {
    // the photo, thrown up off the wall by a projector on a ledge
    const { w, h } = stops[0];
    const top = env.cy - h / 2 + (env.calm ? 0 : Math.sin(t * 1.3) * 0.3 * u);
    const l = cx - w / 2;
    const ph = w / 0.75;
    const ledge = env.cy + h / 2;
    g.fillStyle = C.trim;
    g.fillRect(cx - 9 * u, ledge, 18 * u, 1.2 * u);
    g.fillStyle = C.bezel;
    K.rr(cx - 5 * u, ledge - 1.6 * u, 10 * u, 1.6 * u, 0.6 * u);
    g.fill();
    g.fillStyle = `rgba(${HOLO},0.95)`;
    g.fillRect(cx - 3 * u, ledge - 1.95 * u, 6 * u, 0.4 * u);
    const beam = g.createLinearGradient(0, ledge - 1.9 * u, 0, top + ph * 0.6);
    beam.addColorStop(0, `rgba(${HOLO},${0.34 + 0.16 * glow})`);
    beam.addColorStop(1, `rgba(${HOLO},0)`);
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(cx - 3 * u, ledge - 1.9 * u);
    g.lineTo(cx + 3 * u, ledge - 1.9 * u);
    g.lineTo(l + w, top + ph);
    g.lineTo(l + w, top + ph * 0.6);
    g.lineTo(l, top + ph * 0.6);
    g.lineTo(l, top + ph);
    g.closePath();
    g.fill();
    // the light it gives off
    g.save();
    g.shadowColor = `rgba(${HOLO},${0.55 + 0.3 * glow})`;
    g.shadowBlur = 26;
    g.fillStyle = `rgba(${HOLO},0.3)`;
    g.fillRect(l, top, w, ph);
    g.restore();
    g.save();
    g.beginPath();
    g.rect(l, top, w, ph);
    g.clip();
    g.fillStyle = '#0a1420';
    g.fillRect(l, top, w, ph);
    g.globalAlpha = env.calm ? 0.9 : 0.87 + 0.04 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 23.1);
    if (ready(pics.photo)) {
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(pics.photo, l, top, w, ph);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'screen';
    g.fillStyle = `rgba(${HOLO},0.2)`;
    g.fillRect(l, top, w, ph);
    g.globalCompositeOperation = 'source-over';
    // fine lines drifting up through it, and one slow band of brighter light
    const step = Math.max(3, 0.85 * u);
    g.fillStyle = `rgba(${HOLO},0.1)`;
    for (let y = top - (env.calm ? 0 : (t * 5) % step); y < top + ph; y += step) g.fillRect(l, y, w, step * 0.3);
    if (!env.calm) {
      const sy = top + ph - ((t * 0.16) % 1) * (ph + 8 * u);
      const band = g.createLinearGradient(0, sy, 0, sy + 8 * u);
      band.addColorStop(0, `rgba(${HOLO},0)`);
      band.addColorStop(0.5, `rgba(${HOLO},0.16)`);
      band.addColorStop(1, `rgba(${HOLO},0)`);
      g.fillStyle = band;
      g.fillRect(l, sy, w, 8 * u);
    }
    g.restore();
    // corner marks
    g.strokeStyle = `rgba(${HOLO},0.9)`;
    g.lineWidth = Math.max(1 / env.k, 0.22 * u);
    const c = 2 * u;
    const o = 0.8 * u;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const px = cx + sx * (w / 2 + o);
      const py = top + ph / 2 + sy * (ph / 2 + o);
      g.beginPath();
      g.moveTo(px - sx * c, py);
      g.lineTo(px, py);
      g.lineTo(px, py - sy * c);
      g.stroke();
    }
    const line = about.photo.text.toUpperCase();
    g.fillStyle = `rgba(${HOLO},1)`;
    K.fit(line, 42 * u, 500, clamp(1.75 * u, 6, 9.5), MONO);
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(line, cx, top + ph + 2 * u);
  };
  const desk = (cx: number, glow: number, t: number) => {
    // a fold-down desk: a laptop left open on a chart, and the spiral this map is built on, pinned above it
    const { w, h } = stops[1];
    const q = w / 50;
    const l = cx - w / 2;
    const top = env.cy - h / 2;
    const deskY = top + h - 1.4 * q;
    const pw = 15 * q;
    const ph = 17 * q;
    const pl = l + w - pw - 2 * q;
    const pt = top + q;
    g.save();
    g.translate(pl + pw / 2, pt + ph / 2);
    g.rotate(0.025);
    g.translate(-pl - pw / 2, -pt - ph / 2);
    K.slab(pl, pt, pw, ph, '#f4f1e8', 'rgba(0,0,0,0.4)', 8);
    g.fillStyle = 'rgba(60,110,170,0.16)';
    for (let x = pl + 1.5 * q; x < pl + pw - 0.5 * q; x += 1.5 * q) g.fillRect(x, pt, Math.max(0.6, 0.1 * q), ph);
    for (let y = pt + 1.5 * q; y < pt + ph - 0.5 * q; y += 1.5 * q) g.fillRect(pl, y, pw, Math.max(0.6, 0.1 * q));
    g.strokeStyle = '#3a3f4a';
    g.lineWidth = Math.max(1 / env.k, 0.22 * q);
    g.beginPath();
    for (let k = 0; k <= 90; k++) {
      const a = (k / 90) * Math.PI * 4.5;
      const r = pw * 0.44 * Math.pow(PHI, (-2 * a) / Math.PI);
      const x = pl + pw * 0.56 + Math.cos(a + 2.6) * r;
      const y = pt + ph * 0.4 + Math.sin(a + 2.6) * r;
      if (k) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#3a3f4a';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    const fs = Math.max(5, 1.9 * q);
    g.font = `400 ${fs}px ${DISPLAY}`;
    let x = pl + 1.6 * q;
    g.fillText('r = R₀·φ', x, pt + ph - 1.7 * q);
    x += g.measureText('r = R₀·φ').width;
    g.font = `400 ${fs * 0.66}px ${DISPLAY}`;
    g.fillText('−2θ/π', x + fs * 0.06, pt + ph - 1.7 * q - fs * 0.45);
    g.fillStyle = '#c8452f';
    g.beginPath();
    g.arc(pl + pw / 2, pt + 1.1 * q, 0.55 * q, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // the laptop
    const sw = 27 * q;
    const sh = 16.5 * q;
    const sl = l + 2.5 * q;
    const st = deskY - 0.9 * q - sh;
    g.save();
    g.shadowColor = C.shadow;
    g.shadowBlur = 14;
    g.fillStyle = K.pick('#1b202b', '#3a404c');
    K.rr(sl, st, sw, sh, 0.9 * q);
    g.fill();
    g.restore();
    const b = 0.8 * q;
    g.fillStyle = C.screen;
    g.fillRect(sl + b, st + b, sw - b * 2, sh - b * 2);
    g.save();
    g.beginPath();
    g.rect(sl + b, st + b, sw - b * 2, sh - b * 2);
    g.clip();
    const tints = ['#9fc4ff', '#8fe0bb', '#6f7a8e', '#f0d9a0', '#6f7a8e'];
    for (let r = 0; r < 9; r++) {
      const ind = [0, 1, 1, 2, 2, 1, 0, 0, 1][r] * 1.1 * q;
      g.fillStyle = tints[r % tints.length];
      g.globalAlpha = 0.75;
      g.fillRect(sl + b + 1.2 * q + ind, st + b + (1.3 + r * 1.45) * q, (2.5 + hash(r, 81) * 4.5) * q, 0.5 * q);
      g.fillStyle = '#6f7a8e';
      g.fillRect(sl + b + 1.2 * q + ind + (3.2 + hash(r, 81) * 4.5) * q, st + b + (1.3 + r * 1.45) * q, (1 + hash(r, 82) * 2.5) * q, 0.5 * q);
    }
    g.globalAlpha = 1;
    // a daily count that sits flat, then jumps
    const gx = sl + sw * 0.47;
    const gw = sw * 0.47;
    const gy = st + sh * 0.74;
    const gh = sh * 0.5;
    g.strokeStyle = 'rgba(160,190,240,0.28)';
    g.lineWidth = 1 / env.k;
    g.setLineDash([0.8 * q, 0.8 * q]);
    g.beginPath();
    g.moveTo(gx, gy - gh * 0.42);
    g.lineTo(gx + gw, gy - gh * 0.42);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.moveTo(gx, gy);
    g.lineTo(gx + gw, gy);
    g.stroke();
    g.strokeStyle = '#8fe0bb';
    g.lineWidth = Math.max(1 / env.k, 0.3 * q);
    g.lineJoin = 'round';
    g.beginPath();
    const n = 15;
    let peak: [number, number] = [gx, gy];
    for (let k = 0; k < n; k++) {
      const v = k === 11 ? 0.92 : 0.1 + hash(k, 83) * 0.16;
      const px = gx + (k / (n - 1)) * gw;
      const py = gy - v * gh;
      if (k === 11) peak = [px, py];
      if (k) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.stroke();
    g.fillStyle = '#ff9aa6';
    g.beginPath();
    g.arc(peak[0], peak[1], (0.6 + (env.calm ? 0 : 0.14 * Math.sin(t * 3)) + 0.2 * glow) * q, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = K.pick('#8d94a2', '#aeb4c0');
    g.fillRect(sl - 1.6 * q, deskY - 0.9 * q, sw + 3.2 * q, 0.9 * q);
    g.fillStyle = K.pick('#6d7482', '#8d94a2');
    g.fillRect(sl + sw * 0.4, deskY - 0.9 * q, sw * 0.2, 0.3 * q);
    // a mug
    const mx = l + w - 8.5 * q;
    g.strokeStyle = '#d8dbe2';
    g.lineWidth = 0.6 * q;
    g.beginPath();
    g.arc(mx + 3.2 * q, deskY - 1.9 * q, 1.1 * q, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    g.fillStyle = '#d8dbe2';
    K.rr(mx, deskY - 3.6 * q, 3.2 * q, 3.6 * q, 0.4 * q);
    g.fill();
    g.fillStyle = C.acc;
    g.fillRect(mx, deskY - 2.5 * q, 3.2 * q, 0.5 * q);
    // the desk itself
    g.fillStyle = C.trim;
    g.fillRect(l - q, deskY, w + 2 * q, 1.4 * q);
    g.fillStyle = C.glowLine;
    g.globalAlpha = 0.25 + 0.6 * glow;
    g.fillRect(l - q, deskY + 1.4 * q, w + 2 * q, 0.35 * q);
    g.globalAlpha = 1;
  };
  const LABELS = ['#d9b25f', '#c8452f', '#e7dfcf'];
  const records = (cx: number, glow: number, t: number) => {
    // two records still in their sleeves, the third one playing
    const { w } = stops[2];
    const q = w / 66;
    const l = cx - w / 2;
    const side = 12.5 * q;
    const top = env.cy - stops[2].h / 2;
    const shelfY = top + side;
    pics.covers.forEach((im, i) => {
      const sl = l + i * (side + 3.4 * q);
      if (i < 2) {
        // the record, slid a little way out
        const dx = sl + side * 0.8;
        const dy = top + side / 2;
        const r = side * 0.46;
        g.fillStyle = '#0c0c0e';
        g.beginPath();
        g.arc(dx, dy, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.09)';
        g.lineWidth = 1 / env.k;
        for (const k of [0.9, 0.76, 0.62, 0.48]) {
          g.beginPath();
          g.arc(dx, dy, r * k, 0, Math.PI * 2);
          g.stroke();
        }
        g.fillStyle = LABELS[i];
        g.beginPath();
        g.arc(dx, dy, r * 0.34, 0, Math.PI * 2);
        g.fill();
      }
      K.slab(sl, top, side, side, '#111', C.shadow, 10);
      if (ready(im)) {
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(im, sl, top, side, side);
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1 / env.k;
      g.strokeRect(sl, top, side, side);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(sl + side - 0.3 * q, top, 0.3 * q, side);
    });
    // the record player
    const pl = l + 3 * side + 6.8 * q + 3 * q;
    const pw = l + w - pl;
    const face = 3.2 * q;
    const deck = 3.8 * q;
    const inset = 1.3 * q;
    const dt = shelfY - face - deck;
    g.fillStyle = K.pick('rgba(190,215,255,0.09)', 'rgba(70,100,160,0.1)');
    g.strokeStyle = K.pick('rgba(190,215,255,0.32)', 'rgba(70,100,160,0.4)');
    g.lineWidth = Math.max(1 / env.k, 0.18 * q);
    K.rr(pl + inset, dt - 7.4 * q, pw - inset * 2, 7.4 * q, 0.7 * q);
    g.fill();
    g.stroke();
    env.poly([pl + inset, dt, pl + pw - inset, dt, pl + pw, shelfY - face, pl, shelfY - face], K.pick('#2b303b', '#454b58'));
    g.fillStyle = '#6b4a30';
    g.fillRect(pl, shelfY - face, pw, face);
    g.fillStyle = '#86603f';
    g.fillRect(pl, shelfY - face, pw, 0.5 * q);
    g.fillStyle = '#d8dbe2';
    g.beginPath();
    g.arc(pl + pw - 2.4 * q, shelfY - face / 2 + 0.2 * q, 0.7 * q, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C.glowLine;
    g.fillRect(pl + 1.6 * q, shelfY - face / 2, 1.6 * q, 0.4 * q);
    const rx = 6.2 * q;
    const ry = 1.5 * q;
    const ox = pl + pw * 0.41;
    const oy = dt + deck * 0.5;
    const oval = (kx: number, ky: number, fill: string, drop = 0) => {
      g.fillStyle = fill;
      g.beginPath();
      g.ellipse(ox, oy + drop, rx * kx, ry * ky, 0, 0, Math.PI * 2);
      g.fill();
    };
    oval(1.08, 1.1, '#9aa0ac', 0.3 * q);
    oval(1, 1, '#0c0c0e');
    g.strokeStyle = 'rgba(255,255,255,0.1)';
    g.lineWidth = 1 / env.k;
    for (const k of [0.86, 0.7, 0.54]) {
      g.beginPath();
      g.ellipse(ox, oy, rx * k, ry * k, 0, 0, Math.PI * 2);
      g.stroke();
    }
    // light catching the grooves, and a mark on the label going round at 33 rpm
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = Math.max(1 / env.k, 0.2 * q);
    for (const a of [-0.5, Math.PI - 0.5]) {
      g.beginPath();
      g.ellipse(ox, oy, rx * 0.78, ry * 0.78, 0, a, a + 0.5);
      g.stroke();
    }
    oval(0.34, 0.34, LABELS[2]);
    const spin = env.calm ? 0.6 : t * 3.46;
    g.fillStyle = '#3a3f4a';
    g.beginPath();
    g.ellipse(ox + Math.cos(spin) * rx * 0.2, oy + Math.sin(spin) * ry * 0.2, 0.55 * q, 0.22 * q, 0, 0, Math.PI * 2);
    g.fill();
    oval(0.05, 0.07, '#cfd4dc');
    // the arm
    const ax = pl + pw - 3 * q;
    const ay = dt + deck * 0.3;
    g.strokeStyle = '#cfd4dc';
    g.lineCap = 'round';
    g.lineWidth = 0.5 * q;
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(ox + rx * 0.7, oy - ry * 0.25);
    g.stroke();
    g.lineCap = 'butt';
    g.fillStyle = '#cfd4dc';
    g.beginPath();
    g.arc(ax, ay, 0.8 * q, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#23262e';
    g.fillRect(ox + rx * 0.7 - 0.9 * q, oy - ry * 0.25 - 0.4 * q, 1.5 * q, 0.9 * q);
    // the shelf
    g.fillStyle = C.trim;
    g.fillRect(l - 2 * u, shelfY, w + 4 * u, 1.3 * u);
    g.fillStyle = C.glowLine;
    g.globalAlpha = 0.25 + 0.6 * glow;
    g.fillRect(l - 2 * u, shelfY + 1.3 * u, w + 4 * u, 0.35 * u);
    g.globalAlpha = 1;
  };
  const screenBox = (i: number, cx: number): [number, number, number, number] => {
    const { w, h } = stops[i];
    const l = cx - w / 2;
    const t = env.cy - h / 2;
    K.slab(l, t, w, h, C.bezel, C.shadow, 16);
    const b = 1.1 * u;
    g.fillStyle = C.screen;
    g.fillRect(l + b, t + b, w - b * 2, h - b * 2);
    return [l + b, t + b, w - b * 2, h - b * 2];
  };
  const orbits = (cx: number, t: number) => {
    // a wall screen left on an orbit diagram
    const [l, top, w, h] = screenBox(3, cx);
    g.save();
    g.beginPath();
    g.rect(l, top, w, h);
    g.clip();
    const ox = l + w * 0.5;
    const oy = top + h * 0.52;
    g.fillStyle = 'rgba(200,220,255,0.5)';
    for (let i = 0; i < 40; i++) g.fillRect(l + hash(i, 21) * w, top + hash(i, 22) * h, 1, 1);
    const sun = g.createRadialGradient(ox, oy, 0, ox, oy, h * 0.16);
    sun.addColorStop(0, 'rgba(255,236,190,1)');
    sun.addColorStop(0.3, 'rgba(255,190,110,0.6)');
    sun.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = sun;
    g.fillRect(l, top, w, h);
    const cols = ['#9fc4ff', '#8fe0bb', '#ff9aa6'];
    [0.2, 0.31, 0.44].forEach((r, i) => {
      g.strokeStyle = 'rgba(160,190,240,0.3)';
      g.lineWidth = 1 / env.k;
      g.beginPath();
      g.ellipse(ox, oy, w * r, w * r * 0.36, -0.18, 0, Math.PI * 2);
      g.stroke();
      const a = (env.calm ? 0 : t * (0.5 - i * 0.13)) + i * 2.1;
      const px = Math.cos(a) * w * r;
      const py = Math.sin(a) * w * r * 0.36;
      g.fillStyle = cols[i];
      g.beginPath();
      g.arc(ox + px * Math.cos(-0.18) - py * Math.sin(-0.18), oy + px * Math.sin(-0.18) + py * Math.cos(-0.18), Math.max(1.2, 0.55 * u), 0, Math.PI * 2);
      g.fill();
    });
    g.restore();
  };
  const chart = (cx: number, t: number) => {
    // the flight console: this galaxy, with every planet on its spiral
    const [l, top, w, h] = screenBox(4, cx);
    const ox = l + w / 2;
    const oy = top + h / 2;
    const s = (h * 0.46) / GALAXY_R;
    g.strokeStyle = 'rgba(232,184,107,0.35)';
    g.lineWidth = 1 / env.k;
    g.beginPath();
    zones.forEach((p, i) => (i ? g.lineTo(ox + p.x * s * 1.5, oy + p.y * s) : g.moveTo(ox + p.x * s * 1.5, oy + p.y * s)));
    g.stroke();
    g.fillStyle = 'rgba(232,184,107,0.9)';
    g.beginPath();
    g.arc(ox, oy, 0.5 * u, 0, Math.PI * 2);
    g.fill();
    zones.forEach((p, i) => {
      g.fillStyle = p.look.glow;
      g.globalAlpha = i === 0 && !env.calm ? 0.55 + 0.45 * Math.abs(Math.sin(t * 2)) : 1;
      g.beginPath();
      g.arc(ox + p.x * s * 1.5, oy + p.y * s, Math.max(1.4, 0.7 * u), 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(160,190,240,0.75)';
    g.font = `500 ${clamp(1.6 * u, 5.5, 8.5)}px ${MONO}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(`${zones.length} PLANETS`, l + 1.4 * u, top + 1.2 * u);
  };
  const backpack = (bx: number) => {
    const by = env.feet(0.03);
    g.fillStyle = C.shadow;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.ellipse(bx, by, 6 * u, 1.1 * u, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    // a rolled mat strapped on top
    g.fillStyle = '#4c6a8a';
    K.rr(bx - 5 * u, by - 14.2 * u, 10 * u, 3 * u, 1.5 * u);
    g.fill();
    g.fillStyle = '#c4553b';
    K.rr(bx - 4.4 * u, by - 11.6 * u, 8.8 * u, 11.6 * u, 2 * u);
    g.fill();
    g.fillStyle = '#a84530';
    K.rr(bx - 3.2 * u, by - 6 * u, 6.4 * u, 5 * u, 1.2 * u);
    g.fill();
    g.fillStyle = '#e8dcc2';
    g.fillRect(bx - 0.4 * u, by - 11.6 * u, 0.8 * u, 5.4 * u);
    g.fillRect(bx - 3.6 * u, by - 12.6 * u, 0.7 * u, 2.2 * u);
    g.fillRect(bx + 2.9 * u, by - 12.6 * u, 0.7 * u, 2.2 * u);
  };

  return {
    noun: 'Stop',
    aria: 'A cabin on a space station, with a hologram of a photo, a desk, records beside a record player, a wall screen and a flight console.',
    intro: { kicker: z.code, title: about.hello, sub: resume.location },
    helmetOff: true,
    ink: { base: C.wall, text: C.text, strong: C.strong, line: C.line, shadow: C.shadow, trim: C.trim, door: C.door, doorLine: C.doorLine, plinth: C.plinth, plinthTop: C.plinthTop },
    stops,
    layout() {
      u = env.u;
      const cap = env.vw * 0.8;
      stops[0].w = Math.min(24 * u, cap * 0.6);
      stops[0].h = stops[0].w / 0.75 + 7 * u;
      stops[1].w = Math.min(50 * u, cap);
      stops[1].h = stops[1].w * 0.5;
      stops[2].w = Math.min(66 * u, cap);
      stops[2].h = (stops[2].w / 66) * 12.5 + 2.2 * u;
      stops[3].w = Math.min(42 * u, cap);
      stops[3].h = stops[3].w * 0.62;
      stops[4].w = Math.min(44 * u, cap);
      stops[4].h = stops[4].w * 0.62;
      const [h, s, l] = C.deck;
      floor = K.tiles(15 * u, (c, r) => `hsl(${h} ${s}% ${l + (hash(c, r) - 0.5) * 5}%)`, K.pick('rgba(0,0,0,0.5)', 'rgba(60,70,100,0.35)'), true);
    },
    wall(x0, x1, t) {
      const { floorY, vh } = env;
      const wg = g.createLinearGradient(0, 0, 0, floorY);
      wg.addColorStop(0, C.wall);
      wg.addColorStop(1, C.wallLow);
      g.fillStyle = wg;
      g.fillRect(x0, -vh, x1 - x0, floorY + vh);
      // a band of windows between the station's ribs
      const top = 3.5 * u;
      const h = 10 * u;
      env.sky(x0, x1, top, h, t);
      g.fillStyle = C.trim;
      g.fillRect(x0, top - 1.2 * u, x1 - x0, 1.2 * u);
      g.fillRect(x0, top + h, x1 - x0, 1.2 * u);
      for (let m = Math.floor(x0 / bay()) * bay(); m < x1; m += bay()) {
        g.fillStyle = C.trim;
        g.fillRect(m - 1.3 * u, top, 2.6 * u, h);
        // wall panels, riveted at the corners
        g.fillStyle = C.seam;
        g.fillRect(m, top + h + 3.6 * u, 1, floorY - top - h - 3.6 * u);
        for (const ry of [top + h + 5 * u, floorY - 4.5 * u])
          for (const rx of [m - 1.6 * u, m + 1.6 * u]) {
            g.beginPath();
            g.arc(rx, ry, Math.max(0.8, 0.28 * u), 0, Math.PI * 2);
            g.fill();
          }
      }
      // a strip of light under the windows and another along the floor
      g.fillStyle = C.glowLine;
      g.fillRect(x0, top + h + 2.4 * u, x1 - x0, 0.4 * u);
      g.fillStyle = C.seam;
      g.fillRect(x0, 57.5 * u, x1 - x0, 1);
      g.fillStyle = C.trim;
      g.fillRect(x0, floorY - 1.8 * u, x1 - x0, 1.8 * u);
      g.fillStyle = C.glowLine;
      g.globalAlpha = 0.5;
      g.fillRect(x0, floorY - 1.8 * u, x1 - x0, 0.3 * u);
      g.globalAlpha = 1;
    },
    floor(x0, x1) {
      K.lay(floor, '#2a2f3a', x0, x1, K.pick(0.45, 0.14));
    },
    stop(i, cx, glow, e, t) {
      if (i === 0) hologram(cx, glow, t);
      else if (i === 1) desk(cx, glow, t);
      else if (i === 2) records(cx, glow, t);
      else if (i === 3) orbits(cx, t);
      else chart(cx, t);
      const s = stops[i];
      if (i) K.caption(cx, env.cy + s.h / 2 + (i < 3 ? 3 : 2.2) * u, s.title, glow, C.acc, C.text, e);
    },
    props(x0, x1, front) {
      const bx = env.at(0) - stops[0].w / 2 - 9 * u;
      if (!front && bx > x0 - 10 * u && bx < x1 + 10 * u) backpack(bx);
    },
  };
};

// ================================================================== Education: a lecture hall
export const lectureScene: SceneFactory = (env) => {
  const { g, DISPLAY, MONO } = env;
  const K = kit(env);
  const z = zone('campus');
  const e0 = resume.education;
  const C = {
    wall: K.pick('#1c2321', '#efeadd'), wallLow: K.pick('#161c1a', '#e6dfd0'), trim: K.pick('#2c3532', '#faf6ec'),
    line: K.pick('rgba(226,232,214,0.2)', 'rgba(70,60,40,0.22)'), text: K.pick('#98a39b', '#7a7466'), strong: K.pick('#eaeee6', '#2a2a26'),
    shadow: K.pick('rgba(0,0,0,0.6)', 'rgba(80,60,40,0.3)'), wood: K.pick('#3d2c20', '#c7a57a'), woodHi: K.pick('#51392a', '#d9b98f'),
    woodLo: K.pick('#2b1e15', '#a98a61'), acc: K.pick('#7fb6ff', '#2a5fb0'), door: K.pick('#242b29', '#ddd6c6'),
    doorLine: K.pick('rgba(226,232,214,0.26)', 'rgba(70,60,40,0.3)'), plinth: K.pick('#d5d2c8', '#ffffff'), plinthTop: K.pick('#e8e5dc', '#f5f1e8'),
    slate: K.pick('#22342c', '#2c4338'), chalk: 'rgba(244,246,238,0.94)', tileA: K.pick('#2b2723', '#e9dfcc'), tileB: K.pick('#353029', '#d6c9b1'),
    cork: K.pick('#8a6a45', '#c69a68'),
  };
  const stops: Stop[] = [
    { title: e0.school, meta: e0.dates, body: esc(`${e0.program}.`), accent: C.acc, w: 0, h: 0 },
    { title: 'Graduation', meta: e0.grad, body: esc(e0.details[0]), accent: C.acc, w: 0, h: 0 },
    { title: 'Co-op', body: esc('Co-op program, with work terms between study terms.'), accent: C.acc, w: 0, h: 0 },
  ];
  let u = 1;
  let floor: CanvasPattern | null = null;
  const dado = () => 52 * u;

  const chalkboard = (cx: number) => {
    const s = stops[0];
    const l = cx - s.w / 2;
    const t = s.cy! - s.h / 2;
    K.slab(l, t, s.w, s.h, '#000', C.shadow, 18);
    const [il, it, iw, ih] = env.moulding(l, t, s.w, s.h, 1.2 * u, C.woodHi, C.wood, C.woodLo);
    g.fillStyle = C.slate;
    g.fillRect(il, it, iw, ih);
    // where the board was wiped
    for (let i = 0; i < 5; i++) {
      const gx = il + hash(i, 31) * iw;
      const gy = it + hash(i, 32) * ih;
      const gr = g.createRadialGradient(gx, gy, 0, gx, gy, iw * 0.22);
      gr.addColorStop(0, 'rgba(255,255,255,0.05)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(il, it, iw, ih);
    }
    g.fillStyle = C.chalk;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    const x = il + iw * 0.07;
    const big = K.fit(e0.school, iw * 0.86, 400, clamp(6 * u, 14, 30), DISPLAY);
    g.fillText(e0.school, x, it + ih * 0.42);
    g.fillRect(x, it + ih * 0.42 + big * 0.28, g.measureText(e0.school).width, Math.max(1, 0.25 * u));
    K.fit(e0.program, iw * 0.86, 300, clamp(3.6 * u, 9, 18), DISPLAY);
    g.fillText(e0.program, x, it + ih * 0.66);
    g.font = `400 ${clamp(2.4 * u, 7, 12)}px ${MONO}`;
    g.fillText(e0.dates, x, it + ih * 0.86);
    // the tray: chalk and a felt eraser
    g.fillStyle = C.woodHi;
    g.fillRect(l + s.w * 0.1, t + s.h, s.w * 0.8, 1.1 * u);
    g.fillStyle = '#f2f0e8';
    g.fillRect(l + s.w * 0.2, t + s.h - 0.6 * u, 3.4 * u, 0.6 * u);
    g.fillRect(l + s.w * 0.27, t + s.h - 0.6 * u, 2.2 * u, 0.6 * u);
    g.fillStyle = '#5a5148';
    g.fillRect(l + s.w * 0.66, t + s.h - 1.5 * u, 6 * u, 1.5 * u);
    g.fillStyle = '#c9b89a';
    g.fillRect(l + s.w * 0.66, t + s.h - 1.5 * u, 6 * u, 0.6 * u);
  };
  const calendar = (cx: number) => {
    const s = stops[1];
    const l = cx - s.w / 2;
    const t = s.cy! - s.h / 2;
    const [month, year] = e0.grad.split(' ');
    K.slab(l, t, s.w, s.h, '#fbfaf6', C.shadow, 12);
    g.fillStyle = '#b8402f';
    g.fillRect(l, t, s.w, s.h * 0.2);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${s.h * 0.1}px ${MONO}`;
    g.fillText(year, cx, t + s.h * 0.105);
    g.fillStyle = '#23222a';
    K.fit(month.toUpperCase(), s.w * 0.84, 600, s.h * 0.17, DISPLAY);
    g.fillText(month.toUpperCase(), cx, t + s.h * 0.36);
    // the days, as a grid of small squares
    const cols = 7;
    const cell = (s.w * 0.84) / cols;
    for (let i = 0; i < 30; i++) {
      g.fillStyle = i % 7 > 4 ? 'rgba(184,64,47,0.35)' : 'rgba(35,34,42,0.22)';
      g.fillRect(l + s.w * 0.08 + (i % cols) * cell + cell * 0.2, t + s.h * 0.5 + Math.floor(i / cols) * cell + cell * 0.2, cell * 0.6, cell * 0.6);
    }
    // hung from a nail
    g.fillStyle = C.text;
    g.beginPath();
    g.arc(cx, t - 0.9 * u, 0.5 * u, 0, Math.PI * 2);
    g.fill();
  };
  const notices = (cx: number) => {
    const s = stops[2];
    const l = cx - s.w / 2;
    const t = s.cy! - s.h / 2;
    K.slab(l, t, s.w, s.h, '#000', C.shadow, 14);
    const [il, it, iw, ih] = env.moulding(l, t, s.w, s.h, u, C.woodHi, C.wood, C.woodLo);
    g.fillStyle = C.cork;
    g.fillRect(il, it, iw, ih);
    g.fillStyle = 'rgba(60,35,10,0.18)';
    for (let i = 0; i < 70; i++) g.fillRect(il + hash(i, 41) * iw, it + hash(i, 42) * ih, 1.2, 1.2);
    const sheet = (sx: number, sy: number, sw: number, sh: number, fill: string, rot: number, pin: string) => {
      g.save();
      g.translate(il + sx * iw + (sw * iw) / 2, it + sy * ih + (sh * ih) / 2);
      g.rotate(rot);
      g.shadowColor = 'rgba(0,0,0,0.3)';
      g.shadowBlur = 4;
      g.fillStyle = fill;
      g.fillRect((-sw * iw) / 2, (-sh * ih) / 2, sw * iw, sh * ih);
      g.shadowColor = 'transparent';
      g.fillStyle = pin;
      g.beginPath();
      g.arc(0, (-sh * ih) / 2 + 0.9 * u, 0.55 * u, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    sheet(0.05, 0.12, 0.2, 0.34, '#f3d98c', -0.06, '#b8402f');
    sheet(0.73, 0.1, 0.22, 0.3, '#bfe0d2', 0.05, '#2a5fb0');
    sheet(0.06, 0.56, 0.22, 0.32, '#f1c3b5', 0.04, '#2a5fb0');
    sheet(0.74, 0.5, 0.2, 0.38, '#f6f3ea', -0.04, '#b8402f');
    // the sheet that matters
    sheet(0.31, 0.1, 0.38, 0.8, '#fbfaf6', 0, '#b8402f');
    const px = il + iw * 0.5;
    g.fillStyle = '#23222a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${ih * 0.13}px ${DISPLAY}`;
    g.fillText('CO-OP', px, it + ih * 0.33);
    g.fillStyle = 'rgba(35,34,42,0.3)';
    for (let i = 0; i < 5; i++) g.fillRect(il + iw * 0.36, it + ih * (0.47 + i * 0.075), iw * (i === 4 ? 0.16 : 0.28), Math.max(1, 0.3 * u));
  };
  const deskY = () => env.feet(0.74);
  const desk = (bx: number) => {
    const by = deskY();
    const w = 22 * u;
    g.fillStyle = C.shadow;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.ellipse(bx, by + 0.4 * u, w * 0.56, 1.4 * u, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    // a chair tucked in behind it
    g.fillStyle = C.woodLo;
    g.fillRect(bx - 4 * u, by - 15 * u, 8 * u, 5.5 * u);
    g.fillStyle = K.pick('#17130f', '#4a4038');
    g.fillRect(bx - 3.4 * u, by - 9.5 * u, 0.8 * u, 9.5 * u);
    g.fillRect(bx + 2.6 * u, by - 9.5 * u, 0.8 * u, 9.5 * u);
    g.fillRect(bx - w / 2 + 1.5 * u, by - 9 * u, 0.9 * u, 9 * u);
    g.fillRect(bx + w / 2 - 2.4 * u, by - 9 * u, 0.9 * u, 9 * u);
    g.fillStyle = C.woodHi;
    g.fillRect(bx - w / 2, by - 10.4 * u, w, 3.2 * u);
    g.fillStyle = C.wood;
    g.fillRect(bx - w / 2, by - 7.2 * u, w, 1.3 * u);
  };
  const desks = () => [env.at(0) - 26 * u, env.at(0) + 12 * u, (env.at(1) + env.at(2)) / 2];

  return {
    noun: 'Stop',
    aria: 'A lecture hall with a chalkboard, a wall calendar and a notice board.',
    intro: { kicker: z.code, title: z.title, sub: e0.dates },
    helmetOff: true,
    ink: { base: C.wall, text: C.text, strong: C.strong, line: C.line, shadow: C.shadow, trim: C.trim, door: C.door, doorLine: C.doorLine, plinth: C.plinth, plinthTop: C.plinthTop },
    stops,
    layout() {
      u = env.u;
      const cap = env.vw * 0.84;
      const eye = 33 * u;
      stops[0].w = Math.min(74 * u, cap);
      stops[0].h = Math.min(31 * u, stops[0].w * 0.5);
      stops[1].w = 19 * u;
      stops[1].h = 27 * u;
      stops[2].w = Math.min(38 * u, cap);
      stops[2].h = 26 * u;
      for (const s of stops) s.cy = eye;
      floor = K.tiles(13 * u, (c, r) => ((c + r) % 2 ? C.tileA : C.tileB), K.pick('rgba(0,0,0,0.35)', 'rgba(90,70,40,0.25)'));
    },
    wall(x0, x1, t) {
      const { floorY, vh } = env;
      const wg = g.createLinearGradient(0, 0, 0, floorY);
      wg.addColorStop(0, C.wall);
      wg.addColorStop(1, C.wallLow);
      g.fillStyle = wg;
      g.fillRect(x0, -vh, x1 - x0, floorY + vh);
      // high windows in timber frames
      const top = 3.5 * u;
      const h = 9 * u;
      env.sky(x0, x1, top, h, t);
      g.fillStyle = C.wood;
      g.fillRect(x0, top - u, x1 - x0, u);
      g.fillRect(x0, top + h, x1 - x0, 1.3 * u);
      const every = 38 * u;
      for (let m = Math.floor(x0 / every) * every; m < x1; m += every) {
        g.fillRect(m - u, top, 2 * u, h);
        g.fillRect(m + every / 2 - 0.3 * u, top, 0.6 * u, h);
      }
      // timber panelling below the dado rail
      g.fillStyle = C.wood;
      g.fillRect(x0, dado(), x1 - x0, floorY - dado());
      g.fillStyle = C.woodHi;
      g.fillRect(x0, dado(), x1 - x0, 1.1 * u);
      const pw = 13 * u;
      for (let m = Math.floor(x0 / pw) * pw; m < x1; m += pw) {
        g.fillStyle = C.woodLo;
        g.fillRect(m, dado() + 1.1 * u, Math.max(1, 0.25 * u), floorY - dado());
        g.strokeStyle = C.woodLo;
        g.lineWidth = 1;
        g.strokeRect(m + 1.8 * u + 0.5, dado() + 3 * u + 0.5, pw - 3.6 * u, floorY - dado() - 6 * u);
      }
      g.fillStyle = C.woodLo;
      g.fillRect(x0, floorY - 1.6 * u, x1 - x0, 1.6 * u);
    },
    floor(x0, x1) {
      K.lay(floor, C.tileA, x0, x1, K.pick(0.45, 0.14));
    },
    stop(i, cx) {
      if (i === 0) chalkboard(cx);
      else if (i === 1) calendar(cx);
      else notices(cx);
    },
    props(x0, x1, front, fy) {
      if (front !== fy < deskY()) return;
      desks()
        .filter((bx) => bx + 16 * u > x0 && bx - 16 * u < x1)
        .forEach(desk);
    },
  };
};

// ================================================================== Experience: a street with three storefronts
export const streetScene: SceneFactory = (env) => {
  const { g, DISPLAY } = env;
  const K = kit(env);
  const z = zone('tower');
  const C = {
    base: K.pick('#04050b', '#d7dff0'), hill: K.pick('#0f211c', '#b9d6c8'), hill2: K.pick('#0a1714', '#a6c8b8'),
    trim: K.pick('#2a302f', '#f3f1ea'), line: K.pick('rgba(226,240,232,0.22)', 'rgba(40,60,50,0.25)'), text: K.pick('#9db0a6', '#5d6f66'),
    strong: K.pick('#eef3ef', '#22302a'), shadow: K.pick('rgba(0,0,0,0.6)', 'rgba(40,60,50,0.3)'), acc: K.pick('#8fe0bb', '#1f7a56'),
    door: K.pick('#1e2423', '#d9d6cc'), doorLine: K.pick('rgba(226,240,232,0.26)', 'rgba(40,60,50,0.3)'), board: K.pick('#10171a', '#22302a'),
    paveA: K.pick('#2b2e31', '#cfcdc6'), paveB: K.pick('#323538', '#dad8d1'), curb: K.pick('#4a4e52', '#f0eee8'),
    glass: K.pick('#f6d9a0', '#fbe9c4'), glassDim: K.pick('#3a3526', '#e9dcc0'), post: K.pick('#1a1d1f', '#4a4e52'),
    fronts: [
      { wall: K.pick('#1f4648', '#8cc3be'), dark: K.pick('#163335', '#6fa9a4'), hi: K.pick('#2b5a5c', '#a9d6d1') },
      { wall: K.pick('#5a3428', '#d59a7e'), dark: K.pick('#43261d', '#bb7f63'), hi: K.pick('#6f4233', '#e6b39a') },
      { wall: K.pick('#3d4436', '#b6be9f'), dark: K.pick('#2c3227', '#9ba384'), hi: K.pick('#4d5544', '#cbd2b6') },
    ],
  };
  const roles = resume.experience;
  const stops: Stop[] = roles.map((r) => ({ title: r.title, meta: r.dates, body: `<strong>${esc(r.org)}.</strong> ${esc(r.bullets.join(' '))}`, accent: C.acc, w: 0, h: 0 }));
  let u = 1;
  let floor: CanvasPattern | null = null;

  const lit = (l: number, t: number, w: number, h: number, glow: number) => {
    // a window with the lights on inside
    g.fillStyle = C.glassDim;
    g.fillRect(l, t, w, h);
    g.globalAlpha = 0.55 + 0.45 * glow;
    const gr = g.createLinearGradient(0, t, 0, t + h);
    gr.addColorStop(0, C.glass);
    gr.addColorStop(1, K.pick('#d9a860', '#f3d7a2'));
    g.fillStyle = gr;
    g.fillRect(l, t, w, h);
    g.globalAlpha = 1;
  };
  const sign = (cx: number, t: number, w: number, s: string, f: (typeof C.fronts)[number]) => {
    g.fillStyle = f.dark;
    g.fillRect(cx - w / 2, t, w, 6 * u);
    g.fillStyle = '#f4efe2';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    K.fit(s.toUpperCase(), w - 4 * u, 600, clamp(2.9 * u, 7, 14), DISPLAY);
    g.fillText(s.toUpperCase(), cx, t + 3.1 * u);
  };
  const shell = (i: number, cx: number): [number, number, number, number] => {
    const s = stops[i];
    const f = C.fronts[i];
    const l = cx - s.w / 2;
    const t = s.cy! - s.h / 2;
    K.slab(l, t, s.w, s.h, f.wall, C.shadow, 20);
    g.fillStyle = f.hi;
    g.fillRect(l - 0.8 * u, t - 1.6 * u, s.w + 1.6 * u, 2.2 * u);
    g.fillStyle = f.dark;
    g.fillRect(l, t + s.h - 2 * u, s.w, 2 * u);
    sign(cx, t + 3.4 * u, s.w - 6 * u, roles[i].org, f);
    return [l, t, s.w, s.h];
  };
  const glassDoor = (l: number, b: number, w: number, h: number, f: (typeof C.fronts)[number], glow: number) => {
    g.fillStyle = f.dark;
    g.fillRect(l - 0.8 * u, b - h - 0.8 * u, w + 1.6 * u, h + 0.8 * u);
    lit(l, b - h, w, h, glow);
    g.fillStyle = f.dark;
    g.fillRect(l, b - h * 0.42, w, 0.7 * u);
    g.fillStyle = '#d9c79a';
    g.fillRect(l + w - 1.6 * u, b - h * 0.5, 0.7 * u, 3 * u);
  };
  const robotics = (cx: number, glow: number) => {
    const [l, t, w, h] = shell(0, cx);
    const f = C.fronts[0];
    const b = t + h - 2 * u;
    // the workshop window, with a robot on the bench
    const wl = l + 3 * u;
    const ww = w * 0.62;
    const wt = t + 13 * u;
    const wh = b - wt - 4 * u;
    g.fillStyle = f.dark;
    g.fillRect(wl - 0.8 * u, wt - 0.8 * u, ww + 1.6 * u, wh + 1.6 * u);
    lit(wl, wt, ww, wh, glow);
    g.save();
    g.beginPath();
    g.rect(wl, wt, ww, wh);
    g.clip();
    const ink = '#2a2622';
    g.fillStyle = ink;
    g.fillRect(wl, wt + wh - 2.2 * u, ww, 2.2 * u);
    const rx = wl + ww * 0.42;
    const ry = wt + wh - 2.2 * u;
    // chassis on four wheels, an arm with a claw
    g.fillRect(rx - 6 * u, ry - 4.4 * u, 12 * u, 2.6 * u);
    for (const o of [-4.2, 4.2]) {
      g.beginPath();
      g.arc(rx + o * u, ry - 1.7 * u, 1.7 * u, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = ink;
    g.lineWidth = 1.1 * u;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(rx - 2 * u, ry - 4.4 * u);
    g.lineTo(rx - 4 * u, ry - 10.5 * u);
    g.lineTo(rx + 3.5 * u, ry - 13 * u);
    g.stroke();
    g.lineWidth = 0.7 * u;
    g.beginPath();
    g.moveTo(rx + 3.5 * u, ry - 13 * u);
    g.lineTo(rx + 6.2 * u, ry - 14.4 * u);
    g.moveTo(rx + 3.5 * u, ry - 13 * u);
    g.lineTo(rx + 6.2 * u, ry - 11.4 * u);
    g.stroke();
    g.lineCap = 'butt';
    g.fillStyle = '#c8452f';
    g.fillRect(rx + 2.4 * u, ry - 6.4 * u, 2.6 * u, 2 * u);
    // a gear on the wall behind it
    const gx = wl + ww * 0.82;
    const gy = wt + wh * 0.36;
    g.fillStyle = 'rgba(42,38,34,0.55)';
    for (let i = 0; i < 8; i++) {
      g.save();
      g.translate(gx, gy);
      g.rotate((i / 8) * Math.PI * 2);
      g.fillRect(-0.8 * u, -4.4 * u, 1.6 * u, 8.8 * u);
      g.restore();
    }
    g.beginPath();
    g.arc(gx, gy, 3.2 * u, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C.glass;
    g.beginPath();
    g.arc(gx, gy, 1.2 * u, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = f.dark;
    g.fillRect(wl + ww / 2 - 0.35 * u, wt, 0.7 * u, wh);
    glassDoor(l + w - 13 * u, b, 9 * u, wh + 3 * u, f, glow);
  };
  const community = (cx: number, glow: number) => {
    const [l, t, w, h] = shell(1, cx);
    const f = C.fronts[1];
    const b = t + h - 2 * u;
    const dh = b - t - 15 * u;
    // double doors under a striped awning
    glassDoor(cx - 9.6 * u, b, 9 * u, dh, f, glow);
    glassDoor(cx + 0.6 * u, b, 9 * u, dh, f, glow);
    const at = t + 10.6 * u;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#f1e6cf' : '#b8402f';
      env.poly([cx - 14 * u + i * 3.5 * u, at, cx - 10.5 * u + i * 3.5 * u, at, cx - 10.9 * u + i * 3.75 * u, at + 4 * u, cx - 14.9 * u + i * 3.75 * u, at + 4 * u], g.fillStyle as string);
    }
    // windows either side, a notice board with sheets of every colour
    const ww = w / 2 - 17 * u;
    for (const s of [-1, 1]) {
      const wl = s < 0 ? l + 3 * u : l + w - 3 * u - ww;
      const wt = t + 16 * u;
      const wh = b - wt - 7 * u;
      g.fillStyle = f.dark;
      g.fillRect(wl - 0.8 * u, wt - 0.8 * u, ww + 1.6 * u, wh + 1.6 * u);
      lit(wl, wt, ww, wh, glow);
      if (s < 0) {
        const cols = ['#f3d98c', '#bfe0d2', '#f1c3b5', '#fbfaf6', '#c9d4f2', '#f6f3ea'];
        cols.forEach((c, i) => {
          g.fillStyle = c;
          g.fillRect(wl + ww * (0.1 + (i % 3) * 0.29), wt + wh * (0.14 + Math.floor(i / 3) * 0.42), ww * 0.22, wh * 0.32);
        });
      } else {
        g.fillStyle = f.dark;
        g.fillRect(wl + ww / 2 - 0.35 * u, wt, 0.7 * u, wh);
        g.fillRect(wl, wt + wh / 2 - 0.35 * u, ww, 0.7 * u);
      }
      // a planter under each
      g.fillStyle = '#3f6b4a';
      g.beginPath();
      g.ellipse(wl + ww / 2, b - 4.6 * u, ww * 0.42, 2.4 * u, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = f.dark;
      g.fillRect(wl + ww * 0.06, b - 4.6 * u, ww * 0.88, 3.4 * u);
    }
  };
  const cadets = (cx: number, glow: number) => {
    const [, t, w, h] = shell(2, cx);
    const f = C.fronts[2];
    const b = t + h - 2 * u;
    // a drill hall: one big timber door, small high windows
    const dw = 20 * u;
    const dh = b - t - 17 * u;
    g.fillStyle = f.dark;
    g.fillRect(cx - dw / 2 - u, b - dh - u, dw + 2 * u, dh + u);
    g.fillStyle = K.pick('#4a3424', '#8a6846');
    g.fillRect(cx - dw / 2, b - dh, dw, dh);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let i = 1; i < 6; i++) g.fillRect(cx - dw / 2 + (i * dw) / 6, b - dh, Math.max(1, 0.25 * u), dh);
    g.fillRect(cx - 0.3 * u, b - dh, 0.6 * u, dh);
    g.fillStyle = '#d9c79a';
    g.fillRect(cx - 2.2 * u, b - dh * 0.45, 0.8 * u, 2.6 * u);
    g.fillRect(cx + 1.4 * u, b - dh * 0.45, 0.8 * u, 2.6 * u);
    // three chevrons over the door
    g.strokeStyle = '#e8d9a8';
    g.lineWidth = 0.9 * u;
    g.lineJoin = 'miter';
    for (let i = 0; i < 3; i++) {
      const y = b - dh - 6.4 * u + i * 1.7 * u;
      g.beginPath();
      g.moveTo(cx - 3 * u, y);
      g.lineTo(cx, y + 1.5 * u);
      g.lineTo(cx + 3 * u, y);
      g.stroke();
    }
    for (const s of [-1, 1]) {
      const ww = 9 * u;
      const wl = cx + s * (w / 2 - 9.5 * u) - ww / 2;
      const wt = t + 15 * u;
      g.fillStyle = f.dark;
      g.fillRect(wl - 0.8 * u, wt - 0.8 * u, ww + 1.6 * u, 7.6 * u);
      lit(wl, wt, ww, 6 * u, glow);
      g.fillStyle = f.dark;
      g.fillRect(wl + ww / 2 - 0.35 * u, wt, 0.7 * u, 6 * u);
    }
  };
  const lampY = () => env.floorY + 1.2 * u;
  const lamp = (bx: number) => {
    const by = lampY();
    const top = by - 40 * u;
    const gr = g.createRadialGradient(bx, top + 1.5 * u, 0, bx, top + 1.5 * u, 22 * u);
    gr.addColorStop(0, K.pick('rgba(255,226,170,0.34)', 'rgba(255,240,200,0.5)'));
    gr.addColorStop(1, 'rgba(255,226,170,0)');
    g.fillStyle = gr;
    g.fillRect(bx - 22 * u, top - 20 * u, 44 * u, 44 * u);
    g.fillStyle = C.post;
    g.fillRect(bx - 0.5 * u, top + 2 * u, u, by - top - 2 * u);
    g.fillRect(bx - 1.6 * u, by - 1.4 * u, 3.2 * u, 1.4 * u);
    g.fillRect(bx - 3 * u, top, 6 * u, 0.9 * u);
    g.fillStyle = '#ffe9b8';
    g.beginPath();
    g.ellipse(bx, top + 1.9 * u, 2.2 * u, 1.4 * u, 0, 0, Math.PI * 2);
    g.fill();
  };
  const between = () => stops.slice(0, -1).map((s, i) => (env.at(i) + s.w / 2 + env.at(i + 1) - stops[i + 1].w / 2) / 2);

  return {
    noun: 'Stop',
    aria: 'A street under the stars with three buildings, one for each role.',
    intro: { kicker: z.code, title: z.title, sub: z.section },
    helmetOff: false,
    ink: { base: C.base, text: K.pick('#9db0a6', '#b9cdc2'), strong: '#eef3ef', line: 'rgba(226,240,232,0.3)', shadow: C.shadow, trim: C.trim, door: C.door, doorLine: C.doorLine, plinth: '#fff', plinthTop: '#fff' },
    stops,
    layout() {
      u = env.u;
      const w = Math.min(66 * u, env.vw * 0.86);
      for (const s of stops) {
        s.w = w;
        s.h = 46 * u;
        s.cy = env.floorY - 23 * u;
      }
      floor = K.tiles(17 * u, (c, r) => (hash(c, r) > 0.5 ? C.paveA : C.paveB), K.pick('rgba(0,0,0,0.4)', 'rgba(70,70,60,0.28)'), true);
    },
    wall(x0, x1, t) {
      const { floorY, door, exit, wallText, cy } = env;
      env.sky(x0, x1, 0, floorY, t);
      // far ridges of this planet, sliding by more slowly than the street
      const ridge = (drift: number, base: number, amp: number, fill: string, seed: number) => {
        const off = env.cam * drift;
        g.fillStyle = fill;
        g.beginPath();
        g.moveTo(x0, floorY);
        for (let x = Math.floor(x0 / (8 * u)) * 8 * u; x <= x1 + 8 * u; x += 8 * u) {
          const q = (x - off) / (60 * u);
          g.lineTo(x, floorY - base - (Math.sin(q + seed) + 0.6 * Math.sin(q * 2.3 + seed * 2)) * amp);
        }
        g.lineTo(x1 + 8 * u, floorY);
        g.closePath();
        g.fill();
      };
      ridge(0.55, 9 * u, 3.4 * u, C.hill2, 1);
      ridge(0.3, 4.5 * u, 2.4 * u, C.hill, 4);
      // the shuttle stops at either end of the street
      for (const d of [door, exit]) {
        const l = d.x - 5 * u;
        const w = d.w + 10 * u;
        const top = floorY - d.h - 10 * u;
        g.fillStyle = C.trim;
        g.fillRect(l, top, w, floorY - top);
        g.fillStyle = C.door;
        g.fillRect(l - 1.5 * u, top - 1.6 * u, w + 3 * u, 1.6 * u);
      }
      // a billboard for the name of the street
      g.fillStyle = C.post;
      g.fillRect(wallText.x + 4 * u, cy, 1.2 * u, floorY - cy);
      g.fillRect(wallText.x + wallText.w - 8 * u, cy, 1.2 * u, floorY - cy);
      g.fillStyle = C.board;
      g.fillRect(wallText.x - 4 * u, cy - 13 * u, wallText.w + 4 * u, 25 * u);
    },
    floor(x0, x1) {
      K.lay(floor, C.paveA, x0, x1, K.pick(0.4, 0.12));
      g.fillStyle = C.curb;
      g.fillRect(x0, env.floorY, x1 - x0, 1.2 * u);
    },
    stop(i, cx, glow) {
      if (i === 0) robotics(cx, glow);
      else if (i === 1) community(cx, glow);
      else cadets(cx, glow);
    },
    props(x0, x1, front) {
      if (front) return;
      between()
        .filter((bx) => bx + 24 * u > x0 && bx - 24 * u < x1)
        .forEach(lamp);
    },
  };
};

// ================================================================== Skills: an observatory
export const observatoryScene: SceneFactory = (env) => {
  const { g, DISPLAY, MONO } = env;
  const K = kit(env);
  const z = zone('observatory');
  const C = {
    wall: K.pick('#141a2a', '#e5e9f2'), wallLow: K.pick('#0e1320', '#d9dfeb'), trim: K.pick('#262d42', '#f7f9fc'),
    line: K.pick('rgba(240,217,160,0.24)', 'rgba(60,60,90,0.24)'), text: K.pick('#9aa2b8', '#72778a'), strong: K.pick('#ece8dc', '#252838'),
    shadow: K.pick('rgba(0,0,0,0.6)', 'rgba(50,55,90,0.3)'), acc: K.pick('#f0d9a0', '#8a6a1c'), door: K.pick('#1d2334', '#d3d9e6'),
    doorLine: K.pick('rgba(240,217,160,0.26)', 'rgba(60,60,90,0.3)'), plinth: K.pick('#d3d6df', '#ffffff'), plinthTop: K.pick('#e6e8ef', '#f2f4f8'),
    brass: '#c9a45c', brassHi: '#ecd49a', brassLo: '#8a6c34', chart: '#0f1d3d', chartLine: 'rgba(236,212,154,0.5)', star: '#fff6dc',
    tileA: K.pick('#1c2233', '#cfd5e2'), tileB: K.pick('#232a3d', '#dde2ec'), cork: K.pick('#7d6243', '#c69a68'), paper: '#f6f1e4',
  };
  const groups = Object.entries(resume.skills);
  const notes = resume.curiosity;
  const stops: Stop[] = [
    ...groups.map(([name, items]) => ({ title: name, body: esc(items.join(', ')), accent: C.acc, w: 0, h: 0 })),
    ...notes.map(([name, body]) => ({ title: name, body: esc(body), accent: C.acc, w: 0, h: 0 })),
  ];
  const G = groups.length;
  let u = 1;
  let floor: CanvasPattern | null = null;
  const dome = () => ({ top: 3 * u, h: 19 * u });

  const starChart = (i: number, cx: number, glow: number) => {
    const s = stops[i];
    const items = groups[i][1];
    const l = cx - s.w / 2;
    const t = s.cy! - s.h / 2;
    K.slab(l, t, s.w, s.h, '#000', C.shadow, 16);
    const [il, it, iw, ih] = env.moulding(l, t, s.w, s.h, 0.8 * u, C.brassHi, C.brass, C.brassLo);
    g.fillStyle = C.chart;
    g.fillRect(il, it, iw, ih);
    g.save();
    g.beginPath();
    g.rect(il, it, iw, ih);
    g.clip();
    // the faint grid of a star map
    g.strokeStyle = 'rgba(160,185,240,0.13)';
    g.lineWidth = 1 / env.k;
    for (let r = 1; r < 6; r++) {
      g.beginPath();
      g.arc(il + iw / 2, it + ih * 1.5, r * ih * 0.32, 0, Math.PI * 2);
      g.stroke();
    }
    for (let j = 0; j < 30; j++) {
      g.fillStyle = `rgba(200,215,255,${0.15 + hash(j, i + 50) * 0.3})`;
      g.fillRect(il + hash(j, i + 51) * iw, it + hash(j, i + 52) * ih, 1, 1);
    }
    g.restore();
    // one star for each item, joined into a constellation
    const m = items.length;
    const pts = items.map((_, j) => {
      const up = j % 2 === 0;
      return [il + iw * ((j + 0.5) / m) * 0.92 + iw * 0.04, it + ih * (up ? 0.36 : 0.66) + (hash(j, i + 60) - 0.5) * ih * 0.12, up] as const;
    });
    g.strokeStyle = C.chartLine;
    g.lineWidth = Math.max(1 / env.k, 0.18 * u);
    g.beginPath();
    pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.stroke();
    const f = clamp(1.75 * u, 5.5, 9);
    g.textAlign = 'center';
    pts.forEach(([px, py, up], j) => {
      const r = Math.max(1.3, 0.55 * u);
      const halo = g.createRadialGradient(px, py, 0, px, py, r * (3.5 + glow * 1.5));
      halo.addColorStop(0, 'rgba(255,240,200,0.55)');
      halo.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = halo;
      g.fillRect(px - r * 6, py - r * 6, r * 12, r * 12);
      g.fillStyle = C.star;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
      g.font = `500 ${f}px ${MONO}`;
      g.textBaseline = up ? 'bottom' : 'top';
      g.fillStyle = 'rgba(236,226,196,0.92)';
      g.fillText(items[j], clamp(px, il + g.measureText(items[j]).width / 2 + 2, il + iw - g.measureText(items[j]).width / 2 - 2), py + (up ? -1 : 1) * (r + 0.9 * u));
    });
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillStyle = 'rgba(236,212,154,0.85)';
    g.font = `500 ${clamp(1.7 * u, 5.5, 8.5)}px ${MONO}`;
    g.fillText(groups[i][0].toUpperCase(), il + 1.4 * u, it + 1.2 * u);
  };
  const card = (i: number, cx: number, glow: number) => {
    // a page from the observing log, pinned to cork
    const s = stops[i];
    const l = cx - s.w / 2;
    const t = s.cy! - s.h / 2;
    g.save();
    g.translate(cx, s.cy!);
    g.rotate((hash(i, 70) - 0.5) * 0.07);
    g.translate(-cx, -s.cy!);
    K.slab(l, t, s.w, s.h, C.paper, 'rgba(0,0,0,0.4)', 8);
    g.fillStyle = 'rgba(40,60,120,0.16)';
    for (let r = 0; r < 7; r++) g.fillRect(l + 1.6 * u, t + s.h * 0.5 + r * 1.9 * u, s.w - 3.2 * u, Math.max(0.6, 0.14 * u));
    g.fillStyle = '#23222a';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    const f = clamp(2.3 * u, 7, 11.5);
    g.font = `600 ${f}px ${DISPLAY}`;
    env.wrap(notes[i - G][0], s.w - 3.2 * u).forEach((line, r) => g.fillText(line, l + 1.6 * u, t + 4.4 * u + r * f * 1.2));
    g.fillStyle = 'rgba(35,34,42,0.5)';
    g.font = `500 ${clamp(1.5 * u, 5, 7.5)}px ${MONO}`;
    g.fillText(`LOG ${String(i - G + 1).padStart(2, '0')}`, l + 1.6 * u, t + 1.8 * u);
    g.fillStyle = glow > 0.5 ? '#c8452f' : '#9a3a2a';
    g.beginPath();
    g.arc(cx, t + 1.4 * u, 0.7 * u, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  const scopeX = () => (env.at(G - 1) + stops[G - 1].w / 2 + env.at(G) - stops[G].w / 2) / 2;
  const scopeY = () => env.feet(0.34);
  const telescope = (bx: number) => {
    const by = scopeY();
    g.fillStyle = C.shadow;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.ellipse(bx, by + 0.4 * u, 11 * u, 1.6 * u, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    const hub: [number, number] = [bx, by - 19 * u];
    g.strokeStyle = K.pick('#1b1712', '#4a4038');
    g.lineWidth = 1.1 * u;
    g.lineCap = 'round';
    for (const o of [-9, 0, 9]) {
      g.beginPath();
      g.moveTo(hub[0], hub[1]);
      g.lineTo(bx + o * u, by);
      g.stroke();
    }
    g.lineCap = 'butt';
    // the tube, aimed up at the opening
    g.save();
    g.translate(hub[0], hub[1] - 1.5 * u);
    g.rotate(-0.72);
    const gr = g.createLinearGradient(0, -3.2 * u, 0, 3.2 * u);
    gr.addColorStop(0, C.brassHi);
    gr.addColorStop(0.5, C.brass);
    gr.addColorStop(1, C.brassLo);
    g.fillStyle = gr;
    g.fillRect(-13 * u, -2.6 * u, 34 * u, 5.2 * u);
    g.fillRect(21 * u, -3.4 * u, 4 * u, 6.8 * u);
    g.fillStyle = C.brassLo;
    g.fillRect(-2 * u, -2.6 * u, 1.2 * u, 5.2 * u);
    g.fillRect(10 * u, -2.6 * u, 1.2 * u, 5.2 * u);
    g.fillStyle = '#2a2622';
    g.fillRect(-17 * u, -1.4 * u, 4 * u, 2.8 * u);
    g.restore();
    g.fillStyle = C.brassLo;
    g.beginPath();
    g.arc(hub[0], hub[1], 2 * u, 0, Math.PI * 2);
    g.fill();
  };

  return {
    noun: 'Stop',
    aria: `An observatory with ${G} star charts, a telescope and ${notes.length} pages from an observing log.`,
    intro: { kicker: z.code, title: z.title, sub: z.section },
    helmetOff: true,
    ink: { base: C.wall, text: C.text, strong: C.strong, line: C.line, shadow: C.shadow, trim: C.trim, door: C.door, doorLine: C.doorLine, plinth: C.plinth, plinthTop: C.plinthTop },
    stops,
    layout() {
      u = env.u;
      const cap = env.vw * 0.9;
      const eye = 44.5 * u;
      groups.forEach(([, items], i) => {
        stops[i].w = Math.min(Math.max(34 * u, items.length * 8.2 * u + 6 * u), cap);
        stops[i].h = 29 * u;
        stops[i].cy = eye;
      });
      stops[G - 1].gap = 44 * u;
      notes.forEach((_, j) => {
        const s = stops[G + j];
        s.w = 21 * u;
        s.h = 26 * u;
        s.cy = eye;
        s.gap = 4 * u;
      });
      floor = K.tiles(14 * u, (c, r) => ((c + r) % 2 ? C.tileA : C.tileB), K.pick('rgba(0,0,0,0.4)', 'rgba(60,60,90,0.22)'));
    },
    wall(x0, x1, t) {
      const { floorY, vh } = env;
      const wg = g.createLinearGradient(0, 0, 0, floorY);
      wg.addColorStop(0, C.wall);
      wg.addColorStop(1, C.wallLow);
      g.fillStyle = wg;
      g.fillRect(x0, -vh, x1 - x0, floorY + vh);
      // the dome stands open: a tall band of sky between brass ribs
      const { top, h } = dome();
      env.sky(x0, x1, top, h, t);
      const every = 30 * u;
      for (let m = Math.floor(x0 / every) * every; m < x1; m += every) {
        g.fillStyle = C.trim;
        g.fillRect(m - 0.6 * u, top, 1.2 * u, h);
      }
      g.fillStyle = C.brass;
      g.fillRect(x0, top + h, x1 - x0, 0.7 * u);
      g.fillStyle = C.trim;
      g.fillRect(x0, top - u, x1 - x0, u);
      g.fillRect(x0, top + h + 0.7 * u, x1 - x0, 1.4 * u);
      // the cork the log pages are pinned to
      const a = env.at(G) - stops[G].w / 2 - 3 * u;
      const b = env.at(stops.length - 1) + stops[stops.length - 1].w / 2 + 3 * u;
      if (b > x0 && a < x1) {
        const s = stops[G];
        const ct = s.cy! - s.h / 2 - 3 * u;
        K.slab(a, ct, b - a, s.h + 6 * u, '#000', C.shadow, 14);
        const [il, it, iw, ih] = env.moulding(a, ct, b - a, s.h + 6 * u, 0.9 * u, C.brassHi, C.brass, C.brassLo);
        g.fillStyle = C.cork;
        g.fillRect(il, it, iw, ih);
      }
      g.fillStyle = C.trim;
      g.fillRect(x0, floorY - 2 * u, x1 - x0, 2 * u);
      g.fillStyle = C.brass;
      g.fillRect(x0, floorY - 2 * u, x1 - x0, 0.3 * u);
    },
    floor(x0, x1) {
      K.lay(floor, C.tileA, x0, x1, K.pick(0.45, 0.14));
    },
    stop(i, cx, glow) {
      if (i < G) {
        starChart(i, cx, glow);
      } else card(i, cx, glow);
    },
    props(x0, x1, front, fy) {
      const bx = scopeX();
      if (front !== fy < scopeY() || bx + 30 * u < x0 || bx - 30 * u > x1) return;
      telescope(bx);
    },
  };
};

// ================================================================== Contact: a post office
export const postScene: SceneFactory = (env) => {
  const { g, MONO } = env;
  const K = kit(env);
  const z = zone('signal');
  const C = {
    wall: K.pick('#241d1a', '#f2eadc'), wallLow: K.pick('#1b1513', '#e9dfce'), trim: K.pick('#352b26', '#fbf7ee'),
    line: K.pick('rgba(240,226,200,0.2)', 'rgba(80,60,40,0.22)'), text: K.pick('#a89c8e', '#7b7164'), strong: K.pick('#f0e9dc', '#2a2622'),
    shadow: K.pick('rgba(0,0,0,0.6)', 'rgba(80,60,40,0.3)'), acc: K.pick('#e8b86b', '#8a5f14'), door: K.pick('#2a221e', '#ddd3c2'),
    doorLine: K.pick('rgba(240,226,200,0.26)', 'rgba(80,60,40,0.3)'), plinth: K.pick('#d8d2c6', '#ffffff'), plinthTop: K.pick('#eae5da', '#f6f1e7'),
    dado: K.pick('#2f2420', '#d9ccb6'), wood: K.pick('#4a3526', '#b08a5e'), woodHi: K.pick('#5f4532', '#c7a377'), woodLo: K.pick('#33241a', '#8f6f48'),
    box: '#b5432f', boxHi: '#cf5a44', boxLo: '#8a3022', brass: '#d9bf7f', tileA: K.pick('#171311', '#2e2925'), tileB: K.pick('#40393a', '#f1eadd'),
  };
  const repos = resume.projects.flatMap((p) => (p.links ?? []).filter((l) => /github\.com\/[^/]+\/[^/]+/.test(l.url)).map((l) => l.url.split('/').pop()!));
  const hub = resume.links[0];
  const handle = hub.url.replace(/^https?:\/\//, '');
  const stops: Stop[] = [
    {
      title: 'Email',
      body: 'The fastest way to reach me is email.',
      links: [{ label: resume.email, url: `mailto:${resume.email}` }],
      accent: C.acc, w: 0, h: 0,
    },
    { title: hub.label, body: esc(`Public code for ${repos.length} projects: ${repos.join(', ')}.`), links: [{ label: handle, url: hub.url }], accent: C.acc, w: 0, h: 0 },
  ];
  let u = 1;
  let floor: CanvasPattern | null = null;

  const postbox = (cx: number, glow: number) => {
    const s = stops[0];
    const l = cx - s.w / 2;
    const t = env.cy - s.h / 2;
    g.save();
    g.shadowColor = C.shadow;
    g.shadowBlur = 16;
    g.shadowOffsetY = 8 * env.dpr;
    g.fillStyle = C.box;
    K.rr(l, t, s.w, s.h, [s.w / 2, s.w / 2, 1.2 * u, 1.2 * u] as unknown as number);
    g.fill();
    g.restore();
    const gr = g.createLinearGradient(l, 0, l + s.w, 0);
    gr.addColorStop(0, C.boxLo);
    gr.addColorStop(0.25, C.boxHi);
    gr.addColorStop(1, C.boxLo);
    g.fillStyle = gr;
    K.rr(l, t, s.w, s.h, [s.w / 2, s.w / 2, 1.2 * u, 1.2 * u] as unknown as number);
    g.fill();
    // the slot under its brass hood
    const sy = t + s.h * 0.36;
    g.fillStyle = C.brass;
    g.fillRect(l + s.w * 0.14, sy - 1.6 * u, s.w * 0.72, 5 * u);
    g.fillStyle = '#16100e';
    g.fillRect(l + s.w * 0.2, sy, s.w * 0.6, 1.5 * u);
    // a letter on its way in
    g.fillStyle = '#f6f1e4';
    g.fillRect(l + s.w * 0.3, sy - (1.2 + glow * 1.4) * u, s.w * 0.4, (1.2 + glow * 1.4) * u);
    g.fillStyle = C.brass;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${clamp(2.4 * u, 7, 12)}px ${MONO}`;
    g.fillText('EMAIL', cx, t + s.h * 0.2);
    // the collection plate and the door it opens
    g.fillStyle = '#f4efe2';
    g.fillRect(l + s.w * 0.22, t + s.h * 0.54, s.w * 0.56, s.h * 0.16);
    g.fillStyle = 'rgba(35,34,42,0.55)';
    for (let i = 0; i < 3; i++) g.fillRect(l + s.w * 0.28, t + s.h * (0.575 + i * 0.04), s.w * (i === 2 ? 0.26 : 0.44), Math.max(1, 0.3 * u));
    g.strokeStyle = C.boxLo;
    g.lineWidth = Math.max(1, 0.3 * u);
    g.strokeRect(l + s.w * 0.12, t + s.h * 0.5, s.w * 0.76, s.h * 0.44);
    g.fillStyle = C.brass;
    g.beginPath();
    g.arc(l + s.w * 0.8, t + s.h * 0.82, 0.8 * u, 0, Math.PI * 2);
    g.fill();
  };
  const terminal = (cx: number, t: number) => {
    const s = stops[1];
    const l = cx - s.w / 2;
    const top = env.cy - s.h / 2;
    g.save();
    g.shadowColor = C.shadow;
    g.shadowBlur = 16;
    g.shadowOffsetY = 8 * env.dpr;
    g.fillStyle = K.pick('#cfc6b4', '#e4dccb');
    K.rr(l, top, s.w, s.h, 1.6 * u);
    g.fill();
    g.restore();
    const b = 2 * u;
    g.fillStyle = '#07110c';
    K.rr(l + b, top + b, s.w - b * 2, s.h - b * 2 - 2 * u, u);
    g.fill();
    g.fillStyle = '#8a8274';
    g.fillRect(l + s.w - 8 * u, top + s.h - 2.6 * u, 5 * u, 0.8 * u);
    g.fillStyle = '#7ff0a8';
    g.beginPath();
    g.arc(l + 3.4 * u, top + s.h - 2.2 * u, 0.5 * u, 0, Math.PI * 2);
    g.fill();
    // what is on the screen
    g.save();
    K.rr(l + b, top + b, s.w - b * 2, s.h - b * 2 - 2 * u, u);
    g.clip();
    g.textAlign = 'left';
    g.textBaseline = 'top';
    const f = clamp(1.9 * u, 5.5, 9.5);
    const x = l + b + 1.8 * u;
    let y = top + b + 1.8 * u;
    g.font = `500 ${f}px ${MONO}`;
    g.fillStyle = 'rgba(127,240,168,0.6)';
    g.fillText('$ ls', x, y);
    y += f * 1.6;
    g.fillStyle = '#9ff5bf';
    K.fit(handle, s.w - b * 2 - 3.6 * u, 500, f * 1.35, MONO);
    g.fillText(handle, x, y);
    y += f * 2.3;
    g.font = `500 ${f}px ${MONO}`;
    g.fillStyle = 'rgba(159,245,191,0.82)';
    for (const r of repos) {
      g.fillText(`${r}/`, x, y);
      y += f * 1.5;
    }
    if (env.calm || t % 1.1 < 0.6) g.fillRect(x, y + f * 0.1, f * 0.6, f);
    g.restore();
  };
  const rackX = () => (env.at(0) + stops[0].w / 2 + env.at(1) - stops[1].w / 2) / 2;
  const rack = (cx: number) => {
    // pigeonholes, some with post waiting
    const w = 36 * u;
    const h = 28 * u;
    const l = cx - w / 2;
    const t = env.cy - h / 2;
    K.slab(l, t, w, h, '#000', C.shadow, 14);
    const [il, it, iw, ih] = env.moulding(l, t, w, h, u, C.woodHi, C.wood, C.woodLo);
    g.fillStyle = C.woodLo;
    g.fillRect(il, it, iw, ih);
    const cols = 6;
    const rows = 4;
    const cw = iw / cols;
    const ch = ih / rows;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = il + c * cw + 0.4 * u;
        const y = it + r * ch + 0.4 * u;
        g.fillStyle = K.pick('#17100c', '#5e4a36');
        g.fillRect(x, y, cw - 0.8 * u, ch - 0.8 * u);
        const k = hash(c, r + 90);
        if (k > 0.4) {
          g.fillStyle = k > 0.8 ? '#e9d7a8' : '#f4efe2';
          const n = k > 0.7 ? 2 : 1;
          for (let j = 0; j < n; j++) {
            g.save();
            g.translate(x + cw * (0.3 + j * 0.22), y + ch - 0.8 * u);
            g.rotate(-0.2 + j * 0.25);
            g.fillRect(-0.5 * u, -(ch - 2 * u), u, ch - 2 * u);
            g.restore();
          }
        }
      }
  };

  return {
    noun: 'Stop',
    aria: 'A post office with a post box for email and a terminal for GitHub.',
    intro: { kicker: z.code, title: z.title, sub: z.section },
    helmetOff: true,
    ink: { base: C.wall, text: C.text, strong: C.strong, line: C.line, shadow: C.shadow, trim: C.trim, door: C.door, doorLine: C.doorLine, plinth: C.plinth, plinthTop: C.plinthTop },
    stops,
    layout() {
      u = env.u;
      stops[0].w = 22 * u;
      stops[0].h = 34 * u;
      stops[0].gap = 52 * u;
      stops[1].w = Math.min(44 * u, env.vw * 0.84);
      stops[1].h = stops[1].w * 0.66;
      floor = K.tiles(7 * u, (c, r) => ((c + r) % 2 ? C.tileA : C.tileB), 'rgba(0,0,0,0.25)');
    },
    wall(x0, x1, t) {
      const { floorY, vh } = env;
      const wg = g.createLinearGradient(0, 0, 0, floorY);
      wg.addColorStop(0, C.wall);
      wg.addColorStop(1, C.wallLow);
      g.fillStyle = wg;
      g.fillRect(x0, -vh, x1 - x0, floorY + vh);
      const top = 4 * u;
      const h = 8.5 * u;
      env.sky(x0, x1, top, h, t);
      g.fillStyle = C.wood;
      g.fillRect(x0, top - u, x1 - x0, u);
      g.fillRect(x0, top + h, x1 - x0, 1.3 * u);
      const every = 42 * u;
      for (let m = Math.floor(x0 / every) * every; m < x1; m += every) g.fillRect(m - 0.7 * u, top, 1.4 * u, h);
      // a painted dado with a brass rail
      const d = 56 * u;
      g.fillStyle = C.dado;
      g.fillRect(x0, d, x1 - x0, floorY - d);
      g.fillStyle = C.brass;
      g.globalAlpha = 0.7;
      g.fillRect(x0, d, x1 - x0, 0.45 * u);
      g.globalAlpha = 1;
      g.fillStyle = C.woodLo;
      g.fillRect(x0, floorY - 1.8 * u, x1 - x0, 1.8 * u);
      const rx = rackX();
      if (rx + 24 * u > x0 && rx - 24 * u < x1) rack(rx);
    },
    floor(x0, x1) {
      K.lay(floor, C.tileA, x0, x1, K.pick(0.4, 0.12));
    },
    stop(i, cx, glow, _e, t) {
      if (i === 0) postbox(cx, glow);
      else terminal(cx, t);
    },
  };
};
