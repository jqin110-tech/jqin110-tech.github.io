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

/** What the painting tells the page: a star or the hole was pointed at or chosen. Stars are numbered as in STARS. */
export interface StarryEvents {
  /** The pointer is over star i, over the hole (-1), or over neither (null). x, y are CSS pixels inside the canvas. */
  onHover(what: number | null, x: number, y: number): void;
  onStar(i: number): void;
  onHole(): void;
  /** Something changed while the sky is being kept still (reduced motion): please paint once. */
  invalidate(): void;
}
/** The planets the stars stand for, in the order of STARS. */
export const STAR_ZONES = ['campus', 'workshop', 'tower', 'observatory', 'signal', 'brief'] as const;

interface Gust {
  x: number;
  y: number;
  age: number;
  life: number;
  shade: number;
}

/**
 * Hangs the painting in a canvas and makes it answer to the visitor:
 * the sky stirs round the pointer, a drag leaves fresh paint, a click on open sky starts a new swirl,
 * the stars flare when pointed at (each one is a room), the hole is the way into the galaxy,
 * and the astronaut walks along the hill to stand under the pointer.
 * Returns the function that paints one frame. t is in seconds; calm (reduced motion) keeps the sky still.
 */
export function mountStarry(canvas: HTMLCanvasElement, ev: StarryEvents): (t: number, calm: boolean) => void {
  const rand = rng(7);
  const gusts: Gust[] = [];
  const fresh: { x: number; y: number; dx: number; dy: number; age: number; life: number; shade: number }[] = [];
  const bursts: { x: number; y: number; age: number }[] = [];
  const flare = STARS.map(() => 0);
  let holeFlare = 0;
  const ptr = { x: 0, y: 0, on: false, lx: 0, ly: 0 };
  let hover: number | null = null;
  let lastT = 0;
  let now = 0;
  let walkX = 0.27 * PW;
  let face = 1;

  const toPaint = (e: PointerEvent | MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PW, y: ((e.clientY - r.top) / r.height) * PH, cx: e.clientX - r.left, cy: e.clientY - r.top };
  };
  /** Star index, -1 for the hole, or null for open sky or ground. */
  const hit = (x: number, y: number): number | null => {
    if (Math.hypot(x - HOLE.x, y - HOLE.y) < HOLE.r * 1.9) return -1;
    for (let i = 0; i < STARS.length; i++) if (Math.hypot(x - STARS[i].x, y - STARS[i].y) < STARS[i].r * 1.05) return i;
    return null;
  };
  const point = (e: PointerEvent) => {
    const p = toPaint(e);
    if (ptr.on && y_ok(p.y, p.x)) {
      // a moving pointer leaves fresh paint behind it
      const dx = p.x - ptr.lx;
      const dy = p.y - ptr.ly;
      const d = Math.hypot(dx, dy);
      if (d > 11) {
        fresh.push({ x: p.x, y: p.y, dx: dx / d, dy: dy / d, age: 0, life: 2.2 + rand() * 1.4, shade: rand() });
        if (fresh.length > 150) fresh.shift();
        ptr.lx = p.x;
        ptr.ly = p.y;
      }
    } else {
      ptr.lx = p.x;
      ptr.ly = p.y;
    }
    ptr.x = p.x;
    ptr.y = p.y;
    ptr.on = true;
    const h = hit(p.x, p.y);
    if (h !== hover) {
      hover = h;
      canvas.style.cursor = h === null ? 'crosshair' : 'pointer';
    }
    ev.onHover(h, p.cx, p.cy);
    ev.invalidate();
  };
  const y_ok = (y: number, x: number) => y < hillY(x) - 10;
  const leave = () => {
    ptr.on = false;
    hover = null;
    ev.onHover(null, 0, 0);
    ev.invalidate();
  };
  canvas.addEventListener('pointermove', point);
  canvas.addEventListener('pointerdown', point);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('pointercancel', leave);
  canvas.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && window.setTimeout(leave, 900));
  canvas.addEventListener('click', (e) => {
    const p = toPaint(e);
    const h = hit(p.x, p.y);
    if (h === -1) ev.onHole();
    else if (h !== null) {
      flare[h] = 1.6;
      ev.onStar(h);
    } else if (y_ok(p.y, p.x)) {
      // open sky: a new swirl is born where it was touched, turns for a few seconds and melts back into the paint
      bursts.push({ x: p.x, y: p.y, age: 0 });
      if (bursts.length > 6) bursts.shift();
    } else {
      // the ground: the astronaut walks over to where it was touched
      ptr.x = p.x;
      ptr.on = true;
    }
    ev.invalidate();
  });

  /** The wind as the moving strokes feel it: the painted wind, bent round the pointer and round each new swirl. */
  const stirred = (x: number, y: number): [number, number] => {
    let [vx, vy] = wind(x, y);
    const bend = (cx: number, cy: number, r: number, strength: number) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const w = Math.exp(-Math.pow(d / r, 2)) * strength;
      vx = vx * (1 - w) + ((-dy / d) * 1 - (dx / d) * 0.25) * w;
      vy = vy * (1 - w) + ((dx / d) * 1 - (dy / d) * 0.25) * w;
    };
    if (ptr.on) bend(ptr.x, ptr.y, 120, 0.95);
    for (const b of bursts) bend(b.x, b.y, 90, Math.sin(Math.min(1, b.age / 3.6) * Math.PI));
    const m = Math.hypot(vx, vy) || 1;
    return [vx / m, vy / m];
  };
  const reseed = (q: Gust, first: boolean) => {
    // while the pointer is in the sky, half of the new strokes gather round it
    if (!first && ptr.on && y_ok(ptr.y, ptr.x) && rand() < 0.55) {
      const a = rand() * Math.PI * 2;
      const d = 20 + rand() * 110;
      q.x = ptr.x + Math.cos(a) * d;
      q.y = ptr.y + Math.sin(a) * d;
      q.life = 1.6 + rand() * 2;
    } else {
      q.x = rand() * PW;
      q.y = rand() * 800;
      q.life = 3 + rand() * 4;
    }
    q.age = first ? rand() * q.life : 0;
    q.shade = rand();
  };

  return (t: number, calm: boolean) => {
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
    const dt = Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    now += dt;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const rgba = (c: RGB, a: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, a))})`;
    /** An arc of paint round a centre, in painting units. */
    const ring = (cx: number, cy: number, r: number, a0: number, len: number, col: RGB, alpha: number, wd: number) => {
      g.beginPath();
      g.arc(cx * k, cy * k, Math.max(1, r) * k, a0, a0 + len);
      g.strokeStyle = rgba(col, alpha);
      g.lineWidth = wd * k;
      g.stroke();
    };

    if (!calm) {
      // the wind: strokes of light that keep moving, so the sky is never quite still
      if (!gusts.length) for (let i = 0; i < 170; i++) reseed((gusts[i] = { x: 0, y: 0, age: 0, life: 1, shade: 0 }), true);
      for (const q of gusts) {
        q.age += dt;
        const [vx, vy] = stirred(q.x, q.y);
        const near = ptr.on ? Math.exp(-Math.pow(Math.hypot(q.x - ptr.x, q.y - ptr.y) / 130, 2)) : 0;
        const speed = 26 + near * 70;
        q.x += vx * speed * dt;
        q.y += vy * speed * dt;
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
          const [ux, uy] = stirred(px, py);
          px -= ux * 5;
          py -= uy * 5;
          g.lineTo(px * k, py * k);
        }
        const c = q.shade < 0.25 ? LEMON : q.shade < 0.6 ? SKY[7] : SKY[6];
        g.strokeStyle = rgba(c, Math.sin((q.age / q.life) * Math.PI) * (0.5 + near * 0.4));
        g.lineWidth = (3 + q.shade * 2.4) * k;
        g.stroke();
      }
      // every star turns slowly on its own
      for (let i = 0; i < STARS.length; i++) {
        const s = STARS[i];
        for (let j = 0; j < 5; j++) ring(s.x, s.y, s.r * (0.34 + j * 0.13), now * (0.5 - j * 0.06) + j * 1.9 + i, 0.9, mix(CREAM, s.tint, 0.3), 0.3, 3.4);
      }
    }
    // fresh paint left by the pointer: it drifts with the wind and sinks back into the picture
    for (let i = fresh.length - 1; i >= 0; i--) {
      const f = fresh[i];
      f.age += dt;
      if (f.age > f.life) {
        fresh.splice(i, 1);
        continue;
      }
      const [vx, vy] = wind(f.x, f.y);
      f.x += vx * 9 * dt;
      f.y += vy * 9 * dt;
      const a = Math.pow(1 - f.age / f.life, 1.3);
      const c = f.shade < 0.4 ? CREAM : f.shade < 0.75 ? LEMON : SKY[7];
      const bow = (f.shade - 0.5) * 7;
      const line = (ox: number, oy: number) => {
        g.beginPath();
        g.moveTo((f.x - f.dx * 12 + ox) * k, (f.y - f.dy * 12 + oy) * k);
        g.quadraticCurveTo((f.x - f.dy * bow + ox) * k, (f.y + f.dx * bow + oy) * k, (f.x + f.dx * 12 + ox) * k, (f.y + f.dy * 12 + oy) * k);
        g.stroke();
      };
      g.lineWidth = (4 + f.shade * 2.5) * k;
      g.strokeStyle = rgba(mix(c, SKY[2], 0.5), a * 0.8);
      line(0.8, 1.3);
      g.strokeStyle = rgba(c, a * 0.95);
      line(0, 0);
    }
    // new swirls: rings of paint that open out, turn, and fade
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.age += calm ? 0.6 : dt;
      if (b.age > 3.6) {
        bursts.splice(i, 1);
        continue;
      }
      const u = b.age / 3.6;
      const a = Math.sin(u * Math.PI);
      for (let j = 0; j < 22; j++) {
        const r = (6 + j * 3.1) * (0.35 + u * 1.1);
        const c = j < 5 ? CREAM : j < 12 ? LEMON : j < 17 ? SAGE : SKY[6];
        ring(b.x, b.y, r, j * 2.4 + b.age * (2.6 - j * 0.07), 1.1 + (j % 3) * 0.3, c, a * (1 - j / 30), 3.6);
      }
    }
    // the stars and the hole answer to being pointed at
    for (let i = 0; i < STARS.length; i++) {
      flare[i] += ((hover === i ? 1 : 0) - flare[i]) * Math.min(1, (calm ? 1 : dt * 7));
      const f = Math.min(1, flare[i]);
      if (f < 0.02) continue;
      const s = STARS[i];
      const glow = g.createRadialGradient(s.x * k, s.y * k, 0, s.x * k, s.y * k, s.r * 1.5 * k);
      glow.addColorStop(0, rgba(CREAM, 0.5 * f));
      glow.addColorStop(1, rgba(CREAM, 0));
      g.fillStyle = glow;
      g.fillRect((s.x - s.r * 1.5) * k, (s.y - s.r * 1.5) * k, s.r * 3 * k, s.r * 3 * k);
      for (let j = 0; j < 16; j++) ring(s.x, s.y, s.r * (0.25 + j * 0.068), now * (2.4 - j * 0.1) + j * 2.1, 0.8 + (j % 3) * 0.25, j % 3 ? mix(CREAM, s.tint, 0.35) : LEMON, f * 0.85, 3.8);
    }
    holeFlare += ((hover === -1 ? 1 : 0) - holeFlare) * Math.min(1, calm ? 1 : dt * 7);
    if (holeFlare > 0.02) {
      for (let j = 0; j < 18; j++) ring(HOLE.x, HOLE.y, HOLE.r * (1.08 + j * 0.05), now * (2.2 - j * 0.08) + j * 1.7, 0.7 + (j % 3) * 0.25, j % 2 ? CREAM : LEMON, holeFlare * 0.85, 3.6);
    }

    // the astronaut walks along the hill to stand under the pointer, and looks up at it all
    const want = ptr.on ? Math.min(PW - 60, Math.max(60, ptr.x)) : walkX;
    const gap = want - walkX;
    const moving = Math.abs(gap) > 3 && !calm;
    if (moving) {
      face = gap > 0 ? 1 : -1;
      walkX += face * Math.min(Math.abs(gap), 150 * dt);
    } else if (calm && ptr.on) walkX = want;
    const px = Math.max(2, Math.round(canvas.width / 150));
    const hop = moving ? Math.abs(Math.sin(now * 11)) * 5 : 0;
    drawAstronaut(g, Math.round(walkX * k), Math.round((hillY(walkX) - hop) * k - (ASTRO.h - ASTRO.ay - 1) * px), px, t, face, 0, !moving);
  };
}
