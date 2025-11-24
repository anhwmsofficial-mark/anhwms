'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function AboutSection() {
  const { t } = useLanguage();
  
  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            {t.about.title}
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              {t.about.mainTitle}
              <br />
              <span className="text-blue-600">{t.about.mainTitleHighlight}</span>
            </h3>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              {t.about.desc1}
            </p>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              {t.about.desc2}
            </p>
            <ul className="space-y-4">
              {[
                t.about.features.feature1,
                t.about.features.feature2,
                t.about.features.feature3,
              ].map((item, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-1">
                    <span className="text-blue-600 text-sm">✓</span>
                  </div>
                  <span className="text-gray-700 text-lg">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="text-6xl mb-4">🌐</div>
                <h4 className="text-2xl font-bold text-gray-900 mb-2">Global Logistics Hub</h4>
                <p className="text-gray-600">{t.about.values.value3.desc}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 핵심 가치 */}
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: '🎯',
              title: t.about.values.value1.title,
              description: t.about.values.value1.desc,
            },
            {
              icon: '🔗',
              title: t.about.values.value2.title,
              description: t.about.values.value2.desc,
            },
            {
              icon: '🌏',
              title: t.about.values.value3.title,
              description: t.about.values.value3.desc,
            },
          ].map((item, index) => (
            <div
              key={index}
              className="p-8 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl hover:shadow-lg transition-shadow"
            >
              <div className="text-5xl mb-4">{item.icon}</div>
              <h4 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h4>
              <p className="text-gray-600 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
