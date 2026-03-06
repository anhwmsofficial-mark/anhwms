import { createInboundPlan } from '@/app/actions/inbound';

export async function createInbound(formData: FormData) {
  return createInboundPlan(formData);
}
