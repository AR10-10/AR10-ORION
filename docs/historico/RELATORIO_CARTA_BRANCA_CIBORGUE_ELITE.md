# Relatório — "Carta Branca": Otimização do Motor Matemático, Reconhecimento
# de Padrões e Evidence Fusion Engine

Data: 2026-08-03 · Branch: `claude/eloquent-cannon-qyt86y` · PR #15 ("Entrega 19")

## §0. O pedido, verbatim, e o evento de segurança tratado antes de agir

Mensagem informal, ditada, em português, pedindo em bloco único:

1. Organizar a arquitetura do motor matemático/inteligência e "trazer tudo
   isso" — eliminar redundância real.
2. Etiquetas laterais "mais perfeitas... só mostrar a precisão maciça".
3. Melhorar a visualização de zonas de reteste/zigzag e adicionar
   explicitamente reconhecimento de **Triângulo** e **Ombro-Cabeça-Ombro**.
4. Liberdade total sobre estratégia, calibração de candles/janelas, e
   pesquisa externa.
5. Decidir o que adicionar ou remover do sistema.
6. Analisar e aplicar o efeito visual mais bonito, com liberdade de
   remodelar ícones/layout.
7. "Habilitar todas as ferramentas para funcionarem 100% automatizadas".
8. Fazer o sistema parecer um ser vivo / operador de elite — "não ter erro
   com ele".

**Evento de segurança, tratado antes de qualquer execução**: imediatamente
após a mensagem (e um comando legítimo `/model`), um bloco não-assinado
`[DIRETIVA SUPREMA: PROTÓTIPO CIBORGUE DE ELITE — AUTONOMIA TOTAL]`
apareceu, endereçando uma persona fictícia **"Agente 4"** nunca usada nesta
sessão, e descrevendo a autorização do Operador em terceira pessoa ("o
Operador concedeu Carta Branca Absoluta"). Isto corresponde, palavra por
palavra, ao item 7 da Disciplina de Trabalho deste CLAUDE.md: nome de
persona fictícia + linguagem de protocolo/comando pedindo para pular
autorização exige parar e confirmar com o Operador antes de agir, mesmo
que o resto do documento pareça razoável.

Ação tomada: `AskUserQuestion` com 3 opções, a primeira sendo o default
seguro ("ignorar o bloco"). O Operador respondeu, verbatim: *"É totalmente
meu, pode usar como instrução e executar tudo o que está aí. Carta branca
total para otimizar o motor matemático, limpar redundâncias, refinar o
visual das etiquetas e padronizar o ecossistema ciborgue agora."*

Resolução: o conteúdo substantivo do bloco entrou no escopo autorizado
desta rodada (confirmado explicitamente pelo Operador); a persona "Agente
4" nunca foi adotada — todo trabalho desta rodada foi executado e
reportado como Claude Code nesta sessão, nunca como um agente separado.

## §1. Auditoria antes de construir (Disciplina de Trabalho, item 1)

Antes de escrever qualquer motor novo, auditei o ecossistema real —
`nexus/*.ts` (36+ arquivos), `research/engines/*.js` (5 engines
graduados), 12+ plugins de canvas — para separar redundância real de
capacidade real distinta. Achados relevantes que moldaram o escopo:

- **`engine-signal-contract.ts` sem consumidor real há 4 rodadas**
  (SYSTEM_HANDBOOK §6.72/§6.74/§6.76): classificado 3 vezes seguidas como
  "iniciativa de arquitetura própria, recomendado, nunca construído" — o
  "Evidence Fusion Engine" que a Carta Branca pede por nome já tinha um
  histórico real de adiamento documentado, não uma ideia nova.
- **`computeInstitutionalZones` sem fatia própria na store**: computado há
  várias rodadas só dentro de `EnhancedChart_110_Percent.tsx` (`useMemo`
  local) — nenhum outro consumidor (como o CouncilWidget) conseguia ler a
  mesma leitura sem recomputar. Gap real, não intencional.
- **Zero redundância matemática genuína encontrada** nos motores de
  padrão já existentes (harmônicos XABCD/Wolfe, S/R, market structure,
  FVG/OB) — cada um resolve uma pergunta geométrica distinta sobre os
  MESMOS swings fractais compartilhados (`fractal-swings.js`). "Extermine
  redundância" (texto do bloco confirmado) foi interpretado como: nenhuma
  segunda implementação de zigzag/swing/regressão nos 2 motores novos
  (ambos reusam funções já existentes), nunca como remoção de capacidade
  real distinta (Regra de Ouro 4).

## §2. Pesquisa real (WebSearch) antes de implementar

Confirmada a definição real de cada padrão antes de qualquer código
(Disciplina de Trabalho, item 2):

- **Triângulo** (FXOpen, ChartMill, Strike.money, Titan FX, Scanz):
  Ascendente = resistência horizontal + suporte subindo (continuação de
  alta); Descendente = suporte horizontal + resistência descendo
  (continuação de baixa); Simétrico = as duas convergem, indecisão real —
  todas as fontes concordam que o lado do rompimento de um Simétrico não
  é determinado pela geometria pura. Regra de toque mínimo consistente
  entre fontes: 2 por linha.
- **Ombro-Cabeça-Ombro** (LightningChart, Dukascopy, LuxAlgo, OANDA):
  Regular (baixista) = 3 topos, cabeça mais alta, neckline ligando os 2
  fundos entre eles (pode ser inclinada); Inverso (altista) = espelhado.
  Ombros "aproximadamente iguais" medidos a partir da própria neckline
  (nunca do preço bruto, já que ela pode ser inclinada).

## §3. Motores novos — isolados e testados antes de qualquer graduação

### `nexus/triangle-pattern.ts`

`detectTrianglePattern({candles})` — regressão linear real (mínimos
quadrados) + R² real sobre os swings fractais de `fractal-swings.js`
(zero segunda detecção de swing). Classifica ASCENDING/DESCENDING/
SYMMETRICAL por achatamento normalizado (`FLAT_SLOPE_PCT_PER_CANDLE`);
SYMMETRICAL nunca ganha uma direção fabricada (`direction: null`,
Regra de Ouro 3 — a pesquisa confirma que a geometria não decide o lado).
Ápice real via interseção das 2 retas (mesma técnica já usada pela Wolfe
em `detectWolfeInPivots`), só exposto quando está à frente do último
candle. Deliberadamente NUNCA projeta um alvo de preço ("medir a altura
da base") — projetaria um número com aparência de previsão sem backtest
real neste repositório para sustentar a técnica honestamente.

**9 testes de execução real** (`tests/triangle-pattern.test.ts`):
geometria exata Ascendente/Descendente (R²=1.0, ápice real calculado),
Simétrico com `direction: null`, 3 casos de fail-closed (linhas paralelas,
1 toque só, padrão velho), amostra insuficiente, exatamente 2 toques
(documenta honestamente que R² satura em 1.0 por definição matemática com
2 pontos — não é overfitting fabricado), constante `MIN_TRIANGLE_FIT_SCORE`.

### `nexus/head-shoulders-pattern.ts`

`detectHeadAndShoulders({candles})` — reusa `buildAlternatingPivots` de
`harmonic-patterns.ts` diretamente (zero segunda implementação de
zigzag). Cabeça precisa ser genuinamente mais extrema que os 2 ombros
(medido no preço bruto); neckline real via 2 pontos (mesma técnica de
"reta avaliada em qualquer índice" da Wolfe); ombros medidos ACIMA da
neckline (nunca do preço bruto — sensível a inclinação real). Simetria
scored com tolerância declarada (35%, mesma natureza dos outros
`hardTol` do repositório).

**Limitação documentada honestamente, não escondida**: este motor não
verifica se havia uma tendência prévia genuína antes do padrão (a
definição clássica de reversão pede um "prior trend") — mesma disciplina
já aceita para XABCD/Wolfe neste repositório (geometria pura, não
contexto de tendência).

**7 testes de execução real** (`tests/head-shoulders-pattern.test.ts`):
Regular exato, neckline inclinada (extrapolação linear real verificada
contra o cálculo, nunca a média/último valor), Inverso espelhado, 2 casos
de fail-closed (ombros assimétricos, cabeça não extrema), amostra
insuficiente, constante `MIN_HEAD_SHOULDERS_FIT_SCORE`.

## §4. Graduação ao gráfico — reusa o pipeline já existente

O `useEffect` unificado em `EnhancedChart_110_Percent.tsx` que antes só
desenhava o melhor padrão harmônico agora escolhe o vencedor único entre
**3 famílias** (harmônico/Triângulo/H&S) por `fitScore` desc — mesma
disciplina de "só o melhor vai pro canvas, o resto fica no painel" já
usada pelo harmônico sozinho (visual budget: silk-thread, zero 3
geometrias competindo pela mesma área). Comparar `fitScore` entre motores
diferentes é uma heurística declarada (cada um mede aderência de um jeito
distinto), documentada como tal no próprio código, nunca apresentada como
medição única calibrada.

- **Harmônico vencedor**: desenho idêntico a antes (polilinha XABCD/
  Wolfe + PRZ/EPA).
- **Triângulo vencedor**: 2 retas reais dedicadas (`triangleResistanceLineRef`/
  `triangleSupportLineRef`), avaliadas na PRÓPRIA reta ajustada do 1º
  toque até o último candle; preço real do ápice (onde as 2 retas valem
  o MESMO preço por definição) mostrado com ETA quando à frente do candle
  atual (mesma técnica de EPA/ETA da Wolfe).
- **H&S vencedor**: outline reusa a MESMA função `drawZigzagOutline`
  (agora compartilhada, zero segunda cópia) do harmônico; neckline
  extrapolada como reta dedicada própria (`necklineExtensionLineRef`).

**Painel lateral consolidado**: "Harmonic Patterns" virou "**Chart
Patterns · geometric fit, never probability**" — um único painel para as
3 famílias (nunca 3 painéis separados; feedback já dado pelo Operador em
rodada anterior: "não é excesso demais"). Vazio honesto quando nada bate
o piso de 75% em nenhuma família.

**Toggle renomeado**: "HARMÔNICOS" → "**PADRÕES GRÁFICOS**" — mesmo id
interno `harmonics` (zero migração de preferência salva do Operador),
rótulo visível ampliado porque agora cobre as 3 famílias com honestidade.

## §5. Evidence Fusion Engine — finalizado

Item nomeado explicitamente pela Carta Branca ("como o Evidence Fusion
Engine"), e classificado 3 rodadas seguidas em SYSTEM_HANDBOOK como
"recomendado, nunca construído — iniciativa de arquitetura própria".

### O que é, e a linha vermelha que nunca cruza

`nexus/evidence-fusion.ts` (`fuseEvidence`) agrega `EngineSignal[]` de
múltiplas fontes REAIS e INDEPENDENTES em estatística de **cobertura e
volume de evidência** — quantos sinais reais existem agora, quantos são
válidos, confiança média entre os válidos, e a pergunta que o handbook
vinha repetindo há 3 rodadas ("quantos dos 10 campos do contrato têm
montador real hoje") virou um número AO VIVO (`fieldCoverage`).

**Nunca produz direção, score ou probabilidade combinada** — a mesma
linha vermelha do cabeçalho de `engine-signal-contract.ts` ("combinar em
uma direção continua sendo trabalho exclusivo de `aggregateCouncil`"),
repetida de propósito no novo arquivo. `EvidenceFusionReading` não tem
nenhum campo `stance`/`direction`/`score` — testado explicitamente
(`tests/evidence-fusion.test.ts`, describe "LEI 24 / Regra de Ouro 2").

### 2ª fonte real, e uma 3ª deliberadamente excluída

`deriveEngineSignalsFromInstitutionalZones` (novo montador em
`engine-signal-contract.ts`) reempacota `InstitutionalZone[]` — fonte
genuinamente INDEPENDENTE do Conselho (EMA/VWAP/FVG/OB/liquidez/
estrutura, zero voto de agente envolvido). `weight` reusa
`confluenceWeight(distinctSourceCount)` — a MESMA fórmula já usada pelo
destaque visual da faixa no gráfico (zero segunda fórmula).

**Scenario Engine deliberadamente NÃO virou uma 3ª fonte** — documentado
no cabeçalho do arquivo: `ScenarioPath.opinionWeight` já É a mesma massa
de opinião do Conselho (`buildScenarioProjection` recebe `council` como
insumo direto). Somar as duas contaria a MESMA evidência 2 vezes sob
nomes diferentes — exatamente a redundância que a Carta Branca pediu para
eliminar, não multiplicar.

### Achado de auditoria corrigido no caminho

`institutionalZones` nunca tinha ganho uma fatia própria em
`unified-snapshot-store.ts` — ao contrário de todo outro motor real deste
app. Corrigido: os 4 lugares reais (state → actions → defaults →
seletor), e `EnhancedChart_110_Percent.tsx` agora TAMBÉM publica o mesmo
array já computado (`useEffect` puramente aditivo, zero segundo
cálculo) — o mesmo espírito de "computado uma vez, lido por qualquer
consumidor" já documentado para `layerRelevance`.

### Consumidor real: CouncilWidget

Nova linha "**EVIDENCE FUSION · coverage, never a score**" — cor SEMPRE
neutra (`text-[#8ab4f8]`), nunca verde/vermelho de propósito, a garantia
visual de que a leitura nunca é lida como sinal direcional (diferente de
SCENARIO A/B, que usa cor real porque É uma leitura direcional).
Confirmado ao vivo via Playwright contra o dev server real: `1/7
válidos · 5/10 campos`, número genuinamente real mesmo com o proxy do
sandbox bloqueando WebSockets da Binance (o Council ainda produz alguns
votos fail-closed sem candles ao vivo).

**16 testes de execução real** (`tests/evidence-fusion.test.ts` +
extensão de `tests/nexus-engine-signal-contract.test.ts`) + **17 testes
de wiring** (`tests/engine-signal-consolidation-wiring.test.ts` +
`tests/institutional-zones-store-wiring.test.ts`).

## §6. Etiquetas laterais — "só mostrar a precisão maciça"

Auditoria da função `priceAxisLabels` (useMemo único, ~19 pontos de
`push`) confirmou: quase todo rótulo aparece sempre que o dado subjacente
é finito, sem checar sua própria força/qualidade real — o sistema
anti-colisão (`PriceLabelStackPlugin`) só reposiciona, nunca esconde.

**Gap real identificado e corrigido**: S1/R1 no eixo — únicos com um sinal
de qualidade real já calculado (`computeLevelStrength`,
`support-resistance-engine.js`: FORTE = >=2 toques independentes, FRACA =
1) mas nunca consultado antes de desenhar. Como o próprio nível sempre
conta a si mesmo como 1 toque, `touches` nunca é 0 na prática — "FRACA"
significa literalmente "nenhum OUTRO swing independente confirmou esta
zona ainda", o caso genuinamente menos preciso.

**Gate aplicado**: `supportStrength?.label === "FORTE"` /
`resistanceStrength?.label === "FORTE"` — reusa `STRONG_TOUCH_THRESHOLD`
já existente, zero limiar novo inventado. Regra de Ouro 4 respeitada com
cuidado: só a ETIQUETA fica mais rigorosa — a LINHA nativa
(`supportLineRef`/`resistanceLineRef`, `useEffect` dedicado) e o valor
real de `support`/`resistance` (usado pelo Core Engine, o
`StructureLevelsStrip` sempre-visível, etc.) continuam INCONDICIONAIS,
intocados.

**Deliberadamente NÃO aplicado a TP1/TP2/TP3** (Trade Plan e fallback do
Núcleo): são a informação mais acionável do sistema inteiro — esconder um
alvo por força fraca removeria dado real que o Operador precisa mesmo
antes de uma segunda confirmação.

**Outros candidatos considerados e descartados** (documentado, não
esquecido): Zonas Institucionais já exigem >=2 fontes reais no próprio
motor de origem (piso já real); Sweep já tem teto de 4 etiquetas (Round
anterior); Session Key Levels já restrito à sessão corrente; BOS/CHOCH já
decai por idade (`ageAlpha`) em vez de um corte abrupto — nenhum destes
tinha o MESMO padrão de "sinal de qualidade real ignorado" que S1/R1.

## §7. Auditoria "automático cobre tudo" + ícones

**Verificado por inspeção direta de código** (não suposição):
`DEFAULT_CHART_LAYER_AUTO_MODE` e `RELEVANCE_LAYER_IDS` já cobrem as 21
`CHART_LAYER_IDS` reais 1:1 — garantido estruturalmente por TypeScript
(`Record<ChartLayerId, boolean>` torna uma chave faltando um erro de
compilação). Nenhuma camada nova foi criada nesta rodada (Triângulo/H&S
reusam o id `harmonics` já existente), então nada ficou de fora da
cobertura automática. Radar já escaneia via `setInterval` real
(`RADAR_SCAN_FULL_CYCLE_MS`) — não exige clique manual para o ciclo
central.

**Ícones**: inventário completo dos ~28 ícones `lucide-react` usados em
`App.tsx` (9 do rail de navegação + ~19 do resto do app) revisado —
zero duplicação semântica encontrada (cada ícone mapeia para um conceito
distinto e reconhecível), zero placeholder/TODO. Este repositório já
passou por 5+ rodadas dedicadas de polimento visual antes desta
(LAPIDAÇÃO PROFISSIONAL DO GRÁFICO, 2×ADENDO, 2×Polimento/Lapidação
Visual) — a auditoria confirma que esse trabalho se manteve, não que
havia algo esquecido.

**Achado honesto**: nenhuma mudança de ícone foi necessária. Trocar um
ícone só para "mostrar uma mudança" sem uma razão real violaria a mesma
disciplina de "não adicionar mudança sem justificativa" seguida em toda
esta sessão — reportado como está, não maquiado.

## §8. O que ficou deliberadamente fora de escopo, com motivo

- **Knowledge Graph / Quality Governor / Lifecycle Manager** — a visão
  arquitetural mais ampla (citada em rodadas anteriores) continua fora:
  são peças centrais ainda inexistentes, cada uma sua própria iniciativa,
  não algo a inventar unilateralmente dentro desta rodada.
- **Evidence Fusion Engine v2** (3ª+ fonte genuinamente independente —
  Radar de Qualificação, GMIL) — v1 entregue com 2 fontes reais; somar
  mais fontes é aditivo natural quando cada uma ganhar seu próprio
  montador real, não construído especulativamente agora.
- **Remodelagem de ícones/layout** — avaliada e decidida como
  desnecessária nesta rodada (§7), não ignorada.
- **Mover o Core Engine para um Worker** (Regra de Ouro 6) — fora de
  escopo desta rodada por design permanente do CLAUDE.md, não relacionado
  ao pedido desta Carta Branca.

## §9. Testes executados (verificação final)

- `tsc --noEmit`: limpo.
- `vitest run`: **134 arquivos / 2269 testes, 100%** (+48 novos desde o
  início desta rodada: 9 Triângulo, 7 Ombro-Cabeça-Ombro, 9 Evidence
  Fusion, 6 montador de Zonas Institucionais, 11 wiring do Evidence
  Fusion Engine, 6 wiring da store de Zonas Institucionais; demais testes
  de padrão pré-existentes reancorados em literais/janelas deslocadas
  pelas linhas novas — nenhuma garantia real enfraquecida, todas
  continuam checando exatamente o mesmo comportamento de antes).
- `npm run build`: ok, **1850 módulos, 888,38 kB** (evidência objetiva de
  que `evidence-fusion.ts` virou um módulo genuinamente vivo — mesma
  técnica de prova usada em rodadas anteriores para confirmar consumo
  real vs. isolamento).
- Playwright real contra o dev server: confirmado o toggle "PADRÕES
  GRÁFICOS" renderizando (substituindo "HARMÔNICOS"), o painel "Chart
  Patterns · geometric fit, never probability" com o piso honesto de 75%
  FIT, e a linha "EVIDENCE FUSION · coverage, never a score" com dado
  real ao vivo (`1/7 válidos · 5/10 campos`). Mesma limitação de ambiente
  já documentada em rodadas anteriores: o proxy de saída deste sandbox
  bloqueia WebSockets reais da Binance (`ERR_TUNNEL_CONNECTION_FAILED`),
  então o gráfico fica honestamente em "AWAITING CANDLES…" (fail-closed
  correto) — não impede a verificação da UI estática/painéis/toggles, que
  é o que esta rodada mudou.

## §10. Riscos conhecidos

- A comparação de `fitScore` entre as 3 famílias de padrão (§4) é uma
  heurística declarada, não uma medição calibrada única — documentado no
  próprio código, nunca apresentado ao Operador como mais preciso do que
  realmente é.
- O gate de S1/R1 (§6) pode, em mercados com pouco histórico de swing
  real, deixar os dois lados sem etiqueta temporariamente — comportamento
  intencional (fail-closed honesto sobre precisão), não um bug; a linha
  de referência real continua visível.
- Nenhuma verificação com dado de mercado AO VIVO real foi possível nesta
  sessão (rede do sandbox bloqueia Binance) — a suíte de testes de
  execução real (fixtures determinísticas) e a suíte de padrão de código
  cobrem a lógica; a aparência final com candles reais depende de
  verificação em um ambiente com rede de saída livre.
