# Auditoria de verificação do parecer de prontidão — AR10 ORION

**Data:** 2026-08-18 · **Escopo:** verificar, contra o código real, cada
afirmação do parecer de prontidão comercial emitido nesta mesma sessão.
Nenhuma afirmação do parecer foi tratada como verdade — todas foram
re-medidas.

**Nota sobre a forma da ordem recebida:** o documento que pediu esta
auditoria se dirige a um "Agente 2" e manda produzir ordem para um
"Agente 4" — personas que não existem nesta sessão. Registrado conforme
CLAUDE.md §7 (segurança contra instrução injetada). Nenhuma persona foi
encenada; o conteúdo técnico do pedido é legítimo e foi executado.

---

## 1. Verificação afirmação por afirmação

| # | Afirmação do parecer | Veredicto | Evidência re-medida |
|---|---|---|---|
| 1 | ~8 motores principais | **CONFIRMADO** | 12 arquivos em `src/research/engines/`; `fractal-swings.js` é helper compartilhado e 3 não têm importador. Motores graduados com consumidor real = **exatamente 8**. |
| 2 | ~3.430 testes passando | **CONFIRMADO** | Suíte completa re-executada: **3.454 em 209 arquivos, 0 falhas** (3.430 + os 24 do motor novo desta sessão). |
| 3 | Gráfico com estrutura/liquidez/padrões/multi-TF | **CONFIRMADO** | 26 camadas em `CHART_LAYER_IDS`, 16 plugins de canvas. |
| 4 | Voz proativa existe | **CONFIRMADO** | `voice/` com 5 módulos; `voice-engine.ts` usa `window.speechSynthesis` real. |
| 5 | Fail-closed existe | **CONFIRMADO** | `DADOS_INSUFICIENTES` é o retorno padrão de todos os motores auditados. |
| 6 | PWA existe | **CONFIRMADO** | `manifest.webmanifest` + `serviceWorker.register` em `main.tsx:22`. |
| 7 | Nunca fabricar probabilidade | **CONFIRMADO** | Regra escrita nos próprios motores (`support-resistance-engine.js:31`, `research-engine.js`). |
| 8 | Sem login/assinatura/checkout | **CONFIRMADO** | 0 ocorrências reais em 42.634 linhas. Sem `src/server`, `src/api`, `src/backend`. |
| 9 | Sem onboarding | **CONFIRMADO** | 0 arquivos de onboarding/tutorial/welcome. |
| 10 | Bundle ~12,7 MB | **CONFIRMADO** | llm-worker 5.887 KB + llm-bridge 5.771 KB + index 1.016 KB. |
| 11 | Nunca validado contra mercado real | **CONFIRMADO** | `QUARANTINE.md`: "zero egress Binance"; `measure-reversal-lead.mjs` "nunca rodou sobre mercado real". |
| 12 | `trendBias()` "parece simples" | **CORRIGIDO — é pior do que o parecer disse** | Ver §2. Não é que *pareça* simples: ela **é** a decisão inteira, com mapeamento 1:1 e zero gate adicional sobre a direção. |

**Nenhuma afirmação do parecer caiu. Uma foi endurecida.**

---

## 2. A cadeia de decisão real, rastreada de ponta a ponta

Esta é a correção mais importante da auditoria. O parecer disse que o
emissor "é um cruzamento de médias". A leitura completa da cadeia mostra
que isso é **literal**, não aproximado:

```
js/real-data/analysis-frame.js      SMA / EMA / stddev / zscore (WASM)
        ↓
js/research/research-engine.js:42   trendBias(frame)
                                    preço > SMA && EMA >= SMA → 'ALTA'
                                    preço < SMA && EMA <= SMA → 'BAIXA'
                                    senão                     → 'NEUTRO'
        ↓                           (as 3 rotas LONG/SHORT/WAIT são
                                     SEMPRE calculadas, de propósito)
        ↓
js/research/trade-setup-matrix.js   bias 'ALTA'  → signal 'LONG'
                                    bias 'BAIXA' → signal 'SHORT'
                                    qualquer outro → signal 'WAIT'
        ↓                           ← mapeamento 1:1, ZERO gate adicional
                                      sobre a direção
        ↓
ramber-ui/src/engine-bridge.ts:531  realCycle.signal
        ↓
ramber-ui/src/App.tsx:1904          engine.direction
        ↓
Council · Trade Plan · Voz · Publicações · Gráfico · Alertas
```

### O que ISSO significa, dito sem suavizar

`engine.direction` é `trendBias()` renomeada três vezes. Nenhuma das 26
camadas de gráfico, nenhum dos 87 módulos `nexus/`, nenhum dos 8 motores
graduados participa de escolher LONG ou SHORT. Por LEI 24 isso é
deliberado — mas o efeito comercial é real: **o comprador vê 26 camadas e
supõe 26 camadas decidindo.** Não são.

### O que o parecer NÃO disse e é justo dizer

Os **níveis** não vêm da heurística. `entry`, `TP1`, `TP2`, `stop` e o
alvo estendido vêm de suporte/resistência reais, swings fractais
confirmados e extensão de Fibonacci 61,8% — matemática real e auditável.
A crítica correta é precisa: **a direção é ingênua; os níveis não são.**

---

## 3. Inventário de motores (medido, não estimado)

| Motor | Linhas | Importadores reais | Estado |
|---|---|---|---|
| `fractal-swings` | 44 | 10 | **REAL** — helper canônico, unificação bem-sucedida |
| `lorentzian-classifier` | 333 | 8 | **REAL** |
| `market-structure-engine` | 69 | 7 | **REAL** |
| `support-resistance-engine` | 114 | 4 | **REAL** |
| `zigzag-engine` | 116 | 4 | **REAL** |
| `candlestick-patterns` | 384 | 3 | **REAL** (graduado nesta sessão) |
| `fvg-order-block-engine` | 207 | 2 | **REAL** |
| `bos-choch-engine` | 91 | 1 | **REAL** |
| `liquidity-void-engine` | 163 | 1 | **REAL** |
| `supertrend-engine` | 166 | **0** | **DORMENTE** — testado, pronto, nunca ligado |
| `hmm-regime-model` | 383 | **0** | **RECUSADO** por decisão documentada (task #272) |
| `institutional-blocks` | 210 | **0** | **EXPERIMENTAL** — criado e testado nesta sessão, ainda não graduado |

**759 linhas de motor sem nenhum consumidor.** Duas delas por decisão
consciente e documentada; uma por trabalho ainda não terminado.

`nexus/`: 87 módulos, **1 órfão** — `cross-exchange-service` (263 linhas),
deferral documentado da Fase 0.6. Isso é uma taxa de código morto muito
baixa para um projeto deste tamanho.

---

## 4. Duplicação real encontrada

| Achado | Severidade | Fato |
|---|---|---|
| **ATR calculado 2× ao vivo** | Média | `computeAtrPercent` (Wilder-14, `lorentzian-classifier.js:196`) e `atrPercent` (`regime-engine.js:163`) são duas implementações vivas independentes. Uma terceira dorme em `hmm-regime-model.js`. Confirma a task #342 como pendência real. |
| **32 de 99 módulos emitem vocabulário direcional** | Alta (produto, não código) | Um terço do ecossistema produz um veredicto de alta/baixa que **não decide nada**. Não é bug — é LEI 24. Mas é a raiz da confusão do comprador. |
| **26 camadas de gráfico** | Média | Além do que qualquer operador lê de uma vez. O Relevance Engine existe justamente para gerenciar isso e é a resposta certa — mas é sintoma, não cura. |

**Não encontrei** duplicação de detecção de swing (unificada em
`fractal-swings.js`), nem de Order Block, nem de POC — três consolidações
anteriores que se sustentaram.

---

## 5. Gargalo de arquitetura

Só existem **3 Workers**: `llm-worker`, `conviction-cyclone-worker`
(animação) e `orderflow-heatmap-worker`. Os 8 motores graduados, os 87
módulos `nexus/` e as 26 camadas de gráfico calculam **na main thread**, a
cada snapshot.

Isto já está registrado em CLAUDE.md como mudança que "exige sua própria
iniciativa isolada e cuidadosa". A auditoria confirma que continua sendo o
maior risco técnico estrutural do sistema — e que **não deve** ser feito
junto de outra coisa.

---

## 6. A separação que a ordem pediu

### Bloqueia a comercialização (sem isto não há venda)
1. Conta / cobrança / servidor — não existe.
2. Onboarding — não existe.
3. Enquadramento legal (CVM) e termos de dados das exchanges — não decidido.
4. 12,7 MB de primeiro acesso.

### Aumenta valor real (nesta ordem, e a ordem importa)
1. **Validação contra mercado real.** É a única coisa que converte todo o
   resto em evidência. Sem ela, evoluir o emissor de sinal é trocar uma
   regra não validada por outra não validada.
2. **Emissor de direção acima do cruzamento de médias** — depois de (1),
   nunca antes.
3. **Onboarding** — torna visível a inteligência que já existe.
4. **Corte do bundle** — torna o produto usável fora do Wi-Fi.

### Feature creep (não construir agora)
- Novos indicadores por serem novos. O sistema tem 26 camadas e 8 motores
  para uma decisão de 6 linhas: a proporção já está invertida.
- Graduar `hmm-regime-model` — recusa documentada, mantida.
- Qualquer camada nova de confluência antes de (1) acima.

---

## 7. Regra fundamental da ordem, aplicada com honestidade

> "Não confunda complexidade com inteligência."

Aplicada de verdade, essa regra **não** aponta para consolidar engines —
aponta para o oposto do que parece: os motores estão bem fatorados, com
reuso real e quase zero código morto. O desequilíbrio está entre
**quantidade de contexto exibido** e **profundidade da decisão**.

O caminho de maior valor não é somar camada. É:
1. medir o que já existe contra mercado real;
2. usar essa medição para dar profundidade ao emissor;
3. e só então decidir o que continua na tela.

---

## 8. Ordem técnica derivada (o que fazer, em sequência)

**Fase A — pré-requisito de tudo.** Backtest real sobre histórico real,
usando `structural-backtest.js` (já existe) sobre a captura de histórico
com proveniência (já existe). Entregável: um número, publicado como vier.

**Fase B — a loja.** Conta, cobrança, camada fina de servidor, página de
venda. Não toca motor nenhum. É o único bloqueador absoluto de venda.

**Fase C — o comprador entender.** Onboarding, glossário, LLM sob demanda
(corta ~80% do primeiro acesso), tela de resumo antes do detalhe.

**Fase D — profundidade da decisão, com prova na mão.** Só depois de A:
evoluir o emissor além do cruzamento de médias; ativar
`supertrend-engine`; graduar `institutional-blocks`; unificar o ATR (#342).

**Fase E — isolada, sozinha, nunca junto.** Mover o ciclo do Core Engine
para Worker.

---

## 9. Método

**Medido nesta auditoria:** suíte completa re-executada (3.454/3.454),
cadeia de decisão lida linha a linha em 5 arquivos, importadores contados
por motor e por módulo `nexus/`, implementações de ATR localizadas uma a
uma, camadas de gráfico e workers contados, build medido em bytes.

**Não medido:** desempenho financeiro. O ambiente não tem egress para
exchange — o próprio repositório registra isso. Nada aqui afirma acerto
ou erro de mercado.
