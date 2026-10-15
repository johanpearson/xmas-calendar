// Pure logic for the door's card: its paragraphs and whether plan A (the main text) or
// plan B (`alternative`, for bad weather) shows. No DOM: everything here is testable with
// `node --test`. Rendering lives in app.js.

export const SHOW_PLAN_B = 'Dåligt väder? Visa plan B';
export const SHOW_PLAN_A = 'Visa plan A';

const isText = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Plain text to paragraphs, one per line. Blank lines are not paragraphs of their own:
 * they give the next paragraph extra space before it (gapBefore). Leading and trailing
 * blank lines are dropped, so an empty text has no paragraphs at all.
 */
export function paragraphs(text) {
  const result = [];
  let gap = false;
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      gap = result.length > 0;
      continue;
    }
    result.push({ text: line, gapBefore: gap });
    gap = false;
  }
  return result;
}

// A door has a plan B when its `alternative` has something to show.
export function hasAlternative(day) {
  const alt = day?.alternative;
  return Boolean(alt && typeof alt === 'object' && (isText(alt.body) || isText(alt.title) || isText(alt.verse)));
}

/**
 * What the card shows for a plan: { title, verse, body }. Plan B takes the alternative's
 * body, and its title and verse when it has them, otherwise the door's own, so title and
 * verse look the same in both plans unless the alternative says otherwise.
 */
export function planContent(day, plan) {
  const main = { title: day?.title ?? '', verse: day?.verse ?? '', body: day?.body ?? '' };
  if (plan !== 'B' || !hasAlternative(day)) return main;
  const alt = day.alternative;
  return {
    title: isText(alt.title) ? alt.title : main.title,
    verse: isText(alt.verse) ? alt.verse : main.verse,
    body: alt.body ?? '',
  };
}
