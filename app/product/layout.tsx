import type { Metadata } from 'next';

const productFontStyle = {
  fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif',
  '--font-product-body': '"Noto Sans KR"',
  '--font-product-mono': '"IBM Plex Mono"',
} as const;

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
    <div style={productFontStyle}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+KR:wght@400;500;700&display=swap"
      />
      {children}
    </div>
  );
}
