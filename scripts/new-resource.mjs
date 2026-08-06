#!/usr/bin/env node
/**
 * new-resource.mjs — scaffold a record file
 *
 *   npm run new -- who-global-strategy
 *
 * Creates data/resources/<id>.json pre-filled with the required fields, the
 * $schema hint, and every optional facet at its unknown/not-assessed default,
 * then appends the id to data/order.json.
 *
 * Open the new file in an editor that understands JSON Schema and every
 * vocabulary field will autocomplete.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resourcesDir = path.join(repoRoot, 'data', 'resources');
const orderFile = path.join(repoRoot, 'data', 'order.json');

const id = process.argv[2];
if (!id) {
  console.error('Usage: npm run new -- <resource-id>');
  console.error('Example: npm run new -- who-global-strategy');
  process.exit(1);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
  console.error(`"${id}" is not a valid id.`);
  console.error('Use lower-case kebab-case: letters, digits and single hyphens.');
  process.exit(1);
}
const target = path.join(resourcesDir, `${id}.json`);
if (fs.existsSync(target)) {
  console.error(`data/resources/${id}.json already exists. Edit it, or pick another id.`);
  process.exit(1);
}

const ctx = { window: {}, module: { exports: {} }, globalThis: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(repoRoot, 'public', 'taxonomy.js'), 'utf8'), ctx);
const T = ctx.window.APHL_TAXONOMY;

const record = {
  $schema: '../resource.schema.json',
  id,
  title: '',
  organization: '',
  description: '',
  url: '',
  audiences: [],
  stages: [],
  types: [],
  geography: [],
  topics: [],
  pathogenFocus: [],
  language: ['en'],
  keyFeatures: [],
  practicalUse: '',
  relatedResources: [],
  lastUpdated: '',
  formatDetails: '',
  legacyTags: [],
  ...T.defaults(),
  validated: false
};

fs.writeFileSync(target, JSON.stringify(record, null, 2) + '\n');

const order = JSON.parse(fs.readFileSync(orderFile, 'utf8'));
if (!order.includes(id)) {
  order.push(id);
  fs.writeFileSync(orderFile, JSON.stringify(order, null, 2) + '\n');
}

console.log(`  created data/resources/${id}.json`);
console.log(`  appended "${id}" to data/order.json (move it to change where the card appears)`);
console.log('');
console.log('  Next:');
console.log(`    1. fill it in — your editor will autocomplete every vocabulary field`);
console.log('    2. npm run validate');
console.log('    3. commit both the record and the rebuilt public/resources-data.js');
