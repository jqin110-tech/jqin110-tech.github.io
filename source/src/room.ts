// Every planet opens onto a small place you walk through. This file is what those places share: the astronaut on foot,
// the airlock he comes in by and the exit he leaves by, the helmet, the camera, and the panel of plain HTML under the scene
// that carries the same words and links, so nothing here depends on the canvas. Each place (museum.ts, places.ts) supplies
// its own wall, floor and the things on the wall you walk up to.
import { copyButton } from './copy';
import type { Link } from './data';
import { drawHelmet, drawVisitor, VISITOR } from './draw';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const ease = (k: number) => k * k * (3 - 2 * k);
export const hash = (a: number, b: number) => {
  const q = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return q - Math.floor(q);
};

/** Something on the wall you can walk up to. Its words go in the panel under the scene. */
export interface Stop {
  title: string;
  meta?: string;
  /** HTML, already escaped. */
  body: string;
  links?: Link[];
  accent: string;
  /** A project whose room on the page below this stop can jump to. */
  room?: string;
  /** The box it takes on the wall, set by the scene's layout(). Centred on `cy` (the scene's eye line unless given). */
  w: number;
  h: number;
  cy?: number;
  /** Extra room to its right, for a label beside it. */
  after?: number;
  /** Space before the next stop, when the default is too wide. */
  gap?: number;
}
interface Box {
  x: number;
  w: number;
  h: number;
}
type Ctx = CanvasRenderingContext2D;

/** What a scene is handed: the canvas, the measurements of the room as it is now, and a few shared brushes. */
export interface Env {
  g: Ctx;
  light: boolean;
  calm: boolean;
  DISPLAY: string;
  MONO: string;
  /** A CSS custom property from the page, such as a project colour. */
  css: (name: string) => string;
  // sizes in CSS pixels; `u` is one hundredth of the room's height
  vw: number;
  vh: number;
  u: number;
  dpr: number;
  size: number;
  floorY: number;
  cy: number;
  width: number;
  door: Box;
  exit: Box;
  plinth: Box;
  wallText: { x: number; w: number };
  cam: number;
  k: number;
  /** How strongly each stop is lit: 1 when you stand at it. */
  glow: number[];
  at: (i: number) => number;
  feet: (z: number) => number;
  /** The galaxy outside, for a window. It slides by more slowly than the wall. */
  sky: (x0: number, x1: number, top: number, h: number, t: number) => void;
  poly: (pts: number[], fill: string) => void;
  /** A mitred moulding lit from above. Returns the rectangle left inside it. */
  moulding: (l: number, t: number, w: number, h: number, b: number, top: string, side: string, bottom: string) => [number, number, number, number];
  wrap: (s: string, max: number) => string[];
}

export interface Scene {
  /** What a stop is called in the panel: "Picture 2 of 4". */
  noun: string;
  /** One sentence for screen readers saying what the place is. */
  aria: string;
  /** The words on the wall as you come in. */
  intro: { kicker: string; title: string; sub: string };
  /** Indoors the helmet comes off and waits on a plinth. Outdoors it stays on. */
  helmetOff: boolean;
  ink: { base: string; text: string; strong: string; line: string; shadow: string; trim: string; door: string; doorLine: string; plinth: string; plinthTop: string };
  stops: Stop[];
  /** Size every stop for the room as it is now, and build anything drawn once (a floor pattern). */
  layout: () => void;
  wall: (x0: number, x1: number, t: number) => void;
  floor: (x0: number, x1: number) => void;
  stop: (i: number, cx: number, glow: number, e: number, t: number) => void;
  /** Things standing on the floor. Called once for those behind the astronaut and once for those in front. */
  props?: (x0: number, x1: number, front: boolean, feetY: number) => void;
}
export type SceneFactory = (env: Env) => Scene;

const SKY = {
  dark: { glass: '#04050b', dot: 'rgba(240,236,228,0.85)', nebula: ['rgba(120,90,220,0.4)', 'rgba(60,130,220,0.3)', 'rgba(230,120,90,0.2)'], core: '255,244,226', halo: '150,160,255' },
  light: { glass: '#d7dff0', dot: 'rgba(90,80,130,0.55)', nebula: ['rgba(214,170,230,0.7)', 'rgba(160,200,240,0.7)', 'rgba(250,200,190,0.6)'], core: '255,255,255', halo: '190,170,235' },
};

export function roomMarkup(touch: boolean): string {
  return `<div class="mu" data-museum>
    <div class="mu-stage">
      <canvas class="mu-canvas" tabindex="0" role="img"></canvas>
      <p class="mu-hint mono" data-mu-hint>${touch ? 'Tap the floor to walk · tap something to look' : 'Arrows or WASD to walk · E to look closer · click to walk there'}</p>
    </div>
    <div class="mu-info">
      <button class="mu-step" data-mu-prev aria-label="Previous"><span aria-hidden="true">←</span></button>
      <div class="mu-text" data-mu-text aria-live="polite"></div>
      <button class="mu-step" data-mu-next aria-label="Next"><span aria-hidden="true">→</span></button>
    </div>
  </div>`;
}

interface Opts {
  calm: boolean;
  /** Leave for this project's room on the page below. */
  onRoom: (project: string) => void;
  /** The astronaut has walked out of a door: close the place. */
  onExit: () => void;
}

/** Starts a place inside `host` (the markup above). Returns a function that shuts it down. */
export function mountRoom(host: HTMLElement, dialog: HTMLDialogElement, opts: Opts, make: SceneFactory): () => void {
  const canvas = host.querySelector('canvas')!;
  const g = canvas.getContext('2d')!;
  const text = host.querySelector<HTMLElement>('[data-mu-text]')!;
  const hint = host.querySelector<HTMLElement>('[data-mu-hint]')!;
  const prevBtn = host.querySelector<HTMLButtonElement>('[data-mu-prev]')!;
  const nextBtn = host.querySelector<HTMLButtonElement>('[data-mu-next]')!;
  const css = getComputedStyle(document.documentElement);
  const light = document.documentElement.classList.contains('other-side');
  const S = light ? SKY.light : SKY.dark;
  const DISPLAY = css.getPropertyValue('--display').trim() || 'sans-serif';
  const MONO = css.getPropertyValue('--mono').trim() || 'monospace';

  // ---------------------------------------------------------------- the room
  let vw = 0;
  let vh = 0;
  let u = 1;
  let dpr = 1;
  let size = 3; // CSS pixels per sprite pixel
  let width = 0;
  let cy = 0;
  let floorY = 0;
  let zNear = 0;
  let zFar = 0;
  let door: Box = { x: 0, w: 0, h: 0 };
  let exit: Box = { x: 0, w: 0, h: 0 };
  let plinth: Box = { x: 0, w: 0, h: 0 };
  let wallText = { x: 0, w: 0 };
  const xs: number[] = [];
  const feet = (z: number) => lerp(zFar, zNear, z);

  const poly = (pts: number[], fill: string) => {
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  };
  const moulding: Env['moulding'] = (l, t, w, h, b, top, side, bottom) => {
    poly([l, t, l + w, t, l + w - b, t + b, l + b, t + b], top);
    poly([l, t + h, l + w, t + h, l + w - b, t + h - b, l + b, t + h - b], bottom);
    poly([l, t, l + b, t + b, l + b, t + h - b, l, t + h], side);
    poly([l + w, t, l + w - b, t + b, l + w - b, t + h - b, l + w, t + h], side);
    return [l + b, t + b, w - b * 2, h - b * 2];
  };
  const wrap = (s: string, max: number) => {
    const lines: string[] = [];
    let cur = '';
    for (const word of s.split(' ')) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && g.measureText(next).width > max) {
        lines.push(cur);
        cur = word;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const stars = Array.from({ length: 110 }, (_, i) => ({ x: hash(i, 1), y: hash(i, 2), s: 0.5 + hash(i, 3) * 1.2, ph: hash(i, 4) * 6.28 }));
  const sky: Env['sky'] = (x0, x1, top, h, t) => {
    g.save();
    g.beginPath();
    g.rect(x0, top, x1 - x0, h);
    g.clip();
    g.fillStyle = S.glass;
    g.fillRect(x0, top, x1 - x0, h);
    const drift = cam * 0.5;
    const blob = (sx: number, sy: number, rx: number, ry: number, col: string) => {
      const wx = drift + sx;
      if (wx + rx < x0 || wx - rx > x1) return;
      g.save();
      g.translate(wx, sy);
      g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, col);
      gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = gr;
      g.fillRect(-rx, -rx, rx * 2, rx * 2);
      g.restore();
    };
    const reach = vw * 0.9;
    const tall = Math.max(h, 9 * u);
    for (let b = -1; b < 6; b++) {
      blob(b * reach + reach * 0.2, top + h * 0.7, reach * 0.34, tall * 1.5, S.nebula[0]);
      blob(b * reach + reach * 0.62, top + h * 0.2, reach * 0.28, tall * 1.3, S.nebula[1]);
      blob(b * reach + reach * 0.9, top + h * 0.9, reach * 0.2, tall * 1.1, S.nebula[2]);
    }
    g.fillStyle = S.dot;
    const period = 900;
    // a taller window shows more of the same sky, so more rows of stars
    const rows = Math.max(1, Math.round(h / (9 * u)));
    for (let b = Math.floor((x0 - drift) / period); b <= Math.floor((x1 - drift) / period); b++) {
      for (let r = 0; r < rows; r++) {
        for (const s of stars) {
          const sx = drift + (b + ((s.x + r * 0.37) % 1)) * period;
          if (sx < x0 || sx > x1) continue;
          g.globalAlpha = opts.calm ? 0.75 : 0.4 + 0.6 * Math.abs(Math.sin(t * 0.6 + s.ph + r));
          g.fillRect(sx, top + 1 + ((r + s.y) / rows) * (h - 3), s.s, s.s);
        }
      }
    }
    g.globalAlpha = 1;
    // a small spiral galaxy, tilted, with a bright core
    const gx = drift + vw * 0.66;
    const gr0 = Math.min(h, 14 * u);
    if (gx > x0 - gr0 * 3 && gx < x1 + gr0 * 3) {
      g.save();
      g.translate(gx, top + h * 0.48);
      g.rotate(-0.32);
      g.scale(1, 0.36);
      const r = gr0 * 1.9;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, `rgba(${S.core},0.95)`);
      gr.addColorStop(0.12, `rgba(${S.core},0.7)`);
      gr.addColorStop(0.4, `rgba(${S.halo},0.32)`);
      gr.addColorStop(1, `rgba(${S.halo},0)`);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.restore();
  };

  const env: Env = {
    g, light, calm: opts.calm, DISPLAY, MONO,
    css: (name) => css.getPropertyValue(name).trim(),
    vw: 0, vh: 0, u: 1, dpr: 1, size: 3, floorY: 0, cy: 0, width: 0,
    door, exit, plinth, wallText, cam: 0, k: 1, glow: [],
    at: (i) => xs[i] ?? 0,
    feet, sky, poly, moulding, wrap,
  };
  const scene = make(env);
  const stops = scene.stops;
  const n = stops.length;
  const C = scene.ink;
  stops.forEach((_, i) => (env.glow[i] = 0));
  canvas.setAttribute('aria-label', `${scene.aria} Use the arrow keys to walk and E to look closer. Walk to the exit door at the far end to leave.`);
  const eye = (i: number) => stops[i].cy ?? cy;

  // ---------------------------------------------------------------- the visitor and the view
  let x = 0;
  let z = 0.5; // 0 = up against the wall, 1 = nearest to you
  let vx = 0;
  let vz = 0; // in pixels a second down the screen
  let face = 1;
  let stepT = 0;
  let walking = false;
  let cam = 0;
  let dest: { x: number; z: number; brisk: boolean; look: boolean } | null = null;
  let near = -1;
  let look = false;
  let zoom = 0;
  let moved = false;
  let dragging = false;
  let placed = false;
  const keys = new Set<string>();
  // coming in: the door opens, a few steps to the plinth, the helmet comes off, then on to the first stop
  let intro: 'door' | 'walk' | 'doff' | null = opts.calm ? null : 'door';
  let introT = 0;
  let helmetOn = !opts.calm || !scene.helmetOff;
  let helmetFly = 0; // 0 to 1 while the helmet travels from head to plinth
  let doorOpen = 0;
  // going out: the helmet comes back from its plinth, the door opens, and the astronaut walks through it
  let outro: 'call' | 'leave' | 'gone' | null = null;
  let outroT = 0;
  let outBy: 'in' | 'out' = 'out';
  let helmetBack = 0; // 0 to 1 while the helmet travels from plinth to head
  let exitOpen = 0;
  let leftDoor = false; // has stepped away from the door he came in by
  const mid = (d: Box) => d.x + d.w / 2;

  const html = (i: number) => {
    const s = stops[i];
    const links = (s.links ?? [])
      .map((l) =>
        l.url.startsWith('mailto:')
          ? copyButton(l.label, 'linkish')
          : `<a class="linkish" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`,
      )
      .join('');
    return `<p class="mono mu-count">${esc(scene.noun)} ${i + 1} of ${n}</p>
      <h3 class="mu-name">${esc(s.title)}${s.meta ? `<span class="mono">${esc(s.meta)}</span>` : ''}</h3>
      <p class="mu-tag">${s.body}</p>
      <p class="mu-links">
        <button class="linkish" data-mu-look>${look ? 'Step back' : 'Look closer'}</button>
        ${links}
        ${s.room ? '<button class="linkish" data-mu-room>See the room ↓</button>' : ''}
      </p>`;
  };
  const say = () => {
    text.style.setProperty('--acc', stops[near].accent);
    text.innerHTML = html(near);
    prevBtn.disabled = near === 0;
    nextBtn.disabled = near === n - 1;
  };
  // the panel keeps the height of its longest entry, so the scene above it never jumps as you walk
  let measuredW = -1;
  const measure = () => {
    measuredW = vw;
    text.style.minHeight = '';
    let tall = 0;
    for (let i = 0; i < n; i++) {
      text.innerHTML = html(i);
      tall = Math.max(tall, text.offsetHeight);
    }
    text.style.minHeight = `${tall}px`;
    if (near >= 0) say();
    else text.innerHTML = '';
  };
  const setLook = (on: boolean) => {
    if (on === look) return;
    look = on;
    const b = text.querySelector<HTMLElement>('[data-mu-look]');
    if (b) b.textContent = look ? 'Step back' : 'Look closer';
  };
  /** Any input ends the walk-in at once: the helmet is simply off and on its plinth. */
  const wake = () => {
    moved = true;
    if (!intro) return;
    intro = null;
    helmetOn = !scene.helmetOff;
    helmetFly = 0;
    dest = null;
  };
  /** Head out through a door: helmet first. */
  const leave = (by: Box) => {
    if (outro) return;
    if (opts.calm) {
      opts.onExit();
      return;
    }
    wake();
    outro = helmetOn ? 'leave' : 'call';
    outroT = 0;
    outBy = by === exit ? 'out' : 'in';
    dest = null;
    dragging = false;
    keys.clear();
    setLook(false);
    face = 1;
    if (!helmetOn) helmetBack = 0.001;
  };
  /** Where you stand to look at a stop: in front of it, a step back from the wall. */
  const spot = (i: number) => ({ x: xs[i], z: 0.3 });
  const goTo = (i: number, thenLook = false) => {
    if (outro) return;
    wake();
    const to = clamp(i, 0, n - 1);
    if (opts.calm) {
      // reduced motion: no walk, just be there
      ({ x, z } = spot(to));
      vx = vz = 0;
      dest = null;
      cam = clamp(x - vw / 2, 0, width - vw);
      setLook(thenLook);
      return;
    }
    dest = { ...spot(to), brisk: true, look: thenLook };
    setLook(false);
  };

  const layout = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const off = placed && near >= 0 ? x - xs[near] : 0;
    vw = w;
    vh = h;
    u = vh / 100;
    dpr = Math.max(1, Math.min(2, devicePixelRatio || 1, Math.sqrt(3.2e6 / (vw * vh)))); // a pixel budget, as in the galaxy
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    size = vh < 330 ? 2 : 3;
    cy = 39 * u;
    floorY = 66 * u;
    zFar = floorY + 2.5 * u;
    zNear = vh - 4.5 * u;
    door = { x: 8 * u, w: 22 * size, h: 30 * size };
    plinth = scene.helmetOff ? { x: door.x + door.w + 14 * u, w: 19 * size, h: 12 * size } : { x: door.x + door.w, w: 0, h: 0 };
    wallText = { x: plinth.x + plinth.w / 2 + 12 * u, w: 40 * u };
    Object.assign(env, { vw, vh, u, dpr, size, cy, floorY, door, plinth, wallText });
    scene.layout();
    const space = Math.max(9 * u, vw * 0.06);
    let cx = Math.max(vw / 2, wallText.x + wallText.w + 8 * u + stops[0].w / 2);
    stops.forEach((s, i) => {
      if (i) {
        const p = stops[i - 1];
        cx += p.w / 2 + (p.after ?? 0) + (p.gap ?? space) + s.w / 2;
      }
      xs[i] = cx;
    });
    const last = stops[n - 1];
    exit = { x: xs[n - 1] + last.w / 2 + (last.after ?? 0) + space / 2 + 9 * u, w: door.w, h: door.h };
    width = Math.max(xs[n - 1] + vw / 2, exit.x + exit.w + 12 * u);
    Object.assign(env, { exit, width });
    if (placed && near >= 0) x = xs[near] + off;
    cam = clamp(x - vw / 2, 0, width - vw);
    if (vw !== measuredW) measure();
  };

  // ---------------------------------------------------------------- drawing
  // The room is drawn in its own coordinates, then scaled about a focus point to look closer.
  let k = 1;
  let fx = 0;
  let fyv = 0;
  const view = () => {
    const e = ease(zoom);
    const i = Math.max(0, near);
    const K = Math.min((vw * 0.94) / stops[i].w, (vh * 0.94) / stops[i].h);
    k = lerp(1, K, e);
    fx = lerp(cam + vw / 2, xs[i], e);
    fyv = lerp(vh / 2, eye(i), e);
    env.cam = cam;
    env.k = k;
  };
  const world = () => g.setTransform(dpr * k, 0, 0, dpr * k, dpr * (vw / 2 - k * fx), dpr * (vh / 2 - k * fyv));
  /** A point in the room, as device pixels. */
  const screen = (wx: number, wy: number): [number, number] => [dpr * (vw / 2 + k * (wx - fx)), dpr * (vh / 2 + k * (wy - fyv))];
  const spx = () => Math.max(1, Math.round(dpr * size * k));

  const drawDoor = (d: Box, open: number, t: number, way: 'in' | 'out') => {
    const { x: l, w, h } = d;
    const top = floorY - h;
    const b = 1.1 * u;
    // the frame around the airlock
    g.fillStyle = C.trim;
    g.fillRect(l - b, top - b, w + b * 2, h + b);
    g.save();
    g.beginPath();
    g.rect(l, top, w, h);
    g.clip();
    // outside: the galaxy you flew in from
    g.fillStyle = S.glass;
    g.fillRect(l, top, w, h);
    const gr = g.createRadialGradient(l + w * 0.6, top + h * 0.35, 0, l + w * 0.6, top + h * 0.35, h * 0.7);
    gr.addColorStop(0, S.nebula[0]);
    gr.addColorStop(1, S.nebula[0].replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr;
    g.fillRect(l, top, w, h);
    g.fillStyle = S.dot;
    for (let i = 0; i < 26; i++) {
      g.globalAlpha = opts.calm ? 0.7 : 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i));
      g.fillRect(l + hash(i, 9) * w, top + hash(i, 8) * h, 1, 1);
    }
    g.globalAlpha = 1;
    // two panels that slide apart
    const slide = ease(open) * (w / 2);
    for (const s of [-1, 1]) {
      const pl = s < 0 ? l - slide : l + w / 2 + slide;
      g.fillStyle = C.door;
      g.fillRect(pl, top, w / 2, h);
      g.strokeStyle = C.doorLine;
      g.lineWidth = 1;
      g.strokeRect(pl + 0.5, top + 0.5, w / 2 - 1, h - 1);
      // a narrow pane in each panel
      g.fillStyle = S.glass;
      g.fillRect(pl + w / 4 - 0.5 * u, top + h * 0.16, u, h * 0.3);
    }
    g.restore();
    if (way === 'in') {
      // status light over the airlock
      g.fillStyle = open > 0.5 ? '#7ff0d0' : C.text;
      g.fillRect(l + w / 2 - 0.4 * u, top - b - 1.6 * u, 0.8 * u, 0.8 * u);
      return;
    }
    // a lit sign over the way out
    const f = clamp(2 * u, 7, 10);
    g.font = `600 ${f}px ${MONO}`;
    const sw = g.measureText('EXIT').width + f * 1.5;
    const sh = f * 2;
    const st = top - b - sh - 1.6 * u;
    g.save();
    g.shadowColor = 'rgba(70,215,150,0.6)';
    g.shadowBlur = light ? 6 : 14;
    g.fillStyle = '#1f8f62';
    g.fillRect(l + w / 2 - sw / 2, st, sw, sh);
    g.restore();
    g.fillStyle = '#f3fff9';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('EXIT', l + w / 2, st + sh / 2 + 0.5);
  };

  const plinthTop = () => floorY + 1.2 * u - plinth.h;
  const drawPlinth = () => {
    const l = plinth.x - plinth.w / 2;
    const top = plinthTop();
    g.fillStyle = C.shadow;
    g.globalAlpha = 0.5;
    g.fillRect(l - 2, floorY + 1.2 * u - 1, plinth.w + 4, 0.9 * u);
    g.globalAlpha = 1;
    g.fillStyle = C.plinth;
    g.fillRect(l, top, plinth.w, plinth.h);
    g.fillStyle = C.plinthTop;
    g.fillRect(l, top - 1.2 * u, plinth.w, 1.2 * u);
    g.strokeStyle = C.line;
    g.globalAlpha = 0.5;
    g.strokeRect(l + 0.5, top - 1.2 * u + 0.5, plinth.w - 1, plinth.h + 1.2 * u - 1);
    g.globalAlpha = 1;
  };

  const drawWallText = () => {
    // the words at the start of a show
    const l = wallText.x;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = C.text;
    g.font = `500 ${clamp(1.9 * u, 7, 10)}px ${MONO}`;
    g.fillText(scene.intro.kicker.toUpperCase(), l, cy - 7 * u);
    g.fillStyle = C.strong;
    let f = clamp(6.4 * u, 17, 34);
    g.font = `300 ${f}px ${DISPLAY}`;
    // a long title steps down until it fits its patch of wall
    const tw = g.measureText(scene.intro.title).width;
    if (tw > wallText.w) {
      f *= wallText.w / tw;
      g.font = `300 ${f}px ${DISPLAY}`;
    }
    g.fillText(scene.intro.title, l - 0.03 * u, cy + 0.6 * u);
    g.fillStyle = C.text;
    g.font = `500 ${clamp(1.9 * u, 7, 10)}px ${MONO}`;
    g.fillText(scene.intro.sub, l, cy + 5 * u);
    g.fillStyle = C.line;
    g.fillRect(l, cy + 7.4 * u, 7 * u, 1);
  };

  const draw = (t: number) => {
    const e = ease(zoom);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.base;
    g.fillRect(0, 0, vw, vh);
    world();
    const x0 = fx - vw / 2 / k - 2;
    const x1 = fx + vw / 2 / k + 2;
    scene.wall(x0, x1, t);
    scene.floor(x0, x1);
    if (door.x + door.w + 20 > x0) drawDoor(door, doorOpen, t, 'in');
    if (exit.x - 40 < x1) drawDoor(exit, exitOpen, t, 'out');
    if (wallText.x + wallText.w > x0) drawWallText();
    if (scene.helmetOff && plinth.x + plinth.w > x0) {
      drawPlinth();
      if (!helmetOn && helmetFly === 0 && helmetBack === 0) {
        const [hx, hy] = screen(plinth.x, plinthTop() - 0.5 * u);
        g.setTransform(1, 0, 0, 1, 0, 0);
        drawHelmet(g, hx, hy, spx());
        world();
      }
    }
    stops.forEach((s, i) => {
      const reach = s.w / 2 + (s.after ?? 0) + 30 * u;
      if (xs[i] + reach < x0 || xs[i] - reach > x1) return;
      g.globalAlpha = 1;
      scene.stop(i, xs[i], env.glow[i], e, t);
    });
    g.globalAlpha = 1;

    // whatever stands on the floor, from the wall toward you
    const fy = feet(z);
    scene.props?.(x0, x1, false, fy);
    if (e < 0.6) {
      g.globalAlpha = 0.5 * (1 - e / 0.6);
      g.fillStyle = C.shadow;
      g.beginPath();
      g.ellipse(x, fy + 1, 7 * size, 1.5 * size, 0, 0, Math.PI * 2);
      g.fill();
      const [sx, sy] = screen(x, fy);
      g.setTransform(1, 0, 0, 1, 0, 0);
      // stepping through the door, he is gone
      g.globalAlpha = (1 - e / 0.6) * (outro === 'gone' ? clamp(1 - outroT / 0.3, 0, 1) : 1);
      drawVisitor(g, sx, sy, spx(), t, face, { helmet: helmetOn, step: walking ? stepT : null, calm: opts.calm });
      const head = fy - (VISITOR.h - VISITOR.helmetH) * size;
      if (helmetFly > 0) {
        // the helmet on its way from head to plinth
        const p = ease(helmetFly);
        const [qx, qy] = screen(lerp(x + face * size, plinth.x, p), lerp(head, plinthTop() - 0.5 * u, p) - Math.sin(p * Math.PI) * 5 * u);
        drawHelmet(g, qx, qy, spx());
      }
      if (helmetBack > 0) {
        // and on its way back: it lifts off the plinth and comes down over his head
        const p = ease(helmetBack);
        const [qx, qy] = screen(lerp(plinth.x, x + size, p), lerp(plinthTop() - 0.5 * u, head, p) - Math.sin(p * Math.PI) * 11 * u);
        drawHelmet(g, qx, qy, spx());
      }
      g.globalAlpha = 1;
      world();
    }
    scene.props?.(x0, x1, true, fy);
  };

  // ---------------------------------------------------------------- the loop
  let raf = 0;
  let last = 0;
  let activeAt = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    // 60 frames a second while he walks or the view moves, 30 while he stands and only the room is alive
    if (intro || outro || dest || keys.size > 0 || Math.hypot(vx, vz) > 1 || (look ? zoom < 1 : zoom > 0) || helmetFly > 0 || helmetBack > 0 || !placed) activeAt = now;
    if (now - last < (now - activeAt < 700 ? 1000 / 60 : 1000 / 30) - 3) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (!vw) layout();
    if (!vw) return;
    if (!placed) {
      placed = true;
      // start in the doorway, or with reduced motion already at the first stop
      if (intro) {
        x = mid(door);
        z = 0;
      } else ({ x, z } = spot(0));
      cam = clamp(x - vw / 2, 0, width - vw);
    }
    const walk = 62 * u;
    const depth = zNear - zFar;
    let wantX = 0;
    let wantZ = 0;

    if (intro === 'door') {
      introT += dt;
      if (introT > 0.75) {
        intro = 'walk';
        dest = scene.helmetOff ? { x: plinth.x - plinth.w / 2 - 9 * size, z: 0.14, brisk: false, look: false } : { ...spot(0), brisk: false, look: false };
      }
    } else if (intro === 'doff') {
      helmetFly = Math.min(1, helmetFly + dt / 0.6);
      if (helmetFly >= 1) {
        helmetFly = 0;
        intro = null;
        if (!moved) dest = { ...spot(0), brisk: false, look: false };
      }
    }
    if (outro === 'call') {
      helmetBack = Math.min(1, helmetBack + dt / 0.8);
      if (helmetBack >= 1) {
        helmetBack = 0;
        helmetOn = true;
        outro = 'leave';
        outroT = 0;
      }
    } else if (outro === 'leave') {
      // a beat for the door to open, then through it
      outroT += dt;
      if (outroT > 0.45 && !dest) dest = { x: mid(outBy === 'out' ? exit : door), z: 0, brisk: false, look: false };
    } else if (outro === 'gone') {
      outroT += dt;
      if (outroT > 0.4) {
        opts.onExit();
        return;
      }
    }

    const ix = outro ? 0 : (keys.has('R') ? 1 : 0) - (keys.has('L') ? 1 : 0);
    const iz = outro ? 0 : (keys.has('D') ? 1 : 0) - (keys.has('U') ? 1 : 0);
    if (ix || iz) {
      dest = null;
      setLook(false);
      const m = Math.hypot(ix, iz);
      wantX = (ix / m) * walk;
      wantZ = (iz / m) * walk * 0.6;
    } else if (dest) {
      const dx = dest.x - x;
      const dz = (dest.z - z) * depth;
      const d = Math.hypot(dx, dz);
      if (dest.look && d < 9 * u) {
        setLook(true);
        dest.look = false;
      }
      if (d < 1.5) {
        x = dest.x;
        z = dest.z;
        dest = null;
        if (outro === 'leave') {
          outro = 'gone';
          outroT = 0;
        }
        if (intro === 'walk') {
          if (scene.helmetOff) {
            intro = 'doff';
            helmetOn = false;
            helmetFly = 0.001;
            face = 1;
          } else intro = null;
        }
      } else {
        const sp = Math.min((dest.brisk ? 2 : 1) * walk, d * 7 + 0.4 * walk);
        wantX = (dx / d) * sp;
        wantZ = (dz / d) * sp;
      }
    }
    const grip = Math.min(1, dt * 14);
    vx += (wantX - vx) * grip;
    vz += (wantZ - vz) * grip;
    x = clamp(x + vx * dt, mid(door), mid(exit));
    z = clamp(z + (vz * dt) / depth, 0, 1);
    const speed = Math.hypot(vx, vz);
    walking = speed > walk * 0.12;
    if (walking) stepT += dt * clamp((speed / walk) * 6.5, 4, 9.5);
    if (Math.abs(vx) > walk * 0.08) face = vx > 0 ? 1 : -1;
    cam += (clamp(x - vw / 2, 0, width - vw) - cam) * Math.min(1, dt * 6);

    // walking into a door is how you leave: the exit at the far end, or back out the way you came
    const inDoor = (d: Box, deep: number) => Math.abs(x - mid(d)) < d.w * 0.4 && z < deep;
    if (!inDoor(door, 0.4)) leftDoor = true;
    if (!outro && !intro) {
      if (inDoor(exit, 2)) leave(exit); // the end of the room: standing in front of it is enough
      else if (leftDoor && inDoor(door, 0.1)) leave(door);
    }
    // a door opens to let him in, and again once he is suited up to go
    const going = outro === 'leave' || outro === 'gone';
    const wantIn = (!!intro && inDoor(door, 0.4)) || (going && outBy === 'in');
    const wantOut = going && outBy === 'out';
    doorOpen = clamp(doorOpen + (wantIn ? 1 : -1) * dt * 2.6, 0, 1);
    exitOpen = clamp(exitOpen + (wantOut ? 1 : -1) * dt * 2.6, 0, 1);

    let nearest = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x - xs[i]) < Math.abs(x - xs[nearest])) nearest = i;
    if (nearest !== near) {
      near = nearest;
      say();
    }
    stops.forEach((s, i) => {
      const want = i === near ? clamp(1.25 - Math.abs(x - xs[i]) / (s.w / 2 + 16 * u), 0, 1) : 0;
      env.glow[i] += (want - env.glow[i]) * Math.min(1, dt * 7);
    });
    zoom = opts.calm ? (look ? 1 : 0) : clamp(zoom + (look ? 1 : -1) * dt * 2.6, 0, 1);
    if (moved && hint.style.opacity !== '0') hint.style.opacity = '0';
    view();
    draw(now / 1000);
  };

  // ---------------------------------------------------------------- input
  const KEY: Record<string, string> = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D' };
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey || outro) return;
    const el = ev.target as HTMLElement | null;
    const onControl = !!el?.closest?.('button, a, input');
    if (KEY[ev.code]) {
      wake();
      keys.add(KEY[ev.code]);
    } else if (ev.code === 'KeyE' || (ev.code === 'Enter' && !onControl)) {
      wake();
      if (dest) dest.look = !dest.look;
      else setLook(!look);
    } else if (/^Digit[1-9]$/.test(ev.code) && Number(ev.code.slice(5)) <= n) goTo(Number(ev.code.slice(5)) - 1);
    else return;
    ev.preventDefault();
  };
  const onKeyUp = (ev: KeyboardEvent) => {
    if (KEY[ev.code]) keys.delete(KEY[ev.code]);
  };
  const onBlur = () => {
    keys.clear();
    dragging = false;
  };
  const point = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { wx: fx + (ev.clientX - r.left - vw / 2) / k, wy: fyv + (ev.clientY - r.top - vh / 2) / k };
  };
  /** Walk to where the pointer is: a spot on the floor, or the foot of the wall under it. */
  const walkTo = (wx: number, wy: number) => {
    dest = { x: clamp(wx, mid(door), mid(exit)), z: wy < floorY ? 0.12 : clamp((wy - zFar) / (zNear - zFar), 0, 1), brisk: false, look: false };
  };
  const onDown = (ev: PointerEvent) => {
    canvas.focus({ preventScroll: true });
    if (outro) return;
    wake();
    if (look) {
      setLook(false);
      return;
    }
    const { wx, wy } = point(ev);
    const hit = stops.findIndex((s, i) => Math.abs(wx - xs[i]) < s.w / 2 && Math.abs(wy - eye(i)) < s.h / 2);
    if (hit >= 0) {
      if (hit === near && !dest && Math.abs(x - xs[hit]) < 6 * u) setLook(true);
      else goTo(hit, true);
      return;
    }
    // a click on a door walks him out of it
    const onDoor = (d: Box) => wx > d.x && wx < d.x + d.w && wy > floorY - d.h && wy < floorY;
    if (onDoor(exit) || onDoor(door)) {
      leftDoor = true;
      dest = { x: mid(onDoor(exit) ? exit : door), z: 0.05, brisk: true, look: false };
      return;
    }
    walkTo(wx, wy);
    dragging = true;
    try {
      canvas.setPointerCapture(ev.pointerId);
    } catch {
      /* not every pointer can be captured */
    }
  };
  const onMove = (ev: PointerEvent) => {
    if (!dragging) return;
    const { wx, wy } = point(ev);
    walkTo(wx, wy);
  };
  const onUp = () => (dragging = false);
  // Esc steps back from what you are looking at before it closes the place
  const onCancel = (ev: Event) => {
    if (!look) return;
    ev.preventDefault();
    setLook(false);
  };
  const onClick = (ev: MouseEvent) => {
    const el = ev.target as HTMLElement;
    if (outro && !el.closest('[data-mu-room]')) return;
    if (el.closest('[data-mu-prev]')) goTo(near - 1, look);
    else if (el.closest('[data-mu-next]')) goTo(near + 1, look);
    else if (el.closest('[data-mu-look]')) {
      if (look) setLook(false);
      else goTo(near, true);
    } else if (el.closest('[data-mu-room]') && stops[near].room) opts.onRoom(stops[near].room!);
  };

  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  dialog.addEventListener('cancel', onCancel);
  host.addEventListener('click', onClick);
  const ro = new ResizeObserver(layout);
  ro.observe(canvas);
  canvas.focus({ preventScroll: true });
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    removeEventListener('keydown', onKeyDown);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('blur', onBlur);
    dialog.removeEventListener('cancel', onCancel);
  };
}
