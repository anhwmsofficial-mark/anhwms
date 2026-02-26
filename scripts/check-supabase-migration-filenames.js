#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const FILE_PATTERN = /^\d{14}_[a-z0-9_]+\.sql$/;

function main() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`[migration-filename] Missing directory: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();

  const invalid = files.filter((name) => !FILE_PATTERN.test(name));
  if (invalid.length > 0) {
    console.error('[migration-filename] Invalid migration filename(s):');
    for (const name of invalid) {
      console.error(`- ${name}`);
    }
    console.error('Expected format: YYYYMMDDHHMMSS_description.sql');
    process.exit(1);
  }

  const duplicates = [];
  const seenTimestamp = new Map();
  for (const name of files) {
    const timestamp = name.slice(0, 14);
    if (seenTimestamp.has(timestamp)) {
      duplicates.push([seenTimestamp.get(timestamp), name]);
      continue;
    }
    seenTimestamp.set(timestamp, name);
  }

  if (duplicates.length > 0) {
    console.error('[migration-filename] Duplicate timestamp prefix detected:');
    for (const [a, b] of duplicates) {
      console.error(`- ${a} <-> ${b}`);
    }
    process.exit(1);
  }

  console.log(`[migration-filename] OK: ${files.length} migration filename(s) are valid.`);
}

main();
