# 🔐 테스트 사용자 생성 가이드

## 1단계: Supabase에서 사용자 생성

### Supabase Dashboard 접속
1. https://supabase.com 접속
2. 프로젝트 선택
3. **Authentication** → **Users** 메뉴로 이동

### 테스트 사용자 3명 생성

#### 사용자 1: Mark Choi (Admin)
- Email: `mark.choi@anhwms.com`
- Password: `anhwms2024!Mark` (임시 비밀번호)
- Click "Add user" 버튼

#### 사용자 2: Golden Choi (Manager)
- Email: `golden.choi@anhwms.com`
- Password: `anhwms2024!Golden` (임시 비밀번호)
- Click "Add user" 버튼

#### 사용자 3: Claudia Park (Operator)
- Email: `claudia.park@anhwms.com`
- Password: `anhwms2024!Claudia` (임시 비밀번호)
- Click "Add user" 버튼

---

## 2단계: 사용자 프로필 및 권한 설정

사용자 생성 후, Supabase SQL Editor에서 다음 SQL을 실행하세요:

```sql
-- ====================================================================
-- 테스트 사용자 프로필 업데이트
-- ====================================================================

-- 1. Mark Choi - Admin (전체 권한)
UPDATE user_profiles
SET 
  full_name = 'Mark Choi',
  display_name = 'Mark',
  role = 'admin',
  department = 'admin',
  can_access_admin = TRUE,
  can_access_dashboard = TRUE,
  can_manage_users = TRUE,
  can_manage_inventory = TRUE,
  can_manage_orders = TRUE,
  status = 'active'
WHERE email = 'mark.choi@anhwms.com';

-- 2. Golden Choi - Manager (관리 권한)
UPDATE user_profiles
SET 
  full_name = 'Golden Choi',
  display_name = 'Golden',
  role = 'manager',
  department = 'admin',
  can_access_admin = TRUE,
  can_access_dashboard = TRUE,
  can_manage_users = FALSE,
  can_manage_inventory = TRUE,
  can_manage_orders = TRUE,
  status = 'active'
WHERE email = 'golden.choi@anhwms.com';

-- 3. Claudia Park - Operator (운영 권한)
UPDATE user_profiles
SET 
  full_name = 'Claudia Park',
  display_name = 'Claudia',
  role = 'operator',
  department = 'warehouse',
  can_access_admin = FALSE,
  can_access_dashboard = TRUE,
  can_manage_users = FALSE,
  can_manage_inventory = TRUE,
  can_manage_orders = TRUE,
  status = 'active'
WHERE email = 'claudia.park@anhwms.com';

-- 프로필 확인
SELECT 
  email,
  full_name,
  display_name,
  role,
  department,
  can_access_admin,
  status
FROM user_profiles
WHERE email IN (
  'mark.choi@anhwms.com',
  'golden.choi@anhwms.com',
  'claudia.park@anhwms.com'
);
```

---

## 3단계: 로그인 테스트

### 테스트 시나리오

#### 시나리오 1: Mark Choi (Admin)
1. https://anhwms.vercel.app/login 접속
2. Email: `mark.choi@anhwms.com`
3. Password: `anhwms2024!Mark`
4. **예상 결과**: Admin 페이지(/admin)로 이동

#### 시나리오 2: Golden Choi (Manager)
1. https://anhwms.vercel.app/login 접속
2. Email: `golden.choi@anhwms.com`
3. Password: `anhwms2024!Golden`
4. **예상 결과**: Admin 페이지(/admin)로 이동 (Manager도 Admin 접근 가능)

#### 시나리오 3: Claudia Park (Operator)
1. https://anhwms.vercel.app/login 접속
2. Email: `claudia.park@anhwms.com`
3. Password: `anhwms2024!Claudia`
4. **예상 결과**: Dashboard(/dashboard)로 이동 (Admin 접근 불가)

---

## 4단계: 권한 검증

### Admin 페이지 접근 테스트

| 계정 | Email | Admin 접근 | Dashboard 접근 | 역할 |
|------|-------|-----------|---------------|------|
| Mark Choi | mark.choi@anhwms.com | ✅ | ✅ | Admin |
| Golden Choi | golden.choi@anhwms.com | ✅ | ✅ | Manager |
| Claudia Park | claudia.park@anhwms.com | ❌ | ✅ | Operator |

### 테스트 URL

- 로그인: https://anhwms.vercel.app/login
- Admin: https://anhwms.vercel.app/admin
- Dashboard: https://anhwms.vercel.app/dashboard

---

## 5단계: 비밀번호 변경 (권장)

각 사용자가 첫 로그인 후 비밀번호를 변경하는 것을 권장합니다.

### Supabase Dashboard에서 비밀번호 변경
1. Authentication → Users
2. 사용자 선택
3. "Reset Password" 또는 "Send Password Recovery"

---

## 🔒 보안 주의사항

1. **임시 비밀번호는 즉시 변경하세요**
2. **프로덕션 환경에서는 강력한 비밀번호 정책 적용**
3. **2FA (Two-Factor Authentication) 활성화 권장**
4. **정기적인 비밀번호 변경 권장**

---

## 🐛 문제 해결

### 문제 1: 로그인 후 프로필이 없음
```sql
-- 프로필 수동 생성
INSERT INTO user_profiles (id, email, full_name, role, can_access_admin)
VALUES (
  'USER_ID_FROM_AUTH_USERS',  -- auth.users 테이블에서 ID 확인
  'email@example.com',
  'Full Name',
  'admin',
  TRUE
);
```

### 문제 2: Admin 접근 불가
```sql
-- Admin 권한 부여
UPDATE user_profiles
SET can_access_admin = TRUE
WHERE email = 'your@email.com';
```

### 문제 3: 계정이 비활성화됨
```sql
-- 계정 활성화
UPDATE user_profiles
SET status = 'active'
WHERE email = 'your@email.com';
```

---

## ✅ 완료 체크리스트

- [ ] Supabase에서 3명의 사용자 생성
- [ ] user_profiles 테이블 권한 설정
- [ ] 각 계정 로그인 테스트
- [ ] Admin 접근 권한 확인
- [ ] 비밀번호 변경 안내
- [ ] 실제 사용자에게 로그인 정보 전달

---

생성일: 2025-11-21
프로젝트: ANH WMS v2 Authentication

