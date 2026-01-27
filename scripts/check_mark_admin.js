const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
(async () => {
  const { data: auth, error: aErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (aErr) throw aErr;
  const user = (auth.users || []).find(u => u.email === 'mark.choi@anhwms.com');
  console.log('auth user:', user ? { id: user.id, email: user.email } : null);
  if (!user) return;
  const { data: profile, error: pErr } = await supabase
    .from('user_profiles')
    .select('id, email, display_name, role, status, can_access_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (pErr) throw pErr;
  console.log('profile:', profile);
})();
