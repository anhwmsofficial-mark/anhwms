const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
(async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id,email,role,can_access_admin,can_access_dashboard')
    .in('email', ['checker.lee@anhwms.com','duckhye.kwak@anhwms.com']);
  if (error) throw error;
  console.table(data);
})();