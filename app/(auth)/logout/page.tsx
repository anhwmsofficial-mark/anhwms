'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/utils/supabase/client';

const REDIRECT_SECONDS = 5;

export default function LogoutPage() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.signOut();

    let remaining = REDIRECT_SECONDS;
    setSecondsLeft(remaining);

    const intervalId = window.setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(intervalId);
        router.push('/login');
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-pink-50">
      <Image
        src="/홈배경.gif"
        alt="배경 애니메이션"
        fill
        priority
        unoptimized
        className="object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-white/70" />

      <div className="absolute left-8 top-8 hidden sm:block">
        <Image
          src="/globe.svg"
          alt="떠다니는 지구"
          width={64}
          height={64}
          className="animate-bounce opacity-80"
        />
      </div>
      <div className="absolute right-10 top-16 hidden sm:block">
        <Image
          src="/file.svg"
          alt="귀여운 스티커"
          width={56}
          height={56}
          className="animate-pulse opacity-70"
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-3xl border border-blue-100 bg-white/90 p-8 text-center shadow-xl backdrop-blur">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white">
            <SparklesIcon className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">로그아웃 완료!</h1>
          <p className="mt-2 text-sm text-gray-600">또만나요!! ㅎㅎㅎ</p>

          <div className="relative mx-auto mt-6 h-40 w-40">
            <Image
              src="/글로벌.gif"
              alt="안녕 인사하는 캐릭터"
              fill
              unoptimized
              className="object-contain"
            />
          </div>

          <p className="mt-6 text-base text-gray-700">
            오늘도 수고 많으셨어요. 다음에 또 만나요!
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {secondsLeft}초 후 로그인 화면으로 이동해요.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              다시 로그인
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-6 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              홈으로 가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
