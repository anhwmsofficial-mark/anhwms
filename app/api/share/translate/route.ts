import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_TRANSLATE_MODEL ?? 'gpt-4o-mini';

type Lang = 'ko' | 'zh' | 'en';

interface TranslateRequest {
  sourceLang: Lang;
  targetLang: Lang;
  text?: string;
  texts?: string[];
  tone?: 'business' | 'friendly' | 'formal';
}

function buildSystemPrompt(sourceLang: Lang, targetLang: Lang, tone: string) {
  const toneGuide = {
    business: '업무용 톤 (간결, 존중, 사실 중심)',
    friendly: '친근한 톤 (부드럽지만 전문적)',
    formal: '격식 있는 톤 (공식 문서 수준)',
  }[tone];

  return `You are a professional translator for ANH WMS.
Translate from ${sourceLang} to ${targetLang}.
Tone: ${toneGuide}
Rules:
- Keep numbers, dates, and codes unchanged
- Do not add explanations
- Return only valid JSON array of strings`;
}

export async function POST(request: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY 가 설정되어 있지 않습니다.' }, { status: 500 });
    }

    const body = (await request.json()) as TranslateRequest;
    const sourceLang = body.sourceLang;
    const targetLang = body.targetLang;
    const tone = body.tone ?? 'business';
    const inputTexts = body.texts ?? (body.text ? [body.text] : []);

    if (!sourceLang || !targetLang || inputTexts.length === 0) {
      return NextResponse.json({ error: 'sourceLang, targetLang, text(s) 필드가 필요합니다.' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(sourceLang, targetLang, tone);
    const userPrompt = `Translate the following array:\n${JSON.stringify(inputTexts)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI 응답 오류 (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('번역 결과를 파싱할 수 없습니다.');

    let translatedTexts: string[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        translatedTexts = parsed.map((item) => String(item));
      } else {
        translatedTexts = [String(parsed)];
      }
    } catch {
      translatedTexts = [content];
    }

    return NextResponse.json({ translatedTexts });
  } catch (error: any) {
    return NextResponse.json(
      { error: '번역 중 오류가 발생했습니다.', details: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}
