-- ====================================================================
-- Deactivate all customers except '테스트 유통'
-- ====================================================================

UPDATE customer_master
SET status = 'INACTIVE',
    updated_at = now()
WHERE name <> '테스트 유통'
  AND status = 'ACTIVE';
