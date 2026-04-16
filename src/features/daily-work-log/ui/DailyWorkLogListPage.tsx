'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  DailyWorkLogListResult,
  DailyWorkLogMeta,
} from '@/src/features/daily-work-log/dto';

type DailyWorkLogListPageProps = {
  initialData: DailyWorkLogListResult;
  meta: DailyWorkLogMeta;
  entryBasePath: string;
  title: string;
  backUrl?: string;
  errorMessage?: string | null;
};

export default function DailyWorkLogListPage({
  initialData,
  meta,
  entryBasePath,
  title,
  backUrl,
  errorMessage,
}: DailyWorkLogListPageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => ({
      period: searchParams?.get('period') || initialData.filters.period,
      startDate: searchParams?.get('startDate') || initialData.filters.startDate,
      endDate: searchParams?.get('endDate') || initialData.filters.endDate,
      warehouseId: searchParams?.get('warehouseId') || initialData.filters.warehouseId,
      keyword: searchParams?.get('keyword') || initialData.filters.keyword,
    }),
    [
      initialData.filters.endDate,
      initialData.filters.keyword,
      initialData.filters.period,
      initialData.filters.startDate,
      initialData.filters.warehouseId,
      searchParams,
    ],
  );

  const updateSearchParams = (patch: Partial<typeof filters>) => {
    const nextParams = new URLSearchParams(searchParams?.toString() || '');

    Object.entries({ ...filters, ...patch }).forEach(([key, value]) => {
      const normalized = String(value || '').trim();
      if (!normalized) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, normalized);
      }
    });

    router.push(`${pathname}?${nextParams.toString()}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header title={title} backUrl={backUrl} />

      <main className="flex-1 p-4 lg:p-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <p className="mt-1 text-sm text-gray-600">
                날짜/창고/담당자 기준으로 작업일지를 조회하고 기간 합계를 확인할 수 있습니다.
              </p>
            </div>
            <Link href={`${entryBasePath}/new`}>
              <Button>신규 등록</Button>
            </Link>
          </div>

          <InlineErrorAlert error={errorMessage} />

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">기간</label>
                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={filters.period}
                  onChange={(event) => updateSearchParams({ period: event.target.value })}
                >
                  <option value="day">일</option>
                  <option value="week">주</option>
                  <option value="month">월</option>
                  <option value="year">연</option>
                  <option value="custom">특정 기간</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">시작일</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => updateSearchParams({ startDate: event.target.value })}
                  disabled={filters.period !== 'custom'}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">종료일</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => updateSearchParams({ endDate: event.target.value })}
                  disabled={filters.period !== 'custom'}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">창고</label>
                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={filters.warehouseId}
                  onChange={(event) => updateSearchParams({ warehouseId: event.target.value })}
                >
                  <option value="">전체</option>
                  {meta.warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">등록자/담당자 검색</label>
                <Input
                  value={filters.keyword}
                  onChange={(event) => updateSearchParams({ keyword: event.target.value })}
                  placeholder="이름 검색"
                />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">작업일지 수</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{initialData.summary.totalLogs}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">총 근무인원</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{initialData.summary.totalWorkers}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">총 작업행</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{initialData.summary.totalLineCount}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">총 전일잔여</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {initialData.summary.totalPrevQty.toLocaleString()}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-blue-600">총 금일작업</div>
              <div className="mt-2 text-2xl font-bold text-blue-700">
                {initialData.summary.totalProcessedQty.toLocaleString()}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-amber-600">총 금일잔여</div>
              <div className="mt-2 text-2xl font-bold text-amber-700">
                {initialData.summary.totalRemainQty.toLocaleString()}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">작업일자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">창고</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">총근무인원</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">총작업건수</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">총금일작업</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">작성자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">담당자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">수정일시</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {initialData.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 text-sm text-gray-900">{item.workDate}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">{item.warehouseName}</td>
                      <td className="px-4 py-4 text-right text-sm text-gray-900">{item.totalWorkerCount}</td>
                      <td className="px-4 py-4 text-right text-sm text-gray-900">{item.totalLineCount}</td>
                      <td className="px-4 py-4 text-right text-sm font-semibold text-blue-700">
                        {item.totalProcessedQty.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">{item.createdByName}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {item.operatorNames.length > 0 ? item.operatorNames.join(', ') : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {new Date(item.updatedAt).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-4 text-right text-sm">
                        <Link href={`${entryBasePath}/${item.id}/edit`} className="font-medium text-blue-600 hover:text-blue-800">
                          상세/수정
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {initialData.items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                        조건에 맞는 작업일지가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
