'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import { User } from '@/types';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

type Role = 'admin' | 'manager' | 'operator' | 'viewer';
type RoleFilter = '전체' | Role;

const roleOptions: { value: RoleFilter; label: string }[] = [
  { value: '전체', label: '전체' },
  { value: 'admin', label: '관리자' },
  { value: 'manager', label: '매니저' },
  { value: 'operator', label: '운영팀' },
  { value: 'viewer', label: '조회 전용' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleFilter>('전체');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<{
    username: string;
    email: string;
    role: Role;
    password?: string;
  }>({
    username: '',
    email: '',
    role: 'viewer',
    password: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '사용자를 불러오지 못했습니다.');
      }

      const mappedUsers: User[] = (data.users || []).map((user: any) => ({
        id: user.id,
        username: user.displayName || user.username || user.email,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt || user.created_at || new Date().toISOString(),
        department: user.department,
        status: user.status,
        canAccessAdmin: user.canAccessAdmin,
        canAccessDashboard: user.canAccessDashboard,
      }));

      setUsers(mappedUsers);
    } catch (err: any) {
      console.error('사용자 목록 로딩 실패:', err);
      setError(err.message || '사용자를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === '전체' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const formatDate = (date?: string | null) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(date));
  };

  const stats = useMemo(() => {
    const admin = users.filter(u => u.role === 'admin').length;
    const manager = users.filter(u => u.role === 'manager').length;
    const others = users.filter(u => !['admin', 'manager'].includes(u.role)).length;
    return { admin, manager, others };
  }, [users]);

  const handleOpenModal = (user?: User) => {
    setError(null);
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        role: user.role,
        password: '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        role: 'viewer',
        password: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      role: 'viewer',
      password: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        displayName: formData.username,
        email: formData.email,
        role: formData.role,
      };

      if (!editingUser || formData.password) {
        payload.password = formData.password;
      }

      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '사용자 저장에 실패했습니다.');
      }

      await fetchUsers();
      handleCloseModal();
    } catch (err: any) {
      console.error('사용자 저장 실패:', err);
      setError(err.message || '사용자 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('정말로 이 사용자를 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`/api/admin/users/${id}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '사용자 삭제에 실패했습니다.');
        }
        await fetchUsers();
      } catch (err: any) {
        console.error('사용자 삭제 실패:', err);
        setError(err.message || '사용자 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="inline-flex rounded-full bg-red-100 px-2 text-xs font-semibold leading-5 text-red-800">관리자</span>;
      case 'manager':
        return <span className="inline-flex rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800">매니저</span>;
      case 'operator':
        return <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">운영</span>;
      case 'viewer':
        return <span className="inline-flex rounded-full bg-gray-100 px-2 text-xs font-semibold leading-5 text-gray-800">조회</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="사용자 관리" />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {/* 상태 메시지 */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="사용자명 또는 이메일로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as RoleFilter)}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {roleOptions.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>

            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              사용자 추가
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-3">
                <ShieldCheckIcon className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">관리자</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.admin}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-3">
                <UserCircleIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">매니저</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.manager}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-3">
                <UserCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">기타 역할</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.others}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 사용자 목록 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사용자명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이메일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    권한
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    가입일
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-500">
                      데이터를 불러오는 중입니다...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-500">
                      표시할 사용자가 없습니다.
                    </td>
                  </tr>
                ) : filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <UserCircleIcon className="h-6 w-6 text-gray-500" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenModal(user)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-900"
                        disabled={user.role === 'admin'}
                      >
                        <TrashIcon className={`h-5 w-5 ${user.role === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleCloseModal}></div>
            
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {editingUser ? '사용자 수정' : '사용자 추가'}
              </h3>
              
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이름 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이메일 *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      권한 *
                    </label>
                    <select
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="viewer">조회 전용</option>
                      <option value="operator">운영</option>
                      <option value="manager">매니저</option>
                      <option value="admin">관리자</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editingUser ? '비밀번호 (변경시에만 입력)' : '비밀번호 *'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? '변경하지 않으려면 비워두세요' : ''}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {saving ? '저장 중...' : editingUser ? '수정' : '추가'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

