import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyDetailItems, assertPublishLimitChange, PublishLimitError } from './apply';
import { NaverCommerceError } from './naver';
import { buildMobileDetailHtml } from './html';

const HTML = buildMobileDetailHtml(['https://cdn.example.com/detail/safe.jpg']);

function item(id: string, channelProductNo: string, status = 'preview_ready') {
  return { id, channelProductNo, html: HTML, contentHash: `hash-${id}`, status };
}

describe('상세 반영 작업', () => {
  it('같은 해시는 다시 반영하지 않는다', async () => {
    let updates = 0;
    const result = await applyDetailItems({
      items: [item('1', '13868826874')],
      publishLimit: 1,
      client: {
        wasApplied: async () => true,
        updateDetailContent: async () => {
          updates += 1;
          return { beforeHtml: null };
        },
      },
    });
    assert.equal(updates, 0);
    assert.equal(result.status, 'completed');
    assert.equal(result.results[0]?.status, 'skipped');
    assert.equal(result.skippedCount, 1);
  });

  it('일부 상품만 실패하면 부분 실패로 남긴다', async () => {
    const result = await applyDetailItems({
      items: [item('1', '13868826874'), item('2', '13868826875')],
      publishLimit: 5,
      client: {
        wasApplied: async () => false,
        updateDetailContent: async (channelProductNo) => {
          if (channelProductNo.endsWith('5')) throw new NaverCommerceError('네이버 커머스 API 오류 (500): 일시 오류', 500);
          return { beforeHtml: '<p>before</p>' };
        },
      },
    });
    assert.equal(result.status, 'partial_failed');
    assert.equal(result.successCount, 1);
    assert.equal(result.failedCount, 1);
    assert.equal(result.results.find((row) => row.id === '2')?.errorMessage?.includes('500'), true);
  });

  it('허용 범위를 넘으면 어떤 상품도 반영하지 않는다', async () => {
    let updates = 0;
    await assert.rejects(
      () => applyDetailItems({
        items: [item('1', '13868826874'), item('2', '13868826875')],
        publishLimit: 1,
        client: {
          wasApplied: async () => false,
          updateDetailContent: async () => {
            updates += 1;
            return { beforeHtml: null };
          },
        },
      }),
      PublishLimitError,
    );
    assert.equal(updates, 0);
  });

  it('반영 범위는 1개 검증 뒤에 5개, 5개 뒤에 전체로만 넓힌다', () => {
    assert.throws(() => assertPublishLimitChange(0, 5), /1개/);
    assert.doesNotThrow(() => assertPublishLimitChange(1, 5));
    assert.throws(() => assertPublishLimitChange(4, null), /5개/);
    assert.doesNotThrow(() => assertPublishLimitChange(5, null));
    assert.doesNotThrow(() => assertPublishLimitChange(0, 1));
  });
});
