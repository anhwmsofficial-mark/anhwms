function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200 ${className}`} />;
}

export default function InboundDashboardLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-3">
          <SkeletonBox className="h-7 w-48" />
          <SkeletonBox className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <SkeletonBox className="h-10 w-28" />
          <SkeletonBox className="h-10 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonBox key={index} className="h-36" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SkeletonBox className="h-80" />
          <SkeletonBox className="h-80" />
        </div>
        <div className="space-y-6">
          <SkeletonBox className="h-72" />
          <SkeletonBox className="h-48" />
        </div>
      </div>
    </div>
  );
}
