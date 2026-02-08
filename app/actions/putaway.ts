'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  assignLocationService,
  completePutawayService,
  getLocationsService,
  getPutawayTasksService,
} from '@/services/inventory/putawayService';
import { logger } from '@/lib/logger';

export async function getPutawayTasks(warehouseId?: string) {
  const supabase = await createClient();

  return getPutawayTasksService(supabase, warehouseId);
}

export async function getLocations(warehouseId: string, search?: string) {
  const supabase = await createClient();

  return getLocationsService(supabase, warehouseId, search);
}

export async function assignLocation(taskId: string, locationId: string) {
  const supabase = await createClient();
  try {
    await assignLocationService(supabase, taskId, locationId);
  } catch (error: any) {
    return { error: error?.message || '작업 위치 지정에 실패했습니다.' };
  }
  revalidatePath('/inbound/putaway');
  return { success: true };
}

export async function completePutaway(taskId: string, qty: number, locationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };
  try {
    await completePutawayService(supabase, taskId, qty, locationId, user.id);
    revalidatePath('/inbound/putaway');
    return { success: true };
  } catch (error: any) {
    logger.error(error, { scope: 'putaway', action: 'completePutaway' });
    return { error: error?.message || '작업 완료 처리 중 오류가 발생했습니다.' };
  }
}
