import type { Metadata } from "next";
import "../globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";
import { AuthProvider } from "@/contexts/AuthContext";
import { Providers } from "../providers";

export const metadata: Metadata = {
  title: "ANH Group - 글로벌 물류 플랫폼",
  description: "국내·해외 풀필먼트와 IT 솔루션을 하나의 플랫폼으로 제공하는 ANH 그룹",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className="antialiased"
      style={{ fontFamily: '"Noto Sans KR", "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif' }}
    >
      <Providers>
        <AuthProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProvider>
      </Providers>
    </div>
  );
}
