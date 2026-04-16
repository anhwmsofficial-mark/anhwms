import { z } from 'zod';
import {
  DAILY_WORK_LOG_PERIOD_PRESETS,
  DAILY_WORK_LOG_WORK_TYPES,
  type DailyWorkLogListParams,
  type DailyWorkLogUpsertInput,
} from '@/src/features/daily-work-log/dto';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 이어야 합니다.');
const nonNegativeIntSchema = z.coerce.number().int('정수를 입력해주세요.').min(0, '0 이상이어야 합니다.');

export const DailyWorkLogLineInputSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid('고객사를 선택해주세요.'),
  workType: z.enum(DAILY_WORK_LOG_WORK_TYPES, {
    message: '작업유형을 선택해주세요.',
  }),
  prevQty: nonNegativeIntSchema,
  processedQty: nonNegativeIntSchema,
  remainQty: nonNegativeIntSchema,
  operatorName: z.string().trim().max(100, '담당자는 100자 이하로 입력해주세요.').default(''),
  memo: z.string().trim().max(1000, '비고는 1000자 이하로 입력해주세요.').default(''),
  sortOrder: nonNegativeIntSchema,
});

export const DailyWorkLogUpsertInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    workDate: isoDateSchema,
    warehouseId: z.string().uuid('창고를 선택해주세요.'),
    fullTimeCount: nonNegativeIntSchema,
    longTermPartTimeCount: nonNegativeIntSchema,
    dailyWorkerCount: nonNegativeIntSchema,
    helperCount: nonNegativeIntSchema,
    note: z.string().trim().max(2000, '특이사항은 2000자 이하로 입력해주세요.').default(''),
    lines: z.array(DailyWorkLogLineInputSchema).min(1, '작업 상세는 최소 1행 이상 필요합니다.'),
  })
  .transform((value) => ({
    ...value,
    note: value.note ?? '',
    lines: value.lines
      .map((line, index) => ({
        ...line,
        operatorName: line.operatorName ?? '',
        memo: line.memo ?? '',
        sortOrder: index,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }))
  .superRefine((value, ctx) => {
    value.lines.forEach((line, index) => {
      if (line.processedQty === 0 && line.prevQty === 0 && line.remainQty === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '수량 항목 중 하나 이상 입력해주세요.',
          path: ['lines', index, 'processedQty'],
        });
      }
    });
  });

export const DailyWorkLogLookupSchema = z.object({
  workDate: isoDateSchema,
  warehouseId: z.string().uuid(),
});

export const DailyWorkLogListParamsSchema = z
  .object({
    period: z.enum(DAILY_WORK_LOG_PERIOD_PRESETS).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    warehouseId: z.string().uuid().optional(),
    keyword: z.string().trim().max(100).optional(),
  })
  .transform((value) => ({
    period: value.period ?? 'month',
    startDate: value.startDate,
    endDate: value.endDate,
    warehouseId: value.warehouseId ?? '',
    keyword: value.keyword ?? '',
  }))
  .superRefine((value, ctx) => {
    if (value.period === 'custom') {
      if (!value.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '시작일을 입력해주세요.',
          path: ['startDate'],
        });
      }
      if (!value.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '종료일을 입력해주세요.',
          path: ['endDate'],
        });
      }
    }

    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '시작일은 종료일보다 같거나 빨라야 합니다.',
        path: ['startDate'],
      });
    }
  });

export type DailyWorkLogUpsertInputParsed = z.infer<typeof DailyWorkLogUpsertInputSchema>;
export type DailyWorkLogListParamsParsed = z.infer<typeof DailyWorkLogListParamsSchema>;

export function parseDailyWorkLogInput(input: DailyWorkLogUpsertInput): DailyWorkLogUpsertInputParsed {
  return DailyWorkLogUpsertInputSchema.parse(input);
}

export function parseDailyWorkLogListParams(input: DailyWorkLogListParams): DailyWorkLogListParamsParsed {
  return DailyWorkLogListParamsSchema.parse(input);
}
