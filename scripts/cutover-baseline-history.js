#!/usr/bin/env node
/* eslint-disable no-console */

const { spawnSync } = require('node:child_process');

const OLD_VERSIONS = [
  '20260225123000',
  '20260225153000',
  '20260225160000',
  '20260225170000',
  '20260225173000',
  '20260225180000',
  '20260225183000',
  '20260225190000',
  '20260225193000',
  '20260225200000',
  '20260225203000',
  '20260225210000',
  '20260225213000',
  '20260225220000',
];

const BASELINE_VERSION = '20260226220000';

function parseArgs(argv) {
  return {
    execute: argv.includes('--execute'),
    rollback: argv.includes('--rollback'),
    listOnly: argv.includes('--list-only'),
    dbUrl: readArgValue(argv, '--db-url'),
  };
}

function readArgValue(argv, key) {
  const idx = argv.indexOf(key);
  if (idx === -1 || idx + 1 >= argv.length) return '';
  return argv[idx + 1];
}

function runSupabase(args) {
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const res = spawnSync(cmd, ['supabase', ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  if (res.status !== 0) {
    throw new Error(`Command failed: npx supabase ${args.join(' ')}`);
  }
}

function buildRepairArgs(version, status, dbUrl) {
  const args = ['migration', 'repair', version, '--status', status];
  if (dbUrl) {
    args.push('--db-url', dbUrl);
  }
  return args;
}

function printPlan(mode, dbUrl) {
  const target = dbUrl ? `custom db-url (${dbUrl})` : 'linked project';
  console.log(`\n[baseline-cutover] Target: ${target}`);
  console.log(`[baseline-cutover] Mode: ${mode}\n`);

  if (mode === 'rollback') {
    console.log('Planned operations:');
    console.log(`1) Mark baseline ${BASELINE_VERSION} as reverted`);
    console.log(`2) Mark old versions (${OLD_VERSIONS.length}) back to applied`);
    return;
  }

  console.log('Planned operations:');
  console.log(`1) Mark old versions (${OLD_VERSIONS.length}) as reverted`);
  console.log(`2) Mark baseline ${BASELINE_VERSION} as applied`);
}

function printUsage() {
  console.log(`
Usage:
  node scripts/cutover-baseline-history.js [--execute] [--rollback] [--list-only] [--db-url <url>]

Examples:
  # Show planned operations only (safe default)
  node scripts/cutover-baseline-history.js

  # Execute cutover on linked project
  node scripts/cutover-baseline-history.js --execute

  # Execute cutover on specific database URL
  node scripts/cutover-baseline-history.js --execute --db-url "postgresql://..."

  # Rollback history states (if needed)
  node scripts/cutover-baseline-history.js --execute --rollback
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.rollback ? 'rollback' : 'cutover';

  printPlan(mode, args.dbUrl);

  if (args.listOnly) {
    printUsage();
    return;
  }

  if (!args.execute) {
    console.log('\n[dry-run] No changes were applied. Add --execute to run.\n');
    printUsage();
    return;
  }

  if (args.rollback) {
    runSupabase(buildRepairArgs(BASELINE_VERSION, 'reverted', args.dbUrl));
    for (const version of OLD_VERSIONS) {
      runSupabase(buildRepairArgs(version, 'applied', args.dbUrl));
    }
  } else {
    for (const version of OLD_VERSIONS) {
      runSupabase(buildRepairArgs(version, 'reverted', args.dbUrl));
    }
    runSupabase(buildRepairArgs(BASELINE_VERSION, 'applied', args.dbUrl));
  }

  const listArgs = ['migration', 'list'];
  if (args.dbUrl) {
    listArgs.push('--db-url', args.dbUrl);
  }
  runSupabase(listArgs);

  console.log('\n[baseline-cutover] Completed.\n');
}

try {
  main();
} catch (error) {
  console.error(`\n[baseline-cutover] Failed: ${error.message}\n`);
  process.exit(1);
}
