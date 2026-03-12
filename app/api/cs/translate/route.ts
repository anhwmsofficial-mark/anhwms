import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { toAppApiError } from '@/lib/api/errors';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { requirePermission } from '@/utils/rbac';
import { getErrorMessage } from '@/lib/errorHandler';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_TRANSLATE_MODEL ?? 'gpt-4o';

type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

type GlossaryTerm = {
  term_ko: string;
  term_zh: string;
  note?: string | null;
  priority?: number | null;
};

type GlossaryRule = {
  source: string;
  target: string;
  priority: number;
};

interface TranslateRequest {
  sourceLang: 'ko' | 'zh';
  targetLang: 'ko' | 'zh';
  text: string;
  tone?: 'business' | 'friendly' | 'formal';
  formality?: 'formal' | 'neutral' | 'casual';
  userId?: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsCjkCharacters(value: string) {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(value);
}

function buildGlossaryRules(glossary: GlossaryTerm[], targetLang: 'ko' | 'zh'): GlossaryRule[] {
  return glossary
    .map((item) => ({
      source: (targetLang === 'ko' ? item.term_zh : item.term_ko)?.trim(),
      target: (targetLang === 'ko' ? item.term_ko : item.term_zh)?.trim(),
      priority: item.priority ?? 5,
    }))
    .filter((item): item is GlossaryRule => Boolean(item.source) && Boolean(item.target))
    .sort((a, b) => {
      if (b.source.length !== a.source.length) {
        return b.source.length - a.source.length;
      }

      return b.priority - a.priority;
    });
}

function buildGlossaryPrompt(glossary: GlossaryTerm[], targetLang: 'ko' | 'zh') {
  if (glossary.length === 0) {
    return '';
  }

  const list = glossary
    .map((item) => {
      const source = (targetLang === 'ko' ? item.term_zh : item.term_ko)?.trim();
      const target = (targetLang === 'ko' ? item.term_ko : item.term_zh)?.trim();
      const note = item.note?.trim();

      if (!source || !target) {
        return null;
      }

      if (!note) {
        return `- ${source} => ${target}`;
      }

      return targetLang === 'ko'
        ? `- ${source} => ${target} (메모: ${note})`
        : `- ${source} => ${target} (备注: ${note})`;
    })
    .filter(Boolean)
    .join('\n');

  if (!list) {
    return '';
  }

  if (targetLang === 'ko') {
    return `## 필수 용어집
다음 용어는 반드시 지정된 한국어로 번역하십시오.

${list}

용어집 규칙:
1. 중국어 원문에 해당 용어가 있으면 반드시 지정된 한국어 용어를 사용하십시오.
2. 한국어 결과에 중국어 한자를 남기지 마십시오.
3. 메모가 있는 용어는 해당 문맥을 우선 반영하십시오.`;
  }

  return `## 必须遵守的专业术语词汇表
以下术语在翻译时必须严格使用指定译法。

${list}

术语规则:
1. 原文中出现术语时，必须使用词汇表指定译法。
2. 术语优先于普通直译。
3. 如果有备注，请优先考虑备注中的业务语境。`;
}

function getKoreanDomainGuidance() {
  return `## WMS 용어 해석 기준
- 上架는 문맥상 "적치" 또는 "로케이션 적재"로 번역하고, 중국어를 그대로 남기지 마십시오.
- 入库单는 문맥상 "입고건"으로 번역하십시오.
- 唛头는 일반적으로 "박스 마킹" 또는 "박스 라벨"로 번역하십시오.
- 단, 唛头가 서류 대조나 불일치 문맥(예: 箱单, 资料, 不匹配)에서 쓰이면 "쿠팡 부착서류"로 번역하십시오.
- 箱单은 문맥상 "패킹리스트"로 번역하십시오.

예시:
[원문] 这个入库单已经在4号的时候就到达你们仓库了，麻烦确认之后上架
[번역] 이 입고건은 이미 4일에 귀사 창고에 도착했습니다. 확인 후 적치해 주세요.

[원문] 帮我安排上架 入库单
[번역] 입고건 적치 부탁드립니다.

[원문] 我们之后的货,每个客人有个编号，在唛头上以粗体显示，蛮大的。可以通关这个来分货。
[번역] 추후 들어오는 화물은 고객별 번호가 있으며, 박스 마킹 또는 박스 라벨에 굵은 글씨로 크게 표시되어 있습니다. 이를 기준으로 통관 후 분류할 수 있습니다.

[원문] 3-4, 4-4的这两份资料重新看一下，唛头和箱单不匹配
[번역] 3-4, 4-4 이 두 자료를 다시 확인해 주세요. 쿠팡 부착서류와 패킹리스트가 일치하지 않습니다.`;
}

function applyGlossaryReplacements(value: string, rules: GlossaryRule[]) {
  let output = value;
  const applied = new Set<string>();

  for (const rule of rules) {
    const signature = `${rule.source}=>${rule.target}`;
    if (!rule.source || !rule.target || applied.has(signature) || !output.includes(rule.source)) {
      continue;
    }

    output = output.replace(new RegExp(escapeRegExp(rule.source), 'g'), rule.target);
    applied.add(signature);
  }

  return output;
}

async function requestChatCompletion(messages: ChatMessage[]) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.3,
      top_p: 0.9,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI 응답 오류 (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const translatedText = data?.choices?.[0]?.message?.content?.trim();

  if (!translatedText) {
    throw new Error('번역 결과를 파싱할 수 없습니다.');
  }

  return translatedText;
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

export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/cs/translate');
  try {
    await requirePermission('read:orders', request);
    
    if (!OPENAI_API_KEY) {
      return fail('INTERNAL_ERROR', 'OPENAI_API_KEY 가 설정되어 있지 않습니다.', {
        status: 500,
        requestId: ctx.requestId,
      });
    }

    const body = (await request.json()) as TranslateRequest;

    if (!body?.text || !body.sourceLang || !body.targetLang) {
      return fail('BAD_REQUEST', 'sourceLang, targetLang, text 필드는 필수입니다.', {
        status: 400,
        requestId: ctx.requestId,
      });
    }

    const { sourceLang, targetLang, text } = body;
    const tone = body.tone ?? 'friendly';
    const formality = body.formality ?? 'formal';

    // 용어집 불러오기
    const supabase = getSupabaseAdminClient();
    const { data: glossaryData, error: glossaryError } = await supabase
      .from('cs_glossary')
      .select('term_ko, term_zh, note, priority')
      .eq('active', true)
      .order('priority', { ascending: false });

    if (glossaryError) {
      logger.error(glossaryError as Error, { ...ctx, scope: 'api', stage: 'load_glossary' });
    }

    const glossary = (glossaryData || []) as GlossaryTerm[];
    const isTargetKorean = targetLang === 'ko';
    const glossaryPrompt = buildGlossaryPrompt(glossary, targetLang);
    const glossaryRules = buildGlossaryRules(glossary, targetLang);

    const toneGuide = {
      business: isTargetKorean ? '비즈니스적이고 전문적이며, 간결하고 명확하게' : '商务专业、委婉得体',
      friendly: isTargetKorean ? '친근하고 부드러우며, 자연스럽게' : '亲切友好、自然流畅',
      formal: isTargetKorean ? '격식 있고 정중하며, 정확하게' : '正式规范、严谨准确',
    }[tone];

    const formalityGuide = {
      formal: isTargetKorean ? '하십시오체 또는 하게요체를 적절히 사용하여 정중하게' : '使用敬语和正式表达',
      neutral: isTargetKorean ? '해요체를 사용하여 정중하면서도 부드럽게' : '保持中立、不过分正式',
      casual: isTargetKorean ? '친근한 반말 또는 가벼운 경어 사용' : '轻松自然、口语化',
    }[formality];

    let systemPrompt = '';
    
    if (isTargetKorean) {
      // 한국어 타겟 프롬프트 (Korean Target Prompt)
      systemPrompt = `당신은 ANH WMS 창고 관리 시스템을 위한 전문 한중/중한 번역가입니다.
현재 **중국어(또는 다른 언어)를 한국어로** 번역하는 작업을 수행해야 합니다.

## 핵심 원칙:
1. **자연스러운 흐름 (가장 중요)**: 직역을 피하고, 한국어의 문법 구조(주어-목적어-서술어)와 어순에 맞게 문장을 재구성하십시오.
2. **조사 및 어미 처리**: 한국어의 조사(은/는, 이/가, 을/를 등)와 어미를 문맥에 맞게 정확하고 자연스럽게 사용하십시오. '그것은', '이것은' 같은 부자연스러운 대명사 사용을 지양하십시오.
3. **전문 용어 준수**: 제공된 용어집(Glossary)이 있다면 반드시 따르십시오.
4. **어조 및 태도**: ${toneGuide}
5. **격식 수준**: ${formalityGuide}
6. **형식 유지**: 줄바꿈, 구두점, 리스트 형식을 유지하되, 한국어 문맥상 어색한 구두점은 조정하십시오. 코드, URL, SKU, 송장 번호는 변경하지 마십시오.

${glossaryPrompt ? `\n\n${glossaryPrompt}\n` : ''}

${getKoreanDomainGuidance()}

## 번역 가이드라인:
- 중국어 원문의 어순(SVO)을 그대로 따르지 말고, 한국어의 자연스러운 어순(SOV)으로 변경하십시오.
- 문맥상 불필요한 주어(나, 우리 등)는 한국어 특성에 맞춰 과감히 생략하거나 자연스럽게 처리하십시오.
- 단순히 단어를 치환하는 것이 아니라, 문장의 '의미'를 파악하여 원어민이 쓴 것처럼 자연스럽게 작성하십시오.
- 최종 결과는 한국어만 출력하고, 중국어 한자나 병기를 남기지 마십시오.
- 결과물만 출력하고 설명은 포함하지 마십시오.`;
    } else {
      // 중국어 타겟 프롬프트 (Chinese Target Prompt - 한->중 번역 품질 개선: Few-Shot Pattern Learning)
      systemPrompt = `你是一位专业的韩中/中韩翻译专家，专门为ANH WMS仓储管理系统提供高质量翻译服务。
当前任务是将**韩语(或其他语言)翻译成中文**。

## 你的核心原则：
1. **自然流畅 (最重要的)**：避免逐字直译，根据中文的表达习惯重组句子结构。
2. **准确性**：确保事实、数字、时间、地点等信息100%准确。
3. **语气控制**：${toneGuide}
4. **正式度**：${formalityGuide}
5. **格式保持**：保留换行、标点和列表结构，不改变代码、URL、SKU、单号。

${glossaryPrompt ? `\n\n${glossaryPrompt}\n` : ''}

## 商务翻译风格指南 (Business Style Guide - Few-Shot Examples):
你不仅是翻译，更是"商务沟通专家"。请学习以下范例的语气和逻辑，将其应用到所有类似的翻译中 (Generalize from these examples)：

### 1. 语气转换 (Tone Transformation) - 委婉与专业
- **拒绝/困难 (Refusals)**: 避免直接生硬的否定。
  - [原文] "오늘은 출고량이 많아 어렵습니다." (Today output is high, difficult.)
  - [直译(Bad)] "今天出库量很大，很困难。"
  - [意译(Good)] "今天出库量较大，恐怕很难处理。" / "由于今天出库量大，暂时难以安排。"
- **确认/认知 (Acknowledgment)**: 使用专业的确认词汇。
  - [原文] "재고조사로 알고 있습니다." (Know it is inventory check.)
  - [直译(Bad)] "我知道是库存调查。"
  - [意译(Good)] "据我方了解，是进行库存调查。" / "我方已知悉该事项为库存调查。"

### 2. 时间与截点 (Time & Deadlines) - 明确且包含
- **截止时间**: 除非明确指明"~전(Before)"，否则通常应包含该时间点。
  - [原文] "내일까지 전달드릴게요." (Will give by tomorrow.)
  - [直译(Bad)] "明天之前会传达给您。" (Ambiguous: implies before tomorrow starts)
  - [意译(Good)] "明天内会传达给您。" / "明天会给您答复。" (Clear: includes tomorrow)

### 3. 翻译策略 (Translation Strategy)
- 不要逐字翻译(Word-for-word)，要根据**商务语境**进行**意译(Sense-for-sense)**。
- 补全省略的主语（如"我司"、"贵司"），使句子完整。
- 使用适当的连接词，使逻辑更通顺。

## 翻译要求：
- 直接输出翻译结果，不要添加任何解释或注释
- 保持原文的语气和情感，但在商务语境下要显得得体
- 确保译文符合中文母语者的表达习惯
- 对于人名、地名、公司名等专有名词，要特别注意词汇表中的指定翻译`;
    }

    const userPrompt = isTargetKorean
      ? `다음 ${sourceLang === 'ko' ? '한국어' : '중국어'} 텍스트를 자연스럽고 실무적인 한국어로 번역하십시오:

${text}`
      : `请将以下${sourceLang === 'ko' ? '韩语' : '中文'}文本翻译成${targetLang === 'ko' ? '韩语' : '中文'}：

${text}`;

    let translatedText = await requestChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    translatedText = applyGlossaryReplacements(translatedText, glossaryRules);

    if (isTargetKorean && containsCjkCharacters(translatedText)) {
      translatedText = await requestChatCompletion([
        {
          role: 'system',
          content: `당신은 ANH WMS 실무 번역 검수자입니다.
기존 번역 결과에 남아 있는 중국어/한자를 모두 자연스러운 한국어로 정리하십시오.
코드, SKU, URL, 영문 약어, 숫자, 송장번호는 변경하지 마십시오.
최종 결과는 한국어 문장만 출력하십시오.

${glossaryPrompt ? `${glossaryPrompt}\n` : ''}${getKoreanDomainGuidance()}`,
        },
        {
          role: 'user',
          content: `원문:
${text}

1차 번역:
${translatedText}

남아 있는 중국어 또는 한자가 있다면 모두 자연스러운 한국어로 바꾸고, 문장을 매끄럽게 다듬어 주세요.`,
        },
      ]);

      translatedText = applyGlossaryReplacements(translatedText, glossaryRules);
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

    return ok({
      translatedText,
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: '번역 중 오류가 발생했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', '번역 중 오류가 발생했습니다.', {
      status: apiError.status,
      requestId: ctx.requestId,
      details: getErrorMessage(error),
    });
  }
}
