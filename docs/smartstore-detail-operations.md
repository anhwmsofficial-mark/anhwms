# 스마트스토어 모바일 상세 운영

아하득템 스토어의 상세 이미지를 모바일에서 보이는 JPG HTML로 바꾼 뒤, 담당자 승인을 받아 네이버 커머스 API의 `detailContent`만 교체합니다.

적용한 상품은 스마트스토어 판매자센터의 SmartEditor ONE 문서가 아니라 HTML 상세로 전환됩니다. 공식 API는 SmartEditor ONE 문서를 작성하거나 되돌리지 못합니다. 반영 전에 테스트 상품을 확인하고, 필요하면 적용 전 HTML을 작업 이력에서 복사해 판매자센터에 수동으로 되돌립니다.

## API 발급

1. [커머스 API 센터](https://apicenter.commerce.naver.com/)에서 아하득템 애플리케이션을 등록합니다.
2. 상품 조회와 채널 상품 수정 권한을 신청합니다.
3. 발급된 Client ID와 Client Secret을 서버 환경변수에만 넣습니다.

| 변수 | 용도 |
|---|---|
| `NAVER_COMMERCE_CLIENT_ID` | 커머스 API Client ID |
| `NAVER_COMMERCE_CLIENT_SECRET` | 전자서명용 Client Secret. bcrypt salt 형식 |

비밀키는 화면, 저장소, Git에 넣지 않습니다. 두 값이 없으면 연결 진단은 발급 절차만 보여주고 네이버 API를 호출하지 않습니다. 이미지 변환과 HTML 미리보기는 자격증명 없이 사용할 수 있습니다.

## 데이터베이스

`supabase/migrations/20261113133000_create_smartstore_detail.sql`을 적용합니다. 테이블은 연결 상태, 작업, 작업 항목, 적용 버전을 저장합니다. 최초 반영 범위는 1개입니다.

이미지는 기존 `product-showcase` 버킷의 `smartstore-detail/original`과 `smartstore-detail/deploy`에 분리 저장합니다. 배포본은 최대 너비 860px JPG이며 EXIF를 제거합니다.

## 적용 순서

1. 관리자로 운영지원팀의 **스마트스토어 상세**(`/operations/smartstore-detail`)에 들어갑니다. 메뉴와 API는 `manage:smartstore_detail` 권한이 있는 관리자만 사용할 수 있습니다.
2. 테스트 상품 1개의 채널 상품번호와 상세 이미지를 넣고 미리보기를 만듭니다. PC 860px와 모바일 390px 화면을 확인합니다.
3. 반영은 센터 PC에서 실행합니다. 그 PC의 PowerShell에서 `NAVER_COMMERCE_CLIENT_ID`와 `NAVER_COMMERCE_CLIENT_SECRET`을 설정한 뒤 `npm run smartstore:center`를 실행합니다. 네이버에는 그 센터의 공인 IP만 등록되어 있어야 하며, 화면이 **이 PC 연결됨**으로 바뀐 뒤에만 **승인 후 반영**이 실행됩니다. 범위를 넘긴 작업은 어떤 상품도 수정하지 않습니다.
4. 스마트스토어 모바일에서 테스트 상품의 이미지가 열리는지 확인합니다.
5. 확인 후 반영 범위를 5개로 넓히고 다시 확인합니다.
6. 서로 다른 상품 5개가 반영된 뒤에만 전체 허용으로 바꿀 수 있습니다.

같은 채널 상품번호와 같은 HTML 해시는 버전 테이블에 남아 있으면 다시 반영하지 않습니다. 일부 상품이 실패하면 작업은 부분 실패가 되고, 실패한 항목만 재시도합니다. 변경은 감사 로그 `SMARTSTORE_DETAIL`로 남습니다.

## 롤백

API 반영은 HTML 상세를 덮어쓰므로 SmartEditor ONE 원본 문서를 복구하지 못합니다.

1. 작업 이력에서 해당 상품의 적용 전 HTML을 복사합니다.
2. 판매자센터 상품 편집에서 상세 설명을 수동으로 되돌립니다.
3. 같은 문제가 다른 상품에 번지지 않도록 반영 범위를 다시 1개로 제한합니다.

반영 직후 모바일에서 이미지가 깨지면 추가 상품을 반영하지 않고, 적용 전 HTML과 배포 JPG 주소를 기준으로 원인을 확인합니다.
