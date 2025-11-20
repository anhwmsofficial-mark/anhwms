# 🚀 ANH 홈페이지 배포 가이드

## ✅ 빌드 성공 확인

빌드가 정상적으로 완료되었습니다!
- **총 59개 라우트** 생성
- **정적 페이지**: 56개 (SEO 최적화)
- **동적 API**: 11개 (서버 렌더링)

새로 생성된 주요 페이지:
- ✓ `/` - ANH 공식 홈페이지
- ✓ `/portal` - 포털 허브
- ✓ `/dashboard` - 고객사 WMS

---

## 🌐 배포 옵션

### 옵션 1: Vercel (권장) ⭐

**장점:**
- Next.js 개발사가 직접 운영
- 자동 CI/CD
- 글로벌 CDN
- 무료 SSL 인증서
- 프리뷰 배포
- 무료 플랜 제공

#### 1-A. Vercel CLI로 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 배포 (프로덕션)
vercel --prod
```

#### 1-B. Vercel Git 연동 (추천)

1. GitHub/GitLab에 코드 푸시
2. [vercel.com](https://vercel.com) 접속
3. "New Project" 클릭
4. Git 저장소 연동
5. 자동 배포 완료! 🎉

**설정:**
- **Framework Preset**: Next.js
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `.next` (자동)
- **Install Command**: `npm install`

**환경 변수 설정 (필요시):**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

---

### 옵션 2: Netlify

**장점:**
- 무료 플랜
- 간편한 설정
- Form 처리 내장
- 서버리스 함수 지원

```bash
# Netlify CLI 설치
npm i -g netlify-cli

# 로그인
netlify login

# 배포
netlify deploy --prod
```

**netlify.toml 설정:**
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

---

### 옵션 3: 자체 서버 (Ubuntu/CentOS)

#### 3-1. Node.js 서버로 직접 실행

```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 시작
npm start
# 또는
node .next/standalone/server.js
```

#### 3-2. PM2로 프로세스 관리

```bash
# PM2 설치
npm i -g pm2

# 앱 시작
pm2 start npm --name "anh-homepage" -- start

# 자동 재시작 설정
pm2 startup
pm2 save

# 상태 확인
pm2 status
pm2 logs anh-homepage
```

#### 3-3. Nginx 리버스 프록시 설정

```nginx
# /etc/nginx/sites-available/anh-group.com
server {
    listen 80;
    server_name anh-group.com www.anh-group.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# SSL 인증서 (Let's Encrypt)
# sudo certbot --nginx -d anh-group.com -d www.anh-group.com
```

#### 3-4. 시스템 서비스 등록

```bash
# /etc/systemd/system/anh-homepage.service
[Unit]
Description=ANH Homepage
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/anh-homepage
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
# 서비스 시작
sudo systemctl enable anh-homepage
sudo systemctl start anh-homepage
sudo systemctl status anh-homepage
```

---

### 옵션 4: Docker 컨테이너

#### Dockerfile 생성

```dockerfile
# D:\Projects\ANH_WMS\Dockerfile
FROM node:20-alpine AS base

# 의존성 설치
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# 빌드
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 프로덕션 이미지
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### Docker Compose 설정

```yaml
# docker-compose.yml
version: '3.8'

services:
  anh-homepage:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_KEY}
    restart: unless-stopped
```

#### 실행

```bash
# 이미지 빌드 & 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down
```

---

### 옵션 5: AWS (EC2, S3, CloudFront)

#### 5-1. AWS Amplify (가장 간단)

```bash
# Amplify CLI 설치
npm i -g @aws-amplify/cli

# 초기화
amplify init

# 배포
amplify publish
```

#### 5-2. EC2 + S3 + CloudFront

1. **EC2**: Next.js 서버 실행
2. **S3**: 정적 파일 호스팅
3. **CloudFront**: CDN 배포
4. **Route 53**: DNS 관리

---

## 🔧 배포 전 체크리스트

### 1. 환경 변수 설정

```bash
# .env.production
NEXT_PUBLIC_SITE_URL=https://anh-group.com
NEXT_PUBLIC_API_URL=https://api.anh-group.com
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_key
```

### 2. next.config.ts 최적화

```typescript
// next.config.ts
const nextConfig = {
  output: 'standalone', // Docker 배포시
  compress: true, // Gzip 압축
  images: {
    domains: ['your-cdn.com'],
    formats: ['image/avif', 'image/webp'],
  },
  // 정적 파일 최적화
  experimental: {
    optimizeCss: true,
  },
};
```

### 3. 빌드 최적화

```json
// package.json
{
  "scripts": {
    "build": "next build",
    "start": "next start -p 3000",
    "analyze": "ANALYZE=true next build"
  }
}
```

### 4. 보안 설정

```typescript
// next.config.ts
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ];
  },
};
```

---

## 📊 성능 최적화

### 1. 이미지 최적화

```typescript
// next/image 사용
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="ANH Logo"
  width={200}
  height={50}
  priority // LCP 최적화
/>
```

### 2. 폰트 최적화

```typescript
// app/layout.tsx (이미 적용됨)
import { Geist } from 'next/font/google';

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: 'swap', // FOIT 방지
});
```

### 3. 번들 분석

```bash
# webpack-bundle-analyzer 설치
npm i -D @next/bundle-analyzer

# 분석 실행
ANALYZE=true npm run build
```

---

## 🔍 SEO 최적화

### 1. sitemap.xml 생성

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://anh-group.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://anh-group.com/portal',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // ... 더 많은 페이지
  ];
}
```

### 2. robots.txt 생성

```typescript
// app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard/'],
    },
    sitemap: 'https://anh-group.com/sitemap.xml',
  };
}
```

### 3. Open Graph 메타태그

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  title: "ANH Group - 글로벌 물류 플랫폼",
  description: "국내·해외 풀필먼트와 IT 솔루션을 하나의 플랫폼으로 제공하는 ANH 그룹",
  openGraph: {
    title: 'ANH Group',
    description: '글로벌 물류, 한 번에 연결되는 ANH 그룹',
    url: 'https://anh-group.com',
    siteName: 'ANH Group',
    images: [
      {
        url: 'https://anh-group.com/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ANH Group',
    description: '글로벌 물류 플랫폼',
    images: ['https://anh-group.com/twitter-image.jpg'],
  },
};
```

---

## 📈 모니터링 설정

### 1. Google Analytics

```typescript
// app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XXXXXXXXXX');
          `}
        </Script>
      </body>
    </html>
  );
}
```

### 2. Vercel Analytics (Vercel 배포시)

```bash
npm i @vercel/analytics
```

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

---

## 🚀 배포 실행 (Vercel 권장)

### 빠른 배포 3단계

```bash
# 1. Vercel CLI 설치
npm i -g vercel

# 2. 로그인
vercel login

# 3. 배포
vercel --prod
```

배포 완료! 🎉
- **URL**: https://your-project.vercel.app
- **커스텀 도메인**: anh-group.com 연결 가능

---

## 📞 문의

배포 관련 문제가 발생하면:
- **이메일**: dev@anh-group.com
- **문서**: [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- **Vercel 문서**: [vercel.com/docs](https://vercel.com/docs)

---

© 2024 ANH Group. All rights reserved.

