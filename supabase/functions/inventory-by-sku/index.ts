import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabase, jsonResponse, errorResponse } from '../_shared/supabaseClient.ts';

interface InventoryRequest {
  sku: string;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405);
  }

  let payload: InventoryRequest;

  try {
    payload = await req.json();
  } catch (error) {
    return errorResponse('Invalid JSON payload', 400, error);
  }

  const sku = payload?.sku?.trim();

  if (!sku) {
    return errorResponse('sku 필드는 필수입니다.');
  }

  const { data, error } = await supabase
    .from('products')
    .select(`id, name, sku, category, quantity, unit, min_stock, price, location, description, created_at, updated_at`)
    .eq('sku', sku)
    .maybeSingle();

  if (error) {
    return errorResponse('SKU 조회에 실패했습니다.', 500, error);
  }

  if (!data) {
    return errorResponse(`해당 SKU(${sku}) 데이터를 찾을 수 없습니다.`, 404);
  }

  const response = {
    id: data.id,
    name: data.name,
    sku: data.sku,
    category: data.category,
    quantity: data.quantity,
    unit: data.unit,
    minStock: data.min_stock,
    price: data.price,
    location: data.location,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    isLowStock: data.quantity < data.min_stock,
  };

  return jsonResponse(response);
});
