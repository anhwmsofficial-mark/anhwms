'use server';

import { revalidatePath } from 'next/cache';
import { ensureAdminUserAccess, ensurePermission } from '@/lib/actions/auth';
import { failFromError, type ActionResult } from '@/lib/actions/result';
import {
  INVENTORY_MOVEMENT_DEFINITIONS,
  INVENTORY_MOVEMENT_LABEL_MAP,
  type InventoryMovementType,
} from '@/lib/inventory-definitions';
import { supabaseAdmin } from '@/lib/supabase-admin';

type ExportColumnSource =
  | 'MANAGE_NAME'
  | 'OPENING_STOCK'
  | 'TOTAL_SUM'
  | 'CLOSING_STOCK'
  | 'NOTE'
  | 'TRANSACTION_TYPE';

type TemplateColumnRow = {
  id: string;
  template_id: string;
  source: ExportColumnSource;
  transaction_type: string | null;
  header_name: string | null;
  sort_order: number;
  width: number | null;
  number_format: string | null;
  is_visible: boolean | null;
};

type TemplateRow = {
  id: string;
  tenant_id: string;
  vendor_id: string | null;
  code: string;
  name: string;
  description: string | null;
  sheet_name: string | null;
  is_active: boolean | null;
};

type CustomerRow = {
  id: string;
  name: string | null;
};

export type ExportTemplateEditorColumn = {
  key: string;
  source: ExportColumnSource;
  transactionType: string | null;
  label: string;
  displayName: string;
  enabled: boolean;
  fixed: boolean;
  sortOrder: number;
  width: number | null;
  numberFormat: string | null;
};

export type ExportTemplateEditor = {
  id: string;
  code: string;
  name: string;
  description: string;
  sheetName: string;
  vendorId: string | null;
  isActive: boolean;
  columns: ExportTemplateEditorColumn[];
};

export type ExportTemplateBootstrapData = {
  templates: ExportTemplateEditor[];
  customers: Array<{ id: string; name: string }>;
};

export type SaveExportTemplateInput = {
  id?: string | null;
  code?: string;
  name?: string;
  description?: string | null;
  sheetName?: string | null;
  vendorId?: string | null;
  isActive?: boolean;
  columns?: ExportTemplateEditorColumn[];
};

const db = supabaseAdmin as any;

const FIXED_COLUMN_DEFINITIONS: Array<{
  key: string;
  source: ExportColumnSource;
  label: string;
  displayName: string;
  sortOrder: number;
}> = [
  { key: 'MANAGE_NAME', source: 'MANAGE_NAME', label: '관리명', displayName: '관리명', sortOrder: 10 },
  { key: 'OPENING_STOCK', source: 'OPENING_STOCK', label: '전일재고', displayName: '전일재고', sortOrder: 20 },
  { key: 'TOTAL_SUM', source: 'TOTAL_SUM', label: '총합계', displayName: '총합계', sortOrder: 970 },
  { key: 'CLOSING_STOCK', source: 'CLOSING_STOCK', label: '마감재고', displayName: '마감재고', sortOrder: 980 },
  { key: 'NOTE', source: 'NOTE', label: '비고', displayName: '비고', sortOrder: 990 },
];

function getMovementDefaultSortOrder(type: string) {
  const index = INVENTORY_MOVEMENT_DEFINITIONS.findIndex((item) => item.type === type);
  return index >= 0 ? 30 + index * 10 : 900;
}

function buildDefaultColumns(): ExportTemplateEditorColumn[] {
  const fixed = FIXED_COLUMN_DEFINITIONS.map((item) => ({
    key: item.key,
    source: item.source,
    transactionType: null,
    label: item.label,
    displayName: item.displayName,
    enabled: true,
    fixed: true,
    sortOrder: item.sortOrder,
    width: item.source === 'MANAGE_NAME' ? 28 : item.source === 'NOTE' ? 30 : 14,
    numberFormat: item.source === 'MANAGE_NAME' || item.source === 'NOTE' ? null : '#,##0',
  }));

  const movements = INVENTORY_MOVEMENT_DEFINITIONS.map((item) => ({
    key: `TRANSACTION_TYPE:${item.type}`,
    source: 'TRANSACTION_TYPE' as const,
    transactionType: item.type,
    label: item.label,
    displayName: item.label,
    enabled: false,
    fixed: false,
    sortOrder: getMovementDefaultSortOrder(item.type),
    width: 14,
    numberFormat: '#,##0',
  }));

  return [...fixed, ...movements];
}

function mergeTemplateColumns(rows: TemplateColumnRow[]): ExportTemplateEditorColumn[] {
  const defaults = buildDefaultColumns();
  const rowMap = new Map<string, TemplateColumnRow>();

  for (const row of rows) {
    const key = row.source === 'TRANSACTION_TYPE' ? `TRANSACTION_TYPE:${row.transaction_type || ''}` : row.source;
    rowMap.set(key, row);
  }

  return defaults.map((column) => {
    const current = rowMap.get(column.key);
    if (!current) return column;

    return {
      ...column,
      displayName: String(current.header_name || column.displayName),
      enabled: column.fixed ? true : Boolean(current.is_visible),
      sortOrder: Number(current.sort_order || column.sortOrder),
      width: current.width ?? column.width,
      numberFormat: current.number_format ?? column.numberFormat,
    };
  });
}

function normalizeTemplatePayload(input: SaveExportTemplateInput) {
  const code = String(input.code || '').trim();
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  const sheetName = String(input.sheetName || '').trim() || '재고현황';
  const vendorId = input.vendorId ? String(input.vendorId).trim() : null;
  const incomingColumns = Array.isArray(input.columns) ? input.columns : [];

  if (!code) {
    return { error: '템플릿 코드는 필수입니다.' as const };
  }
  if (!name) {
    return { error: '템플릿명은 필수입니다.' as const };
  }

  const defaults = buildDefaultColumns();
  const incomingMap = new Map(incomingColumns.map((column) => [column.key, column]));

  const normalizedColumns = defaults.map((defaultColumn) => {
    const incoming = incomingMap.get(defaultColumn.key);
    const displayName = String(incoming?.displayName || defaultColumn.displayName).trim() || defaultColumn.displayName;
    const sortOrder = Number(incoming?.sortOrder ?? defaultColumn.sortOrder);
    const width = incoming?.width == null || Number.isNaN(Number(incoming.width)) ? defaultColumn.width : Number(incoming.width);
    const numberFormat = incoming?.numberFormat ?? defaultColumn.numberFormat;

    return {
      ...defaultColumn,
      displayName,
      enabled: defaultColumn.fixed ? true : Boolean(incoming?.enabled),
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : defaultColumn.sortOrder,
      width,
      numberFormat: numberFormat || null,
    };
  });

  const selectedTransactionCount = normalizedColumns.filter(
    (column) => column.source === 'TRANSACTION_TYPE' && column.enabled
  ).length;

  if (selectedTransactionCount === 0) {
    return { error: '최소 1개 이상의 트랜잭션 컬럼을 선택해주세요.' as const };
  }

  return {
    code,
    name,
    description,
    sheetName,
    vendorId,
    isActive: input.isActive !== false,
    columns: normalizedColumns,
  };
}

async function loadTemplatesForOrg(orgId: string): Promise<ExportTemplateBootstrapData> {
  const { data: templatesData, error: templatesError } = await db
    .from('export_templates')
    .select('id, tenant_id, vendor_id, code, name, description, sheet_name, is_active')
    .eq('tenant_id', orgId)
    .order('created_at', { ascending: true });

  if (templatesError) {
    throw new Error(templatesError.message);
  }

  const templates = (templatesData || []) as TemplateRow[];
  const templateIds = templates.map((template) => template.id);

  let columnsByTemplate = new Map<string, TemplateColumnRow[]>();
  if (templateIds.length > 0) {
    const { data: columnRows, error: columnsError } = await db
      .from('export_template_columns')
      .select('id, template_id, source, transaction_type, header_name, sort_order, width, number_format, is_visible')
      .in('template_id', templateIds)
      .order('sort_order', { ascending: true });

    if (columnsError) {
      throw new Error(columnsError.message);
    }

    columnsByTemplate = new Map<string, TemplateColumnRow[]>();
    for (const row of (columnRows || []) as TemplateColumnRow[]) {
      const current = columnsByTemplate.get(row.template_id) || [];
      current.push(row);
      columnsByTemplate.set(row.template_id, current);
    }
  }

  const { data: customersData, error: customersError } = await db
    .from('customer_master')
    .select('id, name')
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  if (customersError) {
    throw new Error(customersError.message);
  }

  return {
    templates: templates.map((template) => ({
      id: template.id,
      code: template.code,
      name: template.name,
      description: template.description || '',
      sheetName: template.sheet_name || '재고현황',
      vendorId: template.vendor_id || null,
      isActive: template.is_active !== false,
      columns: mergeTemplateColumns(columnsByTemplate.get(template.id) || []),
    })),
    customers: ((customersData || []) as CustomerRow[]).map((customer) => ({
      id: customer.id,
      name: String(customer.name || customer.id),
    })),
  };
}

export async function listExportTemplatesAction(): Promise<ActionResult<ExportTemplateBootstrapData>> {
  try {
    const permission = await ensurePermission('manage:orders');
    if (!permission.ok) return permission as any;

    const access = await ensureAdminUserAccess();
    if (!access.ok) return access as any;

    const orgId = access.data.profile.org_id;
    if (!orgId) {
      return { ok: false, status: 403, error: '조직 정보가 없는 계정입니다.' };
    }

    return {
      ok: true,
      data: await loadTemplatesForOrg(orgId),
    };
  } catch (error: unknown) {
    return failFromError(error, '엑셀 템플릿 목록을 불러오지 못했습니다.');
  }
}

export async function saveExportTemplateAction(
  input: SaveExportTemplateInput
): Promise<ActionResult<{ template: ExportTemplateEditor; templates: ExportTemplateEditor[] }>> {
  try {
    const permission = await ensurePermission('manage:orders');
    if (!permission.ok) return permission as any;

    const access = await ensureAdminUserAccess();
    if (!access.ok) return access as any;

    const orgId = access.data.profile.org_id;
    const userId = access.data.user.id;
    if (!orgId) {
      return { ok: false, status: 403, error: '조직 정보가 없는 계정입니다.' };
    }

    const normalized = normalizeTemplatePayload(input);
    if ('error' in normalized) {
      return { ok: false, status: 400, error: normalized.error };
    }

    if (normalized.vendorId) {
      const { data: customer, error: customerError } = await db
        .from('customer_master')
        .select('id, org_id')
        .eq('id', normalized.vendorId)
        .maybeSingle();

      if (customerError) {
        return { ok: false, status: 500, error: customerError.message };
      }
      if (!customer || customer.org_id !== orgId) {
        return { ok: false, status: 400, error: '현재 조직의 업체만 선택할 수 있습니다.' };
      }
    }

    let templateId = String(input.id || '').trim();
    if (templateId) {
      const { data: existing, error: existingError } = await db
        .from('export_templates')
        .select('id, tenant_id')
        .eq('id', templateId)
        .maybeSingle();

      if (existingError) {
        return { ok: false, status: 500, error: existingError.message };
      }
      if (!existing || existing.tenant_id !== orgId) {
        return { ok: false, status: 404, error: '수정할 템플릿을 찾을 수 없습니다.' };
      }

      const { error: updateError } = await db
        .from('export_templates')
        .update({
          code: normalized.code,
          name: normalized.name,
          description: normalized.description || null,
          sheet_name: normalized.sheetName,
          vendor_id: normalized.vendorId,
          is_active: normalized.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId);

      if (updateError) {
        const isConflict = /duplicate key value/i.test(updateError.message);
        return {
          ok: false,
          status: isConflict ? 409 : 500,
          error: isConflict ? '템플릿 코드가 중복되었습니다.' : updateError.message,
        };
      }
    } else {
      const { data: created, error: createError } = await db
        .from('export_templates')
        .insert({
          tenant_id: orgId,
          vendor_id: normalized.vendorId,
          code: normalized.code,
          name: normalized.name,
          description: normalized.description || null,
          sheet_name: normalized.sheetName,
          is_active: normalized.isActive,
          created_by: userId,
        })
        .select('id')
        .single();

      if (createError || !created?.id) {
        const isConflict = createError?.message && /duplicate key value/i.test(createError.message);
        return {
          ok: false,
          status: isConflict ? 409 : 500,
          error: isConflict ? '템플릿 코드가 중복되었습니다.' : createError?.message || '템플릿 생성에 실패했습니다.',
        };
      }

      templateId = String(created.id);
    }

    const { error: deleteColumnsError } = await db
      .from('export_template_columns')
      .delete()
      .eq('template_id', templateId);

    if (deleteColumnsError) {
      return { ok: false, status: 500, error: deleteColumnsError.message };
    }

    const selectedColumns = normalized.columns
      .filter((column) => column.enabled || column.fixed)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((column) => ({
        template_id: templateId,
        sort_order: column.sortOrder,
        source: column.source,
        transaction_type: column.transactionType,
        header_name: column.displayName,
        width: column.width,
        number_format: column.numberFormat,
        is_visible: true,
      }));

    const { error: insertColumnsError } = await db.from('export_template_columns').insert(selectedColumns);
    if (insertColumnsError) {
      return { ok: false, status: 500, error: insertColumnsError.message };
    }

    const bootstrap = await loadTemplatesForOrg(orgId);
    const savedTemplate =
      bootstrap.templates.find((template) => template.id === templateId) ||
      ({
        id: templateId,
        code: normalized.code,
        name: normalized.name,
        description: normalized.description,
        sheetName: normalized.sheetName,
        vendorId: normalized.vendorId,
        isActive: normalized.isActive,
        columns: normalized.columns,
      } satisfies ExportTemplateEditor);

    revalidatePath('/admin/inventory/export-templates');

    return {
      ok: true,
      data: {
        template: savedTemplate,
        templates: bootstrap.templates,
      },
    };
  } catch (error: unknown) {
    return failFromError(error, '엑셀 템플릿 저장에 실패했습니다.');
  }
}

export const EXPORT_TEMPLATE_DEFAULTS = {
  fixedColumns: FIXED_COLUMN_DEFINITIONS,
  movementColumns: INVENTORY_MOVEMENT_DEFINITIONS.map((item) => ({
    type: item.type as InventoryMovementType,
    label: INVENTORY_MOVEMENT_LABEL_MAP[item.type as InventoryMovementType],
  })),
};
