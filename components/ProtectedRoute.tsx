'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  requireAdmin = false 
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
      if (requireAdmin && !profile?.can_access_admin) {
        router.push('/dashboard');
        return;
      }

      // 계정이 비활성화된 경우
      if (profile?.status !== 'active') {
        router.push('/login?error=account_suspended');
        return;
      }
    }
  }, [user, profile, loading, requireAdmin, pathname, router]);

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

  if (!user || (requireAdmin && !profile?.can_access_admin)) {
    return null;
  }

  return <>{children}</>;
}

