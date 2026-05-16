import type { Image } from '../../ingest/types';

// A tiny global so any later-mounting subscriber (e.g. the info sidebar)
// can read the currently displayed image even if it missed the initial
// `viewer:image` event.
declare global {
  interface Window {
    __cosmosCurrentImage?: Image;
  }
}

type State = {
  images: Image[];
  order: number[];     // shuffled index into images
  cursor: number;      // position in order
  history: number[];   // order[] indices the user has visited (for back)
  activeSlot: 'a' | 'b';

  // Slideshow
  isPlaying: boolean;
  slideshowTimer: number | null;
  intervalMs: number;  // current dwell time per slide

  // Controls visibility
  controlsVisible: boolean;
  hideControlsTimer: number | null;
};

/** Cycle order for the speed button, in milliseconds. */
const SLIDESHOW_INTERVALS_MS = [12_000, 24_000, 48_000, 96_000];

const READY_DELAY = 2000;
const HIDE_CONTROLS_AFTER_MS = 3_000;

export function mountViewer() {
  const root = document.getElementById('viewer');
  const dataNode = document.getElementById('images-data');
  if (!root || !dataNode) return;

  let images: Image[];
  try {
    images = JSON.parse(dataNode.textContent || '[]') as Image[];
  } catch {
    images = [];
  }

  if (images.length === 0) {
    showLoadingFailure(root);
    setTimeout(() => location.reload(), READY_DELAY);
    return;
  }

  const state: State = {
    images,
    order: shuffle(images.length),
    cursor: 0,
    history: [],
    activeSlot: 'a',

    isPlaying: false,
    slideshowTimer: null,
    intervalMs: SLIDESHOW_INTERVALS_MS[0]!,

    controlsVisible: false,
    hideControlsTimer: null,
  };

  render(root, state);
  attachInputs(root, state);

  publishCurrentImage(currentImage(state));

  // Start the slideshow by default — the immersive experience is meant
  // to play on arrival. User can pause via the play button, the `p` key,
  // or Space.
  play(root, state);
}

function publishCurrentImage(img: Image) {
  // Stash the current image on window so any later-mounting subscriber
  // can read it on mount (and not depend on event timing).
  window.__cosmosCurrentImage = img;
  window.dispatchEvent(
    new CustomEvent<{ image: Image }>('viewer:image', { detail: { image: img } }),
  );
}

function shuffle(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function currentImage(state: State): Image {
  return state.images[state.order[state.cursor]!]!;
}

function nextImage(state: State): Image | null {
  if (state.order.length === 0) return null;
  if (state.cursor >= state.order.length - 1) {
    // Re-shuffle and wrap
    state.order = shuffle(state.images.length);
    state.cursor = 0;
  } else {
    state.cursor++;
  }
  return currentImage(state);
}

function prevImage(state: State): Image | null {
  if (state.history.length === 0) return null;
  state.cursor = state.history.pop()!;
  return currentImage(state);
}

function render(root: HTMLElement, state: State) {
  const img = currentImage(state);
  const slotEl = root.querySelector<HTMLImageElement>(
    `.slide-${state.activeSlot}`,
  )!;
  slotEl.src = img.imageUrl;
  slotEl.alt = img.title;
  slotEl.classList.add('is-active');

  const credit = root.querySelector<HTMLSpanElement>('#credit-text')!;
  credit.textContent = `${img.title.toUpperCase()} · ${img.credit.toUpperCase()}`;

  preloadNext(state);
}

function advance(root: HTMLElement, state: State) {
  state.history.push(state.cursor);
  const next = nextImage(state);
  if (!next) return;
  swap(root, state, next);
}

function back(root: HTMLElement, state: State) {
  const prev = prevImage(state);
  if (!prev) return;
  swap(root, state, prev);
}

function swap(root: HTMLElement, state: State, img: Image) {
  const old = state.activeSlot;
  const nextSlot = old === 'a' ? 'b' : 'a';
  const oldEl = root.querySelector<HTMLImageElement>(`.slide-${old}`)!;
  const newEl = root.querySelector<HTMLImageElement>(`.slide-${nextSlot}`)!;

  // Handle image error: skip + remove + advance once more
  newEl.onerror = () => {
    console.warn('Image failed:', img.imageUrl);
    // Remove from underlying images by id so reshuffles don't re-pick it
    const idx = state.images.findIndex((i) => i.id === img.id);
    if (idx >= 0) state.images.splice(idx, 1);
    // Rebuild order, keep cursor where it is (best-effort)
    state.order = shuffle(state.images.length);
    state.cursor = 0;
    if (state.images.length > 0) {
      swap(root, state, currentImage(state));
    } else {
      showLoadingFailure(root);
    }
  };

  newEl.onload = () => {
    newEl.classList.add('is-active');
    oldEl.classList.remove('is-active');
    state.activeSlot = nextSlot;

    const credit = root.querySelector<HTMLSpanElement>('#credit-text')!;
    credit.textContent = `${img.title.toUpperCase()} · ${img.credit.toUpperCase()}`;

    publishCurrentImage(img);
    preloadNext(state);

    // Reschedule the slideshow timer whenever the displayed image changes —
    // covers both auto-advance ticks and manual prev/next.
    if (state.isPlaying) scheduleNextTick(root, state);
  };

  newEl.src = img.imageUrl;
  newEl.alt = img.title;
}

function preloadNext(state: State) {
  if (state.cursor >= state.order.length - 1) return;
  const nextImg = state.images[state.order[state.cursor + 1]!]!;
  if (!nextImg) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'image';
  link.href = nextImg.imageUrl;
  document.head.appendChild(link);
}

function showLoadingFailure(root: HTMLElement) {
  const note = document.createElement('div');
  note.textContent = 'Loading the cosmos…';
  note.style.cssText =
    'position:fixed;left:24px;bottom:18px;color:#777;font:10px Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase';
  root.appendChild(note);
}

/* ---------- Slideshow ---------- */

function clearSlideshowTimer(state: State) {
  if (state.slideshowTimer !== null) {
    window.clearTimeout(state.slideshowTimer);
    state.slideshowTimer = null;
  }
}

function scheduleNextTick(root: HTMLElement, state: State) {
  clearSlideshowTimer(state);
  state.slideshowTimer = window.setTimeout(() => {
    state.slideshowTimer = null;
    if (state.isPlaying) advance(root, state);
  }, state.intervalMs);
}

function cycleSpeed(root: HTMLElement, state: State) {
  const i = SLIDESHOW_INTERVALS_MS.indexOf(state.intervalMs);
  const next = SLIDESHOW_INTERVALS_MS[(i + 1) % SLIDESHOW_INTERVALS_MS.length]!;
  state.intervalMs = next;
  updateSpeedButton(state);
  // If currently playing, restart the timer so the new interval applies
  // immediately instead of waiting for the next image change.
  if (state.isPlaying) scheduleNextTick(root, state);
}

function updateSpeedButton(state: State) {
  const btn = document.getElementById('ctrl-speed');
  const label = document.getElementById('ctrl-speed-label');
  if (!btn || !label) return;
  const seconds = Math.round(state.intervalMs / 1000);
  label.textContent = `${seconds}s`;
  btn.setAttribute(
    'aria-label',
    `Slide interval: ${seconds} seconds. Click to change.`,
  );
}

function play(root: HTMLElement, state: State) {
  if (state.isPlaying) return;
  state.isPlaying = true;
  updatePlayButton(state);
  scheduleNextTick(root, state);
}

function pause(state: State) {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  clearSlideshowTimer(state);
  updatePlayButton(state);
}

function togglePlay(root: HTMLElement, state: State) {
  if (state.isPlaying) pause(state);
  else play(root, state);
}

function updatePlayButton(state: State) {
  const btn = document.getElementById('ctrl-play') as HTMLButtonElement | null;
  if (!btn) return;
  // The SVG glyph swap is CSS-driven: .ctrl-play.is-playing toggles between
  // the .icon-play and .icon-pause children. JS only owns aria-label + class.
  if (state.isPlaying) {
    btn.setAttribute('aria-label', 'Pause slideshow');
    btn.classList.add('is-playing');
  } else {
    btn.setAttribute('aria-label', 'Play slideshow');
    btn.classList.remove('is-playing');
  }
}

/* ---------- Fullscreen ---------- */

function toggleFullscreen() {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void>;
    webkitFullscreenElement?: Element | null;
  };
  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };

  const isOn = !!(document.fullscreenElement ?? doc.webkitFullscreenElement);
  const enter = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
  const exit = document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(document);

  try {
    if (isOn) exit?.();
    else enter?.();
  } catch (err) {
    console.warn('Fullscreen toggle failed:', err);
  }
}

function syncFullscreenButton() {
  const btn = document.getElementById('ctrl-fullscreen');
  if (!btn) return;
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  const isOn = !!(document.fullscreenElement ?? doc.webkitFullscreenElement);
  if (isOn) {
    btn.classList.add('is-fullscreen');
    btn.setAttribute('aria-label', 'Exit fullscreen');
  } else {
    btn.classList.remove('is-fullscreen');
    btn.setAttribute('aria-label', 'Enter fullscreen');
  }
}

/* ---------- Controls visibility ---------- */

function showControls(state: State) {
  const controls = document.getElementById('controls');
  if (!controls) return;
  if (!state.controlsVisible) {
    controls.classList.add('is-visible');
    controls.setAttribute('aria-hidden', 'false');
    state.controlsVisible = true;
  }
  resetHideTimer(state);
}

function hideControls(state: State) {
  const controls = document.getElementById('controls');
  if (!controls) return;
  controls.classList.remove('is-visible');
  controls.setAttribute('aria-hidden', 'true');
  state.controlsVisible = false;
  if (state.hideControlsTimer !== null) {
    window.clearTimeout(state.hideControlsTimer);
    state.hideControlsTimer = null;
  }
}

function resetHideTimer(state: State) {
  if (state.hideControlsTimer !== null) {
    window.clearTimeout(state.hideControlsTimer);
  }
  state.hideControlsTimer = window.setTimeout(() => {
    hideControls(state);
  }, HIDE_CONTROLS_AFTER_MS);
}

/* ---------- Input wiring ---------- */

function attachInputs(root: HTMLElement, state: State) {
  // Controls live outside the viewer so we look them up globally.
  const controls = document.getElementById('controls')!;
  const prevBtn = document.getElementById('ctrl-prev') as HTMLButtonElement;
  const nextBtn = document.getElementById('ctrl-next') as HTMLButtonElement;
  const infoBtn = document.getElementById('ctrl-info') as HTMLButtonElement;
  const playBtn = document.getElementById('ctrl-play') as HTMLButtonElement;
  const speedBtn = document.getElementById('ctrl-speed') as HTMLButtonElement;
  const fullscreenBtn = document.getElementById('ctrl-fullscreen') as HTMLButtonElement;

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    back(root, state);
    showControls(state);
  });
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    advance(root, state);
    showControls(state);
  });
  infoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('info:toggle'));
    showControls(state);
    // Drop focus so the button doesn't keep a focus ring after click.
    (e.currentTarget as HTMLElement).blur();
  });
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay(root, state);
    showControls(state);
  });
  speedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cycleSpeed(root, state);
    showControls(state);
  });
  fullscreenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFullscreen();
    showControls(state);
    (e.currentTarget as HTMLElement).blur();
  });

  // Keep the fullscreen button's icon + aria-label in sync with the
  // actual state (also covers user pressing Esc to exit fullscreen).
  document.addEventListener('fullscreenchange', syncFullscreenButton);
  syncFullscreenButton();

  // Click on canvas (not a control):
  // - If the sidebar is open, treat the click as "click outside" and
  //   close the sidebar (don't also advance — that would be jarring).
  // - On touch-only devices, do nothing: a tap is too easy to fire by
  //   accident; user navigates with swipes or the nav buttons.
  // - Otherwise (mouse / pointer device), advance to the next image.
  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('#controls')) return;
    if (document.body.classList.contains('sidebar-open')) {
      window.dispatchEvent(new CustomEvent('info:close'));
      return;
    }
    if (window.matchMedia('(hover: none)').matches) return;
    advance(root, state);
  });

  // Reveal controls on mouse-move over the image area or over the
  // controls themselves (so hovering them keeps the auto-hide timer
  // alive). We don't listen on the sidebar — moving the cursor there
  // while reading shouldn't keep popping the controls back up.
  root.addEventListener('mousemove', () => showControls(state));
  controls.addEventListener('mousemove', () => showControls(state));

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLAnchorElement) return;
    showControls(state);
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        advance(root, state);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        back(root, state);
        break;
      case ' ':
      case 'Spacebar':
      case 'p':
      case 'P':
        e.preventDefault();
        togglePlay(root, state);
        break;
      case 'i':
      case 'I':
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('info:toggle'));
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'Escape':
        window.dispatchEvent(new CustomEvent('info:close'));
        break;
    }
  });

  // Touch: tap reveals controls; swipe advances/goes back.
  let startY = 0;
  let startX = 0;
  root.addEventListener(
    'touchstart',
    (e) => {
      startY = e.touches[0]!.clientY;
      startX = e.touches[0]!.clientX;
      showControls(state);
    },
    { passive: true },
  );
  root.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0]!.clientY - startY;
    const dx = e.changedTouches[0]!.clientX - startX;
    // Horizontal swipe navigates (matches the left/right arrow keys).
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) advance(root, state);          // swipe left = next
      else if (state.history.length > 0) back(root, state);  // swipe right = prev
    }
  });

}
