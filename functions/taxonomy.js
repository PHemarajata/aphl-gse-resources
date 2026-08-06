// Canonical APHL-GSEI resource taxonomy shared by admin, public UI, and scripts.
//
// v2.0.0 — merged taxonomy.
//   The live vocabulary (v1.x) is preserved verbatim: no ID renamed, no ID
//   removed, no cardinality tightened into a hard cap. Every one of the 79
//   live resources validates against this file unchanged.
//
//   Added from the August 2026 prototype (taxonomy.yaml v0.2.0), which was
//   drafted against 15 sample records without access to the live data and is
//   therefore treated as a source of ideas, not as a replacement vocabulary:
//     - eight secondary facets (difficulty, connectivity, cost, effort,
//       reuseTerms, maintenance, access, endorsement), all optional, all
//       single-select, all carrying an explicit unknown/not-assessed value so
//       existing records remain valid with no edits;
//     - four topics filling genuine gaps in the collection's own subject area;
//     - the draft/verified text gate, scoped to the optional `summary` and
//       `notes` fields only. It deliberately does NOT gate `description`,
//       which is curator-written and populated on all 79 records.
//
//   Deliberately NOT adopted: the prototype's replacement stage axis (NIRN),
//   and its replacement topic/audience/type vocabularies. They share zero IDs
//   with the live data and adopting them would have required retagging roughly
//   70 of 79 records by hand.

(function (root) {
  'use strict';

  const TAXONOMY_VERSION = '2.0.0';

  // Multi-select array fields. These are the legacy contract: every record has
  // all seven, and `enumFields()` returns exactly these for the validators.
  const PRIMARY_FIELDS = [
    'audiences', 'stages', 'types', 'geography', 'topics', 'pathogenFocus', 'language'
  ];

  // Single-select optional scalar fields, new in v2.0.0.
  const SECONDARY_FIELDS = [
    'difficulty', 'connectivity', 'cost', 'effort',
    'reuseTerms', 'maintenance', 'access', 'endorsement'
  ];

  const TAXONOMY = {

    // ==================================================================
    // PRIMARY — unchanged from v1.x
    // ==================================================================

    audiences: {
      label: 'Audiences',
      role: 'primary',
      multiple: true,
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
      role: 'primary',
      multiple: true,
      maxRecommended: 4,
      // Framing borrowed from the prototype; the six live stages are unchanged.
      help: 'Where a programme sits in standing up this capability. Stage describes position, not elapsed time — a programme five years in with unstable reagent supply is still at Implementation, not Optimization.',
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
      role: 'primary',
      multiple: true,
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
      role: 'primary',
      multiple: true,
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
      role: 'primary',
      multiple: true,
      // Tightened from 8 to 5 in v2.0.0. Still a warning, not a hard cap.
      // At 5, only 7 of the 79 live records warn. Revert by setting this to 8.
      maxRecommended: 5,
      help: 'Tag what the resource is substantially about. Tagging defensively makes filtering stop narrowing anything.',
      groups: [
        { label: 'Surveillance & Epidemiology', options: [
          { id: 'genomic-surveillance', label: 'Genomic Surveillance' },
          { id: 'amr-surveillance', label: 'AMR Surveillance' },
          { id: 'environmental-surveillance', label: 'Environmental / Wastewater Surveillance' },
          { id: 'one-health', label: 'One Health' },
          { id: 'outbreak-detection', label: 'Outbreak Detection' },
          { id: 'variant-monitoring', label: 'Variant Monitoring' },
          { id: 'surveillance-design', label: 'Surveillance Design & Sampling', sinceVersion: '2.0.0',
            summary: 'Deciding what to sequence, why, and how specimens reach the laboratory.' },
          { id: 'epi-integration', label: 'Epidemiological Integration', sinceVersion: '2.0.0',
            summary: 'Joining genomic results to case, contact, and surveillance data.' }
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
          { id: 'sequencing-platforms', label: 'Sequencing Platforms' },
          { id: 'metadata-management', label: 'Metadata & Data Management', sinceVersion: '2.0.0',
            summary: 'Capturing complete, structured contextual data and keeping it usable.' }
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
          { id: 'resource-mobilization', label: 'Resource Mobilization' },
          { id: 'reporting', label: 'Reporting & Communication', sinceVersion: '2.0.0',
            summary: 'Turning findings into something a non-specialist can act on.' }
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
      role: 'primary',
      multiple: true,
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
      role: 'primary',
      multiple: true,
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
    },

    // ==================================================================
    // SECONDARY — new in v2.0.0, adapted from taxonomy.yaml v0.2.0
    //
    // All are optional and single-select. Each carries an explicit
    // unknown/not-assessed value which is also its default, so importing
    // them costs nothing and no existing record becomes invalid.
    // ==================================================================

    difficulty: {
      label: 'Level',
      role: 'secondary',
      multiple: false,
      optional: true,
      default: 'unknown',
      // Demoted from the prototype's "primary" because no live record carries
      // it. Promote once enough resources are assessed to make it filterable.
      help: 'Independent of stage. A programme at Optimization starting phylodynamics still needs beginner material.',
      options: [
        { id: 'beginner', label: 'Beginner', summary: 'No prior experience assumed.' },
        { id: 'intermediate', label: 'Intermediate', summary: 'Assumes working familiarity with the area.' },
        { id: 'advanced', label: 'Advanced', summary: 'Assumes established practice; extends or deepens it.' },
        { id: 'unknown', label: 'Not assessed' }
      ]
    },

    connectivity: {
      label: 'Connectivity',
      role: 'secondary',
      multiple: false,
      optional: true,
      default: 'unknown',
      help: 'Whether the resource is usable without a reliable connection. 39 of the 79 resources are tagged LMIC, so this is a real access question rather than a technical footnote.',
      options: [
        { id: 'offline-capable', label: 'Works offline' },
        { id: 'online-setup-then-offline', label: 'Online to set up, then offline' },
        { id: 'online-required', label: 'Needs a connection' },
        { id: 'unknown', label: 'Not known' }
      ]
    },

    cost: {
      label: 'Cost',
      role: 'secondary',
      multiple: false,
      optional: true,
      default: 'unknown',
      options: [
        { id: 'free', label: 'Free' },
        { id: 'free-tier', label: 'Free tier available' },
        { id: 'paid', label: 'Paid' },
        { id: 'institutional', label: 'Institutional or consumable cost' },
        { id: 'unknown', label: 'Not known' }
      ]
    },

    effort: {
      label: 'Time to get going',
      role: 'secondary',
      multiple: false,
      optional: true,
      default: 'unknown',
      options: [
        { id: 'minutes', label: 'Minutes' },
        { id: 'hours', label: 'Hours' },
        { id: 'days', label: 'Days' },
        { id: 'weeks', label: 'Weeks' },
        { id: 'months', label: 'Months' },
        { id: 'unknown', label: 'Not known' }
      ]
    },

    reuseTerms: {
      label: 'Reuse terms',
      role: 'secondary',
      multiple: false,
      optional: true,
      default: 'unknown',
      help: 'What a training programme may legally do with this material. Named for the question curators actually ask — can we adapt it for our course — rather than for the licence instrument behind it.',
      options: [
        { id: 'adapt-freely', label: 'Adapt and redistribute freely', summary: 'Open licence permitting modification, usually with attribution.' },
        { id: 'share-unchanged', label: 'Share unchanged', summary: 'May be redistributed, but not modified.' },
        { id: 'use-only', label: 'Use as provided', summary: 'Free to use; no redistribution or adaptation rights granted.' },
        { id: 'ask-first', label: 'Permission needed', summary: 'Contact the publisher before reuse in training.' },
        { id: 'unknown', label: 'Not stated', summary: 'No terms found. Assume permission is needed.' }
      ]
    },

    maintenance: {
      label: 'Maintenance',
      role: 'secondary',
      multiple: false,
      optional: true,
      default: 'unknown',
      help: 'Preferred over version numbers, which go stale within weeks and answer the wrong question. Always shown on the card: "active" is itself reassuring for someone about to commit weeks to a tool, and hiding it until something is wrong trains people not to look.',
      options: [
        { id: 'active', label: 'Actively developed', summary: 'Changed recently; issues are being answered.' },
        { id: 'stable', label: 'Stable', summary: 'Not changing, and does not need to. Normal for a standard or protocol.' },
        { id: 'unmaintained', label: 'Unmaintained', summary: 'No recent activity. Usable, but nobody is fixing it.' },
        { id: 'archived', label: 'Archived', summary: 'Formally retired by its authors.' },
        { id: 'unknown', label: 'Not known', summary: 'Not yet assessed.' }
      ]
    },

    access: {
      label: 'Access',
      role: 'secondary',
      multiple: false,
      optional: true,
      default: 'unknown',
      help: 'A real barrier that cost and connectivity do not capture. "Free" and "you must create an account before you see anything" are different experiences, especially where institutional email or card verification is required.',
      options: [
        { id: 'open', label: 'No account needed', summary: 'Open on the web; nothing to sign up for.' },
        { id: 'free-account', label: 'Free account needed', summary: 'Registration required, at no cost.' },
        { id: 'registration', label: 'Application or approval', summary: 'Access is granted, not self-serve.' },
        { id: 'restricted', label: 'Restricted', summary: 'Membership, institutional agreement, or payment required.' },
        { id: 'unknown', label: 'Not known' }
      ]
    },

    endorsement: {
      label: 'Endorsement',
      role: 'secondary',
      multiple: false,
      optional: true,
      default: 'not-assessed',
      help: 'Optional editorial signal. Defaults to not assessed, and an entry with no endorsement is not a judgement against it. Use sparingly and only where a curator can point at a reason.',
      options: [
        { id: 'not-assessed', label: 'Not assessed' },
        { id: 'widely-adopted', label: 'Widely adopted', summary: 'In routine use across many public health laboratories.' },
        { id: 'course-recommended', label: 'Recommended in course', summary: 'Used or recommended in the APHL/CDC training course.' },
        { id: 'superseded', label: 'Superseded', summary: 'Still listed, but a newer resource is preferred.' }
      ]
    }
  };

  // Status gate for machine-draftable prose. Scoped to the OPTIONAL fields
  // only. `description` is curator-written and filled on all 79 records, so it
  // is deliberately out of scope — gating it would blank the site on import.
  const TEXT_STATUS = {
    label: 'Status for written fields',
    appliesTo: ['summary', 'notes'],
    default: 'draft',
    help: 'Only verified text is published. A withheld summary falls back to `description`; a withheld note simply does not appear.',
    options: [
      { id: 'draft', label: 'Draft', summary: 'Machine-generated or unreviewed. Not published.' },
      { id: 'verified', label: 'Verified', summary: 'A curator has read it and stands behind it.' }
    ]
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

  // Unchanged contract: the seven legacy multi-select array fields only.
  // Existing validators keep working exactly as before.
  function enumFields() {
    return PRIMARY_FIELDS.reduce((acc, field) => {
      acc[field] = valuesFor(field);
      return acc;
    }, {});
  }

  // New in v2.0.0 — single-select optional fields, kept separate so that
  // callers expecting the legacy shape are unaffected.
  function secondaryEnumFields() {
    return SECONDARY_FIELDS.reduce((acc, field) => {
      acc[field] = valuesFor(field);
      return acc;
    }, {});
  }

  function defaults() {
    return SECONDARY_FIELDS.reduce((acc, field) => {
      acc[field] = TAXONOMY[field].default;
      return acc;
    }, {});
  }

  // Fill any missing secondary field with its unknown/not-assessed default.
  // Never overwrites a value a curator has already set.
  function applyDefaults(record) {
    const filled = Object.assign({}, record);
    SECONDARY_FIELDS.forEach((field) => {
      if (filled[field] === undefined || filled[field] === null || filled[field] === '') {
        filled[field] = TAXONOMY[field].default;
      }
    });
    return filled;
  }

  function isUnset(field, value) {
    const def = TAXONOMY[field];
    return !def || value === undefined || value === null || value === '' || value === def.default;
  }

  function fieldsByRole(role) {
    return Object.keys(TAXONOMY).filter((field) => TAXONOMY[field].role === role);
  }

  const api = {
    VERSION: TAXONOMY_VERSION,
    TAXONOMY,
    TEXT_STATUS,
    PRIMARY_FIELDS,
    SECONDARY_FIELDS,
    GEOGRAPHY_PARENT_MAP,
    flattenOptions,
    valuesFor,
    labelFor,
    enumFields,
    secondaryEnumFields,
    defaults,
    applyDefaults,
    isUnset,
    fieldsByRole
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.APHL_TAXONOMY = api;
})(typeof window !== 'undefined' ? window : globalThis);
