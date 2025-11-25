'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import HomeNavbar from '@/components/home/HomeNavbar';
import Footer from '@/components/home/Footer';
import {
  CheckIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  TruckIcon,
  CubeIcon,
  ShoppingBagIcon,
  WrenchScrewdriverIcon,
  ChatBubbleBottomCenterTextIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const monthlyRanges = [
  '0_1000',
  '1000_2000',
  '2000_3000',
  '3000_5000',
  '5000_10000',
  '10000_30000',
  '30000_plus',
] as const;

const quoteRequestSchema = z.object({
  companyName: z.string().min(1, { message: 'required' }),
  contactName: z.string().min(1, { message: 'required' }),
  email: z.string().email({ message: 'invalid' }),
  phone: z.string().optional(),
  monthlyOutboundRange: z.enum(monthlyRanges),
  skuCount: z.string().optional(),
  productCategories: z.array(z.string()),
  extraServices: z.array(z.string()),
  memo: z.string().optional(),
  privacyAgreed: z.boolean().refine((val) => val === true, {
    message: 'required',
  }),
});

type QuoteRequestFormData = z.infer<typeof quoteRequestSchema>;

function QuoteRequestContent() {
  const { t } = useLanguage();
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<QuoteRequestFormData>({
    resolver: zodResolver(quoteRequestSchema),
    defaultValues: {
      productCategories: [],
      extraServices: [],
      privacyAgreed: false,
    },
  });

  const productCategories = watch('productCategories');
  const extraServices = watch('extraServices');

  const toggleCheckbox = (field: 'productCategories' | 'extraServices', value: string) => {
    const current = watch(field);
    if (current.includes(value)) {
      setValue(
        field,
        current.filter((item) => item !== value),
      );
    } else {
      setValue(field, [...current, value]);
    }
  };

  const onSubmit = async (data: QuoteRequestFormData) => {
    try {
      setSubmitStatus('idle');
      setErrorMessage('');

      const response = await fetch('/api/external-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_name: data.companyName,
          contact_name: data.contactName,
          email: data.email,
          phone: data.phone || null,
          monthly_outbound_range: data.monthlyOutboundRange,
          sku_count: data.skuCount || null,
          product_categories: data.productCategories,
          extra_services: data.extraServices,
          memo: data.memo || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '견적 요청에 실패했습니다.');
      }

      setSubmitStatus('success');
      reset();
      
      // 3초 후 성공 메시지 초기화
      setTimeout(() => {
        setSubmitStatus('idle');
      }, 5000);
    } catch (error) {
      console.error('Quote request error:', error);
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  const productCategoryOptions = [
    { value: '패션/의류', labelKey: 'fashion' as const },
    { value: '뷰티/화장품', labelKey: 'beauty' as const },
    { value: '식품/냉장·냉동', labelKey: 'food' as const },
    { value: '리빙/생활용품', labelKey: 'living' as const },
    { value: '디지털/가전', labelKey: 'digital' as const },
    { value: '기타', labelKey: 'other' as const },
  ];

  const extraServiceOptions = [
    { value: '지아미', labelKey: 'jiami' as const },
    { value: '에어캡 포장', labelKey: 'aircap' as const },
    { value: 'B2B 납품용 라벨링/포장', labelKey: 'b2b' as const },
    { value: '세트/번들 구성', labelKey: 'bundle' as const },
    { value: '선물 포장', labelKey: 'gift' as const },
    { value: '기타', labelKey: 'other' as const },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <HomeNavbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {/* 헤더 */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-3xl mb-6 shadow-xl">
            🚚
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6 tracking-tight">
            {t.quoteRequest.title}
          </h1>
          <div className="w-24 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 mx-auto mb-8 rounded-full"></div>
          <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto font-medium">
            {t.quoteRequest.subtitle}
          </p>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">{t.quoteRequest.description}</p>
        </div>

        {/* 성공 메시지 */}
        {submitStatus === 'success' && (
          <div className="mb-8 p-8 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-3xl shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start space-x-5">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <CheckIcon className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-green-900 mb-3">
                  {t.quoteRequest.success.title}
                </h3>
                <p className="text-green-700 text-lg mb-4">{t.quoteRequest.success.message}</p>
                <p className="text-sm text-green-600 bg-green-100 rounded-xl px-4 py-3 inline-block">
                  {t.quoteRequest.success.contact}{' '}
                  <a
                    href={`mailto:${t.quoteRequest.success.email}`}
                    className="font-bold underline hover:text-green-800 transition-colors"
                  >
                    {t.quoteRequest.success.email}
                  </a>
                  {t.quoteRequest.success.emailLabel}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {submitStatus === 'error' && (
          <div className="mb-8 p-8 bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-300 rounded-3xl shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start space-x-5">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <XMarkIcon className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-red-900 mb-3">
                  {t.quoteRequest.error.title}
                </h3>
                <p className="text-red-700 text-lg">{errorMessage || t.quoteRequest.error.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* 폼 */}
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-100">
          {/* 기본 정보 */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                <UserIcon className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">
                {t.quoteRequest.form.basicInfo.title}
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* 회사명 */}
              <div className="group">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <BuildingOfficeIcon className="w-5 h-5 text-blue-600" />
                  {t.quoteRequest.form.basicInfo.companyName.label} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    {...register('companyName')}
                    placeholder={t.quoteRequest.form.basicInfo.companyName.placeholder}
                    className={`w-full px-5 py-4 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                      errors.companyName
                        ? 'border-red-300 focus:border-red-500 bg-red-50'
                        : 'border-gray-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 bg-white'
                    }`}
                  />
                </div>
                {errors.companyName && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <XMarkIcon className="w-4 h-4" />
                    {t.quoteRequest.form.basicInfo.companyName.required}
                  </p>
                )}
              </div>

              {/* 담당자명 */}
              <div className="group">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-blue-600" />
                  {t.quoteRequest.form.basicInfo.contactName.label} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    {...register('contactName')}
                    placeholder={t.quoteRequest.form.basicInfo.contactName.placeholder}
                    className={`w-full px-5 py-4 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                      errors.contactName
                        ? 'border-red-300 focus:border-red-500 bg-red-50'
                        : 'border-gray-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 bg-white'
                    }`}
                  />
                </div>
                {errors.contactName && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <XMarkIcon className="w-4 h-4" />
                    {t.quoteRequest.form.basicInfo.contactName.required}
                  </p>
                )}
              </div>

              {/* 이메일 */}
              <div className="group">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <EnvelopeIcon className="w-5 h-5 text-blue-600" />
                  {t.quoteRequest.form.basicInfo.email.label} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    {...register('email')}
                    placeholder={t.quoteRequest.form.basicInfo.email.placeholder}
                    className={`w-full px-5 py-4 border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                      errors.email
                        ? 'border-red-300 focus:border-red-500 bg-red-50'
                        : 'border-gray-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 bg-white'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <XMarkIcon className="w-4 h-4" />
                    {errors.email.message === 'invalid'
                      ? t.quoteRequest.form.basicInfo.email.invalid
                      : t.quoteRequest.form.basicInfo.email.required}
                  </p>
                )}
              </div>

              {/* 연락처 */}
              <div className="group">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <PhoneIcon className="w-5 h-5 text-blue-600" />
                  {t.quoteRequest.form.basicInfo.phone.label}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    {...register('phone')}
                    placeholder={t.quoteRequest.form.basicInfo.phone.placeholder}
                    className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 물량 및 상품 정보 */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
                <TruckIcon className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">
                {t.quoteRequest.form.volumeInfo.title}
              </h2>
            </div>

            {/* 월 출고량 */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-indigo-600" />
                {t.quoteRequest.form.volumeInfo.monthlyOutbound.label}{' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="grid md:grid-cols-2 gap-3">
                {monthlyRanges.map((range) => (
                  <label
                    key={range}
                    className={`group relative flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      watch('monthlyOutboundRange') === range
                        ? 'border-indigo-600 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 hover:shadow-sm'
                    }`}
                  >
                    <input
                      type="radio"
                      value={range}
                      {...register('monthlyOutboundRange')}
                      className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
                    />
                    <span className={`ml-3 font-medium ${
                      watch('monthlyOutboundRange') === range ? 'text-indigo-900' : 'text-gray-700'
                    }`}>
                      {t.quoteRequest.form.volumeInfo.monthlyOutbound.ranges[range]}
                    </span>
                    {watch('monthlyOutboundRange') === range && (
                      <CheckIcon className="w-5 h-5 text-indigo-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
              {errors.monthlyOutboundRange && (
                <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
                  <XMarkIcon className="w-4 h-4" />
                  {t.quoteRequest.form.volumeInfo.monthlyOutbound.required}
                </p>
              )}
            </div>

            {/* SKU 수량 */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <CubeIcon className="w-5 h-5 text-indigo-600" />
                {t.quoteRequest.form.volumeInfo.skuCount.label}
              </label>
              <input
                type="text"
                {...register('skuCount')}
                placeholder={t.quoteRequest.form.volumeInfo.skuCount.placeholder}
                className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all duration-200 bg-white"
              />
              <p className="mt-2 text-sm text-gray-500 flex items-center gap-1">
                💡 {t.quoteRequest.form.volumeInfo.skuCount.helper}
              </p>
            </div>

            {/* 상품군 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <ShoppingBagIcon className="w-5 h-5 text-indigo-600" />
                {t.quoteRequest.form.volumeInfo.productCategories.label}
              </label>
              <p className="text-sm text-gray-500 mb-4 pl-7">
                {t.quoteRequest.form.volumeInfo.productCategories.helper}
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {productCategoryOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`group relative flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      productCategories.includes(option.value)
                        ? 'border-indigo-600 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-md'
                        : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 hover:shadow-sm'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={productCategories.includes(option.value)}
                      onChange={() => toggleCheckbox('productCategories', option.value)}
                      className="w-5 h-5 text-indigo-600 rounded-lg focus:ring-indigo-500 focus:ring-2"
                    />
                    <span className={`ml-3 font-medium ${
                      productCategories.includes(option.value) ? 'text-indigo-900' : 'text-gray-700'
                    }`}>
                      {t.quoteRequest.form.volumeInfo.productCategories.options[option.labelKey]}
                    </span>
                    {productCategories.includes(option.value) && (
                      <CheckIcon className="w-5 h-5 text-indigo-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 추가 작업 */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg">
                <WrenchScrewdriverIcon className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">
                {t.quoteRequest.form.servicesInfo.title}
              </h2>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-purple-600" />
                {t.quoteRequest.form.servicesInfo.extraServices.label}
              </label>
              <p className="text-sm text-gray-500 mb-4 pl-7">
                {t.quoteRequest.form.servicesInfo.extraServices.helper}
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {extraServiceOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`group relative flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      extraServices.includes(option.value)
                        ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md'
                        : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50 hover:shadow-sm'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={extraServices.includes(option.value)}
                      onChange={() => toggleCheckbox('extraServices', option.value)}
                      className="w-5 h-5 text-purple-600 rounded-lg focus:ring-purple-500 focus:ring-2"
                    />
                    <span className={`ml-3 font-medium ${
                      extraServices.includes(option.value) ? 'text-purple-900' : 'text-gray-700'
                    }`}>
                      {t.quoteRequest.form.servicesInfo.extraServices.options[option.labelKey]}
                    </span>
                    {extraServices.includes(option.value) && (
                      <CheckIcon className="w-5 h-5 text-purple-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 추가 메모 */}
          <div className="mb-10">
            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <ChatBubbleBottomCenterTextIcon className="w-5 h-5 text-blue-600" />
              {t.quoteRequest.form.memo.label}
            </label>
            <textarea
              {...register('memo')}
              rows={6}
              placeholder={t.quoteRequest.form.memo.placeholder}
              className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all duration-200 resize-none bg-white"
            />
          </div>

          {/* 개인정보 동의 */}
          <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
            <label className="flex items-start space-x-4 cursor-pointer group">
              <input
                type="checkbox"
                {...register('privacyAgreed')}
                className="w-6 h-6 text-blue-600 rounded-lg mt-0.5 focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm text-gray-800 font-medium leading-relaxed">
                {t.quoteRequest.form.privacy.text}
              </span>
            </label>
            {errors.privacyAgreed && (
              <p className="mt-3 text-sm text-red-600 flex items-center gap-1 ml-10">
                <XMarkIcon className="w-4 h-4" />
                {t.quoteRequest.form.privacy.required}
              </p>
            )}
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-5 px-8 rounded-2xl font-bold text-white text-lg shadow-xl transition-all duration-300 transform ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed scale-95'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t.quoteRequest.form.submitting}
                </>
              ) : (
                <>
                  {t.quoteRequest.form.submit}
                  <span className="text-xl">→</span>
                </>
              )}
            </span>
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
}

export default function QuoteRequestPage() {
  return (
    <LanguageProvider>
      <QuoteRequestContent />
    </LanguageProvider>
  );
}

