import { assertChannelProductNo, CommerceCredentialsError, createNaverCommerceClient } from './naver';
import { buildMobileDetailHtml } from './html';
import { detailContentHash, jobIdempotencyKey } from './hash';
import { convertToMobileJpeg, detectImageContentType, downloadSourceImage, extensionForContentType } from './images';
import { readCommerceCredentials, SMARTSTORE_SETUP_GUIDE } from './credentials';
import {
  applyDetailItems,
  assertPublishLimitChange,
  PublishLimitError,
} from './apply';
import {
  countPublishedProducts,
  DuplicateVersionError,
  ensureConnection,
  findJobByIdempotencyKey,
  getJob,
  insertJob,
  insertVersion,
  listJobs,
  markJob,
  newObjectPath,
  SmartstoreSchemaError,
  updateConnection,
  updateItem,
  uploadPublicObject,
  wasApplied,
  type JobRecord,
} from './repository';

export type PreviewFile = {
  filename: string;
  contentType: string;
  bytes: Buffer;
};

export type PreviewProductInput = {
  channelProductNo: string;
  productName?: string | null;
  imageUrls?: string[];
  files?: PreviewFile[];
};

export type AuditWriter = (entry: {
  action: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) => Promise<void>;

async function storeImagePair(channelProductNo: string, bytes: Buffer, declaredType: string) {
  const contentType = detectImageContentType(bytes, declaredType);
  const extension = extensionForContentType(contentType);
  const originalUrl = await uploadPublicObject(
    newObjectPath('original', channelProductNo, extension),
    bytes,
    contentType,
  );
  const jpeg = await convertToMobileJpeg(bytes);
  const deployedUrl = await uploadPublicObject(
    newObjectPath('deploy', channelProductNo, 'jpg'),
    jpeg,
    'image/jpeg',
  );
  return { originalUrl, deployedUrl };
}

async function buildItem(product: PreviewProductInput) {
  const channelProductNo = assertChannelProductNo(product.channelProductNo);
  const urls = product.imageUrls || [];
  const files = product.files || [];
  if (urls.length + files.length === 0) {
    throw new Error(`${channelProductNo} 상품에 상세 이미지가 없습니다.`);
  }
  if (urls.length + files.length > 30) {
    throw new Error('상품당 이미지는 30장까지입니다.');
  }

  const originalImageUrls: string[] = [];
  const deployedImageUrls: string[] = [];
  for (const url of urls) {
    const downloaded = await downloadSourceImage(url);
    const stored = await storeImagePair(channelProductNo, downloaded.bytes, downloaded.contentType);
    originalImageUrls.push(stored.originalUrl);
    deployedImageUrls.push(stored.deployedUrl);
  }
  for (const file of files) {
    const stored = await storeImagePair(channelProductNo, file.bytes, file.contentType);
    originalImageUrls.push(stored.originalUrl);
    deployedImageUrls.push(stored.deployedUrl);
  }

  const afterHtml = buildMobileDetailHtml(deployedImageUrls);
  return {
    channelProductNo,
    productName: product.productName?.trim() || null,
    sourceImageUrls: urls,
    originalImageUrls,
    deployedImageUrls,
    afterHtml,
    contentHash: detailContentHash(channelProductNo, afterHtml),
  };
}

export async function getSmartstoreOverview(audit?: AuditWriter) {
  const credentials = readCommerceCredentials();
  let schemaReady = true;
  let connection: Awaited<ReturnType<typeof ensureConnection>> | null = null;
  let jobs: JobRecord[] = [];
  try {
    connection = await ensureConnection();
    jobs = await listJobs();
  } catch (error) {
    if (!(error instanceof SmartstoreSchemaError)) throw error;
    schemaReady = false;
  }

  let status = connection?.status || 'unconfigured';
  let lastError = connection?.lastError || null;
  if (!credentials.configured) {
    status = 'unconfigured';
    lastError = null;
  } else if (schemaReady && connection) {
    try {
      await createNaverCommerceClient({ credentials }).diagnose();
      if (connection.status !== 'ready' || connection.lastError) {
        await updateConnection(connection.id, { status: 'ready', lastError: null });
        await audit?.({
          action: 'UPDATE',
          entityId: connection.id,
          metadata: { status: 'ready' },
        });
      }
      status = 'ready';
      lastError = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : '연결 진단에 실패했습니다.';
      await updateConnection(connection.id, { status: 'error', lastError: message });
      await audit?.({
        action: 'UPDATE',
        entityId: connection.id,
        metadata: { status: 'error' },
      });
      status = 'error';
      lastError = message;
    }
  }

  return {
    schemaReady,
    storeName: '아하득템',
    storeKey: 'ahadeuktem',
    configured: credentials.configured,
    status,
    publishLimit: connection?.publishLimit ?? 1,
    publishedProductCount: schemaReady ? await countPublishedProducts() : 0,
    lastCheckedAt: new Date().toISOString(),
    lastError,
    guide: credentials.configured ? [] : SMARTSTORE_SETUP_GUIDE,
    notice: '승인 반영한 상품은 SmartEditor ONE에서 HTML 상세로 전환됩니다. API만으로 SmartEditor ONE 문서를 되돌릴 수 없습니다.',
    jobs,
  };
}

export async function createDetailPreview(input: {
  actorId: string;
  products: PreviewProductInput[];
  audit?: AuditWriter;
}) {
  if (input.products.length === 0 || input.products.length > 30) {
    throw new Error('한 번에 1~30개 상품을 준비할 수 있습니다.');
  }
  const seen = new Set<string>();
  for (const product of input.products) {
    const channelProductNo = assertChannelProductNo(product.channelProductNo);
    if (seen.has(channelProductNo)) throw new Error('같은 작업에 채널 상품번호가 중복되었습니다.');
    seen.add(channelProductNo);
  }

  const connection = await ensureConnection();
  const items = [];
  for (const product of input.products) items.push(await buildItem(product));
  const idempotencyKey = jobIdempotencyKey(items);
  const existing = await findJobByIdempotencyKey(idempotencyKey);
  if (existing) return existing;

  const created = await insertJob({
    connectionId: connection.id,
    idempotencyKey,
    createdBy: input.actorId,
    items,
  });
  if (!created) throw new Error('미리보기 작업을 저장하지 못했습니다.');
  await input.audit?.({
    action: 'CREATE',
    entityId: created.id,
    metadata: {
      channels: items.map((item) => item.channelProductNo),
      hashes: items.map((item) => item.contentHash),
    },
  });
  return created;
}

export async function publishDetailJob(input: { jobId: string; actorId: string; audit?: AuditWriter }) {
  const credentials = readCommerceCredentials();
  if (!credentials.configured) throw new CommerceCredentialsError();
  const job = await getJob(input.jobId);
  if (!job) throw new Error('작업을 찾지 못했습니다.');
  const actionable = job.items.filter((item) => item.status === 'preview_ready' || item.status === 'failed');
  if (actionable.length === 0) throw new Error('반영할 항목이 없습니다.');

  const connection = await ensureConnection();
  await markJob(job.id, { status: 'publishing', publishApproved: true });
  try {
    const client = createNaverCommerceClient({ credentials });
    const applied = await applyDetailItems({
      items: job.items.map((item) => ({
        id: item.id,
        channelProductNo: item.channelProductNo,
        html: item.afterHtml,
        contentHash: item.contentHash,
        status: item.status,
      })),
      publishLimit: connection.publishLimit,
      client: {
        updateDetailContent: (channelProductNo, html) => client.updateDetailContent(channelProductNo, html),
        wasApplied,
      },
    });

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    for (const result of applied.results) {
      const previous = job.items.find((item) => item.id === result.id);
      let status = result.status;
      if (status === 'published') {
        try {
          await insertVersion({
            jobItemId: result.id,
            channelProductNo: result.channelProductNo,
            beforeHtml: result.beforeHtml,
            afterHtml: result.html,
            imageUrls: previous?.deployedImageUrls || [],
            contentHash: result.contentHash,
            actorId: input.actorId,
          });
          successCount += 1;
        } catch (error) {
          if (!(error instanceof DuplicateVersionError)) throw error;
          status = 'skipped';
          skippedCount += 1;
        }
      } else if (status === 'failed') {
        failedCount += 1;
      } else {
        skippedCount += 1;
      }
      await updateItem(result.id, {
        status,
        errorMessage: status === 'failed' ? result.errorMessage : null,
        attemptCount: (previous?.attemptCount || 0) + result.attemptCount,
      });
    }

    const status = failedCount === 0 ? 'completed' : successCount === 0 && skippedCount === 0 ? 'failed' : 'partial_failed';
    await markJob(job.id, {
      status,
      publishApproved: true,
      successCount,
      failedCount,
      skippedCount,
    });
    await input.audit?.({
      action: 'APPROVE',
      entityId: job.id,
      metadata: { status, successCount, failedCount, skippedCount },
    });
    return getJob(job.id);
  } catch (error) {
    if (error instanceof PublishLimitError) {
      await markJob(job.id, { status: 'preview_ready', publishApproved: false });
    } else {
      await markJob(job.id, { status: 'failed', publishApproved: true });
    }
    throw error;
  }
}

export async function retryDetailJob(input: { jobId: string; actorId: string; audit?: AuditWriter }) {
  const job = await getJob(input.jobId);
  if (!job) throw new Error('작업을 찾지 못했습니다.');
  if (!job.items.some((item) => item.status === 'failed')) {
    throw new Error('재시도할 실패 항목이 없습니다.');
  }
  await input.audit?.({
    action: 'UPDATE',
    entityId: job.id,
    metadata: { retry: true },
  });
  return publishDetailJob(input);
}

export async function changePublishLimit(input: {
  publishLimit: 1 | 5 | null;
  audit?: AuditWriter;
}) {
  const connection = await ensureConnection();
  const publishedProductCount = await countPublishedProducts();
  assertPublishLimitChange(publishedProductCount, input.publishLimit);
  await updateConnection(connection.id, {
    publishLimit: input.publishLimit,
    status: connection.status,
    lastError: connection.lastError,
  });
  await input.audit?.({
    action: 'UPDATE',
    entityId: connection.id,
    metadata: { publishLimit: input.publishLimit, publishedProductCount },
  });
  return { publishLimit: input.publishLimit, publishedProductCount };
}
