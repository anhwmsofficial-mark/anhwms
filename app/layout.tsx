import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ANH WMS | 글로벌 스마트 물류 운영 플랫폼',
  description:
    '다국어 기반으로 입출고·재고·주문·배송을 실시간 통합 관리하는 WMS. 글로벌 이커머스와 물류 네트워크를 연결하는 차세대 물류 운영 플랫폼.',
  openGraph: {
    title: 'ANH WMS | 글로벌 스마트 물류 운영 플랫폼',
    description:
      '다국어 기반으로 입출고·재고·주문·배송을 실시간 통합 관리하는 WMS. 글로벌 이커머스와 물류 네트워크를 연결하는 차세대 물류 운영 플랫폼.',
    siteName: 'ANH WMS',
    type: 'website',
    url: 'https://www.anhwms.com',
  },
  verification: {
    other: {
      'naver-site-verification': '22ff4bae1e5013dec87c24ca9629050167818759',
    },
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ANH WMS',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <ServiceWorkerRegister />
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}


