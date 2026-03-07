export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"
          aria-hidden
        />
        <p className="text-sm text-gray-500">불러오는 중...</p>
      </div>
    </div>
  );
}
