import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { convertToMobileJpeg, detectImageContentType, DetailImageError, downloadSourceImage } from './images';
import { DETAIL_MAX_WIDTH } from './html';

describe('상세 이미지 변환', () => {
  it('넓은 이미지를 860px 이하 JPG로 만들고 EXIF를 제거한다', async () => {
    const source = await sharp({
      create: { width: 1200, height: 80, channels: 3, background: { r: 20, g: 40, b: 60 } },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { ImageDescription: 'secret-exif' } } })
      .toBuffer();
    const sourceMeta = await sharp(source).metadata();
    assert.ok(sourceMeta.exif);

    const output = await convertToMobileJpeg(source);
    const meta = await sharp(output).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.ok((meta.width || 0) <= DETAIL_MAX_WIDTH);
    assert.equal(meta.width, DETAIL_MAX_WIDTH);
    assert.equal(meta.exif, undefined);
    assert.equal(detectImageContentType(output, 'application/octet-stream'), 'image/jpeg');
  });

  it('HTTP와 이미지가 아닌 응답은 변환하지 않는다', async () => {
    await assert.rejects(() => downloadSourceImage('http://cdn.example.com/a.jpg'), DetailImageError);
    await assert.rejects(
      () => downloadSourceImage('https://cdn.example.com/page', async () => new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })),
      DetailImageError,
    );
  });
});
