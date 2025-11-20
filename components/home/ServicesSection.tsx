'use client';

import { 
  TruckIcon, 
  GlobeAltIcon, 
  ComputerDesktopIcon, 
  ChartBarIcon 
} from '@heroicons/react/24/outline';

export default function ServicesSection() {
  const services = [
    {
      icon: TruckIcon,
      title: '국내 풀필먼트 & 3PL',
      subtitle: 'AN',
      description: '입·출고, 보관, 피킹, 패킹, 택배 연동까지 완벽한 국내 물류 서비스',
      tags: ['#풀필먼트', '#3PL', '#국내배송'],
      color: 'blue',
    },
    {
      icon: GlobeAltIcon,
      title: '해외배송 & 크로스보더',
      subtitle: 'AH',
      description: '중국·동남아 파트너 기반 B2C/B2B 국제배송 및 통관 서비스',
      tags: ['#해외배송', '#크로스보더', '#통관'],
      color: 'indigo',
    },
    {
      icon: ComputerDesktopIcon,
      title: 'WMS / IT 솔루션',
      subtitle: 'ANH Tech',
      description: 'ANH WMS, API 연동, 운영 대시보드, 커스텀 기능 개발',
      tags: ['#WMS', '#API', '#시스템통합'],
      color: 'purple',
    },
    {
      icon: ChartBarIcon,
      title: '컨설팅 & 프로젝트',
      subtitle: 'ANH Consulting',
      description: '창고 효율화, 운영 개선, 프로세스 개편 프로젝트 수행',
      tags: ['#컨설팅', '#효율화', '#프로세스개선'],
      color: 'emerald',
    },
  ];

  const colorClasses = {
    blue: {
      bg: 'from-blue-500 to-blue-600',
      text: 'text-blue-600',
      bgLight: 'bg-blue-50',
      border: 'border-blue-200',
    },
    indigo: {
      bg: 'from-indigo-500 to-indigo-600',
      text: 'text-indigo-600',
      bgLight: 'bg-indigo-50',
      border: 'border-indigo-200',
    },
    purple: {
      bg: 'from-purple-500 to-purple-600',
      text: 'text-purple-600',
      bgLight: 'bg-purple-50',
      border: 'border-purple-200',
    },
    emerald: {
      bg: 'from-emerald-500 to-emerald-600',
      text: 'text-emerald-600',
      bgLight: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
  };

  return (
    <section id="services" className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            우리가 제공하는 서비스
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            ANH 그룹은 국내·해외 물류부터 IT 시스템, 컨설팅까지 통합 물류 솔루션을 제공합니다
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {services.map((service, index) => {
            const colors = colorClasses[service.color as keyof typeof colorClasses];
            const IconComponent = service.icon;

            return (
              <div
                key={index}
                className="group relative bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-transparent hover:shadow-2xl transition-all duration-300"
              >
                {/* 호버 시 그라데이션 테두리 효과 */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl`}></div>

                {/* 아이콘 */}
                <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${colors.bg} mb-6`}>
                  <IconComponent className="h-8 w-8 text-white" />
                </div>

                {/* 제목 */}
                <div className="mb-4">
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colors.bgLight} ${colors.text} mb-3`}>
                    {service.subtitle}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                {/* 태그 */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {service.tags.map((tag, tagIndex) => (
                    <span
                      key={tagIndex}
                      className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 자세히 보기 버튼 */}
                <button className={`flex items-center ${colors.text} font-semibold group-hover:translate-x-2 transition-transform`}>
                  <span>자세히 보기</span>
                  <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

