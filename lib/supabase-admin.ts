import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';

export const supabaseAdmin = createAdminClient();

export default supabaseAdmin;

