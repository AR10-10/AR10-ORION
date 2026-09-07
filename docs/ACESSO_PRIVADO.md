# ACESSO — histórico, estado atual, e a arquitetura de autenticação futura

Pedido original do Operador: *"eu quero o que eu uso só eu usar... tem uma
senha, como que nós faz pra deixar só pra mim acessar, e pra deixar outras
pessoa acessar só se eu autorizar."*

**Atualizado em 2026-09-07** — ordem direta do Operador: *"remover password
gate temporário e preparar autenticação correta"*. A cortina de senha
descrita neste documento desde 24/08 foi **removida do caminho crítico**
(ver §2). Este documento passa a registrar três coisas: o que aconteceu com
a tentativa anterior (§1), o estado real de hoje (§2), e o contrato de
arquitetura para quando a autenticação de verdade for construída (§3-§5) —
nunca uma segunda senha global.

---

## 1. Histórico — a tentativa de 24/08 (mantido, nunca reescrito)

Auditoria feita antes da primeira mudança, em 24/08:

| O que foi verificado | Resultado |
|---|---|
| Visibilidade do repositório | **`private: false` — PÚBLICO** |
| GitHub Pages | **ativo**, site público por URL |
| Senha do portão no código | hash SHA-256 era um literal no fonte |
| Senha em texto puro | **estava por extenso** no arquivo de teste, no repositório público |
| Forks | permitidos |

**Conclusão de então, ainda verdadeira:** o repositório esteve público, e a
senha nunca impediu nada de verdade. Qualquer pessoa podia ler a senha em
texto puro no arquivo de teste, rodar
`localStorage.setItem("ar10cyborg_access_unlocked","1")` no console para
entrar sem senha, ou clonar todo o código. O portão em JavaScript **nunca
teve como** resolver isso — num site estático ele só roda depois de o app
inteiro já ter sido entregue ao navegador.

A correção de 24/08 tirou a senha em texto puro do repositório (o hash
passou a vir de um secret de build, `VITE_ACCESS_HASH`) e desenhou um plano
de migração para Cloudflare Pages + Cloudflare Access (autenticação real, no
servidor). **Esse plano nunca foi executado** — os passos 3.1 a 3.5 da
versão anterior deste documento (tornar o repositório privado, desativar o
Pages, criar o projeto Cloudflare, cadastrar os três segredos, ligar o
Access) continuaram todos pendentes, e o GitHub Pages foi religado em 31/08
para o Operador conseguir usar o painel pela URL oficial.

**O que isso causou, medido:** o próprio `VITE_ACCESS_HASH` — a única coisa
que a correção de 24/08 pediu ao Operador — nunca foi cadastrado como secret
do repositório. O portão, fail-closed por desenho, passou a bloquear o
próprio deploy: 4 tentativas seguidas de publicar (PRs #17/#18/#19/#21,
07/09) falharam todas no mesmo passo, e nada chegou ao site público desde
24/08. Uma cortina que não protegia nada de verdade virou, na prática, o
único motivo de o painel nunca mostrar a evolução real do sistema.

---

## 2. Estado atual (2026-09-07) — gate removido, sem substituto global

Por ordem direta do Operador, a cortina de senha (`AccessGate`,
`ipad_runtime/ramber-ui/src/access-gate.tsx`) **saiu do caminho crítico**:

- `main.tsx` não monta mais `<AccessGate>` — o painel abre direto.
- `deploy-ipad-pwa.yml` não checa nem injeta `VITE_ACCESS_HASH` — nenhum
  secret é necessário para publicar.
- `tools/setup-local.mjs` e os 4 instaladores de clique duplo não pedem mais
  senha nenhuma.
- `access-gate.tsx`/`access-gate-crypto.ts` continuam no repositório (Zero
  Delete Rule) — a matemática de hash é reaproveitável quando a autenticação
  real (§3) for construída, mas nada os importa hoje.

**Isso NÃO é uma regressão de segurança real**, pelo motivo já documentado
em §1: o portão nunca foi uma trava de verdade (era JavaScript, contornável
por qualquer pessoa com DevTools). Removê-lo não aumenta a exposição real —
o painel é **READ_ONLY**, sem credencial de exchange, sem execução de
ordem, sem dado do Operador armazenado em servidor nenhum (tudo fica em
IndexedDB, no navegador de cada máquina). O que muda é que o painel volta a
ser publicável, e o Operador volta a ver a evolução real do sistema no link
oficial (`https://ar10-10.github.io/AR10-ORION/`).

O caminho **Cloudflare Pages + Cloudflare Access** (autenticação real, no
servidor, antes de qualquer byte do app sair) continua existindo como opção
— `deploy-cloudflare-pages.yml` está pronto, só sob demanda
(`workflow_dispatch`). Se o Operador quiser essa camada antes da
autenticação definitiva (§3) estar pronta, os passos são: tornar o
repositório privado, desativar o GitHub Pages, criar o projeto Cloudflare,
cadastrar `CLOUDFLARE_API_TOKEN`+`CLOUDFLARE_ACCOUNT_ID`, e ligar uma
política de Access com a lista de e-mails autorizados (`Zero Trust` →
`Access` → `Applications`). **Isso não é obrigatório nem é o passo seguinte
default** — é uma opção registrada, para o dia em que o Operador pedir.

---

## 3. Arquitetura de autenticação futura — o contrato, não a implementação

Esta seção define **somente a arquitetura**, por pedido explícito do
Operador ("não implementar um sistema complexo de login nesta ordem... a
aplicação de trading não deve ser responsável por inventar seu próprio
sistema criptográfico de autenticação"). Nada aqui é código ainda.

```
AUTHENTICATION
    ↓
IDENTITY
    ↓
SESSION
    ↓
AUTHORIZATION
    ↓
AR10 APPLICATION
```

- **AUTHENTICATION** — prova de quem a pessoa é (e-mail + senha, magic
  link, ou OAuth de um provedor de identidade consolidado). Nunca
  reimplementado do zero neste repositório.
- **IDENTITY** — o registro de que aquela pessoa existe e tem uma conta.
- **SESSION** — token/cookie de sessão, com expiração e logout reais,
  emitido pelo provedor de identidade escolhido, nunca fabricado aqui.
- **AUTHORIZATION** — o que aquela sessão pode fazer no AR10 (ver §4, papéis).
- **AR10 APPLICATION** — o painel em si, que só CONSOME o resultado das 4
  camadas acima. Nunca decide autenticação por conta própria.

A escolha do provedor/serviço de identidade concreto é decisão de uma ordem
futura própria, depois de avaliar junto: GitHub Pages (site estático, sem
backend) vs. um backend real; domínio; banco de sessão; custo; segurança;
comportamento de sessão no Safari/iPad (cookies de terceiro, PWA instalado);
escala (quantas pessoas realmente vão usar). Nada disso está decidido aqui.

---

## 4. Modelo de papéis (RBAC) — preparação conceitual, não implementação

| Papel | Acesso |
|---|---|
| **OPERATOR** | Acesso completo: painel inteiro, ferramentas avançadas, diagnóstico, Laboratório de Evolução, configuração operacional. O Operador principal deste projeto é sempre `OPERATOR`. |
| **ADMIN** | Administração de usuários, permissões, configurações globais. |
| **USER** | Acesso só aos módulos autorizados (a definir quando existir mais de um usuário real). |

Fluxo depois de a autenticação real existir:

```
LOGIN → SESSION → ROLE=OPERATOR → AR10 FULL ACCESS
```

**Regra de Ouro desta seção:** nenhuma permissão listada aqui é aplicada
hoje — não existe RBAC real no código ainda, e não se cria uma permissão
artificial só para "parecer pronta". Esta tabela é o contrato que uma ordem
futura de implementação segue, não uma feature já ligada.

---

## 5. O que a autenticação futura NUNCA vai controlar

Separação explícita, para nenhuma sessão futura confundir as duas coisas:

```
PUBLIC MARKET DATA → CONNECTORS → MARKET DATA BUS → ANALYSIS ENGINE → AR10
```

Autenticação controla **quem pode acessar a aplicação** — nunca **se os
dados públicos de mercado (Binance/MEXC) existem**. Os motores de análise, o
Core Engine, o Market Data Bus e todos os conectores continuam rodando
exatamente como hoje, independente de qualquer sistema de login. LEI 24 (o
Core Engine é o único emissor de LONG/SHORT/WAIT) e as Regras de Ouro
continuam valendo sem nenhuma exceção — autenticação é uma camada de acesso
à aplicação, nunca uma camada de decisão de mercado.

---

## 6. Estado da configuração (2026-09-07)

- [x] Cortina de senha (`AccessGate`) removida do caminho crítico de
      build/deploy/runtime
- [x] `deploy-ipad-pwa.yml` publica sem depender de nenhum secret
- [x] `access-gate.tsx`/`access-gate-crypto.ts` preservados (Zero Delete
      Rule) para reaproveitamento futuro, sem serem montados
- [x] Nenhuma senha global nova criada em lugar da antiga (Regra de Ouro
      desta ordem: nunca trocar uma senha global por outra)
- [ ] **Arquitetura de autenticação real** (§3-§4) — contrato definido,
      implementação ainda não iniciada, aguardando ordem específica
- [ ] Cloudflare Pages + Cloudflare Access — opção registrada (§2), não
      ativada, não é o próximo passo default
