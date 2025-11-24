'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ContactSection() {
  const { t } = useLanguage();
  
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
            {t.contact.title}
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600">
            {t.contact.subtitle}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* 문의 폼 */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 회사명 */}
              <div>
                <label htmlFor="company" className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.contact.form.company}
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors"
                  placeholder={t.contact.form.companyPlaceholder}
                />
              </div>

              {/* 담당자 */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.contact.form.name}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors"
                  placeholder={t.contact.form.namePlaceholder}
                />
              </div>

              {/* 이메일 & 연락처 */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t.contact.form.email}
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors"
                    placeholder={t.contact.form.emailPlaceholder}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t.contact.form.phone}
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors"
                    placeholder={t.contact.form.phonePlaceholder}
                  />
                </div>
              </div>

              {/* 관심 영역 */}
              <div>
                <label htmlFor="interest" className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.contact.form.interest}
                </label>
                <select
                  id="interest"
                  name="interest"
                  value={formData.interest}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors"
                >
                  <option value="">{t.contact.form.interestPlaceholder}</option>
                  <option value="domestic">{t.contact.form.interests.domestic}</option>
                  <option value="international">{t.contact.form.interests.international}</option>
                  <option value="wms">{t.contact.form.interests.wms}</option>
                  <option value="consulting">{t.contact.form.interests.consulting}</option>
                  <option value="etc">{t.contact.form.interests.etc}</option>
                </select>
              </div>

              {/* 문의 내용 */}
              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.contact.form.message}
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none transition-colors resize-none"
                  placeholder={t.contact.form.messagePlaceholder}
                />
              </div>

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-xl transition-all font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t.contact.form.submitting : t.contact.form.submit}
              </button>

              {/* 성공 메시지 */}
              {submitStatus === 'success' && (
                <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg text-green-700 text-center">
                  {t.contact.form.successMessage}
                </div>
              )}
            </form>
          </div>

          {/* 연락처 정보 */}
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                {t.contact.info.title}
              </h3>
              <div className="space-y-6">
                {[
                  {
                    icon: '📞',
                    title: t.contact.info.phone.label,
                    content: t.contact.info.phone.value,
                    subContent: t.contact.info.phone.hours,
                  },
                  {
                    icon: '✉️',
                    title: t.contact.info.email.label,
                    content: t.contact.info.email.value,
                    subContent: t.contact.info.email.hours,
                  },
                  {
                    icon: '📍',
                    title: t.contact.info.address.label,
                    content: t.contact.info.address.value,
                    subContent: t.contact.info.address.building,
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
                {t.contact.warehouses.title}
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-gray-900">{t.contact.warehouses.gimpo.name}</div>
                  <div className="text-sm text-gray-600">{t.contact.warehouses.gimpo.address}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{t.contact.warehouses.incheon.name}</div>
                  <div className="text-sm text-gray-600">{t.contact.warehouses.incheon.address}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
