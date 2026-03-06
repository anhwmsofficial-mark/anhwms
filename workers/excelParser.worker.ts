/// <reference lib="webworker" />

import * as XLSX from "xlsx";

type ParseMode = "inbound" | "product" | "volumePreview";

type ParseRequest = {
  mode: ParseMode;
  buffer: ArrayBuffer;
};

type ParseResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

const normalizeHeader = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()_\-]/g, "");

const findHeaderIndex = (headers: string[], aliases: string[]) => {
  const normalizedAliases = aliases.map((alias) => normalizeHeader(alias));
  return headers.findIndex((header) =>
    normalizedAliases.some((alias) => header.includes(alias))
  );
};

const toDateString = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    const yyyy = String(parsed.y).padStart(4, "0");
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) return raw.replace(/\//g, "-");
  return raw;
};

const parseInbound = (workbook: XLSX.WorkBook) => {
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error("데이터가 없는 엑셀 파일입니다.");
  }

  const headers = (jsonData[0] as string[]).map((h) => (h || "").toString().trim().toLowerCase());
  const findIdx = (candidates: string[]) => headers.findIndex((h) => candidates.some((c) => h.includes(c)));

  const skuIndex = findIdx(["sku", "상품코드"]);
  const qtyIndex = findIdx(["수량", "qty"]);
  const nameIndex = findIdx(["상품명", "name"]);
  const categoryIndex = findIdx(["카테고리", "category"]);
  const barcodeIndex = findIdx(["바코드", "barcode"]);
  const barcodeTypeIndex = findIdx(["바코드유형", "barcode_type", "barcode type"]);
  const boxCountIndex = findIdx(["박스", "box", "box_count"]);
  const palletIndex = findIdx(["팔렛", "pallet"]);
  const mfgIndex = findIdx(["제조일", "mfg", "manufacture"]);
  const expiryIndex = findIdx(["유통기한", "유통일", "expiry", "exp"]);
  const noteIndex = findIdx(["비고", "note", "notes"]);

  if (skuIndex === -1 || qtyIndex === -1) {
    throw new Error("필수 컬럼(SKU, 수량)을 찾을 수 없습니다.");
  }

  return jsonData
    .slice(1)
    .map((row) => {
      const rowData = row as (string | number)[];
      return {
        product_sku: String(rowData[skuIndex] || ""),
        product_name: nameIndex !== -1 ? String(rowData[nameIndex] || "") : "",
        product_category: categoryIndex !== -1 ? String(rowData[categoryIndex] || "") : "",
        product_barcode: barcodeIndex !== -1 ? String(rowData[barcodeIndex] || "") : "",
        product_barcode_type: barcodeTypeIndex !== -1 ? String(rowData[barcodeTypeIndex] || "") : "",
        expected_qty: parseInt(String(rowData[qtyIndex] || "0"), 10) || 0,
        box_count: boxCountIndex !== -1 ? parseInt(String(rowData[boxCountIndex] || "0"), 10) || "" : "",
        pallet_text: palletIndex !== -1 ? String(rowData[palletIndex] || "") : "",
        mfg_date: mfgIndex !== -1 ? String(rowData[mfgIndex] || "") : "",
        expiry_date: expiryIndex !== -1 ? String(rowData[expiryIndex] || "") : "",
        line_notes: noteIndex !== -1 ? String(rowData[noteIndex] || "") : "",
      };
    })
    .filter((item) => !!item.product_sku && item.expected_qty > 0);
};

const parseProduct = (workbook: XLSX.WorkBook) => {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(sheet, { header: 1, defval: "" });

  if (!raw || raw.length < 2) {
    throw new Error("엑셀에 데이터가 없습니다. (헤더 + 1행 이상 필요)");
  }

  const headerRow = (raw[0] || []).map((value) => normalizeHeader(value));
  const nameIndex = findHeaderIndex(headerRow, ["제품명", "name", "productname"]);
  const categoryIndex = findHeaderIndex(headerRow, ["카테고리", "category"]);
  const barcodeIndex = findHeaderIndex(headerRow, ["바코드", "barcode"]);
  const skuIndex = findHeaderIndex(headerRow, ["sku", "식별코드"]);
  const manageNameIndex = findHeaderIndex(headerRow, ["관리명", "managename"]);
  const userCodeIndex = findHeaderIndex(headerRow, ["사용자코드", "usercode"]);
  const unitIndex = findHeaderIndex(headerRow, ["단위", "unit"]);
  const minStockIndex = findHeaderIndex(headerRow, ["최소재고", "minstock"]);
  const priceIndex = findHeaderIndex(headerRow, ["판매가", "price"]);
  const costPriceIndex = findHeaderIndex(headerRow, ["원가", "costprice"]);
  const locationIndex = findHeaderIndex(headerRow, ["보관위치", "location"]);
  const descriptionIndex = findHeaderIndex(headerRow, ["설명", "description"]);
  const manufactureDateIndex = findHeaderIndex(headerRow, ["제조일", "manufacturedate"]);
  const expiryDateIndex = findHeaderIndex(headerRow, ["유통기한", "expirydate"]);
  const optionSizeIndex = findHeaderIndex(headerRow, ["옵션사이즈", "optionsize"]);
  const optionColorIndex = findHeaderIndex(headerRow, ["옵션색상", "optioncolor"]);
  const optionLotIndex = findHeaderIndex(headerRow, ["옵션롯트번호", "optionlot"]);
  const optionEtcIndex = findHeaderIndex(headerRow, ["옵션기타", "optionetc"]);

  if (nameIndex === -1 || categoryIndex === -1) {
    throw new Error("필수 컬럼(제품명, 카테고리)을 찾을 수 없습니다.");
  }

  return raw
    .slice(1)
    .map((row, idx) => ({
      rowNo: idx + 2,
      name: String(row[nameIndex] || "").trim(),
      category: String(row[categoryIndex] || "").trim(),
      barcode: barcodeIndex !== -1 ? String(row[barcodeIndex] || "").trim() : "",
      sku: skuIndex !== -1 ? String(row[skuIndex] || "").trim() : "",
      manageName: manageNameIndex !== -1 ? String(row[manageNameIndex] || "").trim() : "",
      userCode: userCodeIndex !== -1 ? String(row[userCodeIndex] || "").trim() : "",
      unit: unitIndex !== -1 ? String(row[unitIndex] || "").trim() : "",
      minStock: minStockIndex !== -1 ? Number(row[minStockIndex] || 0) : 0,
      price: priceIndex !== -1 ? Number(row[priceIndex] || 0) : 0,
      costPrice: costPriceIndex !== -1 ? Number(row[costPriceIndex] || 0) : 0,
      location: locationIndex !== -1 ? String(row[locationIndex] || "").trim() : "",
      description: descriptionIndex !== -1 ? String(row[descriptionIndex] || "").trim() : "",
      manufactureDate: manufactureDateIndex !== -1 ? toDateString(row[manufactureDateIndex]) : "",
      expiryDate: expiryDateIndex !== -1 ? toDateString(row[expiryDateIndex]) : "",
      optionSize: optionSizeIndex !== -1 ? String(row[optionSizeIndex] || "").trim() : "",
      optionColor: optionColorIndex !== -1 ? String(row[optionColorIndex] || "").trim() : "",
      optionLot: optionLotIndex !== -1 ? String(row[optionLotIndex] || "").trim() : "",
      optionEtc: optionEtcIndex !== -1 ? String(row[optionEtcIndex] || "").trim() : "",
    }))
    .filter((item) => item.name || item.category || item.barcode || item.sku);
};

const parseVolumePreview = (workbook: XLSX.WorkBook) => {
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(firstSheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  const headers = ((raw[0] || []) as unknown[]).map((value) => String(value || "").trim());
  return {
    sheetNames: workbook.SheetNames,
    headers,
    rowCount: Math.max(raw.length - 1, 0),
  };
};

self.onmessage = (event: MessageEvent<ParseRequest>) => {
  const { mode, buffer } = event.data;

  try {
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    let data: unknown;

    if (mode === "inbound") data = parseInbound(workbook);
    else if (mode === "product") data = parseProduct(workbook);
    else data = parseVolumePreview(workbook);

    const response: ParseResponse = { ok: true, data };
    self.postMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "엑셀 파싱 중 오류가 발생했습니다.";
    const response: ParseResponse = { ok: false, error: message };
    self.postMessage(response);
  }
};
