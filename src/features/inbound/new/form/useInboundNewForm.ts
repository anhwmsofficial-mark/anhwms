'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { searchProducts, type ProductSearchItem } from '@/app/actions/product';
import { createClient } from '@/utils/supabase/client';
import { showError } from '@/lib/toast';
import { createInbound } from '@/src/features/inbound/new/api/createInbound';
import { fetchInboundMeta } from '@/src/features/inbound/new/api/fetchMeta';
import { buildInboundLinesFromExcelRows } from '@/src/features/inbound/new/excel/parseInboundExcel';
import {
  createEmptyLine,
  createLineId,
  type ClientOption,
  type ExcelInboundRow,
  type InboundLine,
  type ManagerOption,
  type WarehouseOption,
} from '@/src/features/inbound/new/form/schema';

export function useInboundNewForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [plannedDate, setPlannedDate] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [inboundManager, setInboundManager] = useState('');
  const [planNotes, setPlanNotes] = useState('');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanAccumulate] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [lines, setLines] = useState<InboundLine[]>([createEmptyLine()]);
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchMeta = async () => {
      const meta = await fetchInboundMeta(supabase);
      setUserOrgId(meta.userOrgId);
      setClients(meta.clients);
      setWarehouses(meta.warehouses);
      setManagers(meta.managers);
      if (meta.defaultWarehouseId) {
        setSelectedWarehouseId(meta.defaultWarehouseId);
      }
    };

    fetchMeta();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      // Keep lines but warn? Or just clear. Clearing is safer to avoid cross-client data.
      // But user might want to keep if they selected wrong client.
      // Let's just keep them for now, the search will filter by client anyway.
    }
  }, [selectedClientId]);

  const addLine = () => {
    setLines([...lines, createEmptyLine()]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) {
      const newLines = [...lines];
      newLines[0] = createEmptyLine();
      setLines(newLines);
      return;
    }
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
  };

  const handleLineChange = <K extends keyof InboundLine>(index: number, field: K, value: InboundLine[K]) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleProductSelect = (index: number, product: ProductSearchItem) => {
    const newLines = [...lines];
    const barcodes = product.barcodes || [];
    const primary = barcodes.find((b) => b.is_primary) || barcodes.find((b) => b.barcode_type === 'RETAIL') || barcodes[0];

    newLines[index] = {
      ...newLines[index],
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      barcode_primary: primary?.barcode || '',
      barcode_type_primary: primary?.barcode_type || '',
      barcodes: barcodes,
    };
    setLines(newLines);
  };

  const handleScan = async (barcode: string | null) => {
    if (!barcode) return;
    try {
      const results = await searchProducts(barcode, selectedClientId);
      const result = (results || [])[0];

      if (!result) {
        showError(`바코드 매칭 실패: ${barcode}`);
        return;
      }

      const existingIndex = lines.findIndex((l) => l.product_id === result.id);
      if (existingIndex >= 0 && scanAccumulate) {
        const newLines = [...lines];
        newLines[existingIndex].expected_qty = newLines[existingIndex].expected_qty + 1;
        setLines(newLines);
      } else {
        const lastLine = lines[lines.length - 1];
        const isLastEmpty = !lastLine.product_id && !lastLine.product_name;

        const newLineData = {
          id: createLineId(),
          product_id: result.id,
          product_name: result.name,
          product_sku: result.sku,
          barcode_primary: result.barcodes?.[0]?.barcode || '',
          barcode_type_primary: result.barcodes?.[0]?.barcode_type || '',
          expected_qty: 1,
          box_count: '',
          pallet_text: '',
          barcodes: result.barcodes || [],
          mfg_date: '',
          expiry_date: '',
          line_notes: '',
          notes: '',
        };

        if (isLastEmpty) {
          const newLines = [...lines];
          newLines[lines.length - 1] = { ...lastLine, ...newLineData };
          setLines(newLines);
        } else {
          setLines([...lines, newLineData]);
        }
      }
    } finally {
      setScannerOpen(false);
    }
  };

  const handleExcelData = async (data: ExcelInboundRow[]) => {
    if (!data || data.length === 0) {
      showError('엑셀 데이터가 없습니다.');
      return;
    }

    const normalized = data
      .map((item) => ({
        product_sku: (item.product_sku || '').toString().trim(),
        product_name: (item.product_name || '').toString().trim(),
        product_category: (item.product_category || '').toString().trim(),
        product_barcode: (item.product_barcode || '').toString().trim(),
        expected_qty: Number(item.expected_qty || 0),
        box_count: item.box_count ?? '',
        pallet_text: item.pallet_text ?? '',
        mfg_date: item.mfg_date ?? '',
        expiry_date: item.expiry_date ?? '',
        line_notes: item.line_notes ?? '',
      }))
      .filter((item) => item.product_sku && item.expected_qty > 0);

    if (normalized.length === 0) {
      showError('유효한 SKU/수량 데이터가 없습니다.');
      return;
    }

    const { createdLines, failedSkus } = await buildInboundLinesFromExcelRows(data, selectedClientId);

    if (failedSkus.length > 0) {
      showError(`일부 SKU 처리 실패: ${failedSkus.join(', ')}`);
    }

    const cleanLines = lines.filter((l) => l.product_id || l.product_name);
    setLines([...cleanLines, ...createdLines]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (!userOrgId || !selectedClientId || !plannedDate || !selectedWarehouseId || !inboundManager) {
      if (!inboundManager) showError('입고담당자를 입력해주세요.');
      return;
    }

    const effectiveLines = lines.filter((l) => l.product_id);
    if (effectiveLines.length === 0) {
      showError('입고 품목(SKU)이 유효하지 않습니다. 상품을 검색하여 선택해주세요.');
      return;
    }

    const invalidQty = effectiveLines.filter((l) => !l.expected_qty || l.expected_qty <= 0);
    if (invalidQty.length > 0) {
      showError('모든 품목의 수량을 입력해주세요.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('org_id', userOrgId);
    formData.append('client_id', selectedClientId);
    formData.append('planned_date', plannedDate);
    formData.append('warehouse_id', selectedWarehouseId);
    formData.append('inbound_manager', inboundManager);
    formData.append('notes', planNotes);

    const processedLines = effectiveLines.map((l) => ({
      ...l,
      product_id: l.product_id,
    }));
    formData.append('lines', JSON.stringify(processedLines));

    const result = await createInbound(formData);

    setLoading(false);
    if ('error' in result) {
      showError('오류 발생: ' + result.error);
    } else {
      router.push('/inbound');
    }
  };

  return {
    loading,
    clients,
    warehouses,
    managers,
    selectedClientId,
    plannedDate,
    selectedWarehouseId,
    inboundManager,
    planNotes,
    scannerOpen,
    submitted,
    lines,
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
    handleScan,
    handleExcelData,
    handleSubmit,
    onBack: () => router.back(),
  };
}
