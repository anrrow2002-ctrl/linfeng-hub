import { createService, publicURL } from './core.mjs?v=2.1.0';

const VERSION = '2.1.0';
function fault(code, message) { return Object.assign(new Error(message || code), { code }); }
function joinSignals(signals) {
    const list = signals.filter(Boolean);
    if (AbortSignal.any) return AbortSignal.any(list);
    const ctl = new AbortController();
    for (const signal of list) {
        if (signal.aborted) { ctl.abort(); break; }
        signal.addEventListener('abort', () => ctl.abort(), { once: true });
    }
    return ctl.signal;
}

// 联网仍由酒馆服务器完成；浏览器只提交地址并解析返回的公开数据。
export function installNativeFeed(win = globalThis) {
    const originalFetch = win.fetch;
    const callFetch = (...args) => originalFetch.call(win, ...args);
    const lifecycle = new AbortController();
    let active = true, csrfToken = '';
    async function headers(signal) {
        const context = win.SillyTavern?.getContext?.();
        if (context?.getRequestHeaders) return { ...context.getRequestHeaders(), 'Content-Type': 'application/json' };
        if (typeof win.getRequestHeaders === 'function') return { ...win.getRequestHeaders(), 'Content-Type': 'application/json' };
        if (!csrfToken) {
            const response = await callFetch('/csrf-token', { credentials: 'same-origin', cache: 'no-store', signal });
            if (!response.ok) throw fault('session_required');
            try { csrfToken = (await response.json()).token || ''; } catch { throw fault('session_required'); }
            if (!csrfToken) throw fault('session_required');
        }
        return { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
    }
    async function nativeFetch(url, options = {}) {
        if (!active) throw fault('transport_disabled');
        if (!publicURL(url)) throw fault('source_not_allowed');
        const signal = joinSignals([lifecycle.signal, options.signal]);
        const response = await callFetch('/api/search/visit', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: await headers(signal), body: JSON.stringify({ url, html: false }), signal,
        });
        if (response.status === 404) throw fault('native_unavailable');
        if (response.status === 401 || response.status === 403) throw fault('session_required');
        if (response.redirected && /\/(login|signin)(\/|$)/i.test(new URL(response.url).pathname)) throw fault('session_required');
        return response;
    }
    const service = createService({ fetcher: nativeFetch, publicWeb: true });
    const previous = win.__lfNotebookFeed;
    const api = {
        version: VERSION, mode: 'native',
        async feed(input) {
            if (!active) throw fault('transport_disabled');
            return service.feed({ ...input, signal: joinSignals([lifecycle.signal, input.signal]) });
        },
        async probe(options = {}) {
            const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
            const signal = joinSignals([lifecycle.signal, ctl.signal, options.signal]);
            try {
                // Express 对已存在的POST路由自动返回Allow，不需要请求外站或重启服务器。
                const response = await callFetch('/api/search/visit', {
                    method: 'OPTIONS', credentials: 'same-origin', cache: 'no-store',
                    headers: await headers(signal), signal,
                });
                if (response.status === 401 || response.status === 403 || response.redirected) throw fault('session_required');
                if (response.status === 404) throw fault('native_unavailable');
                if (response.ok && /\bPOST\b/i.test(response.headers.get('allow') || '')) return { ok: true, version: VERSION, mode: 'native' };
                // 少数反向代理不保留OPTIONS的Allow头，用缺少URL的校验响应确认原生路由。
                const fallback = await callFetch('/api/search/visit', {
                    method: 'POST', credentials: 'same-origin', cache: 'no-store',
                    headers: await headers(signal), body: '{}', signal,
                });
                if (fallback.status === 401 || fallback.status === 403 || fallback.redirected) throw fault('session_required');
                if (fallback.status === 404) throw fault('native_unavailable');
                if (fallback.status === 400 && /^\s*Bad Request\s*$/i.test(await fallback.text())) return { ok: true, version: VERSION, mode: 'native' };
                throw fault('native_response');
            } finally { clearTimeout(timer); }
        },
        close() {
            if (!active) return;
            active = false; lifecycle.abort(); service.clear();
            if (win.fetch === compatibilityFetch) win.fetch = originalFetch;
            if (win.__lfNotebookFeed === api) {
                if (previous) win.__lfNotebookFeed = previous;
                else delete win.__lfNotebookFeed;
            }
        },
    };
    // 兼容已发布手帐中的旧GET接口。仅拦截本插件的这个地址，其他请求原样交还。
    function compatibilityFetch(input, init = {}) {
        let url;
        try { url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, win.location.href); }
        catch { return callFetch(input, init); }
        const method = String(init.method || input?.method || 'GET').toUpperCase();
        if (!active || method !== 'GET' || url.origin !== win.location.origin || url.pathname !== '/api/plugins/linfeng-notes/feed') return callFetch(input, init);
        const q = url.searchParams;
        return api.feed({
            site: q.get('site') || 'web', query: q.get('q') || '', title: q.get('title') || '',
            seed: q.get('seed') || '', url: q.get('url') || '', exclude: (q.get('exclude') || '').split('|').filter(Boolean),
            signal: init.signal || input?.signal,
        }).then(data => new win.Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    win.__lfNotebookFeed = api;
    win.fetch = compatibilityFetch;
    win.dispatchEvent(new win.CustomEvent('lf-notebook-feed-ready'));
    return api;
}
