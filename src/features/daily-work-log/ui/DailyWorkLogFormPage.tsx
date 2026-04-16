'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Header from '@/components/Header';
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { showError, showSuccess } from '@/lib/toast';
import { normalizeInlineError, type InlineErrorMeta } from '@/lib/api/client';
import type {
  DailyWorkLog,
  DailyWorkLogMeta,
  DailyWorkLogUpsertInput,
} from '@/src/features/daily-work-log/dto';
import {
  createDailyWorkLogAction,
  updateDailyWorkLogAction,
} from '@/app/actions/daily-work-log';

type DailyWorkLogFormPageProps = {
  mode: 'create' | 'edit';
  meta: DailyWorkLogMeta;
  initialValue?: DailyWorkLog | null;
};

type EditableLine = {
  id?: string;
  clientId: string;
  workType: DailyWorkLogUpsertInput['lines'][number]['workType'];
  prevQty: string;
  processedQty: string;
  remainQty: string;
  operatorName: string;
  memo: string;
};

type FormState = {
  workDate: string;
  warehouseId: string;
  fullTimeCount: string;
  longTermPartTimeCount: string;
  dailyWorkerCount: string;
  helperCount: string;
  note: string;
  lines: EditableLine[];
};

type FieldErrors = {
  header: Partial<Record<'workDate' | 'warehouseId' | 'fullTimeCount' | 'longTermPartTimeCount' | 'dailyWorkerCount' | 'helperCount', string>>;
  lines: Array<Partial<Record<'clientId' | 'workType' | 'prevQty' | 'processedQty' | 'remainQty', string>>>;
};

const DEFAULT_WORK_TYPE = 'GENERAL_PARCEL' as const;

function createEmptyLine(): EditableLine {
  return {
    clientId: '',
    workType: DEFAULT_WORK_TYPE,
    prevQty: '0',
    processedQty: '0',
    remainQty: '0',
    operatorName: '',
    memo: '',
  };
}

function createInitialState(initialValue?: DailyWorkLog | null): FormState {
  if (!initialValue) {
    return {
      workDate: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
      warehouseId: '',
      fullTimeCount: '0',
      longTermPartTimeCount: '0',
      dailyWorkerCount: '0',
      helperCount: '0',
      note: '',
      lines: [createEmptyLine()],
    };
  }

  return {
    workDate: initialValue.workDate,
    warehouseId: initialValue.warehouseId,
    fullTimeCount: String(initialValue.fullTimeCount),
    longTermPartTimeCount: String(initialValue.longTermPartTimeCount),
    dailyWorkerCount: String(initialValue.dailyWorkerCount),
    helperCount: String(initialValue.helperCount),
    note: initialValue.note,
    lines:
      initialValue.lines.length > 0
        ? initialValue.lines.map((line) => ({
            id: line.id,
            clientId: line.clientId,
            workType: line.workType,
            prevQty: String(line.prevQty),
            processedQty: String(line.processedQty),
            remainQty: String(line.remainQty),
            operatorName: line.operatorName,
            memo: line.memo,
          }))
        : [createEmptyLine()],
  };
}

function toNonNegativeInt(value: string) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

function validateForm(state: FormState): FieldErrors {
  const errors: FieldErrors = {
    header: {},
    lines: state.lines.map(() => ({})),
  };

  if (!state.workDate) {
    errors.header.workDate = '작업일자를 입력해주세요.';
  }
  if (!state.warehouseId) {
    errors.header.warehouseId = '창고를 선택해주세요.';
  }

  const headerFields: Array<keyof FieldErrors['header']> = [
    'fullTimeCount',
    'longTermPartTimeCount',
    'dailyWorkerCount',
    'helperCount',
  ];

  headerFields.forEach((field) => {
    const parsed = toNonNegativeInt(state[field] || '0');
    if (parsed === null) {
      errors.header[field] = '0 이상의 정수를 입력해주세요.';
    }
  });

  state.lines.forEach((line, index) => {
    if (!line.clientId) {
      errors.lines[index].clientId = '고객사를 선택해주세요.';
    }
    if (!line.workType) {
      errors.lines[index].workType = '작업유형을 선택해주세요.';
    }

    const prevQty = toNonNegativeInt(line.prevQty);
    const processedQty = toNonNegativeInt(line.processedQty);
    const remainQty = toNonNegativeInt(line.remainQty);

    if (prevQty === null) errors.lines[index].prevQty = '0 이상의 정수를 입력해주세요.';
    if (processedQty === null) errors.lines[index].processedQty = '0 이상의 정수를 입력해주세요.';
    if (remainQty === null) errors.lines[index].remainQty = '0 이상의 정수를 입력해주세요.';
    if (prevQty === 0 && processedQty === 0 && remainQty === 0) {
      errors.lines[index].processedQty = '수량 항목 중 하나 이상 입력해주세요.';
    }
  });

  return errors;
}

function hasErrors(errors: FieldErrors) {
  return (
    Object.values(errors.header).some(Boolean) ||
    errors.lines.some((line) => Object.values(line).some(Boolean))
  );
}

export default function DailyWorkLogFormPage({
  mode,
  meta,
  initialValue,
}: DailyWorkLogFormPageProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => createInitialState(initialValue));
  const [errors, setErrors] = useState<FieldErrors>({
    header: {},
    lines: state.lines.map(() => ({})),
  });
  const [error, setError] = useState<InlineErrorMeta | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);
  const totalWorkerCount = useMemo(() => {
    return (
      Number(state.fullTimeCount || 0) +
      Number(state.longTermPartTimeCount || 0) +
      Number(state.dailyWorkerCount || 0) +
      Number(state.helperCount || 0)
    );
  }, [
    state.dailyWorkerCount,
    state.fullTimeCount,
    state.helperCount,
    state.longTermPartTimeCount,
  ]);

  const lineSummary = useMemo(() => {
    return state.lines.reduce(
      (acc, line) => {
        acc.prevQty += Number(line.prevQty || 0);
        acc.processedQty += Number(line.processedQty || 0);
        acc.remainQty += Number(line.remainQty || 0);
        return acc;
      },
      { prevQty: 0, processedQty: 0, remainQty: 0 },
    );
  }, [state.lines]);

  const updateLine = (index: number, patch: Partial<EditableLine>) => {
    setState((prev) => ({
      ...prev,
      lines: prev.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }));
  };

  const addLine = () => {
    setState((prev) => ({
      ...prev,
      lines: [...prev.lines, createEmptyLine()],
    }));
    setErrors((prev) => ({
      ...prev,
      lines: [...prev.lines, {}],
    }));
  };

  const removeLine = (index: number) => {
    setState((prev) => ({
      ...prev,
      lines: prev.lines.length === 1 ? [createEmptyLine()] : prev.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
    setErrors((prev) => ({
      ...prev,
      lines: prev.lines.length === 1 ? [{}] : prev.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const handleCheckExisting = async () => {
    if (!state.workDate || !state.warehouseId || mode === 'edit') {
      return;
    }

    setIsCheckingExisting(true);
    try {
      const result = await fetch(
        `/api/daily-work-logs/lookup?workDate=${encodeURIComponent(state.workDate)}&warehouseId=${encodeURIComponent(state.warehouseId)}`,
      );
      const payload = await result.json().catch(() => null);
      const targetId = payload?.data?.id as string | undefined;
      if (result.ok && targetId) {
        router.push(`/operations/daily-work-logs/${targetId}/edit`);
      }
    } catch {
      // Ignore lookup failures to keep the form non-blocking.
    } finally {
      setIsCheckingExisting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const nextErrors = validateForm(state);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      setError({ message: '입력값을 확인해주세요.' });
      return;
    }

    const payload: DailyWorkLogUpsertInput = {
      id: initialValue?.id,
      workDate: state.workDate,
      warehouseId: state.warehouseId,
      fullTimeCount: toNonNegativeInt(state.fullTimeCount) || 0,
      longTermPartTimeCount: toNonNegativeInt(state.longTermPartTimeCount) || 0,
      dailyWorkerCount: toNonNegativeInt(state.dailyWorkerCount) || 0,
      helperCount: toNonNegativeInt(state.helperCount) || 0,
      note: state.note,
      lines: state.lines.map((line, index) => ({
        id: line.id,
        clientId: line.clientId,
        workType: line.workType,
        prevQty: toNonNegativeInt(line.prevQty) || 0,
        processedQty: toNonNegativeInt(line.processedQty) || 0,
        remainQty: toNonNegativeInt(line.remainQty) || 0,
        operatorName: line.operatorName,
        memo: line.memo,
        sortOrder: index,
      })),
    };

    startTransition(async () => {
      try {
        const result =
          mode === 'edit' && initialValue
            ? await updateDailyWorkLogAction(initialValue.id, payload)
            : await createDailyWorkLogAction(payload);

        if (!result.ok) {
          setError({
            message: result.error || '작업일지 저장에 실패했습니다.',
          });
          showError(result.error || '작업일지 저장에 실패했습니다.');
          return;
        }

        showSuccess(mode === 'edit' ? '작업일지가 수정되었습니다.' : '작업일지가 등록되었습니다.');
        router.push('/operations/daily-work-logs');
        router.refresh();
      } catch (submitError: unknown) {
        const normalized = normalizeInlineError(submitError, '작업일지 저장 중 오류가 발생했습니다.');
        setError(normalized);
        showError(normalized.message);
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header
        title={mode === 'edit' ? '일일 작업일지 수정' : '일일 작업일지 등록'}
        backUrl="/operations/daily-work-logs"
      />

      <main className="flex-1 p-4 lg:p-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {mode === 'edit' ? '일일 작업일지 수정' : '일일 작업일지 등록'}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                현장 작업일지를 수기로 기록하고 추후 자동 연동에 대비한 기준 데이터를 관리합니다.
              </p>
            </div>
            {mode === 'create' ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleCheckExisting}
                disabled={!state.workDate || !state.warehouseId || isCheckingExisting}
              >
                {isCheckingExisting ? '기존 데이터 확인 중...' : '같은 날짜/창고 기존 데이터 확인'}
              </Button>
            ) : null}
          </div>

          <InlineErrorAlert error={error} />

          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">상단 헤더</h2>
                <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  총 근무인원 {totalWorkerCount}명
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">작업일자</label>
                  <Input
                    type="date"
                    value={state.workDate}
                    onChange={(event) => setState((prev) => ({ ...prev, workDate: event.target.value }))}
                  />
                  {errors.header.workDate ? <p className="mt-1 text-xs text-red-600">{errors.header.workDate}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">창고</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={state.warehouseId}
                    onChange={(event) => setState((prev) => ({ ...prev, warehouseId: event.target.value }))}
                  >
                    <option value="">선택하세요</option>
                    {meta.warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                  {errors.header.warehouseId ? (
                    <p className="mt-1 text-xs text-red-600">{errors.header.warehouseId}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">정직원 수</label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={state.fullTimeCount}
                    onChange={(event) => setState((prev) => ({ ...prev, fullTimeCount: event.target.value }))}
                  />
                  {errors.header.fullTimeCount ? (
                    <p className="mt-1 text-xs text-red-600">{errors.header.fullTimeCount}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">장기알바 수</label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={state.longTermPartTimeCount}
                    onChange={(event) =>
                      setState((prev) => ({ ...prev, longTermPartTimeCount: event.target.value }))
                    }
                  />
                  {errors.header.longTermPartTimeCount ? (
                    <p className="mt-1 text-xs text-red-600">{errors.header.longTermPartTimeCount}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">일용직 수</label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={state.dailyWorkerCount}
                    onChange={(event) => setState((prev) => ({ ...prev, dailyWorkerCount: event.target.value }))}
                  />
                  {errors.header.dailyWorkerCount ? (
                    <p className="mt-1 text-xs text-red-600">{errors.header.dailyWorkerCount}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">지원자 수</label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={state.helperCount}
                    onChange={(event) => setState((prev) => ({ ...prev, helperCount: event.target.value }))}
                  />
                  {errors.header.helperCount ? (
                    <p className="mt-1 text-xs text-red-600">{errors.header.helperCount}</p>
                  ) : null}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">특이사항</label>
                  <Textarea
                    value={state.note}
                    onChange={(event) => setState((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="특이사항을 입력하세요."
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">작업 상세 입력</h2>
                  <p className="mt-1 text-sm text-gray-600">기본 1행이 제공되며, 필요 시 행을 추가해 입력하세요.</p>
                </div>
                <Button type="button" variant="outline" onClick={addLine}>
                  <PlusIcon className="h-4 w-4" />
                  행 추가
                </Button>
              </div>

              <div className="space-y-4">
                {state.lines.map((line, index) => (
                  <div key={`${line.id || 'new'}-${index}`} className="rounded-xl border border-gray-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-700">상세 {index + 1}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(index)}
                      >
                        <TrashIcon className="h-4 w-4" />
                        삭제
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-7">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">고객사</label>
                        <select
                          className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={line.clientId}
                          onChange={(event) => updateLine(index, { clientId: event.target.value })}
                        >
                          <option value="">선택하세요</option>
                          {meta.clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                        {errors.lines[index]?.clientId ? (
                          <p className="mt-1 text-xs text-red-600">{errors.lines[index]?.clientId}</p>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">작업유형</label>
                        <select
                          className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={line.workType}
                          onChange={(event) =>
                            updateLine(index, {
                              workType: event.target.value as EditableLine['workType'],
                            })
                          }
                        >
                          {meta.workTypes.map((workType) => (
                            <option key={workType.value} value={workType.value}>
                              {workType.label}
                            </option>
                          ))}
                        </select>
                        {errors.lines[index]?.workType ? (
                          <p className="mt-1 text-xs text-red-600">{errors.lines[index]?.workType}</p>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">전일잔여</label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={line.prevQty}
                          onChange={(event) => updateLine(index, { prevQty: event.target.value })}
                        />
                        {errors.lines[index]?.prevQty ? (
                          <p className="mt-1 text-xs text-red-600">{errors.lines[index]?.prevQty}</p>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">금일작업</label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={line.processedQty}
                          onChange={(event) => updateLine(index, { processedQty: event.target.value })}
                        />
                        {errors.lines[index]?.processedQty ? (
                          <p className="mt-1 text-xs text-red-600">{errors.lines[index]?.processedQty}</p>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">금일잔여</label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={line.remainQty}
                          onChange={(event) => updateLine(index, { remainQty: event.target.value })}
                        />
                        {errors.lines[index]?.remainQty ? (
                          <p className="mt-1 text-xs text-red-600">{errors.lines[index]?.remainQty}</p>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">담당자</label>
                        <Input
                          value={line.operatorName}
                          onChange={(event) => updateLine(index, { operatorName: event.target.value })}
                          placeholder="담당자"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">비고</label>
                        <Input
                          value={line.memo}
                          onChange={(event) => updateLine(index, { memo: event.target.value })}
                          placeholder="비고"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">하단 요약</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">총 전일잔여</div>
                  <div className="mt-2 text-2xl font-bold text-gray-900">{lineSummary.prevQty.toLocaleString()}</div>
                </div>
                <div className="rounded-xl bg-blue-50 p-4">
                  <div className="text-sm text-blue-600">총 금일작업</div>
                  <div className="mt-2 text-2xl font-bold text-blue-700">
                    {lineSummary.processedQty.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50 p-4">
                  <div className="text-sm text-amber-600">총 금일잔여</div>
                  <div className="mt-2 text-2xl font-bold text-amber-700">
                    {lineSummary.remainQty.toLocaleString()}
                  </div>
                </div>
              </div>
            </section>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => router.push('/operations/daily-work-logs')}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '저장 중...' : mode === 'edit' ? '수정 저장' : '등록'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
