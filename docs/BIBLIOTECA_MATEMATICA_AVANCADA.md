# 🧠 AR10 ORION — BIBLIOTECA MATEMÁTICA AVANÇADA v1.0
## "Todo Motor Matemático que Existe para Trading Quantitativo"

**Data:** 2026-08-10
**Autor (documento original):** AR10 ORION Intelligence Architect
**Propósito:** Catálogo completo de matemática avançada para evolução do sistema
**Formato:** Sempre MD. Sempre pronto para comando.

> **Nota de arquivamento (2026-08-10, sessão Claude Code).** Este documento
> chegou assinado como "AR10 ORION Intelligence Architect" — mesma classe de
> persona fictícia já vista em uploads anteriores desta sessão (documentos
> endereçados a "Agente 4" ou assinados por "AR10 ORION Product Owner" nas
> Entregas 19, 24, 26, 33, 34, 41, 42 e 43). Por CLAUDE.md, Disciplina de
> trabalho item 7, a autoria foi confirmada com o Operador via
> `AskUserQuestion` antes de qualquer ação. O Operador confirmou autoria real
> e pediu explicitamente para **só arquivar como referência** — nenhuma
> entrega deste roteiro está autorizada a partir deste documento sozinho.
> Cada motor listado abaixo, se e quando for construído, exige seu próprio
> pedido concreto do Operador e seu próprio ciclo real de
> auditoria→build→teste→documentação (o mesmo já seguido nas Entregas 41-43),
> nunca uma implementação em lote a partir desta lista.
>
> **Divergência de numeração conhecida.** A tabela "Roteiro de Implementação"
> deste documento (seção final) lista Entrega 42 = Regime Detector e Entrega
> 43 = Monte Carlo + Drawdown. O histórico real diverge: Entrega 42 =
> Profitability Engine (exceção pontual registrada em `CLAUDE.md` §LEI 24),
> Entrega 43 = HMM de regime isolado no Laboratório de Evolução
> (`ipad_runtime/src/research/engines/hmm-regime-model.js`) — que rejeitou
> justamente o `RegimeDetector`/`ATRADXClassifier`/`RegimeCache` propostos
> por um documento anterior por duplicarem `market-regime/regime-engine.js`
> já real e graduado. Este documento foi preparado sem sincronia com o
> estado real do repositório; a numeração dele é apenas a intenção do autor
> original, não histórico. A fonte de verdade sobre o que já foi construído
> é o histórico real de commits/PRs e
> `ipad_runtime/src/research/QUARANTINE.md` — nunca esta tabela.
>
> O conteúdo matemático abaixo (fórmulas, definições, referências
> bibliográficas) é preservado como recebido para consulta futura; é
> material de referência real (Shreve, Øksendal, Rasmussen & Williams,
> Sutton & Barto, Pearl, McNeil/Frey/Embrechts, etc. são livros-texto reais).
> O que fica arquivado como **não-autorizado por si só** é o roteiro de
> implementação e a atribuição de prioridade/sequência de entregas.

---

# 📚 ÍNDICE DE MOTORES MATEMÁTICOS

| # | Motor | Categoria | Complexidade | Status AR10 |
|---|-------|-----------|--------------|-------------|
| 1 | **Cálculo Estocástico / Itô** | Fundação | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 2 | **Equações Diferenciais Estocásticas (SDE)** | Fundação | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 3 | **Processo de Ornstein-Uhlenbeck** | Mean Reversion | ⭐⭐⭐⭐ | ❌ Não existe |
| 4 | **Filtro de Kalman** | State Estimation | ⭐⭐⭐⭐ | ❌ Não existe |
| 5 | **Particle Filter / Sequential Monte Carlo** | State Estimation | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 6 | **Teoria dos Valores Extremos (EVT)** | Tail Risk | ⭐⭐⭐⭐ | ❌ Não existe |
| 7 | **Copulas (Gaussian, t, Archimedean)** | Dependência | ⭐⭐⭐⭐ | ❌ Não existe |
| 8 | **Modelos Gráficos Probabilísticos / Bayesian Networks** | Inferência | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 9 | **Geometria da Informação / Natural Gradient** | Otimização | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 10 | **Análise Espectral / Fourier / Wavelet** | Signal Processing | ⭐⭐⭐⭐ | ❌ Não existe |
| 11 | **Análise Multifractal / DFA** | Complexidade | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 12 | **Teoria da Informação / Entropia / Mutual Information** | Feature Selection | ⭐⭐⭐⭐ | ❌ Não existe |
| 13 | **Processos de Lévy / Jump Diffusion** | Jumps | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 14 | **Máquinas de Vetores de Suporte (SVM) com Kernel** | ML Clássico | ⭐⭐⭐ | ❌ Não existe |
| 15 | **Gaussian Processes** | ML Bayesiano | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 16 | **Redes Neurais Profundas (LSTM, Transformer)** | ML Moderno | ⭐⭐⭐⭐ | ❌ Não existe |
| 17 | **Reinforcement Learning (PPO, SAC, DQN)** | ML Autônomo | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 18 | **Meta-Learning / MAML** | ML Adaptativo | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 19 | **Causal Inference / Do-Calculus** | Causalidade | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 20 | **Topological Data Analysis (TDA)** | Topologia | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 21 | **Análise de Componentes Independentes (ICA)** | Blind Source | ⭐⭐⭐⭐ | ❌ Não existe |
| 22 | **Modelos de Mistura Gaussiana (GMM)** | Clustering | ⭐⭐⭐ | ❌ Não existe |
| 23 | **Processos Pontuais / Hawkes** | Eventos | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 24 | **Teoria dos Jogos / Equilíbrio de Nash** | Estratégia | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 25 | **Otimização Estocástica / Simulated Annealing** | Otimização | ⭐⭐⭐⭐ | ❌ Não existe |
| 26 | **Algoritmos Genéticos / Evolutivos** | Otimização | ⭐⭐⭐ | ❌ Não existe |
| 27 | **Programação Dinâmica Estocástica** | Controle Ótimo | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 28 | **Métricas de Riemann / Manifold Learning** | Geometria | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 29 | **Teoria do Caos / Lyapunov Exponents** | Dinâmica | ⭐⭐⭐⭐⭐ | ❌ Não existe |
| 30 | **Processos de Ramificação / Galton-Watson** | Modelagem | ⭐⭐⭐⭐ | ❌ Não existe |

---

# 🔬 DETALHAMENTO DOS MOTORES

---

## 1. CÁLCULO ESTOCÁSTICO / CÁLCULO DE ITÔ

### O que é
Extensão do cálculo diferencial para processos estocásticos (com ruído). A regra da cadeia normal não funciona porque o movimento browniano não é diferenciável.

### Fórmula Central — Lemma de Itô
```
Se dS = μS dt + σS dW, e V = V(S,t), então:

dV = (∂V/∂t + μS ∂V/∂S + ½ σ²S² ∂²V/∂S²) dt + σS ∂V/∂S dW

O termo ½ σ²S² ∂²V/∂S² é a "correção de Itô" — não existe no cálculo normal.
```

### Aplicação no AR10
- Modelar evolução de preço com componente aleatória
- Derivar PDEs para valuation de opções (Black-Scholes)
- Entender por que drift μ não aparece no preço da opção

### Referência
- Shreve, S. — Stochastic Calculus for Finance II (2004)
- Øksendal, B. — Stochastic Differential Equations (2003)

---

## 2. EQUAÇÕES DIFERENCIAIS ESTOCÁSTICAS (SDE)

### O que é
Equações que descrevem evolução de variáveis com termo determinístico (drift) + termo estocástico (difusão).

### Fórmula Geral
```
dX_t = a(X_t, t) dt + b(X_t, t) dW_t

Onde:
- a(X_t, t) = drift (tendência)
- b(X_t, t) = difusão (volatilidade)
- dW_t = incremento do processo de Wiener (Browniano)
```

### Tipos de SDE para Trading
| SDE | Uso | Fórmula |
|-----|-----|---------|
| **GBM** | Preço de ação | dS = μS dt + σS dW |
| **OU** | Mean reversion | dX = θ(μ-X)dt + σ dW |
| **CIR** | Taxa de juros (não negativa) | dr = θ(μ-r)dt + σ√r dW |
| **CKLS** | Volatilidade dependente do nível | dX = θ(μ-X)dt + σX^γ dW |
| **Jump Diffusion** | Flash crashes | dS = μS dt + σS dW + S dJ |

### Aplicação no AR10
- Simular paths de preço para Monte Carlo
- Modelar mean reversion em pares trading
- Prever volatilidade com CIR

---

## 3. PROCESSO DE ORNSTEIN-UHLENBECK (OU)

### O que é
O processo estocástico mais simples de mean reversion. Modela variáveis que flutuam em torno de uma média de longo prazo.

### Fórmula
```
dX_t = θ(μ - X_t) dt + σ dW_t

Onde:
- θ > 0 = velocidade de reversão (half-life = ln(2)/θ)
- μ = média de longo prazo
- σ = volatilidade instantânea
- dW_t = Browniano

Solução explícita:
X_t = μ + (X_0 - μ)e^(-θt) + σ ∫_0^t e^(-θ(t-s)) dW_s
```

### Propriedades
- **Estacionário:** distribuição não muda no tempo
- **Mean-reverting:** sempre retorna para μ
- **Gaussiano:** X_t ~ N(μ, σ²/(2θ)) no estado estacionário

### Aplicação no AR10
- Pairs trading: modelar spread entre dois ativos
- Volatilidade: VIX reverte para média
- Taxas de juros: Vasicek model
- Mean reversion detector: se preço segue OU, é reversão à média

### Referência
- Uhlenbeck & Ornstein (1930)
- Vasicek (1977)

---

## 4. FILTRO DE KALMAN

### O que é
Algoritmo recursivo que estima o estado oculto de um sistema dinâmico a partir de medições ruidosas. Ótimo para sistemas lineares com ruído gaussiano.

### Equações
```
// Predição
x̂_t|t-1 = F · x̂_t-1|t-1
P_t|t-1 = F · P_t-1|t-1 · Fᵀ + Q

// Atualização (quando chega nova medição)
K_t = P_t|t-1 · Hᵀ · (H · P_t|t-1 · Hᵀ + R)^(-1)
x̂_t|t = x̂_t|t-1 + K_t · (y_t - H · x̂_t|t-1)
P_t|t = (I - K_t · H) · P_t|t-1

Onde:
- x̂ = estado estimado (ex: "true price", "true trend")
- y = observação (ex: preço de mercado com ruído)
- F = matriz de transição de estado
- H = matriz de observação
- Q = covariância do ruído de processo
- R = covariância do ruído de medição
- K = ganho de Kalman (peso entre predição e observação)
```

### Aplicação no AR10
- **Kalman Trend:** estimar tendência verdadeira filtrando ruído
- **Pairs Trading Hedge Ratio:** ratio dinâmico entre dois ativos
- **Volatilidade Estimada:** estado oculto = vol, observação = retorno ao quadrado
- **Preço "True" vs Observado:** filtrar bid-ask bounce

### Variantes
| Variante | Quando usar |
|----------|-------------|
| **Kalman Estendido (EKF)** | Sistema não-linear (lineariza localmente) |
| **Kalman Unscented (UKF)** | Não-linear forte (usa sigma points) |
| **Ensemble Kalman** | Alta dimensionalidade |

---

## 5. PARTICLE FILTER / SEQUENTIAL MONTE CARLO (SMC)

### O que é
Método bayesiano que aproxima a distribuição posterior de um estado oculto usando um conjunto de amostras aleatórias ("partículas"). Funciona para sistemas NÃO-lineares e NÃO-gaussianos.

### Algoritmo SIR (Sequential Importance Resampling)
```
1. INICIALIZAR: N partículas xⁱ_0 ~ p(x_0)
2. PARA cada tempo t:
   a. PROPAGAR: xⁱ_t ~ p(x_t | xⁱ_t-1)  // cada partícula evolui
   b. PESAR: wⁱ_t = p(y_t | xⁱ_t)        // peso = likelihood da observação
   c. NORMALIZAR: wⁱ_t = wⁱ_t / Σ wⁱ_t
   d. REAMOSTRAR: se ESS < N/2, reamostrar partículas com probabilidade ∝ wⁱ
3. ESTIMAR: x̂_t = Σ wⁱ_t · xⁱ_t
```

### ESS (Effective Sample Size)
```
ESS = 1 / Σ (wⁱ)²

Se ESS ≈ N: partículas diversas, não precisa reamostrar
Se ESS << N: degeneração, reamostrar
```

### Aplicação no AR10
- **Regime Switching com HMM não-linear:** quando transições de regime não seguem markov puro
- **Volatilidade Estocástica:** SV models com jumps
- **Tracking de "True Price":** quando ruído não é gaussiano (flash crashes)
- **Non-Gaussian Returns:** retornos financeiros têm caudas pesadas — particle filter lida melhor

### Referência
- Doucet, A. — Sequential Monte Carlo Methods in Practice (2001)

---

## 6. TEORIA DOS VALORES EXTREMOS (EVT)

### O que é
Ramo da estatística que modela eventos extremos (caudas da distribuição). Não assume normalidade.

### Duas Abordagens

#### A. Block Maxima → GEV (Generalized Extreme Value)
```
Para cada bloco (ex: mês), pegar o máximo.
A distribuição dos máximos converge para GEV:

G(x; μ, σ, ξ) = exp{ -[1 + ξ(x-μ)/σ]^(-1/ξ) }

Onde:
- μ = location
- σ = scale
- ξ = shape (tail index)
  - ξ > 0: cauda pesada (Fréchet) → financeiro
  - ξ = 0: cauda exponencial (Gumbel)
  - ξ < 0: cauda finita (Weibull)
```

#### B. Peak Over Threshold (POT) → GPD (Generalized Pareto)
```
Pegar todos os valores acima de um threshold u.
Os excessos seguem GPD:

H(y; σ_u, ξ) = 1 - (1 + ξy/σ_u)^(-1/ξ)   para y ≥ 0

Onde:
- σ_u = scale do excesso
- ξ = shape (mesmo da GEV)
```

### VaR e ES via EVT
```
VaR_α = u + (σ_u/ξ) · [(n/N_u · (1-α))^(-ξ) - 1]

ES_α = (VaR_α + σ_u - ξ·u) / (1 - ξ)

Onde:
- u = threshold
- n = total de observações
- N_u = número de excessos
- α = nível de confiança (0.99, 0.999)
```

### Exemplo Real: S&P 500
| Medida | Normal (σ=1%) | EVT (ξ=0.25) | Diferença |
|--------|---------------|--------------|-----------|
| VaR 99% | 2.3% | 3.0% | +30% |
| VaR 99.9% | 3.1% | 5.6% | +81% |
| ES 99% | 2.7% | 4.1% | +52% |

### Aplicação no AR10
- **Tail Risk Dashboard:** VaR e ES realistas (não subestimam)
- **Stress Testing:** probabilidade de crash > 20%
- **Position Sizing:** limitar exposure baseado em EVT VaR
- **Kill Switch:** se EVT ES > limite, pausar trading

### Referência
- McNeil, Frey, Embrechts — Quantitative Risk Management (2015)
- Embrechts, Klüppelberg, Mikosch — Modelling Extremal Events (1997)

---

## 7. COPULAS

### O que é
Funções que modelam a estrutura de dependência entre variáveis aleatórias, separadamente das distribuições marginais.

### Por que importa
Em crises, correlações → 1. A copula captura isso.

### Tipos de Copulas

#### Gaussian Copula
```
C(u₁,...,u_d) = Φ_P(Φ⁻¹(u₁),...,Φ⁻¹(u_d))

Problema: λ_U = λ_L = 0 (sem tail dependence)
→ Falhou em 2008 (CDOs)
```

#### Student-t Copula
```
C(u₁,...,u_d) = t_ν,P(t_ν⁻¹(u₁),...,t_ν⁻¹(u_d))

Vantagem: tail dependence positivo
λ = 2 · t_ν+1( -√((ν+1)(1-ρ)/(1+ρ)) )

Quanto menor ν, mais cauda pesada e mais dependência em extremos.
```

#### Archimedean Copulas (Clayton, Gumbel)
```
Clayton: C(u,v) = (u^(-θ) + v^(-θ) - 1)^(-1/θ)
  → Assimétrica: mais dependência na cauda inferior (crises)

Gumbel: C(u,v) = exp{ -[(-ln u)^θ + (-ln v)^θ]^(1/θ) }
  → Assimétrica: mais dependência na cauda superior (rallies)
```

### Aplicação no AR10
- **Portfolio Risk:** modelar dependência entre múltiplos ativos
- **Correlation Breakdown Detection:** quando copula muda de Gaussian para t
- **Tail Risk Hedging:** identificar ativos que "quebram juntos"
- **Pairs Trading:** dependência não-linear entre pares

---

## 8. REDES BAYESIANAS / MODELOS GRÁFICOS PROBABILÍSTICOS

### O que é
Grafos direcionados acíclicos (DAG) que representam relações probabilísticas entre variáveis. Cada nó = variável. Cada aresta = dependência causal.

### Teorema de Bayes na Rede
```
P(X₁,...,X_n) = Π P(X_i | Pais(X_i))

Inferência: dado evidência em alguns nós, atualizar crenças nos outros.
```

### Estrutura para Trading
```
[Macro] → [Sentimento] → [Preço]
    ↓           ↓              ↓
[Vol]    → [Order Flow] → [Regime]
    ↓                        ↓
[Setup]  ← [Indicadores] ← [Sinal]
```

### Aplicação no AR10
- **Causal Inference:** "Se FOMC sobe, qual P(volatilidade ↑ | evidência)?"
- **Setup Scoring:** P(LONG | BOS=true, EMA=true, Volume=true)
- **Risk Aggregation:** P(Drawdown > 20% | múltiplos fatores)
- **LLM-Constructed BNs:** usar LLM para gerar estrutura + CPTs

### Algoritmos de Inferência
- **Variable Elimination:** exato, mas lento em redes grandes
- **Belief Propagation (Loopy BP):** aproximado, rápido
- **MCMC (Gibbs Sampling):** amostragem da posterior

### Referência
- Pearl, J. — Causality (2009)
- Koller & Friedman — Probabilistic Graphical Models (2009)

---

## 9. GEOMETRIA DA INFORMAÇÃO / NATURAL GRADIENT

### O que é
O espaço dos parâmetros de um modelo estatístico é uma variedade de Riemann. O gradiente natural segue a direção de maior decréscimo respeitando a geometria dessa variedade.

### Fórmula
```
θ_{t+1} = θ_t + η · F(θ_t)^(-1) · ∇_θ L(θ_t)

Onde:
- F(θ) = Fisher Information Matrix = E[∇log p(x|θ) · ∇log p(x|θ)ᵀ]
- F^(-1) = inversa da Fisher = pré-condicionador
- ∇_θ L = gradiente da loss

A atualização segue a direção de "steepest descent" na variedade estatística,
medida pela divergência KL, não pela distância euclidiana.
```

### Vantagem
- Converge 10-100x mais rápido que gradiente vanilla em problemas correlacionados
- Invariante a reparametrização
- Condição da Fisher explica a dificuldade: cond(F) >> 1 = loss surface skewed

### Aplicação no AR10
- **Otimização de Parâmetros de Estratégia:** otimizar thresholds de BOS, FVG, etc.
- **Meta-Learning:** otimizar learning rate de modelos online
- **Neural Network Training:** treinar redes de inferência de regime

### Referência
- Amari, S. — Information Geometry and Its Applications (2016)
- Martens, J. — New Insights and Perspectives on the Natural Gradient (2020)

---

## 10. ANÁLISE ESPECTRAL / FOURIER / WAVELET

### O que é
Decompor sinais de preço em componentes de frequência para identificar ciclos, tendências e ruído.

### Transformada de Fourier
```
X(f) = ∫ x(t) · e^(-i2πft) dt

Identifica frequências dominantes no preço (ciclos).
Problema: perde informação temporal (só vê frequência, não quando).
```

### Transformada Wavelet
```
W(a,b) = (1/√a) ∫ x(t) · ψ*((t-b)/a) dt

Onde:
- a = escala (inversamente proporcional à frequência)
- b = posição temporal
- ψ = wavelet mãe (ex: Morlet, Haar)

Vantagem: localização em tempo E frequência simultânea.
```

### Aplicação no AR10
- **Cycle Detection:** identificar ciclos dominantes (ex: 20-bar, 50-bar)
- **Trend vs Noise Separation:** low frequencies = trend, high = noise
- **Regime Detection:** mudança no espectro = mudança de regime
- **Anomaly Detection:** spike em alta frequência = flash crash

---

## 11. ANÁLISE MULTIFRACTAL / DFA (DETRENDED FLUCTUATION ANALYSIS)

### O que é
Generalização do Hurst Exponent. O mercado não tem UM expoente de Hurst — tem um ESPECTRO de expoentes, dependendo da escala.

### MF-DFA Algorithm
```
1. Construir perfil: Y(j) = Σ (x_i - ⟨x⟩)
2. Dividir em segmentos de tamanho s
3. Para cada segmento, remover tendência polinomial (detrend)
4. Calcular função de flutuação:
   F_q(s) = (1/(2N_s) · Σ [F²(ν,s)]^(q/2))^(1/q)
5. Plot log F_q(s) vs log s → slope = h(q)

h(q) = expoente de Hurst generalizado
- h(2) = Hurst clássico
- h(q) para q >> 2 = comportamento em extremos
- h(q) para q << 2 = comportamento em "valleys"

Se h(q) depende de q → multifractal (mercado é multifractal)
Se h(q) constante → monofractal
```

### Aplicação no AR10
- **Regime Detection:** h(q) muda em crises
- **Volatility Clustering:** multifractalidade = clustering de vol
- **Predictability:** mercados mais multifractais = mais previsíveis?

---

## 12. TEORIA DA INFORMAÇÃO / ENTROPIA / MUTUAL INFORMATION

### O que é
Medir quanta informação uma variável contém sobre outra. Eliminar redundância entre indicadores.

### Entropia de Shannon
```
H(X) = -Σ p(x) · log₂ p(x)

Mede a incerteza de X.
Maior entropia = mais incerteza = menos previsível.
```

### Mutual Information
```
I(X;Y) = H(X) - H(X|Y) = H(Y) - H(Y|X)

Mede quanto Y reduz a incerteza sobre X.
I(X;Y) = 0 → X e Y independentes
I(X;Y) = H(X) → Y determina X perfeitamente

Não-linear: captura dependências que correlação não captura.
```

### Aplicação no AR10
- **Feature Selection:** escolher indicadores que maximizam I(indicador; retorno)
- **Redundância Detection:** se I(EMA; SMA) ≈ H(EMA), são redundantes — remover um
- **Information Flow:** medir quanta informação "flui" de volume para preço
- **Market Efficiency:** H(preço) alto = mercado eficiente (difícil prever)

### Referência
- Shannon, C. — A Mathematical Theory of Communication (1948)
- Cover & Thomas — Elements of Information Theory (2006)

---

## 13. PROCESSOS DE LÉVY / JUMP DIFFUSION

### O que é
Generalização do movimento browniano que permite saltos (jumps). O mercado tem saltos (gaps, flash crashes) que Browniano puro não modela.

### SDE com Jumps (Merton Model)
```
dS = μS dt + σS dW + S dJ

Onde dJ = Σ (Y_i - 1) · dN_t

- N_t = processo de Poisson (conta saltos)
- Y_i = tamanho do salto (log-normal)
- λ = intensidade de salto (saltos por unidade de tempo)
```

### Lévy-driven OU
```
dX_t = -θ X_t dt + σ dL_t

Onde L_t é um processo de Lévy (combina Browniano + saltos + drift)
```

### Aplicação no AR10
- **Flash Crash Modeling:** saltos explicam gaps de abertura
- **Option Pricing:** volatilidade smile explicada por jumps
- **Risk Management:** P(salto > 10% em 1 dia)
- **Stop Loss Optimization:** considerar probabilidade de gap overnight

---

## 14. MÁQUINAS DE VETORES DE SUPORTE (SVM) COM KERNEL

### O que é
Classificador que encontra o hiperplano de separação ótimo em espaço de alta dimensionalidade (via kernel trick).

### Kernel Trick
```
K(x, x') = φ(x) · φ(x')

Não precisa calcular φ(x) explicitamente — só o produto interno no espaço de alta dimensão.

Kernels comuns:
- RBF/Gaussiano: K(x,x') = exp(-γ||x-x'||²)
- Polinomial: K(x,x') = (γ x·x' + r)^d
- Sigmoid: K(x,x') = tanh(γ x·x' + r)
```

### Aplicação no AR10
- **Classificador de Regime:** SVM com kernel RBF para trending vs ranging
- **Anomaly Detection:** One-class SVM para detectar outliers
- **Signal vs Noise:** SVM para classificar candles como "sinal" ou "ruído"

---

## 15. GAUSSIAN PROCESSES (GP)

### O que é
Distribuição sobre funções. Em vez de estimar um único valor, estima uma distribuição de probabilidade sobre TODAS as funções possíveis.

### Fórmula
```
f(x) ~ GP(m(x), k(x,x'))

Onde:
- m(x) = função média
- k(x,x') = função de covariância (kernel)

Predição em ponto novo x*:
- μ* = k*ᵀ · K⁻¹ · y
- σ*² = k(x*,x*) - k*ᵀ · K⁻¹ · k*

Retorna: média + incerteza (intervalo de confiança)
```

### Vantagem
- Incerteza natural (σ*)
- Poucos hiperparâmetros
- Funciona bem com poucos dados

### Aplicação no AR10
- **Bayesian Optimization:** otimizar parâmetros de estratégia (explora incerteza)
- **Regime Probability:** P(regime=trending | dados) com intervalo de confiança
- **Price Forecasting:** prever preço com banda de incerteza
- **Surrogate Model:** substituir simulação lenta por GP rápido

### Referência
- Rasmussen & Williams — Gaussian Processes for Machine Learning (2006)

---

## 16. REDES NEURAIS PROFUNDAS (LSTM, TRANSFORMER)

### LSTM (Long Short-Term Memory)
```
Célula com: input gate, forget gate, output gate, cell state

f_t = σ(W_f · [h_t-1, x_t] + b_f)  // forget
i_t = σ(W_i · [h_t-1, x_t] + b_i)  // input
C̃_t = tanh(W_C · [h_t-1, x_t] + b_C)  // candidate
C_t = f_t ⊙ C_t-1 + i_t ⊙ C̃_t  // update cell
o_t = σ(W_o · [h_t-1, x_t] + b_o)  // output
h_t = o_t ⊙ tanh(C_t)

Captura dependências de longo prazo em séries temporais.
```

### Transformer
```
Attention(Q,K,V) = softmax(QKᵀ/√d_k) · V

Multi-Head Attention = concat(head₁,...,head_h) · W^O

Onde head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)

Vantagem: paralelizável, captura relações de longa distância.
```

### Aplicação no AR10
- **LSTM:** prever retorno baseado em janela de candles
- **Transformer:** atenção sobre múltiplos timeframes simultaneamente
- **Encoder-Decoder:** encoder processa histórico, decoder prevê próximos N candles

---

## 17. REINFORCEMENT LEARNING (PPO, SAC, DQN)

### PPO (Proximal Policy Optimization)
```
maximize L^CLIP(θ) = E_t [ min(r_t(θ)·Â_t, clip(r_t(θ), 1-ε, 1+ε)·Â_t) ]

Onde:
- r_t(θ) = π_θ(a_t|s_t) / π_θ_old(a_t|s_t)  // ratio de políticas
- Â_t = vantagem estimada (Q - V)
- ε = 0.2 (clip parameter)

Evita atualizações muito grandes que destroem a política.
```

### SAC (Soft Actor-Critic)
```
Maximiza reward + entropia (exploração automática)

π* = arg max E[Σ γ^t (R_t + α·H(π(·|s_t)))]

Onde H = entropia da política, α = temperatura (auto-ajustável)
```

### Aplicação no AR10
- **Market Making:** agente aprende a cotar bid/ask otimizando P&L + inventory risk
- **Execution:** agente aprende a dividir ordem grande em slices ótimos
- **Strategy Selection:** agente escolhe qual setup usar em cada regime
- **Position Sizing:** agente aprende tamanho de posição ótimo

### Referência
- Sutton & Barto — Reinforcement Learning: An Introduction (2018)

---

## 18. META-LEARNING / MAML

### MAML (Model-Agnostic Meta-Learning)
```
Meta-objetivo: encontrar θ inicial que permite adaptação rápida

1. Samplear tarefas T_i ~ p(T)
2. Para cada tarefa:
   θ'_i = θ - α · ∇_θ L_Ti(f_θ)
   (1 gradient step na tarefa)
3. Meta-update:
   θ = θ - β · ∇_θ Σ L_Ti(f_θ'_i)
   (otimizar θ para que 1 step funcione bem)

Resultado: θ é um "bom ponto de partida" para qualquer tarefa.
```

### Aplicação no AR10
- **Adaptação a Novos Ativos:** treinar em BTC/ETH, adaptar em 10 trades para SOL/AVAX
- **Regime Adaptation:** meta-treinar em trending/ranging, adaptar em 5 candles para volatile
- **Fast Strategy Calibration:** ao invés de 1000 trades para calibrar, 10 trades

---

## 19. CAUSAL INFERENCE / DO-CALCULUS

### O que é
Distinguir correlação de causalidade. "X correlaciona com Y" ≠ "X causa Y".

### Do-Calculus (Pearl)
```
P(Y | do(X=x)) = Σ_z P(Y | X=x, Z=z) · P(Z=z)

Onde:
- do(X=x) = intervenção (forçar X a ser x)
- P(Y|do(X)) = efeito causal de X em Y
- P(Y|X) = correlação (pode ser confundida)
```

### Backdoor Criterion
```
Um conjunto Z satisfaz o backdoor criterion se:
1. Z bloqueia todos os caminhos confundidores entre X e Y
2. Nenhum nó em Z é descendente de X

Então: P(Y|do(X)) = Σ_z P(Y|X,Z) · P(Z)
```

### Aplicação no AR10
- **Causal Discovery:** "Volume causa volatilidade ou volatilidade causa volume?"
- **Intervention Analysis:** "Se eu mudar o stop de 1% para 2%, qual o efeito no P&L?"
- **Confounding Detection:** identificar variáveis ocultas que afetam sinais
- **Counterfactuals:** "Qual teria sido o P&L se eu tivesse operado em 15m em vez de 1h?"

### Referência
- Pearl, J. — The Book of Why (2018)
- Peters, Janzing, Schölkopf — Elements of Causal Inference (2017)

---

## 20. TOPOLOGICAL DATA ANALYSIS (TDA)

### O que é
Analisar a "forma" dos dados usando topologia. Persistent homology identifica features topológicas que persistem em múltiplas escalas.

### Persistent Homology
```
1. Construir complexo simplicial a partir dos dados (ex: Vietoris-Rips)
2. Aumentar o raio ε gradualmente
3. Rastrear quando "buracos" (ciclos) aparecem e desaparecem
4. Diagrama de persistência: (birth, death) de cada feature

Features que vivem muito (death >> birth) = estrutura real
Features que morrem rápido = ruído
```

### Aplicação no AR10
- **Market Structure:** identificar "buracos" no espaço de preço/volume
- **Regime Detection:** mudança na topologia = mudança de regime
- **Anomaly Detection:** ponto que muda a topologia = outlier
- **Clustering:** agrupar ativos pela "forma" do seu comportamento

---

## 21. ANÁLISE DE COMPONENTES INDEPENDENTES (ICA)

### O que é
Separar um sinal misturado em componentes estatisticamente independentes. Diferente de PCA (que busca componentes não-correlacionados).

### Modelo
```
X = A · S

Onde:
- X = sinais observados (mixture)
- A = matriz de mistura (desconhecida)
- S = componentes independentes (fontes)

Objetivo: estimar A e recuperar S.
```

### Aplicação no AR10
- **Blind Source Separation:** separar "trend signal" de "noise signal" no preço
- **Factor Extraction:** identificar fatores latentes independentes que movem o mercado
- **Noise Reduction:** reconstruir preço usando só os componentes principais

---

## 22. MODELOS DE MISTURA GAUSSIANA (GMM)

### O que é
Modelo de clustering probabilístico. Cada ponto pertence a cada cluster com uma probabilidade.

### Fórmula
```
p(x) = Σ_k π_k · N(x | μ_k, Σ_k)

Onde:
- π_k = peso do cluster k (Σ π_k = 1)
- μ_k, Σ_k = média e covariância do cluster k
- K = número de clusters

Algoritmo EM:
E-step: γ_nk = π_k · N(x_n|μ_k,Σ_k) / Σ_j π_j · N(x_n|μ_j,Σ_j)
M-step: atualizar μ_k, Σ_k, π_k usando γ_nk
```

### Aplicação no AR10
- **Regime Clustering:** clusters = trending, ranging, volatile
- **Volume Profile:** clusters de volume em níveis de preço
- **Market Microstructure:** identificar "regimes" de microstructure

---

## 23. PROCESSOS PONTUAIS / HAWKES

### O que é
Modelar eventos que se auto-excitan. Um evento aumenta a probabilidade de eventos futuros.

### Processo de Hawkes
```
λ(t) = μ + Σ_{t_i < t} φ(t - t_i)

Onde:
- λ(t) = intensidade (taxa de eventos em t)
- μ = intensidade base
- φ(t) = função de excitação (ex: φ(t) = α·e^(-βt))
- α = magnitude da excitação
- β = taxa de decaimento da excitação

Interpretação: cada trade excita mais trades (clustering).
```

### Aplicação no AR10
- **Trade Clustering:** modelar clustering de trades (burst de atividade)
- **Order Flow Prediction:** prever quando virá o próximo burst
- **Flash Crash Prediction:** intensidade λ(t) > threshold = alerta
- **Market Impact:** modelar impacto de uma ordem grande no tempo

---

## 24. TEORIA DOS JOGOS / EQUILÍBRIO DE NASH

### O que é
Modelar interação estratégica entre múltiplos agentes. Cada agente escolhe ação ótima dado o que espera dos outros.

### Equilíbrio de Nash
```
Um perfil de estratégias (s₁*,...,s_n*) é Nash se:
∀i: u_i(s_i*, s_{-i}*) ≥ u_i(s_i, s_{-i}*) ∀s_i

Ninguém pode melhorar unilateralmente.
```

### Aplicação no AR10
- **Market Making Game:** modelar interação entre market makers
- **Adverse Selection:** modelar informed traders vs uninformed
- **Auction Theory:** modelar execução em leilões (opening, closing)
- **Game-Theoretic Optimal:** estratégia que não pode ser explorada

---

## 25. OTIMIZAÇÃO ESTOCÁSTICA / SIMULATED ANNEALING

### Simulated Annealing
```
1. Começar com solução aleatória x, temperatura T alta
2. Perturbar x → x'
3. Se f(x') < f(x): aceitar
   Se f(x') > f(x): aceitar com probabilidade exp(-(f(x')-f(x))/T)
4. Diminuir T gradualmente
5. Repetir

A probabilidade de aceitar solução pior permite escapar de mínimos locais.
```

### Aplicação no AR10
- **Global Optimization:** otimizar parâmetros de estratégia (muitos mínimos locais)
- **Portfolio Optimization:** otimizar alocação com restrições não-convexas
- **Feature Selection:** selecionar subset ótimo de indicadores

---

## 26. ALGORITMOS GENÉTICOS / EVOLUTIVOS

### O que é
Otimização inspirada na evolução biológica. População de soluções que evoluem via seleção, crossover, mutação.

### Algoritmo
```
1. Inicializar população de N cromossomos (cada um = vetor de parâmetros)
2. Avaliar fitness de cada um (ex: Sharpe ratio da estratégia)
3. Selecionar pais (probabilidade ∝ fitness)
4. Crossover: combinar genes de dois pais
5. Mutação: perturbar genes aleatoriamente
6. Substituir população
7. Repetir por G gerações
```

### Aplicação no AR10
- **Strategy Evolution:** evoluir parâmetros de BOS, FVG, thresholds
- **Feature Engineering:** evoluir combinações de indicadores
- **Walk-Forward:** cada geração validada out-of-sample

---

## 27. PROGRAMAÇÃO DINÂMICA ESTOCÁSTICA

### O que é
Resolver problemas de decisão sequencial sob incerteza. Bellman equation.

### Equação de Bellman
```
V(s) = max_a [ R(s,a) + γ · E[V(s') | s,a] ]

Onde:
- V(s) = valor do estado s
- R(s,a) = reward imediato de tomar ação a em s
- γ = fator de desconto
- s' = próximo estado (estocástico)

Solução: trabalhar para trás (backward induction) ou iterar.
```

### Aplicação no AR10
- **Optimal Execution:** quando e quanto executar de uma ordem grande
- **Optimal Stopping:** quando sair de um trade (exercer opção)
- **Inventory Management:** quanto inventory manter como market maker

---

## 28. MÉTRICAS DE RIEMANN / MANIFOLD LEARNING

### O que é
Os dados financeiros não vivem em espaço euclidiano — vivem em uma variedade (manifold) de dimensão menor. Manifold learning encontra essa estrutura.

### Algoritmos
| Algoritmo | O que faz |
|-----------|-----------|
| **Isomap** | Preserva distâncias geodésicas |
| **LLE** | Preserva relações locais |
| **t-SNE** | Preserva similaridades locais (visualização) |
| **UMAP** | Preserva estrutura global e local |

### Aplicação no AR10
- **Dimensionality Reduction:** reduzir 100 features para 5-10 dimensões
- **Visualization:** visualizar estrutura do mercado em 2D/3D
- **Clustering:** agrupar regimes em manifold

---

## 29. TEORIA DO CAOS / LYAPUNOV EXPONENTS

### O que é
Sistemas determinísticos que parecem aleatórios. Pequenas mudanças nas condições iniciais levam a grandes diferenças.

### Lyapunov Exponent
```
λ = lim_{t→∞} (1/t) · ln(|δx(t)| / |δx(0)|)

Onde:
- λ > 0: caótico (sensível a condições iniciais)
- λ = 0: marginalmente estável
- λ < 0: estável (converge)

Em mercados: λ > 0 significa previsibilidade de curto prazo, impossibilidade de longo prazo.
```

### Aplicação no AR10
- **Predictability Horizon:** 1/λ = tempo máximo de previsibilidade
- **Regime Detection:** λ muda em crises
- **Sensitivity Analysis:** quão sensível é a estratégia a condições iniciais

---

## 30. PROCESSOS DE RAMIFICAÇÃO / GALTON-WATSON

### O que é
Modelar crescimento e extinção de "populações" (ex: ordens, trades, clusters de volatilidade).

### Modelo
```
Z_{n+1} = Σ_{i=1}^{Z_n} X_i

Onde:
- Z_n = número de indivíduos na geração n
- X_i = número de filhos do indivíduo i (i.i.d.)
- μ = E[X] = média de filhos

Se μ < 1: extinção certa
Se μ = 1: crítico
Se μ > 1: crescimento exponencial possível
```

### Aplicação no AR10
- **Order Cascade:** modelar cascatas de ordens (uma ordem grande gera muitas pequenas)
- **Volatility Clustering:** cluster de volatilidade como processo de ramificação
- **Flash Crash:** modelar propagação de crash como cascata

---

# 🎯 ROTEIRO DE IMPLEMENTAÇÃO SUGERIDO (documento original — ver nota de arquivamento no topo)

## Fase 1: Fundação
| # (doc. original) | Motor | Prioridade | Complexidade |
|---|-------|------------|--------------|
| 41 | Profitability Engine + Expectancy | ⭐⭐⭐⭐⭐ | Média |
| 42 | Regime Detector (ATR/ADX + HMM) | ⭐⭐⭐⭐⭐ | Média |
| 43 | Monte Carlo + Drawdown | ⭐⭐⭐⭐⭐ | Média |
| 44 | Kelly Criterion + Position Sizing | ⭐⭐⭐⭐⭐ | Baixa |
| 45 | Kalman Filter (Trend Estimation) | ⭐⭐⭐⭐ | Alta |
| 46 | OU Process (Mean Reversion) | ⭐⭐⭐⭐ | Média |
| 47 | EVT (Tail Risk, VaR, ES) | ⭐⭐⭐⭐ | Alta |
| 48 | Entropy + Mutual Information | ⭐⭐⭐⭐ | Média |
| 49 | Copulas (Tail Dependence) | ⭐⭐⭐ | Alta |
| 50 | Particle Filter (Non-linear Regime) | ⭐⭐⭐ | Muito Alta |

## Fase 2: Machine Learning
| # (doc. original) | Motor | Prioridade | Complexidade |
|---|-------|------------|--------------|
| 51 | Ensemble (RF + XGBoost) | ⭐⭐⭐⭐⭐ | Média |
| 52 | Gaussian Processes | ⭐⭐⭐⭐ | Alta |
| 53 | SVM com Kernel | ⭐⭐⭐ | Média |
| 54 | LSTM para Séries Temporais | ⭐⭐⭐⭐ | Alta |
| 55 | Transformer (Multi-Timeframe) | ⭐⭐⭐ | Muito Alta |
| 56 | Reinforcement Learning (PPO) | ⭐⭐⭐⭐ | Muito Alta |
| 57 | Meta-Learning (MAML) | ⭐⭐⭐ | Muito Alta |
| 58 | Anomaly Detection (Isolation Forest) | ⭐⭐⭐⭐ | Média |
| 59 | GMM Clustering | ⭐⭐⭐ | Baixa |
| 60 | ICA (Blind Source Separation) | ⭐⭐⭐ | Média |

## Fase 3: Cérebro Avançado
| # (doc. original) | Motor | Prioridade | Complexidade |
|---|-------|------------|--------------|
| 61 | Bayesian Networks | ⭐⭐⭐⭐ | Alta |
| 62 | Causal Inference (Do-Calculus) | ⭐⭐⭐ | Muito Alta |
| 63 | Topological Data Analysis | ⭐⭐⭐ | Muito Alta |
| 64 | Spectral Analysis / Wavelet | ⭐⭐⭐ | Alta |
| 65 | Multifractal DFA | ⭐⭐⭐ | Muito Alta |
| 66 | Natural Gradient Optimization | ⭐⭐⭐ | Alta |
| 67 | Jump Diffusion / Lévy | ⭐⭐⭐ | Alta |
| 68 | Hawkes Processes | ⭐⭐⭐ | Alta |
| 69 | Game Theory / Nash | ⭐⭐⭐ | Muito Alta |
| 70 | Chaos Theory / Lyapunov | ⭐⭐⭐ | Alta |

## Fase 4: Meta-Cognição
| # (doc. original) | Motor | Prioridade | Complexidade |
|---|-------|------------|--------------|
| 71 | Genetic Algorithms | ⭐⭐⭐⭐ | Média |
| 72 | Simulated Annealing | ⭐⭐⭐ | Média |
| 73 | Stochastic Dynamic Programming | ⭐⭐⭐⭐ | Alta |
| 74 | Manifold Learning (UMAP) | ⭐⭐⭐ | Alta |
| 75 | Branching Processes | ⭐⭐⭐ | Média |
| 76 | Self-Optimization Loop | ⭐⭐⭐⭐⭐ | Muito Alta |
| 77 | Edge Decay (CUSUM) | ⭐⭐⭐⭐ | Média |
| 78 | Performance Attribution (Brinson) | ⭐⭐⭐⭐ | Média |
| 79 | Kill Switch System | ⭐⭐⭐⭐⭐ | Baixa |
| 80 | Governance Dashboard | ⭐⭐⭐⭐ | Média |

> Os números `#` acima são os do documento original recebido — não
> correspondem à numeração real de entregas deste repositório (ver nota de
> arquivamento no topo). Nenhuma linha desta tabela é, por si só, um pedido
> de trabalho.

---

# 📖 REFERÊNCIAS BIBLIOGRÁFICAS

### Fundação Matemática
1. Shreve, S. — Stochastic Calculus for Finance I & II (2004)
2. Øksendal, B. — Stochastic Differential Equations (2003)
3. Baxter & Rennie — Financial Calculus (1996)
4. Brigo & Mercurio — Interest Rate Models (2006)

### Estatística e Probabilidade
5. McNeil, Frey, Embrechts — Quantitative Risk Management (2015)
6. Embrechts et al. — Modelling Extremal Events (1997)
7. Joe, H. — Dependence Modeling with Copulas (2014)
8. Nelsen, R. — An Introduction to Copulas (2006)

### Machine Learning
9. Rasmussen & Williams — Gaussian Processes for ML (2006)
10. Sutton & Barto — Reinforcement Learning: An Introduction (2018)
11. Goodfellow, Bengio, Courville — Deep Learning (2016)
12. Hastie, Tibshirani, Friedman — The Elements of Statistical Learning (2009)

### Causalidade e Inferência
13. Pearl, J. — Causality (2009)
14. Pearl & Mackenzie — The Book of Why (2018)
15. Peters, Janzing, Schölkopf — Elements of Causal Inference (2017)

### Otimização e Geometria
16. Amari, S. — Information Geometry and Its Applications (2016)
17. Boyd & Vandenberghe — Convex Optimization (2004)
18. Nocedal & Wright — Numerical Optimization (2006)

### Mercado e Microestrutura
19. Hasbrouck, J. — Empirical Market Microstructure (2007)
20. Easley, López de Prado, O'Hara — Flow Toxicity (2012)
21. Cont, R. — Empirical Properties of Asset Returns (2001)

---

# 🏁 STATUS

Catálogo de referência arquivado por pedido do Operador (2026-08-10). Zero
destes 30 motores está implementado neste repositório até esta data. Cada
um, se e quando entrar em escopo, segue o mesmo ciclo já estabelecido nas
Entregas 41-43: auditar o que já existe antes de escrever qualquer linha
nova (ex.: a Entrega 43 já cobriu parte do motor #4 — Filtro de Kalman não,
mas confirmou que ADX/ATR Wilder-suavizados já são reais e não devem ser
reimplementados), isolar em `research/engines/` com teste de execução real
antes de qualquer graduação, e nunca tratar "confiança"/score de um motor
novo como probabilidade calibrada sem backtest real (Regra de Ouro 2 do
`CLAUDE.md`).

**Autor (documento original):** AR10 ORION Intelligence Architect
**Arquivado por:** sessão Claude Code, a pedido do Operador
**Data:** 2026-08-10
