'use client';

import { useState } from 'react';
import { ArrowsRightLeftIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function QuickTranslateTab() {
  const [sourceLang, setSourceLang] = useState<'ko' | 'zh'>('ko');
  const [targetLang, setTargetLang] = useState<'ko' | 'zh'>('zh');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [tone, setTone] = useState<'business' | 'friendly' | 'formal'>('business');
  const [formality, setFormality] = useState<'formal' | 'neutral' | 'casual'>('neutral');
  const [copied, setCopied] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      setError('번역할 텍스트를 입력하세요.');
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const response = await fetch('/api/cs/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceLang,
          targetLang,
          text: sourceText,
          tone,
          formality,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: '번역에 실패했습니다.' }));
        throw new Error(data.error || '번역에 실패했습니다.');
      }

      const data = await response.json();
      setTranslatedText(data.translatedText ?? '');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '번역 중 오류가 발생했습니다.');
      setTranslatedText('');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSwap = () => {
    const nextSource = targetLang;
    const nextTarget = sourceLang;
    setSourceLang(nextSource);
    setTargetLang(nextTarget);
    const tempText = sourceText;
    setSourceText(translatedText);
    setTranslatedText(tempText);
    setError(null);
  };

  const handleCopy = async () => {
    if (!translatedText) return;
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      setError('클립보드 복사에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Translate (KR⇄ZH)</h3>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
        
        {/* 언어 선택 및 설정 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">출발 언어</label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as 'ko' | 'zh')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ko">한국어 (KR)</option>
              <option value="zh">중국어 (ZH)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">도착 언어</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as 'ko' | 'zh')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ko">한국어 (KR)</option>
              <option value="zh">중국어 (ZH)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">톤</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as any)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="business">비즈니스</option>
              <option value="friendly">친근함</option>
              <option value="formal">공식</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">격식</label>
            <select
              value={formality}
              onChange={(e) => setFormality(e.target.value as any)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="formal">격식있게</option>
              <option value="neutral">중립</option>
              <option value="casual">캐주얼</option>
            </select>
          </div>
        </div>

        {/* 번역 영역 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              원문 ({sourceLang.toUpperCase()})
            </label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="번역할 텍스트를 입력하세요..."
              className="w-full h-48 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={isTranslating}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                번역 결과 ({targetLang.toUpperCase()})
              </label>
              <button
                onClick={handleCopy}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                disabled={!translatedText}
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    복사됨
                  </>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    복사
                  </>
                )}
              </button>
            </div>
            <textarea
              value={translatedText}
              readOnly
              placeholder="번역 결과가 여기에 표시됩니다..."
              className="w-full h-48 rounded-lg border border-gray-300 px-4 py-2 bg-gray-50 resize-none"
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleSwap}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            disabled={isTranslating}
          >
            <ArrowsRightLeftIcon className="h-5 w-5" />
            언어 교체
          </button>
          <button
            onClick={handleTranslate}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={isTranslating}
          >
            {isTranslating ? '번역 중...' : '번역하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

