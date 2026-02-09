// Supabase Admin Client for Server-side operations
import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

// Admin client with service role key for bypassing RLS
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey,
  {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}
);

if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) {
  console.warn('Supabase env vars missing: admin client may fail.');
}

export default supabaseAdmin;

