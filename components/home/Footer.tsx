'use client';

import Link from 'next/link';

export default function Footer() {
  const navigation = {
    company: [
      { name: '회사소개', href: '#about' },
      { name: '비전 & 미션', href: '#about' },
      { name: '연혁', href: '#about' },
    ],
    services: [
      { name: '국내 풀필먼트', href: '#services' },
      { name: '해외배송', href: '#services' },
      { name: 'WMS 솔루션', href: '#services' },
      { name: '컨설팅', href: '#services' },
    ],
    group: [
      { name: 'AN - 국내물류', href: '#companies' },
      { name: 'AH - 해외물류', href: '#companies' },
    ],
    support: [
      { name: '고객사 & 사례', href: '#clients' },
      { name: '뉴스룸', href: '#news' },
      { name: '문의하기', href: '#contact' },
      { name: '대시보드 로그인', href: '/portal' },
    ],
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* 로고 & 슬로건 */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-6">
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                ANH
              </div>
              <div className="text-sm text-gray-500 border-l border-gray-700 pl-3">
                AN · AH 그룹
              </div>
            </div>
            <p className="text-lg font-semibold text-gray-400 mb-4">
              Accompany & Navigate Hub
            </p>
            <p className="text-gray-500 leading-relaxed">
              함께 동행하는 물류 플랫폼
              <br />
              국내·해외 물류를 하나로 연결합니다
            </p>
          </div>

          {/* 회사소개 */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase mb-4">
              회사소개
            </h3>
            <ul className="space-y-3">
              {navigation.company.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* 서비스 */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase mb-4">
              서비스
            </h3>
            <ul className="space-y-3">
              {navigation.services.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* 자회사 & 지원 */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase mb-4">
              자회사
            </h3>
            <ul className="space-y-3 mb-6">
              {navigation.group.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
            <h3 className="text-white font-bold text-sm uppercase mb-4">
              지원
            </h3>
            <ul className="space-y-3">
              {navigation.support.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 구분선 */}
        <div className="border-t border-gray-800 pt-8">
          <div className="grid md:grid-cols-2 gap-6">
            {/* 회사 정보 */}
            <div className="text-sm text-gray-500 space-y-2">
              <p>
                <span className="font-semibold">대표자:</span> 홍길동
              </p>
              <p>
                <span className="font-semibold">사업자번호:</span> 123-45-67890
              </p>
              <p>
                <span className="font-semibold">주소:</span> 서울특별시 강남구 테헤란로 123, ANH 빌딩 5층
              </p>
              <p>
                <span className="font-semibold">이메일:</span> contact@anh-group.com
              </p>
            </div>

            {/* 저작권 */}
            <div className="text-sm text-gray-500 md:text-right">
              <p className="mb-2">
                © 2024 ANH Group. All rights reserved.
              </p>
              <div className="flex md:justify-end space-x-4">
                <a href="#" className="hover:text-white transition-colors">
                  개인정보처리방침
                </a>
                <a href="#" className="hover:text-white transition-colors">
                  이용약관
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

