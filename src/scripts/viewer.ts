import type { Image } from '../../ingest/types';

type State = {
  images: Image[];
  order: number[];     // shuffled index into images
  cursor: number;      // position in order
  history: number[];   // order[] indices the user has visited (for back)
  activeSlot: 'a' | 'b';
};

const READY_DELAY = 2000;

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
  };

  render(root, state);
  attachInputs(root, state);

  // Notify the rest of the app — info-sheet listens for this.
  window.dispatchEvent(
    new CustomEvent<{ image: Image }>('viewer:image', {
      detail: { image: currentImage(state) },
    }),
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

    window.dispatchEvent(
      new CustomEvent<{ image: Image }>('viewer:image', {
        detail: { image: img },
      }),
    );

    preloadNext(state);
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

function attachInputs(root: HTMLElement, state: State) {
  const cue = root.querySelector<HTMLButtonElement>('#read-cue')!;

  cue.addEventListener('click', (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('info:open'));
  });

  // Click on canvas (not the cue) advances — unless sheet is open.
  root.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#read-cue')) return;
    if (document.body.classList.contains('sheet-open')) {
      window.dispatchEvent(new CustomEvent('info:close'));
      return;
    }
    advance(root, state);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLAnchorElement) return;
    switch (e.key) {
      case 'ArrowDown':
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        advance(root, state);
        break;
      case 'ArrowUp':
        e.preventDefault();
        back(root, state);
        break;
      case 'i':
      case 'I':
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('info:open'));
        break;
      case 'Escape':
        window.dispatchEvent(new CustomEvent('info:close'));
        break;
    }
  });

  // Touch: downward swipe advances.
  let startY = 0;
  root.addEventListener('touchstart', (e) => {
    startY = e.touches[0]!.clientY;
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0]!.clientY - startY;
    if (dy < -40) advance(root, state);   // swipe up = next
    if (dy > 40 && state.history.length > 0) back(root, state);
  });
}
