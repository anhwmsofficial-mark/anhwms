'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function NewsSection() {
  const { t } = useLanguage();
  
  const news = [
    {
      date: t.news.articles.article1.date,
      category: t.news.articles.article1.category,
      title: t.news.articles.article1.title,
      description: t.news.articles.article1.description,
      tag: t.news.articles.article1.tag,
    },
    {
      date: t.news.articles.article2.date,
      category: t.news.articles.article2.category,
      title: t.news.articles.article2.title,
      description: t.news.articles.article2.description,
      tag: t.news.articles.article2.tag,
    },
    {
      date: t.news.articles.article3.date,
      category: t.news.articles.article3.category,
      title: t.news.articles.article3.title,
      description: t.news.articles.article3.description,
      tag: t.news.articles.article3.tag,
    },
  ];

  return (
    <section id="news" className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            {t.news.title}
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600">
            {t.news.subtitle}
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
                  {(item.tag === 'Partnership' || item.category.includes('파트너') || item.category.includes('合作') || item.category.includes('Partner')) && '🤝'}
                  {(item.tag === 'Facility' || item.category.includes('시설') || item.category.includes('设施') || item.category.includes('Facil')) && '🏢'}
                  {(item.tag === 'Service' || item.category.includes('서비스') || item.category.includes('服务') || item.category.includes('Serv')) && '🚀'}
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
                  <span>{t.news.readMore}</span>
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
            {t.news.moreNews}
          </button>
        </div>
      </div>
    </section>
  );
}
