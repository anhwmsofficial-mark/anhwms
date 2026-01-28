const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  {
    full_name: 'ìµœí˜„ì„',
    display_name: 'Mark Choi',
    email: 'mark.choi@anhwms.com',
    password: 'mark2025#',
    role: 'admin',
  },
  {
    full_name: 'ìµœë³´ê¸ˆ',
    display_name: 'Golden Choi',
    email: 'golden.choi@anhwms.com',
    password: 'golden2025#',
    role: 'admin',
  },
  {
    full_name: 'ë°•ì£¼í¬',
    display_name: 'Claudia Park',
    email: 'claudia.park@anhwms.com',
    password: 'claudia2025#',
    role: 'admin',
  },
  {
    full_name: 'ê¹€ìš©ë§Œ',
    display_name: 'Dragon Kim',
    email: 'dragon.kim@anhwms.com',
    password: 'dragon2026#',
    role: 'admin',
  },
  {
    full_name: 'ì£¼ì˜ìž¬',
    display_name: 'Genius Joo',
    email: 'genius.joo@anhwms.com',
    password: 'genius2026#',
    role: 'admin',
  },
  {
    full_name: 'ì´ìƒí›ˆ',
    display_name: 'Checker Lee',
    email: 'checker.lee@anhwms.com',
    password: 'checker2026#',
    role: 'operator',
  },
  {
    full_name: 'ê³½í˜œ',
    display_name: 'Duckhye.Kwak',
    email: 'duckhye.kwak@anhwms.com',
    password: 'duckhye2026#',
    role: 'operator',
  },
];

async function fetchAllAuthUsers() {
  let page = 1;
  const perPage = 200;
  let allUsers = [];
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users || [];
    allUsers = allUsers.concat(batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return allUsers;
}

async function main() {
  const authUsers = await fetchAllAuthUsers();
  const results = [];

  for (const user of users) {
    const emailLower = user.email.toLowerCase();
    const existing = authUsers.find((u) => (u.email || '').toLowerCase() === emailLower);

    let userId;
    let action;
    const roleForUsersTable = user.role === 'admin' ? 'admin' : 'staff';

    if (!existing) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name,
          display_name: user.display_name,
          role: roleForUsersTable,
        },
      });
      if (error) throw error;
      userId = data.user.id;
      action = 'created';
    } else {
      userId = existing.id;
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: user.password,
        user_metadata: {
          full_name: user.full_name,
          display_name: user.display_name,
          role: roleForUsersTable,
        },
      });
      if (error) throw error;
      action = 'updated';
    }

    const isAdmin = user.role === 'admin';
    const username = user.email.split('@')[0];
    const department = isAdmin ? 'admin' : 'warehouse';

    const profilePayload = {
      id: userId,
      email: user.email,
      full_name: user.full_name,
      display_name: user.display_name,
      role: user.role,
      department,
      status: 'active',
      can_access_admin: isAdmin,
      can_access_dashboard: true,
      can_manage_users: isAdmin,
      can_manage_inventory: isAdmin,
      can_manage_orders: isAdmin,
    };

    const legacyPayload = {
      id: userId,
      email: user.email,
      username,
      role: roleForUsersTable,
      department,
      status: 'active',
    };

    const [{ error: profileError }, { error: legacyError }] = await Promise.all([
      supabase.from('user_profiles').upsert(profilePayload, { onConflict: 'id' }),
      supabase.from('users').upsert(legacyPayload, { onConflict: 'id' }),
    ]);

    if (profileError) throw profileError;
    if (legacyError) throw legacyError;

    results.push({ email: user.email, action, id: userId, role: user.role });
  }

  console.table(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});