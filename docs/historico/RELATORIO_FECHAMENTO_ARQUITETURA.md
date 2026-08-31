# Relatório — "Ordem Oficial: Fechamento da Arquitetura" (Última Fase de
# Consolidação)

## §0. O pedido, e o teste que governou toda decisão desta rodada

Diretriz formal: a fase de expansão do sistema está encerrada. Diretriz
Principal, citada por inteiro porque decidiu cada escolha abaixo: **não
criar novos motores, novos contratos, novas camadas, novos módulos —
somente fazê-los trabalhar como um único ecossistema.** Quatro seções
pedidas — (1) eliminar pendências recorrentes, classificando cada uma
como IMPLEMENTAR AGORA / MANTER ISOLADO COM JUSTIFICATIVA TÉCNICA
DEFINITIVA / DESCARTAR POR NÃO GERAR BENEFÍCIO REAL; (2) consolidação
definitiva (todo motor aprovado com consumidor real, função clara,
documentação, integração completa); (3) Evidence Fusion como barramento
inteligente de contexto; (4) revisão honesta da experiência do Operador.

Consequência prática da Diretriz Principal sobre a própria classificação:
como o pedido proíbe construir qualquer coisa nova, **IMPLEMENTAR AGORA
só é válido quando o item é wiring/integração de código JÁ existente** —
nunca pesquisa nova, nunca infraestrutura nova, nunca um motor novo. Essa
leitura restringiu de propósito o que podia entrar no primeiro balde, e
está aplicada com consistência abaixo.

## §1. Pendências recorrentes — auditoria real e classificação definitiva

Auditoria dos próprios relatórios das últimas ~8 rodadas (não uma
auditoria nova do código do zero, conforme pedido: "faça uma auditoria
apenas desses itens") + reconfirmação de cada status com grep/leitura
direta do código atual, não de memória.

| Item | Classificação | Justificativa técnica real |
|---|---|---|
| `cross-exchange-service.ts`/`connection-manager.ts` sem publicador | **MANTER ISOLADO** (definitivo) | O próprio cabeçalho do arquivo já documenta o motivo com precisão cirúrgica: "o passo de maior risco: substituir o WS/REST inline que já funciona em produção." Investigado nesta rodada se existiria uma fatia MENOR e segura para religar — não existe: `CrossExchangeService` só expõe a classe inteira (exige `.start()` real, WS/REST ao vivo); `mergeLiveCandle` é a única função pura exportada e já não tem uso pendente. |
| MACD como 8º voto do Conselho | **MANTER ISOLADO** (definitivo) | Calibrar crossover/histograma de MACD para stance+confiança honesta exige pesquisa própria (Regra de Ouro 2, mesma disciplina que já pesquisou Triângulo/H&S antes de construir). Fazer isso "de passagem" dentro de uma rodada de fechamento seria o oposto de cuidadoso — e adicionaria um voto novo ao pool linear real do Conselho, território LEI 24. |
| `visual-budget.ts`: categorias `TARGET`/`INVALIDATION` nunca graduadas | **DESCARTAR** | `TradePlanZonePlugin` já trata TP1/TP2/TP3/STOP como uma zona única na categoria `TRADE_PLAN` (prioridade MÁXIMA das 7 — na prática quase nunca perde a competição visual). Individualizar exigiria fabricar um peso por alvo que não existe em nenhum motor real hoje — Regra de Ouro 3. Benefício especulativo, não confirmado por nenhuma captura real de poluição visual nesta área. |
| `visual-budget.ts`: categoria `RADAR` nunca graduada | **DESCARTAR** | Correção de escopo, não perda de feature: o Radar é uma lista ranqueada CROSS-SYMBOL, não uma anotação do gráfico do símbolo ativo — estruturalmente não existe "um candidato Radar no canvas" para graduar. Nomear a categoria desde a Diretriz Nº 02 foi, em retrospecto, um item que nunca se encaixaria no modelo. |
| `engine-signal-contract.ts`: `priority`/`quality`/`temporalHorizon`/`lifespanCandles` sempre `null` | **MANTER ISOLADO** (definitivo, escopo reduzido) | Instrumentar honestamente exige que cada fonte (Conselho, Zonas Institucionais) ganhe um cálculo próprio novo — proibido pela Diretriz Principal desta Ordem. Achado positivo real: o gap encolheu — `relevance`/qualidade/maturidade/contexto já têm resposta real via Evidence Fusion v2 (rodada anterior), restam só estes 4. |
| Frequência de atualização adaptativa | **MANTER ISOLADO** (definitivo) | Regra de Ouro 6 — pipeline de dados do Core Engine. A pergunta de design que bloqueia isto ("o que adapta — intervalo de poll? prioridade de reconexão?") já foi nomeada explicitamente na Homologação Nº03 e continua sem resposta; decidir isso apressadamente dentro de uma rodada de fechamento seria o oposto do cuidado que a própria regra exige. |
| Pacote `01_SYSTEM_ARCHITECTURE.md`…`11_FINAL_STATUS.md` | **DESCARTAR** | Mencionado como pendente desde a Entrega 5 (15+ rodadas), nunca reclamado por ninguém. `docs/SYSTEM_HANDBOOK.md` + os `RELATORIO_*.md` numerados já cobrem o mesmo conhecimento, ativamente mantidos a cada rodada — reconstruir um pacote paralelo seria redundância NOVA, o oposto do que esta Ordem pede. |
| Backlog V-MAX (Liquidity Voids, Volume Clusters, Cross-TF Liquidity, Footprint, Auto Layout) | **MANTER ISOLADO** (definitivo, pela própria Ordem) | São motores/camadas genuinamente NOVOS — a Diretriz Principal desta Ordem proíbe construí-los nesta fase, ponto final. Não avaliados por mérito porque o mérito não é a pergunta certa agora. |
| Evidence Fusion: estabilidade/consistência temporal/persistência | **MANTER ISOLADO** (definitivo) | Exigem um ring buffer de leituras passadas — infraestrutura nova, proibida pela Diretriz Principal. Reafirmado da rodada anterior, agora com a mesma regra vinda da própria Ordem, não só de prudência interna. |
| Native price-line (13 call sites) vs. `PriceLabelStackPlugin` — 2 mecanismos paralelos | **MANTER ISOLADO** (definitivo, gatilho nomeado) | Investigado a fundo nesta rodada (ver `price-label-stack.ts`): dar ao stack consciência de posições nativas exigiria semântica de "âncora fixa" nova dentro do resolvedor de colisão mais compartilhado do app (10+ tipos de rótulo dependem dele) — redesenho real de algoritmo, não um ajuste. Sem nenhuma captura de tela confirmando colisão real (diferente de TODO outro fix já feito nesta área). Gatilho definitivo para a próxima rodada decidir: uma captura real do Operador mostrando a colisão. |
| Laboratório de backtest (`structural-backtest.js`/`history-capture.js`/`compare-runs.js`) | **MANTER ISOLADO** (já definitivo) | Fronteira já travada por teste dedicado (`structural-backtest.test.ts`: "nenhum módulo de produção importa daqui"). A decisão mais definitiva que existe neste projeto — só reafirmada aqui, não uma pendência de verdade. |
| "3 fades de plugins pendentes" (Liquidation Heatmap / Session Key Levels / Order Flow Heatmap) | **JÁ RESOLVIDO — fechado, retirado do backlog** | Achado real desta rodada (ver §1.1 abaixo): 2 dos 3 já têm decaimento real, o 3º já decai por magnitude. Claim antigo nunca atualizado — corrigido aqui, zero código novo necessário. |

### §1.1 O achado que fecha uma pendência sem escrever uma linha de código

A alegação "3 fades de plugins pendentes" aparecia desde a Evolução Total
Autônoma (Entrega 16) na lista de features V-MAX ainda por fazer. Checado
com leitura direta do código atual, não de memória:

- **`SessionKeyLevelsPlugin.tsx`** (linha 161-173): já aplica
  `sessionGenerationWeight(generationsBack)` real por nível — MESMAS
  constantes 100/40/20% de `MarketSessionBandsPlugin`, um piso de 20% em
  vez de um degrau binário aberto/fechado.
- **`OrderFlowHeatmapPlugin.tsx`**: já aplica `computeRecencyWeight(i,
  length)` real, tanto no heatmap de liquidez (linha 132/144/151) quanto
  no order flow (linha 162/169-170).
- **`LiquidationHeatmapPlugin.tsx`**: não tem alpha por render — mas o
  motor que alimenta (`computeLiquidationHeatmap`,
  `nexus/liquidation-heatmap.ts`, linha 162-167) já pondera cada evento
  por `ageAlpha(ageMinutes, LIQUIDATION_DECAY)` ANTES de somar no bucket —
  um bucket feito só de eventos com mais de 1h já soma efetivamente zero,
  logo desenha uma barra de largura zero. O decaimento é real, só
  expresso via magnitude (a barra encolhe) em vez de opacidade — mesmo
  resultado prático, arquitetura honestamente diferente da dos outros
  dois.

Nenhum dos três precisa de código novo. A pendência estava desatualizada,
não real — corrigida aqui por remoção do backlog, não por implementação.

## §2. Consolidação Definitiva — todo motor aprovado com integração completa

Critério da própria Ordem: consumidor real + função clara + documentação
+ integração completa, nenhum motor aprovado "aguardando indefinidamente."

- **Consumidor real**: a mesma auditoria de 2 técnicas do §1 (contagem de
  importadores reais + consumidores reais de seletor de store),
  reconfirmada nesta rodada, encontra exatamente 1 módulo real isolado —
  `cross-exchange-service.ts` (já classificado acima, com justificativa
  técnica definitiva, não um esquecimento).
- **Função clara + documentação**: garantida estruturalmente pela
  convenção já em vigor há 20+ rodadas (todo `nexus/*.ts` abre com um
  cabeçalho real descrevendo escopo/não-escopo) — nenhuma exceção
  encontrada.
- **Integração completa**: garantida estruturalmente por
  `noUnusedLocals`/`noUnusedParameters` (permanentes no `tsconfig.json`
  desde a Evolução Visual, Entrega 14) + `tsc --noEmit` limpo — qualquer
  valor computado e nunca lido em lugar nenhum vira erro de compilação,
  não uma suposição. O único caso real onde isto quase falhava —
  `evidenceFusion` computado a cada render de `CouncilWidget` mas nunca
  publicado para nenhum outro consumidor — foi fechado nesta própria
  rodada (§3).

Conclusão real: a arquitetura já estava, na prática, consolidada antes
desta Ordem começar — o trabalho real desta seção foi RECONFIRMAR com
evidência fresca, mais fechar o único gap concreto encontrado (§3), não
descobrir uma pilha de motores esquecidos.

## §3. Evidence Fusion vira o barramento inteligente do ecossistema

Achado real: `fuseEvidence()` já era computado a cada render dentro de
`CouncilWidget`, mas SEM fatia própria na store — exatamente o mesmo
padrão de isolamento que `institutionalZones` tinha antes da Carta
Branca. Nenhum outro consumidor no app conseguia ler a mesma leitura sem
recalculá-la.

**Corrigido — 4 lugares reais na store** (`unified-snapshot-store.ts`,
mesma convenção documentada no cabeçalho do arquivo): `evidenceFusion:
EvidenceFusionReading | null` (state) → `setEvidenceFusion` (action) →
`null` (default, honesto — mesmo padrão de `layerRelevance`) →
`useEvidenceFusionSnapshot()` (seletor). `CouncilWidget` publica a MESMA
leitura já computada (zero segundo cálculo) via `useEffect`.

**Efeito colateral corrigido no caminho**: `engineSignals`/
`institutionalSignals`/`evidenceFusion` não eram memoizados —
recomputavam (novas referências) a cada render. Sem `useMemo`, publicar
na store teria disparado `setEvidenceFusion` (produce/freeze do Immer)
em TODO tick de `CouncilWidget`, mesmo sem mudança real. Os 3 ganharam
`useMemo` com as dependências reais corretas.

**Primeiro consumidor real novo: `self-diagnostics.ts`** —
`DiagnosticInput` ganhou `evidenceFusionFieldCoverage: number | null`
(fração real dos 10 campos do contrato instrumentados, MESMA fórmula já
usada pelo painel "EVIDENCE FUSION", lida via `getSnapshotForEngine()`,
nunca uma segunda medição). Novo achado "Evidence Fusion · cobertura do
contrato" no relatório de autodiagnóstico, severidade sempre `OK` (mesmo
princípio de "Memória (heap JS)": este repositório não tem um limiar
calibrado de "cobertura mínima aceitável", então nunca fabricar um corte
sem medição real). Confirmado ao vivo via Playwright: clique real no
botão "GERAR RELATÓRIO DE AUTODIAGNÓSTICO" produziu `[OK] Evidence
Fusion · cobertura do contrato — 50% dos 10 campos...` — o mesmo número
real que o painel já mostrava, agora também no relatório.

**3ª fonte para Evidence Fusion — considerada e rejeitada, documentado
por quê**: `consensus-radar.ts` foi avaliado como candidato (já reempacota
magnitudes 0..1 reais). Rejeitado: 4 das suas 6 categorias
(Estrutura/Liquidez/Fluxo/Momentum) são literalmente as MESMAS
confidences dos votos do Conselho, só re-fatiadas — somar como uma "3ª
fonte" contaria a mesma evidência 2x, a MESMA razão que já excluiu
Scenario Engine na Carta Branca. Zero fonte nova adicionada.

## §4. Experiência do Operador — revisão honesta

Pergunta aplicada linha a linha no painel `CORE INTELLIGENCE` (o mais
denso do app): "SINCRONIZAÇÃO · IDADE DAS FONTES" checado e mantido —
não é ruído técnico, é a defesa direta contra o operador confiar em dado
velho sem perceber (a própria razão de existir, documentada no comentário
original). As 3 linhas de confluência do widget "VALIDAÇÃO
MULTI-CAMADA" (`CONFLUÊNCIA · CONTEXTO`, `COMITÊ ENSEMBLE`, `CONFLUÊNCIA
CRUZADA`) checadas por sobreposição real — medem 3 coisas genuinamente
diferentes (quais camadas têm dado agora / consenso do comitê / acordo
direcional entre 3 subsistemas), fundir perderia sinal real, não reduziria
ruído. Disclaimer "SUGESTÃO ALGORÍTMICA · NÃO É CONSELHO FINANCEIRO"
checado por duplicação — aparece exatamente 1 vez. Painéis sempre-visíveis
(`system_health` entre eles) checados quanto à categoria arquitetural
"ALWAYS-docked" já nomeada em código — decisão deliberada de rodada
anterior, não uma omissão.

**Resultado honesto**: nenhuma redução nova aplicada nesta rodada. Depois
de 10+ rodadas dedicadas de polimento visual/UX já reais (Lapidação
Profissional, 2×Adendo, 2×Polimento Visual, Restauração/Inteligência
Visual, Refinamento Visual, reorganização do painel de camadas em
Homologação Nº03, gate S1/R1 da Carta Branca), o painel já está no ponto
que a auditoria desta rodada consegue confirmar com evidência real —
forçar um corte sem achado concreto violaria a mesma disciplina que já
impediu inventar uma mudança de ícone na Carta Branca.

## §5. Testes executados (verificação final)

`tsc --noEmit` limpo (0 erros) · **135 arquivos / 2291 testes** (100%,
+11 novos: 4 store-wiring de `evidenceFusion` + 2 self-diagnostics
+ 5 assertions de padrão pré-existentes ajustadas — 2 pelo novo
`useMemo`/formatação de `engineSignals`/`institutionalSignals`, 1 pela
janela fixa de `diretrizes-avancadas-fixes.test.ts` ultrapassada pelas
linhas novas, mais o próprio ajuste de janela do teste novo antes de
estabilizar — nenhuma garantia real enfraquecida) · `npm run build` ok
(1850 módulos, 889,78 kB) · Playwright real contra o dev server
(`localStorage` do cortão de acesso desbloqueado localmente, mesmo
mecanismo não-adversário já usado na rodada anterior): linha "EVIDENCE
FUSION" saudável, clique real em "GERAR RELATÓRIO DE AUTODIAGNÓSTICO"
produziu o achado novo com o número real (50%), zero erro de console
novo, zero regressão de layout.

## §6. Riscos conhecidos

- `evidenceFusionFieldCoverage` reflete só as 2 fontes montadas hoje
  (Conselho + Zonas Institucionais) — mesma limitação honesta já
  documentada para `fieldCoverage`/`weightConsensus` desde a v1/v2.
- A dupla arquitetura de rótulo (native price-line vs. stack) e as 3
  dimensões temporais do Evidence Fusion continuam reais riscos
  arquiteturais conhecidos, não esquecidos — cada um com gatilho
  definitivo nomeado para a próxima rodada decidir com evidência
  concreta em mãos.
- Nenhuma mudança desta rodada toca o Core Engine, LEI 24, ou qualquer
  caminho de execução de ordens.
