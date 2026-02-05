// ===== DAYOUNG's 통번역 스튜디오 v3 - Games Module =====

const Games = {
    current: null,
    
    // ===== 단어 퀴즈 =====
    quiz: {
        questions: [],
        currentIndex: 0,
        score: 0,
        answers: [],
        
        start(wordCount = 10, type = 'en-to-kr', range = 'all') {
            let words = range === 'today' 
                ? Storage.getTodayWords() 
                : Storage.getVocabulary();
            
            if (words.length < 4) {
                showToast('최소 4개 단어가 필요합니다', 'error');
                return false;
            }
            
            const shuffled = [...words].sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, Math.min(wordCount, words.length));
            
            this.questions = selected.map(word => {
                const qType = type === 'mixed' 
                    ? (Math.random() > 0.5 ? 'en-to-kr' : 'kr-to-en') 
                    : type;
                
                const question = qType === 'en-to-kr' ? word.english : word.korean;
                const correct = qType === 'en-to-kr' ? word.korean : word.english;
                
                // 오답 3개 선택
                const others = words
                    .filter(w => w.id !== word.id)
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 3)
                    .map(w => qType === 'en-to-kr' ? w.korean : w.english);
                
                const options = [...others, correct].sort(() => Math.random() - 0.5);
                
                return {
                    word,
                    type: qType,
                    question,
                    options,
                    correctIndex: options.indexOf(correct)
                };
            });
            
            this.currentIndex = 0;
            this.score = 0;
            this.answers = [];
            
            return true;
        },
        
        answer(selectedIndex) {
            const q = this.questions[this.currentIndex];
            const isCorrect = selectedIndex === q.correctIndex;
            
            if (isCorrect) this.score++;
            
            this.answers.push({
                question: q,
                selected: selectedIndex,
                correct: isCorrect
            });
            
            // 단어 복습 기록 업데이트
            Storage.updateWord(q.word.id, {
                reviewCount: (q.word.reviewCount || 0) + 1,
                lastReview: new Date().toISOString(),
                mastered: isCorrect && (q.word.reviewCount || 0) >= 3
            });
            
            return isCorrect;
        },
        
        next() {
            this.currentIndex++;
            return this.currentIndex < this.questions.length;
        },
        
        getResult() {
            const percentage = Math.round((this.score / this.questions.length) * 100);
            
            // 기록 저장
            Storage.addHistory({
                type: 'quiz',
                score: this.score,
                total: this.questions.length,
                percentage
            });
            
            // 경험치
            const expGained = this.score * 5;
            Storage.addExp(expGained);
            
            // 업적 체크
            if (percentage === 100) {
                Achievements.check('special', { achievementId: 'quiz_perfect' });
            }
            
            // 최고 점수
            const isNewBest = Storage.setGameBest('quiz', percentage);
            
            return {
                score: this.score,
                total: this.questions.length,
                percentage,
                expGained,
                isNewBest,
                wrongAnswers: this.answers.filter(a => !a.correct)
            };
        }
    },
    
    // ===== 타자 게임 =====
    typing: {
        words: [],
        fallingWords: [],
        score: 0,
        lives: 3,
        level: 1,
        gameLoop: null,
        spawnInterval: null,
        isRunning: false,
        
        start() {
            const vocab = Storage.getVocabulary();
            if (vocab.length < 10) {
                showToast('최소 10개 단어가 필요합니다', 'error');
                return false;
            }
            
            this.words = vocab.map(w => w.english);
            this.fallingWords = [];
            this.score = 0;
            this.lives = 3;
            this.level = 1;
            this.isRunning = true;
            
            return true;
        },
        
        spawnWord() {
            if (!this.isRunning) return;
            
            const word = this.words[Math.floor(Math.random() * this.words.length)];
            const x = Math.random() * 70 + 10; // 10-80%
            const speed = 3 + this.level * 0.5; // 레벨에 따라 속도 증가
            
            this.fallingWords.push({
                id: Date.now(),
                text: word,
                x: x,
                y: 0,
                speed: speed
            });
        },
        
        update() {
            if (!this.isRunning) return;
            
            this.fallingWords.forEach(fw => {
                fw.y += fw.speed * 0.1;
            });
            
            // 바닥에 닿은 단어 처리
            const fallen = this.fallingWords.filter(fw => fw.y >= 100);
            fallen.forEach(() => {
                this.lives--;
                if (this.lives <= 0) {
                    this.end();
                }
            });
            
            this.fallingWords = this.fallingWords.filter(fw => fw.y < 100);
        },
        
        checkInput(input) {
            const matched = this.fallingWords.find(
                fw => fw.text.toLowerCase() === input.toLowerCase()
            );
            
            if (matched) {
                this.fallingWords = this.fallingWords.filter(fw => fw.id !== matched.id);
                this.score += matched.text.length * 10;
                
                // 레벨업 (50점마다)
                const newLevel = Math.floor(this.score / 500) + 1;
                if (newLevel > this.level) {
                    this.level = newLevel;
                }
                
                return matched;
            }
            
            return null;
        },
        
        end() {
            this.isRunning = false;
            
            if (this.gameLoop) {
                cancelAnimationFrame(this.gameLoop);
                this.gameLoop = null;
            }
            if (this.spawnInterval) {
                clearInterval(this.spawnInterval);
                this.spawnInterval = null;
            }
            
            // 기록 저장
            Storage.addHistory({
                type: 'typing_game',
                score: this.score,
                level: this.level
            });
            
            // 경험치
            const expGained = Math.floor(this.score / 10);
            Storage.addExp(expGained);
            
            // 업적 체크
            if (this.score >= 1000) {
                Achievements.check('special', { achievementId: 'game_typing_100' });
            }
            
            // 최고 점수
            const isNewBest = Storage.setGameBest('typing', this.score);
            
            return {
                score: this.score,
                level: this.level,
                expGained,
                isNewBest
            };
        }
    },
    
    // ===== 매칭 게임 =====
    matching: {
        cards: [],
        flipped: [],
        matched: [],
        moves: 0,
        startTime: null,
        timerInterval: null,
        
        start(pairCount = 8) {
            const vocab = Storage.getVocabulary();
            if (vocab.length < pairCount) {
                showToast(`최소 ${pairCount}개 단어가 필요합니다`, 'error');
                return false;
            }
            
            const selected = [...vocab]
                .sort(() => Math.random() - 0.5)
                .slice(0, pairCount);
            
            // 카드 생성 (영어 + 한국어 쌍)
            this.cards = [];
            selected.forEach((word, idx) => {
                this.cards.push({
                    id: idx * 2,
                    pairId: idx,
                    text: word.english,
                    type: 'en'
                });
                this.cards.push({
                    id: idx * 2 + 1,
                    pairId: idx,
                    text: word.korean,
                    type: 'ko'
                });
            });
            
            // 셔플
            this.cards.sort(() => Math.random() - 0.5);
            
            this.flipped = [];
            this.matched = [];
            this.moves = 0;
            this.startTime = Date.now();
            
            return true;
        },
        
        flip(cardId) {
            if (this.flipped.length >= 2) return null;
            if (this.flipped.includes(cardId)) return null;
            if (this.matched.includes(cardId)) return null;
            
            this.flipped.push(cardId);
            
            if (this.flipped.length === 2) {
                this.moves++;
                
                const card1 = this.cards.find(c => c.id === this.flipped[0]);
                const card2 = this.cards.find(c => c.id === this.flipped[1]);
                
                if (card1.pairId === card2.pairId && card1.type !== card2.type) {
                    // 매칭 성공
                    this.matched.push(this.flipped[0], this.flipped[1]);
                    this.flipped = [];
                    
                    return { match: true, card1, card2 };
                } else {
                    // 매칭 실패
                    return { match: false, card1, card2 };
                }
            }
            
            return { pending: true };
        },
        
        clearFlipped() {
            this.flipped = [];
        },
        
        isComplete() {
            return this.matched.length === this.cards.length;
        },
        
        getTime() {
            return Math.floor((Date.now() - this.startTime) / 1000);
        },
        
        end() {
            const timeSeconds = this.getTime();
            
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            
            // 기록 저장
            Storage.addHistory({
                type: 'matching_game',
                time: timeSeconds,
                moves: this.moves,
                pairs: this.cards.length / 2
            });
            
            // 경험치 (빠를수록 많이)
            const expGained = Math.max(10, 100 - timeSeconds);
            Storage.addExp(expGained);
            
            // 업적 체크
            if (timeSeconds <= 30) {
                Achievements.check('special', { achievementId: 'game_matching_30' });
            }
            
            // 최고 점수 (시간이 짧을수록 좋음)
            const currentBest = Storage.getGameBest('matching');
            const isNewBest = currentBest === 0 || timeSeconds < currentBest;
            if (isNewBest) {
                Storage.setGameBest('matching', timeSeconds);
            }
            
            return {
                time: timeSeconds,
                moves: this.moves,
                expGained,
                isNewBest
            };
        }
    },
    
    // ===== 스피드 퀴즈 =====
    speed: {
        questions: [],
        currentIndex: 0,
        score: 0,
        timeLeft: 30,
        timerInterval: null,
        isRunning: false,
        streak: 0,
        
        start() {
            const vocab = Storage.getVocabulary();
            if (vocab.length < 4) {
                showToast('최소 4개 단어가 필요합니다', 'error');
                return false;
            }
            
            // 많은 문제 준비 (시간 내 최대한)
            this.questions = [];
            for (let i = 0; i < 50; i++) {
                const word = vocab[Math.floor(Math.random() * vocab.length)];
                const type = Math.random() > 0.5 ? 'en-to-kr' : 'kr-to-en';
                const question = type === 'en-to-kr' ? word.english : word.korean;
                const correct = type === 'en-to-kr' ? word.korean : word.english;
                
                const others = vocab
                    .filter(w => w.id !== word.id)
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 3)
                    .map(w => type === 'en-to-kr' ? w.korean : w.english);
                
                const options = [...others, correct].sort(() => Math.random() - 0.5);
                
                this.questions.push({
                    question,
                    options,
                    correctIndex: options.indexOf(correct)
                });
            }
            
            this.currentIndex = 0;
            this.score = 0;
            this.timeLeft = 30;
            this.isRunning = true;
            this.streak = 0;
            
            return true;
        },
        
        answer(selectedIndex) {
            if (!this.isRunning) return null;
            
            const q = this.questions[this.currentIndex];
            const isCorrect = selectedIndex === q.correctIndex;
            
            if (isCorrect) {
                this.score++;
                this.streak++;
                this.timeLeft += 1; // 정답시 1초 보너스
            } else {
                this.streak = 0;
            }
            
            this.currentIndex++;
            
            // 5연속 정답 업적
            if (this.streak >= 5) {
                Achievements.check('special', { achievementId: 'quiz_streak_5' });
            }
            
            return {
                correct: isCorrect,
                streak: this.streak
            };
        },
        
        tick() {
            if (!this.isRunning) return;
            
            this.timeLeft--;
            
            if (this.timeLeft <= 0) {
                this.end();
            }
        },
        
        end() {
            this.isRunning = false;
            
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            
            // 기록 저장
            Storage.addHistory({
                type: 'speed_quiz',
                score: this.score
            });
            
            // 경험치
            const expGained = this.score * 10;
            Storage.addExp(expGained);
            
            // 업적 체크
            if (this.score >= 20) {
                Achievements.check('special', { achievementId: 'game_speed_20' });
            }
            
            // 최고 점수
            const isNewBest = Storage.setGameBest('speed', this.score);
            
            return {
                score: this.score,
                expGained,
                isNewBest
            };
        }
    }
};

// ===== 게임 UI 렌더링 =====
function renderGameUI(gameType) {
    const area = document.getElementById('game-play-area');
    
    switch(gameType) {
        case 'quiz':
            renderQuizUI(area);
            break;
        case 'typing':
            renderTypingUI(area);
            break;
        case 'matching':
            renderMatchingUI(area);
            break;
        case 'speed':
            renderSpeedUI(area);
            break;
    }
}

function renderQuizUI(container) {
    const quiz = Games.quiz;
    const q = quiz.questions[quiz.currentIndex];
    
    container.innerHTML = `
        <div class="quiz-game">
            <div class="quiz-progress">
                <div class="quiz-progress-bar">
                    <div class="quiz-progress-fill" style="width: ${(quiz.currentIndex / quiz.questions.length) * 100}%"></div>
                </div>
                <div class="quiz-progress-text">${quiz.currentIndex + 1} / ${quiz.questions.length}</div>
            </div>
            
            <div class="quiz-question-card">
                <div class="quiz-question">${q.question}</div>
                <div class="quiz-hint">${q.type === 'en-to-kr' ? '한국어로?' : '영어로?'}</div>
            </div>
            
            <div class="quiz-options">
                ${q.options.map((opt, i) => `
                    <button class="quiz-option btn btn-secondary" onclick="handleQuizAnswer(${i})">
                        ${opt}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function handleQuizAnswer(index) {
    const quiz = Games.quiz;
    const isCorrect = quiz.answer(index);
    
    // 정답 표시
    const buttons = document.querySelectorAll('.quiz-option');
    buttons.forEach((btn, i) => {
        btn.disabled = true;
        if (i === quiz.questions[quiz.currentIndex - 1]?.correctIndex || 
            i === quiz.questions[quiz.currentIndex]?.correctIndex) {
            // 현재 인덱스가 이미 증가했으므로 조정 필요
        }
    });
    
    if (isCorrect) {
        buttons[index].classList.add('correct');
        buttons[index].style.background = 'var(--success)';
        buttons[index].style.color = 'white';
    } else {
        buttons[index].classList.add('wrong');
        buttons[index].style.background = 'var(--error)';
        buttons[index].style.color = 'white';
    }
    
    setTimeout(() => {
        if (quiz.next()) {
            renderQuizUI(document.getElementById('game-play-area'));
        } else {
            showQuizResult();
        }
    }, 800);
}

function showQuizResult() {
    const result = Games.quiz.getResult();
    const container = document.getElementById('game-play-area');
    
    const emoji = result.percentage >= 80 ? '🎉' : result.percentage >= 50 ? '👍' : '💪';
    const message = result.percentage >= 80 ? '훌륭해요!' : result.percentage >= 50 ? '잘했어요!' : '다시 도전!';
    
    container.innerHTML = `
        <div class="quiz-result" style="text-align: center; padding: 40px;">
            <div style="font-size: 64px; margin-bottom: 16px;">${emoji}</div>
            <h3 style="font-size: 24px; margin-bottom: 8px;">${message}</h3>
            <div style="font-size: 48px; font-weight: 900; color: var(--accent-primary); margin-bottom: 16px;">
                ${result.percentage}%
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">
                ${result.total}문제 중 ${result.score}문제 정답<br>
                +${result.expGained} EXP
                ${result.isNewBest ? '<br><span style="color: var(--warning)">🏆 신기록!</span>' : ''}
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                ${result.wrongAnswers.length > 0 ? `
                    <button class="btn btn-secondary" onclick="reviewWrongAnswers()">오답 복습</button>
                ` : ''}
                <button class="btn btn-primary" onclick="closeGame()">확인</button>
            </div>
        </div>
    `;
    
    // 가챠 티켓 지급
    Storage.addGachaTicket(1);
    updateGachaTickets();
}

function renderTypingUI(container) {
    container.innerHTML = `
        <div class="typing-game">
            <div class="typing-game-header">
                <div class="typing-score">점수: <span id="typing-score">0</span></div>
                <div class="typing-lives">❤️ <span id="typing-lives">3</span></div>
                <div class="typing-level">Lv.<span id="typing-level">1</span></div>
            </div>
            <div class="typing-area" id="typing-area"></div>
            <div class="typing-input-area">
                <input type="text" class="typing-input" id="typing-input" placeholder="단어를 입력하세요..." autofocus>
            </div>
        </div>
    `;
    
    const input = document.getElementById('typing-input');
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const matched = Games.typing.checkInput(input.value.trim());
            if (matched) {
                // 매칭된 단어 애니메이션
                const wordEl = document.querySelector(`[data-word-id="${matched.id}"]`);
                if (wordEl) {
                    wordEl.classList.add('matched');
                    setTimeout(() => wordEl.remove(), 300);
                }
                document.getElementById('typing-score').textContent = Games.typing.score;
                document.getElementById('typing-level').textContent = Games.typing.level;
            }
            input.value = '';
        }
    });
    
    startTypingGameLoop();
}

function startTypingGameLoop() {
    const typing = Games.typing;
    const area = document.getElementById('typing-area');
    
    // 단어 스폰
    typing.spawnInterval = setInterval(() => {
        if (!typing.isRunning) return;
        typing.spawnWord();
    }, 2000 - typing.level * 100);
    
    // 게임 루프
    function gameLoop() {
        if (!typing.isRunning) return;
        
        typing.update();
        
        // 렌더링
        area.innerHTML = typing.fallingWords.map(fw => `
            <div class="falling-word" data-word-id="${fw.id}" 
                 style="left: ${fw.x}%; top: ${fw.y}%; animation-duration: ${10 / fw.speed}s;">
                ${fw.text}
            </div>
        `).join('');
        
        document.getElementById('typing-lives').textContent = typing.lives;
        
        if (typing.lives <= 0) {
            showTypingResult();
            return;
        }
        
        typing.gameLoop = requestAnimationFrame(gameLoop);
    }
    
    gameLoop();
}

function showTypingResult() {
    const result = Games.typing.end();
    const container = document.getElementById('game-play-area');
    
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 64px; margin-bottom: 16px;">⌨️</div>
            <h3 style="font-size: 24px; margin-bottom: 8px;">게임 오버!</h3>
            <div style="font-size: 48px; font-weight: 900; color: var(--accent-primary); margin-bottom: 16px;">
                ${result.score}점
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">
                레벨 ${result.level} 달성<br>
                +${result.expGained} EXP
                ${result.isNewBest ? '<br><span style="color: var(--warning)">🏆 신기록!</span>' : ''}
            </p>
            <button class="btn btn-primary" onclick="closeGame()">확인</button>
        </div>
    `;
    
    Storage.addGachaTicket(1);
    updateGachaTickets();
}

function renderMatchingUI(container) {
    const matching = Games.matching;
    
    container.innerHTML = `
        <div class="matching-game">
            <div class="matching-header">
                <div class="matching-timer" id="matching-timer">0초</div>
                <div class="matching-moves">이동: <span id="matching-moves">0</span></div>
            </div>
            <div class="matching-grid" id="matching-grid">
                ${matching.cards.map(card => `
                    <div class="match-card" data-card-id="${card.id}" onclick="handleMatchingClick(${card.id})">
                        <span class="card-text">${card.text}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // 타이머 시작
    matching.timerInterval = setInterval(() => {
        document.getElementById('matching-timer').textContent = matching.getTime() + '초';
    }, 1000);
}

function handleMatchingClick(cardId) {
    const matching = Games.matching;
    const result = matching.flip(cardId);
    
    if (!result) return;
    
    const cardEl = document.querySelector(`[data-card-id="${cardId}"]`);
    cardEl.classList.add('flipped');
    
    document.getElementById('matching-moves').textContent = matching.moves;
    
    if (result.match === true) {
        // 매칭 성공
        setTimeout(() => {
            document.querySelector(`[data-card-id="${result.card1.id}"]`).classList.add('matched');
            document.querySelector(`[data-card-id="${result.card2.id}"]`).classList.add('matched');
            
            if (matching.isComplete()) {
                showMatchingResult();
            }
        }, 300);
    } else if (result.match === false) {
        // 매칭 실패 - 카드 다시 뒤집기
        setTimeout(() => {
            document.querySelector(`[data-card-id="${result.card1.id}"]`).classList.remove('flipped');
            document.querySelector(`[data-card-id="${result.card2.id}"]`).classList.remove('flipped');
            matching.clearFlipped();
        }, 1000);
    }
}

function showMatchingResult() {
    const result = Games.matching.end();
    const container = document.getElementById('game-play-area');
    
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 64px; margin-bottom: 16px;">🃏</div>
            <h3 style="font-size: 24px; margin-bottom: 8px;">완료!</h3>
            <div style="font-size: 48px; font-weight: 900; color: var(--accent-primary); margin-bottom: 16px;">
                ${result.time}초
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">
                ${result.moves}번 이동<br>
                +${result.expGained} EXP
                ${result.isNewBest ? '<br><span style="color: var(--warning)">🏆 신기록!</span>' : ''}
            </p>
            <button class="btn btn-primary" onclick="closeGame()">확인</button>
        </div>
    `;
    
    Storage.addGachaTicket(1);
    updateGachaTickets();
}

function renderSpeedUI(container) {
    const speed = Games.speed;
    
    container.innerHTML = `
        <div class="speed-quiz">
            <div class="speed-timer" id="speed-timer">${speed.timeLeft}</div>
            <div class="speed-score">정답: <span id="speed-score">0</span>개</div>
            <div class="speed-question" id="speed-question">${speed.questions[0].question}</div>
            <div class="speed-options" id="speed-options">
                ${speed.questions[0].options.map((opt, i) => `
                    <button class="speed-option" onclick="handleSpeedAnswer(${i})">${opt}</button>
                `).join('')}
            </div>
        </div>
    `;
    
    // 타이머 시작
    speed.timerInterval = setInterval(() => {
        speed.tick();
        const timerEl = document.getElementById('speed-timer');
        if (timerEl) {
            timerEl.textContent = speed.timeLeft;
            timerEl.className = 'speed-timer';
            if (speed.timeLeft <= 10) timerEl.classList.add('warning');
            if (speed.timeLeft <= 5) timerEl.classList.add('danger');
        }
    }, 1000);
}

function handleSpeedAnswer(index) {
    const speed = Games.speed;
    const result = speed.answer(index);
    
    if (!result) return;
    
    // 다음 문제로
    if (speed.currentIndex < speed.questions.length) {
        const q = speed.questions[speed.currentIndex];
        document.getElementById('speed-question').textContent = q.question;
        document.getElementById('speed-options').innerHTML = q.options.map((opt, i) => `
            <button class="speed-option" onclick="handleSpeedAnswer(${i})">${opt}</button>
        `).join('');
        document.getElementById('speed-score').textContent = speed.score;
    }
    
    if (!speed.isRunning) {
        showSpeedResult();
    }
}

function showSpeedResult() {
    const result = Games.speed.end();
    const container = document.getElementById('game-play-area');
    
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 64px; margin-bottom: 16px;">⚡</div>
            <h3 style="font-size: 24px; margin-bottom: 8px;">시간 초과!</h3>
            <div style="font-size: 48px; font-weight: 900; color: var(--accent-primary); margin-bottom: 16px;">
                ${result.score}개
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">
                +${result.expGained} EXP
                ${result.isNewBest ? '<br><span style="color: var(--warning)">🏆 신기록!</span>' : ''}
            </p>
            <button class="btn btn-primary" onclick="closeGame()">확인</button>
        </div>
    `;
    
    Storage.addGachaTicket(1);
    updateGachaTickets();
}

function closeGame() {
    document.getElementById('game-play-area').style.display = 'none';
    document.querySelector('.games-grid').style.display = 'grid';
    updateDashboard();
}
