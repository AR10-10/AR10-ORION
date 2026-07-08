// version.ts — Selo de Versão Semântica (Fase L, diretriz 3). FONTE ÚNICA
// da identidade do build: a UI exibe este selo (uma vez — regra de zero
// repetição), o service worker deriva o nome do cache dele (o cache DE
// CADA versão é fisicamente separado), e o teste de selo de produção
// trava a consistência com package.json. Mudou a versão => muda aqui e no
// package.json juntos, ou o CI para.
export const APP_VERSION = 'v15.0.0-GODTIER';
export const APP_SEAL = `AR10 CYBORG ${APP_VERSION}`;
