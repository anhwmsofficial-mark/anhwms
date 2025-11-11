import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  CSConversation,
  CSIntent,
  CSMessage,
  CSResponse,
  PartnerExtended,
} from '@/types';
import {
  callShipmentStatus,
  callOutboundStatus,
  callInboundStatus,
  callInventoryBySku,
  callDocument,
  callCreateTicket,
} from '@/lib/cs/functionsClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CS_MODEL = process.env.OPENAI_CS_MODEL ?? 'gpt-4o-mini';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 환경 변수가 설정되어 있지 않습니다.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

interface IncomingMessage {
  conversationId?: string;
  partnerId?: string;
  channel: 'wechat' | 'email' | 'chat' | 'phone';
  lang: 'zh' | 'ko';
  message: string;
  metadata?: Record<string, any>;
}

interface PartnerRow {
  id: string;
  name: string;
  type: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  note?: string;
  code?: string;
  locale?: string;
  timezone?: string;
  created_at: string;
  updated_at?: string;
}

interface ConversationRow {
  id: string;
  partner_id?: string;
  channel: string;
  lang_in: string;
  subject?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function mapPartner(row: PartnerRow | null): PartnerExtended | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type as PartnerExtended['type'],
    contact: row.contact,
    phone: row.phone,
    email: row.email,
    address: row.address,
    note: row.note ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(row.created_at),
    code: row.code,
    locale: row.locale,
    timezone: row.timezone,
  };
}

function mapConversation(row: ConversationRow): CSConversation {
  return {
    id: row.id,
    partnerId: row.partner_id ?? undefined,
    channel: row.channel as CSConversation['channel'],
    langIn: row.lang_in as CSConversation['langIn'],
    subject: row.subject ?? undefined,
    status: row.status as CSConversation['status'],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function detectIntent(message: string): CSIntent {
  const normalized = message.toLowerCase();

  if (/(运单|tracking|货|물류|배송|배송조회|运输|物流)/.test(normalized)) return 'shipping_query';
  if (/(出库|출고|发货|发出)/.test(normalized)) return 'outbound_check';
  if (/(入库|입고|入仓)/.test(normalized)) return 'inbound_check';
  if (/(库存|재고|sku|stock)/.test(normalized)) return 'inventory';
  if (/(发票|invoice|装箱单|패킹|서류)/.test(normalized)) return 'document';
  if (/(通关|통관|海关)/.test(normalized)) return 'customs';
  if (/(报价|견적|费用|费率)/.test(normalized)) return 'quote';
  if (/(账单|청구|结算)/.test(normalized)) return 'billing';

  return 'other';
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function extractOrderNo(text: string): string | null {
  const match = text.match(/([A-Z]{1,2}\d{3,}|[A-Z0-9-]{6,})/i);
  return match ? match[1].toUpperCase() : null;
}

function extractTrackingNo(text: string): string | null {
  const match = text.match(/(\d{10,}|[A-Z]{2}\d{9}CN)/i);
  return match ? match[1].toUpperCase() : null;
}

function extractSku(text: string): string | null {
  const match = text.match(/sku[:\s-]*([A-Z0-9-]{3,})/i);
  return match ? match[1].toUpperCase() : null;
}

async function ensurePartner(partnerId?: string): Promise<PartnerExtended | null> {
  if (!partnerId) return null;

  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('id', partnerId)
    .maybeSingle();

  if (error) {
    console.error('[CS API] 파트너 조회 실패:', error);
    return null;
  }

  return mapPartner(data ?? null);
}

async function upsertConversation(payload: IncomingMessage): Promise<CSConversation | null> {
  if (payload.conversationId) {
    const { data, error } = await supabase
      .from('cs_conversations')
      .select('*')
      .eq('id', payload.conversationId)
      .maybeSingle();

    if (error) {
      console.error('[CS API] 대화 조회 실패:', error);
      return null;
    }

    if (data) {
      const { error: updateError } = await supabase
        .from('cs_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', data.id);

      if (updateError) {
        console.error('[CS API] 대화 업데이트 실패:', updateError);
      }

      return mapConversation({
        ...data,
        updated_at: new Date().toISOString(),
      });
    }
  }

  const { data, error } = await supabase
    .from('cs_conversations')
    .insert({
      partner_id: payload.partnerId ?? null,
      channel: payload.channel,
      lang_in: payload.lang,
      subject: payload.metadata?.subject ?? null,
      status: 'open',
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error('[CS API] 대화 생성 실패:', error);
    return null;
  }

  return mapConversation(data);
}

async function logMessage(message: Partial<CSMessage>) {
  const { error } = await supabase.from('cs_messages').insert({
    convo_id: message.convoId,
    role: message.role,
    lang: message.lang,
    content: message.content,
    intent: message.intent,
    slots: message.slots ?? {},
    tool_name: message.toolName ?? null,
    tool_payload: message.toolPayload ?? null,
    tool_result: message.toolResult ?? null,
  });

  if (error) {
    console.error('[CS API] 메시지 기록 실패:', error);
  }
}

function fallbackResponse(intent: CSIntent): string {
  switch (intent) {
    case 'shipping_query':
      return '为便于查询，请提供订单号或运单号。';
    case 'outbound_check':
      return '请提供出库单号或产品名称，以便我们核实。';
    case 'inbound_check':
      return '请提供入库单号或产品信息，以便我们查询。';
    case 'inventory':
      return '请提供 SKU，以便我们返回库存情况。';
    case 'document':
      return '请提供订单号以及所需文件类型。';
    default:
      return '您好，我们已收到您的消息，将尽快回复。';
  }
}

async function refineWithLLM(params: {
  intent: CSIntent;
  slots: Record<string, any>;
  baseResponse: string;
  toolCalls: CSResponse['toolCalls'];
  partner?: PartnerExtended | null;
}) {
  if (!OPENAI_API_KEY) return params.baseResponse;

  try {
    const systemPrompt = '你是 ANH WMS 的中韩双语客服。请用简洁专业的中文回复，重点说明事实、时间、数量、位置，避免夸张，未确认的信息不要编造。';
    const toolSummary = JSON.stringify(
      (params.toolCalls ?? []).map((call) => ({
        name: call.name,
        payload: call.payload,
        result: call.result,
      })),
    );

    const userPrompt = `意图: ${params.intent}\n槽位: ${JSON.stringify(params.slots)}\n合作伙伴: ${params.partner?.name ?? '未知'}\n工具数据: ${toolSummary}\n初始回复: ${params.baseResponse}\n请基于事实重新整理成一段中文答复，保留关键时间、数量、下一步动作。`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_CS_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI 응답 오류: ${await response.text()}`);
    }

    const data = await response.json();
    const refined = data?.choices?.[0]?.message?.content?.trim();
    return refined || params.baseResponse;
  } catch (error) {
    console.error('[CS API] LLM 정제 실패:', error);
    return params.baseResponse;
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as IncomingMessage;

    if (!payload?.message || !payload.channel || !payload.lang) {
      return NextResponse.json(
        { error: 'message, channel, lang 필드는 필수입니다.' },
        { status: 400 }
      );
    }

    const partner = await ensurePartner(payload.partnerId);
    const conversation = await upsertConversation(payload);

    if (!conversation) {
      return NextResponse.json(
        { error: '대화 생성/조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    const intent = detectIntent(payload.message);

    await logMessage({
      convoId: conversation.id,
      role: 'partner',
      lang: payload.lang,
      content: payload.message,
      intent,
      toolPayload: payload.metadata ?? null,
    });

    const toolCalls: CSResponse['toolCalls'] = [];
    const slots: Record<string, any> = {};
    let autoResponse = fallbackResponse(intent);

    try {
      switch (intent) {
        case 'shipping_query': {
          const orderNo = payload.metadata?.orderNo ?? extractOrderNo(payload.message);
          const trackingNo = payload.metadata?.trackingNo ?? extractTrackingNo(payload.message);
          slots.orderNo = orderNo ?? null;
          slots.trackingNo = trackingNo ?? null;

          if (!orderNo && !trackingNo) {
            autoResponse = fallbackResponse(intent);
            break;
          }

          const toolPayload = { orderNo, trackingNo, limit: 5 };
          const result = await callShipmentStatus(toolPayload) as any;
          toolCalls.push({ name: 'shipment-status', payload: toolPayload, result });

          if (result?.items?.length) {
            const latest = result.items[0];
            const latestLog = latest.logs?.[0];
            const eta = latestLog?.createdAt ? formatDateTime(latestLog.createdAt) : null;
            autoResponse = `运单状态：「${latest.status ?? '处理中'}」。物流公司：${latest.logisticsCompany ?? '未登记'}。${eta ? `最新时间：${eta}。` : ''}${latest.trackingNo ? `运单号：${latest.trackingNo}。` : ''}若有变化我们会第一时间通知您。`;
          } else {
            autoResponse = '当前未查询到该订单/运单记录，请确认编号是否正确。';
          }
          break;
        }
        case 'outbound_check': {
          const orderNo = payload.metadata?.orderNo ?? extractOrderNo(payload.message);
          const productName = payload.metadata?.productName;
          const toolPayload = { orderNo, productName, limit: 10 };
          const result = await callOutboundStatus(toolPayload) as any;
          toolCalls.push({ name: 'outbound-status', payload: toolPayload, result });

          if (result?.items?.length) {
            const latest = result.items[0];
            const when = formatDateTime(latest.outboundDate);
            autoResponse = `出库单状态：「${latest.status ?? '处理中'}」。产品：${latest.productName}，数量：${latest.quantity}${latest.unit}。${when ? `时间：${when}。` : ''}如需其他明细请告知。`;
          } else {
            autoResponse = '未找到对应的出库记录，请确认单号或产品信息。';
          }
          break;
        }
        case 'inbound_check': {
          const asnNo = payload.metadata?.asnNo ?? extractOrderNo(payload.message);
          const toolPayload = { asnNo, limit: 10 };
          const result = await callInboundStatus(toolPayload) as any;
          toolCalls.push({ name: 'inbound-status', payload: toolPayload, result });

          if (result?.items?.length) {
            const latest = result.items[0];
            const when = formatDateTime(latest.inboundDate);
            autoResponse = `入库单状态：「${latest.status ?? '处理中'}」。产品：${latest.productName}，数量：${latest.quantity}${latest.unit}。${when ? `时间：${when}。` : ''}如需更多详情请告知。`;
          } else {
            autoResponse = '未找到对应的入库记录，请确认 ASN 或产品信息。';
          }
          break;
        }
        case 'inventory': {
          const sku = payload.metadata?.sku ?? extractSku(payload.message);
          slots.sku = sku ?? null;

          if (!sku) {
            autoResponse = fallbackResponse(intent);
            break;
          }

          const toolPayload = { sku };
          const result = await callInventoryBySku(toolPayload) as any;
          toolCalls.push({ name: 'inventory-by-sku', payload: toolPayload, result });

          autoResponse = `SKU ${result.sku} 当前可用库存：${result.quantity}${result.unit}，最低安全库存：${result.minStock}${result.unit}。${result.location ? `位置：${result.location}。` : ''}${result.isLowStock ? '（⚠ 库存低于阈值）' : ''}`;
          break;
        }
        case 'document': {
          const orderNo = payload.metadata?.orderNo ?? extractOrderNo(payload.message);
          const documentType = payload.metadata?.documentType;
          slots.orderNo = orderNo ?? null;
          slots.documentType = documentType ?? null;

          if (!orderNo) {
            autoResponse = fallbackResponse(intent);
            break;
          }

          const toolPayload = { orderNo, documentType };
          const result = await callDocument(toolPayload) as any;
          toolCalls.push({ name: 'document', payload: toolPayload, result });

          autoResponse = `已生成文件链接：${result.url}。${result.expiresAt ? `有效期至 ${formatDateTime(result.expiresAt)}。` : ''}`;
          break;
        }
        case 'customs': {
          const summary = '通关状态查询';
          const result = await callCreateTicket({
            conversationId: conversation.id,
            partnerId: payload.partnerId,
            summary,
            description: payload.message,
            priority: 'high',
            tags: ['customs'],
          }) as any;
          toolCalls.push({ name: 'cs-ticket', payload: { summary }, result });
          autoResponse = '通关协调中，我们已创建处理工单，后续进度将第一时间同步。';
          break;
        }
        case 'quote':
        case 'billing':
        case 'other':
        default:
          autoResponse = fallbackResponse(intent);
      }

      autoResponse = await refineWithLLM({
        intent,
        slots,
        baseResponse: autoResponse,
        toolCalls,
        partner,
      });
    } catch (toolError: any) {
      console.error('[CS API] 툴 호출 실패:', toolError);
      autoResponse = '内部查询暂时失败，我们正在重新获取数据，请稍候。';
      toolCalls.push({
        name: 'error',
        payload: {},
        result: { message: toolError?.message ?? toolError },
      });
    }

    await logMessage({
      convoId: conversation.id,
      role: 'ai',
      lang: 'zh',
      content: autoResponse,
      intent,
      slots,
      toolName: toolCalls[0]?.name,
      toolPayload: toolCalls[0]?.payload,
      toolResult: toolCalls[0]?.result,
    });

    const response: CSResponse = {
      intent,
      response: autoResponse,
      slots,
      toolCalls,
    };

    return NextResponse.json({
      conversationId: conversation.id,
      partner,
      intent,
      response,
    });
  } catch (error) {
    console.error('[CS API] 처리 중 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
