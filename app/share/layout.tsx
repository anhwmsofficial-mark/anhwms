import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-y-auto bg-gray-50">
      {children}
    </div>
  );
}
