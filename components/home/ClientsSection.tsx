'use client';

export default function ClientsSection() {
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
      title: '출고 리드타임 50% 단축',
      company: 'YBK',
      description: 'WMS 시스템 도입과 프로세스 최적화로 평균 출고 시간을 2일에서 1일로 단축',
      result: '하루 처리량 2배 증가',
    },
    {
      icon: '📉',
      title: '반품률 30% 감소',
      company: 'WMG',
      description: '체계적인 검수 프로세스와 품질 관리 시스템 구축으로 오배송 및 불량 감소',
      result: 'CS 만족도 95% 달성',
    },
    {
      icon: '🌏',
      title: '해외배송 CS 개선',
      company: 'Client 3',
      description: 'AH 자회사를 통한 중국 현지 CS 대응으로 배송 문의 처리 시간 70% 단축',
      result: '배송 완료율 98% 달성',
    },
  ];

  return (
    <section id="clients" className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            이런 고객들이 ANH를 선택했습니다
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600">
            다양한 업종의 50+ 브랜드가 ANH와 함께 성장하고 있습니다
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
            주요 성공 사례
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
            당신의 비즈니스도 ANH와 함께 성장할 수 있습니다
          </p>
          <a
            href="#contact"
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-xl transition-all text-lg font-semibold"
          >
            <span>지금 상담 신청하기</span>
            <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

