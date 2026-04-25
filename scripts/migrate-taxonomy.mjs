#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const dataFilePath = path.join(repoRoot, 'public', 'resources-data.js');
const taxonomyFilePath = path.join(repoRoot, 'public', 'taxonomy.js');
const reportDir = path.join(repoRoot, 'validation-reports');
const reportPath = path.join(reportDir, 'taxonomy-migration-review.json');

function loadTaxonomyApi() {
  const source = fs.readFileSync(taxonomyFilePath, 'utf8');
  const context = { module: { exports: {} }, exports: {}, globalThis: {} };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: taxonomyFilePath });
  return context.module.exports;
}

function loadDatabase() {
  const source = fs.readFileSync(dataFilePath, 'utf8');
  const context = { window: {}, globalThis: {} };
  vm.createContext(context);
  vm.runInContext(`${source};globalThis.__db = typeof resourcesDatabase !== 'undefined' ? resourcesDatabase : { resources: resourcesData };`, context, {
    filename: dataFilePath
  });
  return context.globalThis.__db;
}

const taxonomyApi = loadTaxonomyApi();
const enums = taxonomyApi.enumFields();
const allTaxonomyValues = new Set(Object.values(enums).flat());

const maps = {
  audiences: {
    laboratorians: 'laboratorians',
    laboratorian: 'laboratorians',
    epidemiologists: 'epidemiologists',
    epidemiologist: 'epidemiologists',
    bioinformaticians: 'bioinformaticians',
    bioinformatician: 'bioinformaticians',
    policymakers: 'policymakers',
    policy: 'policymakers',
    donors: 'donors-funders',
    funders: 'donors-funders',
    'health ministries': 'health-ministry-officials',
    'public health labs': 'laboratorians',
    'public health authorities': 'public-health-officials',
    'public health planners': 'public-health-officials',
    'lab leadership': 'lab-leadership',
    'laboratory leadership': 'lab-leadership',
    trainers: 'trainers-educators',
    'one health partners': 'one-health-partners',
    'environmental surveillance teams': 'environmental-health-teams',
    'environmental surveillance': 'environmental-health-teams',
    'regional health organizations': 'regional-international-orgs'
  },
  stages: {
    planning: 'planning-strategy',
    implementation: 'implementation',
    optimization: 'optimization-sustainability',
    readiness: 'readiness-assessment',
    strategy: 'planning-strategy',
    sustainability: 'optimization-sustainability'
  },
  types: {
    guide: 'guide-manual',
    training: 'training-material',
    policy: 'policy-document',
    research: 'research-evidence',
    review: 'research-evidence',
    framework: 'framework-strategy',
    template: 'template-checklist',
    checklist: 'template-checklist',
    dashboard: 'data-dashboard'
  },
  geography: {
    global: 'global',
    'global relevance': 'global',
    lmic: 'lmic',
    lmics: 'lmic',
    africa: 'africa',
    malawi: 'southern-africa',
    nigeria: 'west-africa',
    asia: 'asia',
    'south & southeast asia': 'southeast-asia',
    'se asia': 'southeast-asia',
    indonesia: 'southeast-asia',
    thailand: 'southeast-asia',
    vietnam: 'southeast-asia',
    americas: 'americas',
    australia: 'oceania-pacific',
    'high-income': 'high-income',
    'urban settings': 'global'
  },
  topics: {
    surveillance: 'genomic-surveillance',
    'genomic surveillance': 'genomic-surveillance',
    'pathogen genomics': 'genomic-surveillance',
    'genomic infrastructure': 'genomic-surveillance',
    implementation: 'stakeholder-engagement',
    planning: 'stakeholder-engagement',
    strategy: 'stakeholder-engagement',
    policy: 'regulatory-frameworks',
    governance: 'data-governance',
    'governance & policy roles': 'data-governance',
    'ethical & legal issues': 'ethics-legal',
    privacy: 'privacy-benefit-sharing',
    'benefit sharing': 'privacy-benefit-sharing',
    costing: 'costing-financing',
    'costed activities': 'costing-financing',
    'investment cases': 'investment-cases',
    sustainability: 'sustainability',
    'sustainability considerations': 'sustainability',
    'resource mobilization': 'resource-mobilization',
    'stakeholder engagement': 'stakeholder-engagement',
    'monitoring & evaluation': 'monitoring-evaluation',
    'clear m&e framework': 'monitoring-evaluation',
    training: 'workforce-training',
    'capacity building': 'workforce-training',
    'capacity-building': 'workforce-training',
    capacity: 'workforce-training',
    'capacity assessment': 'workforce-training',
    'technology transfer': 'technology-transfer',
    'regional network': 'regional-networks',
    networking: 'regional-networks',
    'laboratory networking': 'lab-networking',
    'laboratory systems': 'lab-networking',
    qms: 'quality-management',
    qc: 'quality-management',
    'quality assurance': 'quality-management',
    accreditation: 'accreditation',
    diagnostics: 'diagnostics-integration',
    'integration with diagnostics & laboratory capacity': 'diagnostics-integration',
    bioinformatics: 'pipelines-workflows',
    workflows: 'pipelines-workflows',
    'sample & data workflows': 'pipelines-workflows',
    'data flows': 'data-sharing-interoperability',
    'data sharing': 'data-sharing-interoperability',
    'data-sharing': 'data-sharing-interoperability',
    interoperability: 'data-sharing-interoperability',
    phylogenetics: 'phylogenetics',
    visualization: 'visualization',
    prioritization: 'outbreak-detection',
    'pathogen prioritization': 'outbreak-detection',
    'risk prioritization': 'outbreak-detection',
    'outbreak detection': 'outbreak-detection',
    'variant detection': 'variant-monitoring',
    'variant monitoring': 'variant-monitoring',
    wastewater: 'environmental-surveillance',
    amr: 'amr-surveillance',
    'bacterial amr': 'amr-surveillance',
    arboviruses: 'outbreak-detection',
    'emerging pathogens': 'outbreak-detection',
    'viral genomics': 'genomic-surveillance',
    'virus genomics': 'genomic-surveillance'
  },
  pathogenFocus: {
    amr: 'amr-bacteria',
    'bacterial amr': 'amr-bacteria',
    arboviruses: 'arboviruses-vectorborne',
    'emerging pathogens': 'emerging-pathogens',
    'viral genomics': 'viral-genomics',
    'virus genomics': 'viral-genomics',
    'viral & bacterial pathogens': ['viral-genomics', 'bacterial-genomics']
  }
};

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function kebab(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function pushUnique(target, value, allowed) {
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    if (item && allowed.includes(item) && !target.includes(item)) target.push(item);
  }
}

function looksLikeSentence(value) {
  const text = String(value || '');
  return text.length > 42 || /[.;:]/.test(text) || /\b(and|with|shows|includes|defines|outlines|conducts|addresses)\b/i.test(text);
}

function mapValue(field, value) {
  const clean = norm(value);
  if (!clean) return null;
  const directId = kebab(value);
  if (enums[field]?.includes(directId)) return directId;
  return maps[field]?.[clean] || null;
}

function migrateRecord(record, idMap, review) {
  const migrated = {
    ...record,
    id: idMap.get(record.id) || kebab(record.id),
    audiences: [],
    stages: [],
    types: [],
    geography: [],
    topics: [],
    pathogenFocus: [],
    language: Array.isArray(record.language) && record.language.length ? record.language : ['en'],
    lastUpdated: record.lastUpdated || '',
    formatDetails: record.formatDetails || '',
    legacyTags: Array.isArray(record.legacyTags) ? [...record.legacyTags] : []
  };

  const leftovers = [];
  const fields = ['audiences', 'stages', 'types', 'geography', 'topics'];
  for (const sourceField of fields) {
    for (const raw of record[sourceField] || []) {
      const text = String(raw || '').trim();
      if (!text) continue;
      let placed = false;

      for (const targetField of ['audiences', 'stages', 'types', 'geography', 'topics', 'pathogenFocus']) {
        const mapped = mapValue(targetField, text);
        if (mapped) {
          pushUnique(migrated[targetField], mapped, enums[targetField]);
          placed = true;
        }
      }

      if (!placed || looksLikeSentence(text)) leftovers.push(`${sourceField}: ${text}`);
    }
  }

  if (migrated.types.length === 0) {
    const url = String(record.url || '').toLowerCase();
    const title = `${record.title || ''} ${record.description || ''}`.toLowerCase();
    if (/\b(excel|spreadsheet|calculator|costing tool)\b/.test(title)) migrated.types.push('spreadsheet-tool');
    else if (/\b(tool|platform|database|dashboard)\b/.test(title)) migrated.types.push('interactive-tool');
    else if (/\b(training|course|academy|module)\b/.test(title)) migrated.types.push('training-material');
    else if (/\b(policy|resolution)\b/.test(title)) migrated.types.push('policy-document');
    else if (/\b(case study)\b/.test(title)) migrated.types.push('case-study');
    else if (/\b(review|study|assessment|survey)\b/.test(title) || url.includes('journal')) migrated.types.push('research-evidence');
    else migrated.types.push('guide-manual');
    leftovers.push('types: inferred from title/description');
  }

  if (migrated.stages.length === 0) migrated.stages.push('implementation');
  if (migrated.audiences.length === 0) migrated.audiences.push('laboratorians');
  if (migrated.geography.length === 0) migrated.geography.push('global');
  if (migrated.topics.length === 0) migrated.topics.push('genomic-surveillance');

  migrated.relatedResources = (record.relatedResources || [])
    .map((id) => idMap.get(id) || kebab(id))
    .filter((id) => id && idMap.has(id) || id);

  migrated.legacyTags = [...new Set([...migrated.legacyTags, ...leftovers])];

  for (const field of ['audiences', 'stages', 'types', 'geography', 'topics', 'pathogenFocus', 'language']) {
    migrated[field] = [...new Set((migrated[field] || []).filter((value) => enums[field].includes(value)))];
  }

  if (leftovers.length > 0) {
    review.push({
      id: migrated.id,
      title: record.title,
      notes: leftovers
    });
  }

  return migrated;
}

function serializeDatabase(database) {
  return `// Auto-generated resources database with metadata
const resourcesDatabase = ${JSON.stringify(database, null, 2)};

// Backward compatibility - expose resourcesData for existing code
const resourcesData = resourcesDatabase.resources;

// Make both available globally for the admin panel
if (typeof window !== 'undefined') {
  window.resourcesDatabase = resourcesDatabase;
  window.resourcesData = resourcesData;
}`;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const database = loadDatabase();
  const resources = database.resources || [];
  const idMap = new Map();
  const usedIds = new Set();

  for (const resource of resources) {
    let id = kebab(resource.id || resource.title);
    const base = id || 'resource';
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    idMap.set(resource.id, id);
  }

  const review = [];
  const migratedResources = resources.map((record) => migrateRecord(record, idMap, review));
  const validIds = new Set(migratedResources.map((resource) => resource.id));

  for (const resource of migratedResources) {
    const before = resource.relatedResources || [];
    resource.relatedResources = before.filter((id) => validIds.has(id));
    const removed = before.filter((id) => !validIds.has(id));
    if (removed.length) {
      resource.legacyTags = [...new Set([...(resource.legacyTags || []), ...removed.map((id) => `relatedResources removed: ${id}`)])];
      review.push({ id: resource.id, title: resource.title, notes: removed.map((id) => `Missing related resource removed: ${id}`) });
    }
  }

  const now = new Date().toISOString();
  const migratedDatabase = {
    metadata: {
      ...(database.metadata || {}),
      version: '2.0.0',
      lastUpdated: now,
      totalResources: migratedResources.length,
      taxonomyVersion: '2026-04-expanded',
      generatedBy: 'APHL taxonomy migration script',
      validatedResources: (database.metadata?.validatedResources || []).map((id) => idMap.get(id) || kebab(id)).filter((id) => validIds.has(id))
    },
    resources: migratedResources
  };

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: now,
    resourcesChecked: resources.length,
    resourcesMigrated: migratedResources.length,
    manualReviewCount: review.length,
    manualReview: review
  }, null, 2));

  if (!dryRun) fs.writeFileSync(dataFilePath, serializeDatabase(migratedDatabase));
  console.log(`${dryRun ? 'Dry run' : 'Migration'} complete: ${migratedResources.length} resources, ${review.length} review notes.`);
  console.log(`Review report: ${path.relative(repoRoot, reportPath)}`);
}

main();
