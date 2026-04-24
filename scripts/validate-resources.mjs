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

const requiredArrays = Object.keys(enumRules);
const criticalChecks = new Set([
  'duplicate-id',
  'broken-enum',
  'malformed-url',
  'missing-required-array',
  'related-resource-missing'
]);

function loadResourcesDatabase() {
  const source = fs.readFileSync(dataFilePath, 'utf8');
  const context = { window: {}, globalThis: {} };
  vm.createContext(context);
  vm.runInContext(`${source};globalThis.__resourcesDatabase = resourcesDatabase;`, context, { filename: dataFilePath });
  const database = context.globalThis.__resourcesDatabase;
  if (!database) {
    throw new Error(`Unable to parse resources database from ${dataFilePath}`);
  }
  return database;
}

function isLikelyUrl(value) {
  if (typeof value !== 'string') return false;
  if (!value.trim() || value === '#') return true;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function createIssue({ severity, check, resourceId = null, field = null, message, details = null }) {
  return { severity, check, resourceId, field, message, details };
}

function validate(resources) {
  const issues = [];
  const idCounts = new Map();

  for (const resource of resources) {
    if (resource?.id) {
      idCounts.set(resource.id, (idCounts.get(resource.id) ?? 0) + 1);
    }
  }

  for (const [id, count] of idCounts.entries()) {
    if (count > 1) {
      issues.push(createIssue({
        severity: 'critical',
        check: 'duplicate-id',
        resourceId: id,
        field: 'id',
        message: `Duplicate resource ID found: "${id}" appears ${count} times.`,
        details: { count }
      }));
    }
  }

  const resourceIds = new Set(resources.map((resource) => resource.id).filter(Boolean));

  for (const resource of resources) {
    const resourceId = resource?.id ?? '(missing-id)';

    for (const field of requiredArrays) {
      const value = resource?.[field];
      if (!Array.isArray(value) || value.length === 0) {
        issues.push(createIssue({
          severity: 'critical',
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
          severity: 'critical',
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

    if (!isLikelyUrl(resource?.url)) {
      issues.push(createIssue({
        severity: 'critical',
        check: 'malformed-url',
        resourceId,
        field: 'url',
        message: `Malformed URL detected: "${resource?.url}".`
      }));
    }

    if (Array.isArray(resource?.relatedResources)) {
      const missingReferences = resource.relatedResources.filter((id) => !resourceIds.has(id));
      if (missingReferences.length > 0) {
        issues.push(createIssue({
          severity: 'critical',
          check: 'related-resource-missing',
          resourceId,
          field: 'relatedResources',
          message: `Related resource reference(s) not found: ${missingReferences.join(', ')}.`,
          details: { missingReferences }
        }));
      }
    }
  }

  return issues;
}

function buildReport(resources, issues) {
  const generatedAt = new Date().toISOString();
  const criticalIssues = issues.filter((issue) => issue.severity === 'critical');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const groupedByCheck = issues.reduce((acc, issue) => {
    acc[issue.check] = (acc[issue.check] ?? 0) + 1;
    return acc;
  }, {});

  const blocked = criticalIssues.some((issue) => criticalChecks.has(issue.check));

  return {
    generatedAt,
    sourceFile: path.relative(repoRoot, dataFilePath),
    blocked,
    summary: {
      totalResources: resources.length,
      totalIssues: issues.length,
      criticalIssues: criticalIssues.length,
      warnings: warnings.length,
      checks: groupedByCheck
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
  lines.push(`- Critical issues: ${report.summary.criticalIssues}`);
  lines.push(`- Warnings: ${report.summary.warnings}`);
  lines.push(`- Total issues: ${report.summary.totalIssues}`);
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

  lines.push('');
  lines.push('## First 25 issues');

  if (report.issues.length === 0) {
    lines.push('- No issues found.');
  } else {
    for (const issue of report.issues.slice(0, 25)) {
      const location = issue.resourceId ? `resource=${issue.resourceId}` : 'resource=n/a';
      const field = issue.field ? ` field=${issue.field}` : '';
      lines.push(`- [${issue.severity}] ${issue.check} (${location}${field}) ${issue.message}`);
    }
  }

  fs.writeFileSync(humanReportPath, `${lines.join('\n')}\n`);
}

function main() {
  const allowCritical = process.argv.includes('--allow-critical');
  const resourcesDatabase = loadResourcesDatabase();
  const resources = resourcesDatabase?.resources;

  if (!Array.isArray(resources)) {
    throw new Error('resourcesDatabase.resources must be an array.');
  }

  const issues = validate(resources);
  const report = buildReport(resources, issues);
  writeReports(report);

  const status = report.blocked ? 'BLOCKED' : 'PASS';
  console.log(`Validation status: ${status}`);
  console.log(`Machine report: ${path.relative(repoRoot, machineReportPath)}`);
  console.log(`Summary report: ${path.relative(repoRoot, humanReportPath)}`);
  console.log(`Critical issues: ${report.summary.criticalIssues}`);

  if (report.blocked && !allowCritical) {
    process.exitCode = 1;
  }
}

main();
