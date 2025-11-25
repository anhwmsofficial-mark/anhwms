'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ContactSection() {
  const { t } = useLanguage();

  return (
    <section id="contact" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            {t.contact.title}
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600">
            {t.contact.subtitle}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* 견적 문의 카드 */}
          <div className="space-y-6">
            {/* 국내 풀필먼트 견적 */}
            <Link href="/quote-request">
              <div className="group relative bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-3xl p-8 hover:shadow-2xl transition-all cursor-pointer hover:border-blue-400">
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-3xl">
                      🚚
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {t.contact.quoteCards.domestic.title}
                      </h3>
                      <span className="text-blue-600 group-hover:translate-x-2 transition-transform">
                        →
                      </span>
                    </div>
                    <p className="text-gray-600 mb-4">
                      {t.contact.quoteCards.domestic.description}
                    </p>
                    <div className="space-y-2">
                      {t.contact.quoteCards.domestic.features.map((feature: string, idx: number) => (
                        <div key={idx} className="flex items-center text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-2"></div>
                          {feature}
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-xl group-hover:bg-blue-700 transition-colors">
                      {t.contact.quoteCards.domestic.button}
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* 해외배송 견적 */}
            <Link href="/quote-request-international">
              <div className="group relative bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-3xl p-8 hover:shadow-2xl transition-all cursor-pointer hover:border-purple-400">
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center text-3xl">
                      ✈️
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {t.contact.quoteCards.international.title}
                      </h3>
                      <span className="text-purple-600 group-hover:translate-x-2 transition-transform">
                        →
                      </span>
                    </div>
                    <p className="text-gray-600 mb-4">
                      {t.contact.quoteCards.international.description}
                    </p>
                    <div className="space-y-2">
                      {t.contact.quoteCards.international.features.map((feature: string, idx: number) => (
                        <div key={idx} className="flex items-center text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-600 mr-2"></div>
                          {feature}
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 inline-block px-6 py-2 bg-purple-600 text-white font-semibold rounded-xl group-hover:bg-purple-700 transition-colors">
                      {t.contact.quoteCards.international.button}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* 연락처 정보 */}
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                {t.contact.info.title}
              </h3>
              <div className="space-y-6">
                {[
                  {
                    icon: '📞',
                    title: t.contact.info.phone.label,
                    content: t.contact.info.phone.value,
                    subContent: t.contact.info.phone.hours,
                  },
                  {
                    icon: '✉️',
                    title: t.contact.info.email.label,
                    content: t.contact.info.email.value,
                    subContent: t.contact.info.email.hours,
                  },
                  {
                    icon: '📍',
                    title: t.contact.info.address.label,
                    content: t.contact.info.address.value,
                    subContent: t.contact.info.address.building,
                  },
                ].map((item, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-500 mb-1">
                        {item.title}
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {item.content}
                      </div>
                      <div className="text-sm text-gray-600">
                        {item.subContent}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 물류센터 정보 */}
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4">
                {t.contact.warehouses.title}
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-gray-900">{t.contact.warehouses.gimpo.name}</div>
                  <div className="text-sm text-gray-600">{t.contact.warehouses.gimpo.address}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{t.contact.warehouses.incheon.name}</div>
                  <div className="text-sm text-gray-600">{t.contact.warehouses.incheon.address}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
