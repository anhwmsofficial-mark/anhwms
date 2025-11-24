'use client';

import Link from 'next/link';
import { 
  BuildingOfficeIcon, 
  UserGroupIcon, 
  GlobeAltIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/home/LanguageSwitcher';

function PortalContent() {
  const { t } = useLanguage();
  
  const portals = [
    {
      icon: BuildingOfficeIcon,
      title: t.portal.portals.client.title,
      subtitle: t.portal.portals.client.subtitle,
      description: t.portal.portals.client.description,
      features: [
        t.portal.portals.client.features.f1,
        t.portal.portals.client.features.f2,
        t.portal.portals.client.features.f3,
        t.portal.portals.client.features.f4,
      ],
      href: '/dashboard',
      color: 'blue',
      available: true,
    },
    {
      icon: UserGroupIcon,
      title: t.portal.portals.admin.title,
      subtitle: t.portal.portals.admin.subtitle,
      description: t.portal.portals.admin.description,
      features: [
        t.portal.portals.admin.features.f1,
        t.portal.portals.admin.features.f2,
        t.portal.portals.admin.features.f3,
        t.portal.portals.admin.features.f4,
      ],
      href: '/admin',
      color: 'indigo',
      available: true,
    },
    {
      icon: GlobeAltIcon,
      title: t.portal.portals.international.title,
      subtitle: t.portal.portals.international.subtitle,
      description: t.portal.portals.international.description,
      features: [
        t.portal.portals.international.features.f1,
        t.portal.portals.international.features.f2,
        t.portal.portals.international.features.f3,
        t.portal.portals.international.features.f4,
      ],
      href: '#',
      color: 'purple',
      available: false,
    },
  ];

  const colorClasses = {
    blue: {
      bg: 'from-blue-500 to-blue-600',
      bgLight: 'from-blue-50 to-blue-100',
      text: 'text-blue-600',
      border: 'border-blue-200',
      hover: 'hover:border-blue-600',
    },
    indigo: {
      bg: 'from-indigo-500 to-indigo-600',
      bgLight: 'from-indigo-50 to-indigo-100',
      text: 'text-indigo-600',
      border: 'border-indigo-200',
      hover: 'hover:border-indigo-600',
    },
    purple: {
      bg: 'from-purple-500 to-purple-600',
      bgLight: 'from-purple-50 to-purple-100',
      text: 'text-purple-600',
      border: 'border-purple-200',
      hover: 'hover:border-purple-600',
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* 헤더 */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                ANH
              </div>
              <div className="text-sm text-gray-500 border-l pl-3 ml-3">
                Portal Hub
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                {t.portal.backToHome}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* 타이틀 */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            {t.portal.title}
          </h1>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t.portal.subtitle}
            <br />
            {t.portal.description}
          </p>
        </div>

        {/* 포털 카드 */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {portals.map((portal, index) => {
            const colors = colorClasses[portal.color as keyof typeof colorClasses];
            const IconComponent = portal.icon;

            return (
              <div
                key={index}
                className={`group relative bg-white border-2 ${colors.border} rounded-3xl overflow-hidden transition-all duration-300 ${
                  portal.available ? `${colors.hover} hover:shadow-2xl` : 'opacity-75'
                }`}
              >
                {/* 배경 그라데이션 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${colors.bgLight} opacity-50`}></div>

                <div className="relative p-8">
                  {/* 준비중 배지 */}
                  {!portal.available && (
                    <div className="absolute top-4 right-4 px-3 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-semibold">
                      {t.portal.comingSoonBadge}
                    </div>
                  )}

                  {/* 아이콘 */}
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${colors.bg} mb-6`}>
                    <IconComponent className="h-10 w-10 text-white" />
                  </div>

                  {/* 제목 */}
                  <div className="mb-4">
                    <div className={`text-sm font-semibold ${colors.text} mb-2`}>
                      {portal.subtitle}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      {portal.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {portal.description}
                    </p>
                  </div>

                  {/* 기능 목록 */}
                  <ul className="space-y-2 mb-8">
                    {portal.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center text-sm text-gray-700">
                        <div className={`w-1.5 h-1.5 rounded-full ${colors.bg} mr-2`}></div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* 로그인 버튼 */}
                  {portal.available ? (
                    <Link
                      href={portal.href}
                      className={`flex items-center justify-center w-full px-6 py-3 bg-gradient-to-r ${colors.bg} text-white rounded-xl hover:shadow-lg transition-all font-semibold`}
                    >
                      <span>{t.portal.loginButton}</span>
                      <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="flex items-center justify-center w-full px-6 py-3 bg-gray-300 text-gray-500 rounded-xl cursor-not-allowed font-semibold"
                    >
                      {t.portal.comingSoon}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 안내 메시지 */}
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 text-4xl">ℹ️</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t.portal.guide.title}
                </h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>
                      <strong>{t.portal.guide.item1.label}</strong> {t.portal.guide.item1.text}
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>
                      <strong>{t.portal.guide.item2.label}</strong> {t.portal.guide.item2.text}
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>
                      <strong>{t.portal.guide.item3.label}</strong> {t.portal.guide.item3.text}{' '}
                      <Link href="/#contact" className="text-blue-600 hover:underline">
                        {t.portal.guide.item3.link}
                      </Link>
                      {t.portal.guide.item3.text2}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-gray-200 bg-white/80 backdrop-blur-sm mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-500">
            <p>{t.portal.footer.copyright}</p>
            <p className="mt-2">
              {t.portal.footer.contact} contact@anh-group.com | {t.portal.footer.phone} 02-1234-5678
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function PortalPage() {
  return (
    <LanguageProvider>
      <PortalContent />
    </LanguageProvider>
  );
}
