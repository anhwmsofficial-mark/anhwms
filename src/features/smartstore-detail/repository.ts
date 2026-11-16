import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

const BUCKET = 'product-showcase';
const db = supabaseAdmin as unknown as SupabaseClient;

export class SmartstoreSchemaError extends Error {
  constructor() {
    super('스마트스토어 상세 작업 테이블이 없습니다. 마이그레이션을 적용해 주세요.');
    this.name = 'SmartstoreSchemaError';
  }
}

export class DuplicateVersionError extends Error {
  constructor() {
    super('같은 상세 해시는 이미 반영되어 있습니다.');
    this.name = 'DuplicateVersionError';
  }
}

export type ConnectionRecord = {
  id: string;
  storeKey: string;
  storeName: string;
  status: 'unconfigured' | 'ready' | 'error';
  publishLimit: number | null;
  lastCheckedAt: string | null;
  lastError: string | null;
};

export type JobItemRecord = {
  id: string;
  channelProductNo: string;
  productName: string | null;
  sourceImageUrls: string[];
  originalImageUrls: string[];
  deployedImageUrls: string[];
  afterHtml: string;
  beforeHtml: string | null;
  contentHash: string;
  status: string;
  attemptCount: number;
  errorMessage: string | null;
};

export type JobRecord = {
  id: string;
  status: string;
  idempotencyKey: string;
  requestedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  publishApproved: boolean;
  createdAt: string;
  updatedAt: string;
  items: JobItemRecord[];
};

type ConnectionRow = {
  id: string;
  store_key: string;
  store_name: string;
  status: ConnectionRecord['status'];
  publish_limit: number | null;
  last_checked_at: string | null;
  last_error: string | null;
};

type ItemRow = {
  id: string;
  channel_product_no: string;
  product_name: string | null;
  source_image_urls: string[] | null;
  original_image_urls: string[] | null;
  deployed_image_urls: string[] | null;
  after_html: string;
  content_hash: string;
  status: string;
  attempt_count: number;
  error_message: string | null;
};

type JobRow = {
  id: string;
  status: string;
  idempotency_key: string;
  requested_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  publish_approved: boolean;
  created_at: string;
  updated_at: string;
  smartstore_detail_job_items: ItemRow[] | null;
};

export function isSmartstoreSchemaUnavailable(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  const code = String(candidate?.code || '');
  const message = String(candidate?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || (
    message.includes('smartstore_') && (
      message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('could not find')
    )
  );
}

function raiseSchema(error: unknown): never {
  if (isSmartstoreSchemaUnavailable(error)) throw new SmartstoreSchemaError();
  throw error;
}

function asStringArray(value: string[] | null) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function mapItem(row: ItemRow, beforeHtml: string | null): JobItemRecord {
  return {
    id: row.id,
    channelProductNo: row.channel_product_no,
    productName: row.product_name,
    sourceImageUrls: asStringArray(row.source_image_urls),
    originalImageUrls: asStringArray(row.original_image_urls),
    deployedImageUrls: asStringArray(row.deployed_image_urls),
    afterHtml: row.after_html,
    beforeHtml,
    contentHash: row.content_hash,
    status: row.status,
    attemptCount: row.attempt_count,
    errorMessage: row.error_message,
  };
}

function mapConnection(row: ConnectionRow): ConnectionRecord {
  return {
    id: row.id,
    storeKey: row.store_key,
    storeName: row.store_name,
    status: row.status,
    publishLimit: row.publish_limit,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
  };
}

async function beforeHtmlByItem(itemIds: string[]) {
  const found = new Map<string, string | null>();
  if (itemIds.length === 0) return found;
  const { data, error } = await db
    .from('smartstore_detail_versions')
    .select('job_item_id, before_html, applied_at')
    .in('job_item_id', itemIds)
    .order('applied_at', { ascending: false });
  if (error) raiseSchema(error);
  for (const row of data || []) {
    if (!found.has(row.job_item_id)) found.set(row.job_item_id, row.before_html ?? null);
  }
  return found;
}

function mapJob(row: JobRow, versions: Map<string, string | null>): JobRecord {
  const items = (row.smartstore_detail_job_items || [])
    .slice()
    .sort((left, right) => left.channel_product_no.localeCompare(right.channel_product_no))
    .map((item) => mapItem(item, versions.get(item.id) ?? null));
  return {
    id: row.id,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    requestedCount: row.requested_count,
    successCount: row.success_count,
    failedCount: row.failed_count,
    skippedCount: row.skipped_count,
    publishApproved: row.publish_approved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

const JOB_SELECT = `
  id, status, idempotency_key, requested_count, success_count, failed_count, skipped_count,
  publish_approved, created_at, updated_at,
  smartstore_detail_job_items (
    id, channel_product_no, product_name, source_image_urls, original_image_urls,
    deployed_image_urls, after_html, content_hash, status, attempt_count, error_message
  )
`;

async function hydrate(rows: JobRow[]) {
  const itemIds = rows.flatMap((row) => (row.smartstore_detail_job_items || []).map((item) => item.id));
  const versions = await beforeHtmlByItem(itemIds);
  return rows.map((row) => mapJob(row, versions));
}

export async function ensureConnection() {
  const { data, error } = await db
    .from('smartstore_connections')
    .select('id, store_key, store_name, status, publish_limit, last_checked_at, last_error')
    .eq('store_key', 'ahadeuktem')
    .maybeSingle();
  if (error) raiseSchema(error);
  if (data) return mapConnection(data as ConnectionRow);

  const { data: created, error: insertError } = await db
    .from('smartstore_connections')
    .insert({ store_key: 'ahadeuktem', store_name: '아하득템', status: 'unconfigured', publish_limit: 1 })
    .select('id, store_key, store_name, status, publish_limit, last_checked_at, last_error')
    .single();
  if (insertError) raiseSchema(insertError);
  return mapConnection(created as ConnectionRow);
}

export async function updateConnection(id: string, patch: {
  status?: ConnectionRecord['status'];
  publishLimit?: number | null;
  lastError?: string | null;
}) {
  const payload: Record<string, unknown> = { last_checked_at: new Date().toISOString() };
  if (patch.status !== undefined) payload.status = patch.status;
  if ('publishLimit' in patch) payload.publish_limit = patch.publishLimit ?? null;
  if ('lastError' in patch) payload.last_error = patch.lastError;
  const { error } = await db.from('smartstore_connections').update(payload).eq('id', id);
  if (error) raiseSchema(error);
}

export async function listJobs() {
  const { data, error } = await db
    .from('smartstore_detail_jobs')
    .select(JOB_SELECT)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) raiseSchema(error);
  return hydrate((data || []) as unknown as JobRow[]);
}

export async function getJob(id: string) {
  const { data, error } = await db
    .from('smartstore_detail_jobs')
    .select(JOB_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) raiseSchema(error);
  if (!data) return null;
  const [job] = await hydrate([data as unknown as JobRow]);
  return job;
}

export async function findJobByIdempotencyKey(idempotencyKey: string) {
  const { data, error } = await db
    .from('smartstore_detail_jobs')
    .select(JOB_SELECT)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (error) raiseSchema(error);
  if (!data) return null;
  const [job] = await hydrate([data as unknown as JobRow]);
  return job;
}

export async function insertJob(input: {
  connectionId: string;
  idempotencyKey: string;
  createdBy: string;
  items: Array<{
    channelProductNo: string;
    productName: string | null;
    sourceImageUrls: string[];
    originalImageUrls: string[];
    deployedImageUrls: string[];
    afterHtml: string;
    contentHash: string;
  }>;
}) {
  const { data, error } = await db
    .from('smartstore_detail_jobs')
    .insert({
      connection_id: input.connectionId,
      idempotency_key: input.idempotencyKey,
      requested_count: input.items.length,
      created_by: input.createdBy,
      status: 'preview_ready',
    })
    .select('id')
    .single();
  if (error) {
    if (String((error as { code?: string }).code || '') === '23505') {
      return findJobByIdempotencyKey(input.idempotencyKey);
    }
    raiseSchema(error);
  }
  const jobId = data.id as string;
  const { error: itemError } = await db.from('smartstore_detail_job_items').insert(input.items.map((item) => ({
    job_id: jobId,
    channel_product_no: item.channelProductNo,
    product_name: item.productName,
    source_image_urls: item.sourceImageUrls,
    original_image_urls: item.originalImageUrls,
    deployed_image_urls: item.deployedImageUrls,
    after_html: item.afterHtml,
    content_hash: item.contentHash,
    status: 'preview_ready',
  })));
  if (itemError) raiseSchema(itemError);
  return getJob(jobId);
}

export async function markJob(id: string, patch: {
  status: string;
  publishApproved?: boolean;
  successCount?: number;
  failedCount?: number;
  skippedCount?: number;
}) {
  const payload: Record<string, unknown> = { status: patch.status };
  if (patch.publishApproved !== undefined) payload.publish_approved = patch.publishApproved;
  if (patch.successCount !== undefined) payload.success_count = patch.successCount;
  if (patch.failedCount !== undefined) payload.failed_count = patch.failedCount;
  if (patch.skippedCount !== undefined) payload.skipped_count = patch.skippedCount;
  const { error } = await db.from('smartstore_detail_jobs').update(payload).eq('id', id);
  if (error) raiseSchema(error);
}

export async function updateItem(id: string, patch: {
  status: string;
  errorMessage: string | null;
  attemptCount: number;
}) {
  const { error } = await db.from('smartstore_detail_job_items').update({
    status: patch.status,
    error_message: patch.errorMessage,
    attempt_count: patch.attemptCount,
  }).eq('id', id);
  if (error) raiseSchema(error);
}

export async function insertVersion(input: {
  jobItemId: string;
  channelProductNo: string;
  beforeHtml: string | null;
  afterHtml: string;
  imageUrls: string[];
  contentHash: string;
  actorId: string;
}) {
  const { error } = await db.from('smartstore_detail_versions').insert({
    job_item_id: input.jobItemId,
    channel_product_no: input.channelProductNo,
    before_html: input.beforeHtml,
    after_html: input.afterHtml,
    image_urls: input.imageUrls,
    content_hash: input.contentHash,
    actor_id: input.actorId,
  });
  if (error) {
    if (String((error as { code?: string }).code || '') === '23505') throw new DuplicateVersionError();
    raiseSchema(error);
  }
}

export async function wasApplied(channelProductNo: string, contentHash: string) {
  const { data, error } = await db
    .from('smartstore_detail_versions')
    .select('id')
    .eq('channel_product_no', channelProductNo)
    .eq('content_hash', contentHash)
    .is('rolled_back_at', null)
    .limit(1);
  if (error) raiseSchema(error);
  return (data || []).length > 0;
}

export async function countPublishedProducts() {
  const { data, error } = await db
    .from('smartstore_detail_versions')
    .select('channel_product_no')
    .is('rolled_back_at', null);
  if (error) raiseSchema(error);
  return new Set((data || []).map((row) => row.channel_product_no)).size;
}

export async function uploadPublicObject(path: string, bytes: Buffer, contentType: string) {
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) {
    if (isSmartstoreSchemaUnavailable(error) || String(error.message || '').toLowerCase().includes('bucket not found')) {
      throw new SmartstoreSchemaError();
    }
    throw error;
  }
  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  if (!data.publicUrl.startsWith('https://')) {
    throw new Error('배포 이미지 주소가 HTTPS가 아닙니다.');
  }
  return data.publicUrl;
}

export function newObjectPath(kind: 'original' | 'deploy', channelProductNo: string, extension: string) {
  return `smartstore-detail/${kind}/${channelProductNo}/${randomUUID()}.${extension}`;
}
