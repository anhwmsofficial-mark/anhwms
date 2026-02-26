-- ====================================================================
-- Query performance hotfix: notifications access patterns
-- ====================================================================

BEGIN;

-- notifications by user, newest first
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at_desc
ON public.notifications (user_id, created_at DESC);

-- unread/read filter with newest first
CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read_created_at_desc
ON public.notifications (user_id, is_read, created_at DESC);

-- action-based lookups with time window filters
CREATE INDEX IF NOT EXISTS idx_notifications_action_created_at_desc
ON public.notifications (action, created_at DESC);

COMMIT;
