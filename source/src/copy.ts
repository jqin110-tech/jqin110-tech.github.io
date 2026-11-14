/**
 * An email address on this site is a button that copies it, never a mailto: link.
 * A mailto: link does nothing on a computer with no mail app set up, and nothing at all inside an embedded page,
 * so a click on it could look like a dead control. Copying always does something, and says so.
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The address, then a small word that says what a click does and then that it happened. */
export function copyButton(text: string, cls: string): string {
  return `<button type="button" class="${cls} copy" data-copy="${esc(text)}"><span class="copy-what">${esc(text)}</span><span class="copy-hint" aria-live="polite">Copy</span></button>`;
}

async function put(text: string, near: HTMLElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* blocked here: try the older way */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.readOnly = true;
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    // inside an open dialog the field has to live in the dialog, or it cannot take focus
    (near.closest('dialog') ?? document.body).append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    near.focus({ preventScroll: true });
    return ok;
  } catch {
    return false;
  }
}

const timers = new WeakMap<HTMLElement, number>();

/** One listener for every copy button on the page, including those drawn later inside a dialog. */
export function mountCopy(say: (msg: string) => void) {
  document.addEventListener('click', async (e) => {
    const b = (e.target as Element | null)?.closest<HTMLElement>('[data-copy]');
    if (!b) return;
    const text = b.dataset.copy!;
    const ok = await put(text, b);
    const hint = b.querySelector<HTMLElement>('.copy-hint');
    if (!ok) {
      // nothing could be copied: select the address so one keypress finishes the job
      const what = b.querySelector('.copy-what');
      if (what) {
        const r = document.createRange();
        r.selectNodeContents(what);
        const sel = getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
    }
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    const touch = matchMedia('(pointer: coarse)').matches;
    const msg = ok ? 'Copied' : touch ? 'Selected' : mac ? 'Press ⌘C' : 'Press Ctrl+C';
    if (hint) hint.textContent = msg;
    b.classList.add('copied');
    clearTimeout(timers.get(b));
    timers.set(
      b,
      window.setTimeout(() => {
        if (hint) hint.textContent = 'Copy';
        b.classList.remove('copied');
      }, 2200),
    );
    // the toast sits under an open dialog, so it only speaks when none is open
    if (!b.closest('dialog')) say(ok ? 'Email address copied.' : `Select and copy: ${text}`);
  });
}
