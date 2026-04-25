'use strict';

const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const taxonomyApi = require('../public/taxonomy.js');

admin.initializeApp();

const openAiApiKey = defineSecret('OPENAI_API_KEY');
const taxonomyEnums = taxonomyApi.enumFields();

function sendJson(res, status, payload) {
  res.status(status).set('Content-Type', 'application/json').send(JSON.stringify(payload));
}

function taxonomySchema() {
  const arrayOf = (values) => ({
    type: 'array',
    items: { type: 'string', enum: values }
  });

  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'id', 'title', 'organization', 'description', 'url', 'audiences', 'stages',
      'types', 'geography', 'topics', 'pathogenFocus', 'language', 'lastUpdated',
      'formatDetails', 'keyFeatures', 'practicalUse', 'relatedResources',
      'warnings', 'sourceNotes', 'needsReview'
    ],
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      organization: { type: 'string' },
      description: { type: 'string' },
      url: { type: 'string' },
      audiences: arrayOf(taxonomyEnums.audiences),
      stages: arrayOf(taxonomyEnums.stages),
      types: arrayOf(taxonomyEnums.types),
      geography: arrayOf(taxonomyEnums.geography),
      topics: arrayOf(taxonomyEnums.topics),
      pathogenFocus: arrayOf(taxonomyEnums.pathogenFocus),
      language: arrayOf(taxonomyEnums.language),
      lastUpdated: { type: 'string' },
      formatDetails: { type: 'string' },
      keyFeatures: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      practicalUse: { type: 'string' },
      relatedResources: { type: 'array', items: { type: 'string' } },
      warnings: { type: 'array', items: { type: 'string' } },
      sourceNotes: { type: 'array', items: { type: 'string' } },
      needsReview: { type: 'boolean' }
    }
  };
}

async function requireAdmin(req) {
  const header = req.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Missing Firebase auth token.');

  const decoded = await admin.auth().verifyIdToken(match[1]);
  if (decoded.admin === true) return decoded;

  const email = String(decoded.email || '').toLowerCase();
  const allowedEmails = String(process.env.ADMIN_ALLOWED_EMAILS || '').toLowerCase().split(',').map((value) => value.trim()).filter(Boolean);
  const allowedDomains = String(process.env.ADMIN_ALLOWED_DOMAINS || '').toLowerCase().split(',').map((value) => value.trim()).filter(Boolean);
  if (email && allowedEmails.includes(email)) return decoded;
  if (email && allowedDomains.some((domain) => email.endsWith(`@${domain}`))) return decoded;
  throw new Error('Authenticated user is not authorized.');
}

function buildPrompt({ url, text, existingResource }) {
  const taxonomyLines = Object.entries(taxonomyEnums)
    .map(([field, values]) => `${field}: ${values.join(', ')}`)
    .join('\n');

  return [
    'You are cataloging public-health pathogen genomics resources for APHL-GSEI.',
    'Use only the taxonomy IDs listed below. Prefer fewer, stronger tags over broad over-tagging.',
    'If a URL cannot be inspected, rely on pasted text and mark needsReview=true.',
    'Do not invent source facts. Put uncertainty in warnings/sourceNotes.',
    '',
    taxonomyLines,
    '',
    `URL: ${url || '(none)'}`,
    `Pasted text: ${text || '(none)'}`,
    `Existing resource JSON: ${JSON.stringify(existingResource || {})}`
  ].join('\n');
}

function parseResponseText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const chunks = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
      if (content.type === 'text' && content.text) chunks.push(content.text);
    }
  }
  return chunks.join('');
}

exports.categorizeResource = onRequest({ secrets: [openAiApiKey], timeoutSeconds: 120 }, async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  try {
    await requireAdmin(req);
    const { url = '', text = '', existingResource = null } = req.body || {};
    if (!String(url).trim() && !String(text).trim()) {
      return sendJson(res, 400, { error: 'Provide a URL or pasted text.' });
    }

    const body = {
      model: process.env.OPENAI_MODEL || 'gpt-5',
      input: buildPrompt({ url, text, existingResource }),
      text: {
        format: {
          type: 'json_schema',
          name: 'aphl_resource_metadata',
          strict: true,
          schema: taxonomySchema()
        }
      }
    };

    if (String(url).trim()) {
      body.tools = [{ type: 'web_search_preview' }];
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey.value()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return sendJson(res, response.status, { error: payload.error?.message || 'OpenAI request failed.' });
    }

    const outputText = parseResponseText(payload);
    const resource = JSON.parse(outputText);
    return sendJson(res, 200, {
      resource,
      warnings: resource.warnings || [],
      sourceNotes: resource.sourceNotes || [],
      needsReview: Boolean(resource.needsReview)
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Categorization failed.' });
  }
});

exports.saveResources = onRequest({ timeoutSeconds: 60 }, async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });
  try {
    await requireAdmin(req);
    // Hosting file replacement is still handled by the browser file-write flow.
    // This endpoint exists so the admin panel can fail explicitly instead of 404.
    return sendJson(res, 501, {
      error: 'Server-side publishing is not configured. Use Save to Database to write resources-data.js, then deploy Firebase Hosting.'
    });
  } catch (error) {
    return sendJson(res, 401, { error: error.message || 'Unauthorized.' });
  }
});
