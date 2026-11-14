// Scroll-driven set pieces for the resume. Each one is built on the site's own ideas:
// the golden spiral, the planets' colours and the pixel astronaut from the game above.
// Everything here is decoration on top of the plain resume, so it is hidden in print
// and collapses to a still layout when the visitor asks for reduced motion.
// On phones nothing is tied to the scroll position: things play once as they arrive, and the
// pinned set pieces become rows you swipe sideways, the way a phone app would do it.
import { resume } from './data';
import { drawAstronaut } from './draw';
import { projectPicture } from './gallery';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v: number, a = 0, b = 1) => {
  const k = clamp((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const PHI = (1 + Math.sqrt(5)) / 2;

// The 40 stocks Tickerchatter follows, in the order its pipeline lists them.
const TICKERS =
  'NVDA AMD MU INTC AVGO TSM ARM SMCI AAPL MSFT GOOGL AMZN META TSLA NFLX ORCL CRM ADBE PLTR CRWD SNOW SHOP UBER JPM GS BAC COIN BRK.B WMT COST DIS NKE SBUX MCD LLY PFE UNH BA XOM CVX'.split(
    ' ',
  );
// Out-of-sample rank of each stock's best in-sample moving-average pair, of 41 (backtester README).
const RANKS: [string, number][] = [
  ['MU', 28],
  ['AVGO', 26],
  ['MRVL', 36],
  ['AAPL', 30],
];

// ---------------------------------------------------------------- five numbers along the golden spiral
// Each stop borrows a planet colour (a CSS variable, so light mode gets its own shade).
const STOPS: [string, string, string][] = [
  ['40', 'stocks scored every hour', '--c-blue'],
  ['28 → 6', 'false spikes, traced to one bug', '--c-orange'],
  ['41', 'parameter pairs tested on unseen data', '--c-green'],
  ['12 / 15', 'folds where one line beat the model', '--c-violet'],
  ['240', 'automated tests across five projects', '--c-tan'],
];
const SAY = ['Some', 'numbers', 'from', 'things', 'I’ve', 'built.'];

export function spiralScene() {
  return `<section class="orbit motion" data-orbit>
    <div class="orbit-pin">
      <div class="orbit-canvas"><canvas aria-hidden="true"></canvas></div>
      <div class="orbit-side">
        <p class="mono orbit-kick">Five numbers, in the order the spiral reaches them</p>
        <p class="orbit-read" data-orbit-read aria-hidden="true"><b class="show"></b><span class="mono"></span></p>
        <p class="show orbit-say" data-orbit-say aria-label="${SAY.join(' ')}">${SAY.map((w) => `<span aria-hidden="true" class="${w === 'built.' ? 'key' : ''}">${w}</span>`).join(' ')}</p>
      </div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------- project stories: the chart stays, the notes scroll past
interface StoryDef {
  id: string;
  name: string;
  kick: string;
  steps: [string, string][];
  caps: string[];
}
const STORIES: StoryDef[] = [
  {
    id: 'ticker',
    name: 'Tickerchatter',
    kick: 'Case study · a spike detector for the news',
    steps: [
      ['Collect', 'Every hour a pipeline reads headlines for 40 large-cap stocks from Google News and Yahoo Finance, drops the duplicates and counts mentions per stock per day.'],
      ['Detect', 'Each stock is scored against its own 14-day baseline, comparing today so far with the same hours of earlier days. Two standard deviations above normal raises a flag.'],
      ['Fix', 'The first version flagged 28 of 40 stocks. I traced it to a 100-result search cap that packed results into today, sampled every day the same way, and it fell to 6.'],
    ],
    caps: ['40 stocks, mentions per day', 'one stock: 14 earlier days, then today', 'stocks flagged as spikes'],
  },
  {
    id: 'backtest',
    name: 'Backtester',
    kick: 'Case study · testing a trading rule honestly',
    steps: [
      ['Too good to be true', 'An early backtest beat the market by far too much. The strategy was trading on the same bar that produced its signal. Lagging signals by one bar removed the edge.'],
      ['The best settings were luck', 'I tested 41 moving-average pairs. The winner on past data ranked 26th to 36th of 41 on data it had never seen, on all four stocks.'],
      ['A model that lost to one line', 'A random forest beat the majority baseline by 5 to 9 points, then lost to a one-line volatility rule in 12 of 15 folds. I reported that.'],
    ],
    caps: ['illustration: equity with and without the bug', 'rank among 41 pairs, 1 is best', 'walk-forward folds won per stock (counts, not fold order)'],
  },
];

/** Page dots for the swipe rows on phones. Hidden everywhere else. */
export const dots = (n: number, what: string) =>
  `<div class="dots" data-dots>${Array.from({ length: n }, (_, i) => `<button type="button" aria-label="${what} ${i + 1} of ${n}"><i></i></button>`).join('')}</div>`;

/** Projects without a case study still get a room heading in the same voice. */
const BRIEFS: Record<string, string> = {
  'Gravity Simulator': 'Physics · from the solar system to a 100,000-body galaxy',
  'Brain Oxygen Model': 'Physiology · one equation, tested on data it never saw',
  'Resume Quest': 'This site · a galaxy you can fly through',
  'Banking System': 'Command-line app · the rules kept apart from the I/O',
};

/** The opening of a project's room: its case study if it has one, otherwise a short heading. */
export function story(name: string, i: number) {
  const p = resume.projects.find((x) => x.name === name)!;
  const s = STORIES.find((x) => x.name === name);
  const head = `<header class="story-head">
      <p class="mono story-kick">${esc(s?.kick ?? BRIEFS[name] ?? 'Project')}</p>
      <h3 class="show story-title">${esc(p.name)}</h3>
      <div class="story-intro">
        <div class="story-say">
          <p class="story-tag">${esc(p.tagline)}</p>
          <p class="story-links">${(p.links ?? []).map((l) => `<a class="linkish" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</p>
        </div>
        ${projectPicture(name)}
      </div>
    </header>`;
  if (!s) return `<section class="story story-brief motion">${head}</section>`;
  return `<section class="story motion ${i % 2 ? 'flip' : ''}" data-story="${s.id}">
    ${head}
    <div class="story-run">
      <figure class="story-stage">
        <div class="story-canvas"><canvas aria-hidden="true"></canvas></div>
        <figcaption class="mono" data-cap>${esc(s.caps[0])}</figcaption>
      </figure>
      <div class="story-cards">
        ${s.steps.map(([h, t], k) => `<article class="story-card"><p class="mono">${k + 1} of ${s.steps.length}</p><h4>${esc(h)}</h4><p>${esc(t)}</p></article>`).join('')}
      </div>
      ${dots(s.steps.length, 'Note')}
    </div>
  </section>`;
}

// ---------------------------------------------------------------- experience, sideways
export function sideways() {
  const xs = resume.experience;
  return `<section class="hx motion" data-hx>
    <div class="hx-pin">
      <header class="hx-head">
        <h2 class="show hx-title">Experience</h2>
        <p class="mono hx-note">Teaching, leading and volunteering, 2024 to 2026</p>
      </header>
      <div class="hx-ghost show" aria-hidden="true">2024 <i>·</i> 2025 <i>·</i> 2026</div>
      <div class="hx-track">
        ${xs
          .map(
            (x) => `<article class="hx-card">
          <p class="mono hx-dates">${esc(x.dates)}</p>
          <h3 class="show">${esc(x.title)}</h3>
          <p class="hx-org">${esc(x.org)}</p>
          <ul>${x.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
        </article>`,
          )
          .join('')}
      </div>
      ${dots(xs.length, 'Role')}
      <div class="hx-prog" aria-hidden="true"><b></b></div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------- the skill map: what I used, and where
// Left to right, ordered so that the links cross as little as possible.
const MAP_SKILLS = ['GitHub Actions', 'Pyodide', 'pytest', 'Python', 'pandas', 'scikit-learn', 'matplotlib', 'NumPy', 'Numba', 'unittest', 'TypeScript', 'Canvas 2D', 'Java', 'Racket'];
const MAP_PROJECTS = ['Gravity Simulator', 'Tickerchatter', 'Brain Oxygen Model', 'Backtester', 'Resume Quest', 'Banking System'];
/** Each project keeps the colour its room has, wherever it sits in the map. */
const MAP_COLOUR = MAP_PROJECTS.map((n) => resume.projects.findIndex((p) => p.name === n));
// used on this site, though not listed in its stack line
const MAP_EXTRA: Record<string, string[]> = {};

export function skillMap() {
  const known = new Set([...resume.skills.Languages, ...resume.skills['Libraries & tools']]);
  const skills = MAP_SKILLS.filter((s) => known.has(s));
  const links: [number, number][] = [];
  MAP_PROJECTS.forEach((name, pi) => {
    const p = resume.projects.find((x) => x.name === name);
    const uses = new Set([...(p?.stack ?? []), ...(MAP_EXTRA[name] ?? [])]);
    skills.forEach((s, si) => uses.has(s) && links.push([si, pi]));
  });
  return `<section class="smap motion" data-smap data-links="${links.map((l) => l.join('-')).join(' ')}">
    <header class="smap-head">
      <h2 class="show smap-title">Skills</h2>
      <p class="mono smap-note">What I used, and where. Point at a project to trace it.</p>
    </header>
    <div class="smap-grid">
      <ul class="smap-col smap-skills">${skills.map((s, i) => `<li data-s="${i}"><span>${esc(s)}</span><i></i></li>`).join('')}</ul>
      <svg class="smap-links" aria-hidden="true"></svg>
      <ul class="smap-col smap-projects">${MAP_PROJECTS.map((n, i) => `<li data-p="${i}" style="--pc:var(--p${MAP_COLOUR[i]})"><i></i><button class="show">${esc(n)}</button></li>`).join('')}</ul>
    </div>
    <p class="smap-foot"><span class="mono">Spoken</span>${resume.skills.Spoken.map(esc).join(', ')}</p>
  </section>`;
}

// ---------------------------------------------------------------- the graduation year, and the closing line
export function yearBand() {
  return `<p class="yr motion" data-yr aria-hidden="true"><span class="mono">Graduating</span><span class="show yr-n">20<span class="yr-roll"><span data-yr-strip>26<br>27<br>28<br>29<br>30<br>31</span></span></span></p>`;
}
export function closing() {
  const words = ['Thanks', 'for', 'flying', 'by.', '<em>Say</em>', '<em>hi.</em>'];
  return `<p class="closing show motion" data-closing>${words.map((w, i) => `<span style="--i:${i}"><b>${w}</b></span>`).join(' ')}</p>`;
}

// ---------------------------------------------------------------- canvas scenes
type Ctx = CanvasRenderingContext2D;
interface Ink {
  star: string;
  dim: string;
  acc: string;
  hair: string;
  bad: string;
}
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const SHOW = '"Bricolage Grotesque", "Jost", system-ui, sans-serif';

/** The spiral from the game, drawn as far as the scroll has reached, with the astronaut at its head. */
function drawOrbit(g: Ctx, w: number, h: number, p: number, c: Ink, colours: string[], dpr: number, calm: boolean) {
  const wide = w >= 620;
  const cx = w * (wide ? 0.5 : 0.5);
  const cy = h * 0.52;
  const R0 = Math.min(w * (wide ? 0.34 : 0.4), h * 0.37);
  const A0 = (200 * Math.PI) / 180;
  const at = (t: number) => {
    const r = R0 * Math.pow(PHI, (-2 * t) / Math.PI);
    return { x: cx + Math.cos(A0 + t) * r, y: cy + Math.sin(A0 + t) * r, r };
  };
  // stops sit at equal steps of arc length, exactly as the planets do in the game
  const END = 0.31;
  const ts = STOPS.map((_, i) => (Math.log(1 / (1 - (i / (STOPS.length - 1)) * (1 - END))) / Math.log(PHI)) * (Math.PI / 2));
  const span = ts[ts.length - 1];
  const tMax = span + Math.PI * 3.2;
  const e = calm ? 1 : smooth(p, 0.03, 0.62);
  const e2 = calm ? 1 : smooth(p, 0.6, 0.86);
  const head = e < 1 ? span * e : span + (tMax - span) * e2;

  // range rings and bearings, like the chart in the game
  g.lineWidth = 1;
  g.strokeStyle = c.hair;
  g.globalAlpha = 0.5;
  for (const k of [1, 0.655, 0.31]) {
    g.beginPath();
    g.arc(cx, cy, R0 * k, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 0.35;
  for (let a = 0; a < 12; a++) {
    const ang = (a * Math.PI) / 6;
    g.beginPath();
    g.moveTo(cx + Math.cos(ang) * R0 * 1.0, cy + Math.sin(ang) * R0 * 1.0);
    g.lineTo(cx + Math.cos(ang) * R0 * 1.05, cy + Math.sin(ang) * R0 * 1.05);
    g.stroke();
  }
  // the spiral so far
  g.globalAlpha = 1;
  g.lineWidth = 1.6;
  g.strokeStyle = c.star;
  g.beginPath();
  for (let t = 0; t <= Math.min(head, span) + 1e-6; t += 0.03) {
    const q = at(t);
    if (t === 0) g.moveTo(q.x, q.y);
    else g.lineTo(q.x, q.y);
  }
  g.stroke();
  if (head > span) {
    g.globalAlpha = 0.45;
    g.setLineDash([3, 5]);
    g.beginPath();
    for (let t = span; t <= head; t += 0.03) {
      const q = at(t);
      if (t === span) g.moveTo(q.x, q.y);
      else g.lineTo(q.x, q.y);
    }
    g.stroke();
    g.setLineDash([]);
  }
  // the centre it leads to
  g.globalAlpha = 0.25 + 0.75 * e2;
  g.fillStyle = c.star;
  g.beginPath();
  g.arc(cx, cy, 3.2, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.5 * e2;
  g.beginPath();
  g.arc(cx, cy, 8, 0, Math.PI * 2);
  g.stroke();

  // the stops
  STOPS.forEach(([num, cap], i) => {
    const k = calm ? 1 : smooth(head, ts[i] - 0.05, ts[i] + 0.22);
    if (k <= 0) return;
    const q = at(ts[i]);
    const ux = (q.x - cx) / q.r;
    const uy = (q.y - cy) / q.r;
    g.globalAlpha = k * 0.22;
    g.fillStyle = colours[i];
    g.beginPath();
    g.arc(q.x, q.y, 16 * k, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = k;
    g.beginPath();
    g.arc(q.x, q.y, 6, 0, Math.PI * 2);
    g.fill();
    // label, pushed outward from the centre and kept inside the frame
    const size = wide ? 30 : 19;
    g.font = `400 ${size}px ${SHOW}`;
    const nw = g.measureText(num).width;
    g.font = `500 11px ${MONO}`;
    const cw = wide ? g.measureText(cap).width : 0;
    const bw = Math.max(nw, cw);
    const bh = wide ? size + 18 : size;
    const off = 16 + (wide ? 10 : 4);
    let lx = q.x + ux * off + (ux > 0.25 ? 0 : ux < -0.25 ? -bw : -bw / 2);
    let ly = q.y + uy * off + (uy > 0.25 ? size * 0.9 : uy < -0.25 ? -bh + size * 0.9 : size * 0.35);
    lx = clamp(lx, 8, w - bw - 8);
    ly = clamp(ly, size + 4, h - (bh - size) - 8);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = colours[i];
    g.font = `400 ${size}px ${SHOW}`;
    g.fillText(num, lx, ly);
    if (wide) {
      g.fillStyle = c.dim;
      g.font = `500 11px ${MONO}`;
      g.fillText(cap, lx, ly + 17);
    }
  });
  g.globalAlpha = 1;

  // the astronaut from the game rides the head of the line
  if (!calm && p > 0.01 && e2 < 1) {
    const q = at(head);
    const ahead = at(head + 0.05);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const px = Math.max(1, Math.round(dpr * (wide ? 1.5 : 1)));
    g.globalAlpha = 1 - smooth(e2, 0.75, 1);
    drawAstronaut(g, q.x * dpr, (q.y - 4) * dpr, px, p * 40, ahead.x >= q.x ? 1 : -1, 1, false);
    g.restore();
  }
}

function drawTicker(g: Ctx, w: number, h: number, p: number, c: Ink) {
  const step = Math.min(2, Math.floor(p));
  const t = p - step;
  const pad = Math.max(14, w * 0.05);
  const cols = 8;
  const rows = 5;
  const cw = (w - pad * 2) / cols;

  if (step === 0) {
    // headlines arrive: each stock fills with a week of daily counts
    g.globalAlpha = 1 - smooth(t, 0.86, 1);
    const ch = (h - pad * 2) / rows;
    const r = rng(7);
    for (let i = 0; i < 40; i++) {
      const x = pad + (i % cols) * cw;
      const y = pad + Math.floor(i / cols) * ch;
      const k = smooth(t * 1.15, (i / 40) * 0.75, (i / 40) * 0.75 + 0.16);
      g.font = `500 ${Math.max(8, Math.min(11, cw * 0.2))}px ${MONO}`;
      g.fillStyle = c.dim;
      g.globalAlpha = (1 - smooth(t, 0.86, 1)) * (0.25 + 0.75 * k);
      g.textBaseline = 'top';
      g.fillText(TICKERS[i], x + 2, y + 2);
      const bw = (cw - 10) / 7;
      for (let d = 0; d < 7; d++) {
        const v = 0.25 + r() * 0.75;
        const kk = clamp(k * 7 - d);
        const bh = v * (ch - 30) * kk;
        g.fillStyle = c.star;
        g.globalAlpha = (1 - smooth(t, 0.86, 1)) * 0.75 * kk;
        g.fillRect(x + 2 + d * bw, y + ch - 8 - bh, Math.max(1, bw - 2), bh);
      }
    }
  } else if (step === 1) {
    // one stock: the baseline, the mean, the threshold, then today
    const fade = smooth(t, 0, 0.1) * (1 - smooth(t, 0.9, 1));
    const vals = [9, 11, 8, 12, 10, 9, 13, 10, 8, 11, 12, 9, 10, 11];
    const today = 17;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    const z = (today - mean) / sd;
    const x0 = pad + 6;
    const x1 = w - pad;
    const y0 = h - pad - 22;
    const top = pad + 34;
    const Y = (v: number) => y0 - (v / 20) * (y0 - top);
    const bw = (x1 - x0) / 15;
    g.globalAlpha = fade;
    g.strokeStyle = c.hair;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0, y0 + 0.5);
    g.lineTo(x1, y0 + 0.5);
    g.stroke();
    vals.forEach((v, i) => {
      const k = smooth(t, 0.08 + i * 0.02, 0.2 + i * 0.02);
      g.fillStyle = c.star;
      g.globalAlpha = fade * 0.55;
      g.fillRect(x0 + i * bw + bw * 0.16, Y(v * k), bw * 0.68, y0 - Y(v * k));
    });
    // mean and one standard deviation either side
    const m = smooth(t, 0.36, 0.54);
    g.globalAlpha = fade * 0.1 * m;
    g.fillStyle = c.star;
    g.fillRect(x0, Y(mean + sd), (x1 - x0) * m, Y(mean - sd) - Y(mean + sd));
    g.globalAlpha = fade * m;
    g.strokeStyle = c.dim;
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(x0, Y(mean));
    g.lineTo(x0 + (x1 - x0) * m, Y(mean));
    g.stroke();
    g.font = `500 11px ${MONO}`;
    g.fillStyle = c.dim;
    g.textBaseline = 'bottom';
    g.textAlign = 'left';
    g.fillText('mean', x0 + 4, Y(mean) - 4);
    // the flag line, two standard deviations up
    const th = smooth(t, 0.5, 0.66);
    g.globalAlpha = fade * th;
    g.strokeStyle = c.acc;
    g.beginPath();
    g.moveTo(x0, Y(mean + 2 * sd));
    g.lineTo(x0 + (x1 - x0) * th, Y(mean + 2 * sd));
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = c.acc;
    g.fillText('flag above z = 2', x0 + 4, Y(mean + 2 * sd) - 4);
    // today
    const up = smooth(t, 0.64, 0.84);
    g.globalAlpha = fade;
    g.fillStyle = c.acc;
    g.fillRect(x0 + 14 * bw + bw * 0.16, Y(today * up), bw * 0.68, y0 - Y(today * up));
    g.globalAlpha = fade * smooth(t, 0.78, 0.9);
    g.textAlign = 'right';
    g.font = `400 ${Math.max(26, w * 0.075)}px ${SHOW}`;
    g.fillText(`z = ${z.toFixed(1)}`, x1, Y(today) - 8);
    g.font = `500 11px ${MONO}`;
    g.fillStyle = c.dim;
    g.globalAlpha = fade;
    g.textBaseline = 'top';
    g.fillText('today so far', x1, y0 + 8);
    g.textAlign = 'left';
    g.fillText('14 earlier days, same hours', x0, y0 + 8);
  } else {
    // 28 flagged, then 6
    const fade = smooth(t, 0, 0.12);
    const k = smooth(t, 0.34, 0.8);
    const lit = Math.round(lerp(28, 6, k));
    const order = Array.from({ length: 40 }, (_, i) => i);
    const r = rng(23);
    for (let i = 39; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const on = new Set(order.slice(0, lit));
    const headH = Math.max(70, h * 0.26);
    g.globalAlpha = fade;
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = c.acc;
    g.font = `400 ${Math.max(54, w * 0.17)}px ${SHOW}`;
    const num = String(lit);
    g.fillText(num, pad, pad + headH * 0.82);
    const nw = g.measureText(num).width;
    g.fillStyle = c.dim;
    g.font = `500 12px ${MONO}`;
    g.fillText('of 40 stocks flagged', pad + nw + 12, pad + headH * 0.82 - 18);
    g.fillStyle = k < 0.5 ? c.bad : c.star;
    g.fillText(k < 0.5 ? 'too many to be true' : 'once every day is sampled the same way', pad + nw + 12, pad + headH * 0.82);
    const ch = (h - pad * 2 - headH) / rows;
    const rad = Math.min(cw, ch) * 0.26;
    for (let i = 0; i < 40; i++) {
      const x = pad + (i % cols) * cw + cw / 2;
      const y = pad + headH + Math.floor(i / cols) * ch + ch / 2;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      if (on.has(i)) {
        g.globalAlpha = fade;
        g.fillStyle = c.acc;
        g.fill();
      } else {
        g.globalAlpha = fade * 0.9;
        g.strokeStyle = c.hair;
        g.lineWidth = 1.2;
        g.stroke();
      }
    }
  }
  g.globalAlpha = 1;
}

function drawBacktest(g: Ctx, w: number, h: number, p: number, c: Ink) {
  const step = Math.min(2, Math.floor(p));
  const t = p - step;
  const pad = Math.max(14, w * 0.05);
  g.textBaseline = 'alphabetic';
  if (step === 0) {
    // an equity curve that is too good, pulled down to the honest one
    g.globalAlpha = 1 - smooth(t, 0.9, 1);
    const n = 70;
    const r = rng(5);
    const bench: number[] = [1];
    const fair: number[] = [1];
    for (let i = 1; i < n; i++) {
      const d = (r() - 0.4) * 0.05;
      bench.push(bench[i - 1] * (1 + d));
      fair.push(fair[i - 1] * (1 + d * 0.7 + (r() - 0.5) * 0.01));
    }
    const m = smooth(t, 0.46, 0.84);
    const strat = fair.map((v, i) => v * (1 + (1 - m) * 1.5 * Math.pow(i / n, 1.25)));
    const x0 = pad;
    const x1 = w - pad;
    const y0 = h - pad - 8;
    const top = pad + 48;
    const hi = Math.max(...fair.map((v, i) => v * (1 + 1.5 * Math.pow(i / n, 1.25))));
    const lo = Math.min(...bench, ...fair) * 0.96;
    const X = (i: number) => x0 + ((x1 - x0) * i) / (n - 1);
    const Y = (v: number) => y0 - ((v - lo) / (hi - lo)) * (y0 - top);
    const shown = Math.max(2, Math.round(n * smooth(t, 0, 0.3)));
    const line = (a: number[], col: string, lw: number) => {
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < shown; i++) (i ? g.lineTo(X(i), Y(a[i])) : g.moveTo(X(i), Y(a[i])));
      g.stroke();
    };
    g.strokeStyle = c.hair;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0, y0 + 0.5);
    g.lineTo(x1, y0 + 0.5);
    g.stroke();
    line(bench, c.dim, 1.4);
    line(strat, m < 0.5 ? c.bad : c.acc, 2.2);
    // legend, top left
    g.font = `500 11px ${MONO}`;
    g.textAlign = 'left';
    const key = (y: number, col: string, label: string) => {
      g.fillStyle = col;
      g.fillRect(x0, y - 4, 14, 2);
      g.fillText(label, x0 + 22, y);
    };
    key(pad + 8, m < 0.5 ? c.bad : c.acc, m < 0.5 ? 'strategy, trading on the signal bar' : 'strategy, position = signal.shift(1)');
    key(pad + 26, c.dim, 'buy and hold');
  } else if (step === 1) {
    // the in-sample winner slides down the ranking once it meets unseen data
    const fade = smooth(t, 0, 0.1) * (1 - smooth(t, 0.9, 1));
    const m = smooth(t, 0.26, 0.8);
    const labelW = 52;
    const rightW = 52;
    const x0 = pad + labelW;
    const x1 = w - pad - rightW;
    const cell = (x1 - x0) / 41;
    const top = pad + 58;
    const rh = (h - pad - top) / RANKS.length;
    g.globalAlpha = fade;
    g.font = `500 11px ${MONO}`;
    g.fillStyle = c.dim;
    g.textAlign = 'left';
    g.fillText('1st', x0, top - 14);
    g.textAlign = 'right';
    g.fillText('41st', x1, top - 14);
    g.fillStyle = m < 0.5 ? c.star : c.acc;
    g.textAlign = 'left';
    g.fillText(m < 0.5 ? 'on the data it was tuned on' : 'on data it had never seen', pad, pad + 12);
    RANKS.forEach(([name, rank], ri) => {
      const y = top + ri * rh + rh * 0.2;
      const ch = Math.min(rh * 0.5, 30);
      for (let i = 0; i < 41; i++) {
        g.globalAlpha = fade * 0.9;
        g.fillStyle = c.hair;
        g.fillRect(x0 + i * cell + 1, y, Math.max(1, cell - 2), ch);
      }
      const pos = lerp(0, rank - 1, smooth(m, ri * 0.06, 0.82 + ri * 0.06));
      g.globalAlpha = fade;
      g.fillStyle = c.acc;
      g.fillRect(x0 + pos * cell, y - 3, Math.max(3, cell), ch + 6);
      g.fillStyle = c.star;
      g.textAlign = 'left';
      g.font = `500 12px ${MONO}`;
      g.fillText(name, pad, y + ch * 0.5 + 4);
      g.textAlign = 'right';
      g.fillStyle = c.acc;
      g.font = `400 ${Math.max(20, Math.min(30, w * 0.055))}px ${SHOW}`;
      g.fillText(String(Math.round(pos) + 1), w - pad, y + ch * 0.5 + 8);
    });
  } else {
    // folds won: the one-line rule against the forest
    const fade = smooth(t, 0, 0.12);
    const names = ['MU', 'AVGO', 'MRVL'];
    const headH = Math.max(72, h * 0.27);
    const k = smooth(t, 0.2, 0.75);
    const shown = Math.round(k * 15);
    g.globalAlpha = fade;
    g.textAlign = 'left';
    g.fillStyle = c.acc;
    g.font = `400 ${Math.max(54, w * 0.17)}px ${SHOW}`;
    const won = Math.min(12, Math.round(k * 12));
    const num = `${won}`;
    g.fillText(num, pad, pad + headH * 0.8);
    const nw = g.measureText(num).width;
    g.fillStyle = c.dim;
    g.font = `500 12px ${MONO}`;
    g.fillText('of 15 folds went to the', pad + nw + 12, pad + headH * 0.8 - 18);
    g.fillText('one-line rule', pad + nw + 12, pad + headH * 0.8);
    const labelW = 56;
    const x0 = pad + labelW;
    const gap = 8;
    const size = Math.min((w - pad - x0 - gap * 4) / 5, (h - pad * 2 - headH - 26) / 3 - gap);
    names.forEach((name, ri) => {
      const y = pad + headH + ri * (size + gap);
      g.globalAlpha = fade;
      g.fillStyle = c.star;
      g.font = `500 12px ${MONO}`;
      g.textAlign = 'left';
      g.fillText(name, pad, y + size / 2 + 4);
      for (let i = 0; i < 5; i++) {
        const idx = ri * 5 + i;
        const a = idx < shown ? 1 : 0.18;
        g.globalAlpha = fade * a;
        if (i < 4) {
          g.fillStyle = c.star;
          g.fillRect(x0 + i * (size + gap), y, size, size);
        } else {
          g.strokeStyle = c.acc;
          g.lineWidth = 1.5;
          g.strokeRect(x0 + i * (size + gap) + 0.75, y + 0.75, size - 1.5, size - 1.5);
        }
      }
    });
    g.globalAlpha = fade * 0.9;
    g.fillStyle = c.dim;
    g.font = `500 11px ${MONO}`;
    g.textAlign = 'left';
    g.fillText('filled: rule won   outlined: forest won', pad, h - pad + 2);
  }
  g.globalAlpha = 1;
}


// ---------------------------------------------------------------- wiring
/** Where each step of a project chart comes to rest when it is played rather than scrolled. */
const REST = [0.85, 0.9, 0.999];

export function mountMotion(root: HTMLElement, calm: boolean) {
  const html = document.documentElement;
  html.classList.toggle('calm', calm);
  const phoneMq = matchMedia('(max-width: 860px), (pointer: coarse) and (max-height: 520px)');
  let phone = false;
  const inkOf = (el: HTMLElement): Ink => {
    const s = getComputedStyle(el);
    const v = (n: string) => s.getPropertyValue(n).trim();
    return { star: v('--star'), dim: v('--dim'), acc: v('--acc') || v('--dust'), hair: v('--hair-2'), bad: '#e0707a' };
  };
  const fit = (canvas: HTMLCanvasElement, box: HTMLElement) => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h, dpr };
  };
  const pinned = (el: HTMLElement, vh: number) => {
    const r = el.getBoundingClientRect();
    return { p: clamp(-r.top / Math.max(1, r.height - vh)), near: r.bottom > -vh * 0.3 && r.top < vh * 1.3 };
  };

  // hero: the summary lights up word by word
  const lede = root.querySelector<HTMLElement>('.cv-hero .cv-lede');
  let words: HTMLElement[] = [];
  if (lede && !calm) {
    const text = lede.textContent ?? '';
    lede.setAttribute('aria-label', text);
    lede.innerHTML = text
      .split(' ')
      .map((w) => `<span class="w" aria-hidden="true">${esc(w)}</span>`)
      .join(' ');
    words = Array.from(lede.querySelectorAll<HTMLElement>('.w'));
  }

  // the spiral
  const orbit = root.querySelector<HTMLElement>('[data-orbit]');
  const orbitBox = orbit?.querySelector<HTMLElement>('.orbit-canvas') ?? null;
  const orbitCanvas = orbit?.querySelector('canvas') ?? null;
  const say = orbit ? Array.from(orbit.querySelectorAll<HTMLElement>('[data-orbit-say] span')) : [];
  const read = orbit?.querySelector<HTMLElement>('[data-orbit-read]') ?? null;
  let orbitP = -1;
  let readAt = -2;
  const paintOrbit = (p: number) => {
    if (!orbit || !orbitBox || !orbitCanvas) return;
    const { g, w, h, dpr } = fit(orbitCanvas, orbitBox);
    if (!w || !h) return;
    const s = getComputedStyle(orbit);
    drawOrbit(g, w, h, p, inkOf(orbit), STOPS.map((x) => s.getPropertyValue(x[2]).trim()), dpr, calm);
    orbitP = p;
  };

  // stories
  const stories = Array.from(root.querySelectorAll<HTMLElement>('[data-story]')).map((el) => {
    const def = STORIES.find((s) => s.id === el.dataset.story)!;
    return {
      el,
      def,
      canvas: el.querySelector('canvas')!,
      box: el.querySelector<HTMLElement>('.story-canvas')!,
      cards: Array.from(el.querySelectorAll<HTMLElement>('.story-card')),
      row: el.querySelector<HTMLElement>('.story-cards')!,
      cap: el.querySelector<HTMLElement>('[data-cap]')!,
      draw: def.id === 'ticker' ? drawTicker : drawBacktest,
      p: -1,
      w: 0,
      step: -1,
      // phones only: what the chart is showing, whether it has been on screen yet, and its running animation
      q: 0,
      seen: false,
      raf: 0,
    };
  });
  const paint = (s: (typeof stories)[number], p: number) => {
    const { g, w, h } = fit(s.canvas, s.box);
    if (!w || !h) return;
    s.draw(g, w, h, p, inkOf(s.el));
    s.p = p;
    s.w = w;
  };

  // phones: show one step of a chart, either waiting at its start or played through to its resting frame
  const show = (s: (typeof stories)[number], step: number, animate: boolean) => {
    cancelAnimationFrame(s.raf);
    s.step = step;
    s.cards.forEach((c, i) => c.classList.toggle('on', i === step));
    s.cap.textContent = s.def.caps[step];
    s.q = step;
    paint(s, s.q);
    if (!animate) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = clamp((now - t0) / 1500);
      s.q = step + REST[step] * k;
      paint(s, s.q);
      if (k < 1) s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  };
  // phones: a row you swipe sideways, with page dots. It reports the card nearest the left edge when that changes.
  const swipeRow = (row: HTMLElement, cards: HTMLElement[], dotBox: HTMLElement | null, onPick: (i: number) => void) => {
    const btns = dotBox ? Array.from(dotBox.querySelectorAll('button')) : [];
    const pitch = () => (cards.length > 1 ? Math.max(1, cards[1].offsetLeft - cards[0].offsetLeft) : 1);
    let at = -1;
    let wait = false;
    const mark = (i: number) => {
      if (i === at) return;
      at = i;
      btns.forEach((b, k) => b.classList.toggle('on', k === i));
      onPick(i);
    };
    row.addEventListener(
      'scroll',
      () => {
        if (!phone || wait) return;
        wait = true;
        requestAnimationFrame(() => {
          wait = false;
          mark(clamp(Math.round(row.scrollLeft / pitch()), 0, cards.length - 1));
        });
      },
      { passive: true },
    );
    btns.forEach((b, i) => b.addEventListener('click', () => row.scrollTo({ left: i * pitch(), behavior: 'smooth' })));
    return {
      restart: () => {
        at = -1;
        row.scrollLeft = 0;
        mark(0);
      },
    };
  };
  const storyRows = stories.map((s) => swipeRow(s.row, s.cards, s.el.querySelector<HTMLElement>('[data-dots]'), (i) => phone && show(s, i, s.seen)));

  // sideways experience
  const hx = root.querySelector<HTMLElement>('[data-hx]');
  const track = hx?.querySelector<HTMLElement>('.hx-track') ?? null;
  const ghost = hx?.querySelector<HTMLElement>('.hx-ghost') ?? null;
  const prog = hx?.querySelector<HTMLElement>('.hx-prog b') ?? null;
  const hxCards = hx ? Array.from(hx.querySelectorAll<HTMLElement>('.hx-card')) : [];
  const hxRow = track ? swipeRow(track, hxCards, hx!.querySelector<HTMLElement>('[data-dots]'), (i) => hxCards.forEach((c, k) => c.classList.toggle('on', k === i))) : null;

  // skill map: links are measured from where the labels actually sit
  const smap = root.querySelector<HTMLElement>('[data-smap]');
  const svg = smap?.querySelector<SVGSVGElement>('.smap-links') ?? null;
  const sItems = smap ? Array.from(smap.querySelectorAll<HTMLElement>('[data-s]')) : [];
  const pItems = smap ? Array.from(smap.querySelectorAll<HTMLElement>('[data-p]')) : [];
  const links = (smap?.dataset.links ?? '')
    .split(' ')
    .filter(Boolean)
    .map((x) => x.split('-').map(Number) as [number, number])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  let paths: SVGPathElement[] = [];
  const layMap = () => {
    if (!smap || !svg) return;
    const grid = svg.parentElement!;
    const gr = grid.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${gr.width} ${gr.height}`);
    svg.innerHTML = links
      .map(([si, pi]) => {
        const a = sItems[si].querySelector('i')!.getBoundingClientRect();
        const b = pItems[pi].querySelector('i')!.getBoundingClientRect();
        const x1 = a.left + a.width / 2 - gr.left;
        const y1 = a.top + a.height / 2 - gr.top;
        const x2 = b.left + b.width / 2 - gr.left;
        const y2 = b.top + b.height / 2 - gr.top;
        const mx = (x2 - x1) * 0.5;
        return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} C${(x1 + mx).toFixed(1)},${y1.toFixed(1)} ${(x2 - mx).toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" pathLength="1" data-s="${si}" data-p="${pi}" style="stroke:var(--p${MAP_COLOUR[pi]})"/>`;
      })
      .join('');
    paths = Array.from(svg.querySelectorAll('path'));
    sItems.forEach((li, i) => li.classList.toggle('loose', !links.some((l) => l[0] === i)));
    mapK = -1;
  };
  let mapK = -1;
  const pick = (kind: 's' | 'p' | null, i = -1) => {
    if (!smap) return;
    smap.classList.toggle('picking', kind !== null);
    const hit = (l: [number, number]) => (kind === 's' ? l[0] === i : l[1] === i);
    const on = links.filter(hit);
    paths.forEach((path, k) => path.classList.toggle('on', kind !== null && hit(links[k])));
    sItems.forEach((li, k) => li.classList.toggle('on', kind !== null && on.some((l) => l[0] === k)));
    pItems.forEach((li, k) => li.classList.toggle('on', kind !== null && on.some((l) => l[1] === k)));
  };
  if (smap) {
    const bind = (items: HTMLElement[], kind: 's' | 'p') =>
      items.forEach((li, i) => {
        li.addEventListener('pointerenter', () => pick(kind, i));
        li.addEventListener('pointerleave', () => pick(null));
        li.addEventListener('focusin', () => pick(kind, i));
        li.addEventListener('focusout', () => pick(null));
        li.addEventListener('click', () => pick(kind, i));
      });
    bind(sItems, 's');
    bind(pItems, 'p');
    new ResizeObserver(layMap).observe(smap);
  }

  const yr = root.querySelector<HTMLElement>('[data-yr]');
  const strip = root.querySelector<HTMLElement>('[data-yr-strip]');
  const closingEl = root.querySelector<HTMLElement>('[data-closing]');
  // about: the greeting is written by hand, as it scrolls up the screen or, on phones, once when it arrives
  const helloEl = root.querySelector<SVGSVGElement>('[data-hello]');
  const ink = helloEl?.querySelector<SVGPathElement>('.hello-ink') ?? null;
  const pen = helloEl
    ? Array.from(helloEl.querySelectorAll<SVGPathElement>('mask path')).map((el) => {
        // measured here as well, so a stroke can never stop short of its end
        let real = 0;
        try {
          real = el.getTotalLength();
        } catch {
          real = 0;
        }
        return { el, len: Math.max(Number(el.dataset.len), real) + 2 };
      })
    : [];
  const penTotal = pen.reduce((n, s) => n + s.len, 0);
  let penAt = -1;
  const write = (p: number) => {
    if (Math.abs(p - penAt) < 0.0008) return;
    penAt = p;
    // once it is written the mask comes off, so the finished greeting is whole whatever the browser does with masks
    if (ink) {
      if (p >= 1) ink.removeAttribute('mask');
      else if (!ink.hasAttribute('mask')) ink.setAttribute('mask', 'url(#hello-pen)');
    }
    let from = 0;
    for (const s of pen) {
      const k = clamp((p * penTotal - from) / s.len, 0, 1);
      from += s.len;
      // an undrawn stroke is hidden outright, or its round cap would leave a dot where the pen will start
      s.el.style.visibility = k <= 0 ? 'hidden' : 'visible';
      s.el.style.strokeDasharray = `${s.len} ${s.len + 80}`;
      s.el.style.strokeDashoffset = (s.len * (1 - k)).toFixed(1);
    }
  };
  if (pen.length) write(calm ? 1 : 0);
  let helloRaf = 0;
  let helloDone = false;
  const playHello = () => {
    if (helloDone) return;
    helloDone = true;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = clamp((now - t0) / 2400);
      write(k);
      if (k < 1) helloRaf = requestAnimationFrame(tick);
    };
    helloRaf = requestAnimationFrame(tick);
  };
  // about: each picture eases into place as it enters, opening up and settling, and drifts at its own depth
  const soft = Array.from(root.querySelectorAll<HTMLElement>('[data-soft]'));
  const pars = Array.from(root.querySelectorAll<HTMLElement>('[data-par]'));

  // with motion off the year simply reads 2031
  if (calm && strip) strip.style.transform = `translateY(${((-5 / 6) * 100).toFixed(3)}%)`;
  if (closingEl) {
    if (calm) closingEl.classList.add('in');
    else new IntersectionObserver((es) => es[0].isIntersecting && closingEl.classList.add('in'), { threshold: 0.5 }).observe(closingEl);
  }

  // phones play things once as they arrive; wider screens tie them to the scroll position
  let arrivals: IntersectionObserver[] = [];
  const setMode = () => {
    const on = phoneMq.matches && !calm;
    if (on === phone) return;
    phone = on;
    html.classList.toggle('phone', on);
    arrivals.forEach((o) => o.disconnect());
    arrivals = [];
    cancelAnimationFrame(helloRaf);
    for (const s of stories) {
      cancelAnimationFrame(s.raf);
      s.seen = false;
      s.step = -1;
      s.p = -1;
      s.row.scrollLeft = 0;
    }
    if (track) track.style.transform = '';
    if (ghost) ghost.style.transform = '';
    if (!on) return;
    for (const el of pars) el.style.setProperty('--s', '0');
    words.forEach((w) => (w.style.opacity = ''));
    // the root reaches far above the screen, so anything already scrolled past counts as arrived
    const arrive = (els: Element[], threshold: number, then: (el: Element) => void) => {
      const o = new IntersectionObserver(
        (es) => {
          for (const e of es) {
            if (!e.isIntersecting) continue;
            o.unobserve(e.target);
            then(e.target);
          }
        },
        { rootMargin: '100000px 0px 0px 0px', threshold },
      );
      els.forEach((el) => o.observe(el));
      arrivals.push(o);
    };
    for (const el of soft) el.style.setProperty('--p', '0');
    arrive(soft, 0.15, (el) => (el as HTMLElement).style.setProperty('--p', '1'));
    if (helloEl && pen.length) {
      helloDone = false;
      write(0);
      arrive([helloEl], 0.75, playHello);
    }
    storyRows.forEach((r) => r.restart());
    hxRow?.restart();
    arrive(
      stories.map((s) => s.box),
      0.6,
      (box) => {
        const s = stories.find((x) => x.box === box)!;
        s.seen = true;
        show(s, Math.max(0, s.step), true);
      },
    );
  };

  function update(vh: number) {
    if (calm) {
      if (orbitP < 0) paintOrbit(1);
      say.forEach((w) => w.classList.add('on'));
      for (const s of stories) {
        if (s.p < 0 || s.w !== s.box.clientWidth) paint(s, 2.999);
        s.cap.textContent = s.def.caps[2];
      }
      if (mapK < 0 && paths.length) {
        paths.forEach((path) => (path.style.strokeDashoffset = '0'));
        mapK = 1;
      }
      return;
    }
    if (!phone) scrub(vh);
    else for (const s of stories) if (s.p < 0 || s.w !== s.box.clientWidth) paint(s, s.q);
    if (smap && paths.length) {
      const r = smap.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const k = clamp((vh * 0.8 - r.top) / (vh * 0.35 + r.height * 0.55));
        if (Math.abs(k - mapK) > 0.004) {
          mapK = k;
          paths.forEach((path, i) => (path.style.strokeDashoffset = (1 - smooth(k * 1.25, (i / paths.length) * 0.8, (i / paths.length) * 0.8 + 0.3)).toFixed(3)));
        }
      }
    }
    if (yr && strip) {
      const top = yr.getBoundingClientRect().top;
      const k = smooth((vh * 0.95 - top) / (vh * 0.6));
      strip.style.transform = `translate3d(0,${(-k * (5 / 6) * 100).toFixed(2)}%,0)`;
    }
  }

  /** Everything that follows the scroll position frame by frame. Not used on phones. */
  function scrub(vh: number) {
    for (const el of pars) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -300 || r.top > vh + 300) continue;
      el.style.setProperty('--s', clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1).toFixed(3));
    }
    if (helloEl && pen.length) {
      const r = helloEl.getBoundingClientRect();
      if (r.bottom > -200 && r.top < vh + 200) write(clamp((vh * 0.9 - r.top) / (vh * 0.48), 0, 1));
    }
    for (const el of soft) {
      // measured on the parent, which does not move, so the picture's own motion cannot feed back into it
      const r = el.parentElement!.getBoundingClientRect();
      if (r.bottom < -300 || r.top > vh + 300) continue;
      el.style.setProperty('--p', smooth((vh * 1.02 - r.top) / (vh * 0.62)).toFixed(3));
    }
    if (words.length && lede) {
      const top = lede.getBoundingClientRect().top;
      const k = clamp((vh * 0.92 - top) / (vh * 0.5)) * (words.length + 3);
      words.forEach((w, i) => (w.style.opacity = String(0.2 + 0.8 * clamp(k - i))));
    }
    if (orbit) {
      const { p, near } = pinned(orbit, vh);
      if (near) {
        if (Math.abs(p - orbitP) > 0.0015 || orbitCanvas!.clientWidth !== orbitBox!.clientWidth) paintOrbit(p);
        const n = Math.round(smooth(p, 0.5, 0.95) * say.length);
        say.forEach((w, i) => w.classList.toggle('on', i < n));
        // on narrow screens the captions do not fit on the chart, so the latest stop is read out below it
        if (read) {
          const reached = STOPS.filter((_, i) => smooth(p, 0.03, 0.62) >= i / (STOPS.length - 1) - 0.02).length - 1;
          if (reached !== readAt) {
            readAt = reached;
            read.classList.toggle('on', reached >= 0 && p < 0.6);
            if (reached >= 0) {
              read.querySelector('b')!.textContent = STOPS[reached][0];
              read.querySelector('span')!.textContent = STOPS[reached][1];
              read.style.setProperty('--acc', `var(${STOPS[reached][2]})`);
            }
          }
          read.classList.toggle('on', readAt >= 0 && p < 0.6);
        }
      }
    }
    for (const s of stories) {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -vh * 0.3 || r.top > vh * 1.3) continue;
      // progress comes from where the notes are: each one drives its part of the chart as it passes
      const focus = vh * (innerWidth <= 860 ? 0.82 : 0.6);
      const tops = s.cards.map((c) => c.getBoundingClientRect().top);
      const gap = Math.max(1, tops[1] - tops[0]);
      let q = (focus - (tops[0] - gap * 0.35)) / (gap * 1.35);
      if (focus >= tops[1]) q = 1 + (focus - tops[1]) / Math.max(1, tops[2] - tops[1]);
      if (focus >= tops[2]) q = 2 + (focus - tops[2]) / (gap * 0.7);
      q = clamp(q, 0, 2.999);
      const step = Math.floor(q);
      if (step !== s.step) {
        s.step = step;
        s.cards.forEach((c, i) => c.classList.toggle('on', i === step));
        s.cap.textContent = s.def.caps[step];
      }
      if (Math.abs(q - s.p) > 0.002 || s.w !== s.box.clientWidth) paint(s, q);
    }
    if (hx && track) {
      const { p, near } = pinned(hx, vh);
      if (near) {
        const e = smooth(p, 0.04, 0.96);
        const max = Math.max(0, track.scrollWidth - track.parentElement!.clientWidth);
        track.style.transform = `translate3d(${(-e * max).toFixed(1)}px,0,0)`;
        if (ghost) ghost.style.transform = `translate3d(${(-e * max * 0.35).toFixed(1)}px,0,0)`;
        if (prog) prog.style.transform = `scaleX(${e.toFixed(3)})`;
      }
    }
  }

  const relayout = () => {
    orbitP = -1;
    for (const s of stories) s.p = -1;
    layMap();
    if (phone) for (const s of stories) paint(s, s.q);
  };
  relayout();
  setMode();
  phoneMq.addEventListener('change', setMode);
  addEventListener('resize', relayout);
  document.fonts?.ready.then(relayout);
  // light mode and dark mode use different inks
  new MutationObserver(relayout).observe(html, { attributes: true, attributeFilter: ['class'] });
  return { update, repaint: relayout };
}
