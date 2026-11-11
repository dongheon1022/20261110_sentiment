// ==============================================================================
// server.js
// 로컬 개발 환경용 Express 웹 서버
// - public/ 폴더의 정적 웹페이지(HTML, CSS, JS)를 호스팅합니다.
// - api/analyze.js 핸들러를 /api/analyze 엔드포인트로 연결합니다.
// ==============================================================================

// .env 환경 변수 로드
require('dotenv').config();

const express = require('express');
const path = require('path');
const analyzeHandler = require('./api/analyze');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON 요청 본문 파싱 미들웨어 (최대 1MB 허용)
app.use(express.json({ limit: '1mb' }));

// 정적 파일 제공 (public 디렉터리)
app.use(express.static(path.join(__dirname, 'public')));

// /api/analyze 엔드포인트 등록
app.all('/api/analyze', (req, res) => {
  return analyzeHandler(req, res);
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`[ASCEN] 로컬 개발 서버가 성공적으로 시작되었습니다!`);
  console.log(`- 웹 브라우저 주소: http://localhost:${PORT}`);
  console.log(`====================================================`);
});

