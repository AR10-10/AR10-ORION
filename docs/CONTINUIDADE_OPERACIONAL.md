# AR10 CYBORG — Continuidade Operacional

**Gerado em**: 2026-09-06 · **Branch**: `claude/localizar-arquivo-nuvem-qr0z6x` ·
**PR aberta**: [#17](https://github.com/AR10-10/AR10-ORION/pull/17) (draft, CI verde) ·
**Pedido de origem**: Operador — "faz saneamento, vê se está tudo em ordem, me dá
um arquivo MD pra eu levar e continuar certinho".

## O que este documento É e o que ele NÃO É

- **NÃO é** o `docs/MAPA_EVOLUCAO_CIBORGUE.md` — aquele é uma fotografia
  completa de TODO subsistema (IMPLEMENTADO/PARCIAL/AUSENTE), feita pra
  responder "o que existe neste repositório". Está desatualizado desde
  2026-09-01 (5+ dias de commits picaram depois) — **precisa de um
  refresh próprio**, fora do escopo deste documento.
- **NÃO substitui** `CLAUDE.md` (as regras permanentes) nem
  `docs/SYSTEM_HANDBOOK.md` (o histórico completo, cronológico, de cada
  rodada real). Este documento só RESUME e aponta pra eles — nunca
  duplica o texto.
- **É** um briefing de continuidade: onde o trabalho está agora, o que
  falta, e a ordem/disciplina correta pra continuar sem duplicar nem
  quebrar nada — pensado pra ser lido no início de uma sessão nova
  (Claude Code ou o próprio Operador).
- Como qualquer fotografia, **este documento envelhece**. Se você está
  lendo isto depois de vários commits novos, confira `git log --oneline`
  na branch acima antes de confiar cegamente nele.

---

## 1. Estado real agora (saneamento confirmado 2026-09-06)

- `npm run verify` (tsc + suíte inteira + build) — **verde**: 266
  arquivos de teste, 4548 testes, build de produção ok.
- Varredura de resíduos (Math.random em fluxo real, catch vazio,
  @ts-ignore, teste pulado, credencial esquecida, processo órfão) —
  **zero achado**.
- Live-testing via Playwright (dev server real, hash de acesso temporário
  nunca commitado) — boot limpo, zero `pageerror`, todo widget em estado
  honesto (AWAITING/DADOS INSUFICIENTES — nunca fabricado), exatamente o
  esperado neste sandbox de rede zero-egress.
- PR #17 aberta contra `main`, CI verde, `mergeable_state: clean`, zero
  comentário de review pendente.

## 2. O que foi entregue nesta trilha (mais recente primeiro)

| Entrega | Onde | Resultado |
|---|---|---|
| **A2.1 — Microstructure Event Engine** (escopo "consolidar sob 1 contrato tipado", confirmado pelo Operador) | `nexus/microstructure-snapshot.ts` (novo) | Organiza `signal-engine.js`/`trap-detection.ts`/`order-book-depth.ts` sob um `MicrostructureSnapshot` tipado, com qualidade real por fonte. Zero motor novo. Ligado à store (`unified-snapshot-store.ts` §3) e a `App.tsx`. |
| **A1 — Visual Foundation, fechamento** | `chart-ultrawide-scale.ts` (respiro adaptativo), `nexus/fps-monitor.ts` (novo, instrumentação real de FPS) | Breathing room reage à carga real do Trade Plan. Painel de Performance real, Laboratory-only (toggle explícito — `import.meta.env.DEV` provou não ser confiável neste tipo de ambiente). |
| **A1 — Auditoria completa** | (sem código — mapeamento) | Confirmou que trace roxo/seta de direção/anti-colisão/density tiers/z-order já estavam corretos, construídos em rodadas anteriores. |
| **Fim do winner-take-all (harmônicos)** | `HarmonicGeometryPlugin.tsx` | Mostra TODOS os padrões harmônicos qualificados simultaneamente (antes só o de maior fitScore), com indicador visual quando um nível está fora da faixa de preço visível. |
| **Graduação `compare-runs.js`** | `backtest-presentation.ts`, `App.tsx` (BacktestPanel) | Comparação de 2 backtests sai do Laboratório de Evolução. Achado ao vivo: botão "MEDIR" nunca funcionava (bug de símbolo pré-existente, corrigido). |

Detalhe completo de cada uma (checklist Ω-INFINITY: problema/análise/solução/
impacto/riscos/testes) está nas mensagens de commit da branch acima — não
duplicado aqui.

## 3. As 2 lacunas reais conhecidas (não fabricadas, documentadas)

1. **Sem livro de ofertas incremental.** Este projeto só tem
   `depth10@100ms` (Binance, snapshot periódico de 10 níveis) — nunca um
   stream DIFF com sequence/update ID. Por isso: `INVALID_SEQUENCE` /
   `RECONCILIATION_REQUIRED` nunca aparecem como estado possível em
   `MicrostructureDataQuality`, e um detector real de REPLENISHMENT
   (Ordem A2.1 §8) não foi construído — exigiria inventar matemática
   sobre dado grosso demais.
2. **Evidence Graph e Five Pillars não existem como código real** — só
   citados em `SYSTEM_HANDBOOK.md`/comentários (`trade-plan-view.ts`).
   `microstructure-snapshot.ts` já prepara o dado pronto pra quando esses
   sistemas existirem; não os constrói.

## 4. O que vem a seguir — e o que NÃO fazer sem autorização

O Operador definiu 4 fases pra Market Intelligence Next-Gen:

- **A2.1 — Microstructure Event Engine** → ✅ entregue (com os 2 gaps acima).
- **A2.2 — Cross-Venue Intelligence** → **aguardando autorização explícita**.
- **A2.3 — Advanced Order Flow** → aguardando A2.2.
- **A2.4 — Regime Transition** → aguardando A2.3.

**Regra explícita da própria Ordem A2.1 (§ final): "não iniciar A2.2, A2.3
ou A2.4 sem nova autorização."** Uma sessão nova não deve assumir que
"continuar o trabalho" significa começar A2.2 sozinha — isso exige o
Operador pedir de novo, explicitamente.

## 5. A disciplina correta pra continuar (resumo — texto completo em `CLAUDE.md`)

Toda sessão nova que for mexer neste repositório deve, nesta ordem:

1. **Ler `CLAUDE.md` inteiro primeiro** — ele é carregado automaticamente
   pelo Claude Code, mas se você é um humano lendo isto, leia-o também.
   As restrições ali (READ_ONLY/FAIL_CLOSED, LEI 24, as 8 Regras de Ouro)
   são inegociáveis, valem em qualquer sessão.
2. **Auditar antes de construir.** Antes de escrever um motor/feature
   novo, procurar se já existe algo real e reaproveitável — `grep`/leitura
   direta do código, nunca supor. A trilha A2.1 inteira existe porque essa
   auditoria encontrou 4 sistemas já reais fazendo a maior parte do que
   uma Ordem nova pedia.
3. **Nunca fabricar dado.** Sem dado real suficiente, a resposta honesta é
   `DADOS_INSUFICIENTES`/`null` — nunca um número calculado a partir de
   uma suposição.
4. **Verificar antes de considerar pronto**: `npm run verify` de dentro de
   `ipad_runtime/ramber-ui/` — tsc, suíte inteira, build, nessa ordem,
   parando no primeiro erro. Pra mudança visual, somar Playwright real
   (dev server + hash de acesso temporário, nunca commitado).
5. **O commit é o relatório.** Checklist real (problema/análise/solução/
   impacto/riscos/testes) na mensagem de commit — não criar um novo
   `RELATORIO_*.md` por sessão.
6. **Documentar sinceramente o que ficou pendente**, nunca forçar uma
   versão apressada ou fabricada só pra "fechar" uma Ordem.

## 6. Mapa rápido de onde as coisas vivem

- `ipad_runtime/ramber-ui/src/App.tsx` — o componente raiz (~13 mil
  linhas) — praticamente todo estado real do painel principal nasce aqui.
- `ipad_runtime/ramber-ui/src/store/unified-snapshot-store.ts` — o
  Global Snapshot real (Zustand+Immer), organizado por domínio (§1
  Mercado … §5 Organismo). Todo campo novo entra em EXATAMENTE 4 lugares
  (estado → ação → default → seletor) — nunca menos.
- `ipad_runtime/ramber-ui/src/nexus/` — a maior parte da lógica de
  domínio pura (TypeScript): trade plan, trap detection, order book
  depth, microstructure snapshot, fps monitor, etc.
- `ipad_runtime/src/orderflow/` — motor de order flow em JS puro
  (signal-engine.js). **Só recebe extensões aditivas** — nunca vira um
  arquivo monolítico de novo (regra permanente do `CLAUDE.md`).
- `ipad_runtime/src/research/engines/` + `QUARANTINE.md` — Laboratório de
  Evolução: motores puros isolados até serem "graduados" (ligados ao
  sistema ao vivo via `engine-bridge.ts`).
- `ipad_runtime/ramber-ui/src/chart/` — os ~30 overlays do gráfico
  (canvas próprio cada um, dirty-flag + rAF, mesma arquitetura sempre).
- `ipad_runtime/ramber-ui/tests/` — `vitest`, 266 arquivos. Convenção
  mista: lógica pura ganha teste de execução real; fiação entre módulos
  ganha teste de padrão no código-fonte (`readFileSync` + regex).
- `docs/SYSTEM_HANDBOOK.md` — histórico completo cronológico (nunca
  reescrito, só cresce). `docs/historico/INDICE.md` — registros de
  sessões já concluídas.

## 7. Como rodar/verificar localmente

```bash
cd ipad_runtime/ramber-ui
npm run verify          # tsc --noEmit && vitest run && vite build
npm run dev              # dev server real — precisa de VITE_ACCESS_HASH
                          # (ver docs/ACESSO_PRIVADO.md pro comando exato
                          # de gerar um hash temporário, nunca committado)
```

## 8. Pergunta em aberto pro Operador (não resolvida ainda)

O Operador pediu, na mesma mensagem que gerou este documento, que "o
sistema seja inteligente" o bastante pra perceber sozinho quando não está
recebendo dado real, e que — rodando de verdade no Safari — ele
"automaticamente" faça verificações e se atualize. Isso pode significar
pelo menos 3 coisas bem diferentes de construir:

1. Um indicador mais visível de "sem dado real há X segundos" (extensão
   do que `nexus/health-monitor.ts`/`isDataFresh` já calculam hoje, só
   não aparece com destaque).
2. Reconexão automática mais agressiva quando a WebSocket cai (lógica
   nova de retry, hoje o app já reconecta mas não foi medido se é rápido
   o bastante).
3. Um ciclo de auto-diagnóstico periódico (não só sob demanda) usando
   `nexus/self-diagnostics.ts`, que hoje só roda quando pedido.

As três são tecnicamente possíveis e nenhuma fabrica dado nem quebra
LEI 24 — mas são features BEM diferentes em tamanho e risco. Antes de
qualquer uma virar código, uma sessão futura deveria confirmar com o
Operador qual dessas (ou outra coisa) ele quer de verdade.
