
// admin.js v1.8 — self-contained, stable
(function(){
  'use strict';

  function downloadText(filename, text){
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }


  const TAXONOMY_API = window.APHL_TAXONOMY || {};
  const TAXONOMY = TAXONOMY_API.TAXONOMY || {};
  const TAXONOMY_ENUMS = TAXONOMY_API.enumFields ? TAXONOMY_API.enumFields() : {
    audiences: ['laboratorians', 'epidemiologists', 'bioinformaticians', 'policymakers'],
    stages: ['planning', 'implementation', 'optimization'],
    types: ['guide', 'tool', 'training', 'policy'],
    geography: ['global', 'africa', 'asia', 'lmic'],
    topics: ['surveillance', 'implementation', 'policy', 'qms', 'bioinformatics', 'training', 'costing', 'prioritization'],
    pathogenFocus: [],
    language: ['en']
  };
  const RESOURCE_SCHEMA = {
    idPattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    requiredFields: ['id', 'title', 'organization', 'description', 'url'],
    enumFields: TAXONOMY_ENUMS,
    requiredArrays: ['audiences', 'stages', 'types', 'geography', 'topics'],
    optionalArrays: ['keyFeatures', 'relatedResources', 'pathogenFocus', 'language', 'legacyTags'],
    urlPattern: /^https:\/\//i
  };

  function formatValidationMessage(issue){
    return `[${issue.severity.toUpperCase()}] ${issue.source} | field: ${issue.field} | expected: ${issue.expected} | actual: ${issue.actual} | fix: ${issue.hint}`;
  }

  function validateResourceRecord(record, context = {}) {
    const issues = [];
    const source = context.source || 'record';

    const pushIssue = (severity, field, expected, actual, hint) => {
      issues.push({ severity, source, field, expected, actual, hint });
    };

    RESOURCE_SCHEMA.requiredFields.forEach((field) => {
      const value = record[field];
      if (typeof value !== 'string' || value.trim() === '') {
        pushIssue('critical', field, 'non-empty string', JSON.stringify(value), `Provide a value for ${field}.`);
      }
    });

    if (record.id && !RESOURCE_SCHEMA.idPattern.test(record.id)) {
      pushIssue('critical', 'id', 'kebab-case lowercase ID (e.g., who-global-strategy)', JSON.stringify(record.id), 'Use lowercase letters/numbers with single hyphens and no spaces/underscores.');
    }

    if (record.url && record.url !== '#' && !RESOURCE_SCHEMA.urlPattern.test(record.url)) {
      pushIssue('critical', 'url', 'URL must be "#" or start with https://', JSON.stringify(record.url), 'Use a secure https:// URL or "#" if unavailable.');
    }

    RESOURCE_SCHEMA.requiredArrays.forEach((field) => {
      const value = record[field];
      if (!Array.isArray(value) || value.length === 0) {
        pushIssue('critical', field, 'array with at least 1 value', JSON.stringify(value), `Select at least one ${field} value.`);
        return;
      }

      const allowed = RESOURCE_SCHEMA.enumFields[field] || [];
      const invalid = value.filter((entry) => !allowed.includes(entry));
      if (invalid.length > 0) {
        pushIssue('critical', field, `only allowed values: ${allowed.join(', ')}`, JSON.stringify(invalid), `Replace invalid values in ${field} with allowed enum values.`);
      }

      const uniqueCount = new Set(value).size;
      if (uniqueCount !== value.length) {
        pushIssue('warning', field, 'array values should be unique', JSON.stringify(value), `Remove duplicate values from ${field}.`);
      }
    });

    RESOURCE_SCHEMA.optionalArrays.forEach((field) => {
      const value = record[field];
      if (value !== undefined && !Array.isArray(value)) {
        pushIssue('critical', field, 'array value', JSON.stringify(value), `Convert ${field} to an array.`);
      }
    });

    ['pathogenFocus', 'language'].forEach((field) => {
      const value = record[field];
      if (value === undefined) return;
      const allowed = RESOURCE_SCHEMA.enumFields[field] || [];
      const invalid = Array.isArray(value) ? value.filter((entry) => !allowed.includes(entry)) : [];
      if (invalid.length > 0) {
        pushIssue('critical', field, `only allowed values: ${allowed.join(', ')}`, JSON.stringify(invalid), `Replace invalid values in ${field} with allowed enum values.`);
      }
    });

    RESOURCE_SCHEMA.requiredArrays.concat(['pathogenFocus']).forEach((field) => {
      const value = record[field];
      const max = TAXONOMY[field]?.maxRecommended;
      if (Array.isArray(value) && max && value.length > max) {
        pushIssue('warning', field, `no more than ${max} tags recommended`, JSON.stringify(value), `Remove low-value tags from ${field} to keep filtering precise.`);
      }
    });

    if (record.lastUpdated && Number.isNaN(Date.parse(record.lastUpdated))) {
      pushIssue('critical', 'lastUpdated', 'valid ISO date or YYYY-MM-DD', JSON.stringify(record.lastUpdated), 'Use a valid date for lastUpdated.');
    }

    if (Array.isArray(record.keyFeatures) && record.keyFeatures.length === 0) {
      pushIssue('warning', 'keyFeatures', 'at least one key feature recommended', JSON.stringify(record.keyFeatures), 'Add one or more key features to improve discoverability.');
    }

    if (!record.practicalUse || String(record.practicalUse).trim() === '') {
      pushIssue('warning', 'practicalUse', 'recommended non-empty description', JSON.stringify(record.practicalUse), 'Add a practical use note to help users apply the resource.');
    }

    return {
      source,
      issues,
      critical: issues.filter((i) => i.severity === 'critical'),
      warnings: issues.filter((i) => i.severity === 'warning')
    };
  }

  function validateResourceSet(records, sourceLabel = 'dataset') {
    const issues = [];
    const seenIds = new Map();
    const knownIds = new Set(records.map((record) => record && record.id).filter(Boolean));

    records.forEach((record, idx) => {
      const source = `${sourceLabel} row/index ${idx + 1}`;
      const rowResult = validateResourceRecord(record, { source });
      issues.push(...rowResult.issues);

      if (record.id) {
        const existingIndex = seenIds.get(record.id);
        if (existingIndex !== undefined) {
          issues.push({
            severity: 'critical',
            source,
            field: 'id',
            expected: 'unique ID across all records',
            actual: `duplicate of row/index ${existingIndex + 1} (${record.id})`,
            hint: 'Use a unique ID for each resource.'
          });
        } else {
          seenIds.set(record.id, idx);
        }
      }

      if (Array.isArray(record.relatedResources)) {
        const missing = record.relatedResources.filter((id) => !knownIds.has(id));
        if (missing.length > 0) {
          issues.push({
            severity: 'warning',
            source,
            field: 'relatedResources',
            expected: 'IDs that exist in the current dataset',
            actual: JSON.stringify(missing),
            hint: 'Remove stale relatedResources IDs or add the missing referenced records.'
          });
        }
      }
    });

    return {
      issues,
      critical: issues.filter((i) => i.severity === 'critical'),
      warnings: issues.filter((i) => i.severity === 'warning')
    };
  }

  // Converters
  function toTSV(resources){
    const headers = ['id','title','organization','description','url','audiences','stages','types','geography','topics','pathogenFocus','language','lastUpdated','formatDetails','keyFeatures','practicalUse','relatedResources','legacyTags'];
    const head = headers.join('\t');
    const lines = resources.map(r => [
      r.id||'',
      r.title||'',
      r.organization||'',
      r.description||'',
      r.url||'#',
      (r.audiences||[]).join(';'),
      (r.stages||[]).join(';'),
      (r.types||[]).join(';'),
      (r.geography||[]).join(';'),
      (r.topics||[]).join(';'),
      (r.pathogenFocus||[]).join(';'),
      (r.language||[]).join(';'),
      r.lastUpdated||'',
      r.formatDetails||'',
      (r.keyFeatures||[]).join('\\n'),
      r.practicalUse||'',
      (r.relatedResources||[]).join(';'),
      (r.legacyTags||[]).join('\\n')
    ].map(x => String(x)).join('\t'));
    return [head].concat(lines).join('\n');
  }
  function toJS(resources){
    const database = {
      metadata: {
        version: '2.0.0',
        lastUpdated: new Date().toISOString(),
        totalResources: resources.length,
        generatedBy: 'APHL Admin Panel v2.0'
      },
      resources
    };
    return `// Auto-generated resources database with metadata
const resourcesDatabase = ${JSON.stringify(database, null, 2)};

const resourcesData = resourcesDatabase.resources;

if (typeof window !== 'undefined') {
  window.resourcesDatabase = resourcesDatabase;
  window.resourcesData = resourcesData;
}`;
  }

  function deepClone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function computeResourceSummary(previousResources, nextResources){
    const prevMap = new Map((previousResources || []).map((r) => [r.id, r]));
    const nextMap = new Map((nextResources || []).map((r) => [r.id, r]));
    let added = 0;
    let updated = 0;
    let deleted = 0;

    nextMap.forEach((value, id) => {
      if (!prevMap.has(id)) {
        added += 1;
      } else if (JSON.stringify(prevMap.get(id)) !== JSON.stringify(value)) {
        updated += 1;
      }
    });

    prevMap.forEach((_, id) => {
      if (!nextMap.has(id)) deleted += 1;
    });

    return { added, updated, deleted };
  }
  function parseTSV(tsv){
    const rows = tsv.trim().split(/\r?\n/);
    const header = rows.shift().split('\t');
    const idx = Object.fromEntries(header.map((h,i)=>[h.trim(), i]));
    function splitList(v){ return String(v||'').split(';').map(s=>s.trim()).filter(Boolean); }
    return rows.map(line => {
      const cols = line.split('\t');
      const get = k => cols[idx[k]] || '';
      return {
        id: get('id').trim(),
        title: get('title').trim(),
        organization: get('organization').trim(),
        description: get('description').trim(),
        url: get('url').trim() || '#',
        audiences: splitList(get('audiences')),
        stages: splitList(get('stages')),
        types: splitList(get('types')),
        geography: splitList(get('geography')),
        topics: splitList(get('topics')),
        pathogenFocus: splitList(get('pathogenFocus')),
        language: splitList(get('language')),
        lastUpdated: get('lastUpdated').trim(),
        formatDetails: get('formatDetails').trim(),
        keyFeatures: String(get('keyFeatures')||'').replace(/\\r/g,'').split('\\n').filter(Boolean),
        practicalUse: get('practicalUse').trim(),
        relatedResources: splitList(get('relatedResources')),
        legacyTags: String(get('legacyTags')||'').replace(/\\r/g,'').split('\\n').filter(Boolean)
      };
    });
  }
  // --- Robust JS array extraction (resourcesData = [ ... ])
function extractResourcesArrayLiteral(jsText) {
  // Remove UTF-8 BOM if present
  if (jsText.charCodeAt(0) === 0xFEFF) jsText = jsText.slice(1);

  // Find the assignment (supports const/let/var and window.)
  const re = /(const|let|var)?\s*resourcesData\s*=\s*|\bwindow\.resourcesData\s*=\s*/m;
  const m = re.exec(jsText);
  if (!m) throw new Error('Could not find resourcesData assignment');

  let i = re.lastIndex;
  // skip whitespace and optional opening parenthesis
  while (i < jsText.length && /\s/.test(jsText[i])) i++;
  if (jsText[i] === '(') { i++; while (i < jsText.length && /\s/.test(jsText[i])) i++; }

  if (jsText[i] !== '[') throw new Error('Expected array literal after resourcesData =');

  // Balanced bracket scan; ignore strings and comments
  let start = i, depth = 0, inStr = false, q = '', lineCom = false, blockCom = false, j = i;
  while (j < jsText.length) {
    const ch = jsText[j], next = jsText[j+1];

    if (lineCom) { if (ch === '\n') lineCom = false; j++; continue; }
    if (blockCom){ if (ch === '*' && next === '/') { blockCom = false; j += 2; continue; } j++; continue; }
    if (inStr)    { if (ch === '\\' && j+1 < jsText.length) { j += 2; continue; } if (ch === q){ inStr = false; } j++; continue; }

    if (ch === '/' && next === '/') { lineCom = true; j += 2; continue; }
    if (ch === '/' && next === '*') { blockCom = true; j += 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; q = ch; j++; continue; }

    if (ch === '[') depth++;
    if (ch === ']') { depth--; if (depth === 0) { j++; break; } }
    j++;
  }
  if (depth !== 0) throw new Error('Unbalanced array brackets in resourcesData');

  return jsText.slice(start, j);
}

function parseJS(text) {
  try {
    const arrayLiteral = extractResourcesArrayLiteral(text);
    const arr = Function('return (' + arrayLiteral + ');')();
    if (!Array.isArray(arr)) throw new Error('Parsed resourcesData is not an array');
    return arr.map(normalize);
  } catch (error) {
    console.error('parseJS error:', error);
    console.log('First 500 chars of input:', text.substring(0, 500));
    throw error;
  }
}


  function parseJSON(text){
    const parsed = JSON.parse(text);
    const records = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.resources) ? parsed.resources : null);
    if (!records) throw new Error('JSON must be an array of resources or an object with a resources array');
    return records.map(normalize);
  }
  function normalize(o){
    const list = v => Array.isArray(v) ? v : String(v||'').split(';').map(s=>s.trim()).filter(Boolean);
    
    // Normalize ID to lowercase, numbers, and hyphens only
    const normalizeId = (id) => {
      return String(id||'').toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')  // Replace invalid chars with hyphens
        .replace(/-+/g, '-')          // Replace multiple hyphens with single
        .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens
    };
    
    return {
      id: normalizeId(o.id),
      title: String(o.title||'').trim(),
      organization: String(o.organization||'').trim(),
      description: String(o.description||'').trim(),
      url: String(o.url||'#').trim() || '#',
      audiences: list(o.audiences),
      stages: list(o.stages),
      types: list(o.types),
      geography: list(o.geography),
      topics: list(o.topics),
      pathogenFocus: list(o.pathogenFocus),
      language: list(o.language).length ? list(o.language) : ['en'],
      lastUpdated: String(o.lastUpdated||'').trim(),
      formatDetails: String(o.formatDetails||'').trim(),
      legacyTags: list(o.legacyTags),
      keyFeatures: Array.isArray(o.keyFeatures) ? o.keyFeatures : String(o.keyFeatures||'').split('\\n').filter(Boolean),
      practicalUse: String(o.practicalUse||'').trim(),
      relatedResources: list(o.relatedResources)
    };
  }

  // UI
class AdminApp {
  constructor() {
    this.database = null; // Full database with metadata
    this.original = [];
    this.data = [];
    this.dirty = false;
    this.newOrModifiedIds = new Set(); // Track IDs of new or modified resources
    this.validatedIds = new Set(); // Track IDs of validated resources
    this.lastValidationTime = null;
    this.openAiApiKey = '';

    const start = (dbData) => {
      if (dbData && dbData.resources) {
        // New database format with metadata
        this.database = dbData;
        this.original = JSON.parse(JSON.stringify(dbData.resources));
        this.data = JSON.parse(JSON.stringify(dbData.resources));
        this.ensureMetadataCollections();
        // Load validation status from metadata if available
        if (dbData.metadata && dbData.metadata.validatedResources) {
          this.validatedIds = new Set(dbData.metadata.validatedResources);
        }
        if (dbData.metadata && dbData.metadata.lastValidated) {
          this.lastValidationTime = dbData.metadata.lastValidated;
        }
      } else {
        // Fallback to old format
        const arr = Array.isArray(dbData) ? dbData : [];
        this.database = {
          metadata: {
            version: "1.8.1",
            lastUpdated: new Date().toISOString(),
            totalResources: arr.length,
            lastValidated: null,
            validatedResources: [],
            generatedBy: "APHL Admin Panel v1.8",
            versionHistory: [],
            auditLog: []
          },
          resources: arr
        };
        this.original = JSON.parse(JSON.stringify(arr));
        this.data = JSON.parse(JSON.stringify(arr));
      }
      this.renderTaxonomyControls();
      this.bind();
      this.renderList();
      this.updateDashboard();
      this.renderVersionHistory();
      window.admin = this; window.Admin = this;
      this.enableValidationIfAny();
    };

    // Preferred: read from the already-loaded global (fast path)
    if (window.resourcesDatabase) {
      start(window.resourcesDatabase);
    } else if (Array.isArray(window.resourcesData)) {
      start(window.resourcesData);
    } else {
      // Fallback: fetch the JS file and parse robustly
      fetch('resources-data.js')
        .then(r => r.text())
        .then(txt => {
          try {
            // Try to extract the new database format first
            if (txt.includes('resourcesDatabase')) {
              const script = new Function(txt + '; return resourcesDatabase;');
              const db = script();
              start(db);
            } else {
              // Fall back to old format
              const resources = parseJS(txt);
              start(resources);
            }
          } catch (error) {
            console.error('Failed to parse resources file:', error);
            start([]); // Start with empty database
          }
        })
        .catch(() => start([])); // still bring up UI even if fetch fails
    }
  }

  bind() {
    const file = this.q('#fileInputHidden');
    this.on('#importTsvBtn', 'click', () => { file.accept = '.tsv,.txt'; file.onchange = e => this.importFile(e, 'tsv'); file.click(); });
    this.on('#importJsBtn', 'click', () => { file.accept = '.js'; file.onchange = e => this.importFile(e, 'js'); file.click(); });
    this.on('#importJsonBtn', 'click', () => { file.accept = '.json'; file.onchange = e => this.importFile(e, 'json'); file.click(); });

    this.on('#exportJsonBtn', 'click', () => downloadText('resources-data.js', toJS(this.data)));
    this.on('#exportTsvBtn', 'click', () => downloadText('genomic-epi-resources.tsv', toTSV(this.data)));

      // Templates: multi-click safe, works on file://
      this.templateDownload('#downloadTsvTemplate','resources-template.tsv', this.tsvFallback());

      this.on('#validateBtn','click', ()=> this.validateNewResources());
      this.on('#validateAllBtn','click', ()=> this.validateAll());
      this.on('#saveDatabaseBtn','click', ()=> this.saveDatabase());
      this.on('#compareVersionsBtn', 'click', () => this.compareVersions());
      this.on('#aiAnalyzeBtn', 'click', () => this.analyzeWithGpt());
      this.on('#applyAiSuggestionBtn', 'click', () => this.applyAiSuggestion());
      this.on('#batchAnalyzeBtn', 'click', () => this.analyzeUrlBatch());
      this.on('#useOpenAiKeyBtn', 'click', () => this.useOpenAiKeyForSession());
      this.on('#clearOpenAiKeyBtn', 'click', () => this.clearOpenAiKey());

      this.on('#clearForm','click', ()=> this.clearForm());
      this.on('#resourceForm','submit', (e)=>{ e.preventDefault(); this.saveFromForm(); });

      this.on('#searchResources','input', (e)=> this.filterList(e.target.value));
      this.updateOpenAiKeyStatus();

      // Add real-time ID formatting
      this.on('#resourceId','input', (e)=> {
        const input = e.target;
        const cursorPos = input.selectionStart;
        const originalValue = input.value;
        const normalizedValue = originalValue.toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        if (originalValue !== normalizedValue) {
          input.value = normalizedValue;
          // Try to maintain cursor position
          input.setSelectionRange(cursorPos, cursorPos);
        }
      });

      window.addEventListener('beforeunload', (e)=> { 
        if(this.dirty || this.newOrModifiedIds.size > 0){ 
          const message = 'You have unsaved changes. Are you sure you want to leave?';
          e.preventDefault(); 
          e.returnValue = message;
          return message;
        } 
      });

      const savedByInput = this.q('#savedByInput');
      if (savedByInput) {
        const remembered = localStorage.getItem('aphlAdminSavedBy');
        if (remembered) savedByInput.value = remembered;
        savedByInput.addEventListener('change', () => {
          const normalized = String(savedByInput.value || '').trim();
          if (normalized) localStorage.setItem('aphlAdminSavedBy', normalized);
        });
      }
    }

    q(sel){ return document.querySelector(sel); }
    on(sel, ev, fn){ const el=this.q(sel); if(el) el.addEventListener(ev, fn); }

    useOpenAiKeyForSession(){
      const input = this.q('#openAiApiKeyInput');
      const key = String(input?.value || '').trim();
      if (!key) {
        this.openAiApiKey = '';
        this.updateOpenAiKeyStatus('Paste an OpenAI API key before enabling AI intake.');
        return;
      }
      this.openAiApiKey = key;
      if (input) input.value = '';
      this.updateOpenAiKeyStatus();
    }

    clearOpenAiKey(){
      this.openAiApiKey = '';
      const input = this.q('#openAiApiKeyInput');
      if (input) input.value = '';
      this.updateOpenAiKeyStatus();
    }

    updateOpenAiKeyStatus(message){
      const status = this.q('#openAiKeyStatus');
      if (!status) return;
      if (message) {
        status.textContent = message;
        status.className = 'text-xs text-red-700 mt-2';
        return;
      }
      if (this.openAiApiKey) {
        status.textContent = 'OpenAI key active for this session. It will clear on page refresh or logout.';
        status.className = 'text-xs text-green-700 mt-2';
      } else {
        status.textContent = 'No OpenAI key active for this session.';
        status.className = 'text-xs text-blue-900 mt-2';
      }
    }

    renderTaxonomyControls(){
      const renderOptions = (container, name, options, grid = false) => {
        if (!container) return;
        container.className = grid ? 'grid grid-cols-1 md:grid-cols-3 gap-1 text-sm' : container.className;
        container.innerHTML = (options || []).map((opt) => `
          <label class="block leading-snug">
            <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(opt.id)}" class="mr-1">
            ${escapeHtml(opt.label)}
          </label>
        `).join('');
      };

      const renderField = (field) => {
        const container = this.q(`#taxonomy-${field}`);
        const def = TAXONOMY[field];
        if (!container || !def) return;
        if (Array.isArray(def.options)) {
          renderOptions(container, field, def.options, ['pathogenFocus', 'language'].includes(field));
          return;
        }
        container.innerHTML = (def.groups || []).map((group) => `
          <div>
            <div class="text-xs font-semibold text-gray-600 mb-1">${escapeHtml(group.label)}</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-1">
              ${(group.options || []).map((opt) => `
                <label class="block leading-snug">
                  <input type="checkbox" name="${escapeHtml(field)}" value="${escapeHtml(opt.id)}" class="mr-1">
                  ${escapeHtml(opt.label)}
                </label>
              `).join('')}
            </div>
          </div>
        `).join('');
      };

      ['audiences','stages','types','geography','topics','pathogenFocus','language'].forEach(renderField);
    }

    showToast(message, tone = 'info') {
      const existing = document.getElementById('adminImportToast');
      if (existing) existing.remove();

      const palette = {
        success: 'bg-green-600',
        warning: 'bg-yellow-600',
        info: 'bg-gray-800'
      };

      const toast = document.createElement('div');
      toast.id = 'adminImportToast';
      toast.className = `${palette[tone] || palette.info} text-white text-sm px-4 py-3 rounded shadow-lg fixed bottom-4 right-4 z-50 max-w-md`;
      toast.textContent = message;
      document.body.appendChild(toast);

      window.setTimeout(() => {
        toast.style.transition = 'opacity 250ms ease';
        toast.style.opacity = '0';
      }, 2600);
      window.setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 2900);
    }

    templateDownload(sel, filename, fallbackText){
      const el = this.q(sel); if(!el) return;
      el.addEventListener('click', async (e)=>{
        e.preventDefault();
        try{
          const res = await fetch(filename);
          if(!res.ok) throw 0;
          const txt = await res.text();
          downloadText(filename, txt);
        }catch(_){
          downloadText(filename, fallbackText);
        }
      });
    }
    tsvFallback(){ return [
      'id\ttitle\torganization\tdescription\turl\taudiences\tstages\ttypes\tgeography\ttopics\tpathogenFocus\tlanguage\tlastUpdated\tformatDetails\tkeyFeatures\tpracticalUse\trelatedResources\tlegacyTags',
      'example-resource-id\tExample Genomic Surveillance Guide\tExample Health Organization\tA comprehensive guide for implementing genomic surveillance systems in public health laboratories with step-by-step protocols and best practices.\thttps://example.org/guide\tlaboratorians;epidemiologists\tplanning-strategy;implementation\tguide-manual;training-material\tglobal;lmic\tgenomic-surveillance;quality-management\trespiratory-pathogens\ten\t2026-04-25\tPDF guide\tLaboratory setup protocols\\nQuality management systems\\nWorkflow optimization\\nStaff training materials\tUse this guide to establish genomic surveillance capabilities in your laboratory, train staff, and ensure quality standards\trelated-resource-1;related-resource-2\t'
    ].join('\n'); }

    renderList(){
      const c=this.q('#resourceList'); if(!c) return;
      c.innerHTML = (this.data||[]).map(r=>`
        <div class="border rounded p-3" data-hay="${escapeHtml((r.title+' '+r.organization+' '+r.id).toLowerCase())}">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="font-medium text-sm">${escapeHtml(r.title)}</div>
              <div class="text-xs text-gray-600">${escapeHtml(r.organization)}</div>
              <div class="text-[11px] text-gray-500">ID: <code>${escapeHtml(r.id)}</code></div>
            </div>
            <div class="flex space-x-2">
              <button class="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300" data-edit="${escapeHtml(r.id)}"><i class="fas fa-edit mr-1"></i>Edit</button>
              <button class="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200" data-del="${escapeHtml(r.id)}"><i class="fas fa-trash mr-1"></i>Delete</button>
            </div>
          </div>
        </div>
      `).join('') || '<div class="text-sm text-gray-500">No resources loaded yet.</div>';
      c.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', ()=> this.edit(b.getAttribute('data-edit'))));
      c.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', ()=> this.remove(b.getAttribute('data-del'))));
    }
    updateDashboard(){
      const set=(id,val)=>{ const el=this.q(id); if(el) el.textContent=String(val); };
      
      // Basic counts
      set('#dbTotalCount', this.original.length);
      const importedNewCount = this.newOrModifiedIds.size;
      set('#importedCount', importedNewCount);
      
      // Validation counts - total validated resources across all data
      const totalValidated = this.data.filter(r => this.validatedIds.has(r.id)).length;
      set('#dbValidatedCount', totalValidated);
      
      const validatedNew = Array.from(this.newOrModifiedIds).filter(id => this.validatedIds.has(id)).length;
      const needValidation = importedNewCount - validatedNew;
      set('#pendingValidationCount', Math.max(0, needValidation));
      
      // Unsaved count (imported/new resources that haven't been saved to database)
      set('#unsavedCount', importedNewCount);
      
      // Last updated
      const lastUpdated = this.database?.metadata?.lastUpdated;
      if (lastUpdated) {
        const date = new Date(lastUpdated);
        set('#lastUpdated', date.toLocaleDateString());
      } else {
        set('#lastUpdated', 'Never');
      }
      
      // Show alerts if needed
      this.updateDashboardAlerts();
    }

    updateDashboardAlerts() {
      const alertContainer = this.q('#dashboardAlert');
      if (!alertContainer) return;
      
      const unsavedCount = this.newOrModifiedIds.size;
      const needValidation = this.newOrModifiedIds.size - Array.from(this.newOrModifiedIds).filter(id => this.validatedIds.has(id)).length;
      
      let alerts = [];
      
      if (unsavedCount > 0) {
        alerts.push(`<div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <strong>Warning:</strong> You have ${unsavedCount} unsaved resource(s). Remember to save your changes to the database.
        </div>`);
      }
      
      if (needValidation > 0) {
        alerts.push(`<div class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
          <strong>Info:</strong> ${needValidation} resource(s) need validation before saving.
        </div>`);
      }
      
      if (alerts.length > 0) {
        alertContainer.innerHTML = alerts.join('');
        alertContainer.classList.remove('hidden');
      } else {
        alertContainer.classList.add('hidden');
      }
    }

    updateCounts(){
      // Keep for backward compatibility, but now just calls updateDashboard
      this.updateDashboard();
    }

    ensureMetadataCollections(){
      this.database = this.database || {};
      this.database.metadata = this.database.metadata || {};
      if (!Array.isArray(this.database.metadata.versionHistory)) this.database.metadata.versionHistory = [];
      if (!Array.isArray(this.database.metadata.auditLog)) this.database.metadata.auditLog = [];
    }

    getSavedBy(){
      const fromInput = String(this.q('#savedByInput')?.value || '').trim();
      return fromInput || localStorage.getItem('aphlAdminSavedBy') || 'unknown-admin';
    }

    renderVersionHistory(){
      this.ensureMetadataCollections();
      const list = this.q('#versionHistoryList');
      if (!list) return;

      const history = [...this.database.metadata.versionHistory].sort((a,b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
      if (history.length === 0) {
        list.innerHTML = '<div class="text-xs text-gray-500">No versions saved yet.</div>';
      } else {
        list.innerHTML = history.map((v) => {
          const summary = v.summary || {};
          const val = v.validationStats || {};
          const savedAt = v.savedAt ? new Date(v.savedAt).toLocaleString() : 'Unknown';
          return `
            <div class="border rounded p-2 bg-gray-50">
              <div class="font-semibold text-xs">${escapeHtml(v.versionId || 'unknown-version')}</div>
              <div class="text-[11px] text-gray-600">${escapeHtml(savedAt)} • ${escapeHtml(v.savedBy || 'unknown-admin')}</div>
              <div class="text-[11px] mt-1">Δ +${summary.added||0} / ~${summary.updated||0} / -${summary.deleted||0}</div>
              <div class="text-[11px]">Validation: ${val.validatedCount||0} validated, ${val.pendingCount||0} pending</div>
              <button class="mt-2 px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700" data-rollback="${escapeHtml(v.versionId || '')}">
                Rollback to this version
              </button>
            </div>
          `;
        }).join('');
      }

      list.querySelectorAll('[data-rollback]').forEach((btn) => {
        btn.addEventListener('click', () => this.rollbackToVersion(btn.getAttribute('data-rollback')));
      });
      this.populateCompareSelectors();
    }

    populateCompareSelectors(){
      const a = this.q('#compareVersionA');
      const b = this.q('#compareVersionB');
      if (!a || !b) return;

      this.ensureMetadataCollections();
      const versions = [...this.database.metadata.versionHistory].sort((x,y) => (y.savedAt || '').localeCompare(x.savedAt || ''));
      const options = versions.map((v) => `<option value="${escapeHtml(v.versionId || '')}">${escapeHtml(v.versionId || '')} — ${escapeHtml(v.savedAt || '')}</option>`).join('');

      a.innerHTML = `<option value="">Select older version</option>${options}`;
      b.innerHTML = `<option value="">Select newer version</option>${options}`;
      if (versions.length >= 2) {
        a.value = versions[1].versionId;
        b.value = versions[0].versionId;
      }
    }

    compareVersions(){
      const output = this.q('#versionCompareResult');
      const versionA = this.q('#compareVersionA')?.value;
      const versionB = this.q('#compareVersionB')?.value;
      if (!output) return;
      if (!versionA || !versionB) {
        output.textContent = 'Select two versions to compare.';
        return;
      }

      const history = this.database?.metadata?.versionHistory || [];
      const a = history.find((item) => item.versionId === versionA);
      const b = history.find((item) => item.versionId === versionB);
      if (!a || !b) {
        output.textContent = 'Selected versions were not found in history.';
        return;
      }

      const summaryA = a.summary || {};
      const summaryB = b.summary || {};
      const validationA = a.validationStats || {};
      const validationB = b.validationStats || {};
      output.textContent = [
        `Comparing ${a.versionId} -> ${b.versionId}`,
        `Saved by: ${a.savedBy || 'unknown'} -> ${b.savedBy || 'unknown'}`,
        `Saved at: ${a.savedAt || 'unknown'} -> ${b.savedAt || 'unknown'}`,
        `Resources total: ${(a.totalResources ?? 0)} -> ${(b.totalResources ?? 0)} (Δ ${(b.totalResources ?? 0) - (a.totalResources ?? 0)})`,
        `Summary added: ${(summaryA.added ?? 0)} -> ${(summaryB.added ?? 0)}`,
        `Summary updated: ${(summaryA.updated ?? 0)} -> ${(summaryB.updated ?? 0)}`,
        `Summary deleted: ${(summaryA.deleted ?? 0)} -> ${(summaryB.deleted ?? 0)}`,
        `Validated count: ${(validationA.validatedCount ?? 0)} -> ${(validationB.validatedCount ?? 0)}`,
        `Pending validation: ${(validationA.pendingCount ?? 0)} -> ${(validationB.pendingCount ?? 0)}`
      ].join('\n');
    }

    rollbackToVersion(versionId){
      this.ensureMetadataCollections();
      const version = (this.database.metadata.versionHistory || []).find((entry) => entry.versionId === versionId);
      if (!version) return alert('Version not found.');
      const savedBy = this.getSavedBy();
      const confirmed = confirm(`Rollback to ${versionId}? This will replace the in-memory admin dataset. Save again to persist to file.`);
      if (!confirmed) return;

      const snapshot = version.snapshot || {};
      const snapshotResources = Array.isArray(snapshot.resources) ? deepClone(snapshot.resources) : [];
      const snapshotValidated = Array.isArray(snapshot.validatedResources) ? snapshot.validatedResources : [];
      this.data = deepClone(snapshotResources);
      this.original = deepClone(snapshotResources);
      this.validatedIds = new Set(snapshotValidated);
      this.lastValidationTime = snapshot.lastValidated || null;
      this.newOrModifiedIds.clear();
      this.dirty = true;

      this.database.metadata.auditLog.push({
        action: 'rollback',
        fromVersionId: this.database?.metadata?.currentVersionId || null,
        toVersionId: versionId,
        rolledBackAt: new Date().toISOString(),
        rolledBackBy: savedBy
      });

      this.database.metadata.currentVersionId = versionId;
      this.database.resources = deepClone(snapshotResources);
      this.renderList();
      this.updateDashboard();
      this.renderVersionHistory();
      this.enableValidationIfAny();
      alert(`Rolled back to ${versionId}. Click "Save to Database" to persist rollback.`);
    }
    enableValidationIfAny(){
      const btn=this.q('#validateBtn'); if(!btn) return;
      if (this.newOrModifiedIds.size > 0){ 
        btn.disabled=false; 
        btn.classList.remove('bg-gray-400','cursor-not-allowed'); 
        btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      } else {
        btn.disabled=true; 
        btn.classList.add('bg-gray-400','cursor-not-allowed');
        btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      }
    }
    filterList(term){
      const t=(term||'').toLowerCase();
      this.q('#resourceList')?.querySelectorAll('[data-hay]').forEach(node => node.style.display = node.getAttribute('data-hay').includes(t) ? '' : 'none');
    }

    importFile(ev, kind){
      const f = ev.target.files?.[0]; ev.target.value=''; if(!f) return;
      f.text().then(text => {
        let inc=[];
        if (kind==='tsv') inc = parseTSV(text);
        else if (kind==='js') {
          try {
            inc = parseJS(text);
          } catch (error) {
            console.log('parseJS failed, trying fallback method:', error.message);
            // Fallback: try to execute the script in a safe context
            try {
              const script = new Function(text + '; return resourcesData;');
              const result = script();
              if (Array.isArray(result)) {
                inc = result.map(normalize);
              } else {
                throw new Error('Script did not return an array');
              }
            } catch (fallbackError) {
              console.error('Fallback parsing also failed:', fallbackError);
              throw new Error('Could not parse JS file: ' + error.message + ' (Fallback: ' + fallbackError.message + ')');
            }
          }
        } else if (kind==='json') {
          inc = parseJSON(text);
        }

        const validationSource = kind === 'tsv' ? 'TSV import' : kind === 'json' ? 'JSON import' : 'JS import';
        const validation = validateResourceSet(inc, validationSource);
        if (validation.critical.length > 0) {
          const message = [
            `Import rejected: ${validation.critical.length} critical validation error(s).`,
            '',
            ...validation.critical.slice(0, 12).map(formatValidationMessage),
            validation.critical.length > 12 ? `...and ${validation.critical.length - 12} more.` : ''
          ].filter(Boolean).join('\n');
          return alert(message);
        }
        if (validation.warnings.length > 0) {
          const proceed = confirm([
            `Import has ${validation.warnings.length} warning(s).`,
            'Continue import?',
            '',
            ...validation.warnings.slice(0, 8).map(formatValidationMessage),
            validation.warnings.length > 8 ? `...and ${validation.warnings.length - 8} more.` : ''
          ].join('\n'));
          if (!proceed) return;
        }
        
        // Merge per import mode
        const mode = (document.querySelector('input[name="importMode"]:checked')?.value) || 'append';
        const overwrite = !!document.getElementById('overwriteDuplicates')?.checked;
        let importedNewCount = 0;
        let skippedDuplicateCount = 0;
        let overwrittenCount = 0;

        if (mode==='replace'){
          this.data = inc;
          // In replace mode, all resources are considered new
          this.newOrModifiedIds = new Set(inc.map(r => r.id));
          importedNewCount = inc.length;
        }else{
          const map = new Map(this.data.map(r=>[r.id, r]));
          inc.forEach(r => {
            if (!map.has(r.id)) {
              map.set(r.id, r);
              importedNewCount += 1;
              this.newOrModifiedIds.add(r.id); // Track as new/modified
              return;
            }

            if (overwrite) {
              map.set(r.id, r);
              overwrittenCount += 1;
              this.newOrModifiedIds.add(r.id); // Track as new/modified
            } else {
              skippedDuplicateCount += 1;
            }
          });
          this.data = Array.from(map.values());
        }
        this.dirty = true;
        this.renderList();
        this.updateDashboard();
        this.enableValidationIfAny();

        const duplicateTone = skippedDuplicateCount > 0 ? 'warning' : 'success';
        if (mode === 'replace') {
          this.showToast(`Import complete (replace mode): ${importedNewCount} loaded.`, 'info');
        } else {
          this.showToast(
            `Import complete: ${importedNewCount} new, ${skippedDuplicateCount} skipped duplicates, ${overwrittenCount} overwritten.`,
            duplicateTone
          );
        }

        // Auto validate only newly imported resources
        this.validateNewResources();
      }).catch(err => alert('Import failed: ' + err.message));
    }

    readForm(){
      const list = name => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb=>cb.value);
      return {
        id: document.getElementById('resourceId')?.value.trim(),
        title: document.getElementById('title')?.value.trim(),
        organization: document.getElementById('organization')?.value.trim(),
        description: document.getElementById('description')?.value.trim(),
        url: document.getElementById('url')?.value.trim() || '#',
        audiences: list('audiences'),
        stages: list('stages'),
        types: list('types'),
        geography: list('geography'),
        topics: list('topics'),
        pathogenFocus: list('pathogenFocus'),
        language: list('language').length ? list('language') : ['en'],
        lastUpdated: document.getElementById('resourceLastUpdated')?.value || '',
        formatDetails: document.getElementById('formatDetails')?.value.trim() || '',
        keyFeatures: (document.getElementById('keyFeatures')?.value||'').split('\n').map(s=>s.trim()).filter(Boolean),
        practicalUse: document.getElementById('practicalUse')?.value.trim(),
        relatedResources: (document.getElementById('relatedResources')?.value||'').split(/[;,]/).map(s=>s.trim()).filter(Boolean),
        legacyTags: (document.getElementById('legacyTags')?.value||'').split(/[;\n]/).map(s=>s.trim()).filter(Boolean)
      };
    }
    validateForm(d){
      const result = validateResourceRecord(d, { source: 'Admin form row/index 1' });
      if (result.critical.length > 0) {
        alert([
          `Save blocked: ${result.critical.length} critical validation error(s).`,
          '',
          ...result.critical.map(formatValidationMessage)
        ].join('\n'));
        return false;
      }
      if (result.warnings.length > 0) {
        const proceed = confirm([
          `This record has ${result.warnings.length} warning(s). Save anyway?`,
          '',
          ...result.warnings.map(formatValidationMessage)
        ].join('\n'));
        if (!proceed) return false;
      }
      return true;
    }
    saveFromForm(){
      const d = this.readForm(); if(!this.validateForm(d)) return;
      const overwrite = !!document.getElementById('overwriteDuplicates')?.checked;
      const idx = this.data.findIndex(x=>x.id===d.id);
      if (idx>=0){ 
        if(!overwrite && !this.editing) return alert('ID exists (enable Overwrite or change ID)'); 
        this.data[idx]=d; 
        this.newOrModifiedIds.add(d.id); // Track as modified
      }
      else {
        this.data.push(d);
        this.newOrModifiedIds.add(d.id); // Track as new
      }
      this.dirty = true; this.editing=false;
      this.renderList(); this.clearForm(); this.updateDashboard(); this.enableValidationIfAny(); 
      // Validate only the resource that was just saved
      this.validateNewResources();
    }
    clearForm(){
      document.getElementById('resourceForm')?.reset();
      document.querySelectorAll('#resourceForm input[type="checkbox"]').forEach(cb => cb.checked = false);
      this.editing=false;
    }
    edit(id){
      const r=this.data.find(x=>x.id===id); if(!r) return;
      this.editing=true;
      document.getElementById('resourceId').value=r.id;
      document.getElementById('title').value=r.title;
      document.getElementById('organization').value=r.organization;
      document.getElementById('description').value=r.description;
      document.getElementById('url').value=(r.url==='#'?'':r.url);
      const set=(name,arr)=> document.querySelectorAll(`input[name="${name}"]`).forEach(cb=> cb.checked = (arr||[]).includes(cb.value));
      set('audiences',r.audiences); set('stages',r.stages); set('types',r.types); set('geography',r.geography); set('topics',r.topics); set('pathogenFocus',r.pathogenFocus); set('language',r.language || ['en']);
      document.getElementById('resourceLastUpdated').value=(r.lastUpdated||'').slice(0,10);
      document.getElementById('formatDetails').value=r.formatDetails||'';
      document.getElementById('keyFeatures').value=(r.keyFeatures||[]).join('\n');
      document.getElementById('practicalUse').value=r.practicalUse||'';
      document.getElementById('relatedResources').value=(r.relatedResources||[]).join(', ');
      document.getElementById('legacyTags').value=(r.legacyTags||[]).join('\n');
      window.scrollTo({top:0,behavior:'smooth'});
    }
    remove(id){
      if(!confirm('Delete this resource?')) return;
      this.data = this.data.filter(r=>r.id!==id);
      this.newOrModifiedIds.delete(id); // Remove from tracking
      this.validatedIds.delete(id); // Remove from validation tracking
      this.dirty = true; this.renderList(); this.updateDashboard(); this.enableValidationIfAny(); 
      // No need to validate after deletion
    }

    async analyzeWithGpt(){
      const url = String(this.q('#aiUrl')?.value || this.q('#url')?.value || '').trim();
      const context = String(this.q('#aiContext')?.value || this.q('#description')?.value || '').trim();
      const status = this.q('#aiStatus');
      const panel = this.q('#aiReviewPanel');
      const preview = this.q('#aiSuggestionPreview');
      if (!url && !context) return alert('Provide a URL or pasted context before running AI intake.');
      if (!this.openAiApiKey) {
        if (status) status.textContent = 'Enter an OpenAI API key for this session before running AI intake.';
        this.updateOpenAiKeyStatus('Enter an OpenAI API key for this session before running AI intake.');
        return;
      }

      if (status) status.textContent = 'Analyzing with GPT...';
      if (panel) panel.classList.add('hidden');

      try {
        const result = await this.requestGptCategorization({
          url,
          text: context,
          existingResource: this.readForm()
        });
        this.aiSuggestion = result.resource || result;
        if (preview) preview.textContent = JSON.stringify(this.aiSuggestion, null, 2);
        if (panel) panel.classList.remove('hidden');
        if (status) status.textContent = result.needsReview ? 'Suggestion returned; manual review recommended.' : 'Suggestion returned.';
      } catch (error) {
        if (status) status.textContent = `AI intake unavailable: ${error.message}`;
      }
    }

    async requestGptCategorization(payload) {
      if (!this.openAiApiKey) {
        throw new Error('Enter an OpenAI API key for this session before running AI intake.');
      }
      let token = '';
      if (window.firebase?.auth?.().currentUser) {
        token = await window.firebase.auth().currentUser.getIdToken();
      }

      const response = await fetch('/api/categorize-resource', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenAI-API-Key': this.openAiApiKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Request failed with status ${response.status}`);
      return result;
    }

    async analyzeUrlBatch(){
      const raw = String(this.q('#batchUrls')?.value || '');
      const urls = [...new Set(raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
      const btn = this.q('#batchAnalyzeBtn');
      const bar = this.q('#batchProgressBar');
      const text = this.q('#batchProgressText');
      const resultsEl = this.q('#batchResults');

      if (urls.length === 0) return alert('Paste at least one URL, one per line.');
      if (!this.openAiApiKey) {
        this.updateOpenAiKeyStatus('Enter an OpenAI API key for this session before running batch intake.');
        if (text) text.textContent = 'OpenAI key required before batch intake can start.';
        return;
      }
      if (btn) btn.disabled = true;
      if (resultsEl) resultsEl.innerHTML = '';
      this.batchSuggestions = [];

      const renderProgress = (done, total, label) => {
        const pct = total ? Math.round((done / total) * 100) : 0;
        if (bar) bar.style.width = `${pct}%`;
        if (text) text.textContent = `${done}/${total} complete (${pct}%)${label ? ' - ' + label : ''}`;
      };

      renderProgress(0, urls.length, 'Starting');

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        renderProgress(i, urls.length, `Analyzing ${url}`);
        const row = document.createElement('div');
        row.className = 'border rounded bg-white p-3 text-sm';
        row.innerHTML = `<div class="font-medium text-gray-800 break-all">${escapeHtml(url)}</div><div class="text-xs text-gray-500 mt-1">Analyzing...</div>`;
        if (resultsEl) resultsEl.appendChild(row);

        try {
          const result = await this.requestGptCategorization({ url, text: '', existingResource: null });
          const resource = result.resource || result;
          this.batchSuggestions.push(resource);
          const idx = this.batchSuggestions.length - 1;
          row.innerHTML = `
            <div class="flex justify-between items-start gap-3">
              <div class="min-w-0">
                <div class="font-medium text-gray-800">${escapeHtml(resource.title || url)}</div>
                <div class="text-xs text-gray-500 break-all">${escapeHtml(resource.organization || '')}</div>
                <div class="text-xs ${result.needsReview ? 'text-yellow-700' : 'text-green-700'} mt-1">${result.needsReview ? 'Needs review' : 'Ready for curator review'}</div>
              </div>
              <button type="button" class="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 text-xs" data-apply-batch="${idx}">Apply</button>
            </div>
          `;
          row.querySelector('[data-apply-batch]')?.addEventListener('click', () => {
            this.aiSuggestion = this.batchSuggestions[idx];
            const preview = this.q('#aiSuggestionPreview');
            const panel = this.q('#aiReviewPanel');
            if (preview) preview.textContent = JSON.stringify(this.aiSuggestion, null, 2);
            if (panel) panel.classList.remove('hidden');
            this.applyAiSuggestion();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
        } catch (error) {
          row.innerHTML = `
            <div class="font-medium text-gray-800 break-all">${escapeHtml(url)}</div>
            <div class="text-xs text-red-700 mt-1">Failed: ${escapeHtml(error.message)}</div>
          `;
        }
        renderProgress(i + 1, urls.length, i + 1 === urls.length ? 'Done' : 'Continuing');
      }

      if (btn) btn.disabled = false;
    }

    applyAiSuggestion(){
      const r = this.aiSuggestion;
      if (!r) return;
      const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el && value !== undefined && value !== null) el.value = Array.isArray(value) ? value.join('\n') : value;
      };
      const setChecks = (name, arr) => {
        const values = new Set(Array.isArray(arr) ? arr : []);
        document.querySelectorAll(`input[name="${name}"]`).forEach(cb => { cb.checked = values.has(cb.value); });
      };

      setValue('resourceId', r.id || r.suggestedId);
      setValue('title', r.title);
      setValue('organization', r.organization);
      setValue('url', r.url);
      setValue('description', r.description);
      setChecks('audiences', r.audiences);
      setChecks('stages', r.stages);
      setChecks('types', r.types);
      setChecks('geography', r.geography);
      setChecks('topics', r.topics);
      setChecks('pathogenFocus', r.pathogenFocus);
      setChecks('language', r.language || ['en']);
      setValue('resourceLastUpdated', (r.lastUpdated || '').slice(0, 10));
      setValue('formatDetails', r.formatDetails);
      setValue('keyFeatures', r.keyFeatures);
      setValue('practicalUse', r.practicalUse);
      setValue('relatedResources', Array.isArray(r.relatedResources) ? r.relatedResources.join(', ') : r.relatedResources);
      setValue('legacyTags', r.sourceNotes ? ['AI source notes:', r.sourceNotes].flat().join('\n') : undefined);
    }

    async validateNewResources(){
      // Only validate resources that are new or modified
      const resourcesToValidate = this.data.filter(r => this.newOrModifiedIds.has(r.id));
      if (resourcesToValidate.length === 0) {
        const s = this.q('#validationStatus');
        if (s) s.innerHTML = `ℹ️ No new resources to validate.`;
        return;
      }
      
      try{
        if (typeof ResourceValidator === 'function'){
          const v = new ResourceValidator();
          await v.validateAllResources(resourcesToValidate);
          const res = Array.isArray(v.validationResults) ? v.validationResults : [];
          const errs = res.filter(r => r.issues && r.issues.length > 0).length;
          const warns= res.filter(r => r.warnings && r.warnings.length > 0).length;
          
          // Mark resources as validated
          resourcesToValidate.forEach(resource => {
            this.validatedIds.add(resource.id);
          });
          this.lastValidationTime = new Date().toISOString();
          
          const s = this.q('#validationStatus');
          if (s) s.innerHTML = errs===0 ? `✅ Validation passed — ${resourcesToValidate.length} new/modified resources.` : `⚠️ ${errs} issue(s), ${warns} warning(s) in new/modified resources.`;
          
          // Update dashboard to reflect validation status
          this.updateDashboard();
          
          // Show the validation results modal (this will make the filter buttons work)
          if (res.length > 0) {
            v.displayValidationResults();
          }
          
          // Only download report if there are issues
          if (errs > 0 || warns > 0) {
            downloadText('validation-report-new.json', JSON.stringify({
              generatedAt:new Date().toISOString(),
              summary: { totalResources:resourcesToValidate.length, resourcesWithIssues:errs, resourcesWithWarnings:warns, averageScore: (typeof v.averageScore==='number')?v.averageScore:null },
              results: res,
              note: "This report only includes newly imported or modified resources"
            }, null, 2));
          }
        } else {
          const s = this.q('#validationStatus'); if (s) s.innerHTML = `ℹ️ No validator found; ${resourcesToValidate.length} new/modified resources loaded.`;
        }
      }catch(e){
        console.error(e); alert('Validation error: '+e.message);
      }
    }

    async validateAll(){
      try{
        if (typeof ResourceValidator === 'function'){
          const v = new ResourceValidator();
          await v.validateAllResources(this.data);
          const res = Array.isArray(v.validationResults) ? v.validationResults : [];
          const errs = res.filter(r => r.issues && r.issues.length > 0).length;
          const warns= res.filter(r => r.warnings && r.warnings.length > 0).length;
          
          // Mark ALL resources as validated since we just validated them all
          this.data.forEach(resource => {
            this.validatedIds.add(resource.id);
          });
          this.lastValidationTime = new Date().toISOString();
          
          const s = this.q('#validationStatus');
          if (s) s.innerHTML = errs===0 ? `✅ Full validation passed — ${this.data.length} resources.` : `⚠️ ${errs} issue(s), ${warns} warning(s) in full database.`;
          
          // Update dashboard to reflect validation status
          this.updateDashboard();
          
          // Show the validation results modal (this will make the filter buttons work)
          if (res.length > 0) {
            v.displayValidationResults();
          }
          
          downloadText('validation-report-full.json', JSON.stringify({
            generatedAt:new Date().toISOString(),
            summary: { totalResources:this.data.length, resourcesWithIssues:errs, resourcesWithWarnings:warns, averageScore: (typeof v.averageScore==='number')?v.averageScore:null },
            results: res,
            note: "This report includes ALL resources in the database"
          }, null, 2));
        } else {
          // No validator present; still produce a minimal report
          const s = this.q('#validationStatus'); if (s) s.innerHTML = `ℹ️ No validator found; ${this.data.length} resources loaded.`;
        }
      }catch(e){
        console.error(e); alert('Validation error: '+e.message);
      }
    }

    async saveDatabase(){
      const mode = (document.querySelector('input[name="importMode"]:checked')?.value) || 'append';
      let final = [];
      if (mode==='replace'){ final = this.data; }
      else {
        const map = new Map(this.original.map(r=>[r.id,r]));
        this.data.forEach(r=> map.set(r.id,r));
        final = Array.from(map.values());
      }

      const gate = validateResourceSet(final, 'Pre-publish/save gate');
      if (gate.critical.length > 0) {
        alert([
          `Save blocked: ${gate.critical.length} critical validation error(s) found in pre-publish/save gate.`,
          '',
          ...gate.critical.slice(0, 20).map(formatValidationMessage),
          gate.critical.length > 20 ? `...and ${gate.critical.length - 20} more.` : ''
        ].filter(Boolean).join('\n'));
        return;
      }
      if (gate.warnings.length > 0) {
        const proceed = confirm([
          `Pre-publish/save gate found ${gate.warnings.length} warning(s).`,
          'Do you want to continue saving?',
          '',
          ...gate.warnings.slice(0, 12).map(formatValidationMessage),
          gate.warnings.length > 12 ? `...and ${gate.warnings.length - 12} more.` : ''
        ].filter(Boolean).join('\n'));
        if (!proceed) return;
      }
      
      const nowIso = new Date().toISOString();
      const savedBy = this.getSavedBy();
      const summary = computeResourceSummary(this.original, final);
      const validationStats = {
        validatedCount: this.data.filter(r => this.validatedIds.has(r.id)).length,
        pendingCount: Math.max(0, final.length - this.data.filter(r => this.validatedIds.has(r.id)).length),
        lastValidated: this.lastValidationTime,
        validatedResourceIds: Array.from(this.validatedIds)
      };
      const versionId = `v-${nowIso.replace(/[:.]/g, '-')}`;
      const versionRecord = {
        versionId,
        savedBy,
        savedAt: nowIso,
        totalResources: final.length,
        summary,
        validationStats,
        snapshot: {
          resources: deepClone(final),
          validatedResources: Array.from(this.validatedIds),
          lastValidated: this.lastValidationTime
        }
      };

      const existingHistory = Array.isArray(this.database?.metadata?.versionHistory) ? deepClone(this.database.metadata.versionHistory) : [];
      const existingAudit = Array.isArray(this.database?.metadata?.auditLog) ? deepClone(this.database.metadata.auditLog) : [];
      existingHistory.push(versionRecord);
      existingAudit.push({
        action: 'save',
        versionId,
        savedBy,
        savedAt: nowIso,
        summary
      });

      const updatedDatabase = this.buildCurrentDatabaseSnapshot(final, {
        versionId,
        lastUpdated: nowIso,
        versionHistory: existingHistory,
        auditLog: existingAudit
      });
      
      const backupName = `resources-data-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.js`;
      const backupText = toJS(this.original);
      const newText = `// Auto-generated resources database with metadata
const resourcesDatabase = ${JSON.stringify(updatedDatabase, null, 2)};

// Backward compatibility - expose resourcesData for existing code
const resourcesData = resourcesDatabase.resources;

// Make both available globally for the admin panel
if (typeof window !== 'undefined') {
  window.resourcesDatabase = resourcesDatabase;
  window.resourcesData = resourcesData;
}`;
      
      if ('showDirectoryPicker' in window){
        const dir = await window.showDirectoryPicker({id:'site-root', mode:'readwrite'});
        const write = async (name,content)=>{ const h=await dir.getFileHandle(name,{create:true}); const w=await h.createWritable(); await w.write(content); await w.close(); };
        await write(backupName, backupText);
        await write('resources-data.js', newText);
      } else {
        downloadText(backupName, backupText);
        downloadText('resources-data.js', newText);
      }
      
      this.database = updatedDatabase;
      this.original = JSON.parse(JSON.stringify(final));
      this.data = JSON.parse(JSON.stringify(final));
      this.dirty = false; 
      this.newOrModifiedIds.clear(); // Clear tracking since everything is now saved
      this.updateDashboard();
      this.renderVersionHistory();
      this.enableValidationIfAny(); // Update button state
      alert(`Database saved as ${versionId} with immutable version history and validation stats.`);
    }

    buildCurrentDatabaseSnapshot(resourcesOverride, options = {}){
      const resources = Array.isArray(resourcesOverride) ? resourcesOverride : this.data;
      const metadata = this.database?.metadata || {};
      const versionHistory = Array.isArray(options.versionHistory) ? options.versionHistory : (Array.isArray(metadata.versionHistory) ? deepClone(metadata.versionHistory) : []);
      const auditLog = Array.isArray(options.auditLog) ? options.auditLog : (Array.isArray(metadata.auditLog) ? deepClone(metadata.auditLog) : []);

      return {
        metadata: {
          version: "1.8.1",
          currentVersionId: options.versionId || metadata.currentVersionId || null,
          lastUpdated: options.lastUpdated || new Date().toISOString(),
          totalResources: resources.length,
          lastValidated: this.lastValidationTime,
          validatedResources: Array.from(this.validatedIds),
          generatedBy: "APHL Admin Panel v1.8",
          versionHistory,
          auditLog
        },
        resources: deepClone(resources)
      };
    }
  }

  document.addEventListener('DOMContentLoaded', ()=> new AdminApp());
})();
