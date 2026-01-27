const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const logErr = (label, err) => {
  try { console.error(label, JSON.stringify(err, null, 2)); } catch { console.error(label, err); }
};
(async () => {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    const users = data.users || [];
    const matches = users.filter(u => (u.email && u.email.includes('test_admin')) || (u.user_metadata && JSON.stringify(u.user_metadata).includes('test_admin')));
    console.log('auth users matching test_admin:', matches.map(u => ({ id: u.id, email: u.email, user_metadata: u.user_metadata })));
  } catch (err) {
    logErr('check failed:', err);
    process.exit(1);
  }
})();
