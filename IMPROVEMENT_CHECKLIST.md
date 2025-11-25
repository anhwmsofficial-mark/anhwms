# ANH WMS 개선점 체크리스트

> **작성일**: 2025년 11월 18일  
> **대상**: ANH 창고 관리 시스템 (WMS) v1.0  
> **목적**: 실제 프로덕션 배포 전 필수 개선 사항 점검

---

## 📋 목차

1. [🔴 Critical (필수) - 배포 전 반드시 해결](#-critical-필수---배포-전-반드시-해결)
2. [🟡 High Priority (높음) - 조기 해결 권장](#-high-priority-높음---조기-해결-권장)
3. [🟢 Medium Priority (중간) - 점진적 개선](#-medium-priority-중간---점진적-개선)
4. [⚪ Low Priority (낮음) - 추후 개선](#-low-priority-낮음---추후-개선)
5. [💡 개선 로드맵](#-개선-로드맵)

---

## 🔴 Critical (필수) - 배포 전 반드시 해결

### 1. 환경 변수 및 설정

#### ❌ 문제점
- [ ] `.env.local` 파일이 누락되어 있음 (Git에서 제외됨)
- [ ] 환경 변수 템플릿 파일 부재
- [ ] 필수 환경 변수 검증 로직 없음

#### ✅ 해결 방안
```bash
# 1. .env.example 파일 생성
cat > .env.example << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (AI CS 기능 사용 시)
OPENAI_API_KEY=your-openai-api-key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

# 2. 실제 .env.local 파일 생성 (개발자가 직접)
cp .env.example .env.local
# 실제 값으로 수정
```

```typescript
// lib/env.ts 추가
export function validateEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

---

### 2. 인증 시스템 구현

#### ❌ 문제점
- [ ] 로그인/로그아웃 기능 미구현
- [ ] 세션 관리 없음
- [ ] 비밀번호 암호화 없음
- [ ] 사용자 역할 기반 접근 제어 없음

#### ✅ 해결 방안
```typescript
// app/auth/login/page.tsx 생성
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // 로그인 성공
      router.push('/');
    } catch (error: any) {
      alert(`로그인 실패: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">ANH WMS 로그인</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border rounded-lg"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

```typescript
// middleware.ts 생성 (인증 검증)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 인증이 필요한 경로
  if (!session && !req.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  // 이미 로그인한 경우 로그인 페이지 접근 차단
  if (session && req.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

### 3. RLS (Row Level Security) 정책 강화

#### ❌ 문제점
- [ ] 현재 모든 사용자에게 읽기/쓰기 권한 부여 (개발 단계용)
- [ ] 프로덕션에 적합하지 않은 보안 설정

#### ✅ 해결 방안
```sql
-- supabase-rls-production.sql 생성

-- 기존 개발용 정책 삭제
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable insert for all users" ON products;
-- ... (모든 테이블에 대해 반복)

-- 인증된 사용자만 읽기 허용
CREATE POLICY "Authenticated users can read products"
  ON products FOR SELECT
  USING (auth.role() = 'authenticated');

-- 관리자와 매니저만 쓰기 허용
CREATE POLICY "Admin and Manager can insert products"
  ON products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and Manager can update products"
  ON products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin can delete products"
  ON products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- 다른 테이블에도 동일한 패턴 적용
-- (partners, inbounds, outbounds, work_orders, my_tasks 등)
```

---

### 4. 에러 처리 개선

#### ❌ 문제점
- [ ] API 호출 시 에러 처리 불충분
- [ ] 사용자 친화적인 에러 메시지 부재
- [ ] 에러 로깅 시스템 없음

#### ✅ 해결 방안
```typescript
// lib/errorHandler.ts 생성
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleApiError(error: any): AppError {
  console.error('API Error:', error);

  // Supabase 에러
  if (error.code) {
    switch (error.code) {
      case 'PGRST116':
        return new AppError('데이터를 찾을 수 없습니다.', 404, error.code);
      case '23505':
        return new AppError('이미 존재하는 데이터입니다.', 409, error.code);
      case '23503':
        return new AppError('참조 무결성 위반입니다.', 400, error.code);
      default:
        return new AppError('데이터베이스 오류가 발생했습니다.', 500, error.code);
    }
  }

  // 일반 에러
  return new AppError(
    error.message || '알 수 없는 오류가 발생했습니다.',
    500
  );
}

export function showErrorToast(error: any) {
  const appError = handleApiError(error);
  // TODO: Toast 라이브러리 사용 (react-hot-toast 등)
  alert(`❌ ${appError.message}`);
}
```

```typescript
// lib/api/products.ts 개선
import { handleApiError, showErrorToast } from '@/lib/errorHandler';

export async function getProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data.map(item => ({
      ...item,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    })) as Product[];
  } catch (error) {
    const appError = handleApiError(error);
    // 에러 로깅 (Sentry, LogRocket 등)
    console.error('[getProducts]', appError);
    throw appError;
  }
}
```

---

### 5. 데이터 검증 (Validation)

#### ❌ 문제점
- [ ] 클라이언트/서버 사이드 데이터 검증 부재
- [ ] SQL Injection, XSS 취약점 가능성

#### ✅ 해결 방안
```bash
# Zod 설치
npm install zod
```

```typescript
// lib/validations/product.ts 생성
import { z } from 'zod';

export const ProductSchema = z.object({
  name: z.string().min(1, '제품명은 필수입니다').max(200),
  sku: z.string().min(1, 'SKU는 필수입니다').max(50),
  category: z.string().min(1, '카테고리는 필수입니다'),
  quantity: z.number().int().min(0, '수량은 0 이상이어야 합니다'),
  unit: z.string().min(1, '단위는 필수입니다'),
  minStock: z.number().int().min(0),
  price: z.number().min(0, '가격은 0 이상이어야 합니다'),
  location: z.string().optional(),
  description: z.string().optional(),
});

export type ProductInput = z.infer<typeof ProductSchema>;
```

```typescript
// app/api/products/route.ts 생성 (API 라우트)
import { NextRequest, NextResponse } from 'next/server';
import { ProductSchema } from '@/lib/validations/product';
import { createProduct } from '@/lib/api/products';
import { handleApiError } from '@/lib/errorHandler';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 데이터 검증
    const validatedData = ProductSchema.parse(body);
    
    // 제품 생성
    const product = await createProduct(validatedData);
    
    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.errors },
        { status: 400 }
      );
    }
    
    const appError = handleApiError(error);
    return NextResponse.json(
      { success: false, message: appError.message },
      { status: appError.statusCode }
    );
  }
}
```

---

### 6. HTTPS 및 보안 헤더 설정

#### ❌ 문제점
- [ ] 보안 헤더 미설정
- [ ] CORS 정책 부재

#### ✅ 해결 방안
```typescript
// next.config.ts 개선
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## 🟡 High Priority (높음) - 조기 해결 권장

### 7. 성능 최적화

#### ❌ 문제점
- [ ] 이미지 최적화 부재
- [ ] 코드 스플리팅 부족
- [ ] 불필요한 리렌더링 발생
- [ ] API 요청 중복

#### ✅ 해결 방안

**1) React Query 도입 (데이터 캐싱)**
```bash
npm install @tanstack/react-query
```

```typescript
// app/providers.tsx 생성
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분
            cacheTime: 5 * 60 * 1000, // 5분
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

```typescript
// app/layout.tsx에서 사용
import { Providers } from './providers';

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <LayoutWrapper>{children}</LayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}
```

**2) 컴포넌트 메모이제이션**
```typescript
// app/page.tsx 개선
'use client';

import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

// 카드 컴포넌트 메모이제이션
const StatCard = memo(({ title, value, icon, color }: StatCardProps) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* ... */}
    </div>
  );
});

export default function Home() {
  // React Query로 데이터 페칭
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  // 계산 비용이 큰 값은 useMemo로 최적화
  const lowStockProducts = useMemo(
    () => products.filter(p => p.quantity < p.minStock),
    [products]
  );

  const totalStock = useMemo(
    () => products.reduce((sum, p) => sum + p.quantity, 0),
    [products]
  );

  // ...
}
```

**3) 동적 import로 코드 스플리팅**
```typescript
// 무거운 컴포넌트는 동적 로드
import dynamic from 'next/dynamic';

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), {
  loading: () => <p>스캐너 로딩 중...</p>,
  ssr: false, // 클라이언트에서만 실행
});
```

---

### 8. Toast 알림 시스템

#### ❌ 문제점
- [ ] `alert()` 사용으로 UX 저하
- [ ] 에러/성공 메시지 일관성 부족

#### ✅ 해결 방안
```bash
npm install react-hot-toast
```

```typescript
// app/layout.tsx
import { Toaster } from 'react-hot-toast';

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
```

```typescript
// lib/toast.ts
import toast from 'react-hot-toast';

export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 3000,
    style: {
      background: '#10B981',
      color: '#fff',
    },
  });
};

export const showError = (message: string) => {
  toast.error(message, {
    duration: 4000,
    style: {
      background: '#EF4444',
      color: '#fff',
    },
  });
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};
```

---

### 9. 로딩 상태 개선

#### ❌ 문제점
- [ ] 로딩 중 화면 일관성 부족
- [ ] Skeleton UI 부재

#### ✅ 해결 방안
```typescript
// components/LoadingSkeleton.tsx
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4 mb-4">
          <div className="h-4 bg-gray-200 rounded flex-1"></div>
          <div className="h-4 bg-gray-200 rounded flex-1"></div>
          <div className="h-4 bg-gray-200 rounded flex-1"></div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-32 bg-gray-200 rounded-lg"></div>
    </div>
  );
}
```

---

### 10. 페이지네이션 구현

#### ❌ 문제점
- [ ] 모든 데이터를 한 번에 로드 (성능 저하)
- [ ] 대량 데이터 처리 시 브라우저 멈춤 가능

#### ✅ 해결 방안
```typescript
// lib/api/products.ts에 페이지네이션 추가
export async function getProductsPaginated(page: number = 1, pageSize: number = 20) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: data.map(item => ({
      ...item,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    })) as Product[],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}
```

```typescript
// components/Pagination.tsx
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  return (
    <div className="flex justify-center items-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-4 py-2 border rounded disabled:opacity-50"
      >
        이전
      </button>
      
      <span className="px-4">
        {currentPage} / {totalPages}
      </span>
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-4 py-2 border rounded disabled:opacity-50"
      >
        다음
      </button>
    </div>
  );
}
```

---

### 11. 모바일 반응형 개선

#### ❌ 문제점
- [ ] 테이블이 모바일에서 깨짐
- [ ] 사이드바 모바일 최적화 부족
- [ ] 터치 인터랙션 미흡

#### ✅ 해결 방안
```typescript
// components/ResponsiveTable.tsx
export function ResponsiveTable({ data, columns }: TableProps) {
  return (
    <>
      {/* 데스크톱: 일반 테이블 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          {/* 테이블 내용 */}
        </table>
      </div>
      
      {/* 모바일: 카드 형식 */}
      <div className="md:hidden space-y-4">
        {data.map((item, idx) => (
          <div key={idx} className="bg-white p-4 rounded-lg shadow">
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between py-2 border-b last:border-b-0">
                <span className="font-medium text-gray-600">{col.label}</span>
                <span>{item[col.key]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
```

---

### 12. Excel 내보내기 기능

#### ❌ 문제점
- [ ] 데이터 내보내기 기능 없음
- [ ] 보고서 생성 어려움

#### ✅ 해결 방안
```bash
# 이미 설치됨
npm install xlsx
```

```typescript
// lib/exportExcel.ts
import * as XLSX from 'xlsx';

export function exportToExcel<T>(
  data: T[],
  filename: string,
  sheetName: string = 'Sheet1'
) {
  // 워크북 생성
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 파일 다운로드
  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// 사용 예
export function exportProducts(products: Product[]) {
  const exportData = products.map(p => ({
    '제품명': p.name,
    'SKU': p.sku,
    '카테고리': p.category,
    '수량': p.quantity,
    '단위': p.unit,
    '최소재고': p.minStock,
    '단가': p.price,
    '위치': p.location,
    '등록일': p.createdAt.toLocaleDateString('ko-KR'),
  }));

  exportToExcel(exportData, 'products', '제품목록');
}
```

---

## 🟢 Medium Priority (중간) - 점진적 개선

### 13. 테스트 코드 작성

#### ❌ 문제점
- [ ] 단위 테스트 없음
- [ ] E2E 테스트 없음
- [ ] 버그 발생 시 디버깅 어려움

#### ✅ 해결 방안
```bash
# 테스트 라이브러리 설치
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D @playwright/test # E2E 테스트
```

```typescript
// lib/api/products.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getProducts, createProduct } from './products';

describe('Products API', () => {
  it('should fetch all products', async () => {
    const products = await getProducts();
    expect(Array.isArray(products)).toBe(true);
  });

  it('should create a new product', async () => {
    const newProduct = {
      name: '테스트 제품',
      sku: 'TEST-001',
      category: '전자제품',
      quantity: 10,
      unit: '개',
      minStock: 5,
      price: 10000,
      location: 'A-1-01',
    };

    const product = await createProduct(newProduct);
    expect(product.name).toBe(newProduct.name);
  });
});
```

---

### 14. 실시간 알림 시스템

#### ❌ 문제점
- [ ] 재고 부족 시 실시간 알림 없음
- [ ] 작업 배정 시 알림 없음

#### ✅ 해결 방안
```typescript
// lib/realtime.ts
import { supabase } from './supabase';

export function subscribeToLowStockAlerts(callback: (product: Product) => void) {
  const channel = supabase
    .channel('low-stock-alerts')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'products',
        filter: 'quantity=lt.min_stock',
      },
      (payload) => {
        console.log('재고 부족 알림:', payload);
        callback(payload.new as Product);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
```

---

### 15. 감사 로그 (Audit Log)

#### ❌ 문제점
- [ ] 데이터 변경 이력 추적 불가
- [ ] 책임 소재 불명확

#### ✅ 해결 방안
```sql
-- supabase-audit-log.sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

```typescript
// lib/auditLog.ts
export async function logAudit({
  userId,
  action,
  tableName,
  recordId,
  oldData,
  newData,
}: AuditLogParams) {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData,
    new_data: newData,
    ip_address: null, // 서버에서 가져오기
    user_agent: navigator.userAgent,
  });
}
```

---

### 16. 국제화 (i18n)

#### ❌ 문제점
- [ ] 한국어만 지원
- [ ] 다국어 고객사 지원 불가

#### ✅ 해결 방안
```bash
npm install next-intl
```

```typescript
// messages/ko.json
{
  "common": {
    "save": "저장",
    "cancel": "취소",
    "delete": "삭제"
  },
  "dashboard": {
    "title": "대시보드",
    "totalProducts": "총 제품 수"
  }
}

// messages/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "dashboard": {
    "title": "Dashboard",
    "totalProducts": "Total Products"
  }
}
```

---

### 17. 백업 및 복구 시스템

#### ❌ 문제점
- [ ] 정기 백업 계획 없음
- [ ] 재해 복구 절차 없음

#### ✅ 해결 방안
```bash
# Supabase CLI로 백업
supabase db dump -f backup.sql

# 복구
psql -h db.your-project.supabase.co -U postgres -d postgres -f backup.sql
```

**자동 백업 스크립트 (GitHub Actions)**
```yaml
# .github/workflows/backup.yml
name: Database Backup

on:
  schedule:
    - cron: '0 2 * * *' # 매일 새벽 2시

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Supabase CLI
        run: npm install -g supabase
      
      - name: Backup Database
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          PROJECT_ID: ${{ secrets.PROJECT_ID }}
        run: |
          supabase link --project-ref $PROJECT_ID
          supabase db dump -f backup-$(date +%Y%m%d).sql
      
      - name: Upload to S3 or GitHub
        # ... 백업 파일 업로드
```

---

### 18. 성능 모니터링

#### ❌ 문제점
- [ ] 성능 저하 원인 파악 어려움
- [ ] 사용자 경험 지표 부재

#### ✅ 해결 방안
```bash
# Sentry 설치 (에러 추적 & 성능 모니터링)
npm install @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10%의 트랜잭션 추적
  environment: process.env.NODE_ENV,
});
```

---

## ⚪ Low Priority (낮음) - 추후 개선

### 19. PWA (Progressive Web App) 지원

#### ✅ 해결 방안
```bash
npm install next-pwa
```

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
});

module.exports = withPWA({
  // 기존 설정
});
```

---

### 20. 다크 모드

#### ✅ 해결 방안
```bash
npm install next-themes
```

```typescript
// app/providers.tsx
import { ThemeProvider } from 'next-themes';

export function Providers({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      {children}
    </ThemeProvider>
  );
}
```

---

### 21. 대시보드 위젯 커스터마이징

#### ✅ 해결 방안
- 사용자가 대시보드 위젯 배치 변경
- React Grid Layout 사용

---

### 22. 바코드 배치 인쇄

#### ✅ 해결 방안
- 여러 제품 라벨을 A4 용지 한 장에 인쇄
- 라벨 템플릿 선택 기능

---

### 23. 고급 검색 및 필터

#### ✅ 해결 방안
- 다중 조건 검색
- 저장된 검색 필터
- 빠른 필터 버튼

---

### 24. 데이터 분석 대시보드

#### ✅ 해결 방안
- Chart.js 또는 Recharts 사용
- 매출 추이, 재고 회전율, ABC 분석 등

```bash
npm install recharts
```

---

## 💡 개선 로드맵

### Phase 1: 필수 개선 (1-2주)
1. ✅ 환경 변수 설정
2. ✅ 인증 시스템 구현
3. ✅ RLS 정책 강화
4. ✅ 에러 처리 개선
5. ✅ 데이터 검증

### Phase 2: 품질 향상 (2-4주)
6. ✅ 성능 최적화 (React Query, 메모이제이션)
7. ✅ Toast 알림 시스템
8. ✅ 로딩 상태 개선
9. ✅ 페이지네이션
10. ✅ 모바일 반응형 개선
11. ✅ Excel 내보내기

### Phase 3: 안정화 (4-6주)
12. ✅ 테스트 코드 작성
13. ✅ 실시간 알림
14. ✅ 감사 로그
15. ✅ 백업 시스템
16. ✅ 성능 모니터링

### Phase 4: 고도화 (장기)
17. ✅ 국제화 (i18n)
18. ✅ PWA 지원
19. ✅ 다크 모드
20. ✅ 고급 분석 기능

---

## 📊 우선순위 점수표

| 항목 | 중요도 | 긴급도 | 난이도 | 우선순위 |
|------|-------|-------|-------|---------|
| 환경 변수 | 10 | 10 | 1 | 🔴 Critical |
| 인증 시스템 | 10 | 9 | 5 | 🔴 Critical |
| RLS 정책 | 10 | 9 | 3 | 🔴 Critical |
| 에러 처리 | 9 | 8 | 3 | 🔴 Critical |
| 데이터 검증 | 9 | 8 | 4 | 🔴 Critical |
| 보안 헤더 | 9 | 7 | 2 | 🔴 Critical |
| 성능 최적화 | 8 | 7 | 6 | 🟡 High |
| Toast 알림 | 7 | 6 | 2 | 🟡 High |
| 페이지네이션 | 8 | 6 | 3 | 🟡 High |
| 모바일 반응형 | 8 | 5 | 5 | 🟡 High |
| Excel 내보내기 | 7 | 5 | 3 | 🟡 High |
| 테스트 코드 | 8 | 4 | 7 | 🟢 Medium |
| 실시간 알림 | 6 | 4 | 5 | 🟢 Medium |
| 감사 로그 | 7 | 3 | 4 | 🟢 Medium |
| 국제화 | 5 | 3 | 6 | 🟢 Medium |
| PWA 지원 | 4 | 2 | 5 | ⚪ Low |
| 다크 모드 | 3 | 2 | 3 | ⚪ Low |

---

## 🎯 다음 단계

### 즉시 실행
1. `.env.example` 파일 생성
2. 환경 변수 검증 로직 추가
3. 인증 시스템 기본 구조 설계
4. RLS 정책 프로덕션용으로 변경 계획

### 1주일 내
1. 로그인/로그아웃 페이지 구현
2. 미들웨어로 인증 검증
3. 에러 처리 표준화
4. Zod로 데이터 검증

### 1개월 내
1. React Query 도입
2. Toast 알림 시스템 구축
3. 페이지네이션 적용
4. 모바일 반응형 개선

---

## 📝 참고 자료

- [Next.js 보안 가이드](https://nextjs.org/docs/app/building-your-application/configuring/security-best-practices)
- [Supabase RLS 가이드](https://supabase.com/docs/guides/auth/row-level-security)
- [React Performance 최적화](https://react.dev/learn/render-and-commit#optimizing-performance)
- [TypeScript Best Practices](https://typescript-eslint.io/rules/)

---

**작성자**: AI Assistant  
**검토 필요**: 개발팀 리드, 보안 담당자, PM

---





