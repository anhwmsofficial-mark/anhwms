'use server';

import { getDashboardStats } from '@/lib/api/dashboard';
import { getInboundDashboardStats } from '@/lib/api/inbound-dashboard';

export async function getDashboardStatsAction() {
  return getDashboardStats();
}

export async function getInboundDashboardStatsAction() {
  return getInboundDashboardStats();
}
