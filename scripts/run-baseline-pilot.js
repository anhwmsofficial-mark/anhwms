const fs = require('node:fs');
const { Client } = require('pg');

async function main() {
  const dbUrl = process.env.DBURL;
  if (!dbUrl) {
    throw new Error('Missing DBURL env var');
  }

  const sql = fs.readFileSync(
    'supabase/migrations/20260226220000_baseline_schema.sql',
    'utf8'
  );

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    const res = await client.query(
      "select to_regclass('public.user_profiles') as user_profiles, to_regclass('public.notifications') as notifications"
    );
    console.log('baseline_sql_applied');
    console.log(JSON.stringify(res.rows[0]));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
