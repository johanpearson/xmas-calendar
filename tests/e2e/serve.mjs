// Minimal static server for the e2e tests. Serves the repo under /<BASE>/ only,
// like GitHub Pages does, so any root-absolute path (e.g. "/sw.js") gets a 404.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PORT = Number(process.env.PORT ?? 4173);
const BASE = '/xmas-calendar/';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
};

// HIDE=audio/sfx/hohoho.mp3,... answers 404 for those files (tests of a missing file).
const HIDDEN = (process.env.HIDE ?? '').split(',').filter(Boolean).map((f) => BASE + f);

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (!pathname.startsWith(BASE)) {
    res.writeHead(404).end('Not found (outside the site folder)');
    return;
  }
  if (HIDDEN.includes(pathname)) {
    res.writeHead(404).end('Not found (hidden)');
    return;
  }
  let file = normalize(join(ROOT, decodeURIComponent(pathname.slice(BASE.length))));
  if (!file.startsWith(ROOT) || file.includes(`${sep}node_modules${sep}`)) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Serving http://localhost:${PORT}${BASE}`));
