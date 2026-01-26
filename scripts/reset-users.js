const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const users = [
  {
    fullName: 'Mark Choi',
    displayName: '최현석',
    email: 'mark.choi@anhwms.com',
    password: 'mark2025#',
    role: 'admin',
    usersTableRole: 'admin',
    department: 'admin',
  },
  {
    fullName: 'Golden Choi',
    displayName: 'Golden Choi',
    email: 'golden.choi@anhwms.com',
    password: 'golden2025#',
    role: 'manager',
    usersTableRole: 'manager',
    department: 'admin',
  },
  {
    fullName: 'Claudia Park',
    displayName: 'Claudia Park',
    email: 'claudia.park@anhwms.com',
    password: 'Claudia2025#',
    role: 'operator',
    usersTableRole: 'staff', // login logic expects admin/manager/staff
    department: 'warehouse',
  },
];

async function resetUsers() {
  console.log('Resetting users...');

  const { data: orgs, error: orgError } = await supabaseAdmin.from('org').select('id').limit(1);
  if (orgError) {
    console.error('Org lookup error:', orgError);
  }
  const orgId = orgs && orgs.length > 0 ? orgs[0].id : null;

  for (const u of users) {
    // 1) Delete existing auth user if present
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 2000,
    });
    if (listError) {
      console.error(`List users error (${u.email}):`, listError);
    }
    const existingUser = listData?.users?.find((user) => user.email === u.email);
    if (existingUser?.id) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
      if (deleteError) {
        console.error(`Delete user error (${u.email}):`, deleteError);
      } else {
        console.log(`Deleted existing user: ${u.email}`);
      }
    }

    // 2) Create auth user
    const username = u.email.split('@')[0];
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: u.fullName,
        display_name: u.displayName,
        role: u.usersTableRole,
      },
    });

    if (createError || !created?.user?.id) {
      console.error(`Create user error (${u.email}):`, createError);
      continue;
    }

    const userId = created.user.id;
    console.log(`Created user: ${u.email} (${userId})`);

    // 3) Upsert into users table
    const { error: usersTableError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email: u.email,
        username,
        role: u.usersTableRole,
        department: u.department,
        status: 'active',
      });
    if (usersTableError) {
      console.error(`Users table upsert error (${u.email}):`, usersTableError);
    }

    // 4) Upsert into user_profiles table
    const canAccessAdmin = ['admin', 'manager'].includes(u.role);
    const { error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: userId,
        email: u.email,
        full_name: u.fullName,
        display_name: u.displayName,
        role: u.role,
        department: u.department,
        org_id: orgId,
        can_access_admin: canAccessAdmin,
        can_access_dashboard: true,
        can_manage_users: u.role === 'admin',
        can_manage_inventory: ['admin', 'manager', 'operator'].includes(u.role),
        can_manage_orders: u.role !== 'viewer',
        status: 'active',
      });
    if (profilesError) {
      console.error(`User profiles upsert error (${u.email}):`, profilesError);
    }
  }

  console.log('Reset completed.');
}

resetUsers().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
