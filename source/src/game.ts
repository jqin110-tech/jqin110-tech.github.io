import { ASTRO, buildCore, buildGalaxy, CORE_WORLD, drawAstronaut, drawCore, drawPlanet, TEX_WORLD } from './draw';
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
const BANG_SKIP = 6; // how much faster the opening runs once someone clicks to skip ahead
const PLANETS_AT = 0.6; // fraction of the opening that passes before the planets start to form
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
  [255, 232, 170],
  [255, 156, 64],
  [226, 58, 30],
  [110, 8, 18],
];
const COOL_LIGHT: [number, number, number][] = [
  [255, 255, 255],
  [255, 238, 204],
  [250, 204, 172],
  [238, 176, 172],
  [236, 170, 176],
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
  private light = false;
  private coreTex: HTMLCanvasElement;
  private coreTexLight: HTMLCanvasElement | null = null;
  private coreSize: number;
  // void: empty space behind the title · bang: the galaxy forms · live: playable
  private phase: 'void' | 'bang' | 'live' = 'void';
  private bangT = 0;
  private bangRate = 1;
  private coarse = matchMedia('(pointer: coarse)').matches;
  private mottle: HTMLCanvasElement | null = null;
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
    return this.light;
  }
  /** Set the dimension without the warp animation (used on load). */
  setLight(on: boolean) {
    this.light = on;
    if (on) this.ensureLightGalaxy();
    this.render();
  }
  get isLive() {
    return this.phase === 'live';
  }
  /** The galaxy bursts out of a single point and the planets unwind along the golden spiral. */
  bigBang() {
    if (this.phase !== 'void') return;
    if (this.reducedMotion) return this.reveal();
    this.phase = 'bang';
    this.bangT = 0;
    this.bangRate = 1;
    this.overview = true;
    this.zoomTarget = this.cam.zoom = this.overviewZoom();
    this.cam.x = this.cam.y = 0;
    this.start();
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
   * Where a planet is drawn right now. Planets come late: once the disc exists, each one gathers
   * out of it near its own orbit, laps the black hole (inner orbits faster, roughly Keplerian),
   * then slows and locks into its place on the golden spiral.
   */
  private zpos(z: Zone, i: number) {
    if (this.phase === 'live') return { x: z.x, y: z.y, e: 1, r: 0, a: 0, w: 0, hot: 0 };
    if (this.phase === 'void') return { x: 0, y: 0, e: 0, r: 0, a: 0, w: 0, hot: 0 };
    const k = this.planetK();
    if (k <= 0) return { x: 0, y: 0, e: 0, r: 0, a: 0, w: 0, hot: 0 };
    // each planet accretes out of the disc: it grows from a speck and drifts out a little as it gathers mass
    const e = ease((k - i * 0.025) / 0.4);
    const rf = Math.hypot(z.x, z.y);
    const af = Math.atan2(z.y, z.x);
    const r = rf * (0.84 + 0.16 * ease(k / 0.8));
    const turns = 1.15 * Math.pow(zones[0] ? Math.hypot(zones[0].x, zones[0].y) / rf : 1, 0.75);
    const u = Math.min(1, Math.max(0, k / 0.92));
    // planets are born spread by the golden angle (≈137.5°), then each laps at its own speed
    const lag = (turns * Math.PI * 2 + i * GOLDEN_ANGLE) * (1 - u) * (1 - u);
    const a = af - lag;
    const w = turns * Math.PI * 4 * (1 - u); // angular speed, for the motion trail
    const hot = Math.exp(-k * 5); // white-hot at birth, cooling into its own colours
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, e, r, a, w, hot };
  }
  /** Where the waiting point sits on the title screen: centred on big screens, clear of the title text on small ones. */
  private singularity() {
    const { W, H } = this;
    return { cx: H < 520 ? W * 0.82 : W / 2, cy: H < 520 ? H * 0.3 : W < 700 ? H * 0.2 : H / 2 };
  }
  /** How far along planet formation is, 0 to 1. Nothing forms until the disc has gathered. */
  private planetK() {
    return Math.min(1, Math.max(0, (this.bangT / BANG_TIME - PLANETS_AT) / (1 - PLANETS_AT)));
  }
  /**
   * The early universe: a hot cloud of matter flung out from the singularity. It slows under drag,
   * cools from white through blue to amber, picks up rotation (inner matter faster), and fades
   * as it settles into the galaxy's arms.
   */
  private debris: { a: number; rf: number; s: number; d: number }[] = [];
  private drawDebris(g: CanvasRenderingContext2D, k: number) {
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
    // hidden inside the glow at first, dim through the dark ages, gone once the disc has gathered it up
    const fade = smooth(0.1, 0.26, k) * (1 - smooth(0.52, 0.8, k));
    if (fade <= 0) return;
    const born = smooth(0.36, 0.5, k); // the first stars light the gas back up
    const prev = g.globalCompositeOperation;
    if (!this.light) g.globalCompositeOperation = 'lighter';
    for (const p of this.debris) {
      // expansion with drag: fast at first, coasting to its final radius
      const ex = 1 - Math.exp(-k * 5.5 * p.d);
      const r = p.rf * ex;
      // conserve angular momentum: the cloud spins up as it organises, inner parts faster
      const spin = k * k * 2.4 * Math.pow(400 / Math.max(80, p.rf), 0.6);
      const a = p.a - (1 - k) * 1.2 + spin - 2.4 * Math.pow(400 / Math.max(80, p.rf), 0.6);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      // cools the way hot matter really does, white to yellow to orange to red; then star birth turns it blue-white
      const T = Math.exp(-k * 7 * p.d);
      const col = born > 0.5
        ? this.light ? '170,160,230' : '176,208,255'
        : cool(Math.min(0.74, 1 - T), this.light); // never cooler than a dull red-orange, so the gas stays visible
      const al = (0.5 + 0.34 * T + 0.1 * born) * fade;
      g.fillStyle = `rgba(${col},${al})`;
      const sz = p.s * (1 + T * 1.5);
      g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    g.globalCompositeOperation = prev;
  }
  /** Autopilot into the black hole. */
  diveIntoCore() {
    if (this.overview) this.setOverview(false);
    this.auto = { x: 0, y: 0, zone: null };
  }
  private ensureLightGalaxy() {
    if (!this.coreTexLight) this.coreTexLight = buildCore(this.coreSize, true);
    if (this.galaxyLight) return;
    // the other side: a pastel daylight galaxy painted for paper
    this.galaxyLight = buildGalaxy(this.galaxy.width, true);
  }
  private get pal() {
    return this.light
      ? { bg: '#f6f1ea', star: '96,100,150', gold: 'rgba(168,118,52,', text: '34,32,44', dim: '110,108,128', route: 'rgba(120,110,150,', vig: 'rgba(236,200,184,0.32)' }
      : { bg: '#030409', star: '230,236,255', gold: 'rgba(232,184,107,', text: '240,236,228', dim: '170,176,196', route: 'rgba(200,210,240,', vig: 'rgba(0,0,0,0.55)' };
  }
  tryEnter() {
    if (this.near) this.ev.onEnter(this.near);
  }

  // ---------- sizing ----------
  private exploreZoom() {
    // pulled back far enough that the next planet and the route are usually in view
    return Math.max(0.62, Math.min(1.02, Math.min(this.W, this.H) / 840));
  }
  /** Device pixels per sprite pixel: always a whole number, so the astronaut's pixels stay square. */
  private astroPx() {
    const px = Math.max(2, Math.round(((this.W < 700 ? 46 : 66) * this.dpr) / ASTRO.h));
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
      if (this.phase === 'bang') {
        this.bangRate = BANG_SKIP; // impatient? the rest plays in fast-forward
        return;
      }
      const p = pos(e);
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
      c.setPointerCapture(e.pointerId);
      this.pointer = { x: p.x, y: p.y, held: true, moved: false, downAt: performance.now() };
      this.auto = null;
    });
    const up = () => {
      if (this.pointer.held && performance.now() - this.pointer.downAt < 220) {
        // a quick click on empty space sets a waypoint
        const w = this.toWorld(this.pointer.x, this.pointer.y);
        this.auto = { x: w.x, y: w.y, zone: null };
      }
      this.pointer.held = false;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', () => (this.pointer.held = false));
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

    if (this.pointer.held && performance.now() - this.pointer.downAt > 120) {
      const w = this.toWorld(this.pointer.x, this.pointer.y);
      const dx = w.x - s.x;
      const dy = w.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d > 20) {
        ix = dx / d;
        iy = dy / d;
      }
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
        this.light = !this.light;
        if (this.light) this.ensureLightGalaxy();
        this.ev.onDimension(this.light);
        s.x = Math.cos(f.angle) * 175;
        s.y = Math.sin(f.angle) * 175;
        s.vx = Math.cos(f.angle) * 220;
        s.vy = Math.sin(f.angle) * 220;
        this.noticeAt = -99;
        this.notice(this.light ? 'You crossed the event horizon. This is light mode.' : 'Back through the horizon. Dark mode restored.');
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
    const zoom = this.cam.zoom;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const P = this.pal;
    g.fillStyle = P.bg;
    g.fillRect(0, 0, W, H);

    // deep-field stars with parallax
    for (const st of this.bg) {
      const par = [0.04, 0.08, 0.14, 0.34, 0.6][st.layer];
      const x = (((st.x * W * 1.3 - this.cam.x * par * zoom) % W) + W) % W;
      const y = (((st.y * H * 1.3 - this.cam.y * par * zoom) % H) + H) % H;
      const tw = this.reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(this.time * 1.5 + st.p);
      let lit = 1;
      if (this.phase === 'bang') {
        // the first stars switch on one at a time, each with a brief flare
        const at = 0.35 + (st.p / 6) * 0.38;
        const since = this.bangT / BANG_TIME - at;
        if (since <= 0) continue;
        lit = Math.min(1, since / 0.03) * (1 + 1.6 * Math.exp(-since * 45));
      }
      g.fillStyle = `rgba(${P.star},${Math.min(1, st.a * tw * lit)})`;
      g.fillRect(x, y, st.s, st.s);
    }
    if (this.shoot && !this.reducedMotion) {
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
    if (this.phase === 'void') {
      // before the big bang there is only the singularity: one point, waiting
      // centred on big screens; moved clear of the title text on phones and short landscape screens
      const { cx, cy } = this.singularity();
      const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 1.6);
      const halo = g.createRadialGradient(cx, cy, 0, cx, cy, 46 + pulse * 22);
      halo.addColorStop(0, `${P.gold}${0.5 + pulse * 0.3})`);
      halo.addColorStop(0.25, `${P.gold}0.12)`);
      halo.addColorStop(1, `${P.gold}0)`);
      g.fillStyle = halo;
      g.fillRect(cx - 70, cy - 70, 140, 140);
      g.fillStyle = `rgba(${P.text},0.95)`;
      g.beginPath();
      g.arc(cx, cy, 1.8, 0, Math.PI * 2);
      g.fill();
      g.font = '500 10px "IBM Plex Mono", monospace';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillStyle = `rgba(${P.dim},0.8)`;
      g.fillText('t = 0', cx + 16, cy - 14);
      return;
    }
    const live = this.phase === 'live';
    const bk = live ? 1 : this.bangT / BANG_TIME;

    g.save();
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
      g.rotate((1 - ge) * -1.5);
      g.scale(0.8 + ge * 0.2, 0.8 + ge * 0.2);
    }
    g.drawImage(this.light && this.galaxyLight ? this.galaxyLight : this.galaxy, -TEX_WORLD / 2, -TEX_WORLD / 2, TEX_WORLD, TEX_WORLD);
    g.restore();
    if (!live) this.drawDebris(g, bk);
    const coreA = live ? 1 : smooth(0.4, 0.58, bk);
    if (coreA > 0.01) {
      g.save();
      g.globalAlpha = coreA;
      drawCore(g, t, this.light, this.light && this.coreTexLight ? this.coreTexLight : this.coreTex);
      g.restore();
    }
    void CORE_WORLD;

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
        g.strokeStyle = `${P.gold}${0.16 * zp.e * (1 - settle)})`;
        g.lineWidth = 1 / zoom;
        g.beginPath();
        g.arc(0, 0, zp.r, 0, Math.PI * 2);
        g.stroke();
        // a comet-like trail along the orbit, longer while it moves fast
        const len = Math.min(1.6, zp.w * 0.12);
        if (len > 0.02) {
          for (let s2 = 0; s2 < 6; s2++) {
            g.strokeStyle = `rgba(${P.star},${(0.32 * (6 - s2)) / 6 * zp.e})`;
            g.lineWidth = (z.look.r * 0.5 * (6 - s2)) / 6;
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

    for (const [i, z] of zones.entries()) {
      const h = this.hover.get(z.id) ?? 0;
      const zp = this.zpos(z, i);
      if (zp.e <= 0) continue;
      g.save();
      g.translate(zp.x, zp.y);
      if (zp.e < 1) g.scale(0.12 + zp.e * 0.88, 0.12 + zp.e * 0.88);
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
        // a molten ember: a glow that fades as the planet cools
        const R = z.look.r * (1.2 + zp.hot * 1.6);
        const gl = g.createRadialGradient(0, 0, 0, 0, 0, R);
        const c = this.light ? '255,226,190' : '255,248,236';
        gl.addColorStop(0, `rgba(${c},${Math.min(1, zp.hot * 1.15)})`);
        gl.addColorStop(0.45, `rgba(${this.light ? '250,190,150' : '255,200,140'},${zp.hot * 0.55})`);
        gl.addColorStop(1, `rgba(${c},0)`);
        const prev = g.globalCompositeOperation;
        if (!this.light) g.globalCompositeOperation = 'lighter';
        g.fillStyle = gl;
        g.beginPath();
        g.arc(0, 0, R, 0, Math.PI * 2);
        g.fill();
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
    const compact = this.overview && this.W < 700;
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
    const other = this.light ? 'DARK' : 'LIGHT';
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
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, P.vig);
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);

    // the big bang. There is no blast wave, because there is nothing outside it to blast into:
    // all of space is filled with a white-hot glow that cools through yellow and red until it turns transparent.
    if (!live) {
      const c = this.toScreen(0, 0);
      const big = Math.max(W, H);
      if (bk < 0.045) {
        // inflation: from a point to everything, almost at once
        const u = bk / 0.045;
        const R = big * 1.7 * u * u + 2;
        const o = this.singularity(); // it bursts out of the very point that was waiting on the title screen
        const fl = g.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, R);
        fl.addColorStop(0, `rgba(${cool(0, this.light)},1)`);
        fl.addColorStop(0.72, `rgba(${cool(0, this.light)},1)`);
        fl.addColorStop(1, `rgba(${cool(0, this.light)},0)`);
        g.fillStyle = fl;
        g.fillRect(0, 0, W, H);
      } else if (bk < 0.36) {
        const u = (bk - 0.045) / 0.3; // 0 white-hot, 1 cooled
        const al = 1 - smooth(0.55, 1, u);
        const glow = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, big * 0.8);
        glow.addColorStop(0, `rgba(${cool(u * 0.92, this.light)},${al})`);
        glow.addColorStop(1, `rgba(${cool(u, this.light)},${al * 0.94})`);
        g.fillStyle = glow;
        g.fillRect(0, 0, W, H);
        // faint hotter and cooler patches, the seeds of everything that forms later; they stretch as space does
        const m = (this.mottle ??= buildMottle());
        const ma = al * smooth(0.08, 0.45, u) * (this.light ? 0.5 : 0.8);
        if (ma > 0.01) {
          const sz = big * (1.25 + u * 0.55);
          g.save();
          g.globalAlpha = ma;
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = 'high';
          g.drawImage(m, c.x - sz / 2, c.y - sz / 2, sz, sz);
          g.restore();
        }
      }
      // a small clock: where in the real story this moment sits
      let ei = 0;
      for (let i = 0; i < EPOCHS.length; i++) if (bk >= EPOCHS[i][0]) ei = i;
      const [e0, when, what] = EPOCHS[ei];
      const e1 = ei + 1 < EPOCHS.length ? EPOCHS[ei + 1][0] : 1.01;
      const ea = Math.min(smooth(e0, e0 + 0.025, bk), 1 - smooth(e1 - 0.025, e1, bk));
      const onGlow = bk < 0.2 && !this.light; // dark type while the screen is bright
      const ink = onGlow ? '40,30,24' : P.text;
      const y = H - (W < 700 ? 148 : 124);
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
      const goingLight = this.flip.switched ? this.light : !this.light;
      const c = goingLight ? '246,241,234' : '3,4,9';
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


/** A fine blotchy texture: slightly hotter and cooler patches in the early glow. */
function buildMottle() {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 1500; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const r = 2 + rnd() * rnd() * 9;
    const hot = rnd() < 0.5;
    const a = 0.08 + rnd() * 0.2;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, hot ? `rgba(255,250,235,${a})` : `rgba(150,10,24,${a * 1.25})`);
    gr.addColorStop(1, hot ? 'rgba(255,250,235,0)' : 'rgba(150,10,24,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}
