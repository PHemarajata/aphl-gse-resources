#!/usr/bin/env node
/**
 * preview.mjs — serve public/ on localhost so the site and the curation form
 * can be opened in a browser.
 *
 * Needed because public/resources-data.js is a build artifact that is no longer
 * committed: you build it, then look at it. Also because browsers refuse to let
 * a page opened from file:// load its sibling scripts, which is exactly what
 * curate.html does.
 *
 * Zero-dependency on purpose: node scripts/preview.mjs, no install step.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(repoRoot, 'public');
const port = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

if (!fs.existsSync(path.join(publicDir, 'resources-data.js'))) {
  console.error('public/resources-data.js is missing. Build it first:');
  console.error('  npm run build');
  process.exit(1);
}

http.createServer((req, res) => {
  const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const file = path.join(publicDir, relative);

  // Never serve outside public/, whatever the request says.
  if (!file.startsWith(publicDir + path.sep) && file !== publicDir) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (error, body) => {
    if (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`Not found: ${relative}`);
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(body);
  });
}).listen(port, () => {
  console.log(`  site   http://localhost:${port}/`);
  console.log(`  curate http://localhost:${port}/curate.html`);
  console.log('  stop with Ctrl-C');
});
