-- ====================================================================
-- Deactivate all customers except '테스트 유통'
-- ====================================================================

UPDATE customer_master
SET status = 'INACTIVE',
    updated_at = now()
WHERE name NOT IN ('테스트 유통', 'YBK')
  AND status = 'ACTIVE';
