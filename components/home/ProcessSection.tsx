'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function ProcessSection() {
  const { t } = useLanguage();
  
  const steps = [
    {
      number: '01',
      title: t.process.steps.step1.title,
      description: t.process.steps.step1.desc,
      icon: '📥',
    },
    {
      number: '02',
      title: t.process.steps.step2.title,
      description: t.process.steps.step2.desc,
      icon: '📦',
    },
    {
      number: '03',
      title: t.process.steps.step3.title,
      description: t.process.steps.step3.desc,
      icon: '📤',
    },
    {
      number: '04',
      title: t.process.steps.step4.title,
      description: t.process.steps.step4.desc,
      icon: '🚚',
    },
    {
      number: '05',
      title: t.process.steps.step5.title,
      description: t.process.steps.step5.desc,
      icon: '💬',
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            {t.process.title}
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto whitespace-pre-line">
            {t.process.subtitle}
          </p>
        </div>

        {/* 프로세스 플로우 */}
        <div className="relative">
          {/* 연결선 (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-blue-200 via-indigo-200 to-purple-200 -translate-y-1/2"></div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-blue-600 hover:shadow-xl transition-all group">
                  {/* 번호 */}
                  <div className="absolute -top-4 left-6 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-full">
                    {step.number}
                  </div>

                  {/* 아이콘 */}
                  <div className="text-6xl mb-4 mt-4 text-center group-hover:scale-110 transition-transform">
                    {step.icon}
                  </div>

                  {/* 제목 */}
                  <h4 className="text-xl font-bold text-gray-900 mb-2 text-center">
                    {step.title}
                  </h4>

                  {/* 설명 */}
                  <p className="text-gray-600 text-center text-sm">
                    {step.description}
                  </p>
                </div>

                {/* 화살표 (Mobile) */}
                {index < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center my-4">
                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 시스템 통합 설명 */}
        <div className="mt-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className="text-3xl font-bold text-gray-900 mb-6">
              {t.process.system.title}
              <br />
              <span className="text-blue-600">{t.process.system.titleHighlight}</span>
            </h3>
            <ul className="space-y-4">
              {[
                {
                  icon: '🔗',
                  text: t.process.system.features.f1,
                },
                {
                  icon: '📊',
                  text: t.process.system.features.f2,
                },
                {
                  icon: '🔔',
                  text: t.process.system.features.f3,
                },
                {
                  icon: '📱',
                  text: t.process.system.features.f4,
                },
              ].map((item, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-3xl mr-4">{item.icon}</span>
                  <span className="text-lg text-gray-700 mt-1">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div 
              className="aspect-square rounded-2xl p-8 flex items-center justify-center border-2 border-blue-200 bg-cover bg-center"
              style={{
                backgroundImage: 'url(/홈배경.gif)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="text-center">
                <div className="text-7xl mb-4">⚡</div>
                <h4 className="text-2xl font-bold text-white mb-3 whitespace-pre-line drop-shadow-lg">
                  {t.process.system.visibility.title}
                </h4>
                <p className="text-white whitespace-pre-line drop-shadow-lg">
                  {t.process.system.visibility.desc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
