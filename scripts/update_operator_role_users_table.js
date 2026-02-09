import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
(async () => {
  const { data, error } = await supabase
    .from('users')
    .update({ role: 'operator' })
    .in('email', ['checker.lee@anhwms.com','duckhye.kwak@anhwms.com'])
    .select('id,email,role');
  if (error) {
    console.error('update error:', error);
    process.exit(1);
  }
  console.table(data);
})();