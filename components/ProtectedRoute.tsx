'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessAdmin, isActiveProfile } from '@/lib/auth/accessPolicy';
import { hasRolePermission, type UserRole } from '@/lib/auth/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requiredPermission?: string;
}

export default function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requiredPermission,
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      // 로그인하지 않은 경우
      if (!user) {
        router.push(`/login?redirect=${pathname}`);
        return;
      }

      // Admin 권한이 필요한데 없는 경우
      if (requireAdmin && !canAccessAdmin(profile)) {
        // 예외: 견적 문의 관리는 매니저도 접근 가능
        const isManager = profile?.role === 'manager';
        const isQuoteInquiries = pathname?.startsWith('/admin/quote-inquiries');

        if (!(isManager && isQuoteInquiries)) {
          router.push('/dashboard');
          return;
        }
      }

      if (requiredPermission) {
        const role = (profile?.role || 'viewer') as UserRole;
        if (!hasRolePermission(role, requiredPermission)) {
          router.push('/dashboard');
          return;
        }
      }

      // 계정이 비활성화된 경우
      if (!isActiveProfile(profile)) {
        router.push('/login?error=account_suspended');
        return;
      }
    }
  }, [user, profile, loading, requireAdmin, requiredPermission, pathname, router]);

  // 로딩 중이거나 인증되지 않은 경우
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  const isManager = profile?.role === 'manager';
  const isQuoteInquiries = pathname?.startsWith('/admin/quote-inquiries');
  const allowedException = isManager && isQuoteInquiries;

  const hasRequiredPermission = requiredPermission
    ? hasRolePermission((profile?.role || 'viewer') as UserRole, requiredPermission)
    : true;

  if (!user || (requireAdmin && !canAccessAdmin(profile) && !allowedException) || !hasRequiredPermission) {
    return null;
  }

  return <>{children}</>;
}

