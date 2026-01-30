import { supabase } from '../supabase';
import { Product } from '@/types';

export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return data.map(item => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    barcode: item.barcode ?? undefined,
    category: item.category,
    quantity: item.quantity ?? 0,
    unit: item.unit ?? '개',
    minStock: item.min_stock ?? 0,
    price: item.price ?? 0,
    location: item.location ?? '',
    description: item.description ?? '',
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  })) as Product[];
}

export async function getProduct(id: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    name: data.name,
    sku: data.sku,
    barcode: data.barcode ?? undefined,
    category: data.category,
    quantity: data.quantity ?? 0,
    unit: data.unit ?? '개',
    minStock: data.min_stock ?? 0,
    price: data.price ?? 0,
    location: data.location ?? '',
    description: data.description ?? '',
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  } as Product;
}

export async function createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) {
  const res = await fetch('/api/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || null,
      category: product.category,
      quantity: product.quantity,
      unit: product.unit,
      min_stock: product.minStock,
      price: product.price,
      location: product.location,
      description: product.description,
    }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error || '제품 추가에 실패했습니다.');
  return payload.data;
}

export async function updateProduct(id: string, updates: Partial<Product>) {
  const res = await fetch('/api/admin/products', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      updates: {
        name: updates.name,
        sku: updates.sku,
        barcode: updates.barcode ?? null,
        category: updates.category,
        quantity: updates.quantity,
        unit: updates.unit,
        min_stock: updates.minStock,
        price: updates.price,
        location: updates.location,
        description: updates.description,
      },
    }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error || '제품 수정에 실패했습니다.');
  return payload.data;
}

export async function deleteProduct(id: string) {
  const res = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error || '제품 삭제에 실패했습니다.');
}

export async function getLowStockProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .filter('quantity', 'lt', supabase.rpc('min_stock'));

  if (error) {
    // Fallback: get all products and filter in JS
    const allProducts = await getProducts();
    return allProducts.filter(p => p.quantity < p.minStock);
  }

  return data.map(item => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    barcode: item.barcode ?? undefined,
    category: item.category,
    quantity: item.quantity ?? 0,
    unit: item.unit ?? '개',
    minStock: item.min_stock ?? 0,
    price: item.price ?? 0,
    location: item.location ?? '',
    description: item.description ?? '',
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  })) as Product[];
}

