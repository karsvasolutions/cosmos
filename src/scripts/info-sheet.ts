import type { Image } from '../../ingest/types';

export function mountInfoSheet() {
  const sheet = document.getElementById('info-sheet') as HTMLDialogElement | null;
  if (!sheet) return;

  const title = sheet.querySelector<HTMLElement>('#sheet-title')!;
  const date = sheet.querySelector<HTMLElement>('#sheet-date')!;
  const link = sheet.querySelector<HTMLAnchorElement>('#sheet-link')!;
  const body = sheet.querySelector<HTMLElement>('#sheet-body')!;
  const credit = sheet.querySelector<HTMLElement>('#sheet-credit')!;
  const closeBtn = sheet.querySelector<HTMLButtonElement>('#sheet-close')!;

  let current: Image | null = null;

  function render(img: Image) {
    current = img;
    title.textContent = img.title;
    date.textContent = formatDate(img.date);
    link.href = img.sourceUrl;
    body.textContent = img.description;
    credit.textContent = img.credit;
  }

  function open() {
    if (!current) return;
    if (typeof sheet.showModal === 'function') {
      try { sheet.showModal(); } catch { sheet.setAttribute('open', ''); }
    } else {
      sheet.setAttribute('open', '');
    }
    document.body.classList.add('sheet-open');
  }

  function close() {
    if (sheet.open && typeof sheet.close === 'function') sheet.close();
    else sheet.removeAttribute('open');
    document.body.classList.remove('sheet-open');
  }

  window.addEventListener('viewer:image', (e) => {
    const img = (e as CustomEvent<{ image: Image }>).detail.image;
    render(img);
    // Spec: advancing closes the sheet.
    if (sheet.open) close();
  });
  window.addEventListener('info:open', open);
  window.addEventListener('info:close', close);

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  // Prevent click-through inside the sheet from advancing the viewer.
  sheet.addEventListener('click', (e) => e.stopPropagation());
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
