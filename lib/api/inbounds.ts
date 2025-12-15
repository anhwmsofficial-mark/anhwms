import { supabase } from '../supabase';
import { Inbound } from '@/types';

export async function getInbounds() {
  const { data, error } = await supabase
    .from('inbounds')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((item: any) => ({
    id: item.id,
    productName: item.product_name,
    supplierName: item.supplier_name,
    quantity: item.quantity,
    unit: item.unit,
    status: item.status,
    inboundDate: new Date(item.inbound_date),
    createdAt: new Date(item.created_at),
    // 호환성을 위한 기본값
    productId: item.product_id || '',
    supplierId: item.supplier_id || '',
    unitPrice: 0,
    totalPrice: 0,
  })) as Inbound[];
}

export async function createInbound(inbound: Partial<Inbound>) {
  const { data, error } = await supabase
    .from('inbounds')
    .insert({
      product_name: inbound.productName,
      supplier_name: inbound.supplierName,
      quantity: inbound.quantity,
      unit: inbound.unit,
      inbound_date: inbound.inboundDate ? new Date(inbound.inboundDate).toISOString() : new Date().toISOString(),
      status: inbound.status || 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateInbound(id: string, updates: Partial<Inbound>) {
  const dbUpdates: any = {};
  if (updates.productName) dbUpdates.product_name = updates.productName;
  if (updates.supplierName) dbUpdates.supplier_name = updates.supplierName;
  if (updates.quantity) dbUpdates.quantity = updates.quantity;
  if (updates.unit) dbUpdates.unit = updates.unit;
  if (updates.inboundDate) dbUpdates.inbound_date = new Date(updates.inboundDate).toISOString();
  if (updates.status) dbUpdates.status = updates.status;

  const { data, error } = await supabase
    .from('inbounds')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteInbound(id: string) {
  const { error } = await supabase
    .from('inbounds')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getRecentInbounds(limit: number = 5) {
  const { data, error } = await supabase
    .from('inbounds')
    .select('*')
    .order('inbound_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
