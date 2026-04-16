export const DAILY_WORK_LOG_WORK_TYPES = [
  'MORNING_PARCEL_OUTBOUND',
  'AFTERNOON_PARCEL_OUTBOUND',
  'GENERAL_PARCEL',
  'COUPANG_PARCEL',
  'MILKRUN',
  'B2B_OUTBOUND',
  'INSPECTION',
  'RETURNS',
  'OTHER',
] as const;

export type DailyWorkLogWorkType = (typeof DAILY_WORK_LOG_WORK_TYPES)[number];

export const DAILY_WORK_LOG_WORK_TYPE_LABELS: Record<DailyWorkLogWorkType, string> = {
  MORNING_PARCEL_OUTBOUND: '오전택배출고',
  AFTERNOON_PARCEL_OUTBOUND: '오후택배출고',
  GENERAL_PARCEL: '일반택배',
  COUPANG_PARCEL: '쿠팡택배',
  MILKRUN: '밀크런',
  B2B_OUTBOUND: '기업출고',
  INSPECTION: '검수/확인',
  RETURNS: '반품/회수',
  OTHER: '기타',
};

export const DAILY_WORK_LOG_PERIOD_PRESETS = ['day', 'week', 'month', 'year', 'custom'] as const;

export type DailyWorkLogPeriodPreset = (typeof DAILY_WORK_LOG_PERIOD_PRESETS)[number];

export type DailyWorkLogLineInput = {
  id?: string;
  clientId: string;
  workType: DailyWorkLogWorkType;
  prevQty: number;
  processedQty: number;
  remainQty: number;
  operatorName: string;
  memo: string;
  sortOrder: number;
};

export type DailyWorkLogUpsertInput = {
  id?: string;
  workDate: string;
  warehouseId: string;
  fullTimeCount: number;
  longTermPartTimeCount: number;
  dailyWorkerCount: number;
  helperCount: number;
  note: string;
  lines: DailyWorkLogLineInput[];
};

export type DailyWorkLogLine = DailyWorkLogLineInput & {
  clientName: string;
  clientCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DailyWorkLog = {
  id: string;
  organizationId: string;
  tenantId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string | null;
  workDate: string;
  fullTimeCount: number;
  longTermPartTimeCount: number;
  dailyWorkerCount: number;
  helperCount: number;
  totalWorkerCount: number;
  note: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  lines: DailyWorkLogLine[];
};

export type DailyWorkLogListItem = {
  id: string;
  workDate: string;
  warehouseId: string;
  warehouseName: string;
  totalWorkerCount: number;
  totalLineCount: number;
  totalPrevQty: number;
  totalProcessedQty: number;
  totalRemainQty: number;
  createdByName: string;
  operatorNames: string[];
  updatedAt: string;
};

export type DailyWorkLogListSummary = {
  totalLogs: number;
  totalWorkers: number;
  totalLineCount: number;
  totalPrevQty: number;
  totalProcessedQty: number;
  totalRemainQty: number;
};

export type DailyWorkLogListParams = {
  period?: DailyWorkLogPeriodPreset;
  startDate?: string;
  endDate?: string;
  warehouseId?: string;
  keyword?: string;
};

export type DailyWorkLogListResult = {
  items: DailyWorkLogListItem[];
  summary: DailyWorkLogListSummary;
  filters: {
    period: DailyWorkLogPeriodPreset;
    startDate: string;
    endDate: string;
    warehouseId: string;
    keyword: string;
  };
};

export type DailyWorkLogMetaOption = {
  id: string;
  name: string;
  code?: string | null;
};

export type DailyWorkLogMeta = {
  warehouses: DailyWorkLogMetaOption[];
  clients: DailyWorkLogMetaOption[];
  workTypes: Array<{
    value: DailyWorkLogWorkType;
    label: string;
  }>;
};

export type DailyWorkLogServiceContext = {
  userId: string;
  orgId: string;
};
