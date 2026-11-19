export const COMMERCE_CLIENT_ID_ENV = 'NAVER_COMMERCE_CLIENT_ID';
export const COMMERCE_CLIENT_SECRET_ENV = 'NAVER_COMMERCE_CLIENT_SECRET';

export const SMARTSTORE_SETUP_GUIDE = [
  '네이버 커머스 API 센터에서 아하득템 스토어의 애플리케이션을 등록합니다.',
  '커머스API 호출 권한과 상품 조회·수정 권한을 신청합니다.',
  '발급된 Client ID와 Client Secret은 작업할 센터 PC의 PowerShell 환경변수에만 넣습니다.',
  '비밀키는 화면이나 데이터베이스에 저장하지 않습니다.',
  '센터 PC에서 npm run smartstore:center를 실행하고 화면이 이 PC 연결됨으로 바뀌는지 확인합니다.',
  '처음 반영은 테스트 상품 1개만 허용됩니다. 모바일 확인 후 5개, 그 다음 전체로 범위를 넓힙니다.',
];

export type CommerceCredentials = {
  configured: boolean;
  clientId: string;
  clientSecret: string;
};

export function readCommerceCredentials(env: NodeJS.ProcessEnv = process.env): CommerceCredentials {
  const clientId = env[COMMERCE_CLIENT_ID_ENV]?.trim() || '';
  const clientSecret = env[COMMERCE_CLIENT_SECRET_ENV]?.trim() || '';
  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
  };
}
