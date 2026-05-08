const tooltipPanel = document.getElementById('tooltipPanel');
const tooltipText = document.getElementById('tooltipText');
const globalNoticeOverlay = document.getElementById('globalNoticeOverlay');
const globalNoticeBar = document.getElementById('globalNoticeBar');
const globalNoticeText = document.getElementById('globalNoticeText');
const globalNoticeDismiss = document.getElementById('globalNoticeDismiss');
let tooltipTimer = null;
let panelTimer = null;
const GLOBAL_NOTICE_ENDPOINT = window.GLOBAL_NOTICE_API_URL || '/api/global-notice';
const SITE_STATS_ENDPOINT = window.SITE_STATS_API_URL || (() => {
    if (GLOBAL_NOTICE_ENDPOINT.includes('/api/global-notice')) {
        return GLOBAL_NOTICE_ENDPOINT.replace('/api/global-notice', '/api/site-stats');
    }
    return '/api/site-stats';
})();
const SITE_POLL_ENDPOINT = window.SITE_POLL_API_URL || (() => {
    if (GLOBAL_NOTICE_ENDPOINT.includes('/api/global-notice')) {
        return GLOBAL_NOTICE_ENDPOINT.replace('/api/global-notice', '/api/site-poll');
    }
    return '/api/site-poll';
})();
const SITE_POPULAR_APPS_ENDPOINT = window.SITE_POPULAR_APPS_API_URL || (() => {
    if (GLOBAL_NOTICE_ENDPOINT.includes('/api/global-notice')) {
        return GLOBAL_NOTICE_ENDPOINT.replace('/api/global-notice', '/api/popular-apps');
    }
    return '/api/popular-apps';
})();
const SITE_MAINTENANCE_ENDPOINT = GLOBAL_NOTICE_ENDPOINT.includes('/api/global-notice')
    ? GLOBAL_NOTICE_ENDPOINT.replace('/api/global-notice', '/api/maintenance')
    : '/api/maintenance';
const SITE_TICKER_ENDPOINT = GLOBAL_NOTICE_ENDPOINT.includes('/api/global-notice')
    ? GLOBAL_NOTICE_ENDPOINT.replace('/api/global-notice', '/api/ticker')
    : '/api/ticker';
const SITE_FEATURED_GAME_ENDPOINT = GLOBAL_NOTICE_ENDPOINT.includes('/api/global-notice')
    ? GLOBAL_NOTICE_ENDPOINT.replace('/api/global-notice', '/api/featured-game')
    : '/api/featured-game';
const SITE_VISITOR_STORAGE_KEY = 'site-visitor-id-v1';
const GLOBAL_NOTICE_POLL_MS = 30000;
const LAST_NOTICE_CACHE_KEY = 'last-global-notice-payload';
const NOTICE_DISMISS_DELAY_MS = 3000;
let dismissedNoticeSignature = null;
let currentNoticeSignature = null;
let dismissedNoticeMessage = '';
let shownNoticeSignature = null;
let noticeDismissUnlockAt = 0;
let currentFeaturedGame = '';
let noticeDismissInterval = null;

function resetNoticeDismissButton() {
    if (!globalNoticeDismiss) {
        return;
    }

    globalNoticeDismiss.disabled = false;
    globalNoticeDismiss.textContent = 'Close';
}

function stopNoticeDismissTimer() {
    if (noticeDismissInterval) {
        window.clearInterval(noticeDismissInterval);
        noticeDismissInterval = null;
    }
    noticeDismissUnlockAt = 0;
    resetNoticeDismissButton();
}

function startNoticeDismissTimer() {
    if (!globalNoticeDismiss) {
        return;
    }

    if (noticeDismissInterval) {
        window.clearInterval(noticeDismissInterval);
    }

    noticeDismissUnlockAt = Date.now() + NOTICE_DISMISS_DELAY_MS;
    globalNoticeDismiss.disabled = true;

    const tick = () => {
        const remainingMs = Math.max(0, noticeDismissUnlockAt - Date.now());
        if (remainingMs === 0) {
            stopNoticeDismissTimer();
            return;
        }

        const remainingSeconds = Math.ceil(remainingMs / 1000);
        globalNoticeDismiss.textContent = `Close (${remainingSeconds}s)`;
    };

    tick();
    noticeDismissInterval = window.setInterval(tick, 120);
}

function canDismissNoticeNow() {
    return Date.now() >= noticeDismissUnlockAt;
}

function readCachedNotice() {
    try {
        const raw = localStorage.getItem(LAST_NOTICE_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeCachedNotice(payload) {
    try {
        localStorage.setItem(LAST_NOTICE_CACHE_KEY, JSON.stringify(payload));
    } catch {
        // Ignore storage failures.
    }
}

function clearCachedNotice() {
    try {
        localStorage.removeItem(LAST_NOTICE_CACHE_KEY);
    } catch {
        // Ignore storage failures.
    }
}

function updateTooltipPosition(event) {
    const x = event.pageX + 14;
    const y = event.pageY - 20;
    tooltipPanel.style.left = `${x}px`;
    tooltipPanel.style.top = `${y}px`;
}

function typeDescription(text) {
    tooltipText.textContent = '';
    let index = 0;

    function typeNext() {
        if (index < text.length) {
            tooltipText.textContent += text[index++];
            tooltipTimer = window.setTimeout(typeNext, 32);
        }
    }

    typeNext();
}

function showTooltip(event, description) {
    if (!description) {
        return;
    }

    window.clearTimeout(tooltipTimer);
    tooltipText.textContent = '';
    updateTooltipPosition(event);
    tooltipPanel.classList.add('visible');
    typeDescription(description);
}

function hideTooltip() {
    window.clearTimeout(tooltipTimer);
    tooltipPanel.classList.remove('visible');
    tooltipText.textContent = '';
}

document.querySelectorAll('.outline-button, .settings-action-button, .theme-swatch, .dock-item').forEach(button => {
    button.addEventListener('mouseenter', event => showTooltip(event, button.dataset.description));
    button.addEventListener('mousemove', updateTooltipPosition);
    button.addEventListener('mouseleave', hideTooltip);
});

const topBar = document.querySelector('.top-bar');
const openBlankBtn = document.getElementById('openBlankBtn');
const noticeAdminBtn = document.getElementById('noticeAdminBtn');
const sideMenu = document.getElementById('sideMenu');
const settingsMenuBtn = document.getElementById('settingsMenuBtn');
const supportMenuBtn = document.getElementById('supportMenuBtn');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const supportOverlay = document.getElementById('supportOverlay');
const supportCloseBtn = document.getElementById('supportCloseBtn');
const supportRequestBtn = document.getElementById('supportRequestBtn');
const noticeAdminOverlay = document.getElementById('noticeAdminOverlay');
const noticeAdminCloseBtn = document.getElementById('noticeAdminCloseBtn');
const noticeAdminLoginView = document.getElementById('noticeAdminLoginView');
const noticeAdminComposerView = document.getElementById('noticeAdminComposerView');
const noticeLoginBtn = document.getElementById('noticeLoginBtn');
const noticeAdminBackBtn = document.getElementById('noticeAdminBackBtn');
const noticePasswordInput = document.getElementById('noticePasswordInput');
const noticeMessageInput = document.getElementById('noticeMessageInput');
const noticeAdminStatus = document.getElementById('noticeAdminStatus');
const noticeComposerStatus = document.getElementById('noticeComposerStatus');
const noticePublishBtn = document.getElementById('noticePublishBtn');
const noticeClearBtn = document.getElementById('noticeClearBtn');
const noticeRefreshBtn = document.getElementById('noticeRefreshBtn');
const leaderboardResetBtn = document.getElementById('leaderboardResetBtn');
const pollResetBtn = document.getElementById('pollResetBtn');
const pollUpdateBtn = document.getElementById('pollUpdateBtn');
const pollQuestionInput = document.getElementById('pollQuestionInput');
const pollOptionsInput = document.getElementById('pollOptionsInput');
const tickerPublishBtn = document.getElementById('tickerPublishBtn');
const tickerClearBtn = document.getElementById('tickerClearBtn');
const tickerInput = document.getElementById('tickerInput');
const featuredGameSetBtn = document.getElementById('featuredGameSetBtn');
const featuredGameClearBtn = document.getElementById('featuredGameClearBtn');
const featuredGameInput = document.getElementById('featuredGameInput');
const maintenanceOnBtn = document.getElementById('maintenanceOnBtn');
const maintenanceOffBtn = document.getElementById('maintenanceOffBtn');
const maintenanceMessageInput = document.getElementById('maintenanceMessageInput');
const clearPresenceBtn = document.getElementById('clearPresenceBtn');
const adminStatsRefreshBtn = document.getElementById('adminStatsRefreshBtn');
const adminOnlineCount = document.getElementById('adminOnlineCount');
const adminPollVotes = document.getElementById('adminPollVotes');
const adminLaunches = document.getElementById('adminLaunches');
const tickerSection = document.getElementById('tickerSection');
const tickerDivider = document.getElementById('tickerDivider');
const tickerText = document.getElementById('tickerText');
const pollQuestion = document.getElementById('pollQuestion');
const maintenanceOverlay = document.getElementById('maintenanceOverlay');
const maintenanceMsgText = document.getElementById('maintenanceMsgText');
const maintenanceBypassToggle = document.getElementById('maintenanceBypassToggle');
const maintenanceBypassForm = document.getElementById('maintenanceBypassForm');
const maintenanceBypassInput = document.getElementById('maintenanceBypassInput');
const maintenanceBypassBtn = document.getElementById('maintenanceBypassBtn');
const maintenanceBypassError = document.getElementById('maintenanceBypassError');
const settingsOpenBlankBtn = document.getElementById('settingsOpenBlankBtn');
const settingsAppearanceBtn = document.getElementById('settingsAppearanceBtn');
const settingsPrivacyBtn = document.getElementById('settingsPrivacyBtn');
const settingsMainView = document.getElementById('settingsMainView');
const appearanceView = document.getElementById('appearanceView');
const appearanceBackBtn = document.getElementById('appearanceBackBtn');
const partnersDockBtn = document.getElementById('partnersDockBtn');
const gamesDockBtn = document.getElementById('gamesDockBtn');
const updatesDockBtn = document.getElementById('updatesDockBtn');
const partnersOverlay = document.getElementById('partnersOverlay');
const partnersWindow = document.getElementById('partnersWindow');
const partnersWindowHeader = document.getElementById('partnersWindowHeader');
const partnersWindowClose = document.getElementById('partnersWindowClose');
const partnersWindowResize = document.getElementById('partnersWindowResize');
const updatesOverlay = document.getElementById('updatesOverlay');
const updatesWindow = document.getElementById('updatesWindow');
const updatesWindowHeader = document.getElementById('updatesWindowHeader');
const updatesWindowClose = document.getElementById('updatesWindowClose');
const updatesWindowResize = document.getElementById('updatesWindowResize');
const gamesOverlay = document.getElementById('gamesOverlay');
const gamesWindow = document.getElementById('gamesWindow');
const gamesWindowHeader = document.getElementById('gamesWindowHeader');
const gamesSearchInput = document.getElementById('gamesSearchInput');
const gamesSearchPage = document.getElementById('gamesSearchPage');
const gamesSearchResults = document.getElementById('gamesSearchResults');
const gamesRandomBtn = document.getElementById('gamesRandomBtn');
const gamesWindowBack = document.getElementById('gamesWindowBack');
const gamesWindowClose = document.getElementById('gamesWindowClose');
const gamesWindowResize = document.getElementById('gamesWindowResize');
const gamesWindowBody = document.getElementById('gamesWindowBody');
const gamesPreviewFrame = document.getElementById('gamesPreviewFrame');
const gamesMenuButtons = Array.from(document.querySelectorAll('.games-menu-button[data-target]'));
const popularAppsList = document.getElementById('popularAppsList');
let lastScrollY = window.scrollY;
let appearanceCloseTimer = null;
let partnersDrag = null;
let partnersResize = null;
let updatesDrag = null;
let updatesResize = null;
let gamesDrag = null;
let gamesResize = null;
let verifiedNoticePassword = '';

function setNoticeStatus(target, text, tone = '') {
    if (!target) {
        return;
    }

    target.textContent = text;
    target.classList.remove('is-error', 'is-success');
    if (tone) {
        target.classList.add(tone);
    }
}

function setNoticeAdminStatus(text, tone = '') {
    setNoticeStatus(noticeAdminStatus, text, tone);
}

function setNoticeComposerStatus(text, tone = '') {
    setNoticeStatus(noticeComposerStatus, text, tone);
}

function showNoticeLoginView() {
    noticeAdminLoginView?.classList.add('is-active');
    noticeAdminComposerView?.classList.remove('is-active');
    noticeAdminComposerView?.setAttribute('aria-hidden', 'true');
}

function showNoticeComposerView() {
    noticeAdminComposerView?.classList.add('is-active');
    noticeAdminComposerView?.setAttribute('aria-hidden', 'false');
    noticeAdminLoginView?.classList.remove('is-active');
}

function renderGlobalNotice(payload) {
    const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
    const isActive = Boolean(payload?.active !== false && message);
    const signature = payload?.updatedAt ? `${payload.updatedAt}:${message}` : message;
    currentNoticeSignature = signature;

    if (isActive) {
        writeCachedNotice({
            active: true,
            message,
            updatedAt: payload?.updatedAt || null,
        });
    } else {
        clearCachedNotice();
    }

    if (!globalNoticeOverlay || !globalNoticeBar || !globalNoticeText) {
        return;
    }

    if (!isActive || dismissedNoticeSignature === signature || dismissedNoticeMessage === message) {
        globalNoticeOverlay.classList.remove('visible');
        globalNoticeOverlay.setAttribute('aria-hidden', 'true');
        globalNoticeText.textContent = '';
        shownNoticeSignature = null;
        stopNoticeDismissTimer();
        return;
    }

    if (shownNoticeSignature !== signature || !globalNoticeOverlay.classList.contains('visible')) {
        shownNoticeSignature = signature;
        startNoticeDismissTimer();
    }

    globalNoticeText.textContent = message;
    globalNoticeOverlay.classList.add('visible');
    globalNoticeOverlay.setAttribute('aria-hidden', 'false');
}

function dismissCurrentGlobalNotice() {
    if (!canDismissNoticeNow()) {
        return;
    }

    dismissedNoticeSignature = currentNoticeSignature;
    dismissedNoticeMessage = globalNoticeText?.textContent?.trim() || '';
    if (globalNoticeOverlay) {
        globalNoticeOverlay.classList.remove('visible');
        globalNoticeOverlay.setAttribute('aria-hidden', 'true');
    }
    shownNoticeSignature = null;
    stopNoticeDismissTimer();
}

async function fetchGlobalNotice({ silent = false } = {}) {
    try {
        const response = await fetch(GLOBAL_NOTICE_ENDPOINT, {
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Worker returned ${response.status}`);
        }

        const payload = await response.json();
        renderGlobalNotice(payload);

        if (noticeMessageInput && document.activeElement !== noticeMessageInput) {
            noticeMessageInput.value = typeof payload?.message === 'string' ? payload.message : '';
        }

        if (!silent) {
            setNoticeAdminStatus(`Worker endpoint: ${GLOBAL_NOTICE_ENDPOINT}`, 'is-success');
            setNoticeComposerStatus(`Worker endpoint: ${GLOBAL_NOTICE_ENDPOINT}`, 'is-success');
        }
        return payload;
    } catch (error) {
        const cached = readCachedNotice();
        if (cached?.active && typeof cached?.message === 'string' && cached.message.trim()) {
            renderGlobalNotice(cached);
        }
        if (!silent) {
            setNoticeAdminStatus(`Worker unavailable: ${error.message}`, 'is-error');
            setNoticeComposerStatus(`Worker unavailable: ${error.message}`, 'is-error');
        }
        return null;
    }
}

async function verifyNoticePassword() {
    const password = noticePasswordInput?.value || '';
    if (!password) {
        setNoticeAdminStatus('Enter the worker admin password first.', 'is-error');
        return;
    }

    setNoticeAdminStatus('Checking password...', '');

    try {
        const response = await fetch(GLOBAL_NOTICE_ENDPOINT, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ password }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error || `Request failed with ${response.status}`);
        }

        verifiedNoticePassword = password;
        setNoticeAdminStatus('Password accepted.', 'is-success');
        setNoticeComposerStatus('Password accepted.', 'is-success');
        showNoticeComposerView();
        noticeMessageInput?.focus();
        fetchGlobalNotice({ silent: true });
        fetchAdminStats();
    } catch (error) {
        verifiedNoticePassword = '';
        setNoticeAdminStatus(error.message, 'is-error');
    }
}

async function updateGlobalNotice(method) {
    const password = verifiedNoticePassword;
    const message = noticeMessageInput?.value?.trim() || '';

    if (!password) {
        setNoticeComposerStatus('Unlock the broadcast panel first.', 'is-error');
        return;
    }

    if (method === 'POST' && !message) {
        setNoticeComposerStatus('Type a message before publishing.', 'is-error');
        return;
    }

    setNoticeComposerStatus('Sending request...', '');

    try {
        const response = await fetch(GLOBAL_NOTICE_ENDPOINT, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                password,
                message,
            }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error || `Request failed with ${response.status}`);
        }

        dismissedNoticeSignature = null;
        dismissedNoticeMessage = '';
        renderGlobalNotice(payload);
        setNoticeComposerStatus(method === 'DELETE' ? 'Notice cleared.' : 'Notice published.', 'is-success');
    } catch (error) {
        setNoticeComposerStatus(error.message, 'is-error');
    }
}

async function resetLeaderboard() {
    const password = verifiedNoticePassword;
    if (!password) {
        setNoticeComposerStatus('Unlock the broadcast panel first.', 'is-error');
        return;
    }

    setNoticeComposerStatus('Resetting leaderboard...', '');

    try {
        const response = await fetch(SITE_POPULAR_APPS_ENDPOINT, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ password }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error || `Request failed with ${response.status}`);
        }

        setNoticeComposerStatus('Leaderboard reset for this week.', 'is-success');
        renderPopularAppsThisWeek();
    } catch (error) {
        setNoticeComposerStatus(error.message, 'is-error');
    }
}

// ─── Admin helper ────────────────────────────────────────────────────────────
async function adminFetch(url, method, extra = {}) {
    const password = verifiedNoticePassword;
    if (!password) {
        setNoticeComposerStatus('Unlock the broadcast panel first.', 'is-error');
        return null;
    }
    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ password, ...extra }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || `Request failed with ${response.status}`);
        return payload;
    } catch (error) {
        setNoticeComposerStatus(error.message, 'is-error');
        return null;
    }
}

async function resetPoll() {
    setNoticeComposerStatus('Resetting poll votes...', '');
    const result = await adminFetch(SITE_POLL_ENDPOINT, 'DELETE');
    if (result) setNoticeComposerStatus('Poll votes reset.', 'is-success');
}

async function updatePollConfig() {
    const question = pollQuestionInput?.value.trim();
    const rawOptions = pollOptionsInput?.value.trim();
    if (!question || !rawOptions) {
        setNoticeComposerStatus('Enter a question and options.', 'is-error');
        return;
    }
    const options = rawOptions.split('\n').map(o => o.trim()).filter(Boolean);
    if (options.length < 2) {
        setNoticeComposerStatus('Need at least 2 options.', 'is-error');
        return;
    }
    setNoticeComposerStatus('Updating poll...', '');
    const result = await adminFetch(SITE_POLL_ENDPOINT, 'PUT', { question, options });
    if (result) {
        setNoticeComposerStatus('Poll updated (votes reset).', 'is-success');
        if (pollQuestion) pollQuestion.textContent = question;
    }
}

async function publishTicker() {
    const message = tickerInput?.value.trim();
    if (!message) {
        setNoticeComposerStatus('Enter a ticker message.', 'is-error');
        return;
    }
    setNoticeComposerStatus('Publishing ticker...', '');
    const result = await adminFetch(SITE_TICKER_ENDPOINT, 'POST', { message, active: true });
    if (result) {
        setNoticeComposerStatus('Ticker published.', 'is-success');
        renderTicker(result);
    }
}

async function clearTicker() {
    setNoticeComposerStatus('Clearing ticker...', '');
    const result = await adminFetch(SITE_TICKER_ENDPOINT, 'DELETE');
    if (result) {
        setNoticeComposerStatus('Ticker cleared.', 'is-success');
        renderTicker({ active: false, message: '' });
    }
}

async function setFeaturedGame() {
    const name = featuredGameInput?.value.trim();
    if (!name) {
        setNoticeComposerStatus('Enter a game name.', 'is-error');
        return;
    }
    setNoticeComposerStatus('Setting featured game...', '');
    const result = await adminFetch(SITE_FEATURED_GAME_ENDPOINT, 'POST', { name });
    if (result) {
        currentFeaturedGame = result.name || '';
        setNoticeComposerStatus('Featured game set.', 'is-success');
        fetchPopularAppsThisWeek();
    }
}

async function clearFeaturedGame() {
    setNoticeComposerStatus('Clearing featured game...', '');
    const result = await adminFetch(SITE_FEATURED_GAME_ENDPOINT, 'DELETE');
    if (result) {
        currentFeaturedGame = '';
        setNoticeComposerStatus('Featured game cleared.', 'is-success');
        fetchPopularAppsThisWeek();
    }
}

async function enableMaintenance() {
    const message = maintenanceMessageInput?.value.trim() || 'Site under maintenance. Back soon!';
    setNoticeComposerStatus('Enabling maintenance mode...', '');
    const result = await adminFetch(SITE_MAINTENANCE_ENDPOINT, 'POST', { active: true, message });
    if (result) setNoticeComposerStatus('Maintenance mode ON.', 'is-success');
}

async function disableMaintenance() {
    setNoticeComposerStatus('Disabling maintenance mode...', '');
    const result = await adminFetch(SITE_MAINTENANCE_ENDPOINT, 'POST', { active: false, message: '' });
    if (result) setNoticeComposerStatus('Maintenance mode OFF.', 'is-success');
}

async function clearAllPresence() {
    setNoticeComposerStatus('Clearing presence keys...', '');
    const result = await adminFetch(SITE_STATS_ENDPOINT, 'DELETE');
    if (result) setNoticeComposerStatus(`Cleared ${result.deleted ?? 0} presence key(s).`, 'is-success');
}

async function fetchAdminStats() {
    if (adminOnlineCount) adminOnlineCount.textContent = '…';
    if (adminPollVotes) adminPollVotes.textContent = '…';
    if (adminLaunches) adminLaunches.textContent = '…';
    try {
        const [statsRes, pollRes, appsRes] = await Promise.all([
            fetch(SITE_STATS_ENDPOINT, { headers: { Accept: 'application/json' } }),
            fetch(SITE_POLL_ENDPOINT, { headers: { Accept: 'application/json' } }),
            fetch(SITE_POPULAR_APPS_ENDPOINT, { headers: { Accept: 'application/json' } }),
        ]);
        const [stats, poll, apps] = await Promise.all([statsRes.json(), pollRes.json(), appsRes.json()]);
        if (adminOnlineCount) adminOnlineCount.textContent = String(stats.activeVisitors ?? '—');
        if (adminPollVotes) adminPollVotes.textContent = String(poll.totalVotes ?? '—');
        const totalLaunches = Array.isArray(apps.apps) ? apps.apps.reduce((s, a) => s + (a.launches || 0), 0) : '—';
        if (adminLaunches) adminLaunches.textContent = String(totalLaunches);
    } catch {
        if (adminOnlineCount) adminOnlineCount.textContent = 'err';
        if (adminPollVotes) adminPollVotes.textContent = 'err';
        if (adminLaunches) adminLaunches.textContent = 'err';
    }
}

function renderTicker(payload) {
    if (!tickerSection || !tickerDivider || !tickerText) return;
    if (payload?.active && payload.message) {
        tickerText.textContent = payload.message;
        tickerSection.style.display = '';
        tickerDivider.style.display = '';
    } else {
        tickerSection.style.display = 'none';
        tickerDivider.style.display = 'none';
        tickerText.textContent = '';
    }
}

async function fetchTicker() {
    try {
        const res = await fetch(SITE_TICKER_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        renderTicker(await res.json());
    } catch { /* silent */ }
}

async function fetchFeaturedGame() {
    try {
        const res = await fetch(SITE_FEATURED_GAME_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        currentFeaturedGame = data.name || '';
    } catch { /* silent */ }
}

async function fetchMaintenanceStatus() {
    try {
        const res = await fetch(SITE_MAINTENANCE_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        if (data.active && maintenanceOverlay && maintenanceMsgText) {
            maintenanceMsgText.textContent = data.message || 'Back soon!';
            maintenanceOverlay.classList.add('visible');
            maintenanceOverlay.setAttribute('aria-hidden', 'false');
        }
    } catch { /* silent */ }
}

maintenanceBypassToggle?.addEventListener('click', () => {
    maintenanceBypassForm?.classList.toggle('visible');
    if (maintenanceBypassForm?.classList.contains('visible')) {
        maintenanceBypassInput?.focus();
    }
});

async function tryMaintenanceBypass() {
    const password = maintenanceBypassInput?.value?.trim();
    if (!password) return;
    if (maintenanceBypassError) maintenanceBypassError.textContent = '';
    if (maintenanceBypassBtn) maintenanceBypassBtn.disabled = true;

    try {
        const res = await fetch(GLOBAL_NOTICE_ENDPOINT, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ password }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Wrong password.');

        // Password correct — hide maintenance overlay for this session
        verifiedNoticePassword = password;
        if (maintenanceOverlay) {
            maintenanceOverlay.classList.remove('visible');
            maintenanceOverlay.setAttribute('aria-hidden', 'true');
        }
    } catch (err) {
        if (maintenanceBypassError) maintenanceBypassError.textContent = err.message;
    } finally {
        if (maintenanceBypassBtn) maintenanceBypassBtn.disabled = false;
    }
}

maintenanceBypassBtn?.addEventListener('click', tryMaintenanceBypass);
maintenanceBypassInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); tryMaintenanceBypass(); }
});

function openNoticeAdminPanel() {
    if (!noticeAdminOverlay) {
        return;
    }

    noticeAdminOverlay.classList.add('visible');
    noticeAdminOverlay.setAttribute('aria-hidden', 'false');
    verifiedNoticePassword = '';
    showNoticeLoginView();
    setNoticeAdminStatus(`Worker endpoint: ${GLOBAL_NOTICE_ENDPOINT}`);
    setNoticeComposerStatus(`Worker endpoint: ${GLOBAL_NOTICE_ENDPOINT}`);
    fetchGlobalNotice({ silent: false });
    noticePasswordInput?.focus();
}

function closeNoticeAdminPanel() {
    if (!noticeAdminOverlay) {
        return;
    }

    noticeAdminOverlay.classList.remove('visible');
    noticeAdminOverlay.setAttribute('aria-hidden', 'true');
}

function updateGamesBackButtonVisibility() {
    if (!gamesWindowBack || !gamesWindowBody) {
        return;
    }

    const inSubView = gamesWindowBody.classList.contains('has-preview') || gamesWindowBody.classList.contains('is-searching');
    gamesWindowBack.classList.toggle('is-visible', inSubView);
    gamesRandomBtn?.classList.toggle('is-hidden', inSubView);
}

function openPartnersWindow() {
    partnersOverlay?.classList.add('visible');
    partnersOverlay?.setAttribute('aria-hidden', 'false');
}

function closePartnersWindow() {
    partnersOverlay?.classList.remove('visible');
    partnersOverlay?.setAttribute('aria-hidden', 'true');
}

function openUpdatesWindow() {
    updatesOverlay?.classList.add('visible');
    updatesOverlay?.setAttribute('aria-hidden', 'false');
}

function closeUpdatesWindow() {
    updatesOverlay?.classList.remove('visible');
    updatesOverlay?.setAttribute('aria-hidden', 'true');
}

function openGamesWindow() {
    gamesOverlay?.classList.add('visible');
    gamesOverlay?.setAttribute('aria-hidden', 'false');
    updateActiveGamesMenuButton();
    updateGamesBackButtonVisibility();
}

function openGameFromButton(gameButton) {
    if (!gameButton || !gamesPreviewFrame || !gamesWindowBody) {
        return;
    }

    const section = gameButton.closest('.games-section');
    const sectionKey = section?.id?.replace('games-section-', '') || 'unknown';
    const gameName = gameButton.textContent?.trim() || 'game';
    const customSrc = gameButton.dataset.src;

    gamesPreviewFrame.src = customSrc
        ? customSrc
        : `game-placeholder.html?section=${encodeURIComponent(sectionKey)}&game=${encodeURIComponent(gameName)}`;

    recordAppLaunch(gameButton);

    // If the user scrolled deep in the list, reset to top so preview is fully visible.
    gamesWindowBody.scrollTop = 0;
    gamesWindowBody.classList.remove('is-searching');
    gamesSearchPage?.setAttribute('aria-hidden', 'true');
    gamesWindowBody.classList.add('has-preview');
    setActiveGamesMenuButton(`games-section-${sectionKey}`);
    updateGamesBackButtonVisibility();
}

function renderPopularAppsThisWeek(entries = []) {
    if (!popularAppsList) {
        return;
    }

    popularAppsList.innerHTML = '';

    if (!Array.isArray(entries) || entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'popular-app-empty';
        empty.textContent = 'No apps tracked yet this week.';
        popularAppsList.appendChild(empty);
        return;
    }

    entries.slice(0, 8).forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'popular-app-item';
        const isFeatured = currentFeaturedGame && entry.name.toLowerCase() === currentFeaturedGame.toLowerCase();
        row.innerHTML = `
            <span class="popular-app-rank">#${index + 1}</span>
            <span class="popular-app-name">${entry.name}${isFeatured ? ' <span class="featured-star" title="Featured">⭐</span>' : ''}</span>
            <span class="popular-app-count">${Math.max(0, Number(entry.launches) || 0)}</span>
        `;
        popularAppsList.appendChild(row);
    });
}

async function fetchPopularAppsThisWeek() {
    try {
        const response = await fetch(SITE_POPULAR_APPS_ENDPOINT, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Request failed with ${response.status}`);
        }

        const payload = await response.json();
        renderPopularAppsThisWeek(Array.isArray(payload.apps) ? payload.apps : []);
    } catch {
        renderPopularAppsThisWeek([]);
    }
}

async function recordAppLaunch(gameButton) {
    if (!gameButton) {
        return;
    }

    const appName = gameButton.textContent?.trim();
    if (!appName) {
        return;
    }

    try {
        const response = await fetch(SITE_POPULAR_APPS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ appName }),
        });

        if (!response.ok) {
            throw new Error(`Request failed with ${response.status}`);
        }

        const payload = await response.json();
        renderPopularAppsThisWeek(Array.isArray(payload.apps) ? payload.apps : []);
    } catch {
        fetchPopularAppsThisWeek();
    }
}

function openRandomGame() {
    if (!gamesWindowBody) {
        return;
    }

    const availableGameButtons = Array.from(gamesWindowBody.querySelectorAll('.games-section button'));
    if (availableGameButtons.length === 0) {
        return;
    }

    const randomIndex = Math.floor(Math.random() * availableGameButtons.length);
    const randomGameButton = availableGameButtons[randomIndex];
    openGameFromButton(randomGameButton);
}

function clearGamesSearch() {
    if (gamesSearchInput) {
        gamesSearchInput.value = '';
    }
    if (gamesSearchResults) {
        gamesSearchResults.innerHTML = '';
    }
    gamesWindowBody?.classList.remove('is-searching');
    gamesSearchPage?.setAttribute('aria-hidden', 'true');
    updateGamesBackButtonVisibility();
}

function renderGamesSearch(query) {
    if (!gamesWindowBody || !gamesSearchResults || !gamesSearchPage) {
        return;
    }

    const textQuery = query.trim().toLowerCase();
    if (!textQuery) {
        gamesSearchResults.innerHTML = '';
        gamesWindowBody.classList.remove('is-searching');
        gamesSearchPage.setAttribute('aria-hidden', 'true');
        updateGamesBackButtonVisibility();
        return;
    }

    const gameButtons = Array.from(gamesWindowBody.querySelectorAll('.games-section button'));
    const matches = gameButtons.filter(button => {
        const buttonLabel = button.textContent?.trim().toLowerCase() || '';
        return buttonLabel.includes(textQuery);
    });

    stopGamesPreview();
    gamesWindowBody.classList.add('is-searching');
    gamesSearchPage.setAttribute('aria-hidden', 'false');
    gamesSearchResults.innerHTML = '';
    updateGamesBackButtonVisibility();

    if (matches.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'games-search-empty';
        empty.textContent = 'No games found for that search.';
        gamesSearchResults.appendChild(empty);
        return;
    }

    matches.forEach(sourceButton => {
        const resultButton = document.createElement('button');
        resultButton.type = 'button';
        resultButton.className = 'outline-button';
        resultButton.textContent = sourceButton.textContent?.trim() || 'game';
        resultButton.addEventListener('click', () => openGameFromButton(sourceButton));
        gamesSearchResults.appendChild(resultButton);
    });
}

function stopGamesPreview() {
    if (!gamesWindowBody) {
        return;
    }

    gamesWindowBody.classList.remove('has-preview');
    if (gamesPreviewFrame) {
        gamesPreviewFrame.src = 'about:blank';
    }
    updateGamesBackButtonVisibility();
}

function showGamesHome() {
    stopGamesPreview();
    clearGamesSearch();
}

function closeGamesWindow() {
    stopGamesPreview();
    clearGamesSearch();
    gamesOverlay?.classList.remove('visible');
    gamesOverlay?.setAttribute('aria-hidden', 'true');
}

function setActiveGamesMenuButton(targetId) {
    gamesMenuButtons.forEach(button => {
        button.classList.toggle('is-active', button.dataset.target === targetId);
    });
}

function updateActiveGamesMenuButton() {
    if (!gamesWindowBody || gamesMenuButtons.length === 0) {
        return;
    }

    const bodyRect = gamesWindowBody.getBoundingClientRect();
    const markerY = bodyRect.top + bodyRect.height * 0.25;
    let currentId = gamesMenuButtons[0].dataset.target;

    for (const button of gamesMenuButtons) {
        const targetId = button.dataset.target;
        const target = targetId ? gamesWindowBody.querySelector(`#${targetId}`) : null;
        if (!target) {
            continue;
        }

        const rect = target.getBoundingClientRect();
        if (rect.top <= markerY) {
            currentId = targetId;
        } else {
            break;
        }
    }

    if (currentId) {
        setActiveGamesMenuButton(currentId);
    }
}

partnersDockBtn?.addEventListener('click', openPartnersWindow);
partnersWindowClose?.addEventListener('click', closePartnersWindow);
gamesDockBtn?.addEventListener('click', openGamesWindow);
updatesDockBtn?.addEventListener('click', openUpdatesWindow);
gamesRandomBtn?.addEventListener('click', openRandomGame);
gamesWindowBack?.addEventListener('click', showGamesHome);
gamesWindowClose?.addEventListener('click', closeGamesWindow);
updatesWindowClose?.addEventListener('click', closeUpdatesWindow);

partnersOverlay?.addEventListener('click', event => {
    if (event.target === partnersOverlay) {
        closePartnersWindow();
    }
});

updatesOverlay?.addEventListener('click', event => {
    if (event.target === updatesOverlay) {
        closeUpdatesWindow();
    }
});

gamesOverlay?.addEventListener('click', event => {
    if (event.target === gamesOverlay) {
        closeGamesWindow();
    }
});

gamesMenuButtons.forEach(button => {
    button.addEventListener('click', () => {
        if (!gamesWindowBody) {
            return;
        }

        clearGamesSearch();

        const targetId = button.dataset.target;
        const target = targetId ? gamesWindowBody.querySelector(`#${targetId}`) : null;
        if (targetId) {
            setActiveGamesMenuButton(targetId);
        }

        // Letter menu should keep scroll behavior.
        if (target) {
            stopGamesPreview();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

gamesWindowBody?.addEventListener('click', event => {
    const gameButton = event.target instanceof Element
        ? event.target.closest('.games-section button')
        : null;

    if (!gameButton || !gamesPreviewFrame || !gamesWindowBody) {
        return;
    }

    openGameFromButton(gameButton);
});

gamesSearchInput?.addEventListener('input', () => {
    renderGamesSearch(gamesSearchInput.value);
});

fetchPopularAppsThisWeek();

gamesWindowBody?.addEventListener('scroll', updateActiveGamesMenuButton);
window.addEventListener('resize', updateActiveGamesMenuButton);
updateActiveGamesMenuButton();

partnersWindowHeader?.addEventListener('pointerdown', event => {
    if (!partnersWindow || event.target === partnersWindowClose || partnersWindowClose?.contains(event.target)) {
        return;
    }

    const rect = partnersWindow.getBoundingClientRect();
    partnersDrag = {
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
    };

    partnersWindow.style.left = `${rect.left}px`;
    partnersWindow.style.top = `${rect.top}px`;
    partnersWindow.style.transform = 'none';
    partnersWindowHeader.setPointerCapture(event.pointerId);
});

partnersWindowResize?.addEventListener('pointerdown', event => {
    if (!partnersWindow) {
        return;
    }

    const rect = partnersWindow.getBoundingClientRect();
    partnersResize = {
        startX: event.clientX,
        startY: event.clientY,
        width: rect.width,
        height: rect.height,
    };

    partnersWindowResize.setPointerCapture(event.pointerId);
    event.stopPropagation();
});

updatesWindowHeader?.addEventListener('pointerdown', event => {
    if (!updatesWindow || event.target === updatesWindowClose || updatesWindowClose?.contains(event.target)) {
        return;
    }

    const rect = updatesWindow.getBoundingClientRect();
    updatesDrag = {
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
    };

    updatesWindow.style.left = `${rect.left}px`;
    updatesWindow.style.top = `${rect.top}px`;
    updatesWindow.style.transform = 'none';
    updatesWindowHeader.setPointerCapture(event.pointerId);
});

updatesWindowResize?.addEventListener('pointerdown', event => {
    if (!updatesWindow) {
        return;
    }

    const rect = updatesWindow.getBoundingClientRect();
    updatesResize = {
        startX: event.clientX,
        startY: event.clientY,
        width: rect.width,
        height: rect.height,
    };

    updatesWindowResize.setPointerCapture(event.pointerId);
    event.stopPropagation();
});

gamesWindowHeader?.addEventListener('pointerdown', event => {
    if (
        !gamesWindow ||
        event.target === gamesWindowClose ||
        gamesWindowClose?.contains(event.target) ||
        event.target === gamesRandomBtn ||
        gamesRandomBtn?.contains(event.target) ||
        event.target === gamesWindowBack ||
        gamesWindowBack?.contains(event.target)
    ) {
        return;
    }

    const rect = gamesWindow.getBoundingClientRect();
    gamesDrag = {
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
    };

    gamesWindow.style.left = `${rect.left}px`;
    gamesWindow.style.top = `${rect.top}px`;
    gamesWindow.style.transform = 'none';
    gamesWindowHeader.setPointerCapture(event.pointerId);
});

gamesWindowResize?.addEventListener('pointerdown', event => {
    if (!gamesWindow) {
        return;
    }

    const rect = gamesWindow.getBoundingClientRect();
    gamesResize = {
        startX: event.clientX,
        startY: event.clientY,
        width: rect.width,
        height: rect.height,
    };

    gamesWindowResize.setPointerCapture(event.pointerId);
    event.stopPropagation();
});

window.addEventListener('pointermove', event => {
    if (partnersDrag && partnersWindow) {
        const dx = event.clientX - partnersDrag.startX;
        const dy = event.clientY - partnersDrag.startY;
        const maxLeft = Math.max(8, window.innerWidth - partnersWindow.offsetWidth - 8);
        const maxTop = Math.max(8, window.innerHeight - partnersWindow.offsetHeight - 8);
        const nextLeft = Math.min(maxLeft, Math.max(8, partnersDrag.left + dx));
        const nextTop = Math.min(maxTop, Math.max(8, partnersDrag.top + dy));
        partnersWindow.style.left = `${nextLeft}px`;
        partnersWindow.style.top = `${nextTop}px`;
    }

    if (partnersResize && partnersWindow) {
        const dw = event.clientX - partnersResize.startX;
        const dh = event.clientY - partnersResize.startY;
        const newWidth = Math.max(320, partnersResize.width + dw);
        const newHeight = Math.max(220, partnersResize.height + dh);
        partnersWindow.style.width = `${newWidth}px`;
        partnersWindow.style.height = `${newHeight}px`;
    }

    if (updatesDrag && updatesWindow) {
        const dx = event.clientX - updatesDrag.startX;
        const dy = event.clientY - updatesDrag.startY;
        const maxLeft = Math.max(8, window.innerWidth - updatesWindow.offsetWidth - 8);
        const maxTop = Math.max(8, window.innerHeight - updatesWindow.offsetHeight - 8);
        const nextLeft = Math.min(maxLeft, Math.max(8, updatesDrag.left + dx));
        const nextTop = Math.min(maxTop, Math.max(8, updatesDrag.top + dy));
        updatesWindow.style.left = `${nextLeft}px`;
        updatesWindow.style.top = `${nextTop}px`;
    }

    if (updatesResize && updatesWindow) {
        const dw = event.clientX - updatesResize.startX;
        const dh = event.clientY - updatesResize.startY;
        const newWidth = Math.max(320, updatesResize.width + dw);
        const newHeight = Math.max(220, updatesResize.height + dh);
        updatesWindow.style.width = `${newWidth}px`;
        updatesWindow.style.height = `${newHeight}px`;
    }

    if (gamesDrag && gamesWindow) {
        const dx = event.clientX - gamesDrag.startX;
        const dy = event.clientY - gamesDrag.startY;
        const maxLeft = Math.max(8, window.innerWidth - gamesWindow.offsetWidth - 8);
        const maxTop = Math.max(8, window.innerHeight - gamesWindow.offsetHeight - 8);
        const nextLeft = Math.min(maxLeft, Math.max(8, gamesDrag.left + dx));
        const nextTop = Math.min(maxTop, Math.max(8, gamesDrag.top + dy));
        gamesWindow.style.left = `${nextLeft}px`;
        gamesWindow.style.top = `${nextTop}px`;
    }

    if (gamesResize && gamesWindow) {
        const dw = event.clientX - gamesResize.startX;
        const dh = event.clientY - gamesResize.startY;
        const newWidth = Math.max(320, gamesResize.width + dw);
        const newHeight = Math.max(220, gamesResize.height + dh);
        gamesWindow.style.width = `${newWidth}px`;
        gamesWindow.style.height = `${newHeight}px`;
    }
});

window.addEventListener('pointerup', () => {
    partnersDrag = null;
    partnersResize = null;
    updatesDrag = null;
    updatesResize = null;
    gamesDrag = null;
    gamesResize = null;
});

function showMainSettingsView() {
    window.clearTimeout(appearanceCloseTimer);
    appearanceCloseTimer = null;
    settingsMainView?.classList.add('is-active');
    settingsMainView?.classList.remove('is-leaving');
    appearanceView?.classList.remove('is-active');
    appearanceView?.classList.remove('is-leaving');
    appearanceView?.setAttribute('aria-hidden', 'true');
}

function showAppearanceView() {
    window.clearTimeout(appearanceCloseTimer);
    appearanceCloseTimer = null;
    settingsMainView?.classList.remove('is-active');
    settingsMainView?.classList.remove('is-leaving');
    appearanceView?.classList.add('is-active');
    appearanceView?.classList.remove('is-leaving');
    appearanceView?.setAttribute('aria-hidden', 'false');
}

function closeAppearanceViewAnimated() {
    if (!appearanceView?.classList.contains('is-active')) {
        showMainSettingsView();
        return;
    }

    appearanceView.classList.add('is-leaving');
    appearanceCloseTimer = window.setTimeout(() => {
        showMainSettingsView();
    }, 220);
}

function openInAboutBlank() {
    const blankWindow = window.open('about:blank', '_blank');
    if (!blankWindow) {
        return;
    }

    const safeUrl = window.location.href.replace(/"/g, '&quot;');
    blankWindow.document.write(`<!DOCTYPE html><html><head><title>about:blank</title><style>html,body{margin:0;height:100%;overflow:hidden;background:#000;}iframe{width:100%;height:100%;border:0;}</style></head><body><iframe src="${safeUrl}" allow="clipboard-read; clipboard-write"></iframe></body></html>`);
    blankWindow.document.close();
}

function openSettingsPanel() {
    if (!settingsOverlay || !sideMenu) {
        return;
    }

    showMainSettingsView();
    settingsOverlay.classList.add('visible');
    settingsOverlay.setAttribute('aria-hidden', 'false');
    sideMenu.classList.add('side-menu-locked');
    settingsMenuBtn?.blur();
}

function closeSettingsPanel() {
    if (!settingsOverlay || !sideMenu) {
        return;
    }

    showMainSettingsView();
    settingsOverlay.classList.remove('visible');
    settingsOverlay.setAttribute('aria-hidden', 'true');
    sideMenu.classList.remove('side-menu-locked');
}

function openSupportPanel() {
    if (!supportOverlay || !sideMenu) {
        return;
    }

    supportOverlay.classList.add('visible');
    supportOverlay.setAttribute('aria-hidden', 'false');
    sideMenu.classList.add('side-menu-locked');
    supportMenuBtn?.blur();
}

function closeSupportPanel() {
    if (!supportOverlay || !sideMenu) {
        return;
    }

    supportOverlay.classList.remove('visible');
    supportOverlay.setAttribute('aria-hidden', 'true');
    sideMenu.classList.remove('side-menu-locked');
}

settingsMenuBtn?.addEventListener('click', openSettingsPanel);
settingsCloseBtn?.addEventListener('click', closeSettingsPanel);
supportMenuBtn?.addEventListener('click', openSupportPanel);
supportCloseBtn?.addEventListener('click', closeSupportPanel);
noticeAdminBtn?.addEventListener('click', openNoticeAdminPanel);
noticeAdminCloseBtn?.addEventListener('click', closeNoticeAdminPanel);
noticeLoginBtn?.addEventListener('click', verifyNoticePassword);
noticeAdminBackBtn?.addEventListener('click', () => {
    verifiedNoticePassword = '';
    showNoticeLoginView();
    noticePasswordInput?.focus();
});
noticePublishBtn?.addEventListener('click', () => updateGlobalNotice('POST'));
noticeClearBtn?.addEventListener('click', () => updateGlobalNotice('DELETE'));
noticeRefreshBtn?.addEventListener('click', () => fetchGlobalNotice({ silent: false }));
leaderboardResetBtn?.addEventListener('click', resetLeaderboard);
pollResetBtn?.addEventListener('click', resetPoll);
pollUpdateBtn?.addEventListener('click', updatePollConfig);
tickerPublishBtn?.addEventListener('click', publishTicker);
tickerClearBtn?.addEventListener('click', clearTicker);
featuredGameSetBtn?.addEventListener('click', setFeaturedGame);
featuredGameClearBtn?.addEventListener('click', clearFeaturedGame);
maintenanceOnBtn?.addEventListener('click', enableMaintenance);
maintenanceOffBtn?.addEventListener('click', disableMaintenance);
clearPresenceBtn?.addEventListener('click', clearAllPresence);
adminStatsRefreshBtn?.addEventListener('click', fetchAdminStats);
globalNoticeDismiss?.addEventListener('click', dismissCurrentGlobalNotice);
globalNoticeOverlay?.addEventListener('click', event => {
    if (event.target === globalNoticeOverlay) {
        dismissCurrentGlobalNotice();
    }
});

supportRequestBtn?.addEventListener('click', () => {
    closeSupportPanel();
});

settingsOverlay?.addEventListener('click', event => {
    if (event.target === settingsOverlay) {
        closeSettingsPanel();
    }
});

supportOverlay?.addEventListener('click', event => {
    if (event.target === supportOverlay) {
        closeSupportPanel();
    }
});

noticeAdminOverlay?.addEventListener('click', event => {
    if (event.target === noticeAdminOverlay) {
        closeNoticeAdminPanel();
    }
});

window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        if (globalNoticeOverlay?.classList.contains('visible')) {
            dismissCurrentGlobalNotice();
        } else if (partnersOverlay?.classList.contains('visible')) {
            closePartnersWindow();
        } else if (updatesOverlay?.classList.contains('visible')) {
            closeUpdatesWindow();
        } else if (gamesOverlay?.classList.contains('visible')) {
            closeGamesWindow();
        } else if (noticeAdminOverlay?.classList.contains('visible')) {
            closeNoticeAdminPanel();
        } else if (supportOverlay?.classList.contains('visible')) {
            closeSupportPanel();
        } else if (settingsOverlay?.classList.contains('visible')) {
            closeSettingsPanel();
        }
    }
});

if (openBlankBtn) {
    openBlankBtn.addEventListener('click', openInAboutBlank);
}

settingsOpenBlankBtn?.addEventListener('click', openInAboutBlank);

settingsAppearanceBtn?.addEventListener('click', () => {
    showAppearanceView();
});

settingsPrivacyBtn?.addEventListener('click', () => {
    typePanelText('I wont sell your data bro');
});

renderGlobalNotice(readCachedNotice() || { active: false, message: '' });
fetchGlobalNotice({ silent: true });
fetchTicker();
fetchFeaturedGame();
fetchMaintenanceStatus();
window.setInterval(() => {
    fetchGlobalNotice({ silent: true });
}, GLOBAL_NOTICE_POLL_MS);

appearanceBackBtn?.addEventListener('click', closeAppearanceViewAnimated);
noticePasswordInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        verifyNoticePassword();
    }
});

const themes = {
    default: {
        '--bg-dark': '#050006',
        '--bg-mid': '#150a24',
        '--chrome-dark': 'rgba(11, 8, 20, 1)',
        '--chrome-mid': 'rgba(20, 12, 34, 1)',
        '--accent': '#9900ff',
        '--accent-soft': 'rgba(153, 0, 255, 0.18)',
        '--panel-border': 'rgba(153, 0, 255, 0.45)',
        '--panel-surface': 'rgba(255, 255, 255, 0.06)',
        '--text': '#fff',
    },
    minty: {
        '--bg-dark': '#020d06',
        '--bg-mid': '#071a10',
        '--chrome-dark': 'rgba(4, 18, 10, 1)',
        '--chrome-mid': 'rgba(7, 26, 16, 1)',
        '--accent': '#3dd68c',
        '--accent-soft': 'rgba(61, 214, 140, 0.18)',
        '--panel-border': 'rgba(61, 214, 140, 0.45)',
        '--panel-surface': 'rgba(255, 255, 255, 0.06)',
        '--text': '#fff',
    },
    orange: {
        '--bg-dark': '#0d0500',
        '--bg-mid': '#1a0a00',
        '--chrome-dark': 'rgba(18, 8, 0, 1)',
        '--chrome-mid': 'rgba(30, 14, 0, 1)',
        '--accent': '#ff6a00',
        '--accent-soft': 'rgba(255, 106, 0, 0.18)',
        '--panel-border': 'rgba(255, 106, 0, 0.45)',
        '--panel-surface': 'rgba(255, 255, 255, 0.06)',
        '--text': '#fff',
    },
    light: {
        '--bg-dark': '#dcdae6',
        '--bg-mid': '#e8e8f0',
        '--chrome-dark': 'rgba(200, 196, 220, 1)',
        '--chrome-mid': 'rgba(215, 210, 235, 1)',
        '--accent': '#7c5cbf',
        '--accent-soft': 'rgba(124, 92, 191, 0.18)',
        '--panel-border': 'rgba(124, 92, 191, 0.45)',
        '--panel-surface': 'rgba(0, 0, 0, 0.05)',
        '--text': '#1a1a2e',
    },
    black: {
        '--bg-dark': '#000000',
        '--bg-mid': '#0a0a0a',
        '--chrome-dark': 'rgba(6, 6, 6, 1)',
        '--chrome-mid': 'rgba(12, 12, 12, 1)',
        '--accent': '#555555',
        '--accent-soft': 'rgba(85, 85, 85, 0.18)',
        '--panel-border': 'rgba(85, 85, 85, 0.45)',
        '--panel-surface': 'rgba(255, 255, 255, 0.04)',
        '--text': '#fff',
    },
};

function applyTheme(name) {
    const theme = themes[name];
    if (!theme) {
        return;
    }

    const root = document.documentElement;
    Object.entries(theme).forEach(([prop, value]) => {
        root.style.setProperty(prop, value);
    });
}

document.querySelectorAll('.theme-swatch[data-theme]').forEach(swatch => {
    swatch.addEventListener('click', () => applyTheme(swatch.dataset.theme));
});

window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY && currentScrollY > 20) {
        topBar.classList.add('hidden');
    } else {
        topBar.classList.remove('hidden');
    }
    lastScrollY = currentScrollY;
});

// Add click handler for button 1
const panelTextElement = document.createElement('p');
panelTextElement.style.color = 'var(--text)';
panelTextElement.style.fontSize = '1.2rem';
panelTextElement.style.lineHeight = '1.6';
panelTextElement.style.margin = '0';
panelTextElement.style.padding = '20px';

function typePanelText(text, onDone) {
    panelTextElement.textContent = '';
    const panel = document.querySelector('.transparent-panel');
    panel.innerHTML = '';
    panel.appendChild(panelTextElement);
    let index = 0;

    function typeNext() {
        if (index < text.length) {
            panelTextElement.textContent += text[index++];
            panelTimer = window.setTimeout(typeNext, 10);
        } else if (onDone) {
            onDone();
        }
    }

    typeNext();
}

// Add click handlers for all buttons
const buttonMessages = {
    2: 'coming soon...',
    3: 'coming soon...',
    4: 'coming soon...',
    5: 'coming soon...',
    6: 'coming soon...',
    7: 'coming soon...',
    8: 'coming soon...'
};

document.querySelectorAll('.button-row .outline-button').forEach((button, idx) => {
    button.addEventListener('click', () => {
        const btnNum = idx + 1;
        if (btnNum === 1) {
            typePanelText('Tuff Terminal 2.0 a terminal for AI access from any page. Drag this link to your bookmarks bar to install: ', () => {
            const link = document.createElement('a');
            link.href = "javascript:(function () { if (document.getElementById('ai-terminal')) { document.getElementById('ai-terminal').style.display = 'flex'; return; } const t = document.createElement('div'); t.id = 'ai-terminal'; t.style.cssText = 'position:fixed;bottom:20px;right:20px;width:600px;height:400px;background:#000;color:#0f0;font-family:Courier,monospace;border:2px solid #0f0;border-radius:8px;box-shadow:0 0 15px #0f0;z-index:999999;display:flex;flex-direction:column;'; t.innerHTML = '<div id=%22terminal-header%22 style=%22background:#111;padding:8px;text-align:center;cursor:move;font-size:14px;%22>AI Terminal [drag] <button id=%22close-btn%22 style=%22float:right;background:#111;color:#fff;border:none;padding:0 6px;font-size:12px;cursor:pointer;%22>%E2%9C%95</button></div><div id=%22terminal-body%22 style=%22flex:1;padding:10px;overflow-y:auto;%22></div><div style=%22display:flex;%22><input id=%22terminal-input%22 style=%22flex:1;background:none;border:none;color:#0f0;font:inherit;padding:8px;outline:none;%22 placeholder=%22Ask anything...%22 /></div>'; document.body.appendChild(t); const header = t.querySelector('#terminal-header'); let isDragging = false, offsetX, offsetY; header.addEventListener('mousedown', e => { isDragging = true; offsetX = e.clientX - t.getBoundingClientRect().left; offsetY = e.clientY - t.getBoundingClientRect().top; }); document.addEventListener('mousemove', e => { if (isDragging) { t.style.left = (e.clientX - offsetX) + 'px'; t.style.top = (e.clientY - offsetY) + 'px'; t.style.right = 'auto'; t.style.bottom = 'auto'; } }); document.addEventListener('mouseup', () => isDragging = false); const closeBtn = t.querySelector('#close-btn'); let hue = 0; setInterval(() => { hue = (hue + 5) % 360; const color = %60hsl(${hue},100%,50%)%60; t.style.borderColor = color; t.style.boxShadow = %600 0 15px ${color}%60; header.style.color = color; closeBtn.style.color = color; }, 50); function log(text, cls) { const line = document.createElement('div'); line.className = cls; line.style.margin = '0;font-weight:bold;color:' + cls; line.textContent = text; body.appendChild(line); body.scrollTop = body.scrollHeight; } const body = t.querySelector('#terminal-body'); log('AI Terminal ready. Ask anything.', 'white'); closeBtn.addEventListener('click', () => t.style.display = 'none'); const input = t.querySelector('#terminal-input'); input.focus(); const s = document.createElement('script'); s.src = 'https://js.puter.com/v2/'; s.onload = () => { input.addEventListener('keypress', async e => { if (e.key === 'Enter') { const prompt = input.value.trim(); if (!prompt) return; log('> ' + prompt, 'white'); input.value = ''; try { const response = await puter.ai.chat(prompt, { model: 'gpt-5.4-nano' }); log(response, 'hsl(' + hue + ',100%,50%)'); } catch (err) { log('Error: AI service failed.', 'red'); } } }); }; document.head.appendChild(s); })();";
            link.textContent = 'TuffTerminal';
            link.title = 'Drag me to your bookmarks bar!';
            link.style.color = 'var(--accent, #89b4fa)';
            link.style.fontWeight = 'bold';
            link.style.cursor = 'grab';
            link.style.textDecoration = 'underline';
            link.addEventListener('click', e => e.preventDefault());
            panelTextElement.appendChild(link);
            });
        } else if (btnNum === 2) {
            typePanelText('Web Console. Execute JavaScript from any page. Drag this link to your bookmarks bar to install: ', () => {
            const link = document.createElement('a');
            link.href = "javascript:(function(){const c=document.createElement('div');c.innerHTML='<style>.console{position:fixed;top:20px;right:20px;width:500px;height:300px;background:#0d1117;color:#c9d1d9;font:12px/1.5 \"SF Mono\",Consolas,Monaco,monospace;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.5);display:flex;flex-direction:column;z-index:9999;border:1px solid #30363d;animation:slideDown .5s ease-out}.header{padding:8px 12px;background:#161b22;border-bottom:1px solid #30363d;cursor:move;display:flex;justify-content:space-between;align-items:center}.body{flex:1;padding:10px;overflow:auto;max-height:0;transition:max-height .3s ease-out .5s}.animate .body{max-height:300px}@keyframes slideDown{from{top:0;opacity:0}to{top:20px;opacity:1}}</style><div class=\"console animate\"><div class=\"header\"><div>Web Console</div><div class=\"close\">×</div></div><div class=\"body\"></div><div style=\"padding:8px 12px;background:#161b22\"><input autofocus style=\"width:100%;background:transparent;border:none;color:#c9d1d9;outline:none\" placeholder=\"Enter JavaScript...\"></div></div>';document.body.appendChild(c);const console=c.querySelector('.body'),input=c.querySelector('input');input.addEventListener('keydown',e=>{if(e.key==='Enter'){try{console.innerHTML+=%60<div>&gt; ${input.value}</div><div>${String(eval(input.value))}</div>%60;console.scrollTop=console.scrollHeight}catch(err){console.innerHTML+=%60<div>Error: ${err.message}</div>%60}input.value=''}});c.querySelector('.close').onclick=()=>c.remove();console.innerHTML='<div>Console ready. Type JavaScript commands.</div>'})();";
            link.textContent = 'Web Console';
            link.title = 'Drag me to your bookmarks bar!';
            link.style.color = 'var(--accent, #89b4fa)';
            link.style.fontWeight = 'bold';
            link.style.cursor = 'grab';
            link.style.textDecoration = 'underline';
            link.addEventListener('click', e => e.preventDefault());
            panelTextElement.appendChild(link);
            });
        } else if (btnNum === 3) {
            typePanelText('Web pr0xy. Browse from a glass widget overlay. Drag this link to your bookmarks bar to install: ', () => {
            const link = document.createElement('a');
            link.href = `javascript:(function(){var ID='ghc-glass-widget',SID='ghc-glass-widget-style';var old=document.getElementById(ID);if(old){old.remove();var os=document.getElementById(SID);if(os)os.remove();if(window.ghcGlassWidgetLoad)delete window.ghcGlassWidgetLoad;if(window.ghcGlassWidgetLoadHosted)delete window.ghcGlassWidgetLoadHosted;return;}var st=document.createElement('style');st.id=SID;st.textContent='#'+ID+'{position:fixed;top:60px;left:60px;width:min(520px,calc(100vw - 24px));height:min(380px,calc(100vh - 24px));min-width:260px;min-height:220px;border-radius:16px;border:1px solid rgba(255,255,255,.18);background:linear-gradient(160deg,rgba(20,26,37,.62),rgba(8,12,20,.52));-webkit-backdrop-filter:blur(18px) saturate(130%);backdrop-filter:blur(18px) saturate(130%);box-shadow:0 24px 50px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.08);color:#eef3ff;z-index:2147483647;overflow:hidden;font:14px/1.45 Avenir Next,Segoe UI,Helvetica Neue,Arial,sans-serif}#'+ID+' .gh{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;cursor:move;user-select:none;background:rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.15)}#'+ID+' .gt{font-weight:600;letter-spacing:.7px;text-transform:uppercase;font-size:12px;opacity:.92}#'+ID+' .gc{border:0;padding:0;margin:0;background:transparent;color:#d8e2ff;cursor:pointer;font:700 16px/1 Arial,sans-serif}#'+ID+' .gc:hover{opacity:.8}#'+ID+' .gb{height:calc(100% - 41px);padding:8px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))}#'+ID+' .gf{width:100%;height:100%;border:0;border-radius:10px;background:#0b111d}#'+ID+' .gr{position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;border-bottom-right-radius:16px;background:linear-gradient(135deg,transparent 53%,rgba(255,255,255,.55) 53%,rgba(255,255,255,.55) 58%,transparent 58%),linear-gradient(135deg,transparent 66%,rgba(255,255,255,.38) 66%,rgba(255,255,255,.38) 71%,transparent 71%)}';var p=document.createElement('section');p.id=ID;p.innerHTML='<div class="gh"><div class="gt">web pr0xy</div><button class="gc" type="button" aria-label="Close">X</button></div><div class="gb"><iframe class="gf" title="web pr0xy Content" referrerpolicy="no-referrer"></iframe></div><div class="gr" aria-hidden="true"></div>';document.head.appendChild(st);document.body.appendChild(p);var h=p.querySelector('.gh'),c=p.querySelector('.gc'),f=p.querySelector('.gf'),r=p.querySelector('.gr');var clamp=function(v,min,max){return Math.max(min,Math.min(v,max));};var load=function(input,mode){var v=String(input==null?'':input).trim();if(!v)return;var asHtml=mode==='html'||v.indexOf('<')===0||v.indexOf('<!DOCTYPE')===0;if(asHtml){f.removeAttribute('src');f.srcdoc=v;return;}f.removeAttribute('srcdoc');f.src=v;};var loadHosted=function(url){var target=String(url==null?'':url).trim();if(!target)return;var safe=target.replace(/&/g,'&').replace(/"/g,'"');var wrapper='<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#0b111d}iframe{width:100%;height:100%;border:0}</style></head><body><iframe src="'+safe+'" referrerpolicy="no-referrer"></iframe></body></html>';load(wrapper,'html');};window.ghcGlassWidgetLoad=load;window.ghcGlassWidgetLoadHosted=loadHosted;loadHosted('https://sandstone.pages.dev/');var dragging=false,resizing=false,sx=0,sy=0,sl=0,stp=0,sw=0,sh=0;h.addEventListener('pointerdown',function(e){if(resizing||e.button!==0||e.target.closest('.gc'))return;dragging=true;var b=p.getBoundingClientRect();sx=e.clientX;sy=e.clientY;sl=b.left;stp=b.top;e.preventDefault();});r.addEventListener('pointerdown',function(e){if(e.button!==0)return;e.stopPropagation();resizing=true;var b=p.getBoundingClientRect();sx=e.clientX;sy=e.clientY;sw=b.width;sh=b.height;e.preventDefault();});var mv=function(e){if(dragging&&!resizing){var dx=e.clientX-sx,dy=e.clientY-sy,maxL=Math.max(8,window.innerWidth-p.offsetWidth-8),maxT=Math.max(8,window.innerHeight-p.offsetHeight-8);p.style.left=clamp(sl+dx,8,maxL)+'px';p.style.top=clamp(stp+dy,8,maxT)+'px';}if(resizing){var dx2=e.clientX-sx,dy2=e.clientY-sy,b2=p.getBoundingClientRect(),maxW=Math.max(260,window.innerWidth-b2.left-8),maxH=Math.max(220,window.innerHeight-b2.top-8);p.style.width=clamp(sw+dx2,260,maxW)+'px';p.style.height=clamp(sh+dy2,220,maxH)+'px';}};var up=function(){dragging=false;resizing=false;};window.addEventListener('pointermove',mv,true);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',up,true);var rm=function(){window.removeEventListener('pointermove',mv,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',up,true);if(window.ghcGlassWidgetLoad===load)delete window.ghcGlassWidgetLoad;if(window.ghcGlassWidgetLoadHosted===loadHosted)delete window.ghcGlassWidgetLoadHosted;p.remove();st.remove();};c.addEventListener('pointerdown',function(e){e.stopPropagation();});c.addEventListener('click',rm);})();`;
            link.textContent = 'Web pr0xy';
            link.title = 'Drag me to your bookmarks bar!';
            link.style.color = 'var(--accent, #89b4fa)';
            link.style.fontWeight = 'bold';
            link.style.cursor = 'grab';
            link.style.textDecoration = 'underline';
            link.addEventListener('click', e => e.preventDefault());
            panelTextElement.appendChild(link);
            });
        } else if (btnNum === 4) {
            typePanelText('Browserfetch, my masterpiece very cool drag ot bookmarks:  ', () => {
            const link = document.createElement('a');
            link.href = `javascript:(function()%7Bvar rootId="__browserfetch_embed__";var old=document.getElementById(rootId);if(old)%7Bold.remove();return;%7Dvar base="https://browserfetch.bigguy8014.workers.dev/browserfetch";var sel="";try%7Bsel=(window.getSelection&&String(window.getSelection()))%7C%7C"";%7Dcatch(e)%7B%7Dvar u=new URL(base);u.searchParams.set("embed","1");u.searchParams.set("src",location.href);u.searchParams.set("title",document.title%7C%7C"");if(sel)u.searchParams.set("sel",sel.slice(0,4000));var wrap=document.createElement("div");wrap.id=rootId;wrap.style.cssText="position:fixed;top:24px;right:24px;width:760px;height:520px;z-index:2147483647;border-radius:14px;overflow:hidden;box-shadow:0 25px 80px rgba(0,0,0,.45);border:1px solid rgba(49,50,68,.95);background:%2311111b;min-width:360px;min-height:280px;";var drag=document.createElement("div");drag.style.cssText="position:absolute;top:0;left:0;right:56px;height:38px;cursor:move;z-index:2;background:transparent;";var close=document.createElement("button");close.type="button";close.textContent="×";close.setAttribute("aria-label","Close browserfetch");close.style.cssText="position:absolute;top:8px;right:10px;width:28px;height:28px;border:0;border-radius:999px;background:rgba(24,24,37,.94);color:%23cdd6f4;font:20px/1 sans-serif;cursor:pointer;z-index:3;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.28);";var grip=document.createElement("div");grip.style.cssText="position:absolute;right:0;bottom:0;width:20px;height:20px;cursor:se-resize;z-index:2;";var frame=document.createElement("iframe");frame.src=u.toString();frame.allow="clipboard-read; clipboard-write";frame.style.cssText="width:100%25;height:100%25;border:0;display:block;background:%2311111b;";wrap.appendChild(frame);wrap.appendChild(drag);wrap.appendChild(close);wrap.appendChild(grip);var ds=null,rs=null;close.addEventListener("click",function(e)%7Bvar n=document.getElementById(rootId);if(n)n.remove();e.preventDefault();e.stopPropagation();%7D);close.addEventListener("mouseenter",function()%7Bclose.style.background="rgba(243,139,168,.95)";close.style.color="%2311111b";%7D);close.addEventListener("mouseleave",function()%7Bclose.style.background="rgba(24,24,37,.94)";close.style.color="%23cdd6f4";%7D);drag.addEventListener("mousedown",function(e)%7Bvar r=wrap.getBoundingClientRect();ds=%7Bsx:e.clientX,sy:e.clientY,left:r.left,top:r.top%7D;e.preventDefault();%7D);grip.addEventListener("mousedown",function(e)%7Bvar r=wrap.getBoundingClientRect();rs=%7Bsx:e.clientX,sy:e.clientY,w:r.width,h:r.height%7D;e.preventDefault();e.stopPropagation();%7D);document.addEventListener("mousemove",function(e)%7Bif(ds)%7Bwrap.style.left=(ds.left+e.clientX-ds.sx)+"px";wrap.style.top=(ds.top+e.clientY-ds.sy)+"px";wrap.style.right="auto";%7D if(rs)%7Bwrap.style.width=Math.max(360,rs.w+e.clientX-rs.sx)+"px";wrap.style.height=Math.max(280,rs.h+e.clientY-rs.sy)+"px";%7D%7D);document.addEventListener("mouseup",function()%7Bds=null;rs=null;%7D);window.addEventListener("message",function(ev)%7Bif(ev&&ev.data&&ev.data.type==="browserfetch-close")%7Bvar n=document.getElementById(rootId);if(n)n.remove();%7D%7D);document.body.appendChild(wrap);%7D)();
            link.textContent = 'browserfetch';
            link.title = 'Drag me to your bookmarks bar!';
            link.style.color = 'var(--accent, #89b4fa)';
            link.style.fontWeight = 'bold';
            link.style.cursor = 'grab';
            link.style.textDecoration = 'underline';
            link.addEventListener('click', e => e.preventDefault());
            panelTextElement.appendChild(link);
            });
        } else {
            const text = buttonMessages[btnNum] || `Button ${btnNum} clicked.`;
            typePanelText(text);
        }
    });
});

function initParticleConstellation() {
    const canvas = document.getElementById('particleConstellation');
    const particles = Array.from(document.querySelectorAll('.particle-layer .particle'));
    if (!canvas || particles.length < 2) {
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }

    const pointer = {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        active: false,
    };

    const lineState = new Map();
    const smoothing = {
        pointer: 0.18,
        activity: 0.09,
        lineIn: 0.2,
        lineOut: 0.12,
    };
    let activityStrength = 0;

    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resizeCanvas() {
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewportWidth * dpr);
        canvas.height = Math.floor(viewportHeight * dpr);
        canvas.style.width = viewportWidth + 'px';
        canvas.style.height = viewportHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function getParticleCenters() {
        const points = [];
        for (const particle of particles) {
            const rect = particle.getBoundingClientRect();
            points.push({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            });
        }
        return points;
    }

    function pairKey(i, j) {
        return `${i}:${j}`;
    }

    function draw() {
        pointer.x += (pointer.targetX - pointer.x) * smoothing.pointer;
        pointer.y += (pointer.targetY - pointer.y) * smoothing.pointer;
        activityStrength += ((pointer.active ? 1 : 0) - activityStrength) * smoothing.activity;

        ctx.clearRect(0, 0, viewportWidth, viewportHeight);
        if (activityStrength < 0.01 && lineState.size === 0) {
            window.requestAnimationFrame(draw);
            return;
        }

        const cursorRadius = 170;
        const maxPairDistance = 220;
        const minimumVisibleAlpha = 0.015;
        const points = getParticleCenters();

        for (let i = 0; i < points.length; i++) {
            const pointA = points[i];
            const aDx = pointA.x - pointer.x;
            const aDy = pointA.y - pointer.y;
            const aCursorDist = Math.hypot(aDx, aDy);

            for (let j = i + 1; j < points.length; j++) {
                const pointB = points[j];
                const bDx = pointB.x - pointer.x;
                const bDy = pointB.y - pointer.y;
                const bCursorDist = Math.hypot(bDx, bDy);
                const pairDx = pointA.x - pointB.x;
                const pairDy = pointA.y - pointB.y;
                const pairDist = Math.hypot(pairDx, pairDy);
                const key = pairKey(i, j);

                let targetAlpha = 0;
                if (pairDist <= maxPairDistance && aCursorDist <= cursorRadius && bCursorDist <= cursorRadius) {
                    const cursorInfluence = 1 - Math.min((aCursorDist + bCursorDist) / (cursorRadius * 2), 1);
                    const pairInfluence = 1 - Math.min(pairDist / maxPairDistance, 1);
                    targetAlpha = (0.08 + cursorInfluence * pairInfluence * 0.45) * activityStrength;
                }

                const previous = lineState.get(key) || 0;
                const ease = targetAlpha > previous ? smoothing.lineIn : smoothing.lineOut;
                const nextAlpha = previous + (targetAlpha - previous) * ease;

                if (nextAlpha <= minimumVisibleAlpha) {
                    lineState.delete(key);
                    continue;
                }

                lineState.set(key, nextAlpha);
                const pairInfluence = 1 - Math.min(pairDist / maxPairDistance, 1);
                ctx.strokeStyle = `rgba(220, 236, 255, ${nextAlpha.toFixed(3)})`;
                ctx.lineWidth = 0.9 + pairInfluence * 1.3;
                ctx.beginPath();
                ctx.moveTo(pointA.x, pointA.y);
                ctx.lineTo(pointB.x, pointB.y);
                ctx.stroke();

                const nodeAlpha = Math.min(nextAlpha * 0.9, 0.42);
                ctx.fillStyle = `rgba(245, 250, 255, ${nodeAlpha.toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(pointA.x, pointA.y, 1.15, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pointB.x, pointB.y, 1.15, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        window.requestAnimationFrame(draw);
    }

    window.addEventListener('mousemove', event => {
        pointer.targetX = event.clientX;
        pointer.targetY = event.clientY;

        if (!pointer.active && activityStrength < 0.01) {
            pointer.x = event.clientX;
            pointer.y = event.clientY;
        }

        pointer.active = true;
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
        pointer.active = false;
    });

    window.addEventListener('blur', () => {
        pointer.active = false;
    });

    window.addEventListener('resize', resizeCanvas, { passive: true });
    resizeCanvas();
    window.requestAnimationFrame(draw);
}

initParticleConstellation();

// === Stats Panel ===

(function () {
    const countEl = document.getElementById('onlineCount');
    const voteBtn = document.getElementById('pollVoteBtn');
    const resultsEl = document.getElementById('pollResults');
    const optionsEl = document.getElementById('pollOptions');

    if (!countEl || !voteBtn || !resultsEl || !optionsEl) {
        return;
    }

    function getVisitorId() {
        try {
            const existing = localStorage.getItem(SITE_VISITOR_STORAGE_KEY);
            if (existing) {
                return existing;
            }
            const created = crypto.randomUUID();
            localStorage.setItem(SITE_VISITOR_STORAGE_KEY, created);
            return created;
        } catch {
            return crypto.randomUUID();
        }
    }

    const visitorId = getVisitorId();

    function renderResults(options, votes) {
        const total = votes.reduce((a, b) => a + b, 0);
        resultsEl.classList.add('visible');
        resultsEl.innerHTML = '';

        votes.forEach((voteCount, index) => {
            const pct = total > 0 ? Math.round((voteCount / total) * 100) : 0;
            const row = document.createElement('div');
            row.className = 'poll-result-row';
            row.innerHTML = `
                <div class="poll-result-meta">
                    <span class="poll-result-name">${options[index] || `Option ${index + 1}`}</span>
                    <span class="poll-result-pct">${pct}%</span>
                </div>
                <div class="poll-result-track">
                    <div class="poll-result-fill" style="width: ${pct}%"></div>
                </div>
            `;
            resultsEl.appendChild(row);
        });
    }

    function setPollVotedState() {
        voteBtn.disabled = true;
        voteBtn.textContent = 'Voted';
        optionsEl.querySelectorAll('input[type="radio"]').forEach(input => {
            input.disabled = true;
        });
    }

    async function syncPresence() {
        try {
            const response = await fetch(SITE_STATS_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ visitorId }),
            });

            if (!response.ok) {
                return;
            }

            const payload = await response.json();
            countEl.textContent = String(payload.activeVisitors || 0);
        } catch {
            if (!countEl.textContent || countEl.textContent === '—') {
                countEl.textContent = '--';
            }
        }
    }

    async function loadPollState() {
        try {
            const response = await fetch(`${SITE_POLL_ENDPOINT}?visitorId=${encodeURIComponent(visitorId)}`, {
                method: 'GET',
            });

            if (!response.ok) {
                return;
            }

            const payload = await response.json();
            const options = Array.isArray(payload.options) ? payload.options : [];
            const votes = Array.isArray(payload.votes) ? payload.votes : [];

            // Update poll question text dynamically
            if (payload.question && pollQuestion) {
                pollQuestion.textContent = payload.question;
            }

            // Re-render options dynamically if they differ from current HTML
            if (options.length > 0) {
                optionsEl.innerHTML = '';
                options.forEach((label, index) => {
                    const opt = document.createElement('label');
                    opt.className = 'poll-option';
                    opt.innerHTML = `<input type="radio" name="sitePoll" value="${index}" /><span class="poll-option-label">${label}</span>`;
                    optionsEl.appendChild(opt);
                });
            }

            if (payload.voted && options.length && votes.length) {
                renderResults(options, votes);
            } else {
                resultsEl.classList.remove('visible');
                resultsEl.innerHTML = '';
            }

            if (payload.voted) {
                setPollVotedState();
            }
        } catch {
            // Keep the UI usable even if the API is temporarily unreachable.
        }
    }

    voteBtn.addEventListener('click', async () => {
        const checked = optionsEl.querySelector('input[name="sitePoll"]:checked');
        if (!checked || voteBtn.disabled) {
            return;
        }

        voteBtn.disabled = true;

        try {
            const response = await fetch(SITE_POLL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    visitorId,
                    option: Number(checked.value),
                }),
            });

            if (!response.ok) {
                voteBtn.disabled = false;
                return;
            }

            const payload = await response.json();
            const options = Array.isArray(payload.options) ? payload.options : [];
            const votes = Array.isArray(payload.votes) ? payload.votes : [];

            if (options.length && votes.length) {
                renderResults(options, votes);
            }

            setPollVotedState();
        } catch {
            voteBtn.disabled = false;
        }
    });

    syncPresence();
    window.setInterval(syncPresence, 25000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            syncPresence();
        }
    });

    loadPollState();
}());


