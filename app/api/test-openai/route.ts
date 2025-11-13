import { NextResponse } from 'next/server';

export async function GET() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  // 1. API 키 존재 확인
  if (!OPENAI_API_KEY) {
    return NextResponse.json({
      success: false,
      error: 'OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.',
      checks: {
        hasApiKey: false,
      }
    });
  }

  // 2. API 키 형식 확인
  const keyPreview = OPENAI_API_KEY.substring(0, 10) + '...' + OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4);
  
  try {
    // 3. OpenAI API 연결 테스트
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 10,
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API 호출 실패',
        checks: {
          hasApiKey: true,
          apiKeyPreview: keyPreview,
          apiStatus: response.status,
          apiResponse: responseText,
        }
      });
    }

    const data = JSON.parse(responseText);
    
    return NextResponse.json({
      success: true,
      message: 'OpenAI API 연결 성공!',
      checks: {
        hasApiKey: true,
        apiKeyPreview: keyPreview,
        apiStatus: response.status,
        testResponse: data.choices[0].message.content,
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: '테스트 중 오류 발생',
      checks: {
        hasApiKey: true,
        apiKeyPreview: keyPreview,
        errorMessage: error.message,
        errorStack: error.stack,
      }
    });
  }
}

