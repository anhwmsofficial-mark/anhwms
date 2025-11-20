'use client';

import { ArrowRightIcon } from '@heroicons/react/24/outline';

export default function HeroSection() {
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
              Advanced Navigate Hub
            </div>

            {/* 메인 카피 */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              글로벌 물류,
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent animate-gradient">
                한 번에 연결되는
              </span>
              <br />
              ANH 그룹
            </h1>

            {/* 서브 카피 */}
            <p className="text-xl md:text-2xl text-gray-600 mb-6 max-w-3xl mx-auto lg:mx-0 leading-relaxed">
              국내·해외 풀필먼트와 IT 솔루션을 하나의 플랫폼으로 제공합니다.
            </p>
            <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto lg:mx-0">
              ANH·AN·AH가 함께 화주사의 재고·출고·배송·CS까지 End-to-End로 책임집니다.
            </p>

            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
              <a
                href="#services"
                className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-xl transition-all flex items-center space-x-2 text-lg font-medium hover:scale-105"
              >
                <span>서비스 한눈에 보기</span>
                <ArrowRightIcon className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#contact"
                className="px-8 py-4 bg-white text-gray-900 border-2 border-gray-300 rounded-xl hover:border-blue-600 hover:text-blue-600 transition-all text-lg font-medium hover:scale-105"
              >
                프로젝트 상담하기
              </a>
            </div>
          </div>

          {/* 우측: 비주얼 영역 */}
          <div className="relative">
            <div className="relative aspect-square bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center border-4 border-white shadow-2xl">
              <div className="text-center">
                <div className="text-8xl mb-6">🌐</div>
                <h3 className="text-3xl font-bold text-gray-900 mb-2">
                  Global Logistics Hub
                </h3>
                <p className="text-gray-600">
                  국내·해외를 하나로 연결하는 물류 플랫폼
                </p>
              </div>
            </div>
            
            {/* 주변 장식 효과 */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-400/20 to-indigo-400/20 rounded-3xl blur-2xl -z-10"></div>
          </div>
        </div>

        {/* 통계 */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {[
            { label: '물류센터', value: '3+', unit: '곳', icon: '🏢' },
            { label: '누적 출고', value: '100만+', unit: '건', icon: '📦' },
            { label: '협력 브랜드', value: '50+', unit: '개사', icon: '🤝' },
            { label: '해외 배송국', value: '10+', unit: '개국', icon: '🌍' },
          ].map((stat, index) => (
            <div 
              key={index} 
              className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 hover:shadow-lg transition-all hover:scale-105"
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
        
        .delay-500 {
          animation-delay: 0.5s;
        }
        
        .delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </section>
  );
}
