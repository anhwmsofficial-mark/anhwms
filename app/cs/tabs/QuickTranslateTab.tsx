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
      <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg p-8 border border-blue-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <span className="text-3xl">🌐</span>
            Quick Translate
          </h3>
          <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-full shadow-sm">
            KR ⇄ ZH
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            {error}
          </div>
        )}
        
        {/* 언어 선택 및 설정 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">출발 언어</label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as 'ko' | 'zh')}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all bg-white shadow-sm"
            >
              <option value="ko">🇰🇷 한국어</option>
              <option value="zh">🇨🇳 中文</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">도착 언어</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as 'ko' | 'zh')}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all bg-white shadow-sm"
            >
              <option value="ko">🇰🇷 한국어</option>
              <option value="zh">🇨🇳 中文</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">톤</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as any)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all bg-white shadow-sm"
            >
              <option value="business">💼 비즈니스</option>
              <option value="friendly">😊 친근함</option>
              <option value="formal">🎩 공식</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">격식</label>
            <select
              value={formality}
              onChange={(e) => setFormality(e.target.value as any)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all bg-white shadow-sm"
            >
              <option value="formal">⭐ 격식있게</option>
              <option value="neutral">➖ 중립</option>
              <option value="casual">💬 캐주얼</option>
            </select>
          </div>
        </div>

        {/* 번역 영역 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <span>📝 원문</span>
              <span className="text-xs font-normal text-gray-500">({sourceLang.toUpperCase()})</span>
            </label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isTranslating) {
                  e.preventDefault();
                  handleTranslate();
                }
              }}
              placeholder="번역할 텍스트를 입력하세요... 
              
💡 Tip: Enter 키로 바로 번역
      Shift + Enter로 줄바꿈"
              className="w-full h-64 rounded-xl border-2 border-gray-200 px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none transition-all bg-white shadow-sm text-base leading-relaxed"
              disabled={isTranslating}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <span>✨ 번역 결과</span>
              <span className="text-xs font-normal text-gray-500">({targetLang.toUpperCase()})</span>
            </label>
            <textarea
              value={translatedText}
              readOnly
              placeholder="번역 결과가 여기에 표시됩니다..."
              className="w-full h-64 rounded-xl border-2 border-blue-100 px-5 py-4 bg-gradient-to-br from-blue-50 to-white resize-none shadow-sm text-base leading-relaxed"
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleSwap}
            className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-2 font-semibold text-gray-700 shadow-sm"
            disabled={isTranslating}
          >
            <ArrowsRightLeftIcon className="h-5 w-5" />
            언어 교체
          </button>
          <button
            onClick={handleTranslate}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl flex items-center gap-2"
            disabled={isTranslating}
          >
            {isTranslating ? (
              <>
                <span className="animate-spin">⏳</span>
                번역 중...
              </>
            ) : (
              <>
                <span>🚀</span>
                번역하기
              </>
            )}
          </button>
          <button
            onClick={handleCopy}
            className={`px-6 py-3 rounded-xl transition-all font-semibold shadow-lg hover:shadow-xl flex items-center gap-2 ${
              translatedText
                ? copied
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!translatedText}
          >
            {copied ? (
              <>
                <CheckIcon className="h-5 w-5" />
                복사 완료!
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-5 w-5" />
                번역 복사하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

