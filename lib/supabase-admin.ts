import 'server-only';

import { createTrackedAdminClient } from '@/utils/supabase/admin-client';

export const supabaseAdmin = createTrackedAdminClient({ route: 'GLOBAL_SINGLETON' });

export default supabaseAdmin;

