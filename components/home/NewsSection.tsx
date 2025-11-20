'use client';

export default function NewsSection() {
  const news = [
    {
      date: '2024.11.15',
      category: '파트너십',
      title: 'ANH, YBK 브랜드와 전략적 파트너십 체결',
      description: '국내 풀필먼트 서비스 확대 및 WMS 통합 프로젝트 시작',
      tag: 'Partnership',
    },
    {
      date: '2024.10.28',
      category: '시설',
      title: '김포 신규 물류센터 오픈',
      description: '3,000평 규모의 스마트 물류센터로 수도권 배송 강화',
      tag: 'Facility',
    },
    {
      date: '2024.10.10',
      category: '서비스',
      title: 'AH 해외배송 신규 라인 론칭',
      description: '중국·일본·동남아 3개국 추가, 총 10개국 배송 커버',
      tag: 'Service',
    },
  ];

  return (
    <section id="news" className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            ANH 그룹 소식
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600">
            ANH 그룹의 최신 소식과 업데이트를 확인하세요
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {news.map((item, index) => (
            <article
              key={index}
              className="group bg-white border-2 border-gray-200 rounded-2xl overflow-hidden hover:border-blue-600 hover:shadow-xl transition-all cursor-pointer"
            >
              {/* 이미지 영역 (향후 실제 이미지로 대체 가능) */}
              <div className="h-48 bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <div className="text-6xl">
                  {item.category === '파트너십' && '🤝'}
                  {item.category === '시설' && '🏢'}
                  {item.category === '서비스' && '🚀'}
                </div>
              </div>

              <div className="p-6">
                {/* 날짜 & 카테고리 */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-500">{item.date}</span>
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold">
                    {item.tag}
                  </span>
                </div>

                {/* 제목 */}
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h3>

                {/* 설명 */}
                <p className="text-gray-600 mb-4 leading-relaxed">
                  {item.description}
                </p>

                {/* 더보기 링크 */}
                <div className="flex items-center text-blue-600 font-semibold group-hover:translate-x-2 transition-transform">
                  <span>자세히 보기</span>
                  <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* 더 많은 소식 보기 */}
        <div className="mt-12 text-center">
          <button className="px-8 py-4 bg-white border-2 border-gray-300 text-gray-900 rounded-xl hover:border-blue-600 hover:text-blue-600 hover:shadow-lg transition-all font-semibold">
            더 많은 소식 보기
          </button>
        </div>
      </div>
    </section>
  );
}

