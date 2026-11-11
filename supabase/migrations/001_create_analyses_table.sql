-- ==========================================
-- 001_create_analyses_table.sql
-- ASCEN 감성 분석 기록 저장 테이블 생성 스크립트
-- ==========================================

-- 1. analyses 테이블 생성
-- 사용자가 입력한 한국어 텍스트와 AI 분석 결과(감정 라벨, 신뢰도, 근거 이유)를 저장합니다.
CREATE TABLE IF NOT EXISTS public.analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),               -- 고유 식별자 (UUID 자동 생성)
    input_text TEXT NOT NULL,                                   -- 분석 대상 원문 텍스트
    sentiment TEXT NOT NULL                                     -- 감정 라벨 ('positive', 'negative', 'neutral'만 허용)
        CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    confidence INTEGER NOT NULL                                 -- AI 판단 신뢰도 점수 (0 ~ 100 정수)
        CHECK (confidence BETWEEN 0 AND 100),
    reasons JSONB NOT NULL,                                     -- 판단 이유 목록 (문자열 배열)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()               -- 생성 시각 (기본 현재 시각)
);

-- 2. RLS (Row Level Security, 행 수준 보안) 활성화
-- 기본적으로 모든 클라이언트의 직접적인 접근(SELECT, INSERT, UPDATE, DELETE)을 차단합니다.
-- 서버리스 백엔드(Vercel Function)에서 SUPABASE_SERVICE_ROLE_KEY를 통해서만 안전하게 INSERT 작업을 수행합니다.
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

