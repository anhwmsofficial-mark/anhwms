import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface SampleDataNoticeProps {
  title?: string;
  description?: string;
}

export function SampleDataNotice({
  title = '샘플 데이터 화면입니다',
  description = '이 화면의 수치와 목록은 운영 데이터가 아니며, 실제 의사결정이나 고객 안내에 사용하면 안 됩니다.',
}: SampleDataNoticeProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
      <div className="flex gap-3">
        <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}
