// Canonical APHL-GSEI resource taxonomy shared by admin, public UI, and scripts.
(function (root) {
  'use strict';

  const TAXONOMY = {
    audiences: {
      label: 'Audiences',
      maxRecommended: 5,
      options: [
        { id: 'laboratorians', label: 'Laboratorians' },
        { id: 'lab-leadership', label: 'Lab Leadership / Managers' },
        { id: 'bioinformaticians', label: 'Bioinformaticians' },
        { id: 'epidemiologists', label: 'Epidemiologists' },
        { id: 'public-health-officials', label: 'Public Health Officials' },
        { id: 'policymakers', label: 'Policymakers' },
        { id: 'health-ministry-officials', label: 'Health Ministry Officials' },
        { id: 'donors-funders', label: 'Donors & Funders' },
        { id: 'trainers-educators', label: 'Trainers & Educators' },
        { id: 'one-health-partners', label: 'One Health Partners' },
        { id: 'environmental-health-teams', label: 'Environmental Health Teams' },
        { id: 'regional-international-orgs', label: 'Regional / International Organizations' }
      ]
    },
    stages: {
      label: 'Stages',
      maxRecommended: 4,
      options: [
        { id: 'readiness-assessment', label: 'Readiness Assessment' },
        { id: 'planning-strategy', label: 'Planning & Strategy' },
        { id: 'implementation', label: 'Implementation' },
        { id: 'operations-scaleup', label: 'Operations & Scale-up' },
        { id: 'optimization-sustainability', label: 'Optimization & Sustainability' },
        { id: 'evaluation-learning', label: 'Evaluation & Learning' }
      ]
    },
    types: {
      label: 'Resource Type',
      maxRecommended: 3,
      options: [
        { id: 'framework-strategy', label: 'Framework / Strategy' },
        { id: 'guide-manual', label: 'Guide / Manual' },
        { id: 'interactive-tool', label: 'Interactive Tool' },
        { id: 'spreadsheet-tool', label: 'Spreadsheet / Static Tool' },
        { id: 'training-material', label: 'Training Material' },
        { id: 'policy-document', label: 'Policy Document' },
        { id: 'research-evidence', label: 'Research / Evidence Review' },
        { id: 'case-study', label: 'Case Study' },
        { id: 'template-checklist', label: 'Template / Checklist' },
        { id: 'data-dashboard', label: 'Data Resource / Dashboard' }
      ]
    },
    geography: {
      label: 'Geography',
      maxRecommended: 5,
      groups: [
        { label: 'Global / Cross-cutting', options: [
          { id: 'global', label: 'Global' },
          { id: 'lmic', label: 'LMICs (cross-cutting)' },
          { id: 'high-income', label: 'High-income Countries' }
        ] },
        { label: 'Africa', options: [
          { id: 'africa', label: 'Africa (general)' },
          { id: 'east-africa', label: 'East Africa' },
          { id: 'west-africa', label: 'West Africa' },
          { id: 'southern-africa', label: 'Southern Africa' },
          { id: 'north-africa', label: 'North Africa' }
        ] },
        { label: 'Asia', options: [
          { id: 'asia', label: 'Asia (general)' },
          { id: 'southeast-asia', label: 'Southeast Asia' },
          { id: 'south-asia', label: 'South Asia' },
          { id: 'east-asia', label: 'East Asia' },
          { id: 'central-asia', label: 'Central Asia' }
        ] },
        { label: 'Americas', options: [
          { id: 'americas', label: 'Americas (general)' },
          { id: 'north-america', label: 'North America' },
          { id: 'latin-america-caribbean', label: 'Latin America & Caribbean' }
        ] },
        { label: 'Other Regions', options: [
          { id: 'europe', label: 'Europe' },
          { id: 'mena', label: 'Middle East & North Africa (MENA)' },
          { id: 'oceania-pacific', label: 'Oceania & Pacific' }
        ] }
      ]
    },
    topics: {
      label: 'Topics',
      maxRecommended: 8,
      groups: [
        { label: 'Surveillance & Epidemiology', options: [
          { id: 'genomic-surveillance', label: 'Genomic Surveillance' },
          { id: 'amr-surveillance', label: 'AMR Surveillance' },
          { id: 'environmental-surveillance', label: 'Environmental / Wastewater Surveillance' },
          { id: 'one-health', label: 'One Health' },
          { id: 'outbreak-detection', label: 'Outbreak Detection' },
          { id: 'variant-monitoring', label: 'Variant Monitoring' }
        ] },
        { label: 'Laboratory Systems', options: [
          { id: 'lab-networking', label: 'Laboratory Networking' },
          { id: 'quality-management', label: 'Quality Management (QMS)' },
          { id: 'accreditation', label: 'Accreditation' },
          { id: 'biosafety', label: 'Biosafety & Biosecurity' },
          { id: 'diagnostics-integration', label: 'Diagnostics Integration' }
        ] },
        { label: 'Bioinformatics & Data', options: [
          { id: 'pipelines-workflows', label: 'Pipelines & Workflows' },
          { id: 'data-sharing-interoperability', label: 'Data Sharing & Interoperability' },
          { id: 'phylogenetics', label: 'Phylogenetics' },
          { id: 'visualization', label: 'Visualization' },
          { id: 'sequencing-platforms', label: 'Sequencing Platforms' }
        ] },
        { label: 'Governance & Policy', options: [
          { id: 'data-governance', label: 'Data Governance' },
          { id: 'ethics-legal', label: 'Ethics & Legal Frameworks' },
          { id: 'privacy-benefit-sharing', label: 'Privacy & Benefit Sharing' },
          { id: 'investment-cases', label: 'Investment Cases' },
          { id: 'regulatory-frameworks', label: 'Regulatory Frameworks' }
        ] },
        { label: 'Program Management', options: [
          { id: 'costing-financing', label: 'Costing & Financing' },
          { id: 'sustainability', label: 'Sustainability' },
          { id: 'monitoring-evaluation', label: 'Monitoring & Evaluation' },
          { id: 'stakeholder-engagement', label: 'Stakeholder Engagement' },
          { id: 'resource-mobilization', label: 'Resource Mobilization' }
        ] },
        { label: 'Capacity Building', options: [
          { id: 'workforce-training', label: 'Workforce Training' },
          { id: 'technology-transfer', label: 'Technology Transfer' },
          { id: 'regional-networks', label: 'Regional Networks' },
          { id: 'curriculum-development', label: 'Curriculum Development' }
        ] }
      ]
    },
    pathogenFocus: {
      label: 'Pathogen Focus',
      maxRecommended: 4,
      options: [
        { id: 'respiratory-pathogens', label: 'Respiratory Pathogens' },
        { id: 'amr-bacteria', label: 'AMR Bacteria' },
        { id: 'arboviruses-vectorborne', label: 'Arboviruses & Vector-borne' },
        { id: 'enteric-pathogens', label: 'Enteric Pathogens' },
        { id: 'emerging-pathogens', label: 'Emerging / Unknown Pathogens' },
        { id: 'viral-genomics', label: 'Viral Genomics' },
        { id: 'bacterial-genomics', label: 'Bacterial Genomics' }
      ]
    },
    language: {
      label: 'Language',
      options: [
        { id: 'en', label: 'English' },
        { id: 'fr', label: 'French' },
        { id: 'es', label: 'Spanish' },
        { id: 'pt', label: 'Portuguese' },
        { id: 'th', label: 'Thai' },
        { id: 'vi', label: 'Vietnamese' },
        { id: 'id', label: 'Indonesian' },
        { id: 'bn', label: 'Bangla' },
        { id: 'other', label: 'Other' }
      ]
    }
  };

  const GEOGRAPHY_PARENT_MAP = {
    'east-africa': 'africa',
    'west-africa': 'africa',
    'southern-africa': 'africa',
    'north-africa': 'africa',
    'southeast-asia': 'asia',
    'south-asia': 'asia',
    'east-asia': 'asia',
    'central-asia': 'asia',
    'north-america': 'americas',
    'latin-america-caribbean': 'americas'
  };

  function flattenOptions(field) {
    const def = TAXONOMY[field];
    if (!def) return [];
    if (Array.isArray(def.options)) return def.options.slice();
    return (def.groups || []).flatMap((group) => group.options || []);
  }

  function valuesFor(field) {
    return flattenOptions(field).map((option) => option.id);
  }

  function labelFor(field, id) {
    const option = flattenOptions(field).find((entry) => entry.id === id);
    return option ? option.label : String(id || '').replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function enumFields() {
    return {
      audiences: valuesFor('audiences'),
      stages: valuesFor('stages'),
      types: valuesFor('types'),
      geography: valuesFor('geography'),
      topics: valuesFor('topics'),
      pathogenFocus: valuesFor('pathogenFocus'),
      language: valuesFor('language')
    };
  }

  const api = { TAXONOMY, GEOGRAPHY_PARENT_MAP, flattenOptions, valuesFor, labelFor, enumFields };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.APHL_TAXONOMY = api;
})(typeof window !== 'undefined' ? window : globalThis);
