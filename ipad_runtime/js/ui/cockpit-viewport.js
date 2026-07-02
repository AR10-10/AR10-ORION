// cockpit-viewport.js — mede em runtime a altura real de .app-topbar +
// .sw-update-banner (quando visivel) + o padding-top de .runtime-shell, e
// publica o resultado como --cockpit-top em :root. .cockpit-viewport (CSS)
// usa essa variavel para caber em exatamente 100dvh, sem rolagem de pagina
// — nunca um valor estatico chutado, sempre a medida real deste boot/
// orientacao/breakpoint. Fallback CSS de 96px so' cobre o instante antes
// desta 1a medicao rodar.

const FALLBACK_TOP_PX = 96;

function measure() {
    const topbar = document.getElementById('app-topbar');
    const banner = document.getElementById('sw-update-banner');
    const tabs = document.getElementById('app-tabs');
    let top = 0;
    if (topbar) top += topbar.getBoundingClientRect().height;
    if (banner && !banner.hidden) top += banner.getBoundingClientRect().height;
    if (tabs) top += tabs.getBoundingClientRect().height;
    return top > 0 ? top : FALLBACK_TOP_PX;
}

export function recalcCockpitTop() {
    const top = measure();
    document.documentElement.style.setProperty('--cockpit-top', `${Math.round(top)}px`);
}

let observer = null;

export function initCockpitViewport() {
    recalcCockpitTop();
    const topbar = document.getElementById('app-topbar');
    const banner = document.getElementById('sw-update-banner');
    const tabs = document.getElementById('app-tabs');
    if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => recalcCockpitTop());
        if (topbar) observer.observe(topbar);
        if (banner) observer.observe(banner);
        if (tabs) observer.observe(tabs);
    }
    window.addEventListener('resize', recalcCockpitTop);
    window.addEventListener('orientationchange', recalcCockpitTop);
}
