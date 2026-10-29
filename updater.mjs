// 只更新当前安装的这个仓库；文件准备好后，由玩家自行刷新，不打断聊天。
export const UPDATE_REPOSITORY = 'https://github.com/anrrow2002-ctrl/linfeng-hub';
const INTERVAL = 30 * 60 * 1000;
function fault(code) { return Object.assign(new Error(code), { code }); }
export function isUpdateRepository(value) {
    const normalized = String(value || '').trim().replace(/^git@github\.com:/i, 'https://github.com/').replace(/\.git\/?$/i, '').replace(/\/$/, '');
    try {
        const url = new URL(normalized);
        return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search && !url.hash &&
            url.hostname.toLowerCase() === 'github.com' && url.pathname.toLowerCase() === '/anrrow2002-ctrl/linfeng-hub';
    } catch { return false; }
}
function extensionFolder(moduleURL) {
    const match = new URL(moduleURL).pathname.match(/\/scripts\/extensions\/third-party\/([^/]+)\/[^/]+$/);
    if (!match) throw fault('update_installation_unknown');
    const folder = decodeURIComponent(match[1]);
    if (!folder || folder === '.' || folder === '..' || /[\\/\0]/.test(folder)) throw fault('update_installation_unknown');
    return folder;
}
function contextOf(win) { try { return win.SillyTavern?.getContext?.() || {}; } catch { return {}; } }
export function newerVersion(candidate, current) {
    const parse = value => /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value || ''))?.slice(1).map(Number);
    const a = parse(candidate), b = parse(current);
    if (!a || !b) return false;
    for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
    return false;
}
export function updateMessage(state) {
    return ({
        idle: '会自动检查这个插件的更新。', checking: '正在看看有没有新版…',
        current: '插件已经是最新版。', available: '插件有新版，可以更新后刷新使用。',
        downloading: '正在准备新版，聊天可以照常进行…',
        staged: '新版已经准备好，刷新酒馆页面即可使用。请先保存正在输入的内容。',
        permission: '插件有新版，需要酒馆管理员更新这个全局扩展，然后刷新即可使用。',
        unsupported: '这个安装无法自动更新，请在酒馆扩展管理中更新林锋手帐。',
        error: '暂时没能完成更新检查，可以稍后重试。当前版本继续使用。',
        failed: '新版暂时没能下载好，可以重试。当前版本继续使用。',
    })[state.status] || '';
}

/** Install once per extension lifecycle. onChange receives persistent panel state.
 * Native routes and their local/global flags match SillyTavern's extension manager.
 * autoStage downloads only this verified Git repository; it never reloads or executes new code.
 */
export function installExtensionUpdater(win = globalThis, options = {}) {
    const version = String(options.version || ''), moduleURL = options.moduleURL || import.meta.url;
    const fetcher = options.fetcher || ((...args) => win.fetch(...args));
    const now = options.now || Date.now, lifecycle = new AbortController();
    let active = true, state = { status: 'idle', version }, running = null, startupTimer = null, intervalTimer = null, lastChecked = 0;
    let installation = null, csrfToken = '', attempted = '';
    const storageKey = 'lf-notebook-update:' + new URL(moduleURL).pathname.replace(/[^/]+$/, '');
    const sessionSeen = new Set();
    function storage() { return contextOf(win).accountStorage || win.localStorage; }
    function stored(key) { try { return storage()?.getItem(storageKey + key) || ''; } catch { return ''; } }
    function save(key, value) { try { storage()?.setItem(storageKey + key, value); } catch { /* 禁用存储仍可使用 */ } }
    let autoStage = stored('auto-stage') !== 'false' && options.autoStage !== false;
    function set(patch) {
        if (!active) return state;
        state = { ...state, ...patch, autoStage };
        state.message = updateMessage(state);
        options.onChange?.({ ...state });
        return state;
    }
    function notice() {
        const key = state.status + ':' + (state.latestVersion || state.target || 'new');
        if (sessionSeen.has(key) || stored('notice') === key) return;
        sessionSeen.add(key); save('notice', key);
        if (options.onNotice) { try { options.onNotice({ ...state }); } catch { /* 提示失败不改变更新结果 */ } return; }
        const ctx = contextOf(win);
        const message = '林锋手帐：' + state.message;
        if (typeof ctx.callGenericPopup === 'function' && ctx.POPUP_TYPE?.TEXT !== undefined) {
            // 仅提示，不把确认按钮当作强制刷新；玩家可在设置面板操作。
            try { Promise.resolve(ctx.callGenericPopup(message, ctx.POPUP_TYPE.TEXT, '', { okButton: '知道了' })).catch(() => {}); } catch { /* 设置面板仍保留更新提示 */ }
        } else { try { win.toastr?.info?.(message, '林锋手帐更新', { timeOut: 12000, closeButton: true }); } catch { /* 设置面板仍保留更新提示 */ } }
    }
    async function request(url, init = {}, timeout = 20000) {
        const ctl = new AbortController(), cancel = () => ctl.abort();
        lifecycle.signal.addEventListener('abort', cancel, { once: true });
        const timeoutID = setTimeout(cancel, timeout);
        try {
            if (!active) throw fault('update_closed');
            return await fetcher(url, { credentials: 'same-origin', cache: 'no-store', ...init, signal: ctl.signal });
        } finally { clearTimeout(timeoutID); lifecycle.signal.removeEventListener('abort', cancel); }
    }
    async function headers() {
        const ctx = contextOf(win);
        if (ctx.getRequestHeaders) return { ...ctx.getRequestHeaders(), 'Content-Type': 'application/json' };
        if (win.getRequestHeaders) return { ...win.getRequestHeaders(), 'Content-Type': 'application/json' };
        if (!csrfToken) {
            const response = await request('/csrf-token');
            if (!response.ok) throw fault('update_session_required');
            csrfToken = (await response.json()).token || '';
            if (!csrfToken) throw fault('update_session_required');
        }
        return { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
    }
    async function post(route, body, timeout) {
        const response = await request(route, { method: 'POST', headers: await headers(), body: JSON.stringify(body) }, timeout);
        if (!response.ok) throw Object.assign(fault(response.status === 403 ? 'update_permission' : 'update_request_failed'), { status: response.status });
        return response.json();
    }
    async function discover() {
        const folder = extensionFolder(moduleURL);
        const response = await request('/api/extensions/discover');
        if (!response.ok) throw fault('update_installation_unknown');
        const list = await response.json();
        const found = Array.isArray(list) && list.find(item => item.name === 'third-party/' + folder && ['local', 'global'].includes(item.type));
        if (!found) throw fault('update_installation_unknown');
        return { extensionName: folder, global: found.type === 'global' };
    }
    async function stage() {
        if (!active || !installation || !state.verified || !['available', 'failed', 'permission'].includes(state.status)) return state;
        attempted = state.target || state.latestVersion || '';
        set({ status: 'downloading', error: '' });
        try {
            const result = await post('/api/extensions/update', installation, 120000);
            if (!isUpdateRepository(result.remoteUrl)) throw fault('update_repository_mismatch');
            set({ status: 'staged' }); notice();
        } catch (error) {
            if (!active) return state;
            set({ status: error.code === 'update_permission' ? 'permission' : 'failed', error: error.code || 'update_request_failed' });
            notice();
        }
        return state;
    }
    async function performCheck() {
        const old = state;
        set({ status: 'checking', error: '' });
        try {
            // 其他玩家/管理员可能已在同一酒馆更新文件；此时只提示刷新。
            const manifestURL = new URL('./manifest.json', moduleURL); manifestURL.search = 'lf-update=' + now();
            const disk = await request(manifestURL.href);
            if (disk.ok) {
                const installed = await disk.json();
                if (newerVersion(installed.version, version)) {
                    set({ status: 'staged', latestVersion: String(installed.version) }); notice(); return state;
                }
            }
            installation = await discover();
            const result = await post('/api/extensions/version', installation);
            if (!isUpdateRepository(result.remoteUrl) || !result.currentCommitHash) {
                set({ status: 'unsupported', verified: false }); return state;
            }
            if (result.isUpToDate) { set({ status: 'current', verified: true }); return state; }
            let latestVersion = '';
            try {
                const branch = encodeURIComponent(result.currentBranchName || 'main');
                const remote = await post('/api/search/visit', { url: 'https://raw.githubusercontent.com/anrrow2002-ctrl/linfeng-hub/' + branch + '/manifest.json?lf-update=' + now(), html: false });
                if (/^\d+\.\d+\.\d+(?:[-+.][\w.-]+)?$/.test(remote.version || '')) latestVersion = remote.version;
            } catch { /* 原生git检查已确认有更新；版本号不可读不影响一键更新 */ }
            const target = latestVersion || 'after-' + String(result.currentCommitHash);
            set({ status: 'available', verified: true, latestVersion, target });
            if (autoStage && attempted !== target) await stage();
            else notice();
        } catch (error) {
            if (!active) return state;
            if (old.status === 'staged') return set(old);
            set({ status: error.code === 'update_installation_unknown' ? 'unsupported' : 'error', error: error.code || 'update_request_failed' });
        } finally { lastChecked = now(); }
        return state;
    }
    function check() {
        if (!active) return Promise.resolve(state);
        // 本页仍在运行旧模块；只有玩家刷新后才消除这条提示。
        if (state.status === 'staged') return Promise.resolve(state);
        if (running) return running;
        running = performCheck().finally(() => { running = null; });
        return running;
    }
    function prepare() {
        if (running) return running;
        running = stage().finally(() => { running = null; });
        return running;
    }
    function backgroundCheck() { if (active && now() - lastChecked >= INTERVAL) void check(); }
    if (options.autoStart !== false) {
        startupTimer = setTimeout(() => { startupTimer = null; void check(); }, options.initialDelay ?? 3000);
        win.addEventListener?.('focus', backgroundCheck);
        intervalTimer = setInterval(backgroundCheck, INTERVAL);
    }
    set({});
    return {
        check, prepare,
        state: () => ({ ...state }),
        setAutoStage(value) { autoStage = Boolean(value); save('auto-stage', String(autoStage)); set({}); },
        close() {
            active = false; lifecycle.abort();
            clearTimeout(startupTimer); clearInterval(intervalTimer);
            win.removeEventListener?.('focus', backgroundCheck);
        },
    };
}
