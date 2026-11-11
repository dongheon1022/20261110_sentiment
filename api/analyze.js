// ==============================================================================
// api/analyze.js
// ASCEN 백엔드 감성 분석 API 핸들러
// - OpenAI API를 호출하여 한국어 텍스트의 감정(positive/negative/neutral)을 분석합니다.
// - 분석 결과를 Supabase analyses 테이블에 저장합니다.
// - Vercel Serverless Function 및 로컬 Express 서버 양쪽에서 모두 호환됩니다.
// ==============================================================================

const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// 환경 변수 설정
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// OpenAI 클라이언트 초기화
let openaiClient = null;
if (OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
}

// Supabase 클라이언트 초기화 (RLS 우회 가능한 Service Role 키 사용)
let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * API 요청 처리 핵심 핸들러 함수
 * @param {object} req - HTTP 요청 객체
 * @param {object} res - HTTP 응답 객체
 */
async function handler(req, res) {
  // 1. HTTP 메서드 검증 (POST 요청만 허용)
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: '지원하지 않는 요청입니다.',
      },
    });
  }

  try {
    // 2. 요청 본문(body) 확인
    const body = req.body || {};
    const text = body.text;

    // 3. 입력값 형식 및 길이 검증 (1 ~ 5,000자)
    if (typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '1~5,000자 텍스트를 입력해 주세요.',
        },
      });
    }

    const trimmedText = text.trim();
    if (trimmedText.length < 1 || trimmedText.length > 5000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '1~5,000자 텍스트를 입력해 주세요.',
        },
      });
    }

    // 4. 서버 환경 변수 누락 여부 검사
    if (!OPENAI_API_KEY) {
      console.error('[Configuration Error] OPENAI_API_KEY가 설정되지 않았습니다.');
      return res.status(500).json({
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: '서비스 설정 오류입니다. 잠시 후 다시 시도해 주세요.',
        },
      });
    }

    // 5. OpenAI 감성 분석 요청
    // JSON 모드를 활성화하여 항상 규격화된 JSON 문자열로 답변을 받습니다.
    const systemPrompt = `당신은 한국어 텍스트의 감성 분류 도우미입니다.
입력 텍스트 전체에서 가장 두드러지는 감정을 positive, negative, neutral 중 하나로 분류하세요.
입력에 없는 사실이나 작성자의 숨은 의도를 추측하지 마세요.
풍자나 맥락 부족으로 판단이 어려우면 보수적으로 분류하세요.
confidence는 판단에 대한 자기평가 점수(0~100 정수)이며 검증된 확률이 아닙니다.
reasons는 입력에서 직접 확인 가능한 근거를 한국어로 1~3개 작성하세요.
반드시 아래 JSON 스키마 형식으로만 응답하세요:
{
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": 85,
  "reasons": ["근거1", "근거2"]
}`;

    let aiRawResponseText = '';
    try {
      const completion = await openaiClient.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimmedText },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2, // 보수적이고 일관된 결과를 위해 낮은 온도로 설정
      });

      aiRawResponseText = completion.choices[0]?.message?.content || '';
    } catch (apiError) {
      // 보안 준수: 에러 객체 자체나 API 키, 원문은 외부에 노출하지 않고 안전한 코드만 반환
      console.error('[OpenAI Error] API 호출 실패:', apiError.message);
      return res.status(502).json({
        success: false,
        error: {
          code: 'AI_SERVICE_ERROR',
          message: '분석 서비스를 일시적으로 사용할 수 없습니다.',
        },
      });
    }

    // 6. AI 응답 스키마 검증
    let parsedData = null;
    try {
      parsedData = JSON.parse(aiRawResponseText);
    } catch (parseErr) {
      console.error('[JSON Parse Error] AI 응답 파싱 실패');
      return res.status(502).json({
        success: false,
        error: {
          code: 'AI_RESPONSE_INVALID',
          message: '분석 결과를 처리하지 못했습니다. 다시 시도해 주세요.',
        },
      });
    }

    const allowedSentiments = ['positive', 'negative', 'neutral'];
    const isValidSentiment = allowedSentiments.includes(parsedData.sentiment);
    const isValidConfidence =
      Number.isInteger(parsedData.confidence) &&
      parsedData.confidence >= 0 &&
      parsedData.confidence <= 100;
    const isValidReasons =
      Array.isArray(parsedData.reasons) &&
      parsedData.reasons.length >= 1 &&
      parsedData.reasons.length <= 3 &&
      parsedData.reasons.every((r) => typeof r === 'string' && r.trim().length > 0);

    if (!isValidSentiment || !isValidConfidence || !isValidReasons) {
      console.error('[Validation Error] AI 응답 스키마 불일치:', parsedData);
      return res.status(502).json({
        success: false,
        error: {
          code: 'AI_RESPONSE_INVALID',
          message: '분석 결과를 처리하지 못했습니다. 다시 시도해 주세요.',
        },
      });
    }

    const validatedResult = {
      sentiment: parsedData.sentiment,
      confidence: parsedData.confidence,
      reasons: parsedData.reasons,
    };

    // 7. Supabase DB에 저장 시도
    let isSaved = false;
    let saveWarningMessage = null;

    if (supabaseClient) {
      try {
        const { error: dbError } = await supabaseClient.from('analyses').insert([
          {
            input_text: trimmedText,
            sentiment: validatedResult.sentiment,
            confidence: validatedResult.confidence,
            reasons: validatedResult.reasons,
          },
        ]);

        if (dbError) {
          console.error('[Supabase Error] DB 저장 실패:', dbError.message);
          isSaved = false;
          saveWarningMessage = '분석 결과를 데이터베이스에 저장하지 못했습니다.';
        } else {
          isSaved = true;
        }
      } catch (dbEx) {
        console.error('[Supabase Exception] DB 저장 예외 발생:', dbEx.message);
        isSaved = false;
        saveWarningMessage = '분석 결과를 데이터베이스에 저장하지 못했습니다.';
      }
    } else {
      isSaved = false;
      saveWarningMessage = '데이터베이스 설정이 없어 결과가 저장되지 않았습니다.';
    }

    // 8. 최종 응답 반환
    // 정책: DB 저장이 실패하더라도 분석 결과 자체는 사용자에게 성공적으로 표시합니다.
    const responsePayload = {
      success: true,
      data: validatedResult,
      saved: isSaved,
    };

    if (!isSaved && saveWarningMessage) {
      responsePayload.warning = saveWarningMessage;
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('[Internal Error] 예상치 못한 서버 에러:', err.message);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
    });
  }
}

module.exports = handler;

