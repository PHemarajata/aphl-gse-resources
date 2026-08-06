#!/usr/bin/env node
/**
 * draft-resource.mjs — draft a record from a URL, for review.
 *
 * Run by .github/workflows/ai-draft.yml. Writes data/resources/<id>.json,
 * appends to order.json, and writes pr-body.md for the pull request.
 *
 * Two design points worth keeping:
 *
 *  1. The model is handed the actual vocabulary and told to choose only from
 *     it — but its answer is still filtered against the enums afterwards.
 *     Anything invalid is dropped and reported, never written. A model that
 *     invents a plausible-looking topic id must not be able to poison the data.
 *
 *  2. The record is written with validated:false and the drafted prose goes in
 *     as-is. Nothing here is treated as verified; the pull request says so.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.RESOURCE_URL;
if (!url) { console.error('RESOURCE_URL is not set.'); process.exit(1); }

const ctx = { window: {}, module: { exports: {} }, globalThis: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(repoRoot, 'public', 'taxonomy.js'), 'utf8'), ctx);
const T = ctx.window.APHL_TAXONOMY;

const ARRAY_FACETS = ['audiences', 'stages', 'types', 'geography', 'topics', 'pathogenFocus'];
const vocab = {};
for (const f of ARRAY_FACETS) {
  vocab[f] = T.flattenOptions(f).map((o) => `${o.id} (${o.label})`);
}

console.log(`Fetching ${url}`);
let pageText = '';
try {
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; aphl-gse-resources draft bot)' } });
  const html = await res.text();
  pageText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);
  console.log(`  fetched ${pageText.length} characters of text`);
} catch (err) {
  console.error(`  could not fetch the page: ${err.message}`);
  console.error('  drafting from the URL alone; expect a thin record.');
}

const prompt = `You are drafting one entry for a curated library of genomic epidemiology resources used by public health laboratories, largely in lower-resource settings.

Draft a record for this URL: ${url}

Page text:
"""
${pageText || '(the page could not be fetched)'}
"""

Choose tags ONLY from these controlled vocabularies. Use the id, not the label.

${ARRAY_FACETS.map((f) => `${f}:\n${vocab[f].map((v) => '  ' + v).join('\n')}`).join('\n\n')}

Rules:
- topics: at most 5, and only what the resource is substantially ABOUT. Do not tag a tool with the subject area it happens to serve.
- audiences: at most 5. stages: at most 4. types: at most 3. geography: at most 5.
- description: two sentences at most, factual, no marketing language.
- If the page could not be fetched, leave prose fields empty rather than inventing them.

Reply with JSON only, no prose, no code fence:
{"id":"kebab-case-id","title":"","organization":"","description":"","audiences":[],"stages":[],"types":[],"geography":[],"topics":[],"pathogenFocus":[],"keyFeatures":[],"practicalUse":""}`;

console.log('Asking the model for a draft...');
const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.2
  })
});
if (!res.ok) {
  console.error(`OpenAI returned ${res.status}: ${(await res.text()).slice(0, 400)}`);
  process.exit(1);
}
const draft = JSON.parse((await res.json()).choices[0].message.content);

// Never trust the model's vocabulary. Filter, report, and carry on.
const rejected = [];
for (const f of ARRAY_FACETS) {
  const allowed = new Set(T.valuesFor(f));
  const given = Array.isArray(draft[f]) ? draft[f] : [];
  const kept = [...new Set(given.filter((v) => allowed.has(v)))];
  for (const v of given) if (!allowed.has(v)) rejected.push(`${f}: ${v}`);
  draft[f] = kept;
}

const id = (process.env.RESOURCE_ID || draft.id || '').trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
if (!id) { console.error('Could not determine an id.'); process.exit(1); }

const target = path.join(repoRoot, 'data', 'resources', `${id}.json`);
if (fs.existsSync(target)) {
  console.error(`data/resources/${id}.json already exists — refusing to overwrite.`);
  process.exit(1);
}

const record = {
  $schema: '../resource.schema.json',
  id,
  title: draft.title || '',
  organization: draft.organization || '',
  description: draft.description || '',
  url,
  audiences: draft.audiences, stages: draft.stages, types: draft.types,
  geography: draft.geography, topics: draft.topics, pathogenFocus: draft.pathogenFocus,
  language: ['en'],
  keyFeatures: Array.isArray(draft.keyFeatures) ? draft.keyFeatures : [],
  practicalUse: draft.practicalUse || '',
  relatedResources: [],
  lastUpdated: '', formatDetails: '',
  legacyTags: ['machine-drafted: needs curator review'],
  ...T.defaults(),
  validated: false
};
fs.writeFileSync(target, JSON.stringify(record, null, 2) + '\n');

const orderFile = path.join(repoRoot, 'data', 'order.json');
const order = JSON.parse(fs.readFileSync(orderFile, 'utf8'));
if (!order.includes(id)) { order.push(id); fs.writeFileSync(orderFile, JSON.stringify(order, null, 2) + '\n'); }

const empties = ['title', 'organization', 'description'].filter((k) => !record[k]);
const thin = ARRAY_FACETS.filter((f) => record[f].length === 0);

const body = [
  `Machine-drafted from ${url}.`,
  '',
  '**Every field below is a suggestion.** The record is marked `validated: false`',
  'and must be checked against the source before merging.',
  '',
  '## Review checklist',
  '',
  '- [ ] The URL opens and is the canonical page for this resource',
  '- [ ] Title and organization match what the publisher actually says',
  '- [ ] The description is accurate and free of marketing language',
  '- [ ] Topics describe what this is *about*, not what it is merely used within',
  '- [ ] Nothing is tagged so broadly that it would stop filtering narrowing anything',
  '- [ ] Set `validated: true` once you have done the above',
  '',
  `Drafted tags: ${ARRAY_FACETS.map((f) => `${f} ${record[f].length}`).join(', ')}.`,
  ''
];
if (rejected.length) {
  body.push('## The model proposed values that are not in the taxonomy');
  body.push('');
  body.push('These were **dropped**, not written. Worth a look — either the model guessed, or the vocabulary has a genuine gap:');
  body.push('');
  rejected.forEach((r) => body.push(`- \`${r}\``));
  body.push('');
}
if (empties.length) { body.push(`⚠️ Empty required fields: ${empties.map((e) => `\`${e}\``).join(', ')}. The page may not have been fetchable.`); body.push(''); }
if (thin.length) { body.push(`⚠️ No tags chosen for: ${thin.map((t) => `\`${t}\``).join(', ')}.`); body.push(''); }

fs.writeFileSync(path.join(repoRoot, 'pr-body.md'), body.join('\n'));

if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `id=${id}\n`);
console.log(`  drafted data/resources/${id}.json`);
if (rejected.length) console.log(`  dropped ${rejected.length} invalid vocabulary value(s): ${rejected.join(', ')}`);
