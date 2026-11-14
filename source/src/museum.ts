// The Projects planet: a museum. Each project hangs in its own frame with a label beside it, over a chevron oak floor.
// Walking, doors and the panel of links under the hall come from room.ts.
import { resume } from './data';
import { PIECES } from './gallery';
import { clamp, esc, hash, type Scene, type SceneFactory, type Stop } from './room';

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

// Every picture gets its own frame. `rim` and `mat` are fractions of the frame's outer width.
type FrameKind = 'black' | 'gilt' | 'steel' | 'walnut' | 'oak';
const FRAMES: { kind: FrameKind; rim: number; mat: number; scale: number }[] = [
  { kind: 'black', rim: 0.016, mat: 0.055, scale: 1 }, // thin black gallery frame, wide white mat
  { kind: 'gilt', rim: 0.058, mat: 0, scale: 0.95 }, // stepped antique gold moulding
  { kind: 'steel', rim: 0.014, mat: 0.03, scale: 0.97 }, // slim brushed steel around a black mat
  { kind: 'walnut', rim: 0.038, mat: 0, scale: 1 }, // dark walnut with a brass fillet
  { kind: 'oak', rim: 0.024, mat: 0.04, scale: 0.9 }, // pale oak with a linen mat
];

export const museumScene: SceneFactory = (env) => {
  const { g, light, DISPLAY, MONO } = env;
  const C = light
    ? {
        wall: '#f1ece3', wallLow: '#e7e0d4', trim: '#fbf8f2', line: 'rgba(60,50,80,0.2)', faint: 'rgba(60,50,80,0.1)',
        text: '#77737f', strong: '#2a2833', cone: '255,253,246', wash: 0.5, shadow: 'rgba(80,60,50,0.32)',
        wood: [33, 42, 66], seam: 'rgba(120,82,44,0.42)', dusk: 0.16, leather: '#5a473a', leatherFront: '#3f3028', leg: '#2b2420',
        plaque: '#ffffff', ink: '#23222a', inkDim: '#77737f', plinth: '#ffffff', plinthTop: '#f6f2ea', door: '#e2dbcf',
        doorLine: 'rgba(60,50,80,0.28)', mat: '#ffffff',
      }
    : {
        wall: '#191d29', wallLow: '#11141d', trim: '#252a39', line: 'rgba(232,226,210,0.2)', faint: 'rgba(232,226,210,0.085)',
        text: '#9a9fb2', strong: '#ece7dd', cone: '255,236,205', wash: 0.2, shadow: 'rgba(0,0,0,0.6)',
        wood: [26, 40, 25], seam: 'rgba(18,9,4,0.6)', dusk: 0.42, leather: '#3b302b', leatherFront: '#231c19', leg: '#15110f',
        plaque: '#efeadf', ink: '#23222a', inkDim: '#6d6a70', plinth: '#d9d4c9', plinthTop: '#ebe6dc', door: '#202533',
        doorLine: 'rgba(232,226,210,0.26)', mat: '#f1ede4',
      };

  const pieces = PIECES.map((p, idx) => {
    const i = resume.projects.findIndex((x) => x.name === p.project);
    const pr = resume.projects[i];
    const img = new Image();
    img.src = p.pic;
    return { pr, img, credit: p.credit, acc: env.css(`--p${i}`) || '#e8b86b', year: pr.dates.slice(-4), medium: pr.stack.slice(0, 3).join(', '), frame: FRAMES[idx % FRAMES.length] };
  });
  const n = pieces.length;
  const years = [...new Set(pieces.map((p) => p.year))].sort();
  const stops: Stop[] = pieces.map((p) => ({ title: p.pr.name, meta: p.year, body: esc(p.pr.tagline) + (p.credit ? ` <span class="mu-credit mono">${esc(p.credit)}</span>` : ''), links: p.pr.links, accent: p.acc, room: p.pr.name, w: 0, h: 0 }));

  let u = 1;
  let slitTop = 0;
  let slitH = 0;
  let railY = 0;
  let plaqueW = 0;
  let floor: CanvasPattern | null = null;

  const buildFloor = () => {
    // chevron oak, seen at a slant: columns of boards that meet point to point
    const { dpr, vh, floorY } = env;
    const cw = Math.max(18, Math.round(9 * u));
    const ph = Math.max(5, Math.round(2.1 * u));
    const rise = ph * 2;
    const cols = 8;
    const H = Math.ceil(vh - floorY) + 4;
    const tile = document.createElement('canvas');
    tile.width = cols * cw * dpr;
    tile.height = H * dpr;
    const c = tile.getContext('2d')!;
    c.scale(dpr, dpr);
    const [h, s, l] = C.wood;
    for (let col = 0; col < cols; col++) {
      const x0 = col * cw;
      const dir = col % 2 ? 1 : -1;
      c.save();
      c.beginPath();
      c.rect(x0, 0, cw, H);
      c.clip();
      for (let i = -3; i < H / ph + 3; i++) {
        const yl = i * ph;
        const yr = yl + dir * rise;
        const tone = hash(col, i);
        c.fillStyle = `hsl(${h + (tone - 0.5) * 6} ${s + (hash(i, col) - 0.5) * 10}% ${l + (tone - 0.5) * 9}%)`;
        c.beginPath();
        c.moveTo(x0, yl);
        c.lineTo(x0 + cw, yr);
        c.lineTo(x0 + cw, yr + ph + 0.5);
        c.lineTo(x0, yl + ph + 0.5);
        c.closePath();
        c.fill();
        c.strokeStyle = C.seam;
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(x0, yl);
        c.lineTo(x0 + cw, yr);
        c.stroke();
      }
      c.restore();
      c.strokeStyle = C.seam;
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(x0 + 0.5, 0);
      c.lineTo(x0 + 0.5, H);
      c.stroke();
    }
    floor = g.createPattern(tile, 'repeat');
    floor?.setTransform(new DOMMatrix().scale(1 / dpr));
  };

  const drawFrame = (i: number, cx: number) => {
    const p = pieces[i];
    const { w: ow, h: oh } = stops[i];
    const l = cx - ow / 2;
    const t = env.cy - oh / 2;
    const rim = p.frame.rim * ow;
    g.save();
    g.shadowColor = C.shadow;
    g.shadowBlur = 22;
    g.shadowOffsetY = 12 * env.dpr;
    g.fillStyle = '#000';
    g.fillRect(l, t, ow, oh);
    g.restore();
    let r: [number, number, number, number] = [l, t, ow, oh];
    switch (p.frame.kind) {
      case 'black':
        r = env.moulding(...r, rim, '#3a3a40', '#1c1c20', '#0c0c0e');
        break;
      case 'gilt':
        // a stepped profile: broad outer face, a shaded cove, then a bright bead next to the picture
        r = env.moulding(...r, rim * 0.5, '#e3c98a', '#b8934c', '#8a6a30');
        r = env.moulding(...r, rim * 0.32, '#7d5f2c', '#93723a', '#c8a660');
        r = env.moulding(...r, rim * 0.18, '#f0dba4', '#d2b06a', '#a88440');
        break;
      case 'steel':
        r = env.moulding(...r, rim, '#e1e5eb', '#aab0bb', '#7a808c');
        break;
      case 'walnut':
        r = env.moulding(...r, rim * 0.86, '#75503a', '#553726', '#33201a');
        r = env.moulding(...r, rim * 0.14, '#e0c07c', '#c2a05c', '#96783c');
        break;
      case 'oak':
        r = env.moulding(...r, rim, '#e2c597', '#c9a877', '#a5825a');
        break;
    }
    const mat = p.frame.mat * ow;
    const k = env.k;
    if (mat > 0) {
      g.fillStyle = p.frame.kind === 'oak' ? (light ? '#f4f0e7' : '#e6e0d3') : p.frame.kind === 'steel' ? '#0d0f14' : C.mat;
      g.fillRect(...r);
      // the bevel cut into the mat catches a little shade
      g.strokeStyle = 'rgba(40,30,20,0.28)';
      g.lineWidth = 1 / k;
      g.strokeRect(r[0] + mat - 1.5 / k, r[1] + mat - 1.5 / k, r[2] - mat * 2 + 3 / k, r[3] - mat * 2 + 3 / k);
      r = [r[0] + mat, r[1] + mat, r[2] - mat * 2, r[3] - mat * 2];
    }
    if (p.img.complete && p.img.naturalWidth) {
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(p.img, ...r);
    } else {
      g.fillStyle = C.wallLow;
      g.fillRect(...r);
    }
    // the rebate throws a thin shadow on the picture's top and left edges
    g.strokeStyle = 'rgba(0,0,0,0.38)';
    g.lineWidth = 1 / k;
    g.strokeRect(r[0], r[1], r[2], r[3]);
  };

  const drawPlaque = (i: number, cx: number, glow: number, e: number) => {
    // the little card museums put beside a painting: title, year, what it is made of
    const p = pieces[i];
    const { w: ow, h: oh } = stops[i];
    const padIn = clamp(1.5 * u, 4, 8);
    const nameF = clamp(2.3 * u, 7.5, 11.5);
    const metaF = clamp(1.7 * u, 6.5, 8.5);
    const inner = plaqueW - padIn * 2;
    g.font = `600 ${nameF}px ${DISPLAY}`;
    const name = env.wrap(p.pr.name, inner);
    g.font = `400 ${metaF}px ${MONO}`;
    const medium = plaqueW >= 84 ? env.wrap(p.medium, inner).slice(0, 3) : [];
    const lh = nameF * 1.18;
    const mh = metaF * 1.45;
    const h = padIn * 2 + name.length * lh + mh * (1 + medium.length) + (medium.length ? metaF * 0.5 : 0);
    const l = cx + ow / 2 + 3.5 * u;
    const t = env.cy + oh / 2 - h - 0.5 * u;
    g.save();
    g.globalAlpha = 1 - e * 0.25;
    g.shadowColor = C.shadow;
    g.shadowBlur = 6;
    g.shadowOffsetY = 2 * env.dpr;
    g.fillStyle = C.plaque;
    g.fillRect(l, t, plaqueW, h);
    g.restore();
    g.textAlign = 'left';
    g.textBaseline = 'top';
    let y = t + padIn;
    g.fillStyle = C.ink;
    g.font = `600 ${nameF}px ${DISPLAY}`;
    for (const line of name) {
      g.fillText(line, l + padIn, y);
      y += lh;
    }
    g.fillStyle = C.inkDim;
    g.font = `400 ${metaF}px ${MONO}`;
    g.fillText(p.year, l + padIn, y + metaF * 0.15);
    y += mh + (medium.length ? metaF * 0.5 : 0);
    for (const line of medium) {
      g.fillText(line, l + padIn, y);
      y += mh;
    }
    // the picture you are standing at: a thread of its colour down the card's edge
    if (glow > 0.02) {
      g.globalAlpha = glow;
      g.fillStyle = p.acc;
      g.fillRect(l, t, Math.max(1.5, 0.35 * u), h);
      g.globalAlpha = 1;
    }
  };

  // benches stand between the pictures, out on the floor
  const benchAt = () => pieces.slice(0, -1).flatMap((_, i) => (i % 2 === 0 ? [(env.at(i) + stops[i].w / 2 + plaqueW + env.at(i + 1) - stops[i + 1].w / 2) / 2] : []));
  const benchY = () => env.feet(0.66);
  const drawBench = (bx: number) => {
    const w = 30 * u;
    const by = benchY();
    const legH = 4 * u;
    const thick = 1.7 * u;
    const deep = 5 * u;
    const l = bx - w / 2;
    g.fillStyle = C.shadow;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.ellipse(bx, by + 0.4 * u, w * 0.52, 1.5 * u, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = C.leg;
    g.fillRect(l + 2 * u, by - legH, 1.1 * u, legH);
    g.fillRect(l + w - 3.1 * u, by - legH, 1.1 * u, legH);
    g.fillStyle = C.leather;
    g.fillRect(l, by - legH - thick - deep, w, deep);
    g.fillStyle = C.leatherFront;
    g.fillRect(l, by - legH - thick, w, thick);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(l, by - legH - thick + 0.5);
    g.lineTo(l + w, by - legH - thick + 0.5);
    g.moveTo(bx + 0.5, by - legH - thick - deep);
    g.lineTo(bx + 0.5, by - legH - thick);
    g.stroke();
  };

  const scene: Scene = {
    noun: 'Picture',
    aria: `A museum hall with a wooden floor and ${n} framed pictures, one for each project.`,
    intro: { kicker: resume.name, title: `${WORDS[n] ?? n} projects`, sub: years.length > 1 ? `${years[0]} to ${years[years.length - 1]}` : years[0] },
    helmetOff: true,
    ink: { base: C.wall, text: C.text, strong: C.strong, line: C.line, shadow: C.shadow, trim: C.trim, door: C.door, doorLine: C.doorLine, plinth: C.plinth, plinthTop: C.plinthTop },
    stops,
    layout() {
      u = env.u;
      slitTop = 4 * u;
      slitH = 8.5 * u;
      railY = 15.5 * u;
      const ow = Math.min(56 * u, env.vw * 0.5);
      plaqueW = clamp(22 * u, 64, 112);
      stops.forEach((s, i) => {
        const f = pieces[i].frame;
        s.w = ow * f.scale;
        const t = (f.rim + f.mat) * s.w;
        s.h = (s.w - t * 2) / 1.6 + t * 2;
        s.after = 3.5 * u + plaqueW;
      });
      buildFloor();
    },
    wall(x0, x1, t) {
      const { floorY, vh, wallText } = env;
      const wg = g.createLinearGradient(0, 0, 0, floorY);
      wg.addColorStop(0, C.wall);
      wg.addColorStop(1, C.wallLow);
      g.fillStyle = wg;
      g.fillRect(x0, -vh, x1 - x0, floorY + vh);

      env.sky(x0, x1, slitTop, slitH, t);
      // thin mullions, and a deep sill so the window reads as a slot cut through a thick wall
      g.fillStyle = C.trim;
      const every = 46 * u;
      for (let m = Math.floor(x0 / every) * every; m < x1; m += every) g.fillRect(m, slitTop, 0.7 * u, slitH);
      g.fillRect(x0, slitTop + slitH, x1 - x0, 1.1 * u);
      g.fillRect(x0, slitTop - 0.6 * u, x1 - x0, 0.6 * u);
      g.strokeStyle = C.line;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0, slitTop + slitH + 1.1 * u + 0.5);
      g.lineTo(x1, slitTop + slitH + 1.1 * u + 0.5);
      // the picture rail
      g.moveTo(x0, railY + 0.5);
      g.lineTo(x1, railY + 0.5);
      g.moveTo(x0, railY + 0.9 * u + 0.5);
      g.lineTo(x1, railY + 0.9 * u + 0.5);
      g.stroke();

      // panel mouldings, one bay to a picture
      g.strokeStyle = C.faint;
      const bayTop = railY + 3 * u;
      const bayH = floorY - 6.5 * u - bayTop;
      const bay = (l: number, w: number) => {
        if (l > x1 || l + w < x0 || w < 8 * u) return;
        g.strokeRect(l + 0.5, bayTop + 0.5, w, bayH);
        g.strokeRect(l + 0.9 * u + 0.5, bayTop + 0.9 * u + 0.5, w - 1.8 * u, bayH - 1.8 * u);
      };
      const edge = 5 * u;
      const first = env.at(0) - stops[0].w / 2 - edge;
      bay(wallText.x - 6 * u, first - 3 * u - (wallText.x - 6 * u));
      stops.forEach((s, i) => bay(env.at(i) - s.w / 2 - edge, s.w + (s.after ?? 0) + edge * 2));

      // skirting board
      g.fillStyle = C.trim;
      g.fillRect(x0, floorY - 2.4 * u, x1 - x0, 2.4 * u);
      g.strokeStyle = C.line;
      g.beginPath();
      g.moveTo(x0, floorY - 2.4 * u + 0.5);
      g.lineTo(x1, floorY - 2.4 * u + 0.5);
      g.stroke();
    },
    floor(x0, x1) {
      const { floorY, vh } = env;
      const H = vh - floorY + 60;
      g.save();
      g.translate(0, floorY);
      g.fillStyle = floor ?? '#5b3f29';
      g.fillRect(x0, 0, x1 - x0, H);
      g.restore();
      // light from each lamp pooling on the boards
      stops.forEach((s, i) => {
        const px = env.at(i);
        if (px + s.w < x0 || px - s.w > x1) return;
        g.save();
        g.translate(px, floorY + 10 * u);
        g.scale(1, (9 * u) / (s.w * 0.6));
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, s.w * 0.6);
        gr.addColorStop(0, `rgba(${C.cone},${(0.07 + 0.12 * env.glow[i]).toFixed(3)})`);
        gr.addColorStop(1, `rgba(${C.cone},0)`);
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, s.w * 0.6, 0, Math.PI * 2);
        g.fill();
        g.restore();
      });
      // the floor falls into shade under the wall and again at your feet
      const sh = g.createLinearGradient(0, floorY, 0, vh);
      sh.addColorStop(0, `rgba(0,0,0,${C.dusk})`);
      sh.addColorStop(0.16, 'rgba(0,0,0,0)');
      sh.addColorStop(0.7, 'rgba(0,0,0,0)');
      sh.addColorStop(1, `rgba(0,0,0,${C.dusk * 0.6})`);
      g.fillStyle = sh;
      g.fillRect(x0, floorY, x1 - x0, H);
    },
    stop(i, cx, glow, e) {
      const { w: ow, h: oh } = stops[i];
      const top = env.cy - oh / 2;
      // a lamp on the rail and its light washing down the wall
      g.save();
      g.translate(cx, top + oh * 0.3);
      g.scale(1, 1.05);
      const wash = g.createRadialGradient(0, 0, ow * 0.2, 0, 0, ow * 0.86);
      wash.addColorStop(0, `rgba(${C.cone},${(C.wash * (0.45 + 0.55 * glow)).toFixed(3)})`);
      wash.addColorStop(1, `rgba(${C.cone},0)`);
      g.fillStyle = wash;
      g.fillRect(-ow, -ow, ow * 2, ow * 2);
      g.restore();
      g.fillStyle = C.text;
      g.fillRect(cx - 1.4 * u, railY + 0.9 * u, 2.8 * u, 1.1 * u);
      // hanging wires from the rail
      g.strokeStyle = C.line;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx - ow * 0.32, top);
      g.lineTo(cx - ow * 0.32, railY + 0.9 * u);
      g.moveTo(cx + ow * 0.32, top);
      g.lineTo(cx + ow * 0.32, railY + 0.9 * u);
      g.stroke();
      drawFrame(i, cx);
      drawPlaque(i, cx, glow, e);
    },
    props(x0, x1, front, fy) {
      // a bench is drawn before the astronaut when he stands nearer to you than it, and after when he is behind it
      if (front !== fy < benchY()) return;
      benchAt()
        .filter((bx) => bx + 20 * u > x0 && bx - 20 * u < x1)
        .forEach(drawBench);
    },
  };
  return scene;
};
