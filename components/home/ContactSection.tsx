'use client';

import { useState } from 'react';

export default function ContactSection() {
  const [formData, setFormData] = useState({
    company: '',
    name: '',
    email: '',
    phone: '',
    interest: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // 실제 구현 시 API 호출
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitStatus('success');
      setFormData({
        company: '',
        name: '',
        email: '',
        phone: '',
        interest: '',
        message: '',
      });

      // 3초 후 상태 초기화
      setTimeout(() => setSubmitStatus('idle'), 3000);
    }, 1500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <section id="contact" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            프로젝트와 견적, 먼저 편하게 문의해주세요
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600">
            24시간 내에 담당자가 연락드립니다
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* 문의 폼 */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 회사명 */}
              <div>
                <label htmlFor="company" className="block text-sm font-semibold text-gray-700 mb-2">
                  회사명 *
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors"
                  placeholder="회사명을 입력하세요"
                />
              </div>

              {/* 담당자 */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                  담당자명 *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors"
                  placeholder="담당자명을 입력하세요"
                />
              </div>

              {/* 이메일 & 연락처 */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    이메일 *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors"
                    placeholder="example@email.com"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                    연락처 *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors"
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>

              {/* 관심 영역 */}
              <div>
                <label htmlFor="interest" className="block text-sm font-semibold text-gray-700 mb-2">
                  관심 영역 *
                </label>
                <select
                  id="interest"
                  name="interest"
                  value={formData.interest}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors"
                >
                  <option value="">선택해주세요</option>
                  <option value="domestic">국내 풀필먼트 (AN)</option>
                  <option value="international">해외배송/크로스보더 (AH)</option>
                  <option value="wms">WMS/시스템 구축 (ANH)</option>
                  <option value="consulting">컨설팅 & 프로젝트</option>
                  <option value="etc">기타</option>
                </select>
              </div>

              {/* 문의 내용 */}
              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                  문의 내용
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors resize-none"
                  placeholder="현재 물류 상황이나 고민사항을 자유롭게 작성해주세요"
                />
              </div>

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-xl transition-all font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '전송 중...' : '문의하기'}
              </button>

              {/* 성공 메시지 */}
              {submitStatus === 'success' && (
                <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg text-green-700 text-center">
                  ✓ 문의가 성공적으로 전송되었습니다!
                </div>
              )}
            </form>
          </div>

          {/* 연락처 정보 */}
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                직접 연락하기
              </h3>
              <div className="space-y-6">
                {[
                  {
                    icon: '📞',
                    title: '전화',
                    content: '02-1234-5678',
                    subContent: '평일 09:00 - 18:00',
                  },
                  {
                    icon: '✉️',
                    title: '이메일',
                    content: 'contact@anh-group.com',
                    subContent: '24시간 접수 가능',
                  },
                  {
                    icon: '📍',
                    title: '본사',
                    content: '서울특별시 강남구 테헤란로 123',
                    subContent: 'ANH 빌딩 5층',
                  },
                ].map((item, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-500 mb-1">
                        {item.title}
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {item.content}
                      </div>
                      <div className="text-sm text-gray-600">
                        {item.subContent}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 물류센터 정보 */}
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4">
                물류센터 위치
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-gray-900">AN 김포센터</div>
                  <div className="text-sm text-gray-600">경기도 김포시 물류로 456</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">AN 인천센터</div>
                  <div className="text-sm text-gray-600">인천광역시 서구 물류대로 789</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

