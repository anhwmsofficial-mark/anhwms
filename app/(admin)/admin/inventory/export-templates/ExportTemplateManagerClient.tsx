'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  DocumentArrowDownIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  saveExportTemplateAction,
  type ExportTemplateBootstrapData,
  type ExportTemplateEditor,
  type ExportTemplateEditorColumn,
} from '@/app/actions/admin/export-templates';
import Header from '@/components/Header';
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import { Button } from '@/components/ui/button';
import { showError, showSuccess } from '@/lib/toast';
import {
  INVENTORY_MOVEMENT_DEFINITIONS,
  getInventoryMovementLabel,
  type InventoryMovementType,
} from '@/lib/inventory-definitions';

type Props = {
  initialData: ExportTemplateBootstrapData;
  initialError: string | null;
};

const FIXED_COLUMNS: Array<{
  key: string;
  source: ExportTemplateEditorColumn['source'];
  label: string;
  sortOrder: number;
}> = [
  { key: 'MANAGE_NAME', source: 'MANAGE_NAME', label: '관리명', sortOrder: 10 },
  { key: 'OPENING_STOCK', source: 'OPENING_STOCK', label: '전일재고', sortOrder: 20 },
  { key: 'TOTAL_SUM', source: 'TOTAL_SUM', label: '총합계', sortOrder: 970 },
  { key: 'CLOSING_STOCK', source: 'CLOSING_STOCK', label: '마감재고', sortOrder: 980 },
  { key: 'NOTE', source: 'NOTE', label: '비고', sortOrder: 990 },
];

function createNewTemplate(): ExportTemplateEditor {
  return {
    id: '',
    code: '',
    name: '',
    description: '',
    sheetName: '재고현황',
    vendorId: null,
    isActive: true,
    columns: [
      ...FIXED_COLUMNS.map((column) => ({
        key: column.key,
        source: column.source,
        transactionType: null,
        label: column.label,
        displayName: column.label,
        enabled: true,
        fixed: true,
        sortOrder: column.sortOrder,
        width: column.key === 'MANAGE_NAME' ? 28 : column.key === 'NOTE' ? 30 : 14,
        numberFormat: column.key === 'NOTE' || column.key === 'MANAGE_NAME' ? null : '#,##0',
      })),
      ...INVENTORY_MOVEMENT_DEFINITIONS.map((item, index) => ({
        key: `TRANSACTION_TYPE:${item.type}`,
        source: 'TRANSACTION_TYPE' as const,
        transactionType: item.type,
        label: item.label,
        displayName: item.label,
        enabled: false,
        fixed: false,
        sortOrder: 30 + index * 10,
        width: 14,
        numberFormat: '#,##0',
      })),
    ],
  };
}

function sortColumns(columns: ExportTemplateEditorColumn[]) {
  return [...columns].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label, 'ko');
  });
}

export default function ExportTemplateManagerClient({ initialData, initialError }: Props) {
  const [templates, setTemplates] = useState<ExportTemplateEditor[]>(initialData.templates);
  const [customers] = useState(initialData.customers);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialData.templates[0]?.id || 'new'
  );
  const [draft, setDraft] = useState<ExportTemplateEditor>(
    initialData.templates[0] ? structuredClone(initialData.templates[0]) : createNewTemplate()
  );
  const [error, setError] = useState<string | null>(initialError);
  const [isPending, startTransition] = useTransition();

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates]
  );

  const previewColumns = useMemo(
    () => sortColumns(draft.columns.filter((column) => column.enabled || column.fixed)),
    [draft.columns]
  );

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === 'new') {
      setDraft(createNewTemplate());
      setError(null);
      return;
    }

    const template = templates.find((item) => item.id === templateId);
    if (template) {
      setDraft(structuredClone(template));
      setError(null);
    }
  };

  const handleCreateNew = () => {
    setSelectedTemplateId('new');
    setDraft(createNewTemplate());
    setError(null);
  };

  const handleColumnChange = (key: string, patch: Partial<ExportTemplateEditorColumn>) => {
    setDraft((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.key === key
          ? {
              ...column,
              ...patch,
              enabled: column.fixed ? true : patch.enabled ?? column.enabled,
            }
          : column
      ),
    }));
  };

  const handleSave = () => {
    setError(null);

    startTransition(async () => {
      const result = await saveExportTemplateAction({
        id: draft.id || null,
        code: draft.code,
        name: draft.name,
        description: draft.description,
        sheetName: draft.sheetName,
        vendorId: draft.vendorId,
        isActive: draft.isActive,
        columns: draft.columns,
      });

      if (!result.ok) {
        setError(result.error || '템플릿 저장에 실패했습니다.');
        showError(result.error || '템플릿 저장에 실패했습니다.');
        return;
      }

      setTemplates(result.data.templates);
      setSelectedTemplateId(result.data.template.id);
      setDraft(structuredClone(result.data.template));
      showSuccess('엑셀 템플릿 설정이 저장되었습니다.');
    });
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <Header title="엑셀 템플릿 설정" />

      <main className="flex-1 overflow-hidden p-6 lg:p-8">
        <div className="grid h-full gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">템플릿 목록</h2>
                  <p className="mt-1 text-xs text-gray-500">업체별 엑셀 출력 포맷을 관리합니다.</p>
                </div>
                <Button size="sm" onClick={handleCreateNew}>
                  <PlusIcon className="h-4 w-4" />
                  새 템플릿
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <button
                type="button"
                onClick={handleCreateNew}
                className={`mb-3 w-full rounded-xl border px-4 py-3 text-left transition ${
                  selectedTemplateId === 'new'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-dashed border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
                }`}
              >
                <div className="font-medium text-gray-900">새 템플릿 만들기</div>
                <div className="mt-1 text-xs text-gray-500">새 업체 포맷을 처음부터 구성합니다.</div>
              </button>

              <div className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedTemplateId === template.id
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{template.name}</div>
                        <div className="mt-1 text-xs text-gray-500">{template.code}</div>
                      </div>
                      {selectedTemplateId === template.id ? (
                        <CheckCircleIcon className="h-5 w-5 shrink-0 text-blue-600" />
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {customers.find((customer) => customer.id === template.vendorId)?.name || '전체 업체'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedTemplate ? `${selectedTemplate.name} 편집` : '엑셀 템플릿 편집'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    포함 컬럼, 표시 헤더명, 노출 순서를 설정하고 업체별 export 포맷을 저장합니다.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => handleSelectTemplate(selectedTemplateId)}>
                    <ArrowPathIcon className="h-4 w-4" />
                    되돌리기
                  </Button>
                  <Button onClick={handleSave} disabled={isPending}>
                    <DocumentArrowDownIcon className="h-4 w-4" />
                    {isPending ? '저장 중...' : '템플릿 저장'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <InlineErrorAlert
                error={error}
                className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              />

              <div className="mb-6 grid gap-3 xl:grid-cols-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <div className="text-sm font-semibold text-blue-900">사용법 1</div>
                  <p className="mt-1 text-xs leading-5 text-blue-800">
                    템플릿명, 코드, 업체를 먼저 설정한 뒤 저장하면 `/inventory` 다운로드 버튼에서 바로 사용할 수 있습니다.
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <div className="text-sm font-semibold text-emerald-900">사용법 2</div>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    트랜잭션 컬럼 체크박스를 켜면 엑셀 포함, 끄면 제외됩니다. 표시 헤더명은 업체 요구 용어로 수정할 수 있습니다.
                  </p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <div className="text-sm font-semibold text-amber-900">사용법 3</div>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    순서 숫자가 작을수록 앞에 배치됩니다. 저장 후 우측 미리보기와 실제 다운로드 헤더 순서가 같아집니다.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">템플릿명</span>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="예: YBK 기본 제출 양식"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">템플릿 코드</span>
                  <input
                    type="text"
                    value={draft.code}
                    onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
                    className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="예: ybk-default"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">업체</span>
                  <select
                    value={draft.vendorId || ''}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        vendorId: event.target.value || null,
                      }))
                    }
                    className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">전체 업체 공용</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">시트명</span>
                  <input
                    type="text"
                    value={draft.sheetName}
                    onChange={(event) => setDraft((current) => ({ ...current, sheetName: event.target.value }))}
                    className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="예: 재고현황"
                  />
                </label>

                <label className="flex flex-col gap-1 lg:col-span-2">
                  <span className="text-xs font-medium text-gray-500">설명</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    className="min-h-[84px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="예: YBK 제출용. 샘플/파손 포함, 비고 노출"
                  />
                </label>
              </div>

              <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
                <div className="space-y-6">
                  <div>
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">고정 컬럼</h3>
                      <p className="text-xs text-gray-500">핵심 컬럼은 항상 포함되며 순서와 헤더명만 수정할 수 있습니다.</p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
                          <tr>
                            <th className="px-3 py-2 text-left">컬럼</th>
                            <th className="px-3 py-2 text-left">헤더명</th>
                            <th className="px-3 py-2 text-right">순서</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sortColumns(draft.columns.filter((column) => column.fixed)).map((column) => (
                            <tr key={column.key}>
                              <td className="px-3 py-3 text-gray-900">{column.label}</td>
                              <td className="px-3 py-3">
                                <input
                                  type="text"
                                  value={column.displayName}
                                  onChange={(event) =>
                                    handleColumnChange(column.key, { displayName: event.target.value })
                                  }
                                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <input
                                  type="number"
                                  value={column.sortOrder}
                                  onChange={(event) =>
                                    handleColumnChange(column.key, { sortOrder: Number(event.target.value) || 0 })
                                  }
                                  className="h-9 w-24 rounded-md border border-gray-300 px-3 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">트랜잭션 컬럼</h3>
                      <p className="text-xs text-gray-500">체크한 항목만 업체용 엑셀에 포함됩니다.</p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
                          <tr>
                            <th className="px-3 py-2 text-center">포함</th>
                            <th className="px-3 py-2 text-left">트랜잭션 타입</th>
                            <th className="px-3 py-2 text-left">표시 헤더명</th>
                            <th className="px-3 py-2 text-right">순서</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sortColumns(draft.columns.filter((column) => !column.fixed)).map((column) => (
                            <tr key={column.key} className={column.enabled ? 'bg-white' : 'bg-gray-50/50'}>
                              <td className="px-3 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={column.enabled}
                                  onChange={(event) =>
                                    handleColumnChange(column.key, { enabled: event.target.checked })
                                  }
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-medium text-gray-900">{column.label}</div>
                                <div className="mt-0.5 text-xs text-gray-500">
                                  {column.transactionType as InventoryMovementType}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <input
                                  type="text"
                                  value={column.displayName}
                                  onChange={(event) =>
                                    handleColumnChange(column.key, { displayName: event.target.value })
                                  }
                                  className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <input
                                  type="number"
                                  value={column.sortOrder}
                                  onChange={(event) =>
                                    handleColumnChange(column.key, { sortOrder: Number(event.target.value) || 0 })
                                  }
                                  className="h-9 w-24 rounded-md border border-gray-300 px-3 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <h3 className="text-sm font-semibold text-gray-900">선택 컬럼 미리보기</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    현재 설정 기준으로 엑셀에 노출될 컬럼 순서입니다.
                  </p>

                  <div className="mt-4 space-y-2">
                    {previewColumns.map((column) => (
                      <div
                        key={column.key}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">{column.displayName}</div>
                          <div className="text-xs text-gray-500">
                            {column.fixed ? column.label : getInventoryMovementLabel(String(column.transactionType))}
                          </div>
                        </div>
                        <div className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                          {column.sortOrder}
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
