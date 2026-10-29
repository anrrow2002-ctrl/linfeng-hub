/* 酒馆前端扩展入口。后台入口由 package.json 的 main 指向 index.mjs。 */
const PANEL_ID = 'lf-notebook-feed-extension';
let enabled = false, listener = null, request = null;

function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
}

async function checkBackend(panel) {
    if (request) return;
    const button = panel.querySelector('button');
    const status = panel.querySelector('[role="status"]');
    const controller = new AbortController();
    request = controller;
    const timer = setTimeout(() => controller.abort(), 10000);
    button.disabled = true;
    status.dataset.state = 'loading';
    status.textContent = '正在看看后台有没有准备好…';
    try {
        const response = await fetch('/api/plugins/linfeng-notes/health', {
            credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) {
            if (response.status === 404) throw new Error('后台尚未安装或未启用。请按 README 在 VPS 安装后台并重启酒馆。');
            throw new Error('后台检查未成功（HTTP ' + response.status + '），请检查酒馆登录与服务器日志。');
        }
        let body;
        try { body = await response.json(); }
        catch { throw new Error('没有收到后台状态，请检查是否跳到了登录页，以及后台是否已正确安装。'); }
        if (body?.ok !== true || typeof body.version !== 'string') throw new Error('后台返回的状态不完整，请检查安装位置和版本。');
        if (!enabled || !panel.isConnected) return;
        status.dataset.state = 'ready';
        status.textContent = '后台已连接 · v' + body.version + '。翻到手帐“浏览”页就会自动找帖子。';
    } catch (error) {
        if (!enabled || !panel.isConnected) return;
        status.dataset.state = 'unavailable';
        status.textContent = error.name === 'AbortError'
            ? '检查超时，请确认 VPS 上的酒馆正常运行后重试。'
            : error.message;
    } finally {
        clearTimeout(timer);
        if (request === controller) request = null;
        button.disabled = false;
    }
}

function mount() {
    if (!enabled || document.getElementById(PANEL_ID)) return;
    const target = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!target) return;
    const panel = element('details', 'lf-feed-panel');
    panel.id = PANEL_ID;
    panel.open = true;
    panel.appendChild(element('summary', '', '♡ 林锋手帐 · 自动推送'));
    panel.appendChild(element('p', '', '给本子翻找一点小发现。按角色的关键词自动寻找、解析和展示公开帖子。'));
    const status = element('p', 'lf-feed-status', '正在检查后台…');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    panel.appendChild(status);
    const button = element('button', 'menu_button', '检查后台连接');
    button.type = 'button';
    button.addEventListener('click', () => checkBackend(panel));
    panel.appendChild(button);
    panel.appendChild(element('p', 'lf-feed-help', '此处负责检查连接；后台还需安装到 VPS 的 plugins/linfeng-notes 并启用。站点受限时，手帐会保留对应占位。'));
    target.appendChild(panel);
    void checkBackend(panel);
}

export function onEnable() {
    if (enabled) return;
    enabled = true;
    // 使用酒馆公开上下文，不导入依赖扩展目录深度的内部脚本。
    try {
        const context = globalThis.SillyTavern?.getContext();
        if (context?.eventSource?.on && context.event_types?.APP_READY) {
            listener = { bus: context.eventSource, event: context.event_types.APP_READY };
            listener.bus.on(listener.event, mount);
        }
    } catch { /* DOM 就绪时仍可挂载 */ }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
}

export function onDisable() {
    enabled = false;
    request?.abort();
    request = null;
    document.removeEventListener('DOMContentLoaded', mount);
    if (listener) {
        if (typeof listener.bus.removeListener === 'function') listener.bus.removeListener(listener.event, mount);
        else listener.bus.off?.(listener.event, mount);
        listener = null;
    }
    document.getElementById(PANEL_ID)?.remove();
}

onEnable();
