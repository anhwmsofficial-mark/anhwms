'use server';

import { getDashboardStats } from '@/lib/api/dashboard';

export async function getDashboardStatsAction() {
  return getDashboardStats();
}
