# 🚀 ANH WMS v2 배포 가이드

## 📋 사전 준비사항

### 1. Supabase 환경변수
프로젝트에 다음 환경변수가 설정되어 있는지 확인하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 2. Supabase 데이터베이스 마이그레이션

Supabase SQL Editor에서 다음 순서대로 SQL 파일을 실행하세요:

```
1. migrations/00_cleanup.sql (기존 v2 테이블 삭제, 첫 실행이면 스킵)
2. migrations/01_core_customer.sql
3. migrations/02_warehouse_product_inventory.sql
4. migrations/03_inbound_outbound_work_task.sql
5. migrations/04_returns_shipping_extra.sql
6. migrations/05_sample_data.sql (샘플 데이터)
7. migrations/06_sample_products_inventory.sql (샘플 상품)
8. migrations/07_sample_orders.sql (샘플 주문)
```

---

## 🔧 Vercel 배포 설정

### 방법 1: Vercel CLI를 통한 배포

```bash
# Vercel CLI 설치 (필요시)
npm i -g vercel

# 프로젝트 빌드 테스트
npm run build

# Vercel에 배포
vercel

# 프로덕션 배포
vercel --prod
```

### 방법 2: Vercel Dashboard를 통한 배포

1. https://vercel.com 접속
2. 프로젝트 선택
3. Settings → Environment Variables에서 환경변수 설정:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deployments → Redeploy

---

## ✅ 배포 후 체크리스트

### 1. 기본 페이지 접근 확인
- ✅ 홈페이지: https://your-domain.vercel.app/
- ✅ 포털: https://your-domain.vercel.app/portal
- ✅ 대시보드: https://your-domain.vercel.app/dashboard
- ✅ Admin 고객사: https://your-domain.vercel.app/admin/customers
- ✅ Admin 브랜드: https://your-domain.vercel.app/admin/brands
- ✅ Admin 창고: https://your-domain.vercel.app/admin/warehouses
- ✅ Admin 배송사: https://your-domain.vercel.app/admin/shipping

### 2. API 기능 확인
- ✅ 고객사 목록 조회
- ✅ 브랜드 목록 조회
- ✅ 창고 목록 조회
- ✅ 상품 목록 조회
- ✅ 배송사 목록 조회

### 3. 다국어 기능 확인
- ✅ 한국어/영어/중국어 전환
- ✅ 모든 페이지 번역 적용

### 4. 사이드바 동작 확인
- ✅ 홈페이지에서 사이드바 숨김
- ✅ 포털에서 사이드바 숨김
- ✅ 대시보드/Admin에서 사이드바 표시

---

## 🐛 트러블슈팅

### 문제 1: API 호출 실패
```
Error: Failed to fetch
```
**해결방법:**
- Vercel 환경변수에 `SUPABASE_SERVICE_ROLE_KEY` 확인
- Supabase RLS 정책 확인 (모든 정책이 `ENABLE`)

### 문제 2: 빌드 에러
```
Error: Cannot find module '@/lib/supabase-admin'
```
**해결방법:**
- `tsconfig.json`의 `paths` 설정 확인
- `npm install` 재실행

### 문제 3: 데이터가 안 보임
**해결방법:**
- Supabase SQL Editor에서 샘플 데이터 마이그레이션 재실행
- 브라우저 콘솔에서 API 응답 확인

---

## 📊 성능 최적화 권장사항

### 1. 이미지 최적화
- Next.js Image 컴포넌트 사용
- WebP 포맷 사용
- 적절한 이미지 사이즈 설정

### 2. API 캐싱
- SWR 또는 React Query 도입
- API 응답 캐싱

### 3. 코드 스플리팅
- Dynamic Import 활용
- Route-based splitting 확인

---

## 📚 추가 개발 가이드

### Admin 페이지에 CRUD 기능 추가하기

1. **생성(Create)** 기능 추가:
```typescript
const handleCreate = async (data) => {
  const response = await fetch('/api/admin/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (response.ok) {
    fetchCustomers(); // 목록 새로고침
  }
};
```

2. **수정(Update)** 기능 추가:
```typescript
const handleUpdate = async (id, data) => {
  const response = await fetch(`/api/admin/customers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (response.ok) {
    fetchCustomers();
  }
};
```

3. **삭제(Delete)** 기능 추가:
```typescript
const handleDelete = async (id) => {
  if (confirm('정말 삭제하시겠습니까?')) {
    const response = await fetch(`/api/admin/customers/${id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      fetchCustomers();
    }
  }
};
```

---

## 🎯 다음 단계 (추가 개발 권장사항)

1. **인증/권한 시스템**
   - Supabase Auth 연동
   - Role-based Access Control (RBAC)

2. **대시보드 통계**
   - 실시간 재고 현황
   - 주문 처리 현황
   - 매출/정산 통계

3. **알림 시스템**
   - 재고 부족 알림
   - 주문 지연 알림
   - 시스템 장애 알림

4. **보고서 생성**
   - Excel/PDF export
   - 정산 보고서
   - 재고 보고서

5. **모바일 최적화**
   - 반응형 디자인 강화
   - 모바일 전용 UI

---

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. Vercel 로그 (Deployments → Logs)
2. 브라우저 콘솔 (F12 → Console)
3. Supabase 로그 (Project → Logs)

배포 성공을 기원합니다! 🚀
