# 나만의 옷장 (My AI Closet)

보유한 의류 목록과 사진·메타데이터를 기반으로 코디를 추천하고, 구매 전 중복 여부와 활용 가치를 점검해 주는 한국어 AI 개인 옷장 어시스턴트입니다.

## 주요 기능

1. **내 옷장 (의류 등록 · CSV · 사진 AI 자동 분석)**: 카메라 촬영 또는 이미지 업로드를 통해 AI가 카테고리·색상·소재·스타일·핏·상세 디테일을 자동 추출합니다.
2. **스타일 선호도**: 상황(TPO), 계절, 선호 스타일, 추가 요청사항을 설정합니다.
3. **옷장 분석기**: 보유 의류 분포, 색상·소재 현황, 중복 주의 구간, AI 심층 진단을 제공합니다.
4. **코디 추천기**: 보유 의류 목록(`itemIds`) 내 아이템만 조합해 3가지 코디와 활용 팁을 제안합니다.
5. **구매 후보 · 구매 어드바이저**: 새 옷 구매 전 호환성, 활용도, 중복성, 기존 옷 대안 코디를 평가합니다.
6. **실사 코디 미리보기**: 선택한 추천 코디의 실제 의류 사진을 조합해 얼굴이 제외된 3:4 전신 착장 이미지를 생성합니다.
7. **패션 어시스턴트 챗봇**: 보유 의류, 추천 코디, 옷장 요약, 구매 후보 데이터를 질문에 직접 첨부하여 멀티모달 스타일 상담을 진행합니다.

## 기술 스택

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, Lucide React
- **Backend**: Express (Node.js ESM), `@google/genai` (서버 측 전용 Gemini API 연동)
- **배포 구조**: 단일 Node Web Service에서 `/api/*` API 라우트와 프로덕션 정적 빌드(`dist/`)를 함께 서빙합니다.

---

## 로컬 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사하여 `.env` 파일을 만들고 `GEMINI_API_KEY`를 입력합니다. (`.env` 파일은 `.gitignore`에 의해 GitHub에 올라가지 않습니다.)

```bash
cp .env.example .env
```

`.env` 예시:

```env
GEMINI_API_KEY=your_actual_gemini_api_key
PORT=3000
NODE_ENV=development
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

### 4. 프로덕션 빌드 및 로컬 검증

```bash
npm run build
npm run start:prod
```

- 헬스체크 확인: `GET http://localhost:3000/health` 및 `GET http://localhost:3000/api/health`
- 단위 테스트 실행: `npm test`

---

## 환경변수 설명

| 변수명 | 필수 여부 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | **필수** | - | Google Gemini API 키 (서버 측에서만 사용) |
| `PORT` | 선택 | `3000` | HTTP 서버 포트 (Render에서는 자동 주입됨) |
| `NODE_ENV` | 선택 | `development` | 프로덕션 배포 시 `production` 설정 |
| `CORS_ORIGINS` | 선택 | `RENDER_EXTERNAL_URL` | 쉼표로 구분된 추가 허용 출처(Origin) 목록 |
| `RATE_LIMIT_WINDOW_MS` | 선택 | `60000` | Rate Limiting 기준 시간(ms) |
| `RATE_LIMIT_MAX` | 선택 | `20` | 시간 내 IP당 일반 AI API 최대 호출 수 |
| `PREVIEW_RATE_LIMIT_MAX` | 선택 | `8` | 시간 내 IP당 실사 코디 이미지 생성 최대 호출 수 |

---

## Render 배포 방법

이 프로젝트는 프론트엔드(`Vite` 정적 빌드)와 백엔드(`Express` + `Gemini API`)를 **하나의 Render Web Service**로 배포하도록 구성되어 있습니다.

### 방법 A: `render.yaml` Blueprint로 자동 배포

1. 이 저장소를 GitHub Repository에 푸시합니다.
2. [Render 대시보드](https://dashboard.render.com/)에서 **New + > Blueprint**를 선택하고 GitHub 저장소를 연결합니다.
3. `render.yaml`이 자동으로 감지되면 서비스 설정을 확인하고 **Apply**를 누릅니다.
4. `GEMINI_API_KEY` 입력 프롬프트(또는 배포 후 **Environment** 탭)에 실제 Gemini API 키를 입력합니다.

### 방법 B: Render Web Service 수동 생성

1. Render 대시보드에서 **New + > Web Service**를 선택하고 GitHub 저장소를 연결합니다.
2. 아래와 같이 서비스 설정을 입력합니다.
   - **Runtime**: `Node`
   - **Build Command**: `npm install --include=dev && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Health Check Path**: `/health`
3. **Environment** 탭에서 환경변수를 등록합니다.
   - `NODE_ENV` = `production`
   - `GEMINI_API_KEY` = `(실제 Google Gemini API 키)`
   - (선택) 커스텀 도메인을 연결하는 경우 `CORS_ORIGINS` = `https://your-domain.com`
4. **Create Web Service**를 클릭해 배포를 시작합니다.

---

## 보안 및 운영 참고사항

- **API 키 격리**: `GEMINI_API_KEY`는 오직 서버(`dist/server.js`)에서만 읽으며, 프론트엔드 번들(`dist/assets/*.js`), URL, 오류 응답에 노출되지 않습니다.
- **오류 응답 마스킹**: 외부 AI API 오류가 발생하더라도 키 문자열이나 인증 헤더, 스택 트레이스는 마스킹/제거한 뒤 한국어 안내 문구만 반환합니다.
- **Rate Limiting 및 입력 제한**: `/api/wardrobe/*` 경로에 IP 기반 Rate Limiting과 요청 본문 크기(6MB)·목록 개수 제한이 적용되어 있습니다.
- **공개 접근 제어 안내**: 현재 앱은 로그인 없이 `localStorage` 기반으로 동작하는 단일 사용자/데모용 구조입니다. 불특정 다수에게 공개 URL을 장기 운영하는 경우 Render 앞단 인증(Cloudflare Access 등)이나 사용자 인증 레이어를 추가해 AI API 과금 남용을 방지하는 것을 권장합니다.
