// The short version of the site: one quiet screen for a reader with thirty seconds.
// It is drawn like a page from a Paris sketchbook: one wall of a gallery in pen (ink.ts), with one painting of the galaxy
// hanging from the picture rail (the door to the full version, painted in starry.ts), its label, the wall text beside it
// (who Joshua is, three projects, how to reach him), and the rooftops of Paris along the bottom.
// Every word comes from data.ts, so it can never disagree with the resume.
import { copyButton } from './copy';
import { resume } from './data';
import { inkFrame, inkRule, inkSkyline } from './ink';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The three projects shown, strongest first. The rest live in the full version. */
const PICKS = ['Tickerchatter', 'Gravity Simulator', 'Backtester'];

/** rooms: the names of the rooms the six stars open, in the order the painting numbers its stars. */
export function shortPage(rooms: string[]): string {
  const r = resume;
  const picks = PICKS.map((n) => r.projects.find((p) => p.name === n)!);
  // the summary's first sentence repeats the line above it, so only what follows is used
  const lead = r.summary.replace(/^[^.]*\.\s*/, '');
  const short = (label: string) => (/demo|site/i.test(label) ? 'Live' : 'Code');
  return `
    <div class="sp-room">
    <div class="sp">
      <div class="sp-bay sp-bay-art">
        <div class="sp-hang">
          <div class="sp-rail" aria-hidden="true">${inkRule(7, true)}</div>
          <div class="sp-frame">${inkFrame(800, 1000, 124, 11)}<div class="sp-pic">
            <canvas data-short-art role="img" aria-label="A painting of the galaxy in the manner of Van Gogh's Starry Night: a black hole in a swirling sky, six haloed stars, and a small astronaut on a hill. Each star opens a room and the black hole opens the galaxy."></canvas>
            <span class="sp-tip mono" data-short-tip aria-hidden="true"></span>
          </div></div>
        </div>
        <button class="sp-plate" data-short-full>
          <span><b lang="fr">La Galaxie, la nuit</b></span>
          <span>The Galaxy at Night, 2026</span>
          <span>After Van Gogh. Code on canvas, 21,000 strokes.</span>
          <span class="sp-how">Stir the sky. Each star opens a room, and the black hole opens the galaxy.</span>
          <span class="sp-go">Step inside <span aria-hidden="true">→</span></span>
        </button>
        <ul class="sr-only" aria-label="Rooms">${rooms.map((t, i) => `<li><button data-short-star="${i}">${esc(t)}</button></li>`).join('')}</ul>
      </div>
      <div class="sp-bay sp-text">
        <h1 id="short-name">${esc(r.name)}</h1>
        <p class="sp-sub">${esc(r.education.program.replace(', Co-op', ' (Co-op)'))}, ${esc(r.education.school)}. Graduating ${esc(r.education.grad)}.</p>
        <p class="sp-lead">${esc(lead)}</p>
        <h2 class="sp-h">Selected works</h2>
        <ul class="sp-work">
          ${picks
            .map(
              (p) => `<li>
            <b>${esc(p.name)}<i>, ${esc(p.dates.slice(-4))}</i></b>
            <p>${esc(p.tagline)}</p>
            <span class="sp-links">${(p.links ?? []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener" aria-label="${esc(p.name)}: ${esc(l.label)}">${short(l.label)}</a>`).join('')}</span>
          </li>`,
            )
            .join('')}
        </ul>
        <dl class="sp-facts">
          <dt>Languages</dt><dd>${r.skills.Languages.map(esc).join(', ')}</dd>
          <dt>Contact</dt><dd>${copyButton(r.email, 'sp-copy')}${r.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</dd>
        </dl>
        <p class="sp-actions">
          <button class="btn btn-primary" data-short-full>See the full portfolio</button>
          <button class="sp-more" data-short-resume>One-page resume</button>
        </p>
      </div>
    </div>
    </div>
    <div class="sp-roofs" aria-hidden="true">${inkSkyline(1889)}</div>`;
}
