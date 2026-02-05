// ===== DAYOUNG's 통번역 스튜디오 v3 - Achievements Module =====

const Achievements = {
    // 전체 업적 정의
    list: [
        // 연속 학습
        { id: 'streak_3', name: '삼일천하', icon: '🌅', desc: '3일 연속 학습', category: 'streak', condition: s => s.count >= 3 },
        { id: 'streak_7', name: '일주일 전사', icon: '⚔️', desc: '7일 연속 학습', category: 'streak', condition: s => s.count >= 7 },
        { id: 'streak_14', name: '2주 챔피언', icon: '🏅', desc: '14일 연속 학습', category: 'streak', condition: s => s.count >= 14 },
        { id: 'streak_30', name: '한 달의 기적', icon: '🌟', desc: '30일 연속 학습', category: 'streak', condition: s => s.count >= 30 },
        { id: 'streak_60', name: '철인 번역가', icon: '🦾', desc: '60일 연속 학습', category: 'streak', condition: s => s.count >= 60 },
        { id: 'streak_100', name: '백일의 전설', icon: '👑', desc: '100일 연속 학습', category: 'streak', condition: s => s.count >= 100 },
        { id: 'streak_365', name: '1년 마스터', icon: '🏆', desc: '365일 연속 학습', category: 'streak', condition: s => s.count >= 365 },
        
        // 번역 횟수
        { id: 'trans_10', name: '번역 입문', icon: '✍️', desc: '10문장 번역', category: 'count', check: 'translations', target: 10 },
        { id: 'trans_50', name: '번역 수습', icon: '📝', desc: '50문장 번역', category: 'count', check: 'translations', target: 50 },
        { id: 'trans_100', name: '번역 100', icon: '💯', desc: '100문장 번역', category: 'count', check: 'translations', target: 100 },
        { id: 'trans_500', name: '번역 장인', icon: '🎖️', desc: '500문장 번역', category: 'count', check: 'translations', target: 500 },
        { id: 'trans_1000', name: '천 문장의 사나이', icon: '🌠', desc: '1000문장 번역', category: 'count', check: 'translations', target: 1000 },
        
        // 단어 학습
        { id: 'vocab_50', name: '단어 수집가', icon: '📚', desc: '50단어 등록', category: 'count', check: 'vocabulary', target: 50 },
        { id: 'vocab_100', name: '어휘력 100', icon: '📖', desc: '100단어 등록', category: 'count', check: 'vocabulary', target: 100 },
        { id: 'vocab_500', name: '단어 부자', icon: '💎', desc: '500단어 등록', category: 'count', check: 'vocabulary', target: 500 },
        { id: 'vocab_1000', name: '사전 편찬자', icon: '📕', desc: '1000단어 등록', category: 'count', check: 'vocabulary', target: 1000 },
        
        // 퀴즈
        { id: 'quiz_perfect', name: '퍼펙트!', icon: '💫', desc: '퀴즈 100점', category: 'special' },
        { id: 'quiz_10', name: '퀴즈 마니아', icon: '🎯', desc: '퀴즈 10회 완료', category: 'count', check: 'quizzes', target: 10 },
        { id: 'quiz_streak_5', name: '5연속 정답', icon: '🔥', desc: '퀴즈 5연속 정답', category: 'special' },
        
        // 게임
        { id: 'game_typing_100', name: '타자 신동', icon: '⌨️', desc: '타자게임 100점', category: 'special' },
        { id: 'game_matching_30', name: '매칭 달인', icon: '🃏', desc: '매칭게임 30초 이내', category: 'special' },
        { id: 'game_speed_20', name: '스피드 왕', icon: '⚡', desc: '스피드퀴즈 20개', category: 'special' },
        
        // 레벨
        { id: 'level_5', name: '레벨 5 달성', icon: '🌱', desc: 'Lv.5 달성', category: 'special' },
        { id: 'level_10', name: '레벨 10 달성', icon: '🌿', desc: 'Lv.10 달성', category: 'special' },
        { id: 'level_25', name: '레벨 25 달성', icon: '🌳', desc: 'Lv.25 달성', category: 'special' },
        { id: 'level_50', name: '레벨 50 달성', icon: '🏔️', desc: 'Lv.50 달성', category: 'special' },
        
        // 특별
        { id: 'first_article', name: '첫 발자국', icon: '👣', desc: '첫 기사 완독', category: 'special' },
        { id: 'night_owl', name: '야행성 학습자', icon: '🦉', desc: '자정 이후 학습', category: 'special' },
        { id: 'early_bird', name: '얼리버드', icon: '🐦', desc: '오전 6시 이전 학습', category: 'special' },
        { id: 'weekend_warrior', name: '주말 전사', icon: '🗓️', desc: '주말에 1시간 이상', category: 'special' },
        { id: 'customizer', name: '꾸미기 달인', icon: '🎨', desc: '테마 변경', category: 'special' },
        { id: 'gacha_rare', name: '희귀템 획득', icon: '💎', desc: '가챠에서 레어 획득', category: 'special' },
        { id: 'all_categories', name: '만능 학습자', icon: '🌈', desc: '모든 분야 기사 읽기', category: 'special' }
    ],
    
    // 업적 체크
    check(type, data = {}) {
        const unlocked = [];
        const streak = Storage.getStreak();
        const stats = this.getStats();
        
        this.list.forEach(ach => {
            if (Storage.getAchievements().includes(ach.id)) return; // 이미 획득
            
            let shouldUnlock = false;
            
            // 연속 학습 체크
            if (ach.category === 'streak' && ach.condition) {
                shouldUnlock = ach.condition(streak);
            }
            
            // 횟수 체크
            if (ach.category === 'count' && ach.check) {
                const count = stats[ach.check] || 0;
                shouldUnlock = count >= ach.target;
            }
            
            // 특별 업적
            if (type === 'special' && ach.id === data.achievementId) {
                shouldUnlock = true;
            }
            
            if (shouldUnlock) {
                if (Storage.unlockAchievement(ach.id)) {
                    unlocked.push(ach);
                }
            }
        });
        
        return unlocked;
    },
    
    // 통계 가져오기
    getStats() {
        const history = Storage.getHistory();
        return {
            translations: history.filter(h => h.type === 'translation').length,
            interpretations: history.filter(h => h.type === 'interpretation').length,
            vocabulary: Storage.getVocabulary().length,
            quizzes: history.filter(h => h.type === 'quiz').length,
            articles: [...new Set(history.filter(h => h.type === 'article').map(h => h.articleId))].length
        };
    },
    
    // 특정 업적 정보 가져오기
    get(id) {
        return this.list.find(a => a.id === id);
    },
    
    // 획득한 업적 목록
    getUnlocked() {
        const unlockedIds = Storage.getAchievements();
        return this.list.filter(a => unlockedIds.includes(a.id));
    },
    
    // 미획득 업적 목록
    getLocked() {
        const unlockedIds = Storage.getAchievements();
        return this.list.filter(a => !unlockedIds.includes(a.id));
    },
    
    // 카테고리별 필터
    getByCategory(category) {
        if (category === 'all') return this.list;
        return this.list.filter(a => a.category === category);
    },
    
    // 시간대 업적 체크
    checkTimeAchievements() {
        const hour = new Date().getHours();
        
        if (hour >= 0 && hour < 5) {
            this.check('special', { achievementId: 'night_owl' });
        }
        
        if (hour >= 5 && hour < 7) {
            this.check('special', { achievementId: 'early_bird' });
        }
        
        const day = new Date().getDay();
        if (day === 0 || day === 6) {
            const todayMinutes = Storage.getDailyProgress().time || 0;
            if (todayMinutes >= 60) {
                this.check('special', { achievementId: 'weekend_warrior' });
            }
        }
    }
};

// ===== 가챠 시스템 =====
const Gacha = {
    // 보상 풀
    rewards: {
        common: [
            { type: 'sticker', item: '🌸', name: '벚꽃 스티커' },
            { type: 'sticker', item: '⭐', name: '별 스티커' },
            { type: 'sticker', item: '🎈', name: '풍선 스티커' },
            { type: 'sticker', item: '🍀', name: '클로버 스티커' },
            { type: 'sticker', item: '🌙', name: '달 스티커' },
            { type: 'exp', amount: 10, name: '경험치 +10' },
            { type: 'exp', amount: 20, name: '경험치 +20' }
        ],
        rare: [
            { type: 'sticker', item: '🦋', name: '나비 스티커' },
            { type: 'sticker', item: '🌈', name: '무지개 스티커' },
            { type: 'sticker', item: '🎭', name: '가면 스티커' },
            { type: 'sticker', item: '🎪', name: '서커스 스티커' },
            { type: 'exp', amount: 50, name: '경험치 +50' },
            { type: 'ticket', amount: 2, name: '가챠 티켓 x2' }
        ],
        epic: [
            { type: 'sticker', item: '🐉', name: '드래곤 스티커' },
            { type: 'sticker', item: '🦄', name: '유니콘 스티커' },
            { type: 'sticker', item: '🔮', name: '수정구 스티커' },
            { type: 'exp', amount: 100, name: '경험치 +100' },
            { type: 'ticket', amount: 5, name: '가챠 티켓 x5' }
        ],
        legendary: [
            { type: 'sticker', item: '👑', name: '왕관 스티커' },
            { type: 'sticker', item: '💎', name: '다이아 스티커' },
            { type: 'title', item: '가챠 마스터', name: '칭호: 가챠 마스터' },
            { type: 'exp', amount: 200, name: '경험치 +200' }
        ]
    },
    
    // 확률
    rates: {
        common: 60,    // 60%
        rare: 25,      // 25%
        epic: 12,      // 12%
        legendary: 3   // 3%
    },
    
    // 가챠 뽑기
    pull() {
        if (!Storage.useGachaTicket()) {
            return null; // 티켓 없음
        }
        
        const rand = Math.random() * 100;
        let rarity;
        let cumulative = 0;
        
        for (const [r, rate] of Object.entries(this.rates)) {
            cumulative += rate;
            if (rand < cumulative) {
                rarity = r;
                break;
            }
        }
        
        const pool = this.rewards[rarity];
        const reward = pool[Math.floor(Math.random() * pool.length)];
        
        // 보상 적용
        this.applyReward(reward);
        
        // 희귀템 업적
        if (rarity === 'epic' || rarity === 'legendary') {
            Achievements.check('special', { achievementId: 'gacha_rare' });
        }
        
        return { ...reward, rarity };
    },
    
    // 보상 적용
    applyReward(reward) {
        switch (reward.type) {
            case 'sticker':
                Storage.addSticker(reward.item);
                break;
            case 'exp':
                Storage.addExp(reward.amount);
                break;
            case 'ticket':
                Storage.addGachaTicket(reward.amount);
                break;
            case 'title':
                // 특별 칭호는 별도 처리
                break;
        }
    },
    
    // 등급별 색상
    getRarityColor(rarity) {
        const colors = {
            common: '#9ca3af',
            rare: '#3b82f6',
            epic: '#8b5cf6',
            legendary: '#f59e0b'
        };
        return colors[rarity] || colors.common;
    },
    
    // 등급 이름
    getRarityName(rarity) {
        const names = {
            common: '일반',
            rare: '레어',
            epic: '에픽',
            legendary: '레전더리'
        };
        return names[rarity] || '일반';
    }
};

// ===== 운세 시스템 =====
const Fortune = {
    messages: [
        { luck: 5, text: '오늘은 학습 효율이 최고조! 어려운 기사에 도전해보세요.', word: 'serendipity' },
        { luck: 5, text: '영감이 넘치는 날! 창의적인 번역이 나올 거예요.', word: 'inspiration' },
        { luck: 4, text: '집중력이 좋은 날이에요. 긴 기사도 거뜬!', word: 'concentration' },
        { luck: 4, text: '새로운 표현을 많이 배우게 될 날이에요.', word: 'discovery' },
        { luck: 4, text: '오늘 배운 단어가 오래 기억에 남을 거예요.', word: 'memorable' },
        { luck: 3, text: '꾸준함이 빛을 발하는 날! 평소대로 하면 돼요.', word: 'consistency' },
        { luck: 3, text: '작은 성취감을 느낄 수 있는 하루가 될 거예요.', word: 'achievement' },
        { luck: 3, text: '오늘의 노력이 내일의 실력이 됩니다.', word: 'effort' },
        { luck: 2, text: '조금 어려울 수 있지만, 포기하지 마세요!', word: 'perseverance' },
        { luck: 2, text: '천천히 해도 괜찮아요. 이해가 중요합니다.', word: 'patience' },
        { luck: 1, text: '오늘은 복습의 날! 아는 내용을 다지세요.', word: 'review' }
    ],
    
    // 오늘의 운세 가져오기
    get() {
        const lastFortune = Storage.getLastFortune();
        const today = new Date().toDateString();
        
        if (lastFortune.date === today && lastFortune.fortune) {
            return lastFortune.fortune;
        }
        
        // 새 운세 생성
        const fortune = this.messages[Math.floor(Math.random() * this.messages.length)];
        Storage.saveFortune(fortune);
        
        return fortune;
    },
    
    // 운세 아이콘
    getLuckIcon(luck) {
        const icons = ['😢', '😐', '🙂', '😊', '😄', '🤩'];
        return icons[luck] || '🙂';
    }
};
