import { supabase } from '../supabase';
import { Partner } from '@/types';

export type CustomerOption = {
  id: string;
  name: string;
  code?: string;
};

export async function getPartners() {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return data.map(item => ({
    ...item,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  })) as Partner[];
}

export async function getPartner(id: string) {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  
  return {
    ...data,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  } as Partner;
}

export async function createPartner(partner: Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>) {
  const { data, error } = await supabase
    .from('partners')
    .insert({
      name: partner.name,
      type: partner.type,
      contact: partner.contact,
      phone: partner.phone,
      email: partner.email,
      address: partner.address,
      note: partner.note,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePartner(id: string, updates: Partial<Partner>) {
  const { data, error } = await supabase
    .from('partners')
    .update({
      name: updates.name,
      type: updates.type,
      contact: updates.contact,
      phone: updates.phone,
      email: updates.email,
      address: updates.address,
      note: updates.note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePartner(id: string) {
  const { error } = await supabase
    .from('partners')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getSuppliers() {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .in('type', ['supplier', 'both'])
    .order('name');

  if (error) throw error;
  
  return data.map(item => ({
    ...item,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  })) as Partner[];
}

export async function getCustomers(): Promise<CustomerOption[]> {
  const { data: customerMaster, error: customerError } = await supabase
    .from('customer_master')
    .select('id, name, code')
    .eq('status', 'ACTIVE')
    .order('name');

  if (!customerError && customerMaster && customerMaster.length > 0) {
    return customerMaster.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
    }));
  }

  if (customerError) {
    console.warn('customer_master lookup failed, falling back to partners', customerError);
  }

  const { data, error } = await supabase
    .from('partners')
    .select('id, name')
    .in('type', ['customer', 'both'])
    .order('name');

  if (error) throw error;

  return (data || []).map((item) => ({
    id: item.id,
    name: item.name,
  })) as CustomerOption[];
}

