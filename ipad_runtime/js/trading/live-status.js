// live-status.js — Live Trading permanece LIVE_LOCKED nesta versão, por
// design e por estrutura (não por uma flag que poderia simplesmente ser
// virada). Este módulo só relata os motivos estruturais reais — nunca finge
// oferecer um "modo live" desativado por configuração.

export function getLiveStatus() {
    return {
        mode: 'LIVE',
        status: 'LIVE_LOCKED',
        reasons: [
            'Nenhuma função de order_send/execução existe neste runtime — ausência estrutural no código, não uma flag.',
            'Nenhum endpoint privado de exchange é alcançável — a Content-Security-Policy (connect-src) restringe a hosts públicos de leitura.',
            'Nenhuma API secret é lida, armazenada ou aceita por este PWA — não existe campo de credencial em nenhuma tela.',
            'Risk Gate, supervisão humana e Soldier Headless 24/7 (arquitetura Commander/Soldier) ainda não estão implementados como pré-requisito de qualquer execução real.',
        ],
        unlock_requires: [
            'Soldier Headless real, supervisionado, rodando fora do navegador.',
            'Risk Gate com kill switch testado e supervisão humana explícita.',
            'Cofre de credenciais fora do frontend (nunca em localStorage/IndexedDB do PWA).',
            'Aprovação explícita e documentada antes de qualquer primeira ordem real.',
        ],
        siriform_summary: 'Live Trading está bloqueado por estrutura, não por uma opção desligada — não existe nenhuma rota de código que envie ordem real neste runtime.',
    };
}
