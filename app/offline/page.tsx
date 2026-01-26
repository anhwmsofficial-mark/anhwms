import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900">오프라인 상태입니다</h1>
        <p className="mb-8 text-lg text-gray-600">
          인터넷 연결을 확인해주세요. 일부 기능은 오프라인에서 사용할 수 없습니다.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
        >
          메인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
