/**
 * 환경 변수 검증 및 관리
 */

interface EnvConfig {
  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;

  // OpenAI
  openaiApiKey?: string;

  // Application
  appUrl: string;
  nodeEnv: string;

  // Supabase Functions
  supabaseFunctionsUrl?: string;

  // External APIs
  cjApiKey?: string;
  cjApiUrl?: string;
  anhApiKey?: string;
  anhApiUrl?: string;

  // Monitoring
  sentryDsn?: string;
}

/**
 * 환경 변수 검증
 */
export function validateEnv(): EnvConfig {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    const errorMessage = `
❌ 필수 환경 변수가 누락되었습니다:
${missing.map(key => `  - ${key}`).join('\n')}

해결 방법:
1. 프로젝트 루트에 .env.local 파일을 생성하세요
2. .env.example 파일을 참고하여 필수 값을 입력하세요
3. 개발 서버를 재시작하세요

자세한 내용은 README.md를 참고하세요.
    `;
    throw new Error(errorMessage);
  }

  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
    supabaseFunctionsUrl: process.env.SUPABASE_FUNCTIONS_URL,
    cjApiKey: process.env.CJ_API_KEY,
    cjApiUrl: process.env.CJ_API_URL,
    anhApiKey: process.env.ANH_API_KEY,
    anhApiUrl: process.env.ANH_API_URL,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };
}

/**
 * 환경 변수 가져오기 (검증된 값)
 */
let envConfig: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!envConfig) {
    envConfig = validateEnv();
  }
  return envConfig;
}

/**
 * 특정 기능이 활성화되어 있는지 확인
 */
export function isFeatureEnabled(feature: keyof EnvConfig): boolean {
  try {
    const env = getEnv();
    return !!env[feature];
  } catch {
    return false;
  }
}

/**
 * 프로덕션 환경인지 확인
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * 개발 환경인지 확인
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * 테스트 환경인지 확인
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * 환경 변수 디버그 정보 출력 (민감한 정보 제외)
 */
export function printEnvDebug() {
  if (!isDevelopment()) {
    console.warn('환경 변수 디버그는 개발 환경에서만 사용하세요.');
    return;
  }

  const env = getEnv();
  
  console.log('=== Environment Configuration ===');
  console.log('NODE_ENV:', env.nodeEnv);
  console.log('App URL:', env.appUrl);
  console.log('Supabase URL:', env.supabaseUrl);
  console.log('Supabase Anon Key:', env.supabaseAnonKey ? '✅ 설정됨' : '❌ 미설정');
  console.log('Supabase Service Role Key:', env.supabaseServiceRoleKey ? '✅ 설정됨' : '❌ 미설정');
  console.log('OpenAI API Key:', env.openaiApiKey ? '✅ 설정됨' : '❌ 미설정');
  console.log('Supabase Functions URL:', env.supabaseFunctionsUrl || '❌ 미설정');
  console.log('CJ API:', env.cjApiKey && env.cjApiUrl ? '✅ 설정됨' : '❌ 미설정');
  console.log('ANH API:', env.anhApiKey && env.anhApiUrl ? '✅ 설정됨' : '❌ 미설정');
  console.log('Sentry DSN:', env.sentryDsn ? '✅ 설정됨' : '❌ 미설정');
  console.log('================================');
}


