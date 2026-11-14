// One framed picture per project. It hangs at the top of the project's own room, and in the museum on the Projects planet.
// Every picture is the real thing: a screenshot of the site, a chart or a session produced by the project's own code.
import pvBacktester from './assets/pv-backtester.jpg';
import pvBanking from './assets/pv-banking.jpg';
import pvBrain from './assets/pv-brain.jpg';
import pvGravity from './assets/pv-gravity.jpg';
import pvQuest from './assets/pv-quest.jpg';
import pvTickerchatter from './assets/pv-tickerchatter.jpg';
import { resume } from './data';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** To add a picture: add the project to data.ts, put a 1000x625 picture in src/assets and add a line here. */
export const PIECES: { project: string; pic: string; shows: string; alt: string; credit?: string }[] = [
  {
    project: 'Gravity Simulator',
    pic: pvGravity,
    shows: 'A frame from the recorded 100,000-body run: two disc galaxies part-way through colliding.',
    alt: 'Two colliding disc galaxies drawn as thousands of points, one orange and one blue, with long curved tidal tails thrown out around two bright cores',
  },
  {
    project: 'Tickerchatter',
    pic: pvTickerchatter,
    shows: 'The front page of the live site.',
    alt: 'Tickerchatter’s front page: the question “Is the news obsessed with your stock today?”, a search box, and stock tiles with their z-scores',
  },
  {
    project: 'Brain Oxygen Model',
    pic: pvBrain,
    shows: 'The project’s 3D view a few seconds into a run: flow to the front of the brain is down to 19% and its oxygen is falling.',
    alt: 'A see-through 3D head in profile showing the skull, brain and neck arteries. The front of the brain has turned grey while the back stays pink, and a panel beside it reads carotid flow 19 percent, oxygen in the front of the brain 66 percent',
    credit: 'Anatomy: BodyParts3D © The Database Center for Life Science, CC BY 4.0, modified.',
  },
  {
    project: 'Backtester',
    pic: pvBacktester,
    shows: 'A result chart from the repo: the moving-average rule against buy and hold for MU, after costs.',
    alt: 'Line chart of the growth of one dollar from 2018 to 2026 for a moving-average strategy and for buy and hold, with the in-sample and out-of-sample periods marked',
  },
  {
    project: 'Resume Quest',
    pic: pvQuest,
    shows: 'The map at the top of this page.',
    alt: 'The galaxy map from this site, with six stops along a spiral',
  },
  {
    project: 'Banking System',
    pic: pvBanking,
    shows: 'A real session: a withdrawal refused, then the account history.',
    alt: 'A terminal session of the banking app showing its menu, a refused withdrawal and a transaction history',
  },
];

const COUNT: Record<number, string> = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight' };

/** The framed picture that opens a project's room, with one line saying what it shows. */
export function projectPicture(name: string): string {
  const g = PIECES.find((x) => x.project === name);
  const p = resume.projects.find((x) => x.name === name);
  if (!g || !p) return '';
  const link = (p.links ?? [])[0];
  const pic = `<span class="piece-pic"><img src="${g.pic}" alt="${esc(g.alt)}" width="1000" height="625" loading="lazy" decoding="async"></span>`;
  const frame =
    name === 'Resume Quest'
      ? `<a class="piece-frame" href="#top" data-to-top aria-label="${esc(p.name)}: back up to the galaxy">${pic}</a>`
      : link
        ? `<a class="piece-frame" href="${esc(link.url)}" target="_blank" rel="noopener" aria-label="${esc(p.name)}: ${esc(link.label.toLowerCase())}, opens in a new tab">${pic}</a>`
        : `<span class="piece-frame">${pic}</span>`;
  return `<figure class="story-pic" data-soft>${frame}<figcaption class="mono">${esc(g.shows)}${g.credit ? ` ${esc(g.credit)}` : ''}</figcaption></figure>`;
}

/** The heading that opens the Projects chapter. The plain "Projects" heading under it is the one for paper and screen readers. */
export function projectsHead(): string {
  const n = resume.projects.length;
  return `<section class="gal motion" aria-hidden="true">
    <header class="gal-head">
      <p class="show gal-title reveal">Projects</p>
      <p class="mono gal-note reveal">${COUNT[n] ?? n} so far. Each one has a demo you can try.</p>
    </header>
  </section>`;
}
