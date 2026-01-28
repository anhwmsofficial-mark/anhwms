const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
(async () => {
  const { data, error } = await supabase
    .from('users')
    .select('id,email,role')
    .in('email', ['checker.lee@anhwms.com','duckhye.kwak@anhwms.com']);
  if (error) throw error;
  console.table(data);
})();