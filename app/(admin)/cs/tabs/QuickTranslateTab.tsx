'use client';

import { useState } from 'react';
import { ArrowsRightLeftIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

interface TranslateBoxProps {
  title: string;
  sourceLangFixed: 'ko' | 'zh';
  targetLangFixed: 'ko' | 'zh';
  emoji: string;
  gradient: string;
}

function TranslateBox({ title, sourceLangFixed, targetLangFixed, emoji, gradient }: TranslateBoxProps) {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [tone, setTone] = useState<'business' | 'friendly' | 'formal'>('friendly');
  const [formality, setFormality] = useState<'formal' | 'neutral' | 'casual'>('formal');
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
          sourceLang: sourceLangFixed,
          targetLang: targetLangFixed,
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

  const sourceLangName = sourceLangFixed === 'ko' ? '🇰🇷 한국어' : '🇨🇳 中文';
  const targetLangName = targetLangFixed === 'ko' ? '🇰🇷 한국어' : '🇨🇳 中文';

  return (
    <div className={`${gradient} rounded-2xl shadow-lg p-6 border-2 border-gray-200`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          {title}
        </h3>
        <div className="text-xs text-gray-600 bg-white px-3 py-1.5 rounded-full shadow-sm font-semibold">
          {sourceLangName} → {targetLangName}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* 설정 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">톤</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as any)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
          >
            <option value="business">💼 비즈니스</option>
            <option value="friendly">😊 친근함</option>
            <option value="formal">🎩 공식</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">격식</label>
          <select
            value={formality}
            onChange={(e) => setFormality(e.target.value as any)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
          >
            <option value="formal">⭐ 격식있게</option>
            <option value="neutral">➖ 중립</option>
            <option value="casual">💬 캐주얼</option>
          </select>
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          📝 원문 ({sourceLangName})
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
          placeholder={`${sourceLangName} 텍스트를 입력하세요...\n\n💡 Enter: 바로 번역 | Shift+Enter: 줄바꿈`}
          className="w-full h-40 rounded-lg border-2 border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none bg-white text-base"
          disabled={isTranslating}
        />
      </div>

      {/* 출력 영역 */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          ✨ 번역 결과 ({targetLangName})
        </label>
        <textarea
          value={translatedText}
          readOnly
          placeholder="번역 결과가 여기에 표시됩니다..."
          className="w-full h-40 rounded-lg border-2 border-blue-200 px-4 py-3 bg-blue-50 resize-none text-base"
        />
      </div>

      {/* 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={handleTranslate}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          disabled={isTranslating}
        >
          {isTranslating ? (
            <>
              <span className="animate-spin">⏳</span>
              번역 중...
            </>
          ) : (
            <>
              🚀 번역하기
            </>
          )}
        </button>
        <button
          onClick={handleCopy}
          className={`px-6 py-2.5 rounded-lg transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2 ${
            translatedText
              ? copied
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
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
    </div>
  );
}

export default function QuickTranslateTab() {
  return (
    <div className="space-y-6">
      {/* 안내 헤더 */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <span className="text-3xl">🌐</span>
          Quick Translate - 실시간 양방향 번역
        </h2>
        <p className="text-blue-100">
          한국어 ↔ 중국어 번역을 동시에 처리할 수 있습니다. 실무에 최적화된 AI 번역 시스템!
        </p>
      </div>

      {/* 2개의 번역 박스 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TranslateBox
          title="한국어 → 중국어"
          sourceLangFixed="ko"
          targetLangFixed="zh"
          emoji="🇰🇷"
          gradient="bg-gradient-to-br from-white to-blue-50"
        />
        <TranslateBox
          title="中文 → 한국어"
          sourceLangFixed="zh"
          targetLangFixed="ko"
          emoji="🇨🇳"
          gradient="bg-gradient-to-br from-white to-purple-50"
        />
      </div>

      {/* 사용 팁 */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-2xl">💡</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-semibold text-yellow-900">사용 팁</h3>
            <div className="mt-2 text-sm text-yellow-700 space-y-1">
              <p>• <strong>Enter</strong> 키를 눌러 빠르게 번역할 수 있습니다.</p>
              <p>• <strong>Shift + Enter</strong>로 줄바꿈을 입력할 수 있습니다.</p>
              <p>• 양쪽 번역기를 동시에 사용하여 효율적으로 작업하세요!</p>
              <p>• 번역 결과를 클릭 한 번으로 복사할 수 있습니다.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

