import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { logger } from '@/lib/logger'

interface AuditLogParams {
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW_PII' | 'EXPORT' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'REJECT' | 'SYSTEM'
  resourceType: 'orders' | 'inventory' | 'users' | 'partners' | 'settings' | 'auth' | 'system'
  resourceId?: string
  oldValue?: any
  newValue?: any
  reason?: string
}

export async function logAudit(params: AuditLogParams) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for') || 'unknown'
    const userAgent = headerList.get('user-agent') || 'unknown'

    // 사용자 역할 조회 (캐싱하면 좋음)
    let role = 'unknown'
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      role = profile?.role || 'unknown'
    }

    const { error } = await supabase.from('audit_logs').insert({
      actor_id: user?.id || null,
      actor_role: role,
      action_type: params.actionType,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
      new_value: params.newValue ? JSON.stringify(params.newValue) : null,
      reason: params.reason,
      ip_address: ip,
      user_agent: userAgent
    })

    if (error) {
      logger.error(error, { scope: 'audit', message: 'Failed to write audit log' })
    }
  } catch (e) {
    logger.error(e as Error, { scope: 'audit', message: 'Audit log exception' })
  }
}

