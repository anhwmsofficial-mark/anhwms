import { fail } from '@/lib/api/response';

export function requireCronSecret(request: Request) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!secret) {
    return fail('CRON_AUTH_MISCONFIGURED', 'Cron endpoint is unavailable.', { status: 503 });
  }

  if (bearer !== secret) {
    return fail('UNAUTHORIZED', 'Unauthorized cron request', { status: 401 });
  }

  return null;
}
