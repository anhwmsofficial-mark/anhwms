import type { Metadata } from 'next';
import { IBM_Plex_Mono, Noto_Sans_KR } from 'next/font/google';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-product-body',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-product-mono',
});

export const metadata: Metadata = {
  title: 'ANH WMS 상세페이지',
  description: '장기부진재고 상세페이지',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${notoSansKr.variable} ${ibmPlexMono.variable} ${notoSansKr.className}`}>
      {children}
    </div>
  );
}
