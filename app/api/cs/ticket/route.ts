import { NextResponse } from 'next/server';
import { callCreateTicket } from '@/lib/cs/functionsClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const summary = body?.summary;

    if (!summary) {
      return NextResponse.json({ error: 'summary 필드는 필수입니다.' }, { status: 400 });
    }

    const payload = {
      partnerId: body?.partnerId,
      conversationId: body?.conversationId,
      summary,
      description: body?.description,
      priority: body?.priority,
      assignee: body?.assignee,
      tags: Array.isArray(body?.tags) ? body.tags : undefined,
    };

    const data = await callCreateTicket(payload);
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('[api/cs/ticket] 오류', error);
    return NextResponse.json(
      {
        error: 'CS 티켓 생성 중 오류가 발생했습니다.',
        details: error?.message ?? error,
      },
      { status: 500 },
    );
  }
}
