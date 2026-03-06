'use client';

import { useInboundNewForm } from '@/src/features/inbound/new/form/useInboundNewForm';
import InboundNewPageView from '@/src/features/inbound/new/ui/InboundNewPageView';

export default function NewInboundPlanPage() {
  const form = useInboundNewForm();

  return <InboundNewPageView {...form} onSubmit={form.handleSubmit} />;
}
