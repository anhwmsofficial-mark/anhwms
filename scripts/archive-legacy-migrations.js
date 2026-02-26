#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const execute = args.includes('--execute');

const root = process.cwd();
const legacyDir = path.join(root, 'migrations');
const archiveDir = path.join(legacyDir, '_archive');

function isSqlFile(name) {
  return name.toLowerCase().endsWith('.sql');
}

function listLegacySqlFiles() {
  if (!fs.existsSync(legacyDir)) return [];
  return fs
    .readdirSync(legacyDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isSqlFile(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function ensureArchiveDir() {
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
}

function moveFiles(files) {
  const moved = [];
  for (const name of files) {
    const from = path.join(legacyDir, name);
    const to = path.join(archiveDir, name);
    if (fs.existsSync(to)) {
      throw new Error(`Archive target already exists: migrations/_archive/${name}`);
    }
    fs.renameSync(from, to);
    moved.push(name);
  }
  return moved;
}

function main() {
  const files = listLegacySqlFiles();
  console.log(`[archive:legacy] Found ${files.length} SQL file(s) in migrations/.`);

  if (files.length === 0) {
    console.log('[archive:legacy] Nothing to move.');
    return;
  }

  for (const name of files) {
    console.log(`- migrations/${name}`);
  }

  if (!execute) {
    console.log('\n[dry-run] No files moved. Re-run with --execute to archive these files.\n');
    return;
  }

  ensureArchiveDir();
  const moved = moveFiles(files);
  console.log(`\n[archive:legacy] Moved ${moved.length} file(s) to migrations/_archive.\n`);
}

try {
  main();
} catch (error) {
  console.error(`\n[archive:legacy] Failed: ${error.message}\n`);
  process.exit(1);
}
