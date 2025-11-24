'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function ClientsSection() {
  const { t } = useLanguage();
  
  const clients = [
    { name: 'YBK', logo: '🏢' },
    { name: 'WMG', logo: '🎵' },
    { name: 'Client 3', logo: '🛍️' },
    { name: 'Client 4', logo: '📦' },
    { name: 'Client 5', logo: '🌟' },
    { name: 'Client 6', logo: '🎯' },
  ];

  const cases = [
    {
      icon: '⚡',
      title: t.clients.case1.title,
      company: t.clients.case1.company,
      description: t.clients.case1.desc,
      result: t.clients.case1.result,
    },
    {
      icon: '📉',
      title: t.clients.case2.title,
      company: t.clients.case2.company,
      description: t.clients.case2.desc,
      result: t.clients.case2.result,
    },
    {
      icon: '🌏',
      title: t.clients.case3.title,
      company: t.clients.case3.company,
      description: t.clients.case3.desc,
      result: t.clients.case3.result,
    },
  ];

  return (
    <section id="clients" className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            {t.clients.title}
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600">
            {t.clients.subtitle}
          </p>
        </div>

        {/* 고객사 로고 */}
        <div className="mb-20">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {clients.map((client, index) => (
              <div
                key={index}
                className="flex flex-col items-center justify-center p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-600 hover:shadow-lg transition-all group"
              >
                <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">
                  {client.logo}
                </div>
                <div className="text-sm font-semibold text-gray-600 group-hover:text-blue-600">
                  {client.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 성공 사례 */}
        <div>
          <h3 className="text-3xl font-bold text-gray-900 text-center mb-12">
            {t.clients.casesTitle}
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {cases.map((caseItem, index) => (
              <div
                key={index}
                className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-blue-600 hover:shadow-xl transition-all"
              >
                {/* 아이콘 */}
                <div className="text-5xl mb-6">{caseItem.icon}</div>

                {/* 제목 */}
                <h4 className="text-xl font-bold text-gray-900 mb-2">
                  {caseItem.title}
                </h4>

                {/* 회사명 */}
                <div className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold mb-4">
                  {caseItem.company}
                </div>

                {/* 설명 */}
                <p className="text-gray-600 mb-4 leading-relaxed">
                  {caseItem.description}
                </p>

                {/* 결과 */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">✨</span>
                    <span className="font-semibold text-blue-600">
                      {caseItem.result}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="text-lg text-gray-600 mb-6">
            {t.clients.cta.text}
          </p>
          <a
            href="#contact"
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-xl transition-all text-lg font-semibold"
          >
            <span>{t.clients.cta.button}</span>
            <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
