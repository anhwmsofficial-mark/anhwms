import { NaverCommerceError } from './naver';

export type ApplyItem = {
  id: string;
  channelProductNo: string;
  html: string;
  contentHash: string;
  status: string;
};

export type ApplyItemResult = ApplyItem & {
  status: 'published' | 'failed' | 'skipped';
  beforeHtml: string | null;
  errorMessage: string | null;
  attemptCount: number;
};

export type ApplyClient = {
  updateDetailContent(channelProductNo: string, html: string): Promise<{ beforeHtml: string | null }>;
  wasApplied(channelProductNo: string, contentHash: string): Promise<boolean>;
};

export class PublishLimitError extends Error {
  constructor(limit: number, count: number) {
    super(`반영은 한 번에 ${limit}개까지입니다. 현재 ${count}개를 요청했습니다. 테스트 상품부터 확인한 뒤 범위를 넓혀 주세요.`);
    this.name = 'PublishLimitError';
  }
}

export function assertPublishLimitChange(publishedCount: number, next: 1 | 5 | null) {
  if (next === 1) return;
  if (next === 5 && publishedCount < 1) {
    throw new Error('테스트 상품 1개를 반영하고 확인한 뒤에 5개로 확대할 수 있습니다.');
  }
  if (next === null && publishedCount < 5) {
    throw new Error('서로 다른 상품 5개를 반영한 뒤에 전체 반영을 허용할 수 있습니다.');
  }
}

function actionable(items: ApplyItem[]) {
  return items.filter((item) => item.status === 'preview_ready' || item.status === 'failed');
}

export async function applyDetailItems(input: {
  items: ApplyItem[];
  publishLimit: number | null;
  client: ApplyClient;
}) {
  const targets = actionable(input.items);
  if (input.publishLimit != null && targets.length > input.publishLimit) {
    throw new PublishLimitError(input.publishLimit, targets.length);
  }

  const results: ApplyItemResult[] = [];
  for (const item of targets) {
    if (await input.client.wasApplied(item.channelProductNo, item.contentHash)) {
      results.push({ ...item, status: 'skipped', beforeHtml: null, errorMessage: null, attemptCount: 1 });
      continue;
    }
    try {
      const updated = await input.client.updateDetailContent(item.channelProductNo, item.html);
      results.push({
        ...item,
        status: 'published',
        beforeHtml: updated.beforeHtml,
        errorMessage: null,
        attemptCount: 1,
      });
    } catch (error) {
      const message = error instanceof NaverCommerceError || error instanceof Error
        ? error.message
        : '상세 반영에 실패했습니다.';
      results.push({
        ...item,
        status: 'failed',
        beforeHtml: null,
        errorMessage: message,
        attemptCount: 1,
      });
    }
  }

  const failed = results.filter((item) => item.status === 'failed').length;
  const published = results.filter((item) => item.status === 'published').length;
  const status = failed === 0 ? 'completed' : published === 0 && results.every((item) => item.status === 'failed')
    ? 'failed'
    : 'partial_failed';
  return { status, results, successCount: published, failedCount: failed, skippedCount: results.length - published - failed };
}
