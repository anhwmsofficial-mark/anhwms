'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export default function HomeNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: '회사소개', href: '#about' },
    { name: '서비스', href: '#services' },
    { name: '자회사', href: '#companies' },
    { name: '고객사 & 사례', href: '#clients' },
    { name: '뉴스룸', href: '#news' },
    { name: '문의하기', href: '#contact' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* 로고 */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                ANH
              </div>
              <div className="hidden sm:block text-sm text-gray-500 border-l pl-3 ml-3">
                AN · AH 그룹
              </div>
            </Link>
          </div>

          {/* Desktop 메뉴 */}
          <div className="hidden lg:flex items-center space-x-8">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
              >
                {item.name}
              </a>
            ))}
            <Link
              href="/portal"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all"
            >
              대시보드 로그인
            </Link>
          </div>

          {/* Mobile 햄버거 메뉴 */}
          <div className="lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile 메뉴 */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-4 space-y-3">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="block px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <Link
              href="/portal"
              className="block px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              대시보드 로그인
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

