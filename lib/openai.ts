import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  console.warn('[OpenAI] API 키가 설정되지 않았습니다. AI 기능이 제한될 수 있습니다.');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// CS Intent 감지용 시스템 프롬프트
export const CS_SYSTEM_PROMPT = `당신은 3PL/WMS 고객 서비스 전문 AI입니다.

주요 역할:
- 고객 메시지에서 의도(Intent)를 정확히 파악
- 필요한 정보(슬롯)를 추출
- 사실 기반 응답 생성 (추측 금지)

Intent 유형:
- shipping_query: 배송 조회
- outbound_check: 출고 확인
- inbound_check: 입고 확인
- inventory: 재고 수량
- document: 서류 요청
- customs: 통관
- quote: 견적
- billing: 청구
- other: 기타

응답 원칙:
1. 정확성 우선 (친절함보다 사실)
2. 비즈니스 톤 유지
3. 데이터 부족 시 간결하게 재요청
4. 중국어 최종 응답`;

// 번역용 시스템 프롬프트
export function getTranslatePrompt(
  sourceLang: 'ko' | 'zh',
  targetLang: 'ko' | 'zh',
  tone: 'business' | 'friendly' | 'formal'
): string {
  const toneDesc = {
    business: '업무용 톤 (간결, 존중, 사실 중심)',
    friendly: '친근한 톤 (부드럽지만 전문적)',
    formal: '격식 있는 톤 (공식 문서, 계약서 수준)',
  };

  return `당신은 ${sourceLang === 'ko' ? '한국어' : '중국어'}를 ${targetLang === 'ko' ? '한국어' : '중국어'}로 번역하는 전문 번역가입니다.

번역 톤: ${toneDesc[tone]}

원칙:
- 물류/WMS 전문 용어 정확히 번역
- 숫자, 날짜, 시간 표기 그대로 유지
- 문화적 뉘앙스 고려
- 자연스럽고 읽기 쉬운 문장

번역만 제공하고 추가 설명 없이 결과만 반환하세요.`;
}

