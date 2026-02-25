-- ====================================================================
-- Notifications query/index standardization
-- - Align query paths with unified indexes
-- ====================================================================

BEGIN;

-- keep existing composite index and add partial unread index
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created_at_desc
ON public.notifications (user_id, created_at DESC)
WHERE is_read = false;

-- support inquiry timeline lookups
CREATE INDEX IF NOT EXISTS idx_notifications_inquiry_created_at_desc
ON public.notifications (inquiry_id, inquiry_type, created_at DESC);

COMMIT;
