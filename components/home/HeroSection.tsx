'use client';

import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';

export default function HeroSection() {
  const { t } = useLanguage();
  return (
    <section className="relative pt-32 pb-20 bg-gradient-to-br from-blue-50 via-indigo-50 to-white overflow-hidden">
      {/* 배경 장식 - 애니메이션 추가 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-200 rounded-full opacity-20 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-200 rounded-full opacity-20 blur-3xl animate-pulse delay-1000"></div>
        
        {/* 떠다니는 아이콘들 */}
        <div className="absolute top-20 left-[10%] text-4xl animate-float">📦</div>
        <div className="absolute top-40 right-[15%] text-4xl animate-float-delayed">🚚</div>
        <div className="absolute bottom-40 left-[20%] text-3xl animate-float-slow">✈️</div>
        <div className="absolute top-60 right-[25%] text-3xl animate-float-delayed-slow">🌏</div>
        <div className="absolute bottom-60 right-[10%] text-4xl animate-float">📱</div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* 좌측: 텍스트 콘텐츠 */}
          <div className="text-center lg:text-left">
            {/* 배지 */}
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full text-blue-700 text-sm font-medium mb-8 animate-bounce-slow">
              <span className="mr-2">🚀</span>
              {t.hero.badge}
            </div>

            {/* 메인 카피 */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              {t.hero.title1}
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent animate-gradient">
                {t.hero.title2}
              </span>
              <br />
              {t.hero.title3}
            </h1>

            {/* 서브 카피 */}
            <p className="text-xl md:text-2xl text-gray-600 mb-6 max-w-3xl mx-auto lg:mx-0 leading-relaxed">
              {t.hero.subtitle1}
            </p>
            <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto lg:mx-0">
              {t.hero.subtitle2}
            </p>

            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
              <a
                href="#services"
                className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-xl transition-all flex items-center space-x-2 text-lg font-medium hover:scale-105"
              >
                <span>{t.hero.cta1}</span>
                <ArrowRightIcon className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#contact"
                className="px-8 py-4 bg-white text-gray-900 border-2 border-gray-300 rounded-xl hover:border-blue-600 hover:text-blue-600 transition-all text-lg font-medium hover:scale-105"
              >
                {t.hero.cta2}
              </a>
            </div>
          </div>

          {/* 우측: 애니메이션 그래픽 */}
          <div className="relative">
            <div className="relative aspect-square">
              {/* 중앙 메인 박스 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-64 h-64 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl shadow-2xl animate-float">
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <div className="text-center">
                      <div className="text-6xl mb-4">📦</div>
                      <div className="text-2xl font-bold">ANH</div>
                      <div className="text-sm opacity-80">{t.hero.platform}</div>
                    </div>
                  </div>
                  
                  {/* 회전하는 궤도 원들 */}
                  <div className="absolute inset-0 animate-spin-slow">
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-2xl">
                      🚚
                    </div>
                  </div>
                  
                  <div className="absolute inset-0 animate-spin-slow-reverse">
                    <div className="absolute top-1/2 -right-8 -translate-y-1/2 w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-2xl">
                      ✈️
                    </div>
                  </div>
                  
                  <div className="absolute inset-0 animate-spin-slow delay-1000">
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-2xl">
                      🌏
                    </div>
                  </div>
                  
                  <div className="absolute inset-0 animate-spin-slow-reverse delay-500">
                    <div className="absolute top-1/2 -left-8 -translate-y-1/2 w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-2xl">
                      📱
                    </div>
                  </div>
                </div>
              </div>

              {/* 배경 원들 - 펄스 효과 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-80 h-80 border-4 border-blue-200 rounded-full animate-ping-slow"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-96 h-96 border-4 border-indigo-200 rounded-full animate-ping-slower"></div>
              </div>
            </div>
          </div>
        </div>

        {/* 통계 - 업그레이드된 카드 */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {[
            { label: t.hero.stats.centers, value: t.hero.stats.centersValue, icon: '🏢' },
            { label: t.hero.stats.shipments, value: t.hero.stats.shipmentsValue, icon: '📦' },
            { label: t.hero.stats.brands, value: t.hero.stats.brandsValue, icon: '🤝' },
            { label: t.hero.stats.countries, value: t.hero.stats.countriesValue, icon: '🌍' },
          ].map((stat, index) => (
            <div 
              key={index} 
              className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 hover:shadow-lg transition-all hover:scale-105 animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="text-4xl mb-2">{stat.icon}</div>
              <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CSS 애니메이션 정의 */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-25px); }
        }
        
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        
        @keyframes ping-slower {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        
        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 4s ease-in-out infinite;
          animation-delay: 0.5s;
        }
        
        .animate-float-slow {
          animation: float-slow 5s ease-in-out infinite;
        }
        
        .animate-float-delayed-slow {
          animation: float-delayed 6s ease-in-out infinite;
          animation-delay: 1s;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        
        .animate-spin-slow {
          animation: spin 20s linear infinite;
        }
        
        .animate-spin-slow-reverse {
          animation: spin 15s linear infinite reverse;
        }
        
        .animate-ping-slow {
          animation: ping-slow 3s ease-out infinite;
        }
        
        .animate-ping-slower {
          animation: ping-slower 4s ease-out infinite;
          animation-delay: 0.5s;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
        
        .delay-500 {
          animation-delay: 0.5s;
        }
        
        .delay-1000 {
          animation-delay: 1s;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}
