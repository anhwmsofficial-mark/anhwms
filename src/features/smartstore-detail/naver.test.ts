import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { genSaltSync } from 'bcryptjs';
import {
  CommerceCredentialsError,
  createClientSecretSign,
  createNaverCommerceClient,
  replaceDetailContent,
} from './naver';
import { buildMobileDetailHtml } from './html';

const HTML = buildMobileDetailHtml(['https://cdn.example.com/detail/safe.jpg']);
const CHANNEL = '13868826874';

describe('네이버 커머스 클라이언트', () => {
  it('조회한 상품 필드를 유지하고 detailContent만 교체한다', () => {
    const product = {
      originProduct: {
        detailContent: '<p>old</p>',
        name: '보관함',
        salePrice: 19000,
        images: [{ url: 'https://cdn.example.com/keep.jpg' }],
      },
      smartstoreChannelProduct: { channelProductNo: CHANNEL, channelProductName: '보관함' },
    };
    const next = replaceDetailContent(product, HTML);
    assert.equal(next.originProduct.detailContent, HTML);
    assert.equal(next.originProduct.salePrice, 19000);
    assert.equal(next.originProduct.name, '보관함');
    assert.deepEqual(next.originProduct.images, product.originProduct.images);
    assert.equal(next.smartstoreChannelProduct.channelProductName, '보관함');
    assert.equal(product.originProduct.detailContent, '<p>old</p>');
  });

  it('자격증명이 없으면 API를 호출하지 않는다', async () => {
    let called = false;
    const client = createNaverCommerceClient({
      credentials: null,
      fetchImpl: async () => {
        called = true;
        return new Response('');
      },
    });
    await assert.rejects(() => client.diagnose(), CommerceCredentialsError);
    await assert.rejects(() => client.getProduct(CHANNEL), CommerceCredentialsError);
    assert.equal(called, false);
  });

  it('상품 수정 요청에 원본 필드를 포함하고 API 오류에서 비밀값을 제거한다', async () => {
    const secret = genSaltSync(4);
    const sign = createClientSecretSign('client-id', secret, 1);
    assert.equal(Buffer.from(sign, 'base64').toString('utf8').startsWith('$2'), true);

    let puts = 0;
    const client = createNaverCommerceClient({
      credentials: { clientId: 'client-id', clientSecret: secret },
      now: () => 1_700_000_000_000,
      fetchImpl: async (url, init) => {
        const href = String(url);
        if (href.endsWith('/v1/oauth2/token')) {
          return Response.json({ access_token: 'token-1', expires_in: 3600 });
        }
        if (init?.method === 'PUT') {
          puts += 1;
          const body = JSON.parse(String(init.body));
          assert.equal(body.originProduct.salePrice, 19000);
          assert.equal(body.smartstoreChannelProduct.channelProductName, '보관함');
          assert.equal(body.originProduct.detailContent, HTML);
          return new Response('client_secret=super-secret-value&ok=1', { status: 500 });
        }
        return Response.json({
          originProduct: { detailContent: '<p>old</p>', name: '보관함', salePrice: 19000 },
          smartstoreChannelProduct: { channelProductNo: CHANNEL, channelProductName: '보관함' },
        });
      },
    });

    await assert.rejects(
      () => client.updateDetailContent(CHANNEL, HTML),
      (error: unknown) => {
        assert.equal(error instanceof Error, true);
        assert.equal((error as Error).message.includes('super-secret-value'), false);
        return true;
      },
    );
    assert.equal(puts, 1);
  });

  it('인증이 만료되면 토큰을 한 번 다시 발급한다', async () => {
    const secret = genSaltSync(4);
    let tokens = 0;
    let reads = 0;
    const client = createNaverCommerceClient({
      credentials: { clientId: 'client-id', clientSecret: secret },
      now: () => 1_700_000_000_000,
      fetchImpl: async (url) => {
        if (String(url).endsWith('/v1/oauth2/token')) {
          tokens += 1;
          return Response.json({ access_token: `token-${tokens}`, expires_in: 3600 });
        }
        reads += 1;
        if (reads === 1) return new Response('expired', { status: 401 });
        return Response.json({ originProduct: { detailContent: 'old', name: '상품' } });
      },
    });
    const product = await client.getProduct(CHANNEL);
    assert.equal(product.originProduct && (product.originProduct as { name: string }).name, '상품');
    assert.equal(tokens, 2);
  });
});
