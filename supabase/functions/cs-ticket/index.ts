import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabase, jsonResponse, errorResponse } from '../_shared/supabaseClient.ts';

interface TicketRequest {
  partnerId?: string;
  conversationId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  summary: string;
  description?: string;
  assignee?: string;
  tags?: string[];
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405);
  }

  let payload: TicketRequest;

  try {
    payload = await req.json();
  } catch (error) {
    return errorResponse('Invalid JSON payload', 400, error);
  }

  const summary = payload?.summary?.trim();

  if (!summary) {
    return errorResponse('summary 필드는 필수입니다.');
  }

  const insertPayload = {
    partner_id: payload.partnerId ?? null,
    conversation_id: payload.conversationId ?? null,
    priority: payload.priority ?? 'normal',
    summary,
    description: payload.description ?? null,
    assignee: payload.assignee ?? null,
    status: 'open',
    tags: payload.tags ?? [],
  };

  const { data, error } = await supabase
    .from('cs_tickets')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    return errorResponse('CS 티켓 생성에 실패했습니다.', 500, error);
  }

  return jsonResponse({
    ticket: {
      id: data.id,
      partnerId: data.partner_id,
      conversationId: data.conversation_id,
      priority: data.priority,
      summary: data.summary,
      description: data.description,
      assignee: data.assignee,
      status: data.status,
      tags: data.tags,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  }, 201);
});
