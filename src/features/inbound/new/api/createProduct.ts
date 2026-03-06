import type { ProductSearchItem } from '@/app/actions/product';
import { createProductAction } from '@/app/actions/admin/products';
import type { ExcelInboundRow } from '@/src/features/inbound/new/form/schema';

export async function createProductFromExcelItem(
  item: ExcelInboundRow,
  customerId: string,
): Promise<ProductSearchItem> {
  const result = await createProductAction({
    customer_id: customerId,
    name: item.product_name || item.product_sku,
    sku: item.product_sku,
    barcode: item.product_barcode || null,
    category: item.product_category || '기타',
    quantity: 0,
    unit: '개',
    min_stock: 0,
    price: 0,
    location: '',
    description: '엑셀 업로드로 자동 생성',
  });
  if (!result.ok) {
    throw new Error(result.error || '제품 생성 실패');
  }
  return result.data as ProductSearchItem;
}
