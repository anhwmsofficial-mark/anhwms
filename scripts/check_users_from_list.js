const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const emails = [
  'mark.choi@anhwms.com',
  'golden.choi@anhwms.com',
  'claudia.park@anhwms.com',
  'dragon.kim@anhwms.com',
  'genius.joo@anhwms.com',
  'checker.lee@anhwms.com',
  'duckhye.kwak@anhwms.com',
];
(async () => {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const users = data.users || [];
  const found = emails.map(email => {
    const u = users.find(x => (x.email || '').toLowerCase() === email.toLowerCase());
    return { email, id: u?.id || null };
  });
  console.table(found);
})();