// Pen and wash, drawn by code. Every line here is a filled shape whose width breathes the way a nib's does,
// nothing is ruled, corners overshoot, and the colour is laid on loosely so it never quite meets the line.
// The drawings are plain inline SVG: the ink takes the text colour, the washes take CSS variables.
type Pt = [number, number];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth wandering value between -1 and 1: the tremor of a hand. */
function tremor(seed: number) {
  const r = rng(seed);
  const v = Array.from({ length: 64 }, () => r() * 2 - 1);
  return (t: number) => {
    const i = Math.floor(t);
    const f = t - i;
    const a = v[((i % 64) + 64) % 64];
    const b = v[(((i + 1) % 64) + 64) % 64];
    return a + (b - a) * f * f * (3 - 2 * f);
  };
}

const n1 = (n: number) => String(Math.round(n * 10) / 10);
const poly = (p: Pt[]) => 'M' + p.map((q) => `${n1(q[0])} ${n1(q[1])}`).join('L') + 'Z';

/** Points spaced evenly along a polyline. */
function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d <= len) {
      out.push([ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len]);
      d += step;
    }
    carry = (carry + len) % step;
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.3) out.push(last);
  return out;
}

/** One sheet of drawing: strokes pile up in `d`, and every stroke gets its own tremor. */
class Pen {
  d = '';
  r: () => number;
  private k = 0;
  constructor(private seed: number) {
    this.r = rng(seed);
  }
  /** A stroke through the points. w is the nib width; wob is how far the hand wanders off the line. */
  stroke(pts: Pt[], w = 3, wob = 1): this {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (len < 0.5) return this;
    const step = Math.min(9, Math.max(2.2, len / 12));
    const p = resample(pts, step);
    const n = p.length;
    const off = tremor(this.seed * 31 + ++this.k * 7);
    const wid = tremor(this.seed * 17 + this.k * 13);
    const L: Pt[] = [];
    const R: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = p[Math.max(0, i - 1)];
      const b = p[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0];
      let ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      const s = i * step;
      // the ends stay where they were aimed; the middle is free to drift
      const free = Math.min(1, Math.min(s, len - s) / 14);
      const o = wob * free * (off(s / 52) + off(s / 15 + 20) * 0.3);
      // the nib lands, presses, and lifts off in a longer tail
      const press = Math.min(1, 0.45 + s / (w * 2.5)) * Math.min(1, 0.2 + (len - s) / (w * 5));
      const hw = w * 0.5 * (0.78 + 0.34 * wid(s / 64)) * press;
      const cx = p[i][0] - ty * o;
      const cy = p[i][1] + tx * o;
      L.push([cx - ty * hw, cy + tx * hw]);
      R.push([cx + ty * hw, cy - tx * hw]);
    }
    this.d += poly(L.concat(R.reverse()));
    return this;
  }
  /** A straight line drawn freehand: it overshoots a little at both ends and bows very slightly. */
  line(x0: number, y0: number, x1: number, y1: number, w = 3, over = 0, wob = 1): this {
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    const o0 = over * this.r();
    const o1 = over * this.r();
    const bow = (this.r() - 0.5) * len * 0.006;
    return this.stroke(
      [
        [x0 - ux * o0, y0 - uy * o0],
        [(x0 + x1) / 2 - uy * bow, (y0 + y1) / 2 + ux * bow],
        [x1 + ux * o1, y1 + uy * o1],
      ],
      w,
      wob,
    );
  }
  /** Part of an ellipse, from angle a0 to a1 in radians. */
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, w = 2, wob = 0.6): this {
    const n = Math.max(6, Math.ceil((Math.abs(a1 - a0) * Math.max(rx, ry)) / 5));
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return this.stroke(pts, w, wob);
  }
  box(x: number, y: number, w: number, h: number, nib = 2, over = 2): this {
    return this.line(x, y, x + w, y, nib, over).line(x + w, y, x + w, y + h, nib, over).line(x + w, y + h, x, y + h, nib, over).line(x, y + h, x, y, nib, over);
  }
}

/** A patch of colour with an uneven edge, the way a loaded brush leaves it. */
function wash(pts: Pt[], amp: number, seed: number): string {
  const p = resample(pts.concat([pts[0]]), 12);
  const t = tremor(seed);
  const n = p.length;
  return poly(
    p.map((q, i) => {
      const a = p[(i - 1 + n) % n];
      const b = p[(i + 1) % n];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const o = amp * (t(i / 5) + t(i / 1.7 + 30) * 0.4);
      return [q[0] - ((b[1] - a[1]) / l) * o, q[1] + ((b[0] - a[0]) / l) * o] as Pt;
    }),
  );
}
const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/**
 * A picture frame in pen and wash, hung by two wires from one nail. pw and ph are the picture's size, t the width of the
 * moulding. The drawing is laid over a box of exactly (pw + 2t) by (ph + 2t) and spills outside it for the wires above
 * and the shadow hatching beside; `style` positions it that way.
 */
export function inkFrame(pw: number, ph: number, t: number, seed: number): string {
  const W = pw + 2 * t;
  const H = ph + 2 * t;
  const m = 34;
  const wire = Math.round(W * 0.13);
  const pen = new Pen(seed);
  const fine = new Pen(seed + 3);
  const r = pen.r;

  // the moulding: a double line at the outer edge, a double line at the sight edge, and the mitres between them
  for (const [ins, nib, over] of [
    [4, 3.6, 12],
    [16, 1.9, 5],
    [t - 20, 1.8, 3],
    [t - 7, 3.2, 5],
  ]) {
    pen.box(ins, ins, W - 2 * ins, H - 2 * ins, nib, over);
  }
  for (const [sx, sy] of [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]) {
    const x = sx ? W : 0;
    const y = sy ? H : 0;
    const dx = sx ? -1 : 1;
    const dy = sy ? -1 : 1;
    fine.line(x + dx * 5, y + dy * 5, x + dx * (t - 8), y + dy * (t - 8), 1.5, 2, 0.5);
  }

  // the carving, as a draughtsman notes it: a scroll running out of each corner and each middle and curling in on itself,
  // with the channel between them left quiet
  const a = 16;
  const b = t - 20;
  const c = (a + b) / 2;
  const amp = (b - a) / 2 - 4;
  if (amp > 20) {
    const R = amp * 0.46;
    const scroll = (x: number, y: number, ang: number, len: number, turn: number) => {
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const belly = Math.sin(u * Math.PI) * R * 0.3 * turn;
        pts.push([x + dx * len * u + dy * belly, y + dy * len * u - dx * belly]);
      }
      const cx = x + dx * len - dy * turn * R;
      const cy = y + dy * len + dx * turn * R;
      const a0 = Math.atan2(y + dy * len - cy, x + dx * len - cx);
      const sweep = Math.PI * (2.5 + r() * 0.5);
      for (let th = 0.2; th <= sweep; th += 0.2) {
        const rad = R * (1 - 0.84 * Math.pow(th / sweep, 0.85));
        pts.push([cx + Math.cos(a0 + turn * th) * rad, cy + Math.sin(a0 + turn * th) * rad]);
      }
      pen.stroke(pts, 2.5, 0.5);
      // a leaf springing off the back of the scroll
      const lx = x + dx * len * 0.42;
      const ly = y + dy * len * 0.42;
      fine.stroke(
        [
          [lx, ly],
          [lx + dx * len * 0.16 + dy * turn * R * 0.5, ly + dy * len * 0.16 - dx * turn * R * 0.5],
          [lx + dx * len * 0.36 + dy * turn * R * 1.25, ly + dy * len * 0.36 - dx * turn * R * 1.25],
        ],
        1.6,
        0.3,
      );
    };
    const reach = Math.min(pw, ph) * 0.105 + R;
    for (const [X, Y, ix, iy] of [
      [c, c, 1, 1],
      [W - c, c, -1, 1],
      [W - c, H - c, -1, -1],
      [c, H - c, 1, -1],
    ]) {
      scroll(X + ix * R * 1.5, Y, ix > 0 ? 0 : Math.PI, reach, ix * iy);
      scroll(X, Y + iy * R * 1.5, (iy * Math.PI) / 2, reach, -ix * iy);
      const a0 = r() * 6;
      pen.arc(X, Y, R * 0.85, R * 0.85, a0, a0 + 5.9, 1.9, 0.4);
      fine.arc(X, Y, R * 0.3, R * 0.3, a0 + 1, a0 + 6.8, 1.7, 0.2);
    }
    for (const [X, Y, hor, inside] of [
      [W / 2, c, 1, 1],
      [W / 2, H - c, 1, -1],
      [c, H / 2, 0, 1],
      [W - c, H / 2, 0, -1],
    ]) {
      if (hor) {
        scroll(X + R * 0.9, Y, 0, reach * 0.8, inside);
        scroll(X - R * 0.9, Y, Math.PI, reach * 0.8, -inside);
      } else {
        scroll(X, Y + R * 0.9, Math.PI / 2, reach * 0.8, -inside);
        scroll(X, Y - R * 0.9, -Math.PI / 2, reach * 0.8, inside);
      }
      pen.stroke(
        [
          [X - R * 0.55, Y],
          [X, Y - R * 0.55],
          [X + R * 0.55, Y],
          [X, Y + R * 0.55],
          [X - R * 0.5, Y + 0.6],
        ],
        1.7,
        0.2,
      );
    }
  }

  // light comes from the upper left: the far bevels are hatched, and the frame throws a little shadow on the wall
  for (let x = 14; x < W - 8; x += 6 + r() * 4) fine.line(x, H - 5.5, x - 8, H - 15, 1.2, 0, 0.3);
  for (let y = 14; y < H - 8; y += 6 + r() * 4) fine.line(W - 5.5, y, W - 15, y - 8, 1.2, 0, 0.3);
  for (let x = t + 4; x < W - t; x += 7 + r() * 5) fine.line(x, t - 8, x - 7, t - 18, 1.1, 0, 0.3);
  for (let y = t + 4; y < H - t; y += 7 + r() * 5) fine.line(t - 8, y, t - 18, y - 7, 1.1, 0, 0.3);
  const cast = new Pen(seed + 9);
  for (let y = 26; y < H + 8; y += 9 + r() * 7) if (r() < 0.7) cast.line(W + 7, y, W + 16 + r() * 10, y + 9 + r() * 6, 1.2, 0, 0.4);
  for (let x = 30; x < W + 6; x += 9 + r() * 7) if (r() < 0.7) cast.line(x, H + 7, x + 9 + r() * 6, H + 16 + r() * 10, 1.2, 0, 0.4);

  // the wires and the nail
  const nail: Pt = [W / 2 + (r() - 0.5) * 6, -wire + 12];
  const hang = new Pen(seed + 5);
  hang.line(W * 0.27, 3, nail[0], nail[1], 1.6, 0, 0.5).line(W * 0.73, 3, nail[0], nail[1], 1.6, 0, 0.5);
  pen.arc(nail[0], nail[1], 5.5, 5.5, 0.4, 6.4, 2.6, 0.2);
  fine.arc(W * 0.27, 4, 4, 4, 0, 6.1, 1.4, 0.2).arc(W * 0.73, 4, 4, 4, 0, 6.1, 1.4, 0.2);

  // colour: one loose pass over the whole moulding, a second on the two sides away from the light
  const ring = wash(rect(7, 6, W - 10, H - 9), 3.2, seed + 1) + wash(rect(t - 9, t - 8, pw + 15, ph + 14), 2.4, seed + 2);
  const shade =
    wash(
      [
        [W - 3, 8],
        [W - 3, H - 2],
        [6, H - 2],
        [t - 6, H - t + 8],
        [W - t + 8, H - t + 8],
        [W - t + 8, t - 4],
      ],
      2.6,
      seed + 4,
    );
  const top = -m - wire;
  const style = `left:${n1((-m / W) * 100)}%;top:${n1((top / H) * 100)}%;width:${n1(((W + 2 * m) / W) * 100)}%;height:${n1(((H + 2 * m + wire) / H) * 100)}%`;
  return `<svg class="ink ink-frame" viewBox="${-m} ${top} ${W + 2 * m} ${H + 2 * m + wire}" style="${style}" aria-hidden="true" focusable="false">
    <path class="w-frame" fill-rule="evenodd" d="${ring}"/><path class="w-shade" d="${shade}"/>
    <path class="ink-soft" d="${cast.d}"/><path class="ink-soft" d="${hang.d}"/><path d="${pen.d}"/><path d="${fine.d}"/>
  </svg>`;
}

/** A line drawn across the page by hand. It stretches to any width without getting thicker. */
export function inkRule(seed: number, double = false): string {
  const pen = new Pen(seed);
  pen.line(6, 6, 1594, 6 + (pen.r() - 0.5) * 2, 2.2, 0, 1.5);
  if (double) pen.line(10, 13, 1590, 13 + (pen.r() - 0.5) * 2, 1.3, 0, 1.2);
  return `<svg class="ink ink-rule" viewBox="0 0 1600 ${double ? 18 : 12}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${pen.d}"/></svg>`;
}

/**
 * The rooftops of Paris in pen and wash: mansards in zinc, dormers, chimney stacks with their rows of pots, the top floor
 * of each house with its shutters and iron balconies, and behind them a dome and the tower. The drawing is 4200 wide and
 * is meant to be cropped from the middle, so the landmarks sit near the centre.
 */
export function inkSkyline(seed: number): string {
  const W = 4200;
  const H = 340;
  const pen = new Pen(seed);
  const fine = new Pen(seed + 1);
  const far = new Pen(seed + 2);
  const r = pen.r;
  let paper = '';
  let zinc = '';
  let lit = '';
  let wall = '';

  // ---- far off: the tower ----
  {
    const cx = W / 2 + 236;
    const base = H - 30;
    const h = 292;
    const y = (u: number) => base - h + h * u;
    const hw = (u: number) => 2 + 60 * Math.pow(u, 2.05);
    const side = (s: number) => {
      const p: Pt[] = [];
      for (let u = 0; u <= 1.001; u += 0.05) p.push([cx + s * hw(u), y(u)]);
      return p;
    };
    far.stroke(side(-1), 2.6, 0.5).stroke(side(1), 2.6, 0.5);
    far.line(cx, y(0), cx, y(0) - 20, 1.3, 0, 0.2);
    for (const u of [0.1, 0.44, 0.72]) {
      far.line(cx - hw(u) - 3, y(u), cx + hw(u) + 3, y(u), 2, 1, 0.3);
      far.line(cx - hw(u) - 2, y(u) + 5, cx + hw(u) + 2, y(u) + 5, 1.3, 1, 0.3);
    }
    // the lattice
    for (let u = 0.12; u < 0.7; u += 0.045) {
      const v = u + 0.045;
      if (Math.abs(u - 0.44) < 0.03) continue;
      far.line(cx - hw(u), y(u), cx + hw(v), y(v), 0.9, 0, 0.2).line(cx + hw(u), y(u), cx - hw(v), y(v), 0.9, 0, 0.2);
    }
    // the legs, their inner edges and the arch between them
    for (const s of [-1, 1]) {
      const p: Pt[] = [];
      for (let u = 0.725; u <= 1.001; u += 0.05) p.push([cx + s * (hw(u) - 9 - (u - 0.725) * 26), y(u)]);
      far.stroke(p, 1.5, 0.3);
      for (let u = 0.76; u < 0.98; u += 0.055) far.line(cx + s * hw(u), y(u), cx + s * (hw(u + 0.05) - 10 - (u - 0.67) * 26), y(u + 0.05), 0.9, 0, 0.2);
    }
    far.arc(cx, y(1) + 4, hw(1) - 17, h * 0.2, Math.PI, 2 * Math.PI, 1.5, 0.3);
  }
  // ---- far off: a dome on its drum ----
  {
    const cx = W / 2 - 372;
    const base = H - 112;
    const s = 150;
    const dw = s * 0.46;
    const dh = s * 0.34;
    far.line(cx - dw, base, cx - dw, base - dh, 1.6, 1).line(cx + dw, base, cx + dw, base - dh, 1.6, 1);
    far.line(cx - dw - 5, base - dh, cx + dw + 5, base - dh, 2, 2).line(cx - dw - 3, base - dh - 5, cx + dw + 3, base - dh - 5, 1.3, 1);
    for (let x = cx - dw + 6; x < cx + dw - 2; x += 7.5) far.line(x, base - 3, x, base - dh + 5, 1, 0, 0.2);
    far.arc(cx, base - dh - 5, dw * 0.92, s * 0.52, Math.PI, 2 * Math.PI, 2, 0.5);
    for (const k of [-0.5, 0, 0.5]) far.arc(cx + k * dw * 0.2, base - dh - 5, dw * Math.abs(k) * 1.1 + 0.5, s * 0.5, Math.PI * 1.02, Math.PI * 1.98, 0.9, 0.3);
    const top = base - dh - 5 - s * 0.52;
    far.box(cx - 6, top - 15, 12, 15, 1.3, 1).arc(cx, top - 15, 6, 8, Math.PI, 2 * Math.PI, 1.3, 0.2).line(cx, top - 23, cx, top - 37, 1.2, 0, 0.1);
  }

  // ---- the street of houses in front ----
  let x = -40;
  while (x < W + 40) {
    const bw = 96 + r() * 150;
    const eave = H - (62 + r() * 88);
    const mh = 40 + r() * 18;
    const ins = 9 + r() * 6;
    const x0 = x;
    const x1 = x + bw;
    const top = eave - mh;
    const roof: Pt[] = [
      [x0, eave],
      [x0 + ins, top],
      [x1 - ins, top],
      [x1, eave],
    ];
    paper += poly(roof.concat([[x1, H + 6], [x0, H + 6]]));
    zinc += wash(roof, 2.6, seed + Math.round(x)) + (r() < 0.6 ? wash([[x0 + 2, eave - 1], [x0 + ins + 3, top + mh * 0.45], [x1 - ins - 3, top + mh * 0.45], [x1 - 2, eave - 1]], 2, seed + Math.round(x) + 1) : '');
    if (r() < 0.4) wall += wash(rect(x0 + 2, eave + 7, bw - 5, H - eave), 2.4, seed + Math.round(x) + 2);

    // a chimney stack on the party wall, its cap, and the pots in a row
    for (const end of r() < 0.3 ? [0, 1] : [r() < 0.5 ? 0 : 1]) {
      const sw = 17 + r() * 16;
      const sh = 15 + r() * 22;
      const xs = end ? x1 - ins - sw - 4 : x0 + ins + 4;
      paper += poly(rect(xs, top - sh, sw, sh + 2));
      pen.line(xs, top + 1, xs, top - sh, 2.2, 1).line(xs + sw, top + 1, xs + sw, top - sh, 2.2, 1).line(xs - 3, top - sh, xs + sw + 3, top - sh, 2.8, 2);
      const pots = 2 + Math.floor(r() * 4);
      for (let i = 0; i < pots; i++) {
        const px = xs + ((i + 0.5) * sw) / pots;
        const ph = 7 + r() * 8;
        pen.line(px, top - sh - 1, px, top - sh - ph, 3.4, 0, 0.2);
        if (r() < 0.5) fine.line(px - 2.5, top - sh - ph, px + 2.5, top - sh - ph, 1.3, 0, 0.1);
      }
      for (let yy = top - sh + 5; yy < top - 2; yy += 5 + r() * 3) if (r() < 0.5) fine.line(xs + 2, yy, xs + 3 + r() * (sw - 5), yy, 0.9, 0, 0.2);
    }

    // the mansard
    pen.stroke([roof[0], roof[1]], 2.6, 0.5).line(x0 + ins, top, x1 - ins, top, 2.6, 4).stroke([roof[2], roof[3]], 2.6, 0.5);
    pen.line(x0 - 3, eave, x1 + 3, eave, 3, 5).line(x0, eave + 6, x1, eave + 6, 1.5, 3);
    pen.line(x0, eave, x0, H + 4, 2, 0).line(x1, eave, x1, H + 4, 1.6, 0);
    // the seams of the zinc
    for (let sx = x0 + ins + 8; sx < x1 - ins - 4; sx += 9 + r() * 8) if (r() < 0.45) fine.line(sx, top + 3, sx - 1, top + 8 + r() * (mh * 0.3), 0.9, 0, 0.2);

    const n = Math.max(1, Math.floor((bw - 2 * ins - 8) / 40));
    const gap = (bw - 2 * ins) / n;
    const shutters = r() < 0.6;
    for (let i = 0; i < n; i++) {
      const cx = x0 + ins + gap * (i + 0.5);
      // a dormer in the roof
      const dh = Math.min(mh - 13, 23);
      const by = eave - 5;
      paper += poly(rect(cx - 7, by - dh, 14, dh));
      if (r() < 0.13) lit += wash(rect(cx - 6, by - dh + 1, 12, dh - 1), 0.9, seed + Math.round(cx));
      pen.line(cx - 7, by, cx - 7, by - dh, 1.8, 1).line(cx + 7, by, cx + 7, by - dh, 1.8, 1);
      if (r() < 0.5) pen.stroke([[cx - 10, by - dh + 1], [cx, by - dh - 7], [cx + 10, by - dh + 1]], 1.9, 0.3);
      else pen.arc(cx, by - dh + 1, 9.5, 7, Math.PI, 2 * Math.PI, 1.9, 0.3);
      fine.line(cx, by, cx, by - dh, 1, 0, 0.2).line(cx - 6, by - dh * 0.5, cx + 6, by - dh * 0.5, 0.9, 0, 0.2);

      // the window under it, with its shutters and its balcony
      const wy = eave + 15;
      const wh = 34;
      if (r() < 0.15) lit += wash(rect(cx - 6, wy + 1, 12, wh - 2), 0.9, seed + Math.round(cx) + 5);
      fine.box(cx - 6.5, wy, 13, wh, 1.5, 1.5).line(cx, wy, cx, wy + wh, 0.9, 0, 0.2);
      if (shutters) {
        fine.line(cx - 12, wy, cx - 12, wy + wh, 1.2, 1, 0.3).line(cx + 12, wy, cx + 12, wy + wh, 1.2, 1, 0.3);
        for (let yy = wy + 4; yy < wy + wh - 2; yy += 4.5) fine.line(cx - 11.5, yy, cx - 7.5, yy, 0.7, 0, 0.1).line(cx + 7.5, yy, cx + 11.5, yy, 0.7, 0, 0.1);
      }
      const ry = wy + wh;
      pen.line(cx - 13, ry + 1, cx + 13, ry + 1, 2, 1, 0.3);
      fine.line(cx - 12, ry - 9, cx + 12, ry - 9, 1.1, 1, 0.3);
      for (let rx = cx - 10; rx <= cx + 10.1; rx += 4) fine.line(rx, ry, rx, ry - 9, 0.8, 0, 0.1);
      // and the head of the window on the floor below
      const wy2 = ry + 16;
      if (wy2 < H - 8) fine.line(cx - 6.5, wy2, cx + 6.5, wy2, 1.5, 1, 0.2).line(cx - 6.5, wy2, cx - 6.5, H + 2, 1.4, 0, 0.2).line(cx + 6.5, wy2, cx + 6.5, H + 2, 1.4, 0, 0.2);
    }
    if (eave + 60 < H - 6) fine.line(x0 + 1, eave + 60, x1 - 1, eave + 60, 1.1, 0, 0.5);
    x = x1 + (r() < 0.16 ? 5 + r() * 9 : 0);
  }
  return `<svg class="ink ink-sky" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <path class="ink-far" d="${far.d}"/><path class="ink-paper" d="${paper}"/>
    <path class="w-wall" d="${wall}"/><path class="w-zinc" d="${zinc}"/><path class="w-lit" d="${lit}"/>
    <path d="${pen.d}"/><path d="${fine.d}"/>
  </svg>`;
}

/** A quick curved arrow, the kind drawn beside a note to say "this one". It points up and to the right. */
export function inkArrow(seed: number): string {
  const pen = new Pen(seed);
  pen.stroke(
    [
      [8, 66],
      [5, 44],
      [14, 24],
      [36, 9],
    ],
    2.4,
    0.8,
  );
  pen.line(36, 9, 22, 8, 2.2, 0, 0.3).line(36, 9, 30, 22, 2.2, 0, 0.3);
  return `<svg class="ink ink-arrow" viewBox="0 0 44 72" aria-hidden="true" focusable="false"><path d="${pen.d}"/></svg>`;
}
