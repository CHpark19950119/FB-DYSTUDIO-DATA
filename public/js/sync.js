// ===== DAYOUNG's 통번역 스튜디오 - PIN 기반 동기화 모듈 =====

const Sync = {
    pin: null,
    isLinked: false,
    lastSync: null,

    // 초기화: 저장된 PIN 확인
    init() {
        this.pin = localStorage.getItem('dyts_sync_pin');
        this.isLinked = !!this.pin;
        this.lastSync = localStorage.getItem('dyts_last_sync');
        if (this.isLinked) {
            console.log('🔗 동기화 PIN 연결됨:', this.pin);
        }
        this.updateUI();
    },

    // PIN 생성 (새 기기)
    async createPIN() {
        const pin = prompt('사용할 PIN 코드를 입력하세요 (4~6자리 숫자):');
        if (!pin || !/^\d{4,6}$/.test(pin)) {
            showToast('4~6자리 숫자를 입력하세요', 'warning');
            return;
        }

        try {
            // 이미 존재하는 PIN인지 확인
            const doc = await db.collection('sync').doc(pin).get();
            if (doc.exists) {
                // 기존 PIN → 데이터 불러오기 확인
                if (confirm('이미 존재하는 PIN입니다. 해당 데이터를 불러오시겠습니까?')) {
                    await this.linkPIN(pin);
                }
                return;
            }

            // 새 PIN 생성 + 현재 데이터 업로드
            await this.uploadAll(pin);
            this.pin = pin;
            this.isLinked = true;
            localStorage.setItem('dyts_sync_pin', pin);
            this.updateUI();
            showToast(`✅ PIN ${pin} 생성 완료! 다른 기기에서 이 PIN으로 동기화하세요`, 'success');
        } catch (e) {
            console.error('PIN 생성 오류:', e);
            showToast('동기화 오류: ' + e.message, 'error');
        }
    },

    // PIN 연결 (기존 기기 데이터 불러오기)
    async linkPIN(pin) {
        if (!pin) {
            pin = prompt('동기화할 PIN 코드를 입력하세요:');
        }
        if (!pin || !/^\d{4,6}$/.test(pin)) {
            showToast('4~6자리 숫자를 입력하세요', 'warning');
            return;
        }

        try {
            const doc = await db.collection('sync').doc(pin).get();
            if (!doc.exists) {
                showToast('해당 PIN이 없습니다. 먼저 다른 기기에서 PIN을 생성하세요.', 'error');
                return;
            }

            await this.downloadAll(pin);
            this.pin = pin;
            this.isLinked = true;
            localStorage.setItem('dyts_sync_pin', pin);
            this.updateUI();
            showToast('✅ 동기화 완료! 데이터를 불러왔습니다', 'success');
            setTimeout(() => location.reload(), 1500);
        } catch (e) {
            console.error('PIN 연결 오류:', e);
            showToast('동기화 오류: ' + e.message, 'error');
        }
    },

    // 전체 데이터 업로드
    async uploadAll(pin) {
        const targetPin = pin || this.pin;
        if (!targetPin) return;

        const data = {
            // 학습 데이터
            profile: Storage.getProfile(),
            level: Storage.getLevel(),
            streak: Storage.getStreak(),
            vocabulary: Storage.getVocabulary(),
            grassData: Storage.getGrassData(),
            achievements: Storage.getAchievements(),
            gachaTickets: Storage.getGachaTickets(),
            stickers: Storage.getStickers(),
            gameBests: Storage.get('gameBests', {}),
            settings: Storage.getSettings(),
            dday: Storage.getDday(),
            // 아카이브 (첨삭 기록 포함)
            archives: Storage.getArchive(),
            // 첨삭 기록 (별도)
            feedbackHistory: JSON.parse(localStorage.getItem('dyts_feedback_history') || '[]'),
            // 커스텀 기사
            customArticles: JSON.parse(localStorage.getItem('dyts_customArticles') || '[]'),
            // 메타
            updatedAt: new Date().toISOString(),
            deviceInfo: navigator.userAgent.substring(0, 100)
        };

        await db.collection('sync').doc(targetPin).set(data, { merge: true });
        this.lastSync = new Date().toISOString();
        localStorage.setItem('dyts_last_sync', this.lastSync);
        console.log('⬆️ 데이터 업로드 완료:', targetPin);
    },

    // 전체 데이터 다운로드
    async downloadAll(pin) {
        const targetPin = pin || this.pin;
        if (!targetPin) return;

        const doc = await db.collection('sync').doc(targetPin).get();
        if (!doc.exists) return;

        const data = doc.data();

        // 학습 데이터 복원
        if (data.profile) Storage.saveProfile(data.profile);
        if (data.level) Storage.saveLevel(data.level);
        if (data.streak) Storage.set('streak', data.streak);
        if (data.vocabulary) Storage.set('vocabulary', data.vocabulary);
        if (data.grassData) Storage.set('grassData', data.grassData);
        if (data.achievements) Storage.set('achievements', data.achievements);
        if (data.gachaTickets != null) Storage.set('gachaTickets', data.gachaTickets);
        if (data.stickers) Storage.set('stickers', data.stickers);
        if (data.gameBests) Storage.set('gameBests', data.gameBests);
        if (data.settings) Storage.saveSettings(data.settings);
        if (data.dday) Storage.set('dday', data.dday);

        // 아카이브 (로컬과 병합)
        if (data.archives) {
            const local = Storage.getArchive();
            const localIds = new Set(local.map(a => a.id));
            const merged = [...local];
            data.archives.forEach(a => { if (!localIds.has(a.id)) merged.push(a); });
            merged.sort((a, b) => new Date(b.date) - new Date(a.date));
            Storage.set('archive', merged.slice(0, 200));
            // app.js의 extendStorage에서 사용하는 키도 업데이트
            localStorage.setItem('archives', JSON.stringify(merged.slice(0, 200)));
        }

        // 첨삭 기록
        if (data.feedbackHistory) {
            const localFH = JSON.parse(localStorage.getItem('dyts_feedback_history') || '[]');
            const localFHIds = new Set(localFH.map(f => f.id));
            const merged = [...localFH];
            data.feedbackHistory.forEach(f => { if (!localFHIds.has(f.id)) merged.push(f); });
            merged.sort((a, b) => new Date(b.date) - new Date(a.date));
            localStorage.setItem('dyts_feedback_history', JSON.stringify(merged.slice(0, 500)));
        }

        // 커스텀 기사
        if (data.customArticles) {
            localStorage.setItem('dyts_customArticles', JSON.stringify(data.customArticles));
        }

        this.lastSync = new Date().toISOString();
        localStorage.setItem('dyts_last_sync', this.lastSync);
        console.log('⬇️ 데이터 다운로드 완료:', targetPin);
    },

    // 수동 동기화 (업로드)
    async syncNow() {
        if (!this.pin) {
            showToast('먼저 PIN을 설정하세요', 'warning');
            return;
        }
        showLoading(true, '동기화 중...');
        try {
            await this.uploadAll();
            showToast('✅ 동기화 완료!', 'success');
        } catch (e) {
            showToast('동기화 실패: ' + e.message, 'error');
        }
        showLoading(false);
        this.updateUI();
    },

    // 수동 동기화 (다운로드)
    async pullNow() {
        if (!this.pin) {
            showToast('먼저 PIN을 설정하세요', 'warning');
            return;
        }
        showLoading(true, '데이터 불러오는 중...');
        try {
            await this.downloadAll();
            showToast('✅ 데이터 불러오기 완료! 새로고침합니다', 'success');
            setTimeout(() => location.reload(), 1500);
        } catch (e) {
            showToast('불러오기 실패: ' + e.message, 'error');
        }
        showLoading(false);
    },

    // PIN 연결 해제
    disconnect() {
        if (!confirm('동기화 연결을 해제하시겠습니까? 로컬 데이터는 유지됩니다.')) return;
        this.pin = null;
        this.isLinked = false;
        localStorage.removeItem('dyts_sync_pin');
        localStorage.removeItem('dyts_last_sync');
        this.updateUI();
        showToast('동기화 연결 해제됨', 'info');
    },

    // UI 업데이트
    updateUI() {
        const el = document.getElementById('sync-status');
        if (!el) return;

        if (this.isLinked) {
            const lastStr = this.lastSync ? new Date(this.lastSync).toLocaleString('ko-KR') : '없음';
            el.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="color:#10b981;font-weight:600;">🔗 PIN: ${this.pin}</span>
                    <span style="font-size:12px;color:var(--text-secondary);">마지막: ${lastStr}</span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="Sync.syncNow()">⬆️ 업로드</button>
                    <button class="btn btn-sm btn-secondary" onclick="Sync.pullNow()">⬇️ 불러오기</button>
                    <button class="btn btn-sm btn-ghost" onclick="Sync.disconnect()">연결 해제</button>
                </div>
            `;
        } else {
            el.innerHTML = `
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">PIN 코드로 앱/패드 간 학습 데이터를 동기화합니다</p>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-sm btn-primary" onclick="Sync.createPIN()">🔑 PIN 생성/등록</button>
                    <button class="btn btn-sm btn-secondary" onclick="Sync.linkPIN()">📲 PIN 입력</button>
                </div>
            `;
        }
    },

    // 첨삭 완료 후 자동 동기화 (백그라운드)
    async autoSync() {
        if (!this.isLinked) return;
        try {
            await this.uploadAll();
            console.log('🔄 자동 동기화 완료');
        } catch (e) {
            console.warn('자동 동기화 실패:', e.message);
        }
    }
};
