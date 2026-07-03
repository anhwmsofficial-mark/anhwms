import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const internalFunctionSecret = Deno.env.get('ANH_EDGE_INTERNAL_SECRET');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('환경 변수 SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.');
}

export const SUPABASE_URL = supabaseUrl;

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export function errorResponse(message: string, status = 400, details?: unknown) {
  console.error('[Edge Function Error]', message, details);
  return jsonResponse(
    {
      error: message,
      details,
    },
    status,
  );
}

export function requireInternalFunctionSecret(req: Request): Response | null {
  if (!internalFunctionSecret) {
    return errorResponse('ANH_EDGE_INTERNAL_SECRET 환경 변수가 설정되지 않았습니다.', 503);
  }

  const requestSecret = req.headers.get('x-anh-edge-secret')?.trim();

  if (requestSecret !== internalFunctionSecret) {
    return errorResponse('Unauthorized', 401);
  }

  return null;
}
