import './style.css';
import { criteria, resume } from './data';
import { Game } from './game';
import { zones, type Zone } from './zones';
import { roomBody } from './content';
import { museumScene } from './museum';
import { cabinScene, lectureScene, observatoryScene, postScene, streetScene } from './places';
import { mountRoom, roomMarkup, type SceneFactory } from './room';
import { cvSections, mountCv, projectId, quickResume, siteResume } from './cv';
import { shortPage } from './short';
import { mountStarry, STAR_ZONES } from './starry';
import { mountMotion } from './motion';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(document.querySelectorAll(sel)) as T[];

const STORE = 'resume-galaxy-visited';
const store = {
  get(): string[] {
    try {
      return JSON.parse(localStorage.getItem(STORE) || '[]');
    } catch {
      return [];
    }
  },
  set(v: string[]) {
    try {
      localStorage.setItem(STORE, JSON.stringify(v));
    } catch {
      /* progress just isn't remembered */
    }
  },
};

const visited = new Set<string>(store.get().filter((id) => zones.some((z) => z.id === id)));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)');

// ---------- static text ----------
$$('[data-name]').forEach((el) => (el.textContent = resume.name));
$$('[data-headline]').forEach((el) => (el.textContent = resume.headline));
$('[data-cv]').innerHTML = siteResume();
const cvToast = document.createElement('div');
cvToast.className = 'toast cv-toast mono';
cvToast.setAttribute('role', 'status');
document.body.append(cvToast);
let cvToastTimer = 0;
mountCv($('[data-cv]'), (msg) => {
  cvToast.textContent = msg;
  cvToast.classList.add('show');
  clearTimeout(cvToastTimer);
  cvToastTimer = window.setTimeout(() => cvToast.classList.remove('show'), 2600);
});
$('[data-cv-tabs]').innerHTML = cvSections.map((s) => `<li><a class="pill tab" href="#${s.id}">${s.label}</a></li>`).join('');

const canvas = $<HTMLCanvasElement>('#world');
const titleCard = $('[data-title]');
const dialog = $<HTMLDialogElement>('#room');
const quick = $<HTMLDialogElement>('#quick');
const short = $<HTMLDialogElement>('#short');
/** A planet page, the short version or the quick resume is open over the site. */
const modalOpen = () => dialog.open || quick.open || short.open;
// declared up here because a link straight to the quick resume opens it before the rest of the page is wired
let locked = false; // the page is held still while the game is being played
let touchGuard = false;
const toastEl = $('[data-toast]');
const land = $<HTMLButtonElement>('[data-land]');
const resumeView = $('#resume');
const gameView = $('#game-view');

let toastTimer = 0;
function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 3600);
}

// ---------- game ----------
let current: Zone | null = null;
let bangToast = false;
const game = new Game(canvas, {
  onNear(z) {
    current = z ?? current;
    land.hidden = !z;
    if (z) {
      // on a phone the landing control is a round thumb button; with a keyboard it is a hint pill
      land.innerHTML = coarse.matches ? `<b>Land</b><span>${z.title}</span>` : `<span class="mono">${z.code}</span> Land on ${z.title} <kbd>E</kbd>`;
      land.setAttribute('aria-label', `Land on ${z.title}`);
    }
    $$('[data-travel] button').forEach((b) => b.toggleAttribute('aria-current', b.dataset.goto === z?.id));
  },
  onEnter: openRoom,
  onNotice: toast,
  onDimension: setDimension,
  onReady() {
    gameView.classList.add('live');
    syncMap();
    if (bangToast) {
      toast(coarse.matches ? 'Use the stick to fly. Tap a planet to land.' : 'Fly with the arrow keys, or click a planet.');
      // then point out the secret in the middle
      setTimeout(() => {
        if (!modalOpen() && scrolled < 0.5) toast(game.isLight ? 'The white hole in the centre leads back to dark mode.' : 'The black hole in the centre leads to light mode.');
      }, 4400);
    }
    bangToast = false;
  },
});
game.reducedMotion = reduced.matches;
const DIM = 'resume-galaxy-dimension';
function setDimension(light: boolean) {
  document.documentElement.classList.toggle('other-side', light);
  const coreLabel = document.querySelector('[data-core-label]');
  if (coreLabel) coreLabel.textContent = light ? 'Dark mode' : 'Light mode';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f6f1ea' : '#030409');
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(!light)));
  try {
    localStorage.setItem(DIM, light ? 'light' : 'dark');
  } catch {
    /* not remembered */
  }
}
let startLight = false;
try {
  startLight = localStorage.getItem(DIM) === 'light';
} catch {
  /* default dimension */
}
game.showLabels = false;
document.body.classList.add('at-title');
reduced.addEventListener('change', () => (game.reducedMotion = reduced.matches));
if (startLight) {
  game.setLight(true);
  setDimension(true);
}
game.setVisited(visited);
land.addEventListener('click', () => game.tryEnter());

// ---------- dark mode switch: the plain way to change dimension, next to the black hole ----------
$$('[data-mode]').forEach((b) =>
  b.addEventListener('click', () => {
    const light = !game.isLight;
    game.setLight(light);
    setDimension(light);
  }),
);

// ---------- the quick resume: short and plain, for a reader in a hurry ----------
$('[data-quick-body]').innerHTML = quickResume();
function openQuick() {
  if (dialog.open) dialog.close();
  if (short.open) short.close();
  if (!quick.open) quick.showModal();
  syncTouchGuard();
  quick.querySelector<HTMLElement>('.quick-body')!.scrollTop = 0;
}
document.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  if (el.closest('[data-quick]')) openQuick();
  else if (el.closest('[data-quick-full]')) {
    quick.close();
    toResume();
  } else if (el.closest('[data-quick-close]') || el === quick) quick.close();
});
if (location.hash === '#quick') openQuick();

// ---------- the short version: the whole site on one quiet screen ----------
const starZones = STAR_ZONES.map((id) => zones.find((z) => z.id === id)!);
$('[data-short-body]').innerHTML = shortPage(starZones.map((z) => z.title));
const shortArt = $<HTMLCanvasElement>('[data-short-art]');
const shortTip = $('[data-short-tip]');
let shortFrame = 0;
const paintStarry = mountStarry(shortArt, {
  onHover(what, x, y) {
    shortTip.classList.toggle('show', what !== null);
    if (what === null) return;
    shortTip.textContent = what === -1 ? 'Enter the galaxy' : starZones[what].title;
    shortTip.style.left = `${x}px`;
    shortTip.style.top = `${y}px`;
  },
  onStar: (i) => openRoom(starZones[i]),
  onHole: () => short.close(),
  // with motion turned down nothing repaints on its own, so a touch asks for one frame
  invalidate: () => reduced.matches && short.open && !shortFrame && (shortFrame = requestAnimationFrame(paintShortArt)),
});
function paintShortArt(now: number) {
  shortFrame = 0;
  if (!short.open) return;
  // a room opened from a star sits on top: the painting waits underneath
  if (!dialog.open) paintStarry(now / 1000, reduced.matches);
  if (!reduced.matches) shortFrame = requestAnimationFrame(paintShortArt);
}
/** The plain address (and #short) opens the short version. Any other address goes where it says. */
const shortFirst = () => location.hash === '' || location.hash === '#short';
function setHash(hash: string) {
  try {
    history.replaceState(null, '', location.pathname + location.search + hash);
  } catch {
    /* an embedded page may not be allowed to change its address: nothing depends on it */
  }
}
function openShort() {
  if (dialog.open) dialog.close();
  if (quick.open) quick.close();
  if (!short.open) short.showModal();
  syncTouchGuard();
  short.querySelector<HTMLElement>('.short-body')!.scrollTop = 0;
  cancelAnimationFrame(shortFrame);
  shortFrame = requestAnimationFrame(paintShortArt);
}
document.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  if (el.closest('[data-short]')) {
    openShort();
    setHash('');
  } else if (el.closest('[data-short-full]')) short.close();
  else if (el.closest('[data-short-resume]')) openQuick();
  else if (el.closest('[data-short-star]')) openRoom(starZones[Number(el.closest<HTMLElement>('[data-short-star]')!.dataset.shortStar)]);
});
short.addEventListener('close', () => {
  cancelAnimationFrame(shortFrame);
  shortFrame = 0;
  syncTouchGuard();
  // the short version is what the plain address opens, so the full site gets an address of its own:
  // a reload, or a link copied from here, comes back to the galaxy and not to the short page
  if (shortFirst()) setHash('#play');
});
addEventListener('resize', () => short.open && reduced.matches && !shortFrame && (shortFrame = requestAnimationFrame(paintShortArt)));
if (shortFirst()) openShort();
addEventListener('hashchange', () => shortFirst() && openShort());

// ---------- checklist + planet nav ----------
function unlocked() {
  const ids = new Set<string>();
  for (const z of zones) if (visited.has(z.id)) z.criteria.forEach((c) => ids.add(c));
  return ids;
}
function renderProgress() {
  const u = unlocked();
  $('[data-crit-list]').innerHTML = criteria
    .map((c) => {
      const z = zones.find((z) => (z.criteria as readonly string[]).includes(c.id))!;
      const on = u.has(c.id);
      return `<li class="${on ? 'on' : ''}"><span class="tick" aria-hidden="true">${on ? '✓' : ''}</span>
        <span>${c.label}<span class="sr-only">${on ? ', discovered' : ', not discovered yet'}</span></span>
        <button class="linkish mono" data-goto="${z.id}">${z.title}</button></li>`;
    })
    .join('');
  $('[data-crit-count]').textContent = `${u.size}/${criteria.length}`;
  $('.meter-fill').style.width = `${(u.size / criteria.length) * 100}%`;
  $$('[data-travel] button').forEach((b) => b.classList.toggle('done', visited.has(b.dataset.goto!)));
}

$('[data-travel]').innerHTML = zones
  .map(
    (z) => `<li><button class="pill planet-pill" data-goto="${z.id}" style="--dot:${z.look.glow}">
      <span class="dot" aria-hidden="true"></span><span>${z.title}</span></button></li>`,
  )
  .join('') +
  `<li class="core-item"><button class="pill planet-pill core-pill" data-core title="Fly into the black hole">
    <span class="half" aria-hidden="true"></span><span data-core-label>${startLight ? 'Dark mode' : 'Light mode'}</span></button></li>`;
$('[data-core]').addEventListener('click', () => {
  hideTitle();
  toast(game.isLight ? 'Flying into the white hole…' : 'Flying into the black hole…');
  game.diveIntoCore();
  canvas.focus({ preventScroll: true });
});

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-goto]');
  if (!b) return;
  const z = zones.find((z) => z.id === b.dataset.goto)!;
  $<HTMLDetailsElement>('.checklist').open = false;
  if (dialog.open) dialog.close();
  hideTitle();
  game.teleport(z);
  syncMap();
  openRoom(z);
});

// ---------- map toggle ----------
const mapBtn = $<HTMLButtonElement>('[data-map]');
function syncMap() {
  const on = game.isOverview && game.isLive;
  mapBtn.setAttribute('aria-pressed', String(on));
  $('[data-map-label]').textContent = on ? (coarse.matches ? 'CLOSE' : 'CLOSE MAP') : 'MAP';
}
mapBtn.addEventListener('click', () => {
  hideTitle();
  game.setOverview(!game.isOverview);
  syncMap();
  canvas.focus({ preventScroll: true });
});

// ---------- rooms ----------
let leaveMuseum: (() => void) | null = null;
const PLACES: Partial<Record<Zone['id'], SceneFactory>> = {
  brief: cabinScene,
  campus: lectureScene,
  workshop: museumScene,
  tower: streetScene,
  observatory: observatoryScene,
  signal: postScene,
};
function openRoom(z: Zone) {
  const i = zones.indexOf(z);
  const n = (k: number) => String(k + 1).padStart(2, '0');
  $('[data-room-kicker]').textContent = `${n(i)} · ${z.section}`;
  $('[data-room-title]').textContent = z.title;
  leaveMuseum?.();
  leaveMuseum = null;
  const place = PLACES[z.id];
  dialog.classList.toggle('museum', !!place);
  $('[data-room-body]').innerHTML = place ? roomMarkup(matchMedia('(pointer: coarse)').matches) : roomBody(z);
  $('[data-room-count]').textContent = `${n(i)} / ${String(zones.length).padStart(2, '0')}`;
  const prev = $<HTMLButtonElement>('[data-prev]');
  prev.disabled = i === 0;
  prev.innerHTML = i === 0 ? '<span aria-hidden="true">←</span> Back' : `<span aria-hidden="true">←</span> ${zones[i - 1].title}`;
  $('[data-next]').innerHTML = i === zones.length - 1 ? 'Full resume <span aria-hidden="true">→</span>' : `${zones[i + 1].title} <span aria-hidden="true">→</span>`;
  current = z;

  const before = unlocked().size;
  visited.add(z.id);
  store.set([...visited]);
  game.setVisited(visited);
  renderProgress();
  const after = unlocked().size;

  game.stop();
  if (!dialog.open) dialog.showModal();
  syncTouchGuard();
  $('.room-body').scrollTop = 0;
  // most planets open onto a small place you walk through, not a page
  if (place) leaveMuseum = mountRoom($('[data-museum]'), dialog, { calm: reduced.matches, onRoom: toProject, onExit: () => dialog.close() }, place);
  if (after > before && after === criteria.length) toast('Everything discovered. Mission complete.');
  else if (after > before) toast(`Discovered: ${after} of ${criteria.length}`);
}

function step(d: number) {
  if (!current) return;
  const i = zones.indexOf(current) + d;
  if (i >= zones.length) {
    dialog.close();
    toResume();
    return;
  }
  if (i < 0) return;
  game.teleport(zones[i]);
  openRoom(zones[i]);
}
$('[data-next]').addEventListener('click', () => step(1));
$('[data-prev]').addEventListener('click', () => step(-1));
$('[data-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});
dialog.addEventListener('close', () => {
  if (dialog.open) return; // already reopened on another planet
  leaveMuseum?.();
  leaveMuseum = null;
  if (scrolled > 0.5) return;
  game.start();
  canvas.focus({ preventScroll: true });
});

// ---------- title ----------
function hideTitle(bang = false) {
  if (titleCard.hidden) return;
  playing = true;
  scrollTo({ top: 0 });
  syncLock();
  titleCard.classList.add('leaving');
  document.body.classList.remove('at-title');
  game.showLabels = true;
  setTimeout(() => (titleCard.hidden = true), reduced.matches ? 0 : 500);
  if (bang) game.bigBang();
  else game.reveal();
  syncMap();
}
$('[data-start]').addEventListener('click', () => {
  bangToast = true;
  // on a phone the game takes the whole screen where the browser allows it (it does not on iPhone)
  if (coarse.matches) goFullscreen();
  hideTitle(true);
  canvas.focus({ preventScroll: true });
});

// ---------- phone menu and full screen ----------
const fsRoot = document.documentElement;
const canFullscreen = typeof fsRoot.requestFullscreen === 'function' && document.fullscreenEnabled;
function goFullscreen() {
  if (!canFullscreen || document.fullscreenElement) return;
  fsRoot.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
    /* refused: the game simply stays in the page */
  });
}
{
  const menuBtn = $<HTMLButtonElement>('[data-menu]');
  const setMenu = (open: boolean) => {
    gameView.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) game.setStick(0, 0);
  };
  menuBtn.addEventListener('click', () => setMenu(!gameView.classList.contains('menu-open')));
  $$('[data-menu-close]').forEach((b) => b.addEventListener('click', () => setMenu(false)));
  // choosing anything in the menu closes it
  $('.travel').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button, a')) setMenu(false);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
  });
  const fsBtn = $<HTMLButtonElement>('[data-fullscreen]');
  if (canFullscreen) {
    fsBtn.hidden = false;
    const label = () => (fsBtn.textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen');
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else goFullscreen();
    });
    document.addEventListener('fullscreenchange', label);
  } else $('.sheet-more').classList.add('one');
}

// ---------- joystick (phones) ----------
{
  const stick = $('[data-stick]');
  const knob = stick.firstElementChild as HTMLElement;
  const REACH = 38; // px the knob can travel from the centre
  let id = -1;
  const move = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / REACH);
    knob.style.transform = `translate(${((dx / d) * k * REACH).toFixed(1)}px, ${((dy / d) * k * REACH).toFixed(1)}px)`;
    game.setStick((dx / d) * k, (dy / d) * k);
  };
  const drop = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    stick.classList.remove('held');
    knob.style.transform = '';
    game.setStick(0, 0);
  };
  stick.addEventListener('pointerdown', (e) => {
    if (id !== -1) return;
    e.preventDefault();
    id = e.pointerId;
    stick.setPointerCapture(id);
    stick.classList.add('held');
    move(e);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId === id) move(e);
  });
  stick.addEventListener('pointerup', drop);
  stick.addEventListener('pointercancel', drop);
  stick.addEventListener('lostpointercapture', drop);
}

// ---------- keyboard ----------
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']);
function gameHasFocus() {
  const a = document.activeElement;
  return a === canvas || a === document.body || a === null;
}
addEventListener('keydown', (e) => {
  if (scrolled > 0.5 || modalOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!titleCard.hidden) {
    if ((e.code === 'Enter' || e.code === 'Space') && gameHasFocus()) {
      e.preventDefault();
      $<HTMLButtonElement>('[data-start]').click();
    }
    return;
  }
  if (!gameHasFocus()) return;
  if (GAME_KEYS.has(e.code)) {
    e.preventDefault();
    game.keyDown(e.code);
  } else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
    e.preventDefault();
    game.tryEnter();
  } else if (e.code === 'KeyL') {
    game.diveIntoCore();
  } else if (e.code === 'KeyM') {
    mapBtn.click();
  } else if (/^Digit[1-9]$/.test(e.code)) {
    const z = zones[Number(e.code.slice(5)) - 1];
    if (z) game.flyTo(z);
  } else if (e.code === 'KeyR') {
    toResume();
  }
});
addEventListener('keyup', (e) => game.keyUp(e.code));
addEventListener('blur', () => GAME_KEYS.forEach((k) => game.keyUp(k)));
canvas.addEventListener('pointerdown', () => {
  if (!titleCard.hidden) hideTitle();
});

// ---------- while you fly, the page stays put ----------
// Once the game has started, the wheel no longer scrolls the page, so the galaxy can't be blurred by
// accident. The Resume button (or R) is the way down; scrolling works again there.
// Phones are different: the joystick does the flying, so a swipe is free to scroll like on any other page.
let playing = false; // the title card has been dismissed
let goingDown = false; // a deliberate trip to the resume is in progress
let lockHintAt = -1e9;
function syncLock(y = scrollY) {
  const on = playing && y < 2 && !goingDown && !coarse.matches;
  if (on !== locked) {
    locked = on;
    document.documentElement.classList.toggle('playing', on);
  }
  syncTouchGuard();
}
// The listener that can cancel a touch drag is only attached while there is something to hold still.
// Left on all the time, it makes a phone ask the page for permission before every scroll, which is what makes scrolling stutter.
function syncTouchGuard() {
  const on = locked || modalOpen();
  if (on === touchGuard) return;
  touchGuard = on;
  if (on) addEventListener('touchmove', blockScroll, { passive: false });
  else removeEventListener('touchmove', blockScroll);
}
/** The panel under the pointer, if it still has room to scroll the way the gesture is going. */
function roomToScroll(el: HTMLElement | null, dx: number, dy: number) {
  const box = el?.closest?.<HTMLElement>('.room-body, .quick-body, .short-body, .checklist-panel, .travel');
  if (!box) return false;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? box.scrollLeft + box.clientWidth < box.scrollWidth - 1 : box.scrollLeft > 0;
  }
  return dy > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0;
}
let touchX = 0;
let touchY = 0;
addEventListener(
  'touchstart',
  (e) => {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  },
  { passive: true },
);
function blockScroll(e: Event) {
  // a planet page counts as playing: the page behind it must never move
  if (!locked && !modalOpen()) return;
  if (!e.cancelable) return;
  const el = e.target as HTMLElement | null;
  let dx = 0;
  let dy = 0;
  if (e instanceof WheelEvent) {
    if (e.ctrlKey) return; // pinch zoom
    dx = e.shiftKey ? e.deltaY : e.deltaX;
    dy = e.shiftKey ? 0 : e.deltaY;
  } else {
    const t = (e as TouchEvent).touches[0];
    if (!t || (e as TouchEvent).touches.length > 1) return;
    dx = touchX - t.clientX;
    dy = touchY - t.clientY;
  }
  if (roomToScroll(el, dx, dy)) return;
  e.preventDefault();
  if (e.type === 'wheel' && performance.now() - lockHintAt > 8000 && !modalOpen() && !el?.closest?.('.travel, .checklist-panel')) {
    lockHintAt = performance.now();
    toast('Scrolling is paused while you fly. Press Resume ↓ to read the resume.');
  }
}
addEventListener('wheel', blockScroll, { passive: false });
dialog.addEventListener('close', syncTouchGuard);
quick.addEventListener('close', syncTouchGuard);
addEventListener('keydown', (e) => {
  if (modalOpen()) {
    // keys scroll the open page itself, never the page behind it
    const el = e.target as HTMLElement | null;
    if (el?.closest?.('input, textarea, select')) return;
    const body = short.open ? short.querySelector<HTMLElement>('.short-body')! : quick.open ? quick.querySelector<HTMLElement>('.quick-body')! : dialog.querySelector<HTMLElement>('.room-body')!;
    const page = body.clientHeight * 0.85;
    const step: Record<string, number> = { PageDown: page, PageUp: -page, ArrowDown: 60, ArrowUp: -60, End: 1e6, Home: -1e6 };
    if (e.code === 'Space' && !el?.closest?.('button, a, summary')) step.Space = e.shiftKey ? -page : page;
    if (e.code in step) {
      e.preventDefault();
      body.scrollBy({ top: step[e.code] });
    }
    return;
  }
  if (!locked) return;
  if (['PageDown', 'PageUp', 'End', 'Home'].includes(e.code)) e.preventDefault();
});

// ---------- one page: the galaxy on top, the resume scrolls up over it ----------
let scrolled = 0; // 0 = galaxy fills the screen, 1 = scrolled a full screen down
const smooth = () => (reduced.matches ? 'auto' : 'smooth') as ScrollBehavior;
function toResume() {
  if (dialog.open) dialog.close();
  if (short.open) short.close();
  goingDown = true;
  setTimeout(() => (goingDown = false), 1600);
  syncLock();
  resumeView.scrollIntoView({ behavior: smooth() });
  resumeView.focus({ preventScroll: true });
}
/** Leave the galaxy for one project's room on the page below. */
function toProject(name: string) {
  if (dialog.open) dialog.close();
  if (short.open) short.close();
  goingDown = true;
  setTimeout(() => (goingDown = false), 1600);
  syncLock();
  document.getElementById(projectId(name))?.scrollIntoView({ behavior: smooth() });
}
$$('[data-to-resume]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    toResume();
  }),
);
$$('[data-to-top]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    scrollTo({ top: 0, behavior: smooth() });
    canvas.focus({ preventScroll: true });
  }),
);
$$<HTMLAnchorElement>('.cv-tabs a').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector(a.hash)?.scrollIntoView({ behavior: smooth(), block: 'start' });
  }),
);

const reveals = $$('.reveal');
const motion = mountMotion($('[data-cv]'), reduced.matches);
// phones: blocks fade up once as they arrive, with nothing recalculated while the page scrolls
const phone = matchMedia('(max-width: 860px), (pointer: coarse) and (max-height: 520px)');
const appScroll = () => phone.matches && !reduced.matches;
let arrivals: IntersectionObserver | null = null;
function syncReveals() {
  arrivals?.disconnect();
  arrivals = null;
  if (!appScroll()) return;
  // the root reaches far above the screen, so a block that was jumped past still counts as arrived
  const o = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        o.unobserve(el);
        el.dataset.seen = '1';
        el.style.setProperty('--f', '1');
      }
    },
    { rootMargin: '100000px 0px 0px 0px', threshold: 0.12 },
  );
  for (const el of reveals) {
    if (el.dataset.seen) continue;
    el.style.setProperty('--f', '0');
    el.classList.remove('sharp');
    o.observe(el);
  }
  arrivals = o;
}
syncReveals();
phone.addEventListener('change', () => {
  syncReveals();
  queue();
});
const nav = $('.cv-nav');
const tabs = $$<HTMLAnchorElement>('.cv-tabs a');
let ticking = false;
// The page's height and where each section starts are measured when the layout changes, not on every scroll frame.
// Asking for them mid-scroll makes a phone lay the whole page out again each frame, which is what makes it stutter.
let pageH = 0;
let sectionTops: [string, number][] = [];
let stale = true;
function measure() {
  stale = false;
  pageH = document.documentElement.scrollHeight;
  sectionTops = cvSections.map((s2) => {
    const el = document.getElementById(s2.id);
    return [s2.id, el ? el.getBoundingClientRect().top + scrollY : Infinity] as [string, number];
  });
}
new ResizeObserver(() => {
  stale = true;
  queue();
}).observe(resumeView);
let awayShown = '';
let pageShown = '';
let curShown = '-';
function onScroll() {
  ticking = false;
  // read first, write after: asking the page a question once styles have changed makes the browser redo them on the spot
  const vh = innerHeight;
  const y = scrollY;
  if (stale) measure();
  scrolled = Math.min(1, Math.max(0, y / vh));
  const left = pageH - vh - y;
  const end = Math.min(1, Math.max(0, 1 - left / (vh * 0.35)));
  // each block comes into focus as it rises from the bottom of the screen (wide screens only; phones play them once on arrival)
  // near the end of the page everything snaps into focus, so the last blocks are never stuck blurry
  const tops = appScroll() ? [] : reveals.map((el) => el.getBoundingClientRect().top);
  motion.update(vh);

  // the galaxy softens and sinks back as the resume rises over it; set on the galaxy alone, so the rest of the page is left in peace
  const away = scrolled.toFixed(3);
  if (away !== awayShown) gameView.style.setProperty('--away', (awayShown = away));
  // with nothing to soften, drop the filter altogether so the galaxy is not sent through one every frame
  document.documentElement.classList.toggle('at-top', scrolled < 0.002);
  if (scrolled >= 0.98) game.stop();
  else if (!modalOpen()) game.start();
  tops.forEach((top, i) => {
    const el = reveals[i];
    const f = reduced.matches ? 1 : Math.max(end, Math.min(1, Math.max(0, (vh * 0.98 - top) / (vh * 0.42))));
    el.style.setProperty('--f', f.toFixed(3));
    el.classList.toggle('sharp', f >= 0.999);
  });
  const page = Math.min(1, Math.max(0, (y - vh) / Math.max(1, pageH - vh * 2))).toFixed(4);
  if (page !== pageShown) nav.style.setProperty('--page', (pageShown = page));
  if (scrolled > 0.2) goingDown = false;
  syncLock(y);
  nav.classList.toggle('on', scrolled > 0.85);
  let cur = '';
  for (const [id, top] of sectionTops) if (top - y < vh * 0.4) cur = id;
  if (cur !== curShown) {
    curShown = cur;
    tabs.forEach((t) => t.toggleAttribute('aria-current', t.hash === '#' + cur));
  }
}
const queue = () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(onScroll);
  }
};
addEventListener('scroll', queue, { passive: true });
addEventListener('resize', () => {
  stale = true;
  queue();
});
$$('[data-print]').forEach((b) => b.addEventListener('click', () => print()));
if (location.hash === '#resume') requestAnimationFrame(() => toResume());

renderProgress();
onScroll();
document.fonts?.ready.then(() => game.setVisited(visited));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.stop();
  else if (!modalOpen() && scrolled < 0.98) game.start();
});
// let the galaxy drift behind the title card
if (scrolled < 0.98) game.start();
if (coarse.matches) $('[data-hint]').textContent = 'Stick to fly · tap a planet to land';
// print every role expanded, then put things back
let closedForPrint: HTMLDetailsElement[] = [];
addEventListener('beforeprint', () => {
  closedForPrint = $$<HTMLDetailsElement>('details:not([open])');
  closedForPrint.forEach((d) => (d.open = true));
});
addEventListener('afterprint', () => closedForPrint.forEach((d) => (d.open = false)));
