export const COMMERCE_CLIENT_ID_ENV = 'NAVER_COMMERCE_CLIENT_ID';
export const COMMERCE_CLIENT_SECRET_ENV = 'NAVER_COMMERCE_CLIENT_SECRET';

export const SMARTSTORE_SETUP_GUIDE = [
  '최초 1회만 담당자가 각 센터 PC에서 setup-smartstore-center.cmd를 실행합니다.',
  '설치 후 Windows 로그인 시 센터 연결이 자동으로 시작됩니다.',
  '연결되지 않으면 Windows에 다시 로그인하거나 시스템 담당자에게 문의합니다.',
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
