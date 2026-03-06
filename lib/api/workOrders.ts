import { supabase } from '../supabase';
import { WorkOrder, MyTask } from '@/types';

export async function getWorkOrders() {
  const db = supabase as any;
  const { data, error } = await db
    .from('work_orders')
    .select('*')
    .order('due_date', { ascending: true });

  if (error) throw error;
  
  const rows = (data || []) as any[];
  return rows.map(item => ({
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    productName: item.product_name,
    quantity: item.quantity,
    unit: item.unit,
    location: item.location,
    assignee: item.assignee,
    status: item.status,
    dueDate: new Date(item.due_date || new Date().toISOString()),
    startedAt: item.started_at ? new Date(item.started_at) : undefined,
    completedAt: item.completed_at ? new Date(item.completed_at) : undefined,
    note: item.note,
    attachments: item.attachments,
    createdAt: new Date(item.created_at || new Date().toISOString()),
  })) as WorkOrder[];
}

export async function getMyTasks() {
  const db = supabase as any;
  const { data, error } = await db
    .from('my_tasks')
    .select('*')
    .order('due_date', { ascending: true });

  if (error) throw error;
  
  const rows = (data || []) as any[];
  return rows.map(item => ({
    id: item.id,
    workOrderId: item.work_order_id,
    type: item.type,
    title: item.title,
    description: item.description,
    productName: item.product_name,
    quantity: item.quantity,
    unit: item.unit,
    location: item.location,
    status: item.status,
    dueDate: new Date(item.due_date || new Date().toISOString()),
    priority: item.priority,
    barcode: item.barcode,
    qrCode: item.qr_code,
    note: item.note,
    attachments: item.attachments,
    createdAt: new Date(item.created_at || new Date().toISOString()),
  })) as MyTask[];
}

export async function updateTaskStatus(id: string, status: string, note?: string) {
  const db = supabase as any;
  const updates: Record<string, unknown> = {
    status,
    note,
  };

  if (status === 'in-progress' && !updates.started_at) {
    updates.started_at = new Date().toISOString();
  }

  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await db
    .from('my_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

