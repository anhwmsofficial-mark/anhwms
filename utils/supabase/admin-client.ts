import 'server-only';
import { createAdminClient as createOriginalAdminClient } from './admin';

function getCallerFile(): string {
  try {
    const err = new Error();
    const stack = err.stack?.split('\n');
    // stack[0]: Error
    // stack[1]: getCallerFile
    // stack[2]: createTrackedAdminClient
    // stack[3]: Caller (desired)
    if (stack && stack.length > 3) {
      const callerLine = stack[3].trim();
      const match = callerLine.match(/\((.*)\)/) || callerLine.match(/at (.*)/);
      return match ? match[1] : callerLine;
    }
  } catch {
    return 'unknown';
  }
  return 'unknown';
}

async function logAdminUsage(context: Record<string, any>) {
  try {
    const db = createOriginalAdminClient();
    await db.from('audit_logs').insert({
      action_type: 'ADMIN_CLIENT_ACCESS',
      resource_type: 'SYSTEM',
      resource_id: context.requestId || 'N/A',
      new_value: context,
      reason: 'Service Role Client Used',
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Fail silently
    // console.error('Failed to log admin client usage:', error);
  }
}

export function createTrackedAdminClient(context: {
  route?: string;
  action?: string;
  requestId?: string;
} = {}) {
  const client = createOriginalAdminClient();
  
  // Skip logging if env var is set (optional, for local dev noise reduction)
  if (process.env.SKIP_ADMIN_LOG === 'true') return client;

  const caller = getCallerFile();
  const timestamp = new Date().toISOString();

  const logPayload = {
    ...context,
    caller,
    timestamp,
  };

  console.log('[ADMIN_CLIENT_USED]', JSON.stringify(logPayload));

  // Fire-and-forget
  void logAdminUsage(logPayload);

  return client;
}

export const createAdminClient = createTrackedAdminClient;
