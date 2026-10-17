// The bottom sheet "Tidigare repliker" (milestone 16): a card per conversation Tomten has
// had, newest first. Built from the saved history and tomte.json (history.js); every text
// is set with textContent. Closes with the button, a swipe down on the header, Esc or a
// tap on the backdrop. The sheet scrolls on its own, the page behind it does not.

import { historyCards } from './history.js';
import { formatShortDate } from './dates.js';

export const EMPTY_TEXT = 'Vi har inte pratat än. Jag hör av mig snart.';
const SWIPE_CLOSE_PX = 80;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderCard(card, tomteName) {
  const article = el('article', 'sheet-card');
  const heading = el('h3', 'sheet-date', formatShortDate(card.date));
  if (card.welcome) heading.append(el('span', 'sheet-tag', 'Välkomst'));
  article.append(heading);
  for (const part of card.parts) {
    if (part.kind === 'line') {
      article.append(el('p', 'sheet-line', part.text));
      continue;
    }
    article.append(el('p', 'sheet-line', part.text));
    if (part.answer !== null) {
      const answer = el('p', 'sheet-answer');
      answer.append('Du svarade: ', el('strong', null, part.answer));
      article.append(answer, el('p', 'sheet-line', part.reply));
    }
  }
  article.setAttribute('aria-label', `${tomteName}, ${formatShortDate(card.date)}`);
  return article;
}

/**
 * Creates the sheet. getHistory() returns the saved entries, tomte is the content of
 * tomte.json. Returns { open(), close(), isOpen() }; each open() reads the history afresh.
 */
export function createHistorySheet({ tomte, getHistory }) {
  let dialog = null;
  let body = null;
  let opener = null;

  function build() {
    dialog = el('dialog', 'sheet');
    dialog.setAttribute('aria-labelledby', 'sheet-title');

    const head = el('div', 'sheet-head');
    head.append(el('span', 'sheet-grip'));
    const title = el('h2', 'sheet-title', 'Tidigare repliker');
    title.id = 'sheet-title';
    const close = el('button', 'sheet-close', 'Stäng');
    close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    head.append(title, close);

    body = el('div', 'sheet-body');
    body.tabIndex = -1;
    dialog.append(head, body);

    // Swipe down on the header to close: the sheet follows the finger, past the limit it closes.
    let startY = null;
    head.addEventListener('pointerdown', (e) => {
      if (e.target === close) return;
      startY = e.clientY;
      head.setPointerCapture?.(e.pointerId);
      dialog.style.transition = 'none';
    });
    head.addEventListener('pointermove', (e) => {
      if (startY === null) return;
      dialog.style.transform = `translateY(${Math.max(0, e.clientY - startY)}px)`;
    });
    const release = (e) => {
      if (startY === null) return;
      const dy = e.clientY - startY;
      startY = null;
      dialog.style.transition = '';
      dialog.style.transform = '';
      if (dy > SWIPE_CLOSE_PX) dialog.close();
    };
    head.addEventListener('pointerup', release);
    head.addEventListener('pointercancel', () => {
      startY = null;
      dialog.style.transition = '';
      dialog.style.transform = '';
    });

    // A tap on the backdrop (the dialog element itself) closes it too.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      const back = opener;
      opener = null;
      if (back?.isConnected) back.focus();
    });
    document.body.append(dialog);
  }

  function render() {
    const cards = historyCards(getHistory(), tomte);
    if (cards.length === 0) body.replaceChildren(el('p', 'sheet-empty', EMPTY_TEXT));
    else body.replaceChildren(...cards.map((card) => renderCard(card, tomte.name)));
    body.scrollTop = 0;
  }

  return {
    open() {
      if (!dialog) build();
      if (dialog.open) return;
      opener = document.activeElement;
      render();
      dialog.showModal();
      dialog.querySelector('.sheet-close').focus();
    },
    close: () => dialog?.close(),
    isOpen: () => Boolean(dialog?.open),
  };
}
