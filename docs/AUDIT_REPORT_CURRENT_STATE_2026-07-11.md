# AR10-CYBORG — Relatório de Estado Atual do Sistema (para Auditoria Externa)

**Data:** 11 de Julho de 2026
**Autor:** Agente 4 (Engenheiro de Software Principal / Executor)
**Repositório:** `ar10-10/ar10-orion` · **Branch de trabalho:** `claude/eloquent-cannon-qyt86y` · **Pull Request aberto:** #11 (draft, CI "deploy" verde no head `5360895`)
**Propósito:** fotografia honesta e verificável do sistema no estado atual, para uso em auditoria externa. Toda afirmação abaixo é lastreada por evidência concreta (arquivo, teste, número de execução) — nenhuma alegação de marketing.

---

## 1. Sumário executivo

O AR10-CYBORG é um terminal institucional de análise de mercado (cripto, com registro estendido para outras classes de ativo) que opera em modo **exclusivamente de leitura**: coleta dados reais de exchanges públicas, computa análise quantitativa e multi-agente sobre esse dado, e apresenta o resultado em uma interface institucional. **Não existe, em nenhum caminho de código ativo, execução real de ordens** — a funcionalidade de trading ao vivo está deliberadamente bloqueada (ver Seção 7).

O sistema evoluiu por fases numeradas e documentadas (V10 → V18 → "Blueprint V-MAX" Fases 0/1/2 → consolidação do "Organismo"). Na fase mais recente, a arquitetura foi consolidada em torno de um objeto de estado único (`UnifiedGlobalSnapshot`) e uma camada de orquestração central (Nexus Core + Typed Event Bus + Organism Orchestrator) que impõe três regras de circulação de dado: leitura exclusiva via snapshot, publicação exclusiva via eventos tipados, zero comunicação direta entre motores de análise.

**Estado de verificação no momento deste relatório:**
- Suíte de testes automatizados: **708/708 passando** (46 arquivos de teste, TypeScript/Vitest)
- Testes nativos do núcleo quantitativo em Rust/WASM: **11/11 passando** (`cargo test`)
- Checagem de tipos estrita (`tsc --noEmit`): limpa, zero erros
- Build de produção: bem-sucedido
- CI (GitHub Actions, job "deploy") no head atual do PR #11: **sucesso**

---

## 2. Arquitetura — o Organismo

### 2.1 Objeto de fusão único (`UnifiedGlobalSnapshot`)

`src/store/unified-snapshot-store.ts` — Zustand + Immer. Todo dado real do sistema converge para cá, organizado por domínio (mesma ordem em estado → ações → seletores):

| Domínio | Conteúdo | Origem real |
|---|---|---|
| §1 MERCADO | símbolo ativo, timeframe, preço, livro de ofertas, derivativos, candles, conexões por exchange | WebSocket Binance Futures (preço/livro/candles), REST (funding rate/open interest) |
| §2 SÉRIES HISTÓRICAS | histórico L2 (profundidade), histórico de order flow (CVD + trades grandes) | amostragem em ring buffer sobre o dado real acima + poller MEXC |
| §3 MOTORES QUANT | Volume Profile (WASM), Matriz de Confluência Fibonacci | computados em Rust/WASM sobre candles reais |
| §4 CÉREBRO | decisão do Conselho Multi-Agente, projeção de Cenários A/B, sinais de armadilha institucional | motores puros TypeScript sobre os domínios acima |
| §5 ORGANISMO | estado do motor de decisão, saúde do sistema (FPS/memória/latência/workers), TrustScore da fonte de dados, memória afetiva + CPI | Health Monitor + WASM |

### 2.2 Camada central de orquestração ("sistema nervoso")

Consolidada nesta sessão (`docs/ORGANISM_DATA_FLOW.md` é a referência técnica completa). Três componentes:

- **Nexus Core** (`nexus/nexus-core.ts`) — ciclo de vida único (start/pause/resume/stop) e a única instância real do Event Bus.
- **Typed Event Bus** (`nexus/event-bus.ts`) — 14 tipos de evento tipados; cada tipo tem exatamente um publicador real (nunca dois emissores para o mesmo evento); um assinante com exceção nunca derruba os demais.
- **Organism Orchestrator** (`nexus/organism-orchestrator.ts`, novo) — assina o snapshot uma única vez e traduz cada escrita real de fatia em um evento no bus, com o payload sendo a própria referência escrita (zero cópia). Expõe `getSnapshotForEngine()`: leitura versionada (`contractVersion`, contador `seq` de geração) que qualquer motor — presente ou futuro — usa para ler o organismo, nunca por acesso direto a outro motor.

**Regra estrutural verificada por teste:** motores nunca se comunicam entre si diretamente. O único ponto onde isso acontecia (o Conselho entregava sua decisão diretamente ao Motor de Cenários na mesma função) foi eliminado nesta sessão — o Conselho escreve no snapshot, o Motor de Cenários lê do snapshot.

### 2.3 Motores de análise ativos

| Motor | Função | Onde roda |
|---|---|---|
| Conselho Multi-Agente | 6 agentes votantes (Liquidez, Estrutura, Order Flow, Risco, Manipulação, Fibonacci) + Meta-Agent agregador | Main thread (TypeScript puro) |
| Motor de Cenários (Path A/B) | projeção de dois caminhos de preço ponderados pela massa de opinião real do Conselho — nunca probabilidade de mercado | Main thread |
| Detecção de Armadilhas Institucionais | corroboração de sweeps de liquidez + sinais reais de absorção/exaustão | Main thread |
| Memória Afetiva + CPI | reward/pain com decaimento exponencial sobre transições operacionais reais (WS caiu/subiu, ciclo ok/erro, dados frescos/obsoletos) | Main thread (decaimento lazy, sem tick periódico) |
| Volume Profile | histograma de volume por preço (POC/HVN/LVN) | WASM (Rust), dentro de Worker dedicado |
| Matriz de Confluência Fibonacci | retração da última perna confirmada cruzada contra S/R, zonas SMC e POC/HVN | Main thread |
| TrustScore | regularidade de cadência de chegada de preço + convergência cross-exchange (Binance × Bybit/OKX) | WASM (Rust), dentro de Worker dedicado |
| Volume Profile / Order Flow heatmap | renderização de densidade L2 + CVD | OffscreenCanvas em Worker dedicado (com fallback main-thread) |

---

## 3. Fluxo de dados (visão de auditoria)

```
ENTRADA (único coletor real: App.tsx)
  WebSocket preço/livro (Binance Futures) · REST funding/OI · REST trades (MEXC)
  cross-checks pontuais Bybit/OKX
        ↓
MOTORES (Rust/WASM em Worker + TypeScript puro em main thread)
        ↓  cada motor ESCREVE sua própria fatia
UnifiedGlobalSnapshot (§1–§5)
        ↓  Organism Orchestrator traduz escrita → evento
Typed Event Bus (publicador único por tipo de evento)
        ↓
UI / HUD / NucleoVoiceOrb (consumidores via seletores atômicos)
```

Documentação técnica completa, com catálogo de eventos e receita de extensão aditiva: `docs/ORGANISM_DATA_FLOW.md`.

---

## 4. Princípios de governança e evidência de conformidade

| Princípio | Como é imposto | Evidência |
|---|---|---|
| **Fail-Closed** | Dado ausente/degradado nunca é preenchido — vira `null`, lista vazia, ou estado `ABSTAIN`/`pending` explícito | Conselho aborta (`riskGated`) quando offline/dados obsoletos/motor em erro; TrustScore devolve `NaN`→`null` sem amostra suficiente |
| **Zero Mocks** | Nenhum `Math.random()` ou dado de exemplo no caminho de mercado | Travado por teste em cada motor novo (grep de `Math.random` nos testes de VolumeProfilePlugin, heatmap, etc.) |
| **Main Thread sagrada** | Computação pesada (histograma de Volume Profile, TrustScore, redesenho do heatmap) roda em Web Workers/WASM | `ipad_runtime/workers/quant-worker.js`, `orderflow-heatmap-worker.ts` |
| **"Fio de Seda"** | Toda linha de marcação em gráfico é sólida, 1px — hierarquia visual só por cor/opacidade, nunca tracejado | Travado por teste em todos os plugins de chart (`lineWidth = 1`, ausência de `setLineDash`) |
| **Local-First** | Persistência via IndexedDB, sem dependência de backend próprio | `nexus/persistence.ts` |
| **Evolução aditiva** | Módulo novo nunca modifica o código de um módulo existente | Verificável pelo histórico de commits desta sessão: toda extensão foi arquivo novo ou adição a uma união de tipos |

---

## 5. Limitações e reduções de escopo declaradas (honestidade, não marketing)

- **Footprint tick-a-tick**: não construído. Os candles do gráfico são Binance Futures; o único stream de trades individuais reais é MEXC Spot — mercado diferente. Construir um footprint cruzando os dois seria fabricar granularidade inexistente (violaria Zero Mocks). O que existe de real (trades grandes reais por percentil, CVD real) está exposto.
- **`Exchange` tipado hoje cobre `BINANCE | BYBIT | OKX`** — MEXC alimenta apenas o poller de trades/order-flow, fora da união tipada de exchanges do Nexus. É a lacuna concreta por trás da dependência pesada de Binance Futures percebida pelo Operador (ver Seção 7).
- **Cenários A/B são massa de opinião, não probabilidade**: não existe ainda track record persistido de acerto — o rótulo `COUNCIL_OPINION_MASS_NOT_MARKET_PROBABILITY` é deliberado e travado por teste.
- **Latência ponta-a-ponta (WS → barra superior → gráfico) ainda não foi medida/perfilada formalmente** nesta sessão — reconhecido como item aberto (ver Seção 7).
- **Idioma**: comentários de código, documentação e parte da UI estão em português. Levantamento nesta auditoria: **58 arquivos-fonte** em `ipad_runtime/ramber-ui/src/` contêm comentários em português (contagem por acentuação; não inclui strings de UI nem os demais diretórios do `ipad_runtime`). Migração para inglês é item aberto (Seção 7).
- **CrossExchangeService** (`nexus/cross-exchange-service.ts`) existe, com reconexão/heartbeat/modo degradado reais, mas está deliberadamente dormente desde a Fase 0.6 — decisão registrada, não esquecimento.

---

## 6. Bloqueio permanente (por desenho, não por limitação técnica)

**Execução real de ordens (long/short ao vivo) está bloqueada de propósito.** Nenhuma chave de API de negociação, segredo de exchange ou caminho de envio de ordem existe no código ativo. Este é um limite operacional permanente do projeto, não um item de backlog.

---

## 7. Itens em aberto / próximos passos identificados

Nesta data, o Operador emitiu uma nova diretriz ("Ordem para o Executor — Agente 4") cobrindo, em resumo:

1. Camada de ingestão multi-fonte fortalecida, priorizando **MEXC**, Binance Futures e fontes adicionais já presentes na base de código.
2. Sincronização em tempo real garantida entre barra de preço, gráfico e motores (mesma leitura do `UnifiedGlobalSnapshot` no mesmo instante).
3. Auditoria e remoção de camadas legadas/redundantes.
4. Conexão de módulos secundários (Alertas, Scanner, Riscos, Análises, Mercados, Notificações) a dados reais.
5. Documentação em inglês do novo fluxo multi-fonte.
6. Migração completa do sistema para inglês (UI, comentários, nomes, documentação).

Investigação preliminar já realizada para embasar o plano de execução (números desta seção):
- União `Exchange` restrita a `BINANCE | BYBIT | OKX`: confirma a lacuna estrutural de MEXC como fonte de primeira classe.
- 11 arquivos contêm estados de placeholder tipo "aguardando" (`AGUARDANDO`/variantes) — candidatos a "módulo secundário sem dado real".
- 58 arquivos-fonte com comentários em português em `ramber-ui/src/` — dimensiona o esforço mecânico da migração de idioma.
- Um termo citado na diretriz ("BGC") não tem nenhuma ocorrência no repositório — carece de esclarecimento antes de qualquer implementação (evita fabricar um conector inexistente).

Este é um programa de trabalho de múltiplas frentes, algumas com risco arquitetural real (remoção de camadas legadas exige investigação item a item antes de deletar; nova ingestão multi-exchange é mudança estrutural). O plano de execução faseado está sendo definido em conversa com o Operador no momento deste relatório.

---

## 8. Rastreabilidade

- Pull Request ativo: **#11** — `ar10-10/ar10-orion`, branch `claude/eloquent-cannon-qyt86y`
- Commits mais recentes: `3698647` (reorganização do snapshot por domínio), `5360895` (Organism Orchestrator + Event Bus estendido)
- Documentação técnica complementar: `docs/ORGANISM_DATA_FLOW.md` (fluxo de dados), `docs/VMAX_FASE0_AUDIT_REPORT.md` e `docs/VMAX_FASE1_AUDIT_REPORT.md` (histórico de fases anteriores)
- Suíte de testes: `ipad_runtime/ramber-ui/tests/` (46 arquivos, 708 casos)
