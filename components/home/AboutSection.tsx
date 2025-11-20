'use client';

export default function AboutSection() {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            ANH는 어떤 그룹인가요?
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              물류 운영과 IT 시스템을 동시에 설계하는
              <br />
              <span className="text-blue-600">하이브리드 물류 그룹</span>
            </h3>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              ANH는 물류 운영과 IT 시스템을 동시에 설계하는 하이브리드 물류 그룹입니다.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              AN(국내)과 AH(해외) 자회사를 통해 재고관리부터 출고, 해외배송, CS까지 
              하나의 흐름으로 연결합니다.
            </p>
            <ul className="space-y-4">
              {[
                '국내·해외 3PL / 풀필먼트 / 해외배송',
                '중소·중견·크로스보더 End-to-End 대응',
                '현장 운영 + IT 시스템 통합 관리',
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
                <p className="text-gray-600">국내·해외를 하나로 연결하는 물류 플랫폼</p>
              </div>
            </div>
          </div>
        </div>

        {/* 핵심 가치 */}
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: '🎯',
              title: '원스톱 솔루션',
              description: '입고부터 배송, CS까지 모든 프로세스를 한 곳에서',
            },
            {
              icon: '🔗',
              title: '시스템 통합',
              description: 'WMS, API, 대시보드를 통한 실시간 데이터 연동',
            },
            {
              icon: '🌏',
              title: '글로벌 네트워크',
              description: '국내 거점과 해외 파트너로 전세계 배송 커버',
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

