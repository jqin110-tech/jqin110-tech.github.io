// The short version of the site: one quiet screen for a reader with thirty seconds.
// It is laid out like a museum wall: one painting of the galaxy (the door to the full version, painted in starry.ts),
// its label, and beside it the wall text: who Joshua is, three projects, and how to reach him.
// Every word comes from data.ts, so it can never disagree with the resume.
import { copyButton } from './copy';
import { resume } from './data';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The three projects shown, strongest first. The rest live in the full version. */
const PICKS = ['Tickerchatter', 'Gravity Simulator', 'Backtester'];

export function shortPage(): string {
  const r = resume;
  const picks = PICKS.map((n) => r.projects.find((p) => p.name === n)!);
  // the summary's first sentence repeats the line above it, so only what follows is used
  const lead = r.summary.replace(/^[^.]*\.\s*/, '');
  const short = (label: string) => (/demo|site/i.test(label) ? 'Live' : 'Code');
  return `
    <div class="sp">
      <button class="sp-art" data-short-full aria-label="Open the full portfolio: the galaxy you can fly through">
        <span class="sp-frame"><canvas data-short-art></canvas></span>
        <span class="sp-plate"><span><b>The Galaxy at Night</b>, 2026</span><span>After Van Gogh. Code on canvas, 21,000 strokes.</span><span class="sp-go">Step inside <span aria-hidden="true">→</span></span></span>
      </button>
      <div class="sp-text">
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
    </div>`;
}
