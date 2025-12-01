'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  
  const navigation = {
    company: [
      { name: t.footer.company.about, href: '#about' },
      { name: t.footer.company.vision, href: '#about' },
      { name: t.footer.company.history, href: '#about' },
    ],
    services: [
      { name: t.footer.services.domestic, href: '#services' },
      { name: t.footer.services.international, href: '#services' },
      { name: t.footer.services.wms, href: '#services' },
      { name: t.footer.services.consulting, href: '#services' },
    ],
    group: [
      { name: t.footer.group.an, href: '#companies' },
      { name: t.footer.group.ah, href: '#companies' },
    ],
    support: [
      { name: t.footer.support.clients, href: '#clients' },
      { name: t.footer.support.news, href: '#news' },
      { name: t.footer.support.contact, href: '#contact' },
      { name: t.footer.support.dashboard, href: '/portal' },
    ],
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* 상단 네비게이션 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* 로고 & 슬로건 */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-6">
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                ANH
              </div>
              <div className="text-sm text-gray-500 border-l border-gray-700 pl-3">
                AN · AH GROUP
              </div>
            </div>
            <p className="text-lg font-semibold text-gray-400 mb-4">
              {t.footer.tagline}
            </p>
            <p className="text-gray-500 leading-relaxed whitespace-pre-line">
              {t.footer.desc}
            </p>
          </div>

          {/* 회사소개 */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              {t.footer.companyTitle}
            </h3>
            <ul className="space-y-3">
              {navigation.company.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* 서비스 */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              {t.footer.servicesTitle}
            </h3>
            <ul className="space-y-3">
              {navigation.services.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* 자회사 & 지원 */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              {t.footer.groupTitle}
            </h3>
            <ul className="space-y-3 mb-6">
              {navigation.group.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              {t.footer.supportTitle}
            </h3>
            <ul className="space-y-3">
              {navigation.support.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 저작권 */}
        <div className="border-t border-gray-800 pt-8">
          <div className="text-sm text-gray-500 text-center">
            <p className="mb-3 text-gray-400">{t.footer.copyright}</p>
            <div className="flex justify-center items-center space-x-4 text-xs">
              <a href="#" className="hover:text-white transition-colors">
                {t.footer.links.privacy}
              </a>
              <span className="text-gray-700">|</span>
              <a href="#" className="hover:text-white transition-colors">
                {t.footer.links.terms}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
