import { fail } from '@/lib/api/response';

export function requireCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!secret) {
    // Keep backward compatibility for local/dev environments
    return null;
  }

  if (bearer !== secret) {
    return fail('UNAUTHORIZED', 'Unauthorized cron request', { status: 401 });
  }

  return null;
}
