'use strict';

const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const taxonomyApi = require('./taxonomy.js');

admin.initializeApp();

const taxonomyEnums = taxonomyApi.enumFields();
const HTTP_OPTIONS = { invoker: 'public' };

function sendJson(res, status, payload) {
  res.status(status).set('Content-Type', 'application/json').send(JSON.stringify(payload));
}

function decodeJwtPayloadUnsafe(token) {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (_error) {
    return null;
  }
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
  const firebaseHeader = req.get('X-Firebase-Auth') || '';
  const authorizationHeader = req.get('Authorization') || '';
  const firebaseToken = firebaseHeader.trim() || (authorizationHeader.match(/^Bearer\s+(.+)$/i) || [])[1] || '';
  if (!firebaseToken) throw new Error('Missing Firebase auth token.');

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(firebaseToken);
  } catch (error) {
    const payload = decodeJwtPayloadUnsafe(firebaseToken) || {};
    const tokenProject = payload.aud || 'unknown';
    const functionProject = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.PROJECT_ID || 'unknown';
    throw new Error(`Firebase auth token could not be verified. Token project: ${tokenProject}; function project: ${functionProject}. Sign out, use Configure Auth to ensure the project is aphlgseresources, then sign in again. Details: ${error.message}`);
  }
  if (decoded.admin === true) return decoded;

  const email = String(decoded.email || '').toLowerCase();
  const allowedEmails = String(process.env.ADMIN_ALLOWED_EMAILS || '').toLowerCase().split(',').map((value) => value.trim()).filter(Boolean);
  const allowedDomains = String(process.env.ADMIN_ALLOWED_DOMAINS || '').toLowerCase().split(',').map((value) => value.trim()).filter(Boolean);
  const requireAdminClaim = String(process.env.ADMIN_REQUIRE_CLAIM || '').toLowerCase() === 'true';
  if (requireAdminClaim) throw new Error('Authenticated user is missing the admin claim.');
  if (email && allowedEmails.includes(email)) return decoded;
  if (email && allowedDomains.some((domain) => email.endsWith(`@${domain}`))) return decoded;
  if (email && allowedEmails.length === 0 && allowedDomains.length === 0) return decoded;
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

exports.aiHealth = onRequest({ ...HTTP_OPTIONS, timeoutSeconds: 30 }, async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  try {
    const user = await requireAdmin(req);
    const curatorOpenAiKey = String(req.get('X-OpenAI-API-Key') || '').trim();
    if (!curatorOpenAiKey) {
      return sendJson(res, 400, {
        ok: false,
        stage: 'openai-key',
        error: 'OpenAI API key required for this session.'
      });
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${curatorOpenAiKey}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return sendJson(res, response.status, {
        ok: false,
        stage: 'openai-auth',
        error: payload.error?.message || 'OpenAI key check failed.'
      });
    }

    return sendJson(res, 200, {
      ok: true,
      stage: 'ready',
      user: user.email || user.uid,
      model: process.env.OPENAI_MODEL || 'gpt-5'
    });
  } catch (error) {
    return sendJson(res, 401, {
      ok: false,
      stage: 'firebase-auth',
      error: error.message || 'Firebase authorization failed.'
    });
  }
});

exports.categorizeResource = onRequest({ ...HTTP_OPTIONS, timeoutSeconds: 120 }, async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  try {
    await requireAdmin(req);
    const curatorOpenAiKey = String(req.get('X-OpenAI-API-Key') || '').trim();
    if (!curatorOpenAiKey) {
      return sendJson(res, 400, { error: 'OpenAI API key required for this session.' });
    }
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
      body.tools = [{ type: 'web_search' }];
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${curatorOpenAiKey}`,
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

exports.saveResources = onRequest({ ...HTTP_OPTIONS, timeoutSeconds: 60 }, async (req, res) => {
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
