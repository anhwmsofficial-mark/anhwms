import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertSafeDetailHtml, buildMobileDetailHtml, UnsafeDetailContentError } from './html';

const JPG = 'https://cdn.example.com/detail/a.jpg';
const JPEG = 'https://cdn.example.com/detail/b.jpeg';

describe('모바일 상세 HTML', () => {
  it('HTTPS JPG만 가로 100%, 최대 860px로 배치한다', () => {
    const html = buildMobileDetailHtml([JPG, JPEG]);
    assert.match(html, /width:100%/);
    assert.match(html, /max-width:860px/);
    assert.match(html, /height:auto/);
    assert.equal(html.includes('<script'), false);
    assert.equal((html.match(/<img /g) || []).length, 2);
    assertSafeDetailHtml(html);
  });

  it('HTTP, WEBP, 스크립트, 이미지가 아닌 주소를 차단한다', () => {
    assert.throws(() => buildMobileDetailHtml(['http://cdn.example.com/a.jpg']), UnsafeDetailContentError);
    assert.throws(() => buildMobileDetailHtml(['https://cdn.example.com/a.webp']), UnsafeDetailContentError);
    assert.throws(() => buildMobileDetailHtml(['https://cdn.example.com/a.jpg.exe']), UnsafeDetailContentError);
    assert.throws(() => assertSafeDetailHtml(`<script>alert(1)</script><img src="${JPG}" style="width:100%;max-width:860px;height:auto;" />`), UnsafeDetailContentError);
    assert.throws(() => assertSafeDetailHtml(`<img src="${JPG}" style="width:100%;max-width:860px;height:auto;" /><img src="http://cdn.example.com/mixed.jpg" style="width:100%;max-width:860px;height:auto;" />`), UnsafeDetailContentError);
  });
});
