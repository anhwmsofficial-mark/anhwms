"use client";

import { useCallback, useState } from "react";

export type ExcelParseMode = "inbound" | "product" | "volumePreview";

type WorkerSuccess<T> = { ok: true; data: T };
type WorkerFailure = { ok: false; error: string };
type WorkerResponse<T> = WorkerSuccess<T> | WorkerFailure;

export async function parseExcelInWorker<T>(file: File, mode: ExcelParseMode): Promise<T> {
  const worker = new Worker(new URL("../../workers/excelParser.worker.ts", import.meta.url));
  try {
    const buffer = await file.arrayBuffer();
    const data = await new Promise<T>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerResponse<T>>) => {
        const payload = event.data;
        if (payload.ok) resolve(payload.data);
        else reject(new Error(payload.error));
      };
      worker.onerror = () => reject(new Error("Worker 처리 중 오류가 발생했습니다."));
      worker.postMessage({ mode, buffer }, [buffer]);
    });
    return data;
  } finally {
    worker.terminate();
  }
}

export function useExcelParser() {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string>("");

  const parseFile = useCallback(async <T>(file: File, mode: ExcelParseMode): Promise<T | null> => {
    setIsParsing(true);
    setParseError("");
    try {
      return await parseExcelInWorker<T>(file, mode);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "엑셀 파싱에 실패했습니다.");
      return null;
    } finally {
      setIsParsing(false);
    }
  }, []);

  return { isParsing, parseError, setParseError, parseFile };
}
