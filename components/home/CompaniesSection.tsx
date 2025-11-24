'use client';

import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CompaniesSection() {
  const { t } = useLanguage();
  
  return (
    <section id="companies" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            {t.companies.title}
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600">
            {t.companies.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* AN 카드 */}
          <div className="group relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-3xl p-10 overflow-hidden hover:shadow-2xl transition-all duration-300">
            {/* 배경 장식 */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="relative z-10">
              {/* 로고 */}
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mb-6 text-white text-3xl font-bold">
                AN
              </div>

              {/* 제목 */}
              <h3 className="text-3xl font-bold text-gray-900 mb-3">
                {t.companies.an.name}
              </h3>
              <div className="text-lg font-semibold text-blue-600 mb-6">
                {t.companies.an.subtitle}
              </div>

              {/* 설명 */}
              <p className="text-gray-700 mb-6 leading-relaxed">
                {t.companies.an.desc}
              </p>

              {/* 핵심 서비스 */}
              <ul className="space-y-3 mb-8">
                {[
                  t.companies.an.features.f1,
                  t.companies.an.features.f2,
                  t.companies.an.features.f3,
                  t.companies.an.features.f4,
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center mr-3 mt-0.5">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button className="group/btn flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-lg transition-all">
                <span className="font-semibold">{t.companies.an.cta}</span>
                <ArrowRightIcon className="ml-2 h-5 w-5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* AH 카드 */}
          <div className="group relative bg-gradient-to-br from-indigo-50 to-purple-100 rounded-3xl p-10 overflow-hidden hover:shadow-2xl transition-all duration-300">
            {/* 배경 장식 */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-200 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="relative z-10">
              {/* 로고 */}
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-6 text-white text-3xl font-bold">
                AH
              </div>

              {/* 제목 */}
              <h3 className="text-3xl font-bold text-gray-900 mb-3">
                {t.companies.ah.name}
              </h3>
              <div className="text-lg font-semibold text-indigo-600 mb-6">
                {t.companies.ah.subtitle}
              </div>

              {/* 설명 */}
              <p className="text-gray-700 mb-6 leading-relaxed">
                {t.companies.ah.desc}
              </p>

              {/* 핵심 서비스 */}
              <ul className="space-y-3 mb-8">
                {[
                  t.companies.ah.features.f1,
                  t.companies.ah.features.f2,
                  t.companies.ah.features.f3,
                  t.companies.ah.features.f4,
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center mr-3 mt-0.5">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button className="group/btn flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all">
                <span className="font-semibold">{t.companies.ah.cta}</span>
                <ArrowRightIcon className="ml-2 h-5 w-5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* 시너지 메시지 */}
        <div className="mt-16 text-center p-8 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-gray-200">
          <div className="text-4xl mb-4">🤝</div>
          <h4 className="text-2xl font-bold text-gray-900 mb-3">
            {t.companies.synergy.title}
          </h4>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto whitespace-pre-line">
            {t.companies.synergy.desc}
          </p>
        </div>
      </div>
    </section>
  );
}
