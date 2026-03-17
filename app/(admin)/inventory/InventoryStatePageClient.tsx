'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import Header from '@/components/Header';
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { showError, showSuccess } from '@/lib/toast';
import {
  INVENTORY_MOVEMENT_DEFINITIONS,
  getInventoryMovementLabel,
  type InventoryMovementType,
} from '@/lib/inventory-definitions';

type InventoryRow = {
  productId: string;
  manageName: string;
  sku: string | null;
  openingStock: number;
  currentStock: number;
  note: string;
  movements: Record<string, number>;
};

type SelectOption = {
  id: string;
  name: string;
  code?: string | null;
  vendor_id?: string | null;
};

type DailyResponse = {
  date: string;
  rows: InventoryRow[];
  customers: SelectOption[];
  templates: SelectOption[];
  warehouses: SelectOption[];
};

type MovementFormState = {
  productId: string;
  manageName: string;
  movementType: InventoryMovementType;
  warehouseId: string;
  quantity: string;
  memo: string;
  currentStock: number;
};

const columnHelper = createColumnHelper<InventoryRow>();

function getKstTodayString() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function buildMovementColumns(
  visibleMovementTypes: string[],
  openMovementModal: (row: InventoryRow, movementType: InventoryMovementType) => void
): ColumnDef<InventoryRow>[] {
  return visibleMovementTypes.map((movementType) =>
    columnHelper.display({
      id: movementType,
      header: () => (
        <div className="min-w-[110px] whitespace-nowrap text-center text-[11px] font-semibold text-gray-700">
          {getInventoryMovementLabel(movementType)}
        </div>
      ),
      cell: ({ row }) => {
        const value = Number(row.original.movements[movementType] || 0);
        return (
          <button
            type="button"
            onClick={() => openMovementModal(row.original, movementType as InventoryMovementType)}
            className="flex h-10 min-w-[110px] items-center justify-end rounded-md px-3 text-sm transition hover:bg-blue-50 hover:text-blue-700"
            title={`${getInventoryMovementLabel(movementType)} 입력`}
          >
            {value === 0 ? (
              <span className="text-gray-300">0</span>
            ) : (
              <span className="font-medium">{formatNumber(value)}</span>
            )}
          </button>
        );
      },
    })
  );
}

function getFriendlyInventoryError(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof (payload as { message?: unknown }).message === 'string'
  ) {
    return (payload as { message: string }).message;
  }
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as { error?: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error;
  }
  return fallback;
}

export default function InventoryStatePageClient() {
  const [date, setDate] = useState(getKstTodayString());
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [hiddenMovementTypes, setHiddenMovementTypes] = useState<string[]>([]);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [customers, setCustomers] = useState<SelectOption[]>([]);
  const [templates, setTemplates] = useState<SelectOption[]>([]);
  const [warehouses, setWarehouses] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementForm, setMovementForm] = useState<MovementFormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [setupNotice, setSetupNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchDailyInventory = useCallback(
    async (showSpinner = true) => {
      try {
        setLoadError(null);
        if (showSpinner) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const params = new URLSearchParams({ date });
        if (search) params.set('search', search);
        if (customerId) params.set('customer_id', customerId);

        const response = await fetch(`/api/inventory/daily?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          if (response.status === 404) {
            setSetupNotice('일별 재고 집계 API가 아직 연결되지 않았습니다. 이번 단계에서는 화면 구조만 먼저 검증합니다.');
          }
          const fallback =
            response.status === 404
              ? '일별 재고 집계 API가 아직 준비되지 않았습니다.'
              : '재고 현황을 불러오지 못했습니다.';
          throw new Error(getFriendlyInventoryError(payload, fallback));
        }

        const data = payload as DailyResponse;
        setRows(data.rows || []);
        setCustomers(data.customers || []);
        setTemplates(data.templates || []);
        setWarehouses(data.warehouses || []);
        setSetupNotice(null);

        if (!templateId && data.templates?.length) {
          setTemplateId(data.templates[0].id);
        }
      } catch (error) {
        setRows([]);
        setCustomers([]);
        setTemplates([]);
        setWarehouses([]);
        setLoadError(error instanceof Error ? error.message : '재고 현황 조회에 실패했습니다.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [customerId, date, search, templateId]
  );

  useEffect(() => {
    void fetchDailyInventory(true);
  }, [fetchDailyInventory]);

  const visibleMovementDefinitions = useMemo(
    () => INVENTORY_MOVEMENT_DEFINITIONS.filter((item) => !hiddenMovementTypes.includes(item.type)),
    [hiddenMovementTypes]
  );

  const openMovementModal = useCallback(
    (row: InventoryRow, movementType?: InventoryMovementType) => {
      const defaultWarehouseId = warehouses[0]?.id || '';
      setMovementForm({
        productId: row.productId,
        manageName: row.manageName,
        movementType: movementType || 'DAMAGE',
        warehouseId: defaultWarehouseId,
        quantity: '',
        memo: '',
        currentStock: row.currentStock,
      });
      setMovementModalOpen(true);
    },
    [warehouses]
  );

  const columns = useMemo<ColumnDef<InventoryRow>[]>(() => {
    const baseColumns = [
      columnHelper.accessor('manageName', {
        header: () => <div className="min-w-[220px]">관리명</div>,
        cell: ({ row, getValue }) => (
          <button
            type="button"
            onClick={() => openMovementModal(row.original)}
            className="flex min-w-[220px] flex-col items-start rounded-md px-2 py-2 text-left transition hover:bg-blue-50"
          >
            <span className="font-medium text-gray-900">{getValue()}</span>
            <span className="text-xs text-gray-500">{row.original.sku || row.original.productId}</span>
          </button>
        ),
      }) as unknown as ColumnDef<InventoryRow>,
      columnHelper.accessor('openingStock', {
        header: () => <div className="min-w-[120px] text-right">전일재고</div>,
        cell: ({ getValue }) => <div className="min-w-[120px] px-2 text-right">{formatNumber(getValue())}</div>,
      }) as unknown as ColumnDef<InventoryRow>,
      ...buildMovementColumns(
        visibleMovementDefinitions.map((item) => item.type),
        openMovementModal
      ),
      columnHelper.accessor('currentStock', {
        header: () => <div className="min-w-[120px] text-right">현재고</div>,
        cell: ({ getValue }) => (
          <div className="min-w-[120px] px-2 text-right font-semibold text-gray-900">{formatNumber(getValue())}</div>
        ),
      }) as unknown as ColumnDef<InventoryRow>,
      columnHelper.display({
        id: 'action',
        header: () => <div className="min-w-[110px] text-center">작업</div>,
        cell: ({ row }) => (
          <div className="flex min-w-[110px] justify-center px-2">
            <Button size="sm" variant="outline" onClick={() => openMovementModal(row.original)}>
              <PencilSquareIcon className="h-4 w-4" />
              변동 입력
            </Button>
          </div>
        ),
      }) as ColumnDef<InventoryRow>,
    ];

    return baseColumns as ColumnDef<InventoryRow>[];
  }, [openMovementModal, visibleMovementDefinitions]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleToggleMovementColumn = (movementType: string) => {
    setHiddenMovementTypes((current) =>
      current.includes(movementType)
        ? current.filter((item) => item !== movementType)
        : [...current, movementType]
    );
  };

  const handleSubmitMovement = async () => {
    if (!movementForm) return;
    if (!movementForm.warehouseId) {
      showError('창고를 선택해주세요.');
      return;
    }

    const quantity = Number(movementForm.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      showError('수량은 0보다 큰 정수여야 합니다.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/admin/inventory/movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          warehouseId: movementForm.warehouseId,
          productId: movementForm.productId,
          movementType: movementForm.movementType,
          quantity,
          memo: movementForm.memo.trim() || null,
          referenceType: 'MANUAL',
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getFriendlyInventoryError(payload, '재고 변동 저장에 실패했습니다.'));
      }

      showSuccess('재고 변동이 반영되었습니다.');
      setMovementModalOpen(false);
      setMovementForm(null);
      await fetchDailyInventory(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : '재고 변동 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    if (!templateId) {
      showError('엑셀 템플릿을 선택해주세요.');
      return;
    }

    try {
      setExporting(true);
      const params = new URLSearchParams({
        template_id: templateId,
        date_from: date,
        date_to: date,
      });
      if (customerId) params.set('customer_id', customerId);
      if (hiddenMovementTypes.length > 0) {
        params.set('exclude_types', hiddenMovementTypes.join(','));
      }

      const response = await fetch(`/api/inventory/export?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const fallback =
          response.status === 404 ? '엑셀 Export API가 아직 준비되지 않았습니다.' : '엑셀 다운로드에 실패했습니다.';
        throw new Error(getFriendlyInventoryError(payload, fallback));
      }

      const blob = await response.blob();
      const fileNameHeader = response.headers.get('Content-Disposition');
      const fileNameMatch = fileNameHeader?.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || `inventory_export_${date}.xlsx`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      showSuccess('업체용 엑셀을 다운로드했습니다.');
    } catch (error) {
      showError(error instanceof Error ? error.message : '엑셀 다운로드에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <Header title="재고 관리" />

      <main className="flex-1 overflow-hidden p-6 lg:p-8">
        <div className="flex h-full flex-col gap-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">기준일</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">업체</span>
                  <select
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                    className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">전체 업체</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">엑셀 템플릿</span>
                  <select
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                    className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">템플릿 선택</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">품목 검색</span>
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="관리명 / SKU"
                      className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" asChild>
                  <Link href="/inventory/management/templates">템플릿 UI</Link>
                </Button>
                <Button variant="outline" onClick={() => setColumnDialogOpen(true)}>
                  <Cog6ToothIcon className="h-4 w-4" />
                  열 설정
                </Button>
                <Button variant="outline" onClick={() => void fetchDailyInventory(false)} disabled={refreshing}>
                  <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  새로고침
                </Button>
                <Button onClick={handleExport} disabled={exporting || !templateId}>
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  업체용 엑셀 다운로드
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <InlineErrorAlert
                error={loadError}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              />
              {setupNotice ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {setupNotice}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500">숨김 컬럼</span>
              {hiddenMovementTypes.length === 0 ? (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">없음</span>
              ) : (
                hiddenMovementTypes.map((movementType) => (
                  <button
                    key={movementType}
                    type="button"
                    onClick={() => handleToggleMovementColumn(movementType)}
                    className="rounded-full bg-gray-900 px-2.5 py-1 text-xs text-white transition hover:bg-gray-700"
                  >
                    {getInventoryMovementLabel(movementType)} x
                  </button>
                ))
              )}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <div className="text-sm font-semibold text-blue-900">빠른 사용법 1</div>
                <p className="mt-1 text-xs leading-5 text-blue-800">
                  기준일과 업체를 선택하면 해당 일자의 전일재고, 트랜잭션 합계, 현재고를 한 화면에서 확인할 수 있습니다.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="text-sm font-semibold text-emerald-900">빠른 사용법 2</div>
                <p className="mt-1 text-xs leading-5 text-emerald-800">
                  파손, 반품 같은 셀을 직접 클릭하거나 `변동 입력` 버튼을 눌러 즉시 재고 이벤트를 기록하세요.
                </p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <div className="text-sm font-semibold text-amber-900">빠른 사용법 3</div>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  `열 설정`에서 제외한 컬럼은 화면과 업체용 엑셀 다운로드에서 함께 빠집니다.
                </p>
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">실시간 재고 그리드</h3>
                <p className="text-xs text-gray-500">전일재고 + 당일 트랜잭션 합산 기준 현재고를 표시합니다.</p>
              </div>
              <div className="text-xs text-gray-500">조회 {rows.length.toLocaleString('ko-KR')}건</div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-white">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header, index) => (
                        <th
                          key={header.id}
                          className={`border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-semibold text-gray-600 ${
                            index === 0 ? 'sticky left-0 z-30 bg-gray-50' : ''
                          }`}
                        >
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={columns.length} className="px-6 py-16 text-center text-sm text-gray-500">
                        데이터를 불러오는 중입니다...
                      </td>
                    </tr>
                  ) : table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-6 py-16 text-center text-sm text-gray-500">
                        조회된 재고 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="hover:bg-blue-50/40">
                        {row.getVisibleCells().map((cell, index) => (
                          <td
                            key={cell.id}
                            className={`border-b border-r border-gray-100 bg-white px-1 py-1 align-middle ${
                              index === 0 ? 'sticky left-0 z-10 bg-white' : ''
                            }`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>열 표시 설정</DialogTitle>
            <DialogDescription>체크를 해제한 트랜잭션 컬럼은 그리드와 엑셀 다운로드에서 함께 제외됩니다.</DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3">
            {INVENTORY_MOVEMENT_DEFINITIONS.map((item) => {
              const checked = !hiddenMovementTypes.includes(item.type);
              return (
                <label
                  key={item.type}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleMovementColumn(item.type)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setHiddenMovementTypes([])}>
              전체 표시
            </Button>
            <Button onClick={() => setColumnDialogOpen(false)}>적용</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={movementModalOpen}
        onOpenChange={(open) => {
          setMovementModalOpen(open);
          if (!open) setMovementForm(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>재고 변동 입력</DialogTitle>
            <DialogDescription>파손, 반품, 폐기 등 재고 이벤트를 즉시 기록합니다.</DialogDescription>
          </DialogHeader>

          {movementForm ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-xs text-gray-500">품목</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{movementForm.manageName}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-xs text-gray-500">현재고</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{formatNumber(movementForm.currentStock)}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">변동 유형</span>
                  <select
                    value={movementForm.movementType}
                    onChange={(event) =>
                      setMovementForm((current) =>
                        current ? { ...current, movementType: event.target.value as InventoryMovementType } : current
                      )
                    }
                    className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {INVENTORY_MOVEMENT_DEFINITIONS.filter((item) => item.direction !== null).map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">창고</span>
                  <select
                    value={movementForm.warehouseId}
                    onChange={(event) =>
                      setMovementForm((current) => (current ? { ...current, warehouseId: event.target.value } : current))
                    }
                    className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">창고 선택</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500">수량</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={movementForm.quantity}
                  onChange={(event) =>
                    setMovementForm((current) => (current ? { ...current, quantity: event.target.value } : current))
                  }
                  className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500">사유 / 메모</span>
                <textarea
                  value={movementForm.memo}
                  onChange={(event) =>
                    setMovementForm((current) => (current ? { ...current, memo: event.target.value } : current))
                  }
                  placeholder="예: 박스 파손 2개, CS 반품 입고"
                  className="min-h-[96px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          ) : null}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setMovementModalOpen(false)}>
              취소
            </Button>
            <Button onClick={() => void handleSubmitMovement()} disabled={submitting}>
              {submitting ? '저장 중...' : '재고 변동 저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
