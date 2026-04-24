
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

  // Converters
  function toTSV(resources){
    const headers = ['id','title','organization','description','url','audiences','stages','types','geography','topics','keyFeatures','practicalUse','relatedResources'];
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
      (r.keyFeatures||[]).join('\\n'),
      r.practicalUse||'',
      (r.relatedResources||[]).join(';')
    ].map(x => String(x)).join('\t'));
    return [head].concat(lines).join('\n');
  }
  function toJS(resources){
    return `// Auto-generated\nconst resourcesData = ${JSON.stringify(resources, null, 2)};`;
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
        keyFeatures: String(get('keyFeatures')||'').replace(/\\r/g,'').split('\\n').filter(Boolean),
        practicalUse: get('practicalUse').trim(),
        relatedResources: splitList(get('relatedResources'))
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

    const start = (dbData) => {
      if (dbData && dbData.resources) {
        // New database format with metadata
        this.database = dbData;
        this.original = JSON.parse(JSON.stringify(dbData.resources));
        this.data = JSON.parse(JSON.stringify(dbData.resources));
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
            generatedBy: "APHL Admin Panel v1.8"
          },
          resources: arr
        };
        this.original = JSON.parse(JSON.stringify(arr));
        this.data = JSON.parse(JSON.stringify(arr));
      }
      this.bind();
      this.renderList();
      this.updateDashboard();
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

    this.on('#exportJsonBtn', 'click', () => downloadText('resources-data.js', toJS(this.data)));
    this.on('#exportTsvBtn', 'click', () => downloadText('genomic-epi-resources.tsv', toTSV(this.data)));

      // Templates: multi-click safe, works on file://
      this.templateDownload('#downloadTsvTemplate','resources-template.tsv', this.tsvFallback());

      this.on('#validateBtn','click', ()=> this.validateNewResources());
      this.on('#validateAllBtn','click', ()=> this.validateAll());
      this.on('#saveDatabaseBtn','click', ()=> this.saveDatabase());

      this.on('#clearForm','click', ()=> this.clearForm());
      this.on('#resourceForm','submit', (e)=>{ e.preventDefault(); this.saveFromForm(); });

      this.on('#searchResources','input', (e)=> this.filterList(e.target.value));

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
    }

    q(sel){ return document.querySelector(sel); }
    on(sel, ev, fn){ const el=this.q(sel); if(el) el.addEventListener(ev, fn); }

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
      'id\ttitle\torganization\tdescription\turl\taudiences\tstages\ttypes\tgeography\ttopics\tkeyFeatures\tpracticalUse\trelatedResources',
      'example-resource-id\tExample Genomic Surveillance Guide\tExample Health Organization\tA comprehensive guide for implementing genomic surveillance systems in public health laboratories with step-by-step protocols and best practices.\thttps://example.org/guide\tlaboratorians;epidemiologists\tplanning;implementation\tguide;training\tglobal;lmic\tsurveillance;implementation;qms\tLaboratory setup protocols\\nQuality management systems\\nWorkflow optimization\\nStaff training materials\tUse this guide to establish genomic surveillance capabilities in your laboratory, train staff, and ensure quality standards\trelated-resource-1;related-resource-2'
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
        }
        
        // Track imported resources for validation
        const importedIds = new Set(inc.map(r => r.id));
        
        // Merge per import mode
        const mode = (document.querySelector('input[name="importMode"]:checked')?.value) || 'append';
        const overwrite = !!document.getElementById('overwriteDuplicates')?.checked;
        if (mode==='replace'){
          this.data = inc;
          // In replace mode, all resources are considered new
          this.newOrModifiedIds = new Set(inc.map(r => r.id));
        }else{
          const map = new Map(this.data.map(r=>[r.id, r]));
          inc.forEach(r => {
            if (!map.has(r.id) || overwrite) {
              map.set(r.id, r);
              this.newOrModifiedIds.add(r.id); // Track as new/modified
            }
          });
          this.data = Array.from(map.values());
        }
        this.dirty = true;
        this.renderList();
        this.updateDashboard();
        this.enableValidationIfAny();
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
        keyFeatures: (document.getElementById('keyFeatures')?.value||'').split('\n').map(s=>s.trim()).filter(Boolean),
        practicalUse: document.getElementById('practicalUse')?.value.trim(),
        relatedResources: (document.getElementById('relatedResources')?.value||'').split(/[;,]/).map(s=>s.trim()).filter(Boolean)
      };
    }
    validateForm(d){
      const req = ['id','title','description','organization'];
      const reqArr = ['audiences','stages','types','geography','topics'];
      for (let k of req){ if(!d[k]) { alert(k+' is required'); return false; } }
      for (let k of reqArr){ if(!Array.isArray(d[k]) || !d[k].length){ alert('At least one '+k+' required'); return false; } }
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
    clearForm(){ document.getElementById('resourceForm')?.reset(); this.editing=false; }
    edit(id){
      const r=this.data.find(x=>x.id===id); if(!r) return;
      this.editing=true;
      document.getElementById('resourceId').value=r.id;
      document.getElementById('title').value=r.title;
      document.getElementById('organization').value=r.organization;
      document.getElementById('description').value=r.description;
      document.getElementById('url').value=(r.url==='#'?'':r.url);
      const set=(name,arr)=> document.querySelectorAll(`input[name="${name}"]`).forEach(cb=> cb.checked = (arr||[]).includes(cb.value));
      set('audiences',r.audiences); set('stages',r.stages); set('types',r.types); set('geography',r.geography); set('topics',r.topics);
      document.getElementById('keyFeatures').value=(r.keyFeatures||[]).join('\n');
      document.getElementById('practicalUse').value=r.practicalUse||'';
      document.getElementById('relatedResources').value=(r.relatedResources||[]).join(', ');
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
      
      // Create updated database with metadata
      const updatedDatabase = {
        metadata: {
          version: "1.8.1",
          lastUpdated: new Date().toISOString(),
          totalResources: final.length,
          lastValidated: this.lastValidationTime,
          validatedResources: Array.from(this.validatedIds),
          generatedBy: "APHL Admin Panel v1.8"
        },
        resources: final
      };
      
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
      this.enableValidationIfAny(); // Update button state
      alert('Database saved with metadata and validation tracking.');
    }
  }

  document.addEventListener('DOMContentLoaded', ()=> new AdminApp());
})();
