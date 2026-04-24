#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const dataFilePath = path.join(repoRoot, 'public', 'resources-data.js');
const reportDir = path.join(repoRoot, 'validation-reports');
const machineReportPath = path.join(reportDir, 'resource-validation-report.json');
const humanReportPath = path.join(reportDir, 'resource-validation-summary.md');

const enumRules = {
  audiences: ['laboratorians', 'epidemiologists', 'bioinformaticians', 'policymakers'],
  stages: ['planning', 'implementation', 'optimization'],
  types: ['guide', 'tool', 'training', 'policy'],
  geography: ['global', 'africa', 'asia', 'lmic'],
  topics: ['surveillance', 'implementation', 'policy', 'qms', 'bioinformatics', 'training', 'costing', 'prioritization']
};

const requiredArrayFields = Object.keys(enumRules);
const requiredScalarFields = ['id', 'title', 'description', 'organization', 'url'];

function createIssue({
  severity,
  check,
  message,
  resourceId = null,
  field = null,
  details = null
}) {
  return { severity, check, message, resourceId, field, details };
}

function loadResourcesDatabase() {
  const source = fs.readFileSync(dataFilePath, 'utf8');
  const context = { window: {}, globalThis: {} };
  vm.createContext(context);
  vm.runInContext(`${source};globalThis.__resourcesDatabase = resourcesDatabase;`, context, {
    filename: dataFilePath
  });

  return context.globalThis.__resourcesDatabase;
}

function isValidHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;

  // Allow legacy placeholder links currently used by dataset.
  if (value === '#') return true;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function validate(resourcesDatabase) {
  const issues = [];

  if (!resourcesDatabase || typeof resourcesDatabase !== 'object' || Array.isArray(resourcesDatabase)) {
    issues.push(createIssue({
      severity: 'error',
      check: 'invalid-internal-structure',
      message: 'resourcesDatabase must be an object containing a resources array.'
    }));
    return { issues, resources: [] };
  }

  if (!Array.isArray(resourcesDatabase.resources)) {
    issues.push(createIssue({
      severity: 'error',
      check: 'invalid-internal-structure',
      field: 'resources',
      message: 'resourcesDatabase.resources must be an array.'
    }));
    return { issues, resources: [] };
  }

  const resources = resourcesDatabase.resources;
  const idCounts = new Map();

  for (const resource of resources) {
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
      issues.push(createIssue({
        severity: 'error',
        check: 'invalid-internal-structure',
        message: 'Each resource must be an object.'
      }));
      continue;
    }

    if (typeof resource.id === 'string' && resource.id.trim()) {
      idCounts.set(resource.id, (idCounts.get(resource.id) ?? 0) + 1);
    }
  }

  for (const [id, count] of idCounts.entries()) {
    if (count > 1) {
      issues.push(createIssue({
        severity: 'error',
        check: 'duplicate-id',
        resourceId: id,
        field: 'id',
        message: `Duplicate resource ID found: "${id}" appears ${count} times.`,
        details: { count }
      }));
    }
  }

  const resourceIds = new Set(resources.map((resource) => resource?.id).filter(Boolean));

  for (const resource of resources) {
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
      continue;
    }

    const resourceId = resource.id || '(missing-id)';

    for (const field of requiredScalarFields) {
      const value = resource[field];
      if (typeof value !== 'string' || value.trim() === '') {
        issues.push(createIssue({
          severity: 'error',
          check: 'missing-required-field',
          resourceId,
          field,
          message: `Required field "${field}" is missing or empty.`
        }));
      }
    }

    for (const field of requiredArrayFields) {
      const value = resource[field];
      if (!Array.isArray(value) || value.length === 0) {
        issues.push(createIssue({
          severity: 'error',
          check: 'missing-required-array',
          resourceId,
          field,
          message: `Required array "${field}" is missing or empty.`
        }));
        continue;
      }

      const validValues = enumRules[field];
      const invalidValues = value.filter((entry) => !validValues.includes(entry));
      if (invalidValues.length > 0) {
        issues.push(createIssue({
          severity: 'warning',
          check: 'broken-enum',
          resourceId,
          field,
          message: `Field "${field}" has unsupported value(s): ${invalidValues.join(', ')}.`,
          details: {
            invalidValues,
            allowedValues: validValues
          }
        }));
      }
    }

    if (!isValidHttpUrl(resource.url)) {
      issues.push(createIssue({
        severity: 'warning',
        check: 'malformed-url',
        resourceId,
        field: 'url',
        message: `URL is not a valid http(s) URL: "${resource.url}".`
      }));
    }

    if (resource.relatedResources !== undefined && !Array.isArray(resource.relatedResources)) {
      issues.push(createIssue({
        severity: 'error',
        check: 'invalid-internal-structure',
        resourceId,
        field: 'relatedResources',
        message: 'Field "relatedResources" must be an array when provided.'
      }));
    }

    if (Array.isArray(resource.relatedResources)) {
      const missingReferences = resource.relatedResources.filter((id) => !resourceIds.has(id));
      if (missingReferences.length > 0) {
        issues.push(createIssue({
          severity: 'warning',
          check: 'related-resource-missing',
          resourceId,
          field: 'relatedResources',
          message: `Related resource reference(s) not found: ${missingReferences.join(', ')}.`,
          details: { missingReferences }
        }));
      }
    }
  }

  return { issues, resources };
}

function summarizeIssues(issues) {
  const blockingErrors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const checks = issues.reduce((acc, issue) => {
    acc[issue.check] = (acc[issue.check] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalIssues: issues.length,
    blockingErrors: blockingErrors.length,
    warnings: warnings.length,
    checks,
    blockingChecks: [...new Set(blockingErrors.map((issue) => issue.check))],
    warningChecks: [...new Set(warnings.map((issue) => issue.check))]
  };
}

function buildReport(resourcesCount, issues) {
  const summary = summarizeIssues(issues);
  const blocked = summary.blockingErrors > 0;

  return {
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(repoRoot, dataFilePath),
    blocked,
    summary: {
      totalResources: resourcesCount,
      ...summary
    },
    issues
  };
}

function writeReports(report) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(machineReportPath, JSON.stringify(report, null, 2));

  const lines = [];
  lines.push('# Resource Validation Summary');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Source: ${report.sourceFile}`);
  lines.push(`Status: ${report.blocked ? 'BLOCKED' : 'PASS'}`);
  lines.push('');
  lines.push('## Totals');
  lines.push(`- Resources checked: ${report.summary.totalResources}`);
  lines.push(`- Blocking errors: ${report.summary.blockingErrors}`);
  lines.push(`- Warnings: ${report.summary.warnings}`);
  lines.push(`- Total issues: ${report.summary.totalIssues}`);
  lines.push('- Note: warnings are non-blocking and will not fail deploy.');
  lines.push('');
  lines.push('## Issue counts by check');

  const checks = Object.entries(report.summary.checks);
  if (checks.length === 0) {
    lines.push('- None');
  } else {
    for (const [check, count] of checks) {
      lines.push(`- ${check}: ${count}`);
    }
  }

  const blockingErrors = report.issues.filter((issue) => issue.severity === 'error');
  const warnings = report.issues.filter((issue) => issue.severity === 'warning');

  lines.push('');
  lines.push('## First 25 blocking errors');

  if (blockingErrors.length === 0) {
    lines.push('- None');
  } else {
    for (const issue of blockingErrors.slice(0, 25)) {
      const location = issue.resourceId ? `resource=${issue.resourceId}` : 'resource=n/a';
      const field = issue.field ? ` field=${issue.field}` : '';
      lines.push(`- [error] ${issue.check} (${location}${field}) ${issue.message}`);
    }
  }

  lines.push('');
  lines.push('## First 25 warnings');

  if (warnings.length === 0) {
    lines.push('- None');
  } else {
    for (const issue of warnings.slice(0, 25)) {
      const location = issue.resourceId ? `resource=${issue.resourceId}` : 'resource=n/a';
      const field = issue.field ? ` field=${issue.field}` : '';
      lines.push(`- [warning] ${issue.check} (${location}${field}) ${issue.message}`);
    }
  }

  fs.writeFileSync(humanReportPath, `${lines.join('\n')}\n`);
}

function main() {
  const allowBlocking = process.argv.includes('--allow-critical') || process.argv.includes('--allow-blocking');

  let resourcesDatabase;
  let issues = [];
  let resourcesCount = 0;

  try {
    resourcesDatabase = loadResourcesDatabase();
  } catch (error) {
    issues.push(createIssue({
      severity: 'error',
      check: 'malformed-javascript',
      message: `Failed to load ${path.relative(repoRoot, dataFilePath)}: ${error.message}`
    }));

    const report = buildReport(resourcesCount, issues);
    writeReports(report);

    console.log('Validation status: BLOCKED');
    console.log(`Machine report: ${path.relative(repoRoot, machineReportPath)}`);
    console.log(`Summary report: ${path.relative(repoRoot, humanReportPath)}`);
    console.log(`Blocking errors: ${report.summary.blockingErrors}`);

    if (!allowBlocking) {
      process.exitCode = 1;
    }
    return;
  }

  const result = validate(resourcesDatabase);
  issues = result.issues;
  resourcesCount = result.resources.length;

  const report = buildReport(resourcesCount, issues);
  writeReports(report);

  console.log(`Validation status: ${report.blocked ? 'BLOCKED' : 'PASS'}`);
  console.log(`Machine report: ${path.relative(repoRoot, machineReportPath)}`);
  console.log(`Summary report: ${path.relative(repoRoot, humanReportPath)}`);
  console.log(`Blocking errors: ${report.summary.blockingErrors}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  if (report.summary.warnings > 0 && !report.blocked) {
    console.log('Note: warnings are non-blocking and will not fail deploy.');
  }

  if (report.blocked && !allowBlocking) {
    process.exitCode = 1;
  }
}

main();
