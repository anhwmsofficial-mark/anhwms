import 'server-only'

import { AppError } from '@/lib/errorHandler'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/utils/supabase/admin'

export const INVENTORY_MOVEMENT_TYPES = [
  'DAMAGE',
  'RETURN_B2C',
  'DISPOSAL',
  'JET_RETURN',
  'RETURN_MILKRUN',
  'FREIGHT_QUICK_OUT',
  'OFFICE_USE_OUT',
  'FIRE_IN',
  'FIRE_OUT',
  'INBOUND',
  'RECLASSIFY_GOOD_IN',
  'JET_TRANSFER_OUT',
  'JET_TRANSFER_CANCEL_IN',
  'ADVANCE_EXCHANGE_IN',
  'ADVANCE_EXCHANGE_OUT',
  'COUPANG_MILKRUN_OUT',
  'STOCK_ADJUSTMENT_IN',
  'STOCK_ADJUSTMENT_OUT',
  'SAMPLE_OUT',
  'REPACK_INBOUND_IN',
  'EXPORT_PICKUP_OUT',
  'BUNDLE_SPLIT_IN',
  'BUNDLE_SPLIT_OUT',
  'BUNDLE_IN',
  'BUNDLE_OUT',
  'REPACK_IN',
  'REPACK_OUT',
  'RELABEL_IN',
  'RELABEL_OUT',
  'ROCKET_GROWTH_PARCEL_OUT',
  'CAFE_DISPLAY_IN',
  'CAFE_DISPLAY_OUT',
  'OUTBOUND_CANCEL_IN',
  'PARCEL_OUT',
  'INVENTORY_INIT',
  'OUTBOUND',
  'TRANSFER',
] as const

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number]
export type InventoryDirection = 'IN' | 'OUT'

type InventoryTransactionRow = {
  id: string
  product_id: string
  qty_change: number | null
  quantity: number | null
  direction: InventoryDirection | null
  movement_type: string | null
  created_at: string
}

type InventorySnapshotRow = {
  snapshot_date: string
  product_id: string
  opening_stock: number | null
  total_in: number | null
  total_out: number | null
  closing_stock: number | null
  created_at?: string
  updated_at?: string
}

type WarehouseRow = {
  id: string
  org_id: string
}

type InventoryQuantityRow = {
  qty_on_hand: number | null
  qty_available: number | null
  qty_allocated: number | null
}

type ProductQuantityAggregateRow = {
  qty_on_hand: number | null
}

type QueryableClient = ReturnType<typeof createAdminClient> & {
  from: (table: string) => any
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

const movementDirectionMap: Record<InventoryMovementType, InventoryDirection | null> = {
  DAMAGE: 'OUT',
  RETURN_B2C: 'IN',
  DISPOSAL: 'OUT',
  JET_RETURN: 'IN',
  RETURN_MILKRUN: 'IN',
  FREIGHT_QUICK_OUT: 'OUT',
  OFFICE_USE_OUT: 'OUT',
  FIRE_IN: 'IN',
  FIRE_OUT: 'OUT',
  INBOUND: 'IN',
  RECLASSIFY_GOOD_IN: 'IN',
  JET_TRANSFER_OUT: 'OUT',
  JET_TRANSFER_CANCEL_IN: 'IN',
  ADVANCE_EXCHANGE_IN: 'IN',
  ADVANCE_EXCHANGE_OUT: 'OUT',
  COUPANG_MILKRUN_OUT: 'OUT',
  STOCK_ADJUSTMENT_IN: 'IN',
  STOCK_ADJUSTMENT_OUT: 'OUT',
  SAMPLE_OUT: 'OUT',
  REPACK_INBOUND_IN: 'IN',
  EXPORT_PICKUP_OUT: 'OUT',
  BUNDLE_SPLIT_IN: 'IN',
  BUNDLE_SPLIT_OUT: 'OUT',
  BUNDLE_IN: 'IN',
  BUNDLE_OUT: 'OUT',
  REPACK_IN: 'IN',
  REPACK_OUT: 'OUT',
  RELABEL_IN: 'IN',
  RELABEL_OUT: 'OUT',
  ROCKET_GROWTH_PARCEL_OUT: 'OUT',
  CAFE_DISPLAY_IN: 'IN',
  CAFE_DISPLAY_OUT: 'OUT',
  OUTBOUND_CANCEL_IN: 'IN',
  PARCEL_OUT: 'OUT',
  INVENTORY_INIT: 'IN',
  OUTBOUND: 'OUT',
  TRANSFER: null,
}

export type GetRealtimeInventoryInput = {
  tenantId: string
  productId: string
  asOf?: Date | string
  client?: QueryableClient
}

export type GetRealtimeInventoryResult = {
  tenantId: string
  productId: string
  snapshotDate: string | null
  baselineStock: number
  transactionDelta: number
  currentStock: number
}

export type ApplyInventoryTransactionInput = {
  tenantId: string
  warehouseId: string
  productId: string
  type: InventoryMovementType
  quantity: number
  client?: QueryableClient
  referenceId?: string | null
  referenceType?: string | null
  reason?: string | null
  notes?: string | null
  createdBy?: string | null
  createdAt?: Date | string
  idempotencyKey?: string | null
  sourceHash?: string | null
  balanceAfter?: number | null
}

export type ApplyInventoryTransactionResult = {
  ledgerId: string
  direction: InventoryDirection
  quantityDelta: number
  warehouseStock: number
  productStock: number
}

export type DailyClosingInput = {
  tenantId: string
  targetDate?: string
  client?: QueryableClient
}

export type DailyClosingRow = {
  productId: string
  openingStock: number
  totalIn: number
  totalOut: number
  closingStock: number
}

export type DailyClosingResult = {
  date: string
  nextDate: string
  snapshotCount: number
  rows: DailyClosingRow[]
}

function getClient(client?: QueryableClient) {
  return (client || createAdminClient()) as QueryableClient
}

function assertUuidLike(value: string, fieldName: string) {
  if (!value || typeof value !== 'string') {
    throw new AppError(`${fieldName}가 필요합니다.`, 400, 'VALIDATION_ERROR')
  }
}

function assertPositiveInteger(value: number, fieldName: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(`${fieldName}는 0보다 큰 정수여야 합니다.`, 400, 'VALIDATION_ERROR')
  }
}

function resolveDirection(type: InventoryMovementType): InventoryDirection {
  const direction = movementDirectionMap[type]
  if (!direction) {
    throw new AppError(`movement type ${type}의 방향을 결정할 수 없습니다.`, 400, 'VALIDATION_ERROR')
  }
  return direction
}

function toSignedQuantity(direction: InventoryDirection, quantity: number) {
  return direction === 'IN' ? quantity : -quantity
}

function toIsoString(value?: Date | string) {
  if (!value) return new Date().toISOString()
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new AppError('유효하지 않은 날짜 형식입니다.', 400, 'VALIDATION_ERROR')
  }
  return date.toISOString()
}

function toKstDateString(value: Date | string = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new AppError('유효하지 않은 날짜 형식입니다.', 400, 'VALIDATION_ERROR')
  }

  const kst = new Date(date.getTime() + KST_OFFSET_MS)
  const year = kst.getUTCFullYear()
  const month = `${kst.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${kst.getUTCDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split('-').map(Number)
  const utc = Date.UTC(year, month - 1, day + days)
  return toKstDateString(new Date(utc))
}

function startOfKstDayUtc(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - KST_OFFSET_MS)
}

function endOfKstDayUtc(dateString: string) {
  const start = startOfKstDayUtc(dateString)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
}

function getDefaultClosingDate() {
  return addDays(toKstDateString(new Date()), -1)
}

function sumSignedTransactions(rows: InventoryTransactionRow[]) {
  return rows.reduce((sum, row) => {
    if (typeof row.qty_change === 'number') {
      return sum + row.qty_change
    }

    const absolute = Math.abs(Number(row.quantity || 0))
    if ((row.direction || 'IN') === 'OUT') {
      return sum - absolute
    }
    return sum + absolute
  }, 0)
}

async function getWarehouseContext(client: QueryableClient, warehouseId: string) {
  const { data, error } = await client
    .from('warehouse')
    .select('id, org_id')
    .eq('id', warehouseId)
    .single()

  if (error || !data) {
    throw new AppError('창고 정보를 찾을 수 없습니다.', 404, error?.code || 'NOT_FOUND', error)
  }

  return data as WarehouseRow
}

async function getWarehouseStockRow(client: QueryableClient, warehouseId: string, productId: string) {
  const { data, error } = await client
    .from('inventory_quantities')
    .select('qty_on_hand, qty_available, qty_allocated')
    .eq('warehouse_id', warehouseId)
    .eq('product_id', productId)
    .maybeSingle()

  if (error) {
    throw new AppError('창고 재고를 조회하지 못했습니다.', 500, error.code, error)
  }

  return (data as InventoryQuantityRow | null) || {
    qty_on_hand: 0,
    qty_available: 0,
    qty_allocated: 0,
  }
}

async function syncProductQuantity(client: QueryableClient, tenantId: string, productId: string) {
  const { data, error } = await client
    .from('inventory_quantities')
    .select('qty_on_hand')
    .eq('tenant_id', tenantId)
    .eq('product_id', productId)

  if (error) {
    throw new AppError('상품 총재고를 집계하지 못했습니다.', 500, error.code, error)
  }

  const totalQuantity = ((data || []) as ProductQuantityAggregateRow[]).reduce(
    (sum, row) => sum + Number(row.qty_on_hand || 0),
    0
  )

  const { error: updateError } = await client
    .from('products')
    .update({
      quantity: totalQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)

  if (updateError) {
    throw new AppError('상품 현재고를 동기화하지 못했습니다.', 500, updateError.code, updateError)
  }

  return totalQuantity
}

async function loadOpeningStockMap(
  client: QueryableClient,
  tenantId: string,
  targetDate: string,
  productIds: string[]
) {
  const openingMap = new Map<string, number>()

  if (productIds.length === 0) {
    return openingMap
  }

  const { data: sameDayRows, error: sameDayError } = await client
    .from('inventory_snapshot')
    .select('product_id, opening_stock, closing_stock')
    .eq('tenant_id', tenantId)
    .eq('snapshot_date', targetDate)
    .in('product_id', productIds)

  if (sameDayError) {
    throw new AppError('당일 스냅샷을 조회하지 못했습니다.', 500, sameDayError.code, sameDayError)
  }

  for (const row of ((sameDayRows || []) as unknown as InventorySnapshotRow[])) {
    openingMap.set(row.product_id, Number(row.opening_stock ?? row.closing_stock ?? 0))
  }

  const missingProductIds = productIds.filter((productId) => !openingMap.has(productId))
  for (const productId of missingProductIds) {
    const { data: previousSnapshot, error } = await client
      .from('inventory_snapshot')
      .select('product_id, closing_stock')
      .eq('tenant_id', tenantId)
      .eq('product_id', productId)
      .lt('snapshot_date', targetDate)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new AppError('이전 스냅샷을 조회하지 못했습니다.', 500, error.code, error)
    }

    openingMap.set(productId, Number(previousSnapshot?.closing_stock || 0))
  }

  return openingMap
}

export async function getRealtimeInventory(input: GetRealtimeInventoryInput): Promise<GetRealtimeInventoryResult> {
  const client = getClient(input.client)
  assertUuidLike(input.tenantId, 'tenantId')
  assertUuidLike(input.productId, 'productId')

  const asOfIso = toIsoString(input.asOf)
  const asOfDate = toKstDateString(asOfIso)

  const { data: snapshot, error: snapshotError } = await client
    .from('inventory_snapshot')
    .select('snapshot_date, product_id, opening_stock, closing_stock')
    .eq('tenant_id', input.tenantId)
    .eq('product_id', input.productId)
    .lte('snapshot_date', asOfDate)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (snapshotError) {
    throw new AppError('스냅샷을 조회하지 못했습니다.', 500, snapshotError.code, snapshotError)
  }

  const snapshotRow = snapshot as unknown as InventorySnapshotRow | null

  let baselineStock = 0
  let transactionsFromIso: string | null = null
  let snapshotDate: string | null = null

  if (snapshotRow) {
    snapshotDate = snapshotRow.snapshot_date

    if (snapshotRow.snapshot_date === asOfDate) {
      baselineStock = Number(snapshotRow.opening_stock ?? snapshotRow.closing_stock ?? 0)
      transactionsFromIso = startOfKstDayUtc(snapshotRow.snapshot_date).toISOString()
    } else {
      baselineStock = Number(snapshotRow.closing_stock ?? 0)
      transactionsFromIso = startOfKstDayUtc(addDays(snapshotRow.snapshot_date, 1)).toISOString()
    }
  }

  let transactionQuery = client
    .from('inventory_ledger')
    .select('id, product_id, qty_change, quantity, direction, movement_type, created_at')
    .eq('tenant_id', input.tenantId)
    .eq('product_id', input.productId)
    .lte('created_at', asOfIso)
    .order('created_at', { ascending: true })

  if (transactionsFromIso) {
    transactionQuery = transactionQuery.gte('created_at', transactionsFromIso)
  }

  const { data: transactionRows, error: transactionError } = await transactionQuery

  if (transactionError) {
    throw new AppError('트랜잭션을 조회하지 못했습니다.', 500, transactionError.code, transactionError)
  }

  const transactionDelta = sumSignedTransactions((transactionRows || []) as InventoryTransactionRow[])
  const currentStock = baselineStock + transactionDelta

  return {
    tenantId: input.tenantId,
    productId: input.productId,
    snapshotDate,
    baselineStock,
    transactionDelta,
    currentStock,
  }
}

export async function validateNonNegativeInventory(
  client: QueryableClient,
  params: {
    warehouseId: string
    productId: string
    direction: InventoryDirection
    quantity: number
  }
) {
  const row = await getWarehouseStockRow(client, params.warehouseId, params.productId)
  const currentOnHand = Number(row.qty_on_hand || 0)
  const currentAllocated = Number(row.qty_allocated || 0)
  const currentAvailable = Number(row.qty_available || 0)
  const quantityDelta = toSignedQuantity(params.direction, params.quantity)
  const nextOnHand = currentOnHand + quantityDelta
  const nextAvailable = nextOnHand - currentAllocated

  if (nextOnHand < 0) {
    throw new AppError('재고가 마이너스가 될 수 없습니다.', 400, 'NEGATIVE_STOCK', {
      currentOnHand,
      requestedQuantity: params.quantity,
      direction: params.direction,
      nextOnHand,
    })
  }

  if (params.direction === 'OUT' && params.quantity > currentAvailable) {
    throw new AppError('가용 재고보다 많은 수량을 차감할 수 없습니다.', 400, 'INSUFFICIENT_AVAILABLE_STOCK', {
      currentAvailable,
      requestedQuantity: params.quantity,
    })
  }

  if (nextAvailable < 0) {
    throw new AppError('할당 재고보다 적은 현재고로 변경할 수 없습니다.', 400, 'NEGATIVE_AVAILABLE_STOCK', {
      currentAllocated,
      nextOnHand,
      nextAvailable,
    })
  }

  return {
    currentOnHand,
    currentAvailable,
    currentAllocated,
    nextOnHand,
    nextAvailable,
    quantityDelta,
  }
}

export async function applyInventoryTransaction(
  input: ApplyInventoryTransactionInput
): Promise<ApplyInventoryTransactionResult> {
  const client = getClient(input.client)
  assertUuidLike(input.tenantId, 'tenantId')
  assertUuidLike(input.warehouseId, 'warehouseId')
  assertUuidLike(input.productId, 'productId')
  assertPositiveInteger(input.quantity, 'quantity')

  const direction = resolveDirection(input.type)
  const warehouse = await getWarehouseContext(client, input.warehouseId)
  const inventoryState = await validateNonNegativeInventory(client, {
    warehouseId: input.warehouseId,
    productId: input.productId,
    direction,
    quantity: input.quantity,
  })

  const quantityDelta = inventoryState.quantityDelta
  const absoluteQuantity = Math.abs(quantityDelta)
  const createdAt = toIsoString(input.createdAt)
  const balanceAfter = input.balanceAfter ?? inventoryState.nextOnHand
  const reason = input.reason || input.notes || null

  const { data: ledgerEntry, error: insertError } = await client
    .from('inventory_ledger')
    .insert({
      org_id: warehouse.org_id,
      tenant_id: input.tenantId,
      warehouse_id: input.warehouseId,
      product_id: input.productId,
      transaction_type: input.type,
      movement_type: input.type,
      direction,
      quantity: absoluteQuantity,
      qty_change: quantityDelta,
      balance_after: balanceAfter,
      reference_type: input.referenceType || null,
      reference_id: input.referenceId || null,
      memo: reason,
      notes: input.notes || null,
      created_by: input.createdBy || null,
      created_at: createdAt,
      idempotency_key: input.idempotencyKey || null,
      source_hash: input.sourceHash || null,
    })
    .select('id')
    .single()

  if (insertError || !ledgerEntry) {
    throw new AppError('재고 트랜잭션을 저장하지 못했습니다.', 500, insertError?.code, insertError)
  }

  const { error: quantityError } = await client
    .from('inventory_quantities')
    .upsert(
      {
        org_id: warehouse.org_id,
        tenant_id: input.tenantId,
        warehouse_id: input.warehouseId,
        product_id: input.productId,
        qty_on_hand: inventoryState.nextOnHand,
        qty_available: inventoryState.nextAvailable,
        qty_allocated: inventoryState.currentAllocated,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'warehouse_id,product_id' }
    )

  if (quantityError) {
    throw new AppError('창고 재고를 업데이트하지 못했습니다.', 500, quantityError.code, quantityError)
  }

  const productStock = await syncProductQuantity(client, input.tenantId, input.productId)

  logger.info('Applied inventory transaction', {
    tenantId: input.tenantId,
    warehouseId: input.warehouseId,
    productId: input.productId,
    type: input.type,
    quantity: input.quantity,
    direction,
    quantityDelta,
    warehouseStock: inventoryState.nextOnHand,
    productStock,
  })

  return {
    ledgerId: ledgerEntry.id,
    direction,
    quantityDelta,
    warehouseStock: inventoryState.nextOnHand,
    productStock,
  }
}

export async function runDailyClosing(input: DailyClosingInput): Promise<DailyClosingResult> {
  const client = getClient(input.client)
  assertUuidLike(input.tenantId, 'tenantId')

  const targetDate = input.targetDate || getDefaultClosingDate()
  const nextDate = addDays(targetDate, 1)
  const dayStartIso = startOfKstDayUtc(targetDate).toISOString()
  const dayEndIso = endOfKstDayUtc(targetDate).toISOString()

  const { data: existingTargetSnapshots, error: existingTargetSnapshotError } = await client
    .from('inventory_snapshot')
    .select('product_id')
    .eq('tenant_id', input.tenantId)
    .eq('snapshot_date', targetDate)

  if (existingTargetSnapshotError) {
    throw new AppError(
      '기존 당일 스냅샷을 조회하지 못했습니다.',
      500,
      existingTargetSnapshotError.code,
      existingTargetSnapshotError
    )
  }

  const { data: dayTransactions, error: transactionError } = await client
    .from('inventory_ledger')
    .select('id, product_id, qty_change, quantity, direction, movement_type, created_at')
    .eq('tenant_id', input.tenantId)
    .gte('created_at', dayStartIso)
    .lte('created_at', dayEndIso)
    .order('product_id', { ascending: true })
    .order('created_at', { ascending: true })

  if (transactionError) {
    throw new AppError('일일 마감용 트랜잭션을 조회하지 못했습니다.', 500, transactionError.code, transactionError)
  }

  const transactionRows = (dayTransactions || []) as InventoryTransactionRow[]
  const productIds = Array.from(
    new Set([
      ...transactionRows.map((row) => row.product_id).filter(Boolean),
      ...((existingTargetSnapshots || []) as Array<{ product_id: string | null }>)
        .map((row) => row.product_id)
        .filter((value): value is string => Boolean(value)),
    ])
  )
  const openingMap = await loadOpeningStockMap(client, input.tenantId, targetDate, productIds)

  const rowsByProduct = new Map<string, InventoryTransactionRow[]>()
  for (const row of transactionRows) {
    const current = rowsByProduct.get(row.product_id) || []
    current.push(row)
    rowsByProduct.set(row.product_id, current)
  }

  const snapshotRows: DailyClosingRow[] = productIds.map((productId) => {
    const openingStock = openingMap.get(productId) || 0
    const rows = rowsByProduct.get(productId) || []
    const totalIn = rows.reduce((sum, row) => {
      const delta = typeof row.qty_change === 'number'
        ? row.qty_change
        : ((row.direction || 'IN') === 'OUT' ? -Math.abs(Number(row.quantity || 0)) : Math.abs(Number(row.quantity || 0)))
      return delta > 0 ? sum + delta : sum
    }, 0)
    const totalOut = rows.reduce((sum, row) => {
      const delta = typeof row.qty_change === 'number'
        ? row.qty_change
        : ((row.direction || 'IN') === 'OUT' ? -Math.abs(Number(row.quantity || 0)) : Math.abs(Number(row.quantity || 0)))
      return delta < 0 ? sum + Math.abs(delta) : sum
    }, 0)
    const closingStock = openingStock + totalIn - totalOut

    return {
      productId,
      openingStock,
      totalIn,
      totalOut,
      closingStock,
    }
  })

  if (snapshotRows.length > 0) {
    const { error: targetSnapshotError } = await client
      .from('inventory_snapshot')
      .upsert(
        snapshotRows.map((row) => ({
          tenant_id: input.tenantId,
          snapshot_date: targetDate,
          product_id: row.productId,
          opening_stock: row.openingStock,
          total_in: row.totalIn,
          total_out: row.totalOut,
          closing_stock: row.closingStock,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'snapshot_date,tenant_id,product_id' }
      )

    if (targetSnapshotError) {
      throw new AppError('당일 스냅샷을 저장하지 못했습니다.', 500, targetSnapshotError.code, targetSnapshotError)
    }

    const { data: nextDayExistingRows, error: nextDaySelectError } = await client
      .from('inventory_snapshot')
      .select('product_id, opening_stock, total_in, total_out, closing_stock')
      .eq('tenant_id', input.tenantId)
      .eq('snapshot_date', nextDate)
      .in('product_id', productIds)

    if (nextDaySelectError) {
      throw new AppError('다음 날 스냅샷을 조회하지 못했습니다.', 500, nextDaySelectError.code, nextDaySelectError)
    }

    const nextDayMap = new Map<string, InventorySnapshotRow>()
    for (const row of ((nextDayExistingRows || []) as unknown as InventorySnapshotRow[])) {
      nextDayMap.set(row.product_id, row)
    }

    const nextDayUpserts = snapshotRows.map((row) => {
      const existing = nextDayMap.get(row.productId)
      const hasActivityAlready = Number(existing?.total_in || 0) !== 0 || Number(existing?.total_out || 0) !== 0

      return {
        tenant_id: input.tenantId,
        snapshot_date: nextDate,
        product_id: row.productId,
        opening_stock: row.closingStock,
        total_in: Number(existing?.total_in || 0),
        total_out: Number(existing?.total_out || 0),
        closing_stock: hasActivityAlready ? Number(existing?.closing_stock || row.closingStock) : row.closingStock,
        updated_at: new Date().toISOString(),
      }
    })

    const { error: nextDayUpsertError } = await client
      .from('inventory_snapshot')
      .upsert(nextDayUpserts, { onConflict: 'snapshot_date,tenant_id,product_id' })

    if (nextDayUpsertError) {
      throw new AppError('다음 날 기초 재고를 저장하지 못했습니다.', 500, nextDayUpsertError.code, nextDayUpsertError)
    }
  }

  logger.info('Completed daily inventory closing', {
    tenantId: input.tenantId,
    targetDate,
    nextDate,
    snapshotCount: snapshotRows.length,
  })

  return {
    date: targetDate,
    nextDate,
    snapshotCount: snapshotRows.length,
    rows: snapshotRows,
  }
}
