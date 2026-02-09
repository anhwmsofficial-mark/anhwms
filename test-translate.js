// OpenAI API 테스트 스크립트
import https from 'node:https';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

console.log('✅ OPENAI_API_KEY 발견:', OPENAI_API_KEY.substring(0, 10) + '...');

const data = JSON.stringify({
  model: 'gpt-4o-mini',
  temperature: 0.2,
  messages: [
    { role: 'system', content: '너는 번역가야.' },
    { role: 'user', content: '안녕하세요를 중국어로 번역해주세요.' },
  ],
});

const options = {
  hostname: 'api.openai.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Length': data.length,
  },
};

console.log('🔄 OpenAI API 호출 중...');

const req = https.request(options, (res) => {
  console.log(`📡 상태 코드: ${res.statusCode}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      const result = JSON.parse(responseData);
      console.log('✅ 성공!');
      console.log('📝 번역 결과:', result.choices[0].message.content);
    } else {
      console.error('❌ 오류 응답:');
      console.error(responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 요청 실패:', error);
});

req.write(data);
req.end();

