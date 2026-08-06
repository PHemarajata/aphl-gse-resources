#!/usr/bin/env node
/**
 * build-data.mjs — compile data/ into public/resources-data.js
 *
 * Source of truth is data/:
 *   data/metadata.json          stable metadata, curator-maintained
 *   data/order.json             display order (the site renders in array order)
 *   data/resources/<id>.json    one file per resource
 *
 * public/resources-data.js is a BUILD ARTIFACT. It is NOT committed: it is
 * built here, by CI on every pull request, and again at deploy time. Nothing
 * in the repository has to be kept in sync with it by hand — which is what
 * lets a curator open a pull request from a browser, with no terminal.
 *
 * Deliberately zero-dependency: runs with plain `node scripts/build-data.mjs`,
 * in CI, with no install step.
 *
 * Deterministic: the same data/ always produces the same bytes. Nothing here
 * reads the clock, so a rebuild never creates a spurious diff.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'data');
const resourcesDir = path.join(dataDir, 'resources');
const outFile = path.join(repoRoot, 'public', 'resources-data.js');

// Canonical key order. Records are emitted with keys in this sequence so diffs
// stay consistent; the hand-maintained file had five different key orders.
const KEY_ORDER = [
  'id', 'title', 'organization', 'description', 'url',
  'audiences', 'stages', 'types', 'geography', 'topics', 'pathogenFocus', 'language',
  'keyFeatures', 'practicalUse', 'relatedResources',
  'lastUpdated', 'formatDetails', 'sourceNotes', 'legacyTags',
  'validated'
];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${path.relative(repoRoot, file)}: ${error.message}`);
  }
}

function orderKeys(record) {
  const out = {};
  for (const key of KEY_ORDER) if (key in record) out[key] = record[key];
  // Anything not in KEY_ORDER still ships, appended in sorted order, so a new
  // field added by a curator is never silently dropped.
  for (const key of Object.keys(record).sort()) if (!(key in out)) out[key] = record[key];
  return out;
}

function main() {
  const problems = [];
  const metadata = readJson(path.join(dataDir, 'metadata.json'));

  const files = fs.readdirSync(resourcesDir).filter((f) => f.endsWith('.json')).sort();
  const byId = new Map();
  for (const file of files) {
    const record = readJson(path.join(resourcesDir, file));
    const expectedId = file.replace(/\.json$/, '');
    if (record.id !== expectedId) {
      problems.push(`${file}: "id" is "${record.id}" but the filename implies "${expectedId}"`);
      continue;
    }
    if (byId.has(record.id)) problems.push(`${file}: duplicate id "${record.id}"`);
    byId.set(record.id, record);
  }

  // Display order. Ids listed in order.json come first, in that order; any
  // record not listed is appended alphabetically so adding a file never
  // requires touching order.json.
  const order = readJson(path.join(dataDir, 'order.json'));
  const seen = new Set();
  const stale = [];
  const ordered = [];
  for (const id of order) {
    // A listed id with no file is a stale entry, not a failure: it is exactly
    // what a pull request that deletes one record looks like. Note it and move
    // on, so removing a resource never requires editing a second file.
    if (!byId.has(id)) { stale.push(id); continue; }
    if (seen.has(id)) { problems.push(`order.json lists "${id}" more than once`); continue; }
    seen.add(id);
    ordered.push(byId.get(id));
  }
  if (stale.length) console.log(`  note: ${stale.length} id(s) in order.json no longer have a file, ignored: ${stale.join(', ')}`);
  const unlisted = [...byId.keys()].filter((id) => !seen.has(id)).sort();
  for (const id of unlisted) ordered.push(byId.get(id));
  if (unlisted.length) console.log(`  note: ${unlisted.length} record(s) not in order.json, appended alphabetically: ${unlisted.join(', ')}`);

  if (problems.length) {
    console.error('Build failed:');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }

  // `validated` is per-record in data/. Rebuild the flat list the admin panel
  // still reads, so it keeps working while the source of truth stays per-record.
  const validatedResources = ordered.filter((r) => r.validated === true).map((r) => r.id);

  const resources = ordered.map((record) => {
    const copy = orderKeys(record);
    delete copy.validated;  // curator state, not shipped on the record itself
    delete copy.$schema;    // editor hint only, never published
    return copy;
  });

  const database = {
    metadata: {
      ...metadata,
      totalResources: resources.length,
      validatedResources,
      // Version history lives in git now. These stay as empty arrays so the
      // admin panel's code paths that expect arrays keep working.
      versionHistory: [],
      auditLog: []
    },
    resources
  };

  const output = `// Auto-generated resources database with metadata
//
// DO NOT EDIT THIS FILE BY HAND.
// Source of truth is data/. Rebuild with: node scripts/build-data.mjs
const resourcesDatabase = ${JSON.stringify(database, null, 2)};

// Backward compatibility - expose resourcesData for existing code
const resourcesData = resourcesDatabase.resources;

// Make both available globally for the admin panel
if (typeof window !== 'undefined') {
  window.resourcesDatabase = resourcesDatabase;
  window.resourcesData = resourcesData;
}`;

  // --check: verify the committed artifact matches what data/ produces, without
  // writing. Used by CI and as a guard against someone hand-editing the
  // generated file. Exits non-zero on drift.
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
    if (current === output) {
      console.log(`  up to date — ${path.relative(repoRoot, outFile)} matches data/`);
      return;
    }
    console.error(`  DRIFT: ${path.relative(repoRoot, outFile)} does not match data/.`);
    console.error('  Someone edited the generated file by hand, or forgot to rebuild.');
    console.error('  Fix with: node scripts/build-data.mjs');
    process.exit(1);
  }

  fs.writeFileSync(outFile, output);
  console.log(`  built ${path.relative(repoRoot, outFile)} — ${resources.length} resources, ${validatedResources.length} validated, ${(output.length / 1024).toFixed(0)} KB`);
}

main();
