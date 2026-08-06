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
const TIMEOUT_MS = 20000;

async function probe(url) {
  const attempt = async (method) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: ac.signal, headers: { 'user-agent': UA } });
      return { status: res.status, finalUrl: res.url };
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let r = await attempt('HEAD');
    // Plenty of servers reject HEAD but serve GET perfectly well.
    if (r.status === 405 || r.status === 403 || r.status === 501) r = await attempt('GET');
    return r;
  } catch (err) {
    return { status: 0, error: err.name === 'AbortError' ? 'timeout' : err.message };
  }
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
    if (a.origin + a.pathname !== b.origin + b.pathname) moved.push({ r, to: res.finalUrl });
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
  L.push('## Redirected — worth updating so the stored URL is the real one');
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
