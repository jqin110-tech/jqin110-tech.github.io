// The short version of the site: one quiet screen for a reader with thirty seconds.
// A small painting of the galaxy (the door to the full version), who Joshua is, three projects, and how to reach him.
// Every word comes from data.ts, so it can never disagree with the resume.
import { copyButton } from './copy';
import { resume } from './data';
import { drawAstronaut, drawCore, TEX_WORLD } from './draw';

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
        <span class="sp-plate"><span>The galaxy, 2026</span><b>Step inside <span aria-hidden="true">→</span></b></span>
      </button>
      <div class="sp-text">
        <h1 id="short-name">${esc(r.name)}</h1>
        <p class="sp-sub">${esc(r.education.program.replace(', Co-op', ' (Co-op)'))}, ${esc(r.education.school)}. Graduating ${esc(r.education.grad)}.</p>
        <p class="sp-lead">${esc(lead)}</p>
        <h2 class="sp-h">Selected work</h2>
        <ul class="sp-work">
          ${picks
            .map(
              (p) => `<li>
            <b>${esc(p.name)}</b>
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

export interface Art {
  light: boolean;
  galaxy: HTMLCanvasElement;
  core: HTMLCanvasElement;
  sky: HTMLCanvasElement | null;
  bg: string;
  vig0: string;
  vig: string;
}

/** Paints the picture: the hole at the centre of the galaxy, and one small astronaut on the way to it. */
export function paintShort(canvas: HTMLCanvasElement, art: Art, t: number, calm: boolean) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = art.bg;
  g.fillRect(0, 0, w, h);
  if (art.sky) g.drawImage(art.sky, -60, -60, w + 120, h + 120);
  const s = w / 720; // the frame is 720 world units wide: the whole disc, with air on both sides
  const cx = w * 0.5;
  const cy = h * 0.6;
  // only the part of the galaxy picture that the frame shows is drawn
  const k = art.galaxy.width / TEX_WORLD;
  g.drawImage(art.galaxy, art.galaxy.width / 2 - (cx / s) * k, art.galaxy.height / 2 - (cy / s) * k, (w / s) * k, (h / s) * k, 0, 0, w, h);
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  drawCore(g, t, art.light, art.core);
  g.restore();
  const v = g.createRadialGradient(cx, h / 2, Math.min(w, h) * 0.3, cx, h / 2, Math.max(w, h) * 0.8);
  v.addColorStop(0, art.vig0);
  v.addColorStop(1, art.vig);
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const px = Math.max(2, Math.round((w * dpr) / 120));
  const bob = calm ? 0 : Math.round(Math.sin(t * 1.6) * 1.3) * px;
  drawAstronaut(g, w * dpr * 0.27, h * dpr * 0.25 + bob, px, t, 1, 0, true);
}
