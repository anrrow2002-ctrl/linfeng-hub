import { installNativeFeed } from './native-transport.mjs?v=2.1.0';
import { failureReason } from './core.mjs?v=2.1.0';
import { installExtensionUpdater } from './updater.mjs?v=2.1.0';
/* 标准酒馆扩展：复用内置网页读取接口，不要求另装Node后台服务。 */
const PANEL_ID = 'lf-notebook-feed-extension';
let enabled = false, listener = null, request = null, feed = null, updater = null;

function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
}

async function checkBackend(panel) {
    if (request) return;
    const button = panel.querySelector('.lf-feed-check');
    const status = panel.querySelector('[role="status"]');
    const controller = new AbortController();
    request = controller;
    const timer = setTimeout(() => controller.abort(), 10000);
    button.disabled = true;
    status.dataset.state = 'loading';
    status.textContent = '正在看看后台有没有准备好…';
    try {
        const body = await feed.probe({ signal: controller.signal });
        if (!enabled || !panel.isConnected) return;
        status.dataset.state = 'ready';
        status.textContent = '酒馆联网接口已连接 · v' + body.version + '。翻到手帐“浏览”页就会自动找帖子。';
    } catch (error) {
        if (!enabled || !panel.isConnected) return;
        status.dataset.state = 'unavailable';
        status.textContent = error.name === 'AbortError'
            ? '检查超时，请确认 VPS 上的酒馆正常运行后重试。'
            : error.code ? failureReason(error.code) : error.message;
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
    const button = element('button', 'menu_button lf-feed-check', '检查联网接口');
    button.type = 'button';
    button.addEventListener('click', () => checkBackend(panel));
    panel.appendChild(button);
    panel.appendChild(element('p', 'lf-feed-help', '直接使用酒馆已有的联网接口，安装扩展后刷新即可。站点受限、搜索失败和接口不可用会分别提示。'));
    target.appendChild(panel);
    mountUpdater(panel);
    void checkBackend(panel);
}

function mountUpdater(panel) {
    const box = element('div', 'lf-feed-updater');
    const message = element('p', 'lf-feed-update-status', '正在检查插件版本…');
    message.setAttribute('aria-live', 'polite');
    const actions = element('div', 'lf-feed-update-actions');
    const check = element('button', 'menu_button', '检查插件更新');
    const prepare = element('button', 'menu_button', '下载新版');
    const refresh = element('button', 'menu_button', '刷新后使用新版');
    for (const button of [check, prepare, refresh]) { button.type = 'button'; actions.appendChild(button); }
    const label = element('label', 'lf-feed-update-auto');
    const auto = element('input'); auto.type = 'checkbox'; auto.checked = true;
    label.append(auto, element('span', '', '自动准备这个插件的更新，刷新后生效'));
    box.append(message, actions, label);
    panel.appendChild(box);
    updater?.close();
    updater = installExtensionUpdater(globalThis, {
        version: '2.1.0', moduleURL: import.meta.url,
        onChange(state) {
            if (!enabled || !box.isConnected) return;
            message.textContent = state.message + (state.latestVersion ? ' · v' + state.latestVersion : '');
            message.dataset.state = state.status;
            check.disabled = ['checking', 'downloading'].includes(state.status);
            prepare.hidden = !state.verified || !['available', 'failed', 'permission'].includes(state.status);
            prepare.disabled = state.status === 'permission';
            refresh.hidden = state.status !== 'staged';
            auto.checked = state.autoStage;
        },
    });
    check.addEventListener('click', () => void updater?.check());
    prepare.addEventListener('click', () => void updater?.prepare());
    refresh.addEventListener('click', () => globalThis.location.reload());
    auto.addEventListener('change', () => updater?.setAutoStage(auto.checked));
}

export function onEnable() {
    if (enabled) return;
    enabled = true;
    feed = installNativeFeed(globalThis);
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
    updater?.close(); updater = null;
    feed?.close(); feed = null;
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
