'use client';

import type { ProductSearchItem } from '@/app/actions/product';
import BarcodeScanner from '@/components/BarcodeScanner';
import ExcelUpload from '@/components/ExcelUpload';
import NumberInput from '@/components/inputs/NumberInput';
import type {
  ClientOption,
  ExcelInboundRow,
  InboundLine,
  ManagerOption,
  WarehouseOption,
} from '@/src/features/inbound/new/form/schema';
import ProductAutocomplete from '@/src/features/inbound/new/ui/components/ProductAutocomplete';

interface InboundNewPageViewProps {
  loading: boolean;
  clients: ClientOption[];
  warehouses: WarehouseOption[];
  managers: ManagerOption[];
  selectedClientId: string;
  plannedDate: string;
  selectedWarehouseId: string;
  inboundManager: string;
  planNotes: string;
  submitted: boolean;
  lines: InboundLine[];
  scannerOpen: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  setSelectedClientId: (v: string) => void;
  setPlannedDate: (v: string) => void;
  setSelectedWarehouseId: (v: string) => void;
  setInboundManager: (v: string) => void;
  setPlanNotes: (v: string) => void;
  setScannerOpen: (v: boolean) => void;
  addLine: () => void;
  removeLine: (index: number) => void;
  handleLineChange: <K extends keyof InboundLine>(index: number, field: K, value: InboundLine[K]) => void;
  handleProductSelect: (index: number, product: ProductSearchItem) => void;
  handleExcelData: (data: ExcelInboundRow[]) => void;
  handleScan: (barcode: string | null) => void;
}

export default function InboundNewPageView({
  loading,
  clients,
  warehouses,
  managers,
  selectedClientId,
  plannedDate,
  selectedWarehouseId,
  inboundManager,
  planNotes,
  submitted,
  lines,
  scannerOpen,
  onSubmit,
  onBack,
  setSelectedClientId,
  setPlannedDate,
  setSelectedWarehouseId,
  setInboundManager,
  setPlanNotes,
  setScannerOpen,
  addLine,
  removeLine,
  handleLineChange,
  handleProductSelect,
  handleExcelData,
  handleScan,
}: InboundNewPageViewProps) {
  return (
    <div className="max-w-[1400px] mx-auto py-4 px-4 sm:px-6 lg:px-8 lg:py-8">
      <div className="lg:hidden flex items-center mb-4">
        <button onClick={onBack} className="mr-3 p-2 -ml-2 rounded-full hover:bg-gray-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6 text-gray-600"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">신규 입고 예정 등록</h1>
      </div>

      <div className="hidden lg:flex mb-6 justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">신규 입고 예정 등록</h1>
          <p className="text-sm text-gray-500 mt-1">현장 입고 정보를 등록합니다.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 lg:p-6 grid grid-cols-1 md:grid-cols-4 gap-4 lg:gap-6 bg-blue-50/50 border-b border-gray-200">
          <div className="md:col-span-4 mb-2 lg:mb-0">
            <h3 className="font-bold text-lg text-blue-900 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              기본 정보
            </h3>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              업체명 (Client) <span className="text-red-500">*</span>
            </label>
            <select
              required
              className={`w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 py-2.5 ${submitted && !selectedClientId ? 'border-red-500' : ''}`}
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">선택하세요</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              입고 예정일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className={`w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 py-2.5 ${submitted && !plannedDate ? 'border-red-500' : ''}`}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              입고지 주소 <span className="text-red-500">*</span>
            </label>
            <select
              required
              className={`w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 py-2.5 ${submitted && !selectedWarehouseId ? 'border-red-500' : ''}`}
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
            >
              <option value="">선택하세요</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              입고담당 <span className="text-red-500">*</span>
            </label>
            <select
              required
              className={`w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 py-2.5 ${submitted && !inboundManager ? 'border-red-500' : ''}`}
              value={inboundManager}
              onChange={(e) => setInboundManager(e.target.value)}
            >
              <option value="">담당자 선택</option>
              {managers.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <input
              type="text"
              placeholder="비고 (전체 메모)"
              value={planNotes}
              onChange={(e) => setPlanNotes(e.target.value)}
              className="w-full rounded-lg border-gray-300 shadow-sm py-2.5"
            />
          </div>
        </div>

        <div className="px-4 lg:px-6 py-4 flex flex-wrap justify-between items-center border-b border-gray-200 bg-white">
          <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
            입고 품목 (SKU)
          </h3>
          <div className="flex gap-2 mt-2 lg:mt-0 w-full lg:w-auto">
            <ExcelUpload onDataLoaded={handleExcelData} />
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm border border-gray-300"
            >
              📷 바코드 스캔
            </button>
          </div>
        </div>

        <div className="hidden lg:grid grid-cols-12 gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
          <div className="col-span-3 text-left pl-2">상품명 / SKU (검색)</div>
          <div className="col-span-1">박스</div>
          <div className="col-span-1 text-blue-700">수량 (Qty)</div>
          <div className="col-span-2 text-yellow-700">비고 (PLT)</div>
          <div className="col-span-2">제조일</div>
          <div className="col-span-2">유통기한</div>
          <div className="col-span-1">삭제</div>
        </div>

        <div className="divide-y divide-gray-100">
          {lines.map((line, index) => (
            <div
              key={line.id}
              className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-2 p-4 lg:px-6 lg:py-3 items-start hover:bg-gray-50 transition-colors border-b lg:border-none last:border-b-0"
            >
              <div className="lg:hidden text-sm font-bold text-gray-900 mb-1 flex justify-between items-center">
                <span>#{index + 1} 상품 정보</span>
                <button type="button" onClick={() => removeLine(index)} className="text-red-500 text-xs font-medium">
                  삭제
                </button>
              </div>

              <div className="col-span-1 lg:col-span-3">
                <ProductAutocomplete
                  value={line.product_name}
                  clientId={selectedClientId}
                  onChange={(val) => handleLineChange(index, 'product_name', val)}
                  onSelect={(prod) => handleProductSelect(index, prod)}
                />
                {line.product_sku && (
                  <div className="text-xs text-gray-500 mt-1 px-1 truncate font-mono bg-gray-50 inline-block rounded">
                    {line.product_sku} {line.barcode_primary && `| ${line.barcode_primary}`}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 lg:contents">
                <div className="lg:col-span-1">
                  <label className="lg:hidden block text-xs font-medium text-gray-500 mb-1">박스</label>
                  <NumberInput
                    mode="integer"
                    min={0}
                    placeholder="Box"
                    className="w-full border-gray-300 rounded-md text-sm text-center px-1 py-2 focus:ring-blue-500"
                    value={Number(line.box_count) || 0}
                    onValueChange={(next) => handleLineChange(index, 'box_count', next)}
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className="lg:hidden block text-xs font-bold text-blue-700 mb-1">수량 (Qty)</label>
                  <NumberInput
                    mode="integer"
                    min={1}
                    placeholder="Qty"
                    className={`w-full rounded-md text-sm text-center font-bold px-1 py-2 border-2 focus:ring-blue-500 ${
                      submitted && (!line.expected_qty || line.expected_qty <= 0)
                        ? 'border-red-500 bg-red-50'
                        : 'border-blue-200 text-blue-700'
                    }`}
                    value={line.expected_qty}
                    onValueChange={(next) => handleLineChange(index, 'expected_qty', next)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:contents">
                <div className="lg:col-span-2">
                  <label className="lg:hidden block text-xs font-medium text-yellow-700 mb-1">비고 (PLT)</label>
                  <input
                    type="text"
                    placeholder="예: 5 PLT"
                    className="w-full border-gray-300 rounded-md text-sm px-2 py-2 bg-yellow-50 focus:bg-white focus:ring-yellow-500 border-yellow-200"
                    value={line.pallet_text}
                    onChange={(e) => handleLineChange(index, 'pallet_text', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:contents">
                <div className="lg:col-span-2">
                  <label className="lg:hidden block text-xs font-medium text-gray-500 mb-1">제조일자</label>
                  <input
                    type="date"
                    className="w-full border-gray-300 rounded-md text-sm px-1 py-2"
                    value={line.mfg_date}
                    onChange={(e) => handleLineChange(index, 'mfg_date', e.target.value)}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="lg:hidden block text-xs font-medium text-gray-500 mb-1">유통기한</label>
                  <input
                    type="date"
                    className="w-full border-gray-300 rounded-md text-sm px-1 py-2"
                    value={line.expiry_date}
                    onChange={(e) => handleLineChange(index, 'expiry_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="hidden lg:block col-span-1 text-center pt-1">
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 mx-auto"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-2 px-6 py-2 border-2 border-dashed border-gray-400 rounded-xl text-gray-600 font-bold hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            품목 추가하기
          </button>
        </div>

        <div className="p-4 lg:p-6 border-t border-gray-200 flex flex-col-reverse lg:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-full lg:w-auto px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full lg:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
          >
            {loading ? '저장 중...' : '입고 예정 등록 완료'}
          </button>
        </div>
      </form>

      {scannerOpen && <BarcodeScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />}
    </div>
  );
}
