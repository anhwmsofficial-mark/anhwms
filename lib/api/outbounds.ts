import { supabase } from '../supabase';
import { Outbound } from '@/types';

export async function getOutbounds() {
  const { data, error } = await supabase
    .from('outbounds')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((item: any) => ({
    id: item.id,
    productName: item.product_name,
    customerName: item.customer_name,
    quantity: item.quantity,
    unit: item.unit,
    status: item.status,
    outboundDate: new Date(item.outbound_date),
    createdAt: new Date(item.created_at),
    // 호환성을 위한 기본값
    productId: item.product_id || '',
    customerId: item.customer_id || '',
    unitPrice: 0,
    totalPrice: 0,
  })) as Outbound[];
}

export async function createOutbound(outbound: Partial<Outbound>) {
  const { data, error } = await supabase
    .from('outbounds')
    .insert({
      product_name: outbound.productName,
      customer_name: outbound.customerName,
      quantity: outbound.quantity,
      unit: outbound.unit,
      outbound_date: outbound.outboundDate ? new Date(outbound.outboundDate).toISOString() : new Date().toISOString(),
      status: outbound.status || 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOutbound(id: string, updates: Partial<Outbound>) {
  const dbUpdates: any = {};
  if (updates.productName) dbUpdates.product_name = updates.productName;
  if (updates.customerName) dbUpdates.customer_name = updates.customerName;
  if (updates.quantity) dbUpdates.quantity = updates.quantity;
  if (updates.unit) dbUpdates.unit = updates.unit;
  if (updates.outboundDate) dbUpdates.outbound_date = new Date(updates.outboundDate).toISOString();
  if (updates.status) dbUpdates.status = updates.status;

  const { data, error } = await supabase
    .from('outbounds')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOutbound(id: string) {
  const { error } = await supabase
    .from('outbounds')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getRecentOutbounds(limit: number = 5) {
  const { data, error } = await supabase
    .from('outbounds')
    .select('*')
    .order('outbound_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
