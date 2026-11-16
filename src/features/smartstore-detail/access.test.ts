import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasRolePermission, SMARTSTORE_DETAIL_PERMISSION } from '../../../lib/auth/permissions';

describe('스마트스토어 상세 권한', () => {
  it('관리자만 상세 반영 권한을 가진다', () => {
    assert.equal(SMARTSTORE_DETAIL_PERMISSION, 'manage:smartstore_detail');
    assert.equal(hasRolePermission('admin', SMARTSTORE_DETAIL_PERMISSION), true);
    for (const role of ['manager', 'operator', 'viewer', 'partner', 'staff'] as const) {
      assert.equal(hasRolePermission(role, SMARTSTORE_DETAIL_PERMISSION), false);
    }
  });
});
