#!/usr/bin/env node
/**
 * build-schema.mjs — generate data/resource.schema.json from public/taxonomy.js
 *
 * Every record file references this schema, so an editor that understands
 * JSON Schema (VS Code does, out of the box) gives curators autocomplete on
 * every controlled vocabulary, hover text explaining each value, and a red
 * underline on an invalid one — as they type, before CI ever runs.
 *
 * Generated rather than hand-written so it can never drift from the taxonomy.
 * Run with --check to verify the committed copy is current.
 *
 * Deliberately zero-dependency, like the rest of the pipeline.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const taxonomyFile = path.join(repoRoot, 'public', 'taxonomy.js');
const outFile = path.join(repoRoot, 'data', 'resource.schema.json');

function loadTaxonomy() {
  const ctx = { window: {}, module: { exports: {} }, globalThis: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(taxonomyFile, 'utf8'), ctx);
  return ctx.window.APHL_TAXONOMY;
}

const T = loadTaxonomy();

// "id — Label" lines, so hovering a field in the editor explains the vocabulary
// rather than just listing opaque slugs.
function legend(field) {
  return T.flattenOptions(field)
    .map((o) => `- \`${o.id}\` — ${o.label}`)
    .join('\n');
}

function arrayField(field, label, { required = true } = {}) {
  const def = T.TAXONOMY[field];
  const cap = def.maxRecommended;
  return {
    type: 'array',
    description: `${label}.${cap ? ` Keep to ${cap} or fewer — more than that and filtering stops narrowing anything.` : ''}`,
    markdownDescription: `**${label}**\n\n${cap ? `Keep to **${cap} or fewer**; beyond that the validator warns, because a tag on most records filters nothing.\n\n` : ''}${legend(field)}`,
    items: { type: 'string', enum: T.valuesFor(field) },
    uniqueItems: true,
    ...(required ? { minItems: 1 } : {})
  };
}

function scalarField(field) {
  const def = T.TAXONOMY[field];
  return {
    type: 'string',
    enum: T.valuesFor(field),
    default: def.default,
    description: def.help ? def.help.replace(/\s+/g, ' ').trim() : def.label,
    markdownDescription: `**${def.label}**\n\n${def.help ? def.help.replace(/\s+/g, ' ').trim() + '\n\n' : ''}${legend(field)}`
  };
}

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://phemarajata.github.io/aphl-gse-resources/resource.schema.json',
  title: 'APHL genomic epidemiology resource',
  description:
    'One resource in the library. Generated from public/taxonomy.js by ' +
    'scripts/build-schema.mjs — do not edit by hand.',
  type: 'object',
  additionalProperties: false,
  required: [
    'id', 'title', 'organization', 'description', 'url',
    'audiences', 'stages', 'types', 'geography', 'topics', 'language'
  ],
  properties: {
    $schema: { type: 'string', description: 'Editor hint. Stripped from the published data.' },

    id: {
      type: 'string',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
      description: 'Lower-case kebab-case. Must match the filename without .json.'
    },
    title: { type: 'string', minLength: 1, description: 'The resource’s own title, as its publisher writes it.' },
    organization: { type: 'string', minLength: 1, description: 'Publisher or authoring body.' },
    description: {
      type: 'string', minLength: 1,
      description: 'One or two sentences on what this is. Shown on the card and in the detail view.'
    },
    url: {
      type: 'string',
      pattern: '^(https://\\S+|#)$',
      description: 'Must start with https:// and contain no spaces, or be "#" if genuinely unavailable.',
      markdownDescription: '**Link to the resource.**\n\nMust start with `https://` and contain **no whitespace** — a space here means a column got misaligned on import, which has happened before and silently broke five links.\n\nUse `#` only if no public URL exists.'
    },

    audiences: arrayField('audiences', 'Who this is for'),
    stages: arrayField('stages', 'Programme stage this suits'),
    types: arrayField('types', 'What kind of thing this is'),
    geography: arrayField('geography', 'Geographic focus'),
    topics: arrayField('topics', 'What this is substantially about'),
    pathogenFocus: { ...arrayField('pathogenFocus', 'Pathogen focus', { required: false }) },
    language: arrayField('language', 'Languages available'),

    difficulty: scalarField('difficulty'),
    connectivity: scalarField('connectivity'),
    cost: scalarField('cost'),
    effort: scalarField('effort'),
    reuseTerms: scalarField('reuseTerms'),
    maintenance: scalarField('maintenance'),
    access: scalarField('access'),
    endorsement: scalarField('endorsement'),

    keyFeatures: {
      type: 'array', items: { type: 'string' },
      description: 'Short bullet points shown in the detail view.'
    },
    practicalUse: { type: 'string', description: 'How a programme would actually use this.' },
    relatedResources: {
      type: 'array', items: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
      uniqueItems: true,
      description: 'Ids of other records. The build fails on an id that does not exist.'
    },
    lastUpdated: {
      type: 'string', description: 'ISO date the resource itself was last updated, if known. May be empty.'
    },
    formatDetails: { type: 'string', description: 'Free text, e.g. "Journal article / assessment framework".' },
    sourceNotes: { type: 'array', items: { type: 'string' }, description: 'Provenance notes.' },
    legacyTags: {
      type: 'array', items: { type: 'string' },
      description: 'Audit trail from migrations and repairs. Append-only; do not tidy.'
    },
    validated: {
      type: 'boolean',
      description: 'True once a curator has read this record and stands behind it.',
      markdownDescription: '**Curator sign-off.**\n\nSet `true` only when you have actually opened the URL and checked the tagging. The build collects these into `metadata.validatedResources`.'
    }
  }
};

const output = JSON.stringify(schema, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
  if (current === output) {
    console.log('  up to date — data/resource.schema.json matches public/taxonomy.js');
    process.exit(0);
  }
  console.error('  DRIFT: data/resource.schema.json does not match public/taxonomy.js.');
  console.error('  The taxonomy changed without regenerating the schema.');
  console.error('  Fix with: node scripts/build-schema.mjs');
  process.exit(1);
}

fs.writeFileSync(outFile, output);
console.log(`  built data/resource.schema.json — ${Object.keys(schema.properties).length} fields, ${(output.length / 1024).toFixed(0)} KB`);
