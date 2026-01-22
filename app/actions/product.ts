'use server';

import { createClient } from '@/utils/supabase/server';

export async function searchProducts(query: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('products') // products 테이블이 있다고 가정 (없으면 생성 필요)
    .select('id, name, sku, client_id')
    .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error('Error searching products:', error);
    return [];
  }

  return data;
}

export async function getProductsByClient(clientId: string) {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('client_id', clientId)
      .limit(50); // 너무 많으면 안되므로 제한
  
    if (error) {
      console.error('Error fetching client products:', error);
      return [];
    }
  
    return data;
}
