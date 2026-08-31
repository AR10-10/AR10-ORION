# Relatório — "Ordem Oficial de Execução: Consolidação Final do AR10
# Cyborg" (Fase: Transição de Motores para um Organismo Único)

## §0. O pedido, resumido, e o teste que a própria Ordem definiu

Diretriz formal do Operador, prioridade máxima, escopo "consolidação
definitiva da arquitetura do AR10 CYBORG": o foco deixa de ser criar
módulos novos e passa a ser transformar o sistema inteiro em um único
organismo inteligente. 11 prioridades numeradas — auditoria total de
redundância (P1), todos os motores trabalhando juntos (P2), Evidence
Fusion como centro de inteligência (P3), motor matemático (P4),
reconhecimento de padrões (P5), gráfico inteligente (P6), etiquetas (P7),
organismo vivo (P8), execução real (P9), performance (P10), autonomia
técnica (P11) — fechando com um "Resultado Esperado" explícito: o AR10
deve parar de parecer uma coleção de motores independentes.

A própria Ordem definiu o teste a aplicar em cada decisão desta rodada,
citado por inteiro porque governou toda escolha de escopo abaixo:
*"Esta mudança torna o AR10 mais inteligente como um organismo único, ou
apenas adiciona mais um módulo? Se a resposta for apenas 'adicionar
complexidade': NÃO IMPLEMENTAR."*

Nenhuma instrução injetada foi encontrada nesta mensagem (item 7 da
Disciplina de Trabalho, CLAUDE.md) — formato idêntico às Ordens 01/03/04
já executadas nesta mesma sessão, sem persona fictícia nem linguagem de
"pular autorização".

## §1. Prioridade 1 — Auditoria total de redundância/isolamento

Duas técnicas independentes, executadas de novo (não citadas de memória
de rodadas anteriores):

1. **Contagem de importadores reais por módulo `nexus/*.ts`** — para cada
   arquivo, quantos outros arquivos `.ts`/`.tsx` (fora o próprio e fora
   testes) o importam de verdade.
2. **Consumidores reais de cada seletor da store** (`use[Nome]Snapshot`
   extraídos de `unified-snapshot-store.ts`, cada um grepado por uso
   externo real).

**Achado único, já conhecido e documentado desde pelo menos a Ordem 04**:
`cross-exchange-service.ts`/`connection-manager.ts` continuam sem
nenhum consumidor real fora de si mesmos (as únicas 2 outras menções ao
nome do arquivo, em `mexc-spot.ts` e `event-bus.ts`, são comentários em
prosa, não imports). Mesmo motivo de sempre: o cutover de WS/REST ao vivo
é o passo de maior risco técnico do projeto, isolado deliberadamente até
ter sua própria iniciativa dedicada — não um achado novo, uma
reconfirmação com evidência fresca.

**Zero seletor órfão** — todo `use*Snapshot` da store tem pelo menos um
consumidor real fora do próprio arquivo da store. Um falso-positivo do
próprio método (`useUnifiedSnapshot`, substring de
`useUnifiedSnapshotStore` capturada pela regex de extração) foi
identificado e descartado antes de virar um "achado" fantasma.

**Conclusão de P1**: o ecossistema já estava, na prática, consolidado —
a arquitetura de módulos isolados/duplicados que rodadas anteriores
(Diretriz Consolidação, Ordem 03, Ordem 04) foram fechando não deixou
nenhuma redundância nova real para eliminar nesta rodada. Ver §4 sobre
por que isto não vira trabalho manufaturado.

## §2. Prioridade 3 — Evidence Fusion Engine vira o centro de inteligência

`nexus/evidence-fusion.ts` (construído na rodada anterior, "Carta
Branca") ganhou uma v2 mapeando as 9 dimensões nomeadas pela Ordem contra
o que já existe, honestamente — sem fabricar as 9 como campos novos só
para "bater a lista":

| Dimensão pedida | Onde vive |
|---|---|
| Qualidade | `fieldCoverage` (v1, sem mudança) |
| Consenso | `weightConsensus` (**novo**) |
| Conflito | **mesmo campo** `weightConsensus` — consenso alto = conflito baixo, é a mesma estatística de dispersão vista de dois ângulos; dois campos separados repetiria a mesma leitura sob dois nomes, a redundância que a própria P1 desta Ordem pede para eliminar |
| Relevância | `EvidenceFusionSourceGroup.relevance` (**novo**, passthrough) |
| Maturidade | `bySource[].valid`/`bySource[].total` (v1, sem campo novo) |
| Contexto | `fieldCoverage.context` + `EngineSignal.context` (v1, sem mudança) |
| Estabilidade | **deferido** — ver §4 |
| Consistência temporal | **deferido** — ver §4 |
| Persistência | **deferido** — ver §4 |

**`weightConsensus: number | null`** — desvio padrão populacional real
sobre os `weight` não-nulos de TODOS os sinais rastreados agora,
agrupados (não por fonte individual — consenso é uma leitura do conjunto
inteiro, a comparação fonte-a-fonte já existe em `bySource[].meanWeight`
desde a v1). `weight` vive em `[0,1]` por construção
(`confluenceWeight`/pool uniforme, `engine-signal-contract.ts`), então o
desvio padrão máximo teoricamente possível é 0.5 — normalização real
sobre esse teto (`1 - stdDev*2`, clampado), nunca uma escala arbitrária.
`null` honesto com menos de 2 pesos reais (dispersão não existe com 1
ponto só).

**`relevance` (passthrough)** — a decisão de design mais importante desta
peça: `fuseEvidence` NUNCA calcula relevância sozinha. `layer-
relevance.ts` já mede relevância por CAMADA de gráfico inteira, e
`engine-signal-contract.ts` já documentava (linha ~97,
`deriveEngineSignalsFromInstitutionalZones`) por que atribuir uma
relevância de camada a um sinal individual seria uma leitura fabricada —
o mesmo raciocínio se aplica aqui, só que na granularidade certa: o
GRUPO de fonte (que mapeia 1:1 pra uma camada, quando mapeia) recebe o
`LayerRelevanceResult` real já calculado pelo CHAMADOR
(`CouncilWidget`, mesma fatia `useLayerRelevanceSnapshot` que o painel de
camadas já usa — zero segundo cálculo). Zonas Institucionais mapeia para
`institutional_zones`; Conselho não é uma camada de gráfico togglable e
recebe `null` explícito, não um "N/A" inventado. O tipo reusado é o
`LayerRelevanceResult` REAL (`{ relevant, reason, emphasis }`) — não a
união `"alta"|"media"|"baixa"` de `EngineSignal.relevance`, que tem uma
forma diferente; inventar uma tradução entre as duas teria sido uma
segunda fórmula não pedida por nenhum motor real.

**Consumidor real**: o painel "EVIDENCE FUSION" (`CouncilWidget`) agora
mostra `· consenso XX%` no valor compacto quando `weightConsensus` não é
null, e o tooltip ganhou o consenso real e o rótulo "relevante agora"/
"fora de relevância agora" por fonte — confirmado ao vivo (§5).

## §3. Prioridades 6/7 — reconfirmação do Gráfico Inteligente/Etiquetas

Tarefa deliberadamente de auditoria, não de reconstrução (a própria
Ordem, Prioridade 1, pede para não adicionar complexidade sem necessidade
real) — checado por evidência de código, não por memória de rodadas
anteriores:

- **21/21 camadas reais do gráfico** (`RELEVANCE_LAYER_IDS`) continuam
  cobertas pelo Relevance Engine — mesma contagem já certificada pela
  Carta Branca (§6.81), reconfirmada nesta rodada por leitura direta do
  arquivo.
- **Anti-colisão** (`PriceLabelStackPlugin`) já carrega `alpha?: number`
  (opacidade dinâmica/decaimento real, ex.: BOS/CHOCH) e
  `side?: "left"|"right"` — as duas propriedades que a Prioridade 7 pede
  ("opacidade dinâmica", "anti-colisão") já são infraestrutura real, não
  um pedido novo.
- **Só 2 arquivos em todo `chart/` chamam `ctx.fillText` diretamente**:
  o próprio `PriceLabelStackPlugin` (o funil correto) e
  `MarketSessionBandsPlugin` (1 rótulo pequeno de nome de sessão, já
  refinado em 2 rodadas dedicadas — ADENDO/§103 e Lapidação por feedback/
  §162). Nenhum produtor de rótulo novo escapa do sistema unificado.
- **Vencedor de padrão geométrico** (harmônico/Triângulo/H&S) usa
  `series.createPriceLine` nativo — rótulo de eixo, nunca texto flutuando
  sobre velas.

**Achado real, novo, documentado e deliberadamente fora de escopo**: 13
call sites de `series.createPriceLine` nativo (EQH/EQL, Premium/Discount,
vencedor de padrão, entre outros) e o `PriceLabelStackPlugin` custom são
dois mecanismos de rótulo PARALELOS na mesma régua de preço, sem
consciência um do outro — o `PriceLabelStackPlugin` só resolve colisão
entre rótulos que ELE MESMO desenha. Nenhuma evidência real (nenhuma
captura de tela, nenhum teste falhando) confirma uma colisão acontecendo
hoje entre os dois mecanismos — é uma característica arquitetural
observada, não um bug confirmado. Ver §4 para o motivo de não mexer nisto
agora.

## §4. O que ficou deliberadamente fora de escopo, com motivo

- **Estabilidade/Consistência Temporal/Persistência do Evidence Fusion**
  — as 3 exigem uma série temporal real de leituras passadas (ring buffer
  de `EvidenceFusionReading` amostrado a cada ciclo real), infraestrutura
  que não existe neste repositório hoje. Fabricar um número de
  "estabilidade" sem histórico real por trás violaria a Regra de Ouro 3
  (fail-closed) — mais honesto documentar a lacuna do que forçar um
  número. Evolução própria futura, com sua própria iniciativa isolada.
- **Native price-line vs. `PriceLabelStackPlugin` — unificação NÃO
  tentada nesta rodada.** Migrar os 13 call sites de `createPriceLine`
  para o stack customizado quebraria o pareamento nativo linha+rótulo que
  a biblioteca já resolve sozinha (cada `createPriceLine` desenha a LINHA
  de referência, não só o texto) — um refactor arquitetural real, não uma
  correção pontual, sem confirmação visual concreta do problema que
  resolveria. A própria Prioridade 1 desta Ordem pede o oposto de
  refatoração especulativa sem sintoma confirmado ("se apenas adicionar
  complexidade: não implementar"). Documentado para uma auditoria visual
  futura decidir com uma captura de tela real em mãos, mesmo padrão que
  já motivou toda correção anterior nesta área (P.ex. #18, #100, #105).
- **`cross-exchange-service.ts`/`connection-manager.ts`** — isolamento
  reconfirmado, não corrigido, pelo mesmo motivo já documentado em pelo
  menos 3 rodadas anteriores (risco do cutover WS/REST ao vivo).
- **Prioridades 2/4/5/8/9/10/11** desta Ordem são, na prática, o resumo
  do padrão arquitetural que este projeto já segue desde a Ordem 03/04
  (engines puros que se alimentam de dados já reais de outros engines,
  Core Engine como único emissor de decisão, Web Workers para cálculo
  pesado, medição de FPS já existente) — não geraram um item de trabalho
  novo isolado nesta rodada além do que §1/§2/§3 já cobrem; a auditoria
  de P1 e a extensão do Evidence Fusion em P3 SÃO a resposta concreta a
  elas.

## §5. Testes executados (verificação final)

`tsc --noEmit` limpo (0 erros) · **134 arquivos / 2280 testes** (100%,
+11 novos: 6 `weightConsensus` + 3 `relevance` passthrough em
`evidence-fusion.test.ts`, mais 2 testes novos de wiring em
`engine-signal-consolidation-wiring.test.ts`; 5 testes de padrão
pré-existentes com assertions ajustadas, mesma identidade/garantia,
nenhum enfraquecido — 2 em `evidence-fusion.test.ts` (novo campo
`relevance` em `bySource` muda a forma exata esperada por `toEqual`), 1
em `engine-signal-consolidation-wiring.test.ts` (formatação multi-linha
real do novo `fuseEvidence([...])` no App.tsx), 2 em `diretrizes-
avancadas-fixes.test.ts` (janela fixa de caracteres ultrapassada pelas
linhas novas antes do alvo do teste) — mesma classe de manutenção já
documentada em rodadas anteriores) ·
`npm run build` ok (1850 módulos, 889,04 kB) · Playwright real contra o
dev server (`localStorage` do próprio "cortão de acesso" desbloqueado
localmente para este teste — mecanismo que o próprio `access-gate.tsx`
documenta como não-adversário, não um bypass de segurança real):

- Linha "EVIDENCE FUSION" renderizou com dado real mesmo com os feeds da
  Binance bloqueados pelo proxy do sandbox (mesma limitação de ambiente
  de sempre, "FALHA AO CONECTAR AOS FEEDS REAIS" honestamente exibida).
- Tooltip confirmado ao vivo: `relevance` passthrough funcionando de
  ponta a ponta — "Zonas Institucionais: 0/0 válidos · relevante agora"
  (valor real de `layerRelevance.institutional_zones.relevant`, não um
  texto fixo).
- `weightConsensus` corretamente `null` neste estado de dados (1 único
  peso real disponível) — tooltip mostrou o texto honesto "sem amostra
  real (menos de 2 pesos)", nunca um número fabricado; o estado
  "`· consenso XX%`" com 2+ pesos reais fica verificado pelos 5 testes de
  execução real (unitários), não pela captura ao vivo (rede do sandbox
  não permite popular 2 fontes com peso simultâneo).
- Zero erro de console novo — os únicos erros observados são
  `ERR_TUNNEL_CONNECTION_FAILED`/WebSocket bloqueado (proxy do sandbox,
  já esperado), nenhum relacionado ao código desta rodada.
- Layout do painel sem regressão: a linha "EVIDENCE FUSION" quebra em 2
  linhas no rótulo esquerdo do mesmo jeito que a linha vizinha
  "CONFLUÊNCIA CRUZADA · 3 SUBSISTEMAS" já quebrava antes desta rodada —
  padrão pré-existente da coluna estreita, não uma quebra nova.

## §6. Riscos conhecidos

- `weightConsensus`/`relevance` são estatísticas NOVAS — como qualquer
  campo novo do contrato, herdam a mesma limitação honesta que
  `fieldCoverage` já carregava: refletem só as 2 fontes montadas hoje
  (Conselho + Zonas Institucionais). Uma 3ª fonte real futura muda a
  leitura automaticamente, sem exigir mudança nesta função — desenho já
  válido desde a v1.
- A dupla arquitetura de rótulo (native price-line vs. stack customizado,
  §3/§4) é um risco arquitetural REAL, mas não confirmado em produção —
  fica registrado para a próxima auditoria visual decidir com evidência
  concreta, não para ser esquecido.
- Nenhuma mudança desta rodada toca o Core Engine, LEI 24, ou qualquer
  caminho de execução de ordens — Evidence Fusion continua estritamente
  display-only, confirmado pelos mesmos testes de "nunca stance/
  direction/score" que já existiam desde a v1.
