# ANH 공식 홈페이지 가이드

## 📋 개요

ANH Group 공식 홈페이지는 본사(ANH)와 자회사(AN, AH)를 통합적으로 소개하는 브랜드 웹사이트입니다.

## 🏗️ 브랜드 구조

### ANH (Advanced Navigate Hub) - 본사
- 그룹의 중심, 통합 사업 소개
- 국내·해외 물류 + IT 총괄

### AN (Advanced Network) - 국내 물류
- 국내 풀필먼트, 3PL, 표준 운영
- 김포, 인천 거점 운영

### AH (Abundant Happiness) - 해외 물류
- 중국 중심 해외배송, 크로스보더 물류
- 국제 배송 및 통관 전문

## 🗂️ 사이트 구조

```
/                           → 메인 홈페이지
  ├─ #about                 → 회사소개 섹션
  ├─ #services              → 서비스 섹션
  ├─ #companies             → 자회사(AN/AH) 섹션
  ├─ #clients               → 고객사 & 사례 섹션
  ├─ #news                  → 뉴스룸 섹션
  └─ #contact               → 문의하기 섹션

/portal                     → 포털 허브 (브릿지 페이지)
  ├─ 고객사 전용 WMS        → /dashboard
  ├─ 내부 운영자 콘솔       → /admin
  └─ AH 해외 포털 (준비중)

/dashboard                  → 고객사 WMS 대시보드
/admin                      → 관리자 콘솔
```

## 📄 페이지별 설명

### 1. 메인 홈페이지 (`/`)

**컴포넌트 구성:**
- `HomeNavbar` - 네비게이션 바 (GNB)
- `HeroSection` - 히어로 섹션 (메인 카피, CTA)
- `AboutSection` - ANH 그룹 소개
- `ServicesSection` - 4가지 핵심 서비스
- `CompaniesSection` - AN/AH 자회사 소개
- `ClientsSection` - 고객사 로고 및 성공사례
- `ProcessSection` - 물류 프로세스 흐름
- `NewsSection` - 최신 뉴스 및 공지
- `ContactSection` - 문의하기 폼
- `Footer` - 푸터 (회사정보, 링크)

**주요 기능:**
- 부드러운 스크롤 네비게이션
- 반응형 디자인 (모바일/태블릿/데스크톱)
- 문의 폼 제출

### 2. Portal 페이지 (`/portal`)

**목적:** 
각종 대시보드 및 관리 시스템으로의 통합 진입점

**포털 종류:**
1. **고객사 전용 WMS** (`/dashboard`)
   - 화주사를 위한 재고 관리
   - 주문 처리 및 추적
   
2. **내부 운영자 콘솔** (`/admin`)
   - ANH 직원 전용
   - 전체 주문/고객사 관리
   
3. **AH 해외 포털** (준비중)
   - 크로스보더 전용 시스템

### 3. 대시보드 (`/dashboard`)

기존 WMS 대시보드가 여기로 이동되었습니다.
- 재고 관리
- 입출고 내역
- 통계 대시보드

## 🎨 디자인 시스템

### 색상 팔레트

```css
Primary:
- Blue: #2563EB (blue-600)
- Indigo: #4F46E5 (indigo-600)

Secondary:
- Purple: #9333EA (purple-600)
- Emerald: #10B981 (emerald-600)

Neutral:
- Gray-50 ~ Gray-900
```

### 타이포그래피

- **헤드라인:** 4xl ~ 7xl, font-bold
- **본문:** base ~ xl, font-normal
- **캡션:** sm ~ xs, font-medium

### 반응형 브레이크포인트

```
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1536px
```

## 🚀 개발 가이드

### 로컬 실행

```bash
npm run dev
```

### 빌드

```bash
npm run build
npm start
```

### 주요 의존성

- **Next.js 16** - React 프레임워크
- **Tailwind CSS 4** - 스타일링
- **Heroicons** - 아이콘
- **TypeScript** - 타입 안정성

## 📝 컴포넌트 파일 위치

```
components/home/
├── HomeNavbar.tsx          # 메인 네비게이션
├── HeroSection.tsx         # 히어로 섹션
├── AboutSection.tsx        # 회사 소개
├── ServicesSection.tsx     # 서비스 카드
├── CompaniesSection.tsx    # AN/AH 소개
├── ClientsSection.tsx      # 고객사례
├── ProcessSection.tsx      # 프로세스 플로우
├── NewsSection.tsx         # 뉴스룸
├── ContactSection.tsx      # 문의 폼
└── Footer.tsx              # 푸터
```

## 🔧 커스터마이징

### 1. 컨텐츠 수정

각 섹션 컴포넌트 파일에서 직접 텍스트와 데이터를 수정할 수 있습니다.

예시: 서비스 추가/수정
```typescript
// components/home/ServicesSection.tsx
const services = [
  {
    icon: TruckIcon,
    title: '새로운 서비스',
    subtitle: 'New',
    description: '서비스 설명...',
    // ...
  },
];
```

### 2. 스타일 수정

모든 컴포넌트는 Tailwind CSS를 사용합니다.

```typescript
<div className="bg-blue-600 text-white px-4 py-2 rounded-lg">
  버튼
</div>
```

### 3. 새로운 섹션 추가

1. `components/home/`에 새 컴포넌트 생성
2. `app/page.tsx`에 import 및 추가

```typescript
import NewSection from '@/components/home/NewSection';

export default function HomePage() {
  return (
    <>
      {/* ... */}
      <NewSection />
      {/* ... */}
    </>
  );
}
```

## 🎯 주요 메시지

### 브랜드 슬로건
**"Accompany & Navigate Hub - 함께 동행하는 물류 플랫폼"**

### 핵심 가치
1. **원스톱 솔루션** - 입고부터 배송, CS까지
2. **시스템 통합** - WMS, API, 실시간 데이터
3. **글로벌 네트워크** - 국내·해외 완벽 커버

## 📞 문의하기

문의 폼은 `ContactSection` 컴포넌트에서 처리됩니다.
실제 구현 시 백엔드 API 연동이 필요합니다.

```typescript
// components/home/ContactSection.tsx
const handleSubmit = async (e: React.FormEvent) => {
  // TODO: API 연동
  // await fetch('/api/contact', { ... });
};
```

## 🔐 인증 & 권한

Portal 페이지에서 각 시스템으로 라우팅되며,
실제 인증은 각 대시보드에서 처리됩니다.

- `/dashboard` - 고객사 계정 필요
- `/admin` - 관리자 계정 필요

## 📱 모바일 최적화

모든 섹션은 모바일 우선으로 설계되었습니다:
- 햄버거 메뉴
- 터치 친화적 버튼 크기
- 반응형 그리드 레이아웃
- 최적화된 이미지 로딩

## 🚀 배포

### Vercel (권장)
```bash
vercel --prod
```

### 환경 변수
```env
# .env.local
NEXT_PUBLIC_SITE_URL=https://anh-group.com
NEXT_PUBLIC_API_URL=https://api.anh-group.com
```

## 📈 향후 개선사항

- [ ] 실제 고객사 로고 이미지
- [ ] 뉴스룸 CMS 연동
- [ ] 다국어 지원 (i18n)
- [ ] SEO 최적화
- [ ] 애니메이션 효과 강화
- [ ] AH 해외 포털 개발
- [ ] 문의 폼 API 연동
- [ ] Google Analytics 연동

## 🙋‍♂️ 지원

문제가 발생하거나 질문이 있으시면:
- 이메일: dev@anh-group.com
- 내부 슬랙: #dev-support

---

© 2024 ANH Group. All rights reserved.

