# Domain Tunnel Layer (NOT_ACTIVE)

Codinome interno: `AR10_CYBORG_DOMAIN_TUNNEL_SCAFFOLD_V1`.

**Status: `NOT_ACTIVE`.** Subpasta de [`../`](../README.md) (o contrato
genérico Commander↔Soldier). Mesmas garantias do scaffold pai: sem
`package.json`, sem build, sem import por `ipad_runtime/`, sem presença em
`.github/workflows/deploy-ipad-pwa.yml`. Nenhum túnel está configurado,
ativo ou planejado para ativação automática.

## Por que isto existe

Hoje o iPad (Commander) fala diretamente com endpoints públicos fixos —
ver a CSP de `ipad_runtime/index.html`:

```
connect-src 'self' https://api.coingecko.com https://api.binance.com https://api.mexc.com;
```

Se um dia existir um Local Soldier real (ver `../README.md` e
`../windows/README.md`), o Commander precisaria alcançá-lo por algum
endereço estável — não necessariamente um IP doméstico variável. Um
"Domain Tunnel Layer" (Cloudflare Tunnel, Tailscale, ngrok ou um reverse
proxy próprio) é a forma usual de resolver isso sem expor a rede local
diretamente. Este scaffold registra o contrato dessa decisão agora, sem
escolher provedor, sem criar conta em nenhum serviço, sem ativar nada.

## Por que isto é arriscado o suficiente para nunca ser silencioso

Qualquer túnel real exige adicionar o domínio dele a `connect-src` da CSP
de `ipad_runtime/index.html`. Isso é, por definição, uma expansão da
superfície de rede que o PWA pode alcançar. `types.ts` modela essa decisão
como `DomainTunnelActivationProposal`, que amarra:

- a config do túnel (`TunnelConfig`, com `requires_explicit_csp_edit: true`
  e `requires_human_approval: true` fixos no tipo — não são opcionais);
- o `RiskGateConfig` já em vigor no Soldier (`../src/types.ts`), para que
  ativar túnel nunca seja decisão isolada da postura de risco geral;
- um campo `approved_by_human` que precisa ser `true` (com
  `approved_at` preenchido) antes de qualquer ativação real — hoje nenhum
  código produz essa aprovação porque nenhum código real existe.

## Conteúdo

```
domain-tunnel/
├── README.md   este arquivo
└── types.ts    TunnelProvider, TunnelStatus, TunnelConfig,
                 TunnelHealthCheck, DomainTunnelActivationProposal
```

## O que falta para isto deixar de ser scaffold (Tier 3 — não iniciado)

Em adição aos 5 itens já listados em [`../README.md`](../README.md):

1. Escolher o provedor de túnel de fato (`TunnelProvider` hoje é só enum,
   nenhum escolhido) — cada opção tem modelo de confiança e custo
   diferentes (ex.: Cloudflare Tunnel e Tailscale são gratuitos para uso
   pessoal; ngrok tem limites na camada gratuita).
2. Decidir e documentar explicitamente a edição de CSP necessária
   (`connect-src` de `ipad_runtime/index.html`) — esse diff precisa ser
   revisável isoladamente, nunca misturado com outra mudança.
3. Implementar a aprovação humana real (`approved_by_human` /
   `approved_at` de `DomainTunnelActivationProposal`) — hoje é só forma,
   nenhum fluxo de aprovação existe.
4. Implementar o health check real (`TunnelHealthCheck`) — hoje é só
   forma, nenhuma checagem ocorre.
5. Todos os pré-requisitos de transporte/autenticação do Sync Bridge já
   listados no README pai — um túnel resolve alcançabilidade de rede, não
   autenticação nem autorização do que passa por ele.

Nenhum destes itens está implementado. Nenhum domínio, túnel ou alteração
de CSP existe neste código.
