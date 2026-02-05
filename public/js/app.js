// ===== DAYOUNG's 통번역 스튜디오 v3 - Main App =====

const App = {
    articles: [], categories: [], levels: [],
    currentArticle: null, phrases: [], phraseIndex: 0,
    phraseFeedbacks: [], translateDirection: 'en-ko',
    currentArchiveId: null, recommendedArticle: null
};

// Storage 확장 (기존 Storage 객체에 함수 추가)
// storage.js가 로드된 후에 실행되어야 함
function extendStorage() {
    if (typeof Storage === 'undefined' || Storage === null) {
        console.warn('Storage 객체가 없습니다. 기본 객체 생성');
        window.Storage = {};
    }
    
    // 기사 진행도 저장
    Storage.saveArticleProgress = function(articleId, completed, total) {
        try {
            const progress = this.getArticleProgress();
            progress[articleId] = { completed, total, updatedAt: new Date().toISOString() };
            localStorage.setItem('articleProgress', JSON.stringify(progress));
        } catch (e) {
            console.error('진행도 저장 실패:', e);
        }
    };
    
    // 기사 진행도 가져오기
    Storage.getArticleProgress = function() {
        try {
            return JSON.parse(localStorage.getItem('articleProgress') || '{}');
        } catch (e) {
            return {};
        }
    };
    
    // 아카이브 추가
    const originalAddArchive = Storage.addArchive;
    Storage.addArchive = function(data) {
        try {
            const archives = JSON.parse(localStorage.getItem('archives') || '[]');
            data.id = Date.now();
            data.date = data.date || new Date().toISOString();
            archives.unshift(data);
            localStorage.setItem('archives', JSON.stringify(archives.slice(0, 100)));
            console.log('✅ 아카이브 저장 성공:', data.type, data.articleTitle);
            return true;
        } catch (e) {
            console.error('❌ 아카이브 저장 실패:', e);
            return false;
        }
    };
    
    // 아카이브 가져오기
    const originalGetArchive = Storage.getArchive;
    Storage.getArchive = function() {
        try {
            const data = JSON.parse(localStorage.getItem('archives') || '[]');
            console.log('📚 아카이브 로드:', data.length, '개');
            return data;
        } catch (e) {
            console.error('아카이브 로드 실패:', e);
            return [];
        }
    };
    
    // 아카이브 업데이트
    Storage.updateArchiveItem = function(id, updates) {
        try {
            const archives = this.getArchive();
            const index = archives.findIndex(a => a.id === id);
            if (index !== -1) {
                archives[index] = { ...archives[index], ...updates };
                localStorage.setItem('archives', JSON.stringify(archives));
                return true;
            }
            return false;
        } catch (e) {
            console.error('아카이브 업데이트 실패:', e);
            return false;
        }
    };
    
    console.log('✅ Storage 확장 완료');
}

// DOM 로드 전에 실행
extendStorage();

// ========== 초기화 ==========
document.addEventListener('DOMContentLoaded', async () => {
    initTheme(); initProfile();
    await loadArticles();
    loadUserData(); setupEvents();
    updateDashboard(); renderGrass();
    checkDailyFortune(); createParticles();
    if (typeof Achievements !== 'undefined') Achievements.checkTimeAchievements();
    if (typeof Sync !== 'undefined') Sync.init();
    // 업데이트 알림 (1초 후 표시)
    setTimeout(checkUpdateNotice, 1000);
    // Firebase Functions로 기사 업데이트 (GitHub 불필요)
});

function initTheme() {
    const profile = Storage.getProfile();
    document.documentElement.setAttribute('data-theme', profile.theme || 'light');
    const effects = profile.effects || { particles: false, gradient: true, pattern: false };
    document.querySelector('.bg-particles')?.classList.toggle('hidden', !effects.particles);
    document.querySelector('.bg-gradient')?.classList.toggle('hidden', !effects.gradient);
    document.querySelector('.bg-pattern')?.classList.toggle('hidden', !effects.pattern);
}

function initProfile() {
    const profile = Storage.getProfile();
    const level = Storage.getLevel();
    const title = Storage.getTitleForLevel(level.level);
    document.getElementById('sidebar-mascot').textContent = profile.mascot;
    document.getElementById('mascot-level').textContent = 'Lv.' + level.level;
    document.getElementById('studio-name').textContent = profile.nickname + profile.studioName;
    document.getElementById('studio-title').textContent = title;
    document.getElementById('header-name').textContent = profile.nickname;
    updateExpBar();
}

function updateExpBar() {
    const level = Storage.getLevel();
    const required = Storage.getExpForNextLevel();
    const pct = Math.min((level.exp / required) * 100, 100);
    document.getElementById('exp-bar-fill').style.width = pct + '%';
    document.getElementById('exp-text').textContent = level.exp + ' / ' + required + ' EXP';
    const expFill = document.getElementById('exp-fill');
    if (expFill) expFill.style.width = pct + '%';
    const expDisplay = document.getElementById('exp-display');
    if (expDisplay) expDisplay.textContent = level.exp + ' / ' + required + ' EXP';
    const userLevel = document.getElementById('user-level');
    if (userLevel) userLevel.textContent = level.level;
    const userTitle = document.getElementById('user-title');
    if (userTitle) userTitle.textContent = Storage.getTitleForLevel(level.level);
}

async function loadArticles() {
    // 기사 데이터 로드 함수
    function applyArticles(data) {
        App.articles = data.articles || [];
        App.categories = data.categories || [];
        App.levels = data.levels || [];
        
        // 3일 만료 필터 (커스텀/직접입력 제외)
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        App.articles = App.articles.filter(a => {
            if (a.source?.includes('AI') || a.source?.includes('직접입력')) return true;
            if (!a.generatedAt) return true;
            return (now - new Date(a.generatedAt).getTime()) < THREE_DAYS;
        });
        
        // localStorage의 커스텀 기사 병합
        const custom = JSON.parse(localStorage.getItem('dyts_customArticles') || '[]');
        if (custom.length > 0) {
            const existIds = new Set(App.articles.map(a => a.id));
            const newCustom = custom.filter(a => !existIds.has(a.id));
            App.articles = [...newCustom, ...App.articles];
        }
        
        document.getElementById('article-count').textContent = App.articles.length;
        updateRecommended(); updateNewArticles();
    }

    try {
        // 1차: Firebase Storage (최신 기사)
        const storageUrl = 'https://firebasestorage.googleapis.com/v0/b/dayoung-studio.firebasestorage.app/o/data%2Farticles.json?alt=media';
        let res = await fetch(storageUrl);
        if (!res.ok) throw new Error('Storage fetch failed');
        const data = await res.json();
        console.log('✅ Firebase Storage에서 기사 로드:', data.articles?.length || 0, '개');
        applyArticles(data);
    } catch (e) {
        console.warn('Storage 로딩 실패, Functions API 시도:', e.message);
        try {
            // 2차: Firebase Functions API
            const res = await fetch('https://us-central1-dayoung-studio.cloudfunctions.net/getArticles');
            const data = await res.json();
            console.log('✅ Functions API에서 기사 로드:', data.articles?.length || 0, '개');
            applyArticles(data);
        } catch (e2) {
            console.warn('Functions API 실패, 로컬 fallback:', e2.message);
            try {
                // 3차: 로컬 정적 파일
                const res = await fetch('./data/articles.json');
                if (!res.ok) throw new Error('local fetch failed');
                const data = await res.json();
                applyArticles(data);
            } catch (e3) {
                console.error('기사 로딩 완전 실패:', e3);
                showToast('기사 로딩 실패', 'error');
            }
        }
    }
}

function loadUserData() {
    const streak = Storage.getStreak();
    document.getElementById('streak-count').textContent = streak.count;
    document.getElementById('streak-best').textContent = '최고: ' + streak.best + '일';
    const settings = Storage.getSettings();
    const timeGoal = document.getElementById('time-goal');
    if (timeGoal) timeGoal.textContent = settings.dailyGoal;
    document.getElementById('quiz-best').textContent = Storage.getGameBest('quiz');
    document.getElementById('typing-best').textContent = Storage.getGameBest('typing');
    document.getElementById('matching-best').textContent = Storage.getGameBest('matching') || '-';
    document.getElementById('speed-best').textContent = Storage.getGameBest('speed');
    updateGachaTickets();
    const diaryEl = document.getElementById('diary-text');
    if (diaryEl) diaryEl.value = Storage.getDiary();
    updateDdayDisplay();
}

function setupEvents() {
    document.querySelectorAll('.nav-item, .mnav').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.view)));
    ['filter-cat', 'filter-level', 'filter-direction', 'filter-sort'].forEach(id => document.getElementById(id)?.addEventListener('change', renderArticles));
    document.getElementById('archive-filter')?.addEventListener('change', renderArchive);
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); renderVocab(btn.dataset.tab);
    }));
    document.querySelectorAll('.ach-tab').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.ach-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); renderAchievements(btn.dataset.tab);
    }));
    document.getElementById('set-tts-speed')?.addEventListener('input', (e) => {
        document.getElementById('tts-speed-val').textContent = e.target.value + 'x';
    });
}

function navigateTo(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + view)?.classList.add('active');
    document.querySelectorAll('.nav-item, .mnav').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'dashboard') updateDashboard();
    else if (view === 'articles') renderArticles();
    else if (view === 'vocabulary') renderVocab('today');
    else if (view === 'archive') renderArchive();
    else if (view === 'achievements') renderAchievements('all');
    else if (view === 'customize') loadCustomizeSettings();
    else if (view === 'settings') loadSettings();
    else if (view === 'ocr') { /* OCR 뷰 */ }
    else if (view === 'counseling') { /* AI 리서치 뷰 */ }
    else if (view === 'tools') { /* 도구 추천 뷰 */ }
}

// ========== TTS ==========
function speakText(text, rate) { 
    TTS.speak(text, 'en-US', rate || Storage.getSettings().ttsSpeed || 0.9); 
}

function speakPhrase() { 
    if (App.phrases[App.phraseIndex]) {
        const lang = App.translateDirection === 'en-ko' ? 'en-US' : 'ko-KR';
        const text = App.translateDirection === 'en-ko' 
            ? App.phrases[App.phraseIndex].en 
            : (App.phrases[App.phraseIndex].ko || App.phrases[App.phraseIndex].en);
        TTS.speak(text, lang, Storage.getSettings().ttsSpeed || 0.9);
    }
}

function stopTTS() { TTS.stop(); showToast('TTS 정지'); }

// ========== 대시보드 ==========
function updateDashboard() {
    document.getElementById('today-date').textContent = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    const daily = Storage.getDailyProgress();
    const tasks = [daily.article, daily.translate, daily.vocab, daily.quiz];
    const pct = Math.round((tasks.filter(Boolean).length / 4) * 100);
    document.getElementById('hero-pct').textContent = pct + '%';
    const ring = document.getElementById('hero-ring');
    if (ring) { const c = 2 * Math.PI * 52; ring.style.strokeDasharray = c; ring.style.strokeDashoffset = c - (pct / 100) * c; }
    ['article', 'translate', 'vocab', 'quiz'].forEach((t, i) => {
        const el = document.getElementById('hc-' + t);
        if (el) el.querySelector('i').textContent = tasks[i] ? '●' : '○';
    });
    const dashTime = document.getElementById('dash-time');
    if (dashTime) dashTime.textContent = daily.time || 0;
    const vocab = Storage.getVocabulary();
    const dvTotal = document.getElementById('dv-total');
    if (dvTotal) dvTotal.textContent = vocab.length;
    const dvMastered = document.getElementById('dv-mastered');
    if (dvMastered) dvMastered.textContent = vocab.filter(w => w.mastered).length;
    const dvReview = document.getElementById('dv-review');
    if (dvReview) dvReview.textContent = Storage.getReviewWords().length;
    const profile = Storage.getProfile();
    document.getElementById('mascot-big').textContent = profile.mascot;
    document.getElementById('mascot-name-display').textContent = profile.mascotName;
    const moods = ['기분 좋음 😊', '의욕 충만 🔥', '졸린 중 😴'];
    document.getElementById('mascot-mood').textContent = moods[Math.floor(Math.random() * moods.length)];
    const msgs = ['대영아, 오늘도 화이팅! 💪', '조금씩이면 충분해 🌱', '넌 잘하고 있어! 🌟', pct + '% 달성! ' + (pct < 100 ? '거의 다 왔어!' : '오늘 완벽! 🎉')];
    document.getElementById('mascot-msg').textContent = msgs[Math.floor(Math.random() * msgs.length)];
    updateRecentBadges(); updateExpBar();
}

function updateRecommended() {
    if (!App.articles.length) return;
    const history = Storage.getHistory().filter(h => h.type === 'article').map(h => h.articleId);
    const a = App.articles.find(x => !history.includes(x.id)) || App.articles[0];
    if (!a) return;
    const cat = App.categories.find(c => c.id === a.category) || { icon: '📰', name: a.category };
    const lv = App.levels.find(l => l.id === a.level) || { icon: '📚', name: a.level };
    document.getElementById('rec-cat').textContent = cat.icon + ' ' + cat.name;
    document.getElementById('rec-level').textContent = lv.icon + ' ' + lv.name;
    document.getElementById('rec-title').textContent = a.title;
    const recSource = document.getElementById('rec-source');
    if (recSource) recSource.textContent = a.source || '';
    const recDate = document.getElementById('rec-date');
    if (recDate) recDate.textContent = formatDate(a.generatedAt);
    const recNew = document.getElementById('rec-new');
    if (recNew) recNew.textContent = a.id > 100 ? '🤖' : '';
    App.recommendedArticle = a;
}

function updateNewArticles() {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const newArts = App.articles.filter(a => a.generatedAt && new Date(a.generatedAt) > weekAgo).sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt)).slice(0, 5);
    const el = document.getElementById('new-articles-list');
    if (el) el.innerHTML = !newArts.length ? '<p class="empty-small">최근 기사 없음</p>' : newArts.map(a => '<div class="new-article-item" onclick="selectArticle(' + a.id + ')"><span class="badge-new">🆕</span><span class="na-title">' + a.title.substring(0, 35) + '...</span><span class="na-date">' + formatDate(a.generatedAt) + '</span></div>').join('');
}

function updateRecentBadges() {
    if (typeof Achievements === 'undefined') return;
    const unlocked = Achievements.getUnlocked().slice(0, 4);
    const el = document.getElementById('recent-badges');
    if (el) el.innerHTML = !unlocked.length ? '<p class="empty-small">뱃지 없음</p>' : unlocked.map(a => '<div class="badge-mini" title="' + a.name + '">' + a.icon + '</div>').join('');
}

function updateDdayDisplay() {
    const dday = Storage.getDday();
    const el = document.getElementById('dday-display');
    if (!el) return;
    if (!dday) { el.innerHTML = '<p class="empty-small">목표를 설정하세요</p>'; return; }
    const target = new Date(dday.date); const today = new Date();
    today.setHours(0,0,0,0); target.setHours(0,0,0,0);
    const diff = Math.ceil((target - today) / 86400000);
    el.innerHTML = '<div class="dday-num">' + (diff > 0 ? 'D-' : diff < 0 ? 'D+' : 'D-') + Math.abs(diff) + '</div><div class="dday-name">' + dday.name + '</div>';
}

function formatDate(d) { if (!d) return ''; const x = new Date(d); return (x.getMonth()+1) + '/' + x.getDate(); }
function startRecommended() { if (App.recommendedArticle) selectArticle(App.recommendedArticle.id); }

// ========== 잔디 ==========
function renderGrass() {
    const container = document.getElementById('grass-container');
    if (!container) return;
    const grassData = Storage.getGrassData();
    const year = new Date().getFullYear();
    document.getElementById('grass-year').textContent = year;
    let html = '';
    const start = new Date(year, 0, 1); const today = new Date();
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().split('T')[0];
        const dd = grassData[ds];
        const lv = Storage.getGrassLevel(dd);
        html += '<div class="grass-day" data-level="' + lv + '" data-date="' + ds + '" title="' + ds + '"></div>';
    }
    container.innerHTML = html;
}

// ========== 기사 목록 ==========
function renderArticles() {
    const cat = document.getElementById('filter-cat')?.value || 'all';
    const lv = document.getElementById('filter-level')?.value || 'all';
    const sort = document.getElementById('filter-sort')?.value || 'newest';
    let list = [...App.articles];
    if (cat !== 'all') list = list.filter(a => a.category === cat);
    if (lv !== 'all') list = list.filter(a => a.level === lv);
    if (sort === 'newest') list.sort((a, b) => new Date(b.generatedAt || 0) - new Date(a.generatedAt || 0));
    else if (sort === 'oldest') list.sort((a, b) => new Date(a.generatedAt || 0) - new Date(b.generatedAt || 0));
    const grid = document.getElementById('articles-grid');
    if (!list.length) { grid.innerHTML = '<div class="empty-state"><p>기사 없음</p></div>'; return; }
    
    // 아카이브에서 진행도 계산
    const archives = Storage.getArchive ? Storage.getArchive() : [];
    const articleProgressMap = {};
    
    console.log('📊 아카이브 데이터:', archives.length, '개');
    
    archives.forEach(arch => {
        if (arch.articleId) {
            if (!articleProgressMap[arch.articleId]) {
                articleProgressMap[arch.articleId] = {
                    translation: { completed: 0, total: 0, score: 0, count: 0 },
                    interpretation: { completed: 0, total: 0, score: 0, count: 0 }
                };
            }
            const type = arch.type === 'translation' ? 'translation' : 'interpretation';
            articleProgressMap[arch.articleId][type].completed = Math.max(
                articleProgressMap[arch.articleId][type].completed, 
                arch.completedPhrases || 0
            );
            articleProgressMap[arch.articleId][type].total = Math.max(
                articleProgressMap[arch.articleId][type].total,
                arch.totalPhrases || 0
            );
            articleProgressMap[arch.articleId][type].score += arch.averageScore || 0;
            articleProgressMap[arch.articleId][type].count++;
        }
    });
    
    console.log('📊 진행도 맵:', articleProgressMap);
    
    grid.innerHTML = list.map(a => {
        const ci = App.categories.find(c => c.id === a.category) || { icon: '📰', name: a.category };
        const li = App.levels.find(l => l.id === a.level) || { icon: '📚', name: a.level };
        const hasKorean = a.koreanContent ? '🇰🇷' : '';
        const sourceTag = a.isRealArticle || a.source?.includes('직접입력') 
            ? '<span class="badge-real" title="실제 기사">✓실제</span>' 
            : (a.source === 'AI Generated' ? '<span class="badge-ai" title="AI 생성">🤖AI</span>' : '');
        
        // 문장 수 계산
        const totalSentences = (a.content || '').match(/[^.!?]+[.!?]+/g)?.length || 1;
        
        // 진행도 계산 (아카이브 기반)
        const progress = articleProgressMap[a.id];
        
        // 번역 진행도
        let transPct = 0, transAvg = 0, transStatus = '미시작';
        // 통역 진행도  
        let interpPct = 0, interpAvg = 0, interpStatus = '미시작';
        
        if (progress) {
            const trans = progress.translation;
            const interp = progress.interpretation;
            
            if (trans.total > 0) {
                transPct = Math.round((trans.completed / trans.total) * 100);
                transAvg = trans.count > 0 ? Math.round(trans.score / trans.count) : 0;
                transStatus = transPct >= 100 ? '완료' : `${transPct}%`;
            }
            
            if (interp.total > 0) {
                interpPct = Math.round((interp.completed / interp.total) * 100);
                interpAvg = interp.count > 0 ? Math.round(interp.score / interp.count) : 0;
                interpStatus = interpPct >= 100 ? '완료' : `${interpPct}%`;
            }
        }
        
        // 점수 색상 클래스
        const transScoreClass = transAvg >= 80 ? 'score-high' : transAvg >= 60 ? 'score-mid' : transAvg > 0 ? 'score-low' : '';
        const interpScoreClass = interpAvg >= 80 ? 'score-high' : interpAvg >= 60 ? 'score-mid' : interpAvg > 0 ? 'score-low' : '';
        
        // 진행도 HTML
        const progressHtml = `
            <div class="article-progress-section">
                <div class="progress-row">
                    <span class="progress-label">✍️ 번역</span>
                    <div class="progress-bar-mini">
                        <div class="progress-fill-mini ${transPct === 0 ? 'empty' : ''}" style="width:${transPct}%"></div>
                    </div>
                    <span class="progress-text ${transScoreClass}">
                        ${transPct > 0 ? `${transStatus} · ${transAvg}점` : '미시작'}
                    </span>
                </div>
                <div class="progress-row">
                    <span class="progress-label">🎙️ 통역</span>
                    <div class="progress-bar-mini">
                        <div class="progress-fill-mini interp ${interpPct === 0 ? 'empty' : ''}" style="width:${interpPct}%"></div>
                    </div>
                    <span class="progress-text ${interpScoreClass}">
                        ${interpPct > 0 ? `${interpStatus} · ${interpAvg}점` : '미시작'}
                    </span>
                </div>
            </div>`;
        
        // 날짜/시간
        const dateInfo = getArticleDateInfo(a.generatedAt);
        const expiryInfo = getArticleExpiry(a);
        const expiryBadge = expiryInfo ? `<span class="expiry-badge ${expiryInfo.cls}">${expiryInfo.icon} ${expiryInfo.text}</span>` : '';
        
        return `<div class="article-card ${expiryInfo?.cls === 'expiry-urgent' ? 'card-expiring' : ''}">
            <div class="article-meta">
                <span>${ci.icon} ${ci.name}</span>
                <span>${li.icon} ${li.name}</span>
                ${hasKorean ? '<span title="한영 번역 가능">🇰🇷</span>' : ''}
                ${sourceTag}
                ${expiryBadge}
            </div>
            <h4 class="article-title">${a.title}</h4>
            <p class="article-summary">${(a.summary || a.content?.substring(0, 100) + '...')}</p>
            ${progressHtml}
            <div class="article-info">
                <div class="article-date-time">
                    <span class="date-icon">🕐</span>
                    <span class="date-full">${dateInfo.full}</span>
                    <span class="date-relative">${dateInfo.relative}</span>
                </div>
                <div class="article-stats">
                    <span>📝 ${a.wordCount || '-'}단어</span>
                    <span>📄 ${totalSentences}문장</span>
                </div>
            </div>
            <div class="article-actions">
                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); showArticleDetail(${a.id})">📖 원문</button>
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); startTranslate(${a.id})">✍️ 번역</button>
                <button class="btn btn-sm btn-accent" onclick="event.stopPropagation(); startInterpret(${a.id})">🎙️ 통역</button>
            </div>
        </div>`;
    }).join('');
}

// 기사 만료 정보 (3일 기준)
function getArticleExpiry(article) {
    // 커스텀/직접입력 기사는 만료 없음
    if (article.source?.includes('AI') || article.source?.includes('직접입력')) return null;
    if (!article.generatedAt) return null;
    
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    const created = new Date(article.generatedAt).getTime();
    const expires = created + THREE_DAYS;
    const remaining = expires - Date.now();
    
    if (remaining <= 0) return { icon: '⌛', text: '만료됨', cls: 'expiry-expired' };
    
    const hours = Math.floor(remaining / 3600000);
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    
    if (hours <= 6) return { icon: '⏰', text: `${hours}시간 남음`, cls: 'expiry-urgent' };
    if (hours <= 24) return { icon: '⏰', text: `${hours}시간 남음`, cls: 'expiry-warning' };
    return { icon: '📅', text: `${days}일 ${remHours}시간 남음`, cls: 'expiry-normal' };
}

// 기사 날짜 정보
function getArticleDateInfo(dateStr) {
    if (!dateStr) {
        return { full: '날짜 없음', relative: '' };
    }
    
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    // 전체 날짜/시간
    const full = date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // 상대 시간
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    let relative = '';
    if (minutes < 1) relative = '방금 전';
    else if (minutes < 60) relative = `${minutes}분 전`;
    else if (hours < 24) relative = `${hours}시간 전`;
    else if (days < 7) relative = `${days}일 전`;
    else if (days < 30) relative = `${Math.floor(days / 7)}주 전`;
    else if (days < 365) relative = `${Math.floor(days / 30)}개월 전`;
    else relative = `${Math.floor(days / 365)}년 전`;
    
    return { full, relative: `(${relative})` };
}

function formatFullDate(d) {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(d) {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    // 1시간 이내
    if (diffMins < 60) {
        return diffMins <= 1 ? '방금 전' : diffMins + '분 전';
    }
    // 24시간 이내
    if (diffHours < 24) {
        return diffHours + '시간 전';
    }
    // 7일 이내
    if (diffDays < 7) {
        return diffDays + '일 전';
    }
    // 그 외
    return date.toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 기사 선택 (기본: 번역으로 이동)
function selectArticle(id) {
    startTranslate(id);
}

// 번역 연습 시작
function startTranslate(id) {
    const a = App.articles.find(x => x.id === id);
    if (!a) return;
    App.currentArticle = a;
    Storage.addHistory({ type: 'article', articleId: id });
    Storage.updateDailyProgress({ article: true });
    if (typeof Achievements !== 'undefined') Achievements.check('special', { achievementId: 'first_article' });
    Storage.updateStreak();
    setupTranslation(a);
    navigateTo('translate');
}

// 통역 연습 시작
function startInterpret(id) {
    const a = App.articles.find(x => x.id === id);
    if (!a) return;
    App.currentArticle = a;
    Storage.addHistory({ type: 'article', articleId: id });
    Storage.updateDailyProgress({ article: true });
    setupInterpretation(a);
    navigateTo('interpret');
}

// 기사 원문 상세보기
function showArticleDetail(id) {
    const a = App.articles.find(x => x.id === id);
    if (!a) return;
    
    // 현재 기사 저장 (인라인 뷰용)
    App.detailArticle = a;
    
    const dateStr = a.generatedAt ? formatFullDate(a.generatedAt) : '날짜 없음';
    const sentences = (a.content || '').match(/[^.!?]+[.!?]+/g) || [];
    
    const modal = document.getElementById('article-detail-modal');
    document.getElementById('article-detail-title').textContent = a.title;
    document.getElementById('article-detail-date').textContent = '📅 ' + dateStr;
    document.getElementById('article-detail-source').textContent = a.source || '';
    document.getElementById('article-detail-stats').textContent = `${a.wordCount || '-'}단어 · ${sentences.length}문장`;
    
    // 영어 원문
    document.getElementById('article-detail-en').innerHTML = sentences.map((s, i) => 
        `<p><span class="sentence-num">${i+1}</span> ${s.trim()}</p>`
    ).join('');
    
    // 한국어 번역
    const koContent = a.koreanContent || '';
    const koSentences = koContent ? (koContent.match(/[^.!?。]+[.!?。]+/g) || [koContent]) : [];
    if (koSentences.length > 0 && koContent) {
        document.getElementById('article-detail-ko-section').style.display = 'block';
        document.getElementById('article-detail-ko').innerHTML = koSentences.map((s, i) => 
            `<p><span class="sentence-num">${i+1}</span> ${s.trim()}</p>`
        ).join('');
    } else {
        document.getElementById('article-detail-ko-section').style.display = 'none';
    }
    
    // 인라인 뷰 생성
    const inlineEl = document.getElementById('article-detail-inline');
    inlineEl.innerHTML = sentences.map((s, i) => {
        const ko = koSentences[i]?.trim() || '';
        return `<div class="inline-sentence" onclick="toggleSentenceKo(this)">
            <div class="en-text">
                <span class="sentence-num">${i+1}</span>
                <span style="flex:1">${s.trim()}</span>
                <button class="tts-btn-mini" onclick="event.stopPropagation();speakText('${s.trim().replace(/'/g, "\\'")}')">🔊</button>
            </div>
            ${ko ? `<div class="ko-text">🇰🇷 ${ko}</div>` : '<div class="ko-text" style="color:var(--text-secondary);">번역 없음</div>'}
        </div>`;
    }).join('');
    
    // 핵심 용어
    if (a.keyTerms?.length) {
        document.getElementById('article-detail-terms').innerHTML = a.keyTerms.map(t => 
            `<span class="key-term">${t.en} <span class="ko">${t.ko}</span></span>`
        ).join('');
    } else {
        document.getElementById('article-detail-terms').innerHTML = '<p>핵심 용어 없음</p>';
    }
    
    // 뷰 모드 초기화
    setArticleViewMode('separate');
    document.getElementById('toggle-ko-inline').checked = false;
    
    modal.classList.add('active');
    
    document.getElementById('btn-start-translate').onclick = () => { closeArticleDetailModal(); startTranslate(id); };
    document.getElementById('btn-start-interpret').onclick = () => { closeArticleDetailModal(); startInterpret(id); };
}

function closeArticleDetailModal() {
    document.getElementById('article-detail-modal').classList.remove('active');
}

// ========== 번역 연습 ==========
function setupTranslation(a) {
    document.getElementById('trans-empty').style.display = 'none';
    document.getElementById('trans-content').style.display = 'block';
    const ci = App.categories.find(c => c.id === a.category) || { icon: '📰', name: a.category };
    const li = App.levels.find(l => l.id === a.level) || { icon: '📚', name: a.level };
    document.getElementById('trans-cat').textContent = ci.icon + ' ' + ci.name;
    document.getElementById('trans-level').textContent = li.icon + ' ' + li.name;
    document.getElementById('trans-title').textContent = a.title;
    
    const enContent = a.content || '';
    const enSentences = enContent.match(/[^.!?]+[.!?]+/g) || [enContent];
    const koContent = a.koreanContent || '';
    const koSentences = koContent ? (koContent.match(/[^.!?。]+[.!?。]+/g) || [koContent]) : [];
    
    App.phrases = enSentences.map((s, i) => ({ 
        en: s.trim(), 
        ko: koSentences[i]?.trim() || '' 
    }));
    
    App.phraseIndex = 0; 
    App.phraseFeedbacks = [];
    
    // 한영 버튼 활성화/비활성화
    const koEnBtn = document.querySelector('.dir-btn[data-dir="ko-en"]');
    if (koEnBtn) {
        if (koContent) {
            koEnBtn.disabled = false;
            koEnBtn.title = '한영 번역 가능';
        } else {
            koEnBtn.disabled = true;
            koEnBtn.title = '한국어 원문 없음';
        }
    }
    
    if (a.keyTerms?.length) {
        document.getElementById('key-terms-list').innerHTML = a.keyTerms.map(t => 
            '<span class="key-term" onclick="addTermToVocab(\'' + t.en.replace(/'/g, "\\'") + '\', \'' + t.ko.replace(/'/g, "\\'") + '\')">' + 
            t.en + ' <span class="ko">' + t.ko + '</span></span>'
        ).join('');
    }
    
    updatePhraseDisplay();
}

function setTranslateDirection(dir) {
    // 한영인데 한국어 원문 없으면 경고
    if (dir === 'ko-en' && App.phrases.length > 0 && !App.phrases[0].ko) {
        showToast('이 기사는 한국어 원문이 없어 한영 번역을 지원하지 않습니다', 'warning');
        return;
    }
    
    App.translateDirection = dir;
    document.querySelectorAll('.dir-btn').forEach(b => b.classList.toggle('active', b.dataset.dir === dir));
    
    const input = document.getElementById('trans-input');
    if (dir === 'en-ko') {
        input.placeholder = '한국어로 번역하세요...';
    } else {
        input.placeholder = 'Translate to English...';
    }
    
    updatePhraseDisplay();
}

function updatePhraseDisplay() {
    const p = App.phrases[App.phraseIndex]; 
    if (!p) return;
    
    const total = App.phrases.length; 
    const cur = App.phraseIndex + 1;
    
    document.getElementById('trans-progress-fill').style.width = (cur / total * 100) + '%';
    document.getElementById('trans-progress-text').textContent = cur + ' / ' + total;
    document.getElementById('phrase-num').textContent = cur;
    
    if (App.translateDirection === 'en-ko') {
        document.getElementById('phrase-text').textContent = p.en;
    } else {
        document.getElementById('phrase-text').textContent = p.ko || p.en;
    }
    
    document.getElementById('trans-input').value = '';
    document.getElementById('feedback-area').style.display = 'none';
}

// ========== 첨삭 ==========
async function submitWithGPT() { await submitTranslation(false); }
async function submitWithClaude() { await submitTranslation(true); }

async function submitTranslation(usePremium = false) {
    const input = document.getElementById('trans-input').value.trim();
    if (!input) { showToast('번역을 입력해주세요', 'warning'); return; }
    
    const modelName = usePremium ? 'Claude Opus 4' : 'Claude Sonnet 4';
    showLoading(true, modelName + ' 첨삭 중...');
    
    const p = App.phrases[App.phraseIndex];
    const orig = App.translateDirection === 'en-ko' ? p.en : (p.ko || p.en);
    
    try {
        const fb = await API.getTranslationFeedback(orig, input, App.translateDirection, usePremium);
        App.phraseFeedbacks.push({ original: orig, userTranslation: input, feedback: fb, score: fb.score, model: modelName });
        
        // 문장별 첨삭 기록 저장
        saveSentenceFeedback({
            type: 'translation',
            articleId: App.currentArticle?.id,
            articleTitle: App.currentArticle?.title || '',
            sentenceIndex: App.phraseIndex,
            original: orig,
            userTranslation: input,
            direction: App.translateDirection,
            score: fb.score,
            feedback: fb.feedback,
            modelAnswer: fb.modelAnswer || '',
            improvements: fb.improvements || [],
            goodPoints: fb.goodPoints || [],
            model: modelName,
            date: new Date().toISOString()
        });
        
        const modelBadge = usePremium 
            ? '<span class="model-badge premium">✨ Claude Sonnet 4</span>' 
            : '<span class="model-badge gpt">🚀 Claude Sonnet 4</span>';
        
        let analysisHtml = '';
        if (fb.analysis) {
            analysisHtml = '<div class="analysis-section">';
            if (fb.analysis.accuracy) analysisHtml += '<div class="analysis-item"><strong>📌 정확성:</strong> ' + fb.analysis.accuracy + '</div>';
            if (fb.analysis.naturalness) analysisHtml += '<div class="analysis-item"><strong>💬 자연스러움:</strong> ' + fb.analysis.naturalness + '</div>';
            if (fb.analysis.terminology) analysisHtml += '<div class="analysis-item"><strong>📖 용어:</strong> ' + fb.analysis.terminology + '</div>';
            if (fb.analysis.style) analysisHtml += '<div class="analysis-item"><strong>🎨 문체:</strong> ' + fb.analysis.style + '</div>';
            analysisHtml += '</div>';
        }
        
        document.getElementById('feedback-score').textContent = fb.score;
        document.getElementById('feedback-content').innerHTML = 
            modelBadge + 
            '<p class="feedback-main">' + fb.feedback + '</p>' + 
            analysisHtml +
            (fb.goodPoints?.length ? '<h4>✅ 잘한 점</h4><ul>' + fb.goodPoints.map(x => '<li>' + x + '</li>').join('') + '</ul>' : '') + 
            (fb.improvements?.length ? '<h4>💡 개선점</h4><ul>' + fb.improvements.map(x => '<li>' + x + '</li>').join('') + '</ul>' : '') + 
            (fb.modelAnswer ? '<h4>📝 모범 번역</h4><div class="model-answer">' + fb.modelAnswer + '</div>' : '');
        
        document.getElementById('feedback-area').style.display = 'block';
        
        const exp = Math.floor(fb.score / 10);
        const result = Storage.addExp(exp);
        Storage.updateGrass(1, 1);
        Storage.updateDailyProgress({ translate: true });
        if (result.leveledUp) showLevelUp(result.newLevel);
        if (typeof Achievements !== 'undefined') {
            Achievements.check('translations').forEach(a => showBadgeUnlock(a));
        }
    } catch (e) { 
        showToast('첨삭 실패: ' + e.message, 'error'); 
        console.error(e); 
    }
    showLoading(false);
}

function skipPhrase() { 
    App.phraseFeedbacks.push({ original: App.phrases[App.phraseIndex].en, userTranslation: '', score: 0, skipped: true }); 
    nextPhrase(); 
}

function nextPhrase() {
    App.phraseIndex++;
    if (App.phraseIndex < App.phrases.length) updatePhraseDisplay();
    else finishTranslation();
}

function finishTranslation() {
    const completed = App.phraseFeedbacks.filter(f => !f.skipped).length;
    const avg = completed > 0 ? Math.round(App.phraseFeedbacks.filter(f => !f.skipped).reduce((s, f) => s + f.score, 0) / completed) : 0;
    
    // 진행도 저장
    if (Storage.saveArticleProgress) {
        Storage.saveArticleProgress(App.currentArticle.id, completed, App.phrases.length);
    }
    
    // 아카이브 저장
    const archiveData = { 
        type: 'translation', 
        articleId: App.currentArticle.id, 
        articleTitle: App.currentArticle.title, 
        totalPhrases: App.phrases.length, 
        completedPhrases: completed, 
        averageScore: avg, 
        phraseFeedbacks: App.phraseFeedbacks, 
        direction: App.translateDirection,
        date: new Date().toISOString()
    };
    
    console.log('💾 아카이브 저장:', archiveData);
    
    try {
        if (typeof Storage !== 'undefined' && Storage.addArchive) {
            Storage.addArchive(archiveData);
        } else {
            // 직접 localStorage에 저장
            const archives = JSON.parse(localStorage.getItem('archives') || '[]');
            archiveData.id = Date.now();
            archives.unshift(archiveData);
            localStorage.setItem('archives', JSON.stringify(archives.slice(0, 100)));
            console.log('✅ 아카이브 직접 저장 완료');
        }
    } catch (e) {
        console.error('❌ 아카이브 저장 실패:', e);
    }
    
    // 가챠 티켓
    if (Storage.addGachaTicket) {
        Storage.addGachaTicket(1);
    }
    
    showToast('완료! 평균 ' + avg + '점, +1 티켓');
    navigateTo('dashboard'); 
    updateDashboard();
    // 자동 동기화
    if (typeof Sync !== 'undefined') Sync.autoSync();
}

// 문장별 첨삭 기록 저장
function saveSentenceFeedback(record) {
    try {
        record.id = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const history = JSON.parse(localStorage.getItem('dyts_feedback_history') || '[]');
        history.unshift(record);
        localStorage.setItem('dyts_feedback_history', JSON.stringify(history.slice(0, 500)));
        console.log('💾 첨삭 기록 저장:', record.type, record.sentenceIndex, record.score + '점');
    } catch (e) {
        console.error('첨삭 기록 저장 실패:', e);
    }
}

function addTermToVocab(en, ko) { Storage.addWord({ english: en, korean: ko }); showToast('"' + en + '" 추가됨'); }

// ========== 통역 연습 ==========
const InterpretApp = {
    stage: 1,
    currentPhrase: null,
    phraseIndex: 0,
    results: [],
    direction: 'en-ko' // 'en-ko' = 영→한, 'ko-en' = 한→영
};

function setupInterpretation(a) {
    document.getElementById('interp-empty').style.display = 'none';
    document.getElementById('interp-content').style.display = 'block';
    
    const enContent = a.content || '';
    const enSentences = enContent.match(/[^.!?]+[.!?]+/g) || [enContent];
    const koContent = a.koreanContent || '';
    const koSentences = koContent ? (koContent.match(/[^.!?。]+[.!?。]+/g) || [koContent]) : [];
    
    App.phrases = enSentences.map((s, i) => ({ 
        en: s.trim(), 
        ko: koSentences[i]?.trim() || '' 
    }));
    
    InterpretApp.phraseIndex = 0;
    InterpretApp.results = [];
    InterpretApp.stage = 1;
    InterpretApp.direction = 'en-ko'; // 기본값: 영→한
    
    // 통역 방향 전환 UI 삽입
    const hasKorean = !!koContent;
    let dirContainer = document.getElementById('interp-direction-toggle');
    if (!dirContainer) {
        // 요소가 없으면 interp-content 상단에 동적 생성
        const interpContent = document.getElementById('interp-content');
        if (interpContent) {
            const div = document.createElement('div');
            div.id = 'interp-direction-toggle';
            div.style.cssText = 'margin-bottom: 12px;';
            interpContent.insertBefore(div, interpContent.firstChild);
            dirContainer = div;
        }
    }
    if (dirContainer) {
        dirContainer.innerHTML = `
            <div class="direction-toggle">
                <button class="dir-btn active" data-dir="en-ko" onclick="setInterpretDirection('en-ko')">🇺🇸→🇰🇷 영→한</button>
                <button class="dir-btn" data-dir="ko-en" onclick="setInterpretDirection('ko-en')" ${!hasKorean ? 'disabled title="한국어 원문 없음"' : ''}>🇰🇷→🇺🇸 한→영</button>
            </div>
        `;
    }
    
    updateInterpretStage();
    showInterpretPhrase();
}

function setInterpretDirection(dir) {
    // 한→영인데 한국어 원문 없으면 경고
    if (dir === 'ko-en' && App.phrases.length > 0 && !App.phrases[0].ko) {
        showToast('이 기사는 한국어 원문이 없어 한→영 통역을 지원하지 않습니다', 'warning');
        return;
    }
    
    InterpretApp.direction = dir;
    
    // 버튼 활성화 상태 토글
    const container = document.getElementById('interp-direction-toggle');
    if (container) {
        container.querySelectorAll('.dir-btn').forEach(b => b.classList.toggle('active', b.dataset.dir === dir));
    }
    
    // 진행 중이면 리셋
    if (InterpretApp.phraseIndex > 0 || InterpretApp.stage > 1) {
        InterpretApp.phraseIndex = 0;
        InterpretApp.results = [];
        InterpretApp.stage = 1;
        updateInterpretStage();
    }
    
    showInterpretPhrase();
}

function updateInterpretStage() {
    document.querySelectorAll('.interp-stages .stage').forEach((el, i) => {
        el.classList.toggle('active', i + 1 === InterpretApp.stage);
        el.classList.toggle('completed', i + 1 < InterpretApp.stage);
    });
}

function showInterpretPhrase() {
    const p = App.phrases[InterpretApp.phraseIndex];
    if (!p) return;
    
    InterpretApp.currentPhrase = p;
    const workspace = document.getElementById('interp-workspace');
    const total = App.phrases.length;
    const current = InterpretApp.phraseIndex + 1;
    
    workspace.innerHTML = `
        <div class="interp-progress">
            <span>${current} / ${total} 문장</span>
            <div class="progress-bar"><div class="progress-fill" style="width:${(current/total)*100}%"></div></div>
        </div>
        <div class="interp-stage-content">
            ${getStageContent(InterpretApp.stage, p)}
        </div>
    `;
}

function getStageContent(stage, phrase) {
    const isEnToKo = InterpretApp.direction === 'en-ko';
    const listenLabel = isEnToKo ? '영어 원문' : '한국어 원문';
    const interpLabel = isEnToKo ? '한국어로 통역' : 'Translate to English';
    const interpPlaceholder = isEnToKo ? '녹음 버튼을 누르거나 직접 입력하세요...' : 'Press record or type your interpretation...';
    
    switch(stage) {
        case 1: // 듣기
            return `
                <div class="stage-box">
                    <h3>🎧 1단계: 듣기</h3>
                    <p class="stage-desc">${listenLabel}을 듣고 내용을 파악하세요</p>
                    <div class="audio-controls">
                        <button class="btn btn-lg btn-primary" onclick="playInterpretAudio()">
                            🔊 원문 듣기
                        </button>
                        <button class="btn btn-secondary" onclick="playInterpretAudio(0.7)">
                            🐢 느리게
                        </button>
                    </div>
                    <div class="stage-actions">
                        <button class="btn btn-ghost" onclick="showInterpretText()">📖 원문 보기</button>
                        <button class="btn btn-primary" onclick="nextInterpretStage()">다음 단계 →</button>
                    </div>
                </div>
            `;
        case 2: // 기억
            return `
                <div class="stage-box">
                    <h3>🧠 2단계: 기억</h3>
                    <p class="stage-desc">들은 내용을 정리하고 핵심을 기억하세요 (10초)</p>
                    <div class="timer-display" id="interp-timer">10</div>
                    <div class="stage-actions">
                        <button class="btn btn-secondary" onclick="playInterpretAudio()">🔊 다시 듣기</button>
                        <button class="btn btn-primary" onclick="nextInterpretStage()">녹음 시작 →</button>
                    </div>
                </div>
            `;
        case 3: // 녹음/입력
            return `
                <div class="stage-box">
                    <h3>🎙️ 3단계: 통역</h3>
                    <p class="stage-desc">${interpLabel}하세요 (녹음 또는 직접 입력)</p>
                    <div class="interp-record-area">
                        <button class="btn btn-record" id="btn-record" onclick="toggleInterpretRecord()">
                            <span class="record-icon">🎙️</span>
                            <span class="record-label">녹음 시작</span>
                        </button>
                        <div class="record-status" id="record-status" style="display:none;">
                            <span class="record-dot"></span>
                            <span id="record-status-text">녹음 중...</span>
                        </div>
                    </div>
                    <textarea id="interp-input" placeholder="${interpPlaceholder}" style="width:100%;height:120px;padding:12px;border-radius:8px;border:1px solid var(--border-color);font-size:16px;"></textarea>
                    <div class="stage-actions">
                        <button class="btn btn-secondary" onclick="playInterpretAudio()">🔊 다시 듣기</button>
                        <button class="btn btn-primary" onclick="submitInterpretation()">제출 & 평가 →</button>
                    </div>
                </div>
            `;
        case 4: // 평가
            return `
                <div class="stage-box">
                    <h3>📊 4단계: 평가</h3>
                    <div id="interp-feedback">평가 중...</div>
                </div>
            `;
        default:
            return '';
    }
}

// 통역 녹음 (STT)
let isRecordingInterp = false;

function toggleInterpretRecord() {
    if (isRecordingInterp) {
        stopInterpretRecord();
    } else {
        startInterpretRecord();
    }
}

function startInterpretRecord() {
    const btn = document.getElementById('btn-record');
    const status = document.getElementById('record-status');
    const input = document.getElementById('interp-input');
    
    if (!STT.init()) {
        showToast('이 브라우저에서 마이크를 지원하지 않습니다', 'error');
        return;
    }
    
    isRecordingInterp = true;
    btn.classList.add('recording');
    btn.querySelector('.record-label').textContent = '녹음 중지';
    status.style.display = 'flex';
    document.getElementById('record-status-text').textContent = '녹음 중... 말씀하세요';
    
    // 기존 텍스트 유지하면서 이어 쓰기
    const existingText = input.value.trim();
    
    // 방향에 따라 STT 언어 변경: 영→한이면 한국어 인식, 한→영이면 영어 인식
    const sttLang = InterpretApp.direction === 'en-ko' ? 'ko-KR' : 'en-US';
    
    STT.start(sttLang, 
        // onResult
        (text, isFinal) => {
            if (isFinal) {
                input.value = existingText ? existingText + ' ' + text : text;
                document.getElementById('record-status-text').textContent = '✅ 인식 완료';
            } else {
                // 중간 결과 미리보기
                input.value = existingText ? existingText + ' ' + text : text;
                document.getElementById('record-status-text').textContent = '🎤 ' + text;
            }
        },
        // onEnd
        () => {
            isRecordingInterp = false;
            btn.classList.remove('recording');
            btn.querySelector('.record-label').textContent = '녹음 시작';
            setTimeout(() => { status.style.display = 'none'; }, 1500);
        }
    );
}

function stopInterpretRecord() {
    STT.stop();
    isRecordingInterp = false;
    const btn = document.getElementById('btn-record');
    if (btn) {
        btn.classList.remove('recording');
        btn.querySelector('.record-label').textContent = '녹음 시작';
    }
    const status = document.getElementById('record-status');
    if (status) {
        document.getElementById('record-status-text').textContent = '녹음 종료';
        setTimeout(() => { status.style.display = 'none'; }, 1000);
    }
}

function playInterpretAudio(rate = 1) {
    if (InterpretApp.currentPhrase) {
        const isEnToKo = InterpretApp.direction === 'en-ko';
        const text = isEnToKo ? InterpretApp.currentPhrase.en : (InterpretApp.currentPhrase.ko || InterpretApp.currentPhrase.en);
        const lang = isEnToKo ? 'en-US' : 'ko-KR';
        TTS.speak(text, lang, rate);
    }
}

function showInterpretText() {
    if (InterpretApp.currentPhrase) {
        const isEnToKo = InterpretApp.direction === 'en-ko';
        const text = isEnToKo ? InterpretApp.currentPhrase.en : (InterpretApp.currentPhrase.ko || InterpretApp.currentPhrase.en);
        showToast(text, 'info');
    }
}

function nextInterpretStage() {
    InterpretApp.stage++;
    if (InterpretApp.stage > 3) {
        // 3단계(통역 입력) 다음은 submitInterpretation에서 처리
        return;
    }
    updateInterpretStage();
    showInterpretPhrase();
    
    // 2단계 타이머
    if (InterpretApp.stage === 2) {
        startInterpretTimer();
    }
}

function startInterpretTimer() {
    let seconds = 10;
    const timer = document.getElementById('interp-timer');
    const interval = setInterval(() => {
        seconds--;
        if (timer) timer.textContent = seconds;
        if (seconds <= 0) {
            clearInterval(interval);
            nextInterpretStage();
        }
    }, 1000);
}

async function submitInterpretation() {
    const inputEl = document.getElementById('interp-input');
    const input = inputEl?.value.trim();
    if (!input) { showToast('통역 내용을 입력하세요', 'warning'); return; }
    
    // 입력값 저장 (에러 시 복구용)
    const savedInput = input;
    
    InterpretApp.stage = 4;
    updateInterpretStage();
    
    const workspace = document.getElementById('interp-workspace');
    const total = App.phrases.length;
    const current = InterpretApp.phraseIndex + 1;
    
    workspace.innerHTML = `
        <div class="interp-progress">
            <span>${current} / ${total} 문장</span>
            <div class="progress-bar"><div class="progress-fill" style="width:${(current/total)*100}%"></div></div>
        </div>
        <div class="interp-stage-content">
            <div class="stage-box">
                <h3>📊 4단계: 평가</h3>
                <div id="interp-feedback" style="padding: 20px; text-align: center;">
                    <div style="font-size: 24px; margin-bottom: 12px;">⏳</div>
                    <p>AI 평가 중...</p>
                    <p style="font-size: 12px; color: #888; margin-top: 8px;">잠시만 기다려주세요</p>
                </div>
            </div>
        </div>
    `;
    
    console.log('=== 통역 평가 시작 ===');
    console.log('방향:', InterpretApp.direction);
    console.log('원문:', InterpretApp.currentPhrase?.en);
    console.log('통역:', savedInput);
    
    try {
        // 방향에 따라 원문 선택
        const isEnToKo = InterpretApp.direction === 'en-ko';
        const originalText = isEnToKo 
            ? InterpretApp.currentPhrase?.en 
            : (InterpretApp.currentPhrase?.ko || InterpretApp.currentPhrase?.en);
        
        if (!originalText) {
            throw new Error('원문이 없습니다');
        }
        
        const fb = await API.getInterpretationFeedback(
            originalText, 
            savedInput, 
            InterpretApp.direction, 
            false
        );
        
        console.log('=== 평가 결과 ===', fb);
        
        InterpretApp.results.push({
            original: originalText,
            interpretation: savedInput,
            score: fb?.score || 0,
            feedback: fb,
            direction: InterpretApp.direction
        });
        
        // 문장별 첨삭 기록 저장
        saveSentenceFeedback({
            type: 'interpretation',
            articleId: App.currentArticle?.id,
            articleTitle: App.currentArticle?.title || '',
            sentenceIndex: InterpretApp.phraseIndex,
            original: originalText,
            userTranslation: savedInput,
            direction: InterpretApp.direction,
            score: fb?.score || 0,
            feedback: fb?.feedback || '',
            modelAnswer: fb?.modelInterpretation || '',
            improvements: fb?.missedPoints || [],
            goodPoints: fb?.goodPoints || [],
            model: 'Claude Sonnet 4',
            date: new Date().toISOString()
        });
        
        const feedbackEl = document.getElementById('interp-feedback');
        if (feedbackEl) {
            feedbackEl.innerHTML = `
                <div class="feedback-score" style="text-align: center; margin-bottom: 16px;">
                    <span class="score-num" style="font-size: 48px; font-weight: bold; color: var(--accent-primary);">${fb?.score || 0}</span>
                    <span class="score-label" style="font-size: 18px;">점</span>
                </div>
                <p class="feedback-main" style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 16px;">${fb?.feedback || '평가 완료'}</p>
                ${fb?.missedPoints?.length ? '<div style="margin-bottom: 12px;"><h4 style="margin-bottom: 8px;">❌ 누락된 내용</h4><ul style="padding-left: 20px;">' + fb.missedPoints.map(p => '<li>' + p + '</li>').join('') + '</ul></div>' : ''}
                ${fb?.goodPoints?.length ? '<div style="margin-bottom: 12px;"><h4 style="margin-bottom: 8px;">✅ 잘한 점</h4><ul style="padding-left: 20px;">' + fb.goodPoints.map(p => '<li>' + p + '</li>').join('') + '</ul></div>' : ''}
                ${fb?.modelInterpretation ? '<div style="margin-bottom: 16px;"><h4 style="margin-bottom: 8px;">📝 모범 통역</h4><div class="model-answer" style="padding: 12px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border-radius: 8px; border-left: 4px solid var(--accent-primary);">' + fb.modelInterpretation + '</div></div>' : ''}
                <button class="btn btn-primary" onclick="nextInterpretPhrase()" style="width: 100%; margin-top: 16px;">
                    ${InterpretApp.phraseIndex < App.phrases.length - 1 ? '다음 문장 →' : '🎉 결과 보기'}
                </button>
            `;
        }
    } catch (e) {
        console.error('=== 통역 평가 오류 ===', e);
        
        InterpretApp.results.push({
            original: (InterpretApp.direction === 'en-ko' ? InterpretApp.currentPhrase?.en : (InterpretApp.currentPhrase?.ko || InterpretApp.currentPhrase?.en)) || '',
            interpretation: savedInput,
            score: 0,
            error: e.message,
            direction: InterpretApp.direction
        });
        
        const feedbackEl = document.getElementById('interp-feedback');
        if (feedbackEl) {
            feedbackEl.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
                    <p style="color: #dc3545; font-weight: bold; margin-bottom: 8px;">평가 중 오류 발생</p>
                    <p style="font-size: 12px; color: #666; margin-bottom: 16px;">${e.message}</p>
                    <p style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                        <strong>내 통역:</strong> "${savedInput}"
                    </p>
                    <div style="display: flex; gap: 8px; justify-content: center;">
                        <button class="btn btn-secondary" onclick="retryInterpretation('${savedInput.replace(/'/g, "\\'")}')">다시 시도</button>
                        <button class="btn btn-ghost" onclick="nextInterpretPhrase()">건너뛰기</button>
                    </div>
                </div>
            `;
        }
    }
}

function retryInterpretation(savedInput) {
    InterpretApp.stage = 3;
    updateInterpretStage();
    showInterpretPhrase();
    // 저장된 입력값 복원
    setTimeout(() => {
        const inputEl = document.getElementById('interp-input');
        if (inputEl) inputEl.value = savedInput;
    }, 100);
}

function nextInterpretPhrase() {
    InterpretApp.phraseIndex++;
    if (InterpretApp.phraseIndex >= App.phrases.length) {
        finishInterpretation();
        return;
    }
    InterpretApp.stage = 1;
    updateInterpretStage();
    showInterpretPhrase();
}

function finishInterpretation() {
    const completed = InterpretApp.results.length;
    const avg = completed > 0 ? Math.round(InterpretApp.results.reduce((s, r) => s + (r.score || 0), 0) / completed) : 0;
    
    const archiveData = { 
        type: 'interpretation', 
        articleId: App.currentArticle?.id,
        articleTitle: App.currentArticle?.title || '제목 없음', 
        totalPhrases: App.phrases.length, 
        completedPhrases: completed, 
        averageScore: avg, 
        results: InterpretApp.results,
        direction: InterpretApp.direction,
        date: new Date().toISOString()
    };
    
    console.log('💾 통역 아카이브 저장:', archiveData);
    
    try {
        if (typeof Storage !== 'undefined' && Storage.addArchive) {
            Storage.addArchive(archiveData);
        } else {
            // 직접 localStorage에 저장
            const archives = JSON.parse(localStorage.getItem('archives') || '[]');
            archiveData.id = Date.now();
            archives.unshift(archiveData);
            localStorage.setItem('archives', JSON.stringify(archives.slice(0, 100)));
        }
        console.log('✅ 통역 아카이브 저장 완료');
    } catch (e) {
        console.error('❌ 통역 아카이브 저장 실패:', e);
    }
    
    try {
        if (Storage.addGachaTicket) {
            Storage.addGachaTicket(1);
        }
    } catch (e) {
        console.error('가챠 티켓 추가 실패:', e);
    }
    
    showToast('통역 완료! 평균 ' + avg + '점, +1 티켓');
    navigateTo('dashboard'); 
    updateDashboard();
    // 자동 동기화
    if (typeof Sync !== 'undefined') Sync.autoSync();
}

// ========== 기사 업데이트 ==========
function openArticleUpdateModal() {
    document.getElementById('article-update-modal').classList.add('active');
    document.getElementById('update-form-area').style.display = 'none';
    document.getElementById('update-form-area').innerHTML = '';
}

function closeArticleUpdateModal() {
    document.getElementById('article-update-modal').classList.remove('active');
}

// Firebase Functions 기사 자동 수집
async function updateFromRSS() {
    showLoading(true, '기사 업데이트 요청 중...');
    
    try {
        const success = await API.triggerArticleUpdate();
        showLoading(false);
        
        if (success) {
            showToast('✅ 기사 업데이트 완료! 새로고침 중...', 'success');
            closeArticleUpdateModal();
            setTimeout(() => location.reload(), 2000);
        } else {
            showToast('❌ 기사 업데이트 실패. AI 기사 생성을 이용해주세요.', 'error');
        }
    } catch (e) {
        showLoading(false);
        showToast('에러: ' + e.message + ' — AI 기사 생성을 이용해주세요.', 'error');
    }
}

// AI 기사 자동 생성 (Claude Sonnet으로 오늘 날짜 기사 즉시 생성)
async function generateAIArticle() {
    const formArea = document.getElementById('update-form-area');
    formArea.style.display = 'block';
    formArea.innerHTML = `
        <div style="margin-bottom:16px;">
            <label style="font-weight:600;margin-bottom:8px;display:block;">📰 기사 주제 선택</label>
            <select id="ai-article-category" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--border-color);font-size:14px;">
                <option value="economy">💹 경제/금융 뉴스</option>
                <option value="politics">🌍 국제정치/외교</option>
                <option value="tech">💻 기술/IT</option>
                <option value="health">🏥 보건/의료</option>
                <option value="law">⚖️ 법률/규제</option>
                <option value="science">🔬 과학</option>
            </select>
        </div>
        <div style="margin-bottom:16px;">
            <label style="font-weight:600;margin-bottom:8px;display:block;">🎯 난이도</label>
            <select id="ai-article-level" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--border-color);font-size:14px;">
                <option value="intermediate">📗 중급 (CEFR B2)</option>
                <option value="advanced" selected>📘 고급 (CEFR C1)</option>
                <option value="expert">📕 전문가 (CEFR C2)</option>
            </select>
        </div>
        <div style="margin-bottom:16px;">
            <label style="font-weight:600;margin-bottom:8px;display:block;">📝 키워드 (선택)</label>
            <input type="text" id="ai-article-keyword" placeholder="예: AI regulation, climate summit, Fed rate..." 
                style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--border-color);font-size:14px;">
            <small style="color:var(--text-secondary);">비워두면 오늘 날짜 기반 자동 주제 선정</small>
        </div>
        <button class="btn btn-primary" onclick="doGenerateAIArticle()" style="width:100%;">
            ✨ AI 기사 생성 (Claude Sonnet 4)
        </button>
    `;
}

async function doGenerateAIArticle() {
    const category = document.getElementById('ai-article-category').value;
    const level = document.getElementById('ai-article-level').value;
    const keyword = document.getElementById('ai-article-keyword').value.trim();
    
    const catNames = { economy:'Economy/Finance', politics:'International Politics', tech:'Technology', health:'Healthcare', law:'Law/Regulation', science:'Science' };
    const levelDesc = { intermediate:'B2 level, 250-300 words', advanced:'C1 level, 350-400 words, Reuters style', expert:'C2 level, 400-500 words, specialized terminology' };
    const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    
    const prompt = `You are a professional news editor creating translation study material.

Date: ${today}
Category: ${catNames[category]}
Level: ${levelDesc[level]}
${keyword ? `Topic hint: ${keyword}` : 'Generate a timely, realistic topic for today.'}

Create a realistic news article for Korean translation students:

1. Write a full English article (${levelDesc[level]})
2. Professional journalistic style
3. Include realistic quotes and statistics
4. Translate the ENTIRE article to natural Korean (통번역 대학원 수준)
5. Extract 5 key terms

Respond with JSON ONLY:
{
  "title": "English headline",
  "content": "Full English article",
  "koreanTitle": "한국어 제목",
  "koreanContent": "전체 한국어 번역",
  "summary": "2-3 sentence summary",
  "keyTerms": [{"en":"term","ko":"한국어"}]
}`;

    showLoading(true, 'AI가 기사를 작성 중... ✍️');
    
    try {
        const response = await API.callGPT(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) throw new Error('응답 파싱 실패');
        
        const article = JSON.parse(jsonMatch[0]);
        const newId = Math.max(0, ...App.articles.map(a => a.id || 0)) + 1;
        
        const newArticle = {
            id: newId,
            title: article.title,
            content: article.content,
            koreanTitle: article.koreanTitle,
            koreanContent: article.koreanContent,
            summary: article.summary,
            category: category,
            level: level,
            source: 'AI Generated',
            keyTerms: article.keyTerms || [],
            wordCount: (article.content || '').split(/\s+/).length,
            generatedAt: new Date().toISOString()
        };
        
        App.articles.unshift(newArticle);
        localStorage.setItem('dyts_customArticles', JSON.stringify(App.articles.filter(a => a.source?.includes('AI') || a.source?.includes('직접입력'))));
        
        showLoading(false);
        showToast('✅ 새 기사가 생성되었어! 📰', 'success');
        closeArticleUpdateModal();
        renderArticles();
        document.getElementById('article-count').textContent = App.articles.length;
    } catch (error) {
        showLoading(false);
        showToast('❌ 생성 실패: ' + error.message, 'error');
    }
}

// URL에서 기사 추가 (복사/붙여넣기 안내)
function updateFromURL() {
    const formArea = document.getElementById('update-form-area');
    formArea.style.display = 'block';
    formArea.innerHTML = `
        <div style="background: #fff3cd; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin:0; color: #856404;">
                ⚠️ <strong>브라우저 보안 제한</strong>으로 URL 직접 접근이 불가합니다.<br>
                기사 페이지에서 <strong>제목과 본문을 복사</strong>해서 "직접 입력"을 사용하세요.
            </p>
        </div>
        <button class="btn btn-primary" onclick="updateManual()">
            ✍️ 직접 입력으로 이동
        </button>
    `;
}

async function processArticleURL() {
    showToast('URL 직접 접근 불가. "직접 입력"을 사용하세요.', 'warning');
}

// 직접 입력
function updateManual() {
    const formArea = document.getElementById('update-form-area');
    formArea.style.display = 'block';
    formArea.innerHTML = `
        <div style="background: #d4edda; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin:0; color: #155724;">
                ✅ <strong>원문 100% 유지</strong> - 복사한 기사가 그대로 저장됩니다.<br>
                AI는 번역과 핵심용어 추출만 담당합니다.
            </p>
        </div>
        <div class="form-group">
            <label>📰 기사 제목 (복사/붙여넣기)</label>
            <input type="text" id="manual-title" placeholder="기사 제목을 붙여넣으세요" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--border-color);">
        </div>
        <div class="form-group">
            <label>📝 기사 본문 (복사/붙여넣기)</label>
            <textarea id="manual-content" placeholder="기사 전체 본문을 붙여넣으세요..." style="width:100%;height:250px;padding:12px;border-radius:8px;border:1px solid var(--border-color);resize:vertical;font-size:14px;line-height:1.6;"></textarea>
        </div>
        <div class="form-group">
            <label>🌐 원문 언어</label>
            <select id="manual-lang" style="padding:12px;border-radius:8px;border:1px solid var(--border-color);width:100%;">
                <option value="en">🇺🇸 영어 기사 → 한국어 번역 생성</option>
                <option value="ko">🇰🇷 한국어 기사 → 영어 번역 생성</option>
            </select>
        </div>
        <button class="btn btn-primary" onclick="processManualArticle()" style="margin-top:12px;width:100%;">
            ✨ 번역 생성 및 기사 추가
        </button>
    `;
}

async function processManualArticle() {
    const title = document.getElementById('manual-title').value.trim();
    const content = document.getElementById('manual-content').value.trim();
    const lang = document.getElementById('manual-lang').value;
    
    if (!title || !content) { showToast('제목과 내용을 입력하세요', 'warning'); return; }
    
    showLoading(true, '번역 및 용어 추출 중...');
    
    try {
        const article = await API.createArticleFromText(title, content, lang === 'ko');
        
        if (article) {
            const newId = Math.max(0, ...App.articles.map(a => a.id || 0)) + 1;
            const newArticle = {
                id: newId,
                // 원문 유지
                title: article.title,
                content: article.content,
                koreanContent: article.koreanContent || '',
                summary: article.summary || content.substring(0, 150) + '...',
                category: article.category || 'economy',
                level: 'advanced',
                source: lang === 'ko' ? '직접입력 (한국어 원문)' : '직접입력 (영어 원문)',
                keyTerms: article.keyTerms || [],
                wordCount: article.content.split(/\s+/).length,
                generatedAt: new Date().toISOString(),
                isRealArticle: true // 실제 기사 표시
            };
            
            App.articles.unshift(newArticle);
            localStorage.setItem('dyts_customArticles', JSON.stringify(App.articles.filter(a => a.source?.includes('직접입력'))));
            
            showLoading(false);
            showToast('✅ 기사 추가 완료! (원문 유지, 번역 생성됨)', 'success');
            closeArticleUpdateModal();
            renderArticles();
        } else {
            throw new Error('변환 실패');
        }
    } catch (e) {
        showLoading(false);
        showToast('❌ 변환 실패: ' + e.message, 'error');
    }
}

// ========== 단어장 ==========
function renderVocab(tab) {
    let words = [];
    if (tab === 'today') words = Storage.getTodayWords();
    else if (tab === 'all') words = Storage.getVocabulary();
    else if (tab === 'starred') words = Storage.getVocabulary().filter(w => w.starred);
    else if (tab === 'review') words = Storage.getReviewWords();
    const el = document.getElementById('vocab-list');
    if (!words.length) { el.innerHTML = '<div class="empty-state"><p>단어 없음</p></div>'; return; }
    el.innerHTML = words.map(w => '<div class="vocab-item"><span class="vocab-en">' + w.english + '</span><span class="vocab-ko">' + w.korean + '</span>' + (w.partOfSpeech ? '<span class="vocab-pos">' + w.partOfSpeech + '</span>' : '') + '<div class="vocab-actions"><button onclick="toggleStar(' + w.id + ')" class="' + (w.starred ? 'starred' : '') + '">' + (w.starred ? '⭐' : '☆') + '</button><button onclick="speakText(\'' + w.english.replace(/'/g, "\\'") + '\')">🔊</button><button onclick="deleteWord(' + w.id + ')">🗑️</button></div></div>').join('');
}

function openWordModal() { document.getElementById('word-modal').classList.add('active'); }
function closeWordModal() { document.getElementById('word-modal').classList.remove('active'); }

function addWord() {
    const en = document.getElementById('nw-en').value.trim();
    const ko = document.getElementById('nw-kr').value.trim();
    if (!en || !ko) { showToast('영어와 한국어 입력', 'warning'); return; }
    Storage.addWord({ english: en, korean: ko, partOfSpeech: document.getElementById('nw-pos').value, example: document.getElementById('nw-ex').value });
    closeWordModal();
    ['nw-en', 'nw-kr', 'nw-pos', 'nw-ex'].forEach(id => document.getElementById(id).value = '');
    renderVocab('today');
    Storage.updateDailyProgress({ vocab: true });
    if (typeof Achievements !== 'undefined') Achievements.check('vocabulary').forEach(a => showBadgeUnlock(a));
    showToast('단어 추가됨');
}

function toggleStar(id) { const w = Storage.getVocabulary().find(x => x.id === id); if (w) { Storage.updateWord(id, { starred: !w.starred }); renderVocab(document.querySelector('.tab-btn.active')?.dataset.tab || 'today'); } }
function deleteWord(id) { if (confirm('삭제?')) { Storage.deleteWord(id); renderVocab(document.querySelector('.tab-btn.active')?.dataset.tab || 'today'); showToast('삭제됨'); } }

// ========== 게임 ==========
function startGame(type) {
    if (typeof Games === 'undefined') { showToast('게임 모듈 로딩 실패', 'error'); return; }
    document.querySelector('.games-grid').style.display = 'none';
    document.getElementById('game-play-area').style.display = 'block';
    let ok = false;
    if (type === 'quiz') ok = Games.quiz.start(10, 'mixed', 'all');
    else if (type === 'typing') ok = Games.typing.start();
    else if (type === 'matching') ok = Games.matching.start(8);
    else if (type === 'speed') ok = Games.speed.start();
    if (ok) { Games.current = type; renderGameUI(type); } else closeGame();
}

function closeGame() {
    document.querySelector('.games-grid').style.display = 'grid';
    document.getElementById('game-play-area').style.display = 'none';
}

function updateGachaTickets() {
    const t = Storage.getGachaTickets();
    const el = document.getElementById('gacha-tickets');
    if (el) el.textContent = t;
    const m = document.getElementById('gacha-tickets-modal'); if (m) m.textContent = t;
}

function openGacha() { document.getElementById('gacha-modal').classList.add('active'); document.getElementById('gacha-tickets-modal').textContent = Storage.getGachaTickets(); document.getElementById('gacha-result').style.display = 'none'; document.getElementById('gacha-ball').textContent = '?'; }
function closeGacha() { document.getElementById('gacha-modal').classList.remove('active'); }

function pullGacha() {
    if (Storage.getGachaTickets() <= 0) { showToast('티켓 부족', 'error'); return; }
    if (typeof Gacha === 'undefined') { showToast('가챠 모듈 로딩 실패', 'error'); return; }
    const m = document.getElementById('gacha-machine'); m.classList.add('spinning');
    setTimeout(() => {
        m.classList.remove('spinning');
        const r = Gacha.pull();
        if (r) {
            document.getElementById('gacha-ball').textContent = r.item || '🎁';
            document.getElementById('gacha-result').style.display = 'block';
            document.getElementById('gacha-reward').textContent = r.item || '🎁';
            document.getElementById('gacha-reward').style.color = Gacha.getRarityColor(r.rarity);
            document.getElementById('gacha-reward-name').textContent = Gacha.getRarityName(r.rarity) + ' - ' + r.name;
        }
        updateGachaTickets();
    }, 500);
}

// ========== 아카이브 ==========
function renderArchive() {
    const filter = document.getElementById('archive-filter')?.value || 'all';
    let list = Storage.getArchive();
    if (filter !== 'all') list = list.filter(a => a.type === filter);
    const el = document.getElementById('archive-list');
    if (!el) return;
    if (!list.length) { el.innerHTML = '<div class="empty-state"><p>아카이브 없음</p></div>'; return; }
    
    el.innerHTML = list.map(a => {
        const scoreClass = (a.averageScore || 0) >= 80 ? 'score-high' : (a.averageScore || 0) >= 60 ? 'score-mid' : 'score-low';
        const progressPct = a.totalPhrases ? Math.round((a.completedPhrases / a.totalPhrases) * 100) : 0;
        
        return `<div class="archive-card" onclick="openArchive(${a.id})">
            <div class="archive-header">
                <span class="archive-type">${a.type === 'translation' ? '✍️ 번역' : '🎙️ 통역'}</span>
                <span class="archive-date">${new Date(a.date).toLocaleDateString('ko-KR')}</span>
                <span class="archive-score ${scoreClass}">${a.averageScore || 0}점</span>
            </div>
            <h4 class="archive-title">${a.articleTitle || '제목 없음'}</h4>
            <div class="archive-progress">
                <div class="archive-progress-bar">
                    <div class="archive-progress-fill" style="width:${progressPct}%"></div>
                </div>
                <span>${a.completedPhrases || 0}/${a.totalPhrases || 0} 문장 (${progressPct}%)</span>
            </div>
        </div>`;
    }).join('');
}

function openArchive(id) {
    const a = Storage.getArchive().find(x => x.id === id); 
    if (!a) return;
    App.currentArchiveId = id;
    
    const scoreClass = (a.averageScore || 0) >= 80 ? 'score-high' : (a.averageScore || 0) >= 60 ? 'score-mid' : 'score-low';
    
    document.getElementById('am-title').textContent = (a.type === 'translation' ? '✍️ 번역' : '🎙️ 통역') + ' - ' + a.articleTitle;
    
    let body = `
        <div class="archive-summary">
            <div class="summary-item">
                <span class="summary-label">완료</span>
                <span class="summary-value">${a.completedPhrases || 0}/${a.totalPhrases || 0} 문장</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">평균 점수</span>
                <span class="summary-value ${scoreClass}">${a.averageScore || 0}점</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">방향</span>
                <span class="summary-value">${a.direction === 'ko-en' ? '🇰🇷→🇺🇸' : '🇺🇸→🇰🇷'}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">날짜</span>
                <span class="summary-value">${new Date(a.date).toLocaleString('ko-KR')}</span>
            </div>
        </div>
    `;
    
    // 번역 피드백
    if (a.phraseFeedbacks?.length) {
        body += '<h4 class="section-title">📝 문장별 첨삭 기록</h4>';
        body += '<div class="feedback-list">';
        body += a.phraseFeedbacks.map((f, i) => {
            const fScoreClass = (f.score || 0) >= 80 ? 'score-high' : (f.score || 0) >= 60 ? 'score-mid' : 'score-low';
            const feedbackDetail = f.feedback || {};
            
            return `<div class="feedback-item">
                <div class="feedback-header">
                    <span class="feedback-num">${i + 1}</span>
                    <span class="feedback-score ${fScoreClass}">${f.score || 0}점</span>
                    ${f.model ? `<span class="feedback-model">${f.model}</span>` : ''}
                </div>
                <div class="feedback-original">
                    <strong>원문:</strong> "${f.original}"
                </div>
                <div class="feedback-user">
                    <strong>내 번역:</strong> "${f.userTranslation || '(건너뜀)'}"
                </div>
                ${feedbackDetail.feedback ? `<div class="feedback-ai"><strong>AI 평가:</strong> ${feedbackDetail.feedback}</div>` : ''}
                ${feedbackDetail.modelAnswer ? `<div class="feedback-model-answer"><strong>모범 번역:</strong> ${feedbackDetail.modelAnswer}</div>` : ''}
                ${feedbackDetail.improvements?.length ? `<div class="feedback-improvements"><strong>개선점:</strong><ul>${feedbackDetail.improvements.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}
            </div>`;
        }).join('');
        body += '</div>';
    }
    
    // 통역 결과
    if (a.results?.length) {
        body += '<h4 class="section-title">🎙️ 통역 기록</h4>';
        body += '<div class="feedback-list">';
        body += a.results.map((r, i) => {
            const rScoreClass = (r.score || 0) >= 80 ? 'score-high' : (r.score || 0) >= 60 ? 'score-mid' : 'score-low';
            const feedbackDetail = r.feedback || {};
            
            return `<div class="feedback-item">
                <div class="feedback-header">
                    <span class="feedback-num">${i + 1}</span>
                    <span class="feedback-score ${rScoreClass}">${r.score || 0}점</span>
                </div>
                <div class="feedback-original">
                    <strong>원문:</strong> "${r.original}"
                </div>
                <div class="feedback-user">
                    <strong>내 통역:</strong> "${r.interpretation || '(건너뜀)'}"
                </div>
                ${feedbackDetail.feedback ? `<div class="feedback-ai"><strong>AI 평가:</strong> ${feedbackDetail.feedback}</div>` : ''}
                ${feedbackDetail.modelInterpretation ? `<div class="feedback-model-answer"><strong>모범 통역:</strong> ${feedbackDetail.modelInterpretation}</div>` : ''}
                ${feedbackDetail.missedPoints?.length ? `<div class="feedback-missed"><strong>누락된 내용:</strong><ul>${feedbackDetail.missedPoints.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}
                ${feedbackDetail.goodPoints?.length ? `<div class="feedback-good"><strong>잘한 점:</strong><ul>${feedbackDetail.goodPoints.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}
            </div>`;
        }).join('');
        body += '</div>';
    }
    
    document.getElementById('am-body').innerHTML = body;
    document.getElementById('am-memo').value = a.memo || '';
    document.getElementById('archive-modal').classList.add('active');
}

function closeArchiveModal() { document.getElementById('archive-modal').classList.remove('active'); }
function saveArchiveMemo() { if (App.currentArchiveId) { Storage.updateArchiveItem(App.currentArchiveId, { memo: document.getElementById('am-memo').value }); showToast('메모 저장됨'); } }

// ========== 업적 ==========
function renderAchievements(cat) {
    if (typeof Achievements === 'undefined') return;
    const all = Achievements.getByCategory(cat);
    const unlocked = Storage.getAchievements();
    const total = Achievements.list.length; const count = unlocked.length;
    document.getElementById('ach-unlocked').textContent = count;
    document.getElementById('ach-total').textContent = total;
    document.getElementById('ach-percent').textContent = Math.round(count / total * 100) + '%';
    document.getElementById('achievements-grid').innerHTML = all.map(a => '<div class="achievement-card ' + (unlocked.includes(a.id) ? 'unlocked' : 'locked') + '"><div class="achievement-icon">' + a.icon + '</div><h4>' + a.name + '</h4><p>' + a.desc + '</p></div>').join('');
}

// ========== 꾸미기 ==========
function loadCustomizeSettings() {
    const p = Storage.getProfile();
    document.getElementById('custom-nickname').value = p.nickname || 'DAYOUNG';
    document.getElementById('custom-studio').value = p.studioName || "'s Studio";
    document.getElementById('mascot-preview').textContent = p.mascot || '🦜';
    document.getElementById('mascot-name-input').value = p.mascotName || '파랑이';
    document.querySelectorAll('.mascot-opt').forEach(b => b.classList.toggle('active', b.dataset.mascot === p.mascot));
    document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === p.theme));
    const e = p.effects || {};
    document.getElementById('effect-particles').checked = e.particles || false;
    document.getElementById('effect-gradient').checked = e.gradient !== false;
    document.getElementById('effect-pattern').checked = e.pattern || false;
    renderStickerCollection();
}

function selectMascot(m) { document.getElementById('mascot-preview').textContent = m; document.querySelectorAll('.mascot-opt').forEach(b => b.classList.toggle('active', b.dataset.mascot === m)); }
function setTheme(t) { document.documentElement.setAttribute('data-theme', t); document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === t)); if (typeof Achievements !== 'undefined') Achievements.check('special', { achievementId: 'customizer' }); }
function toggleEffect(e) { const el = document.querySelector('.bg-' + (e === 'particles' ? 'particles' : e)); if (el) el.classList.toggle('hidden'); }

function renderStickerCollection() {
    const owned = Storage.getStickers();
    const all = ['⭐', '❤️', '🔥', '🌸', '🎈', '🍀', '🌙', '🦋', '🌈', '🎭', '🎪', '🐉', '🦄', '🔮', '👑', '💎'];
    const el = document.getElementById('sticker-collection');
    if (el) el.innerHTML = all.map(s => '<div class="sticker-item ' + (owned.includes(s) ? '' : 'locked') + '">' + s + '</div>').join('');
}

function saveCustomization() {
    const p = { nickname: document.getElementById('custom-nickname').value || 'DAYOUNG', studioName: document.getElementById('custom-studio').value || "'s Studio", mascot: document.getElementById('mascot-preview').textContent || '🦜', mascotName: document.getElementById('mascot-name-input').value || '파랑이', theme: document.querySelector('.theme-opt.active')?.dataset.theme || 'light', effects: { particles: document.getElementById('effect-particles').checked, gradient: document.getElementById('effect-gradient').checked, pattern: document.getElementById('effect-pattern').checked } };
    Storage.saveProfile(p); initProfile(); initTheme(); showToast('저장됨');
}

// ========== 설정 ==========
function loadSettings() {
    const s = Storage.getSettings();
    document.getElementById('set-goal').value = s.dailyGoal || 60;
    document.getElementById('set-tts-speed').value = s.ttsSpeed || 0.9;
    document.getElementById('tts-speed-val').textContent = (s.ttsSpeed || 0.9) + 'x';
}

// ★ 설정 저장 함수 (이 함수가 없었음!)
function saveSettings() {
    const settings = {
        dailyGoal: parseInt(document.getElementById('set-goal').value) || 60,
        ttsSpeed: parseFloat(document.getElementById('set-tts-speed').value) || 0.9
    };
    Storage.saveSettings(settings);
    showToast('✅ 설정이 저장되었습니다!', 'success');
}

// (GitHub 토큰 불필요 - Firebase Functions 사용)

function saveDday() { const n = document.getElementById('set-dday-name').value; const d = document.getElementById('set-dday-date').value; if (n && d) { Storage.saveDday(n, d); updateDdayDisplay(); showToast('D-Day 설정됨'); } }
function saveDiary() { Storage.saveDiary(document.getElementById('diary-text').value); showToast('일기 저장됨'); }
// ========== 캐시 초기화 ==========
async function clearAllCache() {
    if (!confirm('캐시를 초기화하면 최신 버전으로 새로고침됩니다.\n학습 데이터는 유지됩니다.\n\n계속하시겠습니까?')) return;
    
    try {
        // 1) Service Worker 캐시 전부 삭제
        if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
            console.log('✅ 캐시 삭제:', names);
        }
        
        // 2) Service Worker 등록 해제 후 재등록
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
            console.log('✅ SW 해제 완료');
        }
        
        showToast('✅ 캐시 초기화 완료! 새로고침합니다', 'success');
        setTimeout(() => location.reload(true), 1000);
    } catch (e) {
        console.error('캐시 초기화 오류:', e);
        showToast('캐시 초기화 실패: ' + e.message, 'error');
    }
}

// ========== 업데이트 알림 시스템 ==========
const APP_VERSION = 'v4.3.0';
const UPDATE_LOG = [
    {
        version: 'v4.3.0',
        date: '2025-02-06',
        items: [
            { icon: '🎤', title: 'Whisper 음성인식 도입', desc: 'OpenAI Whisper로 통역 녹음 정확도가 크게 향상되었습니다. 한국어·영어 모두 지원됩니다.' },
            { icon: '📲', title: '기기 간 동기화', desc: 'PIN 코드로 앱/패드 간 학습 데이터를 동기화할 수 있습니다. 설정 → 기기 간 동기화에서 설정하세요.' },
            { icon: '💾', title: '문장별 첨삭 기록 저장', desc: '번역·통역 시 문장별 AI 첨삭 결과가 자동으로 저장됩니다.' },
            { icon: '📰', title: '기사 자동 로드 개선', desc: 'Firebase Storage에서 최신 기사를 바로 불러옵니다.' },
            { icon: '⏰', title: '기사 3일 만료 시스템', desc: '기사에 남은 시간이 표시되며, 3일 후 자동 삭제됩니다.' },
            { icon: '🔄', title: '캐시 초기화 버튼', desc: '설정 → 데이터 관리에서 캐시를 수동으로 초기화할 수 있습니다.' }
        ]
    }
];

function checkUpdateNotice() {
    const lastSeen = localStorage.getItem('dyts_last_update_seen');
    if (lastSeen === APP_VERSION) return; // 이미 본 버전
    
    const body = document.getElementById('update-notice-body');
    if (!body) return;
    
    // 최신 업데이트만 표시 (이전에 못 본 것들도)
    const updates = lastSeen 
        ? UPDATE_LOG.filter(u => u.version > lastSeen) 
        : [UPDATE_LOG[0]];
    
    if (updates.length === 0) return;
    
    let html = `<div class="update-version">📦 ${APP_VERSION} · ${updates[0].date}</div>`;
    
    updates.forEach(u => {
        u.items.forEach(item => {
            html += `<div class="update-item">
                <h4>${item.icon} ${item.title}</h4>
                <p>${item.desc}</p>
            </div>`;
        });
    });
    
    body.innerHTML = html;
    document.getElementById('update-notice-modal').classList.add('active');
}

function closeUpdateNotice() {
    document.getElementById('update-notice-modal').classList.remove('active');
    localStorage.setItem('dyts_last_update_seen', APP_VERSION);
}

function exportData() { const d = Storage.exportData(); const b = new Blob([d], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'dayoung_backup.json'; a.click(); showToast('내보내기됨'); }
function importData() { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = async (e) => { const f = e.target.files[0]; if (f) { const t = await f.text(); if (Storage.importData(t)) { showToast('가져오기됨'); location.reload(); } else showToast('실패', 'error'); } }; i.click(); }
function resetData() { if (confirm('모든 데이터 삭제?')) { Storage.resetAll(); location.reload(); } }

// ========== 운세 ==========
function checkDailyFortune() { const l = Storage.getLastFortune(); if (l.date !== new Date().toDateString()) setTimeout(() => showFortune(), 2000); }
function showFortune() { if (typeof Fortune === 'undefined') return; const f = Fortune.get(); document.getElementById('fortune-result').textContent = f.text; document.getElementById('fortune-word').textContent = f.word; document.getElementById('fortune-modal').classList.add('active'); }
function closeFortuneModal() { document.getElementById('fortune-modal').classList.remove('active'); if (typeof Fortune !== 'undefined') { const f = Fortune.get(); document.getElementById('fortune-text').textContent = f.text; } document.getElementById('fortune-banner').style.display = 'flex'; }
function closeFortune() { document.getElementById('fortune-banner').style.display = 'none'; }

// ========== 모달 ==========
function showBadgeUnlock(a) { document.getElementById('badge-unlock-icon').textContent = a.icon; document.getElementById('badge-unlock-name').textContent = a.name; document.getElementById('badge-unlock-desc').textContent = a.desc; document.getElementById('badge-modal').classList.add('active'); }
function closeBadgeModal() { document.getElementById('badge-modal').classList.remove('active'); }
function showLevelUp(n) { document.getElementById('levelup-num').textContent = n; document.getElementById('levelup-title').textContent = Storage.getTitleForLevel(n); document.getElementById('levelup-modal').classList.add('active'); if (typeof Achievements !== 'undefined') { if (n >= 5) Achievements.check('special', { achievementId: 'level_5' }); if (n >= 10) Achievements.check('special', { achievementId: 'level_10' }); } }
function closeLevelupModal() { document.getElementById('levelup-modal').classList.remove('active'); }

// ========== BGM ==========
function toggleBGM() { document.getElementById('bgm-controls').classList.toggle('active'); }
function changeBGM() { const t = document.getElementById('bgm-select').value; if (t) { BGM.play(t); document.getElementById('bgm-icon').textContent = '🔊'; } else { BGM.stop(); document.getElementById('bgm-icon').textContent = '🔇'; } }
function setBGMVolume() { BGM.setVolume(document.getElementById('bgm-volume').value); }

// ========== 파티클 ==========
function createParticles() { const c = document.getElementById('particles'); if (!c) return; for (let i = 0; i < 20; i++) { const p = document.createElement('div'); p.className = 'particle'; p.style.left = Math.random() * 100 + '%'; p.style.top = Math.random() * 100 + '%'; p.style.animationDelay = Math.random() * 15 + 's'; p.style.animationDuration = (10 + Math.random() * 10) + 's'; c.appendChild(p); } }

// ========== 유틸 ==========
function showLoading(s, msg) { 
    const el = document.getElementById('loading');
    el.style.display = s ? 'flex' : 'none'; 
    let textEl = el.querySelector('.loading-text');
    if (msg && s) {
        if (!textEl) {
            textEl = document.createElement('p');
            textEl.className = 'loading-text';
            textEl.style.color = 'white';
            textEl.style.marginTop = '16px';
            el.querySelector('.loading-spinner').appendChild(textEl);
        }
        textEl.textContent = msg;
    } else if (textEl) {
        textEl.textContent = '로딩중...';
    }
}
function showToast(m, t) { const to = document.createElement('div'); to.className = 'toast ' + (t || 'success'); to.textContent = m; document.getElementById('toasts').appendChild(to); setTimeout(() => to.remove(), 3000); }
function refreshArticles() { showToast('새로고침...'); loadArticles(); }

// ========== 문장별 대조 보기 (인라인 번역) ==========
function setArticleViewMode(mode) {
    const separate = document.getElementById('article-view-separate');
    const inline = document.getElementById('article-view-inline');
    const btnSep = document.getElementById('btn-view-separate');
    const btnInl = document.getElementById('btn-view-inline');
    
    if (mode === 'inline') {
        separate.style.display = 'none';
        inline.style.display = 'block';
        btnSep.style.background = ''; btnSep.style.color = ''; btnSep.className = 'btn btn-sm btn-secondary';
        btnInl.style.background = 'var(--accent-primary)'; btnInl.style.color = 'white'; btnInl.className = 'btn btn-sm';
    } else {
        separate.style.display = 'block';
        inline.style.display = 'none';
        btnSep.style.background = 'var(--accent-primary)'; btnSep.style.color = 'white'; btnSep.className = 'btn btn-sm';
        btnInl.style.background = ''; btnInl.style.color = ''; btnInl.className = 'btn btn-sm btn-secondary';
    }
}

function toggleSentenceKo(el) {
    const ko = el.querySelector('.ko-text');
    if (ko) ko.classList.toggle('visible');
}

function toggleInlineKorean() {
    const checked = document.getElementById('toggle-ko-inline').checked;
    document.querySelectorAll('#article-detail-inline .ko-text').forEach(el => {
        if (checked) el.classList.add('visible');
        else el.classList.remove('visible');
    });
}

// ========== 캡쳐 번역 (OCR) ==========
let ocrImageData = null;
let ocrResult = null;

// 드래그 앤 드롭
document.addEventListener('DOMContentLoaded', () => {
    const area = document.getElementById('ocr-upload-area');
    if (!area) return;
    area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
    area.addEventListener('dragleave', () => { area.classList.remove('dragover'); });
    area.addEventListener('drop', (e) => {
        e.preventDefault(); area.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            processOCRFile(file);
        } else {
            showToast('이미지 파일만 업로드 가능합니다', 'warning');
        }
    });
});

function handleOCRUpload(event) {
    const file = event.target.files[0];
    if (file) processOCRFile(file);
}

function processOCRFile(file) {
    if (file.size > 10 * 1024 * 1024) {
        showToast('10MB 이하 파일만 가능합니다', 'warning');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('ocr-preview-img');
        img.src = e.target.result;
        document.getElementById('ocr-preview').style.display = 'block';
        document.getElementById('ocr-upload-area').style.display = 'none';
        
        // base64 데이터 저장 (data:image/png;base64, 부분 제거)
        ocrImageData = {
            base64: e.target.result.split(',')[1],
            mimeType: file.type
        };
    };
    reader.readAsDataURL(file);
}

async function processOCR() {
    if (!ocrImageData) { showToast('이미지를 먼저 업로드하세요', 'warning'); return; }
    
    const btn = document.getElementById('ocr-process-btn');
    btn.disabled = true;
    btn.textContent = '🔄 AI 분석 중...';
    showLoading(true, 'Claude Vision으로 텍스트 추출 중...');
    
    try {
        ocrResult = await API.analyzeImageForTranslation(ocrImageData.base64, ocrImageData.mimeType);
        
        // 원문 표시
        document.getElementById('ocr-original-text').textContent = ocrResult.originalText || '추출 실패';
        
        const langNames = { en: '🇺🇸 영어', ko: '🇰🇷 한국어', ja: '🇯🇵 일본어', zh: '🇨🇳 중국어' };
        document.getElementById('ocr-language').textContent = langNames[ocrResult.language] || ocrResult.language;
        
        const diffNames = { beginner: '🟢 초급', intermediate: '🟡 중급', advanced: '🔴 고급' };
        document.getElementById('ocr-difficulty').textContent = diffNames[ocrResult.difficulty] || ocrResult.difficulty;
        
        // 문장별 번역
        const sentencesEl = document.getElementById('ocr-sentences');
        sentencesEl.innerHTML = (ocrResult.sentences || []).map((s, i) => `
            <div class="ocr-sentence-card">
                <div class="original"><span class="sentence-num">${i+1}</span> ${s.original}</div>
                <div class="translated">→ ${s.translated}</div>
                ${s.keyTerms?.length ? `<div class="terms">${s.keyTerms.map(t => `<span>${t}</span>`).join('')}</div>` : ''}
            </div>
        `).join('');
        
        // 요약
        document.getElementById('ocr-summary').textContent = ocrResult.summary || '';
        
        document.getElementById('ocr-result').style.display = 'block';
        showToast('✅ 텍스트 추출 및 번역 완료!', 'success');
    } catch (error) {
        showToast('❌ OCR 실패: ' + error.message, 'error');
    } finally {
        showLoading(false);
        btn.disabled = false;
        btn.textContent = '🔍 AI 텍스트 추출 & 번역';
    }
}

function clearOCR() {
    ocrImageData = null;
    ocrResult = null;
    document.getElementById('ocr-preview').style.display = 'none';
    document.getElementById('ocr-result').style.display = 'none';
    document.getElementById('ocr-upload-area').style.display = '';
    document.getElementById('ocr-file-input').value = '';
}

function addOCRToArticles() {
    if (!ocrResult) { showToast('먼저 이미지를 분석하세요', 'warning'); return; }
    
    const isKorean = ocrResult.language === 'ko';
    const originalText = ocrResult.originalText || '';
    const translatedText = (ocrResult.sentences || []).map(s => s.translated).join(' ');
    
    const newId = Math.max(0, ...App.articles.map(a => a.id || 0)) + 1;
    const newArticle = {
        id: newId,
        title: isKorean ? (ocrResult.summary || '캡쳐 문서').substring(0, 60) : originalText.substring(0, 60) + '...',
        content: isKorean ? translatedText : originalText,
        koreanContent: isKorean ? originalText : translatedText,
        summary: ocrResult.summary || '',
        category: ocrResult.topic || 'society',
        level: ocrResult.difficulty || 'intermediate',
        source: '📸 캡쳐 번역',
        keyTerms: (ocrResult.sentences || []).flatMap(s => (s.keyTerms || []).map(t => ({ en: t, ko: t }))).slice(0, 5),
        wordCount: originalText.split(/\s+/).length,
        generatedAt: new Date().toISOString(),
        isRealArticle: true
    };
    
    App.articles.unshift(newArticle);
    showToast('✅ 기사로 추가되었습니다!', 'success');
}

function copyOCRText() {
    if (!ocrResult) return;
    const text = ocrResult.originalText + '\n\n---번역---\n\n' + (ocrResult.sentences || []).map(s => s.original + '\n→ ' + s.translated).join('\n\n');
    navigator.clipboard.writeText(text).then(() => showToast('📋 클립보드에 복사됨'));
}

// ========== 심리/진로 상담 ==========
const CounselingApp = {
    messages: [],
    type: 'general',
    isProcessing: false
};

function setCounselingType(type) {
    CounselingApp.type = type;
    document.querySelectorAll('.counseling-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
        if (btn.dataset.type === type) {
            btn.className = 'btn btn-sm counseling-type-btn active';
        } else {
            btn.className = 'btn btn-sm btn-secondary counseling-type-btn';
        }
    });
    
    const typeNames = { general: '통번역 멘토링', career: '이론/공부 도움', stress: '멘탈 관리', relationship: '진로 상담' };
    const typeEmojis = { general: '🌱', career: '📖', stress: '💪', relationship: '🗺️' };
    
    if (CounselingApp.messages.length === 0) {
        const msgEl = document.getElementById('counseling-messages');
        const msgs = {
            general: `안녕! 나는 대영이의 <strong>AI 멘토</strong>야 😊<br>통번역 공부하면서 어려운 거, 막히는 거, 불안한 거... 뭐든 편하게 물어봐!<br><small style="color:var(--text-secondary)">💡 바보 같은 질문 같은 건 없어. 진짜로!</small>`,
            career: `<strong>공부 도우미 모드</strong>로 왔어! 📖<br>번역 이론이 어렵다고? 괜찮아, 내가 쉽게 풀어줄게.<br><small style="color:var(--text-secondary)">예: "Nida의 동적 등가가 뭐야?", "통역 노트테이킹 어떻게 해?"</small>`,
            stress: `대영아, 힘든 거 있어? 💪<br>공부 스트레스, 번아웃, 불안감... 다 괜찮아. 쉬는 것도 공부야!<br><small style="color:var(--text-secondary)">뭐가 힘든지 편하게 얘기해줘. 같이 방법 찾아보자.</small>`,
            relationship: `<strong>진로 상담 모드</strong>야! 🗺️<br>통번역사 진로, 취업, 포트폴리오... 같이 고민해보자.<br><small style="color:var(--text-secondary)">예: "프리랜서 vs 에이전시?", "AI 시대에 통번역사 전망은?"</small>`
        };
        msgEl.innerHTML = `<div class="counsel-msg counsel-ai">
            <div class="counsel-avatar">${typeEmojis[type]}</div>
            <div class="counsel-bubble"><p>${msgs[type]}</p></div>
        </div>`;
    }
}

// 빠른 질문 바로 실행
function quickResearch(question) {
    const input = document.getElementById('counseling-input');
    input.value = question;
    sendCounselingMessage();
}

async function sendCounselingMessage() {
    if (CounselingApp.isProcessing) return;
    
    const input = document.getElementById('counseling-input');
    const text = input.value.trim();
    if (!text) return;
    
    CounselingApp.isProcessing = true;
    input.value = '';
    
    CounselingApp.messages.push({ role: 'user', content: text });
    
    const msgEl = document.getElementById('counseling-messages');
    msgEl.innerHTML += `<div class="counsel-msg counsel-user">
        <div class="counsel-avatar">👤</div>
        <div class="counsel-bubble"><p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p></div>
    </div>`;
    
    const typeEmojis = { general: '🌱', career: '📖', stress: '💪', relationship: '🗺️' };
    const emoji = typeEmojis[CounselingApp.type] || '🌱';
    
    msgEl.innerHTML += `<div class="counsel-msg counsel-ai" id="counsel-typing">
        <div class="counsel-avatar">${emoji}</div>
        <div class="counsel-bubble">
            <div class="counsel-typing"><span></span><span></span><span></span></div>
            <small style="color:var(--text-tertiary);margin-top:4px;display:block;">분석 중...</small>
        </div>
    </div>`;
    msgEl.scrollTop = msgEl.scrollHeight;
    
    try {
        const response = await API.getCounselingResponse(CounselingApp.messages, CounselingApp.type);
        CounselingApp.messages.push({ role: 'assistant', content: response });
        
        document.getElementById('counsel-typing')?.remove();
        
        // 마크다운 기본 변환 (###, **, -, 코드 등)
        let formatted = response
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/### (.+)/g, '<h4 style="margin:12px 0 6px;color:var(--accent-primary);">$1</h4>')
            .replace(/## (.+)/g, '<h3 style="margin:14px 0 8px;color:var(--accent-primary);">$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.+?)`/g, '<code style="background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;font-size:13px;">$1</code>')
            .replace(/^- (.+)/gm, '<li style="margin-left:16px;margin-bottom:2px;">$1</li>')
            .replace(/^\d+\. (.+)/gm, '<li style="margin-left:16px;margin-bottom:2px;">$1</li>')
            .replace(/\n\n/g, '</p><p style="margin-top:10px;">')
            .replace(/\n/g, '<br>');
        
        msgEl.innerHTML += `<div class="counsel-msg counsel-ai">
            <div class="counsel-avatar">${emoji}</div>
            <div class="counsel-bubble"><p>${formatted}</p></div>
        </div>`;
    } catch (error) {
        document.getElementById('counsel-typing')?.remove();
        msgEl.innerHTML += `<div class="counsel-msg counsel-ai">
            <div class="counsel-avatar">⚠️</div>
            <div class="counsel-bubble"><p style="color:#dc3545;">리서치 오류: ${error.message}</p></div>
        </div>`;
    }
    
    CounselingApp.isProcessing = false;
    msgEl.scrollTop = msgEl.scrollHeight;
}

function clearCounseling() {
    if (CounselingApp.messages.length > 0 && !confirm('대화 내용이 사라져. 괜찮아?')) return;
    CounselingApp.messages = [];
    setCounselingType(CounselingApp.type);
    showToast('새 대화 시작! 🌱');
}

function saveCounselingLog() {
    if (CounselingApp.messages.length === 0) { showToast('저장할 대화가 없어!', 'warning'); return; }
    
    const logs = JSON.parse(localStorage.getItem('counselingLogs') || '[]');
    logs.unshift({
        id: Date.now(),
        type: CounselingApp.type,
        messages: CounselingApp.messages,
        date: new Date().toISOString()
    });
    localStorage.setItem('counselingLogs', JSON.stringify(logs.slice(0, 50)));
    showToast('💾 대화 저장 완료!');
}