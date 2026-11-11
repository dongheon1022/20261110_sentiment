// ==============================================================================
// public/js/app.js
// ASCEN 프런트엔드 비즈니스 로직
// - 글자 수 실시간 계산 (1 ~ 5,000자)
// - 단일 상태(idle, loading, success, error) 관리
// - XSS 방지: textContent를 통한 안전한 텍스트 렌더링
// - 접근성 및 에러 처리 (네트워크 오류, 입력 오류, 저장 실패 경고)
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소 선택
  const form = document.getElementById('sentiment-form');
  const textInput = document.getElementById('text-input');
  const charCount = document.getElementById('char-count');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnSpinner = submitBtn.querySelector('.btn-spinner');

  const inputErrorMsg = document.getElementById('input-error-msg');
  const generalErrorSection = document.getElementById('general-error-section');
  const generalErrorMsg = document.getElementById('general-error-msg');
  const retryBtn = document.getElementById('retry-btn');

  const resultSection = document.getElementById('result-section');
  const sentimentBadge = document.getElementById('sentiment-badge');
  const sentimentIcon = document.getElementById('sentiment-icon');
  const sentimentText = document.getElementById('sentiment-text');
  const confidenceValue = document.getElementById('confidence-value');
  const confidenceProgress = document.getElementById('confidence-progress');
  const confidenceBarContainer = document.getElementById('confidence-bar-container');
  const reasonsList = document.getElementById('reasons-list');
  const dbWarningBanner = document.getElementById('db-warning-banner');

  // 감정별 한국어 라벨 및 아이콘 매핑
  const SENTIMENT_MAP = {
    positive: { text: '긍정', icon: '✦', class: 'positive' },
    negative: { text: '부정', icon: '▲', class: 'negative' },
    neutral: { text: '중립', icon: '―', class: 'neutral' },
  };

  /**
   * UI 상태 전환 함수 (idle, loading, success, error)
   * 상충되는 화면 상태가 동시에 나타나지 않도록 단일 함수로 제어합니다.
   */
  function setUiState(state, payload = {}) {
    switch (state) {
      case 'idle':
        submitBtn.disabled = false;
        btnText.textContent = '감정 분석하기';
        btnSpinner.classList.add('hidden');
        inputErrorMsg.classList.add('hidden');
        generalErrorSection.classList.add('hidden');
        break;

      case 'loading':
        submitBtn.disabled = true;
        btnText.textContent = '분석하는 중...';
        btnSpinner.classList.remove('hidden');
        inputErrorMsg.classList.add('hidden');
        generalErrorSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        break;

      case 'success':
        submitBtn.disabled = false;
        btnText.textContent = '감정 분석하기';
        btnSpinner.classList.add('hidden');
        inputErrorMsg.classList.add('hidden');
        generalErrorSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
        renderAnalysisResult(payload.data, payload.saved, payload.warning);
        break;

      case 'error':
        submitBtn.disabled = false;
        btnText.textContent = '감정 분석하기';
        btnSpinner.classList.add('hidden');

        if (payload.isInputError) {
          inputErrorMsg.textContent = payload.message || '입력값을 확인해 주세요.';
          inputErrorMsg.classList.remove('hidden');
        } else {
          generalErrorMsg.textContent = payload.message || '분석 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
          generalErrorSection.classList.remove('hidden');
        }
        break;
    }
  }

  /**
   * 분석 결과 렌더링
   * XSS 공격을 방지하기 위해 반드시 textContent를 사용합니다.
   */
  function renderAnalysisResult(data, isSaved, warningMessage) {
    if (!data) return;

    const { sentiment, confidence, reasons } = data;
    const sentimentConfig = SENTIMENT_MAP[sentiment] || SENTIMENT_MAP.neutral;

    // 1. 감정 배지 설정
    sentimentBadge.className = `sentiment-badge ${sentimentConfig.class}`;
    sentimentIcon.textContent = sentimentConfig.icon;
    sentimentText.textContent = sentimentConfig.text;

    // 2. 신뢰도 게이지 설정
    const safeConfidence = Math.max(0, Math.min(100, Math.round(confidence || 0)));
    confidenceValue.textContent = `${safeConfidence}%`;
    confidenceProgress.style.width = `${safeConfidence}%`;
    confidenceBarContainer.setAttribute('aria-valuenow', safeConfidence);

    // 3. 근거 목록 표시
    reasonsList.innerHTML = '';
    if (Array.isArray(reasons)) {
      reasons.forEach((reason) => {
        const li = document.createElement('li');
        li.textContent = reason; // HTML 이스케이프 보장
        reasonsList.appendChild(li);
      });
    }

    // 4. Supabase DB 저장 실패 시 소프트 경고 메시지 표시
    if (isSaved === false) {
      dbWarningBanner.textContent = warningMessage || '※ 분석 결과는 도출되었으나, 데이터베이스에 저장되지 않았습니다.';
      dbWarningBanner.classList.remove('hidden');
    } else {
      dbWarningBanner.classList.add('hidden');
    }

    // 결과 영역으로 부드럽게 스크롤
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * 실시간 글자 수 카운터 업데이트
   */
  function updateCharCount() {
    const length = textInput.value.length;
    charCount.textContent = `${length.toLocaleString()} / 5,000자`;

    if (length > 5000) {
      charCount.classList.add('limit-exceeded');
    } else {
      charCount.classList.remove('limit-exceeded');
    }
  }

  // 글자 입력 이벤트 리스너
  textInput.addEventListener('input', updateCharCount);

  /**
   * 감정 분석 요청 전송
   */
  async function performAnalysis() {
    const rawText = textInput.value;
    const trimmedText = rawText.trim();

    // 프런트엔드 유효성 검사
    if (trimmedText.length === 0) {
      setUiState('error', {
        isInputError: true,
        message: '분석할 텍스트를 입력해 주세요.',
      });
      textInput.focus();
      return;
    }

    if (trimmedText.length > 5000) {
      setUiState('error', {
        isInputError: true,
        message: '텍스트는 최대 5,000자까지 입력 가능합니다.',
      });
      textInput.focus();
      return;
    }

    // 로딩 상태 시작
    setUiState('loading');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: trimmedText }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result || !result.success) {
        // 서버에서 반환한 검증 오류인지 일반 오류인지 구분
        const errorCode = result?.error?.code;
        const errorMessage = result?.error?.message;

        if (errorCode === 'VALIDATION_ERROR') {
          setUiState('error', {
            isInputError: true,
            message: errorMessage || '1~5,000자 텍스트를 입력해 주세요.',
          });
        } else {
          setUiState('error', {
            isInputError: false,
            message: errorMessage || '분석 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
          });
        }
        return;
      }

      // 성공 시 결과 화면 반영
      setUiState('success', {
        data: result.data,
        saved: result.saved,
        warning: result.warning,
      });
    } catch (networkError) {
      // 통신 단절, 오프라인 등 네트워크 오류
      console.error('[Network Error]:', networkError);
      setUiState('error', {
        isInputError: false,
        message: '연결이 원활하지 않습니다. 네트워크 상태를 확인한 후 다시 시도해 주세요.',
      });
    }
  }

  // 폼 제출 이벤트 리스너
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    performAnalysis();
  });

  // 재시도 버튼 클릭 리스너
  retryBtn.addEventListener('click', () => {
    generalErrorSection.classList.add('hidden');
    performAnalysis();
  });

  // 초기화
  updateCharCount();
});

