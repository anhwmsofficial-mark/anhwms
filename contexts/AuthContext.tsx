'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { isSupabaseConfigured } from '@/utils/supabase/config';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  display_name?: string;
  role: string;
  department?: string;
  can_access_admin: boolean;
  can_access_dashboard: boolean;
  can_manage_users: boolean;
  can_manage_inventory: boolean;
  can_manage_orders: boolean;
  status: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  canAccessAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Supabase가 설정되지 않았으면 인증 기능 비활성화
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('세션 확인 실패:', error);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((error) => {
      console.error('세션 확인 에러:', error);
      setLoading(false);
    });

    // Auth 상태 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(userId: string) {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('프로필 로드 실패:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('프로필 로드 에러:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (!isSupabaseConfigured()) {
      setUser(null);
      setProfile(null);
      setSession(null);
      router.push('/login');
      return;
    }

    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signOut,
    isAdmin: profile?.role === 'admin',
    canAccessAdmin: profile?.can_access_admin || false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

