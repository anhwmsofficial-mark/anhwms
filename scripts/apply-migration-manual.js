import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function applyMigration() {
  const migrationFile = 'supabase/migrations/20260307150000_audit_log_v2.sql';
  const filePath = path.join(process.cwd(), migrationFile);
  
  console.log(`Reading migration file: ${migrationFile}`);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log('Executing migration...');
  
  // Split by semicolon strictly might break functions, but this file has explicit BEGIN/COMMIT blocks.
  // Using supabase.rpc or raw query if possible. 
  // Supabase-js doesn't support raw SQL query execution directly on public schema easily without postgres connection or specific RPC.
  // However, we can use a PG client if available, but let's try to find a workaround or assume 
  // the user has a way to run SQL.
  
  // Since I cannot easily install 'pg' client if not present, and I see 'pg' in package.json dependencies!
  // I will use 'pg' directly.
  
  // Re-import pg inside the function to avoid top-level require issues if possible, or just require it.
  const { Client } = require('pg');
  
  // Need connection string. Usually it's in env or we construct it.
  // Assuming process.env.DATABASE_URL exists or we can construct it.
  // If not, I'll fail gracefully.
  
  let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
     // Fallback: try to construct from supabase url (project ref) if possible, but password is needed.
     console.error("DATABASE_URL is missing. Cannot execute raw SQL migration via Node script.");
     process.exit(1);
  }

  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } // For Supabase usually needed
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
