// ===== DAYOUNG's 통번역 스튜디오 v3 - Storage Module =====

const Storage = {
    PREFIX: 'dayoung_v3_',
    
    // 기본 저장/불러오기
    get(key, defaultVal = null) {
        try {
            const data = localStorage.getItem(this.PREFIX + key);
            return data ? JSON.parse(data) : defaultVal;
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultVal;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },
    
    remove(key) {
        localStorage.removeItem(this.PREFIX + key);
    },
    
    // ===== 사용자 프로필 =====
    getProfile() {
        return this.get('profile', {
            nickname: 'DAYOUNG',
            studioName: "'s Studio",
            mascot: '🦜',
            mascotName: '파랑이',
            theme: 'light',
            effects: { particles: false, gradient: true, pattern: false }
        });
    },
    
    saveProfile(profile) {
        this.set('profile', profile);
    },
    
    // ===== 레벨 & 경험치 =====
    getLevel() {
        return this.get('level', {
            level: 1,
            exp: 0,
            totalExp: 0
        });
    },
    
    saveLevel(level) {
        this.set('level', level);
    },
    
    addExp(amount) {
        const data = this.getLevel();
        data.exp += amount;
        data.totalExp += amount;
        
        // 레벨업 체크
        const expTable = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000, 5000, 6500, 8000, 10000, 12500, 15000, 18000, 21500, 25500, 30000];
        let leveledUp = false;
        let newLevel = data.level;
        
        while (data.level < 99) {
            const required = expTable[Math.min(data.level, expTable.length - 1)] || (data.level * 1000);
            if (data.exp >= required) {
                data.exp -= required;
                data.level++;
                leveledUp = true;
                newLevel = data.level;
            } else {
                break;
            }
        }
        
        this.saveLevel(data);
        return { leveledUp, newLevel, currentExp: data.exp };
    },
    
    getExpForNextLevel() {
        const data = this.getLevel();
        const expTable = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000, 5000, 6500, 8000, 10000, 12500, 15000, 18000, 21500, 25500, 30000];
        return expTable[Math.min(data.level, expTable.length - 1)] || (data.level * 1000);
    },
    
    // ===== 칭호 시스템 =====
    getTitleForLevel(level) {
        const titles = {
            1: '번역 새싹',
            5: '번역 수습생',
            10: '주니어 번역가',
            15: '번역 장인',
            20: '시니어 번역가',
            25: '번역 마스터',
            30: '통역 달인',
            40: '언어의 연금술사',
            50: '번역계의 전설',
            60: '다국어 마에스트로',
            70: '언어의 수호자',
            80: '번역신',
            90: '초월 번역가',
            99: '🌟 통번역의 신 🌟'
        };
        
        let title = '번역 새싹';
        for (const [lvl, t] of Object.entries(titles)) {
            if (level >= parseInt(lvl)) title = t;
        }
        return title;
    },
    
    // ===== 연속 학습 (스트릭) =====
    getStreak() {
        return this.get('streak', {
            count: 0,
            lastDate: null,
            best: 0
        });
    },
    
    updateStreak() {
        const streak = this.getStreak();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (streak.lastDate === today) {
            return streak; // 이미 오늘 업데이트됨
        }
        
        if (streak.lastDate === yesterday) {
            streak.count++;
        } else if (streak.lastDate !== today) {
            streak.count = 1;
        }
        
        streak.lastDate = today;
        streak.best = Math.max(streak.best, streak.count);
        
        this.set('streak', streak);
        return streak;
    },
    
    // ===== 일일 진행상황 =====
    getDailyProgress() {
        const today = new Date().toDateString();
        const data = this.get('dailyProgress', { date: null });
        
        if (data.date !== today) {
            return {
                date: today,
                article: false,
                translate: false,
                vocab: false,
                quiz: false,
                time: 0,
                sentences: 0
            };
        }
        return data;
    },
    
    updateDailyProgress(updates) {
        const progress = this.getDailyProgress();
        Object.assign(progress, updates);
        progress.date = new Date().toDateString();
        this.set('dailyProgress', progress);
        return progress;
    },
    
    // ===== 학습 잔디 =====
    getGrassData() {
        return this.get('grassData', {});
    },
    
    updateGrass(minutes = 0, sentences = 0) {
        const today = new Date().toISOString().split('T')[0];
        const grass = this.getGrassData();
        
        if (!grass[today]) {
            grass[today] = { minutes: 0, sentences: 0 };
        }
        
        grass[today].minutes += minutes;
        grass[today].sentences += sentences;
        
        this.set('grassData', grass);
        return grass;
    },
    
    getGrassLevel(dayData) {
        if (!dayData) return 0;
        const score = dayData.minutes + dayData.sentences * 2;
        if (score >= 60) return 4;
        if (score >= 40) return 3;
        if (score >= 20) return 2;
        if (score >= 5) return 1;
        return 0;
    },
    
    // ===== 단어장 =====
    getVocabulary() {
        return this.get('vocabulary', []);
    },
    
    addWord(word) {
        const vocab = this.getVocabulary();
        const newWord = {
            id: Date.now(),
            english: word.english,
            korean: word.korean,
            partOfSpeech: word.partOfSpeech || '',
            example: word.example || '',
            starred: false,
            mastered: false,
            reviewCount: 0,
            lastReview: null,
            addedAt: new Date().toISOString()
        };
        vocab.unshift(newWord);
        this.set('vocabulary', vocab);
        return newWord;
    },
    
    updateWord(id, updates) {
        const vocab = this.getVocabulary();
        const idx = vocab.findIndex(w => w.id === id);
        if (idx !== -1) {
            Object.assign(vocab[idx], updates);
            this.set('vocabulary', vocab);
        }
    },
    
    deleteWord(id) {
        const vocab = this.getVocabulary().filter(w => w.id !== id);
        this.set('vocabulary', vocab);
    },
    
    getTodayWords() {
        const today = new Date().toDateString();
        return this.getVocabulary().filter(w => 
            new Date(w.addedAt).toDateString() === today
        );
    },
    
    getReviewWords() {
        const now = Date.now();
        return this.getVocabulary().filter(w => {
            if (w.mastered) return false;
            if (!w.lastReview) return true;
            const hoursSince = (now - new Date(w.lastReview).getTime()) / 3600000;
            const interval = Math.pow(2, w.reviewCount) * 4; // 간격 반복
            return hoursSince >= interval;
        });
    },
    
    // ===== 아카이브 =====
    getArchive() {
        return this.get('archive', []);
    },
    
    addArchive(item) {
        const archive = this.getArchive();
        const newItem = {
            id: Date.now(),
            ...item,
            date: new Date().toISOString()
        };
        archive.unshift(newItem);
        this.set('archive', archive.slice(0, 100)); // 최대 100개
        return newItem;
    },
    
    updateArchiveItem(id, updates) {
        const archive = this.getArchive();
        const idx = archive.findIndex(a => a.id === id);
        if (idx !== -1) {
            Object.assign(archive[idx], updates);
            this.set('archive', archive);
        }
    },
    
    // ===== 학습 히스토리 =====
    getHistory() {
        return this.get('history', []);
    },
    
    addHistory(item) {
        const history = this.getHistory();
        history.unshift({
            ...item,
            timestamp: new Date().toISOString()
        });
        this.set('history', history.slice(0, 500));
    },
    
    // ===== 업적 & 뱃지 =====
    getAchievements() {
        return this.get('achievements', []);
    },
    
    unlockAchievement(id) {
        const achievements = this.getAchievements();
        if (!achievements.includes(id)) {
            achievements.push(id);
            this.set('achievements', achievements);
            return true; // 새로 해금됨
        }
        return false; // 이미 있음
    },
    
    // ===== 가챠 티켓 =====
    getGachaTickets() {
        return this.get('gachaTickets', 0);
    },
    
    addGachaTicket(amount = 1) {
        const tickets = this.getGachaTickets() + amount;
        this.set('gachaTickets', tickets);
        return tickets;
    },
    
    useGachaTicket() {
        const tickets = this.getGachaTickets();
        if (tickets > 0) {
            this.set('gachaTickets', tickets - 1);
            return true;
        }
        return false;
    },
    
    // ===== 스티커 컬렉션 =====
    getStickers() {
        return this.get('stickers', ['⭐', '❤️', '🔥']); // 기본 스티커
    },
    
    addSticker(sticker) {
        const stickers = this.getStickers();
        if (!stickers.includes(sticker)) {
            stickers.push(sticker);
            this.set('stickers', stickers);
            return true;
        }
        return false;
    },
    
    // ===== 게임 최고 점수 =====
    getGameBest(gameType) {
        const bests = this.get('gameBests', {});
        return bests[gameType] || 0;
    },
    
    setGameBest(gameType, score) {
        const bests = this.get('gameBests', {});
        if (score > (bests[gameType] || 0)) {
            bests[gameType] = score;
            this.set('gameBests', bests);
            return true; // 신기록
        }
        return false;
    },
    
    // ===== 일기 =====
    getDiary(date = null) {
        const diaries = this.get('diaries', {});
        const key = date || new Date().toISOString().split('T')[0];
        return diaries[key] || '';
    },
    
    saveDiary(text, date = null) {
        const diaries = this.get('diaries', {});
        const key = date || new Date().toISOString().split('T')[0];
        diaries[key] = text;
        this.set('diaries', diaries);
    },
    
    // ===== D-Day =====
    getDday() {
        return this.get('dday', null);
    },
    
    saveDday(name, date) {
        this.set('dday', { name, date });
    },
    
    // ===== API 키 =====
    getApiKey(provider = 'claude') {
        const keys = this.get('apiKeys', {});
        return keys[provider] || '';
    },
    
    saveApiKey(provider, key) {
        const keys = this.get('apiKeys', {});
        keys[provider] = key;
        this.set('apiKeys', keys);
    },
    
    getAiModel() {
        return this.get('aiModel', 'claude');
    },
    
    setAiModel(model) {
        this.set('aiModel', model);
    },
    
    // ===== 설정 =====
    getSettings() {
        return this.get('settings', {
            dailyGoal: 60,
            ttsSpeed: 0.9,
            notifications: true
        });
    },
    
    saveSettings(settings) {
        this.set('settings', settings);
    },
    
    // ===== 운세 =====
    getLastFortune() {
        return this.get('lastFortune', { date: null, fortune: null });
    },
    
    saveFortune(fortune) {
        this.set('lastFortune', {
            date: new Date().toDateString(),
            fortune
        });
    },
    
    // ===== 데이터 내보내기/가져오기 =====
    exportData() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.PREFIX)) {
                data[key] = localStorage.getItem(key);
            }
        }
        return JSON.stringify(data, null, 2);
    },
    
    importData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            for (const [key, value] of Object.entries(data)) {
                localStorage.setItem(key, value);
            }
            return true;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    },
    
    resetAll() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
};
