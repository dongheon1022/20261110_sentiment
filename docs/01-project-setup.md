# 01. 프로젝트 생성 및 기본 구조

## 목적
HTML/CSS/JavaScript와 Node.js 기반으로 ASCEN의 실행 가능한 최소 구조를 만든다. 프런트엔드 프레임워크는 사용하지 않는다.

## 권장 디렉터리 구조

```text
ascen/
├─ api/
│  └─ analyze.js             # Vercel 서버리스 API
├─ public/
│  ├─ index.html
│  ├─ css/
│  │  └─ style.css
│  ├─ js/
│  │  └─ app.js
│  └─ images/
│     └─ hero-mountain.webp  # 준비된 로컬 이미지가 있을 때만 사용
├─ docs/
├─ .env.example
├─ .gitignore
├─ package.json
├─ vercel.json               # 필요한 경우에만 설정
├─ AGENTS.md
└─ PRD.md
```

## 생성 순서

1. Node.js LTS가 설치되어 있는지 확인한다.
2. 프로젝트 폴더와 위 구조를 만든다.
3. `package.json`에 실행 및 테스트 스크립트를 정의한다.
4. 서버 측 의존성으로 OpenAI SDK와 Supabase JS SDK를 설치한다.
5. 프런트엔드는 순수 HTML/CSS/JavaScript로 구현한다.
6. `.env.example`에는 변수 이름과 가짜 예시만 기록한다.
7. `.gitignore`에 `node_modules/`, `.env`, `.env.*.local`, 로그 파일을 추가한다. `.env.example`은 커밋 가능하게 예외 처리한다.

## 환경 변수 이름

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- `OPENAI_MODEL`은 서버 설정으로만 읽는다. 특정 모델이 계정에서 사용 가능한지 배포 전에 확인한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회할 수 있는 관리자 비밀 키다. 브라우저 코드에 절대 전달하지 않는다.
- 실제 키를 문서, 테스트 코드, Git 저장소에 기록하지 않는다.

## 완료 기준

- `npm install`이 오류 없이 끝난다.
- 로컬 개발 서버에서 정적 페이지를 열 수 있다.
- 서버리스 API 파일이 Vercel 함수 규칙에 맞는 형태로 준비되어 있다.
- `.env.example`과 `.gitignore`가 존재한다.
