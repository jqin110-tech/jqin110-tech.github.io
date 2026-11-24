// The resume below the galaxy: an editorial page with small, working demos of each project.
import { copyButton, mountCopy } from './copy';
import { resume } from './data';
import devotion from './assets/devotion.jpg';
import free from './assets/free.jpg';
import mountains from './assets/mountains.jpg';
import untourable from './assets/untourable.jpg';
import { projectsHead } from './gallery';
import { HELLO } from './hello';
import { inkRule, inkSkyline } from './ink';
import { jakes } from './jakes';
import { closing, sideways, skillMap, story, yearBand } from './motion';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const list = (items: string[]) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

export const cvSections = [
  { id: 'cv-about', label: 'About' },
  { id: 'cv-projects', label: 'Projects' },
  { id: 'cv-experience', label: 'Experience' },
  { id: 'cv-education', label: 'Education' },
  { id: 'cv-skills', label: 'Skills' },
  { id: 'cv-contact', label: 'Contact' },
];

// ---------- dates ----------
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "Sep 2024 – Apr 2025" → months since year 0, start and end. */
function span(s: string) {
  const parts = s.split('–').map((p) => p.trim().toLowerCase());
  const parse = (p: string, fallbackYear?: number) => {
    const m = MONTHS.findIndex((x) => p.startsWith(x));
    const y = Number((p.match(/\d{4}/) || [])[0] ?? fallbackYear);
    return y * 12 + Math.max(0, m);
  };
  const endYear = Number((parts[1]?.match(/\d{4}/) || [])[0]);
  return { a: parse(parts[0], endYear), b: parse(parts[1] ?? parts[0]) + 1 };
}

// ---------- markup ----------
const DEMOS: Record<string, { kind: string; caption: string }> = {
  Tickerchatter: { kind: 'zscore', caption: 'Drag the sliders: a day is flagged when mentions break above the rolling mean by z standard deviations.' },
  Backtester: { kind: 'backtest', caption: 'Change the moving averages, then switch on the lookahead bug to see how it fakes a better result.' },
  'Banking System': { kind: 'bank', caption: 'A working model of the CLI. Try: deposit 120, withdraw 30, transfer 50 savings, history.' },
  'Gravity Simulator': { kind: 'orbit', caption: 'One planet on a stretched orbit (e = 0.5), the same check the repo runs. Switch to Euler and the energy error grows until the orbit falls apart; with leapfrog it stays the same size.' },
  'Brain Oxygen Model': { kind: 'oxygen', caption: 'Cut the carotid flow and the brain’s small oxygen store runs down toward the fitted threshold. The shaded band is the 8.3 to 9.9 s timed in 81 UFC chokes. Below about an 84% cut the model never crosses, because the vertebral arteries keep enough blood flowing. Educational model, not medical advice.' },
  'Resume Quest': { kind: 'spiral', caption: 'How the planets are placed: equal arc-length steps along r = R₀·φ^(−2θ/π).' },
};

/** Where a project's room sits on the page, so the skills line can jump to it. */
export const projectId = (name: string) => `proj-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/**
 * One room per project: its case study (or a short heading), then what I did beside a demo you can try.
 * The write-up inside each room is also what prints, so the paper resume is unchanged.
 */
function projectRooms() {
  return `<div class="lab">${resume.projects
    .map((p, i) => {
      const d = DEMOS[p.name];
      return `<article class="proj${p.paper === false ? ' screen-only' : ''}" id="${projectId(p.name)}" style="--acc:var(--p${i})">
        ${story(p.name, i)}
        <div class="lab-panel">
          <div class="lab-copy reveal">
            <p class="mono proj-kick screen-only">What I did</p>
            <p class="cv-meta">${esc(p.dates)}</p>
            <h3>${esc(p.name)}</h3>
            <p class="cv-sub">${esc(p.tagline)}</p>
            ${list(p.bullets)}
            <p class="cv-stack mono">${p.stack.map(esc).join('<span aria-hidden="true"> / </span>')}</p>
            ${(p.links ?? [])
              .map((l) => `<a class="pill code-link" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗<span class="print-url">${esc(l.url.replace('https://', ''))}</span></a>`)
              .join('')}
          </div>
          <figure class="lab-demo reveal" data-demo="${d?.kind ?? ''}">
            <p class="mono proj-kick">Try it</p>
            <div class="demo-stage"></div>
            ${d ? `<figcaption>${esc(d.caption)}</figcaption>` : ''}
          </figure>
        </div>
        ${rule()}
      </article>`;
    })
    .join('')}</div>`;
}

function timeline() {
  const xs = resume.experience.map((x) => ({ ...x, s: span(x.dates) }));
  const min = Math.min(...xs.map((x) => x.s.a));
  const max = Math.max(...xs.map((x) => x.s.b));
  const years: number[] = [];
  for (let y = Math.ceil(min / 12); y * 12 <= max; y++) years.push(y);
  const pct = (m: number) => (((m - min) / (max - min)) * 100).toFixed(2);
  return `<div class="tl reveal">
    <div class="tl-axis" aria-hidden="true">${years.map((y) => `<span style="left:${pct(y * 12)}%">${y}</span>`).join('')}</div>
    ${xs
      .map(
        (x, i) => `<details class="tl-row" ${i === 0 ? 'open' : ''}>
        <summary>
          <span class="tl-label"><strong>${esc(x.title)}</strong><span>${esc(x.org)}</span></span>
          <span class="tl-track" aria-hidden="true"><span class="tl-bar" style="left:${pct(x.s.a)}%;width:${(Number(pct(x.s.b)) - Number(pct(x.s.a))).toFixed(2)}%"></span></span>
          <span class="tl-dates mono">${esc(x.dates)}</span>
        </summary>
        <div class="tl-body">${list(x.bullets)}</div>
      </details>`,
      )
      .join('')}
  </div>`;
}

function education() {
  const e = resume.education;
  return `<div class="edu reveal">
    <div class="edu-main">
      <p class="cv-meta">${esc(e.dates)}</p>
      <h3>${esc(e.school)}</h3>
      <p class="cv-sub">${esc(e.program)}</p>
      <div class="degree" data-degree>
        <div class="degree-track"><span class="degree-fill"></span><span class="degree-now"></span></div>
        <div class="degree-labels mono"><span>Sep 2026</span><span data-degree-label></span><span>Apr 2031</span></div>
      </div>
    </div>
  </div>`;
}

function skills() {
  const used = (skill: string) => {
    const k = skill.toLowerCase();
    const hits = resume.projects.filter((p) => p.stack.some((t) => t.toLowerCase() === k || t.toLowerCase().includes(k)));
    return hits.map((p) => p.name);
  };
  return `<div class="sk reveal">
    ${Object.entries(resume.skills)
      .map(
        ([group, items]) => `<div class="sk-group">
        <p class="cv-meta">${esc(group)}</p>
        <div class="sk-chips">${items
          .map((s) => {
            const u = used(s);
            return `<button class="pill sk-chip" data-uses="${esc(u.join('|'))}" aria-pressed="false">${esc(s)}</button>`;
          })
          .join('')}</div>
      </div>`,
      )
      .join('')}
    <p class="sk-out" data-sk-out aria-live="polite">Pick a skill to see where I’ve used it.</p>
  </div>`;
}



/** The line between two chapters is drawn by hand, a different one each time. */
let rules = 0;
const rule = () => `<div class="ink-rule-row screen-only" aria-hidden="true">${inkRule(40 + rules++)}</div>`;

/** The one-page resume that sits below the galaxy. */
export function siteResume(): string {
  const r = resume;
  // each chapter can open with a scroll-driven piece; the plain rows underneath are what prints
  const sec = (i: number, inner: string, before = '', note = '', after = true) => {
    const s2 = cvSections[i];
    return `<section id="${s2.id}" class="cv-chap" aria-labelledby="${s2.id}-h">
      ${before}
      <div class="cv-sec">
        <h2 class="cv-h reveal" id="${s2.id}-h">${esc(s2.label)}${note ? `<span class="cv-h-note screen-only">${esc(note)}</span>` : ''}</h2>
        <div class="cv-rows">${inner}</div>
      </div>
    </section>${after ? rule() : ''}`;
  };
  return `
  <header class="cv-hero reveal">
    <p class="cv-kicker mono">Resume · ${esc(r.location)}</p>
    <h1 id="cv-name">${esc(r.name)}</h1>
    <p class="cv-role">${esc(r.headline)}</p>
    <p class="cv-lede">${esc(r.summary)}</p>
    <p class="cv-actions">
      ${copyButton(r.email, 'pill pill-solid')}<a class="print-url" href="mailto:${esc(r.email)}">${esc(r.email)}</a>
      ${r.links.map((l) => `<a class="pill" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="screen-only">${esc(l.label)} ↗</span><span class="print-url">${esc(l.url.replace('https://', ''))}</span></a>`).join('')}
<button class="pill" data-quick>One-page resume</button>
      <button class="pill" data-print>Save as PDF</button>
    </p>
  </header>
  ${aboutMe()}${rule()}
  ${sec(1, projectRooms(), projectsHead(), '', false)}
  ${sec(2, timeline(), sideways())}
  ${sec(3, education(), yearBand())}
  ${sec(4, skills(), skillMap())}
  ${sec(
    5,
    `<div class="cv-contact reveal">
      <p class="cv-lede">Email is the fastest way to reach me.</p>
      <p class="cv-actions">
        ${copyButton(r.email, 'pill pill-solid big')}
      </p>
    </div>`,
    closing(),
    '',
    false,
  )}
  <footer class="cv-foot mono">
    <span>© ${new Date().getFullYear()} ${esc(r.name)}</span>
    <span>The galaxy is drawn on a canvas in TypeScript, with no game engine.</span>
  </footer>
  <div class="cv-roofs screen-only" aria-hidden="true">${inkSkyline(2031)}</div>`;
}

/** A few plain paragraphs about the person, on screen only: the printed resume stays a resume. */
function aboutMe(): string {
  const a = resume.about;
  // each picture sits at its own height and drifts at its own depth
  const DY = [0, 34, 10, 44, 18];
  const K = [0.35, 0.95, 0.55, 1.15, 0.7];
  let n = 0;
  const pic = (m: { key: string; alt: string; name: string }) => {
    const i = n++ % DY.length;
    const at = `style="--dy:${DY[i]}px;--k:${K[i]}"`;
    return ABOUT_PICS[m.key]
      ? `<span class="about-pic" data-soft ${at}><img src="${ABOUT_PICS[m.key]}" alt="${esc(m.alt)}" title="${esc(m.name)}" width="300" height="300" decoding="async"></span>`
      : `<span class="about-pic about-noimg" role="img" aria-label="${esc(m.alt)}" ${at}>${esc(m.name)}</span>`;
  };
  return `<section id="cv-about" class="cv-chap about motion" aria-labelledby="cv-about-h">
    <div class="about-main">
      <p class="mono about-kick reveal">About me</p>
      <h2 class="about-hello" id="cv-about-h" aria-label="${esc(a.hello)}">${helloSvg()}</h2>
      ${a.paras.map((p) => `<p class="about-p reveal">${esc(p)}</p>`).join('')}
    </div>
    <figure class="about-photo" data-par>
      <div class="about-photo-clip" data-soft><div class="photo-move"><img src="${mountains}" alt="${esc(a.photo.alt)}" width="880" height="1173" decoding="async"></div></div>
      <figcaption class="reveal"><span class="mono">${esc(a.photo.label)}</span>${esc(a.photo.text)}</figcaption>
    </figure>
    <aside class="about-side" aria-label="Off the clock">
      <p class="mono about-kick reveal">Off the clock</p>
      <dl>${a.offClock
        .map(
          (o) => `<div class="${o.imgs.length ? 'has-pics' : 'no-pics'}" style="--n:${o.imgs.length}">
            ${o.imgs.length ? `<p class="about-imgs" data-par>${o.imgs.map(pic).join('')}</p>` : ''}
            <dt class="mono reveal">${esc(o.label)}</dt><dd class="reveal">${esc(o.text)}</dd>
            <p class="about-names reveal">${o.imgs.filter((m) => !o.text.includes(m.name)).map((m) => esc(m.name)).join(', ')}</p>
          </div>`,
        )
        .join('')}</dl>
      <p class="about-credit mono reveal">${a.credits.length ? `Photos: ${a.credits.map((c) => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.text)}</a>`).join('. ')}. ` : ''}Album art belongs to the artists and their labels.</p>
    </aside>
  </section>`;
}
/**
 * The greeting in handwriting. The letters are plain outlines, so no font has to load; over them sits a mask
 * made of pen strokes along the middle of each letter, and motion.ts draws those strokes to write it.
 * Once the writing is done the mask is taken off, so the finished greeting can never be clipped.
 */
function helloSvg(): string {
  const h = HELLO;
  return `<svg class="hello" data-hello viewBox="${h.viewBox}" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="hello-ink" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${h.w}" y2="0"><stop offset="0.45" class="hello-a"/><stop offset="1" class="hello-b"/></linearGradient>
      <mask id="hello-pen" maskUnits="userSpaceOnUse" x="0" y="0" width="${h.w}" height="${h.h}">
        ${h.strokes.map((s) => `<path d="${s.d}" data-len="${s.len}" fill="none" stroke="#fff" stroke-width="${h.pen}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
      </mask>
    </defs>
    <path class="hello-ink" d="${h.outline}" fill="url(#hello-ink)" mask="url(#hello-pen)"/>
  </svg>`;
}
/** Files for the about pictures, by the key used in data.ts. */
const ABOUT_PICS: Record<string, string | undefined> = { untourable, free, devotion };

/** The quick resume: the one-page resume in the Jake's Resume layout, as a sheet of paper. */
export function quickResume(): string {
  const j = jakes;
  const items = (xs: readonly string[]) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `
    <p class="q-top"><span class="mono">One-page resume</span><button class="q-close" data-quick-close>Close <kbd>Esc</kbd></button></p>
    <article class="jk">
      <h1 id="quick-name">${esc(j.name)}</h1>
      <p class="jk-contact">${j.contact.map((c) => (c.url.startsWith('mailto:') ? copyButton(c.label, 'jk-copy') : `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a>`)).join(' <span aria-hidden="true">|</span> ')}</p>
      <h2>Education</h2>
      ${j.education
        .map(
          (e) => `<div class="jk-sub">
        <p class="jk-row"><b>${esc(e.school)}</b><span>${esc(e.place)}</span></p>
        <p class="jk-row jk-it"><i>${esc(e.degree)}</i><i>${esc(e.dates)}</i></p>
      </div>`,
        )
        .join('')}
      <h2>Projects</h2>
      ${j.projects
        .map(
          (p) => `<div class="jk-sub">
        <p class="jk-row jk-proj"><span><a class="jk-name" href="${esc(p.url)}" target="_blank" rel="noopener"><b>${esc(p.name)}</b></a> <span aria-hidden="true">|</span> <i>${esc(p.stack)}</i></span><span>${esc(p.dates)}</span></p>
        ${items(p.items)}
      </div>`,
        )
        .join('')}
      <h2>Experience</h2>
      ${j.experience
        .map(
          (x) => `<div class="jk-sub">
        <p class="jk-row"><b>${esc(x.title)}</b><span>${esc(x.dates)}</span></p>
        <p class="jk-row jk-it"><i>${esc(x.org)}</i></p>
        ${items(x.items)}
      </div>`,
        )
        .join('')}
      <h2>Technical Skills</h2>
      <p class="jk-skills">${j.skills.map(([k, v]) => `<b>${esc(k)}</b>: ${esc(v)}`).join('<br>')}</p>
    </article>
    <p class="q-foot"><button class="pill" data-quick-full>See the full resume ↓</button><button class="pill" data-quick-close>Back to the galaxy</button></p>`;
}

// ---------- interactivity ----------
type Ctx = CanvasRenderingContext2D;
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** A canvas that fills its box at device resolution and redraws on resize. */
function stage(host: HTMLElement, aspect: number, draw: (g: Ctx, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  host.prepend(c);
  const g = c.getContext('2d')!;
  let w = 0;
  let h = 0;
  const paint = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = host.clientWidth;
    h = Math.round(w * aspect);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.height = h + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    draw(g, w, h);
  };
  new ResizeObserver(paint).observe(host);
  // the colours come from the theme, so a change of theme redraws
  let light = document.documentElement.classList.contains('other-side');
  new MutationObserver(() => {
    const now = document.documentElement.classList.contains('other-side');
    if (now !== light) {
      light = now;
      paint();
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return paint;
}

function slider(host: HTMLElement, label: string, min: number, max: number, step: number, value: number, fmt = (v: number) => String(v)) {
  const wrap = document.createElement('label');
  wrap.className = 'ctl';
  wrap.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output class="mono"></output>`;
  host.append(wrap);
  const input = wrap.querySelector('input')!;
  const out = wrap.querySelector('output')!;
  const get = () => Number(input.value);
  out.textContent = fmt(get());
  input.addEventListener('input', () => (out.textContent = fmt(get())));
  return { input, get };
}

function controls(fig: HTMLElement) {
  const el = document.createElement('div');
  el.className = 'demo-ctl';
  fig.querySelector('.demo-stage')!.after(el);
  return el;
}

function readout(fig: HTMLElement) {
  const el = document.createElement('p');
  el.className = 'demo-read mono';
  el.setAttribute('aria-live', 'polite');
  fig.querySelector('.demo-ctl')!.after(el);
  return el;
}

/** Tickerchatter: rolling z-score spike detection. */
function zscoreDemo(fig: HTMLElement) {
  const rand = rng(11);
  const N = 120;
  const data: number[] = [];
  for (let i = 0; i < N; i++) {
    let v = 22 + Math.sin(i / 9) * 4 + (rand() - 0.5) * 10;
    if (i === 38) v += 34;
    if (i === 71) v += 22;
    if (i === 72) v += 12;
    if (i === 103) v += 46;
    data.push(Math.max(2, Math.round(v)));
  }
  const ctl = controls(fig);
  const win = slider(ctl, 'Window', 5, 40, 1, 14, (v) => `${v} days`);
  const z = slider(ctl, 'Threshold', 1.5, 4, 0.1, 2.5, (v) => `z ≥ ${v.toFixed(1)}`);
  const read = readout(fig);
  const paint = stage(fig.querySelector('.demo-stage')!, 0.48, (g, w, h) => {
    const W = win.get();
    const Z = z.get();
    const max = Math.max(...data) * 1.1;
    const bw = w / N;
    const y = (v: number) => h - 18 - (v / max) * (h - 30);
    let flagged = 0;
    const band: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      let hit = false;
      if (i >= W) {
        const win2 = data.slice(i - W, i);
        const m = win2.reduce((a, b) => a + b, 0) / W;
        const sd = Math.sqrt(win2.reduce((a, b) => a + (b - m) ** 2, 0) / W) || 1;
        band.push([i, m + Z * sd]);
        hit = (data[i] - m) / sd >= Z;
      }
      if (hit) flagged++;
      g.fillStyle = hit ? css('--dust') : css('--hair-2');
      g.fillRect(i * bw + 0.5, y(data[i]), Math.max(1, bw - 1.5), h - 18 - y(data[i]));
    }
    g.strokeStyle = css('--star');
    g.globalAlpha = 0.55;
    g.setLineDash([3, 3]);
    g.beginPath();
    band.forEach(([i, v], k) => (k ? g.lineTo(i * bw + bw / 2, y(v)) : g.moveTo(i * bw + bw / 2, y(v))));
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
    g.fillStyle = css('--dim');
    g.font = '10px "IBM Plex Mono", monospace';
    g.fillText('$NOVA mentions / day (simulated)', 0, h - 4);
    read.textContent = `${flagged} day${flagged === 1 ? '' : 's'} flagged · dashed line = mean + ${Z.toFixed(1)}σ`;
  });
  win.input.addEventListener('input', paint);
  z.input.addEventListener('input', paint);
}

/** Backtester: moving-average crossover, with an optional lookahead bug. */
function backtestDemo(fig: HTMLElement) {
  const rand = rng(5);
  const N = 500;
  const px: number[] = [100];
  for (let i = 1; i < N; i++) {
    const shock = (rand() + rand() + rand() - 1.5) * 0.024;
    px.push(px[i - 1] * (1 + 0.0003 + shock + Math.sin(i / 60) * 0.002));
  }
  const ctl = controls(fig);
  const fast = slider(ctl, 'Fast MA', 5, 60, 1, 20, (v) => `${v}d`);
  const slow = slider(ctl, 'Slow MA', 30, 200, 5, 80, (v) => `${v}d`);
  const bug = document.createElement('label');
  bug.className = 'ctl toggle';
  bug.innerHTML = `<input type="checkbox"><span>Lookahead bug</span>`;
  ctl.append(bug);
  const bugIn = bug.querySelector('input')!;
  const read = readout(fig);
  const ma = (n: number) => px.map((_, i) => (i + 1 < n ? NaN : px.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n));
  const paint = stage(fig.querySelector('.demo-stage')!, 0.48, (g, w, h) => {
    const f = ma(fast.get());
    const s = ma(slow.get());
    const pos = px.map((_, i) => (f[i] > s[i] ? 1 : 0));
    const strat = [1];
    const hold = [1];
    let peak = 1;
    let dd = 0;
    for (let i = 1; i < N; i++) {
      const r = px[i] / px[i - 1] - 1;
      // correct: trade on yesterday's signal. bug: use today's signal, which already knows today's close.
      const p = bugIn.checked ? pos[i] : pos[i - 1];
      strat.push(strat[i - 1] * (1 + p * r));
      hold.push(hold[i - 1] * (1 + r));
      peak = Math.max(peak, strat[i]);
      dd = Math.max(dd, 1 - strat[i] / peak);
    }
    const all = [...strat, ...hold];
    const lo = Math.min(...all) * 0.97;
    const hi = Math.max(...all) * 1.03;
    const X = (i: number) => (i / (N - 1)) * w;
    const Y = (v: number) => h - 16 - ((v - lo) / (hi - lo)) * (h - 26);
    const line = (arr: number[], col: string, width: number) => {
      g.strokeStyle = col;
      g.lineWidth = width;
      g.beginPath();
      arr.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))));
      g.stroke();
    };
    line(hold, css('--hair-2'), 1.2);
    line(strat, bugIn.checked ? '#e0707a' : css('--dust'), 1.8);
    g.fillStyle = css('--dim');
    g.font = '10px "IBM Plex Mono", monospace';
    g.fillText('strategy', 0, 12);
    g.fillText('— buy & hold (grey)', 64, 12);
    const pct = (v: number) => `${v >= 1 ? '+' : ''}${((v - 1) * 100).toFixed(0)}%`;
    read.textContent = `Strategy ${pct(strat[N - 1])} · Buy & hold ${pct(hold[N - 1])} · Max drawdown ${(dd * 100).toFixed(0)}%${
      bugIn.checked ? ' · inflated by lookahead' : ''
    }`;
  });
  for (const el of [fast.input, slow.input, bugIn]) el.addEventListener('input', paint);
}

/** Banking System: a tiny command line over a service + in-memory store, like the real project. */
function bankDemo(fig: HTMLElement) {
  const st = fig.querySelector('.demo-stage')!;
  st.innerHTML = `<div class="term" role="log" aria-live="polite"></div>
    <form class="term-in"><span class="mono" aria-hidden="true">$</span><input class="mono" aria-label="Banking command" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="type help"></form>`;
  const log = st.querySelector('.term')! as HTMLElement;
  const form = st.querySelector('form')!;
  const input = form.querySelector('input')!;
  const acct: Record<string, number> = { checking: 250, savings: 1000 };
  const hist: string[] = [];
  const money = (n: number) => `$${n.toFixed(2)}`;
  const say = (s: string, cls = '') => {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = s;
    log.append(p);
    log.scrollTop = log.scrollHeight;
  };
  const run = (line: string) => {
    const [cmd, a, b] = line.trim().toLowerCase().split(/\s+/);
    const amt = Number(a);
    const ok = (to = 'checking') => Number.isFinite(amt) && amt > 0 && to in acct;
    switch (cmd) {
      case 'help':
        return say('balance · deposit <amt> · withdraw <amt> · transfer <amt> savings · history · clear');
      case 'balance':
        return say(`checking ${money(acct.checking)} · savings ${money(acct.savings)}`);
      case 'deposit':
        if (!ok()) return say('error: amount must be a positive number', 'err');
        acct.checking += amt;
        hist.push(`deposit ${money(amt)}`);
        return say(`ok · checking ${money(acct.checking)}`);
      case 'withdraw':
        if (!ok()) return say('error: amount must be a positive number', 'err');
        if (amt > acct.checking) return say('error: insufficient funds', 'err');
        acct.checking -= amt;
        hist.push(`withdraw ${money(amt)}`);
        return say(`ok · checking ${money(acct.checking)}`);
      case 'transfer': {
        const to = b || 'savings';
        if (!ok(to) || to === 'checking') return say('error: try transfer 50 savings', 'err');
        if (amt > acct.checking) return say('error: insufficient funds', 'err');
        acct.checking -= amt;
        acct[to] += amt;
        hist.push(`transfer ${money(amt)} → ${to}`);
        return say(`ok · checking ${money(acct.checking)} · ${to} ${money(acct[to])}`);
      }
      case 'history':
        return say(hist.length ? hist.map((h, i) => `${i + 1}. ${h}`).join('\n') : 'no transactions yet');
      case 'clear':
        log.innerHTML = '';
        return;
      case undefined:
      case '':
        return;
      default:
        return say(`unknown command: ${cmd}. type help`, 'err');
    }
  };
  say('bank v1.0 · 17 tests passing', 'dim');
  say('type help to see commands', 'dim');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    say(`$ ${input.value}`, 'echo');
    run(input.value);
    input.value = '';
  });
}

/** Gravity Simulator: one eccentric orbit, stepped with leapfrog or with Euler. */
function orbitDemo(fig: HTMLElement) {
  const GM = 4 * Math.PI * Math.PI; // AU, years and solar masses
  const ECC = 0.5;
  const ctl = controls(fig);
  const steps = slider(ctl, 'Steps per orbit', 40, 500, 10, 100);
  const orbits = slider(ctl, 'Orbits', 1, 30, 1, 10);
  const tog = document.createElement('label');
  tog.className = 'ctl toggle';
  tog.innerHTML = `<input type="checkbox"><span>Use Euler</span>`;
  ctl.append(tog);
  const euler = tog.querySelector('input')!;
  const read = readout(fig);
  const paint = stage(fig.querySelector('.demo-stage')!, 0.62, (g, w, h) => {
    const s = Math.min(w / 3.3, h / 2.2); // pixels per AU
    const ox = w / 2 - 0.5 * s; // the star sits at one focus
    const oy = h / 2;
    // the exact ellipse
    g.strokeStyle = css('--dim');
    g.globalAlpha = 0.6;
    g.setLineDash([3, 4]);
    g.beginPath();
    g.ellipse(ox + ECC * s, oy, s, s * Math.sqrt(1 - ECC * ECC), 0, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
    // start at the far point of the orbit and step forward
    let x = 1 + ECC;
    let y = 0;
    let vx = 0;
    let vy = Math.sqrt((GM * (1 - ECC)) / (1 + ECC));
    const n = steps.get();
    const dt = 1 / n;
    const acc = (px: number, py: number): [number, number] => {
      const r3 = Math.pow(px * px + py * py, 1.5);
      return [(-GM * px) / r3, (-GM * py) / r3];
    };
    const energy = () => 0.5 * (vx * vx + vy * vy) - GM / Math.hypot(x, y);
    const e0 = energy();
    let worst = 0;
    let [ax, ay] = acc(x, y);
    g.strokeStyle = css('--acc') || css('--dust');
    g.lineWidth = 1.2;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(ox + x * s, oy - y * s);
    const total = n * orbits.get();
    for (let i = 0; i < total; i++) {
      if (euler.checked) {
        x += vx * dt;
        y += vy * dt;
        vx += ax * dt;
        vy += ay * dt;
        [ax, ay] = acc(x, y);
      } else {
        vx += (ax * dt) / 2;
        vy += (ay * dt) / 2;
        x += vx * dt;
        y += vy * dt;
        [ax, ay] = acc(x, y);
        vx += (ax * dt) / 2;
        vy += (ay * dt) / 2;
      }
      worst = Math.max(worst, Math.abs((energy() - e0) / e0));
      g.lineTo(ox + x * s, oy - y * s);
      if (Math.hypot(x, y) > 40) break; // thrown out of the system
    }
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = css('--star');
    g.beginPath();
    g.arc(ox, oy, 4.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = css('--acc') || css('--dust');
    g.beginPath();
    g.arc(ox + x * s, oy - y * s, 3.5, 0, Math.PI * 2);
    g.fill();
    const off = worst >= 0.01 ? `${worst >= 10 ? '1,000%+' : `${(worst * 100).toFixed(0)}%`}` : `${(worst * 100).toFixed(worst >= 0.001 ? 2 : 4)}%`;
    read.textContent = `${euler.checked ? 'Euler' : 'Leapfrog'} · ${n} steps per orbit · energy off by at most ${off} · dashed line: the exact orbit`;
  });
  for (const el of [steps.input, orbits.input, euler]) el.addEventListener('input', paint);
}

/**
 * Brain Oxygen Model: the repo's equation with its nominal parameters, stepped with RK4 as in simulator/model.js.
 *   dc/dt = a * [ q(t) * (1 / (1 - E) - c)  -  E / (1 - E) * m(c) ],  c = oxygen as a fraction of baseline
 */
function oxygenDemo(fig: HTMLElement) {
  const CBF = 44.4; // ml blood / 100 ml tissue / min
  const CBV = 3.8; // ml blood / 100 ml tissue
  const OEF = 0.44; // share of arriving oxygen the tissue takes
  const KAPPA = 0.1;
  const VERT = 0.28; // share of brain blood flow that comes up the vertebral arteries
  const THRESHOLD = 0.2411; // central fit to the 1943 cuff study
  const T_ON = 5;
  const T_END = 45;
  const DT = 0.01;
  const ctl = controls(fig);
  const cut = slider(ctl, 'Carotid flow cut', 0, 100, 1, 100, (v) => `${v}%`);
  const vert = slider(ctl, 'Vertebral flow left', 0, 100, 5, 100, (v) => `${v}%`);
  const hold = slider(ctl, 'Held for', 5, 30, 1, 20, (v) => `${v} s`);
  const read = readout(fig);
  const paint = stage(fig.querySelector('.demo-stage')!, 0.56, (g, w, h) => {
    const held = (1 - VERT) * (1 - cut.get() / 100) + VERT * (vert.get() / 100);
    const tOff = T_ON + hold.get();
    const q = (t: number) => (t < T_ON || t >= tOff ? 1 : held);
    const a = CBF / 60 / CBV;
    const rate = (c: number, f: number) => {
      const cc = Math.max(c, 0);
      return a * (f * (1 / (1 - OEF) - c) - (OEF / (1 - OEF)) * (((1 + KAPPA) * cc) / (KAPPA + cc)));
    };
    const L = 34;
    const B = 22;
    const X = (t: number) => L + (t / T_END) * (w - L - 6);
    const Y = (c: number) => 8 + (1 - c / 1.05) * (h - B - 8);
    // while the flow is cut
    g.fillStyle = css('--hair');
    g.fillRect(X(T_ON), Y(1.05), X(tOff) - X(T_ON), Y(0) - Y(1.05));
    // what was measured in fights: 8.3 to 9.9 s after the choke is on
    g.fillStyle = css('--acc') || css('--dust');
    g.globalAlpha = 0.22;
    g.fillRect(X(T_ON + 8.3), Y(1.05), X(T_ON + 9.9) - X(T_ON + 8.3), Y(0) - Y(1.05));
    g.globalAlpha = 1;
    // axes
    g.strokeStyle = css('--hair-2');
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(L, Y(1.05));
    g.lineTo(L, Y(0));
    g.lineTo(w - 6, Y(0));
    g.stroke();
    g.fillStyle = css('--dim');
    g.font = '10px "IBM Plex Mono", monospace';
    g.textAlign = 'right';
    for (const v of [0, 0.5, 1]) g.fillText(v.toFixed(1), L - 6, Y(v) + 3);
    g.textAlign = 'center';
    for (const t of [0, 10, 20, 30, 40]) g.fillText(`${t}s`, X(t), h - 6);
    // the threshold
    g.strokeStyle = css('--star');
    g.globalAlpha = 0.55;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(L, Y(THRESHOLD));
    g.lineTo(w - 6, Y(THRESHOLD));
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
    g.textAlign = 'right';
    g.fillText('fitted threshold', w - 8, Y(THRESHOLD) - 5);
    g.textAlign = 'left';
    // the trace, one RK4 step at a time; no step straddles a jump in flow because the switch times are whole steps
    let c = 1;
    let loc: number | null = null;
    g.strokeStyle = css('--acc') || css('--dust');
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(X(0), Y(1));
    const n = Math.round(T_END / DT);
    for (let i = 0; i < n; i++) {
      const t = i * DT;
      const f = q(t + DT / 2);
      const k1 = rate(c, f);
      const k2 = rate(c + (DT / 2) * k1, f);
      const k3 = rate(c + (DT / 2) * k2, f);
      const k4 = rate(c + DT * k3, f);
      const next = c + (DT / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      if (loc === null && c >= THRESHOLD && next < THRESHOLD) loc = t + (DT * (c - THRESHOLD)) / (c - next) - T_ON;
      c = next;
      if (i % 10 === 9) g.lineTo(X(t + DT), Y(c));
    }
    g.stroke();
    if (loc !== null) {
      g.fillStyle = css('--star');
      g.beginPath();
      g.arc(X(T_ON + loc), Y(THRESHOLD), 3.5, 0, Math.PI * 2);
      g.fill();
    }
    const flow = `${Math.round(held * 100)}% of normal flow`;
    read.textContent =
      loc !== null
        ? `${flow} · model: threshold crossed after ${loc.toFixed(1)} s · measured in fights: 9.0 s`
        : `${flow} · model: the threshold is never crossed in ${hold.get()} s`;
  });
  for (const s of [cut, vert, hold]) s.input.addEventListener('input', paint);
}

/** Resume Quest: equal arc-length placement on the golden spiral. */
function spiralDemo(fig: HTMLElement) {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const ctl = controls(fig);
  const n = slider(ctl, 'Planets', 3, 14, 1, 8);
  const read = readout(fig);
  const paint = stage(fig.querySelector('.demo-stage')!, 0.62, (g, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const R0 = Math.min(w, h) * 0.62;
    const END = R0 * 0.31;
    const at = (t: number) => {
      const r = R0 * Math.pow(PHI, (-2 * t) / Math.PI);
      return { x: cx + Math.cos(t + 3.5) * r, y: cy + Math.sin(t + 3.5) * r, r };
    };
    const span = (Math.log(R0 / END) / Math.log(PHI)) * (Math.PI / 2);
    g.strokeStyle = css('--dim');
    g.globalAlpha = 0.55;
    g.lineWidth = 1.2;
    g.beginPath();
    for (let k = 0; k <= 200; k++) {
      const p = at(-0.4 + ((span + 3) * k) / 200);
      if (k) g.lineTo(p.x, p.y);
      else g.moveTo(p.x, p.y);
    }
    g.stroke();
    g.globalAlpha = 1;
    const count = n.get();
    for (let i = 0; i < count; i++) {
      const r = R0 - (i / (count - 1)) * (R0 - END);
      const t = (Math.log(R0 / r) / Math.log(PHI)) * (Math.PI / 2);
      const p = at(t);
      g.fillStyle = css('--dust');
      g.beginPath();
      g.arc(p.x, p.y, 4 + (1 - i / count) * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = css('--star');
    g.beginPath();
    g.arc(cx, cy, 2.5, 0, Math.PI * 2);
    g.fill();
    read.textContent = `${count} planets · arc length on a log spiral grows linearly with r, so equal steps in r give equal spacing`;
  });
  n.input.addEventListener('input', paint);
}

/** Wire up everything interactive in the resume. */
export function mountCv(root: HTMLElement, toast: (s: string) => void) {
  // demos
  const kinds: Record<string, (f: HTMLElement) => void> = { zscore: zscoreDemo, backtest: backtestDemo, bank: bankDemo, spiral: spiralDemo, orbit: orbitDemo, oxygen: oxygenDemo };
  root.querySelectorAll<HTMLElement>('[data-demo]').forEach((f) => kinds[f.dataset.demo!]?.(f));

  // degree progress
  const deg = root.querySelector<HTMLElement>('[data-degree]');
  if (deg) {
    const a = new Date(2026, 8, 1).getTime();
    const b = new Date(2031, 3, 30).getTime();
    const k = Math.min(1, Math.max(0, (Date.now() - a) / (b - a)));
    deg.style.setProperty('--k', k.toFixed(4));
    const year = Math.min(5, Math.floor(k * 4.66) + 1);
    root.querySelector('[data-degree-label]')!.textContent = `Year ${year} · ${Math.round(k * 100)}% through`;
  }

  // skills: where each one is used
  const out = root.querySelector<HTMLElement>('[data-sk-out]')!;
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('.sk-chip'));
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      const on = c.getAttribute('aria-pressed') !== 'true';
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c && on)));
      const uses = (c.dataset.uses || '').split('|').filter(Boolean);
      out.innerHTML = !on
        ? 'Pick a skill to see where I’ve used it.'
        : uses.length
          ? `<strong>${esc(c.textContent!)}</strong> shows up in ${uses
              .map((u) => `<button class="linkish" data-open-project="${esc(u)}">${esc(u)}</button>`)
              .join(', ')}.`
          : `<strong>${esc(c.textContent!)}</strong> isn’t in a featured project yet.`;
    }),
  );
  // a project named anywhere on the page (the skills line) jumps to its room
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-open-project]');
    if (!b) return;
    document.getElementById(projectId(b.dataset.openProject ?? ''))?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  // every email address on the page is a copy button
  mountCopy(toast);

  // count-up stats, once each
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target as HTMLElement;
        const n = Number(el.dataset.count);
        if (reduced || n > 1000) return;
        const t0 = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - t0) / 900);
          el.textContent = String(Math.round(n * (1 - Math.pow(1 - k, 3))));
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { threshold: 0.6 },
  );
  root.querySelectorAll('[data-count]').forEach((el) => io.observe(el));
}
