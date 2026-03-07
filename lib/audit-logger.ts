import { SupabaseClient } from '@supabase/supabase-js'

export type AuditAction = 
  | 'LOGIN' 
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'CONFIRM'
  | 'CANCEL'
  | 'APPROVE'
  | 'REJECT'
  | 'EXPORT'
  | 'IMPORT'
  | 'INSPECT'

export type AuditEntityType =
  | 'USER'
  | 'ORG'
  | 'PRODUCT'
  | 'INBOUND'
  | 'OUTBOUND'
  | 'INVENTORY'
  | 'ORDER'
  | 'LOCATION'
  | 'SYSTEM'

interface LogActivityParams {
  action: AuditAction | string
  entityType: AuditEntityType | string
  entityId?: string
  oldValue?: any
  newValue?: any
  metadata?: any
  requestId?: string | null
  route?: string
}

export async function logActivity(
  supabase: SupabaseClient,
  params: LogActivityParams
) {
  try {
    const {
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      metadata,
      requestId,
      route
    } = params

    // 1. Get user context
    const { data: { user } } = await supabase.auth.getUser()
    let actorRole: string | null = null

    if (user?.id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      actorRole = profile?.role ?? null
    }

    const reasonParts = [route, requestId].filter(Boolean)
    const reason = reasonParts.length > 0 ? reasonParts.join(' | ') : null

    const { error } = await supabase.from('audit_logs').insert({
      actor_id: user?.id ?? null,
      actor_role: actorRole,
      action_type: action,
      resource_type: entityType,
      resource_id: entityId ?? null,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
      reason,
      request_id: requestId,
      route,
      action_name: action,
      entity_type: entityType,
      metadata: metadata ?? null,
    })

    if (error) {
      console.error('Audit Log Error:', error)
    }
  } catch (err) {
    console.error('Audit Log Exception:', err)
  }
}
