#!/usr/bin/env node
/* eslint-disable no-console */

const { spawnSync } = require('node:child_process');

const LEGACY_DIR = 'migrations/';
const LEGACY_ARCHIVE_DIR = 'migrations/_archive/';

function runGit(args) {
  const res = spawnSync('git', args, { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(res.stderr?.trim() || `git ${args.join(' ')} failed`);
  }
  return res.stdout.trim();
}

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function isLegacySqlPath(path) {
  const p = normalizePath(path);
  return p.startsWith(LEGACY_DIR) && p.endsWith('.sql') && !p.startsWith(LEGACY_ARCHIVE_DIR);
}

function listAddedFilesAgainstBase(baseRef) {
  const out = runGit(['diff', '--name-status', '--diff-filter=A', `${baseRef}...HEAD`]);
  if (!out) return [];
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .map((parts) => parts[1])
    .filter(Boolean);
}

function listAddedFilesFromWorktree() {
  const out = runGit(['status', '--porcelain']);
  if (!out) return [];
  const files = [];
  for (const rawLine of out.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const status = line.slice(0, 2);
    const path = line.slice(3).trim();
    if (status === '??' || status.includes('A')) {
      files.push(path);
    }
  }
  return files;
}

function main() {
  const baseRef = process.env.MIGRATION_POLICY_BASE_REF?.trim();
  const candidateFiles = baseRef
    ? listAddedFilesAgainstBase(baseRef)
    : listAddedFilesFromWorktree();

  const violations = candidateFiles.filter(isLegacySqlPath);

  if (violations.length > 0) {
    console.error('\n[check:migrations] New SQL files in legacy migrations path are not allowed.\n');
    console.error('Allowed path: supabase/migrations/');
    console.error(`Archive exception: ${LEGACY_ARCHIVE_DIR}\n`);
    for (const file of violations) {
      console.error(`- ${normalizePath(file)}`);
    }
    console.error('\nMove these files to supabase/migrations/ with timestamped filenames.\n');
    process.exit(1);
  }

  console.log('[check:migrations] OK');
}

try {
  main();
} catch (error) {
  console.error(`[check:migrations] Failed: ${error.message}`);
  process.exit(1);
}
