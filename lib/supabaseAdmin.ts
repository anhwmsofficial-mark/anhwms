import 'server-only';
import supabaseAdmin from '@/lib/supabase-admin';

export function getSupabaseAdminClient() {
  return supabaseAdmin;
}
