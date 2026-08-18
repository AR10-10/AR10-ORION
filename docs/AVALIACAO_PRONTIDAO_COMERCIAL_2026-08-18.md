# Avaliação de prontidão comercial — AR10 CYBORG

**Data:** 2026-08-18 · **Pergunta do Operador:** "o que ele precisa ser
evoluído pra ficar um produto bom pra gente chegar a vender esse produto?
Ele já está nesse nível? Pra quem acessar pra analisar o ativo ele tá
perfeito?"

Este documento é a resposta medida — não uma impressão. Cada afirmação
abaixo veio de leitura direta do código, execução da suíte, medição do
build ou da documentação interna do próprio repositório.

---

## Resposta curta

- **Como terminal para analisar um ativo:** sim, está no nível. 8 motores
  puros graduados, 3.430 testes reais passando, gráfico com estrutura,
  liquidez, padrões de vela e confluência multi-timeframe.
- **Como produto para colocar à venda:** ainda não. Não existe conta de
  usuário, cobrança, servidor nem primeira-experiência. Hoje não há por
  onde alguém pagar e entrar.

A parte difícil — a que leva anos e não se compra pronta — já está feita.
O que falta está quase todo **fora** dos motores.

---

## As 9 dimensões medidas

| Dimensão | Status | Evidência real |
|---|---|---|
| Motor de decisão | PARCIAL | `js/research/research-engine.js:42` — `trendBias()` é cruzamento de médias (preço > SMA && EMA ≥ SMA = ALTA), 6 linhas. Toda a sofisticação está nas camadas de confluência ao redor, não no emissor. |
| Validação contra mercado real | AUSENTE | `QUARANTINE.md`: "zero egress Binance"; `tools/measure-reversal-lead.mjs` "nunca rodou sobre mercado real". Zero backtest. `MIN_TRADES_FOR_VALID_EXPECTANCY = 30` → usuário novo começa com o Profitability Engine mudo. |
| Conta, cobrança e acesso | AUSENTE | `grep auth\|stripe\|checkout\|paywall\|jwt` → 0 ocorrências reais em 42.634 linhas. Não existe `src/server`, `src/api` nem `src/backend`. |
| Primeira experiência | AUSENTE | `grep onboarding\|tutorial\|welcome` em `src/` → 0 arquivos. O app abre já no painel completo. |
| Entrega no dispositivo | PRONTO | `index.html` → `manifest.webmanifest`; `main.tsx:22` → `serviceWorker.register`. PWA real, instalável, local-first. |
| Custo do primeiro acesso | RISCO | llm-worker 5.887 KB + llm-bridge 5.771 KB + index 1.016 KB ≈ **12,7 MB** de JS antes da primeira vela. |
| Origem dos dados | RISCO | binance, mexc, bybit, okx, coingecko, yahoo, tradingview — todos chamados **browser-direct**. Ótimo para 1 usuário; com N pagantes vira questão de termos de redistribuição. |
| Idioma | PARCIAL | `package.json` sem i18n/intl. Interface 100% português → mercado fechado no Brasil. |
| Enquadramento regulatório | NÃO ENDEREÇADO | Vender análise de ativos no Brasil encosta na regra da CVM para analista/consultor. O sistema já joga a favor (nunca dá recomendação personalizada; aviso legal em 4/4 peças publicáveis via `publication/canvas-primitives.ts`), mas é pergunta para advogado antes da primeira venda. |

---

## Os 5 bloqueadores, na ordem em que travam

A ordem é causal — cada item impede o seguinte de importar.

1. **Não existe como cobrar.** Sem conta, sessão, assinatura ou servidor,
   o AR10 é um site estático: quem recebe o link usa tudo, para sempre,
   de graça. Único bloqueador que sozinho torna a venda impossível.
   *Pronto quando:* uma pessoa desconhecida paga, entra com a própria
   conta, e perde o acesso se cancelar.
2. **O comprador não entende o que comprou.** Dezenas de siglas sem
   explicação. A qualidade real fica invisível para quem precisa ser
   convencido nos primeiros 60 segundos.
   *Pronto quando:* alguém que nunca viu o app lê uma leitura completa
   sozinho.
3. **A promessa ainda não tem prova.** O sistema é rigorosamente honesto
   (nunca inventa probabilidade, fecha em `DADOS_INSUFICIENTES`), mas
   honestidade não é evidência.
   *Pronto quando:* existir backtest real sobre histórico real, com o
   número publicado como vier — inclusive se vier ruim.
4. **O primeiro carregamento é pesado demais.** 12,7 MB, a maior parte
   LLM local — um recurso opcional cobrando o preço de entrada de todos.
   *Pronto quando:* gráfico com dado real aparece em segundos num 4G e o
   LLM baixa sob demanda.
5. **A base legal e de dados não foi decidida.** Enquadramento da venda
   no Brasil + termos das exchanges para clientes pagantes. Baratos de
   resolver antes, caros depois.

---

## O que já vale de verdade (não inflado)

- **3.430 testes reais** em 208 arquivos, com a disciplina de motor novo
  nascer isolado e só graduar depois de provado.
- **Zero número inventado**: zero mock, zero `Math.random()`, zero dado
  sintético no fluxo real; fail-closed em toda parte.
- **8 motores puros graduados**, todos determinísticos.
- **"Confluência nunca é probabilidade"** — num mercado inteiro vendendo
  "87% de acerto" inventado, recusar-se a fabricar o número é argumento
  de venda, não limitação.

---

## Rota até vendável

**Fase 1 — o mínimo para cobrar (a loja).** Login/conta, assinatura e
cobrança, camada fina de servidor para validar acesso, página de venda
dizendo o que o produto é e o que não é. Inegociável, e é a menor em
volume de código — não toca motores, gráfico nem Core Engine.

**Fase 2 — o mínimo para o comprador ficar.** Primeira sessão guiada +
glossário, LLM carregado sob demanda (corta ~80% do primeiro acesso),
tela de resumo que responde "e daí?" antes dos detalhes, preparar o texto
para tradução antes que cresça mais. Risco técnico baixo.

**Fase 3 — o mínimo para a promessa ser honesta.** Backtest real sobre
histórico real; evoluir o emissor de sinal além do cruzamento de médias
com a prova na mão; ativar o `supertrend-engine` (pronto, testado e
dormente). Vender antes desta fase é possível — prometer taxa de acerto
antes dela, não.

---

## Método

**Medido:** código-fonte inteiro (42.634 linhas TS/TSX), motor de decisão
lido linha a linha, suíte executada, build de produção medido em bytes,
documentação interna (`QUARANTINE.md`, `CLAUDE.md`, 455 commits), busca
direta por auth/cobrança/servidor/onboarding/i18n.

**Não medido:** desempenho contra mercado real. Este ambiente nunca teve
saída de rede para as exchanges — o próprio repositório registra isso.
Nada aqui afirma que o sistema acerta ou erra; a avaliação é de
engenharia e prontidão comercial, não de lucratividade.
