// The short version of the site: one quiet screen for a reader with thirty seconds.
// It is a page of a sketchbook, spiral binding and all, with two doors that each say in plain words where they lead.
// On the left, one painting of the galaxy hanging from a picture rail (painted in starry.ts): the note under it says it is
// a game, and the button under that starts it. On the right, who Joshua is, three projects and how to reach him, then the
// full portfolio and the one-page resume. The rooftops of Paris run along the bottom. Nothing on this page scrolls.
// Every word comes from data.ts, so it can never disagree with the resume.
import { copyButton } from './copy';
import { resume } from './data';
import { inkArrow, inkFrame, inkRule, inkSkyline } from './ink';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The three projects shown, strongest first. The rest live in the full version. */
const PICKS = ['Tickerchatter', 'Gravity Simulator', 'Backtester'];

/** The play mark on the game button, drawn by hand like everything else on the page. */
const TRI = '<svg class="sp-tri" viewBox="0 0 20 22" aria-hidden="true"><path d="M3.2 2.4C2.5 8 2.6 14 3.4 19.8C8.6 17.4 13.8 14.4 18.2 11.1C13.4 7.9 8.4 4.9 3.2 2.4Z"/></svg>';

/** rooms: the names of the rooms the six stars open, in the order the painting numbers its stars. */
export function shortPage(rooms: string[]): string {
  const r = resume;
  const picks = PICKS.map((n) => r.projects.find((p) => p.name === n)!);
  // the summary's first sentence repeats the line above it, so only what follows is used
  const lead = r.summary.replace(/^[^.]*\.\s*/, '');
  const short = (label: string) => (/demo|site/i.test(label) ? 'Live' : 'Code');
  return `
    <div class="sb">
    <div class="sb-rings" aria-hidden="true"></div>
    <div class="sb-page">
    <div class="sp-room">
    <div class="sp">
      <div class="sp-bay sp-bay-art">
        <div class="sp-hang">
          <div class="sp-rail" aria-hidden="true">${inkRule(7, true)}</div>
          <div class="sp-frame">${inkFrame(800, 1000, 124, 11)}<div class="sp-pic">
            <canvas data-short-art role="img" aria-label="A painting of the galaxy in the manner of Van Gogh's Starry Night: a black hole in a swirling sky, six haloed stars, and a small astronaut on a hill. The painting is the way into a game: each star opens a room and the black hole starts the game."></canvas>
            <span class="sp-tip mono" data-short-tip aria-hidden="true"></span>
          </div></div>
        </div>
        <div class="sp-plate">
          ${inkArrow(5)}
          <span class="sp-ttl"><b lang="fr"><span class="sp-nb">La Galaxie,</span> <span class="sp-nb">la nuit</span></b></span>
          <span class="sp-say">This painting is a game. Fly a little astronaut through my resume.</span>
          <button class="btn sp-play" data-short-full>${TRI}Play the game</button>
        </div>
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
            <p><span class="sp-long">${esc(p.tagline)}</span><span class="sp-brief">${esc(p.brief ?? p.tagline)}</span></p>
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
          <button class="btn btn-primary" data-short-read><span class="sp-wide">Read the full portfolio</span><span class="sp-narrow">Full portfolio</span></button>
          <button class="sp-more" data-short-resume>One-page resume</button>
        </p>
      </div>
    </div>
    </div>
    <div class="sp-roofs" aria-hidden="true">${inkSkyline(1889)}</div>
    </div>
    </div>`;
}
