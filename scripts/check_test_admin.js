const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const logErr = (label, err) => {
  try { console.error(label, JSON.stringify(err, null, 2)); } catch { console.error(label, err); }
};
(async () => {
  try {
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('id, email, display_name, role, status, can_access_admin')
      .or('email.ilike.%test_admin%,display_name.ilike.%test_admin%')
      .limit(5);
    if (error) throw error;
    console.log('test_admin profiles:', users);
  } catch (err) {
    logErr('check failed:', err);
    process.exit(1);
  }
})();
