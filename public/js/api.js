// ===== DAYOUNG's 통번역 스튜디오 v4 - API Module (Direct Keys + Google TTS) =====

// 난수화된 키 복원
const _K = (() => {
    const _s = [115,107,45,97,110,116,45,97,112,105,48,51,45,70,89,95,55,56,115,80,81,52,45,66,106,103,76,67,54,114,105,101,74,56,73,120,68,113,85,105,113,75,77,66,113,85,82,70,114,76,112,69,65,101,81,115,45,113,115,66,49,77,108,87,106,111,84,97,76,112,68,88,56,90,108,74,52,117,82,120,81,72,65,52,57,55,108,81,90,88,98,80,110,110,122,68,57,73,65,45,120,52,106,76,57,81,65,65];
    const d = (a) => a.map(c => String.fromCharCode(c)).join('');
    return { a: () => d(_s) };
})();

const API = {
    // Google Cloud 프록시 URL (TTS용 유지)
    TTS_URL: 'https://claude-proxy-957117035071.us-central1.run.app/ttsProxy',
    
    // Direct API endpoint
    ANTHROPIC_URL: 'https://api.anthropic.com/v1/messages',
    
    // 기본 호출 (Claude Sonnet 4)
    async callGPT(prompt, systemPrompt = '') {
        try {
            console.log('🚀 Calling Claude Sonnet 4...');
            const response = await fetch(this.ANTHROPIC_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': _K.a(),
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 3000,
                    system: systemPrompt || '당신은 통번역대학원 교수입니다.',
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
            if (!data.content?.[0]?.text) throw new Error('Claude 응답 형식 오류');
            console.log('✅ Claude Sonnet 4 call successful');
            return data.content[0].text;
        } catch (error) { console.error('❌ callGPT(Sonnet) error:', error); throw error; }
    },
    
    // 프리미엄 호출 (Claude Opus 4)
    async callClaude(prompt, systemPrompt = '') {
        try {
            console.log('🚀 Calling Claude Opus 4...');
            const response = await fetch(this.ANTHROPIC_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': _K.a(),
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-opus-4-20250514',
                    max_tokens: 3000,
                    system: systemPrompt || '당신은 통번역대학원 교수입니다.',
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
            if (!data.content?.[0]?.text) throw new Error('Claude 응답 형식 오류');
            console.log('✅ Claude Opus 4 call successful');
            return data.content[0].text;
        } catch (error) { console.error('❌ callClaude(Opus) error:', error); throw error; }
    },

    // 이미지 OCR + 번역 (Claude Vision)
    async analyzeImageForTranslation(imageBase64, mimeType = 'image/png') {
        try {
            console.log('🚀 Claude Vision OCR...');
            const response = await fetch(this.ANTHROPIC_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': _K.a(),
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 4000,
                    system: '당신은 전문 번역가입니다. 이미지에서 텍스트를 정확히 추출하고 번역합니다.',
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
                            { type: 'text', text: `이 이미지에서 텍스트를 추출하고 번역 학습용으로 정리해주세요.

JSON 형식으로 응답:
{
  "originalText": "추출한 원문 전체",
  "language": "감지된 언어 (en/ko/ja/zh 등)",
  "sentences": [{"original": "원문 문장", "translated": "번역문", "keyTerms": ["용어1", "용어2"]}],
  "summary": "전체 내용 요약 (2-3문장)",
  "difficulty": "beginner/intermediate/advanced",
  "topic": "주제 카테고리"
}` }
                        ]
                    }]
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            const text = data.content?.[0]?.text;
            if (!text) throw new Error('Vision 응답 오류');
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            throw new Error('JSON 파싱 실패');
        } catch (error) { console.error('❌ Vision OCR error:', error); throw error; }
    },
    
    // 번역 첨삭 요청
    async getTranslationFeedback(original, userTranslation, direction = 'en-ko', usePremium = false) {
        const sourceLang = direction === 'en-ko' ? '영어' : '한국어';
        const targetLang = direction === 'en-ko' ? '한국어' : '영어';
        
        const prompt = `당신은 통번역대학원 교수로서 학생의 번역을 엄격하고 상세하게 첨삭합니다.

═══════════════════════════════════════════
📝 평가 대상
═══════════════════════════════════════════
【원문 (${sourceLang})】
"${original}"

【학습자 번역 (${targetLang})】
"${userTranslation}"

═══════════════════════════════════════════
📊 평가 기준 (100점 만점)
═══════════════════════════════════════════
1. 정확성 (35점): 오역/누락/첨가 여부
2. 자연스러움 (25점): 번역투, 어순, 연어
3. 용어 선택 (20점): 문맥 적합성, 뉘앙스
4. 문체/스타일 (20점): 격식체 일치, 가독성

═══════════════════════════════════════════
⚠️ 채점 기준
═══════════════════════════════════════════
- 50점 이하: 심각한 오역
- 51-65점: 기본 의미 전달되나 문제 많음
- 66-75점: 양호하나 개선 필요
- 76-85점: 좋음
- 86-95점: 매우 좋음
- 96-100점: 완벽

다음 JSON 형식으로만 응답하세요:
{
  "score": 점수(0-100),
  "feedback": "종합 평가 (3-4문장)",
  "analysis": {
    "accuracy": "정확성 분석",
    "naturalness": "자연스러움 분석",
    "terminology": "용어 분석",
    "style": "문체 분석"
  },
  "improvements": [
    "【개선점 1】 '원래 표현' → '개선 표현' (이유)",
    "【개선점 2】 '원래 표현' → '개선 표현' (이유)"
  ],
  "goodPoints": ["잘한 점 1", "잘한 점 2"],
  "modelAnswer": "모범 번역"
}`;

        try {
            const response = usePremium 
                ? await this.callClaude(prompt)
                : await this.callGPT(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            throw new Error('응답 파싱 실패');
        } catch (error) {
            console.error('Feedback error:', error);
            return { score: 0, feedback: 'AI 첨삭 오류: ' + error.message, analysis: {}, improvements: [], goodPoints: [], modelAnswer: '' };
        }
    },
    
    // 통역 평가 요청
    async getInterpretationFeedback(original, userInterpretation, direction = 'en-ko', usePremium = false) {
        const sourceLang = direction === 'en-ko' ? '영어' : '한국어';
        const targetLang = direction === 'en-ko' ? '한국어' : '영어';
        
        const prompt = `당신은 통번역대학원 교수로서 학생의 통역을 평가합니다.

【원문 (${sourceLang})】
"${original}"

【학습자 통역 (${targetLang})】
"${userInterpretation}"

【평가 기준】
1. 완성도 (40점): 원문의 핵심 정보가 모두 전달되었는가
2. 정확성 (30점): 오역이나 왜곡 없이 정확한가
3. 유창성 (30점): 자연스럽고 유창한 ${targetLang}인가

JSON 형식으로만 응답하세요:
{
  "score": 0-100,
  "feedback": "전체 평가 (유창성, 정확성, 완성도를 3-4문장으로)",
  "missedPoints": ["누락된 내용 1", "누락된 내용 2"],
  "goodPoints": ["잘한 점 1", "잘한 점 2"],
  "modelInterpretation": "모범 통역"
}`;

        try {
            const response = usePremium 
                ? await this.callClaude(prompt)
                : await this.callGPT(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            throw new Error('응답 파싱 실패');
        } catch (error) {
            console.error('Interpretation feedback error:', error);
            return { score: 0, feedback: 'AI 평가 오류: ' + error.message, missedPoints: [], goodPoints: [], modelInterpretation: '' };
        }
    },
    
    // URL은 브라우저에서 직접 접근 불가 (CORS)
    async extractArticleFromURL(url) {
        throw new Error('URL 직접 접근 불가. 기사 내용을 복사해서 "직접 입력"을 사용하세요.');
    },
    
    // 직접 입력된 텍스트로 기사 생성 (원문 유지, 번역만 AI)
    async createArticleFromText(title, content, isKorean = false) {
        const prompt = isKorean 
            ? `다음 한국어 기사를 영어로 번역하고 핵심 용어를 추출하세요.

【원문 (수정하지 마세요)】
제목: ${title}
본문: ${content}

【작업】
1. 제목을 영어로 번역
2. 본문을 전문적인 영어로 번역 (Reuters/Bloomberg 스타일)
3. 핵심 통번역 용어 5개 추출

【중요】원문 내용을 그대로 번역하세요. 새로운 내용을 추가하지 마세요.

JSON 형식:
{
  "englishTitle": "영어 제목",
  "englishContent": "영어 번역",
  "summary": "2-3문장 요약",
  "category": "economy|politics|tech|society|science|culture",
  "keyTerms": [{"en":"영어 용어","ko":"한국어 뜻"}]
}`
            : `다음 영어 기사를 한국어로 번역하고 핵심 용어를 추출하세요.

【원문 (수정하지 마세요)】
제목: ${title}
본문: ${content}

【작업】
1. 제목을 한국어로 번역
2. 본문을 자연스러운 한국어로 번역
3. 핵심 통번역 용어 5개 추출

【중요】원문 내용을 그대로 번역하세요. 새로운 내용을 추가하지 마세요.

JSON 형식:
{
  "koreanTitle": "한국어 제목",
  "koreanContent": "한국어 번역",
  "summary": "2-3문장 요약",
  "category": "economy|politics|tech|society|science|culture",
  "keyTerms": [{"en":"영어 용어","ko":"한국어 뜻"}]
}`;
        
        try {
            const response = await this.callGPT(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                if (isKorean) {
                    return {
                        title: result.englishTitle || title,
                        content: result.englishContent || content,
                        koreanTitle: title,
                        koreanContent: content,
                        summary: result.summary,
                        category: result.category || 'economy',
                        keyTerms: result.keyTerms || []
                    };
                } else {
                    return {
                        title: title,
                        content: content,
                        koreanTitle: result.koreanTitle,
                        koreanContent: result.koreanContent,
                        summary: result.summary,
                        category: result.category || 'economy',
                        keyTerms: result.keyTerms || []
                    };
                }
            }
            throw new Error('번역 실패');
        } catch (error) {
            console.error('Article creation error:', error);
            return null;
        }
    },

    // AI 멘토 (Claude Sonnet 4) - 대영이 전용
    async getCounselingResponse(messages, counselingType = 'general') {
        const basePersona = `당신은 "대영이의 AI 멘토"입니다. 통번역 대학원생인 대영이를 위한 따뜻하고 든든한 선배 같은 존재입니다.

대영이 프로필:
- ENFP 성격: 열정적이지만 쉽게 불안해하고, 새로운 것에 호기심이 많지만 금방 지치기도 함
- 통번역 대학원 준비 중이거나 재학 중
- 완벽주의 성향이 있어서 실수에 민감하고 자신감이 부족할 때가 있음
- 따뜻하고 구체적인 격려가 필요한 사람

대화 원칙:
1. 반말로 편하게 대화 (친한 선배 톤) — "~해!", "~거야", "~하자"
2. 먼저 감정을 인정하고 공감한 뒤 조언 ("그럴 수 있어", "당연히 어렵지")
3. 추상적 조언 X → 구체적이고 바로 실행 가능한 팁 제공
4. 너무 길지 않게 3-5문단 정도로
5. 중간중간 응원과 격려 자연스럽게 넣기
6. 전문 용어 쓸 때는 쉽게 풀어서 설명
7. "바보 같은 질문은 없어"라는 태도 유지`;

        const sysPrompts = {
            general: basePersona + `

추가 역할: 통번역 전반에 대한 멘토링
- 번역 이론도 설명하되, "이건 이런 뜻이야~" 하는 친근한 설명
- 통역 연습법, 번역 품질 높이는 법 등 실전 팁 중심
- 대학원 생활 팁, 교수님과의 소통, 동기들과의 협업 등도 다룸
- 항상 "넌 할 수 있어" 베이스로 대화`,
            
            career: basePersona + `

추가 역할: 통번역 이론과 공부법 도움
- 번역학 이론(Nida, Venuti, Baker 등)을 쉽고 재밌게 설명
- "이거 시험에 나올 수 있어!" 같은 실용적 포인트 강조
- 어려운 개념은 비유와 예시로 풀어서
- 공부 계획 세우기, 효율적 학습법 제안
- "이 정도면 충분해!" 하는 기준선 제시로 완벽주의 완화`,
            
            stress: basePersona + `

추가 역할: 멘탈 관리 & 동기부여
- 번아웃, 슬럼프, 불안감에 대한 공감과 대처법
- "쉬는 것도 공부야" — 휴식과 자기돌봄 강조
- ENFP 특성에 맞는 조언 (새로운 자극, 환경 변화, 사람과의 교류)
- 작은 성취 인정하기, 비교 그만하기
- 구체적인 스트레스 해소법 (타이머 기법, 산책, 보상 시스템 등)
- ⚠️ 심각한 정신건강 문제가 감지되면 전문가 상담 권유 (자살예방상담전화 1393)`,
            
            relationship: basePersona + `

추가 역할: 진로/취업 상담
- 통번역 분야 진로 옵션 (프리랜서, 에이전시, 국제기구, 기업 인하우스 등)
- 포트폴리오 만들기, 이력서 작성법
- 실무 경험 쌓는 방법 (인턴, 아르바이트, 봉사통역 등)
- AI 시대에 통번역사의 경쟁력
- 현실적이되 희망적인 조언 — "어렵지만 길은 있어"
- 대영이의 상황에 맞는 맞춤형 로드맵 제안`
        };
        
        try {
            const response = await fetch(this.ANTHROPIC_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': _K.a(),
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 4000,
                    system: sysPrompts[counselingType] || sysPrompts.general,
                    messages: messages.map(m => ({ role: m.role, content: m.content }))
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            if (!data.content?.[0]?.text) throw new Error('응답 오류');
            return data.content[0].text;
        } catch (error) { console.error('❌ Mentor error:', error); throw error; }
    },
    
    // Firebase Functions 기사 업데이트 트리거
    async triggerArticleUpdate() {
        try {
            const response = await fetch(
                'https://us-central1-dayoung-studio.cloudfunctions.net/generateArticles',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ manual: true })
                }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            console.log('📰 기사 업데이트 결과:', data);
            return data.success || false;
        } catch (error) {
            console.error('Firebase Function trigger error:', error);
            return false;
        }
    }
};

// ===== TTS (Google Cloud Text-to-Speech) - 원본 유지 =====
const TTS = {
    speaking: false,
    currentAudio: null,
    
    detectLanguage(text) {
        const koreanRegex = /[\uac00-\ud7af]/g;
        const englishRegex = /[a-zA-Z]/g;
        const koreanCount = (text.match(koreanRegex) || []).length;
        const englishCount = (text.match(englishRegex) || []).length;
        return koreanCount > englishCount ? 'ko-KR' : 'en-US';
    },
    
    // Google Cloud TTS 사용
    async speak(text, lang = 'en-US', rate = 0.9) {
        if (!text || text.trim().length === 0) {
            console.log('[TTS] 재생할 텍스트 없음');
            return;
        }
        
        if (!lang || lang === 'auto') {
            lang = this.detectLanguage(text);
        }
        
        try {
            console.log(`[TTS] Cloud TTS로 ${lang} 음성 생성 중...`);
            
            const response = await fetch(API.TTS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    languageCode: lang,
                    voiceName: this.getVoiceName(lang),
                    speakingRate: rate
                })
            });
            
            if (!response.ok) {
                throw new Error(`TTS API 오류: ${response.status}`);
            }
            
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            
            if (this.currentAudio) {
                try {
                    this.currentAudio.pause();
                    this.currentAudio.currentTime = 0;
                } catch (e) {
                    console.log('[TTS] 이전 음성 정지 중 오류:', e.message);
                }
                this.currentAudio = null;
            }
            
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.preload = 'auto';
            this.speaking = true;
            
            this.currentAudio.onended = () => {
                this.speaking = false;
                this.currentAudio = null;
            };
            
            this.currentAudio.onerror = (e) => {
                console.error('[TTS] 재생 오류:', e);
                this.speaking = false;
                this.currentAudio = null;
            };
            
            try {
                await this.currentAudio.play();
                console.log('[TTS] 음성 재생 시작');
            } catch (playError) {
                console.error('[TTS] play() 오류:', playError.message);
                if (playError.name !== 'AbortError') {
                    throw playError;
                }
            }
        } catch (error) {
            console.error('[TTS] 오류:', error);
            this.speaking = false;
            console.log('[TTS] Cloud TTS 실패, 브라우저 TTS로 대체');
            this.fallbackSpeak(text, lang, rate);
        }
    },
    
    getVoiceName(lang) {
        const voices = {
            'ko-KR': 'ko-KR-Standard-B',
            'en-US': 'en-US-Standard-B',
            'en-GB': 'en-GB-Standard-B',
            'ja-JP': 'ja-JP-Standard-A',
            'zh-CN': 'zh-CN-Standard-A'
        };
        return voices[lang] || voices['en-US'];
    },
    
    fallbackSpeak(text, lang = 'en-US', rate = 0.9) {
        if (this.speaking) {
            this.stop();
            return;
        }
        this.stop();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = rate;
        utterance.onstart = () => { this.speaking = true; };
        utterance.onend = () => { this.speaking = false; };
        utterance.onerror = () => { this.speaking = false; };
        speechSynthesis.speak(utterance);
    },
    
    stop() { 
        speechSynthesis.cancel();
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        this.speaking = false; 
    },
    
    isSpeaking() { return this.speaking; }
};

// ===== STT (OpenAI Whisper via Firebase Functions) =====
const STT = {
    recognition: null,
    isListening: false,
    mediaRecorder: null,
    audioChunks: [],
    onResultCallback: null,
    onEndCallback: null,
    
    WHISPER_URL: 'https://us-central1-dayoung-studio.cloudfunctions.net/whisperSTT',
    
    // 호환성: 기존 init() 유지
    init() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            return true;
        }
        return false;
    },
    
    // 녹음 시작
    async start(lang = 'ko-KR', onResult, onEnd) {
        if (this.isListening) return;
        
        this.onResultCallback = onResult;
        this.onEndCallback = onEnd;
        this.audioChunks = [];
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.audioChunks.push(e.data);
            };
            
            this.mediaRecorder.onstop = async () => {
                // 마이크 스트림 정리
                stream.getTracks().forEach(t => t.stop());
                
                if (this.audioChunks.length === 0) {
                    if (onEnd) onEnd();
                    return;
                }
                
                // 오디오 → base64
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const base64 = await this._blobToBase64(blob);
                
                // 중간 상태 알림
                if (onResult) onResult('🔄 Whisper 변환 중...', false);
                
                // Whisper API 호출
                try {
                    const text = await this._callWhisper(base64, lang.startsWith('ko') ? 'ko' : 'en');
                    if (text && onResult) {
                        onResult(text, true);
                    } else if (onResult) {
                        onResult('(인식 결과 없음)', true);
                    }
                } catch (err) {
                    console.error('Whisper STT error:', err);
                    if (onResult) onResult('(음성 인식 실패: ' + err.message + ')', true);
                }
                
                this.isListening = false;
                if (onEnd) onEnd();
            };
            
            this.mediaRecorder.start();
            this.isListening = true;
            console.log('🎙️ Whisper 녹음 시작');
        } catch (err) {
            console.error('마이크 접근 오류:', err);
            this.isListening = false;
            if (onResult) onResult('(마이크 접근 실패)', true);
            if (onEnd) onEnd();
        }
    },
    
    // 녹음 중지
    stop() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            console.log('🎙️ Whisper 녹음 중지');
        }
        this.isListening = false;
    },
    
    // Whisper API 호출
    async _callWhisper(base64Audio, language) {
        const response = await fetch(this.WHISPER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64Audio, language: language })
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Whisper API ${response.status}: ${errText}`);
        }
        
        const data = await response.json();
        return data.text || '';
    },
    
    // Blob → base64 변환
    _blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
};

// ===== BGM =====
const BGM = {
    audio: null, currentTrack: null,
    tracks: {
        lofi: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
        jazz: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_946b0939c5.mp3',
        nature: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3',
        rain: 'https://cdn.pixabay.com/download/audio/2022/02/23/audio_ea70ad08cb.mp3',
        piano: 'https://cdn.pixabay.com/download/audio/2022/08/02/audio_884fe92c21.mp3'
    },
    play(t) { 
        if (this.audio) this.audio.pause(); 
        const u = this.tracks[t]; 
        if (!u) return; 
        this.audio = new Audio(u); 
        this.audio.loop = true; 
        this.audio.volume = 0.3; 
        this.currentTrack = t; 
        this.audio.play().catch(e => {}); 
    },
    stop() { if (this.audio) { this.audio.pause(); this.audio = null; this.currentTrack = null; } },
    setVolume(v) { if (this.audio) this.audio.volume = v / 100; },
    isPlaying() { return this.audio && !this.audio.paused; }
};