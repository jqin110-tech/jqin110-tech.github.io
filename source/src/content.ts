import mountains from './assets/mountains.jpg';
import { copyButton } from './copy';
import { criteria, resume, type CriterionId, type Project } from './data';
import { zones, type Zone } from './zones';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const list = (items: string[]) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
const links = (ls: { label: string; url: string }[] = []) =>
  ls.length
    ? `<p class="links">${ls
        .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} <span aria-hidden="true">↗</span></a>`)
        .join('')}</p>`
    : '';

export const criterionLabel = (id: CriterionId) => criteria.find((c) => c.id === id)!.label;

/** One row of the page: a quiet meta column (dates) beside the content. */
const entry = (meta: string, body: string) =>
  `<article class="entry"><p class="entry-meta">${esc(meta)}</p><div class="entry-main">${body}</div></article>`;

const notes = (items: [string, string][]) =>
  `<dl class="notes">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

function project(p: Project) {
  return entry(
    p.dates,
    `<h3>${esc(p.name)}</h3>
    <p class="entry-sub">${esc(p.tagline)}</p>
    ${list(p.bullets)}
    <p class="stack">${p.stack.map(esc).join('<span aria-hidden="true"> / </span>')}</p>
    ${links(p.links)}`,
  );
}

function contactBlock() {
  return `<p class="links big">
    ${copyButton(resume.email, 'link-copy')}
    ${resume.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} <span aria-hidden="true">↗</span></a>`).join('')}
  </p>`;
}

/** Body HTML for each planet's page. */
export function roomBody(z: Zone): string {
  const r = resume;
  switch (z.id) {
    case 'brief':
      return `<p class="lede">${esc(r.summary)}</p>
        ${r.about.paras.map((p) => `<p class="body-copy about-copy">${esc(p)}</p>`).join('')}
        <h4 class="label">Off the clock</h4>
        <dl class="notes">${[...r.about.offClock, r.about.photo].map((o) => `<div><dt>${esc(o.label)}</dt><dd>${esc(o.text)}</dd></div>`).join('')}</dl>
        <figure class="room-photo"><img src="${mountains}" alt="${esc(r.about.photo.alt)}" width="880" height="1173" loading="lazy"></figure>
        <h4 class="label">This map</h4>
        <p class="body-copy">Each planet on this map holds one section of my resume, laid out along a golden spiral. Visit them in any order, or use Next to read straight through.</p>
        <h4 class="label">Controls</h4>
        <dl class="keys">
          <div><dt>Fly</dt><dd><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys</dd></div>
          <div><dt>Travel</dt><dd>Click a planet, or <kbd>1</kbd>–<kbd>${zones.length}</kbd></dd></div>
          <div><dt>Land</dt><dd><kbd>E</kbd> when close</dd></div>
          <div><dt>Map</dt><dd><kbd>M</kbd></dd></div>
          <div><dt>Light mode</dt><dd>Fly into the black hole, or <kbd>L</kbd></dd></div>
          <div><dt>Touch</dt><dd>Use the stick to fly, tap a planet to land</dd></div>
          <div><dt>Resume</dt><dd>Scroll down, or <kbd>R</kbd></dd></div>
        </dl>`;
    case 'campus': {
      const e = r.education;
      return entry(e.dates, `<h3>${esc(e.school)}</h3><p class="entry-sub">${esc(e.program)}</p>${list(e.details)}`);
    }
    case 'workshop':
      return r.projects.map(project).join('');
    case 'tower':
      return r.experience
        .map((x) => entry(x.dates, `<h3>${esc(x.title)}</h3><p class="entry-sub">${esc(x.org)}</p>${list(x.bullets)}`))
        .join('');
    case 'observatory':
      return `<dl class="notes">${Object.entries(r.skills)
        .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v.map(esc).join(', ')}</dd></div>`)
        .join('')}</dl>
        <h4 class="label">Problems that caught my attention</h4>${notes(r.curiosity)}`;
    case 'signal':
      return `<p class="lede">The fastest way to reach me is email.</p>
        ${contactBlock()}`;
  }
}
