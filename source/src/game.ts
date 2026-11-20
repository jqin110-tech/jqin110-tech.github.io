import { ASTRO, buildCore, buildGalaxy, CORE_WORLD, drawAstronaut, drawCore, drawPlanet, HOLE_R, TEX_WORLD } from './draw';
import { GALAXY_R, PHI, SPIRAL_SPAN, spiral, zones, type Zone } from './zones';

const DT = 1 / 60;
const PIXEL_BUDGET = 3.2e6; // canvas pixels, whatever the screen
const CALM_FRAME = 1000 / 30; // ms between frames while nothing but the ambient drift is moving
const BUSY_FRAME = 1000 / 60; // and while flying, zooming or reacting to the pointer
const MAX_SPEED = 360;
const PULL_R = 260; // gravity starts tugging here
const HORIZON_R = 44; // cross this and you change dimension
const FLIP_TIME = 1.4;
const BANG_TIME = 9; // seconds from the first click to a galaxy you can fly in (4.5 in v46 to v57); a click fast-forwards it
const BANG_SKIP = 6;
const CHARGE = 1.0; // seconds of build-up before the blast: the sky is pulled into the point // how much faster the opening runs once someone clicks to skip ahead
const PLANETS_AT = 0.55; // fraction of the opening that passes before the planet seeds start to grow
const SEED = 0.07; // how big a planet's seed is before it grows, as a share of the finished planet
const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
/** The opening follows the real order of events; each caption shows from its start until the next one. */
const EPOCHS: [number, string, string][] = [
  [0, 't = 10⁻³² s', 'inflation'],
  [0.05, 't = 380,000 yr', 'first light'],
  [0.3, 't = 10 million yr', 'dark ages'],
  [0.38, 't = 200 million yr', 'first stars'],
  [0.5, 't = 1 billion yr', 'galaxies form'],
  [0.68, 't = 9.2 billion yr', 'planets form'],
  [0.95, 't = 13.8 billion yr', 'now'],
];
/** Blackbody-ish cooling from white-hot to a dull red: u = 0 is hottest. */
const COOL: [number, number, number][] = [
  [255, 253, 248],
  [255, 236, 224],
  [255, 192, 196],
  [206, 132, 190],
  [124, 104, 214],
];
const COOL_LIGHT: [number, number, number][] = [
  [255, 255, 255],
  [255, 236, 224],
  [248, 204, 214],
  [226, 184, 226],
  [196, 180, 236],
];
const cool = (u: number, light: boolean) => {
  const stops = light ? COOL_LIGHT : COOL;
  const x = Math.min(0.9999, Math.max(0, u)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  return `${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)}`;
};
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/**
 * How the seeds circle during the opening. Speed builds as they leave the fireball, holds while they
 * orbit as seeds, and falls away as the planets form. `done` is the share of the lap finished (0 to 1).
 */
const ORBIT_STEPS = 240;
const orbitSpeed = (k: number) => smooth(0.03, 0.15, k) * (1 - smooth(0.46, 0.96, k));
const ORBIT_SUM: number[] = (() => {
  const acc = [0];
  for (let i = 1; i <= ORBIT_STEPS; i++) acc.push(acc[i - 1] + orbitSpeed((i - 0.5) / ORBIT_STEPS) / ORBIT_STEPS);
  return acc;
})();
const orbit = (k: number) => {
  const x = Math.min(1, Math.max(0, k)) * ORBIT_STEPS;
  const i = Math.min(ORBIT_STEPS - 1, Math.floor(x));
  const total = ORBIT_SUM[ORBIT_STEPS];
  return { done: (ORBIT_SUM[i] + (ORBIT_SUM[i + 1] - ORBIT_SUM[i]) * (x - i)) / total, speed: orbitSpeed(k) / total };
};
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export interface GameEvents {
  onNear(zone: Zone | null): void;
  onEnter(zone: Zone): void;
  onNotice(msg: string): void;
  onDimension(light: boolean): void;
  onReady(): void;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private W = 800; // css px
  private H = 600;
  private galaxy: HTMLCanvasElement;
  private galaxyLight: HTMLCanvasElement | null = null;
  private siteLight = false; // which side of the hole we are on; the rest of the site (rooms, resume) follows it
  private opalSky: HTMLCanvasElement | null = null;
  /** True on the far side of the hole, where the galaxy is drawn as a white dimension. */
  private get light() {
    return this.siteLight;
  }
  private coreTex: HTMLCanvasElement;
  private coreTexLight: HTMLCanvasElement | null = null;
  private coreSize: number;
  // void: empty space behind the title · bang: the galaxy forms · live: playable
  private phase: 'void' | 'bang' | 'live' = 'void';
  private bangT = 0;
  private bangRate = 1;
  private coarse = matchMedia('(pointer: coarse)').matches;
  private tapFrom: { x: number; y: number } | null = null; // where a touch began, until it lifts
  private stick = { x: 0, y: 0 }; // the on-screen joystick on phones, each axis -1 to 1
  private flip: { t: number; switched: boolean; angle: number } | null = null;
  private bg: { x: number; y: number; s: number; a: number; p: number; layer: number }[] = [];

  private cam = { x: 0, y: 0, zoom: 0.3 };
  private zoomTarget = 0.3;
  private overview = true;
  private time = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private activeAt = 0; // last moment something needed 60 fps

  private ship = { x: 0, y: 0, vx: 0, vy: 0, face: 1, thrust: 0 };
  private keys = new Set<string>();
  private pointer: { x: number; y: number; held: boolean; moved: boolean; downAt: number } = { x: 0, y: 0, held: false, moved: false, downAt: 0 };
  private auto: { x: number; y: number; zone: Zone | null } | null = null;
  private motes: Mote[] = [];
  private near: Zone | null = null;
  private hovered: Zone | null = null;
  private hover = new Map<string, number>();
  private visited = new Set<string>();
  private noticeAt = 0;
  private blinkAt = 2;
  private emit = 0;
  private shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  private shootAt = 3;

  reducedMotion = false;
  showLabels = true;

  constructor(private canvas: HTMLCanvasElement, private ev: GameEvents) {
    this.ctx = canvas.getContext('2d')!;
    const small = Math.min(screen.width, screen.height) < 700;
    this.galaxy = buildGalaxy(small ? 2048 : 3072);
    this.coreSize = small ? 1024 : 1536;
    this.coreTex = buildCore(this.coreSize, false);

    // foreground star layers drawn in screen space for depth
    let seed = 11;
    const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 260; i++) {
      const layer = i % 3;
      this.bg.push({ x: r(), y: r(), s: layer === 2 ? 1.4 : layer === 1 ? 1 : 0.7, a: 0.3 + r() * 0.6, p: r() * 6, layer });
    }
    // near dust: a few soft specks that slide past quickly, so flying has a sense of speed
    for (let i = 0; i < 44; i++) {
      const layer = 3 + (i % 2);
      this.bg.push({ x: r(), y: r(), s: layer === 4 ? 2.6 : 1.9, a: 0.1 + r() * 0.2, p: r() * 6, layer });
    }

    const start = zones[0];
    this.ship.x = start.x + 60;
    this.ship.y = start.y + 40;
    this.cam.x = 0;
    this.cam.y = 0;

    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.bindPointer();
  }

  // ---------- public API ----------
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }
  stop() {
    if (!this.running) return; // already stopped: nothing to cancel, and no reason to redraw a galaxy nobody can see
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.keys.clear();
    this.pointer.held = false;
    this.render();
  }
  get isOverview() {
    return this.overview;
  }
  setOverview(on: boolean) {
    this.overview = on;
    this.zoomTarget = on ? this.overviewZoom() : this.exploreZoom();
    if (this.reducedMotion || !this.running) this.cam.zoom = this.zoomTarget;
    if (!on && !this.running) this.snapCam();
    this.render();
  }
  keyDown(code: string) {
    this.keys.add(code);
    this.auto = null;
  }
  keyUp(code: string) {
    this.keys.delete(code);
  }
  setVisited(ids: Iterable<string>) {
    this.visited = new Set(ids);
    this.render();
  }
  /** Park the astronaut beside a planet instantly. */
  teleport(z: Zone) {
    this.ship.x = z.x - (z.look.r + 70);
    this.ship.y = z.y;
    this.ship.face = 1;
    this.ship.vx = this.ship.vy = 0;
    this.auto = null;
    if (this.overview) this.setOverview(false);
    this.snapCam();
    this.updateNear();
    this.render();
  }
  /** Autopilot to a planet and land on arrival. */
  flyTo(z: Zone) {
    if (this.reducedMotion) {
      this.teleport(z);
      this.ev.onEnter(z);
      return;
    }
    if (this.overview) this.setOverview(false);
    const side = this.ship.x < z.x ? -1 : 1; // park beside the planet, clear of its label
    this.auto = { x: z.x + side * (z.look.r + 70), y: z.y, zone: z };
  }
  get isLight() {
    return this.siteLight;
  }
  /** Set the dimension without the warp animation (used on load). */
  setLight(on: boolean) {
    this.siteLight = on;
    if (on) this.ensureLightGalaxy();
    this.render();
  }
  /** The pictures the galaxy is drawn from, on the side we are on now, for the still on the short page. */
  art() {
    if (this.light) this.ensureLightGalaxy();
    const P = this.pal;
    return {
      light: this.light,
      galaxy: this.light && this.galaxyLight ? this.galaxyLight : this.galaxy,
      core: this.light && this.coreTexLight ? this.coreTexLight : this.coreTex,
      sky: this.light ? this.opalSky : null,
      bg: P.bg,
      vig0: P.vig0,
      vig: P.vig,
    };
  }
  get isLive() {
    return this.phase === 'live';
  }
  /** The galaxy bursts out of a single point and the planets unwind along the golden spiral. */
  bigBang() {
    if (this.phase !== 'void') return;
    if (this.reducedMotion) return this.reveal();
    this.phase = 'bang';
    this.bangT = -CHARGE; // negative while it charges; the blast is at 0
    this.bangRate = 1;
    this.overview = true;
    this.zoomTarget = this.cam.zoom = this.overviewZoom();
    this.cam.x = this.cam.y = 0;
    this.start();
  }
  /** Steering from the on-screen joystick. (0, 0) lets go. */
  setStick(x: number, y: number) {
    this.stick.x = x;
    this.stick.y = y;
    if (x || y) this.auto = null;
    this.activeAt = performance.now();
  }
  /** Skip straight to the finished galaxy. */
  reveal() {
    if (this.phase === 'live') return;
    this.phase = 'live';
    this.setOverview(false);
    this.snapCam();
    this.start();
    this.ev.onReady();
  }
  /**
   * Where a planet is drawn right now. Nothing pops into being: each planet starts as a glowing seed
   * thrown out of the fireball with the rest of the matter. The seeds drift around the centre
   * (inner ones a little quicker), then grow into planets by sweeping up gas once the disc has formed,
   * and ease to a stop on the golden spiral.
   */
  private zpos(z: Zone, i: number) {
    if (this.phase === 'live') return { x: z.x, y: z.y, e: 1, r: 0, a: 0, w: 0, hot: 0, grow: 1 };
    if (this.phase === 'void') return { x: 0, y: 0, e: 0, r: 0, a: 0, w: 0, hot: 0, grow: 0 };
    const k = Math.max(0, this.bangT) / BANG_TIME;
    const grow = smooth(i * 0.03, 0.72 + i * 0.03, this.planetK()); // 0 a seed, 1 a finished planet
    // the seed appears inside the fireball and rides out with the rest of the matter
    const e = smooth(0.02, 0.07, k) * (SEED + (1 - SEED) * grow);
    const rf = Math.hypot(z.x, z.y);
    const af = Math.atan2(z.y, z.x);
    const out = 4.4 + (i % 3) * 0.5;
    const r = (rf * (1 - Math.exp(-k * out))) / (1 - Math.exp(-out));
    // a slow drift around the centre, inner orbits a little quicker; it eases to a stop on the spiral
    // (the seeds keep the same spread around the centre as the finished planets, so they never bunch up)
    const rmin = Math.min(...zones.map((q) => Math.hypot(q.x, q.y)));
    // about one lap in all, the inner seeds a touch more. Most of it happens while they are still seeds:
    // they swing out of the fireball, circle the centre through the dark, then slow to a stop as they grow.
    const turn = Math.PI * 2 * 0.95 + 0.55 * Math.pow(rmin / rf, 0.6);
    const o = orbit(k);
    const a = af - turn * (1 - o.done);
    const w = turn * o.speed; // angular speed, for the motion trail
    // a seed is a glowing ember: bright in the fireball, dimmer in the dark, then it cools into its own colours as it grows
    const hot = (0.55 + 0.45 * (1 - smooth(0.1, 0.32, k))) * (1 - smooth(0.25, 0.95, grow));
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, e, r, a, w, hot, grow };
  }
  /** Where the waiting point sits on the title screen: centred on big screens, clear of the title text on small ones. */
  private singularity() {
    const { W, H } = this;
    return { cx: H < 520 ? W * 0.82 : W / 2, cy: H < 520 ? H * 0.3 : W < 700 ? H * 0.2 : H / 2 };
  }
  /** Screen offset during the opening: the galaxy's centre starts on the title-screen point and eases to its real place. */
  private bangDrift(bk: number) {
    const c = this.toScreen(0, 0);
    const o = this.singularity();
    const m = 1 - smooth(0, 0.22, bk);
    // the blast shakes the camera for a moment
    const t = Math.max(0, this.bangT);
    const amp = 11 * Math.exp(-t * 4.2);
    return { x: (o.cx - c.x) * m + Math.sin(t * 83) * amp, y: (o.cy - c.y) * m + Math.cos(t * 67) * amp };
  }
  /** The camera starts close in, so matter rushes past the edges of the screen, then pulls back to show all of it. */
  private bangZoom(bk: number) {
    return 1 + 3.2 * (1 - smooth(0.01, 0.36, bk));
  }
  /** A thin horizontal streak of light, the kind a film lens draws through anything very bright. */
  private lensStreak(g: CanvasRenderingContext2D, x: number, y: number, half: number, alpha: number, thick: number) {
    if (alpha <= 0.01 || half <= 1) return;
    const prevA = g.globalAlpha;
    const col = this.light ? '150,150,235' : '170,200,255';
    const core = this.light ? '120,120,220' : '255,255,255';
    // a round glow stretched sideways, so it tapers to a point at each end and has no hard edge anywhere
    const band = (c: string, r: number, a: number) => {
      g.save();
      g.translate(x, y);
      g.scale(half / r, 1);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, `rgba(${c},${Math.min(1, alpha)})`);
      gr.addColorStop(0.4, `rgba(${c},${Math.min(1, alpha) * 0.35})`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.globalAlpha = prevA * a;
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    band(col, thick * 5, 0.35);
    band(col, thick * 1.8, 0.7);
    band(core, thick * 0.75, 1);
    g.globalAlpha = prevA;
  }
  /** The first stars: points in the gas that flare on one after another, and the core lighting up at the centre. */
  private births: { a: number; rf: number; at: number; s: number }[] = [];
  private drawFirstLight(g: CanvasRenderingContext2D, k: number) {
    if (k < 0.3 || k > 0.9) return;
    if (!this.births.length) {
      let seed = 7;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 22; i++) this.births.push({ a: rnd() * Math.PI * 2, rf: 110 + Math.pow(rnd(), 0.8) * (GALAXY_R - 190), at: 0.33 + (i / 22) * 0.2 + rnd() * 0.02, s: 0.7 + rnd() * 0.9 });
    }
    const prevOp = g.globalCompositeOperation;
    if (!this.light) g.globalCompositeOperation = 'lighter';
    const col = this.light ? '130,130,220' : '206,226,255';
    const gone = 1 - smooth(0.66, 0.86, k); // the finished disc has its own stars
    for (const b of this.births) {
      const since = k - b.at;
      if (since < 0) continue;
      const swirl = 1.1 * Math.pow(400 / Math.max(80, b.rf), 0.6);
      const a = b.a - (1 - k) * 0.5 + (k * k - 1) * swirl;
      const r = b.rf * (1 - Math.exp(-k * 5.5));
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      const flare = Math.exp(-since * 26); // 1 the instant it ignites
      const rise = Math.min(1, since / 0.006);
      const R = (26 + 150 * flare) * b.s;
      const gl = g.createRadialGradient(x, y, 0, x, y, R);
      gl.addColorStop(0, `rgba(${col},${(0.5 + 0.5 * flare) * rise * gone})`);
      gl.addColorStop(0.2, `rgba(${col},${(0.12 + 0.3 * flare) * rise * gone})`);
      gl.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gl;
      g.fillRect(x - R, y - R, R * 2, R * 2);
      // a four-point sparkle while it flares
      const arm = (40 + 260 * flare) * b.s;
      g.strokeStyle = `rgba(${col},${(0.25 + 0.7 * flare) * rise * gone})`;
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(x - arm, y);
      g.lineTo(x + arm, y);
      g.moveTo(x, y - arm * 0.6);
      g.lineTo(x, y + arm * 0.6);
      g.stroke();
    }
    // the core switches on: a flash, a ring racing outward, a streak through the middle
    const since = k - 0.43;
    if (since > 0 && since < 0.3) {
      const f = Math.exp(-since * 15);
      const R = 90 + 620 * (1 - Math.exp(-since * 12));
      const gl = g.createRadialGradient(0, 0, 0, 0, 0, R);
      const cc = this.light ? '170,160,235' : '214,238,255';
      gl.addColorStop(0, `rgba(${cc},${0.95 * f})`);
      gl.addColorStop(0.3, `rgba(${cc},${0.3 * f})`);
      gl.addColorStop(1, `rgba(${cc},0)`);
      g.fillStyle = gl;
      g.fillRect(-R, -R, R * 2, R * 2);
      const ring = GALAXY_R * 1.25 * (1 - Math.exp(-since * 9));
      g.strokeStyle = `rgba(${cc},${0.55 * Math.exp(-since * 10)})`;
      g.lineWidth = 5;
      g.beginPath();
      g.arc(0, 0, ring, 0, Math.PI * 2);
      g.stroke();
      this.lensStreak(g, 0, 0, 260 + 1500 * f, f, 9);
    }
    g.globalCompositeOperation = prevOp;
  }
  /** How far along planet formation is, 0 to 1. Nothing forms until the disc has gathered. */
  private planetK() {
    return Math.min(1, Math.max(0, (Math.max(0, this.bangT) / BANG_TIME - PLANETS_AT) / (1 - PLANETS_AT)));
  }
  /**
   * The early universe: a hot cloud of matter flung out from the singularity. It slows under drag,
   * cools from white through blue to amber, picks up rotation (inner matter faster), and fades
   * as it settles into the galaxy's arms.
   */
  private debris: { a: number; rf: number; s: number; d: number }[] = [];
  private puffs: { a: number; rf: number; s: number; d: number; hue: number }[] = [];
  private puffTex: HTMLCanvasElement | null = null;
  private puffTint: HTMLCanvasElement[] = [];
  /** The gas itself: big soft clouds that glow white-hot, dim to violet in the dark, then take the colours of the arms. */
  private drawGas(g: CanvasRenderingContext2D, k: number) {
    const fade = smooth(0.004, 0.03, k) * (1 - smooth(0.56, 0.86, k));
    if (fade <= 0) return;
    if (!this.puffTex) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d')!;
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.35, 'rgba(255,255,255,0.42)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr;
      x.fillRect(0, 0, 64, 64);
      this.puffTex = c;
      for (let h = 0; h < 3; h++) {
        const t = document.createElement('canvas');
        t.width = t.height = 64;
        this.puffTint.push(t);
      }
      let seed = 97;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 84; i++) {
        const arm = Math.floor(rnd() * 4);
        const rf = 70 + Math.pow(rnd(), 0.8) * (GALAXY_R - 110);
        const a = rnd() < 0.75 ? (arm / 4) * Math.PI * 2 + Math.log(rf / 120) / Math.tan(0.32) + (rnd() - 0.5) * 0.5 : rnd() * Math.PI * 2;
        this.puffs.push({ a, rf, s: 70 + rnd() * 130, d: 0.7 + rnd() * 0.6, hue: i % 3 });
      }
    }
    // one colour per frame for each of three families: hot gas is the same white everywhere, cold gas differs
    const born = smooth(0.34, 0.56, k);
    const T = Math.exp(-k * 9);
    const arms = this.light ? ['168,178,238', '198,176,238', '238,186,216'] : ['104,138,255', '160,112,255', '226,120,196'];
    for (let h = 0; h < 3; h++) {
      const hot = cool(Math.min(1, (1 - T) * 1.05), this.light).split(',').map(Number);
      const arm = arms[h].split(',').map(Number);
      const col = hot.map((v, j) => Math.round(v + (arm[j] - v) * born));
      const x = this.puffTint[h].getContext('2d')!;
      x.globalCompositeOperation = 'copy';
      x.drawImage(this.puffTex, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = `rgb(${col.join(',')})`;
      x.fillRect(0, 0, 64, 64);
    }
    const prevOp = g.globalCompositeOperation;
    const prevA = g.globalAlpha;
    if (!this.light) g.globalCompositeOperation = 'lighter';
    // bright while hot, a faint haze through the dark ages, lit again by the first stars
    const level = (this.light ? 0.22 : 0.17) * (0.3 + 0.7 * T + 0.45 * born) * fade;
    for (const p of this.puffs) {
      const ex = 1 - Math.exp(-k * 5.5 * p.d);
      const r = p.rf * ex;
      const swirl = 1.1 * Math.pow(400 / Math.max(80, p.rf), 0.6);
      const a = p.a - (1 - k) * 0.5 + (k * k - 1) * swirl;
      const sz = p.s * (0.3 + 0.7 * ex);
      g.globalAlpha = level;
      g.drawImage(this.puffTint[p.hue], Math.cos(a) * r - sz, Math.sin(a) * r - sz, sz * 2, sz * 2);
    }
    g.globalAlpha = prevA;
    g.globalCompositeOperation = prevOp;
  }
  private drawDebris(g: CanvasRenderingContext2D, k: number) {
    this.drawGas(g, k);
    if (!this.debris.length) {
      let seed = 41;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 1400; i++) {
        const arm = Math.floor(rnd() * 4);
        const rf = 60 + Math.pow(rnd(), 0.7) * (GALAXY_R - 40);
        // matter is clumpier along where the arms will form
        const a = rnd() < 0.6 ? (arm / 4) * Math.PI * 2 + Math.log(rf / 120) / Math.tan(0.32) + (rnd() - 0.5) * 0.5 : rnd() * Math.PI * 2;
        this.debris.push({ a, rf, s: 1.5 + rnd() * 4, d: 0.6 + rnd() * 0.8 });
      }
    }
    // there from the first instant, dim through the dark ages, gone once the disc has gathered it up
    const fade = smooth(0.004, 0.03, k) * (1 - smooth(0.52, 0.8, k));
    if (fade <= 0) return;
    const born = smooth(0.36, 0.5, k); // the first stars light the gas back up
    const near = Math.pow(this.bangZoom(k), 0.8);
    const zoomNow = this.cam.zoom * this.bangZoom(k);
    const prevCap = g.lineCap;
    g.lineCap = 'round';
    const prev = g.globalCompositeOperation;
    if (!this.light) g.globalCompositeOperation = 'lighter';
    for (const p of this.debris) {
      // expansion with drag: fast at first, coasting to its final radius
      const ex = 1 - Math.exp(-k * 5.5 * p.d);
      const r = p.rf * ex;
      // conserve angular momentum: the cloud spins up as it organises, inner parts faster
      const swirl = 1.1 * Math.pow(400 / Math.max(80, p.rf), 0.6);
      const a = p.a - (1 - k) * 0.5 + (k * k - 1) * swirl;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x = ca * r;
      const y = sa * r;
      // cools the way hot matter really does, white to yellow to orange to red; then star birth turns it blue-white
      const T = Math.exp(-k * 7 * p.d);
      const col = born > 0.5
        ? this.light ? '170,160,230' : '176,208,255'
        : cool(Math.min(0.74, 1 - T), this.light); // never cooler than a dull red-orange, so the gas stays visible
      const al = (0.5 + 0.34 * T + 0.1 * born) * fade;
      const sz = (p.s * (1 + T * 1.5)) / near;
      // while it is still flying fast, each piece is drawn as a streak pointing back at where it came from
      const tail = Math.min(46, p.rf * (1 - ex) * 0.3 * T);
      if (tail > sz * 1.5) {
        g.strokeStyle = `rgba(${col},${al * 0.36})`;
        g.lineWidth = sz * 0.5;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - ca * tail, y - sa * tail);
        g.stroke();
      }
      g.fillStyle = `rgba(${col},${al})`;
      if (sz * zoomNow > 1.7) {
        // big enough to see its shape: a round speck, never a square
        g.beginPath();
        g.arc(x, y, sz * 0.56, 0, Math.PI * 2);
        g.fill();
      } else g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    g.lineCap = prevCap;
    g.globalCompositeOperation = prev;
  }
  /** Autopilot into the black hole. */
  diveIntoCore() {
    if (this.overview) this.setOverview(false);
    this.auto = { x: 0, y: 0, zone: null };
  }
  private ensureLightGalaxy() {
    if (!this.coreTexLight) this.coreTexLight = buildCore(this.coreSize, true);
    if (!this.opalSky) {
      // the sky of the white dimension: slow veils of opal colour, painted once and drifted behind everything
      const c = document.createElement('canvas');
      c.width = c.height = 320;
      const o = c.getContext('2d')!;
      let seed = 5;
      const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      const hues = ['132,206,242', '178,156,250', '250,170,214', '150,230,212', '255,255,255', '255,255,255'];
      for (let i = 0; i < 20; i++) {
        const x = r() * 320;
        const y = r() * 320;
        const rad = 60 + r() * 110;
        const hue = hues[i % hues.length];
        const gr = o.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(${hue},${hue === '255,255,255' ? 0.7 : 0.3 + r() * 0.16})`);
        gr.addColorStop(1, `rgba(${hue},0)`);
        o.fillStyle = gr;
        o.fillRect(0, 0, 320, 320);
      }
      this.opalSky = c;
    }
    if (this.galaxyLight) return;
    // the other side: its own painting, not the night galaxy with the colours swapped
    this.galaxyLight = buildGalaxy(this.galaxy.width, true);
  }
  private get pal() {
    return this.light
      ? { bg: '#e9ebf8', star: '70,66,164', gold: 'rgba(94,76,198,', text: '28,26,58', dim: '100,100,140', route: 'rgba(110,104,186,', vig0: 'rgba(146,140,228,0)', vig: 'rgba(146,140,228,0.42)' }
      : { bg: '#030409', star: '230,236,255', gold: 'rgba(232,184,107,', text: '240,236,228', dim: '170,176,196', route: 'rgba(200,210,240,', vig0: 'rgba(0,0,0,0)', vig: 'rgba(0,0,0,0.55)' };
  }
  tryEnter() {
    if (this.near) this.ev.onEnter(this.near);
  }

  // ---------- sizing ----------
  private exploreZoom() {
    // pulled back far enough that the next planet and the route are usually in view
    // a phone held sideways is short, so it pulls back further to show more of the sky around you
    if (this.H < 520) return 0.46;
    return Math.max(0.62, Math.min(1.02, Math.min(this.W, this.H) / 840));
  }
  /** Device pixels per sprite pixel: always a whole number, so the astronaut's pixels stay square. */
  private astroPx() {
    const px = Math.max(2, Math.round(((this.H < 520 ? 36 : this.W < 700 ? 46 : 66) * this.dpr) / ASTRO.h));
    return this.overview && px > 2 ? px - 1 : px; // a little smaller on the map, so it covers less of it
  }
  private overviewZoom() {
    return Math.min(this.W, this.H) / (GALAXY_R * 2 + 260);
  }
  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.W = rect.width;
    this.H = rect.height;
    // a pixel budget: a big Retina window would otherwise mean five million pixels redrawn every frame
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(PIXEL_BUDGET / (this.W * this.H))));
    this.activeAt = performance.now();
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.zoomTarget = this.overview ? this.overviewZoom() : this.exploreZoom();
    this.cam.zoom = this.zoomTarget;
    if (this.overview) {
      this.cam.x = 0;
      this.cam.y = 0;
    }
    this.render();
  }
  private snapCam() {
    this.cam.x = this.ship.x;
    this.cam.y = this.ship.y;
    this.cam.zoom = this.zoomTarget;
  }
  private toWorld(sx: number, sy: number) {
    return { x: (sx - this.W / 2) / this.cam.zoom + this.cam.x, y: (sy - this.H / 2) / this.cam.zoom + this.cam.y };
  }
  private toScreen(x: number, y: number) {
    return { x: (x - this.cam.x) * this.cam.zoom + this.W / 2, y: (y - this.cam.y) * this.cam.zoom + this.H / 2 };
  }
  private zoneAt(sx: number, sy: number): Zone | null {
    const w = this.toWorld(sx, sy);
    const slack = 18 / this.cam.zoom;
    for (const z of zones) if (Math.hypot(w.x - z.x, w.y - z.y) < z.look.r * 1.25 + slack) return z;
    return null;
  }

  // ---------- pointer: click a planet to fly there; hold on space to steer ----------
  private bindPointer() {
    const c = this.canvas;
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    c.addEventListener('pointermove', (e) => {
      const p = pos(e);
      this.activeAt = performance.now();
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      if (this.pointer.held && Math.hypot(p.x - this.pointer.x, p.y - this.pointer.y) > 0) this.pointer.moved = true;
      const z = this.zoneAt(p.x, p.y);
      this.hovered = z;
      c.style.cursor = z ? 'pointer' : 'crosshair';
      if (!this.running) this.render();
    });
    c.addEventListener('pointerleave', () => {
      this.hovered = null;
    });
    c.addEventListener('pointerdown', (e) => {
      if (!this.running) return;
      // only the main button (or a touch) flies: a right or middle click opens its menu and never reports a release
      if (e.button !== 0) return;
      if (this.phase === 'bang') {
        this.bangRate = BANG_SKIP; // impatient? the rest plays in fast-forward
        return;
      }
      const p = pos(e);
      if (this.coarse) {
        // on a touch screen nothing happens until the finger lifts: the same touch may turn out to be a swipe that scrolls the page
        this.pointer = { x: p.x, y: p.y, held: true, moved: false, downAt: performance.now() };
        this.tapFrom = { x: p.x, y: p.y };
        return;
      }
      const z = this.zoneAt(p.x, p.y);
      if (z) {
        this.flyTo(z);
        return;
      }
      const w = this.toWorld(p.x, p.y);
      if (Math.hypot(w.x, w.y) < 70) {
        this.diveIntoCore();
        return;
      }
      // a click on open space: fly there. Nothing is steered by holding the button down.
      this.auto = { x: w.x, y: w.y, zone: null };
    });
    // if the browser takes the pointer away (a menu, another window), nothing may stay pressed
    const letGo = () => {
      this.pointer.held = false;
      this.tapFrom = null;
    };
    c.addEventListener('contextmenu', letGo);
    window.addEventListener('blur', letGo);
    const up = () => {
      if (this.coarse) {
        const from = this.tapFrom;
        this.tapFrom = null;
        const tapped = this.pointer.held && from && performance.now() - this.pointer.downAt < 450 && Math.hypot(this.pointer.x - from.x, this.pointer.y - from.y) < 14;
        this.pointer.held = false;
        if (!tapped) return;
        // a tap on a planet lands on it, a tap on the core dives in. A tap on open space does nothing:
        // on a phone the stick is the only way to fly (his choice), so a stray touch never moves you.
        const z = this.zoneAt(from.x, from.y);
        const w = this.toWorld(from.x, from.y);
        if (z) this.flyTo(z);
        else if (Math.hypot(w.x, w.y) < 70) this.diveIntoCore();
        return;
      }
      this.pointer.held = false;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', () => {
      this.pointer.held = false;
      this.tapFrom = null; // the touch became a scroll
    });
    // the mouse wheel is left alone so it scrolls the page down to the resume
  }

  // ---------- loop ----------
  // Is anything moving that needs a smooth frame rate? The slow ambient drift does not.
  private busy(now: number) {
    const s = this.ship;
    if (
      this.phase === 'bang' ||
      this.flip ||
      this.auto ||
      this.keys.size > 0 ||
      this.stick.x !== 0 ||
      this.stick.y !== 0 ||
      this.pointer.held ||
      this.motes.length > 0 ||
      this.shoot ||
      Math.abs(s.vx) + Math.abs(s.vy) > 3 ||
      Math.abs(this.cam.zoom - this.zoomTarget) > this.zoomTarget * 0.004
    )
      this.activeAt = now;
    return now - this.activeAt < 700;
  }
  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    // never draw faster than 60 a second (a 120 Hz screen would double the work), and half that at rest
    if (now - this.last < (this.busy(now) ? BUSY_FRAME : CALM_FRAME) - 3) return;
    this.acc += Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    while (this.acc >= DT) {
      this.update(DT);
      this.acc -= DT;
    }
    this.render();
  };

  private update(dt: number) {
    this.time += dt;
    // a shooting star every few seconds
    if (!this.reducedMotion) {
      if (this.shoot) {
        this.shoot.x += this.shoot.vx * dt;
        this.shoot.y += this.shoot.vy * dt;
        this.shoot.life -= dt;
        if (this.shoot.life <= 0) this.shoot = null;
      } else if (this.time > this.shootAt) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const a = 0.35 + Math.random() * 0.5;
        this.shoot = { x: this.W * (0.15 + Math.random() * 0.7), y: this.H * Math.random() * 0.45, vx: Math.cos(a) * 900 * dir, vy: Math.sin(a) * 900, life: 0.75 };
        this.shootAt = this.time + 4 + Math.random() * 6;
      }
    }
    if (this.phase === 'void') return;
    if (this.phase === 'bang') {
      this.bangT += dt * this.bangRate;
      if (this.bangT >= BANG_TIME) {
        this.phase = 'live';
        this.setOverview(false); // swoop in to the astronaut
        this.ev.onReady();
      }
      return;
    }
    const s = this.ship;
    const k = this.keys;
    let ix = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let iy = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);

    if (Math.hypot(this.stick.x, this.stick.y) > 0.14) {
      ix = this.stick.x;
      iy = this.stick.y;
    }
    let thrust = 0;
    if (ix || iy) {
      const m = Math.hypot(ix, iy);
      s.vx += (ix / m) * 900 * dt;
      s.vy += (iy / m) * 900 * dt;
      thrust = 1;
    } else if (this.auto) {
      const dx = this.auto.x - s.x;
      const dy = this.auto.y - s.y;
      const d = Math.hypot(dx, dy);
      const stopAt = 6;
      const want = Math.min(MAX_SPEED * 1.4, Math.max(0, d - stopAt) * 2.4);
      const tx = (dx / (d || 1)) * want;
      const ty = (dy / (d || 1)) * want;
      s.vx += (tx - s.vx) * Math.min(1, dt * 6);
      s.vy += (ty - s.vy) * Math.min(1, dt * 6);
      thrust = Math.min(1, want / MAX_SPEED);
      if (d - stopAt < 8) {
        const z = this.auto.zone;
        this.auto = null;
        s.vx = s.vy = 0;
        if (z) {
          s.face = z.x > s.x ? 1 : -1;
          this.updateNear();
          this.ev.onEnter(z);
        }
      }
    }
    if (!thrust || (!ix && !iy && !this.auto)) {
      const drag = Math.pow(0.12, dt); // floaty: velocity decays slowly
      s.vx *= drag;
      s.vy *= drag;
    }
    const sp = Math.hypot(s.vx, s.vy);
    const cap = this.auto ? MAX_SPEED * 1.4 : MAX_SPEED;
    if (sp > cap) {
      s.vx *= cap / sp;
      s.vy *= cap / sp;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (Math.abs(s.vx) > 8) s.face = s.vx > 0 ? 1 : -1;
    s.thrust += (thrust - s.thrust) * Math.min(1, dt * 8);

    // the edge of the galaxy and the event horizon both push back
    const r = Math.hypot(s.x, s.y);
    if (r > GALAXY_R - 30) {
      const nx = s.x / r;
      const ny = s.y / r;
      s.x = nx * (GALAXY_R - 30);
      s.y = ny * (GALAXY_R - 30);
      const out = s.vx * nx + s.vy * ny;
      if (out > 0) {
        s.vx -= nx * out * 1.6;
        s.vy -= ny * out * 1.6;
      }
      this.notice('Edge of the galaxy. Nothing out there but the void.');
    } else if (r < HORIZON_R && !this.flip) {
      this.auto = null;
      this.flip = { t: 0, switched: false, angle: Math.atan2(s.y, s.x) || 0.5 };
      if (this.reducedMotion) this.flip.t = FLIP_TIME / 2;
    } else if (r < PULL_R && !this.flip) {
      // gravity: a gentle tug toward the core that grows as you fall in
      const pull = 260 * (1 - r / PULL_R);
      s.vx -= (s.x / r) * pull * dt;
      s.vy -= (s.y / r) * pull * dt;
      if (r < 150) this.notice(`Approaching the event horizon. Keep going to switch to ${this.light ? 'dark' : 'light'} mode.`);
    }
    if (this.flip) {
      const f = this.flip;
      f.t += dt;
      // spiral in, switch dimension at the peak, then get flung back out
      if (!f.switched) {
        s.x *= 0.9;
        s.y *= 0.9;
        s.vx = s.vy = 0;
      }
      if (!f.switched && f.t >= FLIP_TIME / 2) {
        f.switched = true;
        this.siteLight = !this.siteLight;
        if (this.light) this.ensureLightGalaxy();
        this.ev.onDimension(this.siteLight);
        s.x = Math.cos(f.angle) * 175;
        s.y = Math.sin(f.angle) * 175;
        s.vx = Math.cos(f.angle) * 220;
        s.vy = Math.sin(f.angle) * 220;
        this.noticeAt = -99;
        this.notice(this.siteLight ? 'You came out of a white hole. This is the light side.' : 'Back through the horizon. This is the dark side.');
      }
      if (f.t >= FLIP_TIME) this.flip = null;
    }

    // exhaust: sparks leave the nozzle opposite to the direction of flight
    if (!this.reducedMotion && s.thrust > 0.2 && !this.flip) {
      this.emit += dt * 120 * s.thrust;
      const sp = Math.hypot(s.vx, s.vy);
      const dx = sp > 20 ? -s.vx / sp : -s.face;
      const dy = sp > 20 ? -s.vy / sp : 0;
      const u = this.astroPx() / this.dpr / this.cam.zoom; // one sprite pixel in world units
      const nx = s.x + s.face * (ASTRO.nozzleX - ASTRO.ax) * u;
      const ny = s.y + (ASTRO.nozzleY - ASTRO.ay + 0.5) * u;
      while (this.emit >= 1) {
        this.emit -= 1;
        const v = 25 + Math.random() * 60;
        const j = (Math.random() - 0.5) * 52;
        const life = 0.4 + Math.random() * 0.6;
        this.motes.push({ x: nx, y: ny, vx: s.vx * 0.15 + dx * v - dy * j, vy: s.vy * 0.15 + dy * v + dx * j, life, max: life });
      }
    }
    for (const m of this.motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;
    }
    this.motes = this.motes.filter((m) => m.life > 0);

    // camera
    if (this.overview) {
      this.cam.x += (0 - this.cam.x) * Math.min(1, dt * 3);
      this.cam.y += (0 - this.cam.y) * Math.min(1, dt * 3);
    } else {
      const lead = this.reducedMotion ? 0 : 0.35;
      this.cam.x += (s.x + s.vx * lead - this.cam.x) * Math.min(1, dt * 3);
      this.cam.y += (s.y + s.vy * lead - this.cam.y) * Math.min(1, dt * 3);
    }
    this.cam.zoom += (this.zoomTarget - this.cam.zoom) * Math.min(1, dt * (this.reducedMotion ? 60 : 2.5));

    for (const z of zones) {
      const h = this.hover.get(z.id) ?? 0;
      const want = this.hovered === z || this.near === z ? 1 : 0;
      this.hover.set(z.id, h + (want - h) * Math.min(1, dt * 7));
    }
    if (this.time > this.blinkAt + 0.14) this.blinkAt = this.time + 2 + Math.random() * 3;
    this.updateNear();
  }

  private notice(msg: string) {
    if (this.time - this.noticeAt < 4) return;
    this.noticeAt = this.time;
    this.ev.onNotice(msg);
  }

  private updateNear() {
    const s = this.ship;
    const z = zones.find((z) => Math.hypot(z.x - s.x, z.y - s.y) < z.look.r + 80) ?? null;
    if (z !== this.near) {
      this.near = z;
      this.ev.onNear(z);
    }
  }

  // ---------- render ----------
  private render() {
    const g = this.ctx;
    const { W, H } = this;
    const t = this.reducedMotion ? 0 : this.time;
    const charge = this.phase === 'bang' && this.bangT < 0 ? 1 + this.bangT / CHARGE : -1; // 0 to 1 while it builds up
    const charging = charge >= 0;
    const cs = charging ? Math.min(1, charge / 0.82) : 0; // the pull; the last moments are a dark, still beat
    const beat = charging ? Math.max(0, (charge - 0.82) / 0.18) : 0;
    const sing = this.singularity();
    const zoom = this.cam.zoom * (this.phase === 'bang' ? this.bangZoom(Math.max(0, this.bangT) / BANG_TIME) : 1);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const P = this.pal;
    g.fillStyle = P.bg;
    g.fillRect(0, 0, W, H);
    if (this.light && this.opalSky) {
      // the opal veils drift slowly on their own, and slide a little as you fly
      const m = 160;
      const drift = this.reducedMotion ? 0 : this.time * 0.05;
      const ox = Math.max(-m, Math.min(m, -this.cam.x * 0.035 * zoom + Math.sin(drift) * 50));
      const oy = Math.max(-m, Math.min(m, -this.cam.y * 0.035 * zoom + Math.cos(drift * 0.8) * 36));
      g.drawImage(this.opalSky, ox - m, oy - m, W + m * 2, H + m * 2);
    }
    const INK = ['64,66,172', '124,96,214', '52,146,196', '206,92,160'];

    // deep-field stars with parallax
    for (const st of this.bg) {
      const par = [0.04, 0.08, 0.14, 0.34, 0.6][st.layer];
      const x = (((st.x * W * 1.3 - this.cam.x * par * zoom) % W) + W) % W;
      const y = (((st.y * H * 1.3 - this.cam.y * par * zoom) % H) + H) % H;
      const tw = this.reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(this.time * 1.5 + st.p);
      let lit = 1;
      if (charging) {
        // the whole sky falls into the point, slowly and then all at once
        const pull = cs * cs * cs;
        const before = Math.pow(Math.max(0, cs - 0.16), 3);
        const al = st.a * (0.7 + cs) * (1 - smooth(0.9, 1, cs));
        if (al <= 0.01) continue;
        g.strokeStyle = `rgba(${P.star},${Math.min(1, al)})`;
        g.lineWidth = Math.max(1, st.s * 0.8);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(sing.cx + (x - sing.cx) * (1 - pull), sing.cy + (y - sing.cy) * (1 - pull));
        g.lineTo(sing.cx + (x - sing.cx) * (1 - before) + 0.5, sing.cy + (y - sing.cy) * (1 - before) + 0.5);
        g.stroke();
        g.lineCap = 'butt';
        continue;
      }
      if (this.phase === 'bang') {
        // the first stars switch on one at a time, each with a brief flare
        const bkS = Math.max(0, this.bangT) / BANG_TIME;
        const at = 0.33 + (st.p / 6) * 0.38;
        const since = bkS - at;
        // the old sky is lost in the glare of the fireball; the new one switches on a star at a time
        lit = since > 0 ? Math.min(1, since / 0.03) * (1 + 1.6 * Math.exp(-since * 45)) : 0;
        if (lit <= 0.01) continue;
      }
      if (this.light) {
        // on the white side the far stars are points of coloured ink, and the near ones are soft motes of white light
        if (st.layer >= 3) {
          g.fillStyle = `rgba(255,255,255,${Math.min(1, st.a * 3 * lit)})`;
          g.beginPath();
          g.arc(x, y, st.s * 1.5, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillStyle = `rgba(${INK[Math.floor(st.p * 2.5) % 4]},${Math.min(1, st.a * tw * lit * 0.8)})`;
          g.beginPath();
          g.arc(x, y, st.s * 0.75, 0, Math.PI * 2);
          g.fill();
        }
        continue;
      }
      g.fillStyle = `rgba(${P.star},${Math.min(1, st.a * tw * lit)})`;
      g.fillRect(x, y, st.s, st.s);
    }
    if (this.shoot && !this.reducedMotion && this.phase === 'live') {
      const sh = this.shoot;
      const a = Math.min(1, sh.life / 0.25) * 0.8;
      const tail = g.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 0.14, sh.y - sh.vy * 0.14);
      tail.addColorStop(0, `rgba(${P.star},${a})`);
      tail.addColorStop(1, `rgba(${P.star},0)`);
      g.strokeStyle = tail;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(sh.x, sh.y);
      g.lineTo(sh.x - sh.vx * 0.14, sh.y - sh.vy * 0.14);
      g.stroke();
    }
    if (this.phase === 'void' || charging) {
      // before the big bang there is only the singularity: one point, waiting
      // centred on big screens; moved clear of the title text on phones and short landscape screens
      // once started it charges: it trembles, light and rings fall into it, then one dark, still beat before the blast
      const tremble = cs * cs * 2.6 * (1 - beat);
      const cx = sing.cx + Math.sin(this.time * 91) * tremble;
      const cy = sing.cy + Math.cos(this.time * 73) * tremble;
      const hold = 1 - beat;
      const pulse = this.reducedMotion ? 0.5 : charging ? 1 : 0.5 + 0.5 * Math.sin(this.time * 1.6);
      if (hold > 0.01) {
        const hr = (46 + pulse * 22) * (1 - cs * 0.5) * hold;
        const halo = g.createRadialGradient(cx, cy, 0, cx, cy, hr);
        halo.addColorStop(0, `${P.gold}${(0.5 + pulse * 0.3) * (1 - cs)})`);
        halo.addColorStop(0.25, `${P.gold}${0.12 * (1 - cs)})`);
        halo.addColorStop(1, `${P.gold}0)`);
        g.fillStyle = halo;
        g.fillRect(cx - 70, cy - 70, 140, 140);
      }
      if (charging && hold > 0.01) {
        const prevOp = g.globalCompositeOperation;
        if (!this.light) g.globalCompositeOperation = 'lighter';
        const ink = this.light ? '120,110,200' : '214,230,255';
        // rings of light closing in on the point
        for (let j = 0; j < 3; j++) {
          const u = cs * 1.5 - j * 0.25;
          if (u <= 0 || u >= 1) continue;
          g.strokeStyle = `rgba(${ink},${0.55 * Math.sin(u * Math.PI) * hold})`;
          g.lineWidth = 1.2;
          g.beginPath();
          g.arc(cx, cy, 300 * Math.pow(1 - u, 1.6) + 3, 0, Math.PI * 2);
          g.stroke();
        }
        // the point itself burns whiter and tighter
        const wr = (14 + 60 * cs) * hold;
        const white = g.createRadialGradient(cx, cy, 0, cx, cy, wr);
        white.addColorStop(0, `rgba(${this.light ? '140,130,220' : '255,255,255'},${cs})`);
        white.addColorStop(0.3, `rgba(${ink},${cs * 0.4})`);
        white.addColorStop(1, `rgba(${ink},0)`);
        g.fillStyle = white;
        g.fillRect(cx - wr, cy - wr, wr * 2, wr * 2);
        this.lensStreak(g, cx, cy, (30 + this.W * 0.42 * cs * cs) * hold, cs * hold, 1.6);
        g.globalCompositeOperation = prevOp;
      }
      if (hold > 0.01) {
        g.fillStyle = `rgba(${P.text},0.95)`;
        g.beginPath();
        g.arc(cx, cy, 1.8 * hold, 0, Math.PI * 2);
        g.fill();
      }
      g.font = '500 10px "IBM Plex Mono", monospace';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillStyle = `rgba(${P.dim},${0.8 * (1 - cs)})`;
      g.fillText('t = 0', cx + 16, cy - 14);
      return;
    }
    const live = this.phase === 'live';
    const bk = live ? 1 : Math.max(0, this.bangT) / BANG_TIME;

    g.save();
    // the bang goes off exactly where the point was waiting on the title screen, and everything drifts to the middle together
    const drift = live ? { x: 0, y: 0 } : this.bangDrift(bk);
    g.translate(drift.x, drift.y);
    g.translate(W / 2, H / 2);
    g.scale(zoom, zoom);
    g.translate(-this.cam.x, -this.cam.y);

    if (this.flip && !this.reducedMotion) {
      // the whole galaxy swirls around the core during the crossing
      const k = Math.sin((this.flip.t / FLIP_TIME) * Math.PI);
      g.translate(this.cam.x, this.cam.y);
      g.rotate(k * 0.6);
      g.scale(1 + k * 0.5, 1 + k * 0.5);
      g.translate(-this.cam.x, -this.cam.y);
    }
    const ge = smooth(0.42, 0.78, bk);
    g.save();
    if (!live) {
      // the disc gathers out of the gas more or less where it is, winding up as it settles
      g.globalAlpha = ge;
      g.rotate((1 - ge) * -0.5);
      g.scale(0.86 + ge * 0.14, 0.86 + ge * 0.14);
    }
    g.drawImage(this.light && this.galaxyLight ? this.galaxyLight : this.galaxy, -TEX_WORLD / 2, -TEX_WORLD / 2, TEX_WORLD, TEX_WORLD);
    g.restore();
    if (!live) {
      this.drawDebris(g, bk);
      this.drawFirstLight(g, bk);
    }
    const coreA = live ? 1 : smooth(0.4, 0.58, bk);
    if (coreA > 0.01) {
      g.save();
      g.globalAlpha = coreA;
      drawCore(g, t, this.light, this.light && this.coreTexLight ? this.coreTexLight : this.coreTex);
      g.restore();
    }
    void CORE_WORLD;

    // nothing drawn from here to the planets may show inside the hole: the route runs in behind it
    g.save();
    g.beginPath();
    g.rect(-TEX_WORLD, -TEX_WORLD, TEX_WORLD * 2, TEX_WORLD * 2);
    g.arc(0, 0, HOLE_R * 1.03, 0, Math.PI * 2);
    g.clip('evenodd');
    // the route is a golden spiral, gold where you have travelled
    const seg = (t0: number, t1: number) => {
      g.beginPath();
      for (let k = 0; k <= 40; k++) {
        const p = spiral(t0 + ((t1 - t0) * k) / 40);
        if (k) g.lineTo(p.x, p.y);
        else g.moveTo(p.x, p.y);
      }
      g.stroke();
    };
    if (live) {
    g.lineWidth = 1.2 / zoom;
    g.strokeStyle = `${P.route}0.14)`;
    g.setLineDash([4 / zoom, 6 / zoom]);
    seg(-0.6, 0);
    seg(SPIRAL_SPAN, SPIRAL_SPAN + 4.6); // keeps winding all the way into the black hole
    g.setLineDash([]);
    for (let i = 0; i < zones.length - 1; i++) {
      const a = zones[i];
      const b = zones[i + 1];
      const done = this.visited.has(a.id) && this.visited.has(b.id);
      g.strokeStyle = done ? `${P.gold}0.75)` : `${P.gold}0.22)`;
      g.lineWidth = (done ? 1.8 : 1.2) / zoom;
      seg(a.t, b.t);
    }
    // quarter-turn radii: each one is φ times shorter than the last
    g.strokeStyle = `${P.gold}0.06)`;
    g.lineWidth = 1 / zoom;
    for (let q = 0; q < 6; q++) {
      const p0 = spiral(q * (Math.PI / 2));
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(p0.x, p0.y);
      g.stroke();
    }
    // a slow current of light drifts along the route toward the black hole
    if (!this.reducedMotion) {
      const span = SPIRAL_SPAN + 4.6 + 0.6;
      for (let j = 0; j < 16; j++) {
        const u = (this.time * 0.03 + j / 16) % 1;
        const p = spiral(-0.6 + u * span);
        g.fillStyle = `${P.gold}${Math.sin(u * Math.PI) * 0.75})`;
        g.beginPath();
        g.arc(p.x, p.y, 2.2 / Math.max(zoom, 0.45), 0, Math.PI * 2);
        g.fill();
      }
    }
    const lab = spiral(-0.45);
    const fz = Math.max(zoom, 0.5);
    g.font = `${12 / fz}px "IBM Plex Mono", monospace`;
    g.fillStyle = `${P.gold}0.55)`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    // on a phone this would sit under the landing button, so it is only drawn on the map there
    if (this.W >= 700 || this.overview) g.fillText(`r = φ^(2θ/π)   φ = ${PHI.toFixed(6)}`, lab.x, lab.y - 14 / fz);
    } else {
      // during the big bang each planet laps its own orbit; the golden spiral is drawn in as they settle
      const settle = ease((this.planetK() - 0.7) / 0.27);
      for (const [i, z] of zones.entries()) {
        const zp = this.zpos(z, i);
        if (zp.e <= 0) continue;
        g.strokeStyle = `${P.gold}${0.14 * zp.grow * (1 - settle)})`;
        g.lineWidth = 1 / zoom;
        g.beginPath();
        g.arc(0, 0, zp.r, 0, Math.PI * 2);
        g.stroke();
        // a faint trail along the orbit while it is still drifting
        const len = Math.min(0.55, zp.w * 0.045);
        const seen = Math.max(zp.grow, 0.7 * smooth(0.1, 0.2, bk)); // seeds leave a trail too, once they are clear of the fireball
        if (len > 0.02 && seen > 0.02) {
          for (let s2 = 0; s2 < 6; s2++) {
            g.strokeStyle = `rgba(${P.star},${(0.3 * (6 - s2)) / 6 * seen})`;
            g.lineWidth = (z.look.r * 0.5 * (0.12 + zp.e * 0.88) * (6 - s2)) / 6;
            g.beginPath();
            g.arc(0, 0, zp.r, zp.a - (len * (s2 + 1)) / 6, zp.a - (len * s2) / 6);
            g.stroke();
          }
        }
      }
      if (settle > 0) {
        g.strokeStyle = `${P.gold}${0.24 * settle})`;
        g.lineWidth = 1.2 / zoom;
        seg(-0.45, -0.45 + (SPIRAL_SPAN + 0.45) * settle);
      }
    }
    g.restore();

    for (const [i, z] of zones.entries()) {
      const h = this.hover.get(z.id) ?? 0;
      const zp = this.zpos(z, i);
      if (zp.e <= 0) continue;
      g.save();
      g.translate(zp.x, zp.y);
      if (zp.e < 1) {
        const sc = (0.12 + zp.e * 0.88) / Math.pow(live ? 1 : this.bangZoom(bk), 0.6);
        g.scale(sc, sc);
      }
      const done = live ? 0 : smooth(0.8, 1, zp.grow);
      if (done > 0 && done < 1) {
        // finished: a ring of light pings off the new planet
        g.strokeStyle = `rgba(${P.star},${0.7 * (1 - done)})`;
        g.lineWidth = 2 / zoom;
        g.beginPath();
        g.arc(0, 0, z.look.r * (1.5 + 2.6 * done), 0, Math.PI * 2);
        g.stroke();
      }
      // orbit marker ring that grows on hover
      g.strokeStyle = `${P.gold}${0.12 + h * 0.5})`;
      g.lineWidth = 1 / zoom;
      g.beginPath();
      g.arc(0, 0, z.look.r * (1.45 + h * 0.15), 0, Math.PI * 2);
      g.stroke();
      if (live && this.near === z && !this.reducedMotion) {
        // a soft ping: you are close enough to land
        const u = (this.time % 1.8) / 1.8;
        g.strokeStyle = `${P.gold}${(1 - u) * 0.55})`;
        g.lineWidth = 1.2 / zoom;
        g.beginPath();
        g.arc(0, 0, z.look.r * (1.5 + u * 0.9), 0, Math.PI * 2);
        g.stroke();
      }
      drawPlanet(g, z.look, Math.atan2(-z.y, -z.x), t, h);
      if (zp.hot > 0.02) {
        // a molten ember: a glow that fades as the planet cools. A seed is tiny, so its glow reaches well past it.
        const R = z.look.r * (1.2 + zp.hot * 1.6) * (1 + (1 - zp.grow) * 1.2);
        const gl = g.createRadialGradient(0, 0, 0, 0, 0, R);
        const c = this.light ? '168,150,230' : '255,248,236';
        gl.addColorStop(0, `rgba(${c},${Math.min(1, zp.hot * 1.15)})`);
        gl.addColorStop(0.45, `rgba(${this.light ? '196,184,240' : '255,226,196'},${zp.hot * 0.42})`);
        gl.addColorStop(1, `rgba(${c},0)`);
        const prev = g.globalCompositeOperation;
        if (!this.light) g.globalCompositeOperation = 'lighter';
        g.fillStyle = gl;
        g.beginPath();
        g.arc(0, 0, R, 0, Math.PI * 2);
        g.fill();
        g.globalCompositeOperation = prev;
      }
      if (!live && zp.grow > 0.001 && zp.grow < 0.999) {
        // what the planet is made of: gas spiralling in from the disc around it
        const inv = 1 / (0.12 + zp.e * 0.88);
        const reach = z.look.r * 4.6;
        const prev = g.globalCompositeOperation;
        if (!this.light) g.globalCompositeOperation = 'lighter';
        for (let j = 0; j < 18; j++) {
          const ph = (zp.grow * 2.6 + j / 18) % 1; // 0 far out, 1 swallowed
          const d = (z.look.r * 0.4 + reach * Math.pow(1 - ph, 1.4)) * inv;
          const an = j * GOLDEN_ANGLE + ph * 4.2;
          const al = Math.sin(ph * Math.PI) * 0.75 * Math.sin(zp.grow * Math.PI);
          const sz = (1.6 + (j % 3)) * 1.5 * inv;
          g.fillStyle = `rgba(${this.light ? '150,140,210' : '190,214,255'},${al})`;
          g.beginPath();
          g.arc(Math.cos(an) * d, Math.sin(an) * d, sz * 0.56, 0, Math.PI * 2);
          g.fill();
        }
        g.globalCompositeOperation = prev;
      }
      g.restore();
    }

    g.restore();

    // exhaust and astronaut are pixel art: drawn in whole device pixels so nothing blurs
    const s = this.ship;
    if (live) {
      const px = this.astroPx();
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      const ramp = this.light ? ['#b9c2f2', '#96a3ea', '#7484e0', '#5266d2', '#3b4fb8'] : ['#2a5fc0', '#3fa0e8', '#7fdcf5', '#c9f4ff', '#ffffff'];
      if (!this.light) g.globalCompositeOperation = 'lighter';
      if (!this.light && s.thrust > 0.15) {
        // a soft bloom where the jet leaves the pack
        const n = this.toScreen(s.x, s.y);
        const gx = n.x * this.dpr + s.face * (ASTRO.nozzleX - ASTRO.ax - 1) * px;
        const gy = n.y * this.dpr + (ASTRO.nozzleY - ASTRO.ay + 0.5) * px;
        const glow = g.createRadialGradient(gx, gy, 0, gx, gy, px * 7);
        glow.addColorStop(0, `rgba(127,220,245,${0.34 * s.thrust})`);
        glow.addColorStop(1, 'rgba(63,160,232,0)');
        g.fillStyle = glow;
        g.fillRect(gx - px * 7, gy - px * 7, px * 14, px * 14);
      }
      for (const m of this.motes) {
        const a = m.life / m.max;
        const p = this.toScreen(m.x, m.y);
        const size = Math.max(1, Math.round(px * (0.45 + a * 0.95)));
        g.globalAlpha = Math.min(1, a * 2.2) * (this.light ? 0.85 : 1);
        g.fillStyle = ramp[Math.min(4, Math.floor(a * a * 5))];
        g.fillRect(Math.round(p.x * this.dpr - size / 2), Math.round(p.y * this.dpr - size / 2), size, size);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      const p = this.toScreen(s.x, s.y);
      const bob = this.reducedMotion ? 0 : Math.round(Math.sin(this.time * 2) * 1.3) * px;
      drawAstronaut(g, p.x * this.dpr, p.y * this.dpr + bob, px, t, s.face, s.thrust, this.reducedMotion);
      g.restore();
    }

    // labels in screen space so text stays crisp
    const compact = this.overview && Math.min(this.W, this.H) < 700; // phones, upright or sideways: short labels that cannot collide
    for (const z of this.showLabels && live ? zones : []) {
      const p = this.toScreen(z.x, z.y);
      if (p.x < -80 || p.x > W + 80 || p.y < -80 || p.y > H + 80) continue;
      const h = this.hover.get(z.id) ?? 0;
      const y = p.y + z.look.r * zoom * 1.5 + 16;
      const seen = this.visited.has(z.id);
      // keep the whole name on screen while any of the planet is, instead of clipping it at the edge
      if (!this.overview && p.x > -z.look.r * zoom && p.x < W + z.look.r * zoom) {
        g.font = '400 13px Jost, sans-serif';
        const half = Math.min(W / 2 - 8, (g.measureText(z.title.toUpperCase()).width + z.title.length * 2.5) / 2 + 10);
        p.x = Math.max(half, Math.min(W - half, p.x));
      }
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.font = '500 10px "IBM Plex Mono", monospace';
      g.fillStyle = seen ? `${P.gold}0.9)` : `rgba(${P.dim},0.85)`;
      if (!compact) g.fillText(seen ? `${z.code} · VISITED` : z.code, p.x, y);
      g.font = `${400 + Math.round(h) * 100} ${(compact ? 10 : 13) + h * 2}px Jost, sans-serif`;
      g.fillStyle = seen && compact ? `${P.gold}0.95)` : `rgba(${P.text},${0.82 + h * 0.18})`;
      spaced(g, z.title.toUpperCase(), p.x, compact ? y - 6 : y + 15, compact ? 1.5 : 2.5);
    }

    // the black hole is labelled with what it does: it is the way to the other colour mode
    const core = this.toScreen(0, 0);
    const coreOn = core.x > -40 && core.x < W + 40 && core.y > -40 && core.y < H + 40;
    const other = this.siteLight ? 'DARK' : 'LIGHT';
    if (live && this.showLabels && coreOn && !this.flip) {
      // below the core, unless that would sit under the planet list
      const below = core.y + 150 * zoom + 12;
      const y = below > H - 170 ? core.y - 150 * zoom - 40 : below;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      if (this.overview && !compact) {
        g.font = '500 10px "IBM Plex Mono", monospace';
        g.fillStyle = `${P.gold}0.95)`;
        g.fillText(`${this.light ? 'WHITE' : 'BLACK'} HOLE → ${other} MODE`, core.x, core.y - 150 * zoom - 24);
      } else if (compact) {
        g.font = '500 9px "IBM Plex Mono", monospace';
        g.fillStyle = `${P.gold}0.95)`;
        g.fillText(`${other} MODE`, core.x, core.y + 70 * zoom + 8);
      } else {
        g.font = '500 10px "IBM Plex Mono", monospace';
        g.fillStyle = `${P.gold}0.9)`;
        g.fillText(this.light ? 'WHITE HOLE' : 'BLACK HOLE', core.x, y);
        g.font = '400 13px Jost, sans-serif';
        g.fillStyle = `rgba(${P.text},0.9)`;
        spaced(g, `FLY IN FOR ${other} MODE`, core.x, y + 15, 2.5);
      }
    }
    const edge = (p: { x: number; y: number }, m: number) => {
      const cx = W / 2;
      const cy = H / 2;
      const a = Math.atan2(p.y - cy, p.x - cx);
      const k = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
      return { a, x: Math.max(m, Math.min(W - m, cx + Math.cos(a) * k)), y: Math.max(96, Math.min(H - 130, cy + Math.sin(a) * k)) };
    };
    // and when it is off screen, a marker at the edge points the way to it
    if (live && this.showLabels && !this.overview && !coreOn) {
      const e = edge(core, 34);
      g.save();
      g.translate(e.x, e.y);
      g.strokeStyle = `rgba(${P.text},0.9)`;
      g.fillStyle = `rgba(${P.text},0.9)`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(0, 0, 7, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(0, 0, 7, Math.PI / 2, -Math.PI / 2);
      g.fill();
      if (!this.reducedMotion) {
        // a slow pulse so the marker is noticed
        const u = (this.time % 2.4) / 2.4;
        g.strokeStyle = `rgba(${P.text},${(1 - u) * 0.5})`;
        g.beginPath();
        g.arc(0, 0, 7 + u * 13, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
      g.font = '500 10px "IBM Plex Mono", monospace';
      g.fillStyle = `rgba(${P.text},0.85)`;
      g.textAlign = Math.cos(e.a) > 0.3 ? 'right' : Math.cos(e.a) < -0.3 ? 'left' : 'center';
      g.textBaseline = Math.sin(e.a) > 0.3 ? 'bottom' : Math.sin(e.a) < -0.3 ? 'top' : 'middle';
      g.fillText(`${other} MODE`, e.x - Math.cos(e.a) * 18, e.y - Math.sin(e.a) * 18);
    }

    // live position in polar coordinates, the same ones the compass ring uses
    if (live && this.showLabels && !this.overview && W >= 700 && H >= 520) {
      const sp = this.ship;
      const deg = ((Math.atan2(-sp.y, sp.x) * 180) / Math.PI + 360) % 360;
      g.font = '400 10px "IBM Plex Mono", monospace';
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillStyle = `rgba(${P.dim},0.75)`;
      const pad = (n: number, w: number) => String(Math.round(n)).padStart(w, ' ');
      g.fillText(`r ${pad(Math.hypot(sp.x, sp.y), 4)}   θ ${pad(deg, 3)}°   v ${pad(Math.hypot(sp.vx, sp.vy), 3)}`, 20, 76);
    }

    // guide arrow toward the next unvisited planet when it is off screen
    const next = zones.find((z) => !this.visited.has(z.id));
    if (next && !this.overview) {
      const p = this.toScreen(next.x, next.y);
      const m = 34;
      if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
        const cx = W / 2;
        const cy = H / 2;
        const a = Math.atan2(p.y - cy, p.x - cx);
        const k = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
        const ax = Math.max(m, Math.min(W - m, cx + Math.cos(a) * k));
        const ay = Math.max(90, Math.min(H - 130, cy + Math.sin(a) * k)); // stay clear of the HUD
        g.save();
        g.translate(ax, ay);
        g.rotate(a);
        g.fillStyle = `${P.gold}0.9)`;
        g.beginPath();
        g.moveTo(10, 0);
        g.lineTo(-6, -7);
        g.lineTo(-3, 0);
        g.lineTo(-6, 7);
        g.closePath();
        g.fill();
        g.restore();
        g.font = '500 10px "IBM Plex Mono", monospace';
        g.fillStyle = `${P.gold}0.85)`;
        g.textAlign = Math.cos(a) > 0.3 ? 'right' : Math.cos(a) < -0.3 ? 'left' : 'center';
        g.textBaseline = Math.sin(a) > 0.3 ? 'bottom' : 'top';
        g.fillText(next.title.toUpperCase(), ax - Math.cos(a) * 16, ay - Math.sin(a) * 16);
      }
    }

    // ship marker in overview
    if (this.overview && this.showLabels && live) {
      const p = this.toScreen(s.x, s.y);
      g.strokeStyle = `${P.gold}0.9)`;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(p.x, p.y, 16 + Math.sin(this.time * 3) * 2, 0, Math.PI * 2);
      g.stroke();
      g.font = '500 10px "IBM Plex Mono", monospace';
      g.fillStyle = `${P.gold}0.95)`;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText('YOU', p.x, p.y - 24 - (ASTRO.ay * this.astroPx()) / this.dpr);
    }

    // vignette
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, P.vig0);
    v.addColorStop(1, P.vig);
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);

    // the big bang: a fireball of light that swells out of the waiting point, thins and cools as it grows,
    // and leaves the gas and the planet seeds flying behind it. No blast-wave ring: there is nothing outside to hit.
    if (!live) {
      const big = Math.min(Math.max(W, H), Math.min(W, H) * 1.6);
      if (bk < 0.4) {
        const c = this.toScreen(0, 0);
        const fx = c.x + drift.x;
        const fy = c.y + drift.y;
        const u = bk / 0.4; // 0 the instant of the bang, 1 faded away
        const R = 5 + (big * 1.0 * (1 - Math.exp(-u * 3.6))) / (1 - Math.exp(-3.6));
        const A = Math.pow(1 - u, 2.6);
        const tint = smooth(0.12, 0.7, u);
        const mixc = (a: number[], b: number[]) => a.map((v, j) => Math.round(v + (b[j] - v) * tint)).join(',');
        const far = this.light ? [214, 200, 240] : [146, 138, 255];
        // white-hot at the heart, a thin blue-violet halo at the edge: light, not smoke
        const ball = g.createRadialGradient(fx, fy, 0, fx, fy, R);
        ball.addColorStop(0, `rgba(${mixc([255, 252, 246], far)},${A})`);
        ball.addColorStop(0.28, `rgba(${mixc([246, 242, 255], far)},${A * 0.5})`);
        ball.addColorStop(0.6, `rgba(${this.light ? '214,200,240' : '150,172,255'},${A * 0.16})`);
        ball.addColorStop(1, `rgba(${this.light ? '214,200,240' : '120,140,255'},0)`);
        const prev = g.globalCompositeOperation;
        if (!this.light) g.globalCompositeOperation = 'lighter';
        g.fillStyle = ball;
        g.fillRect(0, 0, W, H);
        // the white-hot heart of it, brightest in the first moments
        const hk = 1 - smooth(0, 0.38, u);
        if (hk > 0.01) {
          const hr = 12 + R * 0.1;
          const heart = g.createRadialGradient(fx, fy, 0, fx, fy, hr);
          heart.addColorStop(0, `rgba(255,255,255,${hk})`);
          heart.addColorStop(0.35, `rgba(255,250,240,${hk * 0.5})`);
          heart.addColorStop(1, 'rgba(255,246,232,0)');
          g.fillStyle = heart;
          g.fillRect(fx - hr, fy - hr, hr * 2, hr * 2);
        }
        g.globalCompositeOperation = prev;
      }
      {
        const tS = Math.max(0, this.bangT);
        const c0 = this.toScreen(0, 0);
        const bx = c0.x + drift.x;
        const by = c0.y + drift.y;
        const prevOp = g.globalCompositeOperation;
        if (!this.light) g.globalCompositeOperation = 'lighter';
        // the first light races outward as a thin ring, split into colours at its edge
        const ra = Math.exp(-tS * 1.35);
        if (ra > 0.02) {
          const Rr = 8 + Math.hypot(W, H) * 0.9 * (1 - Math.exp(-tS * 1.7));
          const soft = this.light ? '150,140,220' : '170,200,255';
          const ring = (r: number, w: number, c: string, a: number) => {
            if (r <= 0) return;
            g.strokeStyle = `rgba(${c},${a})`;
            g.lineWidth = w;
            g.beginPath();
            g.arc(bx, by, r, 0, Math.PI * 2);
            g.stroke();
          };
          ring(Rr, 46, soft, ra * 0.07);
          ring(Rr, 16, soft, ra * 0.16);
          ring(Rr + 5, 2, this.light ? '176,140,230' : '178,128,255', ra * 0.55);
          ring(Rr - 5, 2, this.light ? '130,170,230' : '120,224,255', ra * 0.5);
          ring(Rr, 2.4, this.light ? '120,110,200' : '255,255,255', ra * 0.9);
          // a slower, fainter second front behind it
          ring(Rr * 0.62, 1.4, soft, ra * 0.3);
        }
        this.lensStreak(g, bx, by, 50 + W * 1.05 * (1 - Math.exp(-tS * 40)) * Math.exp(-tS * 1.2), Math.exp(-tS * 1.9), 2.4);
        g.globalCompositeOperation = prevOp;
        // and for a few frames, everything is light
        const fa = Math.exp(-tS * 8);
        if (fa > 0.01) {
          const fl = g.createRadialGradient(bx, by, 0, bx, by, Math.hypot(W, H) * 0.7);
          fl.addColorStop(0, `rgba(255,255,255,${fa})`);
          fl.addColorStop(0.3, `rgba(${this.light ? '255,255,255' : '226,234,255'},${fa * 0.6})`);
          fl.addColorStop(1, `rgba(${this.light ? '255,255,255' : '150,170,255'},${fa * 0.12})`);
          g.fillStyle = fl;
          g.fillRect(0, 0, W, H);
        }
      }
      // a small clock: where in the real story this moment sits
      let ei = 0;
      for (let i = 0; i < EPOCHS.length; i++) if (bk >= EPOCHS[i][0]) ei = i;
      const [e0, when, what] = EPOCHS[ei];
      const e1 = ei + 1 < EPOCHS.length ? EPOCHS[ei + 1][0] : 1.01;
      const ea = Math.min(smooth(e0, e0 + 0.025, bk), 1 - smooth(e1 - 0.025, e1, bk));
      const onGlow = false; // the screen is never washed out any more, so the type keeps its usual colour
      const ink = P.text;
      const y = H - (H < 520 ? 72 : W < 700 ? 148 : 124);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.font = '500 11px "IBM Plex Mono", monospace';
      g.fillStyle = `rgba(${ink},${0.85 * ea})`;
      g.fillText(`${when}  ·  ${what}`, W / 2, y);
      if (this.bangRate === 1 && bk > 0.08 && bk < 0.9) {
        g.font = '400 10px "IBM Plex Mono", monospace';
        g.fillStyle = `rgba(${onGlow ? ink : P.dim},${0.6 * smooth(0.08, 0.12, bk) * (1 - smooth(0.84, 0.9, bk))})`;
        g.fillText(this.coarse ? 'tap to skip ahead' : 'click to skip ahead', W / 2, y + 18);
      }
    }

    // the crossing: a flash in the colour of the dimension you are entering
    if (this.flip && !this.reducedMotion) {
      const k = Math.sin((this.flip.t / FLIP_TIME) * Math.PI);
      const goingLight = this.flip.switched ? this.siteLight : !this.siteLight;
      const c = goingLight ? '246,246,253' : '3,4,9';
      const p = this.toScreen(0, 0);
      const fl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(W, H) * (0.2 + k));
      fl.addColorStop(0, `rgba(${c},${k})`);
      fl.addColorStop(1, `rgba(${c},${k * 0.85})`);
      g.fillStyle = fl;
      g.fillRect(0, 0, W, H);
    }
  }
}

function spaced(g: CanvasRenderingContext2D, text: string, cx: number, y: number, track: number) {
  const ctx = g as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${track}px`;
    g.fillText(text, cx + track / 2, y);
    ctx.letterSpacing = '0px';
  } else g.fillText(text, cx, y);
}
