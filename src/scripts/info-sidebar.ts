import type { Image } from '../../ingest/types';

declare global {
  interface Window {
    __cosmosCurrentImage?: Image;
  }
}

export function mountInfoSidebar() {
  const sidebar = document.getElementById('info-sidebar');
  if (!sidebar) return;

  const title = sidebar.querySelector<HTMLElement>('#sidebar-title')!;
  const date = sidebar.querySelector<HTMLElement>('#sidebar-date')!;
  const link = sidebar.querySelector<HTMLAnchorElement>('#sidebar-link')!;
  const body = sidebar.querySelector<HTMLElement>('#sidebar-body')!;
  const credit = sidebar.querySelector<HTMLElement>('#sidebar-credit')!;

  function render(img: Image) {
    title.textContent = img.title;
    date.textContent = formatDate(img.date);
    link.href = img.sourceUrl;
    body.textContent = img.description;
    credit.textContent = img.credit;
  }

  function isOpen(): boolean {
    return document.body.classList.contains('sidebar-open');
  }

  function open() {
    document.body.classList.add('sidebar-open');
    sidebar.setAttribute('aria-hidden', 'false');
  }

  function close() {
    document.body.classList.remove('sidebar-open');
    sidebar.setAttribute('aria-hidden', 'true');
  }

  function toggle() {
    if (isOpen()) close();
    else open();
  }

  // If the viewer has already published the current image before we
  // subscribed, render it immediately. (Astro bundles each component's
  // hoisted <script> into a single module, so the viewer's
  // mountViewer() can complete before our listener attaches.)
  if (window.__cosmosCurrentImage) {
    render(window.__cosmosCurrentImage);
  }

  // Keep content in sync as images change.
  window.addEventListener('viewer:image', (e) => {
    const img = (e as CustomEvent<{ image: Image }>).detail.image;
    render(img);
  });

  window.addEventListener('info:open', open);
  window.addEventListener('info:close', close);
  window.addEventListener('info:toggle', toggle);

  // Clicks inside the sidebar shouldn't bubble out to the viewer (which
  // treats outside-control clicks as "advance to next image").
  sidebar.addEventListener('click', (e) => e.stopPropagation());

  // Explicit close button (visible on mobile + tablet via CSS).
  const closeBtn = sidebar.querySelector<HTMLButtonElement>('#sidebar-close');
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  // Swipe-left to close (touch). The sidebar slid in from the left, so
  // pushing it back left is the natural dismiss gesture. Distinguish
  // from a vertical scroll by requiring horizontal movement to dominate
  // and exceed a 40 px threshold.
  let touchStartX = 0;
  let touchStartY = 0;
  sidebar.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.touches[0]!.clientX;
      touchStartY = e.touches[0]!.clientY;
    },
    { passive: true },
  );
  sidebar.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0]!.clientX - touchStartX;
    const dy = e.changedTouches[0]!.clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && dx < -40) {
      close();
    }
  });
}

function formatDate(iso: string): string {
  // "2026-04-22" → "22 APR 2026"
  const [y, m, d] = iso.split('-');
  const month = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ][Number(m) - 1];
  return `${d} ${month} ${y}`;
}
