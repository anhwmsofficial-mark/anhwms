'use client';

import { ArrowRightIcon } from '@heroicons/react/24/outline';

export default function CompaniesSection() {
  return (
    <section id="companies" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            ANH 그룹을 움직이는 두 개의 축
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600">
            국내 물류 전문 AN과 해외 특화 AH, 두 자회사가 완벽한 협업으로 고객사를 지원합니다
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
                Advanced Network
              </h3>
              <div className="text-lg font-semibold text-blue-600 mb-6">
                국내 풀필먼트 & 3PL 전문
              </div>

              {/* 설명 */}
              <p className="text-gray-700 mb-6 leading-relaxed">
                국내 D2C, 스마트스토어를 위한 완벽한 물류 솔루션을 제공합니다.
                김포·인천 거점을 통해 신속하고 정확한 서비스를 실현합니다.
              </p>

              {/* 핵심 서비스 */}
              <ul className="space-y-3 mb-8">
                {[
                  '김포·인천 물류센터 운영',
                  '국내 D2C, 스마트스토어 대응',
                  '입·출고, 보관, 피킹, 패킹',
                  '실시간 재고 관리 시스템',
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
                <span className="font-semibold">AN 자세히 보기</span>
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
                Abundant Happiness
              </h3>
              <div className="text-lg font-semibold text-indigo-600 mb-6">
                해외 특화 물류 & 크로스보더
              </div>

              {/* 설명 */}
              <p className="text-gray-700 mb-6 leading-relaxed">
                중국 중심 해외배송과 크로스보더 물류를 전문으로 합니다.
                JT, CK 등 해외 파트너와의 협력으로 안정적인 서비스를 제공합니다.
              </p>

              {/* 핵심 서비스 */}
              <ul className="space-y-3 mb-8">
                {[
                  '중국·동남아 파트너 네트워크',
                  '국제배송 & 통관 처리',
                  '해외 CS 전담 지원',
                  '크로스보더 풀필먼트',
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
                <span className="font-semibold">AH 자세히 보기</span>
                <ArrowRightIcon className="ml-2 h-5 w-5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* 시너지 메시지 */}
        <div className="mt-16 text-center p-8 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-gray-200">
          <div className="text-4xl mb-4">🤝</div>
          <h4 className="text-2xl font-bold text-gray-900 mb-3">
            AN + AH = 완벽한 글로벌 물류
          </h4>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            국내와 해외를 아우르는 통합 물류 네트워크로
            <br />
            화주사의 모든 물류 니즈를 한 번에 해결합니다
          </p>
        </div>
      </div>
    </section>
  );
}

