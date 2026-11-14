// Vector drawing for the galaxy map: the galaxy texture, the core, planets and the astronaut.
import { GALAXY_R, type Look } from './zones';

type Ctx = CanvasRenderingContext2D;

// deterministic random so the galaxy looks the same on every visit
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function gauss(r: () => number) {
  return (r() + r() + r() + r() - 2) / 2;
}

export const TEX_WORLD = GALAXY_R * 2 + 400; // world units covered by the texture

/** Pre-render the galaxy disc (arms, dust, nebulae, map grid) into an offscreen canvas. */
export function buildGalaxy(size: number, light = false): HTMLCanvasElement {
  // light: the galaxy on the far side of the hole. A glowing white disc, veils of opal colour, and stars of coloured ink.
  // It is its own picture, not an inverted copy of the night one.
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const k = size / TEX_WORLD; // texture px per world unit
  const C = size / 2;
  const R = GALAXY_R * k;
  const rand = rng(7);

  // faint disc haze
  let grd = g.createRadialGradient(C, C, 0, C, C, R * 1.05);
  if (light) {
    grd.addColorStop(0, 'rgba(255,255,255,0.98)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    grd.addColorStop(0.7, 'rgba(255,255,255,0.4)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    grd.addColorStop(0, 'rgba(200,240,250,0.5)');
    grd.addColorStop(0.12, 'rgba(150,210,225,0.2)');
    grd.addColorStop(0.45, 'rgba(120,140,200,0.08)');
    grd.addColorStop(1, 'rgba(60,70,120,0)');
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);

  const ARMS = 4;
  const PITCH = 0.32; // tightness of the logarithmic spiral
  const armAngle = (arm: number, r: number) => (arm / ARMS) * Math.PI * 2 + Math.log(r / 120) / Math.tan(PITCH);

  // nebula clouds along the arms
  g.globalCompositeOperation = light ? 'multiply' : 'lighter';
  if (light) {
    // veils of colour that change slowly along each arm: aqua by the white hole, then violet, then rose at the rim
    const stops = [[104, 196, 240], [150, 140, 250], [196, 140, 246], [250, 150, 204]];
    for (let i = 0; i < 420; i++) {
      const arm = Math.floor(rand() * ARMS);
      const r = 190 + Math.pow(rand(), 0.9) * (GALAXY_R - 230);
      const a = armAngle(arm, r) + gauss(rand) * 0.12;
      const x = C + Math.cos(a) * r * k;
      const y = C + Math.sin(a) * r * k;
      const sz = (30 + rand() * 80) * k;
      const u = Math.min(0.999, Math.max(0, (r - 190) / (GALAXY_R - 230) + (arm - 1.5) * 0.08 + gauss(rand) * 0.09)) * 3;
      const c0 = stops[Math.floor(u)];
      const c1 = stops[Math.floor(u) + 1];
      const m = u - Math.floor(u);
      const hue = c0.map((v, j) => Math.round(v + (c1[j] - v) * m)).join(',');
      grd = g.createRadialGradient(x, y, 0, x, y, sz);
      grd.addColorStop(0, `rgba(${hue},${0.1 + rand() * 0.12})`);
      grd.addColorStop(1, `rgba(${hue},0)`);
      g.fillStyle = grd;
      g.fillRect(x - sz, y - sz, sz * 2, sz * 2);
    }
  }
  for (let i = 0; i < (light ? 0 : 140); i++) {
    const arm = Math.floor(rand() * ARMS);
    const r = 220 + rand() * (GALAXY_R - 260);
    const a = armAngle(arm, r) + gauss(rand) * 0.18;
    const x = C + Math.cos(a) * r * k;
    const y = C + Math.sin(a) * r * k;
    const s = (40 + rand() * 120) * k;
    const pick = rand();
    const hue = pick < 0.3 ? '255,120,150' : pick < 0.65 ? '120,170,255' : '170,140,255';
    grd = g.createRadialGradient(x, y, 0, x, y, s);
    grd.addColorStop(0, `rgba(${hue},${0.07 + rand() * 0.08})`);
    grd.addColorStop(1, `rgba(${hue},0)`);
    g.fillStyle = grd;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }

  // stars: dense in the arms, a sprinkle everywhere, icier toward the core
  if (light) g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 52000; i++) {
    const inArm = rand() < 0.78;
    let r: number;
    let a: number;
    if (inArm) {
      const arm = Math.floor(rand() * ARMS);
      r = 120 + Math.pow(rand(), 0.85) * (GALAXY_R - 120);
      a = armAngle(arm, r) + gauss(rand) * (0.12 + 60 / r);
    } else {
      r = Math.pow(rand(), 0.6) * GALAXY_R;
      a = rand() * Math.PI * 2;
    }
    const x = C + Math.cos(a) * r * k;
    const y = C + Math.sin(a) * r * k;
    const warm = Math.max(0, 1 - r / 700);
    const cr = Math.round(170 + 50 * warm + rand() * 30);
    const cg = Math.round(185 + 65 * warm + rand() * 20);
    const cb = 255;
    const s = (rand() < 0.02 ? 1.8 : rand() < 0.2 ? 1.1 : 0.7) * (light ? 1.5 : 1);
    const al = 0.25 + rand() * 0.6;
    if (light) {
      // ink stars: aqua near the white hole, indigo and violet through the arms, a few sparks of rose and pure white
      const q = rand();
      g.fillStyle =
        q < 0.1
          ? `rgba(255,255,255,${al})`
          : q < 0.17
            ? `rgba(214,84,160,${al * 0.8})`
            : warm > 0.35
              ? `rgba(${50 + Math.round(rand() * 30)},${140 + Math.round(rand() * 40)},204,${al * 0.85})`
              : q < 0.62
                ? `rgba(${50 + Math.round(rand() * 34)},${50 + Math.round(rand() * 30)},${160 + Math.round(rand() * 40)},${al * 0.9})`
                : `rgba(${112 + Math.round(rand() * 30)},${78 + Math.round(rand() * 24)},210,${al * 0.82})`;
    } else g.fillStyle = `rgba(${Math.min(255, cr)},${Math.min(255, cg)},${cb},${al})`;
    g.fillRect(x, y, s, s);
  }

  // dust lanes trail just inside each arm
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 900; i++) {
    const arm = Math.floor(rand() * ARMS);
    const r = 180 + rand() * (GALAXY_R * 0.8);
    const a = armAngle(arm, r) - 0.16 + gauss(rand) * 0.04;
    const x = C + Math.cos(a) * r * k;
    const y = C + Math.sin(a) * r * k;
    const s = (10 + rand() * 26) * k;
    grd = g.createRadialGradient(x, y, 0, x, y, s);
    grd.addColorStop(0, light ? 'rgba(255,255,255,0.2)' : 'rgba(8,6,10,0.16)');
    grd.addColorStop(1, light ? 'rgba(255,255,255,0)' : 'rgba(8,6,10,0)');
    g.fillStyle = grd;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }

  // bright bulge
  g.globalCompositeOperation = light ? 'source-over' : 'lighter';
  grd = g.createRadialGradient(C, C, 0, C, C, 260 * k);
  grd.addColorStop(0, light ? 'rgba(255,255,255,0.95)' : 'rgba(215,248,255,0.85)');
  grd.addColorStop(0.3, light ? 'rgba(255,255,255,0.5)' : 'rgba(150,215,230,0.32)');
  grd.addColorStop(1, light ? 'rgba(255,255,255,0)' : 'rgba(120,190,210,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(C, C, 260 * k, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'source-over';

  if (light) {
    // a scatter of four-point glints through the arms, the brightest things in this sky
    for (let i = 0; i < 110; i++) {
      const arm = Math.floor(rand() * ARMS);
      const r = 200 + rand() * (GALAXY_R - 240);
      const a = armAngle(arm, r) + gauss(rand) * 0.2;
      const x = C + Math.cos(a) * r * k;
      const y = C + Math.sin(a) * r * k;
      const len = (7 + rand() * 15) * k;
      const col = rand() < 0.6 ? '70,60,180' : rand() < 0.5 ? '60,150,206' : '204,90,164';
      const al = 0.5 + rand() * 0.4;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const lg = g.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
        lg.addColorStop(0, `rgba(${col},0)`);
        lg.addColorStop(0.5, `rgba(${col},${al})`);
        lg.addColorStop(1, `rgba(${col},0)`);
        g.strokeStyle = lg;
        g.lineWidth = Math.max(1, 1.1 * k);
        g.beginPath();
        g.moveTo(x - dx * len, y - dy * len);
        g.lineTo(x + dx * len, y + dy * len);
        g.stroke();
      }
      const halo = g.createRadialGradient(x, y, 0, x, y, len * 0.5);
      halo.addColorStop(0, 'rgba(255,255,255,0.95)');
      halo.addColorStop(0.3, `rgba(${col},${al * 0.5})`);
      halo.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = halo;
      g.beginPath();
      g.arc(x, y, len * 0.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  // cartographic grid: rings every 300 units, spokes every 30 degrees
  const ink = light ? '92,80,186' : '232,184,107';
  g.strokeStyle = `rgba(${ink},${light ? 0.12 : 0.07})`;
  g.lineWidth = Math.max(1, size / 2048);
  for (let r = 300; r < GALAXY_R; r += 300) {
    g.beginPath();
    g.arc(C, C, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(C + Math.cos(a) * 150 * k, C + Math.sin(a) * 150 * k);
    g.lineTo(C + Math.cos(a) * R, C + Math.sin(a) * R);
    g.stroke();
  }
  // galaxy boundary with degree ticks
  g.strokeStyle = `rgba(${ink},${light ? 0.45 : 0.35})`;
  g.beginPath();
  g.arc(C, C, R, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 360; i += 5) {
    const a = (i * Math.PI) / 180;
    const len = (i % 30 === 0 ? 22 : 9) * k;
    g.beginPath();
    g.moveTo(C + Math.cos(a) * R, C + Math.sin(a) * R);
    g.lineTo(C + Math.cos(a) * (R + len), C + Math.sin(a) * (R + len));
    g.stroke();
  }
  g.fillStyle = `rgba(${ink},${light ? 0.7 : 0.5})`;
  g.font = `${Math.round(22 * k)}px "IBM Plex Mono", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < 360; i += 30) {
    const a = (i * Math.PI) / 180;
    // screen y points down, so the angle is negated: 90° sits at the top and 270° at the bottom
    g.fillText(`${i}°`, C + Math.cos(a) * (R + 44 * k), C - Math.sin(a) * (R + 44 * k));
  }
  return c;
}

/** World width of the pre-rendered picture of the galaxy's centre. */
export const CORE_WORLD = 820;
/** Radius of the black hole's shadow, in world units. */
export const HOLE_R = 58;
/** How flat the accretion disc looks: it is seen almost edge-on. */
const DISC_TILT = 0.058;
/**
 * The colours of the centre on each side. In the night galaxy it is a black hole lit by white-hot gas.
 * On the other side it is the same shape turned inside out: a white hole drawn in indigo ink that thins to violet and aqua.
 */
const HOLE_INK = {
  dark: { hot: '255,249,238', warm: '255,222,184', far: '214,186,236', fill: '#010203' },
  light: { hot: '46,38,136', warm: '124,96,216', far: '110,188,230', fill: '#ffffff' },
};
/**
 * The hole at the centre, drawn the way gravity really bends light around it (the look the film Interstellar made famous):
 * a round shadow with a thin ring around it, a thin accretion disc crossing in front,
 * and the far side of that disc bent up and over the top, with a fainter copy underneath.
 */
function buildLensedHole(size: number, light: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const k = size / CORE_WORLD;
  const C = size / 2;
  const R = HOLE_R * k;
  const rand = rng(31);
  const { hot, warm, far, fill } = light ? HOLE_INK.light : HOLE_INK.dark;
  const op: GlobalCompositeOperation = light ? 'source-over' : 'lighter';
  g.globalCompositeOperation = op;
  // a soft glow in the gas around it: on the white side the hole bleaches the sky around itself
  let grd = g.createRadialGradient(C, C, R, C, C, R * 6.2);
  if (light) {
    grd.addColorStop(0, 'rgba(255,255,255,0.96)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    grd.addColorStop(0, `rgba(${warm},0.2)`);
    grd.addColorStop(0.3, `rgba(${far},0.07)`);
    grd.addColorStop(1, `rgba(${far},0)`);
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  // the far side of the disc, bent over the top of the hole: thick above, thin below
  const oy = -R * 0.24;
  grd = g.createRadialGradient(C, C, R, C, C + oy, R * 1.62);
  if (light) {
    grd.addColorStop(0, `rgba(${hot},0.92)`);
    grd.addColorStop(0.22, `rgba(${hot},0.66)`);
    grd.addColorStop(0.5, `rgba(${warm},0.42)`);
    grd.addColorStop(0.76, `rgba(${far},0.2)`);
    grd.addColorStop(1, `rgba(${far},0)`);
  } else {
    grd.addColorStop(0, `rgba(${hot},0.95)`);
    grd.addColorStop(0.3, `rgba(${hot},0.72)`);
    grd.addColorStop(0.62, `rgba(${warm},0.4)`);
    grd.addColorStop(0.82, `rgba(${far},0.1)`);
    grd.addColorStop(1, `rgba(${far},0)`);
  }
  g.fillStyle = grd;
  g.beginPath();
  g.arc(C, C + oy, R * 1.62, 0, Math.PI * 2);
  g.fill();
  // fine streaks in it, following the bend
  for (let i = 0; i < 70; i++) {
    const f = rand();
    const r = R * (1.03 + f * 0.6);
    const cy = C + oy * f;
    const a0 = rand() * Math.PI * 2;
    g.strokeStyle = `rgba(${light ? (f > 0.5 ? far : '255,255,255') : hot},${(0.05 + rand() * 0.16) * (1 - f) * (light ? 1.6 : 1)})`;
    g.lineWidth = Math.max(0.6, (0.6 + rand() * 1.2) * k);
    g.beginPath();
    g.arc(C, cy, r, a0, a0 + 0.6 + rand() * 2.4);
    g.stroke();
  }
  // the disc itself, almost edge-on: fine rings, strongest at the inner edge and fading out softly at the rim
  const rings: { r: number; col: string; al: number; lw: number }[] = [];
  for (let i = 0; i < 520; i++) {
    const f = Math.pow(rand(), 1.5); // most of the light is near the inner edge
    const bright = Math.pow(1 - f, 2.1);
    rings.push({
      r: R * (1.2 + f * 3.3),
      col: bright > 0.5 ? hot : bright > 0.16 ? warm : far,
      al: (0.02 + rand() * 0.075) * (0.12 + bright) * Math.min(1, (1 - f) * 3.2),
      lw: ((1.5 + rand() * 7) * k * 0.12) / DISC_TILT,
    });
  }
  const disc = (from: number, to: number) => {
    g.save();
    g.translate(C, C + R * 0.05);
    g.scale(1, DISC_TILT);
    for (const q of rings) {
      g.strokeStyle = `rgba(${q.col},${q.al})`;
      g.lineWidth = q.lw;
      g.beginPath();
      g.arc(0, 0, q.r, from, to);
      g.stroke();
    }
    g.restore();
  };
  disc(Math.PI, Math.PI * 2); // the far half, which the hole will hide where it passes behind
  // the shadow: nothing comes back from the black one, and nothing can enter the white one
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = fill;
  g.beginPath();
  g.arc(C, C, R, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = op;
  // the photon ring: light that has circled the hole
  g.strokeStyle = `rgba(${hot},0.85)`;
  g.lineWidth = Math.max(1, 1.3 * k);
  g.beginPath();
  g.arc(C, C, R * 1.012, 0, Math.PI * 2);
  g.stroke();
  disc(0, Math.PI); // the near half, crossing in front of the shadow
  // the glow along the middle of the disc, strongest where it passes the hole
  for (const [h, a, w] of [[R * 0.3, 0.1, 4.6], [R * 0.11, 0.26, 4.2], [R * 0.04, 0.75, 3.6]] as const) {
    g.save();
    g.translate(C, C + R * 0.1);
    g.scale(1, h / (R * w));
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, R * w);
    rg.addColorStop(0, `rgba(${hot},${a})`);
    rg.addColorStop(0.4, `rgba(${warm},${a * 0.55})`);
    rg.addColorStop(1, `rgba(${light ? far : warm},0)`);
    g.fillStyle = rg;
    g.beginPath();
    g.arc(0, 0, R * w, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  return c;
}
export function buildCore(size: number, light: boolean): HTMLCanvasElement {
  return buildLensedHole(size, light);
}

/** The centre of the galaxy: the pre-rendered hole, plus the gas that is seen moving round it. */
export function drawCore(g: Ctx, t: number, light: boolean, tex: HTMLCanvasElement) {
  const base = g.globalAlpha; // the caller may be fading the whole core in
  // it never turns: the disc stays level, the way the film framed it
  g.drawImage(tex, -CORE_WORLD / 2, -CORE_WORLD / 2, CORE_WORLD, CORE_WORLD);
  const prevOp = g.globalCompositeOperation;
  if (!light) g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  if (light) {
    // a white hole only gives: slow rings of colour leave it and thin out into the sky
    for (let i = 0; i < 3; i++) {
      const f = (t * 0.05 + i / 3) % 1;
      const r = HOLE_R * (1.7 + f * 4.6);
      g.strokeStyle = `rgba(${i === 1 ? '110,188,230' : '150,120,226'},${Math.sin(f * Math.PI) * 0.2 * (1 - f * 0.5)})`;
      g.lineWidth = 1 + f * 2.2;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // gas racing round the disc: quick near the hole, slow at the rim. The part behind the hole is hidden.
  const streak = light ? '72,58,176' : '255,246,230';
  for (let i = 0; i < 44; i++) {
    const f = ((i * 37) % 44) / 44;
    const r = HOLE_R * (1.25 + f * 3.1);
    const a = i * 2.4 + t * 0.9 * Math.pow(1.25 / (1.25 + f * 3.1), 1.5);
    const len = 0.12 + ((i * 13) % 10) / 40;
    const mid = a + len / 2;
    if (Math.sin(mid) < 0 && Math.abs(Math.cos(mid) * r) < HOLE_R) continue;
    g.save();
    g.translate(0, HOLE_R * 0.05);
    g.scale(1, DISC_TILT);
    g.beginPath();
    g.arc(0, 0, r, a, a + len);
    g.restore();
    g.strokeStyle = `rgba(${streak},${(0.16 + 0.4 * (1 - f)) * (Math.sin(mid) > 0 ? 1 : 0.55)})`;
    g.lineWidth = 1.1 + (1 - f) * 1.3;
    g.stroke();
  }
  // and a slow shimmer in the light bent over the top
  for (let i = 0; i < 14; i++) {
    const f = ((i * 5) % 14) / 14;
    const r = HOLE_R * (1.05 + f * 0.5);
    const a = i * 1.7 - t * 0.22 * (1.4 - f);
    g.strokeStyle = `rgba(${light ? '255,255,255' : '255,250,240'},${(0.1 + 0.16 * (1 - f)) * (light ? 1.5 : 1)})`;
    g.lineWidth = 1 + (1 - f);
    g.beginPath();
    g.arc(0, -HOLE_R * 0.24 * f, r, a, a + 0.5 + f * 0.6);
    g.stroke();
  }
  g.lineCap = 'butt';
  g.globalCompositeOperation = prevOp;
  g.globalAlpha = base;
}

/** A planet lit from the galactic core (lightAngle points toward the light). */
export function drawPlanet(g: Ctx, L: Look, lightAngle: number, t: number, hover: number) {
  const r = L.r * (1 + hover * 0.08);
  // atmosphere glow
  let grd = g.createRadialGradient(0, 0, r * 0.9, 0, 0, r * (1.6 + hover * 0.3));
  grd.addColorStop(0, hexA(L.glow, 0.35 + hover * 0.2));
  grd.addColorStop(1, hexA(L.glow, 0));
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, r * 2, 0, Math.PI * 2);
  g.fill();

  if (L.station) return drawStation(g, r, t);

  const ringTilt = 0.32;
  if (L.ring) ring(g, r, ringTilt, Math.PI, Math.PI * 2, L);

  const lx = Math.cos(lightAngle) * r * 0.45;
  const ly = Math.sin(lightAngle) * r * 0.45;
  grd = g.createRadialGradient(lx, ly, r * 0.1, 0, 0, r);
  grd.addColorStop(0, L.light);
  grd.addColorStop(0.45, L.base);
  grd.addColorStop(1, L.dark);
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();

  if (L.bands) {
    g.save();
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.clip();
    for (let i = -4; i <= 4; i++) {
      const y = i * r * 0.22 + Math.sin(t * 0.2 + i) * 2;
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(60,20,0,0.12)';
      g.fillRect(-r, y, r * 2, r * 0.11);
    }
    g.restore();
  }
  // night side
  grd = g.createLinearGradient(lx * 2, ly * 2, -lx * 2.2, -ly * 2.2);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.55, 'rgba(0,0,8,0.15)');
  grd.addColorStop(1, 'rgba(0,0,8,0.7)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();

  if (L.ring) ring(g, r, ringTilt, 0, Math.PI, L);
  if (L.moon) {
    const a = t * 0.35;
    const mx = Math.cos(a) * r * 1.7;
    const my = Math.sin(a) * r * 0.6;
    g.fillStyle = '#d7d3cc';
    g.beginPath();
    g.arc(mx, my, Math.max(4, r * 0.13), 0, Math.PI * 2);
    g.fill();
  }
}

function ring(g: Ctx, r: number, tilt: number, a0: number, a1: number, L: Look) {
  g.strokeStyle = hexA(L.light, 0.55);
  g.lineWidth = r * 0.12;
  g.beginPath();
  g.ellipse(0, 0, r * 1.7, r * 1.7 * tilt, -0.35, a0, a1);
  g.stroke();
  g.strokeStyle = hexA(L.base, 0.4);
  g.lineWidth = r * 0.05;
  g.beginPath();
  g.ellipse(0, 0, r * 1.95, r * 1.95 * tilt, -0.35, a0, a1);
  g.stroke();
}

function drawStation(g: Ctx, r: number, t: number) {
  g.save();
  g.rotate(t * 0.15);
  g.strokeStyle = '#d9dce6';
  g.lineWidth = r * 0.22;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = r * 0.1;
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 2);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(r, 0);
    g.stroke();
  }
  // solar panels
  g.fillStyle = '#2b4a8a';
  g.fillRect(r * 1.15, -r * 0.25, r * 0.8, r * 0.5);
  g.fillRect(-r * 1.95, -r * 0.25, r * 0.8, r * 0.5);
  g.restore();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  g.fill();
  if (Math.sin(t * 3) > 0) {
    g.fillStyle = '#e8b86b';
    g.beginPath();
    g.arc(0, 0, r * 0.14, 0, Math.PI * 2);
    g.fill();
  }
}

// ---- The astronaut: a 24 x 26 pixel sprite, drawn in whole device pixels so every pixel stays square ----
const SPR_W = 24;
const SPR_H = 26;
const INK: Record<string, string> = {
  K: '#141a2b', // outline, a navy taken from the sky rather than pure black
  F: '#ffffff',
  W: '#f3f1ea',
  L: '#c9ccd6',
  G: '#8d93a6',
  D: '#555b70',
  V: '#0b1220', // visor
  B: '#1f3a5c', // nebula reflected in the visor
  C: '#9fe3ee',
  Y: '#e8b86b', // the black hole's ring, reflected
  O: '#d9793b',
  R: '#2c6f66', // status light, off
};
const BODY = [
  '.........KKKKKKKK.......',
  '.......KKFFWWWWWWKK.....',
  '......KWFWWWWWWWWWLK....',
  '.....KWWWLKKKKKKKKLLK...',
  '.....KWWLKVVVVVVCCKLK...',
  '....KLWWKVVVVVVVVCCVK...',
  '....KLWWKVBVVVYYVVCVK...',
  '....KLWWKVBBVYVVYVVVK...',
  '....KLLWKVVBBVYYVVVVK...',
  '....KGLWLKVVBBBVVVVK....',
  '.....KGLLWKKKKKKKKK.....',
  '..KKKKKGGLLLLLLLGK......',
  '..KDDGKKDDDDDDDDK.......',
  '..KDYGKWWWWWWWLLGK......',
  '..KGGLKWWLOOLWWKKKKK....',
  '..KGGLKWWLDRLWKOWLLDK...',
  '.KKGGLKLWWLLLWKLLLGDK...',
  '.KDDGGKLLWWWWWLKKKKK....',
  '.KKDDGKGLLWWWLLGK.......',
  '...KKKKDDDDDDDDDK.......',
  '......KWWLGKWWLGK.......',
  '.....KWWLGKKWWLGK.......',
  '.....KWLLGK.KWLLGK......',
  '....KDDDDK..KDDDDK......',
  '....KGGGDK..KGGGGDK.....',
  '....KKKKKK..KKKKKKK.....',
];
// the arm drifts down one pixel on the second idle frame
const ARM_LOW: Record<number, string> = {
  14: '..KGGLKWWLOOLWWWK.......',
  15: '..KGGLKWWLDRLWKKKKKK....',
  16: '.KKGGLKLWWLLLWKOWLLDK...',
  17: '.KDDGGKLLWWWWWKLLLGDK...',
  18: '.KKDDGKGLLWWWLLKKKKK....',
};
// legs swept back while flying
const LEGS_BACK: Record<number, string> = {
  20: '.....KWWLGKWWLGK........',
  21: '....KWWLGKKWWLGK........',
  22: '...KWLLGK.KWLLGK........',
  23: '..KDDDDK.KDDDDK.........',
  24: '..KGGGDK.KGGGDK.........',
  25: '..KKKKKK.KKKKKK.........',
};
interface Frame {
  img: HTMLCanvasElement;
  visor: [number, number][];
  lamp: [number, number];
}
let frames: Frame[] | null = null;

function buildFrame(over: Record<number, string>, lean: boolean): Frame {
  const rows = BODY.map((r, i) => over[i] ?? r);
  // leaning into the flight: the helmet moves one pixel ahead of the body
  if (lean) for (let i = 0; i < 11; i++) rows[i] = '.' + rows[i].slice(0, -1);
  const img = document.createElement('canvas');
  img.width = SPR_W;
  img.height = SPR_H;
  const c = img.getContext('2d')!;
  const visor: [number, number][] = [];
  let lamp: [number, number] = [0, 0];
  rows.forEach((row, y) => {
    for (let x = 0; x < SPR_W; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      c.fillStyle = INK[ch];
      c.fillRect(x, y, 1, 1);
      if (y < 10 && (ch === 'V' || ch === 'B' || ch === 'Y')) visor.push([x, y]);
      if (ch === 'R') lamp = [x, y];
    }
  });
  return { img, visor, lamp };
}

/** Where the sprite is held (its chest) and where the jetpack nozzle sits, in sprite pixels. */
export const ASTRO = { ax: 11, ay: 15, nozzleX: 0, nozzleY: 17, h: SPR_H };

/**
 * Draws the astronaut in device pixels. (x, y) is the chest, px is the whole number of device pixels per sprite pixel.
 * Call with an identity transform.
 */
export function drawAstronaut(g: Ctx, x: number, y: number, px: number, t: number, face: number, thrust: number, calm: boolean) {
  frames ??= [buildFrame({}, false), buildFrame(ARM_LOW, false), buildFrame(LEGS_BACK, true)];
  const f = thrust > 0.35 ? frames[2] : frames[calm ? 0 : Math.floor(t * 1.4) % 2];
  const dot = (sx: number, sy: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(sx * px, sy * px, px, px);
  };
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.scale(face < 0 ? -1 : 1, 1);
  g.translate(-ASTRO.ax * px, -ASTRO.ay * px);
  g.imageSmoothingEnabled = false;

  // nozzle flame: white-hot at the pack, cooling to blue
  if (thrust > 0.15) {
    const tick = Math.floor(t * 18) % 3;
    dot(ASTRO.nozzleX, ASTRO.nozzleY, '#ffffff');
    dot(ASTRO.nozzleX - 1, ASTRO.nozzleY, tick ? '#c9f4ff' : '#ffffff');
    if (thrust > 0.5) {
      dot(ASTRO.nozzleX, ASTRO.nozzleY + (tick === 1 ? -1 : 1), '#7fdcf5');
      dot(ASTRO.nozzleX - 2, ASTRO.nozzleY, tick === 2 ? '#7fdcf5' : '#3fa0e8');
    }
  }

  g.drawImage(f.img, 0, 0, SPR_W * px, SPR_H * px);

  // status light blinks on the chest unit
  if (calm || t % 1.6 < 0.5) dot(f.lamp[0], f.lamp[1], '#7ff0d0');
  // now and then a glint crosses the visor
  if (!calm) {
    const u = (t % 5.5) / 0.55;
    if (u < 1) {
      const d = Math.round(12 + u * 18);
      for (const [vx, vy] of f.visor) {
        const k = vx + vy;
        if (k === d) dot(vx, vy, 'rgba(235,250,255,0.9)');
        else if (k === d - 1) dot(vx, vy, 'rgba(159,227,238,0.45)');
      }
    }
  }
  g.restore();
}

// ---- Indoors (the museum): the same astronaut on foot, with the helmet on or off ----
Object.assign(INK, {
  H: '#241d1b', // hair
  J: '#4a3c36', // light catching the hair
  S: '#e6bf9a', // skin
  T: '#c79670', // skin in shade
});
// rows 0 to 10 with the helmet lifted away: a head, and the suit's open neck ring
const HEAD: Record<number, string> = {
  0: '........................',
  1: '.........KKKKK..........',
  2: '.......KKHHHHHKK........',
  3: '......KHHJJHHHHHK.......',
  4: '......KHHHHHHHHHK.......',
  5: '......KHHHHSSSSSK.......',
  6: '......KHHSSSSKSSK.......',
  7: '......KHSSSSSSSSSK......',
  8: '.......KSSSSSSTSK.......',
  9: '.......KTSSSSSSK........',
  10: '......KLLKTTSSKLLK......',
};
// two steps of a walk: legs apart, then passing with the back foot lifted
const WALK_A: Record<number, string> = {
  20: '......KWWLGKWWLGK.......',
  21: '.....KWWLGK.KWWLGK......',
  22: '....KWLLGK...KWLLGK.....',
  23: '...KDDDDK....KDDDDK.....',
  24: '...KGGGDK....KGGGGDK....',
  25: '...KKKKKK....KKKKKKK....',
};
const WALK_B: Record<number, string> = {
  20: '......KWWLGKWWLGK.......',
  21: '......KWWLGKWWLGK.......',
  22: '......KWLLGKKWLLGK......',
  23: '.....KDDDDK.KDDDDK......',
  24: '.....KKKKKK.KGGGGDK.....',
  25: '............KKKKKKK.....',
};
let walkers: { on: Frame[]; off: Frame[] } | null = null;
let helmet: HTMLCanvasElement | null = null;

/** How tall the sprite and its helmet are, in sprite pixels. */
export const VISITOR = { h: SPR_H, helmetH: 11 };

/**
 * The astronaut on foot, in device pixels with an identity transform. (x, y) is the floor between the feet.
 * `step` counts steps while walking (null when standing still).
 */
export function drawVisitor(g: Ctx, x: number, y: number, px: number, t: number, face: number, o: { helmet: boolean; step: number | null; calm: boolean }) {
  walkers ??= {
    on: [{}, ARM_LOW, WALK_A, WALK_B].map((r) => buildFrame(r, false)),
    off: [{}, ARM_LOW, WALK_A, WALK_B].map((r) => buildFrame({ ...HEAD, ...r }, false)),
  };
  const set = o.helmet ? walkers.on : walkers.off;
  const stride = o.step === null ? -1 : Math.floor(o.step) % 2;
  const f = stride < 0 ? set[o.calm ? 0 : Math.floor(t * 1.4) % 2] : set[2 + stride];
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.scale(face < 0 ? -1 : 1, 1);
  // the body rises a pixel as the legs pass
  g.translate(-ASTRO.ax * px, -(SPR_H + (stride === 1 ? 1 : 0)) * px);
  g.imageSmoothingEnabled = false;
  g.drawImage(f.img, 0, 0, SPR_W * px, SPR_H * px);
  if (o.calm || t % 1.6 < 0.5) {
    g.fillStyle = '#7ff0d0';
    g.fillRect(f.lamp[0] * px, f.lamp[1] * px, px, px);
  }
  g.restore();
}

/** The helmet on its own, in device pixels. (x, y) is the middle of its base. */
export function drawHelmet(g: Ctx, x: number, y: number, px: number) {
  if (!helmet) {
    helmet = document.createElement('canvas');
    helmet.width = SPR_W;
    helmet.height = VISITOR.helmetH;
    const c = helmet.getContext('2d')!;
    BODY.slice(0, VISITOR.helmetH).forEach((row, ry) => {
      for (let rx = 0; rx < SPR_W; rx++) {
        if (row[rx] === '.') continue;
        c.fillStyle = INK[row[rx]];
        c.fillRect(rx, ry, 1, 1);
      }
    });
  }
  g.save();
  g.imageSmoothingEnabled = false;
  g.drawImage(helmet, Math.round(x) - 12 * px, Math.round(y) - VISITOR.helmetH * px, SPR_W * px, VISITOR.helmetH * px);
  g.restore();
}

export function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
