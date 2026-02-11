# YBK 물동량 엑셀 기반 재고관리 통합 기획

## 1. 개요

### 1.1 목적
- **물동량.xlsx**: YBK(영블랙) 거래처 재고를 기록한 엑셀 시트
- 기존 DB 프로세스와 연결하여 재고 데이터를 동기화
- Admin 담당자가 메일/어드민에서 관리
- 날짜별로 구성된 요구서를 파일로 공유·다운로드

### 1.2 핵심 요구사항
| 구분 | 내용 |
|------|------|
| **업체 필수 요구** | 엑셀 시트의 **모든 열(컬럼)과 행(필드값)** 이 반드시 있어야 함 |
| **담당자** | 메일 어드민(Admin)에서 담당자 관리 |
| **날짜별** | 요구서가 날짜별로 구성됨 → 날짜 기준 조회·추출 |
| **공유** | 파일 공유, 외부 공유 링크, 시트 다운로드 |

---

## 2. 현행 시스템 분석

### 2.1 관련 DB 구조
- **products**: 제품 마스터 (SKU, 바코드, product_db_no, category 등)
- **inventory**: 창고별 재고 (warehouse_id, product_id, qty_on_hand, qty_allocated)
- **inventory_ledger**: 재고 수불부 (입고/출고/조정 등 변동 이력)
- **inbound_receipt_shares**: 외부 공유 링크 (slug, password, expires_at) — 입고 인수증 공유에 사용 중
- **customer_contact**: 거래처 담당자 (email, role, is_primary)

### 2.2 기존 YBK 관련 기능
- `scripts/import_ybk_from_excel.js`: ANH_WMS_상품DB_재구성.xlsx 기반 상품/바코드 일괄 등록
- 고객사 코드 `YBK`, brand `YBK-MAIN` 등
- `customer_contact`에 YBK 담당자(kim@ybk.com 등) 등록

### 2.3 물동량.xlsx 구조 (확인 완료)

**업체 요구: 모든 열·행 필드값 필수** — 아래 컬럼 전체를 그대로 보존·다운로드해야 함.

#### 컬럼 목록 (좌→우 순서)

| No | 컬럼명 | 설명 |
|----|--------|------|
| 1 | **관리병** (관리명) | 제품명/관리명 — `[7]리빙귀지킬러`, `[2]리비기사(25)` 등, products 매핑용 |
| 2 | **전영재고** | 전일/기초 재고 — `36/2` 형태 가능 (수량/상태) |
| 3~35 | 파손, 반품(B2C), 폐기(-), 제트회송(+), 반품(필크로스), 화물(지), 비품(-), 화재(+/-), 재고, 양품화(+), 제트이관(-), 이관작업, 선교환(+/-), 구방(밀크), 재고조정(+/-), 샘문(-), 대포장입고, 수출픽업(-), 번들세제(+/-), 번들(+/-), 재포장(+/-), 라벨작업(+/-), 컷그로스(택배), 카페진연(+/-), 출고취소 | 각 변동 유형별 수량 |
| 36 | **택배** | 택배 출고 수량 |
| 37 | **총합계** | 합계(계산값) |
| 38 | **마감재고** | 당일/기말 재고 — `36/1` 형태 가능 |
| 39 | **비고** | 메모 |

#### 특수 파싱 이슈

- **전영재고·마감재고**: `36/2`, `36/1` 형식 → raw_data에 문자열 그대로 저장. 다운로드 시 원본 유지. DB 집계용은 `/` 앞 숫자만 파싱 (업체 확인 후)
- **매핑 키**: `관리병`(관리명) → `products.manage_name` 또는 `products.name` 매핑

---

## 3. 제안 아키텍처

### 3.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        물동량 엑셀 ↔ DB 연동                              │
├─────────────────────────────────────────────────────────────────────────┤
│  1. [엑셀 업로드] Admin이 물동량.xlsx 업로드                              │
│      → 파싱 후 YBK 전용 테이블/뷰에 저장 (모든 컬럼 보존)                  │
│                                                                          │
│  2. [DB 동기화] products, inventory, inventory_ledger와 매핑              │
│      → SKU/바코드 기준으로 product_id 연결                               │
│      → 입고/출고/조정 변동이 있으면 inventory_ledger에 기록                │
│                                                                          │
│  3. [담당자 관리] Admin > 고객사(YBK) > 담당자 탭                         │
│      → customer_contact에서 이메일/역할 관리                              │
│      → 공유 시 수신자(담당자 이메일) 지정                                 │
│                                                                          │
│  4. [날짜별 추출] 날짜 범위 선택 → Excel/CSV 다운로드                     │
│      → 업체 요구 형식 그대로 (모든 열·행 유지)                            │
│                                                                          │
│  5. [외부 공유] inbound_receipt_shares와 유사한 공유 링크                 │
│      → /share/inventory/[slug] 형식                                      │
│      → 비밀번호, 만료일 설정                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 신규 테이블 제안

#### (A) `inventory_volume_raw` — 원본 엑셀 데이터 보존
> 업체 요구: **모든 필드값이 있어야 함** → 원본 그대로 저장

```sql
CREATE TABLE inventory_volume_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customer_master(id),  -- YBK
  sheet_name TEXT,           -- 시트명
  record_date DATE,          -- 해당 날짜
  raw_data JSONB NOT NULL,   -- 모든 컬럼을 그대로 JSONB로 저장
  created_at TIMESTAMPTZ DEFAULT now(),
  source_file TEXT           -- 업로드 파일명
);
```

- **raw_data**: 엑셀의 한 행을 `{ "컬럼1": "값1", "컬럼2": "값2", ... }` 형태로 저장
- 컬럼 추가/삭제 시에도 스키마 변경 없이 대응 가능

#### (B) `inventory_volume_share` — 공유 링크
```sql
CREATE TABLE inventory_volume_share (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customer_master(id),
  date_from DATE,
  date_to DATE,
  password_hash TEXT,
  password_salt TEXT,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. 기능별 상세 설계

### 4.1 엑셀 업로드 & DB 반영

| 단계 | 처리 내용 |
|------|-----------|
| 1 | Admin이 `/admin/inventory/volume` 페이지에서 엑셀 업로드 |
| 2 | XLSX 파싱 → 시트별, 행별로 `inventory_volume_raw`에 저장 (raw_data에 전체 컬럼) |
| 3 | SKU/바코드/상품코드 등으로 `products` 매핑 시도 |
| 4 | 매핑된 건은 `inventory_ledger`에 변동 기록 (입고/출고/조정) |
| 5 | `products.quantity` 자동 갱신 (기존 트리거 활용) |

**주의사항**
- 매핑 실패 건은 별도 리포트로 표시 (수동 매핑 또는 상품 등록 유도)
- 엑셀 컬럼명이 바뀌어도 `raw_data` JSONB라서 영향 없음
- **업체 요구 충족**: 다운로드 시 `raw_data`를 그대로 엑셀 행으로 복원

### 4.2 담당자 관리 (메일 어드민)

- **경로**: Admin > 고객사관리 > YBK > 담당자 탭  
- **기존**: `customer_contact` (name, email, role, is_primary)
- **활용**:
  - 공유 링크 생성 시 “수신자”로 담당자 이메일 선택
  - (선택) 공유 시 해당 이메일로 자동 발송

### 4.3 날짜별 시트 다운로드

- **조건**: `record_date` (또는 업체 시트의 날짜 컬럼) 기준
- **형식**: 엑셀 원본과 동일한 열 구성 (raw_data 기반)
- **제공 방식**:
  1. Admin 화면에서 “다운로드” 버튼 → 즉시 Excel 생성
  2. 공유 링크에서 날짜 범위 선택 → 다운로드

### 4.4 외부 공유

- **URL**: `https://anhwms.com/share/inventory/[slug]`
- **인증**: 
  - 비밀번호 있으면 입력 후 열기
  - 만료일 지나면 “만료됨” 메시지
- **화면**: 날짜별 재고 시트 (테이블 형태) + Excel 다운로드 버튼
- **기존 패턴**: `inbound_receipt_shares` + `share/inbound/[slug]` 참고

---

## 5. 리스크 & 대응

### 5.1 리스크

| 리스크 | 설명 | 대응 |
|--------|------|------|
| **컬럼 구조 변경** | 업체가 엑셀 양식을 바꾸면 기존 매핑 깨짐 | `raw_data` JSONB로 모든 컬럼 보존 → 다운로드 시 그대로 복원. 매핑용 컬럼만 별도 필드로 추출 |
| **날짜 형식 불일치** | 엑셀 날짜 형식 다양 (숫자, 텍스트 등) | 파싱 단계에서 정규화 (YYYY-MM-DD) |
| **대용량** | 수천~수만 행 | 배치 처리, 백그라운드 작업, 페이지네이션 |
| **중복 업로드** | 같은 파일 여러 번 업로드 | `source_file`+`record_date`+해시로 중복 체크, 업로드 전 확인 |
| **권한** | YBK 담당자만 자기 데이터 조회 | RLS: `customer_id` 또는 `brand_id` 기준 필터 |
| **공유 유출** | 링크/비밀번호 유출 | 만료일 필수, 비밀번호 권장, 감사 로그 |

### 5.2 검증 포인트

- [x] 물동량.xlsx 실제 시트 구조 확인 (헤더 39개 컬럼 확인 완료)
- [ ] products와 매핑 기준 (SKU vs 바코드 vs 상품코드) 확정
- [ ] 업체가 요구하는 “모든 필드”의 정확한 목록
- [ ] 날짜별의 정의 (일별 / 주별 / 월별 등)

---

## 6. 구현 단계 제안

### Phase 1: 기반 구축 (1~2주)
- [ ] `inventory_volume_raw`, `inventory_volume_share` 테이블 마이그레이션
- [ ] 물동량.xlsx 샘플로 파싱 스크립트 작성 (컬럼 구조 문서화)
- [ ] Admin 페이지 `/admin/inventory/volume` 기본 UI (업로드, 목록)

### Phase 2: DB 연동 (1주)
- [ ] 엑셀 → `inventory_volume_raw` 저장
- [ ] products 매핑 및 `inventory_ledger` 반영
- [ ] `products.quantity` 트리거 연동 확인

### Phase 3: 담당자 & 공유 (1주)
- [ ] 담당자(customer_contact) 연결 UI
- [ ] 공유 링크 생성/만료/비밀번호
- [ ] `/share/inventory/[slug]` 페이지

### Phase 4: 다운로드 & 편의 기능 (1주)
- [ ] 날짜별 Excel 다운로드 (raw_data → XLSX)
- [ ] 공유 페이지에서 다운로드
- [ ] (선택) 이메일 발송

---

## 7. 다음 단계 (필수)

1. ~~**물동량.xlsx 구조 확인**~~ ✅ 완료 (39개 컬럼 확인)
2. **매핑 키 협의**  
   - `관리병`(관리명) → `products.manage_name` 또는 `products.name` 매핑 검토
   - `[7]리빙귀지킬러` 형식에서 숫자/SKU 추출 규칙 확인
3. **전영재고/마감재고 `36/2` 형식**  
   - 업체에 의미 확인 (총량/부재고, 양품/불량 등)
4. **담당자 연동 범위**  
   - 공유 시 담당자 이메일로 자동 발송 여부

---

## 8. 요약

| 항목 | 방향 |
|------|------|
| **업체 필수 요구** | `raw_data` JSONB로 모든 열·행 보존 → 다운로드 시 그대로 복원 |
| **DB 연동** | `inventory_volume_raw` + products 매핑 + inventory_ledger 반영 |
| **담당자** | `customer_contact` 기반, Admin에서 관리 |
| **날짜별** | `record_date` 또는 시트 내 날짜 컬럼 기준 조회·다운로드 |
| **공유** | `inventory_volume_share` + `/share/inventory/[slug]` 패턴으로 구현 |
| **리스크** | 컬럼 변경·대용량·중복·권한·유출 등에 대한 대응 방안 포함 |

실제 물동량.xlsx 구조를 알려주시면, 매핑 규칙과 파싱 로직을 더 구체적으로 정리해 드리겠습니다.
