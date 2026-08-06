#!/usr/bin/env node
/**
 * check-links.mjs — fetch every resource URL and report what is broken.
 *
 * Writes link-report.md. Exits non-zero if anything needs attention, so the
 * workflow step can flag it, but the report is what actually gets read.
 *
 * Deliberately forgiving: many publishers block HEAD, rate-limit, or sit
 * behind bot protection. A 403 from a server that is plainly alive is not a
 * dead link, and crying wolf is how a check like this gets ignored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(repoRoot, 'data', 'resources');

const UA = 'Mozilla/5.0 (compatible; aphl-gse-resources link check; +https://github.com/PHemarajata/aphl-gse-resources)';
const TIMEOUT_MS = 30000;
const SLOW_RETRY_MS = 60000;

async function probe(url) {
  const attempt = async (method, timeoutMs) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: ac.signal, headers: { 'user-agent': UA } });
      return { status: res.status, finalUrl: res.url };
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let r = await attempt('HEAD', TIMEOUT_MS);
    // Many servers reject or mishandle HEAD but serve GET perfectly well —
    // including CDNs that answer 404 to a HEAD for a file that plainly exists.
    // The first real run called four live pages dead this way.
    if ([403, 404, 405, 429, 501].includes(r.status)) r = await attempt('GET', TIMEOUT_MS);
    return r;
  } catch (err) {
    if (err.name !== 'AbortError') return { status: 0, error: err.message };
    // A timeout usually means a slow origin, not a dead one. Two africacdc.org
    // pages were reported broken on the first run and both load fine. Give a
    // timeout one more attempt on a longer budget before calling it dead.
    try {
      return await attempt('GET', SLOW_RETRY_MS);
    } catch (err2) {
      return { status: 0, error: err2.name === 'AbortError' ? 'timeout (twice)' : err2.message };
    }
  }
}

// Not every redirect is worth acting on, and following some would make the
// stored link worse. Suppress the traps:
//   - a one-time auth/session transit URL (Nature sends you through
//     idp.nature.com/transit?...code=..., which works once, for you)
//   - an https -> http downgrade, which the record schema now rejects anyway
//   - a DOI resolving to whichever publisher host currently serves it. The DOI
//     is the durable identifier; "following" it is exactly the wrong move.
function redirectWorthReporting(from, to) {
  if (from.protocol === 'https:' && to.protocol === 'http:') return false;
  if (from.hostname === 'doi.org' || from.hostname === 'dx.doi.org') return false;
  if (/(^|\.)idp\./.test(to.hostname)) return false;
  if (/[?&](code|token|session|redirect_uri)=/.test(to.search)) return false;
  return true;
}

const records = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

const noUrl = [], dead = [], moved = [], blocked = [];
let ok = 0;

for (const r of records) {
  if (!r.url || r.url === '#') { noUrl.push(r); continue; }
  const res = await probe(r.url);
  if (res.status === 0) dead.push({ r, why: res.error });
  else if (res.status >= 400 && res.status !== 403 && res.status !== 429) dead.push({ r, why: `HTTP ${res.status}` });
  else if (res.status === 403 || res.status === 429) blocked.push({ r, why: `HTTP ${res.status}` });
  else {
    ok++;
    const a = new URL(r.url), b = new URL(res.finalUrl);
    if (a.origin + a.pathname !== b.origin + b.pathname && redirectWorthReporting(a, b)) {
      moved.push({ r, to: res.finalUrl });
    }
  }
}

const L = [];
L.push('Automated weekly check of every resource URL in `data/resources/`.');
L.push('');
L.push(`**${ok} of ${records.length} resolved.** ${dead.length} broken, ${moved.length} redirected, ${blocked.length} inconclusive, ${noUrl.length} have no URL.`);
L.push('');
if (dead.length) {
  L.push('## Broken — need attention');
  L.push('');
  L.push('| resource | url | problem |');
  L.push('|---|---|---|');
  for (const d of dead) L.push(`| \`${d.r.id}\` | ${d.r.url} | ${d.why} |`);
  L.push('');
}
if (moved.length) {
  L.push('## Redirected — worth a look, not an instruction');
  L.push('');
  L.push('The stored URL still works. Update it only if the destination is genuinely');
  L.push('more canonical — a publisher restructuring its paths, say. Prefer a DOI over');
  L.push('whichever host currently serves the article.');
  L.push('');
  L.push('| resource | stored | resolves to |');
  L.push('|---|---|---|');
  for (const m of moved) L.push(`| \`${m.r.id}\` | ${m.r.url} | ${m.to} |`);
  L.push('');
}
if (blocked.length) {
  L.push('## Inconclusive — server refused an automated request');
  L.push('');
  L.push('Usually bot protection rather than a dead link. Worth a manual click, not a panic.');
  L.push('');
  for (const b of blocked) L.push(`- \`${b.r.id}\` — ${b.r.url} (${b.why})`);
  L.push('');
}
if (noUrl.length) {
  L.push('## No URL at all');
  L.push('');
  for (const n of noUrl) L.push(`- \`${n.id}\` — ${n.title}`);
  L.push('');
}
if (!dead.length && !moved.length && !noUrl.length) L.push('All links resolved. Nothing to do.');

fs.writeFileSync(path.join(repoRoot, 'link-report.md'), L.join('\n') + '\n');
console.log(L.slice(0, 4).join('\n'));

// Deliberately exit 0 even when links are broken. Finding a dead link is this
// script working, not failing, and the report is how that gets communicated.
//
// A non-zero exit is therefore reserved for the script itself breaking — which
// is what happened on the first run: a crash here exited 1, the workflow had
// continue-on-error set, and the job went green having done nothing at all. A
// check that fails silently is worse than no check.
process.exit(0);
