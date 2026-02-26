-- ====================================================================
-- P1 운영개선: 사용자 보안/잠금/삭제 상태 컬럼 추가
-- ====================================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_reason TEXT;

COMMENT ON COLUMN user_profiles.deleted_at IS '소프트 삭제 시각';
COMMENT ON COLUMN user_profiles.locked_until IS '계정 잠금 해제 시각';
COMMENT ON COLUMN user_profiles.locked_reason IS '계정 잠금 사유';

CREATE INDEX IF NOT EXISTS idx_user_profiles_deleted_at ON user_profiles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_locked_until ON user_profiles(locked_until);
