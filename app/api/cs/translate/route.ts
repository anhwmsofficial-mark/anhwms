import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_TRANSLATE_MODEL ?? 'gpt-4o-mini';

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
  const supabase = getSupabaseAdminClient();
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
    console.log('[api/cs/translate] 요청 시작');
    
    if (!OPENAI_API_KEY) {
      console.error('[api/cs/translate] OPENAI_API_KEY 없음');
      return NextResponse.json({ 
        error: 'OPENAI_API_KEY 가 설정되어 있지 않습니다.',
        debug: 'API 키가 환경 변수에 설정되어 있지 않습니다.'
      }, { status: 500 });
    }

    console.log('[api/cs/translate] API 키 확인됨:', OPENAI_API_KEY.substring(0, 10) + '...');

    const body = (await request.json()) as TranslateRequest;
    console.log('[api/cs/translate] 요청 본문:', { sourceLang: body.sourceLang, targetLang: body.targetLang, textLength: body.text?.length });

    if (!body?.text || !body.sourceLang || !body.targetLang) {
      return NextResponse.json({ error: 'sourceLang, targetLang, text 필드는 필수입니다.' }, { status: 400 });
    }

    const { sourceLang, targetLang, text } = body;
    const tone = body.tone ?? 'business';
    const formality = body.formality ?? 'neutral';

    // 용어집 불러오기
    console.log('[api/cs/translate] 용어집 조회 시작');
    const supabase = getSupabaseAdminClient();
    const { data: glossaryData, error: glossaryError } = await supabase
      .from('cs_glossary')
      .select('term_ko, term_zh, priority')
      .eq('active', true)
      .order('priority', { ascending: false });

    if (glossaryError) {
      console.error('[api/cs/translate] 용어집 조회 실패:', glossaryError);
    }

    const glossary = glossaryData || [];
    console.log('[api/cs/translate] 용어집 개수:', glossary.length);

    // 용어집을 프롬프트에 포함
    let glossaryPrompt = '';
    let glossaryInstructions = '';
    if (glossary.length > 0) {
      const glossaryList = glossary
        .map(g => `${g.term_ko} = ${g.term_zh}`)
        .join('\n');
      
      glossaryPrompt = `\n\n## 必须遵守的专业术语词汇表\n以下术语在翻译时必须完全按照词汇表进行替换，绝对不能使用其他翻译：\n\n${glossaryList}\n`;
      
      glossaryInstructions = '\n\n翻译规则：\n1. 严格按照词汇表中的对应关系翻译\n2. 词汇表中的术语不得改变\n3. 如果原文中包含词汇表中的术语，必须使用词汇表中指定的翻译\n4. 保持专业性和准确性';
    }

    const toneGuide = {
      business: '商务专业、简洁明了',
      friendly: '亲切友好、自然流畅',
      formal: '正式规范、严谨准确',
    }[tone];

    const formalityGuide = {
      formal: '使用敬语和正式表达',
      neutral: '保持中立、不过分正式',
      casual: '轻松自然、口语化',
    }[formality];

    const systemPrompt = `你是一位专业的韩中/中韩翻译专家，专门为ANH WMS仓储管理系统提供高质量翻译服务。

## 你的核心原则：
1. **准确性第一** - 确保事实、数字、时间、地点等信息100%准确
2. **专业术语** - 严格遵守用户提供的专业术语词汇表
3. **语气控制** - ${toneGuide}
4. **正式度** - ${formalityGuide}
5. **自然流畅** - 译文应符合目标语言的表达习惯

${glossaryPrompt}${glossaryInstructions}

## 翻译要求：
- 直接输出翻译结果，不要添加任何解释或注释
- 保持原文的语气和情感
- 确保译文符合目标语言的语法和表达习惯
- 对于人名、地名、公司名等专有名词，要特别注意词汇表中的指定翻译`;

    const userPrompt = `请将以下${sourceLang === 'ko' ? '韩语' : '中文'}文本翻译成${targetLang === 'ko' ? '韩语' : '中文'}：

${text}`;

    console.log('[api/cs/translate] 用어집 적용:', glossary.length, '개');

    console.log('[api/cs/translate] OpenAI 호출 시작, 모델:', OPENAI_MODEL);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        top_p: 0.9,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    console.log('[api/cs/translate] OpenAI 응답 상태:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[api/cs/translate] OpenAI 오류:', errorBody);
      throw new Error(`OpenAI 응답 오류 (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const translatedText = data?.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      console.error('[api/cs/translate] 번역 결과 없음:', data);
      throw new Error('번역 결과를 파싱할 수 없습니다.');
    }

    console.log('[api/cs/translate] 번역 성공, 결과 길이:', translatedText.length);

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
    console.error('[api/cs/translate] 오류 발생:', error);
    console.error('[api/cs/translate] 오류 스택:', error?.stack);
    return NextResponse.json(
      {
        error: '번역 중 오류가 발생했습니다.',
        details: error?.message ?? String(error),
        stack: error?.stack,
      },
      { status: 500 },
    );
  }
}
