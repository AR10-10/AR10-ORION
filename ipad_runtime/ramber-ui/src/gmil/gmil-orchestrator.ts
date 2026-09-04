// gmil-orchestrator.ts — GMIL LEI 02 pipeline montado de verdade:
// Providers → (circuit-breaker + quality-engine) → Global Event Bus →
// consensus-engine. Cada provedor sonda no seu próprio intervalo,
// respeitando seu próprio circuito — a falha de um nunca atrasa nem
// derruba os outros (LEI 06).
import { gmilBus } from './event-bus';
import {
  createCircuitBreaker,
  beforeAttempt,
  afterSuccess,
  afterFailure,
  type CircuitBreakerState,
} from './circuit-breaker';
import { computeQuality } from './quality-engine';
import { computeConsensus, type ConsensusResult } from './consensus-engine';
import { aggregateContextBiases, type ContextBiases } from './context-aggregator';
import { fetchCoinGeckoGlobal } from './providers/coingecko-provider';
import { fetchFearGreedIndex } from './providers/fear-greed-provider';
import { fetchTrendingCoins } from './providers/trending-provider';
import { fetchDerivativesPositioning } from './providers/derivatives-provider';
import { fetchOnchainTvlFlow } from './providers/defillama-provider';
import type { GmilProviderDef, ProviderFetchResult } from './types';

// Fontes concretamente viáveis para uma PWA estática sem backend (ver
// README.md deste diretório para a avaliação completa das ~15 fontes
// pedidas no protocolo V10.1 e por que as demais foram adiadas).
const PROVIDERS: GmilProviderDef[] = [
  {
    id: 'coingecko_global',
    label: 'CoinGecko · Market Cap Global',
    category: 'BLOCKCHAIN',
    intervalMs: 90_000,
    fetch: fetchCoinGeckoGlobal,
  },
  {
    id: 'fear_greed_index',
    label: 'Alternative.me · Fear & Greed',
    category: 'SENTIMENT',
    intervalMs: 90_000,
    fetch: fetchFearGreedIndex,
  },
  {
    id: 'trending_coins',
    label: 'CoinGecko · Trending (24h)',
    category: 'ATTENTION',
    // Intervalo mais longo: trending muda devagar (é um agregado de 24h) e
    // é o 3º provedor batendo no mesmo host de coingecko_global — espaçar
    // reduz a chance de qualquer rate-limit público conjunto dos dois.
    intervalMs: 180_000,
    fetch: fetchTrendingCoins,
  },
  {
    // Fase E (V15 Cap. 3/7): feed combinado Spot×Perpetual real — funding
    // + basis (mark vs index) numa única resposta atômica de endpoint
    // público sem chave. 120s: funding muda a cada 8h, basis flutua devagar
    // — sondar mais rápido só gastaria rede sem informação nova.
    id: 'derivatives_positioning',
    label: 'Binance Futures · Funding/Basis BTC',
    category: 'DERIVATIVES',
    intervalMs: 120_000,
    fetch: fetchDerivativesPositioning,
  },
  {
    // Ordem Mestra §7 (On-Chain e DeFi): categoria ONCHAIN sai do null
    // honesto pela primeira vez — TVL agregado real via DefiLlama, sem
    // chave. Intervalo longo: TVL histórico só atualiza 1x/dia na fonte,
    // sondar mais rápido não traria dado novo (mesma lógica de
    // trending_coins acima).
    id: 'onchain_tvl_flow',
    label: 'DefiLlama · Fluxo de TVL Agregado (7d)',
    category: 'ONCHAIN',
    intervalMs: 300_000,
    fetch: fetchOnchainTvlFlow,
  },
];

export interface ProviderRuntimeSnapshot {
  id: string;
  label: string;
  category: string;
  circuitState: CircuitBreakerState['state'];
  lastReading: ProviderFetchResult | null;
  lastSuccessAt: number | null;
  lastLatencyMs: number | null;
  weight: number;
}

export interface GmilSnapshot {
  providers: ProviderRuntimeSnapshot[];
  consensus: ConsensusResult;
  // Fase E (V15 Cap. 6): as 4 saídas oficiais do GMIL, particionadas por
  // categoria pelo context-aggregator — MESMA matemática computeConsensus
  // (LEI 04), só particionamento diferente. Categorias sem provedor ativo
  // (MACRO, ONCHAIN) produzem score null honesto, nunca um neutro
  // fabricado.
  biases: ContextBiases;
}

class GmilOrchestrator {
  private circuits = new Map<string, CircuitBreakerState>();
  private lastReadings = new Map<string, ProviderFetchResult>();
  private lastSuccessAt = new Map<string, number>();
  private lastLatencyMs = new Map<string, number | null>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    for (const provider of PROVIDERS) {
      this.circuits.set(provider.id, createCircuitBreaker());
      const run = () => {
        this.runOnce(provider).catch(() => {
          // runOnce já é fail-closed internamente (provider.fetch() nunca
          // rejeita); este catch existe só para nunca deixar uma promise
          // rejeitada escapar do timer e virar um unhandledrejection.
        });
      };
      run();
      this.timers.push(setInterval(run, provider.intervalMs));
    }
  }

  stop(): void {
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.started = false;
  }

  private async runOnce(provider: GmilProviderDef): Promise<void> {
    const now = Date.now();
    const cb = this.circuits.get(provider.id) ?? createCircuitBreaker();
    const { allowed, state } = beforeAttempt(cb, now);
    this.circuits.set(provider.id, state);
    if (!allowed) return;

    const startedAt = Date.now();
    const result = await provider.fetch();
    this.lastLatencyMs.set(provider.id, Date.now() - startedAt);
    this.lastReadings.set(provider.id, result);

    const prevState = this.circuits.get(provider.id)!.state;
    this.circuits.set(
      provider.id,
      result.ok ? afterSuccess(this.circuits.get(provider.id)!) : afterFailure(this.circuits.get(provider.id)!, now),
    );
    if (result.ok) this.lastSuccessAt.set(provider.id, result.fetchedAt);

    const nextState = this.circuits.get(provider.id)!.state;
    if (nextState !== prevState) {
      gmilBus.emit('PROVIDER_HEALTH_CHANGED', { providerId: provider.id, from: prevState, to: nextState });
    }

    gmilBus.emit('PROVIDER_READING', { providerId: provider.id, result });
    gmilBus.emit('CONSENSUS_UPDATED', this.getSnapshot().consensus);
  }

  getSnapshot(): GmilSnapshot {
    const providers: ProviderRuntimeSnapshot[] = PROVIDERS.map((p) => {
      const circuit = this.circuits.get(p.id) ?? createCircuitBreaker();
      const successAt = this.lastSuccessAt.get(p.id) ?? null;
      const quality = computeQuality({
        latencyMs: this.lastLatencyMs.get(p.id) ?? null,
        consecutiveFailures: circuit.consecutiveFailures,
        ageMs: successAt === null ? null : Date.now() - successAt,
        circuitState: circuit.state,
      });
      return {
        id: p.id,
        label: p.label,
        category: p.category,
        circuitState: circuit.state,
        lastReading: this.lastReadings.get(p.id) ?? null,
        lastSuccessAt: successAt,
        lastLatencyMs: this.lastLatencyMs.get(p.id) ?? null,
        weight: quality.weight,
      };
    });
    const consensusInputs = providers.map((p, i) => ({
      providerId: p.id,
      lean: p.lastReading?.lean ?? null,
      weight: p.weight,
      category: PROVIDERS[i].category,
    }));
    const consensus = computeConsensus(consensusInputs);
    // Fase E: os 4 vieses da Constituição sobre as MESMAS linhas — nenhuma
    // segunda coleta, nenhum segundo peso, nenhuma segunda matemática.
    const biases = aggregateContextBiases(consensusInputs);
    return { providers, consensus, biases };
  }
}

// Singleton — mesmo padrão do getWorkerClient() em engine-bridge.ts.
export const gmilOrchestrator = new GmilOrchestrator();
