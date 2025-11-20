# 🎨 레이아웃 업데이트 완료

## ✅ 수정 내용

### 문제점
- 홈페이지(`/`)와 포털 페이지(`/portal`)에서도 좌측 사이드바가 노출됨
- 공식 홈페이지에는 사이드바가 어울리지 않음

### 해결 방법
`LayoutWrapper.tsx`를 수정하여 **경로별로 다른 레이아웃 적용**

---

## 📱 레이아웃 구조

### 1. 사이드바 없는 레이아웃 (홈페이지 스타일)

**적용 페이지:**
- `/` - ANH 공식 홈페이지
- `/portal` - 포털 허브

**특징:**
- ✅ 좌측 사이드바 없음
- ✅ 전체 너비 사용
- ✅ 자체 네비게이션 바 (HomeNavbar)
- ✅ 깔끔한 랜딩 페이지 스타일

### 2. 사이드바 있는 레이아웃 (WMS/관리자 스타일)

**적용 페이지:**
- `/dashboard` - 고객사 WMS
- `/admin` - 관리자 콘솔
- `/cs` - CS 시스템
- `/inventory` - 재고 관리
- `/inbound` - 입고 관리
- `/outbound` - 출고 관리
- `/orders` - 주문 관리
- `/global-fulfillment` - 글로벌 풀필먼트
- 기타 모든 WMS 관련 페이지

**특징:**
- ✅ 좌측 사이드바 포함
- ✅ WMS 네비게이션 메뉴
- ✅ 전통적인 대시보드 레이아웃

---

## 🔧 기술적 구현

### LayoutWrapper.tsx 주요 코드

```typescript
const pathname = usePathname();

// 사이드바를 숨길 경로들
const noSidebarPaths = ['/', '/portal'];
const shouldShowSidebar = !noSidebarPaths.includes(pathname);

return (
  <LayoutContext.Provider value={{ sidebarOpen, setSidebarOpen, toggleSidebar }}>
    {shouldShowSidebar ? (
      // WMS/관리자 시스템 레이아웃 (사이드바 포함)
      <div className="flex h-screen overflow-hidden bg-gray-100">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    ) : (
      // 홈페이지/포털 레이아웃 (사이드바 없음)
      <div className="min-h-screen">
        {children}
      </div>
    )}
  </LayoutContext.Provider>
);
```

### 작동 방식

1. **usePathname()** 훅으로 현재 경로 확인
2. **noSidebarPaths** 배열에 사이드바를 숨길 경로 정의
3. 경로에 따라 **조건부 렌더링**
   - 홈페이지/포털: 사이드바 없는 레이아웃
   - WMS 페이지: 사이드바 있는 레이아웃

---

## 🌐 배포 완료

### 새 배포 URL
```
https://anhwms.vercel.app
```

### 업데이트 내용
- ✅ 홈페이지: 사이드바 제거됨
- ✅ 포털 페이지: 사이드바 제거됨
- ✅ WMS 대시보드: 사이드바 유지
- ✅ 관리자 콘솔: 사이드바 유지

---

## 📊 페이지별 레이아웃

| 페이지 | 경로 | 사이드바 | 레이아웃 스타일 |
|--------|------|----------|----------------|
| 공식 홈페이지 | `/` | ❌ 없음 | 풀 너비, HomeNavbar |
| 포털 허브 | `/portal` | ❌ 없음 | 풀 너비, 간단한 헤더 |
| 고객사 WMS | `/dashboard` | ✅ 있음 | 사이드바 + 메인 컨텐츠 |
| 관리자 콘솔 | `/admin` | ✅ 있음 | 사이드바 + 메인 컨텐츠 |
| CS 시스템 | `/cs` | ✅ 있음 | 사이드바 + 메인 컨텐츠 |
| 재고 관리 | `/inventory` | ✅ 있음 | 사이드바 + 메인 컨텐츠 |
| 입고 관리 | `/inbound` | ✅ 있음 | 사이드바 + 메인 컨텐츠 |
| 출고 관리 | `/outbound` | ✅ 있음 | 사이드바 + 메인 컨텐츠 |

---

## 🎯 사용자 경험

### Before (이전)
```
홈페이지 접속 → 좌측에 WMS 사이드바 보임 (어색함)
```

### After (현재)
```
홈페이지 접속 → 깔끔한 랜딩 페이지 (사이드바 없음)
                ↓
포털 선택 → 시스템별 진입
                ↓
WMS 로그인 → 사이드바 나타남 (자연스러움)
```

---

## 🔄 추가 확장 가능

나중에 더 많은 페이지에서 사이드바를 숨기고 싶다면:

```typescript
// LayoutWrapper.tsx
const noSidebarPaths = [
  '/',
  '/portal',
  '/about',        // 추가 예시
  '/pricing',      // 추가 예시
];
```

또는 패턴 매칭으로:

```typescript
const shouldShowSidebar = 
  !pathname.startsWith('/') || 
  pathname.startsWith('/dashboard') ||
  pathname.startsWith('/admin');
```

---

## ✅ 테스트 완료

### 확인 항목
- ✅ 홈페이지 사이드바 제거 확인
- ✅ 포털 페이지 사이드바 제거 확인
- ✅ WMS 대시보드 사이드바 유지 확인
- ✅ 관리자 콘솔 사이드바 유지 확인
- ✅ 빌드 성공
- ✅ Vercel 배포 완료

---

## 🚀 지금 확인하세요!

**홈페이지 (사이드바 없음):**
https://anhwms.vercel.app

**포털 (사이드바 없음):**
https://anhwms.vercel.app/portal

**대시보드 (사이드바 있음):**
https://anhwms.vercel.app/dashboard

---

**배포 시간:** 2025-11-20 10:30 KST  
**배포 ID:** anhwms-dlwnohuju

© 2024 ANH Group. All rights reserved.

