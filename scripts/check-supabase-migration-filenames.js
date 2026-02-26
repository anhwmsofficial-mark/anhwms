#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const SUPABASE_MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const PATTERN = /^\d{14}_[a-z0-9_]+\.sql$/;

function main() {
  if (!fs.existsSync(SUPABASE_MIGRATIONS_DIR)) {
    console.log('[check:migration-filenames] supabase/migrations directory not found, skipping.');
    return;
  }

  const files = fs
    .readdirSync(SUPABASE_MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();

  const invalid = files.filter((file) => !PATTERN.test(file));

  if (invalid.length > 0) {
    console.error('\n[check:migration-filenames] Invalid migration filename(s):\n');
    for (const file of invalid) {
      console.error(`- supabase/migrations/${file}`);
    }
    console.error('\nExpected format: YYYYMMDDHHMMSS_description.sql (snake_case description)\n');
    process.exit(1);
  }

  console.log('[check:migration-filenames] OK');
}

try {
  main();
} catch (error) {
  console.error(`[check:migration-filenames] Failed: ${error.message}`);
  process.exit(1);
}
