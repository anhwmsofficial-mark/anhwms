# 스프린트 산출물: UX 안정성 + 운영 문서 정비

## 1. 추가/수정된 error.tsx, loading.tsx 파일 목록

| 파일 | 역할 |
|------|------|
| `app/error.tsx` | 전역 에러 fallback. 페이지 렌더링 예외 시 "다시 시도" / "홈으로 이동" 제공 |
| `app/loading.tsx` | 전역 로딩. 라우트 전환 시 스피너 표시 |
| `app/(admin)/error.tsx` | (admin) 세그먼트 에러 fallback. "다시 시도" / "대시보드로" 제공 |
| `app/(admin)/loading.tsx` | (admin) 세그먼트 로딩. 관리자 화면 전환 시 스피너 표시 |

## 2. 각 파일의 역할

- **error.tsx**: React Error Boundary. page/layout 렌더링 중 예외 발생 시 fallback UI 표시. 인라인 API 에러(toast)와 역할 분리.
- **loading.tsx**: Suspense fallback. 라우트 전환·초기 로딩 시 표시. 페이지 내부 `useState` 로딩과는 별개.

## 3. 문서 추가/수정 목록

| 문서 | 변경 |
|------|------|
| `README.md` | 최신화 (실행 방법, 디렉터리 구조, 환경변수, 문서 링크) |
| `docs/security.md` | 신규 (실제 적용된 보안 정책) |
| `docs/testing.md` | 신규 (CI, smoke, 플래그 기반 테스트) |
| `docs/deployment-checklist.md` | 신규 (배포 전·후 체크리스트) |
| `docs/roadmap-tech-debt.md` | 신규 (후순위 과제 정리) |

## 4. README / security / testing / deployment 문서 핵심 변경점

- **README**: 실제 app 구조, `(admin)` 세그먼트, docs 링크 반영
- **security**: service-role, tenant, share, cron, upload, env-check/test-openai, requestId
- **testing**: lint:ci, typecheck:ci, build, smoke:ci, E2E_RUN_IMPORT_TRANSACTION
- **deployment-checklist**: production 차단 경로, env-check/test-openai, 배포 전·후 항목

## 5. 후순위 과제 정리 문서 위치

`docs/roadmap-tech-debt.md`

- confirm() → 공통 다이얼로그
- 대용량 테이블 가상 스크롤
- 중복 경로/파일 정리
- 도메인 서비스 레이어 확장
- 핵심 도메인 단위 테스트

## 6. 회귀 위험이 있는 화면 또는 검증 필요 포인트

| 구간 | 위험 | 검증 |
|------|------|------|
| (admin) 전역 | 낮음 | 로딩/에러 시 fallback 정상 표시 |
| 인라인 에러 | 없음 | httpToast/toast 기반 API 에러는 그대로 동작 |
| page 내부 loading | 없음 | `useState` loading은 기존대로 유지 |

**검증 권장**:
1. `/admin`, `/dashboard`, `/inbound` 등 이동 시 loading 깜빡임 없음
2. 의도적 에러 유발 시 (예: page에서 throw) error fallback UI 표시
3. "다시 시도" 클릭 시 reset 동작

## 7. 전역/세그먼트 fallback 커버 범위

- **전역 (app/)**: `/`, `/portal`, `/login`, `/quote-request` 등 (admin) 외 모든 라우트
- **(admin)**: `/admin`, `/dashboard`, `/inbound`, `/orders`, `/cs`, `/global-fulfillment` 등
- **추가 세그먼트**: 현재는 P2. inbound/cs/global-fulfillment 상세 세그먼트는 필요 시 추가
