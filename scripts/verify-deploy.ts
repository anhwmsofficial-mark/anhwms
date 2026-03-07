import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load Environment Variables
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Admin verification requires Service Role

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\x1b[31m%s\x1b[0m', '✖ FAIL: Missing Environment Variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function verify() {
  console.log('\n🔍 Starting Deployment Verification...\n');
  let hasError = false;

  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      process.stdout.write(`Checking ${name}... `);
      await fn();
      console.log('\x1b[32m%s\x1b[0m', '✔ PASS');
    } catch (e: any) {
      hasError = true;
      console.log('\x1b[31m%s\x1b[0m', '✖ FAIL');
      console.error(`  -> Error: ${e.message}`);
      if (e.hint) console.error(`  -> Hint: ${e.hint}`);
    }
  };

  // 1. Connectivity Check
  await check('Supabase Connection', async () => {
    const { data, error } = await supabase.from('org').select('id').limit(1);
    if (error) throw error;
  });

  // 2. Table Access: Inbound Receipts
  await check('Table Access: inbound_receipts', async () => {
    const { error } = await supabase.from('inbound_receipts').select('id').limit(1);
    if (error) throw new Error(`Cannot access table: ${error.message}`);
  });

  // 3. Table Access: Inventory Ledger
  await check('Table Access: inventory_ledger', async () => {
    const { error } = await supabase.from('inventory_ledger').select('id').limit(1);
    if (error) throw new Error(`Cannot access table: ${error.message}`);
  });

  // 4. Table Access: Audit Logs (Read Only)
  await check('Table Access: audit_logs', async () => {
    const { error } = await supabase.from('audit_logs').select('count', { count: 'exact', head: true });
    if (error) throw new Error(`Cannot access table: ${error.message}`);
  });

  // 5. RPC Existence Check: confirm_inbound_receipt (Dry-run)
  await check('RPC Check: confirm_inbound_receipt', async () => {
    // Call with a dummy ID to verify function existence without modifying data.
    // We expect a specific business error (e.g., "not found"), NOT a "function not found" error.
    const dummyId = '00000000-0000-0000-0000-000000000000';
    const { error } = await supabase.rpc('confirm_inbound_receipt', {
      p_receipt_id: dummyId,
      p_user_id: dummyId,
    });

    if (!error) {
      throw new Error('RPC should have failed with dummy ID but succeeded (unexpected behavior).');
    }

    // If the error message indicates the function is missing, that's a FAIL.
    // If it's a logic error (e.g., receipt not found), that's a PASS (function exists).
    const msg = error.message.toLowerCase();
    if (msg.includes('function') && msg.includes('does not exist')) {
      throw new Error('RPC function confirm_inbound_receipt does not exist in DB.');
    }
    
    // Check for expected logic error
    // "receipt not found" or UUID syntax error are good signs the function ran.
    // Or just any error that is NOT "function does not exist"
  });

  // 6. RPC Existence Check: create_inbound_plan_full (New Phase 2 RPC)
  await check('RPC Check: create_inbound_plan_full', async () => {
    const { error } = await supabase.rpc('create_inbound_plan_full', {
        p_org_id: '00000000-0000-0000-0000-000000000000',
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_plan_no: 'TEST',
        p_receipt_no: 'TEST',
        p_plan_data: {},
        p_lines: [],
        p_slots: []
    });

    if (!error) {
       throw new Error('RPC should have failed with invalid input but succeeded.');
    }

    const msg = error.message.toLowerCase();
    if (msg.includes('function') && msg.includes('does not exist')) {
      throw new Error('RPC function create_inbound_plan_full does not exist in DB.');
    }
  });

  console.log('\n--------------------------------------------------');
  if (hasError) {
    console.log('\x1b[31m%s\x1b[0m', 'DEPLOY STATUS: WARNING / FAIL');
    console.log('Some checks failed. Please review the errors above.');
    console.log('Possible causes:');
    console.log(' - Missing database migrations');
    console.log(' - Incorrect environment variables');
    console.log(' - RLS policies blocking admin access');
    process.exit(1);
  } else {
    console.log('\x1b[32m%s\x1b[0m', 'DEPLOY STATUS: SAFE');
    console.log('Core tables and RPCs are accessible.');
    process.exit(0);
  }
}

verify();
