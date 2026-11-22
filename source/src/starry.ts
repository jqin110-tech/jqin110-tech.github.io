// The picture on the short page: the galaxy from this site, painted the way Van Gogh painted The Starry Night (1889).
// Nothing is copied from that painting. Every brushstroke here is laid by this code along a field of swirling wind:
// the great swirl is the galaxy with its black hole at the centre, the haloed stars are the planets,
// and the astronaut stands on the hill where the cypress would be.
import { ASTRO, drawAstronaut } from './draw';

const PW = 800;
const PH = 1000;
type RGB = readonly [number, number, number];

/** The hole at the centre of the big swirl. */
const HOLE = { x: 452, y: 392, r: 42 };
/** The big swirl turns one way, the small curl beside it turns the other, as in the original sky. */
const SWIRLS = [
  { x: 168, y: 566, r: 118, dir: -1, pull: 0.18 },
  { x: HOLE.x, y: HOLE.y, r: 250, dir: 1, pull: 0.3 },
];
/** One haloed star for each planet of the galaxy, each with a little of that planet's colour in its halo. */
const STARS: { x: number; y: number; r: number; tint: RGB }[] = [
  { x: 104, y: 112, r: 58, tint: [127, 182, 255] },
  { x: 306, y: 92, r: 40, tint: [255, 190, 150] },
  { x: 566, y: 84, r: 46, tint: [143, 224, 187] },
  { x: 708, y: 206, r: 66, tint: [255, 244, 190] },
  { x: 716, y: 598, r: 40, tint: [226, 232, 255] },
  { x: 92, y: 330, r: 34, tint: [159, 196, 255] },
];
/** Night blues, darkest first. */
const SKY: RGB[] = [
  [9, 18, 52],
  [14, 32, 86],
  [22, 52, 124],
  [34, 78, 158],
  [58, 110, 186],
  [102, 152, 210],
  [160, 196, 228],
  [222, 232, 226],
];
const CREAM: RGB = [255, 249, 220];
const LEMON: RGB = [250, 236, 150];
const SAGE: RGB = [196, 222, 190];
const GROUND: RGB[] = [
  [5, 8, 22],
  [8, 14, 36],
  [12, 22, 52],
  [20, 36, 76],
];

const hillY = (x: number) => 836 + 26 * Math.sin(x * 0.0085 + 0.4) + 12 * Math.sin(x * 0.023 + 2.1);
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ramp = (stops: RGB[], t: number): RGB => {
  const u = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1);
  return mix(stops[Math.floor(u)], stops[Math.floor(u) + 1], u - Math.floor(u));
};
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Which way the paint moves at a point: the wind of the sky, bent round every swirl and every star. */
function wind(x: number, y: number): [number, number] {
  const hy = hillY(x);
  if (y > hy - 6) {
    // the ground follows the slope of the hill
    const s = (hillY(x + 4) - hillY(x - 4)) / 8;
    const m = Math.hypot(1, s);
    return [1 / m, s / m];
  }
  let vx = 1;
  let vy = 0.3 * Math.sin(y * 0.013 + x * 0.007) - 0.1;
  const bend = (cx: number, cy: number, r: number, dir: number, pull: number, sharp: number) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const w = Math.exp(-Math.pow(d / r, 2) * sharp);
    vx = vx * (1 - w) + ((-dy / d) * dir - (dx / d) * pull) * w;
    vy = vy * (1 - w) + ((dx / d) * dir - (dy / d) * pull) * w;
  };
  for (const s of SWIRLS) bend(s.x, s.y, s.r, s.dir, s.pull, 1.1);
  for (const s of STARS) bend(s.x, s.y, s.r, 1, 0, 1.6);
  // the disc of the hole lies flat across it
  const ddx = Math.abs(x - HOLE.x);
  const ddy = Math.abs(y - HOLE.y - 3);
  if (ddx < 150 && ddy < 9) {
    const w = (1 - ddx / 150) * (1 - ddy / 9);
    vx = vx * (1 - w) + w;
    vy = vy * (1 - w);
  }
  const m = Math.hypot(vx, vy) || 1;
  return [vx / m, vy / m];
}

/** Smooth noise, so neighbouring strokes share a mood and the sky has light and dark passages. */
function makeNoise(rand: () => number) {
  const N = 32;
  const grid = Array.from({ length: N * N }, () => rand());
  return (x: number, y: number) => {
    const gx = ((x % N) + N) % N;
    const gy = ((y % N) + N) % N;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const at = (i: number, j: number) => grid[((y0 + j) % N) * N + ((x0 + i) % N)];
    return (at(0, 0) * (1 - sx) + at(1, 0) * sx) * (1 - sy) + (at(0, 1) * (1 - sx) + at(1, 1) * sx) * sy;
  };
}

/** The colour of the paint at a point, and how bright it is (dark paint goes on first). */
function paintAt(x: number, y: number, rand: () => number, noise: (x: number, y: number) => number): { c: RGB; b: number } {
  if (y > hillY(x) - 4) {
    const t = 0.15 + 0.5 * noise(x * 0.02, y * 0.05) + rand() * 0.3 - (y - hillY(x)) * 0.002;
    return { c: ramp(GROUND, t), b: t * 0.2 };
  }
  // the hole: a dark centre, a ring of light bent round it, and its disc across the front
  const hd = Math.hypot(x - HOLE.x, y - HOLE.y);
  const onDisc = Math.abs(y - HOLE.y - 3) < 7 && Math.abs(x - HOLE.x) < 140;
  if (onDisc) {
    const u = Math.abs(x - HOLE.x) / 140;
    return { c: mix(CREAM, mix(LEMON, SKY[5], u), u * 0.9 + rand() * 0.1), b: 0.95 - u * 0.3 };
  }
  if (hd < HOLE.r) return { c: ramp(GROUND, rand() * 0.5), b: 0.02 };
  if (hd < HOLE.r * 1.7) {
    const u = (hd - HOLE.r) / (HOLE.r * 0.7);
    return { c: mix(CREAM, mix(LEMON, SAGE, u), u * 0.8 + rand() * 0.2), b: 0.9 - u * 0.2 };
  }
  // the stars: a cream heart, then rings of lemon and of the planet's own colour, thinning into the sky
  for (const s of STARS) {
    const u = Math.hypot(x - s.x, y - s.y) / s.r;
    if (u < 1) {
      if (u < 0.24) return { c: mix(CREAM, LEMON, rand() * 0.4), b: 1 };
      const ringed = 0.5 + 0.5 * Math.sin(u * 15);
      if (u < 0.62) return { c: mix(mix(LEMON, s.tint, 0.25 + ringed * 0.35), CREAM, rand() * 0.35), b: 0.85 - u * 0.2 };
      const edge = mix(mix(SAGE, s.tint, 0.5), SKY[4], (u - 0.62) / 0.38);
      return { c: mix(edge, SKY[6], ringed * 0.35 + rand() * 0.15), b: 0.6 - u * 0.2 };
    }
  }
  // the open sky: light and dark passages, and bright crests that wind round each swirl like the arms of the galaxy
  let t = 0.16 + 0.42 * noise(x * 0.011, y * 0.011) + rand() * 0.2;
  for (const s of SWIRLS) {
    const dx = x - s.x;
    const dy = y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    const w = Math.exp(-Math.pow(d / s.r, 2) * 1.3);
    const arms = 0.5 + 0.5 * Math.sin(Math.log(d / 20) * 5.2 - Math.atan2(dy, dx) * 2 * s.dir);
    t += w * (arms * 0.55 - 0.12);
  }
  t = Math.min(1, Math.max(0, t));
  let c = ramp(SKY, t);
  // the brightest crests take a little of the starlight
  if (t > 0.8) c = mix(c, LEMON, (t - 0.8) * 1.6 * rand());
  // and a few strokes of green-blue, the way he let the under-colour show
  else if (rand() < 0.05) c = mix(c, [70, 150, 150], 0.5);
  return { c, b: t * 0.7 + 0.1 };
}

let base: HTMLCanvasElement | null = null;
/** Lays the whole painting, once: about twenty thousand strokes, dark paint first and the lights on top. */
function build(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = PW;
  c.height = PH;
  const g = c.getContext('2d')!;
  const rand = rng(1889);
  const noise = makeNoise(rand);
  g.fillStyle = 'rgb(12,26,70)';
  g.fillRect(0, 0, PW, PH);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const strokes: { x: number; y: number; c: RGB; b: number; len: number; wd: number }[] = [];
  for (let i = 0; i < 21000; i++) {
    // brushes land a little outside the canvas too, so the paint runs right to every edge
    const x = -40 + rand() * (PW + 80);
    const y = -40 + rand() * (PH + 80);
    const p = paintAt(x, y, rand, noise);
    const ground = y > hillY(x) - 4;
    strokes.push({ x, y, c: p.c, b: p.b + rand() * 0.35, len: (ground ? 16 : 13) + rand() * (ground ? 26 : 22), wd: 3.2 + rand() * 3.4 });
  }
  strokes.sort((a, b) => a.b - b.b);
  const css = (c2: RGB, k: number, a: number) => `rgba(${Math.round(Math.min(255, c2[0] * k))},${Math.round(Math.min(255, c2[1] * k))},${Math.round(Math.min(255, c2[2] * k))},${a})`;
  /** One stroke of thick paint: a darker edge underneath, the stroke itself, and a thin ridge of light along the top. */
  const lay = (pts: [number, number][], col: RGB, wd: number) => {
    const line = (ox: number, oy: number) => {
      g.beginPath();
      g.moveTo(pts[0][0] + ox, pts[0][1] + oy);
      for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0] + ox, pts[k][1] + oy);
      g.stroke();
    };
    g.lineWidth = wd;
    g.strokeStyle = css(col, 0.7, 0.9);
    line(0.7, 1.2);
    g.strokeStyle = css(col, 1, 0.96);
    line(0, 0);
    if (wd > 4.6) {
      g.lineWidth = 1;
      g.strokeStyle = css(col, 1.16, 0.6);
      line(-0.5, -wd * 0.28);
    }
  };
  for (const s of strokes) {
    // each stroke bends with the wind: a few short steps along it, forwards from where the brush landed
    const pts: [number, number][] = [[s.x, s.y]];
    let px = s.x;
    let py = s.y;
    for (let k = 0; k < 5; k++) {
      const [vx, vy] = wind(px, py);
      px += (vx * s.len) / 5;
      py += (vy * s.len) / 5;
      pts.push([px, py]);
    }
    lay(pts, s.c, s.wd);
  }
  // the hole is painted last, on top, so its shape stays clean: the dark heart, the ring of light bent round it,
  // and the thin bright disc across the front
  const arc = (d: number, a0: number, len: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let k = 0; k <= 4; k++) {
      const a = a0 + ((len / Math.max(d, 5)) * k) / 4;
      pts.push([HOLE.x + Math.cos(a) * d, HOLE.y + Math.sin(a) * d]);
    }
    return pts;
  };
  for (let i = 0; i < 300; i++) {
    const d = Math.sqrt(rand()) * HOLE.r * 0.97;
    lay(arc(d, rand() * Math.PI * 2, 8 + rand() * 14), ramp(GROUND, rand() * 0.62), 3 + rand() * 2.4);
  }
  for (let i = 0; i < 300; i++) {
    const u = Math.pow(rand(), 1.4);
    const d = HOLE.r * (1.05 + u * 0.55);
    // thicker over the top, the way the far side of the disc is bent up and over
    const a0 = rand() < 0.62 ? Math.PI + rand() * Math.PI : rand() * Math.PI;
    lay(arc(d, a0, 12 + rand() * 16), mix(CREAM, mix(LEMON, SAGE, u), u * 0.85 + rand() * 0.15), 2.8 + rand() * 2.6);
  }
  for (let i = 0; i < 46; i++) lay(arc(HOLE.r * 1.03, rand() * Math.PI * 2, 14 + rand() * 12), mix(CREAM, LEMON, rand() * 0.3), 3 + rand());
  for (let i = 0; i < 150; i++) {
    const side = rand() * 2 - 1;
    const u = Math.abs(side);
    const x = HOLE.x + side * 158;
    const y = HOLE.y + 5 + (rand() - 0.5) * 11 * (1 - u * 0.7);
    const len = 12 + rand() * 20;
    const col = u < 0.55 ? mix(CREAM, LEMON, u + rand() * 0.2) : mix(LEMON, SKY[5], (u - 0.55) * 2 * (0.6 + rand() * 0.4));
    lay([[x - len / 2, y], [x, y + (rand() - 0.5) * 1.5], [x + len / 2, y]], col, 2.4 + rand() * 2 * (1 - u * 0.5));
  }
  return c;
}

/** A few strokes of light that keep moving with the wind, so the sky is never quite still. */
const gusts: { x: number; y: number; age: number; life: number; shade: number }[] = [];
let lastT = 0;
const gustRand = rng(7);
function reseed(q: { x: number; y: number; age: number; life: number; shade: number }, fresh: boolean) {
  q.x = gustRand() * PW;
  q.y = gustRand() * 800;
  q.life = 3 + gustRand() * 4;
  q.age = fresh ? gustRand() * q.life : 0;
  q.shade = gustRand();
}

/**
 * Draws the painting into the frame. t is in seconds; calm (reduced motion) leaves the sky still.
 * The astronaut is drawn last, in whole device pixels, standing on the hill.
 */
export function paintStarry(canvas: HTMLCanvasElement, t: number, calm: boolean) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  base ??= build();
  const g = canvas.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingQuality = 'high';
  g.drawImage(base, 0, 0, canvas.width, canvas.height);
  const k = canvas.width / PW;
  if (!calm) {
    if (!gusts.length) for (let i = 0; i < 150; i++) reseed((gusts[i] = { x: 0, y: 0, age: 0, life: 1, shade: 0 }), true);
    const dt = Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    g.lineCap = 'round';
    for (const q of gusts) {
      q.age += dt;
      const [vx, vy] = wind(q.x, q.y);
      q.x += vx * 26 * dt;
      q.y += vy * 26 * dt;
      if (q.age > q.life || q.x < -20 || q.x > PW + 20 || q.y < -20 || q.y > hillY(q.x) - 14) {
        reseed(q, false);
        continue;
      }
      // a short curved stroke trailing behind the point
      let px = q.x;
      let py = q.y;
      g.beginPath();
      g.moveTo(px * k, py * k);
      for (let s = 0; s < 4; s++) {
        const [ux, uy] = wind(px, py);
        px -= ux * 5;
        py -= uy * 5;
        g.lineTo(px * k, py * k);
      }
      const c = q.shade < 0.25 ? LEMON : q.shade < 0.6 ? SKY[7] : SKY[6];
      g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.sin((q.age / q.life) * Math.PI) * 0.5})`;
      g.lineWidth = (3 + q.shade * 2.4) * k;
      g.stroke();
    }
  }
  // the astronaut, feet on the hill, looking up at it all
  const px = Math.max(2, Math.round(canvas.width / 150));
  const ax = Math.round(canvas.width * 0.27);
  const ground = hillY(0.27 * PW) * k;
  drawAstronaut(g, ax, Math.round(ground - (ASTRO.h - ASTRO.ay - 1) * px), px, t, 1, 0, true);
}
