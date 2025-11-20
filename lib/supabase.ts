import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env';

// 환경 변수 검증 (앱 시작 시)
const env = getEnv();

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);

