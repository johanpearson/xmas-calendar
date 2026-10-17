// Pure logic for Tomten's random lines (milestone 16): validating content/tomte-random.json
// and the lottery that picks them. No DOM, no storage; testable with `node --test`.
//
// The lottery works like a shuffle bag: a line is not repeated until every line has been
// used. The bag stores the lines already drawn this round (not positions), so adding or
// editing lines in the file never breaks a saved bag.

export const MAX_LINE_LENGTH = 160;

const isText = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Validates content/tomte-random.json: `{ lines: [text, ...] }`. Throws when it is not
 * usable; returns the lines trimmed, without duplicates.
 */
export function normalizeRandom(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.lines)) {
    throw new Error('tomte-random.json: "lines" must be a list');
  }
  const lines = [...new Set(json.lines.filter(isText).map((line) => line.trim()))];
  if (lines.length === 0) throw new Error('tomte-random.json: no lines');
  return lines;
}

/**
 * Problems in the file's lines, as texts (empty list = fine): unique, non-empty, at most
 * MAX_LINE_LENGTH characters and no dashes (en or em dash). Used by the content test.
 */
export function randomProblems(lines) {
  const problems = [];
  const seen = new Set();
  lines.forEach((line, i) => {
    if (!isText(line)) return problems.push(`line ${i}: empty or not a text`);
    if (seen.has(line)) problems.push(`line ${i}: duplicate`);
    seen.add(line);
    if (line.length > MAX_LINE_LENGTH) problems.push(`line ${i}: ${line.length} characters (max ${MAX_LINE_LENGTH})`);
    if (/[–—]/.test(line)) problems.push(`line ${i}: contains a dash`);
  });
  return problems;
}

export const emptyBag = () => ({ used: [], last: null });

// Whatever came out of storage becomes a usable bag.
export function normalizeBag(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.used)) return emptyBag();
  return { used: value.used.filter((line) => typeof line === 'string'), last: typeof value.last === 'string' ? value.last : null };
}

/**
 * Draws the next line. Returns { line, bag } where `bag` is the state to save, or
 * { line: null, bag } when there are no lines. When every line has been used a new round
 * starts, and its first line is never the one that ended the last round (if there is a choice).
 * `rng` returns a number in [0, 1), like Math.random.
 */
export function drawLine(lines, bag = emptyBag(), rng = Math.random) {
  if (lines.length === 0) return { line: null, bag: emptyBag() };
  const used = bag.used.filter((line) => lines.includes(line));
  let pool = lines.filter((line) => !used.includes(line));
  let usedNow = used;
  if (pool.length === 0) {
    pool = lines.length > 1 ? lines.filter((line) => line !== bag.last) : [...lines];
    usedNow = [];
  }
  const line = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return { line, bag: { used: [...usedNow, line], last: line } };
}
