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
  GlobeAltIcon,
  TruckIcon,
  CubeIcon,
  ShoppingBagIcon,
  ScaleIcon,
  ChatBubbleBottomCenterTextIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const monthlyVolumes = ['0_100', '100_500', '500_1000', '1000_3000', '3000_plus'] as const;
const shippingMethods = ['air', 'express', 'sea', 'combined'] as const;
const tradeTermsOptions = ['FOB', 'DDP', 'EXW', 'CIF', 'not_sure'] as const;

const internationalQuoteSchema = z.object({
  companyName: z.string().min(1, { message: 'required' }),
  contactName: z.string().min(1, { message: 'required' }),
  email: z.string().email({ message: 'invalid' }),
  phone: z.string().optional(),
  destinationCountries: z.array(z.string()).min(1, { message: 'required' }),
  shippingMethod: z.enum(shippingMethods).optional(),
  monthlyShipmentVolume: z.enum(monthlyVolumes),
  avgBoxWeight: z.string().optional(),
  skuCount: z.string().optional(),
  productCategories: z.array(z.string()),
  productCharacteristics: z.array(z.string()),
  customsSupportNeeded: z.boolean(),
  tradeTerms: z.enum(tradeTermsOptions).optional(),
  memo: z.string().optional(),
  privacyAgreed: z.boolean().refine((val) => val === true, {
    message: 'required',
  }),
});

type InternationalQuoteFormData = z.infer<typeof internationalQuoteSchema>;

function InternationalQuoteRequestContent() {
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
  } = useForm<InternationalQuoteFormData>({
    resolver: zodResolver(internationalQuoteSchema),
    defaultValues: {
      destinationCountries: [],
      productCategories: [],
      productCharacteristics: [],
      customsSupportNeeded: false,
      privacyAgreed: false,
    },
  });

  const destinationCountries = watch('destinationCountries');
  const productCategories = watch('productCategories');
  const productCharacteristics = watch('productCharacteristics');

  const toggleCheckbox = (
    field: 'destinationCountries' | 'productCategories' | 'productCharacteristics',
    value: string,
  ) => {
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

  const onSubmit = async (data: InternationalQuoteFormData) => {
    try {
      setSubmitStatus('idle');
      setErrorMessage('');

      const response = await fetch('/api/international-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_name: data.companyName,
          contact_name: data.contactName,
          email: data.email,
          phone: data.phone || null,
          destination_countries: data.destinationCountries,
          shipping_method: data.shippingMethod || null,
          monthly_shipment_volume: data.monthlyShipmentVolume,
          avg_box_weight: data.avgBoxWeight || null,
          sku_count: data.skuCount || null,
          product_categories: data.productCategories,
          product_characteristics: data.productCharacteristics,
          customs_support_needed: data.customsSupportNeeded,
          trade_terms: data.tradeTerms || null,
          memo: data.memo || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '견적 요청에 실패했습니다.');
      }

      setSubmitStatus('success');
      reset();

      setTimeout(() => {
        setSubmitStatus('idle');
      }, 5000);
    } catch (error) {
      console.error('International quote request error:', error);
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  const destinationCountryOptions = [
    { value: '중국', labelKey: 'china' as const },
    { value: '일본', labelKey: 'japan' as const },
    { value: '베트남', labelKey: 'vietnam' as const },
    { value: '태국', labelKey: 'thailand' as const },
    { value: '싱가포르', labelKey: 'singapore' as const },
    { value: '말레이시아', labelKey: 'malaysia' as const },
    { value: '대만', labelKey: 'taiwan' as const },
    { value: '홍콩', labelKey: 'hong_kong' as const },
    { value: '미국', labelKey: 'usa' as const },
    { value: '유럽', labelKey: 'europe' as const },
    { value: '기타', labelKey: 'other' as const },
  ];

  const productCategoryOptions = [
    { value: '패션/의류', labelKey: 'fashion' as const },
    { value: '뷰티/화장품', labelKey: 'beauty' as const },
    { value: '식품/냉장·냉동', labelKey: 'food' as const },
    { value: '리빙/생활용품', labelKey: 'living' as const },
    { value: '디지털/가전', labelKey: 'digital' as const },
    { value: '기타', labelKey: 'other' as const },
  ];

  const productCharacteristicOptions = [
    { value: '일반 상품', labelKey: 'general' as const },
    { value: '깨지기 쉬운 제품', labelKey: 'fragile' as const },
    { value: '액체류', labelKey: 'liquid' as const },
    { value: '식품', labelKey: 'food' as const },
    { value: '화장품', labelKey: 'cosmetics' as const },
    { value: '전자제품', labelKey: 'electronics' as const },
    { value: '배터리 포함 제품', labelKey: 'battery' as const },
    { value: '고가품', labelKey: 'high_value' as const },
    { value: '기타', labelKey: 'other' as const },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-fuchsia-100">
      <HomeNavbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {/* 헤더 */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 text-white text-3xl mb-6 shadow-xl">
            ✈️
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6 tracking-tight">
            {t.internationalQuoteRequest.title}
          </h1>
          <div className="w-24 h-1.5 bg-gradient-to-r from-purple-600 via-pink-600 to-fuchsia-600 mx-auto mb-8 rounded-full"></div>
          <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto font-medium">
            {t.internationalQuoteRequest.subtitle}
          </p>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">{t.internationalQuoteRequest.description}</p>
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
                  {t.internationalQuoteRequest.success.title}
                </h3>
                <p className="text-green-700 text-lg mb-4">{t.internationalQuoteRequest.success.message}</p>
                <p className="text-sm text-green-600 bg-green-100 rounded-xl px-4 py-3 inline-block">
                  {t.internationalQuoteRequest.success.contact}{' '}
                  <a
                    href={`mailto:${t.internationalQuoteRequest.success.email}`}
                    className="font-bold underline hover:text-green-800 transition-colors"
                  >
                    {t.internationalQuoteRequest.success.email}
                  </a>
                  {t.internationalQuoteRequest.success.emailLabel}
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
                  {t.internationalQuoteRequest.error.title}
                </h3>
                <p className="text-red-700 text-lg">
                  {errorMessage || t.internationalQuoteRequest.error.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 폼 */}
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-100">
          {/* 기본 정보 */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg">
                <UserIcon className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">
                {t.internationalQuoteRequest.form.basicInfo.title}
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* 회사명 */}
              <div className="group">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <BuildingOfficeIcon className="w-5 h-5 text-purple-600" />
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
                        : 'border-gray-300 focus:border-purple-600 focus:ring-4 focus:ring-purple-100 bg-white'
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
                  <UserIcon className="w-5 h-5 text-purple-600" />
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
                        : 'border-gray-300 focus:border-purple-600 focus:ring-4 focus:ring-purple-100 bg-white'
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
                  <EnvelopeIcon className="w-5 h-5 text-purple-600" />
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
                        : 'border-gray-300 focus:border-purple-600 focus:ring-4 focus:ring-purple-100 bg-white'
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
                  <PhoneIcon className="w-5 h-5 text-purple-600" />
                  {t.quoteRequest.form.basicInfo.phone.label}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    {...register('phone')}
                    placeholder={t.quoteRequest.form.basicInfo.phone.placeholder}
                    className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:border-purple-600 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all duration-200 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 배송 정보 */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow-lg">
                <GlobeAltIcon className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">
                {t.internationalQuoteRequest.form.shippingInfo.title}
              </h2>
            </div>

            {/* 목적지 국가 */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-pink-600" />
                {t.internationalQuoteRequest.form.shippingInfo.destinationCountries.label}{' '}
                <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-gray-500 mb-4 pl-7">
                {t.internationalQuoteRequest.form.shippingInfo.destinationCountries.helper}
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                {destinationCountryOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`group relative flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      destinationCountries.includes(option.value)
                        ? 'border-pink-600 bg-gradient-to-br from-pink-50 to-fuchsia-50 shadow-md'
                        : 'border-gray-300 hover:border-pink-400 hover:bg-pink-50/50 hover:shadow-sm'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={destinationCountries.includes(option.value)}
                      onChange={() => toggleCheckbox('destinationCountries', option.value)}
                      className="w-5 h-5 text-pink-600 rounded-lg focus:ring-pink-500 focus:ring-2"
                    />
                    <span className={`ml-3 font-medium ${
                      destinationCountries.includes(option.value) ? 'text-pink-900' : 'text-gray-700'
                    }`}>
                      {t.internationalQuoteRequest.form.shippingInfo.destinationCountries.options[option.labelKey]}
                    </span>
                    {destinationCountries.includes(option.value) && (
                      <CheckIcon className="w-5 h-5 text-pink-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
              {errors.destinationCountries && (
                <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
                  <XMarkIcon className="w-4 h-4" />
                  {t.internationalQuoteRequest.form.shippingInfo.destinationCountries.required}
                </p>
              )}
            </div>

            {/* 배송 방식 */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <TruckIcon className="w-5 h-5 text-pink-600" />
                {t.internationalQuoteRequest.form.shippingInfo.shippingMethod.label}
              </label>
              <div className="grid md:grid-cols-2 gap-3">
                {shippingMethods.map((method) => (
                  <label
                    key={method}
                    className={`group relative flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      watch('shippingMethod') === method
                        ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md scale-[1.02]'
                        : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50 hover:shadow-sm'
                    }`}
                  >
                    <input
                      type="radio"
                      value={method}
                      {...register('shippingMethod')}
                      className="w-5 h-5 text-purple-600 focus:ring-purple-500 focus:ring-2"
                    />
                    <span className={`ml-3 font-medium ${
                      watch('shippingMethod') === method ? 'text-purple-900' : 'text-gray-700'
                    }`}>
                      {t.internationalQuoteRequest.form.shippingInfo.shippingMethod.options[method]}
                    </span>
                    {watch('shippingMethod') === method && (
                      <CheckIcon className="w-5 h-5 text-purple-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* 월 발송량 */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <CubeIcon className="w-5 h-5 text-pink-600" />
                {t.internationalQuoteRequest.form.shippingInfo.monthlyVolume.label}{' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="grid md:grid-cols-2 gap-3">
                {monthlyVolumes.map((volume) => (
                  <label
                    key={volume}
                    className={`group relative flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      watch('monthlyShipmentVolume') === volume
                        ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md scale-[1.02]'
                        : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50 hover:shadow-sm'
                    }`}
                  >
                    <input
                      type="radio"
                      value={volume}
                      {...register('monthlyShipmentVolume')}
                      className="w-5 h-5 text-purple-600 focus:ring-purple-500 focus:ring-2"
                    />
                    <span className={`ml-3 font-medium ${
                      watch('monthlyShipmentVolume') === volume ? 'text-purple-900' : 'text-gray-700'
                    }`}>
                      {t.internationalQuoteRequest.form.shippingInfo.monthlyVolume.ranges[volume]}
                    </span>
                    {watch('monthlyShipmentVolume') === volume && (
                      <CheckIcon className="w-5 h-5 text-purple-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
              {errors.monthlyShipmentVolume && (
                <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
                  <XMarkIcon className="w-4 h-4" />
                  {t.internationalQuoteRequest.form.shippingInfo.monthlyVolume.required}
                </p>
              )}
            </div>

            {/* 평균 박스 무게 & SKU 수량 */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <ScaleIcon className="w-5 h-5 text-pink-600" />
                  {t.internationalQuoteRequest.form.shippingInfo.avgBoxWeight.label}
                </label>
                <input
                  type="text"
                  {...register('avgBoxWeight')}
                  placeholder={t.internationalQuoteRequest.form.shippingInfo.avgBoxWeight.placeholder}
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:border-purple-600 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all duration-200 bg-white"
                />
                <p className="mt-2 text-sm text-gray-500 flex items-center gap-1">
                  💡 {t.internationalQuoteRequest.form.shippingInfo.avgBoxWeight.helper}
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <CubeIcon className="w-5 h-5 text-pink-600" />
                  {t.quoteRequest.form.volumeInfo.skuCount.label}
                </label>
                <input
                  type="text"
                  {...register('skuCount')}
                  placeholder={t.quoteRequest.form.volumeInfo.skuCount.placeholder}
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:border-purple-600 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all duration-200 bg-white"
                />
                <p className="mt-2 text-sm text-gray-500 flex items-center gap-1">
                  💡 {t.quoteRequest.form.volumeInfo.skuCount.helper}
                </p>
              </div>
            </div>
          </div>

          {/* 상품 정보 */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-lg">
                <ShoppingBagIcon className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">
                {t.internationalQuoteRequest.form.productInfo.title}
              </h2>
            </div>

            {/* 상품군 */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t.quoteRequest.form.volumeInfo.productCategories.label}
              </label>
              <p className="text-sm text-gray-500 mb-3">
                {t.quoteRequest.form.volumeInfo.productCategories.helper}
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {productCategoryOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      productCategories.includes(option.value)
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-300 hover:border-purple-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={productCategories.includes(option.value)}
                      onChange={() => toggleCheckbox('productCategories', option.value)}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="ml-3 text-gray-700">
                      {t.quoteRequest.form.volumeInfo.productCategories.options[option.labelKey]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 상품 특성 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t.internationalQuoteRequest.form.productInfo.productCharacteristics.label}
              </label>
              <p className="text-sm text-gray-500 mb-3">
                {t.internationalQuoteRequest.form.productInfo.productCharacteristics.helper}
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {productCharacteristicOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      productCharacteristics.includes(option.value)
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-300 hover:border-purple-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={productCharacteristics.includes(option.value)}
                      onChange={() => toggleCheckbox('productCharacteristics', option.value)}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="ml-3 text-gray-700">
                      {t.internationalQuoteRequest.form.productInfo.productCharacteristics.options[option.labelKey]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 통관 및 무역 조건 */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg">
                <GlobeAltIcon className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">
                {t.internationalQuoteRequest.form.customsInfo.title}
              </h2>
            </div>

            {/* 통관 지원 */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                {t.internationalQuoteRequest.form.customsInfo.customsSupport.label}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="true"
                    checked={watch('customsSupportNeeded') === true}
                    onChange={() => setValue('customsSupportNeeded', true)}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="ml-2 text-gray-700">
                    {t.internationalQuoteRequest.form.customsInfo.customsSupport.yes}
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="false"
                    checked={watch('customsSupportNeeded') === false}
                    onChange={() => setValue('customsSupportNeeded', false)}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="ml-2 text-gray-700">
                    {t.internationalQuoteRequest.form.customsInfo.customsSupport.no}
                  </span>
                </label>
              </div>
            </div>

            {/* 무역 조건 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                {t.internationalQuoteRequest.form.customsInfo.tradeTerms.label}
              </label>
              <div className="grid md:grid-cols-3 gap-3">
                {tradeTermsOptions.map((term) => (
                  <label
                    key={term}
                    className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      watch('tradeTerms') === term
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-300 hover:border-purple-400'
                    }`}
                  >
                    <input
                      type="radio"
                      value={term}
                      {...register('tradeTerms')}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="ml-3 text-gray-700">
                      {t.internationalQuoteRequest.form.customsInfo.tradeTerms.options[term]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 추가 메모 */}
          <div className="mb-10">
            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <ChatBubbleBottomCenterTextIcon className="w-5 h-5 text-purple-600" />
              {t.quoteRequest.form.memo.label}
            </label>
            <textarea
              {...register('memo')}
              rows={6}
              placeholder={t.quoteRequest.form.memo.placeholder}
              className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl focus:border-purple-600 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all duration-200 resize-none bg-white"
            />
          </div>

          {/* 개인정보 동의 */}
          <div className="mb-8 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200">
            <label className="flex items-start space-x-4 cursor-pointer group">
              <input
                type="checkbox"
                {...register('privacyAgreed')}
                className="w-6 h-6 text-purple-600 rounded-lg mt-0.5 focus:ring-purple-500 focus:ring-2"
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
                : 'bg-gradient-to-r from-purple-600 via-pink-600 to-fuchsia-600 hover:from-purple-700 hover:via-pink-700 hover:to-fuchsia-700 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t.internationalQuoteRequest.form.submitting}
                </>
              ) : (
                <>
                  {t.internationalQuoteRequest.form.submit}
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

export default function InternationalQuoteRequestPage() {
  return (
    <LanguageProvider>
      <InternationalQuoteRequestContent />
    </LanguageProvider>
  );
}

