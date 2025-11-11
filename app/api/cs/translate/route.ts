import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_TRANSLATE_MODEL ?? 'gpt-4o-mini';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 환경 변수가 설정되어 있지 않습니다.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

interface TranslateRequest {
  sourceLang: 'ko' | 'zh';
  targetLang: 'ko' | 'zh';
  text: string;
  tone?: 'business' | 'friendly' | 'formal';
  formality?: 'formal' | 'neutral' | 'casual';
  userId?: string;
}

async function logTranslate(params: {
  userId?: string;
  sourceLang: 'ko' | 'zh';
  targetLang: 'ko' | 'zh';
  sourceText: string;
  translatedText: string;
  tone: string;
  formality: string;
}) {
  const { error } = await supabase.from('cs_translate_logs').insert({
    user_id: params.userId ?? null,
    source_lang: params.sourceLang,
    target_lang: params.targetLang,
    source_text: params.sourceText,
    translated_text: params.translatedText,
    tone: params.tone,
    formality: params.formality,
    chars_in: params.sourceText.length,
    chars_out: params.translatedText.length,
  });

  if (error) {
    console.error('[api/cs/translate] 번역 로그 저장 실패', error);
  }
}

export async function POST(request: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY 가 설정되어 있지 않습니다.' }, { status: 500 });
    }

    const body = (await request.json()) as TranslateRequest;

    if (!body?.text || !body.sourceLang || !body.targetLang) {
      return NextResponse.json({ error: 'sourceLang, targetLang, text 필드는 필수입니다.' }, { status: 400 });
    }

    const { sourceLang, targetLang, text } = body;
    const tone = body.tone ?? 'business';
    const formality = body.formality ?? 'neutral';

    const systemPrompt = `你是ANH WMS的中韩商务翻译助手。保持事实准确、语气专业，避免夸张。根据语气(${tone})与正式度(${formality})调整措辞。`;
    const userPrompt = `原文语言: ${sourceLang === 'ko' ? '韩语' : '中文'}\n目标语言: ${targetLang === 'ko' ? '韩语' : '中文'}\n语气: ${tone}\n正式度: ${formality}\n---\n${text}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI 응답 오류: ${errorBody}`);
    }

    const data = await response.json();
    const translatedText = data?.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error('번역 결과를 파싱할 수 없습니다.');
    }

    await logTranslate({
      userId: body.userId,
      sourceLang,
      targetLang,
      sourceText: text,
      translatedText,
      tone,
      formality,
    });

    return NextResponse.json({
      translatedText,
    });
  } catch (error: any) {
    console.error('[api/cs/translate] 오류', error);
    return NextResponse.json(
      {
        error: '번역 중 오류가 발생했습니다.',
        details: error?.message ?? error,
      },
      { status: 500 },
    );
  }
}
