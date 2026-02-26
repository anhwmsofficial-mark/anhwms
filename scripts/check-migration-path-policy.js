#!/usr/bin/env node
/* eslint-disable no-console */

const { execSync } = require('node:child_process');

function run(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function parseNameStatus(output) {
  if (!output) return [];
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = parts[0] || '';
      const path = status.startsWith('R') ? parts[2] : parts[1];
      return { status, path };
    })
    .filter((item) => item.path);
}

function isBlockedMigrationPath(path) {
  if (!path) return false;
  const normalized = path.replace(/\\/g, '/');
  return (
    normalized.startsWith('migrations/') &&
    normalized.endsWith('.sql') &&
    !normalized.startsWith('migrations/_archive/')
  );
}

function getChangedFiles() {
  const baseRef = process.env.MIGRATION_POLICY_BASE_REF || '';

  try {
    if (baseRef) {
      const output = run(`git diff --name-status --diff-filter=AR ${baseRef}...HEAD`);
      return parseNameStatus(output);
    }
  } catch (error) {
    console.warn('[migration-policy] Base ref diff failed. Falling back to staged diff.');
  }

  const staged = run('git diff --name-status --cached --diff-filter=AR');
  return parseNameStatus(staged);
}

function main() {
  const changed = getChangedFiles();
  const violations = changed.filter((item) => isBlockedMigrationPath(item.path));

  if (violations.length === 0) {
    console.log('[migration-policy] OK: no forbidden SQL additions in migrations/.');
    return;
  }

  console.error('[migration-policy] Policy violation detected.');
  console.error('New SQL migrations must be added only under supabase/migrations/.');
  console.error('Forbidden added/renamed paths:');
  for (const v of violations) {
    console.error(`- ${v.status}\t${v.path}`);
  }
  process.exit(1);
}

main();
