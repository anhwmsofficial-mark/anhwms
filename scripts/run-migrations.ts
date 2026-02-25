
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
}

const client = new Client({ connectionString });

async function runMigrations() {
    try {
        if (process.env.ENABLE_LEGACY_SCRIPT_MIGRATIONS !== 'true') {
            console.error('Legacy script migrations are disabled by policy. Use numbered SQL files in migrations/.');
            process.exit(1);
        }
        await client.connect();
        
        // 1. Product Barcodes Table
        console.log('Creating product_barcodes table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS product_barcodes (
              id           uuid primary key default gen_random_uuid(),
              org_id       uuid not null,
              product_id   uuid not null references products(id) on delete cascade,
              barcode      text not null,
              barcode_type text not null check (barcode_type in ('RETAIL','SET','INNER','OUTER')),
              is_primary   boolean not null default false,
              created_at   timestamptz not null default now(),
              unique(org_id, barcode),
              unique(product_id, barcode, barcode_type)
            );
            CREATE INDEX IF NOT EXISTS product_barcodes_barcode_idx on product_barcodes(barcode);
            CREATE INDEX IF NOT EXISTS product_barcodes_product_idx on product_barcodes(product_id);
            ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS "Enable read for authenticated users" ON product_barcodes;
            CREATE POLICY "Enable read for authenticated users" ON product_barcodes FOR SELECT TO authenticated USING (true);
            DROP POLICY IF EXISTS "Enable write for authenticated users" ON product_barcodes;
            CREATE POLICY "Enable write for authenticated users" ON product_barcodes FOR ALL TO authenticated USING (true) WITH CHECK (true);
        `);

        // 2. Inbound Plan Lines Columns
        console.log('Adding columns to inbound_plan_lines...');
        await client.query(`
            ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS box_count integer;
            ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS pallet_text text;
            ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS mfg_date date;
            ALTER TABLE inbound_plan_lines ADD COLUMN IF NOT EXISTS line_notes text;
        `);

        // 3. Inbound Plans Manager Column
        console.log('Adding inbound_manager to inbound_plans...');
        await client.query(`
            ALTER TABLE inbound_plans ADD COLUMN IF NOT EXISTS inbound_manager text;
        `);

        console.log('Migrations completed.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await client.end();
    }
}

runMigrations();
